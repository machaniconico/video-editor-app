import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { launchImageLibraryAsync } from "expo-image-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  TimelineTrack,
  TimelineClip,
  TrackType,
  getNextTrackColor,
} from "@/lib/editor-context";

interface MultiTrackTimelineProps {
  tracks: TimelineTrack[];
  totalDuration: number;
  onTracksChange: (tracks: TimelineTrack[]) => void;
  onClipSelect?: (trackId: string, clipId: string) => void;
  selectedClipId?: string | null;
  isLandscape?: boolean;
}

// Zoom levels: seconds per screen width
const ZOOM_LEVELS = [5, 10, 20, 30, 60, 120, 300];

export function MultiTrackTimeline({
  tracks,
  totalDuration,
  onTracksChange,
  onClipSelect,
  selectedClipId,
  isLandscape = false,
}: MultiTrackTimelineProps) {
  const colors = useColors();
  const [zoomIndex, setZoomIndex] = useState(3);
  const [scrollOffset, setScrollOffset] = useState(0);
  const secondsPerScreen = ZOOM_LEVELS[zoomIndex];
  const pixelsPerSecond = 300 / secondsPerScreen; // 300px base width

  const haptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  }, []);

  const zoomIn = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
      haptic();
    }
  };

  const zoomOut = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1);
      haptic();
    }
  };

  const toggleMute = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isMuted: !t.isMuted } : t
    );
    onTracksChange(updated);
  };

  const toggleVisibility = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isHidden: !t.isHidden } : t
    );
    onTracksChange(updated);
  };

  const toggleSolo = (trackId: string) => {
    haptic();
    const updated = tracks.map((t) =>
      t.id === trackId ? { ...t, isSolo: !t.isSolo } : t
    );
    onTracksChange(updated);
  };

  const adjustTrackVolume = (trackId: string, delta: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newVol = Math.max(0, Math.min(1, t.volume + delta));
      return { ...t, volume: newVol };
    });
    onTracksChange(updated);
  };

  const addTrack = (type: TrackType) => {
    if (type === "video" || type === "audio") {
      launchImageLibraryAsync({
        mediaTypes: type === "video" ? ["videos"] : ["videos"],
        quality: 0.8,
      }).then((result) => {
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const dur = (asset.duration ?? 0) / 1000;
          const existingCount = tracks.filter((t) => t.type === type).length;
          const label = type === "video" ? `ビデオ ${existingCount + 1}` : `音声 ${existingCount + 1}`;
          const newTrack: TimelineTrack = {
            id: `track_${type[0]}${existingCount + 1}_${Date.now()}`,
            type,
            label,
            clips: [
              {
                id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                sourceUri: asset.uri,
                name: label,
                duration: dur,
                trimStart: 0,
                trimEnd: dur,
                timelineOffset: 0,
                speed: 1.0,
                volume: 1.0,
              },
            ],
            isMuted: false,
            isSolo: false,
            volume: 1.0,
            color: getNextTrackColor(type, existingCount),
          };
          onTracksChange([...tracks, newTrack]);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        }
      });
    } else {
      // BGM track
      const existingCount = tracks.filter((t) => t.type === "bgm").length;
      const newTrack: TimelineTrack = {
        id: `track_bgm${existingCount + 1}_${Date.now()}`,
        type: "bgm",
        label: `BGM ${existingCount + 1}`,
        clips: [],
        isMuted: false,
        isSolo: false,
        volume: 0.7,
        color: getNextTrackColor("bgm", existingCount),
      };
      onTracksChange([...tracks, newTrack]);
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const removeTrack = (trackId: string) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;

    const doRemove = () => {
      onTracksChange(tracks.filter((t) => t.id !== trackId));
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    if (Platform.OS === "web") {
      if (confirm(`「${track.label}」トラックを削除しますか？`)) doRemove();
    } else {
      Alert.alert(
        "トラック削除",
        `「${track.label}」トラックを削除しますか？`,
        [
          { text: "キャンセル", style: "cancel" },
          { text: "削除", style: "destructive", onPress: doRemove },
        ]
      );
    }
  };

  const adjustClipSpeed = (trackId: string, clipId: string, newSpeed: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, speed: Math.max(0.25, Math.min(10, newSpeed)) } : c
        ),
      };
    });
    onTracksChange(updated);
  };

  const adjustClipVolume = (trackId: string, clipId: string, delta: number) => {
    haptic();
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, volume: Math.max(0, Math.min(1, c.volume + delta)) } : c
        ),
      };
    });
    onTracksChange(updated);
  };

  // Calculate total timeline width
  const timelineWidth = Math.max(totalDuration * pixelsPerSecond, 300);

  // Generate time ruler marks
  const rulerInterval = secondsPerScreen <= 10 ? 1 : secondsPerScreen <= 30 ? 5 : secondsPerScreen <= 60 ? 10 : 30;
  const rulerMarks: number[] = [];
  for (let t = 0; t <= totalDuration; t += rulerInterval) {
    rulerMarks.push(t);
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getTrackIcon = (type: TrackType): any => {
    switch (type) {
      case "video": return "film";
      case "audio": return "waveform";
      case "bgm": return "music.note";
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {/* Header: Zoom controls + Add track */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>タイムライン</Text>
        <View style={s.headerActions}>
          <Pressable onPress={zoomIn} style={({ pressed }) => [s.zoomBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>+</Text>
          </Pressable>
          <Text style={[s.zoomLabel, { color: colors.muted }]}>{secondsPerScreen}s</Text>
          <Pressable onPress={zoomOut} style={({ pressed }) => [s.zoomBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>−</Text>
          </Pressable>
        </View>
      </View>

      {/* Timeline content */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scrollH}>
        <View style={{ width: timelineWidth + 120 }}>
          {/* Time ruler */}
          <View style={[s.ruler, { borderBottomColor: colors.border }]}>
            {rulerMarks.map((t) => (
              <View key={t} style={[s.rulerMark, { left: 120 + t * pixelsPerSecond }]}>
                <View style={[s.rulerLine, { backgroundColor: colors.border }]} />
                <Text style={[s.rulerText, { color: colors.muted }]}>{formatTime(t)}</Text>
              </View>
            ))}
          </View>

          {/* Tracks */}
          <ScrollView style={s.tracksScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {tracks.map((track) => (
              <View key={track.id} style={[s.trackRow, { borderBottomColor: colors.border }]}>
                {/* Track header (fixed left) */}
                <View style={[s.trackHeader, { backgroundColor: `${track.color}15`, borderRightColor: colors.border }]}>
                  <View style={s.trackLabelRow}>
                    <IconSymbol name={getTrackIcon(track.type)} size={14} color={track.color} />
                    <Text style={[s.trackLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {track.label}
                    </Text>
                  </View>
                  <View style={s.trackControls}>
                    {track.type === "video" ? (
                      /* Video track: eye icon for visibility toggle */
                      <Pressable
                        onPress={() => toggleVisibility(track.id)}
                        style={({ pressed }) => [
                          s.trackCtrlBtn,
                          track.isHidden && { backgroundColor: `${colors.error}30` },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <IconSymbol
                          name={track.isHidden ? "eye.slash" : "eye"}
                          size={12}
                          color={track.isHidden ? colors.error : colors.muted}
                        />
                      </Pressable>
                    ) : (
                      /* Audio/BGM track: speaker icon for mute toggle */
                      <Pressable
                        onPress={() => toggleMute(track.id)}
                        style={({ pressed }) => [
                          s.trackCtrlBtn,
                          track.isMuted && { backgroundColor: `${colors.error}30` },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <IconSymbol
                          name={track.isMuted ? "speaker.slash" : "speaker.wave.2"}
                          size={12}
                          color={track.isMuted ? colors.error : colors.muted}
                        />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => toggleSolo(track.id)}
                      style={({ pressed }) => [
                        s.trackCtrlBtn,
                        track.isSolo && { backgroundColor: `${colors.warning}30` },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "800", color: track.isSolo ? colors.warning : colors.muted }}>S</Text>
                    </Pressable>
                    {/* Volume */}
                    <View style={s.volumeRow}>
                      <Pressable onPress={() => adjustTrackVolume(track.id, -0.1)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>−</Text>
                      </Pressable>
                      <Text style={{ color: colors.foreground, fontSize: 10, fontWeight: "600", minWidth: 28, textAlign: "center" }}>
                        {Math.round(track.volume * 100)}%
                      </Text>
                      <Pressable onPress={() => adjustTrackVolume(track.id, 0.1)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => removeTrack(track.id)}
                      style={({ pressed }) => [s.trackCtrlBtn, pressed && { opacity: 0.6 }]}
                    >
                      <IconSymbol name="xmark" size={11} color={colors.error} />
                    </Pressable>
                  </View>
                </View>

                {/* Track clips area */}
                <View style={s.trackClipsArea}>
                  {track.clips.map((clip) => {
                    const clipWidth = ((clip.trimEnd - clip.trimStart) / clip.speed) * pixelsPerSecond;
                    const clipLeft = clip.timelineOffset * pixelsPerSecond;
                    const isSelected = selectedClipId === clip.id;
                    return (
                      <Pressable
                        key={clip.id}
                        onPress={() => onClipSelect?.(track.id, clip.id)}
                        style={({ pressed }) => [
                          s.clip,
                          {
                            left: clipLeft,
                            width: Math.max(clipWidth, 30),
                            backgroundColor: `${track.color}${isSelected ? "50" : "25"}`,
                            borderColor: isSelected ? track.color : `${track.color}60`,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text style={[s.clipName, { color: track.color }]} numberOfLines={1}>
                          {clip.name}
                        </Text>
                        <View style={s.clipInfo}>
                          <Text style={[s.clipDuration, { color: `${track.color}AA` }]}>
                            {formatTime((clip.trimEnd - clip.trimStart) / clip.speed)}
                          </Text>
                          {clip.speed !== 1.0 && (
                            <Text style={[s.clipSpeed, { color: `${track.color}AA` }]}>
                              {clip.speed}x
                            </Text>
                          )}
                        </View>
                        {/* Waveform visualization (decorative) */}
                        {(track.type === "audio" || track.type === "bgm") && (
                          <View style={s.waveformContainer}>
                            {Array.from({ length: Math.max(Math.floor(clipWidth / 4), 5) }).map((_, i) => (
                              <View
                                key={i}
                                style={[
                                  s.waveformBar,
                                  {
                                    height: 4 + Math.random() * 14,
                                    backgroundColor: `${track.color}60`,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  {track.clips.length === 0 && (
                    <View style={s.emptyTrack}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>空のトラック</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Selected clip controls */}
      {selectedClipId && (() => {
        let selectedTrack: TimelineTrack | undefined;
        let selectedClip: TimelineClip | undefined;
        for (const t of tracks) {
          const c = t.clips.find((cl) => cl.id === selectedClipId);
          if (c) { selectedTrack = t; selectedClip = c; break; }
        }
        if (!selectedTrack || !selectedClip) return null;
        return (
          <View style={[s.clipControls, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={s.clipControlsHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[s.clipColorDot, { backgroundColor: selectedTrack.color }]} />
                <Text style={[s.clipControlsTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {selectedClip.name}
                </Text>
              </View>
              <Pressable onPress={() => onClipSelect?.("", "")} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <IconSymbol name="xmark" size={16} color={colors.muted} />
              </Pressable>
            </View>
            <View style={s.clipControlsRow}>
              {/* Speed control */}
              <View style={s.clipControlItem}>
                <Text style={[s.clipControlLabel, { color: colors.muted }]}>速度</Text>
                <View style={s.clipControlBtns}>
                  <Pressable
                    onPress={() => adjustClipSpeed(selectedTrack!.id, selectedClip!.id, selectedClip!.speed - 0.25)}
                    style={({ pressed }) => [s.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>−</Text>
                  </Pressable>
                  <Text style={[s.clipControlValue, { color: colors.primary }]}>{selectedClip.speed}x</Text>
                  <Pressable
                    onPress={() => adjustClipSpeed(selectedTrack!.id, selectedClip!.id, selectedClip!.speed + 0.25)}
                    style={({ pressed }) => [s.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>+</Text>
                  </Pressable>
                </View>
              </View>
              {/* Volume control */}
              <View style={s.clipControlItem}>
                <Text style={[s.clipControlLabel, { color: colors.muted }]}>音量</Text>
                <View style={s.clipControlBtns}>
                  <Pressable
                    onPress={() => adjustClipVolume(selectedTrack!.id, selectedClip!.id, -0.1)}
                    style={({ pressed }) => [s.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>−</Text>
                  </Pressable>
                  <Text style={[s.clipControlValue, { color: colors.primary }]}>{Math.round(selectedClip.volume * 100)}%</Text>
                  <Pressable
                    onPress={() => adjustClipVolume(selectedTrack!.id, selectedClip!.id, 0.1)}
                    style={({ pressed }) => [s.miniBtn, { backgroundColor: colors.border }, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "700" }}>+</Text>
                  </Pressable>
                </View>
              </View>
              {/* Duration info */}
              <View style={s.clipControlItem}>
                <Text style={[s.clipControlLabel, { color: colors.muted }]}>長さ</Text>
                <Text style={[s.clipControlValue, { color: colors.foreground }]}>
                  {formatTime((selectedClip.trimEnd - selectedClip.trimStart) / selectedClip.speed)}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Add track buttons */}
      <View style={[s.addTrackRow, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => addTrack("video")}
          style={({ pressed }) => [
            s.addTrackBtn,
            { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="film" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>動画追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("audio")}
          style={({ pressed }) => [
            s.addTrackBtn,
            { backgroundColor: `${colors.warning}15`, borderColor: colors.warning },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="waveform" size={14} color={colors.warning} />
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "600" }}>音声追加</Text>
        </Pressable>
        <Pressable
          onPress={() => addTrack("bgm")}
          style={({ pressed }) => [
            s.addTrackBtn,
            { backgroundColor: `${colors.success}15`, borderColor: colors.success },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="music.note" size={14} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600" }}>BGM追加</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomLabel: {
    fontSize: 11,
    fontWeight: "600",
    minWidth: 28,
    textAlign: "center",
  },
  scrollH: {
    maxHeight: 240,
  },
  ruler: {
    height: 24,
    position: "relative",
    borderBottomWidth: 0.5,
  },
  rulerMark: {
    position: "absolute",
    top: 0,
    alignItems: "center",
  },
  rulerLine: {
    width: 1,
    height: 8,
  },
  rulerText: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 1,
  },
  tracksScroll: {
    maxHeight: 216,
  },
  trackRow: {
    flexDirection: "row",
    minHeight: 54,
    borderBottomWidth: 0.5,
  },
  trackHeader: {
    width: 120,
    padding: 6,
    borderRightWidth: 0.5,
    justifyContent: "center",
  },
  trackLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  trackLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  trackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trackCtrlBtn: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  trackClipsArea: {
    flex: 1,
    position: "relative",
    paddingVertical: 4,
  },
  clip: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    justifyContent: "center",
    overflow: "hidden",
  },
  clipName: {
    fontSize: 10,
    fontWeight: "700",
  },
  clipInfo: {
    flexDirection: "row",
    gap: 4,
    marginTop: 1,
  },
  clipDuration: {
    fontSize: 9,
    fontWeight: "500",
  },
  clipSpeed: {
    fontSize: 9,
    fontWeight: "700",
  },
  waveformContainer: {
    position: "absolute",
    bottom: 2,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
    height: 18,
    overflow: "hidden",
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
  },
  emptyTrack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  clipControls: {
    padding: 10,
    borderTopWidth: 0.5,
  },
  clipControlsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clipColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  clipControlsTitle: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 200,
  },
  clipControlsRow: {
    flexDirection: "row",
    gap: 16,
  },
  clipControlItem: {
    alignItems: "center",
    gap: 4,
  },
  clipControlLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  clipControlBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clipControlValue: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 36,
    textAlign: "center",
  },
  miniBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addTrackRow: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderTopWidth: 0.5,
  },
  addTrackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
