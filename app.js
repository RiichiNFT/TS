/**
 * Team Secret Inner Circle Pass — Connect, Join Now, form, persistence.
 * Works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM injectors.
 */

const STORAGE_KEY = "ts-pass-registrations";

const connectButton = document.getElementById("connectWallet");
const connectButtonText = document.getElementById("connectButtonText");
const walletAddressEl = document.getElementById("walletAddress");
const sublineEl = document.getElementById("subline");
const connectBlock = document.getElementById("connectBlock");
const joinBlock = document.getElementById("joinBlock");
const joinNowBtn = document.getElementById("joinNowBtn");
const formSection = document.getElementById("formSection");
const emailInput = document.getElementById("emailInput");
const discordInput = document.getElementById("discordInput");
const emailError = document.getElementById("emailError");
const discordError = document.getElementById("discordError");
const completeBtn = document.getElementById("completeBtn");
const successSection = document.getElementById("successSection");

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
  joinBlock.classList.add("is-hidden");
  formSection.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  sublineEl.textContent = "Connect your wallet to get started";
  currentAddress = null;
}

function showJoinedState(address) {
  currentAddress = address;
  const short = formatAddress(address);
  walletAddressEl.textContent = short;
  walletAddressEl.classList.remove("is-hidden");
  connectBlock.classList.add("is-hidden");
  joinBlock.classList.remove("is-hidden");
  formSection.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  sublineEl.textContent = "You're connected. Join the Inner Circle below.";
}

function showForm(prefill) {
  formSection.classList.remove("is-hidden");
  joinBlock.classList.add("is-hidden");
  successSection.classList.add("is-hidden");
  if (prefill) {
    emailInput.value = prefill.email || "";
    discordInput.value = prefill.discord || "";
  } else {
    emailInput.value = "";
    discordInput.value = "";
  }
  emailError.textContent = "";
  discordError.textContent = "";
  emailInput.classList.remove("input-error");
  discordInput.classList.remove("input-error");
}

function showSuccess() {
  formSection.classList.add("is-hidden");
  joinBlock.classList.add("is-hidden");
  successSection.classList.remove("is-hidden");
}

function validateEmail(value) {
  const v = (value || "").trim();
  if (!v) return "Email is required.";
  if (v.length < 5) return "Email is too short.";
  if (!v.includes("@")) return "Email must contain @.";
  const atIdx = v.indexOf("@");
  if (atIdx === 0 || atIdx === v.length - 1) return "Please enter a valid email.";
  const local = v.slice(0, atIdx);
  const domain = v.slice(atIdx + 1);
  if (!domain.includes(".") || domain.length < 3) return "Please enter a valid email.";
  if (/[^\w.+-@]/.test(v)) return "Email contains invalid characters.";
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

function onJoinNow() {
  const prefill = currentAddress ? loadSavedForAddress(currentAddress) : null;
  showForm(prefill);
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

  const reg = getRegistrations();
  reg[currentAddress] = { email: email, discord: discord };
  setRegistrations(reg);
  showSuccess();
}

function init() {
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
  joinNowBtn.addEventListener("click", onJoinNow);
  completeBtn.addEventListener("click", onComplete);
}

init();
