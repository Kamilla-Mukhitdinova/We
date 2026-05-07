import { FormEvent, useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/lib/store';
import { getTaskStatusForDate, isTaskForDate, toDateKey } from '@/lib/task-helpers';
import { Task } from '@/lib/types';

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T09:00`;
}

function getFirstLine(text: string) {
  return text.split('\n').find((line) => line.trim())?.trim() ?? text.trim();
}

function taskTimeLabel(task: Task) {
  if (!task.dueDateTime) return null;
  return format(parseISO(task.dueDateTime), 'HH:mm');
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export default function CalendarPage() {
  const { activeUser, tasks, addTask, deleteTask, toggleTaskForDate, categories } = useApp();
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');

  const monthStart = startOfMonth(visibleMonth);
  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthStart, visibleMonth]);

  const myTasks = useMemo(() => tasks.filter((task) => task.owner === activeUser), [activeUser, tasks]);

  const getTasksForDay = (date: Date) =>
    myTasks
      .filter((task) => isTaskForDate(task, date))
      .sort((a, b) => {
        const aTime = a.dueDateTime ? parseISO(a.dueDateTime).getTime() : 0;
        const bTime = b.dueDateTime ? parseISO(b.dueDateTime).getTime() : 0;
        return aTime - bTime || a.title.localeCompare(b.title);
      });

  const selectedTasks = getTasksForDay(selectedDate);
  const selectedDateKey = toDateKey(selectedDate);
  const monthTasksCount = useMemo(
    () => myTasks.filter((task) => isTaskForDate(task, visibleMonth) || isSameMonth(new Date(task.dueDateTime ?? task.createdAt), visibleMonth)).length,
    [myTasks, visibleMonth]
  );

  const openDay = (date: Date) => {
    setSelectedDate(date);
    setNoteTitle('');
    setNoteText('');
  };

  const handleCreateNote = (event: FormEvent) => {
    event.preventDefault();

    const rawText = noteText.trim();
    const rawTitle = noteTitle.trim();
    const titleSource = rawTitle || getFirstLine(rawText);
    if (!titleSource) return;

    addTask({
      title: titleSource.length > 80 ? `${titleSource.slice(0, 77)}...` : titleSource,
      description: rawText || undefined,
      category: categories.includes('Work') ? 'Work' : categories[0] ?? 'Work',
      kind: 'task',
      recurrence: 'none',
      repeatDays: [],
      completionDates: [],
      status: 'todo',
      dueDateTime: toDateTimeLocalValue(selectedDate),
      owner: activeUser,
    });

    setNoteTitle('');
    setNoteText('');
  };

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[1.8rem] border bg-card shadow-sm"
      >
        <div className="border-b bg-secondary/20 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">План на месяц</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight">
                {format(visibleMonth, 'LLLL yyyy', { locale: ru })}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setVisibleMonth(new Date())}
                className="rounded-xl border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Сегодня
              </button>
              <div className="flex rounded-xl border bg-background p-1">
                <button
                  onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Предыдущий месяц"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Следующий месяц"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => openDay(new Date())}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <CalendarPlus className="h-4 w-4" />
                Записать на сегодня
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Выбранный день</p>
              <p className="mt-1 text-sm font-semibold">{format(selectedDate, 'd MMMM, EEEE', { locale: ru })}</p>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Записей в этот день</p>
              <p className="mt-1 text-sm font-semibold">{selectedTasks.length}</p>
            </div>
            <div className="rounded-2xl bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Задач в месяце</p>
              <p className="mt-1 text-sm font-semibold">{monthTasksCount}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
          <div className="p-4">
            <div className="grid grid-cols-7 rounded-t-2xl border border-white/70 bg-white/55 backdrop-blur">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="border-r border-white/70 px-3 py-3 text-right text-sm font-bold text-slate-500 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-b-2xl border-x border-b border-white/70 bg-white/45 backdrop-blur">
              {calendarDays.map((day) => {
                const dayTasks = getTasksForDay(day);
                const inMonth = isSameMonth(day, visibleMonth);
                const isSelected = toDateKey(day) === selectedDateKey;
                const weekend = isWeekend(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => openDay(day)}
                    className={`group flex min-h-32 flex-col border-r border-b border-white/70 p-2 text-left transition-colors hover:bg-white/75 ${
                      isSelected ? 'bg-emerald-50/75 shadow-[inset_0_0_0_1px_hsl(150_48%_68%/0.55)]' : ''
                    } ${inMonth ? (weekend ? 'bg-white/38' : 'bg-white/58') : 'bg-white/24 text-muted-foreground'} [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0`}
                  >
                    <div className="flex justify-end">
                      <span
                        className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-lg font-semibold ${
                          isToday(day)
                            ? 'bg-emerald-100 text-emerald-700'
                            : isSelected
                              ? 'bg-white/85 text-emerald-700'
                              : inMonth
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="mt-2 min-w-0 space-y-1">
                      {dayTasks.slice(0, 2).map((task) => {
                        const isDone = getTaskStatusForDate(task, day) === 'done';
                        return (
                          <div
                            key={task.id}
                            className={`truncate rounded-full px-2 py-0.5 text-xs font-semibold ${
                              isDone
                                ? 'bg-emerald-100/80 text-emerald-700 line-through'
                                : 'bg-emerald-100/85 text-emerald-800'
                            }`}
                          >
                            {taskTimeLabel(task) ? `${taskTimeLabel(task)} ` : ''}
                            {task.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 2 && (
                        <div className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          +{dayTasks.length - 2} еще
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="border-t bg-secondary/25 p-4 xl:border-l xl:border-t-0">
            <div className="sticky top-20 space-y-4">
              <div className="rounded-2xl bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">День</p>
                <h3 className="mt-2 font-display text-2xl font-bold">
                  {format(selectedDate, 'd MMMM', { locale: ru })}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {format(selectedDate, 'EEEE', { locale: ru })}
                </p>
              </div>

              <form onSubmit={handleCreateNote} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold">Новая запись</p>
                  <p className="mt-1 text-xs text-muted-foreground">Появится на дэшборде, когда наступит этот день.</p>
                </div>
                <Input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Например: сдать проект"
                />
                <Textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Подробности..."
                  rows={4}
                />
                <button
                  type="submit"
                  disabled={!noteTitle.trim() && !noteText.trim()}
                  className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Сохранить запись
                </button>
              </form>

              <div className="space-y-2 rounded-2xl bg-card p-4 shadow-sm">
                <p className="text-sm font-semibold">Записи дня</p>
                {selectedTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    На этот день пока ничего нет.
                  </div>
                ) : (
                  selectedTasks.map((task) => {
                    const done = getTaskStatusForDate(task, selectedDate) === 'done';
                    return (
                      <div key={task.id} className="flex items-start gap-3 rounded-xl bg-secondary/45 p-3">
                        <button
                          onClick={() => toggleTaskForDate(task.id, selectedDateKey)}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            done
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-muted-foreground/30 text-transparent hover:border-emerald-600 hover:text-emerald-600'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${done ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                          {task.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">{task.description}</p>}
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        </div>
      </motion.section>
    </div>
  );
}
