import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DailyWishMessage, Owner, Task, Wish } from './types';
import {
  DEFAULT_PASSWORDS,
  LOCAL_KEYS,
  PasswordMap,
  SharedAppSnapshot,
  loadFromStorage,
  loadLocalBackup,
  loadLastLocalMutationAt,
  loadLocalSnapshot,
  markLocalMutationAt,
  normalizeSharedSnapshot,
  saveLocalSnapshot,
} from './app-persistence';
import { getOwnerByEmail, isSupabaseConfigured, ownerEmailMap, SUPABASE_STATE_ROW_ID, supabase } from './supabase';

type SyncStatus = 'idle' | 'syncing' | 'online' | 'error';
type StorageMode = 'local' | 'shared';

const READ_TIMEOUT_MS = 45000;
const WRITE_TIMEOUT_MS = 45000;
const REMOTE_REFRESH_INTERVAL_MS = 30000;

interface PairSettingsRow {
  pair_id: string;
  categories: string[] | null;
  wish_categories: string[] | null;
  custom_hadiths: string[] | null;
  updated_at?: string;
}

interface TaskRow {
  id: string;
  pair_id: string;
  title: string;
  description?: string;
  category: string;
  kind: Task['kind'];
  recurrence?: Task['recurrence'];
  repeat_days: number[];
  completion_dates: string[];
  status: Task['status'];
  due_date_time?: string;
  owner: Owner;
  created_at: string;
  completed_at?: string;
}

interface WishRow {
  id: string;
  pair_id: string;
  title: string;
  notes?: string;
  image_url?: string;
  category?: string;
  owner: Owner;
  scope: Wish['scope'];
  status: Wish['status'];
  created_at: string;
  achieved_at?: string;
}

interface DailyWishRow {
  id: string;
  pair_id: string;
  from: Owner;
  to: Owner;
  message: string;
  date: string;
  created_at: string;
}

interface SharedSnapshotPayload {
  snapshot: SharedAppSnapshot;
  updatedAt: string | null;
}

interface SharedSettingsSnapshot {
  wishes: Wish[];
  categories: string[];
  wishCategories: string[];
  dailyWishes: DailyWishMessage[];
  customHadiths: string[];
}

interface AppState {
  activeUser: Owner;
  setActiveUser: (user: Owner) => void;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  storageMode: StorageMode;
  syncStatus: SyncStatus;
  syncError: string | null;
  login: (user: Owner, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<{ ok: boolean; message: string }>;
  fontScale: 'sm' | 'md' | 'lg';
  setFontScale: (scale: 'sm' | 'md' | 'lg') => void;
  tasks: Task[];
  wishes: Wish[];
  categories: string[];
  wishCategories: string[];
  dailyWishes: DailyWishMessage[];
  customHadiths: string[];
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTaskForDate: (id: string, date: string) => void;
  deleteTask: (id: string) => void;
  addWish: (wish: Omit<Wish, 'id' | 'createdAt'>) => void;
  updateWish: (id: string, updates: Partial<Wish>) => void;
  deleteWish: (id: string) => void;
  addCategory: (category: string) => void;
  addWishCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  deleteWishCategory: (category: string) => void;
  addDailyWish: (wish: Omit<DailyWishMessage, 'id' | 'createdAt'>) => void;
  addCustomHadith: (hadith: string) => void;
  deleteCustomHadith: (hadith: string) => void;
}

const AppContext = createContext<AppState | null>(null);
const initialSnapshot = loadLocalSnapshot();

function buildSnapshot(params: {
  tasks: Task[];
  wishes: Wish[];
  categories: string[];
  wishCategories: string[];
  dailyWishes: DailyWishMessage[];
  customHadiths: string[];
  passwords: PasswordMap;
}): SharedAppSnapshot {
  return normalizeSharedSnapshot(params);
}

function getEmptySnapshot() {
  return normalizeSharedSnapshot({});
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const message = 'message' in error ? error.message : null;
    const details = 'details' in error ? error.details : null;
    const hint = 'hint' in error ? error.hint : null;
    const parts = [message, details, hint].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (parts.length > 0) return parts.join(' | ');
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 12000): Promise<T> {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  task: () => Promise<T>,
  label: string,
  attempts = 2,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(baseDelayMs * attempt);
    }
  }

  throw new Error(`${label} failed after ${attempts} attempts: ${getErrorMessage(lastError, label)}`);
}

