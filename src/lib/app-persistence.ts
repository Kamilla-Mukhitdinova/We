import { DailyWishMessage, Owner, Task, Wish } from './types';

export type PasswordMap = Record<Owner, string>;
const PRIMARY_OWNER: Owner = 'Kamilla';

function isPrimaryOwner(owner: Owner | string | null | undefined) {
  return owner === PRIMARY_OWNER;
}

export interface SharedAppSnapshot {
  tasks: Task[];
  wishes: Wish[];
  categories: string[];
  wishCategories: string[];
  dailyWishes: DailyWishMessage[];
  customHadiths: string[];
  passwords: PasswordMap;
}

interface SnapshotBackupEnvelope {
  snapshot: SharedAppSnapshot;
  savedAt: string;
}

export const LOCAL_KEYS = {
  tasks: 'twp-tasks',
  wishes: 'twp-wishes',
  activeUser: 'twp-active-user',
  categories: 'twp-categories',
  wishCategories: 'twp-wish-categories',
  dailyWishes: 'twp-daily-wishes',
  customHadiths: 'twp-custom-hadiths',
  isAuthenticated: 'twp-is-authenticated',
  passwords: 'twp-passwords',
  fontScale: 'twp-font-scale',
  snapshotBackup: 'twp-snapshot-backup',
  lastMutationAt: 'twp-last-mutation-at',
} as const;

export const DEFAULT_PASSWORDS: PasswordMap = {
  Kamilla: 'kamilla123',
  Doszhan: '',
};

const DEFAULT_SNAPSHOT: SharedAppSnapshot = {
  tasks: [],
  wishes: [],
  categories: ['Home', 'Work', 'Study'],
  wishCategories: ['Покупки', 'Учёба', 'Путешествия', 'Семья', 'Дом', 'Опыт'],
  dailyWishes: [],
  customHadiths: [],
  passwords: DEFAULT_PASSWORDS,
};

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTask(task: Task): Task {
  return {
    ...task,
    kind: task.kind ?? 'task',
    recurrence: task.recurrence ?? (task.kind === 'habit' ? 'daily' : 'none'),
    completionDates: task.completionDates ?? [],
    repeatDays: task.repeatDays ?? [],
  };
}

function normalizeWish(wish: Wish): Wish {
  return {
    ...wish,
    scope: wish.scope ?? 'personal',
  };
}

export function normalizeSharedSnapshot(snapshot?: Partial<SharedAppSnapshot> | null): SharedAppSnapshot {
  return {
    tasks: (snapshot?.tasks ?? DEFAULT_SNAPSHOT.tasks)
      .filter((task) => isPrimaryOwner(task.owner))
      .map(normalizeTask),
    wishes: (snapshot?.wishes ?? DEFAULT_SNAPSHOT.wishes)
      .filter((wish) => wish.scope === 'couple' || isPrimaryOwner(wish.owner))
      .map(normalizeWish),
    categories: snapshot?.categories?.length ? snapshot.categories : DEFAULT_SNAPSHOT.categories,
    wishCategories: snapshot?.wishCategories?.length ? snapshot.wishCategories : DEFAULT_SNAPSHOT.wishCategories,
    dailyWishes: [],
    customHadiths: snapshot?.customHadiths ?? DEFAULT_SNAPSHOT.customHadiths,
    passwords: {
      ...DEFAULT_PASSWORDS,
      Kamilla: snapshot?.passwords?.Kamilla ?? DEFAULT_PASSWORDS.Kamilla,
    },
  };
}

function hasMeaningfulSnapshotContent(snapshot: SharedAppSnapshot) {
  return (
    snapshot.tasks.length > 0 ||
    snapshot.wishes.length > 0 ||
    snapshot.dailyWishes.length > 0 ||
    snapshot.customHadiths.length > 0
  );
}

function normalizeBackupEnvelope(
  rawBackup: Partial<SharedAppSnapshot> | SnapshotBackupEnvelope | null
): SnapshotBackupEnvelope | null {
  if (!rawBackup) return null;

  if ('snapshot' in rawBackup) {
    return {
      snapshot: normalizeSharedSnapshot(rawBackup.snapshot),
      savedAt:
        typeof rawBackup.savedAt === 'string' && rawBackup.savedAt.trim().length > 0
          ? rawBackup.savedAt
          : new Date(0).toISOString(),
    };
  }

  return {
    snapshot: normalizeSharedSnapshot(rawBackup),
    savedAt: new Date(0).toISOString(),
  };
}

export function loadLocalBackup() {
  const backup = normalizeBackupEnvelope(
    loadFromStorage<Partial<SharedAppSnapshot> | SnapshotBackupEnvelope | null>(LOCAL_KEYS.snapshotBackup, null)
  );

  if (!backup) {
    return null;
  }

  return {
    ...backup,
    hasContent: hasMeaningfulSnapshotContent(backup.snapshot),
  };
}

export function loadLastLocalMutationAt() {
  return loadFromStorage<string | null>(LOCAL_KEYS.lastMutationAt, null);
}

export function markLocalMutationAt(timestamp = new Date().toISOString()) {
  localStorage.setItem(LOCAL_KEYS.lastMutationAt, JSON.stringify(timestamp));
}

export function loadLocalSnapshot(): SharedAppSnapshot {
  return normalizeSharedSnapshot({
    tasks: loadFromStorage<Task[]>(LOCAL_KEYS.tasks, []),
    wishes: loadFromStorage<Wish[]>(LOCAL_KEYS.wishes, []),
    categories: loadFromStorage<string[]>(LOCAL_KEYS.categories, DEFAULT_SNAPSHOT.categories),
    wishCategories: loadFromStorage<string[]>(LOCAL_KEYS.wishCategories, DEFAULT_SNAPSHOT.wishCategories),
    dailyWishes: loadFromStorage<DailyWishMessage[]>(LOCAL_KEYS.dailyWishes, []),
    customHadiths: loadFromStorage<string[]>(LOCAL_KEYS.customHadiths, []),
    passwords: loadFromStorage<PasswordMap>(LOCAL_KEYS.passwords, DEFAULT_PASSWORDS),
  });
}

export function saveLocalSnapshot(snapshot: SharedAppSnapshot) {
  localStorage.setItem(LOCAL_KEYS.tasks, JSON.stringify(snapshot.tasks));
  localStorage.setItem(LOCAL_KEYS.wishes, JSON.stringify(snapshot.wishes));
  localStorage.setItem(LOCAL_KEYS.categories, JSON.stringify(snapshot.categories));
  localStorage.setItem(LOCAL_KEYS.wishCategories, JSON.stringify(snapshot.wishCategories));
  localStorage.setItem(LOCAL_KEYS.dailyWishes, JSON.stringify(snapshot.dailyWishes));
  localStorage.setItem(LOCAL_KEYS.customHadiths, JSON.stringify(snapshot.customHadiths));
  localStorage.setItem(LOCAL_KEYS.passwords, JSON.stringify(snapshot.passwords));

  if (hasMeaningfulSnapshotContent(snapshot)) {
    const backupPayload: SnapshotBackupEnvelope = {
      snapshot,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_KEYS.snapshotBackup, JSON.stringify(backupPayload));
  }
}
