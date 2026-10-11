import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { VaultInfo } from "../generated/ts-rs/VaultInfo";

/** Inactivity timeouts in minutes. 0 means the vault never locks by itself. */
export const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 0] as const;

const STORAGE_KEY = "keepass.autoLockMinutes";
const DEFAULT_AUTO_LOCK_MINUTES = 5;
/** Activity events closer together than this do not update the timestamp. */
const ACTIVITY_THROTTLE_MS = 1_000;

const readStoredMinutes = (): number => {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return (AUTO_LOCK_OPTIONS as readonly number[]).includes(stored)
    ? stored
    : DEFAULT_AUTO_LOCK_MINUTES;
};

export const isAutoLockDue = (lastActivity: number, now: number, minutes: number): boolean =>
  minutes > 0 && now - lastActivity >= minutes * 60_000;

interface KeePassSession {
  /** The vault that is open right now, or null when every vault is locked. */
  vault: VaultInfo | null;
  autoLockMinutes: number;
  lastActivity: number;
  setVault: (vault: VaultInfo) => void;
  setAutoLockMinutes: (minutes: number) => void;
  touch: () => void;
  /** Drops the vault from memory on the Rust side and clears it from the UI. */
  lock: () => Promise<void>;
}

export const useKeePassSession = create<KeePassSession>()((set, get) => ({
  vault: null,
  autoLockMinutes: readStoredMinutes(),
  lastActivity: Date.now(),

  setVault: (vault) => set({ vault, lastActivity: Date.now() }),

  setAutoLockMinutes: (minutes) => {
    localStorage.setItem(STORAGE_KEY, String(minutes));
    set({ autoLockMinutes: minutes });
  },

  touch: () => {
    const now = Date.now();
    if (now - get().lastActivity < ACTIVITY_THROTTLE_MS) return;
    set({ lastActivity: now });
  },

  lock: async () => {
    const vault = get().vault;
    if (!vault) return;
    // Hide the vault first so the UI cannot show it while the backend is closing it.
    set({ vault: null });
    try {
      await invoke("keepass_close", { vaultId: vault.id });
    } catch (e) {
      console.error("Failed to close KeePass vault", e);
    }
  },
}));
