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
3. **Expected columns:** `wallet_address` (text, unique), `email` (text, nullable), `discord_handle` (text, nullable). On connect we upsert a row by `wallet_address`; on Complete we update `email` and `discord_handle` for that row.

Data is also stored in the browser’s **localStorage** as a fallback and for pre-fill.

## Planned (next steps)

- Wire frontend to Supabase or backend API so registrations are stored in a database
