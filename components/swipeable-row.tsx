import React, { useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  deleteButtonWidth?: number;
}

/**
 * A swipeable row component that reveals a delete button when swiped left.
 * Uses react-native-gesture-handler + reanimated for smooth gesture handling.
 */
export function SwipeableRow({
  children,
  onDelete,
  deleteButtonWidth = 80,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const contextX = useSharedValue(0);
  const isOpen = useSharedValue(false);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleDelete = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onDelete();
  }, [onDelete]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((event) => {
      const newX = contextX.value + event.translationX;
      // Only allow left swipe (negative values), clamp to delete button width
      translateX.value = Math.max(-deleteButtonWidth, Math.min(0, newX));
    })
    .onEnd((event) => {
      const threshold = deleteButtonWidth / 2;
      if (translateX.value < -threshold || event.velocityX < -500) {
        // Open: snap to show delete button
        translateX.value = withSpring(-deleteButtonWidth, {
          damping: 20,
          stiffness: 200,
        });
        isOpen.value = true;
        runOnJS(triggerHaptic)();
      } else {
        // Close: snap back
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
        isOpen.value = false;
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    // Tap anywhere to close if open
    if (isOpen.value) {
      translateX.value = withTiming(0, { duration: 200 });
      isOpen.value = false;
    }
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteAnimStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [-deleteButtonWidth, 0],
      [deleteButtonWidth, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      translateX.value,
      [-deleteButtonWidth, -20, 0],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    );
    return { width, opacity };
  });

  return (
    <View style={styles.container}>
      {/* Delete button behind the row */}
      <Animated.View style={[styles.deleteContainer, deleteAnimStyle]}>
        <Pressable
          onPress={handleDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <IconSymbol name="trash.fill" size={22} color="#FFFFFF" />
          <Text style={styles.deleteText}>削除</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable content */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.rowContent, rowAnimStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    marginBottom: 8,
    borderRadius: 12,
  },
  deleteContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  deleteText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  rowContent: {
    backgroundColor: "transparent",
  },
});
