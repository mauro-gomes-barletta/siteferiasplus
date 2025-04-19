import axios from 'axios';

const API_BASE_URL = 'https://api.example.com'; // Replace with actual API base URL

export const fetchDestinations = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/destinations`);
        return response.data;
    } catch (error) {
        console.error('Error fetching destinations:', error);
        throw error;
    }
};

export const fetchWeather = async (location) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/weather`, {
            params: { location }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching weather:', error);
        throw error;
    }
};

export const fetchCosts = async (destination) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/costs`, {
            params: { destination }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching costs:', error);
        throw error;
    }
};