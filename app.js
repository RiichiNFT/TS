/**
 * Team Secret Inner Circle Pass — Connect, form, persistence.
 * Works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM injectors.
 * Data is stored in Supabase table "TS Pass Claim" (and in localStorage as fallback).
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.
 */

const STORAGE_KEY = "ts-pass-registrations";

var SUPABASE_URL = (typeof window !== "undefined" && window.SUPABASE_URL) || "";
var SUPABASE_ANON_KEY = (typeof window !== "undefined" && window.SUPABASE_ANON_KEY) || "";
var SUPABASE_TABLE = (typeof window !== "undefined" && window.SUPABASE_TABLE) || "TS Pass Claim";

var _supabaseClient = null;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || typeof supabase === "undefined") return null;
  if (!_supabaseClient) _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}

function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && typeof supabase !== "undefined");
}

function normalizeAddress(addr) {
  return (addr || "").trim().toLowerCase();
}

const connectButton = document.getElementById("connectWallet");
const connectButtonText = document.getElementById("connectButtonText");
const walletAddressEl = document.getElementById("walletAddress");
const walletAddressText = document.getElementById("walletAddressText");
const walletDisconnectBtn = document.getElementById("walletDisconnect");
const sublineEl = document.getElementById("subline");
const connectBlock = document.getElementById("connectBlock");
const formSection = document.getElementById("formSection");
const emailInput = document.getElementById("emailInput");
const discordInput = document.getElementById("discordInput");
const emailError = document.getElementById("emailError");
const discordError = document.getElementById("discordError");
const completeBtn = document.getElementById("completeBtn");
const successSection = document.getElementById("successSection");
const successDbHint = document.getElementById("successDbHint");
const sublineDbHint = document.getElementById("sublineDbHint");

let currentAddress = null;

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getRegistrations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setRegistrations(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

function loadSavedForAddress(address) {
  const reg = getRegistrations();
  return reg[address] || null;
}

function showConnectState() {
  walletAddressEl.classList.add("is-hidden");
  connectBlock.classList.remove("is-hidden");
  formSection.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  sublineEl.textContent = "Connect your wallet to get started";
  currentAddress = null;
}

function showJoinedState(address) {
  currentAddress = address;
  const short = formatAddress(address);
  if (walletAddressText) walletAddressText.textContent = short;
  walletAddressEl.classList.remove("is-hidden");
  connectBlock.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  formSection.classList.remove("is-hidden");
  sublineEl.textContent = "Complete your details below.";
  if (sublineDbHint) {
    sublineDbHint.textContent = isSupabaseConfigured()
      ? ""
      : "Database not configured — data will only be saved in this browser. Add SUPABASE_URL and SUPABASE_ANON_KEY in config.js to save to Supabase.";
    sublineDbHint.classList.toggle("is-hidden", isSupabaseConfigured());
  }
  emailError.textContent = "";
  discordError.textContent = "";
  emailInput.classList.remove("input-error");
  discordInput.classList.remove("input-error");
  emailInput.value = "";
  discordInput.value = "";
  loadPrefill(address);
}

function loadPrefill(address) {
  const fromLocal = loadSavedForAddress(address);
  if (fromLocal) {
    emailInput.value = fromLocal.email || "";
    discordInput.value = fromLocal.discord || "";
  }
  var sb = getSupabase();
  if (!sb) return;
  sb.from(SUPABASE_TABLE)
    .select("email, discord_handle")
    .eq("wallet_address", normalizeAddress(address))
    .maybeSingle()
    .then(function (r) {
      if (r.error) return;
      if (r.data && (r.data.email || r.data.discord_handle)) {
        if (r.data.email) emailInput.value = r.data.email;
        if (r.data.discord_handle) discordInput.value = r.data.discord_handle;
      }
    });
}

function showSuccess() {
  formSection.classList.add("is-hidden");
  successSection.classList.remove("is-hidden");
  if (successDbHint) successDbHint.classList.add("is-hidden");
}

function validateEmail(value) {
  const v = (value || "").trim();
  if (!v) return "Email is required.";
  if (v.length < 5) return "Invalid email address.";
  if (!v.includes("@")) return "Invalid email address.";
  const atIdx = v.indexOf("@");
  if (atIdx === 0 || atIdx === v.length - 1) return "Invalid email address.";
  const domain = v.slice(atIdx + 1);
  if (!domain.includes(".") || domain.length < 3) return "Invalid email address.";
  if (/[^\w.+-@]/.test(v)) return "Invalid email address.";
  return null;
}

function validateDiscord(value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (v.length > 100) return "Discord handle is too long.";
  return null;
}

function isDuplicateEmail(email, excludeAddress) {
  const reg = getRegistrations();
  const normalized = (email || "").trim().toLowerCase();
  for (const [addr, data] of Object.entries(reg)) {
    if (addr === excludeAddress) continue;
    if ((data.email || "").trim().toLowerCase() === normalized) return true;
  }
  return false;
}

async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    alert("No wallet found. Install MetaMask, Coinbase Wallet, or open this page in the Base app to connect.");
    return;
  }
  try {
    connectButton.disabled = true;
    connectButtonText.textContent = "Connecting…";
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      showJoinedState(address);
      connectButtonText.textContent = "Connect";
      var sb = getSupabase();
      if (sb) {
        sb.from(SUPABASE_TABLE)
          .upsert(
            { wallet_address: normalizeAddress(address) },
            { onConflict: "wallet_address" }
          )
          .then(function (r) {
            if (r.error) {
              console.error("Supabase upsert on connect:", r.error.message, r.error);
            }
          });
      }
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
      } catch (_) {}
    }
  } catch (err) {
    console.error(err);
    connectButtonText.textContent = "Connect";
    if (err.code === 4001) return;
    alert("Connection failed. Try again or use another wallet.");
  } finally {
    connectButton.disabled = false;
  }
}

