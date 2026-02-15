import { NextRequest, NextResponse } from "next/server";

// In-memory queue for AI tasks
let pendingTasks: any[] = [];

export async function GET() {
  return NextResponse.json({ pendingTasks, count: pendingTasks.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    const task = {
      id: taskId || `task_${Date.now()}`,
      title,
      description: description || "",
      agent: agent || "main",
      status: "pending",
      createdAt: Date.now(),
    };

    pendingTasks.push(task);

    // Spawn session immediately using the spawn endpoint
    try {
      // Call our own spawn endpoint which uses sessions_spawn internally
      await fetch(new URL("/api/openclaw/spawn", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
    } catch (e) {
      console.log("Spawn error:", e);
    }

    return NextResponse.json({
      success: true,
      status: "queued",
      message: "Task queued for AI execution"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  
  if (taskId) {
    pendingTasks = pendingTasks.filter(t => t.id !== taskId);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: "Task ID required" }, { status: 400 });
}
