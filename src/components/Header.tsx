import React from "react";
import {
  BookOpen,
  Search,
  Sun,
  Moon,
  UploadCloud,
  FolderUp,
  Menu,
} from "lucide-react";
import { logout } from "../lib/drive";
import { customConfirm } from "../lib/dialogs";

interface HeaderProps {
  onSearch: (q: string) => void;
  onUploadSelect: (mode: "files" | "folder") => void;
  onToggleSidebar: () => void;
  userAvatar?: string | null;
}

export default function Header({
  onSearch,
  onUploadSelect,
  onToggleSidebar,
  userAvatar,
}: HeaderProps) {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const newDark = !dark;
    document.documentElement.classList.toggle("dark", newDark);
    setDark(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface-color)]/80 backdrop-blur-md border-b border-[var(--border-color)] px-4 md:px-6 h-16 flex items-center justify-between shrink-0 transition-colors duration-300">
      <div className="flex items-center gap-2">
        <button
          className="md:hidden p-2 -ml-2 text-[var(--text-secondary)] hover:bg-[var(--surface-dim-color)] rounded-full transition"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-xl tracking-tight text-primary hidden sm:block">
            NovelShelf
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-sm sm:max-w-md mx-2 sm:mx-4 md:mx-12 relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-[var(--text-secondary)]">
          <Search className="w-4 h-4" />
        </span>
        <input
          id="global-search-input"
          type="text"
          placeholder="Search..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-[var(--surface-dim-color)] border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all placeholder:text-[var(--text-secondary)] text-[var(--text-color)]"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onUploadSelect("files")}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
          title="Upload Files"
        >
          <UploadCloud className="w-4 h-4" />
          <span className="hidden sm:block">Upload</span>
        </button>
        <button
          onClick={() => onUploadSelect("folder")}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[var(--surface-dim-color)] text-[var(--text-color)] rounded-lg text-sm font-medium hover:bg-[var(--border-color)] transition-colors"
          title="Upload Folder"
        >
          <FolderUp className="w-4 h-4 shrink-0" />
          <span className="hidden sm:block">Folder</span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-dim-color)] rounded-full transition-colors"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={async () => {
              if (await customConfirm("Are you sure you want to log out?")) {
                logout();
              }
            }}
            title="Log out"
            className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 transition"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="User"
                className="w-full h-full rounded-full"
              />
            ) : (
              "ME"
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
