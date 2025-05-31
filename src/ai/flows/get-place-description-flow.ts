
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

const GetPlaceDescriptionInputSchema = z.object({
  placeName: z.string().describe('The name of the place in Nepal to get details for (e.g., "Pashupatinath Temple", "Rara Lake", "Everest Base Camp Trek").'),
});
export type GetPlaceDescriptionInput = z.infer<typeof GetPlaceDescriptionInputSchema>;

// Schema for what the text model should return for EACH item (structured details)
const PlaceDetailsTextModelOutputSchema = z.object({
  name: z.string().describe("The official or commonly known name of the place, should match the input placeName if possible."),
  tagline: z.string().describe("A very short, catchy, and descriptive tagline for the place (1 sentence maximum)."),
  description: z.string().describe("A detailed and engaging description of the place, its significance, what makes it special for travelers, and what visitors can expect (target 3-5 sentences)."),
  attractions: z.array(z.string()).min(1).max(5).describe("A list of 1 to 5 key attractions, specific points of interest, or main activities directly related to this place. (e.g., for a lake: specific viewpoints, boating; for a trek: key passes, base camps). Be specific."),
  howToReach: z.string().describe("Brief, practical information on how to reach this place (e.g., 'Fly to Lukla (30 mins) then trek for 8 days', 'Approx. 6-7 hour tourist bus ride from Kathmandu, then a short taxi', 'Located within Bhaktapur Durbar Square, easily accessible by local bus or taxi from Kathmandu (1 hour)'). Include common modes of transport and general accessibility from a major hub like Kathmandu or Pokhara."),
  bestTimeToVisit: z.string().describe("The best time of year or specific seasons to visit this place, considering weather, views, and local conditions (e.g., 'Spring (March-May) and Autumn (September-November) for clear skies and pleasant trekking weather')."),
  localTips: z.array(z.string()).min(1).max(3).describe("A list of 1 to 3 practical local tips for visitors (e.g., 'Carry enough water and snacks.', 'Respect local customs by dressing modestly.', 'Entry permits (TIMS and National Park) are required for this trek.').")
});


// Schema for the final output of the FLOW (includes imageUrl for each item)
const GetPlaceDescriptionOutputSchema = PlaceDetailsTextModelOutputSchema.extend({
  imageUrl: z.string().url().describe("URL of the generated image for this specific place. Expected format: 'data:image/png;base64,<encoded_data>'."),
  imageAiHint: z.string().optional().describe("Keywords for Unsplash/placeholder if AI image fails for this place.")
});
export type GetPlaceDescriptionOutput = z.infer<typeof GetPlaceDescriptionOutputSchema>;


