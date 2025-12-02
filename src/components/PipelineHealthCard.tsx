import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/queryWithTimeout";
import { AlertCircle, Image, MessageSquare, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const PipelineHealthCard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pending Approval: safe stories awaiting manual review
  const { data: pendingApproval = 0 } = useQuery({
    queryKey: ["pipeline-pending-approval"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("content_queue")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("safety_level", "safe")
          .then(res => res),
        15000
      );
      return result.count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Needs Voice: stories missing platform content
  const { data: needsVoice = 0 } = useQuery({
    queryKey: ["pipeline-needs-voice"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("content_queue")
          .select("*", { count: "exact", head: true })
          .eq("safety_level", "safe")
          .is("content_lg_base", null)
          .then(res => res),
        15000
      );
      return result.count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Needs Images: stories missing visual assets
  const { data: needsImages = 0 } = useQuery({
    queryKey: ["pipeline-needs-images"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("content_queue")
          .select("*", { count: "exact", head: true })
          .eq("safety_level", "safe")
          .is("image_url", null)
          .then(res => res),
        15000
      );
      return result.count || 0;
    },
    retry: 2,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Needs Verticals: stories missing classification
  const { data: needsVerticals = 0 } = useQuery({
    queryKey: ["pipeline-needs-verticals"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("content_queue")
          .select("metadata")
          .eq("safety_level", "safe")
          .then(res => res),
        15000
      );
      
      const withoutVerticals = result.data?.filter(
        (row) => !row.metadata || !(row.metadata as any).verticals
      ).length || 0;
      
      return withoutVerticals;
    },
    retry: 2,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Backfill Verticals mutation
  const backfillVerticals = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-verticals");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Backfilled ${data.processed} stories with verticals`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-needs-verticals"] });
    },
    onError: (error) => {
      toast.error("Failed to backfill verticals: " + error.message);
    },
  });

  // Bulk Generate Images mutation
  const bulkGenerateImages = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("bulk-generate-images", {
        body: { limit: 20 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.generated} images (${data.errors} errors)`);
      queryClient.invalidateQueries({ queryKey: ["pipeline-needs-images"] });
    },
    onError: (error) => {
      toast.error("Failed to generate images: " + error.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Health</CardTitle>
        <CardDescription>
          Monitor content flow and unlock bottlenecks with quick actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending Approval */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium">Pending Approval</div>
              <div className="text-sm text-muted-foreground">Safe stories awaiting review</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {pendingApproval}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/dashboard/content-queue")}
            >
              Review
            </Button>
          </div>
        </div>

        {/* Needs Verticals */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium">Needs Verticals</div>
              <div className="text-sm text-muted-foreground">Stories missing classification</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {needsVerticals}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => backfillVerticals.mutate()}
              disabled={backfillVerticals.isPending || needsVerticals === 0}
            >
              {backfillVerticals.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Classifying...
                </>
              ) : (
                "Classify"
              )}
            </Button>
          </div>
        </div>

        {/* Needs Voice */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            <div>
              <div className="font-medium">Needs Voice</div>
              <div className="text-sm text-muted-foreground">Missing Lake Geneva voice variants</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {needsVoice}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/dashboard/content-queue")}
            >
              Generate
            </Button>
          </div>
        </div>

        {/* Needs Images */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Image className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium">Needs Images</div>
              <div className="text-sm text-muted-foreground">Stories missing visual assets</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-lg px-3 py-1">
              {needsImages}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkGenerateImages.mutate()}
              disabled={bulkGenerateImages.isPending || needsImages === 0}
            >
              {bulkGenerateImages.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
