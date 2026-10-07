/**
 * Second-opinion extraction with Claude for listings the rule parser is unsure about
 * (low confidence, contradictory condition signals, conflicting years). Results are cached
 * by content hash so a listing is never sent twice. Disabled when ANTHROPIC_API_KEY is unset.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATALOG } from "./catalog";
import type { ParseResult } from "./extract";

const LlmSchema = z.object({
  kind: z.enum(["car", "parts", "wanted", "rental", "other"]),
  make: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().nullable(),
  mileageKm: z.number().int().nullable(),
  fuel: z.enum(["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric", "unknown"]),
  transmission: z.enum(["manual", "automatic", "unknown"]),
  powerKw: z.number().int().nullable(),
  condition: z.enum(["ok", "damaged", "non_running", "parts", "unknown"]),
  seller: z.enum(["private", "dealer", "unknown"]),
});
export type LlmExtraction = z.infer<typeof LlmSchema>;

const makeList = CATALOG.map((mk) => `${mk.slug}: ${mk.models.map((md) => md.slug).join(", ")}`).join("\n");

const SYSTEM = `You extract structured data from Czech and Slovak used-car classified ads for a price comparison site.
Return only what the ad actually states or clearly implies; use null or "unknown" otherwise.

Rules:
- kind: "car" for a whole vehicle offered for sale (even damaged or sold for parts as a whole), "parts" for individual parts/wheels/tyres, "wanted" for buying ads (koupím, hľadám), "rental" for rentals, "other" for anything else.
- make and model: use the slugs from the catalogue below. If the make or model is not in the catalogue, return a lowercase hyphenated slug.
- year: production year or first registration. Never the STK/TK (inspection) expiry, service dates, or purchase year.
- mileageKm: odometer reading in km. Never EV range (dojezd), service intervals, or distances.
- condition: "ok" if drivable with no reported damage; "damaged" for accident/hail/flood damage or needed repairs while still a car; "non_running" if it does not drive or start, or has a seized/missing engine or gearbox; "parts" if the whole car is sold for parts. Watch for negation: "nehavarované", "nebourané", "bez koroze" are positive statements.
- seller: "dealer" for car dealers/companies (autobazar, s.r.o., odpočet DPH, financování), "private" for individuals.

Catalogue (make: models):
${makeList}`;

let client: Anthropic | null = null;

export function llmEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function llmExtract(title: string, description: string): Promise<LlmExtraction | null> {
  if (!llmEnabled()) return null;
  client ??= new Anthropic();
  const text = `Title: ${title}\n\nDescription:\n${description.slice(0, 6000)}`;
  try {
    const response = await client.beta.messages.parse({
      model: process.env.LLM_MODEL ?? "claude-opus-5-5",
      max_tokens: 2000,
      system: SYSTEM,
      // Routine extraction: low effort keeps cost and latency down
      output_config: { effort: "low", format: betaZodOutputFormat(LlmSchema) },
      // Server-side fallback in case a request is declined by a safety classifier
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: text }],
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.warn("[llm] rate limited, skipping");
      return null;
    }
    if (err instanceof Anthropic.APIError) {
      console.warn(`[llm] API error ${err.status}: ${err.message}`);
      return null;
    }
    throw err;
  }
}

/** Merge the LLM view into the rule result: LLM fills gaps and settles flagged conflicts. */
export function mergeLlm(rules: ParseResult, llm: LlmExtraction): ParseResult {
  const prefer = <T>(ruleVal: T, llmVal: T, conflicted: boolean, empty: T | null = null) =>
    conflicted || ruleVal === empty || ruleVal === "unknown" ? (llmVal ?? ruleVal) : ruleVal;
  const yearConflict = rules.doubts.includes("year_conflict");
  const condConflict = rules.doubts.includes("condition_conflict");
  return {
    ...rules,
    kind: rules.confidence < 0.4 ? llm.kind : rules.kind,
    make: prefer(rules.make, llm.make, false),
    model: prefer(rules.model, llm.model, false),
    year: prefer(rules.year, llm.year, yearConflict),
    mileageKm: prefer(rules.mileageKm, llm.mileageKm, false),
    fuel: prefer(rules.fuel, llm.fuel, false),
    transmission: prefer(rules.transmission, llm.transmission, false),
    powerKw: prefer(rules.powerKw, llm.powerKw, false),
    condition: prefer(rules.condition, llm.condition, condConflict),
    seller: prefer(rules.seller, llm.seller, false),
    confidence: Math.max(rules.confidence, 0.8),
  };
}
