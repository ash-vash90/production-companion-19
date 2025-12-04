import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind } from 'lucide-react';

interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      // Using Open-Meteo API (free, no API key required)
      // Putten, Netherlands coordinates: 52.26, 5.61
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=52.26&longitude=5.61&current=temperature_2m,weather_code&timezone=Europe/Amsterdam'
      );
      const data = await response.json();
      
      if (data.current) {
        const weatherCode = data.current.weather_code;
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          condition: getWeatherCondition(weatherCode),
          description: getWeatherDescription(weatherCode)
        });
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherCondition = (code: number): string => {
    if (code === 0) return 'clear';
    if (code >= 1 && code <= 3) return 'cloudy';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 95 && code <= 99) return 'thunderstorm';
    return 'cloudy';
  };

  const getWeatherDescription = (code: number): string => {
    if (code === 0) return 'Clear sky';
    if (code >= 1 && code <= 3) return 'Partly cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 56 && code <= 57) return 'Freezing drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Rain showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Cloudy';
  };

  const WeatherIcon = () => {
    if (!weather) return <Cloud className="h-5 w-5" />;
    
    switch (weather.condition) {
      case 'clear': return <Sun className="h-5 w-5 text-yellow-500" />;
      case 'rain': return <CloudRain className="h-5 w-5 text-blue-400" />;
      case 'snow': return <CloudSnow className="h-5 w-5 text-blue-200" />;
      case 'thunderstorm': return <CloudLightning className="h-5 w-5 text-yellow-400" />;
      case 'fog': return <Wind className="h-5 w-5 text-muted-foreground" />;
      default: return <Cloud className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Cloud className="h-4 w-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <WeatherIcon />
      <span className="font-medium">{weather.temperature}°C</span>
      <span className="text-muted-foreground hidden sm:inline">Putten</span>
    </div>
  );
}
