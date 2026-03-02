import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
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
}

// Zoom levels: seconds per screen width
const ZOOM_LEVELS = [5, 10, 20, 30, 60, 120, 300];
const TRACK_ROW_HEIGHT = 54;
const HANDLE_WIDTH = 14;
const LONG_PRESS_DELAY = 400;

type DragMode = "none" | "trim-left" | "trim-right" | "move";

interface DragState {
  mode: DragMode;
  trackId: string;
  clipId: string;
  /** Original clip data at drag start */
  originalClip: TimelineClip;
  /** Original track index at drag start */
  originalTrackIndex: number;
  /** Accumulated horizontal delta in seconds */
  accDeltaSeconds: number;
  /** Accumulated vertical delta in track indices */
  accDeltaTracks: number;
  /** Timer for long press detection */
  longPressTimer: ReturnType<typeof setTimeout> | null;
  /** Whether long press was triggered */
  isLongPress: boolean;
  /** Start position */
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
}: MultiTrackTimelineProps) {
  const colors = useColors();
  const [zoomIndex, setZoomIndex] = useState(3);
  const [scrollOffset, setScrollOffset] = useState(0);
  const secondsPerScreen = ZOOM_LEVELS[zoomIndex];
  const pixelsPerSecond = 300 / secondsPerScreen; // 300px base width

  // Drag state ref (not state to avoid re-renders during drag)
  const dragRef = useRef<DragState>({
    mode: "none",
    trackId: "",
    clipId: "",
    originalClip: {} as TimelineClip,
    originalTrackIndex: 0,
    accDeltaSeconds: 0,
    accDeltaTracks: 0,
    longPressTimer: null,
    isLongPress: false,
    startX: 0,
    startY: 0,
  });
  const [activeDrag, setActiveDrag] = useState<{ mode: DragMode; clipId: string } | null>(null);
  // Visual feedback for dragging clip (offset in px)
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  // Trim preview deltas (in seconds)
  const [trimLeftDelta, setTrimLeftDelta] = useState(0);
  const [trimRightDelta, setTrimRightDelta] = useState(0);

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  }, []);

  const zoomIn = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
      haptic();
    }
  };

  const zoomOut = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1);
      haptic();
    }
  };

  const toggleMute = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isMuted: !t.isMuted } : t
    );
    onTracksChange(updated);
  };

  const toggleVisibility = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isHidden: !t.isHidden } : t
    );
    onTracksChange(updated);
  };

  const toggleSolo = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isSolo: !t.isSolo } : t
    );
    onTracksChange(updated);
  };

  const adjustTrackVolume = (trackId: string, delta: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newVol = Math.max(0, Math.min(1, t.volume + delta));
      return { ...t, volume: newVol };
    });
    onTracksChange(updated);
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
            clips: [
              {
                id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                sourceUri: asset.uri,
                name: label,
                duration: dur,
                trimStart: 0,
                trimEnd: dur,
                timelineOffset: 0,
                speed: 1.0,
                volume: 1.0,
              },
            ],
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
      // BGM track
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
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    if (Platform.OS === "web") {
      if (confirm(`「${track.label}」トラックを削除しますか？`)) doRemove();
    } else {
      Alert.alert(
        "トラック削除",
        `「${track.label}」トラックを削除しますか？`,
        [
          { text: "キャンセル", style: "cancel" },
          { text: "削除", style: "destructive", onPress: doRemove },
        ]
      );
    }
  };

  const adjustClipSpeed = (trackId: string, clipId: string, newSpeed: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, speed: Math.max(0.25, Math.min(10, newSpeed)) } : c
        ),
      };
    });
    onTracksChange(updated);
  };

  const adjustClipVolume = (trackId: string, clipId: string, delta: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, volume: Math.max(0, Math.min(1, c.volume + delta)) } : c
        ),
      };
    });
    onTracksChange(updated);
  };

  // ---- Trim handle drag logic ----
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
      accDeltaSeconds: 0,
      accDeltaTracks: 0,
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
    const deltaSec = dx / pixelsPerSecond;

    if (drag.mode === "trim-left") {
      // Clamp: trimStart can't go below 0 or above trimEnd - 0.5s
      const maxDelta = drag.originalClip.trimEnd - drag.originalClip.trimStart - 0.5;
      const minDelta = -drag.originalClip.trimStart;
      const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
      setTrimLeftDelta(clamped);
    } else {
      // Clamp: trimEnd can't go above duration or below trimStart + 0.5s
      const maxDelta = drag.originalClip.duration - drag.originalClip.trimEnd;
      const minDelta = -(drag.originalClip.trimEnd - drag.originalClip.trimStart - 0.5);
      const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
      setTrimRightDelta(clamped);
    }
  };

  const onTrimEnd = () => {
    const drag = dragRef.current;
    if (drag.mode !== "trim-left" && drag.mode !== "trim-right") return;

    const updated = tracks.map((t) => {
      if (t.id !== drag.trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== drag.clipId) return c;
          if (drag.mode === "trim-left") {
            const newTrimStart = Math.max(0, Math.min(c.trimEnd - 0.5, drag.originalClip.trimStart + trimLeftDelta));
            return { ...c, trimStart: newTrimStart };
          } else {
            const newTrimEnd = Math.max(c.trimStart + 0.5, Math.min(drag.originalClip.duration, drag.originalClip.trimEnd + trimRightDelta));
            return { ...c, trimEnd: newTrimEnd };
          }
        }),
      };
    });
    onTracksChange(updated);

    dragRef.current.mode = "none";
    setActiveDrag(null);
    setTrimLeftDelta(0);
    setTrimRightDelta(0);
  };

  // ---- Long press + drag move logic ----
  const startMoveDrag = (
    trackId: string,
    clip: TimelineClip,
    evt: GestureResponderEvent
  ) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    // Set up long press timer
    const timer = setTimeout(() => {
      dragRef.current.isLongPress = true;
      dragRef.current.mode = "move";
      setActiveDrag({ mode: "move", clipId: clip.id });
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    }, LONG_PRESS_DELAY);

    dragRef.current = {
      mode: "none", // will become "move" after long press
      trackId,
      clipId: clip.id,
      originalClip: { ...clip },
      originalTrackIndex: trackIndex,
      accDeltaSeconds: 0,
      accDeltaTracks: 0,
      longPressTimer: timer,
      isLongPress: false,
      startX: evt.nativeEvent.pageX,
      startY: evt.nativeEvent.pageY,
    };
    setDragOffsetX(0);
    setDragOffsetY(0);
  };

  const onMoveGrant = (evt: GestureResponderEvent) => {
    // Already handled in startMoveDrag
  };

  const onMoveMove = (evt: GestureResponderEvent) => {
    const drag = dragRef.current;
    const dx = evt.nativeEvent.pageX - drag.startX;
    const dy = evt.nativeEvent.pageY - drag.startY;

    // If moved too much before long press, cancel long press
    if (!drag.isLongPress && drag.longPressTimer) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(drag.longPressTimer);
        drag.longPressTimer = null;
        return;
      }
    }

    if (drag.mode !== "move") return;

    setDragOffsetX(dx);
    setDragOffsetY(dy);
  };

  const onMoveEnd = () => {
    const drag = dragRef.current;

    // Clear long press timer
    if (drag.longPressTimer) {
      clearTimeout(drag.longPressTimer);
      drag.longPressTimer = null;
    }

    if (drag.mode !== "move") {
      dragRef.current.mode = "none";
      setActiveDrag(null);
      return;
    }

    // Calculate new position
    const deltaSec = dragOffsetX / pixelsPerSecond;
    const deltaTrackIndex = Math.round(dragOffsetY / TRACK_ROW_HEIGHT);

    const newOffset = Math.max(0, drag.originalClip.timelineOffset + deltaSec);
    const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, drag.originalTrackIndex + deltaTrackIndex));
    const targetTrack = tracks[newTrackIndex];
    const sourceTrack = tracks[drag.originalTrackIndex];

    if (!targetTrack || !sourceTrack) {
      dragRef.current.mode = "none";
      setActiveDrag(null);
      setDragOffsetX(0);
      setDragOffsetY(0);
      return;
    }

    let updated: TimelineTrack[];

    if (newTrackIndex === drag.originalTrackIndex) {
      // Same track: just update offset
      updated = tracks.map((t) => {
        if (t.id !== drag.trackId) return t;
        return {
          ...t,
          clips: t.clips.map((c) =>
            c.id === drag.clipId ? { ...c, timelineOffset: newOffset } : c
          ),
        };
      });
    } else {
      // Different track: move clip from source to target
      const movedClip = { ...drag.originalClip, timelineOffset: newOffset };
      updated = tracks.map((t, idx) => {
        if (idx === drag.originalTrackIndex) {
          // Remove from source
          return { ...t, clips: t.clips.filter((c) => c.id !== drag.clipId) };
        }
        if (idx === newTrackIndex) {
          // Add to target
          return { ...t, clips: [...t.clips, movedClip] };
        }
        return t;
      });
    }

    onTracksChange(updated);

    dragRef.current.mode = "none";
    setActiveDrag(null);
    setDragOffsetX(0);
    setDragOffsetY(0);
  };

  // Calculate total timeline width
  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 300);

  // Generate time ruler marks
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

    // Calculate visual trim adjustments
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
            width: Math.max(clipWidth, 30),
          },
          isDragMove && {
            transform: [{ translateX: dragOffsetX }, { translateY: dragOffsetY }],
            zIndex: 100,
            opacity: 0.85,
            elevation: 8,
          },
        ]}
      >
        {/* Left trim handle */}
        <View
          style={[
            st.trimHandle,
            st.trimHandleLeft,
            { backgroundColor: isTrimLeft ? track.color : `${track.color}80` },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => startTrimDrag("trim-left", track.id, clip, evt)}
          onResponderMove={onTrimMove}
          onResponderRelease={onTrimEnd}
          onResponderTerminate={onTrimEnd}
        >
          <View style={st.trimHandleBar} />
        </View>

        {/* Clip body (long press to move) */}
        <View
          style={[
            st.clipBody,
            {
              backgroundColor: `${track.color}${isSelected ? "50" : "25"}`,
              borderColor: isSelected ? track.color : `${track.color}60`,
              borderLeftWidth: 0,
              borderRightWidth: 0,
            },
            isDragMove && { borderColor: track.color, borderWidth: 2 },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => {
            startMoveDrag(track.id, clip, evt);
          }}
          onResponderMove={onMoveMove}
          onResponderRelease={(evt) => {
            const drag = dragRef.current;
            // If it was a tap (no long press, no significant move)
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
          {/* Waveform visualization (decorative) */}
          {(track.type === "audio" || track.type === "bgm") && (
            <View style={st.waveformContainer}>
              {Array.from({ length: Math.max(Math.floor(clipWidth / 4), 5) }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    st.waveformBar,
                    {
                      height: 4 + Math.random() * 14,
                      backgroundColor: `${track.color}60`,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          {isDragMove && (
            <View style={[st.movingIndicator, { backgroundColor: `${track.color}30` }]}>
              <IconSymbol name="arrow.up.and.down.and.arrow.left.and.right" size={16} color={track.color} />
            </View>
          )}
        </View>

        {/* Right trim handle */}
        <View
          style={[
            st.trimHandle,
            st.trimHandleRight,
            { backgroundColor: isTrimRight ? track.color : `${track.color}80` },
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(evt) => startTrimDrag("trim-right", track.id, clip, evt)}
          onResponderMove={onTrimMove}
          onResponderRelease={onTrimEnd}
          onResponderTerminate={onTrimEnd}
        >
          <View style={st.trimHandleBar} />
        </View>
      </View>
    );
  };

  return (
    <View style={[st.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Header: Zoom controls + Add track */}
      <View style={[st.header, { borderBottomColor: colors.border }]}>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>タイムライン</Text>
        <View style={st.headerActions}>
          <Pressable onPress={zoomIn} style={({ pressed }) => [st.zoomBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>+</Text>
          </Pressable>
          <Text style={[st.zoomLabel, { color: colors.muted }]}>{secondsPerScreen}s</Text>
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
        scrollEnabled={!activeDrag}
      >
        <View style={{ width: timelineWidth + 120 }}>
          {/* Time ruler */}
          <View style={[st.ruler, { borderBottomColor: colors.border }]}>
            {rulerMarks.map((t) => (
              <View key={t} style={[st.rulerMark, { left: 120 + t * pixelsPerSecond }]}>
                <View style={[st.rulerLine, { backgroundColor: colors.border }]} />
                <Text style={[st.rulerText, { color: colors.muted }]}>{formatTime(t)}</Text>
              </View>
            ))}
          </View>

          {/* Tracks */}
          <ScrollView
            style={st.tracksScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            scrollEnabled={!activeDrag}
          >
            {tracks.map((track) => (
              <View key={track.id} style={[st.trackRow, { borderBottomColor: colors.border }]}>
                {/* Track header (fixed left) */}
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
                    {/* Volume */}
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
              {/* Speed control */}
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
              {/* Volume control */}
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
              {/* Trim info */}
              <View style={st.clipControlItem}>
                <Text style={[st.clipControlLabel, { color: colors.muted }]}>トリム</Text>
                <Text style={[st.clipControlValue, { color: colors.foreground, fontSize: 10 }]}>
                  {formatTime(selectedClip.trimStart)} - {formatTime(selectedClip.trimEnd)}
                </Text>
              </View>
              {/* Duration info */}
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
          style={({ pressed }) => [
            st.addTrackBtn,
            { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="film" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>動画追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("audio")}
          style={({ pressed }) => [
            st.addTrackBtn,
            { backgroundColor: `${colors.warning}15`, borderColor: colors.warning },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="waveform" size={14} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>音声追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("bgm")}
          style={({ pressed }) => [
            st.addTrackBtn,
            { backgroundColor: `${colors.success}15`, borderColor: colors.success },
            pressed && { opacity: 0.7 },
          ]}
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
    minWidth: 28,
    textAlign: "center",
  },
  scrollH: {
    maxHeight: 240,
  },
  ruler: {
    height: 24,
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
  tracksScroll: {
    maxHeight: 216,
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
  // Clip outer container (includes handles)
  clipOuter: {
    position: "absolute",
    top: 4,
    bottom: 4,
    flexDirection: "row",
    alignItems: "stretch",
  },
  // Trim handles
  trimHandle: {
    width: HANDLE_WIDTH,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  trimHandleLeft: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  trimHandleRight: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  trimHandleBar: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  // Clip body (between handles)
  clipBody: {
    flex: 1,
    borderWidth: 1.5,
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
});
