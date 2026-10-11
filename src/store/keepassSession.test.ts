import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { isAutoLockDue, useKeePassSession } from './keepassSession';
import type { VaultInfo } from '../generated/ts-rs/VaultInfo';

const vault: VaultInfo = {
  id: 'vault-1',
  name: 'work',
  path: '/tmp/work.kdbx',
  entryCount: 0,
  groupCount: 1,
  usesKeyfile: false,
};

describe('isAutoLockDue', () => {
  const minute = 60_000;

  it('is false before the timeout and true at it', () => {
    expect(isAutoLockDue(0, 5 * minute - 1, 5)).toBe(false);
    expect(isAutoLockDue(0, 5 * minute, 5)).toBe(true);
  });

  it('never fires when the timeout is 0 (never)', () => {
    expect(isAutoLockDue(0, 10_000 * minute, 0)).toBe(false);
  });
});

describe('useKeePassSession', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useKeePassSession.setState({ vault: null, lastActivity: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lock() clears the vault and closes it on the backend', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    useKeePassSession.getState().setVault(vault);

    await useKeePassSession.getState().lock();

    expect(useKeePassSession.getState().vault).toBeNull();
    expect(invoke).toHaveBeenCalledWith('keepass_close', { vaultId: 'vault-1' });
  });

  it('lock() without an open vault does nothing', async () => {
    await useKeePassSession.getState().lock();

    expect(invoke).not.toHaveBeenCalled();
  });

  it('lock() still hides the vault when the backend call fails', async () => {
    vi.mocked(invoke).mockRejectedValue('boom');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    useKeePassSession.getState().setVault(vault);

    await expect(useKeePassSession.getState().lock()).resolves.toBeUndefined();

    expect(useKeePassSession.getState().vault).toBeNull();
    consoleError.mockRestore();
  });

  it('touch() ignores bursts of events and records the first one after a pause', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    useKeePassSession.setState({ lastActivity: Date.now() - 10_000 });

    useKeePassSession.getState().touch();
    const first = useKeePassSession.getState().lastActivity;
    expect(first).toBe(Date.now());

    vi.setSystemTime(new Date(Date.now() + 500));
    useKeePassSession.getState().touch();
    expect(useKeePassSession.getState().lastActivity).toBe(first);

    vi.setSystemTime(new Date(Date.now() + 2_000));
    useKeePassSession.getState().touch();
    expect(useKeePassSession.getState().lastActivity).toBe(Date.now());
  });

  it('setAutoLockMinutes() persists the choice', () => {
    useKeePassSession.getState().setAutoLockMinutes(15);

    expect(useKeePassSession.getState().autoLockMinutes).toBe(15);
    expect(localStorage.getItem('keepass.autoLockMinutes')).toBe('15');
  });
});
