import { useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { activeUser, changePassword } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNextPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword || !nextPassword || !confirmPassword) {
      toast.message('Заполните все поля');
      return;
    }

    if (nextPassword !== confirmPassword) {
      toast.message('Новые пароли не совпадают');
      return;
    }

    const result = await changePassword(currentPassword, nextPassword);
    if (!result.ok) {
      toast.message(result.message);
      return;
    }

    toast.success(result.message);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Сменить пароль</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Аккаунт: <span className="font-medium text-foreground">{activeUser}</span>
          </p>

          <div className="grid gap-2">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="next-password">Новый пароль</Label>
            <Input
              id="next-password"
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Повторите новый пароль</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Обновить пароль
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
