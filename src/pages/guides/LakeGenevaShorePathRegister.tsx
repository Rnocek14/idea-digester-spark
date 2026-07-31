import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, Footprints, ShieldCheck, Snowflake } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { NotableWalks } from "@/components/shore-path/NotableWalks";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";

const PATH = "/guides/lake-geneva-shore-path/register";
const META_TITLE = "The Lake Geneva Shore Path Register — Everyone Who Has Walked All 21 Miles";
const META_DESCRIPTION =
  "The running register of walkers who have completed all 21 miles of the Geneva Lake Shore Path, listed by walker number in the order they finished. Not a leaderboard — nothing here is timed.";

type Tier = "loop" | "four_seasons";

type Entry = {
  id: string;
  tier: Tier;
  entry_number: number;
  display_name: string | null;
  home_town: string | null;
  completed_at: string;
  days_elapsed: number | null;
  verification: string;
};

const TABS: { value: Tier; label: string; icon: typeof Award }[] = [
  { value: "loop", label: "The Loop", icon: Footprints },
  { value: "four_seasons", label: "Four Seasons", icon: Snowflake },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function LakeGenevaShorePathRegister() {
  const [tier, setTier] = useState<Tier>("loop");

  const { data = [], isLoading } = useQuery({
    queryKey: ["shore-path-register", tier],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("path_register_entries")
        .select("id, tier, entry_number, display_name, home_town, completed_at, days_elapsed, verification")
        .eq("tier", tier)
        .eq("is_public", true)
        .order("entry_number", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const verifiedCount = useMemo(
    () => data.filter((e) => e.verification === "verified").length,
    [data],
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <PageMeta
        title={META_TITLE}
        description={META_DESCRIPTION}
        path={PATH}
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Guides", path: "/guides" },
            { name: "Lake Geneva Shore Path", path: "/guides/lake-geneva-shore-path" },
            { name: "The Register", path: PATH },
          ]),
        ]}
      />
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <nav className="text-xs text-slate-500 mb-4">
          <Link to="/guides" className="hover:text-blue-700">Guides</Link>
          <span className="mx-1.5">/</span>
          <Link to="/guides/lake-geneva-shore-path" className="hover:text-blue-700">
            Shore Path
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">The Register</span>
        </nav>

        <header className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Geneva Lake · 21 miles · sixteen stops
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Award className="h-8 w-8 text-amber-600 flex-shrink-0" />
            The Shore Path Register
          </h1>
          <p className="text-slate-700 mt-3 leading-relaxed max-w-2xl">
            Everyone who has walked all sixteen stops of the Geneva Lake Shore
            Path, listed by walker number in the order they finished. Numbers are
            permanent and never reissued.
          </p>
          <p className="text-slate-600 mt-2 leading-relaxed max-w-2xl text-sm">
            This is a register, not a leaderboard. Nothing here is timed and
            nothing is ranked by speed. The path is a public easement that runs a
            few feet from private front porches, and it has stayed open for 150
            years because walkers treat it that way — so finishing is the whole
            achievement, whether it took you a weekend or five summers.
          </p>
        </header>

        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTier(t.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  tier === t.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tier === "four_seasons" && (
          <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-md px-4 py-3 mb-5 leading-relaxed">
            <strong className="text-slate-900">Four Seasons</strong> means the
            full loop walked in spring, summer, fall <em>and</em> winter. The path
            isn't cleared for snow, so a winter loop has to be earned a section at
            a time — which is why this list will always be the shorter one.
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading the register…</p>
        ) : data.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center">
            <p className="font-display text-xl text-slate-900 tracking-tight">
              {tier === "loop" ? "Nobody is on the register yet." : "No four-season walkers yet."}
            </p>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
              The early numbers are the ones worth having, and right now they're
              all still available. Start a passport and the first sixteen stops
              you walk put you near the front of a list that will outlast all of us.
            </p>
            <Button asChild className="mt-4">
              <Link to="/guides/lake-geneva-shore-path#register">Start a passport</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-4 mb-3 text-sm text-slate-600">
              <span>
                <strong className="text-slate-900">{data.length}</strong>{" "}
                {data.length === 1 ? "walker" : "walkers"}
              </span>
              {verifiedCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                  {verifiedCount} fully verified
                </span>
              )}
            </div>

            <ol className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {data.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="font-mono text-sm text-slate-500 w-14 flex-shrink-0 tabular-nums">
                    #{e.entry_number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-slate-900 font-medium">
                      {e.display_name || "A walker who preferred not to be named"}
                    </span>
                    {e.home_town && (
                      <span className="text-slate-500"> · {e.home_town}</span>
                    )}
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {formatDate(e.completed_at)}
                      {e.days_elapsed != null && (
                        <> · over {e.days_elapsed} day{e.days_elapsed === 1 ? "" : "s"}</>
                      )}
                    </span>
                  </span>
                  {e.verification === "verified" ? (
                    <ShieldCheck
                      className="h-4 w-4 text-emerald-600 flex-shrink-0"
                      aria-label="Every stop confirmed by location"
                    />
                  ) : (
                    <span
                      className="text-[10px] font-mono uppercase tracking-wide text-slate-400 flex-shrink-0"
                      title="Some stops could not be confirmed by location"
                    >
                      {e.verification === "imported" ? "imported" : "self-rep."}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              Walkers appear here only if they chose to be listed. A shield means
              every one of their stops was confirmed by location as they stood
              there; anything else is labelled rather than counted the same.
            </p>
          </>
        )}

        {/* Superlatives over logged walks. Lives here rather than on the guide
            because this is the page for browsing what other people have done. */}
        <NotableWalks />

        <div className="mt-8 rounded-md border border-slate-200 bg-white p-5">
          <h2 className="font-display text-xl text-slate-900 tracking-tight mb-2">
            Walking it yourself
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">
            Read the guide first — the etiquette matters more than the mileage.
            Then start a passport, or print one and carry it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/guides/lake-geneva-shore-path">The full guide</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/guides/lake-geneva-shore-path/passport">Print a passport</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
