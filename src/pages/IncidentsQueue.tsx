import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Check, X, Eye, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type QueueIncident = {
  id: string;
  title: string;
  body: string | null;
  original_body: string | null;
  ai_rewrite: string | null;
  location: string | null;
  source: string | null;
  source_type: string | null;
  status: string;
  tier: number | null;
  confidence_score: number | null;
  hold_reason: string | null;
  started_at: string;
  incident_type: string;
};

const TIER_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Auto-publish", color: "bg-green-100 text-green-800" },
  2: { label: "AI rewrite", color: "bg-blue-100 text-blue-800" },
  3: { label: "Hold for review", color: "bg-yellow-100 text-yellow-800" },
  4: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

function IncidentCard({ incident }: { incident: QueueIncident }) {
  const qc = useQueryClient();
  const [edited, setEdited] = useState(incident.body || incident.original_body || "");

  const publish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("incidents")
        .update({
          status: "active",
          body: edited,
          hold_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", incident.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Published to Right Now");
      qc.invalidateQueries({ queryKey: ["incidents-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (train: boolean) => {
      const { error } = await supabase
        .from("incidents")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", incident.id);
      if (error) throw error;
      if (train && incident.hold_reason) {
        const kw = window.prompt("Keyword to learn (future incidents matching will auto-reject):", "");
        if (kw && kw.trim()) {
          await supabase.from("incident_reject_rules").insert({
            keyword: kw.trim().toLowerCase(),
            reason: `trained from incident ${incident.id}`,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["incidents-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const developing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("incidents")
        .update({
          status: "developing",
          body: edited,
          hold_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", incident.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as developing");
      qc.invalidateQueries({ queryKey: ["incidents-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tier = incident.tier ?? 3;
  const tierBadge = TIER_LABEL[tier];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{incident.title}</CardTitle>
          <div className="flex flex-wrap gap-1 shrink-0">
            <Badge className={tierBadge.color}>T{tier} {tierBadge.label}</Badge>
            <Badge variant="outline">conf {incident.confidence_score ?? "?"}</Badge>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          <span>📡 {incident.source} ({incident.source_type})</span>
          {incident.location && <span>📍 {incident.location}</span>}
          <span>⏱ {new Date(incident.started_at).toLocaleString()}</span>
          {incident.hold_reason && (
            <span className="text-amber-700">⚠ {incident.hold_reason}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {incident.original_body && incident.ai_rewrite && (
          <div className="text-xs text-muted-foreground italic">
            <strong>Original:</strong> {incident.original_body}
          </div>
        )}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            {incident.ai_rewrite ? <Sparkles className="h-3 w-3" /> : null}
            Publish text (editable)
          </div>
          <Textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={3}
            className="text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => publish.mutate()} disabled={publish.isPending}>
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => developing.mutate()} disabled={developing.isPending}>
            <AlertCircle className="h-4 w-4" /> Developing
          </Button>
          <Button size="sm" variant="outline" onClick={() => reject.mutate(false)} disabled={reject.isPending}>
            <X className="h-4 w-4" /> Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reject.mutate(true)} disabled={reject.isPending}>
            <X className="h-4 w-4" /> Reject + train
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IncidentsQueue() {
  const [tab, setTab] = useState<"pending_review" | "developing" | "active" | "rejected">("pending_review");

  const { data, isLoading } = useQuery({
    queryKey: ["incidents-queue", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id,title,body,original_body,ai_rewrite,location,source,source_type,status,tier,confidence_score,hold_reason,started_at,incident_type")
        .eq("status", tab)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as QueueIncident[];
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Right Now — Moderation Queue</h1>
        <p className="text-sm text-muted-foreground">
          Tier 3 holds, AI rewrites, and developing stories. Tier 1 auto-publishes; Tier 4 auto-rejects.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending_review">
            Pending review <Eye className="ml-1 h-3 w-3" />
          </TabsTrigger>
          <TabsTrigger value="developing">Developing</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground italic">Nothing in this queue.</div>
          )}
          {data?.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}