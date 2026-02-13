/**
 * Supabase config for TS Pass Claim.
 * 1. Get your project URL and anon key from Supabase dashboard → Settings → API.
 * 2. Set SUPABASE_URL and SUPABASE_ANON_KEY below.
 * 3. Table name must match your Supabase table (e.g. "TS Pass Claim" or "ts_pass_claim").
 *    Table should have columns: wallet_address (unique), email_address, discord_handle.
 */
window.SUPABASE_URL = "https://qmlpxruqdfvazimeoulm.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbHB4cnVxZGZ2YXppbWVvdWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTUxMTYsImV4cCI6MjA4NjI3MTExNn0.a1dGjjqiXxGeYA5VaZeVloXSfngnCC9EDf3mg9dF14E";
window.SUPABASE_TABLE = "TS Pass Claims";

/**
 * Edge Function URL for server-side registration (signature verification + save).
 * Deploy the Edge Function in supabase/functions/register/, then set this URL.
 * When set, registration writes go through the Edge Function instead of direct Supabase writes.
 * When empty/unset, the app falls back to direct Supabase client writes.
 */
window.EDGE_FUNCTION_URL = "";
