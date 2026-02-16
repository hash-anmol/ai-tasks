"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check webhook endpoint health
    fetch("/api/webhook/openclaw")
      .then((res) => res.json())
      .then((data) => {
        setWebhooks([
          {
            id: "openclaw",
            name: "OpenClaw",
            url: "/api/webhook/openclaw",
            status: data.status === "ok" ? "active" : "error",
            lastPing: new Date().toISOString(),
            events: ["task.created", "task.updated", "task.completed"],
          },
        ]);
        setLoading(false);
      })
      .catch(() => {
        setWebhooks([
          {
            id: "openclaw",
            name: "OpenClaw",
            url: "/api/webhook/openclaw",
            status: "error",
            lastPing: null,
            events: ["task.created", "task.updated", "task.completed"],
          },
        ]);
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-2">Webhooks</h1>
      <p className="text-sm text-slate-500 mb-6">Manage your webhook integrations</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800">{webhook.name}</h3>
                  <p className="text-xs text-slate-500">{webhook.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(webhook.status)}`}></div>
                  <span className={`text-xs font-medium ${
                    webhook.status === "active" ? "text-green-600" : 
                    webhook.status === "error" ? "text-red-600" : "text-slate-400"
                  }`}>
                    {webhook.status === "active" ? "Active" : "Error"}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-2">Events:</p>
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event: string) => (
                    <span key={event} className="text-[10px] px-2 py-1 bg-slate-100 rounded text-slate-600">
                      {event}
                    </span>
                  ))}
                </div>
              </div>

              {webhook.lastPing && (
                <p className="text-xs text-slate-400">
                  Last ping: {new Date(webhook.lastPing).toLocaleString()}
                </p>
              )}
            </div>
          ))}

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-bold text-blue-800 mb-2">Add Webhook</h3>
            <p className="text-sm text-blue-600 mb-3">
              Send POST requests to <code className="bg-white px-1 rounded">/api/webhook/openclaw</code>
            </p>
            <div className="text-xs text-blue-500">
              <p className="font-medium mb-1">Payload format:</p>
              <pre className="bg-white p-2 rounded overflow-x-auto">
{`{
  "taskId": "task_123",
  "status": "working",
  "progress": 50,
  "notes": "Working on analysis..."
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      <AddTaskButton />
      <BottomNav />
    </div>
  );
}
