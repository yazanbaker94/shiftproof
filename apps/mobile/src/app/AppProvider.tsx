import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DraftEntry, DemoNetworkMode, TimeEntry } from '../domain/types';
import { resetDemoDatabase } from '../data/database';
import {
  confirmEntryAndEnqueue,
  getEntry,
  listEntries,
  saveEntryAndEnqueue,
} from '../data/repository';
import { reconcileTimesheet, syncPendingOperations, type SyncSummary } from '../data/sync';
import { logger } from '../observability/logger';

interface AppContextValue {
  entries: TimeEntry[];
  hydrated: boolean;
  demoNetworkMode: DemoNetworkMode;
  setDemoNetworkMode: (mode: DemoNetworkMode) => void;
  isOnline: boolean;
  actualNetworkReachable: boolean | null;
  isSyncing: boolean;
  lastSyncSummary: SyncSummary | null;
  saveEntry: (draft: DraftEntry) => Promise<TimeEntry>;
  confirmEntry: (entryId: string, note: string) => Promise<void>;
  findEntry: (entryId: string) => TimeEntry | undefined;
  refresh: () => Promise<void>;
  syncNow: () => Promise<SyncSummary>;
  resetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || undefined;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [demoNetworkMode, setDemoNetworkModeState] = useState<DemoNetworkMode>('online');
  const [actualNetworkReachable, setActualNetworkReachable] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<SyncSummary | null>(null);

  const refresh = useCallback(async () => {
    setEntries(await listEntries(db));
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

  const isOnline = demoNetworkMode === 'online';

  const syncNow = useCallback(async (): Promise<SyncSummary> => {
    if (demoNetworkMode === 'offline') {
      const skipped = { attempted: 0, succeeded: 0, failed: 0 };
      setLastSyncSummary(skipped);
      return skipped;
    }
    setIsSyncing(true);
    try {
      const summary = await syncPendingOperations(db, apiUrl);
      await reconcileTimesheet(db, apiUrl);
      await refresh();
      setLastSyncSummary(summary);
      return summary;
    } finally {
      setIsSyncing(false);
    }
  }, [db, demoNetworkMode, refresh]);

  useEffect(() => {
    if (!hydrated || demoNetworkMode !== 'online') return;
    void syncNow();
  }, [demoNetworkMode, hydrated, syncNow]);

  const setDemoNetworkMode = useCallback((mode: DemoNetworkMode) => {
    setDemoNetworkModeState(mode);
    logger.info('demo_network_changed', { mode });
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
    if (demoNetworkMode === 'online') void syncNow();
    return result.entry;
  }, [db, demoNetworkMode, refresh, syncNow]);

  const confirmEntry = useCallback(async (entryId: string, note: string): Promise<void> => {
    await confirmEntryAndEnqueue(db, entryId, note, Crypto.randomUUID());
    await refresh();
    if (demoNetworkMode === 'online') await syncNow();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [db, demoNetworkMode, refresh, syncNow]);

  const resetDemo = useCallback(async () => {
    await resetDemoDatabase(db);
    await refresh();
    setLastSyncSummary(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [db, refresh]);

  const value = useMemo<AppContextValue>(() => ({
    entries,
    hydrated,
    demoNetworkMode,
    setDemoNetworkMode,
    isOnline,
    actualNetworkReachable,
    isSyncing,
    lastSyncSummary,
    saveEntry,
    confirmEntry,
    findEntry: (entryId: string) => entries.find((entry) => entry.id === entryId),
    refresh,
    syncNow,
    resetDemo,
  }), [
    actualNetworkReachable,
    confirmEntry,
    demoNetworkMode,
    entries,
    hydrated,
    isOnline,
    isSyncing,
    lastSyncSummary,
    refresh,
    resetDemo,
    saveEntry,
    setDemoNetworkMode,
    syncNow,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
