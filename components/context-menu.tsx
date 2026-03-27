import React from "react";
import { View, Text, Pressable, StyleSheet, Platform, Modal } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface ContextMenuItem {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  title?: string;
}

export function ContextMenu({ visible, onClose, items, title }: ContextMenuProps) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} style={styles.overlay}>
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {title && (
            <Text style={[styles.menuTitle, { color: colors.muted }]}>{title}</Text>
          )}
          {items.map((item, i) => (
            <Pressable
              key={i}
              onPress={() => {
                item.onPress();
                onClose();
              }}
              style={({ pressed }) => [
                styles.menuItem,
                i < items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                pressed && { backgroundColor: `${colors.primary}10` },
              ]}
            >
              <IconSymbol name={item.icon as any} size={18} color={item.color ?? colors.foreground} />
              <Text style={[styles.menuItemText, { color: item.color ?? colors.foreground }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    width: 240,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(0,0,0,0.3)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
