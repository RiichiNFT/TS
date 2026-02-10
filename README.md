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

## Planned (next steps)

- Form for social handles and email (editable only after wallet is connected)
- Backend/API for storing registrations
