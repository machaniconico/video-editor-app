import { useState, useEffect, useCallback, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor } from "@/lib/editor-context";

type ExportState = "settings" | "exporting" | "complete" | "error";
type Quality = "high" | "medium" | "low";

const QUALITY_OPTIONS: { key: Quality; label: string; desc: string }[] = [
  { key: "high", label: "高品質", desc: "1080p · 最高画質" },
  { key: "medium", label: "標準", desc: "720p · バランス" },
  { key: "low", label: "軽量", desc: "480p · 小さいファイル" },
];

export default function ExportScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state } = useEditor();
  const project = state.currentProject;

  const [exportState, setExportState] = useState<ExportState>("settings");
  const [quality, setQuality] = useState<Quality>("high");
  const progress = useSharedValue(0);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const startExport = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setExportState("exporting");
    progress.value = 0;

    // Simulate export progress
    progress.value = withTiming(1, { duration: 3000, easing: Easing.linear });

    setTimeout(() => {
      setExportState("complete");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 3200);
  }, [progress]);

  const handleShare = useCallback(async () => {
    if (!project) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(project.videoUri);
      }
    } catch (e) {
      console.warn("Sharing failed:", e);
    }
  }, [project]);

  const handleDone = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.dismissAll();
  }, [router]);

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
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <IconSymbol name="xmark" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>エクスポート</Text>
          <View style={{ width: 30 }} />
        </View>

        {exportState === "settings" && (
          <View style={styles.content}>
            {/* Project Summary */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{project.title}</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>長さ</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {formatTime(project.trimEnd - project.trimStart)}
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
              {project.textOverlay && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>テキスト</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={1}>
                    {project.textOverlay.text}
                  </Text>
                </View>
              )}
              {project.bgmTrack && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>BGM</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                    {project.bgmTrack.title}
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>画質を選択</Text>
            {QUALITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  setQuality(opt.key);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.qualityOption,
                  {
                    borderColor: quality === opt.key ? colors.primary : colors.border,
                    backgroundColor: quality === opt.key ? `${colors.primary}15` : "transparent",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.qualityInfo}>
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
          </View>
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
            <Text style={[styles.exportingHint, { color: colors.muted }]}>
              しばらくお待ちください
            </Text>
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
              動画が正常にエクスポートされました
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
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  qualityOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  qualityInfo: {
    flex: 1,
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
  exportingHint: {
    fontSize: 14,
    marginTop: 12,
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
