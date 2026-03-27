import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

const ONBOARDING_KEY = "onboarding_completed";

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
  color: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: "film",
    title: "動画を選んで始めよう",
    description: "デバイスから動画を選択、またはテンプレートから始められます。用途に合ったアスペクト比も選べます。",
    color: "#007AFF",
  },
  {
    icon: "scissors",
    title: "直感的な編集",
    description: "タイムラインでクリップをトリミング・分割・並べ替え。ドラッグ操作で簡単に編集できます。",
    color: "#34C759",
  },
  {
    icon: "wand.and.stars",
    title: "エフェクト＆カラー",
    description: "フィルター、エフェクト、カラー調整で映像を仕上げ。テキストやステッカーも自由に配置。",
    color: "#FF9500",
  },
  {
    icon: "square.and.arrow.up",
    title: "書き出し＆共有",
    description: "1080p/H.265対応の高品質エクスポート。TikTok、Instagram、YouTubeにワンタップ共有。",
    color: "#AF52DE",
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const colors = useColors();
  const [currentStep, setCurrentStep] = useState(0);
  const translateX = useSharedValue(0);
  const screenWidth = Dimensions.get("window").width;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goToStep = useCallback((step: number) => {
    translateX.value = withSpring(-step * screenWidth, { damping: 20, stiffness: 200 });
    setCurrentStep(step);
  }, [screenWidth, translateX]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      goToStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, goToStep]);

  const handleComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  }, [onComplete]);

  const step = STEPS[currentStep];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Skip button */}
      <Pressable
        onPress={handleComplete}
        style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>スキップ</Text>
      </Pressable>

      {/* Content */}
      <Animated.View style={[styles.stepsContainer, animatedStyle]}>
        {STEPS.map((s, i) => (
          <View key={i} style={[styles.stepContent, { width: screenWidth }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${s.color}20` }]}>
              <IconSymbol name={s.icon as any} size={56} color={s.color} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.stepDesc, { color: colors.muted }]}>{s.description}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <Pressable key={i} onPress={() => goToStep(i)}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentStep ? step.color : colors.border,
                  width: i === currentStep ? 24 : 8,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Bottom buttons */}
      <View style={styles.bottomRow}>
        {currentStep > 0 && (
          <Pressable
            onPress={() => goToStep(currentStep - 1)}
            style={({ pressed }) => [
              styles.backBtn,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>戻る</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: step.color, flex: currentStep === 0 ? 1 : undefined },
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.nextBtnText}>
            {currentStep === STEPS.length - 1 ? "始める" : "次へ"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Check if onboarding has been completed.
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Reset onboarding state (for testing).
 */
export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  skipBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  stepsContainer: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  stepContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  stepDesc: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    width: "100%",
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
