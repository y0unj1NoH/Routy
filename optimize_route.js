require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY || !MAPS_KEY) {
    console.error("Error: Missing API Keys in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
// Use a model that supports JSON mode well. flash is good for speed/cost.
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });

// --- Data Structures (Enums & Types) ---

const COMPANIONS = {
    ALONE: 'Alone',
    FRIENDS: 'Friends',
    PARTNER: 'Partner',
    FAMILY: 'Family',
    COLLEAGUES: 'Colleagues'
};

const PACE = {
    PACKED: 'Packed',       // Target 6+ spots/day
    RELAXED: 'Relaxed',     // Target 2-3 spots/day
    MODERATE: 'Moderate'    // Default 4-5 spots
};

const THEMES = {
    FOODIE: 'Foodie',
    LANDMARK: 'Landmark',
    SHOPPING: 'Shopping',
    NATURE: 'Nature'
};

// Mock User Input (Funnel Data)
// In a real app, this comes from the frontend.
const USER_PREFERENCES = {
    dates: {
        start: "2026-03-27", // Friday
        end: "2026-03-29"    // Sunday
    },
    companions: COMPANIONS.FRIENDS,
    pace: PACE.PACKED,
    themes: [THEMES.FOODIE, THEMES.SHOPPING],
    anchors: {
        accommodation: {
            name: "Hotel Nikko",
            // In real app, we might have lat/lng or placeID. 
            // For now, let's assume we might need to find it or it's known.
            // Let's hold a placeholder ID or just string for Gemini to recognize if it's in the list.
            id: "Unknown_Hotel_ID" 
        },
        transport: {
            name: "Fukuoka Airport",
            type: "AIRPORT",
            arrival: "2026-03-27T10:00:00",    // Estimated Arrival (Landing)
            departure: "2026-03-29T18:00:00"   // Estimated Departure (Takeoff)
        },
        fixed_activities: [
            // Example: { name: "Concert", time_start: "18:00", time_end: "21:00", location: "..." }
        ]
    }
};

// --- Helper Functions ---

/**
 * Reads result.json and prunes it to essential tokens.
 */
function loadAndPruneData(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return [];
        }
        let rawData = fs.readFileSync(filePath, 'utf8');
        // Strip BOM if present
        if (rawData.charCodeAt(0) === 0xFEFF) {
            rawData = rawData.slice(1);
        }
        const json = JSON.parse(rawData);
        
        if (!json.success || !json.data) {
            throw new Error("Invalid result.json format: success or data missing");
        }

        const pruned = json.data.map(item => {
            const d = item.details;
            // Defensive coding for missing fields
            if (!d) return null;
            
            return {
                id: d.id,
                name: item.name || d.displayName?.text || "Unknown Place",
                location: {
                    lat: d.location?.latitude,
                    lng: d.location?.longitude
                },
                rating: d.rating,
                user_note: item.note, 
                types: d.types || [],
                // Simplify opening hours to just the specific dates if possible, 
                // but for now, let's keep it simple.
                weekdayText: d.regularOpeningHours?.weekdayDescriptions
            };
        }).filter(item => item !== null && item.location.lat); // Remove nulls and places without location

        console.log(`Loaded ${pruned.length} places from ${filePath}.`);
        return pruned;

    } catch (error) {
        console.error("Error loading data:", error.message);
        return [];
    }
}

/**
 * Generates the Gemini Prompt based on scenarios.
 */
