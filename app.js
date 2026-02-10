/**
 * Team Secret Inner Circle Pass — Connect, form, persistence.
 * Works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM injectors.
 * Data is stored only in Supabase; localStorage is not used.
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.
 *
 * Wallet re-authentication:
 * - No wallet state is persisted (no localStorage, sessionStorage, cookies, or cached provider state).
 * - On page load the user is always treated as disconnected; we never auto-connect.
 * - The user is only considered authenticated after connecting and successfully signing an auth message in the current session.
 * - On disconnect or account change, all wallet state is cleared; reconnecting requires signing again.
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

function buildConnectAuthMessage(address) {
  var ts = new Date().toISOString();
  return (
    "Sign in to Team Secret Inner Circle\n\n" +
    "Wallet: " + address + "\n\n" +
    "This request will not trigger a blockchain transaction or cost any gas.\nTimestamp: " + ts
  );
}

function buildRegistrationMessage(wallet, email, discord) {
  var ts = new Date().toISOString();
  return (
    "Team Secret Inner Circle Registration\n\n" +
    "Wallet: " + wallet + "\n" +
    "Email: " + email + "\n" +
    "Discord: " + (discord || "(none)") + "\n\n" +
    "I confirm this information is correct.\nTimestamp: " + ts
  );
}

function stringToHex(s) {
  var hex = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i).toString(16);
    hex += c.length === 1 ? "0" + c : c;
  }
  return "0x" + hex;
}

function requestSignature(message, address) {
  var provider = getProvider();
  var addr = address != null ? address : currentAddress;
  if (!provider || !addr) return Promise.reject(new Error("Wallet not connected"));
  var messageHex = stringToHex(message);
  return new Promise(function (resolve, reject) {
    provider
      .request({
        method: "personal_sign",
        params: [messageHex, addr]
      })
      .then(resolve)
      .catch(reject);
  });
}

function verifyConnectSignature(message, signature, expectedAddress) {
  if (!signature || typeof signature !== "string" || signature.length < 130) return false;
  if (!expectedAddress || !message) return false;
  if (typeof ethers !== "undefined" && ethers.verifyMessage) {
    try {
      var recovered = ethers.verifyMessage(message, signature);
      return recovered && normalizeAddress(recovered) === normalizeAddress(expectedAddress);
    } catch (e) {
      return false;
    }
  }
  return true;
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
  clearAllWalletState();
}

function showJoinedState(address) {
  currentAddress = address;
  const short = formatAddress(address);
  if (walletAddressText) walletAddressText.textContent = short;
  walletAddressEl.classList.remove("is-hidden");
  connectBlock.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  formSection.classList.remove("is-hidden");
  sublineEl.textContent = isSupabaseConfigured()
    ? "Checking registration…"
    : "Complete your details below.";
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

function loadExistingEntry(address, callback) {
  var sb = getSupabase();
  if (!sb) {
    if (callback) callback(null);
    return;
  }
  sb.from(SUPABASE_TABLE)
    .select("email_address, discord_handle")
    .eq("wallet_address", normalizeAddress(address))
    .maybeSingle()
    .then(function (r) {
      if (r.error) {
        if (callback) callback(null);
        return;
      }
      if (callback) callback(r.data);
    });
}

function loadPrefill(address) {
  loadExistingEntry(address, function (data) {
    if (data && data.email_address) {
      sublineEl.textContent = "You're already registered.";
      showAlreadySubmitted(data.email_address, data.discord_handle || "");
      return;
    }
    sublineEl.textContent = "Complete your details below.";
    if (data && (data.email_address || data.discord_handle)) {
      if (data.email_address) emailInput.value = data.email_address;
      if (data.discord_handle) discordInput.value = data.discord_handle;
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
    if (!accounts || accounts.length === 0) {
      connectButtonText.textContent = "Connect";
      return;
    }
    const address = accounts[0];
    connectButtonText.textContent = "Sign message…";
    var authMessage = buildConnectAuthMessage(address);
    var signature;
    try {
      signature = await requestSignature(authMessage, address);
    } catch (signErr) {
      connectButtonText.textContent = "Connect";
      if (signErr && signErr.code === 4001) return;
      alert("Signature is required to continue. Please sign the message in your wallet.");
      return;
    }
    if (!verifyConnectSignature(authMessage, signature, address)) {
      connectButtonText.textContent = "Connect";
      alert("Verification failed. Please try again.");
      return;
    }
    showJoinedState(address);
    connectButtonText.textContent = "Connect";
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
    } catch (_) {}
  } catch (err) {
    console.error(err);
    connectButtonText.textContent = "Connect";
    if (err.code === 4001) return;
    alert("Connection failed. Try again or use another wallet.");
  } finally {
    connectButton.disabled = false;
  }
}

function clearAllWalletState() {
  currentAddress = null;
  walletAddressEl.classList.add("is-hidden");
  connectBlock.classList.remove("is-hidden");
  formSection.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  if (alreadySubmittedSection) alreadySubmittedSection.classList.add("is-hidden");
  if (formEditable) formEditable.classList.remove("is-hidden");
  sublineEl.textContent = "Connect your wallet to get started";
  connectButton.classList.remove("connected");
  connectButtonText.textContent = "Connect";
}

function onDisconnect() {
  clearAllWalletState();
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
  completeBtn.textContent = "Sign in wallet…";
  var message = buildRegistrationMessage(currentAddress, email, discord);
  requestSignature(message, currentAddress)
    .then(function (signature) {
      completeBtn.textContent = "Saving…";
      sb.from(SUPABASE_TABLE)
        .select("email_address, discord_handle")
        .eq("wallet_address", normalizeAddress(currentAddress))
        .maybeSingle()
        .then(function (existing) {
          if (existing.data && existing.data.email_address) {
            sb.from(SUPABASE_TABLE)
              .update({ signature: signature || null })
              .eq("wallet_address", normalizeAddress(currentAddress))
              .then(function (r) {
                completeBtn.disabled = false;
                completeBtn.textContent = "Complete";
                if (r.error) {
                  emailError.textContent = r.error.message || "Could not update.";
                  return;
                }
                if (successDbHint) successDbHint.classList.add("is-hidden");
                showAlreadySubmitted(existing.data.email_address, existing.data.discord_handle || "");
              });
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
              discord_handle: discord || null,
              signature: signature || null
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
    })
    .catch(function (err) {
      completeBtn.disabled = false;
      completeBtn.textContent = "Complete";
      if (err && err.code === 4001) {
        emailError.textContent = "Signature cancelled. Please try again when ready.";
      } else {
        emailError.textContent = "Signature failed. Please try again.";
        if (err) console.error("personal_sign:", err);
      }
    });
}

function init() {
  if (!isSupabaseConfigured()) {
    console.warn("TS Pass: Supabase not configured. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in config.js to save to your database.");
  }
  clearAllWalletState();

  const provider = getProvider();
  if (provider) {
    provider.on("accountsChanged", function (accounts) {
      showConnectState();
    });
  }

  connectButton.addEventListener("click", connectWallet);
  if (walletDisconnectBtn) walletDisconnectBtn.addEventListener("click", onDisconnect);
  completeBtn.addEventListener("click", onComplete);
}

init();
