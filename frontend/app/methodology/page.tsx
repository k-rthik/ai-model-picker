import Link from 'next/link'

export const metadata = { title: 'Methodology — AI Model Picker' }

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🤖</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">AI Model Picker</span>
          </Link>
          <Link href="/" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            ← Back to app
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">How the scores work</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Every model in the catalog gets a <strong>0–10 quality score for each of 8 use cases</strong> (coding,
            writing, analysis, summarization, RAG, agents, vision, long context). Recommendations weigh
            that score against blended token cost. The score has three layers:
          </p>
        </div>

        <Section n="1" title="Curated base tier">
          Each model family carries a hand-maintained base rating — frontier flagships sit around 9–10,
          mid-tier workhorses around 7–8, small edge models around 3–5. Specialist adjustments shift the
          base per use case: coding-tuned models (Codex, Coder, Devstral…) gain for Coding and lose for
          Writing, web-grounded models gain for RAG, reasoning models gain for Analysis, and roleplay
          fine-tunes gain for Writing while losing everywhere else. This layer is editorial judgment,
          updated as new models ship.
        </Section>

        <Section n="2" title="Live arena blend">
          For the roughly 80 catalog models ranked on the{' '}
          <a href="https://arena.ai/leaderboard" target="_blank" rel="noopener noreferrer"
             className="text-blue-600 dark:text-blue-400 underline">LMArena leaderboard</a>{' '}
          — crowd-sourced human preference ELO — the curated base is blended <strong>50/50 with the
          normalized ELO</strong> (the leaderboard range is mapped onto 2–10). Arena data is re-scraped
          on every deployment and daily at 02:00 UTC, so real-world sentiment continuously corrects the
          editorial layer. Models not on the arena keep their curated tier.
        </Section>

        <Section n="3" title="Hard capability gates">
          Objective metadata overrides opinion, whatever the layers above say: a text-only model scores
          1.0 for Vision; context windows under 16K cap Summarization and RAG scores; under 32K caps
          Long-Context at 3.5 while 1M+ windows earn a bonus; models without function-calling support
          are penalized for Agents. Embedding, image, audio, and safety-guard models are excluded from
          recommendations entirely.
        </Section>

        <Section n="$" title="Pricing data">
          Prices, context windows, and capability flags are live market data synced daily from{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer"
             className="text-blue-600 dark:text-blue-400 underline">OpenRouter</a>{' '}
          (~345 hosted models), plus a hand-maintained catalog of self-hosted and niche options.
          Cost ranking uses a blended price assuming a 3:1 input:output token mix, so
          expensive-output models don&apos;t hide behind cheap input rates.
        </Section>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-sm text-amber-800 dark:text-amber-300">
          <strong>Honest caveat:</strong> these scores are informed guidance, not an exhaustive benchmark
          suite. The curated layer reflects editorial judgment; the arena layer reflects aggregate human
          preference, which skews toward chat-style tasks. Treat the recommendation as a strong starting
          point — then validate the pick on your own workload before committing.
        </div>

        <Link href="/" className="inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          ← Try a recommendation
        </Link>
      </main>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
        {title}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{children}</p>
    </section>
  )
}
