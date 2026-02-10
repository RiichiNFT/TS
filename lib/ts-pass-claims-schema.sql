-- Table for TS Pass Claims (Team Secret Inner Circle).
-- Run in Supabase SQL editor or migration.

create table if not exists public.ts_pass_claims (
  wallet_address text primary key,
  email text,
  discord_handle text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Optional: RLS policies (adjust to your auth model)
-- alter table public.ts_pass_claims enable row level security;
-- create policy "Allow insert for authenticated" on public.ts_pass_claims for insert with (true);
-- create policy "Allow update own row" on public.ts_pass_claims for update using (true);
-- create policy "Allow select own row" on public.ts_pass_claims for select using (true);
