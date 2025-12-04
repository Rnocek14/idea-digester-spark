import { Twitter, Facebook } from "lucide-react";

type ShareButtonsProps = {
  title: string;
  url: string;
  className?: string;
};

export const ShareButtons = ({ title, url, className = "" }: ShareButtonsProps) => {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="h-3.5 w-3.5" />
      </a>
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook className="h-3.5 w-3.5" />
      </a>
    </div>
  );
};
