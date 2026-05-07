import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  GripVertical,
  ImagePlus,
  PencilLine,
  Save,
  Sparkles,
  StickyNote,
  SunMedium,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import defaultHeroImage from '@/assets/dashboard-serenity-garden.png';
import { useApp } from '@/lib/store';
import { getTaskStatusForDate, isTaskForDate, toDateKey } from '@/lib/task-helpers';
import { Owner } from '@/lib/types';
import { getTaskCategoryIconSpec, TaskCategoryIconKey } from '@/lib/task-category-icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { prepareImageForStorage } from '@/lib/image-storage';

const DEFAULT_HADITHS = [
  'Лучший из вас тот, кто лучше всего относится к своей семье.',
  'Поистине, с трудностью приходит облегчение.',
  'Аллах любит, когда вы делаете дело красиво и с искренностью.',
  'Улыбка для брата твоего является садака.',
  'Сильный не тот, кто побеждает в борьбе, а тот, кто владеет собой в гневе.',
  'Пусть слова ваши будут мягкими, а намерения чистыми.',
  'Тот, кто благодарит людей, благодарит и Аллаха.',
];

const HERO_LABEL_KEY = 'twp-dashboard-hero-label';
const HERO_QUOTE_KEY = 'twp-dashboard-hero-quote';
const HERO_IMAGE_KEY = 'twp-dashboard-hero-image-v2';
const DASHBOARD_NOTE_KEY = 'twp-dashboard-note';
const DEFAULT_HERO_LABEL = 'Дэшборд';
const DEFAULT_HERO_QUOTE =
  'Воистину, Аллах не меняет положения людей, пока они не изменят самих себя. Начни с себя — и Аллах откроет путь к лучшему.';

function ownerMatches(rawOwner: string | null | undefined, target: Owner) {
  const owner = String(rawOwner ?? '').trim().toLowerCase();
  if (!owner) return false;

  const kamillaAliases = ['kamilla', 'камилла'];
  const doszhanAliases = ['doszhan', 'досжан', 'досжан'];

  return target === 'Kamilla'
    ? kamillaAliases.some((alias) => owner.includes(alias))
    : doszhanAliases.some((alias) => owner.includes(alias));
}

function getDailyIndex(length: number) {
  const now = new Date();
  const day = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return day % length;
}

function getCategoryMeta(
  category: string,
  taskCategoryIcons: Record<string, TaskCategoryIconKey>
): { icon: LucideIcon; bg: string; text: string; label: string } {
  const iconKey = taskCategoryIcons[category] ?? 'generic';
  const spec = getTaskCategoryIconSpec(iconKey);
  if (category === 'Home') return { ...spec, label: 'Дом' };
  if (category === 'Work') return { ...spec, label: 'Работа' };
  if (category === 'Study') return { ...spec, label: 'Учёба' };
  return { ...spec, label: category };
}

