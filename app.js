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
var EDGE_FUNCTION_URL = (typeof window !== "undefined" && window.EDGE_FUNCTION_URL) || "";
var TAGLINE_DEFAULT = "The Inner Circle awaits...";

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

function buildConnectAuthMessage(address, nonce) {
  var ts = new Date().toISOString();
  var msg = "Sign in to Team Secret Inner Circle\n\n" +
    "Wallet: " + address + "\n\n" +
    "This request will not trigger a blockchain transaction or cost any gas.\n";
  if (nonce) msg += "Nonce: " + nonce + "\n";
  msg += "Timestamp: " + ts;
  return msg;
}

function buildRegistrationMessage(wallet, email, discord, nonce) {
  var ts = new Date().toISOString();
  var msg = "Team Secret Inner Circle Registration\n\n" +
    "Wallet: " + wallet + "\n" +
    "Email: " + email + "\n" +
    "Discord: " + (discord || "(none)") + "\n\n" +
    "I confirm this information is correct.\n";
  if (nonce) msg += "Nonce: " + nonce + "\n";
  msg += "Timestamp: " + ts;
  return msg;
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

function verifySignature(message, signature, expectedAddress) {
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

function verifyConnectSignature(message, signature, expectedAddress) {
  return verifySignature(message, signature, expectedAddress);
}

/* --- Modal helpers --- */
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalActions = document.getElementById("modalActions");

function showModal(title, body, buttons) {
  return new Promise(function (resolve) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalActions.innerHTML = "";
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.className = "modal-btn " + (b.primary ? "modal-btn--primary" : "modal-btn--secondary");
      btn.textContent = b.label;
      btn.addEventListener("click", function () {
        modalOverlay.classList.add("is-hidden");
        resolve(b.value);
      });
      modalActions.appendChild(btn);
    });
    modalOverlay.classList.remove("is-hidden");
  });
}

function showAlert(title, body) {
  return showModal(title, body, [{ label: "OK", value: true, primary: true }]);
}

function showConfirm(title, body) {
  return showModal(title, body, [
    { label: "Cancel", value: false, primary: false },
    { label: "Confirm", value: true, primary: true }
  ]);
}

/* --- Animated show/hide for .fade-section elements --- */
function fadeIn(el) {
  if (!el) return;
  el.classList.remove("is-hidden");
  // Force reflow so the transition plays from the hidden state
  void el.offsetWidth;
  el.classList.remove("fade-out");
}

function fadeOut(el, cb) {
  if (!el) return;
  if (el.classList.contains("is-hidden")) { if (cb) cb(); return; }
  el.classList.add("fade-out");
  var onEnd = function () {
    el.removeEventListener("transitionend", onEnd);
    el.classList.add("is-hidden");
    el.classList.remove("fade-out");
    if (cb) cb();
  };
  el.addEventListener("transitionend", onEnd, { once: true });
  // Fallback in case transitionend doesn't fire
  setTimeout(function () { el.removeEventListener("transitionend", onEnd); onEnd(); }, 350);
}

const connectButton = document.getElementById("connectWallet");
const connectButtonText = document.getElementById("connectButtonText");
const walletAddressEl = document.getElementById("walletAddress");
const walletAddressText = document.getElementById("walletAddressText");
const walletDisconnectBtn = document.getElementById("walletDisconnect");
const taglineEl = document.getElementById("tagline");
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
const submittedWalletEl = document.getElementById("submittedWallet");
const submittedEmailEl = document.getElementById("submittedEmail");
const submittedDiscordEl = document.getElementById("submittedDiscord");
const spinnerWrap = document.getElementById("spinnerWrap");

let currentAddress = null;
let _connectCooldownUntil = 0;
let _completeCooldownUntil = 0;
var COOLDOWN_MS = 3000;

