export interface WeatherData {
  temperature: number;
  weatherCode: number;
  humidity: number;
  loading: boolean;
  error: string | null;
  locationName?: string;
}

// WMO Weather interpretation codes (WW)
export const getWeatherDescription = (code: number) => {
  if (code === 0) return { label: '맑음', icon: 'Sun' };
  if (code === 1 || code === 2 || code === 3) return { label: '구름 많음', icon: 'Cloud' };
  if (code === 45 || code === 48) return { label: '안개', icon: 'CloudFog' };
  if (code >= 51 && code <= 55) return { label: '이슬비', icon: 'CloudDrizzle' };
  if (code >= 61 && code <= 65) return { label: '비', icon: 'CloudRain' };
  if (code >= 71 && code <= 77) return { label: '눈', icon: 'Snowflake' };
  if (code >= 80 && code <= 82) return { label: '소나기', icon: 'CloudRainWind' };
  if (code >= 95) return { label: '뇌우', icon: 'CloudLightning' };
  return { label: '흐림', icon: 'Cloud' };
};

export const fetchLocalWeather = async (lat: number, lon: number): Promise<Partial<WeatherData>> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
    );
    const data = await response.json();
    
    return {
      temperature: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
      humidity: data.current.relative_humidity_2m,
      error: null
    };
  } catch (err) {
    console.error("Failed to fetch weather", err);
    return { error: "날씨 정보 수신 실패" };
  }
};