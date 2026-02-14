import { NextResponse } from "next/server";

// In-memory store for demo (replace with Convex/DB in production)
let tasks: any[] = [
  {
    _id: "1",
    title: "Review Q3 Design Specs",
    status: "done",
    priority: "high",
    tags: ["AI"],
    isAI: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "2",
    title: "Synthesize Meeting Notes",
    status: "pending",
    dueDate: "2:30 PM",
    priority: "medium",
    tags: [],
    isAI: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /api/tasks - Get all tasks
export async function GET() {
  return NextResponse.json({ tasks });
}

// POST /api/tasks - Create a new task (for AI agents)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const task = {
      _id: Date.now().toString(),
      title: body.title,
      description: body.description || "",
      status: body.status || "pending",
      priority: body.priority || "medium",
      dueDate: body.dueDate || null,
      tags: body.tags || [],
      isAI: body.isAI || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(task);
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks - Delete a task by ID
export async function DELETE(request: Request) {
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
