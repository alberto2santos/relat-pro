import { localDateISO } from '@/utils/dates';

export interface WeatherReading {
  condition: string;
  temperature: number;
}

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
  };
}

const WEATHER_LABELS: Record<number, string> = {
  0: 'Ensolarado',
  1: 'Predominantemente ensolarado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina com gelo',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva intensa',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve intensa',
  80: 'Pancadas de chuva leves',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  95: 'Trovoada',
  96: 'Trovoada com granizo leve',
  99: 'Trovoada com granizo forte',
};

const cache = new Map<string, { reading: WeatherReading; cachedAt: number }>();
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

export async function fetchWeatherForDate(
  latitude: number,
  longitude: number,
  date: string,
  signal?: AbortSignal,
): Promise<WeatherReading> {
  const cacheKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${date}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_DURATION_MS) return cached.reading;

  const today = localDateISO();
  const endpoint = date < today
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: date,
    end_date: date,
    hourly: 'temperature_2m,weather_code',
    timezone: 'auto',
  });
  const response = await fetch(`${endpoint}?${params}`, { signal });
  if (!response.ok) throw new Error('Não foi possível consultar o clima da unidade.');

  const payload = await response.json() as OpenMeteoResponse;
  const hourly = payload.hourly;
  const noonIndex = hourly?.time?.findIndex((time) => time.endsWith('T12:00')) ?? -1;
  const temperature = noonIndex >= 0 ? hourly?.temperature_2m?.[noonIndex] : undefined;
  const code = noonIndex >= 0 ? hourly?.weather_code?.[noonIndex] : undefined;
  if (typeof temperature !== 'number' || typeof code !== 'number') {
    throw new Error('A previsão não possui dados disponíveis para essa data.');
  }

  const reading = {
    condition: WEATHER_LABELS[code] || 'Condição não identificada',
    temperature: Math.round(temperature * 10) / 10,
  };
  cache.set(cacheKey, { reading, cachedAt: Date.now() });
  return reading;
}
