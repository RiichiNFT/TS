/**
 * Team Secret Inner Circle Pass — Connect, form, persistence.
 * Works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM injectors.
 * Data is stored only in Supabase; localStorage is not used.
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.
 */

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
const formEditable = document.getElementById("formEditable");
const alreadySubmittedSection = document.getElementById("alreadySubmittedSection");
const submittedEmailEl = document.getElementById("submittedEmail");
const submittedDiscordEl = document.getElementById("submittedDiscord");

let currentAddress = null;

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function showConnectState() {
  walletAddressEl.classList.add("is-hidden");
  connectBlock.classList.remove("is-hidden");
  formSection.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  if (alreadySubmittedSection) alreadySubmittedSection.classList.add("is-hidden");
  if (formEditable) formEditable.classList.remove("is-hidden");
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
  if (formEditable) formEditable.classList.remove("is-hidden");
  if (alreadySubmittedSection) alreadySubmittedSection.classList.add("is-hidden");
  loadPrefill(address);
}

function loadPrefill(address) {
  var sb = getSupabase();
  if (!sb) return;
  sb.from(SUPABASE_TABLE)
    .select("email_address, discord_handle")
    .eq("wallet_address", normalizeAddress(address))
    .maybeSingle()
    .then(function (r) {
      if (r.error) return;
      if (r.data && r.data.email_address) {
        showAlreadySubmitted(r.data.email_address, r.data.discord_handle || "");
      } else if (r.data && (r.data.email_address || r.data.discord_handle)) {
        if (r.data.email_address) emailInput.value = r.data.email_address;
        if (r.data.discord_handle) discordInput.value = r.data.discord_handle;
      }
    });
}

function showAlreadySubmitted(email, discord) {
  if (formEditable) formEditable.classList.add("is-hidden");
  if (alreadySubmittedSection) {
    if (submittedEmailEl) submittedEmailEl.textContent = email;
    if (submittedDiscordEl) submittedDiscordEl.textContent = discord || "—";
    alreadySubmittedSection.classList.remove("is-hidden");
  }
}

function showSuccess() {
  formSection.classList.add("is-hidden");
  successSection.classList.remove("is-hidden");
  if (successDbHint) successDbHint.classList.add("is-hidden");
}

var EMAIL_MAX_LENGTH = 254;
var DISCORD_MIN_LENGTH = 2;
var DISCORD_MAX_LENGTH = 32;

function validateEmail(value) {
  var v = (value || "").trim();
  if (!v) return "Email is required.";
  if (v.length > EMAIL_MAX_LENGTH) return "Email must be " + EMAIL_MAX_LENGTH + " characters or fewer.";
  if (v.length < 5) return "Invalid email address.";
  if (!v.includes("@")) return "Invalid email address.";
  var atIdx = v.indexOf("@");
  if (atIdx === 0 || atIdx === v.length - 1) return "Invalid email address.";
  var domain = v.slice(atIdx + 1);
  if (!domain.includes(".") || domain.length < 3) return "Invalid email address.";
  if (/[^\w.+-@]/.test(v)) return "Invalid email address.";
  return null;
}

function validateDiscord(value) {
  var v = (value || "").trim();
  if (!v) return null;
  if (v.length < DISCORD_MIN_LENGTH || v.length > DISCORD_MAX_LENGTH) {
    return "Discord handle must be between " + DISCORD_MIN_LENGTH + " and " + DISCORD_MAX_LENGTH + " characters.";
  }
  return null;
}

function checkDuplicateEmailInSupabase(email, excludeWalletAddress, callback) {
  var sb = getSupabase();
  if (!sb) {
    callback(false);
    return;
  }
  var normalized = (email || "").trim().toLowerCase();
  var currentNorm = normalizeAddress(excludeWalletAddress);
  sb.from(SUPABASE_TABLE)
    .select("wallet_address")
    .eq("email_address", normalized)
    .then(function (r) {
      if (r.error || !r.data) {
        callback(false);
        return;
      }
      var anotherWalletHasEmail = r.data.some(function (row) {
        return ((row.wallet_address || "").toLowerCase() !== currentNorm);
      });
      callback(anotherWalletHasEmail);
    });
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
  if (!confirm("Once you submit, you will not be able to change this information. Are you sure you want to continue?")) {
    return;
  }
  var emailRaw = emailInput.value;
  var discordRaw = discordInput.value;
  var email = (emailRaw || "").trim().toLowerCase();
  var discord = (discordRaw || "").trim();
  emailError.textContent = "";
  discordError.textContent = "";
  emailInput.classList.remove("input-error");
  discordInput.classList.remove("input-error");

  var emailErr = validateEmail(emailRaw);
  if (emailErr) {
    emailError.textContent = emailErr;
    emailInput.classList.add("input-error");
    return;
  }
  var discordErr = validateDiscord(discordRaw);
  if (discordErr) {
    discordError.textContent = discordErr;
    discordInput.classList.add("input-error");
    return;
  }
  var sb = getSupabase();
  if (!sb) {
    emailError.textContent = "Database not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.";
    return;
  }

  completeBtn.disabled = true;
  completeBtn.textContent = "Saving…";
  sb.from(SUPABASE_TABLE)
    .select("email_address")
    .eq("wallet_address", normalizeAddress(currentAddress))
    .maybeSingle()
    .then(function (existing) {
      if (existing.data && existing.data.email_address) {
        completeBtn.disabled = false;
        completeBtn.textContent = "Complete";
        emailError.textContent = "You have already submitted. No changes can be made.";
        return;
      }
      checkDuplicateEmailInSupabase(email, currentAddress, function (isDuplicate) {
        if (isDuplicate) {
          completeBtn.disabled = false;
          completeBtn.textContent = "Complete";
          emailError.textContent = "This email is already registered.";
          emailInput.classList.add("input-error");
          return;
        }
        var payload = {
          wallet_address: normalizeAddress(currentAddress),
          email_address: email,
          discord_handle: discord || null
        };
        sb.from(SUPABASE_TABLE)
          .upsert(payload, { onConflict: "wallet_address" })
          .then(function (r) {
            completeBtn.disabled = false;
            completeBtn.textContent = "Complete";
            if (r.error) {
              var isNoConstraint = (r.error.message || "").indexOf("no unique or exclusion constraint") !== -1;
              if (isNoConstraint) {
                sb.from(SUPABASE_TABLE).insert(payload).then(function (r2) {
                  completeBtn.disabled = false;
                  completeBtn.textContent = "Complete";
                  if (r2.error) {
                    emailError.textContent = r2.error.message || "Could not save to database.";
                    console.error("Supabase insert:", r2.error);
                    return;
                  }
                  if (successDbHint) successDbHint.classList.add("is-hidden");
                  showAlreadySubmitted(email, discord);
                });
                return;
              }
          var msg = r.error.message || "Could not save to database.";
          if (r.error.message && r.error.message.indexOf("row-level security") !== -1) {
            msg = "Database rejected: Row Level Security. Allow insert/update for anon in Supabase.";
          }
          emailError.textContent = msg;
          console.error("Supabase upsert:", r.error);
          return;
        }
        if (successDbHint) successDbHint.classList.add("is-hidden");
        showAlreadySubmitted(email, discord);
      });
      });
    });
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
