import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { useShorePathStops } from "@/hooks/useShorePathStops";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";

const PATH = "/guides/lake-geneva-shore-path/passport";
const META_TITLE = "Printable Lake Geneva Shore Path Passport — 16 Stops to Collect";
const META_DESCRIPTION =
  "A free printable passport for the 21-mile Geneva Lake Shore Path. Sixteen stops to date and initial as you walk them, plus the path etiquette on the cover.";

/**
 * The paper passport.
 *
 * Rendered as a print stylesheet rather than a generated PDF on purpose: it adds
 * no dependency, it is always in sync with shore_path_stops (so a stop added or
 * renamed in the database is in the next print automatically), and "Save as PDF"
 * is already in every browser's print dialog. It is also the cheapest possible
 * test of whether walkers actually want a physical passport before anyone orders
 * printed booklets or has rubber stamps cut.
 */
export default function LakeGenevaShorePathPassport() {
  const { data: stops = [], isLoading } = useShorePathStops();

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
            { name: "Printable Passport", path: PATH },
          ]),
        ]}
      />

      {/* Print rules. Everything chrome-like is dropped, the sheet goes to full
          width, and the stop grid is told not to break a box across a page. */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: #fff !important; }
          .print-hide { display: none !important; }
          .print-sheet {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-page-break { break-before: page; page-break-before: always; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          .print-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          a { text-decoration: none !important; color: #000 !important; }
        }
      `}</style>

      <div className="print-hide">
        <PublicHeader />
      </div>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 print-sheet">
        <div className="print-hide">
          <nav className="text-xs text-slate-500 mb-4">
            <Link to="/guides" className="hover:text-blue-700">Guides</Link>
            <span className="mx-1.5">/</span>
            <Link to="/guides/lake-geneva-shore-path" className="hover:text-blue-700">
              Shore Path
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-slate-700">Printable Passport</span>
          </nav>

          <header className="mb-6">
            <h1 className="font-display text-3xl text-slate-900 tracking-tight">
              Print your Shore Path passport
            </h1>
            <p className="text-slate-700 mt-2 leading-relaxed max-w-2xl">
              Two pages. Print it, fold it, and put it in a pocket — it works at
              zero battery and in the coves where phone service drops out. Date and
              initial each stop as you reach it, and keep it when you're done.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print / save as PDF
              </Button>
              <Button asChild variant="outline">
                <Link to="/guides/lake-geneva-shore-path#register">
                  Or use the digital passport
                </Link>
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              A paper passport is a keepsake, not a register entry. To get a walker
              number, log your stops in the digital passport as you go.
            </p>
          </header>
          <hr className="border-slate-200 mb-8" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Page 1 — cover and etiquette                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-white border border-slate-300 rounded-md p-8 print-avoid-break">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 text-center">
            The Lake Geneva Brief
          </p>
          <h2 className="font-display text-4xl text-slate-900 tracking-tight text-center mt-2">
            Shore Path Passport
          </h2>
          <p className="text-center text-slate-600 mt-1 text-sm">
            Geneva Lake · 21 miles · sixteen stops
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <Field label="Walker" />
            <Field label="Town" />
            <Field label="First walk" />
            <Field label="Finished" />
          </div>

          <div className="mt-8 rounded border border-slate-300 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2.5">
              How to walk the path well
            </p>
            {/* This list is the reason the easement still exists. It goes on the
                cover, where every walker sees it, not in fine print. */}
            <ul className="text-sm text-slate-800 space-y-1.5 leading-snug">
              <li><strong>Stay on the path.</strong> Not the lawns, not the piers, not the private beaches.</li>
              <li><strong>People live here.</strong> Keep voices down, and don't photograph anyone on their own property.</li>
              <li><strong>Walking only.</strong> No bikes or scooters; most of the path won't take a stroller.</li>
              <li><strong>Dogs leashed</strong>, always picked up after, and turn around where a stretch posts a no-pets notice.</li>
              <li><strong>Swim only at the public beaches</strong> — Lake Geneva, Williams Bay, Fontana, Big Foot Beach.</li>
              <li><strong>Carry water.</strong> Drinking fountains are scarce and phone service drops in the coves.</li>
              <li><strong>If a section is blocked</strong> for maintenance, turn around and walk another one.</li>
            </ul>
            <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
              The Shore Path stays open because a continuous easement crosses
              dozens of private properties, and because generations of walkers have
              treated it carefully. That's the whole arrangement.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Page 2 — the sixteen stamp boxes                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-8 print-page-break">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl text-slate-900 tracking-tight">
              The sixteen stops
            </h2>
            <p className="text-[11px] text-slate-500">In walking order from Library Park</p>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500 print-hide">Loading the stops…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print-grid">
              {stops.map((s) => (
                <div
                  key={s.id}
                  className="border border-slate-300 rounded p-3 bg-white print-avoid-break"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[11px] text-slate-500">
                      {String(s.order_index).padStart(2, "0")}
                    </span>
                    <p className="font-display text-sm text-slate-900 leading-tight">
                      {s.short_label || s.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {s.community}
                    {s.approx_mile != null && ` · mi ${Number(s.approx_mile).toFixed(1)}`}
                  </p>
                  {/* Deliberately generous: a stamp needs room, and so does a
                      date scrawled with cold hands in October. */}
                  <div className="mt-2 h-16 border border-dashed border-slate-300 rounded" />
                  <div className="mt-1.5 flex gap-2">
                    <span className="flex-1 border-b border-slate-300 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                      date
                    </span>
                    <span className="w-12 border-b border-slate-300 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                      init
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded border border-slate-300 p-4 bg-white print-avoid-break">
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
              When you've collected all sixteen
            </p>
            <p className="text-sm text-slate-800 leading-relaxed">
              You've walked the whole 21 miles. Enter yourself on the Shore Path
              Register at{" "}
              <span className="font-mono">lakegenevabrief.com/guides/lake-geneva-shore-path/register</span>{" "}
              and you'll be issued a permanent walker number, in the order people
              finish. There's no timing and no ranking — finishing is the whole thing.
            </p>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 text-center">
            The Lake Geneva Brief · lakegenevabrief.com · Leg distances and public
            restrooms per the Williams Bay Recreation Department Shore Path map
          </p>
        </section>
      </main>
    </div>
  );
}

function Field({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div className="mt-4 border-b border-slate-400" />
    </div>
  );
}
