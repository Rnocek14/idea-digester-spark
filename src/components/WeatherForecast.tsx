import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudFog, CloudSun } from "lucide-react";

type DayForecast = {
  date: Date;
  high: number;
  low: number;
  code: number;
  snowfall: number;
  precipitation: number;
};

const getWeatherIcon = (code: number, size = "h-4 w-4") => {
  if (code === 0) return <Sun className={`${size} text-amber-500`} />;
  if (code >= 1 && code <= 2) return <CloudSun className={`${size} text-amber-400`} />;
  if (code === 3) return <Cloud className={`${size} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={`${size} text-slate-400`} />;
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return <CloudRain className={`${size} text-blue-500`} />;
  if (code >= 71 && code <= 77) return <Snowflake className={`${size} text-sky-400`} />;
  if (code >= 85 && code <= 86) return <Snowflake className={`${size} text-sky-400`} />;
  if (code >= 95) return <CloudLightning className={`${size} text-violet-500`} />;
  return <CloudSun className={`${size} text-amber-400`} />;
};

export default function WeatherForecast() {
  const [forecast, setForecast] = useState<DayForecast[]>([]);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,snowfall_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=4"
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.daily) {
          const days: DayForecast[] = [];
          for (let i = 1; i <= 3; i++) {
            days.push({
              date: addDays(new Date(), i),
              high: data.daily.temperature_2m_max[i],
              low: data.daily.temperature_2m_min[i],
              code: data.daily.weathercode[i],
              snowfall: data.daily.snowfall_sum[i] || 0, // already in inches
              precipitation: data.daily.precipitation_sum[i] || 0,
            });
          }
          setForecast(days);
        }
      })
      .catch(() => {});
  }, []);

  if (forecast.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {forecast.map((day, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between bg-muted/50 rounded-md px-2.5 py-1.5 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground w-[28px]">
              {format(day.date, "EEE")}
            </span>
            {getWeatherIcon(day.code)}
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-orange-700 font-semibold">{Math.round(day.high)}°</span>
            <span className="text-blue-600">{Math.round(day.low)}°</span>
            {day.snowfall >= 0.5 && (
              <span className="text-sky-400 font-medium">❄️ {day.snowfall.toFixed(1)}"</span>
            )}
            {day.snowfall < 0.5 && day.precipitation >= 0.1 && (
              <span className="text-blue-700 font-medium">💧 {day.precipitation.toFixed(1)}"</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
