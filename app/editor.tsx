import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor } from "@/lib/editor-context";
import { useOrientation } from "@/hooks/use-orientation";
import { launchImageLibraryAsync } from "expo-image-picker";
import { MultiTrackTimeline } from "@/components/multi-track-timeline";
import type { TimelineTrack, TransitionType, ClipTransition, Keyframe, KeyframeProperty, SpeedCurve, TextAnimationType, TextAlignment, TextOverlay as TextOverlayType, VideoEffect, ColorAdjustments, ColorAdjustmentKey, BlendMode, ChromaKeySettings } from "@/lib/editor-context";
import { createDefaultTracks, TRANSITION_PRESETS, KEYFRAME_PROPERTY_LABELS, SPEED_CURVE_PRESETS, getSpeedAtPosition, TEXT_ANIMATION_PRESETS, FONT_FAMILIES, TEXT_TEMPLATES, ASPECT_RATIO_PRESETS, VIDEO_EFFECT_PRESETS, COLOR_ADJUSTMENT_LABELS, DEFAULT_COLOR_ADJUSTMENTS, BLEND_MODE_LABELS, DEFAULT_CHROMA_KEY } from "@/lib/editor-context";

// Filter definitions
const FILTERS = [
  { id: "original", name: "オリジナル", color: "transparent" },
  { id: "vivid", name: "ビビッド", color: "rgba(255,100,100,0.15)" },
  { id: "mono", name: "モノクロ", color: "rgba(128,128,128,0.5)" },
  { id: "sepia", name: "セピア", color: "rgba(180,140,80,0.3)" },
  { id: "warm", name: "ウォーム", color: "rgba(255,180,50,0.2)" },
  { id: "cool", name: "クール", color: "rgba(50,100,255,0.2)" },
  { id: "dramatic", name: "ドラマ", color: "rgba(0,0,0,0.3)" },
  { id: "fade", name: "フェード", color: "rgba(255,255,255,0.25)" },
];

// Text colors
const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#AF52DE",
  "#FF2D55",
  "#8E8E93",
  "#00C7BE",
  "#FFD60A",
  "#BF5AF2",
  "#FF375F",
  "#30D158",
  "#64D2FF",
];

