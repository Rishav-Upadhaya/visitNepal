
'use server';
/**
 * @fileOverview Fetches detailed information and an image for a specific place in Nepal using AI.
 *
 * - getPlaceDescription - Fetches details for a given place.
 * - GetPlaceDescriptionInput - Input type for the getPlaceDescription function.
 * - GetPlaceDescriptionOutput - Output type for the getPlaceDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL } from '@/types'; // Import from types

const GetPlaceDescriptionInputSchema = z.object({
  placeName: z.string().describe('The name of the place in Nepal to get details for (e.g., "Pashupatinath Temple", "Rara Lake", "Everest Base Camp Trek").'),
});
export type GetPlaceDescriptionInput = z.infer<typeof GetPlaceDescriptionInputSchema>;

// Schema for what the text model should return for EACH item (structured details)
const PlaceDetailsTextModelOutputSchema = z.object({
  name: z.string().describe("The official or commonly known name of the place, should match the input placeName if possible."),
  tagline: z.string().describe("A very short, catchy, and descriptive tagline for the place (1 sentence maximum)."),
  description: z.string().describe("A detailed and engaging description of the place, its significance, what makes it special for travelers, and what visitors can expect (target 3-5 sentences). All information must be specific to its location and context within Nepal."),
  attractions: z.array(z.string()).min(1).max(5).describe("A list of 1 to 5 key attractions, specific points of interest, or main activities directly related to this place within Nepal. (e.g., for a lake: specific viewpoints, boating; for a trek: key passes, base camps). Be specific."),
  howToReach: z.string().describe("Brief, practical information on how to reach this place within Nepal (e.g., 'Fly to Lukla (30 mins) then trek for 8 days', 'Approx. 6-7 hour tourist bus ride from Kathmandu, then a short taxi', 'Located within Bhaktapur Durbar Square, easily accessible by local bus or taxi from Kathmandu (1 hour)'). Include common modes of transport and general accessibility from a major hub like Kathmandu or Pokhara."),
  bestTimeToVisit: z.string().describe("The best time of year or specific seasons to visit this place in Nepal, considering weather, views, and local conditions (e.g., 'Spring (March-May) and Autumn (September-November) for clear skies and pleasant trekking weather')."),
  localTips: z.array(z.string()).min(1).max(3).describe("A list of 1 to 3 practical local tips for visitors relevant to this place in Nepal (e.g., 'Carry enough water and snacks.', 'Respect local customs by dressing modestly.', 'Entry permits (TIMS and National Park) are required for this trek.').")
});


// Schema for the final output of the FLOW (includes imageUrl for each item)
const GetPlaceDescriptionOutputSchema = PlaceDetailsTextModelOutputSchema.extend({
  imageUrl: z.string().url().describe("URL of the generated image for this specific place. Expected format: 'data:image/png;base64,<encoded_data>'."),
  imageAiHint: z.string().optional().describe("Keywords for Unsplash/placeholder if AI image fails for this place.")
});
export type GetPlaceDescriptionOutput = z.infer<typeof GetPlaceDescriptionOutputSchema>;


const FALLBACK_IMAGE_URL_PLACE = "https://placehold.co/800x500.png";

// Fallback used when AI returns some valid structure but specific fields might be missing.
const PARTIAL_FALLBACK_DETAILS: Omit<GetPlaceDescriptionOutput, 'imageUrl' | 'imageAiHint' | 'name'> = {
    tagline: "An intriguing destination in Nepal offering unique experiences and sights.",
    description: "Discover the unique beauty, culture, and significance of this fascinating place in Nepal. More detailed information is being curated by our AI.",
    attractions: ["Key points of interest and activities will be listed here soon."],
    howToReach: "Typically accessible from major cities like Kathmandu or Pokhara; specific routes and travel times depend on the exact location and mode of transport within Nepal.",
    bestTimeToVisit: "Nepal offers diverse climates; the best time to visit varies by region and altitude. Generally, spring and autumn are popular.",
    localTips: ["Always respect local culture and traditions.", "Stay hydrated, especially at higher altitudes.", "Be prepared for varying weather conditions."]
};

// Fallback used when AI provides no useful top-level info, or if an error occurs during processing.
const NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS: Omit<GetPlaceDescriptionOutput, 'imageUrl' | 'imageAiHint' | 'name'> = {
    tagline: "Information not available for this place in Nepal.",
    description: NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL,
    attractions: ["Information unavailable as the place was not identified in Nepal."],
    howToReach: "Route information unavailable as the place was not identified in Nepal.",
    bestTimeToVisit: "Visit time information unavailable.",
    localTips: ["Ensure the place is located within Nepal and try searching again with correct spelling."]
};


export async function getPlaceDescription(
  input: GetPlaceDescriptionInput
): Promise<GetPlaceDescriptionOutput> {
  return getPlaceDescriptionFlow(input);
}

const getPlaceDescriptionFlow = ai.defineFlow(
  {
    name: 'getPlaceDescriptionFlow',
    inputSchema: GetPlaceDescriptionInputSchema,
    outputSchema: GetPlaceDescriptionOutputSchema,
  },
  async ({ placeName }) => {
    let textDetails: z.infer<typeof PlaceDetailsTextModelOutputSchema>;

    try {
      // Step 1: Get structured text details from the text model
      const textPrompt = `You are an expert Nepal travel guide and content creator. Your task is to provide information about a specific *place*.

User-provided place name: "${placeName}"

Follow these steps:
1.  **Interpret Input**: If "${placeName}" seems like a common misspelling of a known Nepali place, interpret it as the correct Nepali place name (e.g., "Pokharaa" as "Pokhara", "Pashupatinat" as "Pashupatinath Temple").
2.  **Contextualize in Nepal**: Determine if the (potentially corrected) place name refers to a location **in Nepal**.
3.  **Information Retrieval (If in Nepal)**: If the place is in Nepal, provide detailed, engaging, and accurate information for a travel website. All information (description, attractions, howToReach, localTips, etc.) MUST be specific to its location and context **within Nepal**.
    *   If the place is a trek (e.g., "Everest Base Camp Trek"), focus on the trek itself.
    *   If it's a specific temple (e.g., "Manakamana Temple"), focus on that temple.
4.  **Error Handling / Place Not Found in Nepal**:
    If the provided "${placeName}" (even after attempting interpretation) is definitively not a place in Nepal, or is not a recognizable place name at all (e.g., gibberish, "Eiffel Tower", "what is the weather"), or if you cannot find any information about it in Nepal:
    *   Set the "name" field in your JSON output to the original "${placeName}" input.
    *   Set the "tagline" field to "Information not available for this place in Nepal."
    *   Set the "description" field *exactly* to: "${NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL}"
    *   Set "attractions" to ["Information unavailable as the place was not identified in Nepal."].
    *   Set "howToReach" to "Route information unavailable as the place was not identified in Nepal."
    *   Set "bestTimeToVisit" to "Visit time information unavailable.".
    *   Set "localTips" to ["Ensure the place is located within Nepal and try searching again with correct spelling."].
    You MUST still return a JSON object matching the schema, but with these "not found" values.

**Required JSON Output Structure (Strictly Adhere):**
Generate the following as a JSON object. Ensure all fields are populated according to the instructions above.

{
  "name": "The official or commonly known name, matching interpreted place name if applicable, or original if not found.",
  "tagline": "A very short, catchy, descriptive tagline (1 sentence max if found), or 'Information not available...' if not.",
  "description": "Detailed description (3-5 sentences if found in Nepal), or '${NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL}' if not.",
  "attractions": ["List of 1-5 key attractions/activities in Nepal if found", "Or 'Information unavailable...' if not."],
  "howToReach": "How to reach information within Nepal if found, or 'Route information unavailable...' if not.",
  "bestTimeToVisit": "Best time to visit in Nepal if found, or 'Visit time information unavailable...' if not.",
  "localTips": ["List of 1-3 local tips in Nepal if found", "Or 'Ensure the place is located...' if not."]
}

Example for input "Rara Lake" (which is in Nepal):
{
  "name": "Rara Lake",
  "tagline": "Nepal's largest and deepest freshwater lake, a stunning turquoise jewel nestled in the remote Himalayas.",
  "description": "Rara Lake, located in the Mugu district of Nepal, is a breathtaking high-altitude lake renowned for its crystal-clear waters and serene surroundings. It's part of Rara National Park, offering a pristine natural environment with diverse flora and fauna. The journey to Rara itself is an adventure, rewarding visitors with unparalleled tranquility and stunning alpine scenery.",
  "attractions": ["Boating on the lake's placid waters", "Horse riding around the lake perimeter", "Hiking to Murma Top for panoramic Himalayan views", "Exceptional bird watching opportunities"],
  "howToReach": "Fly from Nepalgunj to Talcha Airport (approx. 45 mins), then a 2-3 hour walk/hike to the lake. Alternatively, a multi-day trek from Jumla is possible for adventurers.",
  "bestTimeToVisit": "Spring (April-May) and Autumn (September-October) for clear skies, blooming wildflowers (spring), and pleasant temperatures.",
  "localTips": ["Acclimatize properly due to the high altitude (around 3000m).", "Carry basic medical supplies as facilities are limited.", "Camping facilities and basic guesthouses are available; book in advance during peak season."]
}
`;

      const textResponse = await ai.generate({
        prompt: textPrompt,
        output: { schema: PlaceDetailsTextModelOutputSchema },
        config: {
            temperature: 0.3,
            safetySettings: [ 
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            ],
        }
      });

      if (textResponse.output && textResponse.output.name) {
        // If the AI correctly uses the sentinel for description, pass it through.
        // Otherwise, use partial fallbacks for any missing individual fields.
        if (textResponse.output.description === NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL) {
            textDetails = {
                 name: textResponse.output.name || placeName, // Use AI's name or original
                 tagline: textResponse.output.tagline || NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS.tagline,
                 description: NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL,
                 attractions: textResponse.output.attractions && textResponse.output.attractions.length > 0 ? textResponse.output.attractions : NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS.attractions,
                 howToReach: textResponse.output.howToReach || NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS.howToReach,
                 bestTimeToVisit: textResponse.output.bestTimeToVisit || NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS.bestTimeToVisit,
                 localTips: textResponse.output.localTips && textResponse.output.localTips.length > 0 ? textResponse.output.localTips : NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS.localTips,
            };
        } else {
            textDetails = {
                name: textResponse.output.name,
                tagline: textResponse.output.tagline || PARTIAL_FALLBACK_DETAILS.tagline,
                description: textResponse.output.description || PARTIAL_FALLBACK_DETAILS.description,
                attractions: textResponse.output.attractions && textResponse.output.attractions.length > 0 ? textResponse.output.attractions : PARTIAL_FALLBACK_DETAILS.attractions,
                howToReach: textResponse.output.howToReach || PARTIAL_FALLBACK_DETAILS.howToReach,
                bestTimeToVisit: textResponse.output.bestTimeToVisit || PARTIAL_FALLBACK_DETAILS.bestTimeToVisit,
                localTips: textResponse.output.localTips && textResponse.output.localTips.length > 0 ? textResponse.output.localTips : PARTIAL_FALLBACK_DETAILS.localTips,
            };
        }
      } else {
        console.warn(`Text generation for place '${placeName}' returned no valid output or missing name. Using 'not found in Nepal' fallback.`);
        textDetails = { name: placeName, ...NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS };
      }
    } catch (error) {
      console.error(`Error generating text details for place ${placeName}:`, error);
      textDetails = { name: placeName, ...NOT_FOUND_IN_NEPAL_FALLBACK_DETAILS };
    }

    // Step 2: Generate image for the place
    let imageUrl = FALLBACK_IMAGE_URL_PLACE;
    const finalPlaceNameForImage = textDetails.name; // Use the name determined by the text generation logic

    // Generate a concise 1-2 word hint for Unsplash/placeholder
    const placeNameWords = finalPlaceNameForImage.split(' ');
    const imageAiHint = placeNameWords.slice(0, 2).join(' ').toLowerCase();


    try {
      // Only generate image if the place was found in Nepal
      if (textDetails.description !== NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL) {
        const imagePrompt = `Generate a high-resolution, captivating travel photograph showcasing "${finalPlaceNameForImage}" **in Nepal**. The image should be scenic, inspiring, and suitable for a travel website. Focus on its most iconic aspect or viewpoint. Avoid any text overlays or people if not essential to the scene. Aim for a photorealistic style.`;
        const imageGenResponse = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: imagePrompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
             safetySettings: [
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            ],
          },
        });
        if (imageGenResponse.media?.url) {
          imageUrl = imageGenResponse.media.url;
        } else {
           console.warn(`Image generation for place '${finalPlaceNameForImage}' returned no media URL. Using fallback.`);
        }
      } else {
          console.log(`Skipping image generation for '${finalPlaceNameForImage}' as it was not found in Nepal.`);
      }
    } catch (imgError) {
      console.error(`Error generating image for place '${finalPlaceNameForImage}':`, imgError);
    }

    return {
      ...textDetails,
      imageUrl,
      imageAiHint,
    };
  }
);
