import { useEffect, useMemo, useState } from "react";
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

type Entry = {
  id: string;
  day_of_year: number;
  event_year: number | null;
  event_date: string | null;
  title: string;
  body: string;
  source_citation: string | null;
  source_url: string | null;
  image_url: string | null;
  status: string;
  history_type: string | null;
  tags: string[] | null;
  publish_count: number;
  last_published_at: string | null;
  created_at: string;
};

const TYPES = ["mansion","lake","business","boat","event","civic","person","landmark","tradition"];
// Must match the DB constraint exactly:
// history_entries.status CHECK (status IN ('draft','approved','retired')).
// This page previously used 'published', which the constraint rejects — every save
// failed, and HistoryTodayBlock queries 'approved', so nothing could ever go live.
const STATUSES = ["draft", "approved", "retired"] as const;

function dayOfYear(d: Date) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86_400_000);
}

export default function HistoryEntries() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // form
  const [eventDate, setEventDate] = useState<string>("");
  const [eventYear, setEventYear] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [historyType, setHistoryType] = useState<string>("event");
  const [sourceCitation, setSourceCitation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("draft");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("history_entries")
      .select("*")
      .order("day_of_year", { ascending: true })
      .limit(1000);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows((data as Entry[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterType !== "all" && (r.history_type || "") !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (q && !(`${r.title} ${r.body} ${r.source_citation ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, filterType, filterStatus, search]);

  function resetForm() {
    setEventDate(""); setEventYear(""); setTitle(""); setBody("");
    setHistoryType("event"); setSourceCitation(""); setSourceUrl("");
    setImageUrl(""); setTags(""); setStatus("draft");
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Missing fields", description: "Title and body are required.", variant: "destructive" });
      return;
    }
    if (!eventDate) {
      toast({ title: "Missing date", description: "Pick the event date (month + day used for day-of-year).", variant: "destructive" });
      return;
    }
    const d = new Date(`${eventDate}T12:00:00Z`);
    if (isNaN(d.getTime())) {
      toast({ title: "Bad date", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: title.trim(),
      body: body.trim(),
      day_of_year: dayOfYear(d),
      event_date: eventDate,
      event_year: eventYear ? parseInt(eventYear, 10) : null,
      history_type: historyType,
      source_citation: sourceCitation.trim() || null,
      source_url: sourceUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      tags: tagArr.length ? tagArr : null,
      status,
      created_by: user.id,
    };
    const { error } = await supabase.from("history_entries").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    resetForm();
    load();
  }

  async function updateField(id: string, patch: Partial<Entry>) {
    const { error } = await supabase.from("history_entries").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("history_entries").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else load();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Today in Lake Geneva History</h1>
        <p className="text-sm text-slate-600 mt-1">
          Evergreen history entries. The homepage shows one per day based on event date. Every entry must have a real citation — never invent.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">New entry</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Event date (MM-DD used for daily rotation)</Label>
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label>Event year (optional)</Label>
            <Input value={eventYear} onChange={(e) => setEventYear(e.target.value)} placeholder="e.g. 1873" maxLength={4} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={historyType} onValueChange={setHistoryType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Source citation</Label>
            <Input value={sourceCitation} onChange={(e) => setSourceCitation(e.target.value)} placeholder="e.g. Lake Geneva Historical Society" maxLength={300} />
          </div>
          <div>
            <Label>Source URL (optional)</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={500} />
          </div>
          <div>
            <Label>Image URL (optional)</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} maxLength={500} />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="streblow, lake, summer" maxLength={300} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={resetForm}>Clear</Button>
          <Button onClick={submit}>Save entry</Button>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Library {loading ? "" : `(${filtered.length})`}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search title / body"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-slate-500">No entries match.</p>
        )}

        {filtered.map((r) => (
          <Card key={r.id} className="p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">day {r.day_of_year}</Badge>
                {r.event_date && (
                  <Badge variant="outline">{r.event_date}{r.event_year ? ` · ${r.event_year}` : ""}</Badge>
                )}
                {r.history_type && <Badge variant="outline">{r.history_type}</Badge>}
                <Badge variant={r.status === "approved" ? "default" : "outline"}>{r.status}</Badge>
                {r.publish_count > 0 && <span className="text-xs text-slate-500">shown {r.publish_count}×</span>}
              </div>
              <div className="flex gap-2">
                {r.status !== "approved" && (
                  <Button size="sm" variant="outline" onClick={() => updateField(r.id, { status: "approved" })}>Publish</Button>
                )}
                {r.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => updateField(r.id, { status: "draft" })}>Unpublish</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
              </div>
            </div>
            <div className="text-[15px] font-medium text-slate-900">{r.title}</div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</div>
            {r.source_citation && (
              <div className="text-xs text-slate-500">
                Source: {r.source_citation}
                {r.source_url && <> · <a href={r.source_url} target="_blank" rel="noreferrer" className="underline">link</a></>}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}