function mapTaskRowToTask({ pair_id: _pairId, repeat_days, completion_dates, due_date_time, created_at, completed_at, ...task }: TaskRow): Task {
  return {
    ...task,
    repeatDays: repeat_days,
    completionDates: completion_dates,
    dueDateTime: due_date_time,
    createdAt: created_at,
    completedAt: completed_at,
  };
}

function mapTaskToTaskRow(pairId: string, task: Task): TaskRow {
  return {
    id: task.id,
    pair_id: pairId,
    title: task.title,
    description: task.description,
    category: task.category,
    kind: task.kind,
    recurrence: task.recurrence,
    repeat_days: task.repeatDays ?? [],
    completion_dates: task.completionDates ?? [],
    status: task.status,
    due_date_time: task.dueDateTime,
    owner: task.owner,
    created_at: task.createdAt,
    completed_at: task.completedAt,
  };
}

function mapWishRowToWish({ pair_id: _pairId, image_url, created_at, achieved_at, ...wish }: WishRow): Wish {
  return {
    ...wish,
    imageUrl: image_url,
    createdAt: created_at,
    achievedAt: achieved_at,
  };
}

function mapWishToWishRow(pairId: string, wish: Wish): WishRow {
  return {
    id: wish.id,
    pair_id: pairId,
    title: wish.title,
    notes: wish.notes,
    image_url: wish.imageUrl,
    category: wish.category,
    owner: wish.owner,
    scope: wish.scope,
    status: wish.status,
    created_at: wish.createdAt,
    achieved_at: wish.achievedAt,
  };
}

function mapDailyWishRowToDailyWish({ pair_id: _pairId, created_at, ...wish }: DailyWishRow): DailyWishMessage {
  return {
    ...wish,
    createdAt: created_at,
  };
}

function mapDailyWishToDailyWishRow(pairId: string, wish: DailyWishMessage): DailyWishRow {
  return {
    id: wish.id,
    pair_id: pairId,
    from: wish.from,
    to: wish.to,
    message: wish.message,
    date: wish.date,
    created_at: wish.createdAt,
  };
}

async function loadSharedSnapshot(pairId: string): Promise<SharedAppSnapshot> {
  const result = await loadSharedSnapshotWithMeta(pairId);
  return result.snapshot;
}

async function loadSharedSnapshotWithMeta(pairId: string): Promise<SharedSnapshotPayload> {
  if (!supabase) {
    return {
      snapshot: initialSnapshot,
      updatedAt: null,
    };
  }

  const [settingsResult, tasksResult, wishesResult, dailyWishesResult] = await Promise.all([
    supabase
      .from('pair_settings')
      .select('pair_id, categories, wish_categories, custom_hadiths, updated_at')
      .eq('pair_id', pairId)
      .maybeSingle<PairSettingsRow>(),
    supabase.from('tasks').select('*').eq('pair_id', pairId),
    supabase.from('wishes').select('*').eq('pair_id', pairId),
    supabase.from('daily_wishes').select('*').eq('pair_id', pairId),
  ]);

  const firstError =
    settingsResult.error || tasksResult.error || wishesResult.error || dailyWishesResult.error;
  if (firstError) {
    throw firstError;
  }

  const hasRemoteData =
    Boolean(settingsResult.data) ||
    (tasksResult.data?.length ?? 0) > 0 ||
    (wishesResult.data?.length ?? 0) > 0 ||
    (dailyWishesResult.data?.length ?? 0) > 0;

  if (!hasRemoteData) {
    return {
      snapshot: getEmptySnapshot(),
      updatedAt: settingsResult.data?.updated_at ?? null,
    };
  }

  return {
    snapshot: normalizeSharedSnapshot({
      tasks: (tasksResult.data ?? []).map((task) => mapTaskRowToTask(task as TaskRow)),
      wishes: (wishesResult.data ?? []).map((wish) => mapWishRowToWish(wish as WishRow)),
      dailyWishes: (dailyWishesResult.data ?? []).map((wish) => mapDailyWishRowToDailyWish(wish as DailyWishRow)),
      categories: settingsResult.data?.categories ?? undefined,
      wishCategories: settingsResult.data?.wish_categories ?? undefined,
      customHadiths: settingsResult.data?.custom_hadiths ?? undefined,
      passwords: DEFAULT_PASSWORDS,
    }),
    updatedAt: settingsResult.data?.updated_at ?? null,
  };
}

