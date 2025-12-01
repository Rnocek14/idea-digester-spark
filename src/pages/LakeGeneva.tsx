import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
};

const categoryOrder = ["news", "events", "dining", "real_estate", "community"];

const getCategoryColor = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "news": return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "events": return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
    case "dining": return "bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "real_estate": return "bg-green-500/10 text-green-700 dark:text-green-300";
    case "community": return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
    default: return "bg-muted text-muted-foreground";
  }
};

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

  // Fetch active sponsor
  const { data: sponsor } = useQuery({
    queryKey: ["public-sponsor"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("ad_placements")
        .select(`
          *,
          business:business_profiles(name, logo_url, website)
        `)
        .eq("slot_id", "newsletter_header")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();

      if (error) throw error;
      return data?.business as Sponsor | null;
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
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Lake Geneva Brief</h1>
                <p className="text-sm text-muted-foreground">Your local news, simplified</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(), "MMMM d, yyyy")}
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-12">
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
                    href={sponsor.website}
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
            <h2 className="text-2xl font-bold">Get the Lake Geneva Brief</h2>
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
          <div className="space-y-12">
            {sortedCategories.map((category) => (
              <section key={category} className="space-y-4">
                <h2 className="text-2xl font-bold capitalize flex items-center gap-2">
                  {category}
                  <Badge className={getCategoryColor(category)}>
                    {storiesByCategory[category].length}
                  </Badge>
                </h2>
                <div className="grid gap-6">
                  {storiesByCategory[category].map((story) => (
                    <Card key={story.id} className="p-6 hover:shadow-lg transition-shadow">
                      <div className="flex gap-4">
                        {story.image_url && (
                          <img
                            src={story.image_url}
                            alt={story.title}
                            className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 space-y-2">
                          <h3 className="text-xl font-semibold leading-tight">
                            {story.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {story.content_website || story.content_lg_base || story.summary}
                          </p>
                          {story.original_url && (
                            <a
                              href={story.original_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Read more <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-8 bg-muted/20">
        <div className="container max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <div className="flex items-center justify-center gap-4">
            <a href="/lake-geneva" className="hover:text-primary transition-colors">
              Lake Geneva Brief
            </a>
            <span>•</span>
            <a href="/directory" className="hover:text-primary transition-colors">
              Business Directory
            </a>
            <span>•</span>
            <a href="/advertise" className="hover:text-primary transition-colors">
              Advertise
            </a>
          </div>
          <p>© {new Date().getFullYear()} Lake Geneva Brief. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LakeGeneva;
