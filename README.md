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

## Data storage (Supabase)

Data is saved to your **Supabase** table **"TS Pass Claim"** when you configure it.

1. Copy `config.js` and set your Supabase project URL and anon key:
   - In **config.js**: set `window.SUPABASE_URL` (e.g. `https://xxxx.supabase.co`) and `window.SUPABASE_ANON_KEY` (from Supabase → Settings → API).
2. **Table name:** The app uses the table name in `config.js` (`window.SUPABASE_TABLE`). Default is `"TS Pass Claim"`. If your table has a different name (e.g. `ts_pass_claim`), set `window.SUPABASE_TABLE` to that name.
3. **Expected columns:** `wallet_address` (text, unique), `email_address` (text, nullable), `discord_handle` (text, nullable). On connect we upsert a row by `wallet_address`; on Complete we update `email` and `discord_handle` for that row.

Data is also stored in the browser’s **localStorage** as a fallback and for pre-fill.

**Database still empty?**

- **Config empty:** If `config.js` has empty `SUPABASE_URL` and `SUPABASE_ANON_KEY`, nothing is sent to Supabase. The page will show “Database not configured” under the form and “Saved in this browser only” after Complete. Fill in your project URL and anon key in `config.js` (Supabase → Settings → API).
- **Table name:** If your table in Supabase has a different name (e.g. `ts_pass_claim`), set `window.SUPABASE_TABLE` in `config.js` to that exact name (as shown in Supabase Table Editor).
- **Row Level Security (RLS):** If RLS is enabled, add policies that allow the `anon` role to `INSERT` and `UPDATE` rows on your table (e.g. allow all for testing, or restrict by column later).
- **Columns:** Ensure the table has columns `wallet_address`, `email_address`, and `discord_handle`. Names are case-sensitive in the API.

## Planned (next steps)

- Wire frontend to Supabase or backend API so registrations are stored in a database
