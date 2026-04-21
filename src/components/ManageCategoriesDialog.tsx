import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_CATEGORY_ICON_OPTIONS, TaskCategoryIconKey, getTaskCategoryIconSpec, inferTaskCategoryIconKey } from '@/lib/task-category-icons';

export function ManageCategoriesDialog({ open, onClose, type }: { open: boolean; onClose: () => void; type: 'task' | 'wish' }) {
  const {
    categories,
    wishCategories,
    taskCategoryIcons,
    addCategory,
    addWishCategory,
    setTaskCategoryIcon,
    deleteCategory,
    deleteWishCategory,
  } = useApp();
  const [newCat, setNewCat] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState<TaskCategoryIconKey>('generic');

  const items = type === 'task' ? categories : wishCategories;
  const deleteFn = type === 'task' ? deleteCategory : deleteWishCategory;
  const protectedCats = type === 'task' ? ['Home', 'Work', 'Study'] : [];

  const handleAdd = () => {
    if (newCat.trim()) {
      if (type === 'task') {
        addCategory(newCat.trim(), newTaskIcon);
      } else {
        addWishCategory(newCat.trim());
      }
      setNewCat('');
      setNewTaskIcon('generic');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            {type === 'task' ? 'Категории задач' : 'Категории желаний'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {items.map(cat => (
            <div key={cat} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                {type === 'task' && (() => {
                  const iconKey = taskCategoryIcons[cat] ?? inferTaskCategoryIconKey(cat);
                  const meta = getTaskCategoryIconSpec(iconKey);
                  const Icon = meta.icon;
                  return (
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${meta.bg} ${meta.text}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                })()}
                <span className="text-sm font-medium">
                  {cat === 'Home' ? 'Дом' : cat === 'Work' ? 'Работа' : cat === 'Study' ? 'Учёба' : cat}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {type === 'task' && (
                  <Select
                    value={taskCategoryIcons[cat] ?? inferTaskCategoryIconKey(cat)}
                    onValueChange={(value) => setTaskCategoryIcon(cat, value as TaskCategoryIconKey)}
                  >
                    <SelectTrigger className="h-8 w-[124px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_CATEGORY_ICON_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              {!protectedCats.includes(cat) && (
                <button
                  onClick={() => deleteFn(cat)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            {type === 'task' && (
              <Select value={newTaskIcon} onValueChange={(value) => setNewTaskIcon(value as TaskCategoryIconKey)}>
                <SelectTrigger className="w-[124px]">
                  <SelectValue placeholder="Иконка" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORY_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="Новая категория"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            />
            <button
              onClick={handleAdd}
              disabled={!newCat.trim()}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
