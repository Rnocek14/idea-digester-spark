import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Editorial-feeling "by the numbers" card — reads like content, signed
 * quietly by Gina at the bottom. Lives in the right rail under Plans.
 */
export default function LakeGenevaByNumbers() {
  const { data } = useQuery({
    queryKey: ["lg-by-numbers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("real_estate_metrics")
        .select("median_price, yoy_change, active_listings, days_on_market, zip_code, snapshot_date")
        .eq("zip_code", "53147")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });

  if (!data) return null;

  const median = data.median_price
    ? `$${Math.round(data.median_price / 1000)}K`
    : null;
  const yoy =
    data.yoy_change != null
      ? `${data.yoy_change > 0 ? "+" : ""}${data.yoy_change.toFixed(1)}%`
      : null;
  const yoyPositive = (data.yoy_change ?? 0) > 0;

  const rows: { label: string; value: string; tone?: "up" | "down" }[] = [];
  if (median) rows.push({ label: "Median price", value: median });
  if (yoy)
    rows.push({
      label: "YoY change",
      value: yoy,
      tone: yoyPositive ? "up" : "down",
    });
  if (data.active_listings != null)
    rows.push({ label: "Active listings", value: String(data.active_listings) });
  if (data.days_on_market != null)
    rows.push({ label: "Days on market", value: String(data.days_on_market) });

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Lake Geneva by the numbers"
      className="rounded-xl border border-slate-200 bg-stone-50 p-4"
    >
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-slate-200">
        <h3
          className="text-sm text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
        >
          Lake Geneva by the numbers
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          ZIP {data.zip_code || "53147"}
        </span>
      </div>

      <dl className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between text-[13px]"
          >
            <dt className="text-slate-600">{r.label}</dt>
            <dd
              className={`font-mono tabular-nums font-semibold ${
                r.tone === "up"
                  ? "text-emerald-700"
                  : r.tone === "down"
                  ? "text-rose-700"
                  : "text-slate-900"
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <Link
        to="/selling-lake-geneva"
        className="mt-3 pt-3 border-t border-slate-200 block text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
      >
        Market data via{" "}
        <span className="font-semibold text-slate-700">Gina Nocek</span>
        <span className="text-slate-400"> · @properties</span>
      </Link>
    </section>
  );
}