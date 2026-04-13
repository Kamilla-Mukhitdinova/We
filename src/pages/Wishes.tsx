import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Heart, Plus, Settings, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Wish } from '@/lib/types';
import { CreateWishDialog } from '@/components/CreateWishDialog';
import { ManageCategoriesDialog } from '@/components/ManageCategoriesDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Wishes() {
  const { activeUser, wishes, updateWish, deleteWish } = useApp();
  const [activeTab, setActiveTab] = useState<'mine' | 'couple' | 'achieved'>('mine');
  const [showMyWishDialog, setShowMyWishDialog] = useState(false);
  const [showCoupleWishDialog, setShowCoupleWishDialog] = useState(false);
  const [showWishCategories, setShowWishCategories] = useState(false);

  const myWishes = useMemo(
    () => wishes.filter((wish) => wish.scope === 'personal' && wish.owner === activeUser && wish.status !== 'achieved'),
    [activeUser, wishes]
  );

  const coupleWishes = useMemo(
    () => wishes.filter((wish) => wish.scope === 'couple' && wish.status !== 'achieved'),
    [wishes]
  );

  const achievedWishes = useMemo(
    () => wishes.filter((wish) => wish.status === 'achieved'),
    [wishes]
  );

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border bg-card p-6"
      >
        <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-rose-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Мечты</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowWishCategories(true)}
              className="rounded-2xl border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Settings className="mr-2 inline h-4 w-4" />
              Категории
            </button>
            <button
              onClick={() => setShowCoupleWishDialog(true)}
              className="rounded-2xl border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Добавить мечту пары
            </button>
            <button
              onClick={() => setShowMyWishDialog(true)}
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="mr-2 inline h-4 w-4" />
              Добавить мою мечту
            </button>
          </div>
        </div>
      </motion.section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mine' | 'couple' | 'achieved')} className="space-y-4">
        <TabsList className="h-auto rounded-[1.5rem] bg-secondary/70 p-1">
          <TabsTrigger value="mine" className="rounded-[1.2rem] px-4 py-2">Мои мечты</TabsTrigger>
          <TabsTrigger value="couple" className="rounded-[1.2rem] px-4 py-2">Общие мечты</TabsTrigger>
          <TabsTrigger value="achieved" className="rounded-[1.2rem] px-4 py-2">
            <span>Достигнутые</span>
            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              {achievedWishes.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <WishSection
            title="Мои мечты"
            subtitle="Ваши личные мечты и цели."
            emptyTitle="У вас пока нет личных мечт"
            wishes={myWishes}
            onToggleAchieved={(id, achieved) => updateWish(id, { status: achieved ? 'planned' : 'achieved' })}
            onDelete={deleteWish}
          />
        </TabsContent>

        <TabsContent value="couple">
          <WishSection
            title="Общие цели"
            subtitle="То, что вы хотите прожить, увидеть и построить вместе."
            emptyTitle="У пары пока нет общих мечт"
            wishes={coupleWishes}
            onToggleAchieved={(id, achieved) => updateWish(id, { status: achieved ? 'planned' : 'achieved' })}
            onDelete={deleteWish}
          />
        </TabsContent>

        <TabsContent value="achieved">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-emerald-800">Достигнутые мечты</h3>
                <p className="mt-1 text-sm text-emerald-900/70">
                  Всё, что уже стало вашей реальностью.
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                {achievedWishes.length}
              </div>
            </div>

            {achievedWishes.length === 0 ? (
              <div className="mt-5 rounded-[1.5rem] bg-white/50 px-5 py-10 text-center text-sm text-emerald-900/70">
                Когда первая мечта исполнится, она появится здесь.
              </div>
            ) : (
              <WishCategoryGroups
                wishes={achievedWishes}
                accent="success"
                onToggleAchieved={(id) => updateWish(id, { status: 'planned' })}
                onDelete={deleteWish}
              />
            )}
          </motion.section>
        </TabsContent>
      </Tabs>

      <CreateWishDialog
        open={showMyWishDialog}
        onClose={() => setShowMyWishDialog(false)}
        dialogTitle="Новая личная мечта"
        scopeOverride="personal"
      />
      <CreateWishDialog
        open={showCoupleWishDialog}
        onClose={() => setShowCoupleWishDialog(false)}
        dialogTitle="Новая мечта пары"
        scopeOverride="couple"
      />
      <ManageCategoriesDialog open={showWishCategories} onClose={() => setShowWishCategories(false)} type="wish" />
    </div>
  );
}

function WishSection({
  title,
  subtitle,
  emptyTitle,
  wishes,
  onToggleAchieved,
  onDelete,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  wishes: Wish[];
  onToggleAchieved: (id: string, achieved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border bg-card p-6">
      <div className="mb-5">
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {wishes.length === 0 ? (
        <div className="rounded-[1.5rem] bg-secondary/50 px-5 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-4 text-base font-medium">{emptyTitle}</p>
        </div>
      ) : (
        <WishCategoryGroups wishes={wishes} onToggleAchieved={onToggleAchieved} onDelete={onDelete} />
      )}
    </motion.section>
  );
}

function WishCategoryGroups({
  wishes,
  onToggleAchieved,
  onDelete,
  accent,
}: {
  wishes: Wish[];
  onToggleAchieved: (id: string, achieved: boolean) => void;
  onDelete: (id: string) => void;
  accent?: 'success';
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Wish[]>();
    wishes.forEach((wish) => {
      const key = wish.category || 'Без категории';
      const current = map.get(key) ?? [];
      map.set(key, [...current, wish]);
    });
    return Array.from(map.entries());
  }, [wishes]);

  return (
    <div className="space-y-4">
      {grouped.map(([category, items], groupIndex) => (
        <motion.div
          key={category}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIndex * 0.04 }}
          className={`rounded-[1.5rem] border p-4 ${accent === 'success' ? 'border-emerald-500/20 bg-white/60' : 'bg-secondary/20'}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className={`h-4 w-4 ${accent === 'success' ? 'text-emerald-600' : 'text-primary'}`} />
              <h4 className="text-lg font-semibold">{category}</h4>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {items.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {items.map((wish, index) => (
              <motion.article
                key={wish.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`overflow-hidden rounded-[1.6rem] border ${wish.status === 'achieved' ? 'border-emerald-500/20 bg-emerald-500/10' : 'bg-card'}`}
              >
                {wish.imageUrl && <img src={wish.imageUrl} alt={wish.title} className="h-56 w-full object-cover" />}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-base font-semibold">{wish.title}</h5>
                      {wish.notes && <p className="mt-2 text-sm leading-6 text-muted-foreground">{wish.notes}</p>}
                    </div>
                    <button
                      onClick={() => onDelete(wish.id)}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${wish.scope === 'couple' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {wish.scope === 'couple' ? 'Общая мечта' : `Личная мечта ${wish.owner}`}
                    </span>
                  </div>
                  <button
                    onClick={() => onToggleAchieved(wish.id, wish.status === 'achieved')}
                    className={`mt-5 flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
                      wish.status === 'achieved'
                        ? 'bg-background text-emerald-700 hover:bg-background/80'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {wish.status === 'achieved' ? 'Вернуть в активные' : 'Отметить как достигнуто'}
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
