import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DraftEntry, DemoNetworkMode, TimeEntry } from '../domain/types';
import { resolveOnlineState } from '../domain/connectivity';
import { resetDemoDatabase } from '../data/database';
import {
  confirmEntryAndEnqueue,
  getSyncQueueSnapshot,
  getEntry,
  listEntries,
  saveEntryAndEnqueue,
} from '../data/repository';
import { reconcileTimesheet, syncPendingOperations, type SyncSummary } from '../data/sync';
import { AutomaticSyncCoordinator } from '../data/syncCoordinator';
import { logger } from '../observability/logger';

interface AppContextValue {
  entries: TimeEntry[];
  hydrated: boolean;
  demoNetworkMode: DemoNetworkMode;
  setDemoNetworkMode: (mode: DemoNetworkMode) => void;
  isOnline: boolean;
  connectionStatus: boolean | null;
  actualNetworkReachable: boolean | null;
  isSyncing: boolean;
  lastSyncSummary: SyncSummary | null;
  pendingOperationCount: number;
  saveEntry: (draft: DraftEntry) => Promise<TimeEntry>;
  confirmEntry: (entryId: string, note: string) => Promise<void>;
  findEntry: (entryId: string) => TimeEntry | undefined;
  refresh: () => Promise<void>;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [demoNetworkMode, setDemoNetworkModeState] = useState<DemoNetworkMode>('automatic');
  const [actualNetworkReachable, setActualNetworkReachable] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);
  const [pendingOperationCount, setPendingOperationCount] = useState(0);
  const [nextSyncWakeAtMs, setNextSyncWakeAtMs] = useState<number | null>(null);
  const syncCoordinator = useRef(new AutomaticSyncCoordinator()).current;
  const onlineRef = useRef(false);

  const refresh = useCallback(async () => {
    const [nextEntries, queue] = await Promise.all([listEntries(db), getSyncQueueSnapshot(db)]);
    setEntries(nextEntries);
    setPendingOperationCount(queue.pendingCount);
    setNextSyncWakeAtMs(queue.nextWakeAtMs);
  }, [db]);

  useEffect(() => {
    const startedAt = Date.now();
    refresh()
      .then(() => {
        setHydrated(true);
        logger.info('sqlite_hydrated', { durationMs: Date.now() - startedAt });
      })
      .catch((error) => logger.error('sqlite_hydration_failed', { message: String(error) }));
  }, [refresh]);

  useEffect(() => NetInfo.addEventListener((state) => {
    setActualNetworkReachable(state.isInternetReachable ?? state.isConnected ?? null);
  }), []);

  const isOnline = resolveOnlineState(demoNetworkMode, actualNetworkReachable);
  const connectionStatus = demoNetworkMode === 'offline' ? false : actualNetworkReachable;
  onlineRef.current = isOnline;

  const syncNow = useCallback(async (): Promise<SyncSummary> => {
    if (!isOnline) {
      const skipped = { attempted: 0, succeeded: 0, failed: 0 };
      setLastSyncSummary(skipped);
      return skipped;
    }
    const wasRunning = syncCoordinator.running;
    if (!wasRunning) setIsSyncing(true);
    try {
      const summary = await syncCoordinator.request(async () => {
        const pass = await syncPendingOperations(db, apiUrl);
        await reconcileTimesheet(db, apiUrl);
        await refresh();
        return pass;
      }, () => onlineRef.current);
      setLastSyncSummary(summary);
      return summary;
    } finally {
      if (!syncCoordinator.running) setIsSyncing(false);
    }
  }, [db, isOnline, refresh, syncCoordinator]);

  useEffect(() => {
    if (!hydrated || !isOnline) return;
    void syncNow().catch((error) => logger.error('automatic_sync_failed', { message: String(error) }));
  }, [hydrated, isOnline, syncNow]);

  useEffect(() => {
    if (!hydrated || !isOnline || nextSyncWakeAtMs === null) return;
    const timer = setTimeout(() => {
      void syncNow().catch((error) => logger.error('scheduled_sync_failed', { message: String(error) }));
    }, Math.max(25, nextSyncWakeAtMs - Date.now()));
    return () => clearTimeout(timer);
  }, [hydrated, isOnline, nextSyncWakeAtMs, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void NetInfo.fetch().then((network) => {
        const reachable = network.isInternetReachable ?? network.isConnected ?? null;
        setActualNetworkReachable(reachable);
        if (reachable === true && onlineRef.current) {
          void syncNow().catch((error) => logger.error('foreground_sync_failed', { message: String(error) }));
        }
      });
    });
    return () => subscription.remove();
  }, [syncNow]);

  const setDemoNetworkMode = useCallback((mode: DemoNetworkMode) => {
    setDemoNetworkModeState(mode);
    logger.info('network_simulation_changed', { mode });
    void Haptics.selectionAsync();
  }, []);

  const saveEntry = useCallback(async (draft: DraftEntry): Promise<TimeEntry> => {
    const operationId = Crypto.randomUUID();
    const result = await saveEntryAndEnqueue(db, draft, operationId);
    await refresh();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    logger.info('entry_saved_locally', {
      entryId: result.entry.id,
      key: result.operation.idempotencyKey,
      workDate: draft.workDate,
    });
    if (isOnline) {
      void syncNow().catch((error) => logger.error('automatic_sync_failed', { message: String(error) }));
    }
    return result.entry;
  }, [db, isOnline, refresh, syncNow]);

  const confirmEntry = useCallback(async (entryId: string, note: string): Promise<void> => {
    await confirmEntryAndEnqueue(db, entryId, note, Crypto.randomUUID());
    await refresh();
    if (isOnline) await syncNow();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [db, isOnline, refresh, syncNow]);

  const resetDemo = useCallback(async () => {
    await resetDemoDatabase(db);
    await refresh();
    setLastSyncSummary(null);
    setDemoNetworkModeState('automatic');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [db, refresh]);

  const value = useMemo<AppContextValue>(() => ({
    entries,
    hydrated,
    demoNetworkMode,
    setDemoNetworkMode,
    isOnline,
    connectionStatus,
    actualNetworkReachable,
    isSyncing,
    lastSyncSummary,
    pendingOperationCount,
    saveEntry,
    confirmEntry,
    findEntry: (entryId: string) => entries.find((entry) => entry.id === entryId),
    refresh,
    resetDemo,
  }), [
    actualNetworkReachable,
    confirmEntry,
    connectionStatus,
    demoNetworkMode,
    entries,
    hydrated,
    isOnline,
    isSyncing,
    lastSyncSummary,
    pendingOperationCount,
    refresh,
    resetDemo,
    saveEntry,
    setDemoNetworkMode,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
