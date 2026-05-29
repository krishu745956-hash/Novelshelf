import React, { useState, useEffect, useRef } from "react";
import { Search, FileText, ChevronRight, X } from "lucide-react";
import { searchFiles, DriveFile, getFileContent } from "../lib/drive";

interface GlobalSearchProps {
  query: string;
  onClose: () => void;
  onSelect: (file: DriveFile, snippet?: string) => void;
  rootId: string;
}

interface SearchResult {
  file: DriveFile;
  snippet?: string;
  loadingContent?: boolean;
}

export function GlobalSearch({ query, onClose, onSelect, rootId }: GlobalSearchProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
       setResults([]);
       return;
    }

    let unmounted = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const foundFiles = await searchFiles(rootId, query);
        if (unmounted) return;

        // Initialize results without snippets
        let baseResults = foundFiles.map(f => ({ file: f, loadingContent: !f.mimeType.includes('folder') }));
        setResults(baseResults);
        setLoading(false);

        // Fetch snippets sequentially or in small batches
        for (let i = 0; i < baseResults.length; i++) {
           if (unmounted) return;
           const bResult = baseResults[i];
           if (bResult.file.mimeType.includes("folder")) continue;

           try {
             const text = await getFileContent(bResult.file.id);
             if (unmounted) return;

             // basic snippet extraction
             const qLower = query.toLowerCase();
             const tLower = text.toLowerCase();
             const index = tLower.indexOf(qLower);
             
             let snippet = "";
             if (index !== -1) {
                const start = Math.max(0, index - 40);
                const end = Math.min(text.length, index + query.length + 40);
                snippet = (start > 0 ? "..." : "") + text.substring(start, end).replace(/\n/g, ' ') + (end < text.length ? "..." : "");
             }

             setResults(prev => prev.map(p => p.file.id === bResult.file.id ? { ...p, snippet, loadingContent: false } : p));
             
           } catch {
             setResults(prev => prev.map(p => p.file.id === bResult.file.id ? { ...p, loadingContent: false } : p));
           }
        }

      } catch (err) {
        console.error(err);
        if (!unmounted) setLoading(false);
      }
    }, 400);

    return () => {
      unmounted = true;
      clearTimeout(timer);
    };
  }, [query, rootId]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!query) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center pt-20 px-4 bg-black/20 backdrop-blur-sm">
      <div 
        ref={containerRef}
        className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--surface-color)] border border-[var(--border-color)] shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--surface-dim-color)]">
           <span className="text-sm font-semibold text-[var(--text-color)] flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Global Search
           </span>
           <button onClick={onClose} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-md">
             <X className="w-4 h-4" />
           </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
           {loading && results.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-secondary)] flex flex-col items-center">
                 <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3"></div>
                 Searching files and contents...
              </div>
           ) : results.length === 0 && !loading ? (
              <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
                 No results found for "{query}"
              </div>
           ) : (
              <div className="flex flex-col gap-1">
                 {results.map((r, i) => (
                    <button
                       key={r.file.id + i}
                       onClick={() => onSelect(r.file, r.snippet)}
                       className="flex flex-col text-left px-3 py-2 hover:bg-primary/5 rounded-xl transition-colors cursor-pointer group"
                    >
                       <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-primary opacity-70 group-hover:opacity-100" />
                          <span className="font-semibold text-sm text-[var(--text-color)]">{r.file.name}</span>
                          <span className="text-xs text-[var(--text-secondary)] ml-auto truncate opacity-50">
                             {r.file.parents?.[0] ? 'Novel' : ''}
                          </span>
                       </div>
                       {r.loadingContent ? (
                         <div className="h-3 w-1/2 bg-[var(--border-color)]/30 rounded animate-pulse mt-1 ml-6"></div>
                       ) : r.snippet ? (
                         <div className="text-xs text-[var(--text-secondary)] pl-6 pr-2 leading-relaxed">
                            {/* Simple text highlighting */}
                            {r.snippet.split(new RegExp(`(${query})`, 'gi')).map((part, index) => 
                               part.toLowerCase() === query.toLowerCase() ? (
                                  <mark key={index} className="bg-primary/20 text-primary px-0.5 rounded font-medium">{part}</mark>
                               ) : (
                                  <span key={index}>{part}</span>
                               )
                            )}
                         </div>
                       ) : null}
                    </button>
                 ))}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
