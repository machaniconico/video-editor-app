import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}>
        <IconSymbol name={icon as any} size={32} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
