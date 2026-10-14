export type Category = "Frontend" | "AI" | "Tooling";

export interface RawItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  pubDate?: number;
}

export interface CuratedArticle {
  title: string;
  url: string;
  category: Category;
  relevance_score: number;
  tldr: string;
  why_it_matters: string;
}

export interface CurationResult {
  articles: CuratedArticle[];
}

export interface DeliveryReport {
  discordSent: boolean;
  notionSent: boolean;
  itemCount: number;
}
