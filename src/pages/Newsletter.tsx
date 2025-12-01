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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Copy, CheckCircle2, Sparkles, Loader2, Zap, AlertCircle, CheckCircle, Eye, Trash2, Send } from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/logActivity";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [previewOptimized, setPreviewOptimized] = useState<Record<string, string> | null>(null);
  const [previewNewsletter, setPreviewNewsletter] = useState<any | null>(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [sendNow, setSendNow] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newsletterToDelete, setNewsletterToDelete] = useState<string | null>(null);
  const [sendingNewsletterId, setSendingNewsletterId] = useState<string | null>(null);

  // Query recent newsletters
  const { data: recentNewsletters } = useQuery({
    queryKey: ["recent-newsletters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletters")
        .select("*")
        .order("edition_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Send newsletter mutation
  const sendNewsletterMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      setSendingNewsletterId(newsletterId);
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: newsletterId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["recent-newsletters"] });
      toast.success(`Newsletter sent! ${data.sent_count} emails delivered`, {
        description: data.message
      });
      await logActivity({
        entityType: "system",
        entityId: data.newsletter_id,
        action: "newsletter_sent",
        message: `Newsletter sent to ${data.sent_count} subscribers`,
        details: { sent_count: data.sent_count, failed_count: data.failed_count }
      });
    },
    onError: (error: any) => {
      toast.error("Failed to send newsletter", {
        description: error.message
      });
    },
    onSettled: () => {
      setSendingNewsletterId(null);
    }
  });

  // Delete newsletter mutation
  const deleteNewsletterMutation = useMutation({
    mutationFn: async (newsletterId: string) => {
      // First, clear last_newsletter_id from stories that reference this newsletter
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({ last_newsletter_id: null })
        .eq('last_newsletter_id', newsletterId);
      
      if (updateError) throw updateError;

      // Then delete the newsletter
      const { error: deleteError } = await supabase
        .from('newsletters')
        .delete()
        .eq('id', newsletterId);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success("Newsletter deleted", {
        description: "Stories are now eligible for next newsletter"
      });
      queryClient.invalidateQueries({ queryKey: ['recent-newsletters'] });
      setDeleteDialogOpen(false);
      setNewsletterToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete newsletter", {
        description: error.message
      });
    }
  });

  // Autopilot newsletter mutation
  const autopilotMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('autopilot-newsletter', {
        body: { force: forceRegenerate, sendNow }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["recent-newsletters"] });
      
      if (data.status === 'skipped') {
        toast.info(`Newsletter skipped: ${data.reason}`, {
          description: `Edition date: ${format(new Date(data.edition_date), 'MMM d, yyyy')}`
        });
      } else if (data.already_exists) {
        toast.info("Newsletter already exists for today", {
          description: `${data.subject} (${data.existing_story_count} stories)`
        });
      } else if (data.status === 'sent') {
        toast.success(`Newsletter sent! ${data.sent_count} emails delivered`, {
          description: data.subject
        });
      } else {
        toast.success(`Newsletter generated! ${data.story_count} stories`, {
          description: data.subject
        });
      }
      
      setForceRegenerate(false);
      setSendNow(false);
      
      await logActivity({
        entityType: "system",
        entityId: data.newsletter_id,
        action: "autopilot_newsletter_generated",
        message: `Autopilot newsletter ${data.status}: ${data.subject}`,
        details: { story_count: data.story_count, status: data.status }
      });
    },
    onError: (error: any) => {
      console.error("Autopilot error:", error);
      toast.error("Failed to generate autopilot newsletter", {
        description: error.message
      });
    }
  });

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

  // Newsletter flow optimization mutation (with auto voice generation)
  const optimizeFlowMutation = useMutation({
    mutationFn: async (storyIds: string[]) => {
      // First, check which stories need voice generation
      const storiesNeedingVoice = selectedStories.filter(
        s => !s.content_newsletter || !s.voice_generated_at
      );

      // Generate voice for stories that need it
      if (storiesNeedingVoice.length > 0) {
        setBatchProgress({ current: 0, total: storiesNeedingVoice.length });
        
        for (let i = 0; i < storiesNeedingVoice.length; i++) {
          const story = storiesNeedingVoice[i];
          setBatchProgress({ current: i + 1, total: storiesNeedingVoice.length });
          
          const { error } = await supabase.functions.invoke('transform-voice', {
            body: { mode: 'single', id: story.id }
          });
          
          if (error) {
            console.error(`Failed to generate voice for story ${story.id}:`, error);
            toast.error(`Failed to generate voice for "${story.title}"`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        setBatchProgress(null);
        await queryClient.invalidateQueries({ queryKey: ["newsletter-stories", dateRange, categoryFilter, safetyFilter] });
      }

      // Now optimize flow for all stories
      const { data, error } = await supabase.functions.invoke('optimize-newsletter-flow', {
        body: { storyIds }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Map optimized stories by id for preview
      if (data?.optimizedStories) {
        const map: Record<string, string> = {};
        for (const item of data.optimizedStories) {
          map[item.id] = item.newsletter_voice;
        }
        setPreviewOptimized(map);
      }

      await queryClient.invalidateQueries({ queryKey: ["newsletter-stories", dateRange, categoryFilter, safetyFilter] });
      toast.success(`Newsletter prepared for ${data.updatedCount} stories!`);
      
      await logActivity({
        entityType: "content",
        entityId: null,
        action: "newsletter_flow_optimized",
        message: `Newsletter prepared with optimized flow for ${data.updatedCount} stories`,
        details: { count: data.updatedCount }
      });
    },
    onError: (error) => {
      console.error("Newsletter preparation error:", error);
      toast.error("Failed to prepare newsletter");
    },
    onSettled: () => {
      setIsOptimizing(false);
      setBatchProgress(null);
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

  const copyNewsletterHTML = (html: string) => {
    navigator.clipboard.writeText(html);
    toast.success("HTML copied to clipboard!");
  };

  const copyNewsletterPlainText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Plain text copied to clipboard!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'ready':
        return <Badge className="bg-yellow-500"><Sparkles className="h-3 w-3 mr-1" />Ready</Badge>;
      case 'skipped':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Skipped</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Newsletter Composer</h1>
        <p className="text-muted-foreground mt-2">
          Select stories to create your weekly Lake Geneva newsletter
        </p>
      </div>

      {/* Autopilot Section */}
      <Card className="p-6 border-primary/20 bg-primary/5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Autopilot Newsletter
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generate today's newsletter automatically using the best available stories
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={forceRegenerate} 
                  onCheckedChange={(checked) => setForceRegenerate(checked as boolean)}
                />
                <span className="text-sm text-muted-foreground">
                  Force regenerate (delete existing newsletter for today)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={sendNow} 
                  onCheckedChange={(checked) => setSendNow(checked as boolean)}
                />
                <span className="text-sm font-medium text-primary">
                  Send Now via email (Resend)
                </span>
              </label>
            </div>
          </div>
          <Button
            onClick={() => autopilotMutation.mutate()}
            disabled={autopilotMutation.isPending}
            size="lg"
          >
            {autopilotMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Generate Autopilot Newsletter
              </>
            )}
          </Button>
        </div>

        {/* Recent Newsletters Status */}
        {recentNewsletters && recentNewsletters.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-3">Recent Newsletters</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stories</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentNewsletters.map((newsletter) => (
                    <TableRow key={newsletter.id}>
                      <TableCell className="font-medium">
                        {format(new Date(newsletter.edition_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(newsletter.status)}
                      </TableCell>
                      <TableCell>
                        {newsletter.story_count}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {newsletter.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(newsletter.status === 'ready' || newsletter.status === 'sent') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewNewsletter(newsletter)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {newsletter.status === 'ready' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => sendNewsletterMutation.mutate(newsletter.id)}
                              disabled={sendingNewsletterId === newsletter.id}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                              {sendingNewsletterId === newsletter.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewsletterToDelete(newsletter.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Story Picker */}
        <Card className="p-6 space-y-6">
          <div>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Select Stories</h2>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedStories.filter(s => !s.voice_generated_at).length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateBatchVoice}
                    disabled={!!batchProgress || !!generatingStoryId || isOptimizing}
                    className="flex-1"
                  >
                    {batchProgress ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating {batchProgress.current}/{batchProgress.total}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Voice ({selectedStories.filter(s => !s.voice_generated_at).length})
                      </>
                    )}
                  </Button>
                )}
                
                {selectedStories.length >= 2 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setIsOptimizing(true);
                      optimizeFlowMutation.mutate(Array.from(selectedIds));
                    }}
                    disabled={isOptimizing || !!batchProgress || !!generatingStoryId}
                    className="flex-1"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {batchProgress 
                          ? `Generating (${batchProgress.current}/${batchProgress.total})...`
                          : 'Optimizing flow...'
                        }
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        ✨ Prepare Newsletter ({selectedStories.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
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

      {/* Before/After Preview Dialog */}
      {previewOptimized && selectedStories.length > 0 && (
        <Dialog open={true} onOpenChange={() => setPreviewOptimized(null)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto max-w-4xl">
            <DialogHeader>
              <DialogTitle>Newsletter Flow Optimization Preview</DialogTitle>
              <DialogDescription>
                Before and after comparison for {selectedStories.length} stories.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {selectedStories.map((story) => {
                const hasOptimized = previewOptimized[story.id];
                if (!hasOptimized) return null;

                return (
                  <div key={story.id} className="border rounded-lg p-4">
                    <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <span className="truncate">{story.title}</span>
                      <Badge variant="outline" className="shrink-0">
                        {story.category || 'other'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium mb-2 text-muted-foreground">Before</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {story.content_newsletter || story.summary || "No newsletter copy yet"}
                        </p>
                      </div>
                      <div>
                        <div className="font-medium mb-2 text-primary">After</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {previewOptimized[story.id]}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Newsletter Preview Modal */}
      <Dialog open={!!previewNewsletter} onOpenChange={(open) => !open && setPreviewNewsletter(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewNewsletter?.subject}</DialogTitle>
            <DialogDescription className="flex items-center gap-4 text-sm">
              <span>Edition: {previewNewsletter?.edition_date && format(new Date(previewNewsletter.edition_date), 'MMM d, yyyy')}</span>
              <span>•</span>
              <span>{previewNewsletter?.story_count} stories</span>
              <span>•</span>
              {previewNewsletter?.status && getStatusBadge(previewNewsletter.status)}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="html" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="html">HTML Preview</TabsTrigger>
              <TabsTrigger value="text">Plain Text</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="flex-1 overflow-auto border rounded-lg bg-background">
                <iframe
                  srcDoc={previewNewsletter?.html_body}
                  className="w-full h-full min-h-[500px]"
                  title="Newsletter Preview"
                />
              </div>
              <Button
                onClick={() => copyNewsletterHTML(previewNewsletter?.html_body)}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy HTML
              </Button>
            </TabsContent>

            <TabsContent value="text" className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="flex-1 overflow-auto border rounded-lg p-4 bg-muted">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {previewNewsletter?.text_body}
                </pre>
              </div>
              <Button
                onClick={() => copyNewsletterPlainText(previewNewsletter?.text_body)}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Plain Text
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the newsletter and make all its stories eligible for the next edition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => newsletterToDelete && deleteNewsletterMutation.mutate(newsletterToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNewsletterMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Newsletter;
