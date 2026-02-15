import { describe, expect, it } from "vitest";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

function buildPrompt(title: string, description?: string) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description?.trim();
  if (!trimmedTitle) {
    throw new Error("Title required");
  }
  return trimmedDescription
    ? `Task: ${trimmedTitle}\n\nDescription: ${trimmedDescription}`
    : `Task: ${trimmedTitle}`;
}

function isBlocked(task: { dependsOn?: string[] }, tasks: { _id: string; status: TaskStatus }[]) {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  return !task.dependsOn.every((depId) => {
    const depTask = tasks.find((t) => t._id === depId);
    return depTask?.status === "done";
  });
}

describe("mission control task flow", () => {
  it("builds prompt from title only", () => {
    expect(buildPrompt("Ship agents")).toBe("Task: Ship agents");
  });

  it("builds prompt with description", () => {
    expect(buildPrompt("Ship", "Add webhook updates")).toBe(
      "Task: Ship\n\nDescription: Add webhook updates"
    );
  });

  it("rejects empty title", () => {
    expect(() => buildPrompt("  ")).toThrow("Title required");
  });

  it("detects blocked dependencies", () => {
    const tasks = [
      { _id: "a", status: "done" as TaskStatus },
      { _id: "b", status: "in_progress" as TaskStatus },
    ];
    expect(isBlocked({ dependsOn: ["a"] }, tasks)).toBe(false);
    expect(isBlocked({ dependsOn: ["b"] }, tasks)).toBe(true);
    expect(isBlocked({ dependsOn: ["a", "b"] }, tasks)).toBe(true);
  });

  it("treats missing deps as blocked", () => {
    const tasks = [{ _id: "a", status: "done" as TaskStatus }];
    expect(isBlocked({ dependsOn: ["missing"] }, tasks)).toBe(true);
  });
});
