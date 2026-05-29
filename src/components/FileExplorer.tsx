import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Search,
  MoreVertical,
  Plus,
  Edit2,
  Trash2,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  listFolderContents,
  DriveFile,
  deleteFile,
  renameFile,
  createFolder,
  moveFile,
  searchFiles,
  createEmptyMarkdownFile,
} from "../lib/drive";
import { customAlert, customConfirm, customPrompt } from "../lib/dialogs";

// Context to share file operations deeply
interface FileExplorerContextType {
  onNavigate: (id: string, name: string, isFolder: boolean) => void;
  currentId?: string;
  onContextMenu: (e: React.MouseEvent, item: DriveFile) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDropItem: (targetId: string) => void;
  executeDrop: (
    sourceId: string,
    oldParentId: string,
    targetId: string,
  ) => Promise<void>;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  reloadTrigger: number;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  onRenameSubmit: (
    id: string,
    oldName: string,
    newName: string,
  ) => Promise<void>;
}

const FileExplorerContext = React.createContext<FileExplorerContextType | null>(
  null,
);

function useFileExplorer() {
  const ctx = React.useContext(FileExplorerContext);
  if (!ctx) throw new Error("Missing FileExplorerContext");
  return ctx;
}

function FileTreeNode({
  item,
  level,
  parentId,
}: {
  item: DriveFile;
  level: number;
  parentId: string;
}) {
  const {
    onNavigate,
    currentId,
    onContextMenu,
    draggedId,
    setDraggedId,
    executeDrop,
    expandedFolders,
    toggleFolder,
    reloadTrigger,
    renamingId,
    setRenamingId,
    onRenameSubmit,
  } = useFileExplorer();
  const [children, setChildren] = useState<DriveFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFolder = item.mimeType === "application/vnd.google-apps.folder";

  const expanded = expandedFolders.has(item.id);
  const isRenaming = renamingId === item.id;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select text without extension if possible
      const lastDot = editValue.lastIndexOf(".");
      if (lastDot > 0 && !isFolder) {
        inputRef.current.setSelectionRange(0, lastDot);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming]);

  useEffect(() => {
    let unmounted = false;
    if (expanded && isFolder) {
      setLoading(true);
      listFolderContents(item.id)
        .then((contents) => {
          if (!unmounted) {
            setChildren(contents);
            setLoading(false);
          }
        })
        .catch((e) => {
          console.error(e);
          if (!unmounted) setLoading(false);
        });
    }
    return () => {
      unmounted = true;
    };
  }, [expanded, item.id, reloadTrigger, isFolder]);

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onNavigate(item.id, item.name, true);
      toggleFolder(item.id);
    } else {
      onNavigate(item.id, item.name, false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedId(item.id);
    const actualParentId =
      item.parents && item.parents.length > 0 ? item.parents[0] : parentId;
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ id: item.id, parentId: actualParentId }),
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFolder) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.id === item.id) return; // Can't drop onto itself
      if (data.parentId === item.id) return; // Already in this folder

      executeDrop(data.id, data.parentId, item.id);
      setDraggedId(null);
    } catch (err) {
      // ignore
    }
  };

  const isSelected = item.id === currentId;
  const isDragging = draggedId === item.id;

  return (
    <div className="flex flex-col w-full">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, item);
        }}
        className={cn(
          "flex items-center w-full min-h-[30px] py-1 text-[13px] rounded-md cursor-pointer group pr-2 mt-[2px] transition-colors relative selection-none",
          isSelected
            ? "bg-primary/10 text-[var(--text-color)] font-medium"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-color)]/80 hover:text-[var(--text-color)]",
          isDragging ? "opacity-30" : "opacity-100",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleNodeClick}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isFolder) toggleFolder(item.id);
          }}
          className={cn(
            "p-1 rounded mr-0.5 opacity-60 flex items-center justify-center w-5 h-5",
            isFolder
              ? "hover:bg-black/10 dark:hover:bg-white/10 hover:opacity-100"
              : "invisible pointer-events-none",
          )}
        >
          {loading ? (
            <div className="w-3 h-3 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
          ) : expanded ? (
            <ChevronDown className="w-3.5 h-3.5 transition-transform" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 transition-transform" />
          )}
        </button>
        {isFolder ? (
          <Folder className="w-[14px] h-[14px] mr-2 shrink-0 opacity-80 text-primary" />
        ) : (
          <FileText className="w-[14px] h-[14px] mr-2 shrink-0 opacity-80" />
        )}
        {isRenaming ? (
          <input
            ref={inputRef}
            className="flex-1 bg-black/10 dark:bg-white/10 rounded px-1 outline-none text-primary min-w-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onRenameSubmit(item.id, item.name, editValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                onRenameSubmit(item.id, item.name, editValue);
              if (e.key === "Escape") setRenamingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 text-left">{item.name}</span>
        )}
      </div>

      {expanded && isFolder && (
        <div className="flex flex-col w-full relative">
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-black/10 dark:border-white/10"
            style={{ marginLeft: `${level * 12 + 13}px` }}
          />
          {children === null ? null : children.length === 0 ? (
            <div
              className="text-[11px] text-[var(--text-secondary)]/50 italic py-1.5"
              style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}
            >
              Empty folder
            </div>
          ) : (
            children.map((child) => (
              <FileTreeNode
                key={child.id}
                item={child}
                level={level + 1}
                parentId={item.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({
  rootId,
  onNavigate,
  currentId,
  onDataChanged,
  refreshKey,
}: {
  rootId: string;
  onNavigate: (id: string, name: string, isFolder: boolean) => void;
  currentId?: string;
  onDataChanged?: () => void;
  refreshKey?: number;
}) {
  const [rootItems, setRootItems] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DriveFile[] | null>(null);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("novel_expanded_folders");
      return saved ? new Set(JSON.parse(saved)) : new Set([rootId]);
    } catch {
      return new Set([rootId]);
    }
  });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: DriveFile | null;
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentId) {
      setExpandedFolders((prev) => {
        if (prev.has(currentId)) return prev;
        const next = new Set(prev);
        next.add(currentId);
        localStorage.setItem(
          "novel_expanded_folders",
          JSON.stringify(Array.from(next)),
        );
        return next;
      });
    }
  }, [currentId]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(
        "novel_expanded_folders",
        JSON.stringify(Array.from(next)),
      );
      return next;
    });
  };

  const loadRoot = async () => {
    setLoading(true);
    try {
      const items = await listFolderContents(rootId);
      setRootItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoot();
  }, [rootId, reloadTrigger]);

  useEffect(() => {
    if (refreshKey !== undefined) {
      setReloadTrigger((v) => v + 1);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchFiles(rootId, searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, rootId]);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const handleDropItem = async (targetFolderId: string) => {
    if (!draggedId) return;
    try {
      // We need to know the old parent. This is tricky because we didn't track it easily globally,
      // but we encoded it in the drag data!
      // In a real app we'd get oldParentId from the drag payload. Let's assume we can fetch it,
      // but wait, we need it to move in Google Drive.
      // For now, if we don't have it, we might need a workaround, but I encoded it!
      // I can't read dataTransfer in onDropItem easily without passing it... let's just trigger a reload.
      setReloadTrigger((v) => v + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setDraggedId(null);
    }
  };

  // We actually need to execute the move inside handleDrop of FileTreeNode to access e.dataTransfer.
  // Instead, let's redefine handleDrop logic here through context.

  const triggerReload = () => {
    setReloadTrigger((v) => v + 1);
    if (onDataChanged) onDataChanged();
  };

  const executeDrop = async (
    sourceId: string,
    oldParentId: string,
    targetFolderId: string,
  ) => {
    try {
      await moveFile(sourceId, targetFolderId, oldParentId);
      console.log(
        "Move successful:",
        sourceId,
        "from",
        oldParentId,
        "to",
        targetFolderId,
      );
      // Delay reloading to allow Google Drive's search index to update
      setTimeout(() => {
        triggerReload();
      }, 500);
    } catch (e) {
      console.error("Move failed:", e);
      customAlert("Failed to move item.");
    }
  };

  const handleCreateFolder = async (parentId: string) => {
    const name = await customPrompt("New folder name:");
    if (!name) return;
    try {
      await createFolder(name, parentId);
      setExpandedFolders((prev) => new Set(prev).add(parentId)); // auto expand
      triggerReload();
    } catch (e) {
      customAlert("Failed to create folder");
    }
  };

  const handleCreateFile = async (parentId: string) => {
    const name = await customPrompt("New file name (e.g., Note.md):");
    if (!name) return;
    try {
      // Auto append .md if missing
      const finalName =
        name.endsWith(".md") || name.endsWith(".txt") ? name : name + ".md";
      await createEmptyMarkdownFile(finalName, parentId);
      setExpandedFolders((prev) => new Set(prev).add(parentId));
      triggerReload();
    } catch (e) {
      customAlert("Failed to create file");
    }
  };

  const handleRename = (item: DriveFile) => {
    setRenamingId(item.id);
  };

  const onRenameSubmit = async (
    id: string,
    oldName: string,
    newName: string,
  ) => {
    setRenamingId(null);
    if (!newName || newName === oldName) return;
    try {
      await renameFile(id, newName);
      triggerReload();
    } catch (e) {
      customAlert("Failed to rename");
    }
  };

  const handleDelete = async (item: DriveFile) => {
    if (!(await customConfirm(`Are you sure you want to delete ${item.name}?`))) return;
    try {
      await deleteFile(item.id);
      setTimeout(() => triggerReload(), 500);
    } catch (e) {
      customAlert("Failed to delete");
    }
  };

  const ctxValue: FileExplorerContextType = {
    onNavigate,
    currentId,
    onContextMenu: (e, item) => {
      setContextMenu({ x: e.clientX, y: e.clientY, item });
    },
    draggedId,
    setDraggedId,
    onDropItem: (targetId) => {}, // Unused now
    executeDrop,
    expandedFolders,
    toggleFolder,
    reloadTrigger,
    renamingId,
    setRenamingId,
    onRenameSubmit,
  };

  // Override the drop logic in the Context since we can't easily pass it
  useFileExplorer; // just to prevent warning...

  return (
    <FileExplorerContext.Provider value={ctxValue}>
      <div className="flex flex-col h-full overflow-hidden select-none">
        <div className="px-4 mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 group/search">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within/search:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-color)] placeholder:text-[var(--text-secondary)] focus:outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto px-2 custom-scrollbar"
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, item: null });
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData("text/plain"));
              if (data.parentId === rootId) return; // already in root
              await executeDrop(data.id, data.parentId, rootId);
            } catch (err) {}
          }}
        >
          {loading && !searchResults && rootItems.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]/70">
              Loading...
            </div>
          ) : searchResults ? (
            <div className="flex flex-col">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Search Results
              </div>
              {searchResults.length === 0 ? (
                <div className="px-2 py-1 text-xs text-[var(--text-secondary)] opacity-50">
                  No results found.
                </div>
              ) : (
                searchResults.map((item) => (
                  <FileTreeNode
                    key={item.id}
                    item={item}
                    level={0}
                    parentId={rootId}
                  />
                ))
              )}
            </div>
          ) : rootItems.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[var(--text-secondary)]/50">
              Empty
            </div>
          ) : (
            <div className="flex flex-col">
              {rootItems.map((item) => (
                <FileTreeNode
                  key={item.id}
                  item={item}
                  level={0}
                  parentId={rootId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Custom Context Menu overlay */}
        {contextMenu &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setContextMenu(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu(null);
                }}
              />
              <div
                className="fixed z-[9999] bg-[var(--surface-color)]/95 backdrop-blur-xl border border-[var(--border-color)]/50 shadow-2xl rounded-xl py-1.5 flex flex-col min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
                style={{
                  top: Math.min(contextMenu.y, window.innerHeight - 200),
                  left: Math.min(contextMenu.x, window.innerWidth - 180),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {contextMenu.item?.mimeType ===
                  "application/vnd.google-apps.folder" || !contextMenu.item ? (
                  <>
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 mx-1.5 text-[13px] font-medium rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-color)] text-left transition-colors"
                      onClick={() => {
                        handleCreateFile(contextMenu.item?.id || rootId);
                        setContextMenu(null);
                      }}
                    >
                      <FilePlus className="w-4 h-4 text-[var(--text-secondary)]" />
                      New File
                    </button>
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 mx-1.5 text-[13px] font-medium rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-color)] text-left transition-colors"
                      onClick={() => {
                        handleCreateFolder(contextMenu.item?.id || rootId);
                        setContextMenu(null);
                      }}
                    >
                      <FolderPlus className="w-4 h-4 text-[var(--text-secondary)]" />
                      New Folder
                    </button>
                    {contextMenu.item && (
                      <div className="h-px bg-[var(--border-color)]/80 my-1 mx-2" />
                    )}
                  </>
                ) : null}

                {contextMenu.item && (
                  <>
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 mx-1.5 text-[13px] font-medium rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-color)] text-left transition-colors"
                      onClick={() => {
                        handleRename(contextMenu.item!);
                        setContextMenu(null);
                      }}
                    >
                      <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                      Rename
                    </button>
                    {!contextMenu.item?.mimeType.includes("folder") && (
                      <div className="h-px bg-[var(--border-color)]/80 my-1 mx-2" />
                    )}
                    <button
                      className="flex items-center gap-2.5 px-3 py-2 mx-1.5 text-[13px] font-medium rounded-md hover:bg-red-500/10 hover:text-red-500 text-red-500/90 text-left transition-colors"
                      onClick={() => {
                        handleDelete(contextMenu.item!);
                        setContextMenu(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>,
            document.body,
          )}
      </div>
    </FileExplorerContext.Provider>
  );
}
