import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export const InlineSubscribeCTA = () => {
  const scrollToSubscribe = () => {
    const el = document.getElementById('subscribe');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="col-span-full my-4 p-5 rounded-xl bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-100">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">Stay in the loop</p>
            <p className="text-sm text-slate-500">Get Lake Geneva news in your inbox every week.</p>
          </div>
        </div>
        <Button 
          onClick={scrollToSubscribe}
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 shrink-0"
        >
          Subscribe Free
        </Button>
      </div>
    </div>
  );
};
