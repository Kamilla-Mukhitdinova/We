import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { HabitRecurrence, TaskKind } from '@/lib/types';
import { TASK_CATEGORY_ICON_OPTIONS, TaskCategoryIconKey } from '@/lib/task-category-icons';

const DAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

export function CreateTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeUser, addTask, categories, addCategory } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Work');
  const [kind, setKind] = useState<TaskKind>('task');
  const [recurrence, setRecurrence] = useState<HabitRecurrence>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dueDateTime, setDueDateTime] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<TaskCategoryIconKey>('generic');
  const [showNewCat, setShowNewCat] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      kind,
      recurrence: kind === 'habit' ? recurrence : 'none',
      repeatDays: kind === 'habit' ? repeatDays : [],
      completionDates: [],
      status: 'todo',
      dueDateTime: dueDateTime || undefined,
      owner: activeUser,
    });
    setTitle('');
    setDescription('');
    setDueDateTime('');
    setKind('task');
    setRecurrence('daily');
    setRepeatDays([1, 2, 3, 4, 5]);
    onClose();
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      addCategory(newCategory.trim(), newCategoryIcon);
      setCategory(newCategory.trim());
      setNewCategory('');
      setNewCategoryIcon('generic');
      setShowNewCat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Новая задача</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Название *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Что нужно сделать?" autoFocus />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Подробности..." rows={2} />
          </div>
          <div>
            <Label>Тип</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { value: 'task', label: 'Задача' },
                { value: 'habit', label: 'Привычка' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value as TaskKind)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                    kind === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {kind === 'habit' && (
            <div className="space-y-3">
              <div>
                <Label>Повторение привычки</Label>
                <Select value={recurrence} onValueChange={(value) => setRecurrence(value as HabitRecurrence)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Каждый день</SelectItem>
                    <SelectItem value="weekdays">Только по будням</SelectItem>
                    <SelectItem value="custom">Выбрать дни</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {recurrence === 'custom' && (
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleRepeatDay(day.value)}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                        repeatDays.includes(day.value)
                          ? 'bg-primary/10 text-primary'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Категория</Label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c === 'Home' ? 'Дом' : c === 'Work' ? 'Работа' : c === 'Study' ? 'Учёба' : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => setShowNewCat(true)} className="shrink-0 rounded-lg border px-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  +
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={newCategoryIcon} onValueChange={(value) => setNewCategoryIcon(value as TaskCategoryIconKey)}>
                  <SelectTrigger className="w-[132px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORY_ICON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Название категории" />
                <button type="button" onClick={handleAddCategory} className="shrink-0 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
                  Добавить
                </button>
                <button type="button" onClick={() => setShowNewCat(false)} className="shrink-0 rounded-lg border px-3 text-sm text-muted-foreground">
                  ✕
                </button>
              </div>
            )}
          </div>
          <div>
            <Label>{kind === 'habit' ? 'До какой даты повторять (необязательно)' : 'Дедлайн (необязательно)'}</Label>
            <Input type="datetime-local" value={dueDateTime} onChange={e => setDueDateTime(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">Владелец: <strong>{activeUser}</strong></span>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
