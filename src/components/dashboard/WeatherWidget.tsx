import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
  temperature: number;
  condition: string;
  description: string;
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchWeather = async () => {
      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        if (isMounted) setLoading(false);
      }, 5000);

      try {
        // Using Open-Meteo API (free, no API key required)
        // Putten, Netherlands coordinates: 52.26, 5.61
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=52.26&longitude=5.61&current=temperature_2m,weather_code&timezone=Europe/Amsterdam'
        );
        const data = await response.json();
        
        if (data.current && isMounted) {
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
        clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();
    return () => { isMounted = false; };
  }, []);

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

  const getWeatherStyles = () => {
    if (!weather) return { icon: Cloud, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    
    switch (weather.condition) {
      case 'clear': 
        return { icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'rain': 
        return { icon: CloudRain, color: 'text-blue-400', bg: 'bg-blue-400/10' };
      case 'snow': 
        return { icon: CloudSnow, color: 'text-blue-200', bg: 'bg-blue-200/10' };
      case 'thunderstorm': 
        return { icon: CloudLightning, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
      case 'fog': 
        return { icon: Droplets, color: 'text-slate-400', bg: 'bg-slate-400/10' };
      default: 
        return { icon: Cloud, color: 'text-muted-foreground', bg: 'bg-muted/50' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1.5 rounded-full bg-muted/30 animate-pulse">
        <Cloud className="h-4 w-4" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (!weather) return null;

  const { icon: WeatherIcon, color, bg } = getWeatherStyles();

  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-normal shrink-0",
      bg
    )}>
      <WeatherIcon className={cn("h-4 w-4", color)} />
      <span className="font-data text-sm font-semibold">{weather.temperature}°C</span>
      <span className="text-xs text-muted-foreground hidden sm:inline">Putten</span>
    </div>
  );
}
