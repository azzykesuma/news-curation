import Parser from "rss-parser";
import { CONFIG } from "../config.js";
import { RawItem } from "../types.js";

const parser = new Parser();

export async function fetchRSSFeeds(): Promise<RawItem[]> {
  const cutoff = Date.now() - CONFIG.hn.lookbackHours * 3600 * 1000;
  const allItems: RawItem[] = [];

  const promises = CONFIG.rssFeeds.map(async (feedConfig) => {
    try {
      // Use native fetch with strict 6-second timeout to prevent network hangs on Cloudflare/GitHub IPs
      const res = await fetch(feedConfig.url, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
      });

      if (!res.ok) {
        console.warn(`[RSS] Feed "${feedConfig.name}" returned HTTP ${res.status}`);
        return [];
      }

      const xmlText = await res.text();
      const feed = await parser.parseString(xmlText);
      const feedItems: RawItem[] = [];

      for (const item of feed.items || []) {
        if (!item.link || !item.title) continue;

        const pubDate = item.pubDate || (item as any).isoDate;
        const timestamp = pubDate ? new Date(pubDate).getTime() : Date.now();

        // Only include items from the lookback period
        if (timestamp >= cutoff) {
          const rawSnippet = (item.contentSnippet || item.summary || item.content || "")
            .replace(/<[^>]+>/g, "")
            .trim();
          const cleanSnippet = rawSnippet.slice(0, 350);

          feedItems.push({
            title: item.title.trim(),
            url: item.link.trim(),
            snippet: cleanSnippet,
            source: feedConfig.name,
            pubDate: timestamp,
          });
        }
      }

      return feedItems;
    } catch (err: any) {
      console.warn(`[RSS] Skipped feed "${feedConfig.name}": ${err.message || err}`);
      return [];
    }
  });

  const results = await Promise.all(promises);
  for (const feedItems of results) {
    allItems.push(...feedItems);
  }

  console.log(`[RSS] Fetched ${allItems.length} recent articles across ${CONFIG.rssFeeds.length} feeds`);
  return allItems;
}
