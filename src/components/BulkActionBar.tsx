import React from "react";
import { Folder, Star, Trash2, Download, Copy, MoveRight } from "lucide-react";
import { customConfirm, customPrompt, customAlert } from "../lib/dialogs";
import { DriveFile, createFolder, moveFile, deleteFile, toggleFavorite, duplicateFile, downloadMultipleFiles } from "../lib/drive";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  items: DriveFile[];
  currentFolderId: string;
  runBatchedOperation: <T>(text: string, items: DriveFile[], action: (i: DriveFile) => Promise<T>, optimistic?: (res?: T[]) => void) => Promise<T[]>;
  setItems: React.Dispatch<React.SetStateAction<DriveFile[]>>;
  setSelectedIds: (ids: Set<string>) => void;
  setShowFolderPicker: (show: boolean) => void;
}

export function BulkActionBar({
  selectedIds, items, currentFolderId, runBatchedOperation, setItems, setSelectedIds, setShowFolderPicker
}: BulkActionBarProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[var(--surface-color)] border border-[var(--border-color)]/60 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-2 animate-in slide-in-from-bottom-5 w-max max-w-[90vw] overflow-x-auto custom-scrollbar">
      <span className="text-sm font-medium text-[var(--text-color)] px-2 whitespace-nowrap">
        {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
      </span>
      <div className="w-px h-6 bg-[var(--border-color)] shrink-0 mx-2" />
      
      <button
        onClick={async () => {
          const selectedItems = items.filter(i => selectedIds.has(i.id));
          await runBatchedOperation(
            `Favoriting ${selectedItems.length} items...`,
            selectedItems,
            async (item) => { await toggleFavorite(item.id, true); }
          );
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-amber-500 transition-colors rounded-lg hover:bg-amber-500/10 whitespace-nowrap"
      >
        <Star className="w-4 h-4" /> Favorite
      </button>
      
      <button
        onClick={async () => {
          const selectedItems = items.filter(i => selectedIds.has(i.id));
          await downloadMultipleFiles(selectedItems, "NovelShelf_Export");
          setSelectedIds(new Set());
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-primary transition-colors rounded-lg hover:bg-[var(--bg-color)] whitespace-nowrap"
      >
        <Download className="w-4 h-4" /> Download
      </button>

      <button
        onClick={async () => {
          const selectedItems = items.filter(i => selectedIds.has(i.id) && !i.mimeType.includes("folder"));
          await runBatchedOperation(
            `Duplicating ${selectedItems.length} items...`,
            selectedItems,
            async (item) => { return await duplicateFile(item.id, item.name, false); },
            (results) => { if (results && results.length > 0) setItems(prev => [...prev, ...results]); }
          );
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-primary transition-colors rounded-lg hover:bg-[var(--bg-color)] whitespace-nowrap"
      >
        <Copy className="w-4 h-4" /> Duplicate
      </button>

      <button
        onClick={() => setShowFolderPicker(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-primary transition-colors rounded-lg hover:bg-[var(--bg-color)] whitespace-nowrap"
      >
        <MoveRight className="w-4 h-4" /> Move
      </button>

      {Array.from(selectedIds).every(id => !items.find(i => i.id === id)?.mimeType.includes("folder")) && (
        <button
          onClick={async () => {
            const folderName = await customPrompt("Enter new folder name to group items:");
            if (!folderName) return;
            try {
              const importedFolderId = await createFolder(folderName, currentFolderId);
              const selectedItems = items.filter(i => selectedIds.has(i.id));
              const newFolder: DriveFile = {
                id: importedFolderId,
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
                size: "0",
                parents: [currentFolderId],
                createdTime: new Date().toISOString(),
                modifiedTime: new Date().toISOString(),
                starred: false,
                trashed: false
              };
              await runBatchedOperation(
                `Moving ${selectedItems.length} items to new folder...`,
                selectedItems,
                async (item) => { await moveFile(item.id, importedFolderId, currentFolderId); },
                () => setItems(prev => [...prev.filter(i => !selectedIds.has(i.id)), newFolder])
              );
            } catch(e) {
              console.error(e);
              customAlert("Failed to create folder");
            }
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-primary transition-colors rounded-lg hover:bg-[var(--bg-color)] whitespace-nowrap"
        >
          <Folder className="w-4 h-4" /> Create Folder
        </button>
      )}

      <button
        onClick={async () => {
          if (await customConfirm(`Delete ${selectedIds.size} items?`)) {
            const selectedItems = items.filter(i => selectedIds.has(i.id));
            await runBatchedOperation(
              `Deleting ${selectedItems.length} items...`,
              selectedItems,
              async (item) => { await deleteFile(item.id); },
              () => setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
            );
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap"
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
      
      <div className="w-px h-6 bg-[var(--border-color)] shrink-0 mx-2" />
      
      <button
        onClick={() => setSelectedIds(new Set())}
        className="text-xs font-medium px-3 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors whitespace-nowrap"
      >
        Cancel
      </button>
    </div>
  );
}
