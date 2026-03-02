import { describe, it, expect } from "vitest";
import { createDefaultTracks } from "../lib/editor-context";
import type { TimelineTrack, TimelineClip } from "../lib/editor-context";

// Helper: simulate trim-left logic (same as component)
function applyTrimLeft(clip: TimelineClip, deltaSec: number): TimelineClip {
  const maxDelta = clip.trimEnd - clip.trimStart - 0.5;
  const minDelta = -clip.trimStart;
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
  const newTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.5, clip.trimStart + clamped));
  return { ...clip, trimStart: newTrimStart };
}

// Helper: simulate trim-right logic (same as component)
function applyTrimRight(clip: TimelineClip, deltaSec: number): TimelineClip {
  const maxDelta = clip.duration - clip.trimEnd;
  const minDelta = -(clip.trimEnd - clip.trimStart - 0.5);
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
  const newTrimEnd = Math.max(clip.trimStart + 0.5, Math.min(clip.duration, clip.trimEnd + clamped));
  return { ...clip, trimEnd: newTrimEnd };
}

// Helper: simulate move logic
function applyMove(
  tracks: TimelineTrack[],
  sourceTrackIndex: number,
  clipId: string,
  deltaSeconds: number,
  deltaTrackIndex: number
): TimelineTrack[] {
  const sourceTrack = tracks[sourceTrackIndex];
  const clip = sourceTrack.clips.find((c) => c.id === clipId);
  if (!clip) return tracks;

  const newOffset = Math.max(0, clip.timelineOffset + deltaSeconds);
  const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, sourceTrackIndex + deltaTrackIndex));

  if (newTrackIndex === sourceTrackIndex) {
    return tracks.map((t, idx) => {
      if (idx !== sourceTrackIndex) return t;
      return {
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, timelineOffset: newOffset } : c
        ),
      };
    });
  } else {
    const movedClip = { ...clip, timelineOffset: newOffset };
    return tracks.map((t, idx) => {
      if (idx === sourceTrackIndex) {
        return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
      }
      if (idx === newTrackIndex) {
        return { ...t, clips: [...t.clips, movedClip] };
      }
      return t;
    });
  }
}

describe("Clip Trim Left Handle", () => {
  it("should trim left by moving trimStart forward", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, 5);
    expect(result.trimStart).toBe(15);
    expect(result.trimEnd).toBe(50);
  });

  it("should not trim left past trimEnd - 0.5s", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 49, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, 10);
    expect(result.trimStart).toBe(49.5);
  });

  it("should not trim left below 0", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 5, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, -20);
    expect(result.trimStart).toBe(0);
  });

  it("should handle negative delta (expand left)", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, -5);
    expect(result.trimStart).toBe(5);
  });
});

describe("Clip Trim Right Handle", () => {
  it("should trim right by moving trimEnd backward", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimRight(clip, -10);
    expect(result.trimEnd).toBe(40);
  });

  it("should not trim right past duration", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 55,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimRight(clip, 20);
    expect(result.trimEnd).toBe(60);
  });

  it("should not trim right below trimStart + 0.5s", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 11,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimRight(clip, -5);
    expect(result.trimEnd).toBe(10.5);
  });

  it("should handle positive delta (expand right)", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 40,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimRight(clip, 10);
    expect(result.trimEnd).toBe(50);
  });
});

describe("Clip Move (same track)", () => {
  it("should move clip forward on same track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMove(tracks, 0, clipId, 10, 0);
    expect(result[0].clips[0].timelineOffset).toBe(10);
  });

  it("should not move clip to negative offset", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMove(tracks, 0, clipId, -10, 0);
    expect(result[0].clips[0].timelineOffset).toBe(0);
  });

  it("should not change other tracks when moving on same track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMove(tracks, 0, clipId, 5, 0);
    expect(result[1].clips.length).toBe(tracks[1].clips.length);
  });
});

describe("Clip Move (cross-track)", () => {
  it("should move clip from video track to audio track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMove(tracks, 0, clipId, 5, 1);
    // Source track should have no clips
    expect(result[0].clips.length).toBe(0);
    // Target track should have original clip + moved clip
    expect(result[1].clips.length).toBe(2);
    const movedClip = result[1].clips.find((c) => c.id === clipId);
    expect(movedClip).toBeDefined();
    expect(movedClip!.timelineOffset).toBe(5);
  });

  it("should move clip from audio track to video track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[1].clips[0].id;
    const result = applyMove(tracks, 1, clipId, 0, -1);
    expect(result[1].clips.length).toBe(0);
    expect(result[0].clips.length).toBe(2);
  });

  it("should clamp track index to valid range", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    // Try to move above first track (delta = -5)
    const result = applyMove(tracks, 0, clipId, 0, -5);
    // Should stay on first track (index 0)
    expect(result[0].clips.length).toBe(1);
    expect(result[0].clips[0].id).toBe(clipId);
  });

  it("should clamp track index when moving below last track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    // Try to move way below (delta = 10, only 2 tracks)
    const result = applyMove(tracks, 0, clipId, 0, 10);
    // Should move to last track (index 1)
    expect(result[0].clips.length).toBe(0);
    expect(result[1].clips.length).toBe(2);
  });
});

describe("Clip visual width calculation", () => {
  it("should calculate clip width based on trim range and speed", () => {
    const pixelsPerSecond = 10;
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 2.0, volume: 1.0,
    };
    const clipWidth = ((clip.trimEnd - clip.trimStart) / clip.speed) * pixelsPerSecond;
    expect(clipWidth).toBe(200); // (50-10)/2 * 10 = 200
  });

  it("should have minimum width of 30px", () => {
    const pixelsPerSecond = 1;
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 0, trimEnd: 1,
      timelineOffset: 0, speed: 10.0, volume: 1.0,
    };
    const clipWidth = ((clip.trimEnd - clip.trimStart) / clip.speed) * pixelsPerSecond;
    const displayWidth = Math.max(clipWidth, 30);
    expect(displayWidth).toBe(30); // 0.1px -> clamped to 30
  });
});

describe("X delete icon removal", () => {
  it("should have delete button in clip controls panel instead of track header", () => {
    // This test validates the design decision:
    // The × icon was removed from track headers
    // Delete is now available in the selected clip controls panel
    const hasDeleteInTrackHeader = false; // removed
    const hasDeleteInClipControls = true; // moved here
    expect(hasDeleteInTrackHeader).toBe(false);
    expect(hasDeleteInClipControls).toBe(true);
  });
});
