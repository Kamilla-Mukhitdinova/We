import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DailyWishMessage, Owner, Task, Wish } from './types';
import {
  DEFAULT_PASSWORDS,
  LOCAL_KEYS,
  PasswordMap,
  SharedAppSnapshot,
  loadFromStorage,
  loadLocalSnapshot,
  normalizeSharedSnapshot,
  saveLocalSnapshot,
} from './app-persistence';
import { getOwnerByEmail, isSupabaseConfigured, ownerEmailMap, SUPABASE_STATE_ROW_ID, supabase } from './supabase';

type SyncStatus = 'idle' | 'syncing' | 'online' | 'error';
type StorageMode = 'local' | 'shared';

const READ_TIMEOUT_MS = 45000;
const WRITE_TIMEOUT_MS = 45000;

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
  if (!supabase) return initialSnapshot;

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
    return getEmptySnapshot();
  }

  return normalizeSharedSnapshot({
    tasks: (tasksResult.data ?? []).map((task) => mapTaskRowToTask(task as TaskRow)),
    wishes: (wishesResult.data ?? []).map((wish) => mapWishRowToWish(wish as WishRow)),
    dailyWishes: (dailyWishesResult.data ?? []).map((wish) => mapDailyWishRowToDailyWish(wish as DailyWishRow)),
    categories: settingsResult.data?.categories ?? undefined,
    wishCategories: settingsResult.data?.wish_categories ?? undefined,
    customHadiths: settingsResult.data?.custom_hadiths ?? undefined,
    passwords: DEFAULT_PASSWORDS,
  });
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
    updated_at: new Date().toISOString(),
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
      applySnapshot(nextSnapshot);
    },
    [applySnapshot]
  );

  const hydrateSharedInBackground = useCallback(async (pairId: string) => {
    if (!supabase) return;

    try {
      const remoteSnapshot = await withTimeout(loadSharedSnapshot(pairId), 'loadSharedSnapshot', READ_TIMEOUT_MS);
      const hasRemoteContent =
        remoteSnapshot.tasks.length > 0 ||
        remoteSnapshot.wishes.length > 0 ||
        remoteSnapshot.dailyWishes.length > 0;

      if (!hasRemoteContent) {
        await withTimeout(replaceSharedSnapshot(pairId, snapshot), 'replaceSharedSnapshot', WRITE_TIMEOUT_MS);
        applyRemoteSnapshot(snapshot);
      } else {
        applyRemoteSnapshot(remoteSnapshot);
      }

      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
      setSyncError(null);
    } catch (error) {
      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
      setSyncError(getErrorMessage(error, 'Не удалось обновить данные пары, пока используем сохранённые данные.'));
    }
  }, [applyRemoteSnapshot, snapshot]);

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
      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
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
      hasHydratedSharedRef.current = true;
      setSyncStatus('online');
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
        await withTimeout(replaceSharedSnapshot(currentPairId, snapshot), 'replaceSharedSnapshot', WRITE_TIMEOUT_MS);
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
  }, [currentPairId, isAuthenticated, snapshot]);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !currentPairId || !hasHydratedSharedRef.current) return;

    const scheduleRemoteRefresh = () => {
      if (remoteRefreshTimerRef.current) {
        window.clearTimeout(remoteRefreshTimerRef.current);
      }

      remoteRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          const remoteSnapshot = await withTimeout(loadSharedSnapshot(currentPairId), 'loadSharedSnapshot', READ_TIMEOUT_MS);
          applyRemoteSnapshot(remoteSnapshot);
          setSyncStatus('online');
          setSyncError(null);
        } catch (error) {
          setSyncStatus('error');
          setSyncError(getErrorMessage(error, 'Не удалось получить свежие данные пары'));
        }
      }, 250);
    };

    const channel = supabase
      .channel(`pair-sync:${currentPairId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pair_settings', filter: `pair_id=eq.${currentPairId}` },
        scheduleRemoteRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `pair_id=eq.${currentPairId}` },
        scheduleRemoteRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wishes', filter: `pair_id=eq.${currentPairId}` },
        scheduleRemoteRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_wishes', filter: `pair_id=eq.${currentPairId}` },
        scheduleRemoteRefresh
      )
      .subscribe();

    return () => {
      if (remoteRefreshTimerRef.current) {
        window.clearTimeout(remoteRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [applyRemoteSnapshot, currentPairId, isAuthenticated]);

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
    setTasks((prev) => [...prev, { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
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
        return updated;
      })
    );
  }, []);

  const toggleTaskForDate = useCallback((id: string, date: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        if (task.kind !== 'habit') {
          const nextStatus = task.status === 'done' ? 'todo' : 'done';
          return {
            ...task,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
          };
        }

        const completionDates = task.completionDates ?? [];
        const exists = completionDates.includes(date);
        return {
          ...task,
          completionDates: exists ? completionDates.filter((item) => item !== date) : [...completionDates, date],
        };
      })
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const addWish = useCallback((wish: Omit<Wish, 'id' | 'createdAt'>) => {
    setWishes((prev) => [...prev, { ...wish, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateWish = useCallback((id: string, updates: Partial<Wish>) => {
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
  }, []);

  const deleteWish = useCallback((id: string) => {
    setWishes((prev) => prev.filter((wish) => wish.id !== id));
  }, []);

  const addCategory = useCallback((category: string) => {
    setCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
  }, []);

  const addWishCategory = useCallback((category: string) => {
    setWishCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
  }, []);

  const deleteCategory = useCallback((category: string) => {
    setCategories((prev) => prev.filter((item) => item !== category));
  }, []);

  const deleteWishCategory = useCallback((category: string) => {
    setWishCategories((prev) => prev.filter((item) => item !== category));
  }, []);

  const addDailyWish = useCallback((wish: Omit<DailyWishMessage, 'id' | 'createdAt'>) => {
    setDailyWishes((prev) => [...prev, { ...wish, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const addCustomHadith = useCallback((hadith: string) => {
    setCustomHadiths((prev) => (prev.includes(hadith) ? prev : [...prev, hadith]));
  }, []);

  const deleteCustomHadith = useCallback((hadith: string) => {
    setCustomHadiths((prev) => prev.filter((item) => item !== hadith));
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
