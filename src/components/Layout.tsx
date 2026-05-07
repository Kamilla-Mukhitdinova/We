import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '@/lib/store';
import { useTheme } from '@/hooks/use-theme';
import { LayoutDashboard, ListTodo, Heart, Plus, LogOut, KeyRound, Sun, Moon, BarChart3, Type, House, UtensilsCrossed, CalendarDays } from 'lucide-react';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { CreateWishDialog } from '@/components/CreateWishDialog';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { activeUser, logout, fontScale, setFontScale, storageMode, syncStatus } = useApp();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateWish, setShowCreateWish] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const avatarInitial = 'К';
  const avatarBg = 'bg-kamilla';
  const isSharedConnected = storageMode === 'shared' && syncStatus !== 'error';
  const storageBadge =
    storageMode === 'shared'
      ? isSharedConnected
        ? 'Облако подключено'
        : 'Облако недоступно'
      : 'Локальная база';

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/75 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
        <div className="ethno-line" />
        <div className="container flex min-h-16 items-center justify-between gap-4 py-2">
          {/* Logo + Nav */}
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-black text-primary-foreground shadow-sm">
                BP
              </div>
              <div>
                <h1 className="font-display text-lg font-extrabold tracking-tight text-foreground whitespace-nowrap">
                  Bismillah Planner
                </h1>
                <p className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:block">
                  Focus daily
                </p>
              </div>
            </div>
            <div className="hidden lg:flex flex-col gap-1">
              <div className="inline-flex items-center rounded-full border bg-background/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {storageBadge}
              </div>
            </div>
            <nav className="hidden sm:flex items-center gap-1 rounded-2xl border bg-background/70 p-1 shadow-sm">
              <NavTab to="/" label="Дэшборд" icon={<LayoutDashboard className="h-4 w-4" />} />
              <NavTab to="/tasks" label="Мои задачи" icon={<ListTodo className="h-4 w-4" />} />
              <NavTab to="/calendar" label="Календарь" icon={<CalendarDays className="h-4 w-4" />} />
              <NavTab to="/wishes" label="Мечты" icon={<Heart className="h-4 w-4" />} />
              <NavTab to="/menu-book" label="Меню" icon={<UtensilsCrossed className="h-4 w-4" />} />
              <NavTab to="/analytics" label="Аналитика" icon={<BarChart3 className="h-4 w-4" />} />
              <NavTab to="/home-life" label="Notes" icon={<House className="h-4 w-4" />} />
            </nav>
          </div>

          {/* Right: Theme + Quick action + Profile */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ y: -12, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 12, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 items-center gap-1 rounded-full border px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Type className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">{fontScale}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setFontScale('sm')}>Маленький текст</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontScale('md')}>Средний текст</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFontScale('lg')}>Большой текст</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick action "+" */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setShowCreateTask(true)}>
                  <ListTodo className="h-4 w-4 mr-2" />
                  Новая задача
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowCreateWish(true)}>
                  <Heart className="h-4 w-4 mr-2" />
                  Новое желание
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile pill */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-2xl border bg-background/70 px-2 py-1.5 shadow-sm transition-colors hover:bg-secondary">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-xl text-xs font-semibold text-primary-foreground ${avatarBg}`}>
                    {avatarInitial}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">{activeUser}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Сменить пароль
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 shadow-2xl shadow-slate-900/10 backdrop-blur-lg safe-area-bottom">
        <div className="flex justify-around py-2">
          <MobileNavTab to="/" icon={<LayoutDashboard className="h-5 w-5" />} label="Дэшборд" />
          <MobileNavTab to="/tasks" icon={<ListTodo className="h-5 w-5" />} label="Мои" />
          <MobileNavTab to="/calendar" icon={<CalendarDays className="h-5 w-5" />} label="Календарь" />
          <MobileNavTab to="/wishes" icon={<Heart className="h-5 w-5" />} label="Мечты" />
          <MobileNavTab to="/menu-book" icon={<UtensilsCrossed className="h-5 w-5" />} label="Меню" />
          <MobileNavTab to="/analytics" icon={<BarChart3 className="h-5 w-5" />} label="График" />
          <MobileNavTab to="/home-life" icon={<House className="h-5 w-5" />} label="Notes" />
        </div>
      </nav>

      <main className="container max-w-6xl py-6 pb-24 sm:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <CreateTaskDialog open={showCreateTask} onClose={() => setShowCreateTask(false)} />
      <CreateWishDialog open={showCreateWish} onClose={() => setShowCreateWish(false)} />
      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

function NavTab({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavTab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-semibold transition-colors ${
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
