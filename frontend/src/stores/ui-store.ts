"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

type ToastKind = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  kind: ToastKind;
  message: ReactNode;
  detail?: ReactNode;
};

type UiStore = {
  toasts: ToastMessage[];
  pushToast: (input: Omit<ToastMessage, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now() + Math.random());
}

export const useUiStore = create<UiStore>((set) => ({
  toasts: [],
  pushToast: (input) => {
    const id = randomId();
    set((state) => ({
      toasts: [...state.toasts, { id, ...input }]
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
  clearToasts: () => set({ toasts: [] })
}));
