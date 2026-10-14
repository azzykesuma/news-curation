import Parser from "rss-parser";
import { CONFIG } from "../config.js";
import { RawItem } from "../types.js";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "AIFES-NewsCurator/1.0 (Mozilla/5.0 compatible)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  },
});

export async function fetchRSSFeeds(): Promise<RawItem[]> {
  const cutoff = Date.now() - CONFIG.hn.lookbackHours * 3600 * 1000;
  const allItems: RawItem[] = [];

  const promises = CONFIG.rssFeeds.map(async (feedConfig) => {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      const feedItems: RawItem[] = [];

      for (const item of feed.items || []) {
        if (!item.link || !item.title) continue;

        const pubDate = item.pubDate || (item as any).isoDate;
        const timestamp = pubDate ? new Date(pubDate).getTime() : Date.now();

        // Only include items from the lookback period
        if (timestamp >= cutoff) {
          const rawSnippet = (item.contentSnippet || item.summary || item.content || "").replace(/<[^>]+>/g, "").trim();
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
      console.warn(`[RSS] Failed to fetch feed "${feedConfig.name}" (${feedConfig.url}): ${err.message || err}`);
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
