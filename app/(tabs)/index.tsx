import { useEffect, useCallback, useState } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useEditor, type VideoProject } from "@/lib/editor-context";
import { SwipeableRow } from "@/components/swipeable-row";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch, loadProjects, saveProjects, createProject } = useEditor();

  // Confirmation dialog state (for web fallback)
  const [deleteTarget, setDeleteTarget] = useState<VideoProject | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const pickVideo = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const duration = (asset.duration ?? 0) / 1000;
        const project = createProject(asset.uri, duration, null);

        const updatedProjects = [project, ...state.projects];
        await saveProjects(updatedProjects);

        router.push("/editor" as any);
      }
    } catch (e) {
      console.warn("Failed to pick video:", e);
    }
  }, [createProject, router, saveProjects, state.projects]);

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

  const confirmDelete = useCallback(
    (project: VideoProject) => {
      if (Platform.OS === "web") {
        // Web: use custom modal
        setDeleteTarget(project);
        setShowDeleteModal(true);
      } else {
        // Native: use Alert
        Alert.alert(
          "プロジェクトを削除",
          `「${project.title}」を削除しますか？\nこの操作は取り消せません。`,
          [
            { text: "キャンセル", style: "cancel" },
            {
              text: "削除",
              style: "destructive",
              onPress: () => executeDelete(project),
            },
          ]
        );
      }
    },
    []
  );

  const executeDelete = useCallback(
    async (project: VideoProject) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      dispatch({ type: "DELETE_PROJECT", payload: project.id });
      const updatedProjects = state.projects.filter((p) => p.id !== project.id);
      await saveProjects(updatedProjects);
    },
    [dispatch, state.projects, saveProjects]
  );

  const handleWebDeleteConfirm = useCallback(async () => {
    if (deleteTarget) {
      await executeDelete(deleteTarget);
    }
    setShowDeleteModal(false);
    setDeleteTarget(null);
  }, [deleteTarget, executeDelete]);

  const handleWebDeleteCancel = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const renderProject = ({ item }: { item: VideoProject }) => (
    <SwipeableRow onDelete={() => confirmDelete(item)}>
      <Pressable
        onPress={() => openProject(item)}
        style={({ pressed }) => [
          styles.projectCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
          {item.thumbnailUri ? (
            <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnailImage} contentFit="cover" />
          ) : (
            <IconSymbol name="film" size={32} color={colors.muted} />
          )}
        </View>
        <View style={styles.projectInfo}>
          <Text style={[styles.projectTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.projectMeta, { color: colors.muted }]}>
            {formatDuration(item.duration)} · {formatDate(item.updatedAt)}
          </Text>
        </View>
        <View style={styles.swipeHint}>
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        </View>
      </Pressable>
    </SwipeableRow>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: colors.foreground }]}>VideoEdit Pro</Text>
          <Text style={[styles.appSubtitle, { color: colors.muted }]}>動画を自由に編集</Text>
        </View>

        {/* New Project Button */}
        <Pressable
          onPress={pickVideo}
          style={({ pressed }) => [
            styles.newProjectBtn,
            { backgroundColor: colors.primary },
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <View style={styles.newProjectContent}>
            <View style={[styles.newProjectIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <IconSymbol name="plus" size={32} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.newProjectTitle}>新しいプロジェクト</Text>
              <Text style={styles.newProjectDesc}>デバイスから動画を選択</Text>
            </View>
          </View>
        </Pressable>

        {/* Recent Projects */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>最近のプロジェクト</Text>
        </View>

        {state.isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : state.projects.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="film" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              まだプロジェクトがありません
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              上のボタンから動画を選択して始めましょう
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

      {/* Web Delete Confirmation Modal */}
      {Platform.OS === "web" && (
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={handleWebDeleteCancel}
        >
          <Pressable
            onPress={handleWebDeleteCancel}
            style={styles.modalOverlay}
          >
            <Pressable
              onPress={() => {}}
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <View style={styles.modalIconContainer}>
                <View style={[styles.modalIconCircle, { backgroundColor: "#FF3B3020" }]}>
                  <IconSymbol name="trash.fill" size={28} color="#FF3B30" />
                </View>
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                プロジェクトを削除
              </Text>
              <Text style={[styles.modalMessage, { color: colors.muted }]}>
                「{deleteTarget?.title}」を削除しますか？{"\n"}この操作は取り消せません。
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  onPress={handleWebDeleteCancel}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalCancelBtn,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: colors.foreground }]}>
                    キャンセル
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleWebDeleteConfirm}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalDeleteBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                    削除
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
    paddingBottom: 24,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  newProjectBtn: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  newProjectContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  newProjectIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  newProjectTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  newProjectDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumbnail: {
    width: 64,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbnailImage: {
    width: 64,
    height: 48,
  },
  projectInfo: {
    flex: 1,
    marginLeft: 12,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  projectMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  swipeHint: {
    paddingLeft: 8,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 320,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalIconContainer: {
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalDeleteBtn: {
    backgroundColor: "#FF3B30",
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
