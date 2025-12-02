import { useEffect, useState } from "react";

type WeatherData = {
  temp: number;
  wind: number;
  code: number;
};

const weatherIcons: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌧️",
  53: "🌧️",
  55: "🌧️",
  61: "🌦️",
  63: "🌧️",
  65: "🌧️",
  71: "❄️",
  80: "🌧️",
  95: "⛈️",
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&current_weather=true"
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            wind: data.current_weather.windspeed,
            code: data.current_weather.weathercode,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!weather) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
      <span>{weatherIcons[weather.code] || "🌤️"}</span>
      <span>{Math.round(weather.temp)}°F</span>
      <span className="text-slate-400">•</span>
      <span>Wind {Math.round(weather.wind)} mph</span>
    </div>
  );
}
