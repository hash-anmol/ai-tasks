import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const LOG_FILE = path.join(process.cwd(), "logs", "openclaw-execution.log");

export async function GET() {
  try {
    const content = await readFile(LOG_FILE, "utf8");
    const lines = content.trim().split("\n");
    const tail = lines.slice(-500); // return last 500 entries
    return NextResponse.json({ entries: tail.map((line) => JSON.parse(line)) });
  } catch (error: any) {
    return NextResponse.json(
      { entries: [], error: error?.message || "No logs found" },
      { status: 200 }
    );
  }
}