// Font sizes extended
const FONT_SIZES = [14, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

// Speed presets
const SPEED_PRESETS = [
  { label: "0.25x", value: 0.25 },
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
  { label: "3x", value: 3.0 },
  { label: "4x", value: 4.0 },
  { label: "6x", value: 6.0 },
  { label: "8x", value: 8.0 },
  { label: "10x", value: 10.0 },
];

// BGM tracks (placeholder data)
const BGM_TRACKS = [
  { id: "pop1", title: "Happy Vibes", category: "ポップ", duration: 120 },
  { id: "pop2", title: "Summer Day", category: "ポップ", duration: 90 },
  { id: "chill1", title: "Calm Waters", category: "チル", duration: 150 },
  { id: "chill2", title: "Sunset Dream", category: "チル", duration: 180 },
  { id: "epic1", title: "Rise Up", category: "エピック", duration: 100 },
  { id: "epic2", title: "Victory March", category: "エピック", duration: 130 },
  { id: "acoustic1", title: "Morning Coffee", category: "アコースティック", duration: 140 },
  { id: "acoustic2", title: "Gentle Breeze", category: "アコースティック", duration: 110 },
];

const BGM_CATEGORIES = ["すべて", "ポップ", "チル", "エピック", "アコースティック"];

type PanelType = "none" | "trim" | "filter" | "text" | "music" | "speed" | "frame" | "transition" | "keyframe" | "effects" | "color" | "clip-tools" | "sticker" | "audio-tools";

// Frame layout definitions
const FRAME_LAYOUTS: { id: import("@/lib/editor-context").FrameLayout; label: string; icon: string; slots: number }[] = [
  { id: "single", label: "単一", icon: "■", slots: 1 },
  { id: "split-h", label: "左右分割", icon: "◫", slots: 2 },
  { id: "split-v", label: "上下分割", icon: "▤", slots: 2 },
  { id: "grid-4", label: "4分割", icon: "▦", slots: 4 },
  { id: "pip", label: "PiP", icon: "▣", slots: 2 },
];

export default function EditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, undo, redo, canUndo, canRedo } = useEditor();
  const project = state.currentProject;
  const { orientation, dimensions } = useOrientation();
  const isLandscape = orientation === "landscape";

  const [activePanel, setActivePanel] = useState<PanelType>("none");
  const [selectedFilter, setSelectedFilter] = useState("original");
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textPosition, setTextPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [textSize, setTextSize] = useState(24);
  const [speed, setSpeed] = useState(1.0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(project?.duration ?? 0);
  const [selectedBgmCategory, setSelectedBgmCategory] = useState("すべて");
  const [selectedBgm, setSelectedBgm] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.7);

  // Multi-frame state
  const [frameLayout, setFrameLayout] = useState<import("@/lib/editor-context").FrameLayout>(project?.frameLayout ?? "single");
  const [frameSlots, setFrameSlots] = useState<import("@/lib/editor-context").FrameSlot[]>(project?.frameSlots ?? []);

  // Multi-text overlay state
  const [textOverlays, setTextOverlays] = useState<import("@/lib/editor-context").TextOverlay[]>(project?.textOverlays ?? []);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Multi-track timeline state
  const [tracks, setTracks] = useState<TimelineTrack[]>(
    project?.tracks ?? (project ? createDefaultTracks(project.videoUri, project.duration) : [])
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<TransitionType>("none");
  const [transitionDuration, setTransitionDuration] = useState(0.5);
  const [activeKeyframeProperty, setActiveKeyframeProperty] = useState<KeyframeProperty>("x");
  const [keyframeEasing, setKeyframeEasing] = useState<Keyframe["easing"]>("linear");
  const [effects, setEffects] = useState<VideoEffect[]>(project?.effects ?? []);
  const [colorAdj, setColorAdj] = useState<ColorAdjustments>(project?.colorAdjustments ?? { ...DEFAULT_COLOR_ADJUSTMENTS });
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Sticker state
  const [stickers, setStickers] = useState<import("@/lib/editor-context").StickerOverlay[]>(project?.stickers ?? []);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Beat markers
  const [beatMarkers, setBeatMarkers] = useState<import("@/lib/editor-context").BeatMarker[]>(project?.beatMarkers ?? []);

  // Current playback position for timeline playhead
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  // Helper: sync legacy state changes to the first video track clip in tracks
  const syncToVideoTrack = useCallback((updates: { speed?: number; trimStart?: number; trimEnd?: number }) => {
    setTracks((prev) => {
      const videoTrackIdx = prev.findIndex((t) => t.type === "video");
      if (videoTrackIdx === -1) return prev;
      const vt = prev[videoTrackIdx];
      if (vt.clips.length === 0) return prev;
      const clip = { ...vt.clips[0] };
      if (updates.speed !== undefined) clip.speed = updates.speed;
      if (updates.trimStart !== undefined) clip.trimStart = updates.trimStart;
      if (updates.trimEnd !== undefined) clip.trimEnd = updates.trimEnd;
      const newTracks = [...prev];
      newTracks[videoTrackIdx] = { ...vt, clips: [clip, ...vt.clips.slice(1)] };
      return newTracks;
    });
  }, []);

  const panelHeight = useSharedValue(0);
  const panelAnimStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    overflow: "hidden" as const,
  }));

  // Unlock orientation when entering editor, lock back to portrait when leaving
  useFocusEffect(
    useCallback(() => {
      const unlock = async () => {
        if (Platform.OS !== "web") {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.DEFAULT
          );
        }
      };
      unlock();

      return () => {
        if (Platform.OS !== "web") {
          ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );
        }
      };
    }, [])
  );

  // Video player
  const player = useVideoPlayer(project?.videoUri ?? "", (p) => {
    p.loop = true;
    // Initial settings will be applied by useEffect after mount
  });

  // Apply all effective player state on mount and whenever player changes
  useEffect(() => {
    if (!player) return;
    const applyState = () => {
      try {
        player.playbackRate = effectivePlayerState.speed;
        player.volume = effectivePlayerState.volume;
        player.muted = effectivePlayerState.muted;
        if (effectivePlayerState.trimStart > 0) {
          player.currentTime = effectivePlayerState.trimStart;
        }
      } catch (e) { /* ignore */ }
      // Also apply to Web DOM video element
      if (Platform.OS === "web") {
        try {
          const videos = document.querySelectorAll("video");
          if (videos.length > 0) {
            const videoEl = videos[0];
            videoEl.playbackRate = effectivePlayerState.speed;
            videoEl.volume = effectivePlayerState.volume;
            videoEl.muted = effectivePlayerState.muted;
            if (effectivePlayerState.trimStart > 0) {
              videoEl.currentTime = effectivePlayerState.trimStart;
            }
          }
        } catch (e) { /* ignore */ }
      }
    };
    // Delay slightly to ensure video element is mounted on Web
    const timer = setTimeout(applyState, 300);
    return () => clearTimeout(timer);
  }, [player]);

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  useEffect(() => {
    if (project) {
      setTrimStart(project.trimStart);
      setTrimEnd(project.trimEnd);
      if (project.filter) {
        setSelectedFilter(project.filter.id);
        setFilterIntensity(project.filter.intensity);
      }
      if (project.textOverlay) {
        setTextInput(project.textOverlay.text);
        setTextColor(project.textOverlay.color);
        setTextPosition(project.textOverlay.position);
        setTextSize(project.textOverlay.fontSize);
      }
      setSpeed(project.speed);
      setFrameLayout(project.frameLayout ?? "single");
      setFrameSlots(project.frameSlots ?? []);
      setTextOverlays(project.textOverlays ?? []);
      setTracks(project.tracks ?? createDefaultTracks(project.videoUri, project.duration));
    }
  }, [project?.id]);

  // ---- Sync timeline track state to video player ----

  // Compute effective volume and speed from tracks
  const effectivePlayerState = useMemo(() => {
    // Find the first visible video track (skip hidden ones)
    const videoTracks = tracks.filter((t) => t.type === "video");
    const visibleVideoTrack = videoTracks.find((t) => !t.isHidden) ?? null;
    const audioTrack = tracks.find((t) => t.type === "audio");

    // Determine if any track is in solo mode
    const hasSolo = tracks.some((t) => t.isSolo);

    // Video track speed (from first visible video track's first clip)
    let videoSpeed = 1.0;
    let videoTrimStart = 0;
    let videoTrimEnd = project?.duration ?? 0;
    let activeVideoUri = project?.videoUri ?? "";
    let videoHidden = !visibleVideoTrack; // true if all video tracks are hidden

    if (visibleVideoTrack && visibleVideoTrack.clips.length > 0) {
      const clip = visibleVideoTrack.clips[0];
      videoSpeed = clip.speed;
      videoTrimStart = clip.trimStart;
      videoTrimEnd = clip.trimEnd;
      activeVideoUri = clip.sourceUri;
    }

    // Audio mute is controlled only by audio track's isMuted
    let audioVolume = 1.0;
    if (audioTrack) {
      const isAudioActive = hasSolo ? audioTrack.isSolo : !audioTrack.isMuted;
      if (!isAudioActive) {
        audioVolume = 0;
      } else {
        const clipVol = audioTrack.clips.length > 0 ? audioTrack.clips[0].volume : 1.0;
        audioVolume = audioTrack.volume * clipVol;
      }
    }

    // Final volume is based on audio track only (video track visibility doesn't affect audio)
    let finalVolume = audioVolume;

    // All audio muted only if audio track is muted
    const allMuted = audioVolume === 0;

    return {
      speed: videoSpeed,
      volume: Math.max(0, Math.min(1, finalVolume)),
      muted: allMuted,
      trimStart: videoTrimStart,
      trimEnd: videoTrimEnd,
      videoHidden,
      activeVideoUri,
    };
  }, [tracks, project?.duration, project?.videoUri]);

  // Helper: find the underlying HTML5 <video> element on Web for direct DOM access
  const getWebVideoElement = useCallback((): HTMLVideoElement | null => {
    if (Platform.OS !== "web") return null;
    try {
      const videos = document.querySelectorAll("video");
      return videos.length > 0 ? videos[0] : null;
    } catch {
      return null;
    }
  }, []);

  // Apply speed changes to player
  useEffect(() => {
    if (!player || effectivePlayerState.speed <= 0) return;
    try {
      player.playbackRate = effectivePlayerState.speed;
    } catch (e) { /* ignore */ }
    // Also apply directly to DOM video element on Web
    const videoEl = getWebVideoElement();
    if (videoEl) {
      videoEl.playbackRate = effectivePlayerState.speed;
    }
  }, [player, effectivePlayerState.speed, getWebVideoElement]);

  // Apply volume changes to player
  useEffect(() => {
    if (!player) return;
    try {
      player.volume = effectivePlayerState.volume;
      player.muted = effectivePlayerState.muted;
    } catch (e) { /* ignore */ }
    // Also apply directly to DOM video element on Web
    const videoEl = getWebVideoElement();
    if (videoEl) {
      videoEl.volume = effectivePlayerState.volume;
      videoEl.muted = effectivePlayerState.muted;
    }
  }, [player, effectivePlayerState.volume, effectivePlayerState.muted, getWebVideoElement]);

  // Apply trim changes: seek to trimStart when trim changes
  useEffect(() => {
    if (!player || effectivePlayerState.trimStart < 0) return;
    try {
      player.currentTime = effectivePlayerState.trimStart;
    } catch (e) { /* ignore */ }
    // Also apply directly to DOM video element on Web
    const videoEl = getWebVideoElement();
    if (videoEl) {
      videoEl.currentTime = effectivePlayerState.trimStart;
    }
  }, [player, effectivePlayerState.trimStart, getWebVideoElement]);

  // Enforce trim boundaries during playback & update playhead position
  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      try {
        let currentTime = player.currentTime;
        const videoEl = getWebVideoElement();
        if (videoEl && Platform.OS === "web") {
          currentTime = videoEl.currentTime;
        }
        // Update playhead position (relative to timeline: account for timelineOffset)
        const videoTrack = tracks.find((t) => t.type === "video" && !t.isHidden);
        const videoClip = videoTrack?.clips[0];
        const timelinePos = videoClip
          ? videoClip.timelineOffset + ((currentTime - videoClip.trimStart) / (videoClip.speed || 1))
          : currentTime;
        setCurrentPlaybackTime(Math.max(0, timelinePos));

        // Enforce trim boundaries only while playing
        if (isPlaying) {
          if (currentTime >= effectivePlayerState.trimEnd) {
            player.currentTime = effectivePlayerState.trimStart;
            if (videoEl) videoEl.currentTime = effectivePlayerState.trimStart;
          } else if (currentTime < effectivePlayerState.trimStart) {
            player.currentTime = effectivePlayerState.trimStart;
            if (videoEl) videoEl.currentTime = effectivePlayerState.trimStart;
          }
        }
      } catch (e) {
        // ignore
      }
    }, 100);
    return () => clearInterval(interval);
  }, [player, isPlaying, effectivePlayerState.trimStart, effectivePlayerState.trimEnd, getWebVideoElement, tracks]);

  // Also sync the legacy speed state with track speed
  useEffect(() => {
    setSpeed(effectivePlayerState.speed);
  }, [effectivePlayerState.speed]);

  // Sync legacy trim state with track trim
  useEffect(() => {
    setTrimStart(effectivePlayerState.trimStart);
    setTrimEnd(effectivePlayerState.trimEnd);
  }, [effectivePlayerState.trimStart, effectivePlayerState.trimEnd]);

  const togglePlay = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const openPanel = useCallback(
    (panel: PanelType) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (activePanel === panel) {
        setActivePanel("none");
        panelHeight.value = withTiming(0, { duration: 250 });
      } else {
        setActivePanel(panel);
        panelHeight.value = withTiming(isLandscape ? 220 : 280, { duration: 250 });
      }
    },
    [activePanel, panelHeight, isLandscape]
  );

  const applyChanges = useCallback(() => {
    if (!project) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const updates: any = {
      trimStart,
      trimEnd,
      speed,
    };

    if (selectedFilter !== "original") {
      updates.filter = {
        id: selectedFilter,
        name: FILTERS.find((f) => f.id === selectedFilter)?.name ?? "",
        intensity: filterIntensity,
      };
    } else {
      updates.filter = null;
    }

    if (textInput.trim()) {
      updates.textOverlay = {
        text: textInput,
        fontSize: textSize,
        color: textColor,
        position: textPosition,
        bold: false,
        italic: false,
      };
    } else {
      updates.textOverlay = null;
    }

    if (selectedBgm) {
      const track = BGM_TRACKS.find((t) => t.id === selectedBgm);
      if (track) {
        updates.bgmTrack = {
          id: track.id,
          title: track.title,
          category: track.category,
          uri: "",
          duration: track.duration,
          volume: bgmVolume,
        };
      }
    }

    updates.frameLayout = frameLayout;
    updates.frameSlots = frameSlots;
    updates.textOverlays = textOverlays;
    updates.tracks = tracks;
    updates.effects = effects;
    updates.colorAdjustments = colorAdj;
    updates.stickers = stickers;
    updates.beatMarkers = beatMarkers;

    dispatch({ type: "UPDATE_CURRENT_PROJECT", payload: updates });
    setActivePanel("none");
    panelHeight.value = withTiming(0, { duration: 250 });
  }, [
    project,
    trimStart,
    trimEnd,
    speed,
    selectedFilter,
    filterIntensity,
    textInput,
    textSize,
    textColor,
    textPosition,
    selectedBgm,
    bgmVolume,
    frameLayout,
    frameSlots,
    textOverlays,
    tracks,
    dispatch,
    panelHeight,
  ]);

  const goToExport = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    applyChanges();
    router.push("/export" as any);
  }, [applyChanges, router]);

  if (!project) {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.muted }]}>
            プロジェクトが選択されていません
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>戻る</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const filteredBgm =
    selectedBgmCategory === "すべて"
      ? BGM_TRACKS
      : BGM_TRACKS.filter((t) => t.category === selectedBgmCategory);

  const filterOverlay = FILTERS.find((f) => f.id === selectedFilter);

  // ---- Shared sub-components ----

  // Compute aspect ratio for preview
  const projectAspectRatio = (() => {
    const ar = project?.aspectRatio;
    if (!ar) return undefined;
    const preset = ASPECT_RATIO_PRESETS.find((p) => p.id === ar);
    if (preset) return preset.width / preset.height;
    return undefined;
  })();

  const renderVideoPreview = () => (
    <View style={[
      styles.previewContainer,
      isLandscape && styles.previewContainerLandscape,
      isFullscreenPreview && { flex: 1 },
    ]}>
      {effectivePlayerState.videoHidden ? (
        <View style={[styles.videoView, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
          <IconSymbol name="eye.slash" size={48} color="#555" />
          <Text style={{ color: '#777', fontSize: 14, marginTop: 8 }}>ビデオ非表示</Text>
        </View>
      ) : (
        <VideoView
          style={[styles.videoView, projectAspectRatio ? { aspectRatio: projectAspectRatio, flex: undefined, alignSelf: "center" } : undefined]}
          player={player}
          contentFit="contain"
          nativeControls={false}
        />
      )}
      {/* Filter overlay */}
      {filterOverlay && filterOverlay.color !== "transparent" && (
        <View
          style={[
            styles.filterOverlay,
            { backgroundColor: filterOverlay.color, opacity: filterIntensity / 100 },
          ]}
          pointerEvents="none"
        />
      )}
      {/* Text overlays - free positioned, draggable */}
      {textOverlays.map((overlay) => (
        <View
          key={overlay.id}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={() => {
            setSelectedTextId(overlay.id);
            setTextInput(overlay.text);
            setTextColor(overlay.color);
            setTextSize(overlay.fontSize);
            setTextPosition(overlay.position);
            if (activePanel !== "text") openPanel("text");
          }}
          onResponderMove={(evt) => {
            const { locationX, locationY } = evt.nativeEvent;
            // Move relative to touch delta
            const dx = (locationX - 20) * 0.3;
            const dy = (locationY - 20) * 0.3;
            const newX = Math.max(0, Math.min(100, overlay.x + dx));
            const newY = Math.max(0, Math.min(100, overlay.y + dy));
            updateSelectedText({ x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
          }}
          onResponderRelease={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.freeTextOverlay,
            {
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: [{ rotate: `${overlay.rotation}deg` }],
            },
            overlay.background && {
              backgroundColor: overlay.background.color + Math.round(overlay.background.opacity * 255).toString(16).padStart(2, "0"),
              paddingHorizontal: overlay.background.paddingH,
              paddingVertical: overlay.background.paddingV,
              borderRadius: overlay.background.borderRadius,
            },
            selectedTextId === overlay.id && {
              borderWidth: 1,
              borderColor: colors.primary,
              borderStyle: "dashed" as any,
            },
          ]}
        >
          <Text
            style={[
              styles.textOverlay,
              {
                color: overlay.color,
                fontSize: overlay.fontSize,
                fontWeight: overlay.bold ? "bold" : "normal",
                fontStyle: overlay.italic ? "italic" : "normal",
                textAlign: overlay.alignment ?? "center",
                letterSpacing: overlay.letterSpacing ?? 0,
                lineHeight: overlay.lineHeight ? overlay.fontSize * overlay.lineHeight : undefined,
                fontFamily: FONT_FAMILIES.find((f) => f.id === overlay.fontFamily)?.family,
              },
              overlay.outline && {
                textShadowColor: overlay.outline.color,
                textShadowRadius: overlay.outline.width,
              },
              overlay.shadow && {
                textShadowColor: overlay.shadow.color,
                textShadowOffset: { width: overlay.shadow.offsetX, height: overlay.shadow.offsetY },
                textShadowRadius: overlay.shadow.blur,
              },
            ]}
          >
            {overlay.text}
          </Text>
        </View>
      ))}
      {/* Sticker overlays */}
      {stickers.map((stk) => (
        <View
          key={stk.id}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={() => setSelectedStickerId(stk.id)}
          onResponderMove={(evt) => {
            const { locationX, locationY } = evt.nativeEvent;
            const dx = (locationX - 20) * 0.3;
            const dy = (locationY - 20) * 0.3;
            setStickers((prev) => prev.map((s) =>
              s.id === stk.id ? { ...s, x: Math.max(0, Math.min(100, s.x + dx)), y: Math.max(0, Math.min(100, s.y + dy)) } : s
            ));
          }}
          style={[
            styles.freeTextOverlay,
            {
              left: `${stk.x}%`,
              top: `${stk.y}%`,
              transform: [{ scale: stk.scale }, { rotate: `${stk.rotation}deg` }],
            },
            selectedStickerId === stk.id && { borderWidth: 1, borderColor: colors.primary, borderStyle: "dashed" as any },
          ]}
        >
          <Text style={{ fontSize: 36 }}>{stk.emoji}</Text>
        </View>
      ))}
      {/* Legacy single text overlay for backward compat */}
      {textOverlays.length === 0 && textInput.trim() !== "" && (
        <View
          style={[
            styles.textOverlayContainer,
            textPosition === "top" && { top: 20 },
            textPosition === "center" && { top: "40%" },
            textPosition === "bottom" && { bottom: 20 },
          ]}
          pointerEvents="none"
        >
          <Text
            style={[
              styles.textOverlay,
              {
                color: textColor,
                fontSize: textSize,
              },
            ]}
          >
            {textInput}
          </Text>
        </View>
      )}
      {/* Status badges (speed / volume / muted) */}
      <View style={styles.previewBadges} pointerEvents="none">
        {effectivePlayerState.speed !== 1.0 && (
          <View style={[styles.previewBadge, { backgroundColor: "rgba(99,102,241,0.85)" }]}>
            <Text style={styles.previewBadgeText}>{effectivePlayerState.speed}x</Text>
          </View>
        )}
        {effectivePlayerState.videoHidden && (
          <View style={[styles.previewBadge, { backgroundColor: "rgba(107,114,128,0.85)" }]}>
            <Text style={styles.previewBadgeText}>映像OFF</Text>
          </View>
        )}
        {effectivePlayerState.muted && (
          <View style={[styles.previewBadge, { backgroundColor: "rgba(239,68,68,0.85)" }]}>
            <Text style={styles.previewBadgeText}>ミュート</Text>
          </View>
        )}
        {!effectivePlayerState.muted && effectivePlayerState.volume < 1.0 && effectivePlayerState.volume > 0 && (
          <View style={[styles.previewBadge, { backgroundColor: "rgba(245,158,11,0.85)" }]}>
            <Text style={styles.previewBadgeText}>音量 {Math.round(effectivePlayerState.volume * 100)}%</Text>
          </View>
        )}
      </View>
      {/* Fullscreen toggle button */}
      <Pressable
        onPress={() => {
          setIsFullscreenPreview((prev) => !prev);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={({ pressed }) => [
          styles.fullscreenBtn,
          { backgroundColor: "rgba(0,0,0,0.5)" },
          pressed && { opacity: 0.7 },
        ]}
      >
        <IconSymbol
          name={isFullscreenPreview ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
          size={20}
          color="#FFFFFF"
        />
      </Pressable>
      {/* Play/Pause overlay */}
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [styles.playOverlay, pressed && { opacity: 0.8 }]}
      >
        {!isPlaying && (
          <View style={styles.playButton}>
            <IconSymbol name="play.fill" size={36} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    </View>
  );

  const renderTimeline = () => {
    const duration = project.duration || 1;
    const trimStartPct = (trimStart / duration) * 100;
    const trimEndPct = (trimEnd / duration) * 100;
    const trimDuration = trimEnd - trimStart;
    const effectiveSpeed = speed;
    const outputDuration = trimDuration / effectiveSpeed;

    // Generate tick marks for the timeline
    const tickInterval = duration > 60 ? 10 : duration > 10 ? 5 : 1;
    const ticks: number[] = [];
    for (let t = 0; t <= duration; t += tickInterval) {
      ticks.push(t);
    }

    return (
      <View style={[styles.timeline, { backgroundColor: colors.surface }]}>
        {/* Duration info bar */}
        <View style={styles.timelineInfoBar}>
          <Text style={[styles.timelineInfoText, { color: colors.muted }]}>
            選択範囲: {formatTime(trimStart)} - {formatTime(trimEnd)}
          </Text>
          <Text style={[styles.timelineInfoText, { color: colors.primary }]}>
            {formatTime(trimDuration)} ({effectiveSpeed}x → {formatTime(outputDuration)})
          </Text>
        </View>

        {/* Tick marks */}
        <View style={styles.tickContainer}>
          {ticks.map((t) => (
            <View
              key={t}
              style={[
                styles.tickMark,
                {
                  left: `${(t / duration) * 100}%`,
                  backgroundColor: colors.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Timeline bar */}
        <View style={[styles.timelineBar, { backgroundColor: `${colors.border}60` }]}>
          {/* Inactive region left */}
          <View
            style={[
              styles.timelineInactive,
              {
                left: 0,
                width: `${trimStartPct}%`,
                backgroundColor: "rgba(0,0,0,0.4)",
              },
            ]}
          />
          {/* Active trim region */}
          <View
            style={[
              styles.timelineFill,
              {
                backgroundColor: `${colors.primary}40`,
                left: `${trimStartPct}%`,
                right: `${100 - trimEndPct}%`,
                borderTopWidth: 2,
                borderBottomWidth: 2,
                borderColor: colors.primary,
              },
            ]}
          />
          {/* Inactive region right */}
          <View
            style={[
              styles.timelineInactive,
              {
                right: 0,
                width: `${100 - trimEndPct}%`,
                backgroundColor: "rgba(0,0,0,0.4)",
              },
            ]}
          />
          {/* Start handle */}
          <View
            style={[
              styles.timelineHandle,
              {
                left: `${trimStartPct}%`,
                backgroundColor: colors.primary,
              },
            ]}
          >
            <View style={styles.handleGrip}>
              <View style={[styles.handleGripLine, { backgroundColor: "#FFFFFF" }]} />
              <View style={[styles.handleGripLine, { backgroundColor: "#FFFFFF" }]} />
            </View>
          </View>
          {/* End handle */}
          <View
            style={[
              styles.timelineHandle,
              {
                left: `${trimEndPct}%`,
                backgroundColor: colors.primary,
              },
            ]}
          >
            <View style={styles.handleGrip}>
              <View style={[styles.handleGripLine, { backgroundColor: "#FFFFFF" }]} />
              <View style={[styles.handleGripLine, { backgroundColor: "#FFFFFF" }]} />
            </View>
          </View>
        </View>

        {/* Time labels */}
        <View style={styles.timeLabels}>
          <Text style={[styles.timeLabel, { color: colors.primary }]}>
            {formatTime(trimStart)}
          </Text>
          <Text style={[styles.timeLabel, { color: colors.muted }]}>
            {formatTime(duration)}
          </Text>
          <Text style={[styles.timeLabel, { color: colors.primary }]}>
            {formatTime(trimEnd)}
          </Text>
        </View>
      </View>
    );
  };

  const renderToolPanel = () => (
    <Animated.View style={panelAnimStyle}>
      <View style={[styles.panelContent, { backgroundColor: colors.surface }]}>
        {activePanel === "trim" && renderTrimPanel()}
        {activePanel === "filter" && renderFilterPanel()}
        {activePanel === "text" && renderTextPanel()}
        {activePanel === "music" && renderMusicPanel()}
        {activePanel === "speed" && renderSpeedPanel()}
        {activePanel === "frame" && renderFramePanel()}
        {activePanel === "transition" && renderTransitionPanel()}
        {activePanel === "keyframe" && renderKeyframePanel()}
        {activePanel === "effects" && renderEffectsPanel()}
        {activePanel === "color" && renderColorPanel()}
        {activePanel === "clip-tools" && renderClipToolsPanel()}
        {activePanel === "sticker" && renderStickerPanel()}
        {activePanel === "audio-tools" && renderAudioToolsPanel()}
      </View>
    </Animated.View>
  );

  const renderTrimPanel = () => {
    const duration = project.duration || 1;
    const stepSmall = duration > 60 ? 1.0 : 0.5;
    const stepLarge = duration > 60 ? 5.0 : 2.0;

    return (
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>トリミング</Text>
        <View style={styles.trimControls}>
          {/* Start time control */}
          <View style={styles.trimField}>
            <Text style={[styles.trimLabel, { color: colors.muted }]}>開始位置</Text>
            <View style={[styles.trimInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.trimValue, { color: colors.primary }]}>
                {formatTime(trimStart)}
              </Text>
            </View>
            <View style={styles.trimBtns}>
              <Pressable
                onPress={() => {
                  const newVal = Math.max(0, trimStart - stepLarge);
                  setTrimStart(newVal);
                  syncToVideoTrack({ trimStart: newVal });
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepLarge}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.max(0, trimStart - stepSmall);
                  setTrimStart(newVal);
                  syncToVideoTrack({ trimStart: newVal });
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.min(trimEnd - 0.5, trimStart + stepSmall);
                  setTrimStart(newVal);
                  syncToVideoTrack({ trimStart: newVal });
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.min(trimEnd - 0.5, trimStart + stepLarge);
                  setTrimStart(newVal);
                  syncToVideoTrack({ trimStart: newVal });
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+{stepLarge}s</Text>
              </Pressable>
            </View>
          </View>
          {/* End time control */}
          <View style={styles.trimField}>
            <Text style={[styles.trimLabel, { color: colors.muted }]}>終了位置</Text>
            <View style={[styles.trimInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.trimValue, { color: colors.primary }]}>
                {formatTime(trimEnd)}
              </Text>
            </View>
            <View style={styles.trimBtns}>
              <Pressable
                onPress={() => {
                  const newVal = Math.max(trimStart + 0.5, trimEnd - stepLarge);
                  setTrimEnd(newVal);
                  syncToVideoTrack({ trimEnd: newVal });
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepLarge}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.max(trimStart + 0.5, trimEnd - stepSmall);
                  setTrimEnd(newVal);
                  syncToVideoTrack({ trimEnd: newVal });
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.min(duration, trimEnd + stepSmall);
                  setTrimEnd(newVal);
                  syncToVideoTrack({ trimEnd: newVal });
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newVal = Math.min(duration, trimEnd + stepLarge);
                  setTrimEnd(newVal);
                  syncToVideoTrack({ trimEnd: newVal });
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+{stepLarge}s</Text>
              </Pressable>
            </View>
          </View>
        </View>
        {/* Quick actions */}
        <View style={styles.trimQuickActions}>
          <Pressable
            onPress={() => {
              setTrimStart(0);
              setTrimEnd(duration);
              syncToVideoTrack({ trimStart: 0, trimEnd: duration });
            }}
            style={({ pressed }) => [
              styles.trimQuickBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.trimQuickBtnText, { color: colors.muted }]}>全体を選択</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const mid = duration / 2;
              const quarter = duration / 4;
              const newStart = Math.max(0, mid - quarter);
              const newEnd = Math.min(duration, mid + quarter);
              setTrimStart(newStart);
              setTrimEnd(newEnd);
              syncToVideoTrack({ trimStart: newStart, trimEnd: newEnd });
            }}
            style={({ pressed }) => [
              styles.trimQuickBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.trimQuickBtnText, { color: colors.muted }]}>中央50%</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const newEnd = Math.min(duration, 30);
              setTrimStart(0);
              setTrimEnd(newEnd);
              syncToVideoTrack({ trimStart: 0, trimEnd: newEnd });
            }}
            style={({ pressed }) => [
              styles.trimQuickBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.trimQuickBtnText, { color: colors.muted }]}>先頭30秒</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    );
  };

  const renderFilterPanel = () => (
    <View style={styles.panelInner}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>フィルター</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => {
              setSelectedFilter(f.id);
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.filterItem,
              selectedFilter === f.id && { borderColor: colors.primary, borderWidth: 2 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.filterPreview,
                {
                  backgroundColor:
                    f.color === "transparent" ? colors.border : f.color,
                },
              ]}
            />
            <Text
              style={[
                styles.filterName,
                {
                  color: selectedFilter === f.id ? colors.primary : colors.muted,
                },
              ]}
            >
              {f.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={applyChanges}
        style={({ pressed }) => [
          styles.applyBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Text style={styles.applyBtnText}>適用</Text>
      </Pressable>
    </View>
  );

  const addTextOverlay = () => {
    const newOverlay: import("@/lib/editor-context").TextOverlay = {
      id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: textInput.trim() || "テキスト",
      fontSize: textSize,
      color: textColor,
      position: textPosition,
      bold: false,
      italic: false,
      x: 50,
      y: 50,
      rotation: 0,
      startTime: 0,
      endTime: project?.duration ?? 0,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setSelectedTextId(newOverlay.id);
    setTextInput("");
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateSelectedText = (updates: Partial<import("@/lib/editor-context").TextOverlay>) => {
    if (!selectedTextId) return;
    setTextOverlays(textOverlays.map((o) =>
      o.id === selectedTextId ? { ...o, ...updates } : o
    ));
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    setTextOverlays(textOverlays.filter((o) => o.id !== selectedTextId));
    setSelectedTextId(null);
    setTextInput("");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const selectedOverlay = textOverlays.find((o) => o.id === selectedTextId);

  const renderTextPanel = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.panelInner}>
        {/* Header: Title + Add button */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={[styles.panelTitle, { color: colors.foreground, marginBottom: 0 }]}>テキスト</Text>
          <Pressable
            onPress={addTextOverlay}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <IconSymbol name="plus" size={16} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>追加</Text>
          </Pressable>
        </View>

        {/* Templates */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>テンプレート</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TEXT_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => {
                  if (selectedOverlay) {
                    updateSelectedText(tpl.style);
                  } else {
                    // Create new overlay from template
                    const now = Date.now();
                    const overlay: TextOverlayType = {
                      id: `txt_${now}_${Math.random().toString(36).slice(2, 6)}`,
                      text: tpl.label,
                      fontSize: 24,
                      color: "#FFFFFF",
                      position: "center",
                      bold: false,
                      italic: false,
                      x: 50,
                      y: 50,
                      rotation: 0,
                      startTime: 0,
                      endTime: project?.duration ?? 10,
                      ...tpl.style,
                    };
                    setTextOverlays([...textOverlays, overlay]);
                    setSelectedTextId(overlay.id);
                    setTextInput(overlay.text);
                    setTextColor(overlay.color);
                    setTextSize(overlay.fontSize);
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.templateCard,
                  { borderColor: colors.border, backgroundColor: `${colors.muted}10` },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: tpl.style.color ?? "#FFF", fontSize: 11, fontWeight: tpl.style.bold ? "700" : "400", fontStyle: tpl.style.italic ? "italic" : "normal" }} numberOfLines={1}>
                  {tpl.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Text list */}
        {textOverlays.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {textOverlays.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setSelectedTextId(o.id);
                    setTextInput(o.text);
                    setTextColor(o.color);
                    setTextSize(o.fontSize);
                    setTextPosition(o.position);
                  }}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
                      borderColor: selectedTextId === o.id ? colors.primary : colors.border,
                      backgroundColor: selectedTextId === o.id ? `${colors.primary}15` : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: selectedTextId === o.id ? colors.primary : colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                    {o.text.slice(0, 10)}{o.text.length > 10 ? "..." : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Edit selected or new text */}
        <TextInput
          value={selectedOverlay ? selectedOverlay.text : textInput}
          onChangeText={(val) => {
            if (selectedOverlay) {
              updateSelectedText({ text: val });
            } else {
              setTextInput(val);
            }
          }}
          placeholder="テキストを入力..."
          placeholderTextColor={colors.muted}
          multiline
          style={[
            styles.textInputField,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
              minHeight: 60,
              textAlignVertical: "top",
            },
          ]}
        />

        {/* Font family */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>フォント</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FONT_FAMILIES.map((font) => {
              const isActive = (selectedOverlay?.fontFamily ?? "system") === font.id;
              return (
                <Pressable
                  key={font.id}
                  onPress={() => {
                    if (selectedOverlay) updateSelectedText({ fontFamily: font.id });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? `${colors.primary}15` : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: isActive ? colors.primary : colors.foreground, fontSize: 13, fontWeight: "600", fontFamily: font.family }}>
                    {font.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Font size */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>サイズ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {FONT_SIZES.map((size) => (
              <Pressable
                key={size}
                onPress={() => {
                  setTextSize(size);
                  if (selectedOverlay) updateSelectedText({ fontSize: size });
                }}
                style={({ pressed }) => [
                  {
                    width: 38, height: 38, borderRadius: 8,
                    alignItems: "center" as const, justifyContent: "center" as const,
                    backgroundColor: (selectedOverlay?.fontSize ?? textSize) === size ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: (selectedOverlay?.fontSize ?? textSize) === size ? "#FFFFFF" : colors.muted, fontWeight: "700", fontSize: 12 }}>
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Style: Bold, Italic, Alignment */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>スタイル</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <Pressable
            onPress={() => { if (selectedOverlay) updateSelectedText({ bold: !selectedOverlay.bold }); }}
            style={({ pressed }) => [
              styles.styleToggleBtn,
              { backgroundColor: selectedOverlay?.bold ? colors.primary : colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: selectedOverlay?.bold ? "#FFF" : colors.muted, fontWeight: "900", fontSize: 16 }}>B</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (selectedOverlay) updateSelectedText({ italic: !selectedOverlay.italic }); }}
            style={({ pressed }) => [
              styles.styleToggleBtn,
              { backgroundColor: selectedOverlay?.italic ? colors.primary : colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: selectedOverlay?.italic ? "#FFF" : colors.muted, fontWeight: "700", fontSize: 16, fontStyle: "italic" }}>I</Text>
          </Pressable>
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />
          {(["left", "center", "right"] as TextAlignment[]).map((align) => {
            const icons: Record<string, string> = { left: "text.alignleft", center: "text.aligncenter", right: "text.alignright" };
            const isActive = (selectedOverlay?.alignment ?? "center") === align;
            return (
              <Pressable
                key={align}
                onPress={() => { if (selectedOverlay) updateSelectedText({ alignment: align }); }}
                style={({ pressed }) => [
                  styles.styleToggleBtn,
                  { backgroundColor: isActive ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name={icons[align] as any} size={16} color={isActive ? "#FFF" : colors.muted} />
              </Pressable>
            );
          })}
        </View>

        {/* Color */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>カラー</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={styles.colorRow}>
            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  setTextColor(c);
                  if (selectedOverlay) updateSelectedText({ color: c });
                }}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  (selectedOverlay?.color ?? textColor) === c && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              />
            ))}
          </View>
        </ScrollView>

        {/* Advanced options for selected overlay */}
        {selectedOverlay && (
          <>
            {/* Letter spacing */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>文字間隔: {selectedOverlay.letterSpacing ?? 0}px</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              {[0, 1, 2, 4, 6, 8, 12].map((ls) => (
                <Pressable
                  key={ls}
                  onPress={() => updateSelectedText({ letterSpacing: ls })}
                  style={({ pressed }) => [
                    styles.miniChip,
                    { backgroundColor: (selectedOverlay.letterSpacing ?? 0) === ls ? colors.primary : colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: (selectedOverlay.letterSpacing ?? 0) === ls ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>{ls}</Text>
                </Pressable>
              ))}
            </View>

            {/* Line height */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>行間隔: {(selectedOverlay.lineHeight ?? 1.2).toFixed(1)}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              {[1.0, 1.2, 1.4, 1.6, 1.8, 2.0].map((lh) => (
                <Pressable
                  key={lh}
                  onPress={() => updateSelectedText({ lineHeight: lh })}
                  style={({ pressed }) => [
                    styles.miniChip,
                    { backgroundColor: (selectedOverlay.lineHeight ?? 1.2) === lh ? colors.primary : colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: (selectedOverlay.lineHeight ?? 1.2) === lh ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>{lh}</Text>
                </Pressable>
              ))}
            </View>

            {/* Outline */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>縁取り（アウトライン）</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
              {[0, 1, 2, 3, 4].map((w) => {
                const isActive = (selectedOverlay.outline?.width ?? 0) === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => updateSelectedText({ outline: w === 0 ? undefined : { color: selectedOverlay.outline?.color ?? "#000000", width: w } })}
                    style={({ pressed }) => [
                      styles.miniChip,
                      { backgroundColor: isActive ? colors.primary : colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: isActive ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>{w === 0 ? "なし" : `${w}px`}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedOverlay.outline && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={styles.colorRow}>
                  {["#000000", "#FFFFFF", "#FF3B30", "#007AFF", "#FFD60A", "#34C759"].map((c) => (
                    <Pressable
                      key={`outline-${c}`}
                      onPress={() => updateSelectedText({ outline: { ...selectedOverlay.outline!, color: c } })}
                      style={[
                        styles.colorDotSmall,
                        { backgroundColor: c },
                        selectedOverlay.outline?.color === c && { borderColor: colors.primary, borderWidth: 2 },
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Shadow */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>影（シャドウ）</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
              <Pressable
                onPress={() => updateSelectedText({ shadow: undefined })}
                style={({ pressed }) => [
                  styles.miniChip,
                  { backgroundColor: !selectedOverlay.shadow ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: !selectedOverlay.shadow ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>なし</Text>
              </Pressable>
              <Pressable
                onPress={() => updateSelectedText({ shadow: { color: "rgba(0,0,0,0.5)", offsetX: 2, offsetY: 2, blur: 4 } })}
                style={({ pressed }) => [
                  styles.miniChip,
                  { backgroundColor: selectedOverlay.shadow && selectedOverlay.shadow.blur <= 4 ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: selectedOverlay.shadow && selectedOverlay.shadow.blur <= 4 ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>軽い</Text>
              </Pressable>
              <Pressable
                onPress={() => updateSelectedText({ shadow: { color: "rgba(0,0,0,0.7)", offsetX: 4, offsetY: 4, blur: 8 } })}
                style={({ pressed }) => [
                  styles.miniChip,
                  { backgroundColor: selectedOverlay.shadow && selectedOverlay.shadow.blur > 4 && selectedOverlay.shadow.blur <= 8 ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: selectedOverlay.shadow && selectedOverlay.shadow.blur > 4 && selectedOverlay.shadow.blur <= 8 ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>中</Text>
              </Pressable>
              <Pressable
                onPress={() => updateSelectedText({ shadow: { color: "rgba(0,0,0,0.9)", offsetX: 6, offsetY: 6, blur: 16 } })}
                style={({ pressed }) => [
                  styles.miniChip,
                  { backgroundColor: selectedOverlay.shadow && selectedOverlay.shadow.blur > 8 ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: selectedOverlay.shadow && selectedOverlay.shadow.blur > 8 ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>強い</Text>
              </Pressable>
            </View>
            {selectedOverlay.shadow && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={styles.colorRow}>
                  {["rgba(0,0,0,0.7)", "rgba(255,255,255,0.5)", "#FF3B30", "#007AFF", "#00FF88"].map((c, i) => (
                    <Pressable
                      key={`shadow-${i}`}
                      onPress={() => updateSelectedText({ shadow: { ...selectedOverlay.shadow!, color: c } })}
                      style={[
                        styles.colorDotSmall,
                        { backgroundColor: c },
                        selectedOverlay.shadow?.color === c && { borderColor: colors.primary, borderWidth: 2 },
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Background highlight */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>背景ハイライト</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              <Pressable
                onPress={() => updateSelectedText({ background: undefined })}
                style={({ pressed }) => [
                  styles.miniChip,
                  { backgroundColor: !selectedOverlay.background ? colors.primary : colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: !selectedOverlay.background ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>なし</Text>
              </Pressable>
              {[
                { label: "黒", bg: { color: "#000000", opacity: 0.6, paddingH: 10, paddingV: 4, borderRadius: 4 } },
                { label: "白", bg: { color: "#FFFFFF", opacity: 0.7, paddingH: 10, paddingV: 4, borderRadius: 4 } },
                { label: "青", bg: { color: "#007AFF", opacity: 0.8, paddingH: 12, paddingV: 6, borderRadius: 6 } },
                { label: "赤", bg: { color: "#FF3B30", opacity: 0.8, paddingH: 12, paddingV: 6, borderRadius: 6 } },
                { label: "丸", bg: { color: "#000000", opacity: 0.5, paddingH: 16, paddingV: 8, borderRadius: 20 } },
              ].map((opt) => {
                const isActive = selectedOverlay.background?.color === opt.bg.color && selectedOverlay.background?.borderRadius === opt.bg.borderRadius;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => updateSelectedText({ background: opt.bg })}
                    style={({ pressed }) => [
                      styles.miniChip,
                      { backgroundColor: isActive ? colors.primary : colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: isActive ? "#FFF" : colors.muted, fontSize: 11, fontWeight: "600" }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Animation In */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>入場アニメーション</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {TEXT_ANIMATION_PRESETS.map((anim) => {
                  const isActive = (selectedOverlay.animationIn?.type ?? "none") === anim.type;
                  return (
                    <Pressable
                      key={`in-${anim.type}`}
                      onPress={() => {
                        updateSelectedText({
                          animationIn: anim.type === "none" ? undefined : { type: anim.type, duration: selectedOverlay.animationIn?.duration ?? 0.5 },
                        });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        styles.animChip,
                        { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? `${colors.primary}15` : "transparent" },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ color: isActive ? colors.primary : colors.foreground, fontSize: 11, fontWeight: isActive ? "600" : "400" }}>
                        {anim.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Animation Out */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>退場アニメーション</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {TEXT_ANIMATION_PRESETS.map((anim) => {
                  const isActive = (selectedOverlay.animationOut?.type ?? "none") === anim.type;
                  return (
                    <Pressable
                      key={`out-${anim.type}`}
                      onPress={() => {
                        updateSelectedText({
                          animationOut: anim.type === "none" ? undefined : { type: anim.type, duration: selectedOverlay.animationOut?.duration ?? 0.5 },
                        });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        styles.animChip,
                        { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? `${colors.primary}15` : "transparent" },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ color: isActive ? colors.primary : colors.foreground, fontSize: 11, fontWeight: isActive ? "600" : "400" }}>
                        {anim.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Position controls with slider + fine buttons + number input */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>位置調整（プレビュー上でドラッグも可能）</Text>

            {/* X Position */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.muted }]}>X</Text>
              <Pressable onPress={() => updateSelectedText({ x: Math.max(0, selectedOverlay.x - 1) })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
              </Pressable>
              <View style={styles.sliderTrack}>
                <View
                  style={[styles.sliderFill, { width: `${selectedOverlay.x}%`, backgroundColor: colors.primary }]}
                />
                <View
                  style={[styles.sliderThumb, { left: `${selectedOverlay.x}%`, backgroundColor: colors.primary }]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderMove={(evt) => {
                    const touch = evt.nativeEvent;
                    const parent = evt.nativeEvent.locationX;
                    // Use pageX relative approach
                    const newX = Math.max(0, Math.min(100, selectedOverlay.x + (touch.locationX - 10) * 0.5));
                    updateSelectedText({ x: Math.round(newX * 10) / 10 });
                  }}
                />
              </View>
              <Pressable onPress={() => updateSelectedText({ x: Math.min(100, selectedOverlay.x + 1) })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
              </Pressable>
              <TextInput
                value={String(Math.round(selectedOverlay.x * 10) / 10)}
                onChangeText={(val) => {
                  const n = parseFloat(val);
                  if (!isNaN(n)) updateSelectedText({ x: Math.max(0, Math.min(100, n)) });
                }}
                keyboardType="numeric"
                style={[styles.numberInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>%</Text>
            </View>

            {/* Y Position */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.muted }]}>Y</Text>
              <Pressable onPress={() => updateSelectedText({ y: Math.max(0, selectedOverlay.y - 1) })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
              </Pressable>
              <View style={styles.sliderTrack}>
                <View
                  style={[styles.sliderFill, { width: `${selectedOverlay.y}%`, backgroundColor: colors.primary }]}
                />
                <View
                  style={[styles.sliderThumb, { left: `${selectedOverlay.y}%`, backgroundColor: colors.primary }]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderMove={(evt) => {
                    const touch = evt.nativeEvent;
                    const newY = Math.max(0, Math.min(100, selectedOverlay.y + (touch.locationX - 10) * 0.5));
                    updateSelectedText({ y: Math.round(newY * 10) / 10 });
                  }}
                />
              </View>
              <Pressable onPress={() => updateSelectedText({ y: Math.min(100, selectedOverlay.y + 1) })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
              </Pressable>
              <TextInput
                value={String(Math.round(selectedOverlay.y * 10) / 10)}
                onChangeText={(val) => {
                  const n = parseFloat(val);
                  if (!isNaN(n)) updateSelectedText({ y: Math.max(0, Math.min(100, n)) });
                }}
                keyboardType="numeric"
                style={[styles.numberInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>%</Text>
            </View>

            {/* Rotation */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.muted }]}>角度</Text>
              <Pressable onPress={() => updateSelectedText({ rotation: selectedOverlay.rotation - 1 })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
              </Pressable>
              <View style={styles.sliderTrack}>
                <View
                  style={[styles.sliderFill, { width: `${((selectedOverlay.rotation + 360) % 720) / 7.2}%`, backgroundColor: colors.warning }]}
                />
                <View
                  style={[styles.sliderThumb, { left: `${((selectedOverlay.rotation + 360) % 720) / 7.2}%`, backgroundColor: colors.warning }]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderMove={(evt) => {
                    const touch = evt.nativeEvent;
                    const newRot = Math.max(-360, Math.min(360, selectedOverlay.rotation + (touch.locationX - 10) * 1));
                    updateSelectedText({ rotation: Math.round(newRot) });
                  }}
                />
              </View>
              <Pressable onPress={() => updateSelectedText({ rotation: selectedOverlay.rotation + 1 })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
              </Pressable>
              <TextInput
                value={String(selectedOverlay.rotation)}
                onChangeText={(val) => {
                  const n = parseFloat(val);
                  if (!isNaN(n)) updateSelectedText({ rotation: Math.max(-360, Math.min(360, n)) });
                }}
                keyboardType="numbers-and-punctuation"
                style={[styles.numberInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>°</Text>
            </View>

            {/* Quick rotation presets */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              {[-180, -90, -45, 0, 45, 90, 180].map((deg) => (
                <Pressable
                  key={deg}
                  onPress={() => updateSelectedText({ rotation: deg })}
                  style={({ pressed }) => [
                    styles.miniChip,
                    { backgroundColor: selectedOverlay.rotation === deg ? colors.primary : colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: selectedOverlay.rotation === deg ? "#FFF" : colors.muted, fontSize: 10, fontWeight: "700" }}>
                    {deg}°
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Scale (new) */}
            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { color: colors.muted }]}>拡縮</Text>
              <Pressable onPress={() => {
                const cur = selectedOverlay.fontSize;
                if (cur > 8) updateSelectedText({ fontSize: cur - 1 });
              }} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
              </Pressable>
              <View style={styles.sliderTrack}>
                <View
                  style={[styles.sliderFill, { width: `${Math.min((selectedOverlay.fontSize / 72) * 100, 100)}%`, backgroundColor: colors.success }]}
                />
              </View>
              <Pressable onPress={() => {
                const cur = selectedOverlay.fontSize;
                if (cur < 120) updateSelectedText({ fontSize: cur + 1 });
              }} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
              </Pressable>
              <TextInput
                value={String(selectedOverlay.fontSize)}
                onChangeText={(val) => {
                  const n = parseInt(val);
                  if (!isNaN(n) && n >= 8 && n <= 120) updateSelectedText({ fontSize: n });
                }}
                keyboardType="numeric"
                style={[styles.numberInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>px</Text>
            </View>

            {/* Delete button */}
            <Pressable
              onPress={deleteSelectedText}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: `${colors.error}15`, borderWidth: 1, borderColor: colors.error, marginBottom: 8 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="trash" size={16} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>このテキストを削除</Text>
            </Pressable>
          </>
        )}

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderMusicPanel = () => (
    <View style={styles.panelInner}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>BGM</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
      >
        {BGM_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setSelectedBgmCategory(cat)}
            style={({ pressed }) => [
              styles.categoryChip,
              {
                backgroundColor:
                  selectedBgmCategory === cat ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={{
                color: selectedBgmCategory === cat ? "#FFFFFF" : colors.muted,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
        {filteredBgm.map((track) => (
          <Pressable
            key={track.id}
            onPress={() => {
              setSelectedBgm(selectedBgm === track.id ? null : track.id);
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.bgmItem,
              {
                borderColor:
                  selectedBgm === track.id ? colors.primary : colors.border,
                backgroundColor:
                  selectedBgm === track.id ? `${colors.primary}15` : "transparent",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol
              name="music.note"
              size={18}
              color={selectedBgm === track.id ? colors.primary : colors.muted}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={{
                  color:
                    selectedBgm === track.id ? colors.primary : colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {track.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {track.category} ·{" "}
                {Math.floor(track.duration / 60)}:
                {String(track.duration % 60).padStart(2, "0")}
              </Text>
            </View>
            {selectedBgm === track.id && (
              <IconSymbol name="checkmark" size={18} color={colors.primary} />
            )}
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        onPress={applyChanges}
        style={({ pressed }) => [
          styles.applyBtn,
          { backgroundColor: colors.primary },
          pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Text style={styles.applyBtnText}>適用</Text>
      </Pressable>
    </View>
  );

  const renderSpeedPanel = () => {
    const trimDuration = trimEnd - trimStart;
    const outputDuration = trimDuration / speed;
    const isHighSpeed = speed >= 4;

    return (
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>再生速度</Text>
        <View style={styles.speedDisplay}>
          <Text style={[styles.speedValue, { color: colors.primary }]}>
            {speed >= 1 ? `${speed}` : speed.toFixed(2)}x
          </Text>
          <Text style={[styles.speedOutputInfo, { color: colors.muted }]}>
            出力: {formatTime(outputDuration)}
          </Text>
          {isHighSpeed && (
            <Text style={[styles.speedWarning, { color: colors.warning }]}>
              高速再生モード
            </Text>
          )}
        </View>
        {/* Slow motion section */}
        <Text style={[styles.speedSectionLabel, { color: colors.muted }]}>スローモーション</Text>
        <View style={styles.speedPresets}>
          {SPEED_PRESETS.filter((p) => p.value < 1).map((preset) => (
            <Pressable
              key={preset.value}
              onPress={() => {
                setSpeed(preset.value);
                syncToVideoTrack({ speed: preset.value });
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.speedBtn,
                {
                  backgroundColor:
                    speed === preset.value ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: speed === preset.value ? "#FFFFFF" : colors.muted,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Normal speed section */}
        <Text style={[styles.speedSectionLabel, { color: colors.muted }]}>通常速度</Text>
        <View style={styles.speedPresets}>
          {SPEED_PRESETS.filter((p) => p.value >= 1 && p.value <= 3).map((preset) => (
            <Pressable
              key={preset.value}
              onPress={() => {
                setSpeed(preset.value);
                syncToVideoTrack({ speed: preset.value });
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.speedBtn,
                {
                  backgroundColor:
                    speed === preset.value ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: speed === preset.value ? "#FFFFFF" : colors.muted,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* High speed section */}
        <Text style={[styles.speedSectionLabel, { color: colors.warning }]}>高速再生</Text>
        <View style={styles.speedPresets}>
          {SPEED_PRESETS.filter((p) => p.value > 3).map((preset) => (
            <Pressable
              key={preset.value}
              onPress={() => {
                setSpeed(preset.value);
                syncToVideoTrack({ speed: preset.value });
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={({ pressed }) => [
                styles.speedBtn,
                {
                  backgroundColor:
                    speed === preset.value ? colors.warning : colors.border,
                  borderWidth: speed === preset.value ? 0 : 1,
                  borderColor: `${colors.warning}40`,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: speed === preset.value ? "#FFFFFF" : colors.warning,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Speed Curves Section */}
        {selectedClipId && (
          <>
            <Text style={[styles.speedSectionLabel, { color: colors.foreground, marginTop: 16, fontSize: 15, fontWeight: "700" }]}>
              速度カーブ
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
              クリップ内で速度を時間変化させます
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SPEED_CURVE_PRESETS.map((preset) => {
                  const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
                  const isActive = clip?.speedCurve?.name === preset.name;
                  return (
                    <Pressable
                      key={preset.name}
                      onPress={() => {
                        setTracks((prev) => prev.map((track) => ({
                          ...track,
                          clips: track.clips.map((c) =>
                            c.id === selectedClipId
                              ? { ...c, speedCurve: preset.name === "constant" ? undefined : { name: preset.name, points: preset.points } }
                              : c
                          ),
                        })));
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        styles.speedCurveCard,
                        {
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive ? `${colors.primary}15` : "transparent",
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {/* Mini speed curve visualization */}
                      <View style={styles.speedCurveViz}>
                        {preset.points.map((pt, i) => {
                          if (i === 0) return null;
                          const prevPt = preset.points[i - 1];
                          const x1 = prevPt.position * 68;
                          const x2 = pt.position * 68;
                          const y1 = 30 - (Math.min(prevPt.speed, 4) / 4) * 28;
                          const y2 = 30 - (Math.min(pt.speed, 4) / 4) * 28;
                          return (
                            <View
                              key={i}
                              style={{
                                position: "absolute",
                                left: x1,
                                top: Math.min(y1, y2),
                                width: Math.max(x2 - x1, 1),
                                height: Math.max(Math.abs(y2 - y1), 2),
                                backgroundColor: isActive ? colors.primary : colors.muted,
                                borderRadius: 1,
                              }}
                            />
                          );
                        })}
                        {/* Dots at control points */}
                        {preset.points.map((pt, i) => (
                          <View
                            key={`dot-${i}`}
                            style={{
                              position: "absolute",
                              left: pt.position * 68 - 2,
                              top: 30 - (Math.min(pt.speed, 4) / 4) * 28 - 2,
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: isActive ? colors.primary : colors.muted,
                            }}
                          />
                        ))}
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          color: isActive ? colors.primary : colors.foreground,
                          fontWeight: isActive ? "700" : "500",
                          textAlign: "center",
                        }}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    );
  };

  const addFrameSlot = () => {
    launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.8,
    }).then((result) => {
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newSlot: import("@/lib/editor-context").FrameSlot = {
          id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          videoUri: asset.uri,
          thumbnailUri: null,
          duration: (asset.duration ?? 0) / 1000,
        };
        setFrameSlots([...frameSlots, newSlot]);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });
  };

  const removeFrameSlot = (slotId: string) => {
    setFrameSlots(frameSlots.filter((s) => s.id !== slotId));
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const renderFramePanel = () => {
    const currentLayoutInfo = FRAME_LAYOUTS.find((l) => l.id === frameLayout);
    return (
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.panelInner}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>マルチフレーム</Text>

          {/* Layout selection */}
          <Text style={[styles.subLabel, { color: colors.muted }]}>レイアウト</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {FRAME_LAYOUTS.map((layout) => (
              <Pressable
                key={layout.id}
                onPress={() => {
                  setFrameLayout(layout.id);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center" as const,
                    borderWidth: 1.5,
                    borderColor: frameLayout === layout.id ? colors.primary : colors.border,
                    backgroundColor: frameLayout === layout.id ? `${colors.primary}15` : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 20, marginBottom: 2 }}>{layout.icon}</Text>
                <Text style={{ color: frameLayout === layout.id ? colors.primary : colors.muted, fontSize: 11, fontWeight: "600" }}>
                  {layout.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Frame slots */}
          {frameLayout !== "single" && (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={[styles.subLabel, { color: colors.muted, marginBottom: 0 }]}>
                  動画スロット ({frameSlots.length}/{currentLayoutInfo?.slots ?? 2})
                </Text>
                {frameSlots.length < (currentLayoutInfo?.slots ?? 2) && (
                  <Pressable
                    onPress={addFrameSlot}
                    style={({ pressed }) => [
                      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <IconSymbol name="plus" size={14} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 12 }}>動画追加</Text>
                  </Pressable>
                )}
              </View>
              {frameSlots.map((slot, idx) => (
                <View
                  key={slot.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 6,
                    backgroundColor: `${colors.surface}80`,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.border, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <IconSymbol name="film" size={18} color={colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      スロット {idx + 1}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {slot.duration > 0 ? formatTime(slot.duration) : "読み込み中..."}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeFrameSlot(slot.id)}
                    style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="xmark" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
              {frameSlots.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <IconSymbol name="video.badge.plus" size={32} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>動画を追加してマルチフレームを作成</Text>
                </View>
              )}
            </>
          )}

          {/* Layout preview */}
          <Text style={[styles.subLabel, { color: colors.muted, marginTop: 8 }]}>プレビュー</Text>
          <View style={{
            width: "100%",
            aspectRatio: 16 / 9,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            marginBottom: 12,
          }}>
            {frameLayout === "single" && (
              <View style={{ flex: 1, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>メイン</Text>
              </View>
            )}
            {frameLayout === "split-h" && (
              <View style={{ flex: 1, flexDirection: "row" }}>
                <View style={{ flex: 1, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>1</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: `${colors.warning}20`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 12 }}>2</Text>
                </View>
              </View>
            )}
            {frameLayout === "split-v" && (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>1</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: `${colors.warning}20`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 12 }}>2</Text>
                </View>
              </View>
            )}
            {frameLayout === "grid-4" && (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1, flexDirection: "row" }}>
                  <View style={{ flex: 1, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>1</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: `${colors.warning}20`, alignItems: "center", justifyContent: "center", borderBottomWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 12 }}>2</Text>
                  </View>
                </View>
                <View style={{ flex: 1, flexDirection: "row" }}>
                  <View style={{ flex: 1, backgroundColor: `${colors.success}20`, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.success, fontWeight: "600", fontSize: 12 }}>3</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: `${colors.error}20`, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 12 }}>4</Text>
                  </View>
                </View>
              </View>
            )}
            {frameLayout === "pip" && (
              <View style={{ flex: 1, backgroundColor: `${colors.primary}20`, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>メイン</Text>
                <View style={{ position: "absolute", bottom: 8, right: 8, width: "30%", aspectRatio: 16 / 9, backgroundColor: `${colors.warning}40`, borderRadius: 6, borderWidth: 1, borderColor: colors.warning, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 10 }}>PiP</Text>
                </View>
              </View>
            )}
          </View>

          <Pressable
            onPress={applyChanges}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.applyBtnText}>適用</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  const applyTransitionToSelectedClip = useCallback((type: TransitionType, duration: number) => {
    if (!selectedClipId) return;
    setTracks((prev) => prev.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === selectedClipId
          ? { ...clip, transition: type === "none" ? undefined : { type, duration } }
          : clip
      ),
    })));
  }, [selectedClipId]);

  const renderTransitionPanel = () => {
    if (!selectedClipId) {
      return (
        <View style={styles.panelInner}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>トランジション</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 16 }}>
            クリップを選択してからトランジションを設定してください
          </Text>
        </View>
      );
    }

    // Find current transition of selected clip
    const selectedClip = tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === selectedClipId);
    const currentType = selectedClip?.transition?.type ?? "none";

    return (
      <ScrollView style={styles.panelInner} showsVerticalScrollIndicator={false}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>トランジション</Text>

        {/* Transition type grid */}
        <View style={styles.transitionGrid}>
          {TRANSITION_PRESETS.map((preset) => {
            const isActive = currentType === preset.type;
            return (
              <Pressable
                key={preset.type}
                onPress={() => {
                  setSelectedTransition(preset.type);
                  applyTransitionToSelectedClip(preset.type, transitionDuration);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.transitionItem,
                  {
                    backgroundColor: isActive ? `${colors.primary}25` : `${colors.muted}15`,
                    borderColor: isActive ? colors.primary : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol
                  name={preset.icon as any}
                  size={22}
                  color={isActive ? colors.primary : colors.muted}
                />
                <Text
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    color: isActive ? colors.primary : colors.foreground,
                    fontWeight: isActive ? "600" : "400",
                  }}
                  numberOfLines={1}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Duration control */}
        {currentType !== "none" && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              長さ: {transitionDuration.toFixed(1)}秒
            </Text>
            <View style={styles.transitionDurations}>
              {[0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0].map((d) => (
                <Pressable
                  key={d}
                  onPress={() => {
                    setTransitionDuration(d);
                    applyTransitionToSelectedClip(currentType, d);
                  }}
                  style={({ pressed }) => [
                    styles.durationChip,
                    {
                      backgroundColor: transitionDuration === d ? colors.primary : `${colors.muted}20`,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: transitionDuration === d ? "#fff" : colors.foreground,
                      fontWeight: transitionDuration === d ? "600" : "400",
                    }}
                  >
                    {d}s
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Apply to all button */}
        {currentType !== "none" && (
          <Pressable
            onPress={() => {
              setTracks((prev) => prev.map((track) => ({
                ...track,
                clips: track.clips.map((clip, idx) =>
                  idx === 0 ? clip : { ...clip, transition: { type: currentType, duration: transitionDuration } }
                ),
              })));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.applyBtnText}>全クリップに適用</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  };

  // ---- Keyframe helpers ----
  const getSelectedClipKeyframes = useCallback((): Keyframe[] => {
    if (!selectedClipId) return [];
    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
    return clip?.keyframes ?? [];
  }, [selectedClipId, tracks]);

  const updateClipKeyframes = useCallback((newKeyframes: Keyframe[]) => {
    if (!selectedClipId) return;
    setTracks((prev) => prev.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === selectedClipId ? { ...clip, keyframes: newKeyframes } : clip
      ),
    })));
  }, [selectedClipId]);

  const addKeyframe = useCallback((property: KeyframeProperty, time: number, value: number) => {
    const kfs = getSelectedClipKeyframes();
    const newKf: Keyframe = {
      id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time,
      property,
      value,
      easing: keyframeEasing,
    };
    updateClipKeyframes([...kfs, newKf]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [getSelectedClipKeyframes, updateClipKeyframes, keyframeEasing]);

  const removeKeyframe = useCallback((kfId: string) => {
    const kfs = getSelectedClipKeyframes();
    updateClipKeyframes(kfs.filter((kf) => kf.id !== kfId));
  }, [getSelectedClipKeyframes, updateClipKeyframes]);

  const renderKeyframePanel = () => {
    if (!selectedClipId) {
      return (
        <View style={styles.panelInner}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>キーフレーム</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 16 }}>
            クリップを選択してからキーフレームを設定してください
          </Text>
        </View>
      );
    }

    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
    if (!clip) return null;

    const keyframes = clip.keyframes ?? [];
    const propertyKeyframes = keyframes.filter((kf) => kf.property === activeKeyframeProperty);
    const propConfig = KEYFRAME_PROPERTY_LABELS[activeKeyframeProperty];
    const clipDuration = (clip.trimEnd - clip.trimStart) / clip.speed;

    return (
      <ScrollView style={styles.panelInner} showsVerticalScrollIndicator={false}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>キーフレーム</Text>

        {/* Property selector */}
        <View style={styles.transitionGrid}>
          {(Object.keys(KEYFRAME_PROPERTY_LABELS) as KeyframeProperty[]).map((prop) => {
            const config = KEYFRAME_PROPERTY_LABELS[prop];
            const isActive = activeKeyframeProperty === prop;
            const count = keyframes.filter((kf) => kf.property === prop).length;
            return (
              <Pressable
                key={prop}
                onPress={() => setActiveKeyframeProperty(prop)}
                style={({ pressed }) => [
                  styles.transitionItem,
                  {
                    backgroundColor: isActive ? `${colors.primary}25` : `${colors.muted}15`,
                    borderColor: isActive ? colors.primary : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name={config.icon as any} size={20} color={isActive ? colors.primary : colors.muted} />
                <Text style={{ fontSize: 9, marginTop: 2, color: isActive ? colors.primary : colors.foreground, fontWeight: isActive ? "600" : "400" }} numberOfLines={1}>
                  {config.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.keyframeBadge, { backgroundColor: colors.primary }]}>
                    <Text style={{ fontSize: 8, color: "#fff", fontWeight: "700" }}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Easing selector */}
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 6 }}>
          イージング
        </Text>
        <View style={styles.transitionDurations}>
          {(["linear", "ease-in", "ease-out", "ease-in-out"] as Keyframe["easing"][]).map((e) => {
            const labels: Record<string, string> = { linear: "リニア", "ease-in": "イーズイン", "ease-out": "イーズアウト", "ease-in-out": "イーズ" };
            return (
              <Pressable
                key={e}
                onPress={() => setKeyframeEasing(e)}
                style={({ pressed }) => [
                  styles.durationChip,
                  { backgroundColor: keyframeEasing === e ? colors.primary : `${colors.muted}20` },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 11, color: keyframeEasing === e ? "#fff" : colors.foreground, fontWeight: keyframeEasing === e ? "600" : "400" }}>
                  {labels[e]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Add keyframe at current time */}
        <Pressable
          onPress={() => {
            const relativeTime = Math.max(0, Math.min(currentPlaybackTime - clip.timelineOffset, clipDuration));
            addKeyframe(activeKeyframeProperty, relativeTime, propConfig.defaultValue);
          }}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary, marginTop: 14 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.applyBtnText}>
            現在位置にキーフレーム追加 ({propConfig.label})
          </Text>
        </Pressable>

        {/* Existing keyframes list */}
        {propertyKeyframes.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              {propConfig.label}のキーフレーム ({propertyKeyframes.length})
            </Text>
            {propertyKeyframes
              .sort((a, b) => a.time - b.time)
              .map((kf) => (
                <View
                  key={kf.id}
                  style={[styles.keyframeRow, { borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                      {kf.time.toFixed(1)}s → {kf.value}{propConfig.unit}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {kf.easing}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeKeyframe(kf.id)}
                    style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                  >
                    <IconSymbol name="trash" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))}
          </View>
        )}

        {/* Quick presets */}
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginTop: 14, marginBottom: 8 }}>
          プリセット
        </Text>
        <View style={styles.transitionDurations}>
          <Pressable
            onPress={() => {
              // Fade in: opacity 0 -> 100
              updateClipKeyframes([
                ...keyframes.filter((kf) => kf.property !== "opacity"),
                { id: `kf_${Date.now()}_1`, time: 0, property: "opacity", value: 0, easing: "ease-out" },
                { id: `kf_${Date.now()}_2`, time: Math.min(1, clipDuration), property: "opacity", value: 100, easing: "ease-out" },
              ]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.durationChip, { backgroundColor: `${colors.muted}20` }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: colors.foreground }}>フェードイン</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              // Fade out: opacity 100 -> 0
              updateClipKeyframes([
                ...keyframes.filter((kf) => kf.property !== "opacity"),
                { id: `kf_${Date.now()}_1`, time: Math.max(0, clipDuration - 1), property: "opacity", value: 100, easing: "ease-in" },
                { id: `kf_${Date.now()}_2`, time: clipDuration, property: "opacity", value: 0, easing: "ease-in" },
              ]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.durationChip, { backgroundColor: `${colors.muted}20` }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: colors.foreground }}>フェードアウト</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              // Zoom in: scale 50 -> 100
              updateClipKeyframes([
                ...keyframes.filter((kf) => kf.property !== "scale"),
                { id: `kf_${Date.now()}_1`, time: 0, property: "scale", value: 50, easing: "ease-out" },
                { id: `kf_${Date.now()}_2`, time: clipDuration, property: "scale", value: 100, easing: "ease-out" },
              ]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.durationChip, { backgroundColor: `${colors.muted}20` }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: colors.foreground }}>ズームイン</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              // Slide in from left: x -100 -> 0
              updateClipKeyframes([
                ...keyframes.filter((kf) => kf.property !== "x"),
                { id: `kf_${Date.now()}_1`, time: 0, property: "x", value: -100, easing: "ease-out" },
                { id: `kf_${Date.now()}_2`, time: Math.min(0.5, clipDuration), property: "x", value: 0, easing: "ease-out" },
              ]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.durationChip, { backgroundColor: `${colors.muted}20` }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: colors.foreground }}>スライドイン</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              // Spin: rotation 0 -> 360
              updateClipKeyframes([
                ...keyframes.filter((kf) => kf.property !== "rotation"),
                { id: `kf_${Date.now()}_1`, time: 0, property: "rotation", value: 0, easing: "linear" },
                { id: `kf_${Date.now()}_2`, time: clipDuration, property: "rotation", value: 360, easing: "linear" },
              ]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [styles.durationChip, { backgroundColor: `${colors.muted}20` }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: colors.foreground }}>回転</Text>
          </Pressable>
        </View>

        {/* Clear all keyframes */}
        {keyframes.length > 0 && (
          <Pressable
            onPress={() => {
              updateClipKeyframes([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: colors.error, marginTop: 14 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.applyBtnText}>全キーフレームをクリア</Text>
          </Pressable>
        )}
      </ScrollView>
    );
  };

  // ---- Clip Tools Panel (Reverse, Freeze, Chroma Key, Blend, Stabilize, Flip, Crop) ----
  const updateSelectedClip = useCallback((updates: Partial<TimelineTrack["clips"][0]>) => {
    if (!selectedClipId) return;
    setTracks((prev) => prev.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === selectedClipId ? { ...clip, ...updates } : clip
      ),
    })));
  }, [selectedClipId]);

  const renderClipToolsPanel = () => {
    if (!selectedClipId) {
      return (
        <View style={styles.panelInner}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>クリップツール</Text>
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 16 }}>
            クリップを選択してください
          </Text>
        </View>
      );
    }

    const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId);
    if (!clip) return null;

    return (
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.panelInner}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>クリップツール</Text>

          {/* Toggle options */}
          {/* Reverse */}
          <Pressable
            onPress={() => {
              updateSelectedClip({ isReversed: !clip.isReversed });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.effectRow,
              { borderColor: clip.isReversed ? colors.primary : colors.border, backgroundColor: clip.isReversed ? `${colors.primary}10` : "transparent" },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="arrow.uturn.backward" size={20} color={clip.isReversed ? colors.primary : colors.muted} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: clip.isReversed ? colors.primary : colors.foreground, fontSize: 14, fontWeight: "600" }}>逆再生</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>クリップを反転再生</Text>
            </View>
            <Text style={{ color: clip.isReversed ? colors.primary : colors.muted, fontSize: 12, fontWeight: "600" }}>
              {clip.isReversed ? "ON" : "OFF"}
            </Text>
          </Pressable>

          {/* Stabilization */}
          <Pressable
            onPress={() => {
              updateSelectedClip({ isStabilized: !clip.isStabilized });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.effectRow,
              { borderColor: clip.isStabilized ? colors.primary : colors.border, backgroundColor: clip.isStabilized ? `${colors.primary}10` : "transparent", marginTop: 8 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="hand.raised" size={20} color={clip.isStabilized ? colors.primary : colors.muted} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: clip.isStabilized ? colors.primary : colors.foreground, fontSize: 14, fontWeight: "600" }}>手ブレ補正</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>映像を安定化</Text>
            </View>
            <Text style={{ color: clip.isStabilized ? colors.primary : colors.muted, fontSize: 12, fontWeight: "600" }}>
              {clip.isStabilized ? "ON" : "OFF"}
            </Text>
          </Pressable>

          {/* Flip */}
          <Text style={[styles.subLabel, { color: colors.muted, marginTop: 12 }]}>反転</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Pressable
              onPress={() => {
                updateSelectedClip({ isFlippedH: !clip.isFlippedH });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.miniChip,
                { backgroundColor: clip.isFlippedH ? colors.primary : colors.border, flex: 1, alignItems: "center" as const, paddingVertical: 10 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: clip.isFlippedH ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>↔ 左右反転</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                updateSelectedClip({ isFlippedV: !clip.isFlippedV });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={({ pressed }) => [
                styles.miniChip,
                { backgroundColor: clip.isFlippedV ? colors.primary : colors.border, flex: 1, alignItems: "center" as const, paddingVertical: 10 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: clip.isFlippedV ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>↕ 上下反転</Text>
            </Pressable>
          </View>

          {/* Freeze Frame */}
          <Text style={[styles.subLabel, { color: colors.muted }]}>フリーズフレーム</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Pressable
              onPress={() => {
                const relTime = Math.max(0, currentPlaybackTime - clip.timelineOffset);
                updateSelectedClip({ freezeFrameAt: clip.freezeFrameAt !== undefined ? undefined : relTime });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={({ pressed }) => [
                styles.effectRow,
                { flex: 1, borderColor: clip.freezeFrameAt !== undefined ? colors.warning : colors.border, backgroundColor: clip.freezeFrameAt !== undefined ? `${colors.warning}10` : "transparent" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="pause.circle" size={20} color={clip.freezeFrameAt !== undefined ? colors.warning : colors.muted} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: clip.freezeFrameAt !== undefined ? colors.warning : colors.foreground, fontSize: 14, fontWeight: "600" }}>
                  {clip.freezeFrameAt !== undefined ? `${clip.freezeFrameAt.toFixed(1)}s で静止` : "現在位置で静止画挿入"}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Blend Mode */}
          <Text style={[styles.subLabel, { color: colors.muted }]}>ブレンドモード</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {BLEND_MODE_LABELS.map(({ mode, label }) => {
                const isActive = (clip.blendMode ?? "normal") === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      updateSelectedClip({ blendMode: mode === "normal" ? undefined : mode });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={({ pressed }) => [
                      styles.animChip,
                      { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? `${colors.primary}15` : "transparent" },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: isActive ? colors.primary : colors.foreground, fontSize: 11, fontWeight: isActive ? "600" : "400" }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Chroma Key */}
          <Text style={[styles.subLabel, { color: colors.muted }]}>クロマキー（グリーンスクリーン）</Text>
          <Pressable
            onPress={() => {
              const current = clip.chromaKey;
              if (current?.enabled) {
                updateSelectedClip({ chromaKey: { ...current, enabled: false } });
              } else {
                updateSelectedClip({ chromaKey: { ...(current ?? DEFAULT_CHROMA_KEY), enabled: true } });
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={({ pressed }) => [
              styles.effectRow,
              { borderColor: clip.chromaKey?.enabled ? colors.success : colors.border, backgroundColor: clip.chromaKey?.enabled ? `${colors.success}10` : "transparent", marginBottom: 8 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="square.on.square.dashed" size={20} color={clip.chromaKey?.enabled ? colors.success : colors.muted} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: clip.chromaKey?.enabled ? colors.success : colors.foreground, fontSize: 14, fontWeight: "600" }}>クロマキー</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>背景色を透過</Text>
            </View>
            <Text style={{ color: clip.chromaKey?.enabled ? colors.success : colors.muted, fontSize: 12, fontWeight: "600" }}>
              {clip.chromaKey?.enabled ? "ON" : "OFF"}
            </Text>
          </Pressable>

          {clip.chromaKey?.enabled && (
            <>
              {/* Key color selection */}
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>キーカラー</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={styles.colorRow}>
                  {["#00FF00", "#0000FF", "#FF0000", "#00FFFF", "#FF00FF", "#FFFFFF", "#000000"].map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => updateSelectedClip({ chromaKey: { ...clip.chromaKey!, color: c } })}
                      style={[
                        styles.colorDotSmall,
                        { backgroundColor: c },
                        clip.chromaKey?.color === c && { borderColor: colors.primary, borderWidth: 2 },
                      ]}
                    />
                  ))}
                </View>
              </ScrollView>

              {/* Similarity */}
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: colors.muted }]}>許容</Text>
                <Pressable onPress={() => updateSelectedClip({ chromaKey: { ...clip.chromaKey!, similarity: Math.max(0, (clip.chromaKey?.similarity ?? 40) - 5) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
                </Pressable>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${clip.chromaKey?.similarity ?? 40}%`, backgroundColor: colors.success }]} />
                </View>
                <Pressable onPress={() => updateSelectedClip({ chromaKey: { ...clip.chromaKey!, similarity: Math.min(100, (clip.chromaKey?.similarity ?? 40) + 5) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                </Pressable>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", width: 36, textAlign: "center" }}>{clip.chromaKey?.similarity ?? 40}%</Text>
              </View>

              {/* Smoothness */}
              <View style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: colors.muted }]}>滑らか</Text>
                <Pressable onPress={() => updateSelectedClip({ chromaKey: { ...clip.chromaKey!, smoothness: Math.max(0, (clip.chromaKey?.smoothness ?? 10) - 5) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
                </Pressable>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${clip.chromaKey?.smoothness ?? 10}%`, backgroundColor: colors.success }]} />
                </View>
                <Pressable onPress={() => updateSelectedClip({ chromaKey: { ...clip.chromaKey!, smoothness: Math.min(100, (clip.chromaKey?.smoothness ?? 10) + 5) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                </Pressable>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", width: 36, textAlign: "center" }}>{clip.chromaKey?.smoothness ?? 10}%</Text>
              </View>
            </>
          )}

          {/* Crop */}
          <Text style={[styles.subLabel, { color: colors.muted, marginTop: 4 }]}>クロップ</Text>
          {(["top", "right", "bottom", "left"] as const).map((side) => {
            const labels: Record<string, string> = { top: "上", right: "右", bottom: "下", left: "左" };
            const value = clip.crop?.[side] ?? 0;
            return (
              <View key={side} style={styles.sliderRow}>
                <Text style={[styles.sliderLabel, { color: colors.muted }]}>{labels[side]}</Text>
                <Pressable onPress={() => updateSelectedClip({ crop: { ...(clip.crop ?? { top: 0, right: 0, bottom: 0, left: 0 }), [side]: Math.max(0, value - 1) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
                </Pressable>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${value}%`, backgroundColor: colors.primary }]} />
                </View>
                <Pressable onPress={() => updateSelectedClip({ crop: { ...(clip.crop ?? { top: 0, right: 0, bottom: 0, left: 0 }), [side]: Math.min(45, value + 1) } })} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                </Pressable>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", width: 36, textAlign: "center" }}>{value}%</Text>
              </View>
            );
          })}

          <Pressable
            onPress={applyChanges}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: colors.primary, marginTop: 12 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.applyBtnText}>適用</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  // ---- Sticker Panel ----
  const EMOJI_STICKERS = ["⭐", "❤️", "🔥", "😂", "👍", "🎉", "💯", "✨", "👏", "🙌", "💪", "🎵", "🎬", "📸", "💡", "🚀", "💎", "🏆", "👑", "🌟", "😎", "🤩", "💥", "⚡", "🎯", "🎨", "🎭", "🎸", "🎮", "📢"];

  const addSticker = useCallback((emoji: string) => {
    const newSticker: import("@/lib/editor-context").StickerOverlay = {
      id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      startTime: 0,
      endTime: project?.duration ?? 10,
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [project]);

  const renderStickerPanel = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>ステッカー</Text>

        {/* Emoji grid */}
        <View style={styles.transitionGrid}>
          {EMOJI_STICKERS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => addSticker(emoji)}
              style={({ pressed }) => [
                { width: 44, height: 44, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: `${colors.muted}15` },
                pressed && { opacity: 0.7, transform: [{ scale: 1.1 }] },
              ]}
            >
              <Text style={{ fontSize: 24 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {/* Active stickers list */}
        {stickers.length > 0 && (
          <>
            <Text style={[styles.subLabel, { color: colors.muted, marginTop: 12 }]}>配置済み ({stickers.length})</Text>
            {stickers.map((stk) => {
              const isSelected = selectedStickerId === stk.id;
              return (
                <View key={stk.id} style={[styles.effectRow, { borderColor: isSelected ? colors.primary : colors.border, marginBottom: 6 }]}>
                  <Text style={{ fontSize: 24, marginRight: 8 }}>{stk.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12 }}>
                      位置: ({Math.round(stk.x)}%, {Math.round(stk.y)}%) 拡大: {stk.scale.toFixed(1)}x
                    </Text>
                  </View>
                  <Pressable onPress={() => setStickers((prev) => prev.filter((s) => s.id !== stk.id))}>
                    <IconSymbol name="trash" size={16} color={colors.error} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [styles.applyBtn, { backgroundColor: colors.primary, marginTop: 12 }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  // ---- Audio Tools Panel (Beat Markers, Noise Reduction, Voice Over) ----
  const renderAudioToolsPanel = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>音声ツール</Text>

        {/* Beat Markers */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>ビートマーカー</Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>
          音楽のビートに合わせてタップしてマーカーを打つ
        </Text>
        <Pressable
          onPress={() => {
            setBeatMarkers((prev) => [...prev, { time: currentPlaybackTime }]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.warning },
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>🥁 ビートをタップ ({beatMarkers.length})</Text>
        </Pressable>

        {beatMarkers.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                マーカー: {beatMarkers.length}個
              </Text>
              <Pressable onPress={() => setBeatMarkers([])}>
                <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>全削除</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {beatMarkers.sort((a, b) => a.time - b.time).map((bm, i) => (
                  <View key={i} style={[styles.miniChip, { backgroundColor: colors.warning }]}>
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>{bm.time.toFixed(1)}s</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Noise Reduction */}
        <Text style={[styles.subLabel, { color: colors.muted, marginTop: 8 }]}>ノイズリダクション</Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>
          音声トラックのノイズを軽減
        </Text>
        {(() => {
          const audioTrack = tracks.find((t) => t.type === "audio");
          if (!audioTrack) return <Text style={{ color: colors.muted, fontSize: 12 }}>音声トラックがありません</Text>;
          return (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {["なし", "軽い", "中", "強い"].map((level, i) => {
                const volumes = [1.0, 0.9, 0.8, 0.7]; // Simulated via volume for now
                const isActive = Math.abs(audioTrack.volume - volumes[i]) < 0.05;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      setTracks((prev) => prev.map((t) =>
                        t.id === audioTrack.id ? { ...t, volume: volumes[i] } : t
                      ));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={({ pressed }) => [
                      styles.miniChip,
                      { flex: 1, alignItems: "center" as const, paddingVertical: 10, backgroundColor: isActive ? colors.primary : colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: isActive ? "#FFF" : colors.muted, fontSize: 12, fontWeight: "600" }}>{level}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })()}

        {/* Voice Over */}
        <Text style={[styles.subLabel, { color: colors.muted, marginTop: 8 }]}>ボイスオーバー</Text>
        <Pressable
          onPress={async () => {
            try {
              const { createVoiceRecorder } = require("@/lib/audio-service");
              const recorder = createVoiceRecorder();
              if (recorder.isRecording()) {
                const uri = await recorder.stop();
                // Add as a new audio track
                const newTrack = {
                  id: `track_vo_${Date.now()}`,
                  type: "audio" as const,
                  label: `VO ${(project?.voiceOvers?.length ?? 0) + 1}`,
                  clips: [{
                    id: `clip_vo_${Date.now()}`,
                    sourceUri: uri,
                    name: "ボイスオーバー",
                    duration: 10,
                    trimStart: 0,
                    trimEnd: 10,
                    timelineOffset: currentPlaybackTime,
                    speed: 1.0,
                    volume: 1.0,
                  }],
                  isMuted: false,
                  isSolo: false,
                  volume: 1.0,
                  color: "#F59E0B",
                };
                setTracks((prev) => [...prev, newTrack]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                await recorder.start();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
            } catch (e: any) {
              console.warn("Voice recording error:", e);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }}
          style={({ pressed }) => [
            styles.effectRow,
            { borderColor: colors.border, marginBottom: 6 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="mic" size={20} color={colors.error} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>録音開始 / 停止</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>再生位置から音声を録音してトラックに追加</Text>
          </View>
          <IconSymbol name="circle.fill" size={12} color={colors.error} />
        </Pressable>

        {/* Audio extraction */}
        <Pressable
          onPress={async () => {
            if (!project) return;
            try {
              const { extractAudio } = require("@/lib/audio-service");
              await extractAudio(project.videoUri);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              console.warn("Audio extraction error:", e);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          }}
          style={({ pressed }) => [
            styles.effectRow,
            { borderColor: colors.border, marginBottom: 12 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="waveform.and.magnifyingglass" size={20} color={colors.muted} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>音声を抽出</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>動画から音声だけを分離</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [styles.applyBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  // ---- Effects Panel ----
  const toggleEffect = useCallback((type: VideoEffect["type"]) => {
    setEffects((prev) => {
      const existing = prev.find((e) => e.type === type);
      if (existing) {
        return prev.filter((e) => e.type !== type);
      }
      return [...prev, { type, intensity: 50 }];
    });
  }, []);

  const updateEffectIntensity = useCallback((type: VideoEffect["type"], intensity: number) => {
    setEffects((prev) => prev.map((e) => e.type === type ? { ...e, intensity } : e));
  }, []);

  const renderEffectsPanel = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>エフェクト</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
          タップで有効/無効。スライダーで強度調整。
        </Text>

        {VIDEO_EFFECT_PRESETS.map((preset) => {
          const active = effects.find((e) => e.type === preset.type);
          return (
            <View key={preset.type} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  toggleEffect(preset.type);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.effectRow,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? `${colors.primary}10` : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconSymbol name={preset.icon as any} size={20} color={active ? colors.primary : colors.muted} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 14, fontWeight: "600" }}>
                    {preset.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{preset.description}</Text>
                </View>
                {active && (
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{active.intensity}%</Text>
                )}
              </Pressable>

              {/* Intensity slider when active */}
              {active && (
                <View style={styles.sliderRow}>
                  <Text style={[styles.sliderLabel, { color: colors.muted }]}>強度</Text>
                  <Pressable onPress={() => updateEffectIntensity(preset.type, Math.max(0, active.intensity - 5))} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
                  </Pressable>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${active.intensity}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Pressable onPress={() => updateEffectIntensity(preset.type, Math.min(100, active.intensity + 5))} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                  </Pressable>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", width: 36, textAlign: "center" }}>{active.intensity}%</Text>
                </View>
              )}
            </View>
          );
        })}

        {effects.length > 0 && (
          <Pressable
            onPress={() => {
              setEffects([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
            style={({ pressed }) => [
              styles.applyBtn,
              { backgroundColor: colors.error },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.applyBtnText}>すべてクリア</Text>
          </Pressable>
        )}

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary, marginTop: 8 },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  // ---- Color Adjustment Panel ----
  const updateColorAdj = useCallback((key: ColorAdjustmentKey, value: number) => {
    setColorAdj((prev) => ({ ...prev, [key]: value }));
  }, []);

  const renderColorPanel = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={styles.panelInner}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>カラー調整</Text>

        {(Object.keys(COLOR_ADJUSTMENT_LABELS) as ColorAdjustmentKey[]).map((key) => {
          const config = COLOR_ADJUSTMENT_LABELS[key];
          const value = colorAdj[key];
          const isDefault = value === DEFAULT_COLOR_ADJUSTMENTS[key];
          const range = config.max - config.min;
          const pct = ((value - config.min) / range) * 100;

          return (
            <View key={key} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <IconSymbol name={config.icon as any} size={14} color={isDefault ? colors.muted : colors.primary} />
                  <Text style={{ color: isDefault ? colors.muted : colors.foreground, fontSize: 13, fontWeight: "600" }}>
                    {config.label}
                  </Text>
                </View>
                <Pressable onPress={() => updateColorAdj(key, DEFAULT_COLOR_ADJUSTMENTS[key])}>
                  <Text style={{ color: isDefault ? colors.muted : colors.primary, fontSize: 12, fontWeight: "600" }}>
                    {value}{isDefault ? "" : " ↺"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.sliderRow}>
                <Pressable onPress={() => updateColorAdj(key, Math.max(config.min, value - 1))} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>−</Text>
                </Pressable>
                <View style={styles.sliderTrack}>
                  {/* Center line for bipolar sliders */}
                  {config.min < 0 && (
                    <View style={{ position: "absolute", left: "50%", top: 4, bottom: 4, width: 1, backgroundColor: `${colors.muted}40` }} />
                  )}
                  <View
                    style={[
                      styles.sliderFill,
                      config.min < 0
                        ? value >= 0
                          ? { left: "50%", width: `${(value / config.max) * 50}%`, backgroundColor: colors.primary }
                          : { right: "50%", width: `${(Math.abs(value) / Math.abs(config.min)) * 50}%`, backgroundColor: colors.warning, left: undefined }
                        : { width: `${pct}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <Pressable onPress={() => updateColorAdj(key, Math.min(config.max, value + 1))} style={({ pressed }) => [styles.fineBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.6 }]}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>+</Text>
                </Pressable>
                <TextInput
                  value={String(value)}
                  onChangeText={(val) => {
                    const n = parseInt(val);
                    if (!isNaN(n)) updateColorAdj(key, Math.max(config.min, Math.min(config.max, n)));
                  }}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.numberInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
            </View>
          );
        })}

        {/* Reset all */}
        <Pressable
          onPress={() => {
            setColorAdj({ ...DEFAULT_COLOR_ADJUSTMENTS });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.error },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.applyBtnText}>リセット</Text>
        </Pressable>

        <Pressable
          onPress={applyChanges}
          style={({ pressed }) => [
            styles.applyBtn,
            { backgroundColor: colors.primary, marginTop: 8 },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.applyBtnText}>適用</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  // Toolbar groups
  const TOOLBAR_GROUPS = [
    {
      id: "edit",
      icon: "scissors" as const,
      label: "編集",
      items: [
        { key: "trim" as PanelType, icon: "scissors" as const, label: "トリミング" },
        { key: "speed" as PanelType, icon: "speedometer" as const, label: "速度" },
        { key: "frame" as PanelType, icon: "rectangle.on.rectangle" as const, label: "フレーム" },
      ],
    },
    {
      id: "look",
      icon: "wand.and.stars" as const,
      label: "見た目",
      items: [
        { key: "filter" as PanelType, icon: "wand.and.stars" as const, label: "フィルター" },
        { key: "color" as PanelType, icon: "slider.horizontal.3" as const, label: "カラー" },
        { key: "effects" as PanelType, icon: "sparkles" as const, label: "エフェクト" },
      ],
    },
    {
      id: "text",
      icon: "textformat" as const,
      label: "テキスト",
      items: [
        { key: "text" as PanelType, icon: "textformat" as const, label: "テキスト" },
        { key: "sticker" as PanelType, icon: "face.smiling" as const, label: "ステッカー" },
      ],
    },
    {
      id: "audio",
      icon: "music.note" as const,
      label: "音声",
      items: [
        { key: "music" as PanelType, icon: "music.note" as const, label: "BGM" },
        { key: "audio-tools" as PanelType, icon: "waveform" as const, label: "音声ツール" },
      ],
    },
    {
      id: "clip",
      icon: "film" as const,
      label: "クリップ",
      items: [
        { key: "clip-tools" as PanelType, icon: "wrench" as const, label: "クリップツール" },
        { key: "transition" as PanelType, icon: "arrow.right.arrow.left" as const, label: "切替効果" },
        { key: "keyframe" as PanelType, icon: "diamond" as const, label: "キーフレーム" },
      ],
    },
  ];

  const renderToolbar = () => (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.border, borderLeftWidth: isLandscape ? 0.5 : 0, borderLeftColor: colors.border }}>
      {/* Sub-items row (shown when a group is expanded) */}
      {expandedGroup && (
        <View style={[styles.subToolbar, { borderBottomColor: colors.border }]}>
          {TOOLBAR_GROUPS.find((g) => g.id === expandedGroup)?.items.map((tool) => (
            <Pressable
              key={tool.key}
              onPress={() => {
                openPanel(tool.key);
                setExpandedGroup(null);
              }}
              style={({ pressed }) => [
                styles.subToolBtn,
                activePanel === tool.key && { backgroundColor: `${colors.primary}15` },
                pressed && { opacity: 0.6 },
              ]}
            >
              <IconSymbol
                name={tool.icon}
                size={18}
                color={activePanel === tool.key ? colors.primary : colors.foreground}
              />
              <Text style={[styles.subToolLabel, { color: activePanel === tool.key ? colors.primary : colors.foreground }]}>
                {tool.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Main group bar */}
      <View style={[isLandscape ? styles.toolbarLandscape : styles.toolbar]}>
        {TOOLBAR_GROUPS.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const hasActiveChild = group.items.some((i) => i.key === activePanel);
          return (
            <Pressable
              key={group.id}
              onPress={() => {
                if (group.items.length === 1) {
                  openPanel(group.items[0].key);
                  setExpandedGroup(null);
                } else {
                  setExpandedGroup(isExpanded ? null : group.id);
                }
              }}
              style={({ pressed }) => [
                isLandscape ? styles.toolBtnLandscape : styles.toolBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <IconSymbol
                name={group.icon}
                size={isLandscape ? 22 : 24}
                color={isExpanded || hasActiveChild ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.toolLabel,
                  { color: isExpanded || hasActiveChild ? colors.primary : colors.muted },
                  isLandscape && { fontSize: 9 },
                ]}
              >
                {group.label}
              </Text>
              {isExpanded && (
                <View style={[styles.groupIndicator, { backgroundColor: colors.primary }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // ---- Orientation indicator ----
  const renderOrientationBadge = () => (
    <View
      style={[
        styles.orientationBadge,
        { backgroundColor: `${colors.primary}30`, borderColor: colors.primary },
      ]}
    >
      <IconSymbol
        name={isLandscape ? "rectangle.landscape.rotate" : "rectangle.portrait.rotate"}
        size={14}
        color={colors.primary}
      />
      <Text style={[styles.orientationText, { color: colors.primary }]}>
        {isLandscape ? "横向き" : "縦向き"}
      </Text>
    </View>
  );

  // ---- LANDSCAPE LAYOUT ----
  if (isLandscape) {
    return (
      <ScreenContainer
        containerClassName="bg-background"
        edges={["left", "right"]}
      >
        <View style={styles.editorContainer}>
          {/* Compact Top Bar for landscape (hidden in fullscreen) */}
          {!isFullscreenPreview && (
          <View style={[styles.topBarLandscape, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </Pressable>
            <Text
              style={[styles.topBarTitleLandscape, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {project.title}
            </Text>
            {renderOrientationBadge()}
            <View style={styles.undoRedoGroup}>
              <Pressable
                onPress={undo}
                disabled={!canUndo}
                style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
              >
                <IconSymbol name="arrow.uturn.backward" size={18} color={canUndo ? colors.foreground : colors.muted} />
              </Pressable>
              <Pressable
                onPress={redo}
                disabled={!canRedo}
                style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
              >
                <IconSymbol name="arrow.uturn.forward" size={18} color={canRedo ? colors.foreground : colors.muted} />
              </Pressable>
            </View>
            <Pressable
              onPress={goToExport}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: colors.primary },
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
            >
              <Text style={styles.exportBtnText}>エクスポート</Text>
            </Pressable>
          </View>
          )}

          {/* Landscape main area: Video + Toolbar side by side */}
          <View style={[styles.landscapeBody, isFullscreenPreview && { flex: 1 }]}>
            {/* Left: Video preview (takes most space) */}
            <View style={styles.landscapeVideoArea}>
              {renderVideoPreview()}
              {!isFullscreenPreview && (
                <MultiTrackTimeline
                  tracks={tracks}
                  totalDuration={project.duration}
                  currentTime={currentPlaybackTime}
                  onTracksChange={(newTracks) => {
                    setTracks(newTracks);
                    const vt = newTracks.find((t) => t.type === "video");
                    if (vt && vt.clips.length > 0) {
                      const clip = vt.clips[0];
                      setSpeed(clip.speed);
                      setTrimStart(clip.trimStart);
                      setTrimEnd(clip.trimEnd);
                    }
                  }}
                  onClipSelect={(trackId, clipId) => {
                    setSelectedClipId(clipId || null);
                    if (clipId) {
                      const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
                      if (clip?.transition) {
                        setSelectedTransition(clip.transition.type);
                        setTransitionDuration(clip.transition.duration);
                      } else {
                        setSelectedTransition("none");
                      }
                    }
                  }}
                  selectedClipId={selectedClipId}
                  isLandscape
                  textOverlays={textOverlays}
                  onTextOverlaysChange={setTextOverlays}
                  onTextOverlaySelect={setSelectedTextId}
                  selectedTextId={selectedTextId}
                  onSeek={(time) => {
                    player.currentTime = time;
                    setCurrentPlaybackTime(time);
                  }}
                />
              )}
            </View>

            {/* Right: Tool panel or toolbar (hidden in fullscreen) */}
            {!isFullscreenPreview && (
              activePanel !== "none" ? (
                <ScrollView
                  style={[
                    styles.landscapePanelArea,
                    { backgroundColor: colors.surface, borderLeftColor: colors.border },
                  ]}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.panelContent}>
                    {activePanel === "trim" && renderTrimPanel()}
                    {activePanel === "filter" && renderFilterPanel()}
                    {activePanel === "text" && renderTextPanel()}
                    {activePanel === "music" && renderMusicPanel()}
                    {activePanel === "speed" && renderSpeedPanel()}
                    {activePanel === "frame" && renderFramePanel()}
                  </View>
                  {/* Inline toolbar at bottom of panel */}
                  {renderToolbar()}
                </ScrollView>
              ) : (
                renderToolbar()
              )
            )}
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ---- PORTRAIT LAYOUT (default) ----
  return (
    <ScreenContainer
      containerClassName="bg-background"
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.editorContainer}>
        {/* Top Bar (hidden in fullscreen) */}
        {!isFullscreenPreview && (
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
          </Pressable>
          <Text
            style={[styles.topBarTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {project.title}
          </Text>
          <View style={styles.undoRedoGroup}>
            <Pressable
              onPress={undo}
              disabled={!canUndo}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="arrow.uturn.backward" size={20} color={canUndo ? colors.foreground : colors.muted} />
            </Pressable>
            <Pressable
              onPress={redo}
              disabled={!canRedo}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="arrow.uturn.forward" size={20} color={canRedo ? colors.foreground : colors.muted} />
            </Pressable>
          </View>
          <Pressable
            onPress={goToExport}
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: colors.primary },
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.exportBtnText}>エクスポート</Text>
          </Pressable>
        </View>
        )}

        {/* Video Preview */}
        {renderVideoPreview()}

        {/* Timeline + Tools (hidden in fullscreen) */}
        {!isFullscreenPreview && (
          <>
            <MultiTrackTimeline
              tracks={tracks}
              totalDuration={project.duration}
              currentTime={currentPlaybackTime}
              onTracksChange={(newTracks) => {
                setTracks(newTracks);
                const vt = newTracks.find((t) => t.type === "video");
                if (vt && vt.clips.length > 0) {
                  const clip = vt.clips[0];
                  setSpeed(clip.speed);
                  setTrimStart(clip.trimStart);
                  setTrimEnd(clip.trimEnd);
                }
              }}
              onClipSelect={(trackId, clipId) => {
                    setSelectedClipId(clipId || null);
                    if (clipId) {
                      const clip = tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
                      if (clip?.transition) {
                        setSelectedTransition(clip.transition.type);
                        setTransitionDuration(clip.transition.duration);
                      } else {
                        setSelectedTransition("none");
                      }
                    }
                  }}
              selectedClipId={selectedClipId}
              textOverlays={textOverlays}
              onTextOverlaysChange={setTextOverlays}
              onTextOverlaySelect={setSelectedTextId}
              selectedTextId={selectedTextId}
            />

            {/* Tool Panel (animated) */}
            {renderToolPanel()}

            {/* Bottom Toolbar */}
            {renderToolbar()}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

const styles = StyleSheet.create({
  editorContainer: {
    flex: 1,
  },
  // ---- Top Bar (Portrait) ----
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  topBarBtn: {
    padding: 4,
  },
  undoRedoGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 12,
  },
  // ---- Top Bar (Landscape) ----
  topBarLandscape: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  topBarTitleLandscape: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    marginHorizontal: 10,
  },
  exportBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exportBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  // ---- Orientation Badge ----
  orientationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
  },
  orientationText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // ---- Video Preview ----
  previewContainer: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  previewContainerLandscape: {
    flex: 1,
  },
  videoView: {
    flex: 1,
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  textOverlayContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  freeTextOverlay: {
    position: "absolute",
    padding: 4,
    borderRadius: 4,
  },
  textOverlay: {
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  // ---- Timeline ----
  timeline: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  timelineInfoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timelineInfoText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tickContainer: {
    height: 6,
    position: "relative",
    marginBottom: 2,
  },
  tickMark: {
    position: "absolute",
    top: 0,
    width: 1,
    height: 6,
  },
  timelineBar: {
    height: 36,
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
  },
  timelineInactive: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  timelineFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  timelineHandle: {
    position: "absolute",
    top: 0,
    width: 14,
    height: 36,
    borderRadius: 3,
    marginLeft: -7,
    justifyContent: "center",
    alignItems: "center",
  },
  handleGrip: {
    gap: 2,
  },
  handleGripLine: {
    width: 4,
    height: 1.5,
    borderRadius: 1,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  // ---- Tool Panel ----
  panelContent: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  panelInner: {
    padding: 16,
    flex: 1,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  // ---- Trim Panel ----
  trimControls: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  trimField: {
    flex: 1,
  },
  trimLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  trimInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  trimValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  trimBtns: {
    flexDirection: "row",
    gap: 6,
  },
  trimBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  trimQuickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  trimQuickBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  trimQuickBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // ---- Filter Panel ----
  filterScroll: {
    marginBottom: 12,
  },
  filterItem: {
    alignItems: "center",
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 4,
  },
  filterPreview: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  filterName: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  // ---- Text Panel ----
  textInputField: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  styleToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  animChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  templateCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
  },
  // ---- Slider controls ----
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: "600",
    width: 28,
  },
  sliderTrack: {
    flex: 1,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(128,128,128,0.2)",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    opacity: 0.3,
  },
  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    top: 4,
  },
  fineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  numberInput: {
    width: 48,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 0,
  },
  // ---- Effects ----
  effectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  positionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  positionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
  },
  // ---- Music Panel ----
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  bgmItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  // ---- Speed Panel ----
  speedDisplay: {
    alignItems: "center",
    marginBottom: 12,
  },
  speedValue: {
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
  },
  speedOutputInfo: {
    fontSize: 13,
    marginTop: 2,
  },
  speedWarning: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  speedSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  speedPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  speedBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  // ---- Apply Button ----
  applyBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  // ---- Transition Panel ----
  transitionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  transitionItem: {
    width: 72,
    height: 64,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  transitionDurations: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  // ---- Keyframe Panel ----
  keyframeBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  keyframeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  // ---- Speed Curve ----
  speedCurveCard: {
    width: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 6,
    alignItems: "center",
  },
  speedCurveViz: {
    width: 68,
    height: 32,
    marginBottom: 4,
    position: "relative",
  },
  // ---- Toolbar (Portrait) ----
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingBottom: 16,
    borderTopWidth: 0.5,
  },
  toolBtn: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  toolLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  groupIndicator: {
    position: "absolute",
    bottom: 0,
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  subToolbar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
  },
  subToolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  subToolLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  // ---- Toolbar (Landscape) ----
  toolbarLandscape: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderLeftWidth: 0.5,
    gap: 4,
  },
  toolBtnLandscape: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  // ---- Landscape Layout ----
  landscapeBody: {
    flex: 1,
    flexDirection: "row",
  },
  landscapeVideoArea: {
    flex: 1,
  },
  landscapePanelArea: {
    width: 280,
    borderLeftWidth: 0.5,
  },
  // ---- Error / Empty State ----
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  // ---- Preview Badges ----
  previewBadges: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  previewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  // ---- Fullscreen Button ----
  fullscreenBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
