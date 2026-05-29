import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bg-color)]">
          <div className="bg-[var(--surface-color)] p-8 rounded-2xl border border-[var(--border-color)]/60 max-w-md w-full text-center shadow-xl">
             <h2 className="text-xl font-bold mb-4 text-[var(--text-color)]">Workspace Error</h2>
             <p className="text-[var(--text-secondary)] text-sm mb-6">The workspace encountered a rendering error. This can happen during complex operations. Your files are safe.</p>
             <button onClick={() => window.location.reload()} className="px-6 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium rounded-lg hover:bg-amber-500/20 transition-colors">Reload Dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
