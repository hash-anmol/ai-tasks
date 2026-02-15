import { NextRequest, NextResponse } from "next/server";

// Simple in-memory store with localStorage sync on client
// This provides basic functionality until Convex is properly set up

let tasks: any[] = [];

const DEMO_TASKS = [
  {
    _id: "demo-1",
    title: "Welcome to AI Tasks!",
    description: "Click the + button to create your first task",
    status: "pending",
    priority: "medium",
    tags: [],
    isAI: false,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    _id: "demo-2",
    title: "Try an AI Task",
    description: "Toggle AI Task and assign to Main Agent for AI-powered assistance",
    status: "pending",
    priority: "high",
    tags: ["AI"],
    isAI: true,
    aiStatus: "pending",
    aiProgress: 0,
    agent: "main",
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
  },
];

// Initialize with demo tasks if empty
if (tasks.length === 0) {
  tasks = [...DEMO_TASKS];
}

// GET /api/tasks - Get all tasks
export async function GET() {
  return NextResponse.json({ tasks });
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const task = {
      _id: `task-${Date.now()}`,
      title: body.title,
      description: body.description || "",
      status: body.status || "pending",
      priority: body.priority || "medium",
      dueDate: body.dueDate || undefined,
      tags: body.tags || [],
      isAI: body.isAI || false,
      agent: body.agent || undefined,
      aiStatus: body.isAI ? "pending" : undefined,
      aiProgress: body.isAI ? 0 : undefined,
      dependsOn: body.dependsOn || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tasks.push(task);
    
    return NextResponse.json({ success: true, _id: task._id });
  } catch (error: any) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks - Delete a task by ID
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  
  if (!id) {
    return NextResponse.json(
      { error: "Task ID is required" },
      { status: 400 }
    );
  }
  
  const initialLength = tasks.length;
  tasks = tasks.filter(t => t._id !== id);
  
  if (tasks.length === initialLength) {
    return NextResponse.json(
      { error: "Task not found" },
      { status: 404 }
    );
  }
  
  return NextResponse.json({ success: true, message: "Task deleted" });
}

// PATCH /api/tasks - Update a task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const taskIndex = tasks.findIndex(t => t._id === id);
    if (taskIndex === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: Date.now(),
    };
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
