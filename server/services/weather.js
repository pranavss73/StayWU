/**
 * Weather Service for StayWU
 * Integrates Open-Meteo API for real-time weather and 7-day Goa forecasts.
 * Requires no API key, completely free and reliable.
 */

class WeatherService {
  /**
   * Determine coordinates based on Goa district/area
   */
  static getCoordinates(location = '') {
    const loc = (location || '').toLowerCase();
    
    // South Goa locations
    const southKeywords = ['benaulim', 'colva', 'margao', 'margaon', 'palolem', 'agonda', 'canacona', 'cavelossim', 'varca', 'majorda', 'betalbatim', 'south goa'];
    if (southKeywords.some(k => loc.includes(k))) {
      return { latitude: 15.2736, longitude: 73.9582, region: 'South Goa' };
    }

    // North Goa locations
    const northKeywords = ['baga', 'calangute', 'candolim', 'anjuna', 'vagator', 'morjim', 'ashwem', 'arambol', 'siolim', 'saligao', 'panaji', 'panjim', 'porvorim', 'bardez', 'north goa'];
    if (northKeywords.some(k => loc.includes(k))) {
      return { latitude: 15.5432, longitude: 73.7554, region: 'North Goa' };
    }

    // Central / Default Goa coordinates
    return { latitude: 15.4989, longitude: 73.8278, region: 'Goa' };
  }

  /**
   * Translate WMO weather code to description and icon
   */
  static interpretWmoCode(code) {
    const codeMap = {
      0: { label: 'Clear Sky / Sunny', icon: '☀️', ascii: 'Sunny', isRain: false },
      1: { label: 'Mainly Clear', icon: '🌤️', ascii: 'Mainly Clear', isRain: false },
      2: { label: 'Partly Cloudy', icon: '⛅', ascii: 'Partly Cloudy', isRain: false },
      3: { label: 'Overcast', icon: '☁️', ascii: 'Overcast', isRain: false },
      45: { label: 'Foggy', icon: '🌫️', ascii: 'Foggy', isRain: false },
      48: { label: 'Depositing Rime Fog', icon: '🌫️', ascii: 'Foggy', isRain: false },
      51: { label: 'Light Drizzle', icon: '🌦️', ascii: 'Light Drizzle', isRain: true },
      53: { label: 'Moderate Drizzle', icon: '🌦️', ascii: 'Drizzle', isRain: true },
      55: { label: 'Dense Drizzle', icon: '🌧️', ascii: 'Dense Drizzle', isRain: true },
      61: { label: 'Slight Rain', icon: '🌧️', ascii: 'Slight Rain', isRain: true },
      63: { label: 'Moderate Rain', icon: '🌧️', ascii: 'Moderate Rain', isRain: true },
      65: { label: 'Heavy Rain', icon: '🌧️', ascii: 'Heavy Rain', isRain: true },
      80: { label: 'Rain Showers', icon: '🌦️', ascii: 'Rain Showers', isRain: true },
      81: { label: 'Moderate Showers', icon: '🌧️', ascii: 'Moderate Showers', isRain: true },
      82: { label: 'Violent Showers', icon: '⛈️', ascii: 'Heavy Showers', isRain: true },
      95: { label: 'Thunderstorm', icon: '⛈️', ascii: 'Thunderstorm', isRain: true },
      96: { label: 'Thunderstorm with Hail', icon: '⛈️', ascii: 'Thunderstorm', isRain: true },
      99: { label: 'Severe Thunderstorm', icon: '⛈️', ascii: 'Severe Thunderstorm', isRain: true },
    };

    return codeMap[code] || { label: 'Fair', icon: '⛅', ascii: 'Fair', isRain: false };
  }

