import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import { Task, TaskStatus } from './types';

export function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function getTaskBaseDate(task: Task) {
  return task.dueDateTime ? new Date(task.dueDateTime) : new Date(task.createdAt);
}

export function isHabit(task: Task) {
  return task.kind === 'habit';
}

export function isHabitScheduledOn(task: Task, date: Date) {
  if (!isHabit(task)) return false;

  const baseDate = startOfDay(getTaskBaseDate(task));
  const targetDate = startOfDay(date);
  if (isBefore(targetDate, baseDate)) return false;

  const recurrence = task.recurrence ?? 'daily';
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return targetDate.getDay() >= 1 && targetDate.getDay() <= 5;
  if (recurrence === 'custom') return (task.repeatDays ?? []).includes(targetDate.getDay());
  return isSameDay(baseDate, targetDate);
}

export function isTaskForDate(task: Task, date: Date) {
  if (isHabit(task)) return isHabitScheduledOn(task, date);
  const baseDate = task.dueDateTime ? new Date(task.dueDateTime) : new Date(task.createdAt);
  return isSameDay(baseDate, date);
}

export function getTaskStatusForDate(task: Task, date: Date): TaskStatus {
  if (!isHabit(task)) return task.status;
  return (task.completionDates ?? []).includes(toDateKey(date)) ? 'done' : 'todo';
}
