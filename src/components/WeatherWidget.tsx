import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudFog, CloudSun, Sunrise, Sunset } from "lucide-react";

type WeatherData = {
  temp: number;
  wind: number;
  code: number;
  high: number;
  low: number;
  sunrise: string;
  sunset: string;
};

const getWeatherIcon = (code: number, size: "sm" | "lg" = "lg") => {
  const className = size === "lg" ? "h-10 w-10" : "h-5 w-5";
  
  if (code === 0) return <Sun className={`${className} text-amber-500`} />;
  if (code >= 1 && code <= 2) return <CloudSun className={`${className} text-amber-400`} />;
  if (code === 3) return <Cloud className={`${className} text-slate-400`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={`${className} text-slate-400`} />;
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return <CloudRain className={`${className} text-blue-500`} />;
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

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&current_weather=true&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago"
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
        }
      })
      .catch(() => {});
  }, []);

  if (!weather) return null;

  return (
    <div className="space-y-1.5">
      {/* Masthead temp line: [icon] 68° Partly Cloudy · H 75° / L 55° */}
      <div className="flex items-center gap-2.5 text-sm">
        {getWeatherIcon(weather.code, "sm")}
        <span className="font-mono font-semibold text-foreground tabular-nums">
          {Math.round(weather.temp)}°
        </span>
        <span className="text-foreground">{getWeatherLabel(weather.code)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          <span className="text-orange-600 font-semibold">H {Math.round(weather.high)}°</span>
          <span className="mx-1 opacity-50">/</span>
          <span className="text-blue-600 font-semibold">L {Math.round(weather.low)}°</span>
        </span>
      </div>
      {/* Daylight line: sunrise · sunset */}
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
    </div>
  );
}
