import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { useKeePassAutoLock } from './useKeePassAutoLock';
import { useKeePassSession } from '../../store/keepassSession';
import type { VaultInfo } from '../../generated/ts-rs/VaultInfo';

const vault: VaultInfo = {
  id: 'vault-1',
  name: 'work',
  path: '/tmp/work.kdbx',
  entryCount: 0,
  groupCount: 1,
  usesKeyfile: false,
};

const MINUTE = 60_000;

describe('useKeePassAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(undefined);
    useKeePassSession.setState({ vault: null, lastActivity: Date.now(), autoLockMinutes: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks the vault after the inactivity timeout', async () => {
    renderHook(() => useKeePassAutoLock());
    useKeePassSession.getState().setVault(vault);

    await act(async () => {
      vi.advanceTimersByTime(MINUTE + 15_000);
    });

    expect(useKeePassSession.getState().vault).toBeNull();
    expect(invoke).toHaveBeenCalledWith('keepass_close', { vaultId: 'vault-1' });
  });

  it('keeps the vault open while there is activity', async () => {
    renderHook(() => useKeePassAutoLock());
    useKeePassSession.getState().setVault(vault);

    // Simulate the user moving the mouse every 30 seconds for 3 minutes.
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      window.dispatchEvent(new Event('mousemove'));
    }

    expect(useKeePassSession.getState().vault).not.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('never locks when auto-lock is set to never', async () => {
    useKeePassSession.setState({ autoLockMinutes: 0 });
    renderHook(() => useKeePassAutoLock());
    useKeePassSession.getState().setVault(vault);

    await act(async () => {
      vi.advanceTimersByTime(120 * MINUTE);
    });

    expect(useKeePassSession.getState().vault).not.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
