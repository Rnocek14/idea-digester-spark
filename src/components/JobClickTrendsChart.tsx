import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface JobClickTrendsChartProps {
  jobIds: string[];
  jobTitles: Record<string, string>;
}

interface ClickData {
  job_id: string;
  clicked_at: string;
}

const COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(142, 71%, 45%)", // green  
  "hsl(262, 83%, 58%)", // purple
  "hsl(25, 95%, 53%)",  // orange
  "hsl(339, 90%, 51%)", // pink
];

type DateRange = "7" | "14" | "30";

export default function JobClickTrendsChart({ jobIds, jobTitles }: JobClickTrendsChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>("14");
  const days = parseInt(dateRange);

  // Fetch click data for the selected date range
  const { data: clicks, isLoading } = useQuery({
    queryKey: ["job-click-trends", jobIds, dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), days).toISOString();
      
      const { data, error } = await supabase
        .from("job_clicks")
        .select("job_id, clicked_at")
        .in("job_id", jobIds)
        .gte("clicked_at", startDate)
        .order("clicked_at", { ascending: true });

      if (error) throw error;
      return data as ClickData[];
    },
    enabled: jobIds.length > 0,
  });

  // Process data into chart format
  const chartData = useMemo(() => {
    if (!clicks || clicks.length === 0) return [];

    const today = new Date();
    const startDate = subDays(today, days - 1);
    const intervalDays = eachDayOfInterval({ start: startDate, end: today });

    // Create a map for quick lookup: date -> jobId -> count
    const clicksByDay: Record<string, Record<string, number>> = {};
    
    intervalDays.forEach(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      clicksByDay[dateKey] = {};
      jobIds.forEach(id => {
        clicksByDay[dateKey][id] = 0;
      });
    });

    // Count clicks per day per job
    clicks.forEach(click => {
      const dateKey = format(parseISO(click.clicked_at), "yyyy-MM-dd");
      if (clicksByDay[dateKey] && clicksByDay[dateKey][click.job_id] !== undefined) {
        clicksByDay[dateKey][click.job_id]++;
      }
    });

    // Convert to array format for Recharts
    return intervalDays.map(day => {
      const dateKey = format(day, "yyyy-MM-dd");
      const entry: Record<string, string | number> = {
        date: format(day, "MMM d"),
        fullDate: dateKey,
      };
      
      jobIds.forEach(id => {
        entry[id] = clicksByDay[dateKey][id] || 0;
      });
      
      return entry;
    });
  }, [clicks, jobIds, days]);

  // Calculate total clicks for the period
  const totalClicks = clicks?.length || 0;

  if (jobIds.length === 0) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (totalClicks === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Click Trends
              </CardTitle>
              <CardDescription>Last {days} days</CardDescription>
            </div>
            <ToggleGroup type="single" value={dateRange} onValueChange={(v) => v && setDateRange(v as DateRange)} size="sm">
              <ToggleGroupItem value="7" className="text-xs px-3">7d</ToggleGroupItem>
              <ToggleGroupItem value="14" className="text-xs px-3">14d</ToggleGroupItem>
              <ToggleGroupItem value="30" className="text-xs px-3">30d</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No click data yet. Clicks will appear here as they happen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Click Trends
            </CardTitle>
            <CardDescription>
              {totalClicks} total clicks in the last {days} days
            </CardDescription>
          </div>
          <ToggleGroup type="single" value={dateRange} onValueChange={(v) => v && setDateRange(v as DateRange)} size="sm">
            <ToggleGroupItem value="7" className="text-xs px-3">7d</ToggleGroupItem>
            <ToggleGroupItem value="14" className="text-xs px-3">14d</ToggleGroupItem>
            <ToggleGroupItem value="30" className="text-xs px-3">30d</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
                interval={days > 14 ? 2 : 0}
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
              />
              {jobIds.length > 1 && (
                <Legend 
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  formatter={(value) => {
                    const title = jobTitles[value] || value;
                    return title.length > 20 ? title.slice(0, 20) + "…" : title;
                  }}
                />
              )}
              {jobIds.map((jobId, index) => (
                <Line
                  key={jobId}
                  type="monotone"
                  dataKey={jobId}
                  name={jobTitles[jobId] || jobId}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
