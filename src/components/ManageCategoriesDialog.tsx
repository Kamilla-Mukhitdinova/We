import { useState } from 'react';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

export function ManageCategoriesDialog({ open, onClose, type }: { open: boolean; onClose: () => void; type: 'task' | 'wish' }) {
  const { categories, wishCategories, addCategory, addWishCategory, deleteCategory, deleteWishCategory } = useApp();
  const [newCat, setNewCat] = useState('');

  const items = type === 'task' ? categories : wishCategories;
  const addFn = type === 'task' ? addCategory : addWishCategory;
  const deleteFn = type === 'task' ? deleteCategory : deleteWishCategory;
  const protectedCats = type === 'task' ? ['Home', 'Work', 'Study'] : [];

  const handleAdd = () => {
    if (newCat.trim()) {
      addFn(newCat.trim());
      setNewCat('');
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
              <span className="text-sm font-medium">
                {cat === 'Home' ? 'Дом' : cat === 'Work' ? 'Работа' : cat === 'Study' ? 'Учёба' : cat}
              </span>
              {!protectedCats.includes(cat) && (
                <button
                  onClick={() => deleteFn(cat)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
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
