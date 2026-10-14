import fs from "fs/promises";
import { CONFIG } from "../config.js";
import { RawItem } from "../types.js";

/**
 * Clean URL for deduplication comparison (strips common tracking parameters and trailing slashes)
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    let clean = parsed.toString();
    if (clean.endsWith("/")) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return rawUrl.trim();
  }
}

export async function loadSeenUrls(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(CONFIG.seenFile, "utf-8");
    const urls: string[] = JSON.parse(content);
    return new Set(urls.map(normalizeUrl));
  } catch {
    console.warn(`[Storage] Could not read ${CONFIG.seenFile}, starting with empty history`);
    return new Set();
  }
}

export async function saveSeenUrls(seenSet: Set<string>): Promise<void> {
  try {
    // Keep only the most recent N URLs to prevent unbounded file growth
    const allUrls = Array.from(seenSet);
    const capped = allUrls.slice(-CONFIG.maxSeenUrls);
    await fs.writeFile(CONFIG.seenFile, JSON.stringify(capped, null, 2), "utf-8");
    console.log(`[Storage] Saved ${capped.length} seen URLs to ${CONFIG.seenFile}`);
  } catch (err: any) {
    console.error(`[Storage] Failed to save ${CONFIG.seenFile}:`, err.message || err);
  }
}

export function filterUnseenItems(items: RawItem[], seenSet: Set<string>): RawItem[] {
  const unseen: RawItem[] = [];
  const inBatchSeen = new Set<string>();

  for (const item of items) {
    const cleanUrl = normalizeUrl(item.url);
    if (!seenSet.has(cleanUrl) && !inBatchSeen.has(cleanUrl)) {
      inBatchSeen.add(cleanUrl);
      unseen.push(item);
    }
  }

  return unseen;
}
