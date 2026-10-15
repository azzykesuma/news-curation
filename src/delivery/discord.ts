import { CONFIG } from "../config.js";
import { CuratedArticle } from "../types.js";

const CATEGORY_COLORS: Record<string, number> = {
  AI: 0x9b59b6, // Purple
  Frontend: 0x3498db, // Blue
  Tooling: 0x2ecc71, // Green
};

export async function sendToDiscord(articles: CuratedArticle[]): Promise<boolean> {
  if (!CONFIG.discordWebhookUrl) {
    console.warn(
      "⚠️ [Discord] Webhook URL not configured! Please set DISCORD_WEBHOOK_URL or WEBHOOK_API in .env or GitHub Secrets."
    );
    return false;
  }

  if (articles.length === 0) {
    console.log("[Discord] No articles to send.");
    return false;
  }

  console.log(`[Discord] Preparing ${articles.length} articles for webhook delivery...`);

  // Discord supports a maximum of 10 embeds per webhook POST
  const embeds = articles.slice(0, 10).map((item) => {
    const color = CATEGORY_COLORS[item.category] || 0x95a5a6;
    const unscored = item.relevance_score === 0;
    const title = `[${item.category}] ${item.title}${unscored ? " (Unreviewed)" : ` (${item.relevance_score}/10)`}`.slice(0, 250);
    const description = unscored
      ? `**Source excerpt:** ${item.tldr}\n\n${item.why_it_matters}`.slice(0, 4000)
      : `**TL;DR:** ${item.tldr}\n\n**Why it matters:**\n${item.why_it_matters}`.slice(0, 4000);

    return {
      title,
      url: item.url,
      description,
      color,
      footer: {
        text: unscored ? "Unreviewed headline • No AI curation" : `Relevance: ${item.relevance_score}/10 • Curated by AI News Curator`,
      },
    };
  });

  const today = new Date().toISOString().split("T")[0];
  const payload = {
    content: `☕ **Daily Frontend & AI Briefing — ${today}**\n*${articles[0].relevance_score === 0 ? "AI unavailable: recent, unreviewed source headlines" : "Top curated engineering updates"} (${embeds.length}):*`,
    embeds,
  };

  try {
    const res = await fetch(CONFIG.discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ [Discord] Webhook returned HTTP ${res.status}: ${errText}`);
      return false;
    }

    console.log(`✅ [Discord] Successfully posted ${embeds.length} curated embeds to Discord!`);
    return true;
  } catch (err: any) {
    console.error("❌ [Discord] Network error sending webhook:", err.message || err);
    return false;
  }
}
