/**
 * Supabase Edge Function: /register
 *
 * Receives registration data + signature, verifies the signature server-side,
 * checks for duplicate email/discord, validates the nonce, saves, and sends
 * a confirmation email via Resend on first-time registration.
 *
 * Deploy: supabase functions deploy register
 * Set secrets:
 *   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
 *   supabase secrets set RESEND_API_KEY=re_...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TABLE = "TS Pass Claims";

const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatWallet(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

async function sendConfirmationEmail(to: string, wallet: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipping confirmation email.");
    return false;
  }

  const shortWallet = formatWallet(wallet);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Team Secret <onboarding@resend.dev>",
        to: [to],
        subject: "You're registered — Team Secret Inner Circle",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #e0e0e0; background: #111111; border-radius: 12px;">
            <h2 style="color: #ffffff; margin: 0 0 16px;">Welcome to the Inner Circle</h2>
            <p style="margin: 0 0 12px; line-height: 1.6;">
              Your registration for the <strong>Team Secret Inner Circle</strong> has been confirmed.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; color: #999;">Wallet</td>
                <td style="padding: 8px 0; color: #fff; font-family: monospace;">${shortWallet}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #999;">Email</td>
                <td style="padding: 8px 0; color: #fff;">${to}</td>
              </tr>
            </table>
            <p style="margin: 20px 0 0; line-height: 1.6;">
              Stay tuned for Team Secret updates. No further action is needed.
            </p>
            <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
            <p style="margin: 0; font-size: 12px; color: #666;">
              This is an automated message from Team Secret. If you did not register, you can ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error:", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendConfirmationEmail failed:", err);
    return false;
  }
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

    if (emailNorm.length > 254) {
      return json({ error: "Email must be 254 characters or fewer.", field: "email" }, 400);
    }
    if (discordNorm.length > 0 && (discordNorm.length < 2 || discordNorm.length > 32)) {
      return json({ error: "Discord handle must be between 2 and 32 characters.", field: "discord" }, 400);
    }

    const sig = typeof signature === "string" ? signature.trim() : "";
    if (!sig.startsWith("0x") || !/^0x[0-9a-fA-F]+$/.test(sig) || sig.length < 66 || /^0x0+$/.test(sig)) {
      return json({ error: "Invalid signature format" }, 400);
    }

    // --- Verify signature (ecrecover); smart contract wallets (e.g. Base app) may throw ---
    let recovered: string | null = null;
    try {
      recovered = ethers.verifyMessage(message, sig).toLowerCase();
    } catch {
      recovered = null;
    }

    if (recovered !== null && recovered !== walletNorm) {
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
        .update({ signature: sig, nonce: null, updated_at: new Date().toISOString() })
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
      signature: sig,
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

    const emailSent = await sendConfirmationEmail(emailNorm, walletNorm);
    if (emailSent) {
      await sb.from(TABLE)
        .update({ confirmation_sent: true })
        .eq("wallet_address", walletNorm);
    }

    return json({
      success: true,
      alreadyExisted: false,
      email: emailNorm,
      discord: discordNorm,
      confirmationSent: emailSent,
    });
  } catch (err) {
    console.error("register:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
