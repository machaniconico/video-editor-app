import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useColors } from "@/hooks/use-colors";

const TOOLTIP_PREFIX = "tooltip_seen_";

interface TooltipProps {
  /** Unique ID for this tooltip (persisted so it only shows once) */
  id: string;
  /** Text to display */
  text: string;
  /** Position relative to the anchor */
  position?: "top" | "bottom";
  /** Whether to show the tooltip (controlled mode) */
  visible?: boolean;
  children: React.ReactNode;
}

export function Tooltip({ id, text, position = "bottom", visible: controlledVisible, children }: TooltipProps) {
  const colors = useColors();
  const [show, setShow] = useState(false);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (controlledVisible !== undefined) {
      setShow(controlledVisible);
      opacity.value = withTiming(controlledVisible ? 1 : 0, { duration: 200 });
      return;
    }
    // Auto-show: check if this tooltip has been seen before
    AsyncStorage.getItem(`${TOOLTIP_PREFIX}${id}`).then((seen) => {
      if (!seen) {
        // Show after a short delay
        setTimeout(() => {
          setShow(true);
          opacity.value = withDelay(300, withTiming(1, { duration: 300 }));
        }, 500);
      }
    });
  }, [id, controlledVisible, opacity]);

  const dismiss = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => setShow(false), 200);
    AsyncStorage.setItem(`${TOOLTIP_PREFIX}${id}`, "true");
  }, [id, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={dismiss}>
        {children}
      </Pressable>
      {show && (
        <Animated.View
          style={[
            styles.tooltip,
            position === "top" ? styles.tooltipTop : styles.tooltipBottom,
            { backgroundColor: colors.foreground },
            animStyle,
          ]}
          pointerEvents="box-none"
        >
          <Text style={[styles.tooltipText, { color: colors.background }]}>{text}</Text>
          <View
            style={[
              styles.arrow,
              position === "top" ? styles.arrowBottom : styles.arrowTop,
              { borderTopColor: position === "top" ? colors.foreground : "transparent", borderBottomColor: position === "bottom" ? colors.foreground : "transparent" },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Hook to manage tooltip first-time display.
 */
export function useTooltip(id: string): { shouldShow: boolean; dismiss: () => void } {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`${TOOLTIP_PREFIX}${id}`).then((seen) => {
      if (!seen) setShouldShow(true);
    });
  }, [id]);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    AsyncStorage.setItem(`${TOOLTIP_PREFIX}${id}`, "true");
  }, [id]);

  return { shouldShow, dismiss };
}

/**
 * Reset all tooltips (for testing).
 */
export async function resetAllTooltips(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const tooltipKeys = keys.filter((k) => k.startsWith(TOOLTIP_PREFIX));
  await AsyncStorage.multiRemove(tooltipKeys);
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  tooltip: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -80 }],
    width: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    ...Platform.select({
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.3)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  tooltipTop: {
    bottom: "100%",
    marginBottom: 8,
  },
  tooltipBottom: {
    top: "100%",
    marginTop: 8,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  arrow: {
    position: "absolute",
    left: "50%",
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  arrowTop: {
    top: -6,
    borderBottomWidth: 6,
  },
  arrowBottom: {
    bottom: -6,
    borderTopWidth: 6,
  },
});
