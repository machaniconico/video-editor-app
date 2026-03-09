import { describe, it, expect } from "vitest";
import { createDefaultTracks } from "../lib/editor-context";
import type { TimelineTrack, TimelineClip } from "../lib/editor-context";

// Helper: simulate trim-left logic with timelineOffset adjustment (same as component)
function applyTrimLeft(clip: TimelineClip, deltaSec: number): TimelineClip {
  const maxDelta = clip.trimEnd - clip.trimStart - 0.5;
  const minDelta = -clip.trimStart;
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
  const newTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.5, clip.trimStart + clamped));
  // When left-trimming, shift timelineOffset by the amount trimmed
  const trimDelta = newTrimStart - clip.trimStart;
  const newOffset = Math.max(0, clip.timelineOffset + (trimDelta / clip.speed));
  return { ...clip, trimStart: newTrimStart, timelineOffset: newOffset };
}

// Helper: calculate playhead timeline position from video playback time
function calcPlayheadPosition(clip: TimelineClip, currentTime: number): number {
  return clip.timelineOffset + ((currentTime - clip.trimStart) / (clip.speed || 1));
}

// Helper: simulate trim-right logic (same as component)
function applyTrimRight(clip: TimelineClip, deltaSec: number): TimelineClip {
  const maxDelta = clip.duration - clip.trimEnd;
  const minDelta = -(clip.trimEnd - clip.trimStart - 0.5);
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaSec));
  const newTrimEnd = Math.max(clip.trimStart + 0.5, Math.min(clip.duration, clip.trimEnd + clamped));
  return { ...clip, trimEnd: newTrimEnd };
}

// Helper: simulate move logic (same track only - no cross-track movement)
function applyMoveSameTrack(
  tracks: TimelineTrack[],
  sourceTrackIndex: number,
  clipId: string,
  deltaSeconds: number
): TimelineTrack[] {
  const sourceTrack = tracks[sourceTrackIndex];
  const clip = sourceTrack.clips.find((c) => c.id === clipId);
  if (!clip) return tracks;

  const newOffset = Math.max(0, clip.timelineOffset + deltaSeconds);

  return tracks.map((t, idx) => {
    if (idx !== sourceTrackIndex) return t;
    return {
      ...t,
      clips: t.clips.map((c) =>
        c.id === clipId ? { ...c, timelineOffset: newOffset } : c
      ),
    };
  });
}

// Helper: simulate pinch zoom calculation
function applyPinchZoom(initialZoom: number, initialDistance: number, currentDistance: number): number {
  const ZOOM_MIN = 3;
  const ZOOM_MAX = 300;
  if (initialDistance === 0) return initialZoom;
  const scale = currentDistance / initialDistance;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, initialZoom / scale));
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

describe("Clip Move (same track only)", () => {
  it("should move clip forward on same track", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMoveSameTrack(tracks, 0, clipId, 10);
    expect(result[0].clips[0].timelineOffset).toBe(10);
  });

  it("should not move clip to negative offset", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMoveSameTrack(tracks, 0, clipId, -10);
    expect(result[0].clips[0].timelineOffset).toBe(0);
  });

  it("should not change other tracks when moving", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    const result = applyMoveSameTrack(tracks, 0, clipId, 5);
    expect(result[1].clips.length).toBe(tracks[1].clips.length);
    expect(result[1].clips[0].timelineOffset).toBe(0);
  });

  it("should only move horizontally, not cross tracks", () => {
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const clipId = tracks[0].clips[0].id;
    // applyMoveSameTrack doesn't accept deltaTrackIndex - it's same track only
    const result = applyMoveSameTrack(tracks, 0, clipId, 15);
    // Clip stays on track 0
    expect(result[0].clips.length).toBe(1);
    expect(result[0].clips[0].timelineOffset).toBe(15);
    // Track 1 unchanged
    expect(result[1].clips.length).toBe(1);
  });
});

