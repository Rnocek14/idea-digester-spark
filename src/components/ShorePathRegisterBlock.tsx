import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The Shore Path Register, on the homepage.
 *
 * The register is otherwise reachable only from two-thirds of the way down a
 * very long guide page and one line on the guides index — which is how a feature
 * quietly dies. A register nobody finds stays empty, an empty register looks
 * abandoned, and abandoned features get deleted. This is the fix.
 *
 * It leads with whatever is true right now: the most recent finisher once there
 * is one, and before that the fact that every number is still available. The
 * empty state is the stronger pitch, so it is written as a pitch rather than an
 * apology.
 */
type RecentEntry = {
  entry_number: number;
  display_name: string | null;
  home_town: string | null;
  completed_at: string;
};

export default function ShorePathRegisterBlock() {
  const { data, isLoading } = useQuery({
    queryKey: ["shore-path-register-homepage"],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("path_register_entries")
        .select("entry_number, display_name, home_town, completed_at", { count: "exact" })
        .eq("tier", "loop")
        .eq("is_public", true)
        .order("entry_number", { ascending: false })
        .limit(1);
      if (error) throw error;
      return { latest: (data?.[0] ?? null) as RecentEntry | null, total: count ?? 0 };
    },
    staleTime: 30 * 60 * 1000,
    // A homepage module is never worth a broken homepage. If the table isn't
    // there yet, or the query fails, this renders nothing at all.
    retry: false,
  });

  if (isLoading || !data) return null;

  const { latest, total } = data;

  return (
    <Link
      to="/guides/lake-geneva-shore-path/register"
      className="group block rounded-md border border-slate-200 bg-white px-4 py-3.5 hover:border-amber-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Award className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            The Shore Path Register
          </p>

          {latest ? (
            <>
              <p className="text-slate-900 leading-snug mt-0.5">
                <strong>
                  {latest.display_name || "A walker"}
                  {latest.home_town && (
                    <span className="font-normal text-slate-500"> of {latest.home_town}</span>
                  )}
                </strong>{" "}
                became Shore Path Walker <strong>#{latest.entry_number}</strong> —
                all sixteen stops, all 21 miles.
              </p>
              {/* Only claim a total when we actually have one. A missing count
                  header would otherwise print "0 walkers have finished" directly
                  beneath "became Walker #13", which reads as broken — and the
                  count can legitimately trail the highest number anyway, since
                  walkers who stayed private hold numbers without being listed. */}
              <p className="text-xs text-slate-600 mt-1">
                {total > 0 && (
                  <>
                    {total} {total === 1 ? "walker is" : "walkers are"} on the
                    register.{" "}
                  </>
                )}
                Numbers are issued in the order people finish and never reissued.
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-900 leading-snug mt-0.5">
                <strong>Walk all 21 miles and you get a number that's yours for good.</strong>{" "}
                Nobody is on the register yet — every one of the early numbers is
                still available.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                No timing, no leaderboard. Take a weekend or take five summers;
                the number is the same.
              </p>
            </>
          )}

          <span className="inline-flex items-center gap-1 text-xs text-blue-700 group-hover:underline mt-1.5">
            See the register <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
