import { getSession, clearSession } from "./auth";

const API_BASE = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";

export function getAccessToken(): string | null {
  return getSession();
}

export function logout() {
  clearSession();
}
const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  thumbnailLink?: string;
  hasThumbnail?: boolean;
  starred?: boolean;
  trashed?: boolean;
}

class DriveApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function request(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<any> {
  const token = getAccessToken();
  if (!token)
    throw new Error("No access token available. Please sign in again.");

  const headers = new Headers(options.headers || {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return request(url, options, retries - 1);
      }
      logout();
      throw new Error("Session expired");
    }

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && retries > 0) {
        await new Promise((r) =>
          setTimeout(r, (4 - retries) * 1000 + Math.random() * 1000),
        );
        return request(url, options, retries - 1);
      }
      const errorData = await response.json().catch(() => ({}));
      throw new DriveApiError(
        errorData.error?.message ||
          `Request failed with status ${response.status}`,
      );
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (err: any) {
    if (err.message !== "Session expired" && retries > 0) {
      await new Promise((r) =>
        setTimeout(r, (4 - retries) * 1000 + Math.random() * 1000),
      );
      return request(url, options, retries - 1);
    }
    throw err;
  }
}

export async function findOrCreateMyNovelsFolder(): Promise<string> {
  const q = `mimeType='${FOLDER_MIME}' and name='MyNovels' and trashed=false`;
  const data = await request(
    `${API_BASE}?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id, name)`,
  );

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const createData = await request(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "MyNovels",
      mimeType: FOLDER_MIME,
    }),
  });

  return createData.id;
}

const locallyDeletedIds = new Set<string>();

export async function listFolderContents(
  folderId: string,
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  let url = `${API_BASE}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed)&orderBy=folder,name&pageSize=1000`;

  let allFiles: DriveFile[] = [];
  let currentUrl = url;

  while (true) {
    const data = await request(currentUrl);
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    if (data.nextPageToken) {
      currentUrl = `${url}&pageToken=${data.nextPageToken}`;
    } else {
      break;
    }
  }

  return allFiles.filter((f) => !locallyDeletedIds.has(f.id));
}

export async function calculateFolderSize(folderId: string): Promise<number> {
  let totalSize = 0;

  const q = `'${folderId}' in parents and trashed=false`;
  const url = `${API_BASE}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,mimeType,size)&pageSize=1000`;

  let allFiles: DriveFile[] = [];
  let currentUrl = url;

  while (true) {
    const data = await request(currentUrl);
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    if (data.nextPageToken) {
      currentUrl = `${url}&pageToken=${data.nextPageToken}`;
    } else {
      break;
    }
  }

  for (const file of allFiles) {
    if (locallyDeletedIds.has(file.id)) continue;
    if (file.mimeType === FOLDER_MIME) {
      totalSize += await calculateFolderSize(file.id);
    } else if (file.size) {
      totalSize += parseInt(file.size, 10);
    }
  }

  return totalSize;
}