function generatePrompt(places, scenario, preferences) {
    const isPersonalized = scenario === 'Personalized';
    
    let prompt = `
You are an expert travel planner. 
Context:
- Dates: ${preferences.dates.start} to ${preferences.dates.end} (3 Days)
- Friday to Sunday. Check for weekends/holidays in Japan.
- Accommodation: ${preferences.anchors.accommodation.name} (Start/End of Day)
- Airport: ${preferences.anchors.transport.name} (Day 1 Start, Day 3 End)
- Arrival: ${preferences.anchors.transport.arrival}
- Departure: ${preferences.anchors.transport.departure}

User Preferences (${scenario}):
`;

    if (isPersonalized) {
        prompt += `
- Companions: ${preferences.companions}
- Pace: ${preferences.pace}
- Themes: ${preferences.themes.join(", ")}
- Goal: Create a "${preferences.pace}" itinerary that maximizes "${preferences.themes.join(" & ")}" spots.
- Prioritize specifically: Places with User Notes.
`;
    } else {
        prompt += `
- Goal: Create a logical, distance-minimized route.
`;
    }

    prompt += `
Available Places (JSON):
${JSON.stringify(places)}

Task:
Generate a valid JSON object with the following structure:
{
  "itinerary": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "place_id": "ID from list or 'AIRPORT' or 'HOTEL'",
          "name": "Name",
          "time": "HH:MM",
          "label": "Breakfast | Lunch | Dinner | Cafe | Sightseeing | Shopping | Landmark | Activity",
          "reason": "Short reason why selected here"
        }
      ]
    },
    ... (Day 2, Day 3)
  ]
}

Rules:
1. Day 1 starts at Airport -> Hotel (Drop bags) -> Activities.
2. Day 3 ends at Airport (allow 2 hours before departure).
3. Group places geographically to minimize travel time.
4. Ensure highly rated food spots are assigned to Lunch/Dinner slots.
5. If a place has a 'user_note', it is a MUST VISIT.
6. Use "Hotel Nikko" (ID: HOTEL) and "Fukuoka Airport" (ID: AIRPORT) as anchors.
`;
    return prompt;
}

/**
 * Calls Gemini to generate the itinerary.
 */
async function callGemini(prompt) {
    try {
        console.log("Sending request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Log token usage if available (Gemini API usually provides usageMetadata)
        if (result.response.usageMetadata) {
            console.log(`Token Usage - Prompt: ${result.response.usageMetadata.promptTokenCount}, Candidates: ${result.response.usageMetadata.candidatesTokenCount}`);
        }
        
        // Clean markdown code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Gemini Error:", error);
        return null;
    }
}

const axios = require('axios');

// --- Routes & Places API Helpers ---

/**
 * Finds a Place ID using Text Search (New Places API).
 */
async function findPlaceId(query) {
    try {
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const response = await axios.post(url, {
            textQuery: query,
            maxResultCount: 1
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': MAPS_KEY,
                'X-Goog-FieldMask': 'places.id,places.location'
            }
        });

        const place = response.data.places?.[0];
        if (place) {
            console.log(`Resolved "${query}" -> ${place.id}`);
            return { id: place.id, location: place.location };
        }
        return null;
    } catch (error) {
        console.error(`Error resolving place "${query}":`, error.message);
        return null;
    }
}

/**
 * Calculates route using Google Routes API (v2).
 * Logic: < 1.5km = WALKING, else = TRANSIT (default).
 */
async function getRoute(originId, destId, isWalkingPreferred = false) {
    try {
        const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        
        // Simple heuristic: Try walking first if preferred or unknown
        // But for Routes API, we need to specify mode.
        // Let's assume TRANSIT first, but if close, WALKING. 
        // Actually, we need lat/lng to estimate "close" before calling API if we want to save calls,
        // OR we just ask for TRANSIT and if it's short, we ask for WALKING?
        // Let's do a simple optimization: 
        // We will request TRANSIT by default. If it returns a very short distance (< 1.5km), 
        // we might want to suggest walking. 
        // BETTER STRATEGY: 
        // We really want distinct modes. Let's just default to TRANSIT for now as it's safer for general travel in Japan.
        // Modifications: If "isWalkingPreferred" (flags from Gemini?), use WALKING.
        // For now, let's stick to TRANSIT as primary for > 1km, WALKING for < 1km.
        // We can't know distance easily without calling.
        // Let's call with travelMode: 'TRANSIT'.
        
        const body = {
            origin: { placeId: originId },
            destination: { placeId: destId },
            travelMode: 'TRANSIT',
            computeAlternativeRoutes: false,
            languageCode: 'ko' // Korean response
        };

        let response = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': MAPS_KEY,
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs'
            }
        });

        // Fallback: If Transit fails (e.g. too close or no route), try WALKING
        if (!response.data.routes || response.data.routes.length === 0) {
            body.travelMode = 'WALK';
            response = await axios.post(url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': MAPS_KEY,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
                }
            });
        }

        const route = response.data.routes?.[0];
        if (route) {
            const distanceMeters = route.distanceMeters;
            const durationSeconds = parseInt(route.duration.replace('s', ''));
            
            // Post-correction: If transit finds a route but it's very short (< 1.2km), 
            // force a recalculation for WALKING to give a better "vibe" (unless it's raining/baggage).
            if (distanceMeters < 1200 && body.travelMode === 'TRANSIT') {
                 body.travelMode = 'WALK';
                 const walkResponse = await axios.post(url, body, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': MAPS_KEY,
                        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
                    }
                });
                const walkRoute = walkResponse.data.routes?.[0];
                if (walkRoute) {
                    return {
                        mode: 'WALK',
                        distance: `${walkRoute.distanceMeters}m`,
                        duration: `${Math.ceil(parseInt(walkRoute.duration.replace('s', '')) / 60)}분`
                    };
                }
            }

            return {
                mode: body.travelMode === 'TRANSIT' ? 'TRANSIT' : 'WALK',
                distance: distanceMeters >= 1000 ? `${(distanceMeters/1000).toFixed(1)}km` : `${distanceMeters}m`,
                duration: `${Math.ceil(durationSeconds / 60)}분`
            };
        }
        return null;
    } catch (error) {
        console.error("Routes API Error:", error.response?.data?.error?.message || error.message);
        return { mode: 'UNKNOWN', distance: '?', duration: '?' };
    }
}

