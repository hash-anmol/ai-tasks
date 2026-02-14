import { NextResponse } from "next/server";

// GET /api/standup
// Returns formatted standup message for the current day

export async function GET() {
  // Get tasks from localStorage would happen client-side
  // For now, return instructions for generating standup
  
  const standupTemplate = {
    sections: [
      {
        title: "✅ Completed Yesterday",
        tasks: "[Tasks completed in last 24h]",
        format: "- {task_title}"
      },
      {
        title: "🔄 In Progress Today",
        tasks: "[Tasks currently working on]",
        format: "- {task_title}"
      },
      {
        title: "🚧 Blockers",
        tasks: "[Any blockers or dependencies]",
        format: "- {blocker_description}"
      }
    ],
    example: `📊 *Daily Standup*

✅ *Completed Yesterday*
- Review Q3 Design Specs
- Add task dependencies system

🔄 *In Progress Today*
- Generate Project Roadmap

🚧 *Blockers*
- None`
  };

  return NextResponse.json({
    success: true,
    message: "Use /api/standup/generate to get today's standup",
    template: standupTemplate,
  });
}

// POST /api/standup
// Generate standup from tasks
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "tasks array is required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Categorize tasks
    const completedYesterday = tasks.filter((t: any) => {
      const updated = new Date(t.updatedAt);
      return t.status === "done" && updated >= yesterday;
    });

    const inProgress = tasks.filter((t: any) => 
      t.status === "in_progress" || t.status === "assigned"
    );

    const blocked = tasks.filter((t: any) => 
      t.dependsOn && t.dependsOn.length > 0 && 
      !t.dependsOn.every((depId: string) => 
        tasks.find((task: any) => task._id === depId)?.status === "done"
      )
    );

    // Format message
    let message = `📊 *Daily Standup* — ${now.toLocaleDateString("en-IN", { 
      weekday: "long", 
      month: "short", 
      day: "numeric" 
    })}\n\n`;

    message += `✅ *Completed Yesterday* (${completedYesterday.length})\n`;
    if (completedYesterday.length > 0) {
      completedYesterday.forEach((t: any) => {
        message += `• ${t.title}\n`;
      });
    } else {
      message += `_No tasks completed_\n`;
    }
    message += "\n";

    message += `🔄 *In Progress Today* (${inProgress.length})\n`;
    if (inProgress.length > 0) {
      inProgress.forEach((t: any) => {
        const agent = t.agent ? ` [${t.agent}]` : "";
        message += `• ${t.title}${agent}\n`;
      });
    } else {
      message += `_No tasks in progress_\n`;
    }
    message += "\n";

    message += `🚧 *Blockers* (${blocked.length})\n`;
    if (blocked.length > 0) {
      blocked.forEach((t: any) => {
        message += `• ${t.title} — blocked\n`;
      });
    } else {
      message += `_No blockers! 🎉_\n`;
    }

    return NextResponse.json({
      success: true,
      message,
      stats: {
        completed: completedYesterday.length,
        inProgress: inProgress.length,
        blocked: blocked.length,
      },
    });
  } catch (error) {
    console.error("Standup error:", error);
    return NextResponse.json(
      { error: "Failed to generate standup" },
      { status: 500 }
    );
  }
}
