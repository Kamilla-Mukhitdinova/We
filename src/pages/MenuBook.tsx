import { ChangeEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BookOpenText, Check, ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { prepareImageForStorage } from '@/lib/image-storage';

type MealPlanMode = 'week' | 'month';

interface MealPlanItem {
  id: string;
  date: string;
  title: string;
  eaten: boolean;
}

const MEAL_PLAN_KEY = 'twp-meal-plan-items';

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function loadMealPlan() {
  try {
    const raw = localStorage.getItem(MEAL_PLAN_KEY);
    return raw ? (JSON.parse(raw) as MealPlanItem[]) : [];
  } catch {
    return [];
  }
}

export default function MenuBook() {
  const { recipeEntries, addRecipeEntry, deleteRecipeEntry } = useApp();
  const [title, setTitle] = useState('');
  const [recipe, setRecipe] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mealPlanMode, setMealPlanMode] = useState<MealPlanMode>('week');
  const [plannerAnchor, setPlannerAnchor] = useState(new Date());
  const [mealPlan, setMealPlan] = useState<MealPlanItem[]>(() => loadMealPlan());
  const [mealInputs, setMealInputs] = useState<Record<string, string>>({});
  const [mealRecipeSelects, setMealRecipeSelects] = useState<Record<string, string>>({});

  const entries = useMemo(
    () => [...recipeEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [recipeEntries]
  );
  const weekStart = useMemo(() => startOfWeek(plannerAnchor, { weekStartsOn: 1 }), [plannerAnchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const monthDays = useMemo(() => {
    const start = startOfMonth(plannerAnchor);
    const end = endOfMonth(plannerAnchor);
    return eachDayOfInterval({ start, end });
  }, [plannerAnchor]);
  const visibleDays = mealPlanMode === 'week' ? weekDays : monthDays;
  const eatenCount = mealPlan.filter((item) => item.eaten).length;

  const saveMealPlan = (next: MealPlanItem[]) => {
    setMealPlan(next);
    localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(next));
  };

  const getMealsForDay = (date: Date) => {
    const dateKey = toDateKey(date);
    return mealPlan.filter((item) => item.date === dateKey);
  };

  const addMealToDay = (date: Date, titleOverride?: string) => {
    const dateKey = toDateKey(date);
    const selectedRecipe = entries.find((entry) => entry.id === mealRecipeSelects[dateKey]);
    const titleValue = (titleOverride ?? selectedRecipe?.title ?? mealInputs[dateKey] ?? '').trim();
    if (!titleValue) return;

    saveMealPlan([
      ...mealPlan,
      {
        id: crypto.randomUUID(),
        date: dateKey,
        title: titleValue,
        eaten: false,
      },
    ]);
    setMealInputs((prev) => ({ ...prev, [dateKey]: '' }));
    setMealRecipeSelects((prev) => ({ ...prev, [dateKey]: '' }));
  };

  const toggleMeal = (id: string) => {
    saveMealPlan(mealPlan.map((item) => (item.id === id ? { ...item, eaten: !item.eaten } : item)));
  };

  const deleteMeal = (id: string) => {
    saveMealPlan(mealPlan.filter((item) => item.id !== id));
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await prepareImageForStorage(file);
      setImageUrl(dataUrl);
    } catch {
      toast.error('Не удалось сохранить это изображение');
    } finally {
      event.target.value = '';
    }
  };

  const handleAddRecipe = () => {
    if (!title.trim() || !recipe.trim()) return;

    addRecipeEntry({
      title: title.trim(),
      recipe: recipe.trim(),
      imageUrl: imageUrl || undefined,
    });

    setTitle('');
    setRecipe('');
    setImageUrl(null);
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border bg-card p-6"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -top-6 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold">Меню</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ваши блюда, рецепты и фото в одном месте.</p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="planner-surface rounded-[1.8rem] border bg-card p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-display text-2xl font-extrabold">План питания</h3>
            <p className="mt-1 text-sm text-muted-foreground">Распределяйте блюда по дням и отмечайте, что уже поели.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-2xl bg-secondary/70 p-1">
              <button
                onClick={() => setMealPlanMode('week')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${mealPlanMode === 'week' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                Неделя
              </button>
              <button
                onClick={() => setMealPlanMode('month')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${mealPlanMode === 'month' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                Месяц
              </button>
            </div>
            <div className="flex rounded-2xl border bg-background p-1">
              <button
                onClick={() => setPlannerAnchor((date) => (mealPlanMode === 'week' ? addDays(date, -7) : subMonths(date, 1)))}
                className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPlannerAnchor(new Date())}
                className="rounded-xl px-3 py-2 text-sm font-semibold hover:bg-secondary"
              >
                Сегодня
              </button>
              <button
                onClick={() => setPlannerAnchor((date) => (mealPlanMode === 'week' ? addDays(date, 7) : addMonths(date, 1)))}
                className="rounded-xl p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <p className="text-xs text-muted-foreground">Период</p>
            <p className="mt-1 text-sm font-bold">
              {mealPlanMode === 'week'
                ? `${format(weekDays[0], 'd MMM', { locale: ru })} - ${format(weekDays[6], 'd MMM', { locale: ru })}`
                : format(plannerAnchor, 'LLLL yyyy', { locale: ru })}
            </p>
          </div>
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <p className="text-xs text-muted-foreground">Запланировано</p>
            <p className="mt-1 text-sm font-bold">{mealPlan.length} блюд</p>
          </div>
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <p className="text-xs text-muted-foreground">Уже поели</p>
            <p className="mt-1 text-sm font-bold text-primary">{eatenCount}</p>
          </div>
        </div>

        <div className={`mt-5 grid gap-3 ${mealPlanMode === 'week' ? 'lg:grid-cols-7' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {visibleDays.map((day) => {
            const dayKey = toDateKey(day);
            const meals = getMealsForDay(day);
            const outsideMonth = mealPlanMode === 'month' && !isSameMonth(day, plannerAnchor);

            return (
              <div key={dayKey} className={`rounded-2xl border bg-background p-3 ${outsideMonth ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {format(day, 'EEE', { locale: ru })}
                    </p>
                    <p className="mt-1 text-xl font-extrabold">{format(day, 'd')}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground">
                    {meals.filter((meal) => meal.eaten).length}/{meals.length}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {meals.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      Пусто
                    </div>
                  ) : (
                    meals.map((meal) => (
                      <div key={meal.id} className={`flex items-center gap-2 rounded-xl px-2 py-2 ${meal.eaten ? 'bg-primary/10' : 'bg-secondary/40'}`}>
                        <button
                          onClick={() => toggleMeal(meal.id)}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            meal.eaten ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 text-muted-foreground'
                          }`}
                          title={meal.eaten ? 'Уже поели' : 'Отметить, что поели'}
                        >
                          {meal.eaten ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${meal.eaten ? 'text-primary line-through' : ''}`}>
                          {meal.title}
                        </span>
                        <button onClick={() => deleteMeal(meal.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 space-y-1.5 border-t pt-2">
                  {entries.length > 0 && (
                    <Select
                      value={mealRecipeSelects[dayKey] || undefined}
                      onValueChange={(value) => {
                        setMealRecipeSelects((prev) => ({ ...prev, [dayKey]: value }));
                        setMealInputs((prev) => ({ ...prev, [dayKey]: '' }));
                      }}
                    >
                      <SelectTrigger className="h-8 rounded-lg border-border/70 bg-secondary/25 px-2 text-[11px] text-muted-foreground shadow-none focus:ring-1 focus:ring-primary/20">
                        <SelectValue placeholder="Выбрать рецепт" />
                      </SelectTrigger>
                      <SelectContent>
                        {entries.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-1.5">
                  <input
                    value={mealInputs[dayKey] ?? ''}
                    onChange={(event) => {
                      setMealInputs((prev) => ({ ...prev, [dayKey]: event.target.value }));
                      setMealRecipeSelects((prev) => ({ ...prev, [dayKey]: '' }));
                    }}
                    placeholder={entries.length > 0 ? 'Или своё блюдо' : 'Блюдо'}
                    className="h-8 min-w-0 flex-1 rounded-lg border-border/70 bg-secondary/20 px-2 text-[11px] outline-none focus:border-primary/30"
                    onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addMealToDay(day))}
                  />
                  <button
                    onClick={() => addMealToDay(day)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                    title="Добавить блюдо"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  </div>
                  </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.8rem] border bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-primary" />
          <h3 className="font-display text-2xl font-bold">Книга рецептов</h3>
        </div>

        <Tabs defaultValue="create" className="mt-4 space-y-3">
          <TabsList className="h-auto rounded-xl bg-secondary/60 p-1">
            <TabsTrigger value="create" className="rounded-lg px-3 py-1.5 text-xs">Добавить</TabsTrigger>
            <TabsTrigger value="view" className="rounded-lg px-3 py-1.5 text-xs">Смотреть</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-0 space-y-3 rounded-xl border bg-secondary/20 p-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название блюда"
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
            />
            <textarea
              value={recipe}
              onChange={(event) => setRecipe(event.target.value)}
              placeholder="Напишите рецепт"
              className="min-h-40 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            />

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <ImagePlus className="h-4 w-4" />
              Прикрепить фото
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            {imageUrl ? (
              <div className="relative w-fit">
                <img src={imageUrl} alt="Рецепт" className="h-32 w-32 rounded-xl object-cover" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ) : null}

            <button
              onClick={handleAddRecipe}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Сохранить рецепт
            </button>
          </TabsContent>

          <TabsContent value="view" className="mt-0 space-y-3 rounded-xl border bg-secondary/20 p-4">
            {entries.length === 0 ? (
              <div className="rounded-xl bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                Пока здесь нет рецептов
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="overflow-hidden rounded-[1.4rem] border bg-background">
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.title} className="h-52 w-full object-cover" />
                  ) : null}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold">{entry.title}</h4>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.recipe}</p>
                      </div>
                      <button
                        onClick={() => deleteRecipeEntry(entry.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                        title="Удалить рецепт"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </motion.section>
    </div>
  );
}
