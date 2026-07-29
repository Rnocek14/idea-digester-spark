import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCityId, isCityScopingEnabled } from "@/lib/cityId";
import { useCityConfig } from "@/hooks/useCityConfig";

/**
 * /debug/feed — the instrument for "why are there no stories?"
 *
 * Runs the homepage's filters one at a time against the real database with the
 * real anon key, so RLS applies exactly as it does for a reader. Whichever step
 * drops to zero is the cause. Deliberately dependency-free and noindex'd.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

type Step = { label: string; count: number | null; error?: string; note?: string };

async function countWith(
  build: (q: Any) => Any,
  table = "content_queue",
): Promise<{ count: number | null; error?: string }> {
  try {
    const base = (supabase as Any).from(table).select("id", { count: "exact", head: true });
    const { count, error } = await build(base);
    return { count: count ?? 0, error: error ? `${error.code ?? ""} ${error.message ?? error}`.trim() : undefined };
  } catch (e) {
    return { count: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function DebugFeed() {
  const city = useCityConfig();
  const [steps, setSteps] = useState<Step[]>([]);
  const [samples, setSamples] = useState<Any[]>([]);
  const [incidentSteps, setIncidentSteps] = useState<Step[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(true);

  useEffect(() => {
    (async () => {
      setRunning(true);
      const nowMs = Date.now();
      const now = new Date().toISOString();
      const twoWeeksAgo = new Date(nowMs - 14 * 864e5).toISOString();
      const out: Step[] = [];

      setEnv({
        hostname: window.location.hostname,
        "resolved city_id": getCityId(),
        "city_config row": `${city.id} (${city.site_name})`,
        "city scoping": isCityScopingEnabled() ? "enabled" : "DISABLED (fell back — city_id column missing)",
        "supabase url": (import.meta as Any).env?.VITE_SUPABASE_URL ?? "(unset)",
      });

      // Does city_config exist / is it readable?
      const cfg = await countWith((q: Any) => q, "city_config");
      out.push({ label: "city_config rows readable", count: cfg.count, error: cfg.error });

      // Progressive funnel over the homepage filters.
      const a = await countWith((q: Any) => q);
      out.push({ label: "content_queue — all rows visible to anon (RLS applied)", count: a.count, error: a.error });

      const b = await countWith((q: Any) => q.in("status", ["published", "auto_published"]));
      out.push({ label: "+ status IN (published, auto_published)", count: b.count, error: b.error });

      const c = await countWith((q: Any) =>
        q.in("status", ["published", "auto_published"]).in("safety_level", ["safe", "soft_sensitive"]),
      );
      out.push({ label: "+ safety_level IN (safe, soft_sensitive)", count: c.count, error: c.error });

      const d = await countWith((q: Any) =>
        q
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          .gte("geo_tier", 0)
          .lte("geo_tier", 2),
      );
      out.push({ label: "+ geo_tier between 0 and 2", count: d.count, error: d.error });

      const e = await countWith((q: Any) =>
        q
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          .gte("geo_tier", 0)
          .lte("geo_tier", 2)
          .gte("created_at", twoWeeksAgo),
      );
      out.push({ label: "+ created_at within 14 days", count: e.count, error: e.error });

      const f = await countWith((q: Any) =>
        q
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          .gte("geo_tier", 0)
          .lte("geo_tier", 2)
          .gte("created_at", twoWeeksAgo)
          .gte("publish_date", twoWeeksAgo)
          .lte("publish_date", now),
      );
      out.push({
        label: "+ publish_date within 14 days and not future",
        count: f.count,
        error: f.error,
        note: "NULL publish_date is EXCLUDED by this filter",
      });

      const g = await countWith((q: Any) =>
        q
          .eq("city_id", getCityId())
          .in("status", ["published", "auto_published"])
          .in("safety_level", ["safe", "soft_sensitive"])
          .gte("geo_tier", 0)
          .lte("geo_tier", 2)
          .gte("created_at", twoWeeksAgo)
          .gte("publish_date", twoWeeksAgo)
          .lte("publish_date", now),
      );
      out.push({
        label: `+ city_id = '${getCityId()}'  ← the full homepage query`,
        count: g.count,
        error: g.error,
      });

      // Useful counters that isolate common culprits.
      const nullPub = await countWith((q: Any) =>
        q.in("status", ["published", "auto_published"]).is("publish_date", null),
      );
      out.push({ label: "published rows with NULL publish_date", count: nullPub.count, error: nullPub.error });

      const anyCity = await countWith((q: Any) => q.not("city_id", "is", null));
      out.push({ label: "rows where city_id column exists/non-null", count: anyCity.count, error: anyCity.error });

      setSteps(out);

      // Most recent rows regardless of filters — shows what the pipeline last produced.
      const { data: recent } = await (supabase as Any)
        .from("content_queue")
        .select("id, title, status, safety_level, geo_tier, city_id, publish_date, created_at, category")
        .order("created_at", { ascending: false })
        .limit(8);
      setSamples(recent ?? []);

      // Incidents funnel
      const iAll = await countWith((q: Any) => q, "incidents");
      const iStatus = await countWith(
        (q: Any) => q.in("status", ["active", "developing", "monitoring", "resolved"]),
        "incidents",
      );
      const iCity = await countWith(
        (q: Any) => q.eq("city_id", getCityId()).in("status", ["active", "developing", "monitoring", "resolved"]),
        "incidents",
      );
      setIncidentSteps([
        { label: "incidents — visible to anon", count: iAll.count, error: iAll.error },
        { label: "+ public statuses", count: iStatus.count, error: iStatus.error },
        { label: `+ city_id = '${getCityId()}'`, count: iCity.count, error: iCity.error },
      ]);

      setRunning(false);
    })();
  }, [city.id, city.site_name]);

  const row = (s: Step, i: number) => {
    const zero = s.count === 0;
    return (
      <tr key={i} className={s.error ? "bg-red-50" : zero ? "bg-amber-50" : ""}>
        <td className="border-b border-slate-200 px-3 py-2 align-top">{s.label}</td>
        <td className="border-b border-slate-200 px-3 py-2 text-right font-mono tabular-nums align-top">
          {s.error ? "—" : s.count}
        </td>
        <td className="border-b border-slate-200 px-3 py-2 text-[12px] text-slate-600 align-top">
          {s.error ? <span className="text-red-700 font-mono">{s.error}</span> : s.note ?? ""}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-white p-6 font-sans text-slate-900">
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold mb-1">Feed diagnostics</h1>
        <p className="text-sm text-slate-600 mb-6">
          Runs the homepage filters one at a time against the live database using the public key,
          so row-level security applies exactly as it does for a reader.{" "}
          <strong>The first row that drops to zero is the cause.</strong>
        </p>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Environment</h2>
        <table className="w-full mb-6 text-sm border border-slate-200">
          <tbody>
            {Object.entries(env).map(([k, v]) => (
              <tr key={k}>
                <td className="border-b border-slate-200 px-3 py-2 w-56 text-slate-600">{k}</td>
                <td className="border-b border-slate-200 px-3 py-2 font-mono text-[12px] break-all">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Story funnel {running && <span className="text-slate-400">(running…)</span>}
        </h2>
        <table className="w-full mb-6 text-sm border border-slate-200">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-semibold">Filter</th>
              <th className="px-3 py-2 font-semibold text-right">Rows</th>
              <th className="px-3 py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>{steps.map(row)}</tbody>
        </table>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">Incidents funnel</h2>
        <table className="w-full mb-6 text-sm border border-slate-200">
          <tbody>{incidentSteps.map(row)}</tbody>
        </table>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-2">
          8 most recent rows in content_queue (no filters)
        </h2>
        {samples.length === 0 ? (
          <p className="text-sm text-red-700 mb-6">
            None readable. Either the table is empty, or RLS is hiding everything from the public key.
          </p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-[12px] border border-slate-200">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {["created_at", "publish_date", "status", "safety", "tier", "city_id", "title"].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {samples.map((s: Any) => (
                  <tr key={s.id}>
                    <td className="border-b px-2 py-1.5 font-mono whitespace-nowrap">{String(s.created_at).slice(0, 16)}</td>
                    <td className={`border-b px-2 py-1.5 font-mono whitespace-nowrap ${!s.publish_date ? "bg-amber-100" : ""}`}>
                      {s.publish_date ? String(s.publish_date).slice(0, 16) : "NULL"}
                    </td>
                    <td className="border-b px-2 py-1.5">{s.status}</td>
                    <td className="border-b px-2 py-1.5">{s.safety_level}</td>
                    <td className="border-b px-2 py-1.5 text-right">{s.geo_tier}</td>
                    <td className="border-b px-2 py-1.5">{s.city_id ?? "—"}</td>
                    <td className="border-b px-2 py-1.5">{String(s.title ?? "").slice(0, 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[12px] text-slate-500">
          Red = query error (usually a missing column or an RLS block). Amber = the row count hit zero.
        </p>
      </div>
    </div>
  );
}
