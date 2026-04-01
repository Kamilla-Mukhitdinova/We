create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  owner text not null unique,
  pair_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pair_settings (
  pair_id text primary key,
  categories text[] not null default array['Home', 'Work', 'Study'],
  wish_categories text[] not null default array['Покупки', 'Учёба', 'Путешествия', 'Семья', 'Дом', 'Опыт'],
  custom_hadiths text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id text primary key,
  pair_id text not null,
  title text not null,
  description text,
  category text not null,
  kind text not null,
  recurrence text,
  repeat_days integer[] not null default '{}',
  completion_dates text[] not null default '{}',
  status text not null,
  due_date_time timestamptz,
  owner text not null,
  created_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists tasks_pair_id_idx on public.tasks(pair_id);

create table if not exists public.wishes (
  id text primary key,
  pair_id text not null,
  title text not null,
  notes text,
  image_url text,
  category text,
  owner text not null,
  scope text not null,
  status text not null,
  created_at timestamptz not null,
  achieved_at timestamptz
);

create index if not exists wishes_pair_id_idx on public.wishes(pair_id);

create table if not exists public.daily_wishes (
  id text primary key,
  pair_id text not null,
  "from" text not null,
  "to" text not null,
  message text not null,
  date text not null,
  created_at timestamptz not null
);

create index if not exists daily_wishes_pair_id_idx on public.daily_wishes(pair_id);

alter table public.pair_settings enable row level security;
alter table public.tasks enable row level security;
alter table public.wishes enable row level security;
alter table public.daily_wishes enable row level security;
alter table public.profiles enable row level security;

create policy "read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "read pair_settings for own pair"
on public.pair_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = pair_settings.pair_id
  )
);

create policy "write pair_settings for own pair"
on public.pair_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = pair_settings.pair_id
  )
)
with check (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = pair_settings.pair_id
  )
);

create policy "read tasks for own pair"
on public.tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = tasks.pair_id
  )
);

create policy "write tasks for own pair"
on public.tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = tasks.pair_id
  )
)
with check (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = tasks.pair_id
  )
);

create policy "read wishes for own pair"
on public.wishes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = wishes.pair_id
  )
);

create policy "write wishes for own pair"
on public.wishes
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = wishes.pair_id
  )
)
with check (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = wishes.pair_id
  )
);

create policy "read daily_wishes for own pair"
on public.daily_wishes
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = daily_wishes.pair_id
  )
);

create policy "write daily_wishes for own pair"
on public.daily_wishes
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = daily_wishes.pair_id
  )
)
with check (
  exists (
    select 1
    from public.profiles profiles
    where profiles.id = auth.uid()
      and profiles.pair_id = daily_wishes.pair_id
  )
);
