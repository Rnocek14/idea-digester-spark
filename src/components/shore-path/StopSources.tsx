import { BookOpen, CircleHelp, FileText } from "lucide-react";

export type StopSource = {
  url?: string | null;
  publisher?: string | null;
  supports?: string | null;
};

export type HistoryConfidence = "documented" | "traditional" | "thin";

const CONFIDENCE_COPY: Record<HistoryConfidence, { label: string; note: string }> = {
  documented: {
    label: "Documented",
    note: "The history below rests on the published sources listed here.",
  },
  traditional: {
    label: "Traditional account",
    note:
      "This is the account as it is handed down around the lake and repeated by the shoreline communities. This desk has not reproduced a deed, plat, or court record for it — read it as tradition rather than citation.",
  },
  thin: {
    label: "Thinly sourced",
    note:
      "We found little published about this stop. Rather than pad it out, we have kept it short. If you know more, we would like to hear from you.",
  },
};

/**
 * Provenance for a stop's history.
 *
 * This is the one thing the Shore Path's other guides don't do. There is already
 * a paid 146-stop GPS audio tour and two printed guides sold locally; none of
 * them tells you where a claim came from or admits when a story is lake lore
 * rather than record. Competing on volume of history is a losing fight. Being
 * the one that shows its work is not — and it's what the /about transparency
 * policy already commits this desk to.
 */
export function StopSources({
  sources,
  confidence,
}: {
  sources: StopSource[];
  confidence: HistoryConfidence | null;
}) {
  const cited = (sources ?? []).filter((s) => s?.url || s?.publisher);

  // Nothing to say and nothing claimed — don't render an empty box.
  if (cited.length === 0 && !confidence) return null;

  const copy = confidence ? CONFIDENCE_COPY[confidence] : null;
  const Icon = confidence === "documented" ? FileText : confidence === "thin" ? CircleHelp : BookOpen;

  return (
    <section className="mb-8 rounded-md border border-slate-200 bg-stone-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {copy ? copy.label : "Sources"}
        </p>
      </div>

      {copy && (
        <p className="text-xs text-slate-600 leading-relaxed">{copy.note}</p>
      )}

      {cited.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {cited.map((s, i) => (
            <li key={i} className="text-xs text-slate-600 leading-snug">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-blue-700 hover:underline font-medium"
                >
                  {s.publisher || s.url}
                </a>
              ) : (
                <span className="font-medium text-slate-800">{s.publisher}</span>
              )}
              {s.supports && <span className="text-slate-500"> — {s.supports}</span>}
            </li>
          ))}
        </ul>
      )}

      {cited.length === 0 && confidence === "thin" && (
        <p className="text-xs text-slate-500 mt-2 italic">No published source found.</p>
      )}
    </section>
  );
}

/**
 * The same view, a century earlier, beside the one the walker is looking at.
 *
 * Renders nothing unless credit AND rights are both recorded. An archive holding
 * a public-domain original very often asserts rights over its own scan, so "old"
 * is not a licence — and a wrong photo credit in a local paper is a correction at
 * best. The gate is deliberate.
 */
export function ThenAndNow({
  historicalUrl,
  year,
  credit,
  sourceUrl,
  rights,
  modernUrl,
  stopName,
}: {
  historicalUrl: string | null;
  year: string | null;
  credit: string | null;
  sourceUrl: string | null;
  rights: string | null;
  modernUrl: string | null;
  stopName: string;
}) {
  if (!historicalUrl || !credit || !rights) {
    // Fall back to whatever modern image exists.
    if (!modernUrl) return null;
    return (
      <img
        src={modernUrl}
        alt={stopName}
        className="w-full rounded-md border border-slate-200 mb-6"
        loading="lazy"
      />
    );
  }

  return (
    <figure className="mb-6">
      <div className={`grid gap-2 ${modernUrl ? "sm:grid-cols-2" : ""}`}>
        <div>
          <img
            src={historicalUrl}
            alt={`${stopName}${year ? `, ${year}` : ""}`}
            className="w-full rounded-md border border-slate-300"
            loading="lazy"
          />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1">
            {year || "Then"}
          </p>
        </div>
        {modernUrl && (
          <div>
            <img
              src={modernUrl}
              alt={`${stopName} today`}
              className="w-full rounded-md border border-slate-300"
              loading="lazy"
            />
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-1">
              Today
            </p>
          </div>
        )}
      </div>
      <figcaption className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        {year && `${year}. `}
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-blue-700 hover:underline"
          >
            {credit}
          </a>
        ) : (
          credit
        )}
        {rights === "public_domain" && " · Public domain."}
        {rights === "no_known_restrictions" && " · No known restrictions."}
        {rights === "permission_granted" && " · Used with permission."}
        {rights === "licensed" && " · Licensed."}
      </figcaption>
    </figure>
  );
}
