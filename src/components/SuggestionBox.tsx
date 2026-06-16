import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getSessionId } from "@/lib/sessionId";

interface FormProps {
  onDone?: () => void;
  compact?: boolean;
}

function SuggestionForm({ onDone, compact }: FormProps) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error("A few more words would help.");
      return;
    }
    if (trimmed.length > 1000) {
      toast.error("Please keep it under 1,000 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reader_suggestions").insert({
      message: trimmed,
      email: email.trim() || null,
      page_path: typeof window !== "undefined" ? window.location.pathname : null,
      session_id: getSessionId(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't send that — try again in a moment.");
      return;
    }
    setDone(true);
    setMessage("");
    setEmail("");
    toast.success("Thanks — we read every one.");
    setTimeout(() => onDone?.(), 1200);
  };

  if (done) {
    return (
      <div className="text-sm text-slate-700 py-2">
        Thanks — we read every one. Send another anytime.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What should we cover? What's missing? Anything you'd like more of?"
        rows={compact ? 3 : 4}
        maxLength={1000}
        required
        className="text-[15px]"
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional — only if you'd like a reply)"
        className="text-[14px]"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          Anonymous unless you add an email.
        </p>
        <Button type="submit" disabled={submitting} size="sm">
          {submitting ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}

export function SuggestionBoxModal({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tell us what you think</DialogTitle>
          <DialogDescription>
            Suggestions, gripes, story ideas — all welcome. Goes straight to the editor.
          </DialogDescription>
        </DialogHeader>
        <SuggestionForm onDone={() => setOpen(false)} compact />
      </DialogContent>
    </Dialog>
  );
}

export function SuggestionBoxCard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-stone-50 p-5 md:p-6">
      <div className="mb-3">
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500 mb-1">
          Reader mailbox
        </p>
        <h2 className="text-lg font-semibold text-slate-800" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          What should we cover next?
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          A new business worth a story? A topic you wish was here every morning? Send a note.
        </p>
      </div>
      <SuggestionForm />
    </section>
  );
}