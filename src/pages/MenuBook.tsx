import { ChangeEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenText, ImagePlus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { prepareImageForStorage } from '@/lib/image-storage';

export default function MenuBook() {
  const { recipeEntries, addRecipeEntry, deleteRecipeEntry } = useApp();
  const [title, setTitle] = useState('');
  const [recipe, setRecipe] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const entries = useMemo(
    () => [...recipeEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [recipeEntries]
  );

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

  const handleAddRecipe = () => {
    if (!title.trim() || !recipe.trim()) return;

    addRecipeEntry({
      title: title.trim(),
      recipe: recipe.trim(),
      imageUrl: imageUrl || undefined,
    });

    setTitle('');
    setRecipe('');
    setImageUrl(null);
  };

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border bg-card p-6"
      >
        <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -top-6 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold">Меню</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ваши блюда, рецепты и фото в одном месте.</p>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.8rem] border bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <BookOpenText className="h-5 w-5 text-primary" />
          <h3 className="font-display text-2xl font-bold">Книга рецептов</h3>
        </div>

        <Tabs defaultValue="create" className="mt-4 space-y-3">
          <TabsList className="h-auto rounded-xl bg-secondary/60 p-1">
            <TabsTrigger value="create" className="rounded-lg px-3 py-1.5 text-xs">Добавить</TabsTrigger>
            <TabsTrigger value="view" className="rounded-lg px-3 py-1.5 text-xs">Смотреть</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-0 space-y-3 rounded-xl border bg-secondary/20 p-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название блюда"
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
            />
            <textarea
              value={recipe}
              onChange={(event) => setRecipe(event.target.value)}
              placeholder="Напишите рецепт"
              className="min-h-40 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            />

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <ImagePlus className="h-4 w-4" />
              Прикрепить фото
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            {imageUrl ? (
              <div className="relative w-fit">
                <img src={imageUrl} alt="Рецепт" className="h-32 w-32 rounded-xl object-cover" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ) : null}

            <button
              onClick={handleAddRecipe}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Сохранить рецепт
            </button>
          </TabsContent>

          <TabsContent value="view" className="mt-0 space-y-3 rounded-xl border bg-secondary/20 p-4">
            {entries.length === 0 ? (
              <div className="rounded-xl bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                Пока здесь нет рецептов
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="overflow-hidden rounded-[1.4rem] border bg-background">
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.title} className="h-52 w-full object-cover" />
                  ) : null}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold">{entry.title}</h4>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.recipe}</p>
                      </div>
                      <button
                        onClick={() => deleteRecipeEntry(entry.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                        title="Удалить рецепт"
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
      </motion.section>
    </div>
  );
}
