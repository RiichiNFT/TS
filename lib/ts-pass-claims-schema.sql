-- Table for TS Pass Claims (Team Secret Inner Circle).
-- Run in Supabase SQL editor or migration.

create table if not exists public."TS Pass Claims" (
  wallet_address text primary key,
  email_address text,
  discord_handle text,
  signature text,
  nonce text,
  confirmation_sent boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- Row Level Security (RLS)
-- No anon policies: the anon key cannot read, insert, update,
-- or delete rows directly. All data access goes through either
-- SECURITY DEFINER RPC functions (below) or the Edge Function
-- which uses the service_role key (bypasses RLS).
-- ============================================================

alter table public."TS Pass Claims" enable row level security;

-- Drop legacy permissive policies if they exist
drop policy if exists "anon_select_own" on public."TS Pass Claims";
drop policy if exists "anon_insert"     on public."TS Pass Claims";
drop policy if exists "anon_update"     on public."TS Pass Claims";

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

-- ============================================================
-- check_registration: returns email & discord for a wallet.
-- Called by the client after wallet connect to check if already
-- registered. SECURITY DEFINER so it bypasses RLS.
-- ============================================================

create or replace function public.check_registration(p_wallet text)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'email_address', email_address,
    'discord_handle', discord_handle
  ) into v_result
  from public."TS Pass Claims"
  where wallet_address = lower(trim(p_wallet))
    and email_address is not null;

  return coalesce(v_result, '{}'::json);
end;
$$;

-- ============================================================
-- check_duplicate: returns whether an email or discord handle
-- is already taken by a different wallet. Called by the client
-- before the registration signature request.
-- ============================================================

create or replace function public.check_duplicate(
  p_email text,
  p_discord text,
  p_exclude_wallet text
)
returns json
language plpgsql
security definer
as $$
declare
  v_email_taken boolean := false;
  v_discord_taken boolean := false;
  v_wallet_norm text := lower(trim(p_exclude_wallet));
begin
  if p_email is not null and trim(p_email) != '' then
    select exists(
      select 1 from public."TS Pass Claims"
      where email_address = lower(trim(p_email))
        and wallet_address != v_wallet_norm
    ) into v_email_taken;
  end if;

  if p_discord is not null and trim(p_discord) != '' then
    select exists(
      select 1 from public."TS Pass Claims"
      where discord_handle = trim(p_discord)
        and wallet_address != v_wallet_norm
    ) into v_discord_taken;
  end if;

  return json_build_object(
    'email_taken', v_email_taken,
    'discord_taken', v_discord_taken
  );
end;
$$;
