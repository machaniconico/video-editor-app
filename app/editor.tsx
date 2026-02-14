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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor } from "@/lib/editor-context";

const SCREEN_WIDTH = Dimensions.get("window").width;

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

type PanelType = "none" | "trim" | "filter" | "text" | "music" | "speed";

export default function EditorScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useEditor();
  const project = state.currentProject;

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

  const panelHeight = useSharedValue(0);
  const panelAnimStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    overflow: "hidden",
  }));

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
        panelHeight.value = withTiming(280, { duration: 250 });
      }
    },
    [activePanel, panelHeight]
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
      updates.filter = { id: selectedFilter, name: FILTERS.find((f) => f.id === selectedFilter)?.name ?? "", intensity: filterIntensity };
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
          <Text style={[styles.errorText, { color: colors.muted }]}>プロジェクトが選択されていません</Text>
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

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.editorContainer}>
        {/* Top Bar */}
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
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
        <View style={styles.previewContainer}>
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
          {/* Text overlay */}
          {textInput.trim() !== "" && (
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

        {/* Timeline */}
        <View style={[styles.timeline, { backgroundColor: colors.surface }]}>
          <View style={styles.timelineBar}>
            <View
              style={[
                styles.timelineFill,
                {
                  backgroundColor: colors.primary,
                  left: `${(trimStart / (project.duration || 1)) * 100}%`,
                  right: `${100 - (trimEnd / (project.duration || 1)) * 100}%`,
                },
              ]}
            />
            <View
              style={[
                styles.timelineHandle,
                {
                  left: `${(trimStart / (project.duration || 1)) * 100}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
            <View
              style={[
                styles.timelineHandle,
                {
                  left: `${(trimEnd / (project.duration || 1)) * 100}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.timeLabels}>
            <Text style={[styles.timeLabel, { color: colors.muted }]}>
              {formatTime(trimStart)}
            </Text>
            <Text style={[styles.timeLabel, { color: colors.muted }]}>
              {formatTime(trimEnd)}
            </Text>
          </View>
        </View>

        {/* Tool Panel (animated) */}
        <Animated.View style={panelAnimStyle}>
          <View style={[styles.panelContent, { backgroundColor: colors.surface }]}>
            {activePanel === "trim" && (
              <View style={styles.panelInner}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>トリミング</Text>
                <View style={styles.trimControls}>
                  <View style={styles.trimField}>
                    <Text style={[styles.trimLabel, { color: colors.muted }]}>開始</Text>
                    <View style={[styles.trimInput, { borderColor: colors.border }]}>
                      <Text style={[styles.trimValue, { color: colors.foreground }]}>
                        {formatTime(trimStart)}
                      </Text>
                    </View>
                    <View style={styles.trimBtns}>
                      <Pressable
                        onPress={() => setTrimStart(Math.max(0, trimStart - 0.5))}
                        style={({ pressed }) => [
                          styles.trimBtn,
                          { backgroundColor: colors.border },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: "600" }}>-</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setTrimStart(Math.min(trimEnd - 0.5, trimStart + 0.5))}
                        style={({ pressed }) => [
                          styles.trimBtn,
                          { backgroundColor: colors.border },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: "600" }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.trimField}>
                    <Text style={[styles.trimLabel, { color: colors.muted }]}>終了</Text>
                    <View style={[styles.trimInput, { borderColor: colors.border }]}>
                      <Text style={[styles.trimValue, { color: colors.foreground }]}>
                        {formatTime(trimEnd)}
                      </Text>
                    </View>
                    <View style={styles.trimBtns}>
                      <Pressable
                        onPress={() => setTrimEnd(Math.max(trimStart + 0.5, trimEnd - 0.5))}
                        style={({ pressed }) => [
                          styles.trimBtn,
                          { backgroundColor: colors.border },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: "600" }}>-</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setTrimEnd(Math.min(project.duration, trimEnd + 0.5))
                        }
                        style={({ pressed }) => [
                          styles.trimBtn,
                          { backgroundColor: colors.border },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: "600" }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
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
            )}

            {activePanel === "filter" && (
              <View style={styles.panelInner}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>フィルター</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {FILTERS.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        setSelectedFilter(f.id);
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                          { backgroundColor: f.color === "transparent" ? colors.border : f.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.filterName,
                          { color: selectedFilter === f.id ? colors.primary : colors.muted },
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
            )}

            {activePanel === "text" && (
              <View style={styles.panelInner}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>テキスト</Text>
                <TextInput
                  value={textInput}
                  onChangeText={setTextInput}
                  placeholder="テキストを入力..."
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.textInputField,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                  ]}
                  returnKeyType="done"
                />
                <Text style={[styles.subLabel, { color: colors.muted }]}>カラー</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.colorRow}>
                    {TEXT_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setTextColor(c)}
                        style={[
                          styles.colorDot,
                          { backgroundColor: c },
                          textColor === c && { borderColor: colors.primary, borderWidth: 2 },
                        ]}
                      />
                    ))}
                  </View>
                </ScrollView>
                <Text style={[styles.subLabel, { color: colors.muted }]}>位置</Text>
                <View style={styles.positionRow}>
                  {(["top", "center", "bottom"] as const).map((pos) => (
                    <Pressable
                      key={pos}
                      onPress={() => setTextPosition(pos)}
                      style={({ pressed }) => [
                        styles.positionBtn,
                        { borderColor: textPosition === pos ? colors.primary : colors.border },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={{
                          color: textPosition === pos ? colors.primary : colors.muted,
                          fontWeight: "600",
                          fontSize: 13,
                        }}
                      >
                        {pos === "top" ? "上" : pos === "center" ? "中央" : "下"}
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
            )}

            {activePanel === "music" && (
              <View style={styles.panelInner}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>BGM</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
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
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        styles.bgmItem,
                        {
                          borderColor: selectedBgm === track.id ? colors.primary : colors.border,
                          backgroundColor: selectedBgm === track.id ? `${colors.primary}15` : "transparent",
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
                            color: selectedBgm === track.id ? colors.primary : colors.foreground,
                            fontWeight: "600",
                            fontSize: 14,
                          }}
                        >
                          {track.title}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {track.category} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}
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
            )}

            {activePanel === "speed" && (
              <View style={styles.panelInner}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>再生速度</Text>
                <Text style={[styles.speedValue, { color: colors.primary }]}>{speed.toFixed(2)}x</Text>
                <View style={styles.speedPresets}>
                  {SPEED_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.value}
                      onPress={() => {
                        setSpeed(preset.value);
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => [
                        styles.speedBtn,
                        {
                          backgroundColor: speed === preset.value ? colors.primary : colors.border,
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
            )}
          </View>
        </Animated.View>

        {/* Bottom Toolbar */}
        <View style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {([
            { key: "trim" as PanelType, icon: "scissors" as const, label: "トリミング" },
            { key: "filter" as PanelType, icon: "wand.and.stars" as const, label: "フィルター" },
            { key: "text" as PanelType, icon: "textformat" as const, label: "テキスト" },
            { key: "music" as PanelType, icon: "music.note" as const, label: "BGM" },
            { key: "speed" as PanelType, icon: "speedometer" as const, label: "速度" },
          ]).map((tool) => (
            <Pressable
              key={tool.key}
              onPress={() => openPanel(tool.key)}
              style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
            >
              <IconSymbol
                name={tool.icon}
                size={24}
                color={activePanel === tool.key ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.toolLabel,
                  { color: activePanel === tool.key ? colors.primary : colors.muted },
                ]}
              >
                {tool.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
  previewContainer: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
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
  timeline: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    position: "relative",
  },
  timelineFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  timelineHandle: {
    position: "absolute",
    top: -6,
    width: 4,
    height: 16,
    borderRadius: 2,
    marginLeft: -2,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
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
    gap: 8,
  },
  trimBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
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
  speedValue: {
    fontSize: 40,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  speedPresets: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 16,
  },
  speedBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
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
});
