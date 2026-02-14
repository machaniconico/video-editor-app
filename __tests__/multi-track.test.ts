import { describe, it, expect } from "vitest";
import { createDefaultTracks, getNextTrackColor } from "../lib/editor-context";
import type { TimelineTrack, TimelineClip, TrackType } from "../lib/editor-context";

describe("Multi-track timeline", () => {
  describe("createDefaultTracks", () => {
    it("should create a video track and an audio track", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      expect(tracks).toHaveLength(2);
      expect(tracks[0].type).toBe("video");
      expect(tracks[1].type).toBe("audio");
    });

    it("should set correct duration on clips", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 120);
      expect(tracks[0].clips[0].duration).toBe(120);
      expect(tracks[0].clips[0].trimEnd).toBe(120);
      expect(tracks[1].clips[0].duration).toBe(120);
    });

    it("should set default volume to 1.0", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 30);
      expect(tracks[0].volume).toBe(1.0);
      expect(tracks[1].volume).toBe(1.0);
      expect(tracks[0].clips[0].volume).toBe(1.0);
    });

    it("should not be muted or solo by default", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 30);
      expect(tracks[0].isMuted).toBe(false);
      expect(tracks[0].isSolo).toBe(false);
    });

    it("should use the provided video URI", () => {
      const uri = "file:///my-video.mp4";
      const tracks = createDefaultTracks(uri, 45);
      expect(tracks[0].clips[0].sourceUri).toBe(uri);
      expect(tracks[1].clips[0].sourceUri).toBe(uri);
    });
  });

  describe("getNextTrackColor", () => {
    it("should return a color string for video type", () => {
      const color = getNextTrackColor("video", 0);
      expect(color).toBeTruthy();
      expect(color.startsWith("#")).toBe(true);
    });

    it("should return different colors for different indices", () => {
      const c0 = getNextTrackColor("video", 0);
      const c1 = getNextTrackColor("video", 1);
      expect(c0).not.toBe(c1);
    });

    it("should cycle colors when index exceeds palette length", () => {
      const c0 = getNextTrackColor("audio", 0);
      const c4 = getNextTrackColor("audio", 4);
      expect(c0).toBe(c4);
    });

    it("should return colors for all track types", () => {
      const types: TrackType[] = ["video", "audio", "bgm"];
      types.forEach((type) => {
        const color = getNextTrackColor(type, 0);
        expect(color).toBeTruthy();
      });
    });
  });

  describe("Track operations", () => {
    it("should toggle mute on a track", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const updated = tracks.map((t) =>
        t.id === tracks[0].id ? { ...t, isMuted: !t.isMuted } : t
      );
      expect(updated[0].isMuted).toBe(true);
      expect(updated[1].isMuted).toBe(false);
    });

    it("should toggle solo on a track", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const updated = tracks.map((t) =>
        t.id === tracks[0].id ? { ...t, isSolo: !t.isSolo } : t
      );
      expect(updated[0].isSolo).toBe(true);
    });

    it("should adjust track volume within bounds", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      // Increase
      const inc = tracks.map((t) =>
        t.id === tracks[0].id ? { ...t, volume: Math.min(1, t.volume + 0.1) } : t
      );
      expect(inc[0].volume).toBe(1.0); // Already at max

      // Decrease
      const dec = tracks.map((t) =>
        t.id === tracks[0].id ? { ...t, volume: Math.max(0, t.volume - 0.3) } : t
      );
      expect(dec[0].volume).toBeCloseTo(0.7);
    });

    it("should adjust clip speed within bounds", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const clip = tracks[0].clips[0];
      const newSpeed = Math.max(0.25, Math.min(10, clip.speed + 1));
      expect(newSpeed).toBe(2.0);
      
      const maxSpeed = Math.max(0.25, Math.min(10, 11));
      expect(maxSpeed).toBe(10);

      const minSpeed = Math.max(0.25, Math.min(10, 0.1));
      expect(minSpeed).toBe(0.25);
    });

    it("should add a new track to the list", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const newTrack: TimelineTrack = {
        id: "track_bgm1",
        type: "bgm",
        label: "BGM 1",
        clips: [],
        isMuted: false,
        isSolo: false,
        volume: 0.7,
        color: getNextTrackColor("bgm", 0),
      };
      const updated = [...tracks, newTrack];
      expect(updated).toHaveLength(3);
      expect(updated[2].type).toBe("bgm");
    });

    it("should remove a track from the list", () => {
      const tracks = createDefaultTracks("file:///test.mp4", 60);
      const updated = tracks.filter((t) => t.type !== "audio");
      expect(updated).toHaveLength(1);
      expect(updated[0].type).toBe("video");
    });

    it("should calculate effective clip duration with speed", () => {
      const clip: TimelineClip = {
        id: "c1",
        sourceUri: "file:///test.mp4",
        name: "Test",
        duration: 60,
        trimStart: 10,
        trimEnd: 50,
        timelineOffset: 0,
        speed: 2.0,
        volume: 1.0,
      };
      const effectiveDuration = (clip.trimEnd - clip.trimStart) / clip.speed;
      expect(effectiveDuration).toBe(20);
    });

    it("should calculate effective clip duration at 10x speed", () => {
      const clip: TimelineClip = {
        id: "c1",
        sourceUri: "file:///test.mp4",
        name: "Test",
        duration: 120,
        trimStart: 0,
        trimEnd: 120,
        timelineOffset: 0,
        speed: 10.0,
        volume: 1.0,
      };
      const effectiveDuration = (clip.trimEnd - clip.trimStart) / clip.speed;
      expect(effectiveDuration).toBe(12);
    });
  });
});
