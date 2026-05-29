import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import { DriveFile, listFolderContents, getFileContent, getFavorites, renameFile, toggleFavorite, deleteFile, duplicateFile, downloadMultipleFiles, downloadFolder, moveFile, createFolder, createEmptyMarkdownFile } from "../lib/drive";
import { customConfirm, customPrompt, customAlert } from "../lib/dialogs";
import { Folder, FileText, ChevronRight, LayoutGrid, List, AlignJustify, Star, Trash2, Edit2, Download, Copy, CheckSquare, MoveRight, FolderPlus, FilePlus } from "lucide-react";
import { FolderPicker } from "./FolderPicker";
import { FolderCard } from "./FolderCard";
import { FileCard } from "./FileCard";
import { ContextMenu } from "./ContextMenu";
import { BulkActionBar } from "./BulkActionBar";
import { UploadTracker } from "../lib/upload-utils";

interface VisualExplorerProps {
  rootId: string;
  onOpenFile: (file: DriveFile) => void;
  refreshKey: number;
  onDataChanged: () => void;
  uploadTracker?: UploadTracker;
}

interface Breadcrumb {
  id: string;
  name: string;
}



export function VisualExplorer({ rootId, onOpenFile, refreshKey, onDataChanged, uploadTracker = {} }: VisualExplorerProps) {
  const [currentFolderId, setCurrentFolderId] = useState(rootId);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: rootId, name: "Vault Root" }]);
  const [items, setItems] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "compact">("grid");
  const [activeTab, setActiveTab] = useState<"explorer" | "favorites">("explorer");

  const [snippets, setSnippets] = useState<Record<string, string>>({});

  const [selectedIds, setSelectedIdsState] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(selectedIds);

  const setSelectedIds = useCallback((nextArg: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedIdsState(prev => {
      const next = typeof nextArg === 'function' ? nextArg(prev) : nextArg;
      selectedIdsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!uploadTracker) return;
    const completedFiles = Object.values(uploadTracker)
      .filter(t => t.status === "success" && t.file)
      .map(t => t.file as DriveFile);

    if (completedFiles.length > 0) {
      setItems(prev => {
        let changed = false;
        const next = [...prev];
        for (const file of completedFiles) {
          if (!next.find(i => i.id === file.id)) {
            // Only add if it belongs in current view (or if we just assume so for now since upload targets currentFolderId)
            if (activeTab === "explorer" && (file.parents?.[0] === currentFolderId)) {
              next.push(file);
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    }
  }, [uploadTracker, activeTab, currentFolderId]);
  const lastSelectedIdRef = useRef<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState<boolean>(false);
  const [opProgress, setOpProgress] = useState<{text: string, progress: number, total: number} | null>(null);

  const [selectionBox, setSelectionBox] = useState<{startX: number, startY: number, currentX: number, currentY: number, isDragging: boolean} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStartSelectionRef = useRef<Set<string>>(new Set());
  const dragModifiersRef = useRef<{alt: boolean}>({ alt: false });
  const rafRef = useRef<number | null>(null);
  const lastMousePosRef = useRef<{clientY: number, clientX: number} | null>(null);
  const cachedRectsRef = useRef<{id: string, left: number, right: number, top: number, bottom: number}[]>([]);

  const calculateIntersections = useCallback((box: {startX: number, startY: number, currentX: number, currentY: number}, isAlt: boolean) => {
    const boxLeft = Math.min(box.startX, box.currentX);
    const boxRight = Math.max(box.startX, box.currentX);
    const boxTop = Math.min(box.startY, box.currentY);
    const boxBottom = Math.max(box.startY, box.currentY);

    const newSelection = new Set(dragStartSelectionRef.current);
    
    startTransition(() => {
      cachedRectsRef.current.forEach(card => {
        const { id, left: cardLeft, right: cardRight, top: cardTop, bottom: cardBottom } = card;

        if (boxRight < cardLeft || boxLeft > cardRight || boxBottom < cardTop || boxTop > cardBottom) return;

        const overlapX = Math.max(0, Math.min(boxRight, cardRight) - Math.max(boxLeft, cardLeft));
        const overlapY = Math.max(0, Math.min(boxBottom, cardBottom) - Math.max(boxTop, cardTop));
        const overlapArea = overlapX * overlapY;
        const cardArea = (cardRight - cardLeft) * (cardBottom - cardTop);

        if (cardArea > 0 && overlapArea / cardArea > 0.30) {
           if (isAlt && newSelection.has(id)) {
              newSelection.delete(id);
           } else if (!isAlt) {
              newSelection.add(id);
           }
        }
      });
      setSelectedIdsState(prev => {
        // Prevent unnecessary re-renders if selection hasn't changed
        if (prev.size === newSelection.size && Array.from(prev).every(id => newSelection.has(id))) return prev;
        selectedIdsRef.current = newSelection;
        return newSelection;
      });
    });
  }, []);

  const autoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const mouse = lastMousePosRef.current;
    const box = selectionBoxRef.current;
    if (!container || !mouse || !box) return;

    if (box.isDragging) {
      // Calculate auto scroll
      const rect = container.getBoundingClientRect();
      const distanceTop = mouse.clientY - rect.top;
      const distanceBottom = rect.bottom - mouse.clientY;
      
      let scrollAmount = 0;
      if (distanceTop < 50) {
        scrollAmount = -Math.max(5, 50 - distanceTop);
      } else if (distanceBottom < 50) {
        scrollAmount = Math.max(5, 50 - distanceBottom);
      }

      if (scrollAmount !== 0) {
        container.scrollTop += scrollAmount;
        setSelectionBox(prev => {
          if (!prev) return null;
          const nextBox = { ...prev, currentY: prev.currentY + scrollAmount };
          selectionBoxRef.current = nextBox;
          return nextBox;
        });
      }
      
      // Calculate intersections every frame if dragging
      calculateIntersections(selectionBoxRef.current, dragModifiersRef.current.alt);
    }
    rafRef.current = requestAnimationFrame(autoScroll);
  }, [calculateIntersections]);

  // We need a ref for selectionBox so autoScroll can read it if we're worried about closures
  const selectionBoxRef = useRef<{startX: number, startY: number, currentX: number, currentY: number, isDragging: boolean} | null>(null);
  
  useEffect(() => {
    // Only spin up the RAF loop if we are dragging
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  const handleContainerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.item-card') || target.closest('button')) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    
    // Pre-calculate and cache card rects for faster intersection checks during drag
    const cards = container.querySelectorAll('.item-card');
    cachedRectsRef.current = Array.from(cards).map(card => {
      const id = card.getAttribute('data-id');
      const rect = card.getBoundingClientRect();
      return {
        id: id || '',
        left: rect.left - containerRect.left + container.scrollLeft,
        right: rect.right - containerRect.left + container.scrollLeft,
        top: rect.top - containerRect.top + container.scrollTop,
        bottom: rect.bottom - containerRect.top + container.scrollTop
      };
    }).filter(c => c.id);

    const x = e.clientX - containerRect.left + container.scrollLeft;
    const y = e.clientY - containerRect.top + container.scrollTop;

    const newBox = { startX: x, startY: y, currentX: x, currentY: y, isDragging: false };
    setSelectionBox(newBox);
    selectionBoxRef.current = newBox;

    dragModifiersRef.current = { alt: e.altKey };
    
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      dragStartSelectionRef.current = new Set(selectedIdsRef.current);
    } else {
      dragStartSelectionRef.current = new Set();
      startTransition(() => setSelectedIds(new Set()));
    }

    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    container.setPointerCapture(e.pointerId);
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(autoScroll);
  }, [autoScroll]);

  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    
    if (!selectionBoxRef.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentX = e.clientX - rect.left + container.scrollLeft;
    const currentY = e.clientY - rect.top + container.scrollTop;

    dragModifiersRef.current = { alt: e.altKey };

    setSelectionBox(prev => {
       if (!prev) return null;
       const dx = Math.abs(currentX - prev.startX);
       const dy = Math.abs(currentY - prev.startY);
       const isDragging = prev.isDragging || dx > 5 || dy > 5;
       
       const nextBox = { ...prev, currentX, currentY, isDragging };
       selectionBoxRef.current = nextBox;
       return nextBox;
    });
  }, []);

  const handleContainerPointerUp = useCallback((e: React.PointerEvent) => {
    if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }
    if (!selectionBoxRef.current) return;
    const container = scrollContainerRef.current;
    if (container) {
      container.releasePointerCapture(e.pointerId);
    }
    setSelectionBox(null);
    selectionBoxRef.current = null;
  }, []);



  const runBatchedOperation = async <T,>(operationText: string, itemsToProcess: DriveFile[], action: (item: DriveFile) => Promise<T>, optimisticUpdate?: (results?: T[]) => void) => {
    if (optimisticUpdate) optimisticUpdate();
    
    setOpProgress({ text: operationText, progress: 0, total: itemsToProcess.length });
    const BATCH_SIZE = 5;
    let completed = 0;
    const results: T[] = [];
    
    for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
      const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (item) => {
        try {
          const res = await action(item);
          return res;
        } catch (error) {
          console.error(`Error processing ${item.name}:`, error);
          return null as any;
        } finally {
          completed++;
        }
      }));
      results.push(...batchResults.filter(Boolean));
      setOpProgress(prev => prev ? { ...prev, progress: completed } : null);
    }
    
    setOpProgress(null);
    setSelectedIds(new Set());
    if (optimisticUpdate) {
      // Allow second call with results if needed
      optimisticUpdate(results);
    }
    return results;
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent taking action if user is typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          if (items.length > 0) {
            setSelectedIds(new Set(items.map(i => i.id)));
          }
        }
        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          const selectedItems = items.filter(i => selectedIds.has(i.id) && !i.mimeType.includes("folder"));
          if (selectedItems.length > 0) {
            await runBatchedOperation(
              `Duplicating ${selectedItems.length} items...`,
              selectedItems,
              async (item) => { return await duplicateFile(item.id, item.name, false); },
              (results) => { if (results && results.length > 0) setItems(prev => [...prev, ...results]); }
            );
            setSelectedIds(new Set());
          }
        }
        if (e.key === "1") { e.preventDefault(); setViewMode("grid"); }
        if (e.key === "2") { e.preventDefault(); setViewMode("list"); }
        if (e.key === "3") { e.preventDefault(); setViewMode("compact"); }
      } else {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedIds.size > 0) {
            e.preventDefault();
            if (await customConfirm(`Delete ${selectedIds.size} items?`)) {
              const selectedItems = items.filter(i => selectedIds.has(i.id));
              await runBatchedOperation(
                `Deleting ${selectedItems.length} items...`,
                selectedItems,
                async (item) => { await deleteFile(item.id); },
                () => setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
              );
              setSelectedIds(new Set());
            }
          }
        }
        if (e.key === "F2") {
          if (selectedIds.size === 1) {
            e.preventDefault();
            const id = Array.from(selectedIds)[0];
            const item = items.find(i => i.id === id);
            if (item) {
              const newName = await customPrompt("Enter new name:", item.name);
              if (newName && newName !== item.name) {
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: newName } : i));
                try {
                  await renameFile(item.id, newName);
                } catch(err) {
                  setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: item.name } : i));
                }
              }
            }
          }
        }
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIds]);

  useEffect(() => {
    let unmounted = false;
    async function load() {
      setLoading(true);
      setSelectedIds(new Set());
      try {
        let fetched: DriveFile[] = [];
        if (activeTab === "favorites") {
          fetched = await getFavorites();
        } else {
          fetched = await listFolderContents(currentFolderId);
        }
        if (unmounted) return;
        
        setItems(prev => {
          let updated = [...fetched];
          const fetchedIds = new Set(fetched.map(f => f.id));
          for (const oldItem of prev) {
            if (!fetchedIds.has(oldItem.id)) {
              if (activeTab !== "explorer" || oldItem.parents?.[0] === currentFolderId) {
                const isRecent = oldItem.createdTime && (Date.now() - new Date(oldItem.createdTime).getTime() < 300000);
                if (isRecent) {
                  updated.push(oldItem);
                }
              }
            }
          }
          return updated;
        });
        
        // Fetch snippets for files
        const files = fetched.filter(f => !f.mimeType.includes("folder"));
        files.forEach(async (f) => {
          try {
            const text = await getFileContent(f.id);
            if (unmounted) return;
            const preview = text.substring(0, 150).replace(/[#*`_]/g, "").trim();
            setSnippets(prev => ({ ...prev, [f.id]: preview }));
          } catch (e) {
            // ignore preview fetch errors
          }
        });
      } catch (err) {
        console.error("Failed to load folder", err);
      } finally {
        if (!unmounted) setLoading(false);
      }
    }
    load();
    return () => { unmounted = true; };
  }, [currentFolderId, refreshKey, activeTab]);

  const handleNavigate = (id: string, name: string) => {
    setCurrentFolderId(id);
    setBreadcrumbs(prev => [...prev, { id, name }]);
    setActiveTab("explorer");
  };

  const handleBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async () => {
    const name = await customPrompt("New folder name:");
    if (!name) return;
    try {
      setLoading(true);
      await createFolder(name, currentFolderId);
      onDataChanged(); // trigger a tree refresh
    } catch (e) {
      customAlert("Failed to create folder");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFile = async () => {
    const name = await customPrompt("New file name (e.g., Note.md):");
    if (!name) return;
    try {
      setLoading(true);
      const finalName = name.endsWith(".md") || name.endsWith(".txt") ? name : name + ".md";
      await createEmptyMarkdownFile(finalName, currentFolderId);
      onDataChanged();
    } catch (e) {
      customAlert("Failed to create file");
    } finally {
      setLoading(false);
    }
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: DriveFile } | null>(null);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    return () => window.removeEventListener("click", closeContextMenu);
  }, []);



  const onRename = async (item: DriveFile) => {
    const newName = await customPrompt("Enter new name:", item.name);
    if (newName && newName !== item.name) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: newName } : i));
      try {
        await renameFile(item.id, newName);
      } catch(e) {
        // Revert or alert
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, name: item.name } : i));
      }
    }
  };

  const onDelete = async (item: DriveFile) => {
    if (await customConfirm(`Are you sure you want to delete ${item.name}?`)) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      try {
        await deleteFile(item.id);
      } catch(e) {
        // Handle failure if needed
      }
    }
  };

  const onToggleStar = async (item: DriveFile) => {
    const newStarred = !item.starred;
    setItems(prev => {
      if (activeTab === "favorites" && !newStarred) {
        return prev.filter(i => i.id !== item.id);
      }
      return prev.map(i => i.id === item.id ? { ...i, starred: newStarred } : i);
    });
    try {
      await toggleFavorite(item.id, newStarred);
    } catch(e) {
      // Revert if failed
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, starred: item.starred } : i));
    }
  };

  const folders = useMemo(() => items.filter(i => i.mimeType.includes("folder")), [items]);
  const files = useMemo(() => {
    const list = items.filter(i => !i.mimeType.includes("folder"));
    // Add upload tracking files optimally
    Object.values(uploadTracker).forEach(tracker => {
      // Find if we already have it in items (successful upload might have synced or something)
      const existing = list.find(l => l.name === tracker.filename && l.id === tracker.id);
      if (!existing && (tracker.status === "pending" || tracker.status === "uploading")) {
        // Create an optimistic placeholder
        list.push({
          id: tracker.id,
          name: tracker.filename || "Untitled",
          mimeType: "file",
          size: (tracker.fileSize || 0).toString(),
          modifiedTime: new Date().toISOString(),
          createdTime: new Date().toISOString(),
          parents: [currentFolderId],
          starred: false,
          trashed: false,
          _uploadProgress: tracker.progress
        } as DriveFile & { _uploadProgress?: number });
      }
    });
    return list;
  }, [items, uploadTracker, currentFolderId]);

  const toggleSelection = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.shiftKey && lastSelectedIdRef.current) {
      const allItems = [...folders, ...files];
      const startIdx = allItems.findIndex(i => i.id === lastSelectedIdRef.current);
      const endIdx = allItems.findIndex(i => i.id === id);
      if (startIdx !== -1 && endIdx !== -1) {
        const start = Math.min(startIdx, endIdx);
        const end = Math.max(startIdx, endIdx);
        startTransition(() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              next.add(allItems[i].id);
            }
            return next;
          });
        });
        lastSelectedIdRef.current = id;
        return;
      }
    }
    
    startTransition(() => {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          lastSelectedIdRef.current = id;
        }
        return next;
      });
    });
  }, [folders, files]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: DriveFile) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedIdsRef.current.size > 0 || (touchTimerRef.current && !document.hidden)) {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current); // Ensure no re-trigger
      toggleSelection(e as unknown as React.MouseEvent, item.id);
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, [toggleSelection]);

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTouchStart = useCallback((id: string) => {
    touchTimerRef.current = setTimeout(() => {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }
      touchTimerRef.current = null;
    }, 600);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const handleItemClick = useCallback((e: React.MouseEvent, id: string, name: string, isFolder: boolean, file: DriveFile) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelection(e, id);
    } else {
      setSelectedIds(new Set([id]));
      lastSelectedIdRef.current = id;
    }
  }, [toggleSelection]);

  const handleItemDoubleClick = useCallback((e: React.MouseEvent, id: string, name: string, isFolder: boolean, file: DriveFile) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder) {
      handleNavigate(id, name);
    } else {
      onOpenFile(file);
    }
  }, [onOpenFile]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-color)] overflow-hidden relative">
      {/* Operation Progress overlay */}
      {opProgress && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface-color)] border border-[var(--border-color)] text-[var(--text-color)] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-5">
           <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0"></div>
           <div className="flex flex-col min-w-[150px]">
             <span className="text-sm font-medium">{opProgress.text}</span>
             <div className="h-1.5 w-full bg-[var(--bg-color)] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(opProgress.progress / opProgress.total) * 100}%` }}></div>
             </div>
           </div>
           <span className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
             {opProgress.progress} / {opProgress.total}
           </span>
        </div>
      )}

      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-color)]/30 shrink-0">
        <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar pr-4 pb-1">
          <div className="flex bg-[var(--surface-color)] p-1 rounded-xl shadow-sm border border-[var(--border-color)]/50 shrink-0 text-sm font-medium">
             <button onClick={() => setActiveTab("explorer")} className={`px-4 py-1.5 rounded-lg transition-colors ${activeTab === "explorer" ? "bg-[var(--bg-color)] text-[var(--text-color)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"}`}>Explorer</button>
             <button onClick={() => setActiveTab("favorites")} className={`px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${activeTab === "favorites" ? "bg-[var(--bg-color)] text-[var(--text-color)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"}`}><Star className="w-4 h-4" /> Favorites</button>
          </div>

          {activeTab === "explorer" && (
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />}
                  <button
                    onClick={() => handleBreadcrumb(idx)}
                    className={`hover:text-primary transition-colors whitespace-nowrap px-2 py-1 rounded-md ${
                      idx === breadcrumbs.length - 1 
                        ? "text-[var(--text-color)] bg-[var(--surface-color)] shadow-sm pointer-events-none" 
                        : "hover:bg-[var(--surface-color)]/50"
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {activeTab === "explorer" && (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCreateFolder} 
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-color)] text-[var(--text-color)] text-sm font-medium rounded-lg border border-[var(--border-color)]/50 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Folder</span>
              </button>
              <button 
                onClick={handleCreateFile} 
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-color)] text-[var(--text-color)] text-sm font-medium rounded-lg border border-[var(--border-color)]/50 shadow-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
               title="New File"
              >
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline">File</span>
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-1 bg-[var(--surface-color)] p-1 rounded-xl shadow-sm border border-[var(--border-color)]/50 shrink-0">
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-[var(--bg-color)] text-primary shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"}`} title="Grid View"><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-[var(--bg-color)] text-primary shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"}`} title="List View"><AlignJustify className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("compact")} className={`p-1.5 rounded-lg transition-colors ${viewMode === "compact" ? "bg-[var(--bg-color)] text-primary shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-color)]"}`} title="Compact View"><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-800 rounded-full animate-spin mb-4" />
          <div className="text-[var(--text-secondary)] text-sm animate-pulse">Loading View...</div>
          <button onClick={() => setLoading(false)} className="mt-6 px-4 py-2 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-black/5 transition-colors">Force Continue (If stuck)</button>
        </div>
      ) : (
        <div 
          className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar pb-24 relative"
          ref={scrollContainerRef}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={handleContainerPointerUp}
          onPointerCancel={handleContainerPointerUp}
        >
          {/* Drag Selection Box layer */}
          {selectionBox && (
            <div
              className="absolute border border-primary/50 bg-primary/10 pointer-events-none z-50 rounded-sm"
              style={{
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY)
              }}
            />
          )}

          {folders.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4 ml-1">Folders</h3>
              <div className={`grid gap-4 ${
                viewMode === "grid" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" :
                viewMode === "list" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" :
                "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
              }`}>
                {folders.map((f, i) => {
                  return (
                    <FolderCard 
                      key={f.id}
                      f={f}
                      index={i}
                      isSelected={selectedIds.has(f.id)}
                      showCheckboxes={selectedIds.size > 0}
                      viewMode={viewMode}
                      onClick={handleItemClick}
                      onDoubleClick={handleItemDoubleClick}
                      onContextMenu={handleContextMenu}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      onToggleSelection={toggleSelection}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4 ml-1">Manuscripts & Notes</h3>
              <div className={`grid gap-6 ${
                viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" :
                viewMode === "list" ? "grid-cols-1 lg:grid-cols-2" :
                "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              }`}>
                {files.map((f, i) => {
                  return (
                    <FileCard 
                      key={f.id}
                      f={f}
                      index={i}
                      snippet={snippets[f.id]}
                      isSelected={selectedIds.has(f.id)}
                      showCheckboxes={selectedIds.size > 0}
                      viewMode={viewMode}
                      onClick={handleItemClick}
                      onDoubleClick={handleItemDoubleClick}
                      onContextMenu={handleContextMenu}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      onToggleSelection={toggleSelection}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {folders.length === 0 && files.length === 0 && !loading && (
             <div className="flex flex-col items-center justify-center py-24 text-[var(--text-secondary)] text-center">
               <div className="w-16 h-16 bg-[var(--surface-color)] rounded-2xl flex items-center justify-center mb-6 border border-[var(--border-color)]/50 shadow-inner">
                 {activeTab === "favorites" ? (
                   <Star className="w-8 h-8 opacity-40" />
                 ) : (
                   <Folder className="w-8 h-8 opacity-40" />
                 )}
               </div>
               <h3 className="text-lg font-bold text-[var(--text-color)] mb-2">
                 {activeTab === "favorites" ? "No Favorites" : "Empty Vault"}
               </h3>
               <p className="opacity-70 max-w-xs text-sm">
                 {activeTab === "favorites" 
                   ? "Star your most important files to see them here."
                   : "Drop files here or use the sidebar to start building your manuscript."}
               </p>
             </div>
          )}
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar 
        selectedIds={selectedIds}
        items={items}
        currentFolderId={currentFolderId}
        runBatchedOperation={runBatchedOperation}
        setItems={setItems}
        setSelectedIds={setSelectedIds}
        setShowFolderPicker={setShowFolderPicker}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onNavigate={handleNavigate}
          onOpenFile={onOpenFile}
          onToggleStar={onToggleStar}
          onMove={(item) => {
             setSelectedIds(new Set([item.id]));
             setShowFolderPicker(true);
          }}
          onRename={onRename}
          onDuplicate={async (item) => {
             const res = await duplicateFile(item.id, item.name, false);
             setItems(prev => [...prev, res]);
          }}
          onDelete={onDelete}
        />
      )}
      {/* Context Menu ends here */}
      
      {showFolderPicker && (
        <FolderPicker 
          onClose={() => setShowFolderPicker(false)}
          excludeIds={selectedIds}
          onSelect={async (destFolderId) => {
            setShowFolderPicker(false);
            if (activeTab === "favorites") {
               customAlert("Cannot move from favorites view. Go to folders first.");
               return;
            }
            const selectedItems = items.filter(i => selectedIds.has(i.id));
            await runBatchedOperation(
              `Moving ${selectedItems.length} items...`,
              selectedItems,
              async (item) => { await moveFile(item.id, destFolderId, currentFolderId); },
              () => setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
            );
          }}
        />
      )}
    </div>
  );
}
