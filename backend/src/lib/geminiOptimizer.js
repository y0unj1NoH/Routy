const { GoogleGenerativeAI } = require("@google/generative-ai");

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

function ensureGeminiKey() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return apiKey;
}

function generatePrompt(places, scenario, generationInput) {
  const isPersonalized = scenario === 'Personalized';
  
  // Use generationInput mapping rather than hardcoded dates
  let prompt = `
You are an expert travel planner. 
Context:
- Dates: ${generationInput.startDate} to ${generationInput.endDate}
- Anchor: Consider typical start and end times for a day.

User Preferences (${scenario}):
`;

  if (isPersonalized) {
      prompt += `
- Companions: ${generationInput.companions || 'Any'}
- Pace: ${generationInput.pace || 'Moderate'}
- Themes: ${(generationInput.themes || []).join(", ") || 'Any'}
- Goal: Create a "${generationInput.pace || 'Moderate'}" itinerary that maximizes "${(generationInput.themes || []).join(" & ") || 'diverse experiences'}" spots.
- Prioritize specifically: Places with User Notes (which meant they were marked).
`;
  } else {
      prompt += `
- Goal: Create a logical, distance-minimized route focusing on standard popular places.
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
          "place_id": "ID from the provided list",
          "name": "Name",
          "time": "HH:MM",
          "label": "START | MORNING | VISIT | AFTERNOON | FINISH",
          "reason": "Short reason why selected here"
        }
      ]
    }
  ]
}

Rules:
1. Group places geographically to minimize travel time.
2. If a place has a 'user_note', it is highly recommended to include.
3. Make sure the 'place_id' matches exactly the ID from the provided list.
`;
  return prompt;
}

async function callGemini(prompt) {
  const apiKey = ensureGeminiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.0-flash as per the optimization script
  const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash", 
      generationConfig: { responseMimeType: "application/json" } 
  });

  try {
      console.log("Sending request to Gemini...");
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (result.response.usageMetadata) {
          console.log(`Token Usage - Prompt: ${result.response.usageMetadata.promptTokenCount}, Candidates: ${result.response.usageMetadata.candidatesTokenCount}`);
      }
      
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonString);
  } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
  }
}

async function buildGeminiSchedulePlan({ candidates, dayCount, startDate, stayPlace, generationInput, scenario = 'Personalized' }) {
    // 1. Format candidates into the structure expected by the prompt
    const placesList = candidates.map(candidate => {
        const p = candidate.place;
        return {
            id: p.id,
            name: p.name,
            location: { lat: p.lat, lng: p.lng },
            rating: p.rating,
            types: p.types_raw || [],
            user_note: candidate.note || (candidate.priority ? "Must visit" : null)
        };
    });

    const prompt = generatePrompt(placesList, scenario, generationInput);
    
    const itineraryResponse = await callGemini(prompt);
    
    if (!itineraryResponse || !itineraryResponse.itinerary) {
        throw new Error("Failed to generate itinerary from Gemini API");
    }

    // 2. Map the Gemini response back to the structured `planDays` format expected by resolvers
    const planDays = itineraryResponse.itinerary.map(dayPlan => {
        const stops = dayPlan.activities.map((activity, index) => {
            // Find the original place object to extract metadata if needed
            const matchedCandidate = candidates.find(c => c.place.id === activity.place_id);
            const badges = [];
            if (matchedCandidate && matchedCandidate.priority) badges.push("MUSTVISIT");

            return {
                placeId: activity.place_id,
                time: activity.time,
                label: activity.label || `VISIT`,
                badges: badges,
                note: matchedCandidate ? matchedCandidate.note : null,
                reason: activity.reason,
                transportToNext: null // Optionally, could integrate routes API here later
            };
        }).filter(stop => stop.placeId); // Ensure placeId is valid

        return {
            dayNumber: dayPlan.day,
            stops: stops
        };
    });

    return planDays;
}

module.exports = {
  buildGeminiSchedulePlan
};
