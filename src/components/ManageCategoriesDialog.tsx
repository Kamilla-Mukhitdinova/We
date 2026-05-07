import { ChangeEvent, useState } from 'react';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ImagePlus, Trash2, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TASK_CATEGORY_ICON_OPTIONS, TaskCategoryIconKey, getTaskCategoryIconSpec } from '@/lib/task-category-icons';
import { prepareImageForStorage } from '@/lib/image-storage';
import { toast } from 'sonner';

export function ManageCategoriesDialog({ open, onClose, type }: { open: boolean; onClose: () => void; type: 'task' | 'wish' }) {
  const {
    categories,
    wishCategories,
    taskCategoryIcons,
    taskCategoryImages,
    addCategory,
    addWishCategory,
    setTaskCategoryIcon,
    setTaskCategoryImage,
    deleteCategory,
    deleteWishCategory,
  } = useApp();
  const [newCat, setNewCat] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState<TaskCategoryIconKey | ''>('');
  const [newTaskImage, setNewTaskImage] = useState('');

  const items = type === 'task' ? categories : wishCategories;
  const deleteFn = type === 'task' ? deleteCategory : deleteWishCategory;

  const handleAdd = () => {
    if (newCat.trim()) {
      if (type === 'task') {
        if (!newTaskIcon && !newTaskImage) return;
        const categoryName = newCat.trim();
        addCategory(categoryName, newTaskIcon || 'generic');
        if (newTaskImage) setTaskCategoryImage(categoryName, newTaskImage);
      } else {
        addWishCategory(newCat.trim());
      }
      setNewCat('');
      setNewTaskIcon('');
      setNewTaskImage('');
    }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, category?: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await prepareImageForStorage(file);
      if (category) {
        setTaskCategoryImage(category, dataUrl);
      } else {
        setNewTaskImage(dataUrl);
      }
    } catch {
      toast.error('Не удалось сохранить эту картинку');
    } finally {
      event.target.value = '';
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
                  const iconKey = taskCategoryIcons[cat] ?? 'generic';
                  const imageUrl = taskCategoryImages[cat];
                  const meta = getTaskCategoryIconSpec(iconKey);
                  const Icon = meta.icon;
                  return imageUrl ? (
                    <img src={imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
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
                  <>
                    <Select
                      value={taskCategoryIcons[cat] ?? 'generic'}
                      onValueChange={(value) => setTaskCategoryIcon(cat, value as TaskCategoryIconKey)}
                    >
                      <SelectTrigger className="h-8 w-[124px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORY_ICON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="inline-flex items-center gap-2">
                              {(() => {
                                const meta = getTaskCategoryIconSpec(option.value);
                                const Icon = meta.icon;
                                return (
                                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${meta.bg} ${meta.text}`}>
                                    <Icon className="h-3 w-3" />
                                  </span>
                                );
                              })()}
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-background hover:text-foreground" title="Загрузить фото">
                      <ImagePlus className="h-4 w-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, cat)} />
                    </label>
                    {taskCategoryImages[cat] && (
                      <button
                        onClick={() => setTaskCategoryImage(cat)}
                        className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                        title="Убрать фото"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => deleteFn(cat)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            {type === 'task' && (
              <>
                <Select value={newTaskIcon} onValueChange={(value) => setNewTaskIcon(value as TaskCategoryIconKey)}>
                  <SelectTrigger className="w-[124px]">
                    <SelectValue placeholder="Иконка" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORY_ICON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="inline-flex items-center gap-2">
                          {(() => {
                            const meta = getTaskCategoryIconSpec(option.value);
                            const Icon = meta.icon;
                            return (
                              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${meta.bg} ${meta.text}`}>
                                <Icon className="h-3 w-3" />
                              </span>
                            );
                          })()}
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Загрузить фото">
                  {newTaskImage ? (
                    <img src={newTaskImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event)} />
                </label>
              </>
            )}
            <Input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="Новая категория"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            />
            <button
              onClick={handleAdd}
              disabled={!newCat.trim() || (type === 'task' && !newTaskIcon && !newTaskImage)}
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