function startCooldown(btn, originalText, which) {
  var until = Date.now() + COOLDOWN_MS;
  if (which === "connect") _connectCooldownUntil = until;
  else _completeCooldownUntil = until;
  btn.disabled = true;
  var tick = function () {
    var left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) {
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }
    btn.textContent = "Retry in " + left + "s…";
    setTimeout(tick, 300);
  };
  tick();
}

function isOnCooldown(which) {
  return Date.now() < (which === "connect" ? _connectCooldownUntil : _completeCooldownUntil);
}

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function showJoinedState(address) {
  currentAddress = address;
  if (taglineEl) taglineEl.textContent = TAGLINE_DEFAULT;
  const short = formatAddress(address);
  if (walletAddressText) walletAddressText.textContent = short;
  walletAddressEl.classList.remove("is-hidden");
  fadeOut(connectBlock);
  fadeOut(successSection);
  fadeIn(formSection);
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
  if (formEditable) formEditable.classList.add("is-hidden");
  if (alreadySubmittedSection) alreadySubmittedSection.classList.add("is-hidden");
  if (spinnerWrap) spinnerWrap.classList.remove("is-hidden");
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
    if (spinnerWrap) spinnerWrap.classList.add("is-hidden");
    if (data && data.email_address) {
      showAlreadySubmitted(data.email_address, data.discord_handle || "");
      return;
    }
    sublineEl.textContent = "Complete your details below.";
    if (formEditable) formEditable.classList.remove("is-hidden");
    if (data && (data.email_address || data.discord_handle)) {
      if (data.email_address) emailInput.value = data.email_address;
      if (data.discord_handle) discordInput.value = data.discord_handle;
    }
  });
}

function showAlreadySubmitted(email, discord) {
  if (taglineEl) taglineEl.textContent = "You have already submitted.";
  sublineEl.textContent = "";
  if (formEditable) formEditable.classList.add("is-hidden");
  if (alreadySubmittedSection) {
    if (submittedWalletEl) submittedWalletEl.textContent = formatAddress(currentAddress);
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

async function checkDuplicateEmail(email, excludeWalletAddress) {
  var sb = getSupabase();
  if (!sb) return false;
  var normalized = (email || "").trim().toLowerCase();
  var currentNorm = normalizeAddress(excludeWalletAddress);
  var r = await sb.from(SUPABASE_TABLE).select("wallet_address").eq("email_address", normalized);
  if (r.error || !r.data) return false;
  return r.data.some(function (row) {
    return (row.wallet_address || "").toLowerCase() !== currentNorm;
  });
}

async function checkDuplicateDiscord(discord, excludeWalletAddress) {
  var sb = getSupabase();
  if (!sb) return false;
  var normalized = (discord || "").trim();
  if (!normalized) return false;
  var currentNorm = normalizeAddress(excludeWalletAddress);
  var r = await sb.from(SUPABASE_TABLE).select("wallet_address").eq("discord_handle", normalized);
  if (r.error || !r.data) return false;
  return r.data.some(function (row) {
    return (row.wallet_address || "").toLowerCase() !== currentNorm;
  });
}

async function fetchNonce(address) {
  var sb = getSupabase();
  if (!sb) return null;
  var r = await sb.rpc("generate_nonce", { p_wallet: normalizeAddress(address) });
  if (r.error || !r.data) return null;
  return r.data;
}

async function saveViaEdgeFunction(address, email, discord, message, signature) {
  var res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: normalizeAddress(address),
      email: email,
      discord: discord || "",
      message: message,
      signature: signature
    })
  });
  var body = await res.json();
  if (!res.ok) {
    var err = new Error(body.error || "Registration failed.");
    err.field = body.field || null;
    throw err;
  }
  return body;
}

