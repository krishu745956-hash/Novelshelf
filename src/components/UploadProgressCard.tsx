import React from "react";
import { UploadTracker } from "../lib/upload-utils";
import { CloudUpload, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface UploadProgressCardProps {
  tracker: UploadTracker;
}

export function UploadProgressCard({ tracker }: UploadProgressCardProps) {
  const items = Object.values(tracker);
  if (items.length === 0) return null;

  const total = items.length;
  const completed = items.filter((i) => i.status === "success").length;
  const errored = items.filter((i) => i.status === "error").length;
  const isDone = (completed + errored) === total && total > 0;
  
  const totalProgress = items.reduce((acc, curr) => acc + curr.progress, 0) / (total || 1);

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-2xl shadow-xl w-80 overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-8">
      <div className="p-4 flex items-center justify-between bg-[var(--surface-dim-color)]/50 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          {isDone ? (
            <CheckCircle2 className={`w-5 h-5 ${errored > 0 ? "text-yellow-500" : "text-green-500"}`} />
          ) : (
            <div className="relative">
              <CloudUpload className="w-5 h-5 text-primary" />
              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
            </div>
          )}
          <span className="font-medium text-[var(--text-color)] text-sm">
            {isDone
              ? errored > 0
                ? `Done — ${errored} file${errored > 1 ? "s" : ""} failed`
                : "Upload complete"
              : `Uploading ${total} item${total > 1 ? "s" : ""}...`}
          </span>
        </div>
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {Math.round(totalProgress)}%
        </span>
      </div>

      <div className="w-full bg-[var(--surface-dim-color)] h-1.5 relative overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            isDone ? (errored > 0 ? "bg-yellow-500" : "bg-green-500") : "bg-primary"
          )}
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {!isDone && (
        <div className="max-h-32 overflow-y-auto p-3 text-xs space-y-2">
          {items.map((item) => {
            if (item.status === "pending") return null;
            return (
              <div key={item.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="truncate w-48">{item.filename}</span>
                  {item.status === "error" && <AlertCircle className="w-3 h-3 text-red-500" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
