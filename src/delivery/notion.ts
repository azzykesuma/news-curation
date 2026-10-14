import { Client } from "@notionhq/client";
import { CONFIG } from "../config.js";
import { CuratedArticle } from "../types.js";

export async function sendToNotion(articles: CuratedArticle[]): Promise<boolean> {
  if (!CONFIG.notionToken || !CONFIG.notionDatabaseId) {
    console.log("[Notion] NOTION_TOKEN or NOTION_DATABASE_ID not configured, skipping Notion delivery.");
    return false;
  }

  if (articles.length === 0) {
    console.log("[Notion] No articles to save.");
    return false;
  }

  const notion = new Client({ auth: CONFIG.notionToken });
  let savedCount = 0;

  for (const item of articles) {
    try {
      const summaryText = `${item.tldr}\n\nWhy it matters:\n${item.why_it_matters}`.slice(0, 2000);

      await notion.pages.create({
        parent: { database_id: CONFIG.notionDatabaseId },
        properties: {
          Name: {
            title: [{ text: { content: item.title.slice(0, 2000) } }],
          },
          Category: {
            select: { name: item.category },
          },
          Score: {
            number: item.relevance_score,
          },
          URL: {
            url: item.url,
          },
          Summary: {
            rich_text: [{ text: { content: summaryText } }],
          },
          Date: {
            date: { start: new Date().toISOString() },
          },
        },
      });
      savedCount++;

      // Pause briefly to respect Notion API rate limits (~3 requests/sec)
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err: any) {
      console.error(`[Notion] Failed to insert "${item.title}":`, err.message || err);
    }
  }

  console.log(`[Notion] Saved ${savedCount}/${articles.length} articles to database.`);
  return savedCount > 0;
}