async function saveViaDirectSupabase(address, email, discord, signature) {
  var sb = getSupabase();
  if (!sb) throw new Error("Database not configured.");
  var walletNorm = normalizeAddress(address);

  var existing = await sb.from(SUPABASE_TABLE)
    .select("email_address, discord_handle")
    .eq("wallet_address", walletNorm)
    .maybeSingle();

  if (existing.data && existing.data.email_address) {
    var upd = await sb.from(SUPABASE_TABLE)
      .update({ signature: signature || null })
      .eq("wallet_address", walletNorm);
    if (upd.error) throw new Error(upd.error.message || "Could not update.");
    return { alreadyExisted: true, email: existing.data.email_address, discord: existing.data.discord_handle || "" };
  }

  var payload = {
    wallet_address: walletNorm,
    email_address: email,
    discord_handle: discord || null,
    signature: signature || null
  };

  var res = await sb.from(SUPABASE_TABLE).upsert(payload, { onConflict: "wallet_address" });
  if (res.error) {
    var isNoConstraint = (res.error.message || "").indexOf("no unique or exclusion constraint") !== -1;
    if (isNoConstraint) {
      var ins = await sb.from(SUPABASE_TABLE).insert(payload);
      if (ins.error) throw new Error(ins.error.message || "Could not save to database.");
      return { alreadyExisted: false, email: email, discord: discord };
    }
    var msg = res.error.message || "Could not save to database.";
    if (res.error.message && res.error.message.indexOf("row-level security") !== -1) {
      msg = "Database rejected: Row Level Security. Allow insert/update for anon in Supabase.";
    }
    throw new Error(msg);
  }
  return { alreadyExisted: false, email: email, discord: discord };
}

async function connectWallet() {
  if (isOnCooldown("connect")) return;
  const provider = getProvider();
  if (!provider) {
    await showAlert("No Wallet Found", "Install MetaMask, Coinbase Wallet, or open this page in the Base app to connect.");
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
    connectButtonText.textContent = "Preparing…";
    var connectNonce = await fetchNonce(address);
    connectButtonText.textContent = "Sign message…";
    var authMessage = buildConnectAuthMessage(address, connectNonce);
    var signature;
    try {
      signature = await requestSignature(authMessage, address);
    } catch (signErr) {
      if (signErr && signErr.code === 4001) {
        connectButton.disabled = false;
        connectButtonText.textContent = "Connect";
        return;
      }
      startCooldown(connectButton, "Connect", "connect");
      await showAlert("Signature Required", "Please sign the message in your wallet to continue.");
      return;
    }
    if (!verifyConnectSignature(authMessage, signature, address)) {
      startCooldown(connectButton, "Connect", "connect");
      await showAlert("Verification Failed", "The signature could not be verified. Please try again.");
      return;
    }
    showJoinedState(address);
    connectButtonText.textContent = "Connect";
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] });
    } catch (_) {}
  } catch (err) {
    console.error(err);
    if (err.code === 4001) {
      connectButton.disabled = false;
      connectButtonText.textContent = "Connect";
      return;
    }
    startCooldown(connectButton, "Connect", "connect");
    await showAlert("Connection Failed", "Could not connect. Try again or use another wallet.");
  }
}

function resetToConnectState() {
  currentAddress = null;
  walletAddressEl.classList.add("is-hidden");
  fadeIn(connectBlock);
  fadeOut(formSection);
  fadeOut(successSection);
  if (alreadySubmittedSection) alreadySubmittedSection.classList.add("is-hidden");
  if (formEditable) formEditable.classList.remove("is-hidden");
  if (spinnerWrap) spinnerWrap.classList.add("is-hidden");
  if (taglineEl) taglineEl.textContent = TAGLINE_DEFAULT;
  sublineEl.textContent = "Connect your wallet to get started";
  connectButton.classList.remove("connected");
  connectButtonText.textContent = "Connect";
}

