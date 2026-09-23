// Single source of truth for tiers, model IDs, and prices.
// The JSON lives in the Next app so the deployed frontend can bundle it; this
// package reads the same file from the repository so the two never drift.
// Prices are standard, uncached, short-context API USD / 1M tokens.
import DATA from '../../frontend/app/lib/cli-router/catalog.json' with { type: 'json' };

export const PRICING_DATE = DATA.pricingDate;
export const PRICING_SOURCES = DATA.pricingSources;
export const CATALOG = DATA.catalog;
