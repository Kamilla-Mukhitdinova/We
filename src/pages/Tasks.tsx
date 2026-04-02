import { useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Columns3,
  Dumbbell,
  Flame,
  Home,
  Landmark,
  Pencil,
  Plus,
  Repeat2,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Task, TaskStatus } from '@/lib/types';
import { getTaskStatusForDate, isHabit, isTaskForDate, toDateKey } from '@/lib/task-helpers';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OwnerBadge, StatusBadge } from '@/components/Badges';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { ManageCategoriesDialog } from '@/components/ManageCategoriesDialog';

type PlannerView = 'list' | 'kanban' | 'calendar';

function getPartner(owner: Task['owner']): Task['owner'] {
  return owner === 'Kamilla' ? 'Doszhan' : 'Kamilla';
}

function getLocalDate(task: Task) {
  return task.dueDateTime ? parseISO(task.dueDateTime) : undefined;
}

function translateCategory(category: string) {
  if (category === 'Home') return 'Дом';
  if (category === 'Work') return 'Работа';
  if (category === 'Study') return 'Учёба';
  return category;
}

function getCategoryMeta(category: string): { icon: LucideIcon; bg: string; text: string } {
  const lower = category.toLowerCase();
  if (category === 'Home') return { icon: Home, bg: 'bg-amber-100', text: 'text-amber-700' };
  if (category === 'Work') return { icon: BriefcaseBusiness, bg: 'bg-sky-100', text: 'text-sky-700' };
  if (category === 'Study' || lower.includes('уч')) return { icon: BookOpenText, bg: 'bg-violet-100', text: 'text-violet-700' };
  if (lower.includes('спорт')) return { icon: Dumbbell, bg: 'bg-emerald-100', text: 'text-emerald-700' };
  return { icon: Landmark, bg: 'bg-rose-100', text: 'text-rose-700' };
}

function translateRecurrence(task: Task) {
  if (task.kind !== 'habit') return 'Разовая задача';
  if (task.recurrence === 'weekdays') return 'По будням';
  if (task.recurrence === 'custom') return 'В выбранные дни';
  if (task.recurrence === 'none') return 'В конкретный день';
  return 'Каждый день';
}

function getHabitStreak(task: Task, fromDate: Date) {
  let streak = 0;

  for (let offset = 0; offset < 60; offset += 1) {
    const date = subDays(fromDate, offset);
    if (!isTaskForDate(task, date)) continue;
    if (getTaskStatusForDate(task, date) !== 'done') break;
    streak += 1;
  }

  return streak;
}

