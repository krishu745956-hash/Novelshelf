import React from "react";
import { Folder, FileText, Star, MoveRight, Edit2, Copy, Download, Trash2 } from "lucide-react";
import { DriveFile, duplicateFile, downloadFolder, downloadMultipleFiles } from "../lib/drive";

interface ContextMenuProps {
  x: number;
  y: number;
  item: DriveFile;
  onClose: () => void;
  onNavigate: (id: string, name: string) => void;
  onOpenFile: (file: DriveFile) => void;
  onToggleStar: (file: DriveFile) => void;
  onMove: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  onDuplicate: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
}

export function ContextMenu({
  x, y, item, onClose, onNavigate, onOpenFile, onToggleStar, onMove, onRename, onDuplicate, onDelete
}: ContextMenuProps) {
  return (
    <div 
      className="fixed z-50 min-w-[200px] bg-[var(--surface-color)] border border-[var(--border-color)]/60 rounded-xl shadow-2xl py-2 animate-in fade-in zoom-in duration-200 backdrop-blur-md"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-[var(--border-color)]/30 mb-1">
        <p className="text-xs font-semibold text-[var(--text-secondary)] truncate">
           {item.name}
        </p>
      </div>
      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
        onClick={() => {
          if (item.mimeType.includes("folder")) {
            onNavigate(item.id, item.name);
          } else {
            onOpenFile(item);
          }
          onClose();
        }}
      >
        {item.mimeType.includes("folder") ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        Open
      </button>
      
      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
        onClick={() => {
          onToggleStar(item);
          onClose();
        }}
      >
        <Star className={`w-4 h-4 ${item.starred ? "fill-current text-amber-500" : ""}`} />
        {item.starred ? "Remove from Favorites" : "Add to Favorites"}
      </button>

      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
        onClick={() => {
          onMove(item);
          onClose();
        }}
      >
        <MoveRight className="w-4 h-4" />
        Move
      </button>
      
      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
        onClick={() => {
          onRename(item);
          onClose();
        }}
      >
        <Edit2 className="w-4 h-4" />
        Rename
      </button>

      {!item.mimeType.includes("folder") && (
        <button 
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
          onClick={async () => {
            onClose();
            onDuplicate(item);
          }}
        >
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
      )}

      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-primary transition-colors focus:bg-[var(--bg-color)] focus:text-primary outline-none"
        onClick={async () => {
          onClose();
          if (item.mimeType.includes("folder")) {
            await downloadFolder(item.id, item.name, (msg) => console.log(msg));
          } else {
            await downloadMultipleFiles([item], item.name.replace(".md", ""));
          }
        }}
      >
        <Download className="w-4 h-4" />
        Download
      </button>

      <div className="h-px bg-[var(--border-color)]/30 my-1"></div>

      <button 
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:bg-red-50 dark:focus:bg-red-950/30 outline-none"
        onClick={() => {
          onDelete(item);
          onClose();
        }}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
