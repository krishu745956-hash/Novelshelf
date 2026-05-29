import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Settings,
  Type,
  Layout,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Moon,
  Sun,
} from "lucide-react";
import { getFileContent, DriveFile } from "../lib/drive";
import { cn } from "../lib/utils";

interface MarkdownReaderProps {
  file: DriveFile;
  onClose: () => void;
}

const scrollCache: Record<string, number> = {};

export function MarkdownReader({ file, onClose }: MarkdownReaderProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState<number>(18);
  const [readWidth, setReadWidth] = useState<
    "narrow" | "optimal" | "wide" | "full"
  >("optimal");
  const [readingTheme, setReadingTheme] = useState<
    "system" | "light" | "dark" | "sepia"
  >("system");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unmounted = false;
    setContent("");
    setLoading(true);
    setError(null);

    getFileContent(file.id)
      .then((text) => {
        if (!unmounted) {
          setContent(text);
          setLoading(false);
          // Restore scroll
          setTimeout(() => {
            if (scrollContainerRef.current) {
               scrollContainerRef.current.scrollTop = scrollCache[file.id] || 0;
            }
          }, 50);
        }
      })
      .catch((err) => {
        if (!unmounted) {
          console.error(err);
          setError("Failed to load file contents.");
          setLoading(false);
        }
      });

    return () => {
      unmounted = true;
    };
  }, [file.id]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    document.addEventListener("mousemove", handleMouseMove);
    timeout = setTimeout(() => setShowControls(false), 3000);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const themeClasses = {
    system: "bg-[var(--bg-color)] text-[var(--text-color)]",
    light: "bg-[#fdfdfc] text-[#1a1a1a]",
    dark: "bg-[#0f0f0f] text-[#ebebeb] dark",
    sepia: "bg-[#f4ecd8] text-[#433422]",
  };

  const widthClasses = {
    narrow: "max-w-2xl",
    optimal: "max-w-3xl",
    wide: "max-w-5xl",
    full: "max-w-full px-8",
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 h-full flex flex-col transition-colors duration-500 overflow-hidden relative",
        themeClasses[readingTheme],
      )}
    >
      {/* Header / Controls */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 p-4 pt-6 md:p-6 flex items-center justify-between transition-transform duration-500 z-10 bg-gradient-to-b from-black/40 xl:from-transparent to-transparent backdrop-blur-sm xl:backdrop-blur-none",
          showControls || !isFullscreen ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 dark:bg-black/20 hover:bg-white/20 dark:hover:bg-black/40 rounded-full backdrop-blur-md transition-all text-white xl:text-inherit xl:bg-[var(--surface-color)] xl:border xl:border-[var(--border-color)] xl:hover:bg-[var(--surface-color)]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-full px-2 py-1 xl:bg-[var(--surface-color)] xl:border xl:border-[var(--border-color)] text-white xl:text-[var(--text-color)]">
          <button
            onClick={() => setFontSize((s) => Math.max(12, s - 2))}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Decrease Font Size"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium">
            {fontSize}
          </span>
          <button
            onClick={() => setFontSize((s) => Math.min(32, s + 2))}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Increase Font Size"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <div className="flex gap-1">
            <button
              onClick={() => setReadingTheme("light")}
              className={cn(
                "w-6 h-6 rounded-full bg-[#fdfdfc] border border-black/10 flex items-center justify-center",
                readingTheme === "light" && "ring-2 ring-primary ring-offset-2",
              )}
              title="Light Theme"
            ></button>
            <button
              onClick={() => setReadingTheme("sepia")}
              className={cn(
                "w-6 h-6 rounded-full bg-[#f4ecd8] border border-black/10 flex items-center justify-center",
                readingTheme === "sepia" && "ring-2 ring-primary ring-offset-2",
              )}
              title="Sepia Theme"
            ></button>
            <button
              onClick={() => setReadingTheme("dark")}
              className={cn(
                "w-6 h-6 rounded-full bg-[#0f0f0f] border border-white/10 flex items-center justify-center",
                readingTheme === "dark" && "ring-2 ring-primary ring-offset-2",
              )}
              title="Dark Theme"
            ></button>
          </div>

          <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/20 rounded-full hidden sm:block transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="flex-1 overflow-y-auto scroll-smooth pt-24 pb-32 px-4 sm:px-8 custom-scrollbar"
        onScroll={(e) => {
          scrollCache[file.id] = (e.target as HTMLDivElement).scrollTop;
        }}
        ref={scrollContainerRef}
      >
        <div
          className={cn(
            "mx-auto transition-all duration-500",
            widthClasses[readWidth],
          )}
          ref={contentRef}
        >
          <div className="mb-16">
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 tracking-tight opacity-90">
              {file.name.replace(/\.md$/i, "")}
            </h1>
            <div className="flex items-center gap-4 text-sm opacity-60">
              {file.modifiedTime && (
                <span>
                  Updated {new Date(file.modifiedTime).toLocaleDateString()}
                </span>
              )}
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium text-xs">
                Read Only
              </span>
            </div>
            <div className="h-px border-b border-current opacity-10 mt-8" />
          </div>

          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-4 bg-current opacity-10 rounded w-3/4"></div>
              <div className="h-4 bg-current opacity-10 rounded w-full"></div>
              <div className="h-4 bg-current opacity-10 rounded w-5/6"></div>
              <div className="h-4 bg-current opacity-10 rounded w-full"></div>
              <div className="h-4 bg-current opacity-10 rounded w-2/3"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center">
              {error}
            </div>
          ) : (
            <div
              className={cn(
                "prose prose-lg max-w-none opacity-90 font-serif leading-relaxed transition-all",
                readingTheme === "dark"
                  ? "prose-invert"
                  : readingTheme === "system"
                    ? "dark:prose-invert"
                    : readingTheme === "sepia"
                      ? "prose-stone"
                      : "prose-neutral",
              )}
              style={{ fontSize: `${fontSize}px` }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Footer Progress (Optional) */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-1 bg-current opacity-20 transition-transform duration-500",
          !showControls && isFullscreen ? "translate-y-0" : "translate-y-full",
        )}
      />
    </div>
  );
}
