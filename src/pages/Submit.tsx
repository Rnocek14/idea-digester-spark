import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Heart, CalendarPlus, Mail } from "lucide-react";

type Kind = "event" | "local_love" | "tip";

async function submit(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("submit-community", {
    body: payload,
  });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

function SharedFields({
  values,
  set,
}: {
  values: Record<string, string>;
  set: (k: string, v: string) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 pt-2">
      <div>
        <Label htmlFor="submitter_name" className="text-xs">Your name (optional)</Label>
        <Input
          id="submitter_name"
          value={values.submitter_name || ""}
          onChange={(e) => set("submitter_name", e.target.value)}
          placeholder="So we can credit you"
        />
      </div>
      <div>
        <Label htmlFor="submitter_email" className="text-xs">Email (optional)</Label>
        <Input
          id="submitter_email"
          type="email"
          value={values.submitter_email || ""}
          onChange={(e) => set("submitter_email", e.target.value)}
          placeholder="If we have questions"
        />
      </div>
    </div>
  );
}

function HoneyPot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      name="company_website"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="hidden"
      aria-hidden="true"
    />
  );
}

function EventForm() {
  const [v, setV] = useState<Record<string, string>>({ category: "community" });
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.title || !v.summary || !v.event_date) {
      toast.error("Title, description, and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        kind: "event",
        honeypot: hp,
        title: v.title,
        summary: v.summary,
        event_date: v.event_date,
        event_time: v.event_time || undefined,
        venue: v.venue || undefined,
        original_url: v.original_url || undefined,
        category: v.category || "community",
        submitter_name: v.submitter_name || undefined,
        submitter_email: v.submitter_email || undefined,
      });
      toast.success("Event submitted. We'll review it soon.");
      setV({ category: "community" });
    } catch (err: any) {
      toast.error(err?.message || "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <HoneyPot value={hp} onChange={setHp} />
      <div>
        <Label htmlFor="title">Event name</Label>
        <Input id="title" value={v.title || ""} onChange={(e) => set("title", e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="summary">What is it? (1–3 sentences)</Label>
        <Textarea id="summary" rows={3} value={v.summary || ""} onChange={(e) => set("summary", e.target.value)} required />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="event_date">Date</Label>
          <Input id="event_date" type="date" value={v.event_date || ""} onChange={(e) => set("event_date", e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="event_time">Time (optional)</Label>
          <Input id="event_time" type="time" value={v.event_time || ""} onChange={(e) => set("event_time", e.target.value)} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" value={v.venue || ""} onChange={(e) => set("venue", e.target.value)} placeholder="Where in Lake Geneva" />
        </div>
        <div>
          <Label htmlFor="original_url">Link (optional)</Label>
          <Input id="original_url" type="url" value={v.original_url || ""} onChange={(e) => set("original_url", e.target.value)} placeholder="https://" />
        </div>
      </div>
      <SharedFields values={v} set={set} />
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Submitting…" : "Submit event"}
      </Button>
    </form>
  );
}

function LocalLoveForm({
  initialSubject,
  initialBodyPrefix,
}: { initialSubject?: string; initialBodyPrefix?: string } = {}) {
  const [v, setV] = useState<Record<string, string>>({
    category: "places",
    subject_name: initialSubject || "",
    body: initialBodyPrefix || "",
  });
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.body || v.body.length < 4) {
      toast.error("Tell us a little more.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        kind: "local_love",
        honeypot: hp,
        category: v.category as "people" | "places" | "moments",
        body: v.body,
        subject_name: v.subject_name || undefined,
        submitter_name: v.submitter_name || undefined,
        submitter_email: v.submitter_email || undefined,
        submitter_town: v.submitter_town || undefined,
      });
      toast.success("Thanks — we'll review and post it on the Local Love wall.");
      setV({ category: "people" });
    } catch (err: any) {
      toast.error(err?.message || "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const len = (v.body || "").length;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <HoneyPot value={hp} onChange={setHp} />
      <div>
        <Label className="text-xs">What kind of love?</Label>
        <div className="flex gap-2 mt-1">
          {(["people", "places", "moments"] as const).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => set("category", c)}
              className={`px-3 py-1.5 rounded-full text-sm border capitalize ${
                v.category === c
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="subject_name">Who or what are you celebrating?</Label>
        <Input id="subject_name" value={v.subject_name || ""} onChange={(e) => set("subject_name", e.target.value)} placeholder="A person, business, or moment" />
      </div>
      <div>
        <Label htmlFor="body">In 280 characters or less</Label>
        <Textarea id="body" rows={4} maxLength={280} value={v.body || ""} onChange={(e) => set("body", e.target.value)} required />
        <p className="text-[11px] text-slate-500 mt-1">{len}/280</p>
      </div>
      <div>
        <Label htmlFor="submitter_town" className="text-xs">Your town (optional)</Label>
        <Input id="submitter_town" value={v.submitter_town || ""} onChange={(e) => set("submitter_town", e.target.value)} placeholder="Lake Geneva, Fontana, etc." />
      </div>
      <SharedFields values={v} set={set} />
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700">
        {submitting ? "Submitting…" : "Send some love"}
      </Button>
    </form>
  );
}

function TipForm() {
  const [v, setV] = useState<Record<string, string>>({});
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.body || v.body.length < 4) {
      toast.error("Tell us a little more.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        kind: "tip",
        honeypot: hp,
        body: v.body,
        submitter_name: v.submitter_name || undefined,
        submitter_email: v.submitter_email || undefined,
      });
      toast.success("Got it. Thanks for the tip.");
      setV({});
    } catch (err: any) {
      toast.error(err?.message || "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <HoneyPot value={hp} onChange={setHp} />
      <div>
        <Label htmlFor="tip-body">What should we look into?</Label>
        <Textarea
          id="tip-body"
          rows={5}
          value={v.body || ""}
          onChange={(e) => set("body", e.target.value)}
          placeholder="A story idea, a memory, a heads-up. Links welcome."
          required
        />
      </div>
      <SharedFields values={v} set={set} />
      <p className="text-xs text-slate-500">
        Tips stay private. If we use yours in a story, we'll reach out first.
      </p>
      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Sending…" : "Send tip"}
      </Button>
    </form>
  );
}

export default function Submit() {
  const [params] = useSearchParams();
  const initialKind = (params.get("kind") as Kind) || "event";
  const [tab, setTab] = useState<Kind>(
    initialKind === "local_love" || initialKind === "tip" || initialKind === "event"
      ? initialKind
      : "event",
  );
  const stopSlug = params.get("stop") || "";
  const stopName = params.get("stop_name") || "";
  const shorePathContext = stopName
    ? { subject: stopName, prefix: `Shore Path · ${stopName}: ` }
    : null;

  useEffect(() => {
    if (stopSlug && initialKind === "local_love") setTab("local_love");
  }, [stopSlug, initialKind]);

  return (
    <div className="min-h-screen bg-stone-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl text-slate-900 tracking-tight">Submit to the Brief</h1>
          <p className="text-slate-600 mt-2 text-sm leading-relaxed">
            Got an event the rest of Lake Geneva should know about? A neighbor to thank?
            A story we should chase down? This is the desk. We read everything.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="event" className="gap-2"><CalendarPlus className="h-4 w-4" />Event</TabsTrigger>
            <TabsTrigger value="local_love" className="gap-2"><Heart className="h-4 w-4" />Local Love</TabsTrigger>
            <TabsTrigger value="tip" className="gap-2"><Mail className="h-4 w-4" />Tip</TabsTrigger>
          </TabsList>
          <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6">
            {shorePathContext && tab === "local_love" && (
              <p className="text-xs text-slate-600 mb-3 italic">
                Sharing a memory from <strong>{shorePathContext.subject}</strong> on the Shore Path.
              </p>
            )}
            <TabsContent value="event"><EventForm /></TabsContent>
            <TabsContent value="local_love">
              <LocalLoveForm
                initialSubject={shorePathContext?.subject}
                initialBodyPrefix={shorePathContext?.prefix}
              />
            </TabsContent>
            <TabsContent value="tip"><TipForm /></TabsContent>
          </div>
        </Tabs>

        <p className="text-xs text-slate-500 mt-6 text-center">
          Submissions are reviewed by a human before anything is published.
        </p>
      </main>
    </div>
  );
}