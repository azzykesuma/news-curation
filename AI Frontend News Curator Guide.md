# **AI Frontend News Curator Guide**

[https\://gemini.google.com/app/c1bf719912f7809f](https://gemini.google.com/app/c1bf719912f7809f)

*User prompt: i want to create something like a news curation ai tools for ai and frontend development the news then can be curated into something like discord or notion how do i make this?*

Response: Building an AI-powered news curator for AI and frontend development requires a four-stage pipeline: **Ingest → Filter & Deduplicate → Summarize (LLM) → Deliver**.

You can build this either as a **low-code workflow** (in an afternoon) or a **custom code script** running on a free schedule (like GitHub Actions).

## **1\. Choose Your Build Approach**

| Approach | Best For | Core Stack | Hosting / Cost |
| :---- | :---- | :---- | :---- |
| **Low-Code (Fastest)** | Visual builders, quick prototyping, easy Notion/Discord auth | **n8n** or **Make.com** | Self-hosted n8n (Free) or Cloud ($9–$20/mo) |
| **Custom Code (Most Flexible)** | Developers who want custom scraping, deduplication, and zero monthly fees | **Node.js / TypeScript** or **Python** | **GitHub Actions** (Free cron jobs) or **Cloudflare Workers** |

## **2\. Step-by-Step Implementation Pipeline**

**1Ingest Sources (The Feed)**

Fetch raw articles & releases daily

Avoid scraping raw HTML where possible; rely on structured APIs and RSS feeds that rarely break:

* **Hacker News:** Use the **Algolia HN Search API** (\[hn.algolia.com/api/v1/search\_by\_date?query=react+OR+llm\&points\](https\://hn.algolia.com/api/v1/search\_by\_date?query=react+OR+llm\&points)\>50) to get pre-vetted, high-signal tech stories.  
* **RSS Feeds:** Pull from *Smashing Magazine*, *CSS-Tricks*, *Vercel Blog*, *React Blog*, *Hugging Face Blog*, and *Simon Willison’s Weblog* using rss-parser (Node) or feedparser (Python).  
* **GitHub Trending / Releases:** Track specific repos (e.g., Next.js, Tailwind, Vite, LangChain) via the GitHub Releases RSS feed (\[github.com/:owner/:repo/releases.atom\](https\://github.com/:owner/:repo/releases.atom)).  
* **Reddit:** Pull JSON directly by appending .json to subreddit URLs (\[reddit.com/r/LocalLLaMA/top.json?t=day\](https\://reddit.com/r/LocalLLaMA/top.json?t=day) and r/reactjs).

**2Extract Full Text & Deduplicate**

Prevent paying for duplicate tokens

RSS feeds often only give you a 1-sentence snippet, and the same major release will appear on HN, Reddit, and blogs simultaneously.

* **Deduplicate:** Store seen URLs (or hashes of article titles) in a lightweight database like **Supabase**, **Upstash Redis**, or a local seen.json file committed back to your repo.  
* **Scrape Clean Markdown:** Pass new URLs through **Jina Reader** (\[https\://r.jina.ai/https\://your-target-url.com\](https\://r.jina.ai/https\://your-target-url.com)) or **Firecrawl**. Both convert messy web pages into clean, LLM-ready Markdown for free/cheap.

**3Curate & Summarize with an LLM**

Use Structured Outputs (JSON)

Send the batch of scraped articles to a fast, cheap, large-context model like **Gemini 2.5 Flash** or **GPT-4o-mini**. Force the model to return a strict **JSON Schema** so your code can easily route the results to Notion and Discord.

* **Scoring:** Ask the LLM to score relevance from 1–10 based on your exact tastes (e.g., *"High score for React 19, CSS features, local LLMs, and agentic workflows; score 0 for crypto, generic AI hype, or beginner tutorials"*).  
* **Filtering:** Drop anything that scores below a 7\.

**4Push to Discord and Notion**

Format for each platform's strengths

* **Discord (via Webhook):** Create a webhook in your Discord channel settings (Server Settings \-\> Integrations \-\> Webhooks). Send a POST request with embeds so links are clickable, color-coded (e.g., Blue for Frontend, Purple for AI), and scannable.  
* **Notion (via Official SDK):** Create an internal integration at notion.so/my-integrations and share a Database with it. Map your LLM's JSON fields directly to Notion properties (Title, URL, Category Select tag, TL;DR text, and Score number).

**5Automate the Schedule**

Run daily at 8:00 AM

Create a .github/workflows/daily-digest.yml file in your repository using on: schedule: \- cron: '0 8 \* \* \*'. GitHub Actions will spin up a container every morning, run your script, and shut down for free.

## **3\. The Curation Prompt & JSON Schema**

To make your tool feel like a smart senior engineer rather than a generic summarizer, use a system prompt that enforces structured JSON output:

`{`  
  `"system_prompt": "You are a Senior Frontend & AI Engineer curating a daily briefing. Analyze the provided articles. Reject fluff, PR announcements without technical substance, and beginner tutorials. For each high-signal article, return a structured object.",`  
  `"expected_output_schema": {`  
    `"articles": [`  
      `{`  
        `"title": "Clean, non-clickbait title",`  
        `"url": "Original URL",`  
        `"category": "Frontend | AI | Tooling",`  
        `"relevance_score": 8,`  
        `"tldr": "One punchy sentence explaining what this is.",`  
        `"why_it_matters": "2 bullet points on practical impact for a developer."`  
      `}`  
    `]`  
  `}`  
`}`

## **4\. Minimal Delivery Code (Node.js / TypeScript)**

Once your LLM outputs the JSON array above, pushing to both platforms takes less than 40 lines of code:

`import { Client } from "@notionhq/client";`

`const notion = new Client({ auth: process.env.NOTION_TOKEN });`  
`const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL!;`  
`const NOTION_DB_ID = process.env.NOTION_DATABASE_ID!;`

`async function publishDigest(articles: any[]) {`  
  `// 1. Send to Discord as a rich Embed message`  
  `const embeds = articles.slice(0, 10).map((item) => ({`  
    ``title: `[${item.category}] ${item.title}`,``  
    `url: item.url,`  
    ``description: `**TL;DR:** ${item.tldr}\n\n**Why it matters:**\n${item.why_it_matters}`,``  
    `color: item.category === "AI" ? 0x9b59b6 : 0x3498db, // Purple for AI, Blue for Frontend`  
  `}));`

  `await fetch(DISCORD_WEBHOOK, {`  
    `method: "POST",`  
    `headers: { "Content-Type": "application/json" },`  
    `body: JSON.stringify({`  
      `content: "☕ **Your Daily AI & Frontend Briefing**",`  
      `embeds,`  
    `}),`  
  `});`

  `// 2. Save each item as a row in a Notion Database`  
  `for (const item of articles) {`  
    `await notion.pages.create({`  
      `parent: { database_id: NOTION_DB_ID },`  
      `properties: {`  
        `Name: { title: [{ text: { content: item.title } }] },`  
        `Category: { select: { name: item.category } },`  
        `Score: { number: item.relevance_score },`  
        `URL: { url: item.url },`  
        `Summary: { rich_text: [{ text: { content: item.tldr } }] },`  
      `},`  
    `});`  
  `}`  
`}`

---

*User prompt: Write the complete Node.js or Python script that fetches from Hacker News and RSS feeds, passes them to an LLM for JSON curation, and runs via GitHub Actions.*

Response: This complete, production-ready **Node.js (TypeScript)** solution fetches AI and Frontend news from Hacker News and RSS feeds, deduplicates articles, curates and summarizes them using **Gemini 2.5 Flash** with strict JSON schema output, and delivers the digest to **Discord** and **Notion** via a free daily **GitHub Action**.

## **Project Structure**

Create a new GitHub repository with these four files:

`ai-frontend-curator/`  
`├── .github/`  
`│   └── workflows/`  
`│       └── daily-digest.yml   # Runs the script every morning at 8 AM UTC + saves state`  
`├── curate.ts                  # Main ingestion, AI curation, and delivery script`  
`├── package.json               # Dependencies`  
`└── seen.json                  # Tracks already-processed URLs so you never get duplicates`

## **1\. Dependencies (package.json & seen.json)**

Create package.json:

`{`  
  `"name": "ai-frontend-curator",`  
  `"version": "1.0.0",`  
  `"type": "module",`  
  `"scripts": {`  
    `"start": "tsx curate.ts"`  
  `},`  
  `"dependencies": {`  
    `"@google/genai": "^1.0.0",`  
    `"@notionhq/client": "^2.2.15",`  
    `"rss-parser": "^3.13.0"`  
  `},`  
  `"devDependencies": {`  
    `"@types/node": "^22.0.0",`  
    `"tsx": "^4.19.0",`  
    `"typescript": "^5.6.0"`  
  `}`  
`}`

Create an empty array in seen.json at the root of your project to initialize URL tracking:

`[]`

## **2\. The Complete Curation Script (curate.ts)**

This script pulls from the Algolia Hacker News API and top AI/Frontend RSS feeds, filters out seen links, uses the @google/genai SDK for structured JSON curation, and pushes to Discord and Notion.

`import fs from "fs/promises";`  
`import Parser from "rss-parser";`  
`import { GoogleGenAI, Type, Schema } from "@google/genai";`  
`import { Client as NotionClient } from "@notionhq/client";`

`// --- 1. CONFIGURATION & CLIENTS ---`  
`const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });`  
`const notion = process.env.NOTION_TOKEN`  
  `? new NotionClient({ auth: process.env.NOTION_TOKEN })`  
  `: null;`  
`const rssParser = new Parser();`

`const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;`  
`const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;`  
`const SEEN_FILE = "./seen.json";`

`// High-signal RSS feeds for Frontend & AI Engineering`  
`const RSS_FEEDS = [`  
  `"https://overreacted.io/rss.xml",                     // Dan Abramov / React`  
  `"https://vercel.com/atom",                            // Vercel / Next.js`  
  `"https://www.smashingmagazine.com/feed/",             // Frontend & UX`  
  `"https://css-tricks.com/feed/",                       // Modern CSS`  
  `"https://simonwillison.net/atom/everything/",         // Applied LLMs & AI Engineering`  
  `"https://huggingface.co/blog/feed.xml",               // Open-source AI`  
  `"https://github.com/facebook/react/releases.atom",    // React Releases`  
  `"https://github.com/vercel/next.js/releases.atom",    // Next.js Releases`  
`];`

`interface RawItem {`  
  `title: string;`  
  `url: string;`  
  `snippet: string;`  
  `source: string;`  
`}`

`interface CuratedArticle {`  
  `title: string;`  
  `url: string;`  
  `category: "Frontend" | "AI" | "Tooling";`  
  `relevance_score: number;`  
  `tldr: string;`  
  `why_it_matters: string;`  
`}`

`// --- 2. INGESTION (HACKER NEWS + RSS) ---`  
`async function fetchHackerNews(): Promise<RawItem[]> {`  
  `// Fetch stories from the last 24h matching AI or Frontend keywords with > 40 points`  
  `const yesterday = Math.floor(Date.now() / 1000) - 86400;`  
  `const query = encodeURIComponent(`  
    `'react OR typescript OR css OR vite OR nextjs OR llm OR "ai agent" ORmcp OR Rag'`  
  `);`  
  ``const url = `https://hn.algolia.com/api/v1/search_by_date?query=$query&tags=story&numericFilters=create{d}_{a}{t}_{i}>${yesterday},points>40`;``

  `try {`  
    `const res = await fetch(url);`  
    `const data = await res.json();`  
    `return (data.hits || [])`  
      `.filter((hit: any) => hit.url)`  
      `.map((hit: any) => ({`  
        `title: hit.title,`  
        `url: hit.url,`  
        ``snippet: `HN Score: ${hit.points} | Comments: ${hit.num_comments}`,``  
        `source: "Hacker News",`  
      `}));`  
  `} catch (err) {`  
    `console.error("Failed to fetch Hacker News:", err);`  
    `return [];`  
  `}`  
`}`

`async function fetchRSSFeeds(): Promise<RawItem[]> {`  
  `const cutoff = Date.now() - 48 * 60 * 60 * 1000; // Last 48 hours`  
  `const items: RawItem[] = [];`

  `for (const feedUrl of RSS_FEEDS) {`  
    `try {`  
      `const feed = await rssParser.parseURL(feedUrl);`  
      `for (const item of feed.items) {`  
        `const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();`  
        `if (pubDate >= cutoff && item.link && item.title) {`  
          `items.push({`  
            `title: item.title,`  
            `url: item.link,`  
            `snippet: (item.contentSnippet || item.summary || "").slice(0, 400),`  
            `source: feed.title || feedUrl,`  
          `});`  
        `}`  
      `}`  
    `} catch (err) {`  
      ``console.warn(`Failed to parse RSS feed ${feedUrl}:`, err);``  
    `}`  
  `}`  
  `return items;`  
`}`

`// --- 3. LLM CURATION (GEMINI STRUCTURED OUTPUT) ---`  
`async function curateWithLLM(rawItems: RawItem[]): Promise<CuratedArticle[]> {`  
  `if (rawItems.length === 0) return [];`

  `const responseSchema: Schema = {`  
    `type: Type.OBJECT,`  
    `properties: {`  
      `articles: {`  
        `type: Type.ARRAY,`  
        `items: {`  
          `type: Type.OBJECT,`  
          `properties: {`  
            `title: { type: Type.STRING, description: "Clean, non-clickbait title" },`  
            `url: { type: Type.STRING },`  
            `category: { type: Type.STRING, enum: ["Frontend", "AI", "Tooling"] },`  
            `relevance_score: {`  
              `type: Type.INTEGER,`  
              `description: "Score from 1 to 10 based on practical value for developers",`  
            `},`  
            `tldr: {`  
              `type: Type.STRING,`  
              `description: "One sharp sentence summarizing what it is.",`  
            `},`  
            `why_it_matters: {`  
              `type: Type.STRING,`  
              `description: "1-2 concise bullet points on why a developer should care.",`  
            `},`  
          `},`  
          `required: ["title", "url", "category", "relevance_score", "tldr", "why_it_matters"],`  
        `},`  
      `},`  
    `},`  
    `required: ["articles"],`  
  `};`

  `` const prompt = ` ``  
`You are a Staff Frontend & AI Engineer curating a high-signal daily digest.`  
`Review the raw candidate articles below.`  
`1. Deduplicate stories covering the exact same release or news.`  
`2. Score each article from 1-10:`  
   `- 8-10: Major releases (React, Next.js, Vite, TypeScript, CSS specs), practical AI engineering (MCP, local LLMs, prompt caching, evals, agent workflows), deep technical postmortems.`  
   `- 1-6: Generic AI hype, corporate PR fluff, crypto, or basic beginner tutorials.`  
`3. Only include articles with a relevance_score >= 7, up to the top 10 highest-scoring items.`

`Candidate Articles:`  
`${JSON.stringify(rawItems, null, 2)}`  
`` `; ``

  `const response = await ai.models.generateContent({`  
    `model: "gemini-2.5-flash",`  
    `contents: prompt,`  
    `config: {`  
      `responseMimeType: "application/json",`  
      `responseSchema: responseSchema,`  
      `temperature: 0.2,`  
    `},`  
  `});`

  `const parsed = JSON.parse(response.text || '{"articles": []}');`  
  `return parsed.articles.sort(`  
    `(a: CuratedArticle, b: CuratedArticle) => b.relevance_score - a.relevance_score`  
  `);`  
`}`

`// --- 4. DELIVERY (DISCORD & NOTION) ---`  
`async function sendToDiscord(articles: CuratedArticle[]) {`  
  `if (!DISCORD_WEBHOOK_URL || articles.length === 0) return;`

  `// Discord allows up to 10 embeds per webhook message`  
  `const embeds = articles.slice(0, 10).map((item) => ({`  
    ``title: `[${item.category}] $item.title(${item.relevance_score}/10)`,``  
    `url: item.url,`  
    ``description: `**TL;DR:** ${item.tldr}\n\n**Why it matters:**\n${item.why_it_matters}`,``  
    `color:`  
      `item.category === "AI"`  
        `? 0x9b59b6 // Purple`  
        `: item.category === "Frontend"`  
        `? 0x3498db // Blue`  
        `: 0x2ecc71, // Green for Tooling`  
  `}));`

  `await fetch(DISCORD_WEBHOOK_URL, {`  
    `method: "POST",`  
    `headers: { "Content-Type": "application/json" },`  
    `body: JSON.stringify({`  
      ``content: `☕ **Daily AI & Frontend Briefing (${new Date().toISOString().split("T")[0]})**`,``  
      `embeds,`  
    `}),`  
  `});`  
  ``console.log(`✅ Sent ${embeds.length} articles to Discord.`);``  
`}`

`async function sendToNotion(articles: CuratedArticle[]) {`  
  `if (!notion || !NOTION_DATABASE_ID || articles.length === 0) return;`

  `for (const item of articles) {`  
    `try {`  
      `await notion.pages.create({`  
        `parent: { database_id: NOTION_DATABASE_ID },`  
        `properties: {`  
          `Name: { title: [{ text: { content: item.title } }] },`  
          `Category: { select: { name: item.category } },`  
          `Score: { number: item.relevance_score },`  
          `URL: { url: item.url },`  
          `Summary: {`  
            ``rich_text: [{ text: { content: `${item.tldr} — ${item.why_it_matters}` } }],``  
          `},`  
          `Date: { date: { start: new Date().toISOString() } },`  
        `},`  
      `});`  
    `} catch (err) {`  
      ``console.error(`Failed to insert "${item.title}" into Notion:`, err);``  
    `}`  
  `}`  
  ``console.log(`✅ Saved ${articles.length} articles to Notion.`);``  
`}`

`// --- 5. MAIN EXECUTION & DEDUPLICATION ---`  
`async function main() {`  
  `// Load previously seen URLs`  
  `let seenUrls: string[] = [];`  
  `try {`  
    `seenUrls = JSON.parse(await fs.readFile(SEEN_FILE, "utf-8"));`  
  `} catch {`  
    `seenUrls = [];`  
  `}`  
  `const seenSet = new Set(seenUrls);`

  `// Fetch all sources concurrently`  
  `const [hnItems, rssItems] = await Promise.all([fetchHackerNews(), fetchRSSFeeds()]);`  
  `const allRaw = [...hnItems, ...rssItems];`

  `// Deduplicate by URL`  
  `const unseenItems: RawItem[] = [];`  
  `for (const item of allRaw) {`  
    `if (!seenSet.has(item.url)) {`  
      `seenSet.add(item.url);`  
      `unseenItems.push(item);`  
    `}`  
  `}`

  ``console.log(`Found ${unseenItems.length} new candidate articles.`);``  
  `if (unseenItems.length === 0) return;`

  `// Curate via LLM`  
  `const curated = await curateWithLLM(unseenItems);`  
  ``console.log(`LLM selected ${curated.length} high-signal articles.`);``

  `// Deliver to targets`  
  `await Promise.all([sendToDiscord(curated), sendToNotion(curated)]);`

  `// Keep the last 1,000 URLs in seen.json so the file stays small`  
  `const updatedSeen = Array.from(seenSet).slice(-1000);`  
  `await fs.writeFile(SEEN_FILE, JSON.stringify(updatedSeen, null, 2));`  
`}`

`main().catch((err) => {`  
  `console.error(err);`  
  `process.exit(1);`  
`});`

## **3\. GitHub Actions Workflow (.github/workflows/daily-digest.yml)**

This workflow runs every morning at 8:00 AM UTC, executes the script, and automatically commits the updated seen.json back to your repository so you never receive the same article twice.

`name: Daily AI & Frontend News Digest`

`on:`  
  `schedule:`  
    `- cron: "0 8 * * *" # Runs every day at 08:00 UTC`  
  `workflow_dispatch:    # Allows you to trigger a test run manually in GitHub UI`

`permissions:`  
  `contents: write       # Required to commit updated seen.json back to the repo`

`jobs:`  
  `curate-and-publish:`  
    `runs-on: ubuntu-latest`  
    `steps:`  
      `- name: Checkout repository`  
        `uses: actions/checkout@v4`

      `- name: Setup Node.js`  
        `uses: actions/setup-node@v4`  
        `with:`  
          `node-version: "22"`  
          `cache: "npm"`

      `- name: Install dependencies`  
        `run: npm install`

      `- name: Run Curator Script`  
        `env:`  
          `GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}`  
          `DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}`  
          `NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}`  
          `NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}`  
        `run: npm start`

      `- name: Commit updated seen.json`  
        `run: |`  
          `git config user.name "github-actions[bot]"`  
          `git config user.email "github-actions[bot]@users.noreply.github.com"`  
          `git add seen.json`  
          `git diff --staged --quiet || git commit -m "chore: update seen URLs [skip ci]"`  
          `git push`

## **4\. Quick Setup Checklist**

> 1. **Notion Database Columns:** Create a new full-page Database in Notion with these exact column names and types:  
   * Name (Title)  
   * Category (Select — options AI, Frontend, Tooling will be auto-created)  
   * Score (Number)  
   * URL (URL)  
   * Summary (Text)  
   * Date (Date)  
   * Click the **...** menu in the top right of your Notion page \-\> **Connections** \-\> connect your Notion API integration.  
> 2. **GitHub Secrets:** In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:  
   * GEMINI\_API\_KEY (From Google AI Studio)  
   * DISCORD\_WEBHOOK\_URL (From Discord Channel Settings → Integrations → Webhooks)  
   * NOTION\_TOKEN & NOTION\_DATABASE\_ID  
> 3. **Test It:** Go to the **Actions** tab in your GitHub repository, click **Daily AI & Frontend News Digest**, and click **Run workflow** to trigger your first briefing immediately.

**Sources**

> 1. [@google/genai](https://googleapis.github.io/js-genai/)

---

