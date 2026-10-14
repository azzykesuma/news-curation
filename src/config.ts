import "dotenv/config";

export const CONFIG = {
  // DeepSeek AI
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",

  // Delivery
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || process.env.WEBHOOK_API || "",
  notionToken: process.env.NOTION_TOKEN || "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID || "",

  // Storage & State
  seenFile: process.env.SEEN_FILE || "./seen.json",
  maxSeenUrls: 1000,

  // Curation Thresholds
  minRelevanceScore: Number(process.env.MIN_RELEVANCE_SCORE) || 7,
  maxArticles: Number(process.env.MAX_ARTICLES) || 10,

  // Hacker News Ingestion
  hn: {
    minPoints: 25,
    lookbackHours: 48,
    topics: ["react", "typescript", "nextjs", "llm", "ai agent", "mcp"],
  },

  // High-signal RSS Feeds
  rssFeeds: [
    { name: "Overreacted (Dan Abramov)", url: "https://overreacted.io/rss.xml" },
    { name: "Vercel Blog", url: "https://vercel.com/atom" },
    { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
    { name: "CSS-Tricks", url: "https://css-tricks.com/feed/" },
    { name: "Simon Willison (AI Engineering)", url: "https://simonwillison.net/atom/everything/" },
    { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
    { name: "React Releases", url: "https://github.com/facebook/react/releases.atom" },
    { name: "Next.js Releases", url: "https://github.com/vercel/next.js/releases.atom" },
    { name: "Tailwind CSS Blog", url: "https://tailwindcss.com/feeds/feed.xml" },
  ],
};
