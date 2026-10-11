import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from './store';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

describe('useStore', () => {
  beforeEach(() => {
    // The store is shared between tests, so favorites and tunnels start empty every time.
    useStore.setState({ favorites: [], tunnels: [] });
    // Reset store state before each test
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.handleServicesByServersByCompanyChange([]);
      result.current.handleConnectedServicesChange([]);
    });
    vi.clearAllMocks();
  });

  describe('Favorites', () => {
    it('should add service to favorites', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.toggleFavorite('service-123');
      });

      expect(result.current.favorites).toContain('service-123');
    });

    it('should remove service from favorites when toggled again', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.toggleFavorite('service-123');
        result.current.toggleFavorite('service-123');
      });

      expect(result.current.favorites).not.toContain('service-123');
    });
  });

  describe('Active Tab', () => {
    it('should change active tab', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.setActiveTab('servers');
      });

      expect(result.current.activeTab).toBe('servers');
    });
  });

  describe('Recent Connections', () => {
    it('should add recent connection', () => {
      const { result } = renderHook(() => useStore());
      const connection = {
        id: 'conn-1',
        name: 'Test Server',
        protocol: 'ssh' as const,
        timestamp: new Date().toISOString(),
        serverId: 'server-1',
        serviceId: 'service-1',
      };

      act(() => {
        result.current.addRecentConnection(connection);
      });

      expect(result.current.recentConnections).toHaveLength(1);
      expect(result.current.recentConnections[0]).toEqual(connection);
    });

    it('should limit recent connections to 10', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentConnection({
            id: `conn-${i}`,
            name: `Server ${i}`,
            protocol: 'ssh',
            timestamp: new Date().toISOString(),
            serverId: `server-${i}`,
            serviceId: `service-${i}`,
          });
        }
      });

      expect(result.current.recentConnections).toHaveLength(10);
    });
  });

  describe('Settings', () => {
    it('should update language setting', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.updateSettings({ language: 'ru' });
      });

      expect(result.current.settings.language).toBe('ru');
    });

    it('should persist language to localStorage', () => {
      const { result } = renderHook(() => useStore());
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        result.current.updateSettings({ language: 'ru' });
      });

      expect(setItemSpy).toHaveBeenCalledWith('language', 'ru');
    });
  });

  describe('Server Actions', () => {
    it('should call delete_server invoke', async () => {
      const { result } = renderHook(() => useStore());
      const mockInvoke = vi.mocked(invoke);

      await act(async () => {
        await result.current.deleteServer('server-123');
      });

      expect(mockInvoke).toHaveBeenCalledWith('delete_server', { serverId: 'server-123' });
    });

    it('should call update_server invoke', async () => {
      const { result } = renderHook(() => useStore());
      const mockInvoke = vi.mocked(invoke);

      await act(async () => {
        await result.current.updateServer('server-123', 'New Name', 'New Description');
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_server', {
        serverId: 'server-123',
        name: 'New Name',
        description: 'New Description',
      });
    });
  });

  describe('Tunnel Management', () => {
    beforeEach(() => {
      // With cloudflared present, starting a tunnel does not try to install it first.
      useStore.setState({ cloudflaredVersion: '2026.10.0' });
    });

    it('should start TCP tunnel', async () => {
      const { result } = renderHook(() => useStore());
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValueOnce({
        id: 'tunnel-1',
        hostname: 'example.com',
        localPort: 8080,
        pid: 12345,
      });

      await act(async () => {
        await result.current.startTcpTunnel('example.com', 8080);
      });

      expect(result.current.tunnels).toHaveLength(1);
      expect(result.current.tunnels[0].hostname).toBe('example.com');
    });

    it('should stop TCP tunnel', async () => {
      const { result } = renderHook(() => useStore());
      const mockInvoke = vi.mocked(invoke);
      
      // First add a tunnel
      mockInvoke.mockResolvedValueOnce({
        id: 'tunnel-1',
        hostname: 'example.com',
        localPort: 8080,
        pid: 12345,
      });

      await act(async () => {
        await result.current.startTcpTunnel('example.com', 8080);
      });

      // Then stop it
      await act(async () => {
        await result.current.stopTcpTunnel('tunnel-1');
      });

      expect(result.current.tunnels).toHaveLength(0);
    });
  });
});
