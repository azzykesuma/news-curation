import { CONFIG } from "./config.js";
import { curateWithDeepSeek } from "./curator/deepseek.js";
import { curateWithGemini } from "./curator/gemini.js";
import { selectHeadlines } from "./curator/headlines.js";
import { sendToDiscord } from "./delivery/discord.js";
import { sendToNotion } from "./delivery/notion.js";
import { fetchHackerNews } from "./sources/hackerNews.js";
import { fetchRSSFeeds } from "./sources/rss.js";
import { filterUnseenItems, loadSeenUrls, normalizeUrl, saveSeenUrls } from "./storage/seen.js";
import { CuratedArticle } from "./types.js";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isForce = process.argv.includes("--force") || process.env.FORCE_RUN === "true";
  const startTime = Date.now();

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
  const fetchStart = Date.now();
  const [hnItems, rssItems] = await Promise.all([fetchHackerNews(), fetchRSSFeeds()]);
  const allRaw = [...hnItems, ...rssItems];
  console.log(
    `[Ingestion] Collected ${allRaw.length} raw candidates in ${((Date.now() - fetchStart) / 1000).toFixed(1)}s`
  );

  // 3. Deduplicate against seen database and current batch
  const candidateItems = filterUnseenItems(allRaw, seenSet);
  console.log(`[Filtering] Found ${candidateItems.length} candidate articles to curate.`);

  if (candidateItems.length === 0) {
    console.log("✅ Everything is up to date. No new articles to process.");
    process.exit(0);
  }

  // 4. Curate and score with AI
  console.log("\n[AI Curation] Curating articles with AI...");
  const curateStart = Date.now();
  let curatedArticles: CuratedArticle[] = [];
  let usedHeadlinesFallback = false;

  try {
    if (CONFIG.deepseekApiKey) {
      console.log(`[AI Curation] Calling DeepSeek (${CONFIG.deepseekModel})...`);
      curatedArticles = await curateWithDeepSeek(candidateItems);
    } else if (CONFIG.geminiApiKey) {
      console.log(`[AI Curation] Calling Gemini (${CONFIG.geminiModel})...`);
      curatedArticles = await curateWithGemini(candidateItems);
    } else {
      console.warn("[AI Curation] No AI key configured; using recent source headlines.");
      curatedArticles = selectHeadlines(candidateItems);
      usedHeadlinesFallback = true;
    }
  } catch (err: any) {
    console.warn(`⚠️ [AI Curation] Primary model failed: ${err.message || err}`);
    if (CONFIG.geminiApiKey && CONFIG.deepseekApiKey) {
      console.log(`🔄 [AI Curation] Falling back to Gemini (${CONFIG.geminiModel})...`);
      try {
        curatedArticles = await curateWithGemini(candidateItems);
      } catch (geminiErr: any) {
        console.warn(`⚠️ [AI Curation] Fallback Gemini also failed: ${geminiErr.message || geminiErr}`);
        curatedArticles = selectHeadlines(candidateItems);
        usedHeadlinesFallback = true;
      }
    } else {
      curatedArticles = selectHeadlines(candidateItems);
      usedHeadlinesFallback = true;
    }
  }

  if (usedHeadlinesFallback) {
    console.warn(`[Headlines] Publishing ${curatedArticles.length} recent headlines without AI scoring or review.`);
  }

  console.log(
    `[AI Curation] Finished in ${((Date.now() - curateStart) / 1000).toFixed(1)}s (${curatedArticles.length} articles)`
  );

  if (curatedArticles.length === 0) {
    console.log("⚠️ No articles met the minimum relevance score threshold. Nothing to publish.");
    process.exit(0);
  }

  // 5. Output results for dry-run
  if (isDryRun) {
    console.log("\n" + "=".repeat(60));
    console.log(`📋 ${usedHeadlinesFallback ? "UNREVIEWED HEADLINES" : "CURATED BRIEFING"} PREVIEW (${curatedArticles.length} articles):`);
    console.log("=".repeat(60));

    curatedArticles.forEach((article, index) => {
      console.log(`\n#${index + 1} [${article.category}] ${usedHeadlinesFallback ? "(Unreviewed)" : `(${article.relevance_score}/10)`} ${article.title}`);
      console.log(`🔗 ${article.url}`);
      console.log(`💡 ${usedHeadlinesFallback ? "Source excerpt" : "TL;DR"}: ${article.tldr}`);
      console.log(`📌 ${usedHeadlinesFallback ? "Note" : "Why it matters"}: ${article.why_it_matters}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("✨ Dry run completed successfully! No delivery sent and seen.json was not modified.");
    process.exit(0);
  }

  // 6. Deliver to configured destinations
  console.log("\n[Delivery] Dispatching curated digest to destinations...");
  const deliveryStart = Date.now();
  await Promise.all([sendToDiscord(curatedArticles), sendToNotion(curatedArticles)]);
  console.log(`[Delivery] Completed in ${((Date.now() - deliveryStart) / 1000).toFixed(1)}s`);

  // With unreviewed headlines, retain unselected candidates for a later AI run.
  for (const item of usedHeadlinesFallback ? curatedArticles : candidateItems) {
    seenSet.add(normalizeUrl(item.url));
  }
  await saveSeenUrls(seenSet);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 News curation run finished successfully in ${totalTime}s!`);

  // Explicitly exit cleanly so Node doesn't hold open background keep-alive sockets
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Fatal error during curation pipeline:", err);
  process.exit(1);
});
