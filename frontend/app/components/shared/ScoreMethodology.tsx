'use client'

/**
 * Collapsible explainer for how quality scores are computed.
 * Shown wherever a 0–10 score is displayed.
 */
export function ScoreMethodology() {
  return (
    <details className="group bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-gray-600 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-gray-100">
        ℹ️ How are these scores calculated?
      </summary>
      <div className="px-4 pb-4 pt-1 text-xs text-gray-600 dark:text-gray-400 space-y-2 leading-relaxed">
        <p>
          Each model gets a <strong>0–10 quality score per use case</strong>, built from three layers:
        </p>
        <ol className="list-decimal ml-4 space-y-1.5">
          <li>
            <strong>Curated base tier</strong> — a hand-maintained rating for each model family
            (e.g. frontier flagships ≈ 9–10, small edge models ≈ 3–5), with specialty adjustments:
            coding-tuned models score higher for Coding and lower for Writing, web-search models
            get a RAG boost, roleplay fine-tunes get a Writing boost.
          </li>
          <li>
            <strong>Live arena data</strong> — for the ~80 models ranked on the{' '}
            <a href="https://arena.ai/leaderboard" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 dark:text-blue-400 underline">LMArena leaderboard</a>{' '}
            (human preference ELO), the base is blended <strong>50/50 with the normalized ELO</strong>.
            Arena data refreshes daily. Models not on the arena keep their curated tier.
          </li>
          <li>
            <strong>Hard capability gates</strong> — objective facts override opinion: text-only
            models score 1.0 for Vision, small context windows cap Long-Context and Summarization
            scores, and models without tool support are penalized for Agents.
          </li>
        </ol>
        <p>
          <strong>Prices, context windows, and capabilities</strong> are live market data,
          synced daily from OpenRouter.
        </p>
        <p className="text-gray-500 dark:text-gray-500">
          Honest caveat: these scores are informed guidance, not an exhaustive benchmark suite.
          The curated layer reflects editorial judgment; the arena layer reflects real human
          preferences. Always validate the final pick on your own workload.
        </p>
      </div>
    </details>
  )
}