export async function searchFiles(
  _folderId: string,
  searchTerm: string,
): Promise<DriveFile[]> {
  const escapedTerm = searchTerm.replace(/'/g, "\\'");
  const q = `trashed=false and (name contains '${escapedTerm}' or fullText contains '${escapedTerm}')`;
  const url = `${API_BASE}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed)&pageSize=1000`;

  let allFiles: DriveFile[] = [];
  let currentUrl = url;

  while (true) {
    const data = await request(currentUrl);
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    if (data.nextPageToken) {
      currentUrl = `${url}&pageToken=${data.nextPageToken}`;
    } else {
      break;
    }
  }
  return allFiles.filter((f) => !locallyDeletedIds.has(f.id));
}

export async function getUniqueName(name: string, isFolder: boolean, count = 0): Promise<string> {
  const isMd = name.toLowerCase().endsWith(".md");
  const baseName = isMd ? name.slice(0, -3) : name;
  const ext = isMd ? ".md" : "";
  const searchName = count === 0 ? name : `${baseName}${count}${ext}`;
  const mimeQuery = isFolder ? "mimeType = 'application/vnd.google-apps.folder'" : "mimeType != 'application/vnd.google-apps.folder'";
  
  const token = getAccessToken();
  if (!token) throw new Error("No access token");
  const q = `name='${searchName.replace(/'/g, "\\'")}' and trashed=false and ${mimeQuery}`;
  const url = `${API_BASE}?q=${encodeURIComponent(q)}&fields=files(id)`;
  
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return searchName; // Fallback
  const data = await res.json();
  
  if (data.files && data.files.length > 0) {
    return getUniqueName(name, isFolder, count === 0 ? 1 : count + 1);
  }
  return searchName;
}

export async function renameFile(
  fileId: string,
  newName: string,
): Promise<DriveFile> {
  const isFolderCheck = await request(`${API_BASE}/${fileId}?fields=mimeType`);
  const isFolder = isFolderCheck.mimeType === "application/vnd.google-apps.folder";
  const uniqueName = await getUniqueName(newName, isFolder);
  const data = await request(
    `${API_BASE}/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: uniqueName }),
    },
  );
  return data;
}

export async function moveFile(
  fileId: string,
  newParentId: string,
  oldParentId: string | null,
): Promise<DriveFile> {
  const removeQuery = oldParentId ? `&removeParents=${oldParentId}` : "";
  const data = await request(
    `${API_BASE}/${fileId}?addParents=${newParentId}${removeQuery}&fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  return data;
}

export async function toggleFavorite(
  fileId: string,
  starred: boolean,
): Promise<DriveFile> {
  const data = await request(
    `${API_BASE}/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    },
  );
  return data;
}

export async function getFavorites(): Promise<DriveFile[]> {
  const q = `appProperties has { key='isNovel' and value='true' } and starred=true and trashed=false`;
  // Since we might not have set appProperties, we can just search for starred=true and trashed=false inside the whole drive? No, we should restrict to inside MyNovels. That's hard without knowing MyNovels folder id. Let's just fetch starred=true.
  const url = `${API_BASE}?q=${encodeURIComponent("starred=true and trashed=false")}&fields=nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed)&pageSize=1000`;

  let allFiles: DriveFile[] = [];
  let currentUrl = url;

  while (true) {
    const data = await request(currentUrl);
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    if (data.nextPageToken) {
      currentUrl = `${url}&pageToken=${data.nextPageToken}`;
    } else {
      break;
    }
  }
  return allFiles.filter((f) => !locallyDeletedIds.has(f.id));
}

export async function getTrashed(): Promise<DriveFile[]> {
  const url = `${API_BASE}?q=${encodeURIComponent("trashed=true")}&fields=nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed)&pageSize=1000`;
  let allFiles: DriveFile[] = [];
  let currentUrl = url;

  while (true) {
    const data = await request(currentUrl);
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    if (data.nextPageToken) {
      currentUrl = `${url}&pageToken=${data.nextPageToken}`;
    } else {
      break;
    }
  }
  return allFiles;
}

export async function restoreFile(fileId: string): Promise<DriveFile> {
  const data = await request(
    `${API_BASE}/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: false }),
    },
  );
  locallyDeletedIds.delete(fileId);
  return data;
}

export async function permanentlyDelete(fileId: string): Promise<void> {
  await request(`${API_BASE}/${fileId}`, {
    method: "DELETE",
  });
}

