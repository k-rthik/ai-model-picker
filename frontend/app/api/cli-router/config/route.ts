import { NextResponse } from 'next/server'
import { CATALOG, PRICING_DATE, THRESHOLDS } from '../../../lib/cli-router/core'
import type { RouterConfig } from '../../../lib/cli-router/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public shape of the router configuration. The Jev credential itself never
 * appears here — only whether one is configured, so the UI can say up front
 * that routing will fall back to balanced.
 */
export async function GET() {
  const config: RouterConfig = {
    jevConfigured: Boolean(process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY),
    catalog: CATALOG,
    pricingDate: PRICING_DATE,
    thresholds: THRESHOLDS,
  }
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } })
}
