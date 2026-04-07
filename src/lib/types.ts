export type Owner = 'Kamilla' | 'Doszhan';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type WishStatus = 'planned' | 'achieved';
export type WishScope = 'personal' | 'couple';
export type TaskKind = 'task' | 'habit';
export type HabitRecurrence = 'none' | 'daily' | 'weekdays' | 'custom';

export type DefaultCategory = 'Home' | 'Work' | 'Study';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  kind: TaskKind;
  recurrence?: HabitRecurrence;
  repeatDays?: number[];
  completionDates?: string[];
  status: TaskStatus;
  dueDateTime?: string;
  owner: Owner;
  createdAt: string;
  completedAt?: string;
}

export interface Wish {
  id: string;
  title: string;
  notes?: string;
  imageUrl?: string;
  category?: string;
  owner: Owner;
  scope: WishScope;
  status: WishStatus;
  createdAt: string;
  achievedAt?: string;
}

export interface DailyWishMessage {
  id: string;
  from: Owner;
  to: Owner;
  message: string;
  date: string;
  createdAt: string;
}

export interface HomePurchase {
  id: string;
  title: string;
  notes?: string;
  imageUrl?: string;
  owner: Owner;
  isRecurring: boolean;
  status: 'todo' | 'done';
  createdAt: string;
}

export interface DailyReflection {
  id: string;
  owner: Owner;
  date: string; // yyyy-MM-dd
  text: string;
  updatedAt: string;
}

export type ViewFilter = 'all' | 'my' | 'partner';
export type PeriodFilter = 'today' | 'week' | 'all';
