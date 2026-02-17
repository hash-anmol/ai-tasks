import "server-only";

import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "openclaw-execution.log");

type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  ts: string;
  level: LogLevel;
  event: string;
  message?: string;
  data?: Record<string, unknown>;
};

async function writeLog(entry: LogEntry) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("OpenClaw log write failed:", error);
  }
}

export async function logOpenClaw(
  level: LogLevel,
  event: string,
  message?: string,
  data?: Record<string, unknown>,
) {
  await writeLog({
    ts: new Date().toISOString(),
    level,
    event,
    message,
    data,
  });
}