function onDisconnect() {
  showConnectState();
  connectButton.classList.remove("connected");
  connectButtonText.textContent = "Connect";
}

function onComplete() {
  const email = emailInput.value.trim();
  const discord = discordInput.value.trim();
  emailError.textContent = "";
  discordError.textContent = "";
  emailInput.classList.remove("input-error");
  discordInput.classList.remove("input-error");

  const emailErr = validateEmail(emailInput.value);
  if (emailErr) {
    emailError.textContent = emailErr;
    emailInput.classList.add("input-error");
    return;
  }
  const discordErr = validateDiscord(discordInput.value);
  if (discordErr) {
    discordError.textContent = discordErr;
    discordInput.classList.add("input-error");
    return;
  }
  if (currentAddress && isDuplicateEmail(email, currentAddress)) {
    emailError.textContent = "This email is already registered.";
    emailInput.classList.add("input-error");
    return;
  }

  var sb = getSupabase();
  if (sb) {
    completeBtn.disabled = true;
    completeBtn.textContent = "Saving…";
    sb.from(SUPABASE_TABLE)
      .update({
        email: email,
        discord_handle: discord || null
      })
      .eq("wallet_address", normalizeAddress(currentAddress))
      .then(function (r) {
        completeBtn.disabled = false;
        completeBtn.textContent = "Complete";
        if (r.error) {
          var msg = r.error.message || "Could not save to database.";
          if (r.error.code === "PGRST116") {
            msg = "No row found for this wallet. Table name or columns may be wrong. Use table name from Supabase (e.g. ts_pass_claim).";
          } else if (r.error.message && r.error.message.indexOf("row-level security") !== -1) {
            msg = "Database rejected: Row Level Security. Allow insert/update for anon in Supabase.";
          }
          emailError.textContent = msg;
          console.error("Supabase update:", r.error);
          return;
        }
        if (successDbHint) successDbHint.classList.add("is-hidden");
        saveAndShowSuccess(email, discord);
      });
  } else {
    if (sublineDbHint) sublineDbHint.classList.add("is-hidden");
    saveAndShowSuccess(email, discord);
    if (successDbHint) {
      successDbHint.textContent = "Saved in this browser only. Add SUPABASE_URL and SUPABASE_ANON_KEY in config.js to save to your database.";
      successDbHint.classList.remove("is-hidden");
    }
  }
}

function saveAndShowSuccess(email, discord) {
  const reg = getRegistrations();
  reg[currentAddress] = { email: email, discord: discord };
  setRegistrations(reg);
  showSuccess();
}

function init() {
  if (!isSupabaseConfigured()) {
    console.warn("TS Pass: Supabase not configured. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in config.js to save to your database.");
  }
  const provider = getProvider();
  if (provider) {
    provider.on("accountsChanged", (accounts) => {
      if (!accounts || accounts.length === 0) {
        showConnectState();
        connectButton.classList.remove("connected");
        connectButtonText.textContent = "Connect";
      } else {
        showJoinedState(accounts[0]);
      }
    });
  }

  connectButton.addEventListener("click", connectWallet);
  if (walletDisconnectBtn) walletDisconnectBtn.addEventListener("click", onDisconnect);
  completeBtn.addEventListener("click", onComplete);
}

init();
