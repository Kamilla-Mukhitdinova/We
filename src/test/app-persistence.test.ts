import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORDS,
  LOCAL_KEYS,
  loadLastLocalMutationAt,
  loadLocalBackup,
  loadLocalSnapshot,
  markLocalMutationAt,
  saveLocalSnapshot,
  shouldPromoteLocalSnapshotDuringHydration,
} from '@/lib/app-persistence';
import type { SharedAppSnapshot } from '@/lib/app-persistence';

const fullSnapshot: SharedAppSnapshot = {
  tasks: [
    {
      id: 'task-1',
      title: 'Test task',
      category: 'Home',
      kind: 'task',
      recurrence: 'none',
      repeatDays: [],
      completionDates: [],
      status: 'todo',
      owner: 'Kamilla',
      createdAt: '2026-04-03T10:00:00.000Z',
    },
  ],
  wishes: [],
  categories: ['Home', 'Work', 'Study'],
  wishCategories: ['Покупки'],
  dailyWishes: [],
  customHadiths: [],
  passwords: DEFAULT_PASSWORDS,
};

describe('app persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not resurrect deleted tasks from backup when current local data is empty on purpose', () => {
    saveLocalSnapshot(fullSnapshot);

    window.localStorage.setItem(LOCAL_KEYS.tasks, JSON.stringify([]));
    window.localStorage.setItem(LOCAL_KEYS.wishes, JSON.stringify([]));
    window.localStorage.setItem(LOCAL_KEYS.dailyWishes, JSON.stringify([]));
    window.localStorage.setItem(LOCAL_KEYS.customHadiths, JSON.stringify([]));

    const restored = loadLocalSnapshot();

    expect(restored.tasks).toHaveLength(0);
  });

  it('stores backup metadata with a save timestamp', () => {
    saveLocalSnapshot(fullSnapshot);

    const backup = loadLocalBackup();

    expect(backup?.hasContent).toBe(true);
    expect(backup?.savedAt).toMatch(/T/);
    expect(backup?.snapshot.tasks[0].id).toBe('task-1');
  });

  it('stores the last explicit local mutation timestamp', () => {
    markLocalMutationAt('2026-04-03T12:00:00.000Z');

    expect(loadLastLocalMutationAt()).toBe('2026-04-03T12:00:00.000Z');
    expect(window.localStorage.getItem(LOCAL_KEYS.lastMutationAt)).toContain('2026-04-03T12:00:00.000Z');
  });

  it('prefers newer local data over older remote snapshot during hydration', () => {
    saveLocalSnapshot(fullSnapshot);
    markLocalMutationAt('2026-04-03T12:00:00.000Z');

    const shouldPromote = shouldPromoteLocalSnapshotDuringHydration({
      remoteSnapshot: {
        ...fullSnapshot,
        tasks: [],
      },
      remoteUpdatedAt: '2026-04-03T11:00:00.000Z',
      localBackup: loadLocalBackup(),
      lastLocalMutationAt: loadLastLocalMutationAt(),
      startedAtVersion: 2,
      currentLocalChangeVersion: 2,
    });

    expect(shouldPromote).toBe(true);
  });

  it('does not replace newer remote data with stale local snapshot', () => {
    const shouldPromote = shouldPromoteLocalSnapshotDuringHydration({
      remoteSnapshot: fullSnapshot,
      remoteUpdatedAt: '2026-04-03T13:00:00.000Z',
      localBackup: {
        snapshot: fullSnapshot,
        savedAt: '2026-04-03T10:00:00.000Z',
        hasContent: true,
      },
      lastLocalMutationAt: '2026-04-03T10:00:00.000Z',
      startedAtVersion: 2,
      currentLocalChangeVersion: 2,
    });

    expect(shouldPromote).toBe(false);
  });
});