async function warmUpSharedSnapshot(pairId: string) {
  if (!supabase) return;

  const { error } = await supabase
    .from('pair_settings')
    .select('pair_id')
    .eq('pair_id', pairId)
    .maybeSingle();

  if (error) throw error;
}

async function replaceSharedSnapshot(pairId: string, snapshot: SharedAppSnapshot) {
  if (!supabase) return;

  const settingsPayload: PairSettingsRow = {
    pair_id: pairId,
    categories: snapshot.categories,
    wish_categories: snapshot.wishCategories,
    custom_hadiths: snapshot.customHadiths,
  };

  const tasksPayload: TaskRow[] = snapshot.tasks.map((task) => mapTaskToTaskRow(pairId, task));
  const wishesPayload: WishRow[] = snapshot.wishes.map((wish) => mapWishToWishRow(pairId, wish));
  const dailyWishesPayload: DailyWishRow[] = snapshot.dailyWishes.map((wish) =>
    mapDailyWishToDailyWishRow(pairId, wish)
  );

  const { error: settingsError } = await supabase.from('pair_settings').upsert(settingsPayload);
  if (settingsError) throw settingsError;

  const { error: clearTasksError } = await supabase.from('tasks').delete().eq('pair_id', pairId);
  if (clearTasksError) throw clearTasksError;
  if (tasksPayload.length > 0) {
    const { error: tasksError } = await supabase.from('tasks').insert(tasksPayload);
    if (tasksError) throw tasksError;
  }

  const { error: clearWishesError } = await supabase.from('wishes').delete().eq('pair_id', pairId);
  if (clearWishesError) throw clearWishesError;
  if (wishesPayload.length > 0) {
    const { error: wishesError } = await supabase.from('wishes').insert(wishesPayload);
    if (wishesError) throw wishesError;
  }

  const { error: clearDailyWishesError } = await supabase
    .from('daily_wishes')
    .delete()
    .eq('pair_id', pairId);
  if (clearDailyWishesError) throw clearDailyWishesError;
  if (dailyWishesPayload.length > 0) {
    const { error: dailyWishesError } = await supabase.from('daily_wishes').insert(dailyWishesPayload);
    if (dailyWishesError) throw dailyWishesError;
  }

  const { error: finalizeSettingsError } = await supabase
    .from('pair_settings')
    .update({ updated_at: new Date().toISOString() })
    .eq('pair_id', pairId);
  if (finalizeSettingsError) throw finalizeSettingsError;
}

