import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  Home,
  Landmark,
  Percent,
  Sparkles,
  SunMedium,
  Target,
} from 'lucide-react';
import coupleImg from '@/assets/dashboard-couple-romantic-v2.png';
import { useApp } from '@/lib/store';
import { getTaskStatusForDate, isTaskForDate, toDateKey } from '@/lib/task-helpers';
import { Owner } from '@/lib/types';

const DEFAULT_HADITHS = [
  'Лучший из вас тот, кто лучше всего относится к своей семье.',
  'Поистине, с трудностью приходит облегчение.',
  'Аллах любит, когда вы делаете дело красиво и с искренностью.',
  'Улыбка для брата твоего является садака.',
  'Сильный не тот, кто побеждает в борьбе, а тот, кто владеет собой в гневе.',
  'Пусть слова ваши будут мягкими, а намерения чистыми.',
  'Тот, кто благодарит людей, благодарит и Аллаха.',
];

function ownerMatches(rawOwner: string | null | undefined, target: Owner) {
  const owner = String(rawOwner ?? '').trim().toLowerCase();
  if (!owner) return false;

  const kamillaAliases = ['kamilla', 'камилла'];
  const doszhanAliases = ['doszhan', 'досжан', 'досжан'];

  return target === 'Kamilla'
    ? kamillaAliases.some((alias) => owner.includes(alias))
    : doszhanAliases.some((alias) => owner.includes(alias));
}

function buildOwnerStats(owner: Owner, taskCount: number, doneCount: number) {
  const percent = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  return { owner, total: taskCount, done: doneCount, percent };
}

function getDailyIndex(length: number) {
  const now = new Date();
  const day = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return day % length;
}

function getCategoryMeta(category: string) {
  const lower = category.toLowerCase();
  if (category === 'Home') return { icon: Home, bg: 'bg-amber-100', text: 'text-amber-700', label: 'Дом' };
  if (category === 'Work') return { icon: BriefcaseBusiness, bg: 'bg-sky-100', text: 'text-sky-700', label: 'Работа' };
  if (category === 'Study' || lower.includes('уч')) return { icon: BookOpenText, bg: 'bg-violet-100', text: 'text-violet-700', label: 'Учёба' };
  return { icon: Landmark, bg: 'bg-rose-100', text: 'text-rose-700', label: category };
}

