import { Owner, TaskStatus } from '@/lib/types';

export function OwnerBadge({ owner }: { owner: Owner }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
      owner === 'Kamilla'
        ? 'bg-kamilla-light text-kamilla-foreground'
        : 'bg-doszhan-light text-doszhan-foreground'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${owner === 'Kamilla' ? 'bg-kamilla' : 'bg-doszhan'}`} />
      {owner}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
      {category === 'Home' ? 'Дом' : category === 'Work' ? 'Работа' : category === 'Study' ? 'Учёба' : category}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; className: string }> = {
    todo: { label: 'К выполнению', className: 'bg-secondary text-muted-foreground' },
    in_progress: { label: 'В процессе', className: 'bg-accent/15 text-accent-foreground' },
    done: { label: 'Выполнено', className: 'bg-status-done-light text-foreground' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}
