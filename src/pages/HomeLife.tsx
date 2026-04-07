import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import { toDateKey } from '@/lib/task-helpers';

export default function HomeLife() {
  const {
    activeUser,
    homePurchases,
    dailyReflections,
    addHomePurchase,
    toggleHomePurchase,
    deleteHomePurchase,
    upsertDailyReflection,
    deleteDailyReflection,
  } = useApp();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [draftReflection, setDraftReflection] = useState('');

  const purchasesSorted = useMemo(
    () =>
      [...homePurchases].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [homePurchases]
  );

  const myReflection = useMemo(
    () => dailyReflections.find((item) => item.owner === activeUser && item.date === selectedDate) ?? null,
    [activeUser, dailyReflections, selectedDate]
  );

  useEffect(() => {
    setDraftReflection(myReflection?.text ?? '');
  }, [myReflection, selectedDate]);

  const dayReflections = useMemo(
    () =>
      dailyReflections
        .filter((item) => item.date === selectedDate)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [dailyReflections, selectedDate]
  );

  const handleAddPurchase = () => {
    if (!title.trim()) return;
    addHomePurchase({
      title: title.trim(),
      notes: notes.trim() || undefined,
      isRecurring,
    });
    setTitle('');
    setNotes('');
    setIsRecurring(false);
  };

  const handleSaveReflection = () => {
    upsertDailyReflection(selectedDate, draftReflection);
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border bg-card p-6"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -top-6 h-36 w-36 rounded-full bg-sky-300/20 blur-3xl" />
        <h2 className="font-display text-3xl font-bold">Дом и день</h2>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.8rem] border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold">Покупки по дому</h3>
          </div>

          <div className="mt-4 grid gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Что нужно купить?"
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            />
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Комментарий (необязательно)"
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(event) => setIsRecurring(event.target.checked)}
              />
              Бессрочная покупка
            </label>
            <button
              onClick={handleAddPurchase}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {purchasesSorted.length === 0 ? (
              <div className="rounded-xl bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
                Пока нет покупок
              </div>
            ) : (
              purchasesSorted.map((item) => (
                <div key={item.id} className="rounded-xl border bg-secondary/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                        {item.title}
                      </p>
                      {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
                      <div className="mt-2 flex gap-2">
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">{item.owner}</span>
                        {item.isRecurring ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Бессрочно</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleHomePurchase(item.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-emerald-600"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteHomePurchase(item.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[1.8rem] border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold">Запись дня</h3>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {format(new Date(selectedDate), 'd MMMM', { locale: ru })}
            </span>
          </div>

          <textarea
            value={draftReflection}
            onChange={(event) => setDraftReflection(event.target.value)}
            placeholder="Мысли, переживания, идеи на день..."
            className="mt-4 min-h-40 w-full rounded-xl border bg-background p-3 text-sm"
          />

          <button
            onClick={handleSaveReflection}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Сохранить запись
          </button>

          <div className="mt-5 space-y-2">
            {dayReflections.length === 0 ? (
              <div className="rounded-xl bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
                На эту дату записей нет
              </div>
            ) : (
              dayReflections.map((entry) => (
                <div key={entry.id} className="rounded-xl border bg-secondary/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{entry.owner}</p>
                    {entry.owner === activeUser ? (
                      <button
                        onClick={() => deleteDailyReflection(entry.id)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.text}</p>
                </div>
              ))
            )}
          </div>
        </motion.article>
      </section>
    </div>
  );
}
