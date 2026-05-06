import Link from "next/link";
import type { MessageMetadataDto } from "../../lib/api";

type Props = {
  metadata: MessageMetadataDto | null | undefined;
  /** Dock usa tipografía más compacta */
  compact?: boolean;
};

/**
 * Render de metadata V1-C (menciones enriquecidas + enlaces a cotizaciones con snapshot).
 */
export function MessageMetadataBlock({ metadata, compact }: Props) {
  if (!metadata) return null;
  const hasM = metadata.mentions.length > 0;
  const hasQ = metadata.quoteRefs.length > 0;
  const hasReply = !!metadata.replyTo;
  if (!hasM && !hasQ && !hasReply) return null;

  const textXs = compact ? "text-[10px]" : "text-xs";

  return (
    <div
      className={`mt-2 space-y-1.5 rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 dark:border-slate-600/60 dark:bg-slate-800/50 ${textXs}`}
    >
      {hasM && (
        <div className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Menciones: </span>
          {metadata.mentions.map((m, i) => (
            <span key={m.userId}>
              {i > 0 ? " · " : ""}
              <span className="font-medium text-primary-700 dark:text-primary-300">
                @{m.displayName}
              </span>
            </span>
          ))}
        </div>
      )}
      {hasReply && metadata.replyTo && (
        <div className="rounded border-l-2 border-primary-300 bg-white/90 px-2 py-1.5 dark:border-primary-700 dark:bg-slate-900/50">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Responde a {metadata.replyTo.authorNameSnapshot}: </span>
          <span className="text-slate-600 dark:text-slate-400">{metadata.replyTo.bodySnippet}</span>
        </div>
      )}
      {hasQ && (
        <div className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Cotizaciones: </span>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5">
            {metadata.quoteRefs.map((q) => (
              <li key={q.quoteId}>
                <Link
                  href={`/cotizaciones/${encodeURIComponent(q.quoteId)}`}
                  className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  {q.titleSnapshot}
                  {q.commercialNumberSnapshot
                    ? ` (${q.commercialNumberSnapshot})`
                    : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
