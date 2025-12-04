import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import lakeGenevaHero from "@/assets/lake-geneva-hero.jpg";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Home, 
  TrendingUp, 
  Star, 
  CheckCircle, 
  Phone, 
  Mail,
  BarChart3,
  Users,
  Clock,
  Award
} from "lucide-react";
import { toast } from "sonner";

const formatPrice = (price: number) => {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  return `$${Math.round(price / 1000)}K`;
};

const formatDate = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const SellingLakeGeneva = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Gina's business profile
  const { data: sponsor } = useQuery({
    queryKey: ["gina-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("category", "real-estate")
        .eq("status", "active")
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch real estate metrics
  const { data: metrics } = useQuery({
    queryKey: ['real-estate-metrics', '53147'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('real_estate_metrics')
        .select('*')
        .eq('zip_code', '53147')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Please fill in your name and email");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("advertiser_leads")
        .insert({
          contact_name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          business_name: formData.address || "Home Valuation Request",
          notes: null,
          source: "selling_page",
          business_profile_id: sponsor?.id || null,
        });

      if (error) throw error;

      // Notify via edge function
      await supabase.functions.invoke('notify-on-lead', {
        body: {
          leadId: null,
          businessName: formData.address || "Home Valuation Request",
          contactName: formData.name,
          email: formData.email,
          phone: formData.phone,
        }
      });

      toast.success("Request submitted!", {
        description: "Gina will reach out within 24 hours with your free home valuation.",
      });
      setFormData({ name: "", email: "", phone: "", address: "" });
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const testimonials = [
    {
      quote: "Gina sold our lakefront home in just 8 days — above asking price. Her Chicago connections brought in serious buyers immediately.",
      attribution: "The Hendersons, Lake Geneva",
    },
    {
      quote: "We interviewed three agents. Gina was the only one who understood how to position our property for out-of-state buyers.",
      attribution: "Mark & Susan P.",
    },
    {
      quote: "Professional, responsive, and genuinely cared about getting us the best outcome. Would recommend to anyone selling in the area.",
      attribution: "Recent Seller",
    },
  ];

  return (
    <PageShell>
      {/* Hero with Background */}
      <section 
        className="relative py-12 lg:py-16 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8"
        style={{
          backgroundImage: `url(${lakeGenevaHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/80" />
        
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-semibold mb-4">
              <Home className="w-3.5 h-3.5" />
              Lake Geneva Real Estate
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              What's Your Lake Geneva<br />
              <span className="text-blue-300">Home Worth?</span>
            </h1>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-4">
              Get a free, no-obligation home valuation from Lake Geneva's top-rated listing agent.
            </p>
            
            {/* Mobile Phone CTA */}
            <a 
              href="tel:+12627452360" 
              className="inline-flex items-center gap-2 text-blue-300 font-medium hover:text-blue-200 lg:hidden"
            >
              <Phone className="w-4 h-4" />
              Call Gina: (262) 745-2360
            </a>
          </div>

          {/* Credibility Stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 py-4 px-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-300" />
              <span className="text-sm font-medium text-white">15+ Years Experience</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium text-white">Top Lake Geneva Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-medium text-white">72 Five-Star Reviews</span>
            </div>
          </div>

          {/* Two Column: Form + Agent Info */}
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Valuation Form */}
            <Card className="p-6 lg:p-8 shadow-lg border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-1">
                Get Your Free Home Valuation
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Response within 24 hours · No commitment required
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    placeholder="Your Name *"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="h-12"
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="Email Address *"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-12"
                  />
                </div>
                <div>
                  <Input
                    type="tel"
                    placeholder="Phone Number (optional)"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-12"
                  />
                </div>
                <div>
                  <Input
                    placeholder="Property Address (e.g., 123 Lakeshore Dr)"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="h-12"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-12 text-base"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "What's My Home Worth?"}
                </Button>
              </form>
            </Card>

            {/* Agent Info */}
            <div className="space-y-6">
              {/* Agent Card */}
              <Card className="p-6 bg-gradient-to-br from-slate-50 to-white">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0">
                    {sponsor?.logo_url ? (
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {sponsor?.name || "Gina Nocek"}
                    </h3>
                    <p className="text-sm text-blue-600 font-medium">
                      Top Lake Geneva Listing Agent
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      @properties Lake Geneva
                    </p>
                    
                    {/* Zillow Rating */}
                    {sponsor?.zillow_rating && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(sponsor.zillow_rating || 0)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {sponsor.zillow_rating.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({sponsor.zillow_review_count} reviews)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Buttons */}
                <div className="flex gap-3 mt-4">
                  {sponsor?.phone && (
                    <a href={`tel:${sponsor.phone.replace(/\D/g, '')}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Phone className="w-4 h-4 mr-1.5" />
                        Call Direct
                      </Button>
                    </a>
                  )}
                  {sponsor?.email && (
                    <a href={`mailto:${sponsor.email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Mail className="w-4 h-4 mr-1.5" />
                        Email
                      </Button>
                    </a>
                  )}
                </div>
              </Card>

              {/* Why Sellers Choose Section */}
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-600" />
                  Why Sellers Choose Gina
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Multiple offers in days, not weeks</p>
                      <p className="text-xs text-slate-500">Homes sell 2× faster than market average</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Chicago buyer network</p>
                      <p className="text-xs text-slate-500">Access to motivated buyers from Chicago's North Shore</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Full-service listing preparation</p>
                      <p className="text-xs text-slate-500">Staging, professional photography, and targeted marketing</p>
                    </div>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of page content */}
      <div className="max-w-5xl mx-auto">

        {/* Market Snapshot */}
        {metrics && (
          <section className="py-8 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">Lake Geneva Market Snapshot</h2>
              <span className="text-xs text-slate-500 ml-auto">
                Updated {formatDate(metrics.fetched_at)} · Zillow ZHVI
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{formatPrice(metrics.median_price)}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Median Home Value</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-1">
                  <TrendingUp className="w-5 h-5" />
                  +{metrics.yoy_change}%
                </div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Year-over-Year</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{metrics.active_listings}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Active Listings</div>
              </Card>
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{formatPrice(metrics.median_list_price || 0)}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">Median List Price</div>
              </Card>
            </div>
          </section>
        )}

        {/* Testimonials */}
        <section className="py-8 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">What Sellers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-center gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-sm text-slate-600 italic leading-relaxed">
                  "{testimonial.quote}"
                </blockquote>
                <footer className="mt-3 text-xs font-medium text-slate-500">
                  — {testimonial.attribution}
                </footer>
              </Card>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-12 border-t border-slate-200 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Ready to Find Out What Your Home is Worth?
          </h2>
          <p className="text-slate-600 mb-6">
            Get a free, no-obligation market analysis from Lake Geneva's top-rated agent.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Home className="w-4 h-4 mr-2" />
            What's My Home Worth?
          </Button>
        </section>
      </div>
    </PageShell>
  );
};

export default SellingLakeGeneva;
