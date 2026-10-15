import { GoogleGenAI, Type } from "@google/genai";
import { CONFIG } from "../config.js";
import { CuratedArticle, CurationResult, RawItem } from "../types.js";

export async function curateWithGemini(rawItems: RawItem[]): Promise<CuratedArticle[]> {
  if (rawItems.length === 0) return [];

  if (!CONFIG.geminiApiKey) {
    throw new Error("[Gemini] GEMINI_API_KEY is not set.");
  }

  console.log(`[Gemini] Curating ${rawItems.length} candidate items using model "${CONFIG.geminiModel}"...`);

  const ai = new GoogleGenAI({ apiKey: CONFIG.geminiApiKey });

  const systemInstruction = `You are a Staff Frontend & Applied AI Engineer curating an elite daily briefing for developers.
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
5. Provide a crisp one-sentence TL;DR and 1-2 bullet points for why it matters to engineers.`;

  const candidateBatch = rawItems.slice(0, 50).map((item) => ({
    title: item.title,
    url: item.url,
    source: item.source,
    snippet: item.snippet,
  }));

  const prompt = `Here are the candidate articles to curate:\n${JSON.stringify(candidateBatch, null, 2)}`;

  const response = await ai.models.generateContent({
    model: CONFIG.geminiModel,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          articles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["Frontend", "AI", "Tooling"] },
                relevance_score: { type: Type.INTEGER },
                tldr: { type: Type.STRING },
                why_it_matters: { type: Type.STRING },
              },
              required: ["title", "url", "category", "relevance_score", "tldr", "why_it_matters"],
            },
          },
        },
        required: ["articles"],
      },
      temperature: 0.2,
    },
  });

  const content = response.text;
  if (!content) return [];

  const parsed: CurationResult = JSON.parse(content);
  return (parsed.articles || [])
    .filter((item) => item.title && item.url && item.relevance_score >= CONFIG.minRelevanceScore)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, CONFIG.maxArticles);
}
