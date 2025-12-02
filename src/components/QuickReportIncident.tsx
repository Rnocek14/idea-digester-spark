import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

type IncidentType = "accident" | "fire" | "police" | "weather" | "utility" | "other";

const symptomOptions = [
  { key: "crash", label: "Crash / major traffic backup", type: "accident" as IncidentType },
  { key: "smoke", label: "Smoke or fire", type: "fire" as IncidentType },
  { key: "police", label: "Heavy police activity", type: "police" as IncidentType },
  { key: "weather", label: "Severe weather right now", type: "weather" as IncidentType },
  { key: "outage", label: "Power outage", type: "utility" as IncidentType },
  { key: "other", label: "Something else unusual", type: "other" as IncidentType },
];

const locationOptions = [
  "Hwy 50",
  "Downtown / Main St",
  "Near the lake",
  "Residential neighborhood",
  "Not sure / Other",
];

export default function QuickReportIncident() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [locationChoice, setLocationChoice] = useState<string>("Not sure / Other");
  const [locationNote, setLocationNote] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const queryClient = useQueryClient();

  const toggleSymptom = (key: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedSymptoms.length === 0) {
        throw new Error("Please select at least one option for what you're seeing.");
      }

      const primarySymptom = symptomOptions.find((s) =>
        selectedSymptoms.includes(s.key)
      )!;
      const incidentType = primarySymptom.type;

      const locationSummary =
        locationChoice === "Not sure / Other"
          ? (locationNote || locationChoice)
          : locationNote
          ? `${locationChoice} (${locationNote})`
          : locationChoice;

      const title = `Community report: ${primarySymptom.label.toLowerCase()}`;
      const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const { data: incident, error: incidentError } = await supabase
        .from("incidents")
        .insert({
          slug,
          title,
          incident_type: incidentType,
          status: "active",
          location: locationSummary || null,
          priority_score: 2,
        })
        .select("*")
        .single();

      if (incidentError || !incident) {
        console.error("[QuickReport] Error creating incident", incidentError);
        throw new Error("Could not create incident.");
      }

      const summaryLines: string[] = [];
      summaryLines.push(
        `Community quick report: ${selectedSymptoms
          .map((k) => symptomOptions.find((s) => s.key === k)?.label)
          .filter(Boolean)
          .join(", ")}`
      );

      if (locationSummary) {
        summaryLines.push(`📍 Location: ${locationSummary}`);
      }

      if (extraInfo.trim()) {
        summaryLines.push("");
        summaryLines.push(extraInfo.trim());
      }

      const text = summaryLines.join("\n");

      const { error: updateError } = await supabase.from("incident_updates").insert({
        incident_id: incident.id,
        source: "community",
        source_label: "Community quick report",
        text,
        is_verified: false,
      });

      if (updateError) {
        console.error("[QuickReport] Error creating update", updateError);
        throw new Error("Could not save incident update.");
      }

      return incident;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents-public"] });
      queryClient.invalidateQueries({ queryKey: ["incidents-sidebar"] });

      toast({
        title: "Quick report sent",
        description: "Thank you. This will be shown as an unconfirmed community report.",
      });

      setSelectedSymptoms([]);
      setLocationChoice("Not sure / Other");
      setLocationNote("");
      setExtraInfo("");
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send quick report",
        variant: "destructive",
      });
    },
  });

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="w-full text-xs mt-2"
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        See something? Quick report
      </Button>
    );
  }

  return (
    <div className="mt-3 border rounded-lg p-3 bg-muted/50">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs font-semibold">Quick incident report</div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-[11px] text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <div className="text-[11px] font-medium mb-1.5">What are you seeing? *</div>
          <div className="space-y-1.5">
            {symptomOptions.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-[11px]">
                <Checkbox
                  checked={selectedSymptoms.includes(opt.key)}
                  onCheckedChange={() => toggleSymptom(opt.key)}
                  className="h-3.5 w-3.5"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium mb-1.5">Where is it?</div>
          <Select value={locationChoice} onValueChange={setLocationChoice}>
            <SelectTrigger className="h-8 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((loc) => (
                <SelectItem key={loc} value={loc} className="text-[11px]">
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            placeholder="Nearby landmark / cross street (optional)"
            className="mt-1.5 h-8 text-[11px]"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
          />
        </div>

        <div>
          <div className="text-[11px] font-medium mb-1.5">
            Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
          </div>
          <Textarea
            rows={2}
            className="text-[11px] min-h-[50px]"
            value={extraInfo}
            onChange={(e) => setExtraInfo(e.target.value)}
            placeholder="Example: 'Lots of smoke near XYZ, traffic backing up both ways.'"
          />
        </div>

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-8 text-xs"
        >
          {mutation.isPending ? "Sending..." : "Send quick report"}
        </Button>

        <p className="text-[10px] text-muted-foreground">
          Reports are reviewed before being treated as confirmed. We never publish your contact
          info or name from this form.
        </p>
      </form>
    </div>
  );
}
