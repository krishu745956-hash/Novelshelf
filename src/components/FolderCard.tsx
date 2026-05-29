import React from "react";
import { Folder, CheckSquare } from "lucide-react";
import { DriveFile } from "../lib/drive";

const FOLDER_COLORS = [
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  "bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20",
];

interface FolderCardProps {
  f: DriveFile;
  index: number;
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

export const FolderCard = React.memo(({ 
  f, index, isSelected, showCheckboxes, viewMode, 
  onClick, onDoubleClick, onContextMenu, onTouchStart, onTouchEnd, onToggleSelection
}: FolderCardProps) => {
  const colorClass = FOLDER_COLORS[index % FOLDER_COLORS.length];
  return (
    <button
      data-id={f.id}
      onClick={(e) => onClick(e, f.id, f.name, true, f)}
      onDoubleClick={(e) => onDoubleClick(e, f.id, f.name, true, f)}
      onContextMenu={(e) => onContextMenu(e, f)}
      onTouchStart={() => onTouchStart(f.id)}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchEnd}
      className={`item-card relative flex items-center text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-color)] bg-[var(--surface-color)]" : ""
      } ${
        viewMode === "grid" 
          ? `flex-col p-5 rounded-2xl border bg-gradient-to-br ${colorClass.replace("border-", "border-").replace("text-", "").replace("bg-", "from-transparent to-").split(" ")[0]} ${colorClass}`
          : viewMode === "list"
            ? `flex-row p-4 rounded-xl border items-center gap-4 ${colorClass}`
            : `flex-row p-2 rounded-lg border items-center gap-2 ${colorClass}`
      }`}
    >
      <Folder className={`${
        viewMode === "grid" ? "w-10 h-10 mb-3 opacity-80 group-hover:opacity-100 transition-opacity" :
        viewMode === "list" ? "w-8 h-8 opacity-90" :
        "w-5 h-5 opacity-90"
      }`} />
      <div className={`flex-1 ${viewMode === "grid" ? "w-full text-center" : ""}`}>
        <h4 className={`font-bold tracking-tight ${
          viewMode === "grid" ? "text-[15px]" :
          viewMode === "list" ? "text-base" :
          "text-sm truncate"
        }`}>
          {f.name}
        </h4>
      </div>
      
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
