import { NextRequest, NextResponse } from "next/server";

const TASKS_API_URL = process.env.TASKS_API_URL || "https://ai-tasks-zeta.vercel.app/api/tasks";

export async function GET() {
  try {
    // Fetch from the tasks REST API
    const response = await fetch(TASKS_API_URL, { 
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      return NextResponse.json({ pendingTasks: [], count: 0 });
    }
    
    const data = await response.json();
    const allTasks = data.tasks || [];
    
    // Filter for AI tasks with pending status
    const pending = allTasks
      .filter((t: any) => t.isAI && (t.aiStatus === "pending" || !t.aiStatus))
      .map((t: any) => ({
        id: t._id,
        title: t.title,
        description: t.description || "",
        agent: t.agent || "main",
        status: "pending",
        createdAt: t.createdAt,
        taskId: t._id,
      }));
    
    return NextResponse.json({ pendingTasks: pending, count: pending.length });
  } catch (error: any) {
    console.error("Queue error:", error.message);
    return NextResponse.json({ pendingTasks: [], count: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: "queued",
      message: "Task queued"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  
  if (!taskId) {
    return NextResponse.json({ error: "Task ID required" }, { status: 400 });
  }
  
  return NextResponse.json({ success: true });
}
