import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Copy, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/logActivity";

type Story = {
  id: string;
  title: string;
  category: string | null;
  safety_level: string | null;
  content_newsletter: string | null;
  summary: string | null;
  voice_generated_at: string | null;
  created_at: string;
  source: { name: string } | null;
};

const Newsletter = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [safetyFilter, setSafetyFilter] = useState<"safe" | "safe_and_sensitive">("safe");
  const [generatingStoryId, setGeneratingStoryId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const { data: stories, isLoading } = useQuery({
    queryKey: ["newsletter-stories", dateRange, categoryFilter, safetyFilter],
    queryFn: async () => {
      let query = supabase
        .from("content_queue")
        .select("id, title, category, safety_level, content_newsletter, summary, voice_generated_at, created_at, source:sources(name)")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (safetyFilter === "safe") {
        query = query.eq("safety_level", "safe");
      } else {
        query = query.in("safety_level", ["safe", "sensitive"]);
      }

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Story[];
    },
  });

  const selectedStories = useMemo(() => {
    if (!stories) return [];
    return stories.filter((s) => selectedIds.has(s.id));
  }, [stories, selectedIds]);

  const groupedStories = useMemo(() => {
    const groups: Record<string, Story[]> = {
      events: [],
      community: [],
      dining: [],
      news: [],
      other: [],
    };

    selectedStories.forEach((story) => {
      const cat = story.category || "other";
      if (groups[cat]) {
        groups[cat].push(story);
      } else {
        groups.other.push(story);
      }
    });

    return groups;
  }, [selectedStories]);

  // Single voice generation mutation
  const generateVoiceMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const { data, error } = await supabase.functions.invoke('transform-voice', {
        body: { mode: 'single', id: storyId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, storyId) => {
      await queryClient.invalidateQueries({ queryKey: ["newsletter-stories", dateRange, categoryFilter, safetyFilter] });
      toast.success("Voice generated successfully!");
      
      await logActivity({
        entityType: "content",
        entityId: storyId,
        action: "voice_generated",
        message: "Voice variants generated from Newsletter page",
      });
    },
    onError: (error) => {
      console.error("Voice generation error:", error);
      toast.error("Failed to generate voice variants");
    },
    onSettled: () => {
      setGeneratingStoryId(null);
    }
  });

  // Batch voice generation
  const generateBatchVoice = async () => {
    const storiesNeedingVoice = selectedStories.filter(s => !s.voice_generated_at);
    if (storiesNeedingVoice.length === 0) return;

    setBatchProgress({ current: 0, total: storiesNeedingVoice.length });
    
    for (let i = 0; i < storiesNeedingVoice.length; i++) {
      const story = storiesNeedingVoice[i];
      setGeneratingStoryId(story.id);
      setBatchProgress({ current: i + 1, total: storiesNeedingVoice.length });
      
      try {
        await generateVoiceMutation.mutateAsync(story.id);
      } catch (error) {
        console.error(`Failed to generate voice for story ${story.id}:`, error);
      }
    }
    
    setBatchProgress(null);
    setGeneratingStoryId(null);
    toast.success(`Generated voice for ${storiesNeedingVoice.length} stories!`);
  };

  const toggleStory = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const generatePlainText = () => {
    let text = "THIS WEEK IN LAKE GENEVA\n\n";
    text += "Your weekly guide to what's happening in our beautiful lakeside community.\n\n";

    if (groupedStories.events.length > 0) {
      text += "🌟 FEATURED EVENTS\n\n";
      groupedStories.events.forEach((story) => {
        text += `${story.title}\n`;
        text += `${story.content_newsletter || story.summary}\n\n`;
      });
    }

    if (groupedStories.community.length > 0) {
      text += "COMMUNITY & LOCAL LIFE\n\n";
      groupedStories.community.forEach((story) => {
        text += `${story.title}\n`;
        text += `${story.content_newsletter || story.summary}\n\n`;
      });
    }

    if (groupedStories.dining.length > 0) {
      text += "FOOD & DRINK\n\n";
      groupedStories.dining.forEach((story) => {
        text += `${story.title}\n`;
        text += `${story.content_newsletter || story.summary}\n\n`;
      });
    }

    if (groupedStories.news.length > 0) {
      text += "NEWS & UPDATES\n\n";
      groupedStories.news.forEach((story) => {
        text += `${story.title}\n`;
        text += `${story.content_newsletter || story.summary}\n\n`;
      });
    }

    return text;
  };

  const generateHTML = () => {
    let html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">`;
    html += `<h1 style="color: #1a1a1a; margin-bottom: 8px;">This Week in Lake Geneva</h1>`;
    html += `<p style="color: #666; margin-bottom: 32px;">Your weekly guide to what's happening in our beautiful lakeside community.</p>`;

    if (groupedStories.events.length > 0) {
      html += `<h2 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px;">🌟 Featured Events</h2>`;
      groupedStories.events.forEach((story) => {
        html += `<h3 style="color: #333; margin-bottom: 8px;">${story.title}</h3>`;
        html += `<p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${story.content_newsletter || story.summary}</p>`;
      });
    }

    if (groupedStories.community.length > 0) {
      html += `<h2 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px;">Community & Local Life</h2>`;
      groupedStories.community.forEach((story) => {
        html += `<h3 style="color: #333; margin-bottom: 8px;">${story.title}</h3>`;
        html += `<p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${story.content_newsletter || story.summary}</p>`;
      });
    }

    if (groupedStories.dining.length > 0) {
      html += `<h2 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px;">Food & Drink</h2>`;
      groupedStories.dining.forEach((story) => {
        html += `<h3 style="color: #333; margin-bottom: 8px;">${story.title}</h3>`;
        html += `<p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${story.content_newsletter || story.summary}</p>`;
      });
    }

    if (groupedStories.news.length > 0) {
      html += `<h2 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px;">News & Updates</h2>`;
      groupedStories.news.forEach((story) => {
        html += `<h3 style="color: #333; margin-bottom: 8px;">${story.title}</h3>`;
        html += `<p style="color: #444; line-height: 1.6; margin-bottom: 24px;">${story.content_newsletter || story.summary}</p>`;
      });
    }

    html += `</div>`;
    return html;
  };

  const copyPlainText = () => {
    navigator.clipboard.writeText(generatePlainText());
    toast.success("Plain text copied to clipboard!");
  };

  const copyHTML = () => {
    navigator.clipboard.writeText(generateHTML());
    toast.success("HTML copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Newsletter Composer</h1>
        <p className="text-muted-foreground mt-2">
          Select stories to create your weekly Lake Geneva newsletter
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Story Picker */}
        <Card className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Select Stories</h2>
              {selectedStories.filter(s => !s.voice_generated_at).length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateBatchVoice}
                  disabled={!!batchProgress || !!generatingStoryId}
                >
                  {batchProgress ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating {batchProgress.current}/{batchProgress.total}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Voice for {selectedStories.filter(s => !s.voice_generated_at).length} Selected
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* Filters */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">From</label>
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                          className={cn("pointer-events-auto")}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">To</label>
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                          className={cn("pointer-events-auto")}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="events">Events</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                    <SelectItem value="dining">Dining</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Safety Level</label>
                <Select value={safetyFilter} onValueChange={(v) => setSafetyFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safe">Safe Only</SelectItem>
                    <SelectItem value="safe_and_sensitive">Safe + Sensitive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Story List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading stories...</p>
            ) : !stories || stories.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No stories found</p>
            ) : (
              stories.map((story) => (
                <div
                  key={story.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(story.id)}
                    onCheckedChange={() => toggleStory(story.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1 truncate">{story.title}</h3>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="outline" className="text-xs capitalize">
                        {story.category || "uncategorized"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {story.source?.name || "Unknown"}
                      </Badge>
                      {story.safety_level === "safe" ? (
                        <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                          Safe
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          Sensitive
                        </Badge>
                      )}
                      {story.voice_generated_at ? (
                        <Badge className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Voice: Ready
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGeneratingStoryId(story.id);
                            generateVoiceMutation.mutate(story.id);
                          }}
                          disabled={generatingStoryId === story.id || !!batchProgress}
                        >
                          {generatingStoryId === story.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate Voice
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Right Column: Preview */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Newsletter Preview</h2>
            <Badge variant="outline">{selectedStories.length} stories selected</Badge>
          </div>

          {selectedStories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>Select stories from the left to preview your newsletter</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Content */}
              <div className="border rounded-lg p-6 bg-background max-h-[600px] overflow-y-auto">
                <h1 className="text-2xl font-bold mb-2">This Week in Lake Geneva</h1>
                <p className="text-muted-foreground mb-8">
                  Your weekly guide to what's happening in our beautiful lakeside community.
                </p>

                {groupedStories.events.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">🌟 Featured Events</h2>
                    {groupedStories.events.map((story) => (
                      <div key={story.id} className="mb-6">
                        <h3 className="font-semibold mb-2">{story.title}</h3>
                        <p className="text-sm leading-relaxed">
                          {story.content_newsletter || story.summary}
                          {!story.content_newsletter && (
                            <span className="text-yellow-500 text-xs ml-2">
                              (Using neutral summary – no voice yet)
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {groupedStories.community.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Community & Local Life</h2>
                    {groupedStories.community.map((story) => (
                      <div key={story.id} className="mb-6">
                        <h3 className="font-semibold mb-2">{story.title}</h3>
                        <p className="text-sm leading-relaxed">
                          {story.content_newsletter || story.summary}
                          {!story.content_newsletter && (
                            <span className="text-yellow-500 text-xs ml-2">
                              (Using neutral summary – no voice yet)
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {groupedStories.dining.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Food & Drink</h2>
                    {groupedStories.dining.map((story) => (
                      <div key={story.id} className="mb-6">
                        <h3 className="font-semibold mb-2">{story.title}</h3>
                        <p className="text-sm leading-relaxed">
                          {story.content_newsletter || story.summary}
                          {!story.content_newsletter && (
                            <span className="text-yellow-500 text-xs ml-2">
                              (Using neutral summary – no voice yet)
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {groupedStories.news.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">News & Updates</h2>
                    {groupedStories.news.map((story) => (
                      <div key={story.id} className="mb-6">
                        <h3 className="font-semibold mb-2">{story.title}</h3>
                        <p className="text-sm leading-relaxed">
                          {story.content_newsletter || story.summary}
                          {!story.content_newsletter && (
                            <span className="text-yellow-500 text-xs ml-2">
                              (Using neutral summary – no voice yet)
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Copy Buttons */}
              <div className="flex gap-3">
                <Button onClick={copyPlainText} className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy as Plain Text
                </Button>
                <Button onClick={copyHTML} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy as HTML
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Newsletter;
