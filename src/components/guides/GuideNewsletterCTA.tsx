/**
 * Inline newsletter CTA used mid-guide. Scrolls to the homepage subscribe
 * section since that's where the form is already wired up.
 */
import { Link } from "react-router-dom";

export function GuideNewsletterCTA() {
  return (
    <aside className="my-10 rounded-md border-l-4 border-blue-600 bg-blue-50/40 p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-blue-700">
        The Brief, daily
      </p>
      <p className="text-slate-800 mt-2 text-base leading-relaxed">
        One short email each morning — what's happening around Geneva Lake,
        who's doing what, and what's worth your weekend.
      </p>
      <Link
        to="/#subscribe"
        className="inline-block mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Get the Brief
      </Link>
    </aside>
  );
}