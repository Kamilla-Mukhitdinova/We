import { useState } from 'react';
import { HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping, storageMode, syncStatus, login } = useApp();
  const [password, setPassword] = useState('');
  const isSharedConnected = storageMode === 'shared' && syncStatus !== 'error';
  const storageLabel = storageMode === 'shared' ? 'Облачная синхронизация' : 'Локальная база';
  const storageStatusLabel =
    storageMode === 'shared'
      ? isSharedConnected
        ? 'Подключено'
        : 'Не подключено'
      : 'На этом устройстве';

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password.trim()) {
      toast.message('Введите пароль');
      return;
    }

    if (isBootstrapping) {
      toast.message('Подготавливаем приложение, подождите пару секунд');
      return;
    }

    const ok = await login('Kamilla', password.trim());
    if (!ok) {
      toast.message(isBootstrapping ? 'Подождите завершения подключения' : 'Не удалось войти');
      return;
    }

    setPassword('');
    toast.success('Вход выполнен');
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="dashboard-hero planner-surface rounded-[1.5rem] border bg-card p-8">
            <div className="mb-8 inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-4 w-4" />
              Private planner
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight text-foreground">
              Пространство для больших достижений
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Место, где намерения превращаются в ясный план, а маленькие шаги каждый день собираются в большой результат.
            </p>

            <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {storageLabel}
              </span>
              <span className="rounded-full bg-background px-2 py-1">
                {storageStatusLabel}
              </span>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-background/70 p-4">
                <p className="text-sm font-bold">Намерение</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Начать день осознанно</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-4">
                <p className="text-sm font-bold">Фокус</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Видеть главное</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-4">
                <p className="text-sm font-bold">Дисциплина</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Двигаться шагами</p>
              </div>
            </div>
          </section>

          <section className="planner-surface rounded-[1.5rem] border bg-card p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-extrabold">Вход</h2>
                <p className="text-xs text-muted-foreground">Личный вход Камиллы</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="grid gap-2">
                <span className="text-sm font-medium">Аккаунт</span>
                <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                  Kamilla
                </div>
              </div>

              <div className="grid gap-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Пароль
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Введите пароль"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isBootstrapping}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                <HeartHandshake className="h-4 w-4" />
                {isBootstrapping ? 'Подключаем...' : 'Войти'}
              </button>

              <div className="rounded-2xl border bg-secondary/45 p-4 text-xs leading-5 text-muted-foreground">
                Войдите под своим именем и личным паролем. Данные сохраняются локально в браузере, а пароль можно поменять в профиле.
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
