import { useState, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { HabitRecurrence, Task, TaskStatus, TaskKind } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

export function EditTaskDialog({ task, open, onClose }: { task: Task | null; open: boolean; onClose: () => void }) {
  const { updateTask, categories } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dueDateTime, setDueDateTime] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [kind, setKind] = useState<TaskKind>('task');
  const [recurrence, setRecurrence] = useState<HabitRecurrence>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setCategory(task.category);
      setDueDateTime(task.dueDateTime || '');
      setStatus(task.status);
      setKind(task.kind);
      setRecurrence(task.recurrence ?? 'daily');
      setRepeatDays(task.repeatDays ?? []);
    }
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;
    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      kind,
      recurrence: kind === 'habit' ? recurrence : 'none',
      repeatDays: kind === 'habit' ? repeatDays : [],
      dueDateTime: dueDateTime || undefined,
      status,
    });
    onClose();
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Редактировать задачу</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Название *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Описание</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Тип</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as TaskKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Задача</SelectItem>
                <SelectItem value="habit">Привычка</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c === 'Home' ? 'Дом' : c === 'Work' ? 'Работа' : c === 'Study' ? 'Учёба' : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Статус</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">К выполнению</SelectItem>
                <SelectItem value="in_progress">В процессе</SelectItem>
                <SelectItem value="done">Выполнено</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{kind === 'habit' ? 'До какой даты повторять' : 'Дедлайн'}</Label>
            <Input type="datetime-local" value={dueDateTime} onChange={e => setDueDateTime(e.target.value)} />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
