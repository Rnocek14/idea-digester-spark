import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image as ImageIcon, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  storyId: string;
  title: string;
  category: string;
  imageUrl: string | null;
  prompt?: string;
  error?: string;
  timestamp: Date;
}

const TEST_SCENARIOS = [
  { id: "civic", label: "Civic / Government", description: "City Hall, municipal meetings, government announcements" },
  { id: "schools", label: "Schools", description: "School delays, events, educational news" },
  { id: "events", label: "Events", description: "Community events, festivals, gatherings" },
  { id: "dining", label: "Dining / Local Biz", description: "Restaurants, cafes, new business openings" },
  { id: "weather", label: "Weather / Incidents", description: "Weather advisories, travel alerts, incidents" },
  { id: "real-estate", label: "Real Estate", description: "Property listings, market updates" },
];

export default function ImageTest() {
  const [selectedStoryId, setSelectedStoryId] = useState<string>("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Fetch stories grouped by category
  const { data: stories, isLoading: loadingStories, error, refetch } = useQuery({
    queryKey: ['image-test-stories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_queue')
        .select('id, title, category, summary, image_url')
        .in('status', ['approved', 'auto_published', 'published', 'pending'])
        .eq('safety_level', 'safe')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // Group stories by category
  const storiesByCategory = stories?.reduce((acc, story) => {
    const cat = story.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(story);
    return acc;
  }, {} as Record<string, typeof stories>) || {};

  // Generate image mutation
  const generateMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-post-image', {
        body: { story_id: storyId, platform: 'instagram' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, storyId) => {
      const story = stories?.find(s => s.id === storyId);
      setTestResults(prev => [{
        storyId,
        title: story?.title || 'Unknown',
        category: story?.category || 'general',
        imageUrl: data.imageUrl,
        timestamp: new Date(),
      }, ...prev]);
      toast.success('Image generated successfully');
    },
    onError: (error: any, storyId) => {
      const story = stories?.find(s => s.id === storyId);
      setTestResults(prev => [{
        storyId,
        title: story?.title || 'Unknown',
        category: story?.category || 'general',
        imageUrl: null,
        error: error.message,
        timestamp: new Date(),
      }, ...prev]);
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!selectedStoryId) {
      toast.error('Please select a story');
      return;
    }
    generateMutation.mutate(selectedStoryId);
  };

  const handleQuickTest = (category: string) => {
    const categoryStories = storiesByCategory?.[category];
    if (!categoryStories?.length) {
      toast.error(`No stories found for category: ${category}`);
      return;
    }
    const randomStory = categoryStories[Math.floor(Math.random() * categoryStories.length)];
    generateMutation.mutate(randomStory.id);
  };

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Image Generation Test</h1>
          <p className="text-muted-foreground">Test AI image generation across different content categories</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">Failed to load stories: {(error as Error).message}</p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loadingStories) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Image Generation Test</h1>
          <p className="text-muted-foreground">Test AI image generation across different content categories</p>
        </div>
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading stories...</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Taking too long? Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Image Generation Test</h1>
        <p className="text-muted-foreground">Test AI image generation across different content categories</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Generate Test Image
            </CardTitle>
            <CardDescription>
              Select a story to generate an image and review the output quality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Story</label>
              <Select value={selectedStoryId} onValueChange={setSelectedStoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a story to test..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(storiesByCategory).map(([category, catStories]) => (
                    <div key={category}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase bg-muted/50">
                        {category} ({catStories?.length})
                      </div>
                      {catStories?.slice(0, 5).map((story) => (
                        <SelectItem key={story.id} value={story.id}>
                          <span className="truncate max-w-[300px] block">
                            {story.title}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={!selectedStoryId || generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating (~25s)...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Category Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Category Tests</CardTitle>
            <CardDescription>
              One-click test for each category type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {TEST_SCENARIOS.map((scenario) => {
                const count = storiesByCategory?.[scenario.id]?.length || 0;
                return (
                  <Button
                    key={scenario.id}
                    variant="outline"
                    className="justify-between h-auto py-3"
                    disabled={count === 0 || generateMutation.isPending}
                    onClick={() => handleQuickTest(scenario.id)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{scenario.label}</div>
                      <div className="text-xs text-muted-foreground">{scenario.description}</div>
                    </div>
                    <Badge variant={count > 0 ? "secondary" : "outline"}>
                      {count} stories
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Results ({testResults.length})</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTestResults([])}
              >
                Clear
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testResults.map((result, idx) => (
                <Card key={idx} className={result.error ? "border-destructive" : "border-green-500/50"}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="mb-1">{result.category}</Badge>
                        <h4 className="font-medium text-sm truncate">{result.title}</h4>
                      </div>
                      {result.error ? (
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      )}
                    </div>
                    
                    {result.imageUrl ? (
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={result.imageUrl} 
                          alt={result.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : result.error ? (
                      <div className="aspect-square rounded-lg bg-destructive/10 flex items-center justify-center p-4">
                        <p className="text-xs text-destructive text-center">{result.error}</p>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{result.timestamp.toLocaleTimeString()}</span>
                      {result.imageUrl && (
                        <a 
                          href={result.imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          View Full
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
