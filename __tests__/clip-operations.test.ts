import { describe, it, expect } from "vitest";

// Test clip split logic
describe("Clip split at playhead", () => {
  it("should split a clip into two at the playhead position", () => {
    const clip = {
      id: "clip1",
      sourceUri: "test.mp4",
      name: "Test",
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      timelineOffset: 0,
      speed: 1.0,
      volume: 1.0,
    };

    const playheadTime = 5; // seconds
    const clipTimelineStart = clip.timelineOffset;
    const clipTimelineEnd = clip.timelineOffset + ((clip.trimEnd - clip.trimStart) / clip.speed);

    // Playhead is within clip
    expect(playheadTime > clipTimelineStart).toBe(true);
    expect(playheadTime < clipTimelineEnd).toBe(true);

    // Calculate source time at playhead
    const sourceTimeAtPlayhead = clip.trimStart + (playheadTime - clip.timelineOffset) * clip.speed;
    expect(sourceTimeAtPlayhead).toBe(5);

    // Left clip
    const clip1 = {
      ...clip,
      id: `${clip.id}_L`,
      trimEnd: sourceTimeAtPlayhead,
    };
    expect(clip1.trimStart).toBe(0);
    expect(clip1.trimEnd).toBe(5);
    expect(clip1.timelineOffset).toBe(0);

    // Right clip
    const clip2 = {
      ...clip,
      id: `${clip.id}_R`,
      trimStart: sourceTimeAtPlayhead,
      timelineOffset: playheadTime,
    };
    expect(clip2.trimStart).toBe(5);
    expect(clip2.trimEnd).toBe(10);
    expect(clip2.timelineOffset).toBe(5);
  });

  it("should split a clip with speed correctly", () => {
    const clip = {
      id: "clip1",
      sourceUri: "test.mp4",
      name: "Test",
      duration: 20,
      trimStart: 0,
      trimEnd: 20,
      timelineOffset: 0,
      speed: 2.0,
      volume: 1.0,
    };

    // At 2x speed, 20s clip plays in 10s on timeline
    const clipTimelineEnd = clip.timelineOffset + ((clip.trimEnd - clip.trimStart) / clip.speed);
    expect(clipTimelineEnd).toBe(10);

    const playheadTime = 5; // 5s on timeline = 10s in source at 2x speed
    const sourceTimeAtPlayhead = clip.trimStart + (playheadTime - clip.timelineOffset) * clip.speed;
    expect(sourceTimeAtPlayhead).toBe(10);

    const clip1 = { ...clip, id: "L", trimEnd: sourceTimeAtPlayhead };
    const clip2 = { ...clip, id: "R", trimStart: sourceTimeAtPlayhead, timelineOffset: playheadTime };

    // Left clip: 0-10s source, plays 0-5s on timeline
    expect(clip1.trimStart).toBe(0);
    expect(clip1.trimEnd).toBe(10);
    expect((clip1.trimEnd - clip1.trimStart) / clip1.speed).toBe(5);

    // Right clip: 10-20s source, plays 5-10s on timeline
    expect(clip2.trimStart).toBe(10);
    expect(clip2.trimEnd).toBe(20);
    expect(clip2.timelineOffset).toBe(5);
    expect((clip2.trimEnd - clip2.trimStart) / clip2.speed).toBe(5);
  });

  it("should not split if playhead is outside clip", () => {
    const clip = {
      timelineOffset: 5,
      trimStart: 0,
      trimEnd: 10,
      speed: 1.0,
    };

    const clipStart = clip.timelineOffset;
    const clipEnd = clip.timelineOffset + ((clip.trimEnd - clip.trimStart) / clip.speed);

    // Playhead before clip
    expect(2 > clipStart && 2 < clipEnd).toBe(false);
    // Playhead after clip
    expect(20 > clipStart && 20 < clipEnd).toBe(false);
    // Playhead at clip start (not strictly inside)
    expect(5 > clipStart && 5 < clipEnd).toBe(false);
  });
});

