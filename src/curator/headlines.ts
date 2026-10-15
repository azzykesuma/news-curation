import { CONFIG } from "../config.js";
import { CuratedArticle, Category, RawItem } from "../types.js";

function categoryFor(item: RawItem): Category {
  if (/\b(ai|llm|model|agents?|mcp|ollama|deepseek|gemini|rag)\b/i.test(item.title)) return "AI";
  if (/\b(react|next\.?js|frontend|typescript|javascript|css|tailwind|browser|web performance|vite)\b/i.test(item.title)
      || /^(React Releases|Next\.js Releases|Tailwind CSS Blog|CSS-Tricks|Vercel Blog)$/.test(item.source)) return "Frontend";
  return "Tooling";
}

/** Publish recent source headlines without making up AI scores or summaries. */
export function selectHeadlines(rawItems: RawItem[]): CuratedArticle[] {
  const seenTitles = new Set<string>();

  return [...rawItems]
    .sort((a, b) => (b.pubDate ?? 0) - (a.pubDate ?? 0))
    .filter((item) => {
      const title = item.title.trim().toLowerCase();
      if (!title || !item.url || seenTitles.has(title)) return false;
      seenTitles.add(title);
      return true;
    })
    .slice(0, CONFIG.maxArticles)
    .map((item) => ({
      title: item.title,
      url: item.url,
      category: categoryFor(item),
      relevance_score: 0, // Sentinel: not scored by an AI model.
      tldr: item.snippet && !item.snippet.startsWith("HN Points:") ? item.snippet : item.title,
      why_it_matters: `Headline from ${item.source}; published without AI review.`,
    }));
}
