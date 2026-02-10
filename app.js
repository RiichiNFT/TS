/**
 * Team Secret Airdrop — Connect Wallet
 * Works with Base app (AA), MetaMask, Coinbase Wallet, and other EVM injectors.
 */

const connectButton = document.getElementById("connectWallet");
const connectButtonText = document.getElementById("connectButtonText");

function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function connectWallet() {
  const provider = getProvider();
  if (!provider) {
    alert(
      "No wallet found. Install MetaMask, Coinbase Wallet, or open this page in the Base app to connect."
    );
    return;
  }

  try {
    connectButton.disabled = true;
    connectButtonText.textContent = "Connecting…";
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (accounts && accounts.length > 0) {
      const address = accounts[0];
      connectButton.classList.add("connected");
      connectButtonText.textContent = formatAddress(address);
      connectButton.disabled = false;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch (_) {}
    }
  } catch (err) {
    console.error(err);
    connectButtonText.textContent = "Connect";
    connectButton.disabled = false;
    if (err.code === 4001) return;
    alert("Connection failed. Try again or use another wallet.");
  }
}

function init() {
  const provider = getProvider();
  if (provider) {
    provider.on("accountsChanged", (accounts) => {
      if (!accounts || accounts.length === 0) {
        connectButton.classList.remove("connected");
        connectButtonText.textContent = "Connect";
      } else {
        connectButton.classList.add("connected");
        connectButtonText.textContent = formatAddress(accounts[0]);
      }
    });
  }
  connectButton.addEventListener("click", connectWallet);
}

init();
