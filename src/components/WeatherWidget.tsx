import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, Snowflake, CloudLightning, CloudFog, CloudSun } from "lucide-react";

type WeatherData = {
  temp: number;
  wind: number;
  code: number;
  high: number;
  low: number;
};

const getWeatherIcon = (code: number) => {
  if (code === 0) return <Sun className="h-5 w-5 text-amber-500" />;
  if (code >= 1 && code <= 2) return <CloudSun className="h-5 w-5 text-amber-400" />;
  if (code === 3) return <Cloud className="h-5 w-5 text-muted-foreground" />;
  if (code >= 45 && code <= 48) return <CloudFog className="h-5 w-5 text-muted-foreground" />;
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return <CloudRain className="h-5 w-5 text-blue-500" />;
  if (code >= 71 && code <= 77) return <Snowflake className="h-5 w-5 text-sky-400" />;
  if (code >= 85 && code <= 86) return <Snowflake className="h-5 w-5 text-sky-400" />;
  if (code >= 95) return <CloudLightning className="h-5 w-5 text-violet-500" />;
  return <CloudSun className="h-5 w-5 text-amber-400" />;
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

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&current_weather=true&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago"
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
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!weather) return null;

  return (
    <div className="inline-flex items-center gap-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        {getWeatherIcon(weather.code)}
        <span className="text-2xl font-semibold text-foreground">
          {Math.round(weather.temp)}°
        </span>
      </div>
      <div className="h-6 w-px bg-border" />
      <div className="flex flex-col text-xs">
        <span className="text-muted-foreground">{getWeatherLabel(weather.code)}</span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-blue-600 font-medium">L: {Math.round(weather.low)}°</span>
          <span className="text-orange-600 font-medium">H: {Math.round(weather.high)}°</span>
        </div>
      </div>
    </div>
  );
}
