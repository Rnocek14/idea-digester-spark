import { useEffect, useState } from "react";
import {
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudFog,
  CloudSun,
  Sunrise,
  Sunset,
} from "lucide-react";
import { format, addDays } from "date-fns";

type WeatherData = {
  temp: number;
  wind: number;
  code: number;
  high: number;
  low: number;
  sunrise: string;
  sunset: string;
};

type DayForecast = {
  date: Date;
  high: number;
  low: number;
  code: number;
  snowfall: number;
  precipitation: number;
};

const getWeatherIcon = (code: number, size: "sm" | "lg" | "xs" = "lg") => {
  const map: Record<string, string> = {
    lg: "h-10 w-10",
    sm: "h-5 w-5",
    xs: "h-4 w-4",
  };
  const className = map[size] || map.lg;

  if (code === 0) return <Sun className={`${className} text-amber-500`} />;
  if (code >= 1 && code <= 2) return <CloudSun className={`${className} text-amber-400`} />;
  if (code === 3) return <Cloud className={`${className} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={`${className} text-slate-400`} />;
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82))
    return <CloudRain className={`${className} text-blue-500`} />;
  if (code >= 71 && code <= 77) return <Snowflake className={`${className} text-sky-400`} />;
  if (code >= 85 && code <= 86) return <Snowflake className={`${className} text-sky-400`} />;
  if (code >= 95) return <CloudLightning className={`${className} text-violet-500`} />;
  return <CloudSun className={`${className} text-amber-400`} />;
};

const getWeatherLabel = (code: number) => {
  if (code === 0) return "Clear";
  if (code >= 1 && code <= 2) return "Partly Cloudy";
  if (code === 3) return "Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code >= 95) return "Thunderstorm";
  return "Fair";
};

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    });
  } catch {
    return "";
  }
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DayForecast[]>([]);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,weathercode,precipitation_sum,snowfall_sum&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FChicago&forecast_days=4"
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.current_weather && data?.daily) {
          setWeather({
            temp: data.current_weather.temperature,
            wind: data.current_weather.windspeed,
            code: data.current_weather.weathercode,
            high: data.daily.temperature_2m_max[0],
            low: data.daily.temperature_2m_min[0],
            sunrise: formatTime(data.daily.sunrise[0]),
            sunset: formatTime(data.daily.sunset[0]),
          });

          const days: DayForecast[] = [];
          for (let i = 1; i <= 3; i++) {
            days.push({
              date: addDays(new Date(), i),
              high: data.daily.temperature_2m_max[i],
              low: data.daily.temperature_2m_min[i],
              code: data.daily.weathercode[i],
              snowfall: data.daily.snowfall_sum[i] || 0,
              precipitation: data.daily.precipitation_sum[i] || 0,
            });
          }
          setForecast(days);
        }
      })
      .catch(() => {});
  }, []);

  if (!weather) return null;

  return (
    <div className="space-y-3">
      {/* Current conditions */}
      <div className="flex items-center gap-2.5 text-sm">
        {getWeatherIcon(weather.code, "sm")}
        <span className="font-mono font-semibold text-foreground tabular-nums">
          {Math.round(weather.temp)}°
        </span>
        <span className="text-foreground">{getWeatherLabel(weather.code)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          <span className="text-orange-700 font-semibold">H {Math.round(weather.high)}°</span>
          <span className="mx-1 opacity-50">/</span>
          <span className="text-blue-700 font-semibold">L {Math.round(weather.low)}°</span>
        </span>
      </div>

      {/* Daylight line */}
      {weather.sunrise && weather.sunset && (
        <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground tabular-nums">
          <span className="flex items-center gap-1">
            <Sunrise className="h-3 w-3 text-amber-500" />
            {weather.sunrise}
          </span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-1">
            <Sunset className="h-3 w-3 text-orange-400" />
            {weather.sunset}
          </span>
        </div>
      )}

      {/* 3-day forecast strip */}
      {forecast.length > 0 && (
        <div className="pt-2 border-t border-slate-200">
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
                  {getWeatherIcon(day.code, "xs")}
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-orange-700 font-semibold">{Math.round(day.high)}°</span>
                  <span className="text-blue-700">{Math.round(day.low)}°</span>
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
        </div>
      )}
    </div>
  );
}
