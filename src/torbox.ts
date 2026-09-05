import md5 from "blueimp-md5";

const DEFAULT_API_BASE_URL = "https://api.torbox.app/v1/api";

export type TorBoxLinkKind = "torrent" | "web-download";

export interface TorBoxCachedItem {
  name?: string;
  size?: number;
  hash?: string;
  files?: Array<{
    name: string;
    size: number;
  }>;
  [key: string]: unknown;
}

export interface TorBoxCacheCheckResult {
  cached: boolean;
  kind: TorBoxLinkKind;
  hash: string;
  item: TorBoxCachedItem | null;
}

export interface TorBoxCacheCheckOptions {
  apiKey: string;
  apiBaseUrl?: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

interface TorBoxResponse {
  success: boolean;
  error: string | null;
  detail: string;
  data: unknown;
}

export class TorBoxApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "TorBoxApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Checks whether an HTTP(S) or magnet link is currently cached by TorBox.
 *
 * Keep this call in the extension background script so the API key is never
 * exposed to page scripts. The extension manifest will need host permission
 * for https://api.torbox.app/*.
 */
export async function checkTorBoxCache(
  link: string,
  options: TorBoxCacheCheckOptions,
): Promise<TorBoxCacheCheckResult> {
  const apiKey = options.apiKey.trim();

  if (!apiKey) {
    throw new TypeError("A TorBox API key is required.");
  }

  const target = identifyLink(link);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("No fetch implementation is available.");
  }

  const baseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(
    /\/$/,
    "",
  );
  const resource = target.kind === "torrent" ? "torrents" : "webdl";
  const requestUrl = new URL(`${baseUrl}/${resource}/checkcached`);

  requestUrl.searchParams.set("hash", target.hash);
  requestUrl.searchParams.set("format", "object");
  requestUrl.searchParams.set("list_files", "true");

  const response = await fetchImpl(requestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options.signal,
  });

  const body = await readJsonResponse(response);

  if (!response.ok || body.success !== true) {
    throw new TorBoxApiError(
      body.detail || `TorBox returned HTTP ${response.status}.`,
      response.status,
      body.error,
    );
  }

  const item = findCachedItem(body.data, target.hash);

  return {
    cached: item !== null,
    kind: target.kind,
    hash: target.hash,
    item,
  };
}

function identifyLink(link: string): { kind: TorBoxLinkKind; hash: string } {
  const value = link.trim();

  if (!value) {
    throw new TypeError("The link cannot be empty.");
  }

  if (/^magnet:/i.test(value)) {
    return { kind: "torrent", hash: extractMagnetInfoHash(value) };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("The link must be a valid HTTP(S) or magnet URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Only HTTP(S) and magnet links are supported.");
  }

  // TorBox hashes the submitted link exactly, so do not normalize or reserialize it.
  return { kind: "web-download", hash: md5(value) };
}

function extractMagnetInfoHash(magnet: string): string {
  let url: URL;

  try {
    url = new URL(magnet);
  } catch {
    throw new TypeError("The magnet link is invalid.");
  }

  const exactTopic = url.searchParams
    .getAll("xt")
    .find((value) => /^urn:btih:/i.test(value));
  const hash = exactTopic?.slice("urn:btih:".length).toLowerCase();

  if (!hash || !/^(?:[a-f0-9]{40}|[a-z2-7]{32})$/.test(hash)) {
    throw new TypeError(
      "The magnet link does not contain a valid BitTorrent info hash.",
    );
  }

  return hash;
}

async function readJsonResponse(response: Response): Promise<TorBoxResponse> {
  try {
    const body = await response.json();

    if (!body || typeof body.success !== "boolean")
      throw new Error("Invalid envelope");

    return body as TorBoxResponse;
  } catch {
    throw new TorBoxApiError(
      `TorBox returned a non-JSON response (HTTP ${response.status}).`,
      response.status,
    );
  }
}

function findCachedItem(data: unknown, hash: string): TorBoxCachedItem | null {
  if (Array.isArray(data)) {
    const match = data.find(
      (item): item is TorBoxCachedItem =>
        isRecord(item) &&
        typeof item.hash === "string" &&
        item.hash.toLowerCase() === hash.toLowerCase(),
    );

    return match ?? null;
  }

  if (!isRecord(data)) {
    throw new TorBoxApiError("TorBox returned invalid cache data.", 200);
  }

  const directMatch = data[hash] ?? data[hash.toLowerCase()];

  if (isRecord(directMatch)) {
    return directMatch;
  }

  const match = Object.values(data).find(
    (item): item is TorBoxCachedItem =>
      isRecord(item) &&
      typeof item.hash === "string" &&
      item.hash.toLowerCase() === hash.toLowerCase(),
  );

  return match ?? null;
}

function isRecord(value: unknown): value is TorBoxCachedItem {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
