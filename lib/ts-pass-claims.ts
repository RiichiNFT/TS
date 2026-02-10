/**
 * Team Secret Inner Circle — Supabase TS Pass Claims
 * Use with an already-initialized Supabase client.
 *
 * Table expected: ts_pass_claims
 *   - wallet_address: text, primary key
 *   - email: text, nullable
 *   - discord_handle: text, nullable
 *   - created_at: timestamptz (default now())
 *   - updated_at: timestamptz (default now())
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const TS_PASS_CLAIMS_TABLE = "ts_pass_claims" as const;

export type TsPassClaimRow = {
  wallet_address: string;
  email: string | null;
  discord_handle: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ClaimResult =
  | { success: true; data?: TsPassClaimRow }
  | { success: false; error: string };

function normalizeAddress(address: string): string {
  return (address || "").trim().toLowerCase();
}

/**
 * On wallet connect: insert a row for this wallet if it doesn't exist.
 * If the wallet already exists, no-op and return success.
 */
export async function upsertClaimOnConnect(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<ClaimResult> {
  const address = normalizeAddress(walletAddress);
  if (!address) {
    return { success: false, error: "Wallet address is required." };
  }

  try {
    const { data, error } = await supabase
      .from(TS_PASS_CLAIMS_TABLE)
      .upsert(
        {
          wallet_address: address,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "wallet_address",
          ignoreDuplicates: true,
        }
      )
      .select("wallet_address, email, discord_handle, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned when ignoreDuplicates skipped insert (row already exists)
        return { success: true };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as TsPassClaimRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Update the claim row for this wallet with the given email.
 */
export async function updateClaimEmail(
  supabase: SupabaseClient,
  walletAddress: string,
  email: string
): Promise<ClaimResult> {
  const address = normalizeAddress(walletAddress);
  const emailTrimmed = (email || "").trim();
  if (!address) return { success: false, error: "Wallet address is required." };
  if (!emailTrimmed) return { success: false, error: "Email is required." };
  if (!emailTrimmed.includes("@"))
    return { success: false, error: "Invalid email format." };

  try {
    const { data, error } = await supabase
      .from(TS_PASS_CLAIMS_TABLE)
      .update({
        email: emailTrimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("wallet_address", address)
      .select("wallet_address, email, discord_handle, created_at, updated_at")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as TsPassClaimRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Update the claim row for this wallet with the given Discord handle.
 */
export async function updateClaimDiscord(
  supabase: SupabaseClient,
  walletAddress: string,
  discordHandle: string
): Promise<ClaimResult> {
  const address = normalizeAddress(walletAddress);
  const discordTrimmed = (discordHandle || "").trim();
  if (!address) return { success: false, error: "Wallet address is required." };

  try {
    const { data, error } = await supabase
      .from(TS_PASS_CLAIMS_TABLE)
      .update({
        discord_handle: discordTrimmed || null,
        updated_at: new Date().toISOString(),
      })
      .eq("wallet_address", address)
      .select("wallet_address, email, discord_handle, created_at, updated_at")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as TsPassClaimRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Update email and Discord in one call (e.g. when user submits the full form).
 * Still uses wallet_address as the key.
 */
export async function updateClaimProfile(
  supabase: SupabaseClient,
  walletAddress: string,
  payload: { email: string; discordHandle?: string }
): Promise<ClaimResult> {
  const address = normalizeAddress(walletAddress);
  const emailTrimmed = (payload.email || "").trim();
  const discordTrimmed = (payload.discordHandle ?? "").trim() || null;
  if (!address) return { success: false, error: "Wallet address is required." };
  if (!emailTrimmed) return { success: false, error: "Email is required." };
  if (!emailTrimmed.includes("@"))
    return { success: false, error: "Invalid email format." };

  try {
    const { data, error } = await supabase
      .from(TS_PASS_CLAIMS_TABLE)
      .update({
        email: emailTrimmed,
        discord_handle: discordTrimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("wallet_address", address)
      .select("wallet_address, email, discord_handle, created_at, updated_at")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as TsPassClaimRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Fetch the claim row for a wallet (e.g. to pre-fill form or check completion).
 */
export async function getClaimByWallet(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<ClaimResult> {
  const address = normalizeAddress(walletAddress);
  if (!address) return { success: false, error: "Wallet address is required." };

  try {
    const { data, error } = await supabase
      .from(TS_PASS_CLAIMS_TABLE)
      .select("wallet_address, email, discord_handle, created_at, updated_at")
      .eq("wallet_address", address)
      .single();

    if (error) {
      if (error.code === "PGRST116") return { success: true, data: undefined };
      return { success: false, error: error.message };
    }
    return { success: true, data: data as TsPassClaimRow };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: message };
  }
}
