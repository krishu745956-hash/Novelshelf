import { DriveFile, createFolder, uploadFile } from "./drive";

export interface UploadProgress {
  id: string;
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  fileSize: number;
  file?: DriveFile;
}

export type UploadTracker = Record<string, UploadProgress>;

async function traverseFileTree(item: any, path: string = ""): Promise<File[]> {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file: File) => {
        if (file.name !== ".DS_Store") {
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: path + file.name,
              writable: false
            });
          } catch(e) {
            (file as any)._relativePath = path + file.name;
          }
          resolve([file]);
        } else {
          resolve([]);
        }
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      let allEntries: any[] = [];
      const readAll = () => {
        dirReader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            let files: File[] = [];
            for (let i = 0; i < allEntries.length; i++) {
              const nestedFiles = await traverseFileTree(allEntries[i], path + item.name + "/");
              files = files.concat(nestedFiles);
            }
            resolve(files);
          } else {
            allEntries = allEntries.concat(entries);
            readAll();
          }
        });
      };
      readAll();
    } else {
      resolve([]);
    }
  });
}

export async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  let files: File[] = [];
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const entryFiles = await traverseFileTree(entry, "");
          files = files.concat(entryFiles);
        }
      }
    }
  } else {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      files.push(dataTransfer.files[i]);
    }
  }
  return files;
}

export async function uploadFilesWithHierarchy(
  files: File[],
  rootFolderId: string,
  onProgressUpdate: (tracker: UploadTracker) => void,
  onComplete?: () => void
) {
  let tracker: UploadTracker = {};
  const newFiles = [...files].filter(f => f.name !== ".DS_Store");
  
  newFiles.forEach((file, index) => {
    const internalId = `upload_${Date.now()}_${index}`;
    (file as any)._internalId = internalId;
    tracker[internalId] = {
      id: internalId,
      filename: (file as any)._relativePath || file.webkitRelativePath || file.name,
      progress: 0,
      status: "pending",
      fileSize: file.size
    };
  });
  
  onProgressUpdate({ ...tracker });

  const folderCache: Record<string, string | Promise<string>> = { "": rootFolderId };

  const getParentId = async (relativePath: string): Promise<string> => {
    if (!relativePath) return rootFolderId;
    
    const parts = relativePath.split("/");
    const dirs = parts.slice(0, -1);
    
    let currentPath = "";
    let currentParentId = rootFolderId;
    
    for (const dir of dirs) {
      currentPath = currentPath ? `${currentPath}/${dir}` : dir;
      if (folderCache[currentPath]) {
        currentParentId = await folderCache[currentPath];
      } else {
        folderCache[currentPath] = createFolder(dir, currentParentId).then(id => {
          folderCache[currentPath] = id;
          return id;
        });
        currentParentId = await folderCache[currentPath];
      }
    }
    
    return currentParentId;
  };

  const CONCURRENCY = 2;
  let activeUploads = 0;
  let currentIndex = 0;

  // Debounce the state update instead of triggering React re-renders on every byte
  let renderTimeout: ReturnType<typeof setTimeout> | null = null;
  const triggerRender = () => {
    if (!renderTimeout) {
      renderTimeout = setTimeout(() => {
        onProgressUpdate({ ...tracker });
        renderTimeout = null;
      }, 150); // max ~6-7 renders per second
    }
  };

  return new Promise<void>((resolve) => {
    const pump = async () => {
      if (currentIndex >= newFiles.length && activeUploads === 0) {
        if (onComplete) onComplete();
        resolve();
        return;
      }

      while (activeUploads < CONCURRENCY && currentIndex < newFiles.length) {
        const file = newFiles[currentIndex];
        const internalId = (file as any)._internalId as string;
        currentIndex++;
        activeUploads++;

        tracker[internalId].status = "uploading";
        triggerRender();

        (async () => {
          try {
            const relPath = (file as any)._relativePath || file.webkitRelativePath || file.name;
            const parentId = await getParentId(relPath);
            const uploaded = await uploadFile(file, parentId, (percent) => {
              if (tracker[internalId].progress !== percent) {
                tracker[internalId].progress = percent;
                triggerRender();
              }
            });
            
            tracker[internalId].progress = 100;
            tracker[internalId].status = "success";
            tracker[internalId].file = uploaded;
          } catch (err: any) {
            tracker[internalId].status = "error";
            tracker[internalId].error = err.message;
          } finally {
            triggerRender();
            activeUploads--;
            pump();
          }
        })();
      }
    };
    pump();
  });
}
