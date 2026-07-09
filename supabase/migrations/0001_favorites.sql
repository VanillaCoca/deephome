-- Deephome · 收藏表
-- 在 Supabase 后台 SQL Editor 里整段执行。
--
-- 安全边界放在【数据库层】：RLS 保证任何人（包括拿到 anon key 的浏览器）
-- 都只能读写 auth.uid() = user_id 的行。前端被绕过也拿不到别人的数据。

create table if not exists public.favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  mls_number text        not null,
  listing    jsonb,      -- 收藏时的房源快照：房源日后下架，"我的收藏"仍能展示
  created_at timestamptz not null default now(),
  primary key (user_id, mls_number)
);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

drop policy if exists "read own favorites"   on public.favorites;
drop policy if exists "insert own favorites" on public.favorites;
drop policy if exists "delete own favorites" on public.favorites;

create policy "read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
