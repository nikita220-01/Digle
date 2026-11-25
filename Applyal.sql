-- === ОЧИСТКА ===
drop policy if exists "avatars upload" on storage.objects;
drop policy if exists "avatars select" on storage.objects;
drop policy if exists "avatars update" on storage.objects;
drop policy if exists "attachments upload" on storage.objects;
drop policy if exists "attachments select" on storage.objects;

drop table if exists public.read_receipts cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversation_members cascade;
drop table if exists public.conversations cascade;
drop table if exists public.profiles cascade;

-- === ТАБЛИЦЫ ===
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_id bigint generated always as identity unique,
  username text unique not null,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  title text,
  created_at timestamptz default now()
);

create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text,
  attachment_type text,
  attachment_url text,
  created_at timestamptz default now()
);

-- === RLS: profiles ===
alter table public.profiles enable row level security;
create policy "profiles select" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

-- === RLS: conversations ===
alter table public.conversations enable row level security;
create policy "conv select" on public.conversations for select to authenticated
  using (exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid()));
create policy "conv insert" on public.conversations for insert to authenticated with check (true);

-- === RLS: conversation_members ===
alter table public.conversation_members enable row level security;
create policy "members select" on public.conversation_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.conversation_members m where m.conversation_id = conversation_id and m.user_id = auth.uid()));
create policy "members insert" on public.conversation_members for insert to authenticated with check (true);

-- === RLS: messages ===
alter table public.messages enable row level security;
create policy "msg select" on public.messages for select to authenticated
  using (exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy "msg insert" on public.messages for insert to authenticated with check (sender_id = auth.uid());

-- === STORAGE ===
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "avatars upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "attachments upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');
create policy "attachments select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments');