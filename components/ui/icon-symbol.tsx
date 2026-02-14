// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "folder.fill": "folder",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "scissors": "content-cut",
  "camera.filters": "filter",
  "textformat": "text-fields",
  "music.note": "music-note",
  "speedometer": "speed",
  "square.and.arrow.up": "share",
  "plus": "add",
  "xmark": "close",
  "checkmark": "check",
  "trash.fill": "delete",
  "arrow.left": "arrow-back",
  "slider.horizontal.3": "tune",
  "wand.and.stars": "auto-fix-high",
  "photo.on.rectangle": "photo-library",
  "film": "movie",
  "rectangle.landscape.rotate": "screen-rotation",
  "rectangle.portrait.rotate": "screen-lock-rotation",
  "rectangle.split.2x1": "view-column",
  "rectangle.split.1x2": "view-stream",
  "rectangle.split.2x2": "grid-view",
  "pip": "picture-in-picture",
  "text.cursor": "text-format",
  "arrow.up.and.down.and.arrow.left.and.right": "open-with",
  "textformat.size": "format-size",
  "rotate.right": "rotate-right",
  "plus.circle": "add-circle",
  "minus.circle": "remove-circle",
  "trash": "delete-outline",
  "rectangle.on.rectangle": "filter-none",
  "video.badge.plus": "video-library",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
