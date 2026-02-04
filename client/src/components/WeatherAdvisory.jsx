import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cloud, Sun, CloudRain, Wind, Thermometer, MapPin } from 'lucide-react';

const WeatherAdvisory = () => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [locationName, setLocationName] = useState('Sultan Naga Dimaporo');
    const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false);

    // Default Coordinates for Sultan Naga Dimaporo, Lanao del Norte (MSU-SND)
    const DEFAULT_LAT = 7.808;
    const DEFAULT_LON = 123.736;

    useEffect(() => {
        const fetchWeather = async (lat, lon) => {
            try {
                const response = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila`
                );
                setWeather(response.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching weather:", err);
                setError("Unable to load weather data.");
                setLoading(false);
            }
        };

        const getLocation = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        setLocationName('Current Location');
                        setIsUsingCurrentLocation(true);
                        fetchWeather(latitude, longitude);
                    },
                    (error) => {
                        console.warn("Geolocation permission denied or error:", error);
                        // Fallback to default
                        fetchWeather(DEFAULT_LAT, DEFAULT_LON);
                    }
                );
            } else {
                // Fallback if geolocation is not supported
                fetchWeather(DEFAULT_LAT, DEFAULT_LON);
            }
        };

        getLocation();
    }, []);

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
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        };
        return codes[code] || "Variable";
    };

    if (loading) return (
        <div className="bg-white p-4 rounded-lg shadow animate-pulse h-32 flex items-center justify-center">
            <span className="text-gray-400">Loading Weather...</span>
        </div>
    );

    if (error) return null;

    const current = weather?.current;
    const daily = weather?.daily;

    if (!current) return null;

    return (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-lg relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Cloud size={100} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                        {getWeatherIcon(current.weather_code)}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            Weather Advisory
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isUsingCurrentLocation ? 'bg-green-600 text-green-100' : 'bg-blue-800 text-blue-100'}`}>
                                <MapPin size={10} />
                                {locationName}
                            </span>
                        </h3>
                        <p className="text-blue-100 text-sm">{getWeatherDescription(current.weather_code)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                            <Thermometer size={16} className="text-blue-200" />
                            <span className="text-2xl font-bold">{current.temperature_2m}°C</span>
                        </div>
                        <p className="text-xs text-blue-200">Temp</p>
                    </div>
                    
                    <div className="text-center hidden sm:block">
                        <div className="flex items-center justify-center gap-1">
                            <Wind size={16} className="text-blue-200" />
                            <span className="text-xl font-semibold">{current.wind_speed_10m} <span className="text-xs">km/h</span></span>
                        </div>
                        <p className="text-xs text-blue-200">Wind</p>
                    </div>

                    <div className="text-center hidden sm:block">
                        <div className="flex items-center justify-center gap-1">
                            <CloudRain size={16} className="text-blue-200" />
                            <span className="text-xl font-semibold">{current.relative_humidity_2m}%</span>
                        </div>
                        <p className="text-xs text-blue-200">Humidity</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherAdvisory;
