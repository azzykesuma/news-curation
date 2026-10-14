# AI Frontend & AI News Curator

Automated, high-signal news curator tailored for modern **Frontend Engineering** and **Applied AI Systems**. Powered by **DeepSeek API (`deepseek-chat`)** for ultra-low inference costs (< $0.001/run), and delivered directly to **Discord** and optionally **Notion**.

---

## ⚡ Highlights

- **Multi-Source Ingestion**: Pulls curated developer stories from Hacker News (Algolia API) and leading RSS/Atom feeds (Dan Abramov, Vercel, Smashing Mag, CSS-Tricks, Simon Willison, Hugging Face, React Releases, Next.js Releases, Tailwind).
- **Persistent Deduplication**: Remembers processed articles in `seen.json` (sliding window of 1,000 URLs) so you never get duplicates.
- **DeepSeek AI Scoring & Curation**: Evaluates candidate articles with a Senior Engineering persona:
  - **High score (8–10)**: React 19, Next.js, TypeScript, Micro-Frontends, Module Federation, Rspack/Vite, Local LLMs, MCP, AI agents, production postmortems.
  - **Rejects (1–5)**: AI hype, marketing fluff, 101 beginner tutorials, crypto/Web3.
- **Discord Delivery**: Posts scannable rich embeds color-coded by category (Frontend: Blue, AI: Purple, Tooling: Green).
- **Zero-Maintenance Automation**: Runs on a free daily GitHub Action cron schedule (08:00 UTC) and automatically commits updated state back to GitHub.

---

## 🚀 Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
Create `.env` or use `.env.example`:
```env
DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### 3. Test with Dry Run (No delivery / No state modification)
```bash
npm run dry-run
```
Fetches live articles from Hacker News and RSS feeds, sends them to DeepSeek for senior curation, and prints the formatted briefing to your terminal.

### 4. Run Full Pipeline
```bash
npm start
```

---

## 📡 Integrations Setup

### Discord Webhook (Recommended)
1. In your Discord server, open **Channel Settings** for the desired channel.
2. Select **Integrations** → **Webhooks** → **New Webhook**.
3. Name it (e.g. `Tech Briefing Bot`) and click **Copy Webhook URL**.
4. Set `DISCORD_WEBHOOK_URL` in `.env`.

### Notion Database (Optional)
1. Create an Internal Integration at [notion.so/profile/integrations](https://www.notion.so/profile/integrations) and copy the **Internal Integration Secret**.
2. Create a new full-page Database in Notion with these exact columns:
   - `Name`: **Title**
   - `Category`: **Select**
   - `Score`: **Number**
   - `URL`: **URL**
   - `Summary`: **Rich text**
   - `Date`: **Date**
3. Share the database with your integration via `...` → **Connect to** → select your integration.
4. Set `NOTION_TOKEN` and `NOTION_DATABASE_ID` in `.env`.

---

## ⏰ Deploying to GitHub Actions

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: initial news curator setup"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions** and add:
   - `DEEPSEEK_API_KEY` (Required)
   - `DISCORD_WEBHOOK_URL` (Required for Discord alerts)
   - `NOTION_TOKEN` & `NOTION_DATABASE_ID` (Optional)
3. The workflow runs every day at **08:00 AM UTC** (`.github/workflows/daily-digest.yml`), or trigger it manually anytime under the **Actions** tab.
