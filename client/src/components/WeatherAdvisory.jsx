import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cloud, Sun, CloudRain, Wind, Thermometer, MapPin } from 'lucide-react';
import { cacheSingleton, getSingleton } from '../utils/db';

const WeatherAdvisory = () => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [locationName, setLocationName] = useState('Sultan Naga Dimaporo');
    const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);

    // Default Coordinates for Sultan Naga Dimaporo, Lanao del Norte (MSU-SND)
    const DEFAULT_LAT = 7.808;
    const DEFAULT_LON = 123.736;
    const CACHE_KEY = 'weather_data';
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

    useEffect(() => {
        const loadWeather = async () => {
            try {
                // Try cache first
                const cached = await getSingleton('analytics', CACHE_KEY);
                if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
                    setWeather(cached.data);
                    setLocationName(cached.locationName);
                    setIsUsingCurrentLocation(cached.isUsingCurrentLocation);
                    setLoading(false);
                    return;
                }
            } catch (e) {
                console.warn("Weather cache read error", e);
            }

            getLocation();
        };

        loadWeather();
    }, []);

    const fetchWeather = async (lat, lon, locName, isCurrentLoc) => {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila`
            );
            
            const weatherData = response.data;
            setWeather(weatherData);
            setLoading(false);

            // Cache the result
            await cacheSingleton('analytics', CACHE_KEY, {
                data: weatherData,
                locationName: locName,
                isUsingCurrentLocation: isCurrentLoc,
                timestamp: Date.now()
            });

        } catch (err) {
            console.error("Error fetching weather:", err);
            setError("Unable to load weather data.");
            setLoading(false);
        }
    };

    const fetchLocationName = async (lat, lon) => {
        try {
            // Using OpenStreetMap Nominatim for reverse geocoding
            const response = await axios.get(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
            );
            if (response.data && response.data.address) {
                const { city, town, village, municipality, county, state } = response.data.address;
                const specificLoc = city || town || village || municipality || county;
                const broadLoc = state;
                if (specificLoc) {
                    return `${specificLoc}${broadLoc ? `, ${broadLoc}` : ''}`;
                }
            }
        } catch (err) {
            console.warn("Error fetching location name:", err);
        }
        return 'Sultan Naga Dimaporo'; // Fallback or previous default
    };

    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    setIsUsingCurrentLocation(true);
                    const locName = await fetchLocationName(latitude, longitude);
                    setLocationName(locName);
                    fetchWeather(latitude, longitude, locName, true);
                },
                async (error) => {
                    console.warn("Geolocation permission denied or error:", error);
                    // Try IP-based geolocation before defaulting
                    try {
                        const ipResp = await axios.get('https://ipapi.co/json/');
                        const ipLat = ipResp.data?.latitude;
                        const ipLon = ipResp.data?.longitude;
                        const ipCity = ipResp.data?.city;
                        if (ipLat && ipLon) {
                            const locName = ipCity || await fetchLocationName(ipLat, ipLon);
                            setIsUsingCurrentLocation(false);
                            setLocationName(locName);
                            return fetchWeather(ipLat, ipLon, locName, false);
                        }
                    } catch (e) {
                        console.warn("IP geolocation failed:", e.message);
                    }
                    // Final fallback to default
                    fetchWeather(DEFAULT_LAT, DEFAULT_LON, 'Sultan Naga Dimaporo', false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
            );
        } else {
            // Fallback if geolocation is not supported
            fetchWeather(DEFAULT_LAT, DEFAULT_LON, 'Sultan Naga Dimaporo', false);
        }
    };

    const getWeatherIcon = (code) => {
        // WMO Weather interpretation codes (ww)
        if (code === 0 || code === 1) return <Sun className="text-yellow-500" size={32} />;
        if (code === 2 || code === 3) return <Cloud className="text-gray-400" size={32} />;
        if (code >= 51 && code <= 67) return <CloudRain className="text-blue-400" size={32} />;
        if (code >= 80 && code <= 99) return <CloudRain className="text-blue-600" size={32} />;
        return <Cloud className="text-gray-400" size={32} />;
    };

    const getWeatherDescription = (code) => {
        const codes = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Depositing rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            71: "Thunderstorm", 95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        };
        return codes[code] || "Variable";
    };

    const getSkyCondition = (code) => {
        if (code <= 1) return "Sunny Day";
        if (code <= 3) return "Cloudy Day";
        if (code >= 51) return "Rainy Day";
        return "Cloudy Day"; // Default
    };
    
    const getAnimationClass = (w) => {
        if (!w) return '';
        const code = w.weather_code;
        const wind = w.wind_speed_10m || 0;
        if (code <= 1) return 'weather-sunny';
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return 'weather-rain';
        if (wind >= 25) return 'weather-wind';
        return '';
    };

    if (loading) return (
        <div className="bg-white p-4 rounded-lg shadow animate-pulse h-32 flex items-center justify-center">
            <span className="text-gray-400">Loading Weather...</span>
        </div>
    );

    if (error) return null;

    const current = weather?.current;
    
    if (!current) return null;

    return (
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg shadow-lg relative overflow-hidden mb-6">
            <div className={`weather-bg ${getAnimationClass(current)}`}></div>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Cloud size={100} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm shadow-inner">
                        {getWeatherIcon(current.weather_code)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            {getSkyCondition(current.weather_code)}
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isUsingCurrentLocation ? 'bg-green-500/80 text-white' : 'bg-blue-900/50 text-blue-100'}`}>
                                <MapPin size={10} />
                                {locationName}
                            </span>
                        </h3>
                        <p className="text-blue-100 text-sm">{getWeatherDescription(current.weather_code)}</p>
                    </div>
                </div>

                <div className="flex items-center justify-around w-full md:w-auto gap-2 sm:gap-6 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                    <div className="text-center px-2">
                        <div className="flex items-center justify-center gap-1">
                            <Thermometer size={18} className="text-yellow-300" />
                            <span className="text-2xl font-bold">{current.temperature_2m}°C</span>
                        </div>
                        <p className="text-xs text-blue-200 uppercase tracking-wider">Temp</p>
                    </div>
                    
                    <div className="w-px h-8 bg-blue-400/30"></div>

                    <div className="text-center px-2">
                        <div className="flex items-center justify-center gap-1">
                            <Wind size={18} className="text-gray-300" />
                            <span className="text-xl font-semibold">{current.wind_speed_10m} <span className="text-xs">km/h</span></span>
                        </div>
                        <p className="text-xs text-blue-200 uppercase tracking-wider">Wind</p>
                    </div>

                    <div className="w-px h-8 bg-blue-400/30"></div>

                    <div className="text-center px-2">
                        <div className="flex items-center justify-center gap-1">
                            <CloudRain size={18} className="text-blue-300" />
                            <span className="text-xl font-semibold">{current.relative_humidity_2m}%</span>
                        </div>
                        <p className="text-xs text-blue-200 uppercase tracking-wider">Humidity</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherAdvisory;
