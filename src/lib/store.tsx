import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DailyReflection, DailyWishMessage, HomePurchase, Owner, RecipeEntry, Task, Wish } from './types';
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
  shouldPromoteLocalSnapshotDuringHydration,
} from './app-persistence';
import { getOwnerByEmail, isSupabaseConfigured, ownerEmailMap, SUPABASE_STATE_ROW_ID, supabase } from './supabase';

type SyncStatus = 'idle' | 'syncing' | 'online' | 'error';
type StorageMode = 'local' | 'shared';

const READ_TIMEOUT_MS = 45000;
const WRITE_TIMEOUT_MS = 45000;
const REMOTE_REFRESH_INTERVAL_MS = 30000;
const PRIMARY_OWNER: Owner = 'Kamilla';

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

interface ProfileRow {
  pair_id: string;
}

interface SharedSettingsSnapshot {
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
  refreshSharedData: () => Promise<void>;
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
  homePurchases: HomePurchase[];
  dailyReflections: DailyReflection[];
  recipeEntries: RecipeEntry[];
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
  addHomePurchase: (input: Omit<HomePurchase, 'id' | 'createdAt' | 'owner' | 'status'>) => void;
  toggleHomePurchase: (id: string) => void;
  deleteHomePurchase: (id: string) => void;
  upsertDailyReflection: (date: string, text: string) => void;
  deleteDailyReflection: (id: string) => void;
  addRecipeEntry: (input: Omit<RecipeEntry, 'id' | 'createdAt' | 'owner'>) => void;
  deleteRecipeEntry: (id: string) => void;
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

function dedupeRowsById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    map.set(row.id, row);
  });
  return Array.from(map.values());
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

async function loadPairIdForUser(userId: string): Promise<string | null> {
  if (!supabase) return SUPABASE_STATE_ROW_ID;

  const { data, error } = await supabase
    .from('profiles')
    .select('pair_id')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (error) throw error;
  return data?.pair_id ?? null;
}

async function discoverAccessiblePairId(): Promise<string | null> {
  if (!supabase) return null;

  const settings = await supabase.from('pair_settings').select('pair_id').limit(1).maybeSingle<{ pair_id: string }>();
  if (!settings.error && settings.data?.pair_id) return settings.data.pair_id;

  const tasks = await supabase.from('tasks').select('pair_id').limit(1).maybeSingle<{ pair_id: string }>();
  if (!tasks.error && tasks.data?.pair_id) return tasks.data.pair_id;

  const wishes = await supabase.from('wishes').select('pair_id').limit(1).maybeSingle<{ pair_id: string }>();
  if (!wishes.error && wishes.data?.pair_id) return wishes.data.pair_id;

  return null;
}

