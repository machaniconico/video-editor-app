import { useState, useCallback, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor } from "@/lib/editor-context";
import { runExport, type ExportSettings, type ExportProgress } from "@/lib/export-service";

type ExportState = "settings" | "exporting" | "complete" | "error";
type Quality = ExportSettings["quality"];
type FPS = ExportSettings["fps"];
type Codec = ExportSettings["codec"];

const QUALITY_OPTIONS: { key: Quality; label: string; desc: string }[] = [
  { key: "high", label: "高品質", desc: "1080p · 最高画質" },
  { key: "medium", label: "標準", desc: "720p · バランス" },
  { key: "low", label: "軽量", desc: "480p · 小さいファイル" },
];

const FPS_OPTIONS: { key: FPS; label: string }[] = [
  { key: 24, label: "24fps · 映画" },
  { key: 30, label: "30fps · 標準" },
  { key: 60, label: "60fps · なめらか" },
];

const CODEC_OPTIONS: { key: Codec; label: string; desc: string }[] = [
  { key: "h264", label: "H.264", desc: "互換性が高い" },
  { key: "h265", label: "H.265 (HEVC)", desc: "高圧縮・高画質" },
];

export default function ExportScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state } = useEditor();
  const project = state.currentProject;

  const [exportState, setExportState] = useState<ExportState>("settings");
  const [quality, setQuality] = useState<Quality>("high");
  const [fps, setFps] = useState<FPS>(30);
  const [codec, setCodec] = useState<Codec>("h264");
  const [progressMessage, setProgressMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [exportedUri, setExportedUri] = useState<string | null>(null);
  const progress = useSharedValue(0);
  const abortRef = useRef(false);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const startExport = useCallback(async () => {
    if (!project) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setExportState("exporting");
    setProgressMessage("準備中...");
    progress.value = 0;
    abortRef.current = false;

    const settings: ExportSettings = { quality, fps, codec };

    const onProgress = (p: ExportProgress) => {
      if (abortRef.current) return;
      progress.value = withTiming(p.progress, { duration: 200 });
      setProgressMessage(p.message);
    };

    try {
      const uri = await runExport(project, settings, onProgress);
      if (abortRef.current) return;

      setExportedUri(uri);
      setExportState("complete");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      if (abortRef.current) return;
      setErrorMessage(e?.message ?? "エクスポートに失敗しました");
      setExportState("error");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [project, quality, fps, codec, progress]);

  const handleShare = useCallback(async () => {
    const uri = exportedUri ?? project?.videoUri;
    if (!uri) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.warn("Sharing failed:", e);
    }
  }, [exportedUri, project]);

  const handleDone = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.dismissAll();
  }, [router]);

  const handleRetry = useCallback(() => {
    setExportState("settings");
    setErrorMessage("");
    progress.value = 0;
  }, [progress]);

  if (!project) {
    return (
      <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>プロジェクトが見つかりません</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              if (exportState === "exporting") {
                abortRef.current = true;
              }
              router.back();
            }}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="xmark" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>エクスポート</Text>
          <View style={{ width: 30 }} />
        </View>

        {exportState === "settings" && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Project Summary */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{project.title}</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>長さ</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {formatTime(project.trimEnd - project.trimStart)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>トラック数</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {project.tracks.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>クリップ数</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {project.tracks.reduce((sum, t) => sum + t.clips.length, 0)}
                </Text>
              </View>
              {project.filter && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>フィルター</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                    {project.filter.name}
                  </Text>
                </View>
              )}
              {project.textOverlays.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>テキスト</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                    {project.textOverlays.length}個
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>速度</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {project.speed}x
                </Text>
              </View>
            </View>

            {/* Quality Selection */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>画質</Text>
            {QUALITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setQuality(opt.key);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderColor: quality === opt.key ? colors.primary : colors.border,
                    backgroundColor: quality === opt.key ? `${colors.primary}15` : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.optionInfo}>
                  <Text
                    style={{
                      color: quality === opt.key ? colors.primary : colors.foreground,
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    {opt.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{opt.desc}</Text>
                </View>
                {quality === opt.key && (
                  <IconSymbol name="checkmark" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}

            {/* FPS Selection */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>フレームレート</Text>
            <View style={styles.chipRow}>
              {FPS_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setFps(opt.key);
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: fps === opt.key ? colors.primary : colors.border,
                      backgroundColor: fps === opt.key ? `${colors.primary}15` : "transparent",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color: fps === opt.key ? colors.primary : colors.foreground,
                      fontWeight: fps === opt.key ? "600" : "400",
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Codec Selection */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>コーデック</Text>
            {CODEC_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setCodec(opt.key);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderColor: codec === opt.key ? colors.primary : colors.border,
                    backgroundColor: codec === opt.key ? `${colors.primary}15` : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.optionInfo}>
                  <Text
                    style={{
                      color: codec === opt.key ? colors.primary : colors.foreground,
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    {opt.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{opt.desc}</Text>
                </View>
                {codec === opt.key && (
                  <IconSymbol name="checkmark" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}

            {/* Export Button */}
            <Pressable
              onPress={startExport}
              style={({ pressed }) => [
                styles.exportButton,
                { backgroundColor: colors.primary },
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              ]}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>エクスポート開始</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {exportState === "exporting" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.exportingTitle, { color: colors.foreground }]}>
              エクスポート中...
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[styles.progressFill, { backgroundColor: colors.primary }, progressStyle]}
              />
            </View>
            <Text style={[styles.progressMessage, { color: colors.muted }]}>
              {progressMessage}
            </Text>
            <Pressable
              onPress={() => {
                abortRef.current = true;
                setExportState("settings");
                progress.value = 0;
              }}
              style={({ pressed }) => [
                styles.cancelBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>キャンセル</Text>
            </Pressable>
          </View>
        )}

        {exportState === "complete" && (
          <View style={styles.center}>
            <View style={[styles.successIcon, { backgroundColor: `${colors.success}20` }]}>
              <IconSymbol name="checkmark" size={48} color={colors.success} />
            </View>
            <Text style={[styles.completeTitle, { color: colors.foreground }]}>
              エクスポート完了！
            </Text>
            <Text style={[styles.completeHint, { color: colors.muted }]}>
              カメラロールに保存されました
            </Text>
            <View style={styles.completeActions}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                ]}
              >
                <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>共有</Text>
              </Pressable>
              <Pressable
                onPress={handleDone}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>完了</Text>
              </Pressable>
            </View>
          </View>
        )}

        {exportState === "error" && (
          <View style={styles.center}>
            <View style={[styles.successIcon, { backgroundColor: `${colors.error}20` }]}>
              <IconSymbol name="xmark" size={48} color={colors.error} />
            </View>
            <Text style={[styles.completeTitle, { color: colors.foreground }]}>
              エクスポート失敗
            </Text>
            <Text style={[styles.completeHint, { color: colors.muted }]}>
              {errorMessage}
            </Text>
            <View style={styles.completeActions}>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                ]}
              >
                <IconSymbol name="arrow.clockwise" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>再試行</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>戻る</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  optionInfo: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  exportingTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressMessage: {
    fontSize: 14,
    marginTop: 12,
  },
  cancelBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  completeHint: {
    fontSize: 15,
    marginTop: 8,
    marginBottom: 32,
    textAlign: "center",
  },
  completeActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
