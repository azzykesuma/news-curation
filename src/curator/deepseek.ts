import OpenAI from "openai";
import { CONFIG } from "../config.js";
import { CuratedArticle, CurationResult, RawItem } from "../types.js";

export async function curateWithDeepSeek(rawItems: RawItem[]): Promise<CuratedArticle[]> {
  if (rawItems.length === 0) {
    console.log("[DeepSeek] No candidate articles to curate.");
    return [];
  }

  if (!CONFIG.deepseekApiKey) {
    throw new Error(
      "[DeepSeek] DEEPSEEK_API_KEY is not set in environment or GitHub Secrets. Please provide your key to run AI curation."
    );
  }

  console.log(`[DeepSeek] Curating ${rawItems.length} candidate items using model "${CONFIG.deepseekModel}"...`);

  const deadlineMs = 60000;
  const client = new OpenAI({
    apiKey: CONFIG.deepseekApiKey,
    baseURL: "https://api.deepseek.com",
    timeout: deadlineMs,
    maxRetries: 0, // Avoid silently waiting for a second full request on timeout or 5xx.
  });

  const systemPrompt = `You are a Staff Frontend & Applied AI Engineer curating an elite daily briefing for developers.
Evaluate the candidate articles below and select ONLY the highest-signal, most actionable updates.

### Scoring Criteria (1 to 10):
- 8 to 10 (High Signal - Priority):
  * Major frontend frameworks & runtime releases: React 19, Next.js, TypeScript, Vite, Rspack, Turbopack.
  * Web architecture & performance: Module Federation, Micro-Frontends, Server Components, Core Web Vitals, modern CSS/Tailwind.
  * Applied AI & Local AI Engineering: DeepSeek models, Ollama, llama.cpp, Model Context Protocol (MCP), agentic workflows, structured outputs, prompt caching, practical RAG.
  * Production postmortems, real-world architecture breakdowns, engineering deep dives with code.
- 6 to 7 (Moderate):
  * Useful new open-source developer tools, high-quality UI component libraries.
- 1 to 5 (Reject immediately):
  * Generic AI hype, buzzwords, philosophical debates ("Will AI replace developers?").
  * Elementary 101 beginner tutorials ("What is a hook", "Install node.js").
  * Crypto, Web3, NFT, finance speculation.
  * Superficial listicles, corporate PR fluff without technical substance.

### Curation Rules:
1. Deduplicate stories covering the exact same news or release across multiple sources.
2. Only include articles with relevance_score >= ${CONFIG.minRelevanceScore}.
3. Pick up to the top ${CONFIG.maxArticles} highest-scoring articles.
4. Categorize each article as exactly one of: "Frontend", "AI", or "Tooling".
5. Provide a crisp one-sentence TL;DR and 1-2 bullet points for why it matters to engineers.

### Output JSON Format:
You MUST respond with valid JSON matching this structure:
{
  "articles": [
    {
      "title": "Clean, descriptive title",
      "url": "Original URL from the candidate list",
      "category": "Frontend",
      "relevance_score": 9,
      "tldr": "One concise sentence explaining what this is.",
      "why_it_matters": "Practical impact on day-to-day architecture, performance, or workflow."
    }
  ]
}`;

  // Limit candidate payload to avoid token bloat
  const candidateBatch = rawItems.slice(0, 50).map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    snippet: item.snippet,
  }));

  const userContent = `Here are the candidate articles to curate:\n${JSON.stringify(candidateBatch, null, 2)}`;

  const requestStart = Date.now();
  console.log(`[DeepSeek] Request started (${candidateBatch.length} candidates; ${deadlineMs / 1000}s deadline).`);
  try {
    const response = await client.chat.completions.create({
      model: CONFIG.deepseekModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }, { signal: AbortSignal.timeout(deadlineMs) });

    console.log(`[DeepSeek] Response received in ${((Date.now() - requestStart) / 1000).toFixed(1)}s (HTTP 200).`);

    if ((response as any).error) {
      throw new Error(`DeepSeek API server error: ${(response as any).error.message || JSON.stringify((response as any).error)}`);
    }

    if (!response.choices || response.choices.length === 0) {
      throw new Error(`DeepSeek returned no choices: ${JSON.stringify(response)}`);
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[DeepSeek] Empty response received from model");
      return [];
    }

    const parsed: CurationResult = JSON.parse(content);
    const validArticles = (parsed.articles || [])
      .filter((item) => item.title && item.url && item.relevance_score >= CONFIG.minRelevanceScore)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, CONFIG.maxArticles);

    console.log(`[DeepSeek] Successfully curated ${validArticles.length} high-signal articles.`);
    return validArticles;
  } catch (err: any) {
    console.error(
      `[DeepSeek] Curation failed after ${((Date.now() - requestStart) / 1000).toFixed(1)}s ` +
      `(status: ${err.status ?? "no HTTP response"}, error: ${err.message || err}).`
    );
    throw err;
  }
}
