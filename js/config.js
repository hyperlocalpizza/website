/**
 * VIPizza — Supabase client configuration.
 *
 * This project was previously configured for a local Docker / CLI Supabase
 * instance. Keep the old values below commented if you need to quickly revert.
 *
 * For the hosted project, replace the placeholders with your Supabase project
 * values from the dashboard: Settings → API
 *
 *   SUPABASE_URL      -> https://<your-project-ref>.supabase.co
 *   SUPABASE_ANON_KEY -> the public "anon" key (safe to expose in the browser)
 *
 * NOTE: The anon key is public by design. Never put the service_role key here.
 */

// Legacy local Docker / CLI compatibility (uncomment this block to revert):
// const SUPABASE_URL = "http://localhost:8000";
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";

// Hosted Supabase project values
const SUPABASE_URL = "https://qiqjqqejegsworbdbjva.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vKdnmcbja8fqpPg04RAixA_DwI0kkfM";

// Create a single shared client instance.
// The Supabase CDN script may not have finished loading when this file runs,
// so wait until `window.supabase` is available before creating the client.
function initClient() {
  if (window.VIPizza && window.VIPizza.supabase) {
    return window.VIPizza.supabase;
  }
  if (typeof window.supabase === "undefined") {
    // CDN not loaded yet — retry shortly.
    setTimeout(initClient, 50);
    return null;
  }
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  window.VIPizza = window.VIPizza || {};
  window.VIPizza.supabase = supabase;
  window.VIPizza.config = { SUPABASE_URL, SUPABASE_ANON_KEY };
  return supabase;
}

initClient();

// Helper for other modules: returns the client once it's ready.
// Usage: const supabase = window.VIPizza.getClient();
window.VIPizza.getClient = function () {
  if (window.VIPizza.supabase) return window.VIPizza.supabase;
  initClient();
  return window.VIPizza.supabase;
};