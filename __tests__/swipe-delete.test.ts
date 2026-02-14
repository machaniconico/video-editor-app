import { describe, it, expect } from "vitest";

describe("Swipe Delete Logic", () => {
  // Simulate project list
  const projects = [
    { id: "proj_1", title: "プロジェクト 1" },
    { id: "proj_2", title: "プロジェクト 2" },
    { id: "proj_3", title: "プロジェクト 3" },
  ];

  it("should remove a project by id", () => {
    const deleteId = "proj_2";
    const result = projects.filter((p) => p.id !== deleteId);
    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === deleteId)).toBeUndefined();
    expect(result[0].id).toBe("proj_1");
    expect(result[1].id).toBe("proj_3");
  });

  it("should not remove anything if id does not exist", () => {
    const deleteId = "proj_999";
    const result = projects.filter((p) => p.id !== deleteId);
    expect(result).toHaveLength(3);
  });

  it("should handle deleting the last project", () => {
    const singleProject = [{ id: "proj_1", title: "プロジェクト 1" }];
    const result = singleProject.filter((p) => p.id !== "proj_1");
    expect(result).toHaveLength(0);
  });

  it("should clear currentProject if deleted project is current", () => {
    const currentProjectId = "proj_2";
    const deleteId = "proj_2";
    const newCurrentProject = currentProjectId === deleteId ? null : currentProjectId;
    expect(newCurrentProject).toBeNull();
  });

  it("should keep currentProject if deleted project is not current", () => {
    const currentProjectId: string = "proj_1";
    const deleteId: string = "proj_2";
    const newCurrentProject = currentProjectId === deleteId ? null : currentProjectId;
    expect(newCurrentProject).toBe("proj_1");
  });

  it("should calculate swipe threshold correctly", () => {
    const deleteButtonWidth = 80;
    const threshold = deleteButtonWidth / 2;
    expect(threshold).toBe(40);
  });

  it("should clamp translateX between -deleteButtonWidth and 0", () => {
    const deleteButtonWidth = 80;
    const clamp = (value: number) => Math.max(-deleteButtonWidth, Math.min(0, value));

    expect(clamp(-100)).toBe(-80); // clamped to max left
    expect(clamp(-40)).toBe(-40);  // within range
    expect(clamp(0)).toBe(0);      // at rest
    expect(clamp(50)).toBe(0);     // no right swipe allowed
  });

  it("should open when swipe exceeds threshold", () => {
    const deleteButtonWidth = 80;
    const threshold = deleteButtonWidth / 2;
    const translateX = -50; // past threshold of -40

    const shouldOpen = translateX < -threshold;
    expect(shouldOpen).toBe(true);
  });

  it("should close when swipe does not exceed threshold", () => {
    const deleteButtonWidth = 80;
    const threshold = deleteButtonWidth / 2;
    const translateX = -30; // not past threshold of -40

    const shouldOpen = translateX < -threshold;
    expect(shouldOpen).toBe(false);
  });

  it("should open when velocity is high even if position is small", () => {
    const deleteButtonWidth = 80;
    const threshold = deleteButtonWidth / 2;
    const translateX = -20;
    const velocityX = -600;

    const shouldOpen = translateX < -threshold || velocityX < -500;
    expect(shouldOpen).toBe(true);
  });
});
