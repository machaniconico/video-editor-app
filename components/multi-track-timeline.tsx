import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  GestureResponderEvent,
  NativeTouchEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { launchImageLibraryAsync } from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  TimelineTrack,
  TimelineClip,
  TrackType,
  getNextTrackColor,
} from "@/lib/editor-context";

interface MultiTrackTimelineProps {
  tracks: TimelineTrack[];
  totalDuration: number;
  onTracksChange: (tracks: TimelineTrack[]) => void;
  onClipSelect?: (trackId: string, clipId: string) => void;
  selectedClipId?: string | null;
  isLandscape?: boolean;
  /** Current playback position in seconds (for playhead display) */
  currentTime?: number;
}

// Zoom: continuous seconds-per-screen (not discrete levels)
const ZOOM_MIN = 3;
const ZOOM_MAX = 300;
const ZOOM_PRESETS = [5, 10, 20, 30, 60, 120, 300];
const TRACK_ROW_HEIGHT = 54;
const HANDLE_HIT_SLOP = 20; // extra touch area for handles
const LONG_PRESS_DELAY = 350;

type DragMode = "none" | "trim-left" | "trim-right" | "move";

interface DragState {
  mode: DragMode;
  trackId: string;
  clipId: string;
  originalClip: TimelineClip;
  originalTrackIndex: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  isLongPress: boolean;
  startX: number;
  startY: number;
}

