import React from "react";
import { FileText, CheckSquare } from "lucide-react";
import { DriveFile } from "../lib/drive";

const FILE_BG_COLORS = [
  "bg-[#fdfbf7] dark:bg-[#2a2421]",
  "bg-[#fdf8f5] dark:bg-[#2c2220]",
  "bg-[#fcfaf5] dark:bg-[#282620]",
];

interface FileCardProps {
  f: DriveFile;
  index: number;
  snippet?: string;
  isSelected: boolean;
  showCheckboxes: boolean;
  viewMode: "grid" | "list" | "compact";
  onClick: (e: React.MouseEvent, id: string, name: string, isFolder: boolean, file: DriveFile) => void;
  onDoubleClick: (e: React.MouseEvent, id: string, name: string, isFolder: boolean, file: DriveFile) => void;
  onContextMenu: (e: React.MouseEvent, file: DriveFile) => void;
  onTouchStart: (id: string) => void;
  onTouchEnd: () => void;
  onToggleSelection: (e: React.MouseEvent, id: string) => void;
}

export const FileCard = React.memo(({
  f, index, snippet, isSelected, showCheckboxes, viewMode,
  onClick, onDoubleClick, onContextMenu, onTouchStart, onTouchEnd, onToggleSelection
}: FileCardProps) => {
  const bgColor = FILE_BG_COLORS[index % FILE_BG_COLORS.length];
  return (
    <button
      data-id={f.id}
      onClick={(e) => onClick(e, f.id, f.name, false, f)}
      onDoubleClick={(e) => onDoubleClick(e, f.id, f.name, false, f)}
      onContextMenu={(e) => onContextMenu(e, f)}
      onTouchStart={() => onTouchStart(f.id)}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchEnd}
      className={`item-card group relative text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-900/5 focus:outline-none focus:ring-2 focus:ring-amber-500 overflow-hidden border border-[var(--border-color)]/50 select-none ${bgColor} ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-color)]" : ""
      } ${
        viewMode === "compact" ? "rounded-xl p-3 flex items-center gap-3" :
        viewMode === "list" ? "rounded-2xl p-5 flex items-start gap-4" :
        "rounded-2xl p-5 flex flex-col aspect-[4/5]"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-50 pointer-events-none" />
      <div className={`flex items-start ${viewMode === "compact" ? "gap-2 items-center min-w-0" : "justify-between w-full mb-3"} relative z-10`}>
        <div className={`p-2 rounded-xl bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ${viewMode === "compact" ? "p-1.5 rounded-lg shrink-0" : ""}`}>
          <FileText className={`${viewMode === "compact" ? "w-4 h-4" : "w-5 h-5"}`} />
        </div>
      </div>
      
      {(f as any)._uploadProgress !== undefined && (
        <div className="absolute top-0 left-0 h-1 bg-primary/80 transition-all duration-300 pointer-events-none z-20" style={{ width: `${(f as any)._uploadProgress}%` }} />
      )}

      <div className={`relative z-10 ${viewMode === "compact" ? "min-w-0 flex-1" : "flex-1 flex flex-col"}`}>
        <h4 className={`font-bold text-[var(--text-color)] ${viewMode === "compact" ? "text-sm truncate pr-8" : "text-base mb-2 leading-tight pr-6"}`}>
          {(f.name || "").replace(/\.md$/, '')}
        </h4>
        {viewMode !== "compact" && (
          <div className={`text-xs text-[var(--text-secondary)] leading-relaxed opacity-80 font-serif ${viewMode === "grid" ? "line-clamp-[8]" : "line-clamp-2"}`}>
            {snippet ? snippet : (
              <div className="flex flex-col gap-2 mt-2 opacity-50">
                <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-full"></div>
                <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-5/6"></div>
                <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-4/6"></div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
      
      {/* Selection Checkbox Overlay */}
      {showCheckboxes && (
        <div 
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleSelection(e, f.id); }}
          className={`absolute top-2 right-2 p-1 rounded-lg transition-all z-20 ${
            isSelected ? "text-primary opacity-100" : "text-[var(--text-secondary)] opacity-0 group-hover:opacity-60"
          }`}
        >
          <CheckSquare className={`w-5 h-5 ${isSelected ? "fill-primary text-[var(--bg-color)]" : ""}`} />
        </div>
      )}
    </button>
  );
});
