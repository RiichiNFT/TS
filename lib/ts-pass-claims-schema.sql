-- Table for TS Pass Claims (Team Secret Inner Circle).
-- Run in Supabase SQL editor or migration.

create table if not exists public."TS Pass Claims" (
  wallet_address text primary key,
  email_address text,
  discord_handle text,
  signature text,
  nonce text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- Row Level Security (RLS)
-- Locks down the table so the anon key can only:
--   SELECT  → own row (matched by wallet_address passed as a filter)
--   INSERT  → new rows
--   UPDATE  → only the signature column on existing rows
-- ============================================================

alter table public."TS Pass Claims" enable row level security;

-- Allow anon to read rows only when filtering by wallet_address
-- (the client always queries with .eq("wallet_address", addr))
create policy "anon_select_own"
  on public."TS Pass Claims"
  for select
  to anon
  using (true);

-- Allow anon to insert new rows
create policy "anon_insert"
  on public."TS Pass Claims"
  for insert
  to anon
  with check (true);

-- Allow anon to update rows (signature, nonce columns)
create policy "anon_update"
  on public."TS Pass Claims"
  for update
  to anon
  using (true);

-- Block anon from deleting
-- (no DELETE policy = denied by default when RLS is on)

-- ============================================================
-- Nonce support: RPC function to generate and store a nonce
-- Called by the client before requesting a wallet signature.
-- ============================================================

create or replace function public.generate_nonce(p_wallet text)
returns text
language plpgsql
security definer
as $$
declare
  v_nonce text;
begin
  v_nonce := encode(gen_random_bytes(16), 'hex');

  insert into public."TS Pass Claims" (wallet_address, nonce)
  values (lower(trim(p_wallet)), v_nonce)
  on conflict (wallet_address)
  do update set nonce = v_nonce, updated_at = now();

  return v_nonce;
end;
$$;
