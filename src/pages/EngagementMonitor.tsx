import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Heart, 
  Repeat2, 
  MessageCircle, 
  UserPlus,
  ExternalLink,
  Check,
  X,
  Clock,
  TrendingUp,
  Hash,
  AtSign,
  Plus,
  Link,
  Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type OpportunityType = 'mention' | 'reply' | 'hashtag' | 'follower' | 'curated';
type OpportunityStatus = 'new' | 'reviewed' | 'engaged' | 'dismissed';

interface EngagementOpportunity {
  id: string;
  platform: string;
  opportunity_type: OpportunityType;
  tweet_id: string | null;
  author_username: string | null;
  author_display_name: string | null;
  author_profile_url: string | null;
  tweet_text: string | null;
  tweet_url: string | null;
  hashtags: string[] | null;
  tweet_created_at: string | null;
  status: OpportunityStatus;
  priority_score: number;
  metadata: any;
  created_at: string;
}

interface ParsedTweet {
  tweetId: string;
  username: string;
  url: string;
}

// Parse tweet URL to extract ID and username
function parseTweetUrl(url: string): ParsedTweet | null {
  const trimmed = url.trim();
  // Match patterns like:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/i);
  if (match) {
    return {
      username: match[1],
      tweetId: match[2],
      url: trimmed
    };
  }
  return null;
}

