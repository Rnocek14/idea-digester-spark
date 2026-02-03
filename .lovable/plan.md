

# Merge V1 and V2: Add Quick-Scan + View Controls to L-L-L Architecture

## Goal
Combine V1's user-control and quick-scan features with V2's temporal 3-column layout to create the best of both worlds.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           HEADER                                     │
├──────────────┬─────────────────────────────────┬────────────────────┤
│   [LIVE]     │         [LATEST]                │    [LATER]         │
│  (sidebar)   │                                 │   (sidebar)        │
│              │  ┌─────────────────────────┐    │                    │
│  Weather     │  │ At-a-Glance (5 bullets) │    │  Tonight's Pick    │
│  Incidents   │  └─────────────────────────┘    │  NightlifeWidget   │
│              │                                 │  NowHiringWidget   │
│              │  ┌─────────────────────────┐    │                    │
│              │  │ View Toggle:            │    │                    │
│              │  │ [All] [Topic] [Recent•] │    │                    │
│              │  └─────────────────────────┘    │                    │
│              │                                 │                    │
│              │  ┌─────────────────────────┐    │                    │
│              │  │ Category Pills (if Topic)│   │                    │
│              │  └─────────────────────────┘    │                    │
│              │                                 │                    │
│              │  Story Cards (filtered)         │                    │
└──────────────┴─────────────────────────────────┴────────────────────┘
```

---

## Changes to `src/pages/LakeGenevaV2.tsx`

### 1. Add State for View Modes
Import `useSearchParams` and add new state variables:
```typescript
const [searchParams] = useSearchParams();
const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
const [viewMode, setViewMode] = useState<'all' | 'topic' | 'recent'>('all');
const [newUpdatesCount, setNewUpdatesCount] = useState(0);
const previousFeedIdsRef = useRef<Set<string>>(new Set());
```

### 2. Add Deep Linking Support
Handle `?category=events` URL params:
```typescript
useEffect(() => {
  const categoryParam = searchParams.get('category');
  if (categoryParam && categoryOrder.includes(categoryParam.toLowerCase())) {
    setActiveCategory(categoryParam.toLowerCase());
    setViewMode('topic');
  }
}, [searchParams]);
```

### 3. Add "At-a-Glance" Quick-Scan Section
Insert after the LATEST header, before the lead stories:
```typescript
{/* At-a-Glance: Quick-scan bullet list */}
{!storiesLoading && stories.length > 0 && (
  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-sm">
    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-3">
      AT A GLANCE
    </p>
    <ul className="space-y-2">
      {stories.slice(0, 5).map((story) => (
        <li key={story.id} className="flex items-start gap-2">
          <span className="text-slate-400 mt-0.5">•</span>
          <button
            onClick={() => scrollToStory(story.id)}
            className="text-left text-sm text-slate-800 hover:text-blue-700 line-clamp-1"
          >
            {story.title}
          </button>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {getRelativeTime(story.created_at)}
          </span>
        </li>
      ))}
    </ul>
  </div>
)}
```

### 4. Add View Mode Toggle Bar
Insert after At-a-Glance, styled to match V2's industrial aesthetic:
```typescript
{/* View Mode Toggle - sticky */}
<div className="sticky top-[73px] z-20 bg-background py-3 border-b border-slate-200 mb-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    {/* Toggle Pills */}
    <div className="flex items-center gap-1 bg-slate-100 rounded-sm p-1">
      <button
        onClick={() => setViewMode('all')}
        className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
          viewMode === 'all'
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        All
      </button>
      <button
        onClick={() => setViewMode('topic')}
        className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
          viewMode === 'topic'
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        By Topic
      </button>
      <button
        onClick={() => {
          setViewMode('recent');
          setNewUpdatesCount(0);
        }}
        className={`rounded-sm px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
          viewMode === 'recent'
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Recent
        {newUpdatesCount > 0 && viewMode !== 'recent' && (
          <span className="h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {newUpdatesCount > 9 ? '9+' : newUpdatesCount}
          </span>
        )}
      </button>
    </div>

    {/* Category Pills (topic mode only) */}
    {viewMode === 'topic' && (
      <div className="flex flex-wrap gap-2">
        {['all', ...categoryOrder].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-sm px-2.5 py-1 text-[11px] font-mono uppercase border transition-colors ${
              activeCategory === cat
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-500"
            }`}
          >
            {cat === 'all' ? 'All' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

### 5. Update Story Grid to Respect View Mode
Replace the current grid rendering with view-mode-aware logic:
```typescript
{/* Story Grid - respects viewMode */}
{viewMode === 'all' && (
  // Chronological list (current behavior)
)}

{viewMode === 'topic' && (
  // Grouped by category with headers, filtered by activeCategory
)}

{viewMode === 'recent' && (
  // Pure chronological with live incident interleaving (from V1's FeedItem logic)
)}
```

### 6. Add New Updates Detection
Track when new stories appear and show badge:
```typescript
useEffect(() => {
  if (stories.length === 0) return;
  
  const currentIds = new Set(stories.map(s => s.id));
  const previousIds = previousFeedIdsRef.current;
  
  if (previousIds.size > 0) {
    const newItems = [...currentIds].filter(id => !previousIds.has(id));
    if (newItems.length > 0 && viewMode !== 'recent') {
      setNewUpdatesCount(prev => prev + newItems.length);
    }
  }
  
  previousFeedIdsRef.current = currentIds;
}, [stories, viewMode]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LakeGenevaV2.tsx` | Add state, view toggles, At-a-Glance, category pills, filtered rendering |

---

## Design Decisions

1. **Keep V2's industrial aesthetic**: Use `rounded-sm`, `font-mono`, uppercase tracking for consistency with L-L-L branding
2. **At-a-Glance replaces lead pyramid in "recent" mode**: When viewing "Most Recent", hide the pyramid and show pure chronological feed
3. **Category pills are text-only**: No emojis, matching V2's monospace industrial style
4. **Sticky toggle bar**: Stays visible while scrolling for easy mode switching
5. **Mobile: View toggles collapse**: On mobile, show a dropdown instead of pills to save horizontal space

---

## Outcome

After implementation:
- **Quick scan**: Users can read 5 headlines in 10 seconds via At-a-Glance
- **User control**: Three browsing modes (All/Topic/Recent) to match mental models
- **Deep linking**: Share `?category=civic` URLs for specific topic views
- **Live updates**: Badge shows new items since last "Recent" view
- **Preserved L-L-L**: LIVE/LATEST/LATER 3-column architecture remains intact