describe("Pinch Zoom", () => {
  it("should zoom in when fingers spread apart", () => {
    const initialZoom = 30;
    const initialDistance = 100;
    const currentDistance = 200; // fingers spread 2x
    const result = applyPinchZoom(initialZoom, initialDistance, currentDistance);
    expect(result).toBe(15); // 30 / 2 = 15
  });

  it("should zoom out when fingers pinch together", () => {
    const initialZoom = 30;
    const initialDistance = 200;
    const currentDistance = 100; // fingers pinch to half
    const result = applyPinchZoom(initialZoom, initialDistance, currentDistance);
    expect(result).toBe(60); // 30 / 0.5 = 60
  });

  it("should clamp zoom to minimum", () => {
    const initialZoom = 5;
    const initialDistance = 50;
    const currentDistance = 500; // 10x spread
    const result = applyPinchZoom(initialZoom, initialDistance, currentDistance);
    expect(result).toBe(3); // clamped to ZOOM_MIN
  });

  it("should clamp zoom to maximum", () => {
    const initialZoom = 200;
    const initialDistance = 200;
    const currentDistance = 10; // extreme pinch
    const result = applyPinchZoom(initialZoom, initialDistance, currentDistance);
    expect(result).toBe(300); // clamped to ZOOM_MAX
  });

  it("should not change zoom when initial distance is 0", () => {
    const initialZoom = 30;
    const result = applyPinchZoom(initialZoom, 0, 100);
    expect(result).toBe(30);
  });

  it("should handle no change in distance", () => {
    const initialZoom = 30;
    const result = applyPinchZoom(initialZoom, 100, 100);
    expect(result).toBe(30);
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
    expect(clipWidth).toBe(200);
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
    expect(displayWidth).toBe(30);
  });
});

describe("Left trim offset adjustment", () => {
  it("should shift timelineOffset forward when left-trimming at speed 1x", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, 5);
    expect(result.trimStart).toBe(15);
    expect(result.timelineOffset).toBe(5); // shifted by 5s / 1.0x = 5s
  });

  it("should shift timelineOffset correctly at 2x speed", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 2.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, 10);
    expect(result.trimStart).toBe(20);
    expect(result.timelineOffset).toBe(5); // shifted by 10s / 2.0x = 5s
  });

  it("should shift timelineOffset back when expanding left", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 10, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, -5);
    expect(result.trimStart).toBe(5);
    expect(result.timelineOffset).toBe(5); // shifted back by -5s / 1.0x = -5s
  });

  it("should not let timelineOffset go below 0", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 5, trimEnd: 50,
      timelineOffset: 2, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, -10);
    expect(result.trimStart).toBe(0);
    expect(result.timelineOffset).toBe(0); // clamped to 0
  });

  it("should preserve existing timelineOffset when left-trimming", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 20, speed: 1.0, volume: 1.0,
    };
    const result = applyTrimLeft(clip, 5);
    expect(result.trimStart).toBe(15);
    expect(result.timelineOffset).toBe(25); // 20 + 5 = 25
  });
});

describe("Playhead position calculation", () => {
  it("should calculate playhead at start of clip", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const pos = calcPlayheadPosition(clip, 10);
    expect(pos).toBe(0); // at trimStart, offset 0
  });

  it("should calculate playhead mid-clip", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    const pos = calcPlayheadPosition(clip, 30);
    expect(pos).toBe(20); // 0 + (30 - 10) / 1.0 = 20
  });

  it("should account for speed in playhead position", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 2.0, volume: 1.0,
    };
    const pos = calcPlayheadPosition(clip, 30);
    expect(pos).toBe(10); // 0 + (30 - 10) / 2.0 = 10
  });

  it("should account for timelineOffset in playhead position", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 5, speed: 1.0, volume: 1.0,
    };
    const pos = calcPlayheadPosition(clip, 10);
    expect(pos).toBe(5); // 5 + (10 - 10) / 1.0 = 5
  });

  it("should work correctly after left trim with offset adjustment", () => {
    const clip: TimelineClip = {
      id: "c1", sourceUri: "file:///test.mp4", name: "Test",
      duration: 60, trimStart: 10, trimEnd: 50,
      timelineOffset: 0, speed: 1.0, volume: 1.0,
    };
    // Trim left by 5 seconds
    const trimmed = applyTrimLeft(clip, 5);
    expect(trimmed.trimStart).toBe(15);
    expect(trimmed.timelineOffset).toBe(5);
    // Playhead at new trimStart should be at timelineOffset
    const pos = calcPlayheadPosition(trimmed, 15);
    expect(pos).toBe(5); // 5 + (15 - 15) / 1.0 = 5
  });
});

describe("Track isolation", () => {
  it("should not allow cross-track movement (design validation)", () => {
    // The component now only supports horizontal movement within the same track
    // There is no deltaTrackIndex parameter in the move logic
    const tracks = createDefaultTracks("file:///test.mp4", 60);
    const videoClipId = tracks[0].clips[0].id;
    const audioClipId = tracks[1].clips[0].id;

    // Move video clip - stays on video track
    const result1 = applyMoveSameTrack(tracks, 0, videoClipId, 10);
    expect(result1[0].clips.length).toBe(1);
    expect(result1[1].clips.length).toBe(1);

    // Move audio clip - stays on audio track
    const result2 = applyMoveSameTrack(tracks, 1, audioClipId, 5);
    expect(result2[0].clips.length).toBe(1);
    expect(result2[1].clips.length).toBe(1);
  });
});
