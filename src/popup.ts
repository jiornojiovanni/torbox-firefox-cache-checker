const link = document.querySelector<HTMLTextAreaElement>("#link")!;
const key = document.querySelector<HTMLInputElement>("#key")!;
const settings = document.querySelector<HTMLDetailsElement>("#settings")!;
const keyStatus = document.querySelector<HTMLElement>("#key-status")!;
const statusText = document.querySelector<HTMLElement>("#status")!;
const detail = document.querySelector<HTMLElement>("#detail")!;
const result = document.querySelector<HTMLElement>("#result")!;

const buttons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#check-form button"),
);

function show(title: string, description: string, state = "") {
  statusText.textContent = title;
  detail.textContent = description;
  result.dataset.state = state;
}

async function check() {
  if (!link.value.trim()) {
    show("Add a link", "Paste a download URL or magnet link above.", "error");

    return;
  }

  buttons.forEach((button) => {
    button.disabled = true;
  });
  show("Checking…", "Looking for this download in TorBox.");

  try {
    const reply = await browser.runtime.sendMessage({
      type: "check",
      link: link.value.trim(),
    });

    if (reply.error) {
      show("Unable to check", reply.error, "error");

      if (reply.needsKey) {
        settings.open = true;
      }
    } else {
      const { cached, item } = reply.result;

      show(
        cached ? "Cached — ready to download" : "No cache match",
        cached
          ? item?.name || "TorBox reports this download is cached."
          : "TorBox did not find this link’s hash. Another URL for the same file may have a different result.",
        cached ? "cached" : "miss",
      );
    }
  } catch {
    show("Unable to check", "Reopen the extension and try again.", "error");
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function handleCheckSubmit(event: Event) {
  event.preventDefault();
  void check();
}

async function pasteAndCheck() {
  try {
    link.value = (await navigator.clipboard.readText()).trim();
    await check();
  } catch {
    show(
      "Paste your link manually",
      "Clipboard access was unavailable. Click the field and press Ctrl+V.",
      "error",
    );
    link.focus();
  }
}

async function saveApiKey(event: Event) {
  event.preventDefault();

  if (!key.value.trim()) {
    keyStatus.textContent = "Enter an API key first.";

    return;
  }

  try {
    await browser.storage.local.set({ apiKey: key.value.trim() });
    key.value = "";
    keyStatus.textContent = "Key saved in this Firefox profile.";
    settings.open = false;

    if (link.value.trim()) {
      await check();
    }
  } catch {
    keyStatus.textContent = "Could not save the key. Please try again.";
  }
}

async function forgetApiKey() {
  await browser.storage.local.remove("apiKey");
  key.value = "";
  keyStatus.textContent = "Key removed.";
}

async function init() {
  const { apiKey } = await browser.storage.local.get("apiKey");

  settings.open = !apiKey;
  keyStatus.textContent = apiKey
    ? "An API key is saved."
    : "Save your API key to get started.";

  const pending = await browser.runtime.sendMessage({ type: "pending" });

  if (pending.link) {
    link.value = pending.link;
    await check();
  }
}

document
  .querySelector("#check-form")!
  .addEventListener("submit", handleCheckSubmit);
document.querySelector("#paste")!.addEventListener("click", pasteAndCheck);
document.querySelector("#key-form")!.addEventListener("submit", saveApiKey);
document.querySelector("#forget")!.addEventListener("click", forgetApiKey);

void init().catch(() =>
  show("Unable to load", "Close and reopen the extension.", "error"),
);
