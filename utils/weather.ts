const WEATHER_KEY = process.env.EXPO_PUBLIC_WEATHER_KEY

export async function getWeather(city: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_KEY}&units=imperial`
    )
    const data = await res.json()
    const temp = Math.round(data.main.temp)
    const desc = data.weather[0].description
    return `${temp}°F, ${desc}`
  } catch {
    return ''
  }
}