export default function Dashboard() {
  const {
    activeUser,
    tasks,
    categories,
    reorderCategory,
    taskOrderByCategory,
    reorderTaskInCategory,
    toggleTaskForDate,
    customHadiths,
    taskCategoryIcons,
    taskCategoryImages,
    refreshSharedData,
  } = useApp();
  const [dailyHadith, setDailyHadith] = useState('');
  const [isHadithExpanded, setIsHadithExpanded] = useState(false);
  const [isHeroDialogOpen, setIsHeroDialogOpen] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedTaskOrderId, setDraggedTaskOrderId] = useState<string | null>(null);
  const [heroLabel, setHeroLabel] = useState(() => localStorage.getItem(HERO_LABEL_KEY) || DEFAULT_HERO_LABEL);
  const [heroQuote, setHeroQuote] = useState(() => localStorage.getItem(HERO_QUOTE_KEY) || DEFAULT_HERO_QUOTE);
  const [heroImage, setHeroImage] = useState(() => localStorage.getItem(HERO_IMAGE_KEY) || defaultHeroImage);
  const [dashboardNote, setDashboardNote] = useState(() => localStorage.getItem(DASHBOARD_NOTE_KEY) || '');
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);

  const myTodayTasks = useMemo(
    () =>
      tasks.filter(
        (task) => ownerMatches(task.owner, activeUser) && isTaskForDate(task, todayDate)
      ),
    [activeUser, tasks, todayDate]
  );

  const todayDone = myTodayTasks.filter((task) => getTaskStatusForDate(task, todayDate) === 'done').length;
  const todayPercent = myTodayTasks.length > 0 ? Math.round((todayDone / myTodayTasks.length) * 100) : 0;
  const myTodayByCategory = useMemo(() => {
    const sortByCategoryOrder = (category: string, items: typeof myTodayTasks) => {
      const order = taskOrderByCategory[category] ?? [];
      return [...items].sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    };

    const map = new Map<string, typeof myTodayTasks>();

    categories.forEach((category) => {
      const categoryTasks = myTodayTasks.filter((task) => task.category === category);
      if (categoryTasks.length > 0) map.set(category, sortByCategoryOrder(category, categoryTasks));
    });

    myTodayTasks
      .filter((task) => !map.has(task.category))
      .forEach((task) => {
        const current = map.get(task.category) ?? [];
        map.set(task.category, sortByCategoryOrder(task.category, [...current, task]));
      });

    return Array.from(map.entries());
  }, [categories, myTodayTasks, taskOrderByCategory]);

  useEffect(() => {
    void refreshSharedData();
  }, [refreshSharedData]);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `daily-hadith-${todayKey}`;
    const cached = localStorage.getItem(storageKey);
    const fallbackPool = [...DEFAULT_HADITHS, ...customHadiths];

    if (cached) {
      setDailyHadith(cached);
      return;
    }

    const dailyNumber = (getDailyIndex(40) % 40) + 1;
    const endpoints = [
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/rus-nawawi/${dailyNumber}.json`,
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/russian-nawawi/${dailyNumber}.json`,
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-nawawi/${dailyNumber}.json`,
    ];

    const resolveText = (data: unknown) => {
      const payload = data as {
        hadiths?: Array<{ text?: string }>;
        hadith?: { text?: string };
        text?: string;
      };

      return payload?.hadiths?.[0]?.text || payload?.hadith?.text || payload?.text || '';
    };

    const fetchSequentially = async () => {
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;
          const data = await response.json();
          const text = resolveText(data);
          if (text) return text;
        } catch {
          continue;
        }
      }

      return fallbackPool[getDailyIndex(fallbackPool.length)];
    };

    fetchSequentially().then((resolved) => {
      if (!cancelled) {
        setDailyHadith(resolved);
        localStorage.setItem(storageKey, resolved);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [customHadiths, todayKey]);

  useEffect(() => {
    setIsHadithExpanded(false);
  }, [dailyHadith]);

  useEffect(() => {
    localStorage.setItem(HERO_LABEL_KEY, heroLabel);
  }, [heroLabel]);

  useEffect(() => {
    localStorage.setItem(HERO_QUOTE_KEY, heroQuote);
  }, [heroQuote]);

  useEffect(() => {
    localStorage.setItem(HERO_IMAGE_KEY, heroImage);
  }, [heroImage]);

  const isLongHadith = dailyHadith.length > 180;
  const hadithPreview = isLongHadith ? `${dailyHadith.slice(0, 180).trim()}...` : dailyHadith;

  const handleHeroImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await prepareImageForStorage(file);
      setHeroImage(dataUrl);
    } catch {
      toast.error('Не удалось сохранить это изображение');
    } finally {
      event.target.value = '';
    }
  };

  const resetHero = () => {
    setHeroLabel(DEFAULT_HERO_LABEL);
    setHeroQuote(DEFAULT_HERO_QUOTE);
    setHeroImage(defaultHeroImage);
  };

  const handleCategoryDrop = (targetCategory: string) => {
    if (!draggedCategory || draggedCategory === targetCategory) return;
    reorderCategory(draggedCategory, targetCategory);
    setDraggedCategory(null);
  };

  const handleTaskOrderDrop = (category: string, targetTaskId: string) => {
    if (!draggedTaskOrderId || draggedTaskOrderId === targetTaskId) return;
    reorderTaskInCategory(category, draggedTaskOrderId, targetTaskId);
    setDraggedTaskOrderId(null);
  };

  const saveDashboardNote = () => {
    const note = dashboardNote.trim();
    if (!note) {
      localStorage.removeItem(DASHBOARD_NOTE_KEY);
      setDashboardNote('');
      toast.success('Заметка очищена');
      return;
    }

    localStorage.setItem(DASHBOARD_NOTE_KEY, note);
    setDashboardNote(note);
    toast.success('Заметка сохранена');
  };

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute -left-24 top-8 -z-10 h-72 w-72 rounded-full bg-emerald-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-32 -z-10 h-80 w-80 rounded-full bg-rose-200/35 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-[34rem] -z-10 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="planner-surface overflow-hidden rounded-[1.5rem] border bg-card/92 backdrop-blur"
      >
        <div className="grid items-center gap-5 p-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                {heroLabel}
              </div>
              <button
                onClick={() => setIsHeroDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border bg-background/85 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-secondary hover:text-foreground"
              >
                <PencilLine className="h-4 w-4" />
                Изменить
              </button>
            </div>
            <h2 className="mt-4 max-w-3xl font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
              {heroQuote}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-background/75 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Сегодня</p>
                <p className="mt-1 text-lg font-extrabold">{format(todayDate, 'd MMMM', { locale: ru })}</p>
              </div>
              <div className="rounded-2xl border bg-background/75 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Фокус</p>
                <p className="mt-1 text-lg font-extrabold">{myTodayTasks.length}</p>
              </div>
              <div className="rounded-2xl border bg-background/75 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Прогресс</p>
                <p className="mt-1 text-lg font-extrabold text-primary">{todayPercent}%</p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:flex justify-end">
            <img
              src={heroImage}
              alt="Dashboard hero"
              className="h-48 w-72 rounded-[1.5rem] border object-cover shadow-xl shadow-slate-900/15"
            />
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="planner-surface rounded-[1.5rem] border bg-card/95 p-6 shadow-xl shadow-slate-900/5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-3xl font-extrabold">Мои задачи и привычки на сегодня</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {myTodayTasks.length} пунктов на {format(new Date(), 'd MMMM', { locale: ru })}
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 px-4 py-2 text-sm font-extrabold text-primary">
              {todayPercent}%
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-secondary/35 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Сегодня выполнено <span className="font-semibold text-foreground">{todayDone}</span> из{' '}
              <span className="font-semibold text-foreground">{myTodayTasks.length}</span>
            </p>
            <span className="rounded-xl bg-background px-3 py-1 text-xs font-bold text-primary shadow-sm">
              {todayPercent}%
            </span>
          </div>

          {myTodayTasks.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-secondary/40 px-5 py-10 text-center text-sm text-muted-foreground">
              На сегодня пока нет задач и привычек. Можно спокойно спланировать день.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {myTodayByCategory.map(([category, categoryTasks]) => {
                const meta = getCategoryMeta(category, taskCategoryIcons);
                const categoryImage = taskCategoryImages[category];
                const Icon = meta.icon;
                const doneCount = categoryTasks.filter((task) => getTaskStatusForDate(task, todayDate) === 'done').length;
                const categoryPercent = categoryTasks.length > 0 ? Math.round((doneCount / categoryTasks.length) * 100) : 0;

                return (
                  <div
                    key={category}
                    className="rounded-[1.5rem] border bg-background/70 p-4"
                    onDragOver={(event) => {
                      if (!categories.includes(category) || !draggedCategory) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!categories.includes(category) || !draggedCategory) return;
                      event.preventDefault();
                      handleCategoryDrop(category);
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {categoryImage ? (
                          <img src={categoryImage} alt="" className="h-10 w-10 rounded-2xl object-cover" />
                        ) : (
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${meta.bg} ${meta.text}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {doneCount} из {categoryTasks.length} выполнено
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {categories.includes(category) && (
                          <button
                            draggable
                            onDragStart={() => setDraggedCategory(category)}
                            onDragEnd={() => setDraggedCategory(null)}
                            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            title="Перетащите, чтобы изменить порядок категории"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        )}
                        <div className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                          {categoryPercent}%
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {categoryTasks.map((task) => {
                        const taskStatus = getTaskStatusForDate(task, todayDate);

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDraggedTaskOrderId(task.id)}
                            onDragEnd={() => setDraggedTaskOrderId(null)}
                            onDragOver={(event) => {
                              if (!draggedTaskOrderId || draggedTaskOrderId === task.id) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              if (!draggedTaskOrderId || draggedTaskOrderId === task.id) return;
                              event.preventDefault();
                              event.stopPropagation();
                              handleTaskOrderDrop(category, task.id);
                            }}
                            className="rounded-[1.4rem] bg-secondary/25 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleTaskForDate(task.id, todayKey)}
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    taskStatus === 'done'
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-muted-foreground/30 text-transparent hover:border-emerald-600 hover:text-emerald-600'
                                  }`}
                                  title="Отметить выполненным"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <div>
                                  <p className={`text-sm font-semibold ${taskStatus === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Задача
                                  </p>
                                </div>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${taskStatus === 'done' ? 'bg-emerald-600 text-white' : 'bg-background text-muted-foreground'}`}>
                                {taskStatus === 'done' ? 'Сделано' : 'В плане'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.article>

        <div className="grid gap-4">
          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="planner-surface rounded-[1.5rem] border bg-card/95 p-6 shadow-xl shadow-slate-900/5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold">Моя заметка</h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <StickyNote className="h-5 w-5" />
              </div>
            </div>

            <Textarea
              value={dashboardNote}
              onChange={(event) => setDashboardNote(event.target.value)}
              placeholder="Напишите короткую заметку, мысль или напоминание на сегодня..."
              rows={6}
              className="mt-5 resize-none rounded-[1.3rem] bg-secondary/25"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {localStorage.getItem(DASHBOARD_NOTE_KEY) ? 'Сохранено на дэшборде' : 'Пока не сохранено'}
              </p>
              <div className="flex items-center gap-2">
                {localStorage.getItem(DASHBOARD_NOTE_KEY) && (
                  <button
                    onClick={() => {
                      localStorage.removeItem(DASHBOARD_NOTE_KEY);
                      setDashboardNote('');
                      toast.success('Заметка удалена');
                    }}
                    className="rounded-xl border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    Очистить
                  </button>
                )}
                <button
                  onClick={saveDashboardNote}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Save className="h-4 w-4" />
                  Сохранить
                </button>
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="planner-surface rounded-[1.5rem] border bg-card/95 p-6 shadow-xl shadow-slate-900/5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold">Хадис дня</h3>
                <p className="mt-1 text-sm text-muted-foreground">Меняется каждый день</p>
              </div>
              <SunMedium className="h-5 w-5 text-accent" />
            </div>
            <div className="quote-border mt-5 pl-4">
              <p className="text-sm leading-7 text-foreground/80">
                «{dailyHadith ? (isHadithExpanded ? dailyHadith : hadithPreview) : 'Загружаем хадис дня...'}»
              </p>
            </div>
            {isLongHadith && (
              <button
                onClick={() => setIsHadithExpanded((value) => !value)}
                className="mt-4 rounded-full bg-secondary px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {isHadithExpanded ? 'Скрыть часть хадиса' : 'Читать полностью'}
              </button>
            )}
          </motion.article>
        </div>
      </section>

      <Dialog open={isHeroDialogOpen} onOpenChange={setIsHeroDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[1.8rem]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Настроить дэшборд</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Подпись</p>
              <Input value={heroLabel} onChange={(event) => setHeroLabel(event.target.value)} placeholder="Например: Мой дэшборд" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Надпись</p>
              <Textarea
                rows={5}
                value={heroQuote}
                onChange={(event) => setHeroQuote(event.target.value)}
                placeholder="Напишите свой текст для дэшборда"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Картинка</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary">
                  <ImagePlus className="h-4 w-4" />
                  Загрузить новую
                  <input type="file" accept="image/*" onChange={handleHeroImageChange} className="hidden" />
                </label>
                <button
                  onClick={() => setHeroImage(defaultHeroImage)}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                  Вернуть стандартную
                </button>
              </div>
              <img src={heroImage} alt="Предпросмотр дэшборда" className="h-48 w-full rounded-[1.5rem] object-cover" />
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                onClick={resetHero}
                className="rounded-xl border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Сбросить всё
              </button>
              <button
                onClick={() => setIsHeroDialogOpen(false)}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Готово
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
