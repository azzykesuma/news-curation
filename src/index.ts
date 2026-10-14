import { CONFIG } from "./config.js";
import { curateWithDeepSeek } from "./curator/deepseek.js";
import { sendToDiscord } from "./delivery/discord.js";
import { sendToNotion } from "./delivery/notion.js";
import { fetchHackerNews } from "./sources/hackerNews.js";
import { fetchRSSFeeds } from "./sources/rss.js";
import { filterUnseenItems, loadSeenUrls, normalizeUrl, saveSeenUrls } from "./storage/seen.js";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isForce = process.argv.includes("--force");

  console.log("=".repeat(60));
  console.log("🚀 Starting AI Frontend & AI News Curator");
  if (isDryRun) {
    console.log("🔍 MODE: DRY-RUN (Terminal preview only, no delivery / state update)");
  }
  if (isForce) {
    console.log("⚡ MODE: FORCE (Bypassing deduplication to re-curate recent stories)");
  }
  console.log("=".repeat(60));

  // 1. Load seen URLs history
  const seenSet = isForce ? new Set<string>() : await loadSeenUrls();
  if (isForce) {
    console.log("[Storage] Force mode active: ignoring previously seen URLs for this run.");
  } else {
    console.log(`[Storage] Loaded ${seenSet.size} previously processed URLs.`);
  }

  // 2. Concurrently fetch all sources
  console.log("\n[Ingestion] Fetching stories from Hacker News & RSS feeds...");
  const [hnItems, rssItems] = await Promise.all([fetchHackerNews(), fetchRSSFeeds()]);
  const allRaw = [...hnItems, ...rssItems];
  console.log(`[Ingestion] Total collected raw candidates: ${allRaw.length}`);

  // 3. Deduplicate against seen database and current batch
  const candidateItems = filterUnseenItems(allRaw, seenSet);
  console.log(`[Filtering] Found ${candidateItems.length} candidate articles to curate.`);

  if (candidateItems.length === 0) {
    console.log("✅ Everything is up to date. No new articles to process.");
    return;
  }

  // 4. Curate and score with DeepSeek LLM
  console.log("\n[AI Curation] Sending candidates to DeepSeek for senior-level curation...");
  const curatedArticles = await curateWithDeepSeek(candidateItems);

  if (curatedArticles.length === 0) {
    console.log("⚠️ No articles met the minimum relevance score threshold. Nothing to publish.");
    return;
  }

  // 5. Output results
  if (isDryRun) {
    console.log("\n" + "=".repeat(60));
    console.log(`📋 CURATED BRIEFING PREVIEW (${curatedArticles.length} articles):`);
    console.log("=".repeat(60));

    curatedArticles.forEach((article, index) => {
      console.log(`\n#${index + 1} [${article.category}] (${article.relevance_score}/10) ${article.title}`);
      console.log(`🔗 ${article.url}`);
      console.log(`💡 TL;DR: ${article.tldr}`);
      console.log(`📌 Why it matters: ${article.why_it_matters}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("✨ Dry run completed successfully! No delivery sent and seen.json was not modified.");
    return;
  }

  // 6. Deliver to configured destinations
  console.log("\n[Delivery] Dispatching curated digest to destinations...");
  await Promise.all([sendToDiscord(curatedArticles), sendToNotion(curatedArticles)]);

  // 7. Update seen database with all candidate URLs processed in this run
  for (const item of candidateItems) {
    seenSet.add(normalizeUrl(item.url));
  }
  await saveSeenUrls(seenSet);

  console.log("\n🎉 News curation run finished successfully!");
}

main().catch((err) => {
  console.error("\n❌ Fatal error during curation pipeline:", err);
  process.exit(1);
});
