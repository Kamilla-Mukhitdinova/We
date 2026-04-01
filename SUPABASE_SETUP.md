# Supabase Setup

Этот проект умеет работать в двух режимах:

- `local`: данные живут только в браузере текущего устройства
- `shared`: данные синхронизируются через Supabase между телефонами и ноутбуками

## 1. Создайте проект Supabase

В панели Supabase создайте новый проект и возьмите:

- `Project URL`
- `anon public key`

## 2. Создайте таблицы

В SQL Editor выполните SQL из файла:

`[supabase/schema.sql](/Users/kamilla/Desktop/We/supabase/schema.sql)`

Там уже есть:

- `profiles`
- `pair_settings`
- `tasks`
- `wishes`
- `daily_wishes`
- индексы
- RLS-политики с привязкой к `auth.uid()` и `pair_id`

## 3. Заполните `.env.local`

Создайте файл `.env.local` в корне проекта:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_APP_STATE_ID=your-private-random-id
VITE_KAMILLA_EMAIL=kamilla@example.com
VITE_DOSZHAN_EMAIL=doszhan@example.com
```

После этого перезапустите приложение.

Если хотите не придумывать значения вручную, используйте уже готовый набор из
[SUPABASE_PRIVATE_VALUES.md](/Users/kamilla/Desktop/We/SUPABASE_PRIVATE_VALUES.md)
и шаблон
[.env.local.example-ready](/Users/kamilla/Desktop/We/.env.local.example-ready).

## 4. Создайте 2 аккаунта в Supabase Auth

Это внутренний технический шаг. В самом приложении Kamilla и Doszhan будут входить только по паролю, без ввода e-mail.

В Supabase:

- откройте `Authentication`
- создайте пользователя для Kamilla
- создайте пользователя для Doszhan
- e-mail этих пользователей должны совпадать с `VITE_KAMILLA_EMAIL` и `VITE_DOSZHAN_EMAIL`

Пароли этим аккаунтам вы задаёте уже в Supabase. После этого вход на сайте будет выглядеть для вас как `имя + пароль`, без показа e-mail.

## 5. Создайте профили пары

После создания аккаунтов выполните SQL, подставив ваши реальные e-mail:

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

Важно:

- `pair_id` у Kamilla и Doszhan должен быть одинаковый
- это и есть ваш закрытый идентификатор пары
- после этого RLS пустит к данным только вас двоих

## Что уже готово

Сейчас проект уже использует:

- настоящий вход через `Supabase Auth`
- таблицу `profiles`
- отдельные таблицы `tasks`, `wishes`, `daily_wishes`, `pair_settings`
- синхронизацию между устройствами после входа
- привязку доступа к данным через `auth.uid()` и `pair_id`

## Честная пометка

Это уже хороший закрытый вариант для вашей пары. Единственное, что можно улучшить потом:

- добавить таблицу `profiles` с дополнительными полями интерфейса
- разнести права ещё тоньше, если появятся новые роли
- сделать миграции через Supabase CLI
