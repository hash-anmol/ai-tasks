import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task } = body;

    if (!task) {
      return NextResponse.json({ error: "Task required" }, { status: 400 });
    }

    // This endpoint is designed to be called internally
    // In production, this would trigger the actual agent execution
    // For now, we'll return success and the cron job will handle execution
    
    console.log("📝 Spawn request for task:", task.title);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      message: "Task queued for execution"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
