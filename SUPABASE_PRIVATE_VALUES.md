# Private Supabase Values

Этот файл оставлен как безопасный шаблон для личных значений.
Реальные пароли, e-mail и `pair_id` не храните в публичном репозитории.

## Скрытые служебные аккаунты

- Kamilla e-mail: `kamilla@example.com`
- Doszhan e-mail: `doszhan@example.com`

Эти e-mail нужны только для внутренней настройки Supabase. В самом приложении вы их не вводите.

## Пароли

- Kamilla пароль: придумайте свой приватный пароль в панели Supabase
- Doszhan пароль: придумайте свой приватный пароль в панели Supabase

## Pair ID

- `your-private-pair-id`

## `.env.local`

Когда создадите проект Supabase и получите `URL` и `Anon Key`, заполните так:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_SUPABASE_APP_STATE_ID=your-private-pair-id
VITE_KAMILLA_EMAIL=kamilla@example.com
VITE_DOSZHAN_EMAIL=doszhan@example.com
```

## SQL для profiles

```sql
insert into public.profiles (id, email, owner, pair_id)
select id, email, 'Kamilla', 'your-private-pair-id'
from auth.users
where email = 'kamilla@example.com';

insert into public.profiles (id, email, owner, pair_id)
select id, email, 'Doszhan', 'your-private-pair-id'
from auth.users
where email = 'doszhan@example.com';
```