async function replaceSharedSettingsSnapshot(pairId: string, snapshot: SharedSettingsSnapshot) {
  if (!supabase) return;

  const settingsPayload: PairSettingsRow = {
    pair_id: pairId,
    categories: snapshot.categories,
    wish_categories: snapshot.wishCategories,
    custom_hadiths: snapshot.customHadiths,
  };

  const wishesPayload: WishRow[] = snapshot.wishes.map((wish) => mapWishToWishRow(pairId, wish));
  const dailyWishesPayload: DailyWishRow[] = snapshot.dailyWishes.map((wish) =>
    mapDailyWishToDailyWishRow(pairId, wish)
  );

  const { error: settingsError } = await supabase.from('pair_settings').upsert(settingsPayload);
  if (settingsError) throw settingsError;

  const { error: clearWishesError } = await supabase.from('wishes').delete().eq('pair_id', pairId);
  if (clearWishesError) throw clearWishesError;
  if (wishesPayload.length > 0) {
    const { error: wishesError } = await supabase.from('wishes').insert(wishesPayload);
    if (wishesError) throw wishesError;
  }

  const { error: clearDailyWishesError } = await supabase
    .from('daily_wishes')
    .delete()
    .eq('pair_id', pairId);
  if (clearDailyWishesError) throw clearDailyWishesError;
  if (dailyWishesPayload.length > 0) {
    const { error: dailyWishesError } = await supabase.from('daily_wishes').insert(dailyWishesPayload);
    if (dailyWishesError) throw dailyWishesError;
  }

  const { error: finalizeSettingsError } = await supabase
    .from('pair_settings')
    .update({ updated_at: new Date().toISOString() })
    .eq('pair_id', pairId);
  if (finalizeSettingsError) throw finalizeSettingsError;
}

async function syncTaskRow(pairId: string, task: Task) {
  if (!supabase) return;

  const { error } = await supabase.from('tasks').upsert(mapTaskToTaskRow(pairId, task));
  if (error) throw error;
}

async function removeTaskRow(pairId: string, taskId: string) {
  if (!supabase) return;

  const { error } = await supabase.from('tasks').delete().eq('pair_id', pairId).eq('id', taskId);
  if (error) throw error;
}

