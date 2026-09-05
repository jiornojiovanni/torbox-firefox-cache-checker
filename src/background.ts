import { checkTorBoxCache, TorBoxApiError } from "./torbox.js";

// A pending link lives only in memory, never in persistent browsing history.
let pendingLink = "";

function createContextMenus() {
  browser.menus.create({
    id: "check-link",
    title: "Check link in TorBox",
    contexts: ["link"],
  });

  browser.menus.create({
    id: "check-selection",
    title: "Check selected URL in TorBox",
    contexts: ["selection"],
  });
}

function handleMenuClick(info: {
  menuItemId: string | number;
  linkUrl?: string;
  selectionText?: string;
}) {
  if (
    info.menuItemId !== "check-link" &&
    info.menuItemId !== "check-selection"
  ) {
    return;
  }

  const selectedLink =
    info.menuItemId === "check-link" ? info.linkUrl : info.selectionText;

  pendingLink = selectedLink?.trim() ?? "";

  // Call synchronously within the menu gesture so Firefox permits the popup.
  void browser.action
    .openPopup()
    .catch(() => browser.action.setBadgeText({ text: "1" }));
}

function handleMessage(message: { type?: string; link?: unknown } | null) {
  if (message?.type === "pending") {
    const link = pendingLink;

    pendingLink = "";
    void browser.action.setBadgeText({ text: "" });

    return Promise.resolve({ link });
  }

  if (message?.type === "check" && typeof message.link === "string") {
    return check(message.link);
  }
}

async function check(link: string) {
  const { apiKey } = await browser.storage.local.get("apiKey");

  if (typeof apiKey !== "string" || !apiKey) {
    return { error: "Save your TorBox API key below first.", needsKey: true };
  }

  if (link.length > 16384) {
    return { error: "This link is too long. Select a single download URL." };
  }

  try {
    return {
      result: await checkTorBoxCache(link, {
        apiKey,
        signal: AbortSignal.timeout(20000),
      }),
    };
  } catch (error) {
    if (error instanceof TorBoxApiError) {
      if (error.status === 401 || error.status === 403) {
        return {
          error: "TorBox rejected this API key. Check it in settings.",
          needsKey: true,
        };
      }

      if (error.status === 429) {
        return {
          error: "TorBox is limiting requests. Wait a moment and try again.",
        };
      }

      return {
        error: `TorBox could not complete the check (HTTP ${error.status}). Try again shortly.`,
      };
    }

    return {
      error:
        error instanceof TypeError && !/fetch|network/i.test(error.message)
          ? error.message
          : "Could not reach TorBox. Check your connection and try again.",
    };
  }
}

browser.runtime.onInstalled.addListener(createContextMenus);
browser.menus.onClicked.addListener(handleMenuClick);
browser.runtime.onMessage.addListener(handleMessage);
