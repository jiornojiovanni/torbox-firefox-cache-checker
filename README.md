# TorBox Cache Check

A Firefox extension for checking whether a download is cached on TorBox without opening the site.

Right-click a link or a selected URL to check it. For a copied link, open the extension and click **Paste & check**. You can also paste into the text field manually.

You'll need a TorBox API key. Enter it in the popup once; it's saved locally in your Firefox profile.

## Install locally

With Node.js 22 or newer installed, run:

```sh
npm ci
npm run build
```

Open `about:debugging#/runtime/this-firefox` in Firefox, click **Load Temporary Add-on**, and select `extension/manifest.json`.

## Supported links

Magnet links are checked as torrents. HTTP and HTTPS links are checked as web downloads. Links to `.torrent` or NZB files aren't parsed.

A “No cache match” result means TorBox didn't find the hash for that link. A different URL for the same file can give a different result.

The extension sends the link's hash and your API key to TorBox when you check it. It reads the clipboard only when you click **Paste & check** and doesn't save a history of checks.
