import type { Metadata } from 'next'
import { HomeShell } from '../components/HomeShell'

export const metadata: Metadata = {
  title: 'CLI Router · AI Model Picker',
  description: 'Route a coding prompt to the right Codex CLI or Claude Code model before you run it.',
}

/** Shareable entry point that opens the same app on the CLI Router tab. */
export default function CliRouterPage() {
  return <HomeShell initialTab="cli" />
}