export function MultiTrackTimeline({
  tracks,
  totalDuration,
  onTracksChange,
  onClipSelect,
  selectedClipId,
  isLandscape = false,
  currentTime = 0,
}: MultiTrackTimelineProps) {
  const colors = useColors();
  const [secondsPerScreen, setSecondsPerScreen] = useState(30);
  const pixelsPerSecond = 300 / secondsPerScreen;

  // Pinch zoom state
  const pinchRef = useRef({
    active: false,
    initialDistance: 0,
    initialZoom: 30,
  });

  // Drag state ref
  const dragRef = useRef<DragState>({
    mode: "none",
    trackId: "",
    clipId: "",
    originalClip: {} as TimelineClip,
    originalTrackIndex: 0,
    longPressTimer: null,
    isLongPress: false,
    startX: 0,
    startY: 0,
  });
  const [activeDrag, setActiveDrag] = useState<{ mode: DragMode; clipId: string } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [trimLeftDelta, setTrimLeftDelta] = useState(0);
  const [trimRightDelta, setTrimRightDelta] = useState(0);

  // Store latest pixelsPerSecond in ref for use in trim callbacks
  const ppsRef = useRef(pixelsPerSecond);
  ppsRef.current = pixelsPerSecond;

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  }, []);

  // ---- Zoom controls ----
  const zoomIn = () => {
    setSecondsPerScreen((prev) => {
      const idx = ZOOM_PRESETS.findIndex((v) => v >= prev);
      const newIdx = Math.max(0, (idx <= 0 ? 0 : idx - 1));
      return ZOOM_PRESETS[newIdx];
    });
    haptic();
  };

  const zoomOut = () => {
    setSecondsPerScreen((prev) => {
      const idx = ZOOM_PRESETS.findIndex((v) => v > prev);
      const newIdx = idx === -1 ? ZOOM_PRESETS.length - 1 : Math.min(ZOOM_PRESETS.length - 1, idx);
      return ZOOM_PRESETS[newIdx];
    });
    haptic();
  };

  // ---- Pinch zoom on ruler ----
  const getDistance = (touches: NativeTouchEvent[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onRulerTouchStart = (evt: GestureResponderEvent) => {
    const touches = (evt.nativeEvent as any).touches || [];
    if (touches.length === 2) {
      pinchRef.current = {
        active: true,
        initialDistance: getDistance(touches),
        initialZoom: secondsPerScreen,
      };
    }
  };

  const onRulerTouchMove = (evt: GestureResponderEvent) => {
    const touches = (evt.nativeEvent as any).touches || [];
    if (!pinchRef.current.active || touches.length < 2) return;

    const currentDistance = getDistance(touches);
    if (pinchRef.current.initialDistance === 0) return;

    const scale = currentDistance / pinchRef.current.initialDistance;
    // Wider pinch = zoom in (fewer seconds per screen)
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchRef.current.initialZoom / scale));
    setSecondsPerScreen(newZoom);
  };

  const onRulerTouchEnd = () => {
    pinchRef.current.active = false;
  };

  // ---- Track operations ----
  const toggleMute = (trackId: string) => {
    haptic();
    onTracksChange(tracks.map((t) => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
  };

  const toggleVisibility = (trackId: string) => {
    haptic();
    onTracksChange(tracks.map((t) => t.id === trackId ? { ...t, isHidden: !t.isHidden } : t));
  };

  const toggleSolo = (trackId: string) => {
    haptic();
    onTracksChange(tracks.map((t) => t.id === trackId ? { ...t, isSolo: !t.isSolo } : t));
  };

  const adjustTrackVolume = (trackId: string, delta: number) => {
    haptic();
    onTracksChange(tracks.map((t) => {
      if (t.id !== trackId) return t;
      return { ...t, volume: Math.max(0, Math.min(1, t.volume + delta)) };
    }));
  };

  const addTrack = (type: TrackType) => {
    if (type === "video" || type === "audio") {
      launchImageLibraryAsync({
        mediaTypes: type === "video" ? ["videos"] : ["videos"],
        quality: 0.8,
      }).then((result) => {
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const dur = (asset.duration ?? 0) / 1000;
          const existingCount = tracks.filter((t) => t.type === type).length;
          const label = type === "video" ? `ビデオ ${existingCount + 1}` : `音声 ${existingCount + 1}`;
          const newTrack: TimelineTrack = {
            id: `track_${type[0]}${existingCount + 1}_${Date.now()}`,
            type,
            label,
            clips: [{
              id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              sourceUri: asset.uri,
              name: label,
              duration: dur,
              trimStart: 0,
              trimEnd: dur,
              timelineOffset: 0,
              speed: 1.0,
              volume: 1.0,
            }],
            isMuted: false,
            isSolo: false,
            volume: 1.0,
            color: getNextTrackColor(type, existingCount),
          };
          onTracksChange([...tracks, newTrack]);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        }
      });
    } else {
      const existingCount = tracks.filter((t) => t.type === "bgm").length;
      const newTrack: TimelineTrack = {
        id: `track_bgm${existingCount + 1}_${Date.now()}`,
        type: "bgm",
        label: `BGM ${existingCount + 1}`,
        clips: [],
        isMuted: false,
        isSolo: false,
        volume: 0.7,
        color: getNextTrackColor("bgm", existingCount),
      };
      onTracksChange([...tracks, newTrack]);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const removeTrack = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const doRemove = () => {
      onTracksChange(tracks.filter((t) => t.id !== trackId));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    if (Platform.OS === "web") {
      if (confirm(`「${track.label}」トラックを削除しますか？`)) doRemove();
    } else {
      Alert.alert("トラック削除", `「${track.label}」トラックを削除しますか？`, [
        { text: "キャンセル", style: "cancel" },
        { text: "削除", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  const adjustClipSpeed = (trackId: string, clipId: string, newSpeed: number) => {
    haptic();
    onTracksChange(tracks.map((t) => {
      if (t.id !== trackId) return t;
      return { ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, speed: Math.max(0.25, Math.min(10, newSpeed)) } : c) };
    }));
  };

  const adjustClipVolume = (trackId: string, clipId: string, delta: number) => {
    haptic();
    onTracksChange(tracks.map((t) => {
      if (t.id !== trackId) return t;
      return { ...t, clips: t.clips.map((c) => c.id === clipId ? { ...c, volume: Math.max(0, Math.min(1, c.volume + delta)) } : c) };
    }));
  };

  // ---- Trim handle drag (immediate, no long press needed) ----
  const startTrimDrag = (
    mode: "trim-left" | "trim-right",
    trackId: string,
    clip: TimelineClip,
    evt: GestureResponderEvent
  ) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    dragRef.current = {
      mode,
      trackId,
      clipId: clip.id,
      originalClip: { ...clip },
      originalTrackIndex: trackIndex,
      longPressTimer: null,
      isLongPress: false,
      startX: evt.nativeEvent.pageX,
      startY: evt.nativeEvent.pageY,
    };
    setActiveDrag({ mode, clipId: clip.id });
    setTrimLeftDelta(0);
    setTrimRightDelta(0);
    haptic();
  };

  const onTrimMove = (evt: GestureResponderEvent) => {
    const drag = dragRef.current;
    if (drag.mode !== "trim-left" && drag.mode !== "trim-right") return;

    const dx = evt.nativeEvent.pageX - drag.startX;
    const deltaSec = dx / ppsRef.current;

    if (drag.mode === "trim-left") {
      const maxDelta = drag.originalClip.trimEnd - drag.originalClip.trimStart - 0.5;
      const minDelta = -drag.originalClip.trimStart;
      setTrimLeftDelta(Math.max(minDelta, Math.min(maxDelta, deltaSec)));
    } else {
      const maxDelta = drag.originalClip.duration - drag.originalClip.trimEnd;
      const minDelta = -(drag.originalClip.trimEnd - drag.originalClip.trimStart - 0.5);
      setTrimRightDelta(Math.max(minDelta, Math.min(maxDelta, deltaSec)));
    }
  };

  const onTrimEnd = () => {
    const drag = dragRef.current;
    if (drag.mode !== "trim-left" && drag.mode !== "trim-right") return;

    onTracksChange(tracks.map((t) => {
      if (t.id !== drag.trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== drag.clipId) return c;
          if (drag.mode === "trim-left") {
            const newTrimStart = Math.max(0, Math.min(c.trimEnd - 0.5, drag.originalClip.trimStart + trimLeftDelta));
            // When left-trimming, shift timelineOffset by the amount trimmed
            const trimDelta = newTrimStart - drag.originalClip.trimStart;
            const newOffset = Math.max(0, drag.originalClip.timelineOffset + (trimDelta / c.speed));
            return { ...c, trimStart: newTrimStart, timelineOffset: newOffset };
          } else {
            const newTrimEnd = Math.max(c.trimStart + 0.5, Math.min(drag.originalClip.duration, drag.originalClip.trimEnd + trimRightDelta));
            return { ...c, trimEnd: newTrimEnd };
          }
        }),
      };
    }));

    dragRef.current.mode = "none";
    setActiveDrag(null);
    setTrimLeftDelta(0);
    setTrimRightDelta(0);
  };

  // ---- Long press + drag move (horizontal only, same track) ----
  const startMoveDrag = (
    trackId: string,
    clip: TimelineClip,
    evt: GestureResponderEvent
  ) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    const timer = setTimeout(() => {
      dragRef.current.isLongPress = true;
      dragRef.current.mode = "move";
      setActiveDrag({ mode: "move", clipId: clip.id });
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    }, LONG_PRESS_DELAY);

    dragRef.current = {
      mode: "none",
      trackId,
      clipId: clip.id,
      originalClip: { ...clip },
      originalTrackIndex: trackIndex,
      longPressTimer: timer,
      isLongPress: false,
      startX: evt.nativeEvent.pageX,
      startY: evt.nativeEvent.pageY,
    };
    setDragOffsetX(0);
  };

  const onMoveMove = (evt: GestureResponderEvent) => {
    const drag = dragRef.current;
    const dx = evt.nativeEvent.pageX - drag.startX;
    const dy = evt.nativeEvent.pageY - drag.startY;

    // Cancel long press if moved too much before it triggers
    if (!drag.isLongPress && drag.longPressTimer) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearTimeout(drag.longPressTimer);
        drag.longPressTimer = null;
        return;
      }
    }

    if (drag.mode !== "move") return;
    // Only horizontal movement (no cross-track)
    setDragOffsetX(dx);
  };

  const onMoveEnd = () => {
    const drag = dragRef.current;

    if (drag.longPressTimer) {
      clearTimeout(drag.longPressTimer);
      drag.longPressTimer = null;
    }

    if (drag.mode !== "move") {
      dragRef.current.mode = "none";
      setActiveDrag(null);
      return;
    }

    // Apply horizontal move (same track only)
    const deltaSec = dragOffsetX / ppsRef.current;
    const newOffset = Math.max(0, drag.originalClip.timelineOffset + deltaSec);

    onTracksChange(tracks.map((t) => {
      if (t.id !== drag.trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === drag.clipId ? { ...c, timelineOffset: newOffset } : c
        ),
      };
    }));

    dragRef.current.mode = "none";
    setActiveDrag(null);
    setDragOffsetX(0);
  };

  // ---- Rendering ----
  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 300);

  const rulerInterval = secondsPerScreen <= 10 ? 1 : secondsPerScreen <= 30 ? 5 : secondsPerScreen <= 60 ? 10 : 30;
  const rulerMarks: number[] = [];
  for (let t = 0; t <= totalDuration; t += rulerInterval) {
    rulerMarks.push(t);
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getTrackIcon = (type: TrackType): any => {
    switch (type) {
      case "video": return "film";
      case "audio": return "waveform";
      case "bgm": return "music.note";
    }
  };

  const renderClip = (track: TimelineTrack, clip: TimelineClip) => {
    const isSelected = selectedClipId === clip.id;
    const isDragging = activeDrag?.clipId === clip.id;
    const isDragMove = isDragging && activeDrag?.mode === "move";
    const isTrimLeft = isDragging && activeDrag?.mode === "trim-left";
    const isTrimRight = isDragging && activeDrag?.mode === "trim-right";

    let visualTrimStart = clip.trimStart;
    let visualTrimEnd = clip.trimEnd;
    if (isTrimLeft) {
      visualTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.5, clip.trimStart + trimLeftDelta));
    }
    if (isTrimRight) {
      visualTrimEnd = Math.max(clip.trimStart + 0.5, Math.min(clip.duration, clip.trimEnd + trimRightDelta));
    }

    const clipWidth = ((visualTrimEnd - visualTrimStart) / clip.speed) * pixelsPerSecond;
    const clipLeft = clip.timelineOffset * pixelsPerSecond;

    return (
      <View
        key={clip.id}
        style={[
          st.clipOuter,
          {
            left: clipLeft,
            width: Math.max(clipWidth, 30 + HANDLE_HIT_SLOP * 2),
          },
          isDragMove && {
            transform: [{ translateX: dragOffsetX }],
            zIndex: 100,
            opacity: 0.85,
          },
        ]}
      >
        {/* Left trim handle - large hit area */}
        <View
          style={[
            st.trimHandleHitArea,
            { left: 0 },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => {
            evt.stopPropagation?.();
            startTrimDrag("trim-left", track.id, clip, evt);
          }}
          onResponderMove={onTrimMove}
          onResponderRelease={onTrimEnd}
          onResponderTerminate={onTrimEnd}
        >
          <View
            style={[
              st.trimHandleVisible,
              st.trimHandleLeftShape,
              {
                backgroundColor: isTrimLeft ? track.color : `${track.color}90`,
                borderColor: isTrimLeft ? track.color : `${track.color}50`,
              },
            ]}
          >
            <View style={st.trimHandleBar} />
          </View>
        </View>

        {/* Clip body (long press to move horizontally) */}
        <View
          style={[
            st.clipBody,
            {
              marginLeft: HANDLE_HIT_SLOP,
              marginRight: HANDLE_HIT_SLOP,
              backgroundColor: `${track.color}${isSelected ? "50" : "25"}`,
              borderColor: isSelected ? track.color : `${track.color}60`,
            },
            isDragMove && { borderColor: track.color, borderWidth: 2 },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => startMoveDrag(track.id, clip, evt)}
          onResponderMove={onMoveMove}
          onResponderRelease={() => {
            const drag = dragRef.current;
            if (!drag.isLongPress && drag.mode !== "move") {
              if (drag.longPressTimer) {
                clearTimeout(drag.longPressTimer);
                drag.longPressTimer = null;
              }
              onClipSelect?.(track.id, clip.id);
            }
            onMoveEnd();
          }}
          onResponderTerminate={onMoveEnd}
        >
          <Text style={[st.clipName, { color: track.color }]} numberOfLines={1}>
            {clip.name}
          </Text>
          <View style={st.clipInfo}>
            <Text style={[st.clipDuration, { color: `${track.color}AA` }]}>
              {formatTime((visualTrimEnd - visualTrimStart) / clip.speed)}
            </Text>
            {clip.speed !== 1.0 && (
              <Text style={[st.clipSpeed, { color: `${track.color}AA` }]}>
                {clip.speed}x
              </Text>
            )}
          </View>
          {(track.type === "audio" || track.type === "bgm") && (
            <View style={st.waveformContainer}>
              {Array.from({ length: Math.max(Math.floor(clipWidth / 4), 5) }).map((_, i) => (
                <View
                  key={i}
                  style={[st.waveformBar, { height: 4 + Math.random() * 14, backgroundColor: `${track.color}60` }]}
                />
              ))}
            </View>
          )}
          {isDragMove && (
            <View style={[st.movingIndicator, { backgroundColor: `${track.color}30` }]}>
              <IconSymbol name="chevron.left.forwardslash.chevron.right" size={14} color={track.color} />
            </View>
          )}
        </View>

        {/* Right trim handle - large hit area */}
        <View
          style={[
            st.trimHandleHitArea,
            { right: 0 },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => {
            evt.stopPropagation?.();
            startTrimDrag("trim-right", track.id, clip, evt);
          }}
          onResponderMove={onTrimMove}
          onResponderRelease={onTrimEnd}
          onResponderTerminate={onTrimEnd}
        >
          <View
            style={[
              st.trimHandleVisible,
              st.trimHandleRightShape,
              {
                backgroundColor: isTrimRight ? track.color : `${track.color}90`,
                borderColor: isTrimRight ? track.color : `${track.color}50`,
              },
            ]}
          >
            <View style={st.trimHandleBar} />
          </View>
        </View>
      </View>
    );
  };

  const zoomLabel = secondsPerScreen < 10
    ? `${secondsPerScreen.toFixed(1)}s`
    : `${Math.round(secondsPerScreen)}s`;

  return (
    <View style={[st.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Header */}
      <View style={[st.header, { borderBottomColor: colors.border }]}>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>タイムライン</Text>
        <View style={st.headerActions}>
          <Pressable onPress={zoomIn} style={({ pressed }) => [st.zoomBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>+</Text>
          </Pressable>
          <Text style={[st.zoomLabel, { color: colors.muted }]}>{zoomLabel}</Text>
          <Pressable onPress={zoomOut} style={({ pressed }) => [st.zoomBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>−</Text>
          </Pressable>
        </View>
      </View>

      {/* Timeline content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.scrollH}
        scrollEnabled={!activeDrag && !pinchRef.current.active}
      >
        <View style={{ width: timelineWidth + 120 }}>
          {/* Time ruler with pinch zoom */}
          <View
            style={[st.ruler, { borderBottomColor: colors.border }]}
            onTouchStart={onRulerTouchStart}
            onTouchMove={onRulerTouchMove}
            onTouchEnd={onRulerTouchEnd}
            onTouchCancel={onRulerTouchEnd}
          >
            {rulerMarks.map((t) => (
              <View key={t} style={[st.rulerMark, { left: 120 + t * pixelsPerSecond }]}>
                <View style={[st.rulerLine, { backgroundColor: colors.border }]} />
                <Text style={[st.rulerText, { color: colors.muted }]}>{formatTime(t)}</Text>
              </View>
            ))}
            {/* Pinch hint */}
            <View style={st.pinchHint}>
              <Text style={[st.pinchHintText, { color: `${colors.muted}80` }]}>⇔ ピンチでズーム</Text>
            </View>
          </View>

          {/* Playhead line (spans ruler + all tracks) */}
          {currentTime >= 0 && currentTime <= totalDuration && (
            <View
              style={[
                st.playhead,
                { left: 120 + currentTime * pixelsPerSecond },
              ]}
              pointerEvents="none"
            >
              <View style={st.playheadHead} />
              <View style={st.playheadLine} />
            </View>
          )}

          {/* Tracks */}
          <ScrollView
            style={st.tracksScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            scrollEnabled={!activeDrag}
          >
            {tracks.map((track) => (
              <View key={track.id} style={[st.trackRow, { borderBottomColor: colors.border }]}>
                {/* Track header */}
                <View style={[st.trackHeader, { backgroundColor: `${track.color}15`, borderRightColor: colors.border }]}>
                  <View style={st.trackLabelRow}>
                    <IconSymbol name={getTrackIcon(track.type)} size={14} color={track.color} />
                    <Text style={[st.trackLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {track.label}
                    </Text>
                  </View>
                  <View style={st.trackControls}>
                    {track.type === "video" ? (
                      <Pressable
                        onPress={() => toggleVisibility(track.id)}
                        style={({ pressed }) => [
                          st.trackCtrlBtn,
                          track.isHidden && { backgroundColor: `${colors.error}30` },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <IconSymbol
                          name={track.isHidden ? "eye.slash" : "eye"}
                          size={12}
                          color={track.isHidden ? colors.error : colors.muted}
                        />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => toggleMute(track.id)}
                        style={({ pressed }) => [
                          st.trackCtrlBtn,
                          track.isMuted && { backgroundColor: `${colors.error}30` },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <IconSymbol
                          name={track.isMuted ? "speaker.slash" : "speaker.wave.2"}
                          size={12}
                          color={track.isMuted ? colors.error : colors.muted}
                        />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => toggleSolo(track.id)}
                      style={({ pressed }) => [
                        st.trackCtrlBtn,
                        track.isSolo && { backgroundColor: `${colors.warning}30` },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "800", color: track.isSolo ? colors.warning : colors.muted }}>S</Text>
                    </Pressable>
                    <View style={st.volumeRow}>
                      <Pressable onPress={() => adjustTrackVolume(track.id, -0.1)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>−</Text>
                      </Pressable>
                      <Text style={{ color: colors.foreground, fontSize: 10, fontWeight: "600", minWidth: 28, textAlign: "center" }}>
                        {Math.round(track.volume * 100)}%
                      </Text>
                      <Pressable onPress={() => adjustTrackVolume(track.id, 0.1)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Track clips area */}
                <View style={st.trackClipsArea}>
                  {track.clips.map((clip) => renderClip(track, clip))}
                  {track.clips.length === 0 && (
                    <View style={st.emptyTrack}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>空のトラック</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Selected clip controls */}
      {selectedClipId && (() => {
        let selectedTrack: TimelineTrack | undefined;
        let selectedClip: TimelineClip | undefined;
        for (const t of tracks) {
          const c = t.clips.find((cl) => cl.id === selectedClipId);
          if (c) { selectedTrack = t; selectedClip = c; break; }
        }
        if (!selectedTrack || !selectedClip) return null;
        return (
          <View style={[st.clipControls, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={st.clipControlsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[st.clipColorDot, { backgroundColor: selectedTrack.color }]} />
                <Text style={[st.clipControlsTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedClip.name}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Pressable
                  onPress={() => removeTrack(selectedTrack!.id)}
                  style={({ pressed }) => [st.deleteBtn, { backgroundColor: `${colors.error}15`, borderColor: colors.error }, pressed && { opacity: 0.7 }]}
                >
                  <IconSymbol name="trash" size={12} color={colors.error} />
                  <Text style={{ color: colors.error, fontSize: 10, fontWeight: "600" }}>削除</Text>
                </Pressable>
                <Pressable onPress={() => onClipSelect?.("", "")} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <IconSymbol name="xmark" size={16} color={colors.muted} />
                </Pressable>
              </View>
            </View>
            <View style={st.clipControlsRow}>
              <View style={st.clipControlItem}>
                <Text style={[st.clipControlLabel, { color: colors.muted }]}>速度</Text>
                <View style={st.clipControlBtns}>
                  <Pressable
                    onPress={() => adjustClipSpeed(selectedTrack!.id, selectedClip!.id, selectedClip!.speed - 0.25)}
                    style={({ pressed }) => [st.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>−</Text>
                  </Pressable>
                  <Text style={[st.clipControlValue, { color: colors.primary }]}>{selectedClip.speed}x</Text>
                  <Pressable
                    onPress={() => adjustClipSpeed(selectedTrack!.id, selectedClip!.id, selectedClip!.speed + 0.25)}
                    style={({ pressed }) => [st.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={st.clipControlItem}>
                <Text style={[st.clipControlLabel, { color: colors.muted }]}>音量</Text>
                <View style={st.clipControlBtns}>
                  <Pressable
                    onPress={() => adjustClipVolume(selectedTrack!.id, selectedClip!.id, -0.1)}
                    style={({ pressed }) => [st.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>−</Text>
                  </Pressable>
                  <Text style={[st.clipControlValue, { color: colors.primary }]}>{Math.round(selectedClip.volume * 100)}%</Text>
                  <Pressable
                    onPress={() => adjustClipVolume(selectedTrack!.id, selectedClip!.id, 0.1)}
                    style={({ pressed }) => [st.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={st.clipControlItem}>
                <Text style={[st.clipControlLabel, { color: colors.muted }]}>トリム</Text>
                <Text style={[st.clipControlValue, { color: colors.foreground, fontSize: 10 }]}>
                  {formatTime(selectedClip.trimStart)} - {formatTime(selectedClip.trimEnd)}
                </Text>
              </View>
              <View style={st.clipControlItem}>
                <Text style={[st.clipControlLabel, { color: colors.muted }]}>長さ</Text>
                <Text style={[st.clipControlValue, { color: colors.foreground }]}>
                  {formatTime((selectedClip.trimEnd - selectedClip.trimStart) / selectedClip.speed)}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Add track buttons */}
      <View style={[st.addTrackRow, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => addTrack("video")}
          style={({ pressed }) => [st.addTrackBtn, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }, pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="film" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>動画追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("audio")}
          style={({ pressed }) => [st.addTrackBtn, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }, pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="waveform" size={14} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>音声追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("bgm")}
          style={({ pressed }) => [st.addTrackBtn, { backgroundColor: `${colors.success}15`, borderColor: colors.success }, pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="music.note" size={14} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600" }}>BGM追加</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomLabel: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 32,
    textAlign: "center",
  },
  scrollH: {
    maxHeight: 260,
  },
  ruler: {
    height: 28,
    position: "relative",
    borderBottomWidth: 0.5,
  },
  rulerMark: {
    position: "absolute",
    top: 0,
    alignItems: "center",
  },
  rulerLine: {
    width: 1,
    height: 8,
  },
  rulerText: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 1,
  },
  pinchHint: {
    position: "absolute",
    right: 8,
    top: 6,
  },
  pinchHintText: {
    fontSize: 8,
    fontWeight: "500",
  },
  tracksScroll: {
    maxHeight: 232,
  },
  trackRow: {
    flexDirection: "row",
    minHeight: TRACK_ROW_HEIGHT,
    borderBottomWidth: 0.5,
  },
  trackHeader: {
    width: 120,
    padding: 6,
    borderRightWidth: 0.5,
    justifyContent: "center",
  },
  trackLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  trackLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  trackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trackCtrlBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trackClipsArea: {
    flex: 1,
    position: "relative",
    paddingVertical: 4,
  },
  clipOuter: {
    position: "absolute",
    top: 2,
    bottom: 2,
    flexDirection: "row",
    alignItems: "stretch",
  },
  // Invisible large hit area for trim handles
  trimHandleHitArea: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: HANDLE_HIT_SLOP,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Visible trim handle bar
  trimHandleVisible: {
    width: 10,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  trimHandleLeftShape: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  trimHandleRightShape: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  trimHandleBar: {
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  clipBody: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    justifyContent: "center",
    overflow: "hidden",
  },
  clipName: {
    fontSize: 10,
    fontWeight: "700",
  },
  clipInfo: {
    flexDirection: "row",
    gap: 4,
    marginTop: 1,
  },
  clipDuration: {
    fontSize: 9,
    fontWeight: "500",
  },
  clipSpeed: {
    fontSize: 9,
    fontWeight: "700",
  },
  waveformContainer: {
    position: "absolute",
    bottom: 2,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
    height: 18,
    overflow: "hidden",
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
  },
  movingIndicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  emptyTrack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clipControls: {
    padding: 10,
    borderTopWidth: 0.5,
  },
  clipControlsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clipColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  clipControlsTitle: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 200,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  clipControlsRow: {
    flexDirection: "row",
    gap: 16,
  },
  clipControlItem: {
    alignItems: "center",
    gap: 4,
  },
  clipControlLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  clipControlBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clipControlValue: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 36,
    textAlign: "center",
  },
  miniBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addTrackRow: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderTopWidth: 0.5,
  },
  addTrackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  // Playhead styles
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 50,
    alignItems: "center",
  },
  playheadHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
    marginTop: 2,
    marginLeft: -4,
  },
  playheadLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#FF3B30",
  },
});