  /**
   * Fetch live weather and forecast from Open-Meteo
   */
  static async getWeather(location = '', checkIn = null, checkOut = null) {
    const coords = this.getCoordinates(location);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=Asia%2FKolkata&forecast_days=7`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!response.ok) {
        throw new Error(`Open-Meteo responded with status ${response.status}`);
      }

      const data = await response.json();
      const currentCode = this.interpretWmoCode(data.current?.weather_code ?? 0);

      const current = {
        temp: Math.round(data.current?.temperature_2m ?? 28),
        feelsLike: Math.round(data.current?.apparent_temperature ?? 31),
        humidity: data.current?.relative_humidity_2m ?? 80,
        precipitation: data.current?.precipitation ?? 0,
        windSpeed: Math.round(data.current?.wind_speed_10m ?? 10),
        condition: currentCode.label,
        icon: currentCode.icon,
        ascii: currentCode.ascii,
        isRain: currentCode.isRain,
        region: coords.region,
      };

      const daily = [];
      const dailyDates = data.daily?.time || [];
      const dailyCodes = data.daily?.weather_code || [];
      const dailyMax = data.daily?.temperature_2m_max || [];
      const dailyMin = data.daily?.temperature_2m_min || [];
      const dailyRainProb = data.daily?.precipitation_probability_max || [];
      const dailyUV = data.daily?.uv_index_max || [];

      for (let i = 0; i < dailyDates.length; i++) {
        const wCode = this.interpretWmoCode(dailyCodes[i] ?? 0);
        const dObj = new Date(dailyDates[i]);
        const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
        
        daily.push({
          date: dailyDates[i],
          dayName,
          maxTemp: Math.round(dailyMax[i] ?? 30),
          minTemp: Math.round(dailyMin[i] ?? 24),
          rainProb: Math.round(dailyRainProb[i] ?? 30),
          uvIndex: dailyUV[i] != null ? Math.round(dailyUV[i]) : 6,
          condition: wCode.label,
          icon: wCode.icon,
          ascii: wCode.ascii,
          isRain: wCode.isRain,
        });
      }

      // Generate practical Goan travel advisory
      const rainyDays = daily.filter(d => d.rainProb >= 50 || d.isRain).length;
      let advisory = '';
      if (rainyDays >= 3) {
        advisory = 'Monsoon/rain showers expected during your stay. Pack a compact umbrella, waterproof bag, and non-slip sandals. Mornings usually offer clearer skies for sightseeing before afternoon showers.';
      } else if (rainyDays > 0) {
        advisory = 'Occasional coastal showers expected with pleasant tropical breezes. Ideal for both beach afternoons and scenic spice plantation visits. Carry light rain protection.';
      } else {
        advisory = 'Clear skies and warm tropical weather expected! High UV index around midday. Pack sunglasses, sunscreen, light cotton clothing, and stay hydrated.';
      }

      // Format prompt injection summary
      let promptSummary = `Current: ${current.temp}°C (Feels like ${current.feelsLike}°C), ${current.condition}, Humidity: ${current.humidity}%, Wind: ${current.windSpeed} km/h.\nUpcoming Forecast:\n`;
      daily.slice(0, 5).forEach((d, idx) => {
        promptSummary += `- Day ${idx + 1} (${d.dayName} ${d.date}): ${d.maxTemp}°C / ${d.minTemp}°C, ${d.condition}, Rain Probability: ${d.rainProb}%\n`;
      });
      promptSummary += `Advisory: ${advisory}`;

      return {
        region: coords.region,
        current,
        daily,
        advisory,
        promptSummary,
        source: 'Open-Meteo Live API',
      };
    } catch (err) {
      console.warn('Weather fetch failed, utilizing intelligent seasonal fallback:', err.message);
      return this.getFallbackWeather(coords.region);
    }
  }

  /**
   * Fallback seasonal Goa weather if external API is unreachable
   */
  static getFallbackWeather(region = 'Goa') {
    return {
      region,
      current: {
        temp: 28,
        feelsLike: 32,
        humidity: 82,
        precipitation: 0.5,
        windSpeed: 12,
        condition: 'Partly Cloudy with Coastal Breeze',
        icon: '⛅',
        ascii: 'Partly Cloudy',
        isRain: false,
        region,
      },
      daily: [
        { date: 'Day 1', dayName: 'Today', maxTemp: 30, minTemp: 24, rainProb: 35, uvIndex: 7, condition: 'Partly Cloudy', icon: '⛅', ascii: 'Partly Cloudy' },
        { date: 'Day 2', dayName: 'Tomorrow', maxTemp: 29, minTemp: 24, rainProb: 40, uvIndex: 6, condition: 'Passing Showers', icon: '🌦️', ascii: 'Passing Showers' },
        { date: 'Day 3', dayName: 'Day 3', maxTemp: 30, minTemp: 25, rainProb: 25, uvIndex: 8, condition: 'Mainly Sunny', icon: '🌤️', ascii: 'Mainly Sunny' },
      ],
      advisory: 'Tropical coastal climate with warm sunshine and gentle sea breezes. Keep a light raincoat handy and stay hydrated.',
      promptSummary: 'Current: 28°C, Partly Cloudy, Humidity: 82%. Forecast: 29-30°C with occasional light coastal showers. Advisory: Great beach conditions in morning hours.',
      source: 'Seasonal Climate Model',
    };
  }
}

module.exports = WeatherService;
