/**
 * Supabase Edge Function: /register
 *
 * Receives registration data + signature, verifies the signature server-side,
 * checks for duplicate email/discord, validates the nonce, and saves.
 *
 * Deploy: supabase functions deploy register
 * Set secrets: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TABLE = "TS Pass Claims";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { wallet_address, email, discord, message, signature } = await req.json();

    // --- Basic validation ---
    if (!wallet_address || !email || !message || !signature) {
      return json({ error: "Missing required fields: wallet_address, email, message, signature" }, 400);
    }

    const walletNorm = (wallet_address as string).trim().toLowerCase();
    const emailNorm = (email as string).trim().toLowerCase();
    const discordNorm = ((discord as string) || "").trim();

    // --- Verify signature ---
    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature).toLowerCase();
    } catch {
      return json({ error: "Invalid signature" }, 400);
    }

    if (recovered !== walletNorm) {
      return json({ error: "Signature does not match wallet address" }, 403);
    }

    // --- Verify nonce in message ---
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existing } = await sb
      .from(TABLE)
      .select("nonce, email_address, discord_handle")
      .eq("wallet_address", walletNorm)
      .maybeSingle();

    if (existing && existing.nonce) {
      if (!message.includes(existing.nonce)) {
        return json({ error: "Invalid or expired nonce. Please try again." }, 403);
      }
    }

    // --- If already has email, just update signature ---
    if (existing && existing.email_address) {
      await sb.from(TABLE)
        .update({ signature, nonce: null, updated_at: new Date().toISOString() })
        .eq("wallet_address", walletNorm);
      return json({
        success: true,
        alreadyExisted: true,
        email: existing.email_address,
        discord: existing.discord_handle || "",
      });
    }

    // --- Check duplicate email ---
    const { data: emailRows } = await sb
      .from(TABLE)
      .select("wallet_address")
      .eq("email_address", emailNorm);

    if (emailRows && emailRows.some((r: { wallet_address: string }) => r.wallet_address !== walletNorm)) {
      return json({ error: "This email is already registered.", field: "email" }, 409);
    }

    // --- Check duplicate discord ---
    if (discordNorm) {
      const { data: discordRows } = await sb
        .from(TABLE)
        .select("wallet_address")
        .eq("discord_handle", discordNorm);

      if (discordRows && discordRows.some((r: { wallet_address: string }) => r.wallet_address !== walletNorm)) {
        return json({ error: "This Discord handle is already registered.", field: "discord" }, 409);
      }
    }

    // --- Upsert registration ---
    const payload = {
      wallet_address: walletNorm,
      email_address: emailNorm,
      discord_handle: discordNorm || null,
      signature,
      nonce: null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await sb
      .from(TABLE)
      .upsert(payload, { onConflict: "wallet_address" });

    if (upsertErr) {
      // Fallback to plain insert if upsert constraint missing
      const { error: insertErr } = await sb.from(TABLE).insert(payload);
      if (insertErr) {
        return json({ error: insertErr.message || "Could not save to database." }, 500);
      }
    }

    return json({
      success: true,
      alreadyExisted: false,
      email: emailNorm,
      discord: discordNorm,
    });
  } catch (err) {
    console.error("register:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
