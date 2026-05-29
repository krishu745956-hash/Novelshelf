import React, { useEffect, useState, useRef } from "react";
import {
  DriveFile,
  findOrCreateMyNovelsFolder,
} from "./lib/drive";
import {
  uploadFilesWithHierarchy,
  getFilesFromDataTransfer,
  UploadTracker,
} from "./lib/upload-utils";
import {
  UploadCloud,
} from "lucide-react";

import LoginScreen from "./components/LoginScreen";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { UploadProgressCard } from "./components/UploadProgressCard";
import { MarkdownReader } from "./components/MarkdownReader";
import { GlobalSearch } from "./components/GlobalSearch";
import { VisualExplorer } from "./components/VisualExplorer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DialogProvider, customAlert } from "./lib/dialogs";
import { cn } from "./lib/utils";

interface Breadcrumb {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  photoURL?: string;
}

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [initError, setInitError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [rootId, setRootId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const [uploadTracker, setUploadTracker] = useState<UploadTracker>({});
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unmounted = false;
    import("./lib/auth").then(({ getSession }) => {
      if (unmounted) return;
      const session = getSession();
      if (session) {
        // Assume user
        setUser({ id: "user", email: "" } as typeof user);
        setNeedsAuth(false);
      } else {
        setNeedsAuth(true);
        setUser(null);
        setRootId(null);
        cacheRef.current = {};
        setRefreshKey((k) => k + 1);
        setUploadTracker({});
        setLoading(false);
      }
    });

    const handleSessionExpired = () => {
      setNeedsAuth(true);
      setUser(null);
      setRootId(null);
      setLoading(false);
    };
    window.addEventListener("novelshelf_session_expired", handleSessionExpired);

    return () => {
      unmounted = true;
      window.removeEventListener("novelshelf_session_expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (needsAuth || rootId || !user) return;

    let unmounted = false;
    (async () => {
      try {
        setLoading(true);
        const mainFolderId = await findOrCreateMyNovelsFolder();
        if (unmounted) return;
        setRootId(mainFolderId);
      } catch (e: any) {
        if (e.message?.includes("Session expired") || e.message?.includes("No access token")) {
          if (!unmounted) {
            setNeedsAuth(true);
            setUser(null);
            setRootId(null);
          }
        } else {
          console.error("Failed to init drive", e);
          if (!unmounted) {
            setInitError(e.message || "Unknown error connecting to Drive");
          }
        }
      } finally {
        if (!unmounted) setLoading(false);
      }
    })();
    return () => {
      unmounted = true;
    };
  }, [needsAuth, rootId, user]);

  const currentFolderId = rootId;

  // Clear selection on navigation or search change
  const cacheRef = useRef<Record<string, DriveFile[]>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input") as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }

      if (e.key === "Escape") {
        setPreviewFile(null);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // No longer fetch grid items automatically because the grid is removed.
  // Sidebar manages its own tree.

  const handleUploadSelect = (mode: "files" | "folder") => {
    if (mode === "files") fileInputRef.current?.click();
    else folderInputRef.current?.click();
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentFolderId) return;

    try {
      await uploadFilesWithHierarchy(
        Array.from(files),
        currentFolderId,
        (tracker) => setUploadTracker({ ...tracker }),
        () => {
          setRefreshKey((k) => k + 1);
          setTimeout(() => setUploadTracker({}), 7000);
        },
      );
    } catch (err: any) {
      if (err.message !== "Session expired") {
        console.error("Upload failed:", err);
        customAlert("Upload failed: " + (err.message || "Unknown error"));
      }
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!currentFolderId) return;

    try {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      if (files.length === 0) return;
      await uploadFilesWithHierarchy(
        files,
        currentFolderId,
        (tracker) => setUploadTracker({ ...tracker }),
        () => {
          setRefreshKey((k) => k + 1);
          setTimeout(() => setUploadTracker({}), 7000);
        },
      );
    } catch (err: any) {
      if (err.message !== "Session expired") {
        console.error("Upload failed:", err);
        customAlert("Upload failed: " + (err.message || "Unknown error"));
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-color)] overflow-hidden font-sans">
      {/* Hidden inputs */}
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={onFilesSelected}
        accept=".pdf,.epub,.txt,.docx,.md,application/pdf,application/epub+zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
      />
      <input
        type="file"
        multiple
        className="hidden"
        ref={folderInputRef}
        onChange={onFilesSelected}
        {...({ webkitdirectory: "true", directory: "" } as any)}
      />

      <Header
        onSearch={setSearchQuery}
        onUploadSelect={handleUploadSelect}
        onToggleSidebar={() => setSidebarOpen(true)}
        userAvatar={user?.photoURL}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          rootId={rootId}
          currentFolderId={currentFolderId || undefined}
          refreshKey={refreshKey}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
          onNavigateFileTree={(id, name, isFolder) => {
            if (isFolder) {
              // Clicking folder purely expands/collapses it inside FileExplorer now, 
              // we don't set breadcrumbs for the main view.
              // We maintain the file explorer internal state.
            } else {
              setPreviewFile({
                id,
                name,
                mimeType: "text/markdown",
                size: "0",
                parents: [],
                createdTime: "",
                trashed: false,
              } as DriveFile);
            }
          }}
        />

        {searchQuery && rootId && (
          <GlobalSearch
            rootId={rootId}
            query={searchQuery}
            onClose={() => setSearchQuery("")}
            onSelect={(file, snippet) => {
              setSearchQuery("");
              if (!file.mimeType.includes("folder")) {
                setPreviewFile(file);
              }
            }}
          />
        )}

        <main
          className="flex-1 flex flex-col min-w-0 bg-[var(--bg-color)] overflow-hidden relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-primary border-dashed m-4 rounded-xl flex items-center justify-center">
              <div className="bg-[var(--surface-color)] p-6 rounded-2xl shadow-xl flex flex-col items-center pointer-events-none">
                <UploadCloud className="w-12 h-12 text-primary mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-[var(--text-color)] mb-2">
                  Drop files to upload
                </h3>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
              <div className="text-[var(--text-secondary)] text-sm animate-pulse">Loading Workspace...</div>
              <button 
                onClick={() => setLoading(false)}
                className="mt-6 px-4 py-2 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Force Continue (If stuck)
              </button>
            </div>
          ) : needsAuth ? (
            <div className="flex-1 overflow-y-auto">
              <LoginScreen
                onLogin={(u) => {
                  setUser(u);
                  setNeedsAuth(false);
                }}
              />
            </div>
          ) : !rootId ? (
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <span className="text-red-500 font-bold text-2xl">!</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-color)]">Drive Connection Error</h3>
              {initError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 mb-6 text-left w-full text-[var(--text-color)]">
                  <p className="font-medium mb-2 text-red-500">
                    {initError.includes("Google Drive API has not been used") ? "Google Drive API is not enabled" : "Connection Error"}
                  </p>
                  <p className="text-sm mb-4">
                    {initError.includes("Google Drive API has not been used") 
                      ? "You need to enable the Google Drive API in your Google Cloud Console for the project you created the OAuth credentials in."
                      : initError}
                  </p>
                  {initError.includes("console.developers.google.com") && (
                    <a 
                      href={initError.match(/https:\/\/console\.developers\.google\.com[^\s]*/)?.[0] || "https://console.cloud.google.com/apis/library/drive.googleapis.com"} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-block px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                    >
                      Enable Google Drive API
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-[var(--text-secondary)] mb-6">
                  Successfully logged in, but failed to connect to Google Drive. Please ensure the Google Drive API is enabled in your Google Cloud Console for your project.
                </p>
              )}
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    import('./lib/auth').then(({ clearSession }) => {
                      clearSession();
                      window.location.reload();
                    });
                  }}
                  className="px-6 py-2 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-lg font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[var(--text-secondary)]"
                >
                  Logout
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Reload App
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Reading preview overlay */}
              {previewFile && (
                <div className="absolute inset-0 z-20 bg-[var(--bg-color)]">
                  <MarkdownReader
                    file={previewFile}
                    onClose={() => setPreviewFile(null)}
                  />
                </div>
              )}

              <div className={cn("flex-1 h-full flex overflow-hidden", previewFile ? "hidden" : "")}>
                <ErrorBoundary>
                  <VisualExplorer
                    rootId={rootId}
                    onOpenFile={setPreviewFile}
                    refreshKey={refreshKey}
                    onDataChanged={() => {}}
                    uploadTracker={uploadTracker}
                  />
                </ErrorBoundary>
              </div>
            </>
          )}
        </main>
      </div>

      {Object.keys(uploadTracker).length > 0 && (
        <UploadProgressCard tracker={uploadTracker} />
      )}
      <DialogProvider />
    </div>
  );
}
