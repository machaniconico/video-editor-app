import { useEffect, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor, type VideoProject } from "@/lib/editor-context";

export default function ProjectsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, loadProjects, saveProjects } = useEditor();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const openProject = useCallback(
    (project: VideoProject) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      dispatch({ type: "SET_CURRENT_PROJECT", payload: project });
      router.push("/editor" as any);
    },
    [dispatch, router]
  );

  const deleteProject = useCallback(
    (project: VideoProject) => {
      const doDelete = () => {
        dispatch({ type: "DELETE_PROJECT", payload: project.id });
        const updated = state.projects.filter((p) => p.id !== project.id);
        saveProjects(updated);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      };

      if (Platform.OS === "web") {
        if (confirm(`「${project.title}」を削除しますか？`)) {
          doDelete();
        }
      } else {
        Alert.alert("プロジェクト削除", `「${project.title}」を削除しますか？`, [
          { text: "キャンセル", style: "cancel" },
          { text: "削除", style: "destructive", onPress: doDelete },
        ]);
      }
    },
    [dispatch, saveProjects, state.projects]
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const renderProject = ({ item }: { item: VideoProject }) => (
    <Pressable
      onPress={() => openProject(item)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.cardThumb, { backgroundColor: colors.border }]}>
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.cardThumbImg} contentFit="cover" />
        ) : (
          <IconSymbol name="film" size={28} color={colors.muted} />
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardDate, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
      </View>
      <Pressable
        onPress={() => deleteProject(item)}
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
      >
        <IconSymbol name="trash.fill" size={18} color={colors.error} />
      </Pressable>
    </Pressable>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>プロジェクト</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {state.projects.length} 件
          </Text>
        </View>

        {state.projects.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="folder.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              プロジェクトがありません
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              ホーム画面から新しいプロジェクトを作成してください
            </Text>
          </View>
        ) : (
          <FlatList
            data={state.projects}
            renderItem={renderProject}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardThumb: {
    width: 80,
    height: 56,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardThumbImg: {
    width: 80,
    height: 56,
  },
  durationBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardDate: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
});
