/**
 * Example config — no secrets. The app reads from window.__ENV__ (set by env.js).
 *
 * Setup:
 * 1. Copy .env.example to .env and fill in your Supabase URL, anon key, Edge Function URL.
 * 2. Run: node scripts/inject-env.js   (writes env.js from .env; env.js is gitignored)
 * 3. Or set env vars and run: SUPABASE_URL=... SUPABASE_ANON_KEY=... EDGE_FUNCTION_URL=... node scripts/inject-env.js
 *
 * Production (e.g. Vercel): Add SUPABASE_URL, SUPABASE_ANON_KEY, EDGE_FUNCTION_URL in project
 * settings, then in Build & Development set build command to: node scripts/inject-env.js
 * (and keep your normal build or use "npm run build" that runs inject-env.js then static export).
 */
