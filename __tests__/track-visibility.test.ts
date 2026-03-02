import { describe, it, expect } from "vitest";
import { createDefaultTracks, TimelineTrack } from "../lib/editor-context";

describe("Track Visibility and Mute", () => {
  it("should create default tracks with isHidden=false for video track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const videoTrack = tracks.find((t) => t.type === "video");
    expect(videoTrack).toBeDefined();
    expect(videoTrack!.isHidden).toBe(false);
  });

  it("should create default tracks with isMuted=false for audio track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const audioTrack = tracks.find((t) => t.type === "audio");
    expect(audioTrack).toBeDefined();
    expect(audioTrack!.isMuted).toBe(false);
  });

  it("video track isHidden should control video visibility, not audio", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    // Hide the video track
    const hiddenTracks = tracks.map((t) =>
      t.type === "video" ? { ...t, isHidden: true } : t
    );
    const videoTrack = hiddenTracks.find((t) => t.type === "video");
    const audioTrack = hiddenTracks.find((t) => t.type === "audio");

    expect(videoTrack!.isHidden).toBe(true);
    // Audio track should still not be muted
    expect(audioTrack!.isMuted).toBe(false);
  });

  it("audio track isMuted should control audio mute, not video visibility", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    // Mute the audio track
    const mutedTracks = tracks.map((t) =>
      t.type === "audio" ? { ...t, isMuted: true } : t
    );
    const videoTrack = mutedTracks.find((t) => t.type === "video");
    const audioTrack = mutedTracks.find((t) => t.type === "audio");

    expect(audioTrack!.isMuted).toBe(true);
    // Video track should still be visible
    expect(videoTrack!.isHidden).toBe(false);
  });

  describe("effectivePlayerState logic", () => {
    function computeEffectiveState(tracks: TimelineTrack[], duration: number) {
      const videoTracks = tracks.filter((t) => t.type === "video");
      const visibleVideoTrack = videoTracks.find((t) => !t.isHidden) ?? null;
      const audioTrack = tracks.find((t) => t.type === "audio");
      const hasSolo = tracks.some((t) => t.isSolo);

      let videoSpeed = 1.0;
      let videoTrimStart = 0;
      let videoTrimEnd = duration;
      let videoHidden = !visibleVideoTrack;

      if (visibleVideoTrack && visibleVideoTrack.clips.length > 0) {
        const clip = visibleVideoTrack.clips[0];
        videoSpeed = clip.speed;
        videoTrimStart = clip.trimStart;
        videoTrimEnd = clip.trimEnd;
      }

      let audioVolume = 1.0;
      if (audioTrack) {
        const isAudioActive = hasSolo ? audioTrack.isSolo : !audioTrack.isMuted;
        if (!isAudioActive) {
          audioVolume = 0;
        } else {
          const clipVol = audioTrack.clips.length > 0 ? audioTrack.clips[0].volume : 1.0;
          audioVolume = audioTrack.volume * clipVol;
        }
      }

      const finalVolume = audioVolume;
      const allMuted = audioVolume === 0;

      return {
        speed: videoSpeed,
        volume: Math.max(0, Math.min(1, finalVolume)),
        muted: allMuted,
        trimStart: videoTrimStart,
        trimEnd: videoTrimEnd,
        videoHidden,
      };
    }

    it("should not be muted when video is hidden but audio is active", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const hiddenTracks = tracks.map((t) =>
        t.type === "video" ? { ...t, isHidden: true } : t
      );
      const state = computeEffectiveState(hiddenTracks, 60);
      expect(state.videoHidden).toBe(true);
      expect(state.muted).toBe(false);
      expect(state.volume).toBe(1.0);
    });

    it("should be muted when audio track is muted, regardless of video visibility", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const mutedTracks = tracks.map((t) =>
        t.type === "audio" ? { ...t, isMuted: true } : t
      );
      const state = computeEffectiveState(mutedTracks, 60);
      expect(state.videoHidden).toBe(false);
      expect(state.muted).toBe(true);
      expect(state.volume).toBe(0);
    });

    it("should show video hidden and muted when both are set", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const bothTracks = tracks.map((t) => {
        if (t.type === "video") return { ...t, isHidden: true };
        if (t.type === "audio") return { ...t, isMuted: true };
        return t;
      });
      const state = computeEffectiveState(bothTracks, 60);
      expect(state.videoHidden).toBe(true);
      expect(state.muted).toBe(true);
    });

    it("should use first visible video track when first is hidden", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      // Add a second video track
      const secondVideoTrack: TimelineTrack = {
        id: "track_v2",
        type: "video",
        label: "ビデオ 2",
        clips: [
          {
            id: "clip_v2",
            sourceUri: "file:///test2.mp4",
            name: "セカンド動画",
            duration: 30,
            trimStart: 5,
            trimEnd: 25,
            timelineOffset: 0,
            speed: 2.0,
            volume: 1.0,
          },
        ],
        isMuted: false,
        isSolo: false,
        volume: 1.0,
        color: "#8B5CF6",
        isHidden: false,
      };
      const allTracks = [...tracks.map((t) =>
        t.type === "video" ? { ...t, isHidden: true } : t
      ), secondVideoTrack];

      const state = computeEffectiveState(allTracks, 60);
      expect(state.videoHidden).toBe(false);
      expect(state.speed).toBe(2.0);
      expect(state.trimStart).toBe(5);
      expect(state.trimEnd).toBe(25);
    });

    it("should show videoHidden when all video tracks are hidden", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const allHidden = tracks.map((t) =>
        t.type === "video" ? { ...t, isHidden: true } : t
      );
      const state = computeEffectiveState(allHidden, 60);
      expect(state.videoHidden).toBe(true);
    });

    it("should not affect volume when video is hidden", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      // Set audio volume to 0.5
      const adjusted = tracks.map((t) =>
        t.type === "audio" ? { ...t, volume: 0.5 } : { ...t, isHidden: true }
      );
      const state = computeEffectiveState(adjusted, 60);
      expect(state.volume).toBe(0.5);
      expect(state.muted).toBe(false);
    });
  });
});
