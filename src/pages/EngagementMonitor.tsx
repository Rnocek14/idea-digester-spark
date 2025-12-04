import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  AtSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type OpportunityType = 'mention' | 'reply' | 'hashtag' | 'follower';
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

export default function EngagementMonitor() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch opportunities
  const { data: opportunities, isLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['engagement-opportunities', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('engagement_opportunities')
        .select('*')
        .order('priority_score', { ascending: false })
        .order('tweet_created_at', { ascending: false })
        .limit(100);

      if (activeTab !== 'all') {
        if (activeTab === 'new') {
          query = query.eq('status', 'new');
        } else {
          query = query.eq('opportunity_type', activeTab);
        }
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

  // Refresh from X API
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('monitor-x-engagement');
      if (error) throw error;
      toast.success(`Found ${data.found} tweets, added ${data.inserted} new`);
      refetchOpportunities();
      queryClient.invalidateQueries({ queryKey: ['engagement-stats'] });
    } catch (error: any) {
      toast.error(`Refresh failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

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
            Discover local conversations on X · Click to engage natively
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Scan X
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Total Found</p>
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
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="new">
            New
            {stats?.new ? <Badge variant="secondary" className="ml-1">{stats.new}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="hashtag">Hashtags</TabsTrigger>
          <TabsTrigger value="mention">Mentions</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No engagement opportunities found. Click "Scan X" to search.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {opportunities?.map((opp) => (
                <OpportunityCard 
                  key={opp.id} 
                  opportunity={opp}
                  onUpdateStatus={(status) => updateStatus.mutate({ id: opp.id, status })}
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

interface OpportunityCardProps {
  opportunity: EngagementOpportunity;
  onUpdateStatus: (status: OpportunityStatus) => void;
  onEngagement: (action: string) => void;
  getLikeUrl: (id: string) => string;
  getRetweetUrl: (id: string) => string;
  getReplyUrl: (id: string) => string;
  getFollowUrl: (username: string) => string;
}

function OpportunityCard({ 
  opportunity, 
  onUpdateStatus, 
  onEngagement,
  getLikeUrl,
  getRetweetUrl,
  getReplyUrl,
  getFollowUrl,
}: OpportunityCardProps) {
  const metrics = opportunity.metadata?.public_metrics || {};
  
  return (
    <Card className={opportunity.status === 'new' ? 'border-orange-500/50' : ''}>
      <CardContent className="pt-4">
        <div className="flex gap-4">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold truncate">
                {opportunity.author_display_name || 'Unknown'}
              </span>
              {opportunity.author_username && (
                <span className="text-muted-foreground text-sm">
                  @{opportunity.author_username}
                </span>
              )}
              {opportunity.priority_score > 5 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {opportunity.priority_score}
                </Badge>
              )}
              <Badge variant={opportunity.status === 'new' ? 'default' : 'outline'}>
                {opportunity.status}
              </Badge>
            </div>

            {/* Tweet Text */}
            <p className="text-sm mb-2 line-clamp-3">{opportunity.tweet_text}</p>

            {/* Hashtags */}
            {opportunity.hashtags && opportunity.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {opportunity.hashtags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Metrics & Time */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {metrics.like_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Repeat2 className="h-3 w-3" /> {metrics.retweet_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {metrics.reply_count || 0}
              </span>
              {opportunity.tweet_created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(opportunity.tweet_created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {/* Deep Link Actions - Opens in X */}
            {opportunity.tweet_id && (
              <>
                <a
                  href={getLikeUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('like')}
                >
                  <Button size="sm" variant="outline" className="w-full">
                    <Heart className="h-4 w-4 mr-1" /> Like
                  </Button>
                </a>
                <a
                  href={getRetweetUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('retweet')}
                >
                  <Button size="sm" variant="outline" className="w-full">
                    <Repeat2 className="h-4 w-4 mr-1" /> RT
                  </Button>
                </a>
                <a
                  href={getReplyUrl(opportunity.tweet_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onEngagement('reply')}
                >
                  <Button size="sm" variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-1" /> Reply
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
                <Button size="sm" variant="outline" className="w-full">
                  <UserPlus className="h-4 w-4 mr-1" /> Follow
                </Button>
              </a>
            )}

            {/* View on X */}
            {opportunity.tweet_url && (
              <a
                href={opportunity.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="ghost" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-1" /> View
                </Button>
              </a>
            )}

            {/* Status Actions */}
            <div className="flex gap-1 mt-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-500"
                onClick={() => onUpdateStatus('engaged')}
                title="Mark engaged"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-500"
                onClick={() => onUpdateStatus('dismissed')}
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
