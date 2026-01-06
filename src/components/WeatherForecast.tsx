import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";

type DayForecast = {
  date: Date;
  high: number;
  low: number;
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
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const weatherDescriptions: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Cloudy",
  45: "Foggy",
  48: "Icy Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Light Snow Showers",
  86: "Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
  99: "Severe Thunderstorm",
};

export default function WeatherForecast() {
  const [forecast, setForecast] = useState<DayForecast[]>([]);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.5917&longitude=-88.4334&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=4"
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.daily) {
          const days: DayForecast[] = [];
          // Skip today (index 0), get next 3 days
          for (let i = 1; i <= 3; i++) {
            days.push({
              date: addDays(new Date(), i),
              high: data.daily.temperature_2m_max[i],
              low: data.daily.temperature_2m_min[i],
              code: data.daily.weathercode[i],
            });
          }
          setForecast(days);
        }
      })
      .catch(() => {});
  }, []);

  if (forecast.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <span className="text-slate-500 font-medium">3-Day:</span>
      {forecast.map((day, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-slate-500">{format(day.date, "EEE")}</span>
          <span>{weatherIcons[day.code] || "🌤️"}</span>
          <span className="text-slate-700">
            {Math.round(day.low)}°-{Math.round(day.high)}°
          </span>
        </div>
      ))}
    </div>
  );
}
