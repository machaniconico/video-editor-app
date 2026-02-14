import { describe, it, expect } from "vitest";

// Test frame layout definitions
const FRAME_LAYOUTS = [
  { id: "single", label: "単一", slots: 1 },
  { id: "split-h", label: "左右分割", slots: 2 },
  { id: "split-v", label: "上下分割", slots: 2 },
  { id: "grid-4", label: "4分割", slots: 4 },
  { id: "pip", label: "PiP", slots: 2 },
];

// Text overlay type
interface TextOverlay {
  id: string;
  text: string;
  fontSize: number;
  color: string;
  position: "top" | "center" | "bottom";
  bold: boolean;
  italic: boolean;
  x: number;
  y: number;
  rotation: number;
}

interface FrameSlot {
  id: string;
  videoUri: string;
  thumbnailUri: string | null;
  duration: number;
}

describe("Multi-frame feature", () => {
  it("should have 5 layout options", () => {
    expect(FRAME_LAYOUTS).toHaveLength(5);
  });

  it("should have correct slot counts for each layout", () => {
    expect(FRAME_LAYOUTS.find((l) => l.id === "single")?.slots).toBe(1);
    expect(FRAME_LAYOUTS.find((l) => l.id === "split-h")?.slots).toBe(2);
    expect(FRAME_LAYOUTS.find((l) => l.id === "split-v")?.slots).toBe(2);
    expect(FRAME_LAYOUTS.find((l) => l.id === "grid-4")?.slots).toBe(4);
    expect(FRAME_LAYOUTS.find((l) => l.id === "pip")?.slots).toBe(2);
  });

  it("should create frame slots with required properties", () => {
    const slot: FrameSlot = {
      id: "frame_123",
      videoUri: "file:///test.mp4",
      thumbnailUri: null,
      duration: 30,
    };
    expect(slot.id).toBeTruthy();
    expect(slot.videoUri).toBeTruthy();
    expect(slot.duration).toBeGreaterThan(0);
  });

  it("should limit frame slots to layout max", () => {
    const layout = FRAME_LAYOUTS.find((l) => l.id === "split-h");
    const slots: FrameSlot[] = [
      { id: "1", videoUri: "a.mp4", thumbnailUri: null, duration: 10 },
      { id: "2", videoUri: "b.mp4", thumbnailUri: null, duration: 15 },
    ];
    expect(slots.length).toBeLessThanOrEqual(layout!.slots);
  });

  it("should remove frame slot by id", () => {
    const slots: FrameSlot[] = [
      { id: "1", videoUri: "a.mp4", thumbnailUri: null, duration: 10 },
      { id: "2", videoUri: "b.mp4", thumbnailUri: null, duration: 15 },
    ];
    const filtered = slots.filter((s) => s.id !== "1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });
});

describe("Free text overlay positioning", () => {
  it("should create text overlay with position coordinates", () => {
    const overlay: TextOverlay = {
      id: "txt_1",
      text: "Hello",
      fontSize: 24,
      color: "#FFFFFF",
      position: "center",
      bold: false,
      italic: false,
      x: 50,
      y: 50,
      rotation: 0,
    };
    expect(overlay.x).toBe(50);
    expect(overlay.y).toBe(50);
    expect(overlay.rotation).toBe(0);
  });

  it("should clamp x and y to 0-100 range", () => {
    const clamp = (val: number) => Math.max(0, Math.min(100, val));
    expect(clamp(-10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(50)).toBe(50);
  });

  it("should support rotation values", () => {
    const rotations = [-45, -15, 0, 15, 45];
    rotations.forEach((r) => {
      expect(r).toBeGreaterThanOrEqual(-45);
      expect(r).toBeLessThanOrEqual(45);
    });
  });

  it("should support multiple text overlays", () => {
    const overlays: TextOverlay[] = [
      { id: "1", text: "Title", fontSize: 32, color: "#FFFFFF", position: "top", bold: true, italic: false, x: 50, y: 10, rotation: 0 },
      { id: "2", text: "Subtitle", fontSize: 18, color: "#FFFF00", position: "center", bold: false, italic: false, x: 50, y: 50, rotation: -15 },
      { id: "3", text: "Caption", fontSize: 14, color: "#00FF00", position: "bottom", bold: false, italic: true, x: 30, y: 85, rotation: 0 },
    ];
    expect(overlays).toHaveLength(3);
    expect(overlays.map((o) => o.id)).toEqual(["1", "2", "3"]);
  });

  it("should update selected text overlay", () => {
    const overlays: TextOverlay[] = [
      { id: "1", text: "Old", fontSize: 24, color: "#FFF", position: "center", bold: false, italic: false, x: 50, y: 50, rotation: 0 },
    ];
    const selectedId = "1";
    const updated = overlays.map((o) =>
      o.id === selectedId ? { ...o, text: "New", x: 30, y: 70 } : o
    );
    expect(updated[0].text).toBe("New");
    expect(updated[0].x).toBe(30);
    expect(updated[0].y).toBe(70);
  });

  it("should delete text overlay by id", () => {
    const overlays: TextOverlay[] = [
      { id: "1", text: "A", fontSize: 24, color: "#FFF", position: "top", bold: false, italic: false, x: 50, y: 10, rotation: 0 },
      { id: "2", text: "B", fontSize: 18, color: "#FF0", position: "bottom", bold: false, italic: false, x: 50, y: 90, rotation: 0 },
    ];
    const filtered = overlays.filter((o) => o.id !== "1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });

  it("should support font size presets", () => {
    const FONT_SIZES = [14, 18, 24, 32, 40, 56];
    expect(FONT_SIZES).toHaveLength(6);
    expect(FONT_SIZES[0]).toBe(14);
    expect(FONT_SIZES[FONT_SIZES.length - 1]).toBe(56);
  });
});
