import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, TrendingUp, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketAnalysisDialog } from "@/components/MarketAnalysisDialog";

interface RealEstateHeroStripProps {
  sponsorId?: string;
  sponsorEmail?: string;
}

export const RealEstateHeroStrip = ({ sponsorId, sponsorEmail }: RealEstateHeroStripProps) => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <section className="py-6">
      <div className="rounded-sm bg-gradient-to-r from-blue-50 via-white to-slate-50 border border-slate-200 p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Headline + Benefits */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Lake Geneva Real Estate
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-3">
              Thinking of Selling Your Home?
            </h2>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Multiple offers in days, not weeks</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Chicago buyer network for higher sale prices</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Full-service: staging, photos, marketing</span>
              </li>
            </ul>
          </div>

          {/* Right: CTA + Market Stats */}
          <div className="flex flex-col items-center lg:items-end gap-3">
            <Button 
              size="lg"
              className="w-full lg:w-auto text-sm font-semibold px-6"
              onClick={() => setShowDialog(true)}
            >
              <Home className="w-4 h-4 mr-2" />
              Get Your Free Home Valuation
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              <span>Lake Geneva home values up <strong className="text-green-600">+3.2%</strong> this year</span>
            </div>
            <Link 
              to="/selling-lake-geneva" 
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Learn more about selling in Lake Geneva →
            </Link>
          </div>
        </div>
      </div>

      <MarketAnalysisDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        sponsorName="Gina Nocek"
        sponsorId={sponsorId || ''}
        sponsorEmail={sponsorEmail}
      />
    </section>
  );
};

export default RealEstateHeroStrip;