async function onComplete() {
  if (isOnCooldown("complete")) return;
  var confirmed = await showConfirm("Confirm Submission", "Once you submit, you will not be able to change this information. Are you sure you want to continue?");
  if (!confirmed) {
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
  if (!getSupabase()) {
    emailError.textContent = "Database not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in config.js.";
    return;
  }

  completeBtn.disabled = true;
  completeBtn.textContent = "Checking…";

  try {
    var results = await Promise.all([
      checkDuplicateEmail(email, currentAddress),
      checkDuplicateDiscord(discord, currentAddress)
    ]);
    var isEmailDup = results[0];
    var isDiscordDup = results[1];
    if (isEmailDup || isDiscordDup) {
      if (isEmailDup) {
        emailError.textContent = "This email is already registered.";
        emailInput.classList.add("input-error");
      }
      if (isDiscordDup) {
        discordError.textContent = "This Discord handle is already registered.";
        discordInput.classList.add("input-error");
      }
      completeBtn.disabled = false;
      completeBtn.textContent = "Complete";
      return;
    }

    completeBtn.textContent = "Preparing…";
    var nonce = await fetchNonce(currentAddress);

    completeBtn.textContent = "Sign in wallet…";
    var message = buildRegistrationMessage(currentAddress, email, discord, nonce);
    var signature;
    try {
      signature = await requestSignature(message, currentAddress);
    } catch (signErr) {
      completeBtn.disabled = false;
      completeBtn.textContent = "Complete";
      if (signErr && signErr.code === 4001) {
        emailError.textContent = "Signature cancelled. Please try again when ready.";
      } else {
        emailError.textContent = "Signature failed. Please try again.";
        if (signErr) console.error("personal_sign:", signErr);
      }
      return;
    }

    if (!verifySignature(message, signature, currentAddress)) {
      completeBtn.disabled = false;
      completeBtn.textContent = "Complete";
      emailError.textContent = "Signature verification failed. The signature does not match the submitted information. Please try again.";
      return;
    }

    completeBtn.textContent = "Saving…";
    var result;
    if (EDGE_FUNCTION_URL) {
      result = await saveViaEdgeFunction(currentAddress, email, discord, message, signature);
    } else {
      result = await saveViaDirectSupabase(currentAddress, email, discord, signature);
    }
    if (successDbHint) successDbHint.classList.add("is-hidden");
    showAlreadySubmitted(result.email, result.discord);
  } catch (err) {
    if (err && err.field === "email") {
      emailError.textContent = err.message;
      emailInput.classList.add("input-error");
    } else if (err && err.field === "discord") {
      discordError.textContent = err.message;
      discordInput.classList.add("input-error");
    } else {
      emailError.textContent = (err && err.message) || "An error occurred. Please try again.";
    }
    startCooldown(completeBtn, "Complete", "complete");
    console.error("onComplete:", err);
    return;
  }
  completeBtn.disabled = false;
  completeBtn.textContent = "Complete";
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function setupMobileDeepLinks() {
  if (!isMobile() || getProvider()) return;
  var mobileWalletLinks = document.getElementById("mobileWalletLinks");
  var metamaskLink = document.getElementById("metamaskDeepLink");
  var coinbaseLink = document.getElementById("coinbaseDeepLink");
  if (!mobileWalletLinks) return;

  var dappUrl = window.location.host + window.location.pathname;
  if (metamaskLink) metamaskLink.href = "https://metamask.app.link/dapp/" + dappUrl;
  if (coinbaseLink) coinbaseLink.href = "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(window.location.href);

  mobileWalletLinks.classList.remove("is-hidden");
}

function onDisconnect() {
  resetToConnectState();
}

function init() {
  if (!isSupabaseConfigured()) {
    console.warn("TS Pass: Supabase not configured. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in config.js to save to your database.");
  }
  resetToConnectState();
  setupMobileDeepLinks();

  const provider = getProvider();
  if (provider) {
    provider.on("accountsChanged", function (accounts) {
      resetToConnectState();
    });
  }

  connectButton.addEventListener("click", connectWallet);
  if (walletDisconnectBtn) walletDisconnectBtn.addEventListener("click", onDisconnect);
  completeBtn.addEventListener("click", onComplete);
}

init();
