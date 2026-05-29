import React, { useState, useEffect } from 'react';

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogState {
  id: number;
  type: DialogType;
  title: string;
  message: string;
  defaultValue?: string;
  resolve: (value: any) => void;
}

let dialogId = 0;
let requestDialog: ((state: DialogState) => void) | null = null;

export const customAlert = (message: string, title = "Alert"): Promise<void> => {
  return new Promise((resolve) => {
    if (requestDialog) {
      requestDialog({ id: ++dialogId, type: 'alert', title, message, resolve });
    } else {
      console.warn("DialogProvider not mounted");
      resolve();
    }
  });
};

export const customConfirm = (message: string, title = "Confirm"): Promise<boolean> => {
  return new Promise((resolve) => {
    if (requestDialog) {
      requestDialog({ id: ++dialogId, type: 'confirm', title, message, resolve });
    } else {
      console.warn("DialogProvider not mounted");
      resolve(true); 
    }
  });
};

export const customPrompt = (message: string, defaultValue = "", title = "Prompt"): Promise<string | null> => {
  return new Promise((resolve) => {
    if (requestDialog) {
      requestDialog({ id: ++dialogId, type: 'prompt', title, message, defaultValue, resolve });
    } else {
      console.warn("DialogProvider not mounted");
      resolve(null);
    }
  });
};

export const DialogProvider = () => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    requestDialog = (state) => {
      setDialog(state);
      setInputValue(state.defaultValue || "");
    };
    return () => { requestDialog = null; };
  }, []);

  if (!dialog) return null;

  const close = (value: any) => {
    dialog.resolve(value);
    setDialog(null);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--surface-color)] p-6 rounded-2xl shadow-2xl border border-[var(--border-color)]/50 max-w-sm w-full animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-semibold text-[var(--text-color)] mb-2">{dialog.title}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{dialog.message}</p>
        
        {dialog.type === 'prompt' && (
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-lg px-3 py-2 text-sm text-[var(--text-color)] mb-6 outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') close(inputValue);
              if (e.key === 'Escape') close(null);
            }}
          />
        )}

        <div className="flex justify-end gap-3">
          {dialog.type !== 'alert' && (
            <button 
              onClick={() => close(dialog.type === 'prompt' ? null : false)}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)] rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={() => close(dialog.type === 'prompt' ? inputValue : dialog.type === 'confirm' ? true : undefined)}
            className="px-4 py-2 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors"
          >
            {dialog.type === 'alert' ? 'OK' : dialog.type === 'confirm' ? 'Confirm' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
