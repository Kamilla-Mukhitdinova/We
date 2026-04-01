import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { eachDayOfInterval, endOfDay, format, isWithinInterval, startOfDay, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { BarChart3, CalendarRange, CheckCircle2, Clock3, TrendingUp } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Legend, LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/lib/store';

export default function Analytics() {
  const { activeUser, tasks } = useApp();
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const applyQuickRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days - 1);
    setDateFrom(format(start, 'yyyy-MM-dd'));
    setDateTo(format(end, 'yyyy-MM-dd'));
  };

  const myTasks = tasks.filter((task) => task.owner === activeUser);
  const intervalStart = startOfDay(new Date(dateFrom));
  const intervalEnd = endOfDay(new Date(dateTo));
  const inRange = (value?: string) => {
    if (!value) return false;
    return isWithinInterval(new Date(value), { start: intervalStart, end: intervalEnd });
  };
  const rangedTasks = myTasks.filter((task) => inRange(task.dueDateTime || task.createdAt) || inRange(task.completedAt));

  const chartData = useMemo(() => {
    return eachDayOfInterval({ start: intervalStart, end: intervalEnd }).map((day) => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const created = rangedTasks.filter((task) => task.createdAt.slice(0, 10) === dayKey).length;
      const completed = rangedTasks.filter((task) => task.completedAt?.slice(0, 10) === dayKey).length;
      const pending = rangedTasks.filter((task) => task.dueDateTime?.slice(0, 10) === dayKey && task.status !== 'done').length;

      return {
        dayLabel: format(day, 'd MMM', { locale: ru }),
        created,
        completed,
        pending,
      };
    });
  }, [intervalEnd, intervalStart, rangedTasks]);

  const totals = useMemo(() => {
    const completed = rangedTasks.filter((task) => task.status === 'done').length;
    const pending = rangedTasks.filter((task) => task.status !== 'done').length;
    const progress = rangedTasks.length > 0 ? Math.round((completed / rangedTasks.length) * 100) : 0;
    return { completed, pending, progress };
  }, [rangedTasks]);

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Аналитика</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Здесь можно выбрать период с определённой даты до определённой и посмотреть аналитику именно за этот промежуток.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: '7 дней', days: 7 },
                { label: '14 дней', days: 14 },
                { label: 'Месяц', days: 30 },
              ].map((option) => (
                <button
                  key={option.days}
                  onClick={() => applyQuickRange(option.days)}
                  className="rounded-full bg-secondary px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">С даты</span>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-2xl border bg-background px-4 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">По дату</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-2xl border bg-background px-4 py-2"
                />
              </label>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        <MiniCard icon={<CheckCircle2 className="h-4 w-4" />} label="Выполнено" value={totals.completed} />
        <MiniCard icon={<Clock3 className="h-4 w-4" />} label="Не выполнено" value={totals.pending} />
        <MiniCard icon={<TrendingUp className="h-4 w-4" />} label="Общий прогресс" value={`${totals.progress}%`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.8rem] border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold">Динамика по дням</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayLabel" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="completed" stroke="hsl(160 50% 40%)" strokeWidth={3} name="Выполнено" />
                <Line type="monotone" dataKey="pending" stroke="hsl(0 65% 50%)" strokeWidth={3} name="Не выполнено" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="rounded-[1.8rem] border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold">Количество задач</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dayLabel" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="hsl(175 45% 38%)" name="Создано" radius={[8, 8, 0, 0]} />
                <Bar dataKey="completed" fill="hsl(160 50% 40%)" name="Выполнено" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.article>
      </section>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-[1.6rem] border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-4 font-display text-4xl font-bold">{value}</p>
    </div>
  );
}
