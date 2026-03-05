# Team Secret — Airdrop Registration

Landing page for onboarding Team Secret’s community to register their wallet for a future NFT airdrop. Visual-first, low-friction for gamers new to blockchain.

## Initial step (current)

- **Team Secret logo** at the top (links to teamsecret.gg)
- **Connect Wallet** button — works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM wallets
- **Social links** in the footer: Twitter/X, Instagram, YouTube, Twitch, Discord

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the URL shown (e.g. http://localhost:3000 or http://localhost:8000).

## Tech

- Plain HTML, CSS, and JavaScript
- Wallet connection via `window.ethereum` (EIP-1193)
- Optional switch to Base mainnet after connect

## Config and secrets (no keys in repo)

The app reads config from **`window.__ENV__`**, which is set by **`env.js`**. That file is **generated** and **gitignored**, so real keys are never committed.

**Local dev:**
1. Copy `.env.example` to `.env` and fill in your Supabase URL, anon key, and Edge Function URL.
2. Run: `node scripts/inject-env.js` — this writes `env.js` from your `.env`.
3. Serve the app as below. If `env.js` is missing, the app loads but shows "Database not configured".

**Production (e.g. Vercel):**  
Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EDGE_FUNCTION_URL` (and optionally `SUPABASE_TABLE`) in your project's environment variables. Set the build command to run `node scripts/inject-env.js` before your static export (or as the only step if you're serving the repo as static files). The built output will include a generated `env.js` with those values.

**Optional:** Install `dotenv` for local dev so `inject-env.js` reads `.env` automatically: `npm install dotenv` (or run with env vars set: `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/inject-env.js`).

---

## Data storage (Supabase)

Data is saved to your **Supabase** table when you configure it (via `env.js`).

1. **Table name:** Set `SUPABASE_TABLE` in `.env` / env vars (default `"TS Pass Claims"`).
3. **Expected columns:** `wallet_address` (text, unique), `email_address` (text, nullable), `discord_handle` (text, nullable). On connect we upsert a row by `wallet_address`; on Complete we update `email` and `discord_handle` for that row.

Only Supabase is used for storage; localStorage is not used for form data.

**Database still empty?**

- **Config empty:** If `config.js` has empty `SUPABASE_URL` and `SUPABASE_ANON_KEY`, nothing is sent to Supabase. The page will show “Database not configured” under the form and “Saved in this browser only” after Complete. Fill in your project URL and anon key in `config.js` (Supabase → Settings → API).
- **Table name:** If your table in Supabase has a different name (e.g. `ts_pass_claim`), set `window.SUPABASE_TABLE` in `config.js` to that exact name (as shown in Supabase Table Editor).
- **Row Level Security (RLS):** If RLS is enabled, add policies that allow the `anon` role to `INSERT` and `UPDATE` rows on your table (e.g. allow all for testing, or restrict by column later).
- **Columns:** Ensure the table has columns `wallet_address`, `email_address`, and `discord_handle`. Names are case-sensitive in the API.
- **Unique constraint:** If you see "no unique or exclusion constraint matching the ON CONFLICT specification", your table does not have a unique constraint on `wallet_address`. The app will fall back to insert, but you may get duplicate rows. In Supabase SQL Editor run: `ALTER TABLE "TS Pass Claims" ADD UNIQUE (wallet_address);` (adjust table name if different) so one row per wallet is enforced and upsert works.

## Planned (next steps)

- Wire frontend to Supabase or backend API so registrations are stored in a database
