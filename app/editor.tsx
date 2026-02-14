import { useRef, useState, useCallback, useEffect } from "react";
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
import type { TimelineTrack } from "@/lib/editor-context";
import { createDefaultTracks } from "@/lib/editor-context";

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
];

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

type PanelType = "none" | "trim" | "filter" | "text" | "music" | "speed" | "frame";

// Frame layout definitions
const FRAME_LAYOUTS: { id: import("@/lib/editor-context").FrameLayout; label: string; icon: string; slots: number }[] = [
  { id: "single", label: "単一", icon: "■", slots: 1 },
  { id: "split-h", label: "左右分割", icon: "◫", slots: 2 },
  { id: "split-v", label: "上下分割", icon: "▤", slots: 2 },
  { id: "grid-4", label: "4分割", icon: "▦", slots: 4 },
  { id: "pip", label: "PiP", icon: "▣", slots: 2 },
];

const FONT_SIZES = [14, 18, 24, 32, 40, 56];

export default function EditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useEditor();
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
  const [showMultiTrack, setShowMultiTrack] = useState(false);

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
  });

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

  const renderVideoPreview = () => (
    <View style={[styles.previewContainer, isLandscape && styles.previewContainerLandscape]}>
      <VideoView
        style={styles.videoView}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
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
      {/* Text overlays - free positioned */}
      {textOverlays.map((overlay) => (
        <Pressable
          key={overlay.id}
          onPress={() => {
            setSelectedTextId(overlay.id);
            setTextInput(overlay.text);
            setTextColor(overlay.color);
            setTextSize(overlay.fontSize);
            setTextPosition(overlay.position);
            if (activePanel !== "text") openPanel("text");
          }}
          style={[
            styles.freeTextOverlay,
            {
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: [{ rotate: `${overlay.rotation}deg` }],
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
              },
            ]}
          >
            {overlay.text}
          </Text>
        </Pressable>
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
                  setTrimStart(Math.max(0, trimStart - stepLarge));
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
                onPress={() => setTrimStart(Math.max(0, trimStart - stepSmall))}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => setTrimStart(Math.min(trimEnd - 0.5, trimStart + stepSmall))}
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
                  setTrimStart(Math.min(trimEnd - 0.5, trimStart + stepLarge));
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
                  setTrimEnd(Math.max(trimStart + 0.5, trimEnd - stepLarge));
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
                onPress={() => setTrimEnd(Math.max(trimStart + 0.5, trimEnd - stepSmall))}
                style={({ pressed }) => [
                  styles.trimBtn,
                  { backgroundColor: colors.border },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-{stepSmall}s</Text>
              </Pressable>
              <Pressable
                onPress={() => setTrimEnd(Math.min(duration, trimEnd + stepSmall))}
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
                  setTrimEnd(Math.min(duration, trimEnd + stepLarge));
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
              setTrimStart(Math.max(0, mid - quarter));
              setTrimEnd(Math.min(duration, mid + quarter));
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
              setTrimStart(0);
              setTrimEnd(Math.min(duration, 30));
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
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1.5,
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
          style={[
            styles.textInputField,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
          returnKeyType="done"
        />

        {/* Font size */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>サイズ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FONT_SIZES.map((size) => (
              <Pressable
                key={size}
                onPress={() => {
                  setTextSize(size);
                  if (selectedOverlay) updateSelectedText({ fontSize: size });
                }}
                style={({ pressed }) => [
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    alignItems: "center" as const,
                    justifyContent: "center" as const,
                    backgroundColor: (selectedOverlay?.fontSize ?? textSize) === size ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: (selectedOverlay?.fontSize ?? textSize) === size ? "#FFFFFF" : colors.muted, fontWeight: "700", fontSize: 13 }}>
                  {size}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Color */}
        <Text style={[styles.subLabel, { color: colors.muted }]}>カラー</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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

        {/* Position controls for selected overlay */}
        {selectedOverlay && (
          <>
            <Text style={[styles.subLabel, { color: colors.muted }]}>位置調整</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>X: {Math.round(selectedOverlay.x)}%</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable
                    onPress={() => updateSelectedText({ x: Math.max(0, selectedOverlay.x - 5) })}
                    style={({ pressed }) => [styles.trimBtn, { backgroundColor: colors.border, flex: 1 }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-5</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSelectedText({ x: Math.min(100, selectedOverlay.x + 5) })}
                    style={({ pressed }) => [styles.trimBtn, { backgroundColor: colors.border, flex: 1 }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+5</Text>
                  </Pressable>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Y: {Math.round(selectedOverlay.y)}%</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Pressable
                    onPress={() => updateSelectedText({ y: Math.max(0, selectedOverlay.y - 5) })}
                    style={({ pressed }) => [styles.trimBtn, { backgroundColor: colors.border, flex: 1 }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>-5</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateSelectedText({ y: Math.min(100, selectedOverlay.y + 5) })}
                    style={({ pressed }) => [styles.trimBtn, { backgroundColor: colors.border, flex: 1 }, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 12 }}>+5</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Rotation */}
            <Text style={[styles.subLabel, { color: colors.muted }]}>回転: {selectedOverlay.rotation}°</Text>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
              {[-45, -15, 0, 15, 45].map((deg) => (
                <Pressable
                  key={deg}
                  onPress={() => updateSelectedText({ rotation: deg })}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      paddingVertical: 7,
                      borderRadius: 8,
                      alignItems: "center" as const,
                      backgroundColor: selectedOverlay.rotation === deg ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: selectedOverlay.rotation === deg ? "#FFFFFF" : colors.muted, fontWeight: "700", fontSize: 12 }}>
                    {deg}°
                  </Text>
                </Pressable>
              ))}
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

  const renderToolbar = () => (
    <View
      style={[
        isLandscape ? styles.toolbarLandscape : styles.toolbar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderLeftColor: colors.border,
        },
      ]}
    >
      {([
        { key: "trim" as PanelType, icon: "scissors" as const, label: "トリミング" },
        { key: "filter" as PanelType, icon: "wand.and.stars" as const, label: "フィルター" },
        { key: "text" as PanelType, icon: "textformat" as const, label: "テキスト" },
        { key: "music" as PanelType, icon: "music.note" as const, label: "BGM" },
        { key: "speed" as PanelType, icon: "speedometer" as const, label: "速度" },
        { key: "frame" as PanelType, icon: "rectangle.on.rectangle" as const, label: "フレーム" },
      ]).map((tool) => (
        <Pressable
          key={tool.key}
          onPress={() => openPanel(tool.key)}
          style={({ pressed }) => [
            isLandscape ? styles.toolBtnLandscape : styles.toolBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <IconSymbol
            name={tool.icon}
            size={isLandscape ? 22 : 24}
            color={activePanel === tool.key ? colors.primary : colors.muted}
          />
          <Text
            style={[
              styles.toolLabel,
              { color: activePanel === tool.key ? colors.primary : colors.muted },
              isLandscape && { fontSize: 9 },
            ]}
          >
            {tool.label}
          </Text>
        </Pressable>
      ))}
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
          {/* Compact Top Bar for landscape */}
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

          {/* Landscape main area: Video + Toolbar side by side */}
          <View style={styles.landscapeBody}>
            {/* Left: Video preview (takes most space) */}
            <View style={styles.landscapeVideoArea}>
              {renderVideoPreview()}
              {showMultiTrack ? (
                <MultiTrackTimeline
                  tracks={tracks}
                  totalDuration={project.duration}
                  onTracksChange={setTracks}
                  onClipSelect={(trackId, clipId) => setSelectedClipId(clipId || null)}
                  selectedClipId={selectedClipId}
                  isLandscape
                />
              ) : (
                renderTimeline()
              )}
            </View>

            {/* Right: Tool panel or toolbar */}
            {activePanel !== "none" ? (
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
        {/* Top Bar */}
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

        {/* Video Preview */}
        {renderVideoPreview()}

        {/* Timeline toggle */}
        <View style={[styles.timelineToggle, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => { setShowMultiTrack(false); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={({ pressed }) => [
              styles.timelineToggleBtn,
              !showMultiTrack && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: !showMultiTrack ? colors.primary : colors.muted, fontSize: 12, fontWeight: "600" }}>シンプル</Text>
          </Pressable>
          <Pressable
            onPress={() => { setShowMultiTrack(true); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={({ pressed }) => [
              styles.timelineToggleBtn,
              showMultiTrack && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: showMultiTrack ? colors.primary : colors.muted, fontSize: 12, fontWeight: "600" }}>マルチトラック</Text>
          </Pressable>
        </View>

        {/* Timeline */}
        {showMultiTrack ? (
          <MultiTrackTimeline
            tracks={tracks}
            totalDuration={project.duration}
            onTracksChange={setTracks}
            onClipSelect={(trackId, clipId) => setSelectedClipId(clipId || null)}
            selectedClipId={selectedClipId}
          />
        ) : (
          renderTimeline()
        )}

        {/* Tool Panel (animated) */}
        {renderToolPanel()}

        {/* Bottom Toolbar */}
        {renderToolbar()}
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
  // ---- Timeline Toggle ----
  timelineToggle: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  timelineToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
});