export default function Tasks() {
  const { activeUser, tasks, updateTask, toggleTaskForDate, deleteTask, categories } = useApp();
  const [plannerView, setPlannerView] = useState<PlannerView>('list');
  const [ownerFilter, setOwnerFilter] = useState<'mine' | 'partner' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [collapsedKanbanGroups, setCollapsedKanbanGroups] = useState<Record<string, boolean>>({});
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);
  const selectedDateKey = toDateKey(selectedDate);
  const partner = getPartner(activeUser);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (ownerFilter === 'mine') return task.owner === activeUser;
        if (ownerFilter === 'partner') return task.owner === partner;
        return true;
      })
      .filter((task) => (statusFilter === 'all' ? true : getTaskStatusForDate(task, todayDate) === statusFilter))
      .sort((a, b) => {
        const aDate = isHabit(a) ? 0 : a.dueDateTime ? new Date(a.dueDateTime).getTime() : 0;
        const bDate = isHabit(b) ? 0 : b.dueDateTime ? new Date(b.dueDateTime).getTime() : 0;
        return aDate - bDate || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activeUser, ownerFilter, partner, statusFilter, tasks, todayDate]);

  const todayTasks = useMemo(
    () => visibleTasks.filter((task) => isTaskForDate(task, todayDate)),
    [visibleTasks, todayDate]
  );

  const myHabits = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (task.kind !== 'habit') return false;
          if (ownerFilter === 'mine') return task.owner === activeUser;
          if (ownerFilter === 'partner') return task.owner === partner;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activeUser, ownerFilter, partner, tasks]
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Task[]>();
    categories.forEach((category) => {
      const categoryTasks = visibleTasks.filter((task) => task.category === category);
      if (categoryTasks.length > 0) map.set(category, categoryTasks);
    });
    visibleTasks
      .filter((task) => !map.has(task.category))
      .forEach((task) => {
        const current = map.get(task.category) ?? [];
        map.set(task.category, [...current, task]);
      });
    return Array.from(map.entries());
  }, [categories, visibleTasks]);

  const tasksForSelectedDate = useMemo(() => {
    return visibleTasks.filter((task) => isTaskForDate(task, selectedDate));
  }, [visibleTasks, selectedDate]);

  const tasksByCategoryOnSelectedDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasksForSelectedDate.forEach((task) => {
      const current = map.get(task.category) ?? [];
      map.set(task.category, [...current, task]);
    });
    return Array.from(map.entries());
  }, [tasksForSelectedDate]);

  const dayCompleted = tasksForSelectedDate.filter((task) => getTaskStatusForDate(task, selectedDate) === 'done').length;
  const dayProgress = tasksForSelectedDate.length > 0 ? Math.round((dayCompleted / tasksForSelectedDate.length) * 100) : 0;

  const calendarHighlightedDates = useMemo(
    () =>
      visibleTasks.flatMap((task) => {
        if (isHabit(task)) return [];
        const taskDate = getLocalDate(task);
        return taskDate ? [taskDate] : [];
      }),
    [visibleTasks]
  );

  const kanbanColumns: { status: TaskStatus; title: string; hint: string }[] = [
    { status: 'todo', title: 'К выполнению', hint: 'Стартовые задачи и привычки' },
    { status: 'in_progress', title: 'В процессе', hint: 'То, чем вы занимаетесь сейчас' },
    { status: 'done', title: 'Выполнено', hint: 'Уже закрытые пункты' },
  ];

  const handleDropToColumn = (status: TaskStatus, taskId?: string) => {
    const resolvedTaskId = taskId || draggedTaskId;
    if (!resolvedTaskId) return;
    updateTask(resolvedTaskId, { status });
    setDraggedTaskId(null);
  };

  const toggleKanbanGroup = (groupKey: string) => {
    setCollapsedKanbanGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border bg-card p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Задачи</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Список, канбан и календарь работают как единая система. Можно смотреть свои задачи, задачи партнёра или все сразу и видеть общий ритм.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCategories(true)}
              className="flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Категории
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Новая запись
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'mine', label: 'Мои' },
              { value: 'partner', label: partner },
              { value: 'all', label: 'Все' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setOwnerFilter(option.value as 'mine' | 'partner' | 'all')}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  ownerFilter === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
            {[
              { value: 'all', label: 'Все' },
              { value: 'todo', label: 'К выполнению' },
              { value: 'in_progress', label: 'В процессе' },
              { value: 'done', label: 'Выполнено' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value as 'all' | TaskStatus)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  statusFilter === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="rounded-[1.5rem] bg-secondary/35 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Сегодня</p>
                <p className="mt-1 text-sm font-semibold">{todayTasks.length} задач и привычек</p>
              </div>
              <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-primary">
                {todayTasks.filter((task) => getTaskStatusForDate(task, todayDate) === 'done').length}/{todayTasks.length || 0}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <Tabs value={plannerView} onValueChange={(value) => setPlannerView(value as PlannerView)} className="space-y-4">
        <TabsList className="h-auto rounded-[1.5rem] bg-secondary/70 p-1">
          <TabsTrigger value="list" className="rounded-[1.2rem] px-4 py-2">
            <Sparkles className="mr-2 h-4 w-4" />
            Список
          </TabsTrigger>
          <TabsTrigger value="kanban" className="rounded-[1.2rem] px-4 py-2">
            <Columns3 className="mr-2 h-4 w-4" />
            Канбан
          </TabsTrigger>
          <TabsTrigger value="calendar" className="rounded-[1.2rem] px-4 py-2">
            <CalendarDays className="mr-2 h-4 w-4" />
            Календарь
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {groupedByCategory.length === 0 ? (
            <EmptyTasksState onCreate={() => setShowCreate(true)} />
          ) : (
            <div className="space-y-4">
              {groupedByCategory.map(([category, categoryTasks], index) => (
                <motion.section
                  key={category}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-[1.8rem] border bg-card p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <CategoryHeader category={category} count={categoryTasks.length} />
                  </div>
                  <div className="space-y-3">
                    {categoryTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        referenceDate={todayDate}
                        onEdit={() => setEditingTask(task)}
                        onDelete={() => deleteTask(task.id)}
                        onToggleDone={() => toggleTaskForDate(task.id, todayKey)}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban">
          {todayTasks.length === 0 ? (
            <EmptyTasksState onCreate={() => setShowCreate(true)} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
                {kanbanColumns.map((column, index) => {
                const columnTasks = todayTasks.filter((task) => getTaskStatusForDate(task, todayDate) === column.status);
                const columnGroups = categories
                  .map((category) => [category, columnTasks.filter((task) => task.category === category)] as const)
                  .filter(([, tasksInCategory]) => tasksInCategory.length > 0);

                columnTasks
                  .filter((task) => !categories.includes(task.category))
                  .forEach((task) => {
                    const existing = columnGroups.find(([category]) => category === task.category);
                    if (existing) {
                      existing[1].push(task);
                    } else {
                      columnGroups.push([task.category, [task]]);
                    }
                  });

                  return (
                    <motion.section
                      key={column.status}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const droppedId = event.dataTransfer.getData('text/plain');
                        handleDropToColumn(column.status, droppedId);
                      }}
                      className="rounded-[1.8rem] border bg-card p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold">{column.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">{column.hint}</p>
                        </div>
                        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                          {columnTasks.length}
                        </span>
                      </div>

                      <div className="space-y-3 min-h-40 rounded-[1.4rem] bg-secondary/25 p-2">
                        {columnTasks.length === 0 ? (
                          <div className="rounded-[1.2rem] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                            Перетащите сюда карточку
                          </div>
                        ) : (
                          columnGroups.map(([category, tasksInCategory], groupIndex) => (
                            <div key={category} className="space-y-3">
                              {groupIndex > 0 && <div className="mx-1 h-px bg-border/80" />}
                              <div className="flex items-center gap-2 px-2 pt-1">
                                <div className="h-2 w-2 rounded-full bg-primary/60" />
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                  {translateCategory(category)}
                                </span>
                              </div>
                              {[
                                { key: 'habit', label: 'Привычки', items: tasksInCategory.filter((task) => task.kind === 'habit') },
                                { key: 'task', label: 'Задачи', items: tasksInCategory.filter((task) => task.kind !== 'habit') },
                              ]
                                .filter((group) => group.items.length > 0)
                                .map((group) => {
                                  const groupKey = `${column.status}-${category}-${group.key}`;
                                  const isCollapsed = !!collapsedKanbanGroups[groupKey];

                                  return (
                                    <div key={group.key} className="rounded-[1.2rem] bg-background/75 p-2 shadow-sm">
                                      <button
                                        onClick={() => toggleKanbanGroup(groupKey)}
                                        className="flex w-full items-center justify-between gap-3 rounded-[1rem] px-2 py-2 text-left transition-colors hover:bg-secondary/60"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                                            group.key === 'habit' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                                          }`}>
                                            {group.items.length}
                                          </span>
                                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            {group.label}
                                          </span>
                                        </div>
                                        <ChevronDown
                                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                                            isCollapsed ? '' : 'rotate-180'
                                          }`}
                                        />
                                      </button>

                                      {!isCollapsed && (
                                        <div className="mt-2 space-y-2">
                                          {group.items.map((task) => (
                                            <div
                                              key={task.id}
                                              draggable
                                              onDragStart={(event) => {
                                                setDraggedTaskId(task.id);
                                                event.dataTransfer.setData('text/plain', task.id);
                                                event.dataTransfer.effectAllowed = 'move';
                                              }}
                                              onDragEnd={() => setDraggedTaskId(null)}
                                            >
                                              <TaskCard
                                                task={task}
                                                compact
                                                referenceDate={todayDate}
                                                onEdit={() => setEditingTask(task)}
                                                onDelete={() => deleteTask(task.id)}
                                                onToggleDone={() => toggleTaskForDate(task.id, todayKey)}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.section>
                  );
                })}
              </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.8rem] border bg-card p-5"
            >
              <h3 className="font-display text-2xl font-bold">Интерактивный календарь</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Выбирайте день, распределяйте задачи и привычки по категориям, отслеживайте выполненные пункты и прогресс дня в удобном визуальном формате.
              </p>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{ scheduled: calendarHighlightedDates }}
                modifiersClassNames={{ scheduled: 'border border-primary/40 font-semibold text-primary' }}
                className="mt-5 rounded-[1.5rem] bg-secondary/40"
              />
              <div className="mt-5 rounded-[1.5rem] bg-primary/5 p-4">
                <p className="text-sm font-semibold">Цель раздела</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Календарный формат помогает лучше организовать время, не пропускать важные задачи и наглядно видеть нагрузку по дням.
                </p>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-[1.8rem] border bg-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold">
                    {format(selectedDate, 'd MMMM, EEEE', { locale: ru })}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Здесь можно просматривать задачи, привычки и выполнение за выбранный день.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Добавить на дату
                </button>
              </div>

              <div className="mt-5 rounded-[1.5rem] bg-secondary/35 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Прогресс дня</span>
                  <span className="text-primary">{dayProgress}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${dayProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Выполнено {dayCompleted} из {tasksForSelectedDate.length} пунктов.
                </p>
              </div>

              {tasksForSelectedDate.length === 0 ? (
                <div className="mt-5 rounded-[1.5rem] bg-secondary/50 px-4 py-10 text-center text-sm text-muted-foreground">
                  На этот день задач нет для выбранного режима просмотра.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {tasksByCategoryOnSelectedDate.map(([category, categoryTasks]) => (
                    <div key={category} className="rounded-[1.5rem] border bg-secondary/15 p-4">
                      <CategoryHeader category={category} count={categoryTasks.length} />
                      <div className="mt-3 space-y-3">
                        {categoryTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            referenceDate={selectedDate}
                            onEdit={() => setEditingTask(task)}
                            onDelete={() => deleteTask(task.id)}
                            onToggleDone={() => toggleTaskForDate(task.id, selectedDateKey)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          </div>
        </TabsContent>
      </Tabs>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-[1.8rem] border bg-card p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Repeat2 className="h-3.5 w-3.5" />
              Ритм дня
            </div>
            <h3 className="mt-2 font-display text-2xl font-bold">Мои привычки</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Повторяющиеся дела собраны отдельно, чтобы их было проще отмечать и отслеживать в выбранном режиме просмотра.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-2xl border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Добавить привычку
          </button>
        </div>

        {myHabits.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] bg-secondary/35 px-5 py-8 text-center text-sm text-muted-foreground">
            Пока нет привычек для выбранного режима. Можно добавить, например, Коран, спорт, учёбу или чтение.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {myHabits.map((habit, index) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                todayDate={todayDate}
                todayKey={todayKey}
                delay={index * 0.04}
                onEdit={() => setEditingTask(habit)}
                onDelete={() => deleteTask(habit.id)}
                onToggleToday={() => toggleTaskForDate(habit.id, todayKey)}
              />
            ))}
          </div>
        )}
      </motion.section>

      <CreateTaskDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <EditTaskDialog task={editingTask} open={!!editingTask} onClose={() => setEditingTask(null)} />
      <ManageCategoriesDialog open={showCategories} onClose={() => setShowCategories(false)} type="task" />
    </div>
  );
}

function CategoryHeader({ category, count }: { category: string; count: number }) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.bg} ${meta.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-2xl font-bold">{translateCategory(category)}</h3>
          <p className="text-sm text-muted-foreground">{count} задач</p>
        </div>
      </div>
    </div>
  );
}

function HabitCard({
  habit,
  todayDate,
  todayKey,
  delay,
  onEdit,
  onDelete,
  onToggleToday,
}: {
  habit: Task;
  todayDate: Date;
  todayKey: string;
  delay: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleToday: () => void;
}) {
  const meta = getCategoryMeta(habit.category);
  const Icon = meta.icon;
  const streak = getHabitStreak(habit, todayDate);
  const doneToday = getTaskStatusForDate(habit, todayDate) === 'done';
  const recentDays = Array.from({ length: 7 }, (_, index) => subDays(todayDate, 6 - index));

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-[1.5rem] border bg-secondary/10 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-2xl ${meta.bg} ${meta.text}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-display text-xl font-bold leading-none">{habit.title}</h4>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
                <Icon className="h-3.5 w-3.5" />
                {translateCategory(habit.category)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Repeat2 className="h-3.5 w-3.5" />
                {translateRecurrence(habit)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[1.2rem] bg-background/90 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Сегодня</p>
              <p className="mt-1.5 text-sm font-medium text-foreground/80">
                {doneToday ? 'Привычка уже отмечена' : 'Ещё можно отметить выполнение'}
              </p>
            </div>
            <button
              onClick={onToggleToday}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                doneToday
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {doneToday ? 'Сделано' : 'Отметить'}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-[1rem] bg-secondary/35 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Flame className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Серия</p>
              <p className="mt-1 text-base font-semibold">{streak} дней подряд</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.2rem] bg-background/90 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Последние 7 дней</p>
              <p className="mt-1 text-xs text-muted-foreground">Лёгкий обзор без переходов по датам</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {todayKey}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {recentDays.map((date) => {
              const scheduled = isTaskForDate(habit, date);
              const done = scheduled && getTaskStatusForDate(habit, date) === 'done';

              return (
                <div key={toDateKey(date)} className="text-center">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {format(date, 'EEEEE', { locale: ru })}
                  </p>
                  <div
                    className={`mx-auto flex h-8.5 w-8.5 items-center justify-center rounded-2xl border text-[11px] font-semibold transition-colors ${
                      done
                        ? 'border-emerald-200 bg-emerald-500 text-white'
                        : scheduled
                          ? 'border-border bg-secondary text-muted-foreground'
                          : 'border-dashed border-border bg-background text-muted-foreground/40'
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : format(date, 'd')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TaskCard({
  task,
  referenceDate,
  compact,
  onEdit,
  onDelete,
  onToggleDone,
}: {
  task: Task;
  referenceDate: Date;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}) {
  const meta = getCategoryMeta(task.category);
  const Icon = meta.icon;
  const effectiveStatus = getTaskStatusForDate(task, referenceDate);

  return (
    <article className="rounded-[1.4rem] bg-secondary/35 p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleDone}
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
            effectiveStatus === 'done'
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-muted-foreground/30 text-transparent hover:border-emerald-600 hover:text-emerald-600'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className={`text-sm font-semibold ${effectiveStatus === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h4>
              {task.description && !compact && (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={onDelete} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <OwnerBadge owner={task.owner} />
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
              <Icon className="h-3.5 w-3.5" />
              {translateCategory(task.category)}
            </span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${task.kind === 'habit' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
              {task.kind === 'habit' ? 'Привычка' : 'Задача'}
            </span>
            <StatusBadge status={effectiveStatus} />
            {task.dueDateTime && (
              <span className="inline-flex items-center rounded-full bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                {format(new Date(task.dueDateTime), 'd MMM, HH:mm', { locale: ru })}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyTasksState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[2rem] border bg-card px-6 py-14 text-center">
      <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <p className="mt-4 text-base font-medium">У вас пока нет задач</p>
      <p className="mt-1 text-sm text-muted-foreground">Создайте первую задачу или привычку и выберите удобный формат планирования.</p>
      <button onClick={onCreate} className="mt-5 rounded-2xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        Добавить
      </button>
    </div>
  );
}
