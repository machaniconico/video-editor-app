import { describe, it, expect } from "vitest";

describe("Speed Presets", () => {
  const SPEED_PRESETS = [
    { label: "0.25x", value: 0.25 },
    { label: "0.5x", value: 0.5 },
    { label: "1x", value: 1.0 },
    { label: "1.5x", value: 1.5 },
    { label: "2x", value: 2.0 },
    { label: "3x", value: 3.0 },
    { label: "4x", value: 4.0 },
    { label: "6x", value: 6.0 },
    { label: "8x", value: 8.0 },
    { label: "10x", value: 10.0 },
  ];

  it("should have 10 speed presets", () => {
    expect(SPEED_PRESETS).toHaveLength(10);
  });

  it("should include 10x as the maximum speed", () => {
    const maxSpeed = SPEED_PRESETS[SPEED_PRESETS.length - 1];
    expect(maxSpeed.value).toBe(10.0);
    expect(maxSpeed.label).toBe("10x");
  });

  it("should include slow motion presets (< 1x)", () => {
    const slowPresets = SPEED_PRESETS.filter((p) => p.value < 1);
    expect(slowPresets).toHaveLength(2);
    expect(slowPresets[0].value).toBe(0.25);
    expect(slowPresets[1].value).toBe(0.5);
  });

  it("should include normal speed presets (1x - 3x)", () => {
    const normalPresets = SPEED_PRESETS.filter((p) => p.value >= 1 && p.value <= 3);
    expect(normalPresets).toHaveLength(4);
  });

  it("should include high speed presets (> 3x)", () => {
    const highPresets = SPEED_PRESETS.filter((p) => p.value > 3);
    expect(highPresets).toHaveLength(4);
    expect(highPresets.map((p) => p.value)).toEqual([4, 6, 8, 10]);
  });

  it("should be sorted in ascending order", () => {
    for (let i = 1; i < SPEED_PRESETS.length; i++) {
      expect(SPEED_PRESETS[i].value).toBeGreaterThan(SPEED_PRESETS[i - 1].value);
    }
  });
});

describe("Output Duration Calculation", () => {
  it("should calculate output duration correctly at 1x speed", () => {
    const trimDuration = 60;
    const speed = 1.0;
    const output = trimDuration / speed;
    expect(output).toBe(60);
  });

  it("should halve duration at 2x speed", () => {
    const trimDuration = 60;
    const speed = 2.0;
    const output = trimDuration / speed;
    expect(output).toBe(30);
  });

  it("should reduce duration to 1/10 at 10x speed", () => {
    const trimDuration = 60;
    const speed = 10.0;
    const output = trimDuration / speed;
    expect(output).toBe(6);
  });

  it("should double duration at 0.5x speed", () => {
    const trimDuration = 60;
    const speed = 0.5;
    const output = trimDuration / speed;
    expect(output).toBe(120);
  });

  it("should quadruple duration at 0.25x speed", () => {
    const trimDuration = 60;
    const speed = 0.25;
    const output = trimDuration / speed;
    expect(output).toBe(240);
  });
});

describe("Timeline Calculations", () => {
  it("should calculate trim percentage correctly", () => {
    const duration = 120;
    const trimStart = 30;
    const trimEnd = 90;
    const startPct = (trimStart / duration) * 100;
    const endPct = (trimEnd / duration) * 100;
    expect(startPct).toBe(25);
    expect(endPct).toBe(75);
  });

  it("should generate correct tick intervals for short videos", () => {
    const duration = 8;
    const tickInterval = duration > 60 ? 10 : duration > 10 ? 5 : 1;
    expect(tickInterval).toBe(1);
    const ticks: number[] = [];
    for (let t = 0; t <= duration; t += tickInterval) {
      ticks.push(t);
    }
    expect(ticks).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("should generate correct tick intervals for medium videos", () => {
    const duration = 45;
    const tickInterval = duration > 60 ? 10 : duration > 10 ? 5 : 1;
    expect(tickInterval).toBe(5);
  });

  it("should generate correct tick intervals for long videos", () => {
    const duration = 180;
    const tickInterval = duration > 60 ? 10 : duration > 10 ? 5 : 1;
    expect(tickInterval).toBe(10);
  });

  it("should calculate step sizes correctly for short videos", () => {
    const duration = 30;
    const stepSmall = duration > 60 ? 1.0 : 0.5;
    const stepLarge = duration > 60 ? 5.0 : 2.0;
    expect(stepSmall).toBe(0.5);
    expect(stepLarge).toBe(2.0);
  });

  it("should calculate step sizes correctly for long videos", () => {
    const duration = 120;
    const stepSmall = duration > 60 ? 1.0 : 0.5;
    const stepLarge = duration > 60 ? 5.0 : 2.0;
    expect(stepSmall).toBe(1.0);
    expect(stepLarge).toBe(5.0);
  });
});

describe("Trim Quick Actions", () => {
  it("should select full range", () => {
    const duration = 120;
    const trimStart = 0;
    const trimEnd = duration;
    expect(trimStart).toBe(0);
    expect(trimEnd).toBe(120);
  });

  it("should select center 50%", () => {
    const duration = 120;
    const mid = duration / 2;
    const quarter = duration / 4;
    const trimStart = Math.max(0, mid - quarter);
    const trimEnd = Math.min(duration, mid + quarter);
    expect(trimStart).toBe(30);
    expect(trimEnd).toBe(90);
  });

  it("should select first 30 seconds", () => {
    const duration = 120;
    const trimStart = 0;
    const trimEnd = Math.min(duration, 30);
    expect(trimStart).toBe(0);
    expect(trimEnd).toBe(30);
  });

  it("should handle video shorter than 30 seconds for first 30s preset", () => {
    const duration = 15;
    const trimStart = 0;
    const trimEnd = Math.min(duration, 30);
    expect(trimStart).toBe(0);
    expect(trimEnd).toBe(15);
  });
});

describe("Format Time", () => {
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${String(s).padStart(2, "0")}.${ms}`;
  }

  it("should format 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00.0");
  });

  it("should format 90.5 seconds", () => {
    expect(formatTime(90.5)).toBe("1:30.5");
  });

  it("should format 6 seconds (10x of 60s)", () => {
    expect(formatTime(6)).toBe("0:06.0");
  });

  it("should format large duration", () => {
    expect(formatTime(600)).toBe("10:00.0");
  });
});
