/**
 * Supabase config — no secrets in this file.
 * Values come from window.__ENV__ (injected at build/deploy time via env.js).
 * See config.example.js and README for setting up env.js from env vars.
 */
(function () {
  var e = typeof window !== "undefined" && window.__ENV__;
  window.SUPABASE_URL = (e && e.SUPABASE_URL) || "";
  window.SUPABASE_ANON_KEY = (e && e.SUPABASE_ANON_KEY) || "";
  window.SUPABASE_TABLE = (e && e.SUPABASE_TABLE) || "TS Pass Claims";
  window.EDGE_FUNCTION_URL = (e && e.EDGE_FUNCTION_URL) || "";
})();
