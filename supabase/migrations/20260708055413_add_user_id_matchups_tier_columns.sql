-- Add user_id to matchups (missing from original schema)
alter table public.matchups add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Add tier_placement to reviews (for new schema)
alter table public.reviews add column if not exists tier_placement text check (tier_placement in ('like', 'okay', 'dislike'));

-- Add RLS on matchups for user_id (was not possible before)
alter table public.matchups enable row level security;

-- Drop any existing open matchup policies before creating scoped ones
do $$ begin
  drop policy if exists "Allow all matchup operations" on public.matchups;
  drop policy if exists "Users can read matchups" on public.matchups;
  drop policy if exists "Users can insert matchups" on public.matchups;
  drop policy if exists "Users can update matchups" on public.matchups;
  drop policy if exists "Users can delete matchups" on public.matchups;
exception when others then null;
end $$;

create policy "Users can read own matchups" on public.matchups
  for select using (auth.uid() = user_id);
create policy "Users can insert own matchups" on public.matchups
  for insert with check (auth.uid() = user_id);
create policy "Users can update own matchups" on public.matchups
  for update using (auth.uid() = user_id);
create policy "Users can delete own matchups" on public.matchups
  for delete using (auth.uid() = user_id);

-- Ensure books has a `tier` column for new schema compat (alias for tier_bucket)
-- Books table already has tier_bucket; add `tier` alias column
alter table public.books add column if not exists tier text check (tier in ('like', 'okay', 'dislike'));
