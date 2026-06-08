import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sunrise, Sunset, Thermometer, Shield, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Glance = {
  high: number;
  low: number;
  currentTemp: number;
  sunrise: string; // HH:MM AM/PM
  sunset: string;
};

const formatTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    });
  } catch {
    return "";
  }
};

/**
 * "Lake at a Glance" — left-rail hyperlocal intelligence panel.
 * Only surfaces signals we can verify in real time (weather, daylight,
 * community status). Lake temp / beach status / traffic are intentionally
 * deferred until we have authoritative feeds — we don't show fake data.
 */
export default function LakeAtAGlance() {
  const [glance, setGlance] = useState<Glance | null>(null);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&timezone=America%2FChicago",
    )
      .then((r) => r.json())
      .then((d) => {
        if (!d?.daily || !d?.current_weather) return;
        setGlance({
          high: d.daily.temperature_2m_max[0],
          low: d.daily.temperature_2m_min[0],
          currentTemp: d.current_weather.temperature,
          sunrise: formatTime(d.daily.sunrise[0]),
          sunset: formatTime(d.daily.sunset[0]),
        });
      })
      .catch(() => {});
  }, []);

  const { data: incidentStatus } = useQuery({
    queryKey: ["glance-incidents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id")
        .eq("status", "active")
        .limit(1);
      return { hasActive: (data?.length || 0) > 0 };
    },
    refetchInterval: 60000,
  });
  const isActive = incidentStatus?.hasActive === true;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-slate-100">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-900 font-semibold">
          Lake at a Glance
        </h3>
        <span className="text-[9px] font-mono text-slate-400 uppercase">Live</span>
      </div>

      <ul className="space-y-2 text-[12.5px]">
        {glance?.sunrise && (
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Sunrise className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] uppercase tracking-wider font-mono">Sunrise</span>
            </span>
            <span className="font-mono text-slate-900 tabular-nums">{glance.sunrise}</span>
          </li>
        )}

        {glance?.sunset && (
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600">
              <Sunset className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-[11px] uppercase tracking-wider font-mono">Sunset</span>
            </span>
            <span className="font-mono text-slate-900 tabular-nums">{glance.sunset}</span>
          </li>
        )}
      </ul>

      <p className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">
        Lake temp &amp; beach status coming soon.
      </p>
    </div>
  );
}