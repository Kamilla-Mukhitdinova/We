import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  Home,
  ImagePlus,
  Landmark,
  PencilLine,
  Sparkles,
  SunMedium,
  Trash2,
} from 'lucide-react';
import defaultHeroImage from '@/assets/dashboard-serenity-garden.png';
import { useApp } from '@/lib/store';
import { getTaskStatusForDate, isTaskForDate, toDateKey } from '@/lib/task-helpers';
import { Owner } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
const DEFAULT_HERO_LABEL = 'Дэшборд';
const DEFAULT_HERO_QUOTE =
  'Воистину, Аллах не меняет положения людей, пока они не изменят самих себя. Начни с себя — и Аллах откроет путь к лучшему.';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });
}

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
  const [isHeroDialogOpen, setIsHeroDialogOpen] = useState(false);
  const [heroLabel, setHeroLabel] = useState(() => localStorage.getItem(HERO_LABEL_KEY) || DEFAULT_HERO_LABEL);
  const [heroQuote, setHeroQuote] = useState(() => localStorage.getItem(HERO_QUOTE_KEY) || DEFAULT_HERO_QUOTE);
  const [heroImage, setHeroImage] = useState(() => localStorage.getItem(HERO_IMAGE_KEY) || defaultHeroImage);
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);

  const myTodayTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.kind === 'task' && ownerMatches(task.owner, activeUser) && isTaskForDate(task, todayDate)
      ),
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
      const dataUrl = await fileToDataUrl(file);
      setHeroImage(dataUrl);
    } finally {
      event.target.value = '';
    }
  };

  const resetHero = () => {
    setHeroLabel(DEFAULT_HERO_LABEL);
    setHeroQuote(DEFAULT_HERO_QUOTE);
    setHeroImage(defaultHeroImage);
  };

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
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/85 px-4 py-2 text-xs font-medium text-primary shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                {heroLabel}
              </div>
              <button
                onClick={() => setIsHeroDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border bg-background/85 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-secondary hover:text-foreground"
              >
                <PencilLine className="h-4 w-4" />
                Изменить
              </button>
            </div>
            <h2 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {heroQuote}
            </h2>
          </div>
          <div className="relative hidden lg:flex justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-400/15 blur-3xl" />
            <img src={heroImage} alt="Dashboard hero" className="relative h-72 w-auto rounded-[2rem] object-cover shadow-xl opacity-95" />
          </div>
        </div>
      </motion.section>

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