/**
 * Enriches the Gemini itinerary with real routes.
 */
async function enrichItinerary(itineraryJson) {
    const itinerary = itineraryJson.itinerary;
    
    // 1. Resolve Anchors once
    const accommodation = USER_PREFERENCES.anchors.accommodation;
    const airport = USER_PREFERENCES.anchors.transport;
    
    // Cache for resolved IDs
    const resolvedIds = {};
    
    async function getId(key, name) {
        if (key === 'HOTEL' || key === 'AIRPORT' || !key.startsWith('ChI')) {
            if (resolvedIds[name]) return resolvedIds[name];
            const resolved = await findPlaceId(name);
            if (resolved) {
                resolvedIds[name] = resolved.id;
                return resolved.id;
            }
        }
        return key;
    }

    // 2. Iterate and Route
    for (const day of itinerary) {
        console.log(`Routing Day ${day.day}...`);
        
        for (let i = 0; i < day.activities.length - 1; i++) {
            const current = day.activities[i];
            const next = day.activities[i+1];
            
            const originId = await getId(current.place_id, current.name);
            const destId = await getId(next.place_id, next.name);
            
            if (originId && destId && originId !== destId) {
                // Determine if we should prefer walking (heuristic: if labels suggest adjacent shopping)
                const route = await getRoute(originId, destId);
                if (route) {
                    current.transport_to_next = route;
                }
            }
        }
    }
    return itineraryJson;
}

// --- Main Execution ---

async function main() {
    console.log("Starting Route Optimization...");
    
    // 1. Load Data
    const places = loadAndPruneData('./result.json');
    if (places.length === 0) {
        console.error("No places loaded. Exiting.");
        return;
    }
    
    // 2. Token Check
    const originalSize = fs.statSync('./result.json').size;
    const prunedJson = JSON.stringify(places);
    const prunedSize = Buffer.byteLength(prunedJson, 'utf8');
    console.log(`Data Size: ${originalSize} bytes -> ${prunedSize} bytes (${((prunedSize/originalSize)*100).toFixed(2)}%)`);

    // 3. Generate Itineraries (Skip if intermediate exists to save tokens/time during dev)
    let results = {};
    if (fs.existsSync('intermediate_itinerary.json')) {
        console.log("Loading user-generated intermediate itinerary...");
        results = JSON.parse(fs.readFileSync('intermediate_itinerary.json', 'utf8'));
    } else {
        const scenarios = ['Baseline', 'Personalized'];
        for (const scenario of scenarios) {
            console.log(`\nGenerating ${scenario} Itinerary...`);
            const prompt = generatePrompt(places, scenario, USER_PREFERENCES);
            const itinerary = await callGemini(prompt);
            if (itinerary) {
                results[scenario.toLowerCase()] = itinerary;
                console.log(`${scenario} Generated!`);
            }
        }
        fs.writeFileSync('intermediate_itinerary.json', JSON.stringify(results, null, 2));
    }

    // 4. Enrich with Routes API
    console.log("\nEnriching with Real Transport Data...");
    if (results.baseline) {
        results.baseline = await enrichItinerary(results.baseline);
    }
    if (results.personalized) {
        results.personalized = await enrichItinerary(results.personalized);
    }

    // 5. Final Output
    fs.writeFileSync('final_itinerary.json', JSON.stringify(results, null, 2));
    console.log("\nSuccess! Saved to final_itinerary.json");
}

main();
