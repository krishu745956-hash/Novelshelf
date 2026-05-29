import React, { useState, useEffect } from "react";
import { X, HardDrive } from "lucide-react";
import { cn } from "../lib/utils";
import { calculateFolderSize } from "../lib/drive";
import FileExplorer from "./FileExplorer";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  rootId?: string | null;
  onNavigateFileTree?: (id: string, name: string, isFolder: boolean) => void;
  currentFolderId?: string;
  refreshKey?: number;
  onDataChanged?: () => void;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function StorageUsageIndicator({ rootId, refreshKey }: { rootId: string, refreshKey?: number }) {
  const [size, setSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unmounted = false;
    setLoading(true);
    calculateFolderSize(rootId).then(totalSize => {
      if(unmounted) return;
      setSize(totalSize);
      setLoading(false);
    }).catch((e: any) => {
      if (e.message !== "Session expired") {
        console.error(e);
      }
      if(!unmounted) setLoading(false);
    });
    return () => { unmounted = true; };
  }, [rootId, refreshKey]);

  // 15 GB total limit as standard free tier Google Drive
  const TOTAL_STORAGE = 15 * 1024 * 1024 * 1024;
  const percentage = size !== null ? Math.min(100, Math.max(0, (size / TOTAL_STORAGE) * 100)) : 0;

  return (
    <div className="mt-auto px-4 lg:px-6 pt-5 pb-6 border-t border-[var(--border-color)] bg-[var(--surface-color)]/30 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3 text-[var(--text-secondary)]">
        <HardDrive className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-sm text-[var(--text-color)]">Storage Usage</span>
      </div>
      {loading ? (
        <div className="space-y-3">
          <div className="h-1.5 bg-[var(--bg-color)] rounded-full overflow-hidden">
             <div className="h-full bg-[var(--border-color)] animate-pulse w-full"></div>
          </div>
          <div className="h-3 bg-[var(--border-color)]/50 rounded w-1/2 animate-pulse" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="h-1.5 w-full bg-[var(--surface-color)] border border-[var(--border-color)] rounded-full overflow-hidden shadow-inner relative">
            <div 
              className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" 
              style={{ width: `${Math.max(1, percentage)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--text-color)] font-medium bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              {size !== null ? formatBytes(size) : "Unknown"}
            </span>
            <span>15 GB</span>
          </div>
        </div>
      )}
    </div>
  );
}



export default function Sidebar({ isOpen, onClose, rootId, onNavigateFileTree, currentFolderId, refreshKey, onDataChanged }: SidebarProps) {
  const [width, setWidth] = useState(256);
  const isResizing = React.useRef(false);

  const startResizing = React.useCallback(() => {
    isResizing.current = true;
  }, []);

  const stopResizing = React.useCallback(() => {
    isResizing.current = false;
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing.current) {
        setWidth(Math.min(Math.max(mouseMoveEvent.clientX, 200), 480));
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed md:sticky top-0 md:top-16 z-50 md:z-10 bg-[var(--surface-color)] h-[100vh] md:h-[calc(100vh-4rem)] border-r border-[var(--border-color)] flex flex-col transition-all duration-300 overflow-hidden shrink-0 group/sidebar relative shadow-sm max-w-[85vw]",
          isOpen ? "translate-x-0 !shadow-2xl md:!shadow-sm" : "-translate-x-full md:translate-x-0"
        )}
        style={{ width: window.innerWidth < 768 ? '280px' : `${width}px` }}
      >
        {/* Resize Handle Container */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-2 translate-x-1 cursor-col-resize flex flex-col items-center justify-center group/resize z-40 transition-colors"
          onMouseDown={startResizing} 
        >
          {/* Visual Indicator (Vertical Line) */}
          <div className="w-[3px] h-10 bg-[var(--border-color)]/50 group-hover/resize:h-14 group-hover/resize:bg-primary group-active/resize:bg-primary transition-all rounded-full flex items-center justify-center gap-[1px]">
             <div className="w-[1px] h-4 bg-[var(--surface-color)] rounded-full opacity-0 group-hover/resize:opacity-100 transition-opacity" />
             <div className="w-[1px] h-4 bg-[var(--surface-color)] rounded-full opacity-0 group-hover/resize:opacity-100 transition-opacity" />
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col pt-4 pb-4">
          <div className="md:hidden flex items-center justify-between px-6 mb-4 border-b border-[var(--border-color)] pb-3">
            <span className="font-semibold text-lg text-[var(--text-color)] flex items-baseline gap-1">
              NovelShelf
            </span>
            <button onClick={onClose} className="p-2 -mr-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        
        <div className="flex-1 overflow-y-auto w-full relative">
          <h3 className="px-6 text-xs font-bold text-[var(--text-color)] uppercase tracking-widest mb-3">File Explorer</h3>
          <div className="h-full">
            {rootId && onNavigateFileTree ? (
              <FileExplorer 
                rootId={rootId} 
                onNavigate={(id, name, isFolder) => {
                  onNavigateFileTree(id, name, isFolder);
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }} 
                currentId={currentFolderId} 
                onDataChanged={onDataChanged}
                refreshKey={refreshKey}
              />
            ) : null}
          </div>
        </div>

        </div>

        {rootId && <StorageUsageIndicator rootId={rootId} refreshKey={refreshKey} />}
      </aside>
    </>
  );
}