async function ensureOwnProfile(params: { userId: string; email: string; owner: Owner; pairId: string }) {
  if (!supabase) return;

  const { error } = await supabase.from('profiles').upsert({
    id: params.userId,
    email: params.email,
    owner: params.owner,
    pair_id: params.pairId,
  });

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

  const tasksPayload = dedupeRowsById(snapshot.tasks.map((task) => mapTaskToTaskRow(pairId, task)));
  const wishesPayload = dedupeRowsById(snapshot.wishes.map((wish) => mapWishToWishRow(pairId, wish)));
  const dailyWishesPayload = dedupeRowsById(
    snapshot.dailyWishes.map((wish) => mapDailyWishToDailyWishRow(pairId, wish))
  );

  const { error: settingsError } = await supabase.from('pair_settings').upsert(settingsPayload);
  if (settingsError) throw settingsError;

  const { error: clearTasksError } = await supabase.from('tasks').delete().eq('pair_id', pairId);
  if (clearTasksError) throw clearTasksError;
  if (tasksPayload.length > 0) {
    const { error: tasksError } = await supabase.from('tasks').upsert(tasksPayload, { onConflict: 'id' });
    if (tasksError) throw tasksError;
  }

  const { error: clearWishesError } = await supabase.from('wishes').delete().eq('pair_id', pairId);
  if (clearWishesError) throw clearWishesError;
  if (wishesPayload.length > 0) {
    const { error: wishesError } = await supabase.from('wishes').upsert(wishesPayload, { onConflict: 'id' });
    if (wishesError) throw wishesError;
  }

  const { error: clearDailyWishesError } = await supabase
    .from('daily_wishes')
    .delete()
    .eq('pair_id', pairId);
  if (clearDailyWishesError) throw clearDailyWishesError;
  if (dailyWishesPayload.length > 0) {
    const { error: dailyWishesError } = await supabase
      .from('daily_wishes')
      .upsert(dailyWishesPayload, { onConflict: 'id' });
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

  const dailyWishesPayload: DailyWishRow[] = snapshot.dailyWishes.map((wish) =>
    mapDailyWishToDailyWishRow(pairId, wish)
  );

  const { error: settingsError } = await supabase.from('pair_settings').upsert(settingsPayload);
  if (settingsError) throw settingsError;

  const { error: clearDailyWishesError } = await supabase
    .from('daily_wishes')
    .delete()
    .eq('pair_id', pairId);
  if (clearDailyWishesError) throw clearDailyWishesError;
  if (dailyWishesPayload.length > 0) {
    const { error: dailyWishesError } = await supabase
      .from('daily_wishes')
      .upsert(dailyWishesPayload, { onConflict: 'id' });
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

  const { error } = await supabase.from('tasks').upsert(mapTaskToTaskRow(pairId, task), { onConflict: 'id' });
  if (error) throw error;
}

async function syncWishRow(pairId: string, wish: Wish) {
  if (!supabase) return;

  const { error } = await supabase.from('wishes').upsert(mapWishToWishRow(pairId, wish), { onConflict: 'id' });
  if (error) throw error;
}

async function removeTaskRow(taskId: string) {
  if (!supabase) return;

  // Delete by primary key only. RLS still limits access to own pair rows.
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

async function removeWishRow(wishId: string) {
  if (!supabase) return;

  const { error } = await supabase.from('wishes').delete().eq('id', wishId);
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
  const [activeUser, setActiveUser] = useState<Owner>(() => {
    const savedUser = loadFromStorage<Owner>(LOCAL_KEYS.activeUser, PRIMARY_OWNER);
    return savedUser === PRIMARY_OWNER ? savedUser : PRIMARY_OWNER;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    loadFromStorage<boolean>(LOCAL_KEYS.isAuthenticated, false)
  );
  const [tasks, setTasks] = useState<Task[]>(initialSnapshot.tasks);
  const [wishes, setWishes] = useState<Wish[]>(initialSnapshot.wishes);
  const [categories, setCategories] = useState<string[]>(initialSnapshot.categories);
  const [wishCategories, setWishCategories] = useState<string[]>(initialSnapshot.wishCategories);
  const [dailyWishes, setDailyWishes] = useState<DailyWishMessage[]>(initialSnapshot.dailyWishes);
  const [customHadiths, setCustomHadiths] = useState<string[]>(initialSnapshot.customHadiths);
  const [homePurchases, setHomePurchases] = useState<HomePurchase[]>(() =>
    loadFromStorage<HomePurchase[]>('twp-home-purchases', [])
  );
  const [dailyReflections, setDailyReflections] = useState<DailyReflection[]>(() =>
    loadFromStorage<DailyReflection[]>('twp-daily-reflections', [])
  );
  const [recipeEntries, setRecipeEntries] = useState<RecipeEntry[]>(() =>
    loadFromStorage<RecipeEntry[]>('twp-recipe-entries', [])
  );
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
  const pendingTaskDeletesRef = useRef<Set<string>>(new Set());
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
      categories,
      wishCategories,
      dailyWishes,
      customHadiths,
    }),
    [categories, wishCategories, dailyWishes, customHadiths]
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
      const hasRemoteContent =
        remoteSnapshot.tasks.length > 0 ||
        remoteSnapshot.wishes.length > 0 ||
        remoteSnapshot.dailyWishes.length > 0;
      const localBackup = loadLocalBackup();
      const lastLocalMutationAt = loadLastLocalMutationAt();
      const shouldPromoteLocalSnapshot = shouldPromoteLocalSnapshotDuringHydration({
        remoteSnapshot,
        remoteUpdatedAt,
        localBackup,
        lastLocalMutationAt,
        startedAtVersion,
        currentLocalChangeVersion: localChangeVersionRef.current,
      });

      if (!hasRemoteContent || shouldPromoteLocalSnapshot) {
        await withTimeout(replaceSharedSnapshot(pairId, snapshot), 'replaceSharedSnapshot', WRITE_TIMEOUT_MS);
        if (localChangeVersionRef.current === startedAtVersion) {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          applyRemoteSnapshot(snapshot);
        }
      } else if (localChangeVersionRef.current === startedAtVersion) {
        const pendingDeletes = pendingTaskDeletesRef.current;
        if (pendingDeletes.size > 0) {
          applyRemoteSnapshot({
            ...remoteSnapshot,
            tasks: remoteSnapshot.tasks.filter((task) => !pendingDeletes.has(task.id)),
          });
        } else {
          applyRemoteSnapshot(remoteSnapshot);
        }
      }

      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
      setSyncError(null);
    } catch (error) {
      hasHydratedSharedRef.current = true;
      setSyncStatus('idle');
      setSyncError(null);
    }
  }, [applyRemoteSnapshot, snapshot]);

  const refreshSharedSnapshot = useCallback(
    async (pairId: string) => {
      if (!supabase || !hasHydratedSharedRef.current) return;

      try {
        const remoteSnapshot = await withTimeout(loadSharedSnapshot(pairId), 'loadSharedSnapshot', READ_TIMEOUT_MS);
        applyRemoteSnapshot(remoteSnapshot);
        setSyncStatus('online');
        setSyncError(null);
      } catch (error) {
        setSyncStatus('idle');
        setSyncError(null);
      }
    },
    [applyRemoteSnapshot]
  );

  const markLocalChange = useCallback(() => {
    localChangeVersionRef.current += 1;
    markLocalMutationAt();
  }, []);

  const refreshSharedData = useCallback(async () => {
    if (!supabase || !isAuthenticated || !currentPairId) return;

    if (hasHydratedSharedRef.current) {
      await refreshSharedSnapshot(currentPairId);
      return;
    }

    await hydrateSharedInBackground(currentPairId);
  }, [currentPairId, hydrateSharedInBackground, isAuthenticated, refreshSharedSnapshot]);

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
    localStorage.setItem('twp-home-purchases', JSON.stringify(homePurchases));
  }, [homePurchases]);

  useEffect(() => {
    localStorage.setItem('twp-daily-reflections', JSON.stringify(dailyReflections));
  }, [dailyReflections]);

  useEffect(() => {
    localStorage.setItem('twp-recipe-entries', JSON.stringify(recipeEntries));
  }, [recipeEntries]);

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
        setSyncError(null);
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

      const pairId = SUPABASE_STATE_ROW_ID;
      const userId = data.session?.user?.id;
      const email = data.session?.user?.email;
      if (userId && email) {
        try {
          await ensureOwnProfile({
            userId,
            email,
            owner,
            pairId: SUPABASE_STATE_ROW_ID,
          });
        } catch {
          // keep going with fallback pair id
        }
      }
      if (!mounted) return;

      setActiveUser(owner);
      setIsAuthenticated(true);
      setCurrentPairId(pairId);
      hasHydratedSharedRef.current = false;
      setSyncStatus('syncing');
      setSyncError(null);
      setIsBootstrapping(false);

      void hydrateSharedInBackground(pairId);
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
      const pairId = SUPABASE_STATE_ROW_ID;
      const userId = session?.user?.id;
      const email = session?.user?.email;
      if (userId && email) {
        try {
          await ensureOwnProfile({
            userId,
            email,
            owner,
            pairId: SUPABASE_STATE_ROW_ID,
          });
        } catch {
          // keep going with fallback pair id
        }
      }

      setActiveUser(owner);
      setIsAuthenticated(true);
      setCurrentPairId(pairId);
      hasHydratedSharedRef.current = false;
      setSyncStatus('syncing');
      setSyncError(null);
      setIsBootstrapping(false);
      void hydrateSharedInBackground(pairId);
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
        setSyncStatus('idle');
        setSyncError(null);
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

  useEffect(() => {
    if (!supabase || !isAuthenticated || !currentPairId || !hasHydratedSharedRef.current) return;

    const refreshFromRealtime = () => {
      void refreshSharedSnapshot(currentPairId);
    };

    const channel = supabase
      .channel(`pair-updates-${currentPairId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `pair_id=eq.${currentPairId}` },
        refreshFromRealtime
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wishes', filter: `pair_id=eq.${currentPairId}` },
        refreshFromRealtime
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_wishes', filter: `pair_id=eq.${currentPairId}` },
        refreshFromRealtime
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pair_settings', filter: `pair_id=eq.${currentPairId}` },
        refreshFromRealtime
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refreshFromRealtime();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentPairId, isAuthenticated, refreshSharedSnapshot]);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !currentPairId) return;
    if (pendingTaskDeletesRef.current.size === 0) return;

    const ids = Array.from(pendingTaskDeletesRef.current);
    void Promise.all(ids.map((id) => removeTaskRow(id)))
      .then(async () => {
        pendingTaskDeletesRef.current.clear();
        await touchPairSettings(currentPairId);
        lastSharedSyncVersionRef.current = localChangeVersionRef.current;
      })
      .catch(() => {
        // keep ids for next retry
      });
  }, [currentPairId, isAuthenticated]);

  const login = useCallback(
    async (user: Owner, password: string) => {
      if (isBootstrapping) return false;
      if (user !== PRIMARY_OWNER) return false;

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
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch((error) => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('idle');
          setSyncError(null);
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
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('online');
            setSyncError(null);
          })
          .catch((error) => {
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('idle');
            setSyncError(null);
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
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('online');
            setSyncError(null);
          })
          .catch((error) => {
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('idle');
            setSyncError(null);
          });
      });
    }
  }, [currentPairId, markLocalChange]);

  const deleteTask = useCallback((id: string) => {
    markLocalChange();
    setTasks((prev) => prev.filter((task) => task.id !== id));

    if (supabase && !currentPairId) {
      pendingTaskDeletesRef.current.add(id);
      return;
    }

    if (supabase && currentPairId) {
      void withTimeout(
        (async () => {
          await removeTaskRow(id);
          await touchPairSettings(currentPairId);
        })(),
        'removeTaskRow',
        WRITE_TIMEOUT_MS
      )
        .then(() => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch((error) => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('idle');
          setSyncError(null);
        });
    }
  }, [currentPairId, markLocalChange]);

  const addWish = useCallback((wish: Omit<Wish, 'id' | 'createdAt'>) => {
    const nextWish: Wish = { ...wish, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    markLocalChange();
    setWishes((prev) => [...prev, nextWish]);

    if (supabase && currentPairId) {
      void withTimeout(
        (async () => {
          await syncWishRow(currentPairId, nextWish);
          await touchPairSettings(currentPairId);
        })(),
        'syncWishRow',
        WRITE_TIMEOUT_MS
      )
        .then(() => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch(() => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('idle');
          setSyncError(null);
        });
    }
  }, [currentPairId, markLocalChange]);

  const updateWish = useCallback((id: string, updates: Partial<Wish>) => {
    let syncedWish: Wish | null = null;
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
        syncedWish = updated;
        return updated;
      })
    );

    if (supabase && currentPairId) {
      queueMicrotask(() => {
        if (!syncedWish) return;
        void withTimeout(
          (async () => {
            await syncWishRow(currentPairId, syncedWish as Wish);
            await touchPairSettings(currentPairId);
          })(),
          'syncWishRow',
          WRITE_TIMEOUT_MS
        )
          .then(() => {
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('online');
            setSyncError(null);
          })
          .catch(() => {
            lastSharedSyncVersionRef.current = localChangeVersionRef.current;
            setSyncStatus('idle');
            setSyncError(null);
          });
      });
    }
  }, [currentPairId, markLocalChange]);

  const deleteWish = useCallback((id: string) => {
    markLocalChange();
    setWishes((prev) => prev.filter((wish) => wish.id !== id));

    if (supabase && currentPairId) {
      void withTimeout(
        (async () => {
          await removeWishRow(id);
          await touchPairSettings(currentPairId);
        })(),
        'removeWishRow',
        WRITE_TIMEOUT_MS
      )
        .then(() => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('online');
          setSyncError(null);
        })
        .catch(() => {
          lastSharedSyncVersionRef.current = localChangeVersionRef.current;
          setSyncStatus('idle');
          setSyncError(null);
        });
    }
  }, [currentPairId, markLocalChange]);

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

  const addHomePurchase = useCallback((input: Omit<HomePurchase, 'id' | 'createdAt' | 'owner' | 'status'>) => {
    const nextItem: HomePurchase = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      notes: input.notes?.trim() || undefined,
      imageUrl: input.imageUrl,
      isRecurring: input.isRecurring,
      status: 'todo',
      owner: activeUser,
      createdAt: new Date().toISOString(),
    };
    setHomePurchases((prev) => [nextItem, ...prev]);
  }, [activeUser]);

  const toggleHomePurchase = useCallback((id: string) => {
    setHomePurchases((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: item.status === 'done' ? 'todo' : 'done' } : item
      )
    );
  }, []);

  const deleteHomePurchase = useCallback((id: string) => {
    setHomePurchases((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const upsertDailyReflection = useCallback((date: string, text: string) => {
    const cleanText = text.trim();
    setDailyReflections((prev) => {
      const existing = prev.find((item) => item.owner === activeUser && item.date === date);
      if (!cleanText) {
        if (!existing) return prev;
        return prev.filter((item) => item.id !== existing.id);
      }
      if (!existing) {
        return [
          {
            id: crypto.randomUUID(),
            owner: activeUser,
            date,
            text: cleanText,
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      return prev.map((item) =>
        item.id === existing.id ? { ...item, text: cleanText, updatedAt: new Date().toISOString() } : item
      );
    });
  }, [activeUser]);

  const deleteDailyReflection = useCallback((id: string) => {
    setDailyReflections((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addRecipeEntry = useCallback((input: Omit<RecipeEntry, 'id' | 'createdAt' | 'owner'>) => {
    const nextEntry: RecipeEntry = {
      id: crypto.randomUUID(),
      owner: activeUser,
      title: input.title.trim(),
      recipe: input.recipe.trim(),
      imageUrl: input.imageUrl,
      createdAt: new Date().toISOString(),
    };
    setRecipeEntries((prev) => [nextEntry, ...prev]);
  }, [activeUser]);

  const deleteRecipeEntry = useCallback((id: string) => {
    setRecipeEntries((prev) => prev.filter((item) => item.id !== id));
  }, []);

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
        refreshSharedData,
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
        homePurchases,
        dailyReflections,
        recipeEntries,
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
        addHomePurchase,
        toggleHomePurchase,
        deleteHomePurchase,
        upsertDailyReflection,
        deleteDailyReflection,
        addRecipeEntry,
        deleteRecipeEntry,
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
