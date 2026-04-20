import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, ClipboardList, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import { toDateKey } from '@/lib/task-helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { prepareImageForStorage } from '@/lib/image-storage';

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replaceAll('&nbsp;', ' ').trim();
}

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [draftReflection, setDraftReflection] = useState('<p></p>');
  const [openedReflectionDate, setOpenedReflectionDate] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const purchasesSorted = useMemo(
    () =>
      [...homePurchases].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [homePurchases]
  );

  const reflectionDates = useMemo(
    () =>
      Array.from(new Set(dailyReflections.map((item) => item.date))).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
      ),
    [dailyReflections]
  );

  const openedDayReflections = useMemo(
    () =>
      dailyReflections
        .filter((item) => item.date === openedReflectionDate)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [dailyReflections, openedReflectionDate]
  );

  const handleAddPurchase = () => {
    if (!title.trim()) return;
    addHomePurchase({
      title: title.trim(),
      notes: notes.trim() || undefined,
      imageUrl: imageUrl || undefined,
      isRecurring,
    });
    setTitle('');
    setNotes('');
    setImageUrl(null);
    setIsRecurring(false);
  };

  const handleSaveReflection = () => {
    const html = editorRef.current?.innerHTML ?? draftReflection;
    const hasContent = stripHtml(html).length > 0;
    if (!hasContent) return;
    upsertDailyReflection(selectedDate, html);
    setDraftReflection('<p></p>');
    if (editorRef.current) {
      editorRef.current.innerHTML = '<p></p>';
    }
  };

  const applyEditorCommand = (command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList') => {
    document.execCommand(command);
    const html = editorRef.current?.innerHTML ?? '';
    setDraftReflection(html);
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

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border bg-card p-6"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -top-6 h-36 w-36 rounded-full bg-sky-300/20 blur-3xl" />
        <h2 className="font-display text-3xl font-bold">Notes</h2>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.8rem] border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-display text-2xl font-bold">Покупки</h3>
          </div>

          <Tabs defaultValue="create" className="mt-4 space-y-3">
            <TabsList className="h-auto rounded-xl bg-secondary/60 p-1">
              <TabsTrigger value="create" className="rounded-lg px-3 py-1.5 text-xs">Создать</TabsTrigger>
              <TabsTrigger value="view" className="rounded-lg px-3 py-1.5 text-xs">Просмотр</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-0 space-y-3 rounded-xl border bg-secondary/20 p-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Что нужно купить?"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Комментарий (необязательно)"
                className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
                  <ImagePlus className="h-4 w-4" />
                  Прикрепить фото
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                  />
                  Бессрочная покупка
                </label>
              </div>
              {imageUrl ? (
                <div className="relative w-fit">
                  <img src={imageUrl} alt="Покупка" className="h-28 w-28 rounded-xl object-cover" />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ) : null}
              <button
                onClick={handleAddPurchase}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Добавить
              </button>
            </TabsContent>

            <TabsContent value="view" className="mt-0 space-y-2 rounded-xl border bg-secondary/20 p-4">
              {purchasesSorted.length === 0 ? (
                <div className="rounded-xl bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  Пока нет покупок
                </div>
              ) : (
                purchasesSorted.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="h-16 w-16 rounded-lg object-cover" />
                        ) : null}
                        <div>
                          <p className={`text-sm font-semibold ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {item.title}
                          </p>
                          {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
                          <div className="mt-2 flex gap-2">
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{item.owner}</span>
                            {item.isRecurring ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Бессрочно</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleHomePurchase(item.id)}
                          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-emerald-600"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteHomePurchase(item.id)}
                          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
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

          <div className="mt-4 grid gap-4">
            <div className="rounded-2xl border bg-background p-3 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3">
                <button onClick={() => applyEditorCommand('bold')} className="rounded-lg border px-3 py-1 text-xs font-semibold">B</button>
                <button onClick={() => applyEditorCommand('italic')} className="rounded-lg border px-3 py-1 text-xs italic">I</button>
                <button onClick={() => applyEditorCommand('underline')} className="rounded-lg border px-3 py-1 text-xs underline">U</button>
                <button onClick={() => applyEditorCommand('insertUnorderedList')} className="rounded-lg border px-3 py-1 text-xs">• List</button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setDraftReflection(editorRef.current?.innerHTML ?? '')}
                className="min-h-56 rounded-xl px-4 py-4 text-[16px] leading-8 outline-none"
                style={{
                  fontFamily: 'Georgia, Cambria, \"Times New Roman\", serif',
                  backgroundImage: 'linear-gradient(transparent 31px, rgba(0,0,0,0.06) 32px)',
                  backgroundSize: '100% 32px',
                }}
              />
              <button
                onClick={handleSaveReflection}
                className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Сохранить запись
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border bg-secondary/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Просмотр записей</p>
            {reflectionDates.length === 0 ? (
              <div className="rounded-xl bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                Записей пока нет
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {reflectionDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => setOpenedReflectionDate((prev) => (prev === date ? null : date))}
                      className={`rounded-xl border bg-background px-3 py-2 text-left text-sm transition-colors ${
                        openedReflectionDate === date ? 'border-primary text-primary' : 'hover:border-primary/40'
                      }`}
                    >
                      {format(new Date(date), 'd MMMM yyyy', { locale: ru })}
                    </button>
                  ))}
                </div>

                {openedReflectionDate ? (
                  <div className="space-y-2 pt-2">
                    {openedDayReflections.map((entry) => (
                      <div key={entry.id} className="rounded-xl border bg-background p-3">
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
                        {/<\/?[a-z][\s\S]*>/i.test(entry.text) ? (
                          <div className="prose prose-sm mt-2 max-w-none leading-7" dangerouslySetInnerHTML={{ __html: entry.text }} />
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </motion.article>
      </section>
    </div>
  );
}