async function touchPairSettings(pairId: string) {
  if (!supabase) return;

  const { error } = await supabase.from('pair_settings').upsert({
    pair_id: pairId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeUser, setActiveUser] = useState<Owner>(() => loadFromStorage<Owner>(LOCAL_KEYS.activeUser, 'Kamilla'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    loadFromStorage<boolean>(LOCAL_KEYS.isAuthenticated, false)
  );
  const [tasks, setTasks] = useState<Task[]>(initialSnapshot.tasks);
  const [wishes, setWishes] = useState<Wish[]>(initialSnapshot.wishes);
  const [categories, setCategories] = useState<string[]>(initialSnapshot.categories);
  const [wishCategories, setWishCategories] = useState<string[]>(initialSnapshot.wishCategories);
  const [dailyWishes, setDailyWishes] = useState<DailyWishMessage[]>(initialSnapshot.dailyWishes);
  const [customHadiths, setCustomHadiths] = useState<string[]>(initialSnapshot.customHadiths);
  const [passwords, setPasswords] = useState<PasswordMap>(initialSnapshot.passwords);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>(() =>
    loadFromStorage<'sm' | 'md' | 'lg'>(LOCAL_KEYS.fontScale, 'md')
  );
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(isSupabaseConfigured);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isSupabaseConfigured ? 'idle' : 'online');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [currentPairId, setCurrentPairId] = useState<string | null>(isSupabaseConfigured ? null : SUPABASE_STATE_ROW_ID);
  const syncTimerRef = useRef<number | null>(null);
  const remoteRefreshTimerRef = useRef<number | null>(null);
  const hasHydratedSharedRef = useRef(!isSupabaseConfigured);
  const skipNextSharedSyncRef = useRef(false);
  const localChangeVersionRef = useRef(0);
  const lastSharedSyncVersionRef = useRef(0);
  const storageMode: StorageMode = isSupabaseConfigured ? 'shared' : 'local';

  const snapshot = useMemo(
    () =>
      buildSnapshot({
        tasks,
        wishes,
        categories,
        wishCategories,
        dailyWishes,
        customHadiths,
        passwords,
      }),
    [tasks, wishes, categories, wishCategories, dailyWishes, customHadiths, passwords]
  );

  const sharedSettingsSnapshot = useMemo<SharedSettingsSnapshot>(
    () => ({
      wishes,
      categories,
      wishCategories,
      dailyWishes,
      customHadiths,
    }),
    [wishes, categories, wishCategories, dailyWishes, customHadiths]
  );

  const applySnapshot = useCallback((nextSnapshot: SharedAppSnapshot) => {
    setTasks(nextSnapshot.tasks);
    setWishes(nextSnapshot.wishes);
    setCategories(nextSnapshot.categories);
    setWishCategories(nextSnapshot.wishCategories);
    setDailyWishes(nextSnapshot.dailyWishes);
    setCustomHadiths(nextSnapshot.customHadiths);
  }, []);

  const applyRemoteSnapshot = useCallback(
    (nextSnapshot: SharedAppSnapshot) => {
      skipNextSharedSyncRef.current = true;
      lastSharedSyncVersionRef.current = localChangeVersionRef.current;
      applySnapshot(nextSnapshot);
    },
    [applySnapshot]
  );

  const hydrateSharedInBackground = useCallback(async (pairId: string) => {
    if (!supabase) return;
    const startedAtVersion = localChangeVersionRef.current;

    try {
      const { snapshot: remoteSnapshot, updatedAt: remoteUpdatedAt } = await withTimeout(
        loadSharedSnapshotWithMeta(pairId),
        'loadSharedSnapshot',
        READ_TIMEOUT_MS
      );
      const localBackup = loadLocalBackup();
      const lastLocalMutationAt = loadLastLocalMutationAt();
      const hasRemoteContent =
        remoteSnapshot.tasks.length > 0 ||
        remoteSnapshot.wishes.length > 0 ||
        remoteSnapshot.dailyWishes.length > 0;
      const localBackupSavedAt = localBackup?.savedAt ? new Date(localBackup.savedAt).getTime() : 0;
      const localMutationTimestamp = lastLocalMutationAt ? new Date(lastLocalMutationAt).getTime() : 0;
      const remoteSnapshotUpdatedAt = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
      const shouldPromoteLocalSnapshot =
        (localMutationTimestamp > remoteSnapshotUpdatedAt ||
          (localBackup?.hasContent && localBackupSavedAt > remoteSnapshotUpdatedAt)) &&
        localChangeVersionRef.current === startedAtVersion;

      if (!hasRemoteContent || shouldPromoteLocalSnapshot) {
        await withTimeout(replaceSharedSnapshot(pairId, snapshot), 'replaceSharedSnapshot', WRITE_TIMEOUT_MS);
        if (localChangeVersionRef.current === startedAtVersion) {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          applyRemoteSnapshot(snapshot);
        }
      } else if (localChangeVersionRef.current === startedAtVersion) {
        applyRemoteSnapshot(remoteSnapshot);
      }

      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
      setSyncError(null);
    } catch (error) {
      hasHydratedSharedRef.current = true;
      setSyncStatus('error');
      setSyncError(getErrorMessage(error, 'Не удалось обновить данные пары, пока используем сохранённые данные.'));
    }
  }, [applyRemoteSnapshot, snapshot]);

  const refreshSharedSnapshot = useCallback(
    async (pairId: string) => {
      if (!supabase || !hasHydratedSharedRef.current) return;

      const scheduledAtVersion = localChangeVersionRef.current;
      const hasPendingLocalChanges = localChangeVersionRef.current !== lastSharedSyncVersionRef.current;
      if (hasPendingLocalChanges) return;

      try {
        const remoteSnapshot = await withTimeout(loadSharedSnapshot(pairId), 'loadSharedSnapshot', READ_TIMEOUT_MS);
        const localChangedSinceRefreshStarted = localChangeVersionRef.current !== scheduledAtVersion;
        const stillHasPendingLocalChanges = localChangeVersionRef.current !== lastSharedSyncVersionRef.current;
        if (localChangedSinceRefreshStarted || stillHasPendingLocalChanges) {
          return;
        }

        applyRemoteSnapshot(remoteSnapshot);
        setSyncStatus('online');
        setSyncError(null);
      } catch (error) {
        setSyncStatus('error');
        setSyncError(getErrorMessage(error, 'Не удалось получить свежие данные пары'));
      }
    },
    [applyRemoteSnapshot]
  );

  const markLocalChange = useCallback(() => {
    localChangeVersionRef.current += 1;
    markLocalMutationAt();
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.activeUser, JSON.stringify(activeUser));
  }, [activeUser]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.isAuthenticated, JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(LOCAL_KEYS.fontScale, JSON.stringify(fontScale));
    document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale]);

  useEffect(() => {
    saveLocalSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    if (!supabase) {
      setIsBootstrapping(false);
      return;
    }

    let mounted = true;

    const hydrateSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        setSyncError('Не удалось проверить сессию Supabase');
        setIsBootstrapping(false);
        return;
      }

      const owner = getOwnerByEmail(data.session?.user?.email);
      if (!owner) {
        setIsAuthenticated(false);
        setSyncStatus('idle');
        setSyncError(null);
        setCurrentPairId(null);
        setIsBootstrapping(false);
        return;
      }

      setActiveUser(owner);
      setIsAuthenticated(true);
      setCurrentPairId(SUPABASE_STATE_ROW_ID);
      hasHydratedSharedRef.current = false;
      setSyncStatus('syncing');
      setSyncError(null);
      setIsBootstrapping(false);

      void hydrateSharedInBackground(SUPABASE_STATE_ROW_ID);
    };

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const owner = getOwnerByEmail(session?.user?.email);

      if (!owner) {
        setIsAuthenticated(false);
        setSyncStatus('idle');
        setSyncError(null);
        setIsBootstrapping(false);
        hasHydratedSharedRef.current = false;
        setCurrentPairId(null);
        return;
      }
      setActiveUser(owner);
      setIsAuthenticated(true);
      setCurrentPairId(SUPABASE_STATE_ROW_ID);
      hasHydratedSharedRef.current = false;
      setSyncStatus('syncing');
      setSyncError(null);
      setIsBootstrapping(false);
      void hydrateSharedInBackground(SUPABASE_STATE_ROW_ID);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateSharedInBackground]);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !currentPairId || !hasHydratedSharedRef.current) return;

    if (skipNextSharedSyncRef.current) {
      skipNextSharedSyncRef.current = false;
      return;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(async () => {
      try {
        await withTimeout(
          replaceSharedSettingsSnapshot(currentPairId, sharedSettingsSnapshot),
          'replaceSharedSettingsSnapshot',
          WRITE_TIMEOUT_MS
        );
        lastSharedSyncVersionRef.current = localChangeVersionRef.current;
        setSyncStatus('online');
        setSyncError(null);
      } catch (error) {
        setSyncStatus('error');
        setSyncError(getErrorMessage(error, 'Не удалось синхронизировать данные пары'));
      }
    }, 500);

    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [currentPairId, isAuthenticated, sharedSettingsSnapshot]);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !currentPairId || !hasHydratedSharedRef.current) return;

    const scheduleRemoteRefresh = () => {
      if (remoteRefreshTimerRef.current) {
        window.clearTimeout(remoteRefreshTimerRef.current);
      }

      remoteRefreshTimerRef.current = window.setTimeout(() => {
        void refreshSharedSnapshot(currentPairId);
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        scheduleRemoteRefresh();
      }
    };

    const pollIntervalId = window.setInterval(() => {
      scheduleRemoteRefresh();
    }, REMOTE_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', scheduleRemoteRefresh);
    window.addEventListener('online', scheduleRemoteRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(pollIntervalId);
      if (remoteRefreshTimerRef.current) {
        window.clearTimeout(remoteRefreshTimerRef.current);
      }
      window.removeEventListener('focus', scheduleRemoteRefresh);
      window.removeEventListener('online', scheduleRemoteRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentPairId, isAuthenticated, refreshSharedSnapshot]);

  const login = useCallback(
    async (user: Owner, password: string) => {
      if (isBootstrapping) return false;

      if (supabase) {
        const email = ownerEmailMap[user];
        if (!email) return false;

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) return false;
        return true;
      }

      const isValid = passwords[user] === password;
      if (!isValid) return false;

      setActiveUser(user);
      setIsAuthenticated(true);
      return true;
    },
    [isBootstrapping, passwords]
  );

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      if (supabase) {
        const email = ownerEmailMap[activeUser];
        if (!email) {
          return { ok: false, message: 'Для этого пользователя не настроен e-mail Supabase' };
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

        if (reauthError) {
          return { ok: false, message: 'Текущий пароль введён неверно' };
        }

        if (nextPassword.trim().length < 6) {
          return { ok: false, message: 'Новый пароль должен быть не короче 6 символов' };
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: nextPassword.trim(),
        });

        if (updateError) {
          return { ok: false, message: 'Не удалось обновить пароль в Supabase' };
        }

        return { ok: true, message: 'Пароль обновлён в Supabase' };
      }

      if (passwords[activeUser] !== currentPassword) {
        return { ok: false, message: 'Текущий пароль введён неверно' };
      }

      if (nextPassword.trim().length < 6) {
        return { ok: false, message: 'Новый пароль должен быть не короче 6 символов' };
      }

      setPasswords((prev) => ({
        ...prev,
        [activeUser]: nextPassword.trim(),
      }));

      return { ok: true, message: 'Пароль успешно изменён' };
    },
    [activeUser, passwords]
  );

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>) => {
    const nextTask: Task = { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    markLocalChange();
    setTasks((prev) => [...prev, nextTask]);

    if (supabase && currentPairId) {
      void withTimeout(
        (async () => {
          await syncTaskRow(currentPairId, nextTask);
          await touchPairSettings(currentPairId);
        })(),
        'syncTaskRow',
        WRITE_TIMEOUT_MS
      )
        .then(() => {
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch((error) => {
          setSyncStatus('error');
          setSyncError(getErrorMessage(error, 'Не удалось сохранить задачу'));
        });
    }
  }, [currentPairId, markLocalChange]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    let syncedTask: Task | null = null;
    markLocalChange();
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const updated = { ...task, ...updates };
        if (updates.status === 'done' && task.status !== 'done') {
          updated.completedAt = new Date().toISOString();
        }
        if (updates.status && updates.status !== 'done') {
          updated.completedAt = undefined;
        }
        syncedTask = updated;
        return updated;
      })
    );

    if (supabase && currentPairId) {
      queueMicrotask(() => {
        if (!syncedTask) return;
        void withTimeout(
          (async () => {
            await syncTaskRow(currentPairId, syncedTask as Task);
            await touchPairSettings(currentPairId);
          })(),
          'syncTaskRow',
          WRITE_TIMEOUT_MS
        )
          .then(() => {
            setSyncStatus('online');
            setSyncError(null);
          })
          .catch((error) => {
            setSyncStatus('error');
            setSyncError(getErrorMessage(error, 'Не удалось обновить задачу'));
          });
      });
    }
  }, [currentPairId, markLocalChange]);

  const toggleTaskForDate = useCallback((id: string, date: string) => {
    let syncedTask: Task | null = null;
    markLocalChange();
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        if (task.kind !== 'habit') {
          const nextStatus = task.status === 'done' ? 'todo' : 'done';
          syncedTask = {
            ...task,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
          };
          return syncedTask;
        }

        const completionDates = task.completionDates ?? [];
        const exists = completionDates.includes(date);
        syncedTask = {
          ...task,
          completionDates: exists ? completionDates.filter((item) => item !== date) : [...completionDates, date],
        };
        return syncedTask;
      })
    );

    if (supabase && currentPairId) {
      queueMicrotask(() => {
        if (!syncedTask) return;
        void withTimeout(
          (async () => {
            await syncTaskRow(currentPairId, syncedTask as Task);
            await touchPairSettings(currentPairId);
          })(),
          'syncTaskRow',
          WRITE_TIMEOUT_MS
        )
          .then(() => {
            setSyncStatus('online');
            setSyncError(null);
          })
          .catch((error) => {
            setSyncStatus('error');
            setSyncError(getErrorMessage(error, 'Не удалось обновить задачу'));
          });
      });
    }
  }, [currentPairId, markLocalChange]);

  const deleteTask = useCallback((id: string) => {
    markLocalChange();
    setTasks((prev) => prev.filter((task) => task.id !== id));

    if (supabase && currentPairId) {
      void withTimeout(
        (async () => {
          await removeTaskRow(currentPairId, id);
          await touchPairSettings(currentPairId);
        })(),
        'removeTaskRow',
        WRITE_TIMEOUT_MS
      )
        .then(() => {
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch((error) => {
          setSyncStatus('error');
          setSyncError(getErrorMessage(error, 'Не удалось удалить задачу'));
        });
    }
  }, [currentPairId, markLocalChange]);

  const addWish = useCallback((wish: Omit<Wish, 'id' | 'createdAt'>) => {
    markLocalChange();
    setWishes((prev) => [...prev, { ...wish, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, [markLocalChange]);

  const updateWish = useCallback((id: string, updates: Partial<Wish>) => {
    markLocalChange();
    setWishes((prev) =>
      prev.map((wish) => {
        if (wish.id !== id) return wish;
        const updated = { ...wish, ...updates };
        if (updates.status === 'achieved' && wish.status !== 'achieved') {
          updated.achievedAt = new Date().toISOString();
        }
        if (updates.status && updates.status !== 'achieved') {
          updated.achievedAt = undefined;
        }
        return updated;
      })
    );
  }, [markLocalChange]);

  const deleteWish = useCallback((id: string) => {
    markLocalChange();
    setWishes((prev) => prev.filter((wish) => wish.id !== id));
  }, [markLocalChange]);

  const addCategory = useCallback((category: string) => {
    markLocalChange();
    setCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
  }, [markLocalChange]);

  const addWishCategory = useCallback((category: string) => {
    markLocalChange();
    setWishCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
  }, [markLocalChange]);

  const deleteCategory = useCallback((category: string) => {
    markLocalChange();
    setCategories((prev) => prev.filter((item) => item !== category));
  }, [markLocalChange]);

  const deleteWishCategory = useCallback((category: string) => {
    markLocalChange();
    setWishCategories((prev) => prev.filter((item) => item !== category));
  }, [markLocalChange]);

  const addDailyWish = useCallback((wish: Omit<DailyWishMessage, 'id' | 'createdAt'>) => {
    markLocalChange();
    setDailyWishes((prev) => [...prev, { ...wish, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, [markLocalChange]);

  const addCustomHadith = useCallback((hadith: string) => {
    markLocalChange();
    setCustomHadiths((prev) => (prev.includes(hadith) ? prev : [...prev, hadith]));
  }, [markLocalChange]);

  const deleteCustomHadith = useCallback((hadith: string) => {
    markLocalChange();
    setCustomHadiths((prev) => prev.filter((item) => item !== hadith));
  }, [markLocalChange]);

  return (
    <AppContext.Provider
      value={{
        activeUser,
        setActiveUser,
        isAuthenticated,
        isBootstrapping,
        storageMode,
        syncStatus,
        syncError,
        login,
        logout,
        changePassword,
        fontScale,
        setFontScale,
        tasks,
        wishes,
        categories,
        wishCategories,
        dailyWishes,
        customHadiths,
        addTask,
        updateTask,
        toggleTaskForDate,
        deleteTask,
        addWish,
        updateWish,
        deleteWish,
        addCategory,
        addWishCategory,
        deleteCategory,
        deleteWishCategory,
        addDailyWish,
        addCustomHadith,
        deleteCustomHadith,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
