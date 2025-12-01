import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { BriefHero } from "@/components/BriefHero";
import { StoryCard } from "@/components/StoryCard";

type Story = {
  id: string;
  title: string;
  content_website: string | null;
  content_lg_base: string | null;
  summary: string | null;
  category: string | null;
  publish_date: string | null;
  original_url: string | null;
  image_url: string | null;
  created_at: string;
};

type Sponsor = {
  name: string;
  logo_url: string | null;
  website: string | null;
  placementId?: string;
  businessId?: string;
};

const categoryOrder = ["news", "schools", "events", "dining", "real_estate", "community"];

const LakeGeneva = () => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch today's published stories
  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ["public-stories"],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("content_queue")
        .select("*")
        .in("status", ["published", "auto_published"])
        .eq("safety_level", "safe")
        .gte("created_at", weekAgo.toISOString())
        .order("publish_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Story[];
    },
    staleTime: 60000, // 1 minute
  });

  // Query sponsor
  const { data: sponsor } = useQuery({
    queryKey: ["public-sponsor"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("ad_placements")
        .select(`
          id,
          business_id,
          business:business_profiles(name, logo_url, website)
        `)
        .eq("slot_id", "newsletter_header")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (error) throw error;
      return data ? { ...data.business, placementId: data.id, businessId: data.business_id } as Sponsor & { placementId: string; businessId: string } : null;
    },
    staleTime: 300000, // 5 minutes
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (subscriberEmail: string) => {
      const { error } = await supabase
        .from("subscribers")
        .insert({
          email: subscriberEmail,
          status: "active",
          source: "website",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Successfully subscribed!", {
        description: "You'll receive the Lake Geneva Brief in your inbox.",
      });
      setEmail("");
      setIsSubscribing(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Already subscribed", {
          description: "This email is already on our list.",
        });
      } else {
        toast.error("Subscription failed", {
          description: "Please try again later.",
        });
      }
      setIsSubscribing(false);
    },
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }
    setIsSubscribing(true);
    subscribeMutation.mutate(email);
  };

  // Group stories by category
  const storiesByCategory = stories.reduce((acc, story) => {
    const cat = story.category?.toLowerCase() || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  // Sort categories by predefined order
  const sortedCategories = categoryOrder
    .filter((cat) => storiesByCategory[cat]?.length > 0)
    .concat(Object.keys(storiesByCategory).filter((cat) => !categoryOrder.includes(cat)));

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-16">
        {/* Hero Section */}
        {stories.length > 0 && <BriefHero stories={stories} />}

        {/* Sponsor Block */}
        {sponsor && (
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-center gap-4">
              {sponsor.logo_url && (
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="h-16 w-16 object-contain rounded-lg bg-white p-2"
                />
              )}
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                  Presented By
                </p>
                <p className="text-lg font-bold text-foreground">{sponsor.name}</p>
                {sponsor.website && (
                  <a
                    href={`https://mzumvkrpnxhkvhdyzgqa.supabase.co/functions/v1/track-click?url=${encodeURIComponent(sponsor.website)}&source=web_brief&bid=${sponsor.businessId}&pid=${sponsor.placementId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    Visit Website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Subscribe CTA */}
        <Card className="p-8 bg-gradient-to-br from-background to-muted/20">
          <div className="max-w-md mx-auto text-center space-y-4">
            <Mail className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-2xl font-serif font-bold">Get the Lake Geneva Brief</h2>
            <p className="text-muted-foreground">
              Local stories delivered to your inbox. No spam, just news.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                disabled={isSubscribing}
              />
              <Button type="submit" disabled={isSubscribing}>
                {isSubscribing ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>
          </div>
        </Card>

        {/* Stories by Category */}
        {storiesLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading today's stories...
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No stories published yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-16">
            {sortedCategories.map((category) => (
              <section key={category} className="space-y-6">
                {/* Section Header */}
                <div className="flex items-center gap-3 pb-3 border-b-2 border-primary/20">
                  <h2 className="text-3xl font-serif font-bold capitalize">
                    {category}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {storiesByCategory[category].length}
                  </Badge>
                </div>

                {/* Story Cards */}
                <div className="grid gap-4">
                  {storiesByCategory[category].map((story) => (
                    <StoryCard
                      key={story.id}
                      title={story.title}
                      summary={story.content_website || story.content_lg_base || story.summary}
                      imageUrl={story.image_url}
                      category={story.category}
                      url={story.original_url}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
};

export default LakeGeneva;
