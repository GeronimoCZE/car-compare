import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const countryEnum = pgEnum("country", ["CZ", "SK"]);
export const currencyEnum = pgEnum("currency", ["CZK", "EUR"]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "removed", "hidden"]);
export const conditionEnum = pgEnum("vehicle_condition", ["ok", "damaged", "non_running", "parts", "unknown"]);
export const listingKindEnum = pgEnum("listing_kind", ["car", "parts", "wanted", "rental", "other"]);
export const fuelEnum = pgEnum("fuel", ["petrol", "diesel", "lpg", "cng", "hybrid", "plugin_hybrid", "electric", "unknown"]);
export const transmissionEnum = pgEnum("transmission", ["manual", "automatic", "unknown"]);
export const sellerEnum = pgEnum("seller", ["private", "dealer", "unknown"]);
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const runStatusEnum = pgEnum("run_status", ["running", "ok", "failed"]);

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  name: text("name").notNull(),
  country: countryEnum("country").notNull(),
  baseUrl: text("base_url").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  // Free-form adapter settings (category URLs, page limits, feed URLs...)
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  // Short note shown in admin about the legal basis (ToS, robots.txt, partner agreement)
  complianceNote: text("compliance_note"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 120 }).notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    price: integer("price"),
    currency: currencyEnum("currency").notNull().default("CZK"),
    // Price normalised to CZK so CZ and SK listings can be compared on one scale
    priceCzk: integer("price_czk"),
    location: text("location"),
    postalCode: varchar("postal_code", { length: 10 }),
    country: countryEnum("country").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
    status: listingStatusEnum("status").notNull().default("active"),
    // Parsed attributes
    kind: listingKindEnum("kind").notNull().default("car"),
    make: varchar("make", { length: 40 }),
    model: varchar("model", { length: 60 }),
    variant: text("variant"),
    year: integer("year"),
    mileageKm: integer("mileage_km"),
    fuel: fuelEnum("fuel").notNull().default("unknown"),
    transmission: transmissionEnum("transmission").notNull().default("unknown"),
    bodyType: varchar("body_type", { length: 30 }),
    powerKw: integer("power_kw"),
    engineCcm: integer("engine_ccm"),
    condition: conditionEnum("condition").notNull().default("unknown"),
    conditionNotes: jsonb("condition_notes").$type<string[]>().notNull().default([]),
    seller: sellerEnum("seller").notNull().default("unknown"),
    vatDeductible: boolean("vat_deductible").notNull().default(false),
    serviceBook: boolean("service_book"),
    firstOwner: boolean("first_owner"),
    stkValidUntil: varchar("stk_valid_until", { length: 7 }),
    parseConfidence: real("parse_confidence").notNull().default(0),
    parsedBy: varchar("parsed_by", { length: 10 }).notNull().default("rules"),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    // Same physical car posted on several sites shares a cluster key
    clusterKey: varchar("cluster_key", { length: 120 }),
    // Market comparison, refreshed by the worker
    marketMedianCzk: integer("market_median_czk"),
    marketSampleSize: integer("market_sample_size"),
    dealScore: real("deal_score"),
    reportCount: integer("report_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("listings_source_ext_idx").on(t.sourceId, t.externalId),
    index("listings_make_model_idx").on(t.make, t.model, t.year),
    index("listings_status_idx").on(t.status, t.kind),
    index("listings_price_idx").on(t.priceCzk),
    index("listings_cluster_idx").on(t.clusterKey),
    index("listings_checked_idx").on(t.lastCheckedAt),
    index("listings_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', unaccent_immutable(${t.title} || ' ' || coalesce(${t.make}, '') || ' ' || coalesce(${t.model}, '')))`,
    ),
  ],
);

export const priceHistory = pgTable(
  "price_history",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    price: integer("price"),
    currency: currencyEnum("currency").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_listing_idx").on(t.listingId, t.observedAt)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 80 }),
  role: roleEnum("role").notNull().default("user"),
  locale: varchar("locale", { length: 2 }).notNull().default("cs"),
  emailAlerts: boolean("email_alerts").notNull().default(true),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the random token stored in the cookie
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    // Price when bookmarked, so we can show "dropped by X since you saved it"
    priceCzkAtSave: integer("price_czk_at_save"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  query: text("query").notNull(),
  notify: boolean("notify").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  newMatches: integer("new_matches").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: varchar("reason", { length: 30 }).notNull(),
  message: text("message"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "cascade" }),
    job: varchar("job", { length: 30 }).notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetched: integer("fetched").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    removed: integer("removed").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    llmCalls: integer("llm_calls").notNull().default(0),
    log: text("log").notNull().default(""),
  },
  (t) => [index("ingest_runs_started_idx").on(t.startedAt)],
);

// Cache of LLM extractions keyed by content hash so we never pay twice for the same text
export const llmCache = pgTable("llm_cache", {
  contentHash: varchar("content_hash", { length: 64 }).primaryKey(),
  result: jsonb("result").notNull(),
  model: varchar("model", { length: 60 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who did what in the admin area (kept for accountability; never shown publicly). */
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    detail: jsonb("detail"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_at_idx").on(t.at)],
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type User = typeof users.$inferSelect;
