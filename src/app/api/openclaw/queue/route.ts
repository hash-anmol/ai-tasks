import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const PENDING_TASKS_FILE = "/tmp/ai_tasks_pending.json";

function getPendingTasks() {
  try {
    if (existsSync(PENDING_TASKS_FILE)) {
      return JSON.parse(readFileSync(PENDING_TASKS_FILE, "utf-8"));
    }
  } catch (e) {
    console.log("Error reading pending tasks:", e);
  }
  return [];
}

function savePendingTask(task: any) {
  const tasks = getPendingTasks();
  tasks.push({ ...task, addedAt: Date.now() });
  writeFileSync(PENDING_TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function clearPendingTask(taskId: string) {
  const tasks = getPendingTasks().filter((t: any) => t.id !== taskId);
  writeFileSync(PENDING_TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// GET pending tasks - for OpenClaw to poll
export async function GET() {
  const tasks = getPendingTasks();
  return NextResponse.json({ 
    pendingTasks: tasks,
    count: tasks.length 
  });
}

// POST - Create task and queue for AI execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    console.log("📝 Queueing AI task:", { title, agent, taskId });

    // Save to pending tasks file for OpenClaw to pick up
    savePendingTask({
      id: taskId || `task_${Date.now()}`,
      title,
      description: description || "",
      agent: agent || "main",
      status: "pending"
    });

    return NextResponse.json({
      success: true,
      status: "queued",
      message: "Task queued for AI execution"
    });

  } catch (error: any) {
    console.error("❌ Queue error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Clear a pending task after execution
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  
  if (taskId) {
    clearPendingTask(taskId);
    return NextResponse.json({ success: true, message: "Task cleared" });
  }
  
  return NextResponse.json({ error: "Task ID required" }, { status: 400 });
}
