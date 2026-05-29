import React, { useState, useEffect } from "react";
import { Folder, ChevronRight, X } from "lucide-react";
import { DriveFile, listFolderContents } from "../lib/drive";

interface FolderPickerProps {
  onSelect: (folderId: string) => void;
  onClose: () => void;
  title?: string;
  excludeIds?: Set<string>;
}

export function FolderPicker({ onSelect, onClose, title = "Move to...", excludeIds = new Set() }: FolderPickerProps) {
  const [currentId, setCurrentId] = useState("root");
  const [history, setHistory] = useState<{ id: string; name: string }[]>([{ id: "root", name: "My Drive" }]);
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const items = await listFolderContents(currentId);
        setFolders(items.filter((i) => i.mimeType.includes("folder") && !excludeIds.has(i.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentId, excludeIds]);

  const handleNavigate = (id: string, name: string) => {
    setCurrentId(id);
    setHistory((prev) => [...prev, { id, name }]);
  };

  const handleBreadcrumb = (idx: number) => {
    const crumb = history[idx];
    setCurrentId(crumb.id);
    setHistory((prev) => prev.slice(0, idx + 1));
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--surface-color)] rounded-2xl shadow-2xl border border-[var(--border-color)]/50 max-w-md w-full animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]/30 shrink-0">
          <h3 className="text-lg font-semibold text-[var(--text-color)]">{title}</h3>
          <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--bg-color)] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[var(--border-color)]/30 shrink-0 overflow-x-auto whitespace-nowrap custom-scrollbar flex items-center gap-1">
          {history.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />}
              <button
                onClick={() => handleBreadcrumb(idx)}
                className={`text-sm hover:text-primary transition-colors px-2 py-1 rounded-md ${
                  idx === history.length - 1 ? "text-[var(--text-color)] font-medium" : "text-[var(--text-secondary)] hover:bg-[var(--bg-color)]"
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar min-h-[200px]">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-800 rounded-full animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">No folders here</div>
          ) : (
            <div className="flex flex-col gap-1">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleNavigate(f.id, f.name)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-color)] transition-colors text-left group"
                >
                  <Folder className="w-5 h-5 text-blue-500/80 group-hover:text-blue-500" fill="currentColor" fillOpacity={0.2} />
                  <span className="flex-1 text-sm font-medium text-[var(--text-color)] truncate">{f.name}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-color)]/30 shrink-0 bg-[var(--bg-color)] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => onSelect(currentId)}
            className="px-4 py-2 text-sm font-medium bg-primary text-white hover:opacity-90 rounded-lg transition-opacity shadow-sm"
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
