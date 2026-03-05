// Default empty config so the app loads even when env.js is missing (e.g. fresh clone).
// When you run "node scripts/inject-env.js", env.js overwrites window.__ENV__ with real values.
window.__ENV__ = window.__ENV__ || {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SUPABASE_TABLE: "TS Pass Claims",
  EDGE_FUNCTION_URL: ""
};