export default function Dashboard() {
  const {
    activeUser,
    tasks,
    toggleTaskForDate,
    customHadiths,
    refreshSharedData,
  } = useApp();
  const [dailyHadith, setDailyHadith] = useState('');
  const [isHadithExpanded, setIsHadithExpanded] = useState(false);
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);

  const myTasks = tasks.filter((task) => ownerMatches(task.owner, activeUser));
  const todayDoneOverall = myTasks.filter((task) =>
      task.kind === 'habit' ? getTaskStatusForDate(task, todayDate) === 'done' : task.status === 'done'
    ).length;
  const stats = [buildOwnerStats(activeUser, myTasks.length, todayDoneOverall)];

  const myTodayTasks = useMemo(
    () => tasks.filter((task) => ownerMatches(task.owner, activeUser) && isTaskForDate(task, todayDate)),
    [activeUser, tasks, todayDate]
  );

  const todayDone = myTodayTasks.filter((task) => getTaskStatusForDate(task, todayDate) === 'done').length;
  const todayPercent = myTodayTasks.length > 0 ? Math.round((todayDone / myTodayTasks.length) * 100) : 0;
  const myTodayByCategory = useMemo(() => {
    const map = new Map<string, typeof myTodayTasks>();
    myTodayTasks.forEach((task) => {
      const current = map.get(task.category) ?? [];
      map.set(task.category, [...current, task]);
    });
    return Array.from(map.entries());
  }, [myTodayTasks]);

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

  const isLongHadith = dailyHadith.length > 180;
  const hadithPreview = isLongHadith ? `${dailyHadith.slice(0, 180).trim()}...` : dailyHadith;

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-hero relative overflow-hidden rounded-[2rem] border bg-card"
      >
        <div className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="grid items-center gap-6 p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/85 px-4 py-2 text-xs font-medium text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Наш Дэшборд 
            </div>
            <h2 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Пусть все строится из мягкости, верности, красивых намерений и маленьких дел, сделанных ради Аллаха.
            </h2>
          </div>
          <div className="relative hidden lg:flex justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-400/15 blur-3xl" />
            <img src={coupleImg} alt="Romantic Muslim couple illustration" className="relative h-72 w-auto rounded-[2rem] object-cover shadow-xl opacity-95" />
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 lg:grid-cols-2">
        {stats.map((stat, index) => (
          <motion.article
            key={stat.owner}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className={`rounded-[1.9rem] border p-6 shadow-sm ${
              stat.owner === activeUser ? 'border-primary/30 bg-primary/5' : 'bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Статистика пары</p>
                <h3 className="mt-1 font-display text-2xl font-bold">Я</h3>
              </div>
              <div className="rounded-2xl bg-background px-3 py-2 text-xs font-medium text-primary shadow-sm">
                Только ваш прогресс
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Все задачи и привычки</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatMiniCard icon={<Target className="h-4 w-4" />} label="Поставлено" value={stat.total} />
              <StatMiniCard icon={<CheckCircle2 className="h-4 w-4" />} label="Выполнено" value={stat.done} />
              <StatMiniCard icon={<Percent className="h-4 w-4" />} label="Процент" value={`${stat.percent}%`} />
            </div>
            <div className="mt-5 rounded-[1.4rem] bg-background/80 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Общий прогресс</p>
                  <p className="mt-1 text-sm font-medium text-foreground/80">
                    {stat.done} из {stat.total || 0} выполнено
                  </p>
                </div>
                <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  {stat.percent}%
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.percent}%` }}
                  transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <motion.article
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.9rem] border bg-card p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold">Мои задачи на сегодня</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {myTodayTasks.length} задач на {format(new Date(), 'd MMMM', { locale: ru })}
              </p>
            </div>
            <div className="rounded-2xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {todayPercent}%
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] bg-secondary/35 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Сегодня выполнено <span className="font-semibold text-foreground">{todayDone}</span> из{' '}
              <span className="font-semibold text-foreground">{myTodayTasks.length}</span>
            </p>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">
              {todayPercent}%
            </span>
          </div>

          {myTodayTasks.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] bg-secondary/40 px-5 py-10 text-center text-sm text-muted-foreground">
              На сегодня пока нет задач. Можно спокойно спланировать день.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {myTodayByCategory.map(([category, categoryTasks]) => {
                const meta = getCategoryMeta(category);
                const Icon = meta.icon;
                const doneCount = categoryTasks.filter((task) => getTaskStatusForDate(task, todayDate) === 'done').length;
                const categoryPercent = categoryTasks.length > 0 ? Math.round((doneCount / categoryTasks.length) * 100) : 0;

                return (
                  <div key={category} className="rounded-[1.5rem] border bg-secondary/15 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${meta.bg} ${meta.text}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {doneCount} из {categoryTasks.length} выполнено
                          </p>
                        </div>
                      </div>
                      <div className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                        {categoryPercent}%
                      </div>
                    </div>

                    <div className="space-y-3">
                      {categoryTasks.map((task) => {
                        const taskStatus = getTaskStatusForDate(task, todayDate);

                        return (
                          <div key={task.id} className="rounded-[1.4rem] bg-secondary/35 p-4">
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
                                    {task.kind === 'habit' ? 'Привычка' : 'Задача'}
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
            transition={{ delay: 0.06 }}
            className="rounded-[1.9rem] border bg-card p-6"
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
    </div>
  );
}

function StatMiniCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-[1.4rem] bg-background/90 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
