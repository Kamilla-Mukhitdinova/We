import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Columns3,
  Dumbbell,
  Home,
  Landmark,
  Pencil,
  Plus,
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
import { StatusBadge } from '@/components/Badges';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { ManageCategoriesDialog } from '@/components/ManageCategoriesDialog';

type PlannerView = 'list' | 'kanban' | 'calendar';

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

export default function Tasks() {
  const { activeUser, tasks, updateTask, toggleTaskForDate, deleteTask, categories } = useApp();
  const [plannerView, setPlannerView] = useState<PlannerView>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const todayDate = new Date();
  const todayKey = toDateKey(todayDate);
  const selectedDateKey = toDateKey(selectedDate);

  const myTasks = useMemo(() => {
    return tasks
      .filter((task) => task.owner === activeUser)
      .filter((task) => (statusFilter === 'all' ? true : getTaskStatusForDate(task, todayDate) === statusFilter))
      .sort((a, b) => {
        const aDate = isHabit(a) ? 0 : a.dueDateTime ? new Date(a.dueDateTime).getTime() : 0;
        const bDate = isHabit(b) ? 0 : b.dueDateTime ? new Date(b.dueDateTime).getTime() : 0;
        return aDate - bDate || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activeUser, statusFilter, tasks, todayDate]);

  const todayTasks = useMemo(
    () => myTasks.filter((task) => isTaskForDate(task, todayDate)),
    [myTasks, todayDate]
  );

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Task[]>();
    categories.forEach((category) => {
      const categoryTasks = todayTasks.filter((task) => task.category === category);
      if (categoryTasks.length > 0) map.set(category, categoryTasks);
    });
    todayTasks
      .filter((task) => !map.has(task.category))
      .forEach((task) => {
        const current = map.get(task.category) ?? [];
        map.set(task.category, [...current, task]);
      });
    return Array.from(map.entries());
  }, [categories, todayTasks]);

  const tasksForSelectedDate = useMemo(() => {
    return myTasks.filter((task) => isTaskForDate(task, selectedDate));
  }, [myTasks, selectedDate]);

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
      myTasks.flatMap((task) => {
        if (isHabit(task)) return [];
        const taskDate = getLocalDate(task);
        return taskDate ? [taskDate] : [];
      }),
    [myTasks]
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

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border bg-card p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Мои задачи</h2>
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
                              <div className="space-y-2">
                                {tasksInCategory.map((task) => (
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
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{ scheduled: calendarHighlightedDates }}
                modifiersClassNames={{ scheduled: 'border border-primary/40 font-semibold text-primary' }}
                className="mt-5 rounded-[1.5rem] bg-secondary/40"
              />
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
                  На этот день задач нет.
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
      <button onClick={onCreate} className="mt-5 rounded-2xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        Добавить
      </button>
    </div>
  );
}
