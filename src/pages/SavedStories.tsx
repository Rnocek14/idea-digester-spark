import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Bookmark } from "lucide-react";
import PageShell from "@/components/PageShell";
import { PageMeta } from "@/components/PageMeta";
import {
  listSavedStories,
  removeSavedStory,
  subscribeSavedStories,
  type SavedStory,
} from "@/lib/savedStories";

const SavedStories = () => {
  const [items, setItems] = useState<SavedStory[]>([]);

  useEffect(() => {
    setItems(listSavedStories());
    return subscribeSavedStories(setItems);
  }, []);

  return (
    <PageShell>
      <PageMeta
        title="Your saved stories | Lake Geneva Brief"
        description="Stories you saved while swiping the Lake Geneva Brief."
        path="/saved"
        noindex
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800">Saved stories</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kept on this phone only — no account, nothing to sign up for.
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-3 text-sm text-slate-700">Nothing saved yet.</p>
            <Link
              to="/reel"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-slate-800 px-5 text-sm font-semibold text-white"
            >
              Swipe the Brief
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {items.map((story) => (
              <li
                key={story.id}
                className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                {story.imageUrl && (
                  <img
                    src={story.imageUrl}
                    alt={story.title}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link to={story.path} className="block font-semibold leading-snug text-slate-800">
                    {story.title}
                  </Link>
                  {story.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{story.summary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeSavedStory(story.id)}
                  aria-label={`Remove ${story.title} from saved stories`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
};

export default SavedStories;
