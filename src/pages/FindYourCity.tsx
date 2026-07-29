import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Mail, Navigation, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageMeta } from "@/components/PageMeta";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  nearestCity,
  lookupZip,
  isValidUsZip,
  kmToMiles,
  type CityPoint,
  type NearestResult,
} from "@/lib/cityDistance";

/**
 * The reader-side city resolver: "which brief is mine?"
 * Geolocation first (one tap), zip as the no-permission fallback. A match
 * links to that city's site; a miss becomes a waitlist signal — every
 * "we're not in your town yet" email+zip tells us which city to launch next.
 */
export default function FindYourCity() {
  const [geoActive, setGeoActive] = useState(false);
  const geo = useGeolocation(geoActive);
  const [zip, setZip] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [located, setLocated] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);

  const { data: cities = [] } = useQuery({
    queryKey: ["city-directory"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("city_config")
        .select("id, city_name, state_code, site_domain, status, latitude, longitude")
        .in("status", ["active", "bootstrapping"])
        .order("city_name");
      return (data ?? []) as CityPoint[];
    },
    staleTime: 60 * 60 * 1000,
  });

  const liveCities = useMemo(() => cities.filter((c) => c.status === "active"), [cities]);
  const comingSoon = useMemo(() => cities.filter((c) => c.status === "bootstrapping"), [cities]);

  const geoPoint =
    geo.status === "granted" ? { lat: geo.lat, lon: geo.lng, label: "your location" } : null;
  const point = geoPoint ?? located;
  const match: NearestResult = point ? nearestCity(liveCities, point.lat, point.lon) : null;
  const searched = point !== null;

  const handleZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUsZip(zip)) {
      toast({ title: "Please enter a 5-digit US zip code", variant: "destructive" });
      return;
    }
    setZipBusy(true);
    setGeoActive(false);
    const result = await lookupZip(zip);
    setZipBusy(false);
    if (!result) {
      toast({ title: "We couldn't find that zip code", variant: "destructive" });
      return;
    }
    setLocated({ lat: result.lat, lon: result.lon, label: result.label });
  };

  const joinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!point) return;
    const email = waitlistEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    const nearestAny = nearestCity(cities, point.lat, point.lon, 500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("city_waitlist").insert({
      email,
      zip: isValidUsZip(zip) ? zip.trim() : null,
      lat: point.lat,
      lon: point.lon,
      place_label: point.label,
      nearest_city_id: nearestAny?.city.id ?? null,
      distance_km: nearestAny?.distanceKm ?? null,
    });
    if (error && !error.message?.includes("duplicate")) {
      toast({ title: "Something went wrong — please try again", variant: "destructive" });
      return;
    }
    setWaitlistDone(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta
        title="Find your city's Brief"
        description="Local news, simplified — find the daily Brief for your town, or tell us where to launch next."
        path="/cities"
      />
      <PublicHeader />

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-10">
        <header className="text-center mb-8">
          <h1
            className="text-3xl font-bold text-foreground mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Find your city's Brief
          </h1>
          <p className="text-muted-foreground">
            The five-minute local newsletter — city hall, schools, events, and what's really going
            on in town. Which town is yours?
          </p>
        </header>

        {/* Locate: geolocation + zip */}
        <div className="rounded-lg border border-border bg-card p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => {
                setLocated(null);
                setGeoActive(true);
              }}
              disabled={geo.status === "requesting"}
              className="sm:flex-1"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {geo.status === "requesting" ? "Locating…" : "Use my location"}
            </Button>
            <div className="flex items-center text-xs text-muted-foreground justify-center">or</div>
            <form onSubmit={handleZip} className="flex gap-2 sm:flex-1">
              <Input
                inputMode="numeric"
                placeholder="Zip code"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={5}
              />
              <Button type="submit" variant="secondary" disabled={zipBusy}>
                {zipBusy ? "…" : "Go"}
              </Button>
            </form>
          </div>
          {(geo.status === "denied" || geo.status === "unavailable" || geo.status === "error") && (
            <p className="text-xs text-muted-foreground mt-3">
              {"error" in geo ? geo.error : ""} Try the zip code instead.
            </p>
          )}
        </div>

        {/* Result */}
        {searched && match && (
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-6 mb-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h2 className="text-xl font-semibold text-foreground mb-1">
              You're near {match.city.city_name} —{" "}
              {Math.round(kmToMiles(match.distanceKm))} miles out
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              The {match.city.city_name} Brief covers your area.
            </p>
            <Button asChild>
              <a href={`https://${match.city.site_domain}`}>
                Read the {match.city.city_name} Brief →
              </a>
            </Button>
          </div>
        )}

        {searched && !match && (
          <div className="rounded-lg border border-border bg-card p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              We're not in your town yet
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              We're launching city by city. Leave your email and we'll tell you the day your
              town's Brief goes live — and your signup helps us decide where to go next.
            </p>
            {waitlistDone ? (
              <p className="text-sm font-medium text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> You're on the list — we'll email you when we
                arrive.
              </p>
            ) : (
              <form onSubmit={joinWaitlist} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">
                  <Mail className="h-4 w-4 mr-2" /> Notify me
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Directory */}
        <section>
          <h2 className="text-sm font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
            Live now
          </h2>
          <ul className="space-y-2 mb-6">
            {liveCities.map((c) => (
              <li key={c.id}>
                {/*
                  rel="nofollow" is deliberate and load-bearing.

                  This is one codebase served on every city's domain, so /cities renders
                  a link to every live city FROM every live city. Followed, that is an
                  N-by-N reciprocal link graph between sites owned by one person — which
                  is a link scheme by Google's own definition, and the kind that is
                  genuinely hard to recover from. It has cost nothing so far only because
                  the page never rendered for crawlers.

                  Readers still need this directory, and it stays useful to them. It just
                  must not pass PageRank between our own domains.
                */}
                <a
                  href={`https://${c.site_domain}`}
                  rel="nofollow"
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {c.city_name}, {c.state_code}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.site_domain}</span>
                </a>
              </li>
            ))}
          </ul>
          {comingSoon.length > 0 && (
            <>
              <h2 className="text-sm font-mono uppercase tracking-[0.18em] text-slate-500 mb-3">
                Coming soon
              </h2>
              <ul className="space-y-2">
                {comingSoon.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-muted-foreground"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>
                      {c.city_name}, {c.state_code}
                    </span>
                    <span className="ml-auto text-xs">in the works</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