export async function createEmptyMarkdownFile(
  name: string,
  parentId: string,
): Promise<DriveFile> {
  const finalName = name.toLowerCase().endsWith(".md") ? name : name + ".md";
  const uniqueName = await getUniqueName(finalName, false);
  const metadata = {
    name: uniqueName,
    parents: [parentId],
    mimeType: "text/markdown",
  };
  const token = getAccessToken();
  if (!token) throw new Error("No access token");

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", new Blob([""], { type: "text/markdown" }));

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open(
      "POST",
      `${UPLOAD_BASE}?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status === 401) {
        logout();
        reject(new Error("Session expired"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(
          new DriveApiError(`Failed to create empty file status ${xhr.status}`),
        );
      }
    };
    xhr.onerror = () => reject(new DriveApiError("Network error"));
    xhr.send(form);
  });
}

export async function createFolder(
  name: string,
  parentId: string,
): Promise<DriveFile> {
  const uniqueName = await getUniqueName(name, true);
  
  const createData = await request(`${API_BASE}?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: uniqueName,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
  return createData;
}

export async function duplicateFile(fileId: string, currentName: string, isFolder: boolean): Promise<DriveFile> {
  if (isFolder) throw new Error("Folder duplication not supported yet");
  const uniqueName = await getUniqueName(currentName + " copy", false);
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/${fileId}/copy?fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: uniqueName })
  });
  if (!res.ok) throw new Error("Failed to duplicate file");
  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const data = await request(`${API_BASE}/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  locallyDeletedIds.add(fileId);
  return data;
}

export async function uploadFile(
  file: File,
  parentId: string,
  onProgress?: (percent: number) => void,
  retries = 3,
): Promise<DriveFile> {
  const uniqueName = await getUniqueName(file.name, false);
  return new Promise((resolve, reject) => {
    const token = getAccessToken();
    if (!token) {
      reject(new Error("No access token"));
      return;
    }

    const metadata = {
      name: uniqueName,
      parents: [parentId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${UPLOAD_BASE}?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,parents,starred,trashed`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        if (retries > 0) {
          setTimeout(() => {
            uploadFile(file, parentId, onProgress, retries - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
          return;
        }
        logout();
        reject(new Error("Session expired"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        if ((xhr.status === 429 || xhr.status >= 500) && retries > 0) {
          setTimeout(
            () => {
              uploadFile(file, parentId, onProgress, retries - 1)
                .then(resolve)
                .catch(reject);
            },
            (4 - retries) * 1000 + Math.random() * 1000,
          );
          return;
        }
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new DriveApiError(errData.error?.message || "Upload failed"));
        } catch {
          reject(new DriveApiError(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      if (retries > 0) {
        setTimeout(
          () => {
            uploadFile(file, parentId, onProgress, retries - 1)
              .then(resolve)
              .catch(reject);
          },
          (4 - retries) * 1000 + Math.random() * 1000,
        );
        return;
      }
      reject(new DriveApiError("Network error during upload"));
    };
    xhr.send(form);
  });
}

import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function downloadFile(
  fileId: string,
  fileName?: string,
  retries = 1,
  isBlob = false,
): Promise<Blob | void> {
  const token = getAccessToken();
  if (!token) throw new Error("No access token");
  const res = await fetch(`${API_BASE}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return downloadFile(fileId, fileName, retries - 1, isBlob);
    }
    logout();
    throw new Error("Session expired");
  }
  if (!res.ok)
    throw new DriveApiError(`Download failed with status ${res.status}`);
  const blob = await res.blob();
  if (isBlob) return blob;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "download";
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadMultipleFiles(files: DriveFile[], zipName: string) {
  const zip = new JSZip();
  let fileCount = 0;
  for (const f of files) {
    if (f.mimeType.includes("folder")) continue;
    try {
      const blob = await downloadFile(f.id, f.name, 3, true) as Blob;
      zip.file(f.name, blob);
      fileCount++;
    } catch {}
  }
  if (fileCount === 0) return;
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName + ".zip";
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadFolder(
  folderId: string,
  folderName: string,
  onProgress?: (msg: string) => void,
) {
  const zip = new JSZip();

  async function addFolderToZip(
    currentFolderId: string,
    currentZipFolder: JSZip,
  ) {
    let pageToken = "";
    do {
      const token = getAccessToken();
      if (!token) throw new Error("No access token");
      const q = `'${currentFolderId}' in parents and trashed = false`;
      const url = new URL(API_BASE);
      url.searchParams.append("q", q);
      url.searchParams.append(
        "fields",
        "nextPageToken, files(id, name, mimeType)",
      );
      if (pageToken) url.searchParams.append("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new DriveApiError(`Failed to fetch folder contents`);
      const data = await res.json();

      for (const file of data.files) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          onProgress?.(`Exploring ${file.name}...`);
          const newZipFolder = currentZipFolder.folder(file.name);
          if (newZipFolder) {
            await addFolderToZip(file.id, newZipFolder);
          }
        } else {
          try {
            onProgress?.(`Downloading ${file.name}...`);
            const blob = (await downloadFile(
              file.id,
              file.name,
              1,
              true,
            )) as Blob;
            if (blob) {
              currentZipFolder.file(file.name, blob);
            }
          } catch (e) {
            console.error(`Failed to download ${file.name}`, e);
          }
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  onProgress?.("Preparing ZIP archive...");
  await addFolderToZip(folderId, zip);

  onProgress?.("Compressing archive...");
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${folderName}.zip`);
  onProgress?.("");
}

export async function getFileContent(
  fileId: string,
  retries = 1,
): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error("No access token");
  const res = await fetch(`${API_BASE}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return getFileContent(fileId, retries - 1);
    }
    logout();
    throw new Error("Session expired");
  }
  if (!res.ok)
    throw new DriveApiError(`Download failed with status ${res.status}`);
  return await res.text();
}
