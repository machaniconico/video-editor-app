import React, { useEffect, useCallback, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export type ToastType = "success" | "info" | "warning" | "error";

interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  icon?: string;
}

interface FeedbackToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
  duration?: number;
}

export function FeedbackToast({ message, onDismiss, duration = 2000 }: FeedbackToastProps) {
  const colors = useColors();
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (message) {
      translateY.value = withTiming(0, { duration: 250 });
      opacity.value = withTiming(1, { duration: 250 });

      // Auto-dismiss
      translateY.value = withDelay(duration, withTiming(-80, { duration: 250 }));
      opacity.value = withDelay(duration, withTiming(0, { duration: 250 }));
      const timer = setTimeout(onDismiss, duration + 300);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onDismiss, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!message) return null;

  const typeColors: Record<ToastType, string> = {
    success: "#34C759",
    info: "#007AFF",
    warning: "#FF9500",
    error: "#FF3B30",
  };

  const defaultIcons: Record<ToastType, string> = {
    success: "checkmark.circle.fill",
    info: "info.circle.fill",
    warning: "exclamationmark.triangle.fill",
    error: "xmark.circle.fill",
  };

  const bgColor = typeColors[message.type];
  const icon = message.icon ?? defaultIcons[message.type];

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={[styles.toast, { backgroundColor: bgColor }]}>
        <IconSymbol name={icon as any} size={18} color="#FFFFFF" />
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Hook for managing toast messages.
 */
export function useToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, type: ToastType = "info", icon?: string) => {
    setMessage({
      id: `toast_${Date.now()}`,
      type,
      text,
      icon,
    });
  }, []);

  const dismissToast = useCallback(() => {
    setMessage(null);
  }, []);

  return { message, showToast, dismissToast };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    pointerEvents: "none",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 300,
    ...Platform.select({
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.2)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
