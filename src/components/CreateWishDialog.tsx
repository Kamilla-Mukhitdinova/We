import { useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { Owner, WishScope } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImagePlus, X } from 'lucide-react';

export function CreateWishDialog({
  open,
  onClose,
  ownerOverride,
  scopeOverride,
  dialogTitle = 'Новое желание',
}: {
  open: boolean;
  onClose: () => void;
  ownerOverride?: Owner;
  scopeOverride?: WishScope;
  dialogTitle?: string;
}) {
  const { activeUser, addWish, wishCategories, addWishCategory } = useApp();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState<WishScope>(scopeOverride ?? 'personal');
  const [newCategory, setNewCategory] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const owner = ownerOverride ?? activeUser;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addWish({
      title: title.trim(),
      notes: notes.trim() || undefined,
      imageUrl: imageUrl || undefined,
      category: category || undefined,
      owner,
      scope: scopeOverride ?? scope,
      status: 'planned',
    });
    setTitle('');
    setNotes('');
    setImageUrl('');
    setCategory('');
    setScope(scopeOverride ?? 'personal');
    onClose();
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      addWishCategory(newCategory.trim());
      setCategory(newCategory.trim());
      setNewCategory('');
      setShowNewCat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!scopeOverride && (
            <div>
              <Label>Тип мечты</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { value: 'personal', label: 'Моя мечта' },
                  { value: 'couple', label: 'Мечта пары' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value as WishScope)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                      scope === option.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Желание *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="О чём мечтаете?" autoFocus />
          </div>

          {/* Image upload */}
          <div>
            <Label>Картинка</Label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {imageUrl ? (
              <div className="relative mt-1 rounded-lg overflow-hidden border">
                <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 rounded-full bg-foreground/60 p-1 text-background hover:bg-foreground/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                Добавить изображение
              </button>
            )}
          </div>

          {/* Category */}
          <div>
            <Label>Категория</Label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Без категории" /></SelectTrigger>
                  <SelectContent>
                    {wishCategories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => setShowNewCat(true)} className="shrink-0 rounded-lg border px-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  +
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Название категории" />
                <button type="button" onClick={handleAddCategory} className="shrink-0 rounded-lg bg-primary px-3 text-sm text-primary-foreground">
                  ОК
                </button>
                <button type="button" onClick={() => setShowNewCat(false)} className="shrink-0 rounded-lg border px-3 text-sm text-muted-foreground">
                  ✕
                </button>
              </div>
            )}
          </div>

          <div>
            <Label>Заметки</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Подробности..." rows={2} />
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Владелец: <strong>{owner}</strong>
            </span>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
