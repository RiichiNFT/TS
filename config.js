/**
 * Supabase config.
 * env.js (gitignored) can override these values via window.__ENV__.
 * The anon key is safe to include here — it is a public client key by design.
 * The service role key is only used in the Edge Function (server-side).
 */
(function () {
  var e = typeof window !== "undefined" && window.__ENV__;
  window.SUPABASE_URL = (e && e.SUPABASE_URL) || "https://qmlpxruqdfvazimeoulm.supabase.co";
  window.SUPABASE_ANON_KEY = (e && e.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtbHB4cnVxZGZ2YXppbWVvdWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTUxMTYsImV4cCI6MjA4NjI3MTExNn0.a1dGjjqiXxGeYA5VaZeVloXSfngnCC9EDf3mg9dF14E";
  window.SUPABASE_TABLE = (e && e.SUPABASE_TABLE) || "TS Pass Claims";
  window.EDGE_FUNCTION_URL = (e && e.EDGE_FUNCTION_URL) || "https://qmlpxruqdfvazimeoulm.supabase.co/functions/v1/register";
})();
