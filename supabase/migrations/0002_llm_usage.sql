-- Deephome · LLM 用量限流
-- 在 Supabase 后台 SQL Editor 里整段执行（在 0001 之后）。
--
-- 设计要点：
-- 1) 这张表【对所有用户完全不可读写】—— 不给任何 RLS policy。
--    否则用户可以把自己的计数清零。RLS 挡得住"读别人的数据"，挡不住"改自己的额度"。
-- 2) 只能通过下面的 security definer 函数消费额度：它以表所有者身份运行。
--    因此不需要 service_role key（那把 key 一旦泄露 = 全库沦陷）。
-- 3) "检查 + 自增"在一条 SQL 里原子完成（on conflict ... where），并发下无法绕过。

create table if not exists public.llm_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default (now() at time zone 'utc')::date,
  count   int  not null default 0,
  primary key (user_id, day)
);

alter table public.llm_usage enable row level security;
-- 故意不创建任何 policy：RLS 开启 + 无 policy = 普通用户一律拒绝。

create or replace function public.consume_llm_quota(p_limit int default 50)
returns table (allowed boolean, used int, remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  today     date := (now() at time zone 'utc')::date;
  new_count int;
begin
  if uid is null then
    return query select false, 0, 0;
    return;
  end if;

  -- 原子地：不存在则插入 1；存在且未超限则 +1；已超限则不更新（不返回行）
  insert into public.llm_usage (user_id, day, count)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set count = llm_usage.count + 1
    where llm_usage.count < p_limit
  returning count into new_count;

  if new_count is null then
    -- 未更新 = 已达上限
    select u.count into new_count
      from public.llm_usage u
     where u.user_id = uid and u.day = today;
    return query select false, coalesce(new_count, 0), 0;
  end if;

  return query select true, new_count, greatest(p_limit - new_count, 0);
end;
$$;

revoke all on function public.consume_llm_quota(int) from public, anon;
grant execute on function public.consume_llm_quota(int) to authenticated;
