import { CONFIG } from "../config.js";
import { RawItem } from "../types.js";

interface AlgoliaHit {
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at_i?: number;
}

export async function fetchHackerNews(): Promise<RawItem[]> {
  const sinceTimestamp = Math.floor(Date.now() / 1000) - CONFIG.hn.lookbackHours * 3600;
  const seenUrlsInBatch = new Set<string>();
  const items: RawItem[] = [];

  const promises = CONFIG.hn.topics.map(async (topic) => {
    const encodedTopic = encodeURIComponent(topic);
    const endpoint = `https://hn.algolia.com/api/v1/search_by_date?query=${encodedTopic}&tags=story&numericFilters=created_at_i>${sinceTimestamp},points>${CONFIG.hn.minPoints}&hitsPerPage=15`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "AIFES-NewsCurator/1.0" },
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { hits?: AlgoliaHit[] };
      return data.hits || [];
    } catch (err: any) {
      console.warn(`[HN] Failed to fetch topic "${topic}": ${err.message || err}`);
      return [];
    }
  });

  const results = await Promise.all(promises);
  for (const hits of results) {
    for (const hit of hits) {
      if (hit.title && hit.url && !seenUrlsInBatch.has(hit.url)) {
        seenUrlsInBatch.add(hit.url);
        items.push({
          title: hit.title.trim(),
          url: hit.url.trim(),
          snippet: `HN Points: ${hit.points || 0} | Comments: ${hit.num_comments || 0}`,
          source: "Hacker News",
          pubDate: hit.created_at_i ? hit.created_at_i * 1000 : undefined,
        });
      }
    }
  }

  console.log(`[HN] Fetched ${items.length} candidate stories across ${CONFIG.hn.topics.length} topics`);
  return items;
}
