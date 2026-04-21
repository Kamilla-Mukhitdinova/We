import { BookOpenText, BriefcaseBusiness, Dumbbell, Heart, Home, Landmark, Sparkles, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TaskCategoryIconKey =
  | 'home'
  | 'work'
  | 'study'
  | 'sport'
  | 'health'
  | 'food'
  | 'star'
  | 'generic';

type TaskCategoryIconSpec = {
  icon: LucideIcon;
  bg: string;
  text: string;
  label: string;
};

const TASK_CATEGORY_ICON_SPECS: Record<TaskCategoryIconKey, TaskCategoryIconSpec> = {
  home: { icon: Home, bg: 'bg-amber-100', text: 'text-amber-700', label: 'Дом' },
  work: { icon: BriefcaseBusiness, bg: 'bg-sky-100', text: 'text-sky-700', label: 'Работа' },
  study: { icon: BookOpenText, bg: 'bg-violet-100', text: 'text-violet-700', label: 'Учеба' },
  sport: { icon: Dumbbell, bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Спорт' },
  health: { icon: Heart, bg: 'bg-rose-100', text: 'text-rose-700', label: 'Здоровье' },
  food: { icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-700', label: 'Еда' },
  star: { icon: Sparkles, bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Важное' },
  generic: { icon: Landmark, bg: 'bg-slate-100', text: 'text-slate-700', label: 'Другое' },
};

export const TASK_CATEGORY_ICON_OPTIONS: Array<{ value: TaskCategoryIconKey; label: string }> = [
  { value: 'home', label: TASK_CATEGORY_ICON_SPECS.home.label },
  { value: 'work', label: TASK_CATEGORY_ICON_SPECS.work.label },
  { value: 'study', label: TASK_CATEGORY_ICON_SPECS.study.label },
  { value: 'sport', label: TASK_CATEGORY_ICON_SPECS.sport.label },
  { value: 'health', label: TASK_CATEGORY_ICON_SPECS.health.label },
  { value: 'food', label: TASK_CATEGORY_ICON_SPECS.food.label },
  { value: 'star', label: TASK_CATEGORY_ICON_SPECS.star.label },
  { value: 'generic', label: TASK_CATEGORY_ICON_SPECS.generic.label },
];

export function getTaskCategoryIconSpec(iconKey: TaskCategoryIconKey) {
  return TASK_CATEGORY_ICON_SPECS[iconKey] ?? TASK_CATEGORY_ICON_SPECS.generic;
}

export function inferTaskCategoryIconKey(category: string): TaskCategoryIconKey {
  const lower = category.trim().toLowerCase();

  if (category === 'Home' || lower.includes('дом')) return 'home';
  if (category === 'Work' || lower.includes('раб')) return 'work';
  if (category === 'Study' || lower.includes('уч') || lower.includes('study')) return 'study';
  if (lower.includes('спорт') || lower.includes('gym') || lower.includes('трен')) return 'sport';
  if (lower.includes('здор') || lower.includes('health')) return 'health';
  if (lower.includes('еда') || lower.includes('food') || lower.includes('кух')) return 'food';

  return 'generic';
}
