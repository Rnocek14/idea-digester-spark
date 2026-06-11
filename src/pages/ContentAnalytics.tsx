import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PillarRow = {
  pillar: string;
  impressions: number;
  homepage_clicks: number;
  detail_views: number;
  newsletter_clicks: number;
  unique_sessions: number;
  ctr_pct: number | null;
};

type SessionAggregate = {
  totalSessions: number;
  returningSessions: number;
  returningPct: number;
};

const PILLAR_ORDER = ["news", "business", "history", "events", "schools", "community", "civic", "other"];
const PILLAR_COLOR: Record<string, string> = {
  news: "bg-slate-100 text-slate-800",
  business: "bg-emerald-100 text-emerald-800",
  history: "bg-amber-100 text-amber-800",
  events: "bg-indigo-100 text-indigo-800",
  schools: "bg-rose-100 text-rose-800",
  community: "bg-sky-100 text-sky-800",
  civic: "bg-stone-200 text-stone-800",
  other: "bg-slate-100 text-slate-600",
};

export default function ContentAnalytics() {
  const [pillars, setPillars] = useState<PillarRow[]>([]);
  const [returning, setReturning] = useState<SessionAggregate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: rows }, { data: sessions }] = await Promise.all([
        supabase.from("content_pillar_metrics_7d").select("*"),
        supabase
          .from("story_events")
          .select("session_id, occurred_at")
          .gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
          .not("session_id", "is", null)
          .limit(10_000),
      ]);

      const sorted = ((rows as PillarRow[]) || []).sort(
        (a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar),
      );
      setPillars(sorted);

      if (sessions?.length) {
        const byDay = new Map<string, Set<string>>();
        for (const r of sessions as { session_id: string; occurred_at: string }[]) {
          const day = r.occurred_at.slice(0, 10);
          if (!byDay.has(day)) byDay.set(day, new Set());
          byDay.get(day)!.add(r.session_id);
        }
        const sessionDayCount = new Map<string, number>();
        for (const [, set] of byDay) {
          for (const sid of set) sessionDayCount.set(sid, (sessionDayCount.get(sid) ?? 0) + 1);
        }
        const total = sessionDayCount.size;
        let ret = 0;
        sessionDayCount.forEach((days) => { if (days >= 2) ret += 1; });
        setReturning({
          totalSessions: total,
          returningSessions: ret,
          returningPct: total === 0 ? 0 : Math.round((100 * ret) / total),
        });
      } else {
        setReturning({ totalSessions: 0, returningSessions: 0, returningPct: 0 });
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Content analytics</h1>
        <p className="text-sm text-slate-600 mt-1">
          Last 7 days. Tracks which content pillars Lake Geneva readers actually
          respond to. Goal: figure out what creates habitual readership before
          building more infrastructure.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-sm uppercase tracking-wider text-slate-500">Returning visitor rate (7d)</h2>
          {returning && (
            <span className="text-xs text-slate-500">
              {returning.returningSessions} of {returning.totalSessions} sessions returned on 2+ days
            </span>
          )}
        </div>
        <div className="text-4xl font-semibold text-slate-900 tabular-nums">
          {loading ? "…" : `${returning?.returningPct ?? 0}%`}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          North-star metric for the new history + business engines.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-4">By content pillar (7d)</h2>
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && pillars.length === 0 && (
          <p className="text-sm text-slate-500">
            No events yet. Browse the homepage to start collecting data.
          </p>
        )}
        {pillars.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Pillar</th>
                  <th className="py-2 pr-3 text-right">Impressions</th>
                  <th className="py-2 pr-3 text-right">Clicks</th>
                  <th className="py-2 pr-3 text-right">CTR</th>
                  <th className="py-2 pr-3 text-right">Detail views</th>
                  <th className="py-2 pr-3 text-right">Newsletter</th>
                  <th className="py-2 pr-3 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {pillars.map((p) => (
                  <tr key={p.pillar} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <Badge className={PILLAR_COLOR[p.pillar] ?? PILLAR_COLOR.other}>{p.pillar}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.impressions}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.homepage_clicks}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.ctr_pct == null ? "—" : `${p.ctr_pct}%`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.detail_views}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.newsletter_clicks}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.unique_sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 bg-slate-50 border-dashed">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Reading the numbers</h2>
        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
          <li>If <strong>business</strong> or <strong>history</strong> CTR beats <strong>news</strong>, lean further into those engines.</li>
          <li>Returning visitor rate is the real thesis — pageviews are vanity.</li>
          <li>Detail views with no homepage clicks usually mean newsletter or direct traffic.</li>
        </ul>
      </Card>
    </div>
  );
}