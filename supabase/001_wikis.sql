-- わたしのWiki: 保存テーブル
create table if not exists public.wikis (
  uid text primary key,
  name text not null default '',
  wiki text not null,
  transcript jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);
alter table public.wikis enable row level security;
-- サーバー側だけがキーを持つ前提で、このテーブルに限り読み書きを許可
drop policy if exists "wikis_select" on public.wikis;
drop policy if exists "wikis_insert" on public.wikis;
drop policy if exists "wikis_update" on public.wikis;
create policy "wikis_select" on public.wikis for select using (true);
create policy "wikis_insert" on public.wikis for insert with check (true);
create policy "wikis_update" on public.wikis for update using (true) with check (true);
