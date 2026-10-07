import type { ParsedAttributes } from "@/parser/extract";
import type { Source } from "@/db/schema";

export type RawListing = {
  externalId: string;
  url: string;
  title: string;
  description?: string;
  price?: number | null;
  currency: "CZK" | "EUR";
  location?: string | null;
  postalCode?: string | null;
  imageUrl?: string | null;
  postedAt?: Date | null;
  /** Attributes the source already provides in structured form */
  hints?: Partial<ParsedAttributes>;
  /** True when description is only a teaser; the pipeline may fetch the detail page */
  partial?: boolean;
};

export type CheckResult = { status: "active" | "removed" | "unknown"; listing?: RawListing };

export type CrawlContext = {
  source: Source;
  log: (msg: string) => void;
  /** Stop paging once this many consecutive already-known, unchanged listings were seen */
  isKnown: (externalId: string) => Promise<boolean>;
};

export interface SourceAdapter {
  crawl(ctx: CrawlContext): AsyncIterable<RawListing>;
  /** Fetch a single listing again (detail page) to refresh data or detect removal */
  check?(ctx: CrawlContext, listing: { url: string; externalId: string }): Promise<CheckResult>;
}
