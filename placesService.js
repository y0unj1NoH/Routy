const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1/places:searchText';

async function getPlaceDetails(query) {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
        console.warn('Google Places API Key is missing. Returning mock data.');
        return {
            id: 'mock-place-id-123',
            displayName: { text: query },
            formattedAddress: 'Mock Address, Fukuoka',
            rating: 4.5,
            userRatingCount: 100,
            location: { latitude: 33.59, longitude: 130.40 },
            regularOpeningHours: { 
                openNow: true,
                periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } }],
                weekdayDescriptions: ["Monday: 9AM-6PM", "Tuesday: 9AM-6PM"]
            },
            mock: true
        };
    }

    try {
        const response = await axios.post(
            BASE_URL,
            {
                textQuery: query,
                // Bias towards Fukuoka for better accuracy based on the user's provided context
                locationBias: {
                    circle: {
                        center: { latitude: 33.5854724, longitude: 130.2313199 },
                        radius: 50000 // 50km radius
                    }
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': API_KEY,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.photos,places.regularOpeningHours'
                }
            }
        );

        if (response.data.places && response.data.places.length > 0) {
            return response.data.places[0]; // Return top match
        }
        return null;
    } catch (error) {
        console.error(`Error searching for place "${query}":`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = { getPlaceDetails };
