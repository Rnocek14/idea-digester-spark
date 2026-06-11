import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Story = {
  id: string;
  business_name: string;
  business_id: string | null;
  story_type: string;
  headline: string;
  raw_input: string;
  owner_quote: string | null;
  photo_url: string | null;
  source_citation: string | null;
  ai_draft: string | null;
  final_body: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

const STORY_TYPES = [
  { value: "new_on_menu", label: "New on the menu" },
  { value: "owner_spotlight", label: "Owner spotlight" },
  { value: "behind_the_business", label: "Behind the business" },
  { value: "seasonal_update", label: "Seasonal update" },
  { value: "history", label: "Business history" },
  { value: "event", label: "Event at this business" },
  { value: "reopening", label: "Reopening / launch" },
];

export default function BusinessStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // intake form state
  const [businessId, setBusinessId] = useState<string>("");
  const [businessName, setBusinessName] = useState("");
  const [storyType, setStoryType] = useState("new_on_menu");
  const [headline, setHeadline] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [ownerQuote, setOwnerQuote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [sourceCitation, setSourceCitation] = useState("");

  async function load() {
    const [{ data: rows }, { data: biz }] = await Promise.all([
      supabase.from("business_stories").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("business_profiles").select("id, name").order("name").limit(500),
    ]);
    setStories((rows as Story[]) || []);
    setBusinesses((biz as any[]) || []);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!businessName.trim() || !headline.trim() || !rawInput.trim()) {
      toast({ title: "Missing fields", description: "Business, headline, and the facts are required.", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to submit a business story.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("business_stories").insert({
      business_id: businessId || null,
      business_name: businessName.trim(),
      story_type: storyType,
      headline: headline.trim(),
      raw_input: rawInput.trim(),
      owner_quote: ownerQuote.trim() || null,
      photo_url: photoUrl.trim() || null,
      source_citation: sourceCitation.trim() || null,
      submitted_by: user.id,
      submitter_email: user.email,
      submitter_role: "editor",
      status: "pending",
    });
    if (error) {
      toast({ title: "Submit failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Submitted", description: "Story added to the queue." });
    setHeadline(""); setRawInput(""); setOwnerQuote(""); setPhotoUrl(""); setSourceCitation("");
    load();
  }

  async function generateDraft(id: string) {
    setBusyId(id);
    const { error } = await supabase.functions.invoke("generate-business-story", { body: { story_id: id } });
    setBusyId(null);
    if (error) {
      toast({ title: "Draft failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Draft ready" });
    load();
  }

  async function approveAndPublish(s: Story) {
    const body = s.final_body?.trim() || s.ai_draft?.trim();
    if (!body) {
      toast({ title: "No body", description: "Generate or write a draft first.", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("business_stories")
      .update({
        status: "published",
        final_body: body,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Published" });
    load();
  }

  async function reject(id: string) {
    await supabase.from("business_stories").update({ status: "rejected" }).eq("id", id);
    load();
  }

  async function updateField(id: string, patch: Partial<Story>) {
    await supabase.from("business_stories").update(patch).eq("id", id);
    load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Business Stories</h1>
        <p className="text-sm text-slate-600 mt-1">
          One real input per row. AI expands it into a draft — it never invents facts, quotes, prices, or outcomes.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">New story</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Business (existing)</Label>
            <Select value={businessId} onValueChange={(v) => {
              setBusinessId(v);
              const b = businesses.find((x) => x.id === v);
              if (b) setBusinessName(b.name);
            }}>
              <SelectTrigger><SelectValue placeholder="Pick a business (optional)" /></SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Business name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Oakfire Pizza" maxLength={200} />
          </div>
          <div>
            <Label>Story type</Label>
            <Select value={storyType} onValueChange={setStoryType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STORY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Headline (working title)</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} />
          </div>
        </div>

        <div>
          <Label>Facts (the real input — what actually happened)</Label>
          <Textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. Oakfire added a summer Detroit-style pepperoni pizza. Available Thu-Sun. $19. Owner Joe confirmed by phone 6/10."
            rows={4} maxLength={2000}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Owner quote (verbatim, optional)</Label>
            <Textarea value={ownerQuote} onChange={(e) => setOwnerQuote(e.target.value)} rows={3} maxLength={600} />
          </div>
          <div className="space-y-3">
            <div>
              <Label>Photo URL (optional)</Label>
              <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} maxLength={500} />
            </div>
            <div>
              <Label>Source citation</Label>
              <Input value={sourceCitation} onChange={(e) => setSourceCitation(e.target.value)} placeholder="e.g. Phone call with owner, 6/10/26" maxLength={300} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit}>Submit</Button>
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Queue</h2>
        {stories.length === 0 && <p className="text-sm text-slate-500">No stories yet.</p>}
        {stories.map((s) => (
          <Card key={s.id} className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{s.story_type.replace(/_/g, " ")}</Badge>
                <Badge variant={s.status === "published" ? "default" : "outline"}>{s.status}</Badge>
                <span className="text-sm font-semibold text-slate-800">{s.business_name}</span>
              </div>
              <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
            </div>

            <div className="text-[15px] font-medium text-slate-900">{s.headline}</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{s.raw_input}</div>
            {s.owner_quote && (
              <div className="text-sm text-slate-700 italic border-l-2 border-slate-300 pl-3">"{s.owner_quote}"</div>
            )}
            {s.source_citation && (
              <div className="text-xs text-slate-500">Source: {s.source_citation}</div>
            )}

            {s.ai_draft && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">AI draft</div>
                <Textarea
                  defaultValue={s.final_body ?? s.ai_draft}
                  rows={6}
                  onBlur={(e) => updateField(s.id, { final_body: e.target.value })}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busyId === s.id} onClick={() => generateDraft(s.id)}>
                {busyId === s.id ? "Drafting…" : s.ai_draft ? "Regenerate draft" : "Generate AI draft"}
              </Button>
              {s.status !== "published" && (
                <Button size="sm" onClick={() => approveAndPublish(s)}>Approve & publish</Button>
              )}
              {s.status !== "rejected" && s.status !== "published" && (
                <Button size="sm" variant="ghost" onClick={() => reject(s.id)}>Reject</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}