const FALLBACK_IMAGE_URL_PLACE = "https://placehold.co/800x500.png?text=Nepal+Attraction";
const FALLBACK_PLACE_DETAILS: Omit<GetPlaceDescriptionOutput, 'imageUrl' | 'imageAiHint' | 'name'> = {
    tagline: "An intriguing destination in Nepal offering unique experiences and sights.",
    description: "Discover the unique beauty, culture, and significance of this fascinating place in Nepal. More detailed information is being curated by our AI.",
    attractions: ["Key points of interest and activities will be listed here soon."],
    howToReach: "Typically accessible from major cities like Kathmandu or Pokhara; specific routes and travel times depend on the exact location and mode of transport.",
    bestTimeToVisit: "Nepal offers diverse climates; the best time to visit varies by region and altitude. Generally, spring and autumn are popular.",
    localTips: ["Always respect local culture and traditions.", "Stay hydrated, especially at higher altitudes.", "Be prepared for varying weather conditions."]
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
      const textPrompt = `You are an expert Nepal travel guide and content creator. For the specific place named "${placeName}" in Nepal, provide detailed, engaging, and accurate information for a travel website. If the place is a trek, focus on the trek itself (e.g., "Everest Base Camp Trek"). If it's a specific temple, focus on that temple.

      Generate the following as a JSON object. Ensure all fields are populated with relevant and specific information:
      1.  **name:** The official or commonly known name, ideally matching "${placeName}".
      2.  **tagline:** A very short, catchy, and descriptive tagline for "${placeName}" (maximum 1 sentence, e.g., "The spiritual heart of Kathmandu, a UNESCO World Heritage site.").
      3.  **description:** A detailed and engaging description of "${placeName}", covering its significance, what makes it special for travelers, and what visitors can expect. Aim for 3-5 well-crafted sentences.
      4.  **attractions:** A list (JSON array of strings) of 2 to 4 key attractions, specific points of interest, or main activities directly related to this place. (e.g., for a lake: "Boating on the serene waters", "Hiking to a nearby viewpoint for panoramic vistas"; for a trek: "Crossing the Thorong La Pass", "Reaching Annapurna Base Camp"). Be specific and actionable.
      5.  **howToReach:** Brief, practical information on how to reach "${placeName}". Include common modes of transport and general accessibility, ideally from a major hub like Kathmandu or Pokhara. (e.g., "Fly from Kathmandu to Lukla (30 mins), then begin the 8-day trek.", "Approx. 6-7 hour tourist bus ride from Kathmandu to Pokhara, then a 30-minute taxi to Phewa Lake's north shore.", "Located within Bhaktapur Durbar Square, easily accessible by local bus or taxi from Kathmandu (approx. 1 hour).").
      6.  **bestTimeToVisit:** The best time of year or specific seasons to visit "${placeName}", considering weather, views, and local conditions. (e.g., "Spring (March to May) and Autumn (September to November) offer clear skies and pleasant trekking weather.", "October to March for comfortable temperatures in the Terai region.").
      7.  **localTips:** A list (JSON array of strings) of 2 to 3 practical and specific local tips for visitors (e.g., "Carry enough water and snacks for the day hike.", "Respect local customs by dressing modestly when visiting monasteries.", "Entry permits (TIMS card and National Park permit) are required for this trek and can be obtained in Kathmandu or Pokhara.").

      Your output MUST be a JSON object strictly matching this structure. Do not add any extra explanations outside the JSON.
      Example for input "Rara Lake":
      {
        "name": "Rara Lake",
        "tagline": "Nepal's largest and deepest freshwater lake, a stunning turquoise jewel nestled in the remote Himalayas.",
        "description": "Rara Lake, located in the Mugu district, is a breathtaking high-altitude lake renowned for its crystal-clear waters and serene surroundings. It's part of Rara National Park, offering a pristine natural environment with diverse flora and fauna. The journey to Rara itself is an adventure, rewarding visitors with unparalleled tranquility and stunning alpine scenery.",
        "attractions": ["Boating on the lake's placid waters", "Horse riding around the lake perimeter", "Hiking to Murma Top for panoramic Himalayan views", "Exceptional bird watching opportunities"],
        "howToReach": "Fly from Nepalgunj to Talcha Airport (approx. 45 mins), then a 2-3 hour walk/hike to the lake. Alternatively, a multi-day trek from Jumla is possible for adventurers.",
        "bestTimeToVisit": "Spring (April-May) and Autumn (September-October) for clear skies, blooming wildflowers (spring), and pleasant temperatures.",
        "localTips": ["Acclimatize properly due to the high altitude (around 3000m).", "Carry basic medical supplies as facilities are limited.", "Camping facilities and basic guesthouses are available; book in advance during peak season."]
      }
      `;

      const textResponse = await ai.generate({
        prompt: textPrompt,
        output: { schema: PlaceDetailsTextModelOutputSchema },
        config: { temperature: 0.4 }
      });

      if (textResponse.output && textResponse.output.name) { // Check if AI returned a name
        textDetails = {
            ...FALLBACK_PLACE_DETAILS, // Start with fallback
            name: textResponse.output.name, // Prioritize AI name
            tagline: textResponse.output.tagline || FALLBACK_PLACE_DETAILS.tagline,
            description: textResponse.output.description || FALLBACK_PLACE_DETAILS.description,
            attractions: textResponse.output.attractions && textResponse.output.attractions.length > 0 ? textResponse.output.attractions : FALLBACK_PLACE_DETAILS.attractions,
            howToReach: textResponse.output.howToReach || FALLBACK_PLACE_DETAILS.howToReach,
            bestTimeToVisit: textResponse.output.bestTimeToVisit || FALLBACK_PLACE_DETAILS.bestTimeToVisit,
            localTips: textResponse.output.localTips && textResponse.output.localTips.length > 0 ? textResponse.output.localTips : FALLBACK_PLACE_DETAILS.localTips,
        };
      } else {
        console.warn(`Text generation for place '${placeName}' returned no valid output or missing name. Using fallback details with input placeName.`);
        textDetails = { name: placeName, ...FALLBACK_PLACE_DETAILS };
      }
    } catch (error) {
      console.error(`Error generating text details for place ${placeName}:`, error);
      textDetails = { name: placeName, ...FALLBACK_PLACE_DETAILS }; // Use input placeName for fallback if AI fails
    }

    // Step 2: Generate image for the place
    let imageUrl = FALLBACK_IMAGE_URL_PLACE;
    // Use the name from textDetails (which is either AI-generated or the input placeName) for consistency
    const finalPlaceNameForImage = textDetails.name;
    const imageAiHint = `${finalPlaceNameForImage} Nepal travel photo`;
    try {
      const imagePrompt = `Generate a high-resolution, captivating travel photograph showcasing "${finalPlaceNameForImage}" in Nepal. The image should be scenic, inspiring, and suitable for a travel website. Focus on its most iconic aspect or viewpoint. Avoid any text overlays or people if not essential to the scene. Aim for a photorealistic style.`;
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
    } catch (imgError) {
      console.error(`Error generating image for place '${finalPlaceNameForImage}':`, imgError);
    }

    return {
      ...textDetails, // name is already in textDetails
      imageUrl,
      imageAiHint,
    };
  }
);
    