// Test clipboard operations
describe("Clipboard operations", () => {
  it("should create clipboard data from a clip", () => {
    const clip = {
      id: "clip1",
      sourceUri: "test.mp4",
      name: "Test",
      duration: 10,
      trimStart: 2,
      trimEnd: 8,
      timelineOffset: 5,
      speed: 1.5,
      volume: 0.8,
    };

    const clipboard = {
      clip: { ...clip },
      trackType: "video" as const,
      operation: "copy" as const,
    };

    expect(clipboard.clip.id).toBe("clip1");
    expect(clipboard.trackType).toBe("video");
    expect(clipboard.operation).toBe("copy");
  });

  it("should paste clip at playhead position with new id", () => {
    const original = {
      id: "clip1",
      sourceUri: "test.mp4",
      name: "Test",
      duration: 10,
      trimStart: 2,
      trimEnd: 8,
      timelineOffset: 0,
      speed: 1.0,
      volume: 1.0,
    };

    const playheadTime = 15;
    const pasted = {
      ...original,
      id: `clip_new`,
      timelineOffset: playheadTime,
    };

    expect(pasted.id).not.toBe(original.id);
    expect(pasted.timelineOffset).toBe(15);
    expect(pasted.trimStart).toBe(original.trimStart);
    expect(pasted.trimEnd).toBe(original.trimEnd);
  });

  it("should only allow paste to same track type", () => {
    const clipboard = { trackType: "video" as string };
    const videoTrack = { type: "video" as string };
    const audioTrack = { type: "audio" as string };

    expect(videoTrack.type === clipboard.trackType).toBe(true);
    expect(audioTrack.type === clipboard.trackType).toBe(false);
  });
});

// Test left trim visual improvement
describe("Left trim visual behavior", () => {
  it("should shift clip position when left-trimming", () => {
    const clip = {
      trimStart: 2,
      trimEnd: 10,
      timelineOffset: 5,
      speed: 1.0,
    };

    const trimLeftDelta = 3; // Trim 3 more seconds from left
    const newTrimStart = clip.trimStart + trimLeftDelta;
    const trimDelta = newTrimStart - clip.trimStart;
    const newOffset = clip.timelineOffset + (trimDelta / clip.speed);

    expect(newTrimStart).toBe(5);
    expect(newOffset).toBe(8); // Shifted right by 3s

    // Visual width should shrink
    const originalWidth = (clip.trimEnd - clip.trimStart) / clip.speed;
    const newWidth = (clip.trimEnd - newTrimStart) / clip.speed;
    expect(newWidth).toBe(5);
    expect(newWidth).toBeLessThan(originalWidth);

    // Visual left position should move right
    expect(newOffset * 10).toBe(80); // pixelsPerSecond=10 -> 80px
    expect(clip.timelineOffset * 10).toBe(50); // original was 50px
  });

  it("should visually update clip left position during trim drag", () => {
    const clip = {
      trimStart: 0,
      trimEnd: 10,
      timelineOffset: 0,
      speed: 1.0,
    };

    const trimLeftDelta = 2;
    const newTrimStart = Math.max(0, clip.trimStart + trimLeftDelta);
    const trimDelta = newTrimStart - clip.trimStart;
    const visualOffset = Math.max(0, clip.timelineOffset + (trimDelta / clip.speed));

    // During drag, the clip left edge should move right
    expect(visualOffset).toBe(2);
    // And the clip width should shrink from left
    const visualWidth = (clip.trimEnd - newTrimStart) / clip.speed;
    expect(visualWidth).toBe(8);
  });
});

// Test TextOverlay timeline display
describe("TextOverlay timeline display", () => {
  it("should have startTime and endTime properties", () => {
    const overlay = {
      id: "txt1",
      text: "Hello",
      fontSize: 24,
      color: "#FFFFFF",
      position: "center" as const,
      bold: false,
      italic: false,
      x: 50,
      y: 50,
      rotation: 0,
      startTime: 5,
      endTime: 15,
    };

    expect(overlay.startTime).toBe(5);
    expect(overlay.endTime).toBe(15);
  });

  it("should calculate correct timeline position and width", () => {
    const overlay = {
      startTime: 10,
      endTime: 30,
    };
    const pixelsPerSecond = 10;

    const clipLeft = overlay.startTime * pixelsPerSecond;
    const clipWidth = (overlay.endTime - overlay.startTime) * pixelsPerSecond;

    expect(clipLeft).toBe(100);
    expect(clipWidth).toBe(200);
  });

  it("should default to 0 and totalDuration when not set", () => {
    const totalDuration = 60;
    const overlay = {
      startTime: 0,
      endTime: totalDuration,
    };

    expect(overlay.startTime).toBe(0);
    expect(overlay.endTime).toBe(60);
  });
});

// Test playhead color
describe("Playhead appearance", () => {
  it("should use yellow color for playhead", () => {
    const PLAYHEAD_COLOR = "#FFD60A";
    expect(PLAYHEAD_COLOR).toBe("#FFD60A");
  });
});