export default function EngagementMonitor() {
  const [activeTab, setActiveTab] = useState<string>("curate");
  const [tweetUrls, setTweetUrls] = useState("");
  const [parsedTweets, setParsedTweets] = useState<ParsedTweet[]>([]);
  const queryClient = useQueryClient();

  // Parse URLs as user types
  const handleUrlsChange = (value: string) => {
    setTweetUrls(value);
    const lines = value.split(/[\n,]/).filter(line => line.trim());
    const parsed: ParsedTweet[] = [];
    for (const line of lines) {
      const result = parseTweetUrl(line);
      if (result) {
        parsed.push(result);
      }
    }
    setParsedTweets(parsed);
  };

  // Add parsed tweets to database
  const addTweets = useMutation({
    mutationFn: async (tweets: ParsedTweet[]) => {
      const records = tweets.map(t => ({
        platform: 'x',
        opportunity_type: 'curated' as const,
        tweet_id: t.tweetId,
        author_username: t.username,
        tweet_url: t.url,
        status: 'new',
        priority_score: 10, // Manual curation = high priority
      }));

      const { error } = await supabase
        .from('engagement_opportunities')
        .upsert(records, { onConflict: 'tweet_id', ignoreDuplicates: true });
      
      if (error) throw error;
      return records.length;
    },
    onSuccess: (count) => {
      toast.success(`Added ${count} tweets to queue`);
      setTweetUrls("");
      setParsedTweets([]);
      queryClient.invalidateQueries({ queryKey: ['engagement-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to add tweets: ${error.message}`);
    }
  });

  // Fetch opportunities
  const { data: opportunities, isLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['engagement-opportunities', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('engagement_opportunities')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeTab === 'curate') {
        query = query.eq('opportunity_type', 'curated');
      } else if (activeTab === 'new') {
        query = query.eq('status', 'new');
      } else if (activeTab !== 'all') {
        query = query.eq('opportunity_type', activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EngagementOpportunity[];
    },
    staleTime: 30000,
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['engagement-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_opportunities')
        .select('status, opportunity_type');
      
      if (error) throw error;

      const counts = {
        total: data.length,
        new: data.filter(d => d.status === 'new').length,
        engaged: data.filter(d => d.status === 'engaged').length,
        curated: data.filter(d => d.opportunity_type === 'curated').length,
        hashtag: data.filter(d => d.opportunity_type === 'hashtag').length,
        mention: data.filter(d => d.opportunity_type === 'mention').length,
      };
      return counts;
    },
    staleTime: 30000,
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OpportunityStatus }) => {
      const { error } = await supabase
        .from('engagement_opportunities')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engagement-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-stats'] });
    },
  });

  // Delete mutation
  const deleteTweet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engagement_opportunities')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removed from queue');
      queryClient.invalidateQueries({ queryKey: ['engagement-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-stats'] });
    },
  });

  // Deep link generators
  const getLikeUrl = (tweetId: string) => `https://twitter.com/intent/like?tweet_id=${tweetId}`;
  const getRetweetUrl = (tweetId: string) => `https://twitter.com/intent/retweet?tweet_id=${tweetId}`;
  const getReplyUrl = (tweetId: string) => `https://twitter.com/intent/tweet?in_reply_to=${tweetId}`;
  const getFollowUrl = (username: string) => `https://twitter.com/intent/follow?screen_name=${username}`;

  const handleEngagement = (id: string, action: string) => {
    updateStatus.mutate({ id, status: 'engaged' });
    toast.success(`Marked as engaged (${action})`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engagement Monitor</h1>
          <p className="text-muted-foreground">
            Curate local tweets · Click to engage natively on X
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.curated || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Link className="h-3 w-3" /> Curated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-500">{stats?.new || 0}</div>
            <p className="text-xs text-muted-foreground">New</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{stats?.engaged || 0}</div>
            <p className="text-xs text-muted-foreground">Engaged</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.hashtag || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" /> Hashtags
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.mention || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Mentions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="curate">
            <Plus className="h-4 w-4 mr-1" />
            Curate
            {stats?.curated ? <Badge variant="secondary" className="ml-1">{stats.curated}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="new">
            New
            {stats?.new ? <Badge variant="secondary" className="ml-1">{stats.new}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="curate" className="mt-4 space-y-4">
          {/* Add Tweets Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Link className="h-5 w-5" />
                Add Tweet URLs
              </CardTitle>
              <CardDescription>
                Paste tweet URLs from X (one per line or comma-separated). 
                Search #LakeGeneva, local businesses, community accounts manually on X and paste links here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="https://x.com/username/status/1234567890&#10;https://twitter.com/another/status/0987654321"
                value={tweetUrls}
                onChange={(e) => handleUrlsChange(e.target.value)}
                className="min-h-[100px] font-mono text-sm"
              />
              
              {parsedTweets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Found {parsedTweets.length} valid tweet{parsedTweets.length !== 1 ? 's' : ''}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {parsedTweets.map((t, i) => (
                      <Badge key={i} variant="outline" className="font-mono">
                        @{t.username}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={() => addTweets.mutate(parsedTweets)}
                disabled={parsedTweets.length === 0 || addTweets.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {parsedTweets.length} Tweet{parsedTweets.length !== 1 ? 's' : ''} to Queue
              </Button>
            </CardContent>
          </Card>

          {/* Quick Search Tips */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-2">Search tips for Lake Geneva:</p>
              <div className="flex flex-wrap gap-2">
                {['#LakeGeneva', '#LakeGenevaWI', '#GenevaLake', '#WalworthCounty', 'Lake Geneva WI'].map(term => (
                  <a
                    key={term}
                    href={`https://twitter.com/search?q=${encodeURIComponent(term)}&src=typed_query&f=live`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Badge variant="secondary" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                      {term} <ExternalLink className="h-3 w-3 ml-1" />
                    </Badge>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Curated List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No curated tweets yet. Add some URLs above!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {opportunities?.map((opp) => (
                <CuratedTweetCard 
                  key={opp.id} 
                  opportunity={opp}
                  onUpdateStatus={(status) => updateStatus.mutate({ id: opp.id, status })}
                  onDelete={() => deleteTweet.mutate(opp.id)}
                  onEngagement={(action) => handleEngagement(opp.id, action)}
                  getLikeUrl={getLikeUrl}
                  getRetweetUrl={getRetweetUrl}
                  getReplyUrl={getReplyUrl}
                  getFollowUrl={getFollowUrl}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No new engagement opportunities. Add tweets in the Curate tab!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {opportunities?.map((opp) => (
                <CuratedTweetCard 
                  key={opp.id} 
                  opportunity={opp}
                  onUpdateStatus={(status) => updateStatus.mutate({ id: opp.id, status })}
                  onDelete={() => deleteTweet.mutate(opp.id)}
                  onEngagement={(action) => handleEngagement(opp.id, action)}
                  getLikeUrl={getLikeUrl}
                  getRetweetUrl={getRetweetUrl}
                  getReplyUrl={getReplyUrl}
                  getFollowUrl={getFollowUrl}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No engagement opportunities found.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {opportunities?.map((opp) => (
                <CuratedTweetCard 
                  key={opp.id} 
                  opportunity={opp}
                  onUpdateStatus={(status) => updateStatus.mutate({ id: opp.id, status })}
                  onDelete={() => deleteTweet.mutate(opp.id)}
                  onEngagement={(action) => handleEngagement(opp.id, action)}
                  getLikeUrl={getLikeUrl}
                  getRetweetUrl={getRetweetUrl}
                  getReplyUrl={getReplyUrl}
                  getFollowUrl={getFollowUrl}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface CuratedTweetCardProps {
  opportunity: EngagementOpportunity;
  onUpdateStatus: (status: OpportunityStatus) => void;
  onDelete: () => void;
  onEngagement: (action: string) => void;
  getLikeUrl: (id: string) => string;
  getRetweetUrl: (id: string) => string;
  getReplyUrl: (id: string) => string;
  getFollowUrl: (username: string) => string;
}

function CuratedTweetCard({ 
  opportunity, 
  onUpdateStatus,
  onDelete,
  onEngagement,
  getLikeUrl,
  getRetweetUrl,
  getReplyUrl,
  getFollowUrl,
}: CuratedTweetCardProps) {
  const isEngaged = opportunity.status === 'engaged';
  
  return (
    <Card className={`${opportunity.status === 'new' ? 'border-orange-500/50' : ''} ${isEngaged ? 'opacity-60' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-4">
          {/* User Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                {opportunity.author_username && (
                  <a 
                    href={`https://x.com/${opportunity.author_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline truncate"
                  >
                    @{opportunity.author_username}
                  </a>
                )}
                <Badge variant={opportunity.status === 'new' ? 'default' : isEngaged ? 'secondary' : 'outline'}>
                  {opportunity.status}
                </Badge>
              </div>
              {opportunity.tweet_text && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {opportunity.tweet_text}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Added {formatDistanceToNow(new Date(opportunity.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {opportunity.tweet_id && (
              <>
                <a
                  href={getLikeUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('like')}
                >
                  <Button size="sm" variant="outline" className="gap-1">
                    <Heart className="h-4 w-4" />
                    <span className="hidden sm:inline">Like</span>
                  </Button>
                </a>
                <a
                  href={getRetweetUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('retweet')}
                >
                  <Button size="sm" variant="outline" className="gap-1">
                    <Repeat2 className="h-4 w-4" />
                    <span className="hidden sm:inline">RT</span>
                  </Button>
                </a>
                <a
                  href={getReplyUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('reply')}
                >
                  <Button size="sm" variant="outline" className="gap-1">
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Reply</span>
                  </Button>
                </a>
              </>
            )}
            
            {opportunity.author_username && (
              <a
                href={getFollowUrl(opportunity.author_username)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onEngagement('follow')}
              >
                <Button size="sm" variant="outline" className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Follow</span>
                </Button>
              </a>
            )}

            {opportunity.tweet_url && (
              <a
                href={opportunity.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="ghost">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
