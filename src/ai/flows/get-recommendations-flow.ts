
'use server';
/**
 * @fileOverview Provides travel recommendations (multiple items per category, each with structured details and image) for Nepal using AI.
 *
 * - getRecommendations - Fetches AI-generated structured details and images for multiple items within a category.
 * - GetRecommendationsInput - Input type for the getRecommendations function.
 * - GetRecommendationsOutput - Output type for the getRecommendationsOutput function.
 * - RecommendationCategory - Type for recommendation categories.
 * - RecommendedItem - Type for individual recommended items.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CATEGORIES = ["treks", "lakes", "cities", "national-parks", "hike", "scenic-views"] as const;
const CategoryEnum = z.enum(CATEGORIES);
export type RecommendationCategory = z.infer<typeof CategoryEnum>;

const GetRecommendationsInputSchema = z.object({
  category: CategoryEnum.describe('The category for which to get recommendations.'),
});
export type GetRecommendationsInput = z.infer<typeof GetRecommendationsInputSchema>;

// Schema for what the text model should return for EACH item (structured details)
const TextModelRecommendedItemSchema = z.object({
  name: z.string().describe("The specific name of the recommended place or item (e.g., 'Everest Base Camp Trek', 'Phewa Lake')."),
  tagline: z.string().describe("A short, catchy, and descriptive tagline (1-2 sentences) that captures the essence of the place."),
  suggestedDuration: z.string().describe("Suggested number of days one can spend at this place (e.g., '10-12 days for the trek', '2-3 days to explore the city', 'A full day visit')."),
  accommodations: z.array(z.string()).describe("List of 2-4 general types or examples of accommodations available (e.g., 'Tea Houses', 'Luxury Hotels', 'Budget Guesthouses', 'Community Homestays')."),
  nearbyPlaces: z.array(z.string()).optional().describe("List of 2-3 other interesting places or attractions nearby the main recommended item."),
  food: z.array(z.string()).describe("List of 2-4 famous local dishes, food specialties, or types of cuisine prominent in or around the recommended item."),
  routeFromKathmandu: z.string().describe("Brief information on how to reach this place from Kathmandu and the estimated travel duration/days from Kathmandu (e.g., 'Fly to Lukla (30 mins) then trek for 8 days', '6-7 hour bus ride').")
});

const TextModelResponseSchema = z.object({
  recommendations: z.array(TextModelRecommendedItemSchema).min(3).max(4).describe("An array of 3 to 4 recommended places/items for the given category, each with detailed structured information.")
});

// Schema for the final output of the FLOW (includes imageUrl for each item)
const FinalRecommendedItemSchema = TextModelRecommendedItemSchema.extend({
  imageUrl: z.string().url().describe("URL of the generated image for this specific item."),
  imageAiHint: z.string().optional().describe("Keywords for Unsplash/placeholder if AI image fails for this item.")
});
export type RecommendedItem = z.infer<typeof FinalRecommendedItemSchema>;

const GetRecommendationsOutputSchema = z.object({
  category: CategoryEnum.describe('The category for which recommendations were generated.'),
  items: z.array(FinalRecommendedItemSchema).describe('A list of recommended items for the category, each with its own name, structured details, and image URL.'),
});
export type GetRecommendationsOutput = z.infer<typeof GetRecommendationsOutputSchema>;


const generateTextPromptStructure = (category: RecommendationCategory): string => {
  let itemFocus = "places or activities";
  let categorySpecificInstruction = "";
  let exampleItemName = "Example Place Name";
  let exampleTagline = "An amazing example tagline for this place.";
  let exampleDuration = "Varies depending on interest";
  let exampleAccommodations = `["Various suitable options", "Local guesthouses"]`;
  let exampleNearby = `["Nearby Attraction 1", "Another Point of Interest"]`;
  let exampleFood = `["Local specialty dish 1", "Popular regional cuisine"]`;
  let exampleRoute = "Accessible from Kathmandu via a short flight or scenic bus ride.";


  if (category === "treks") {
    itemFocus = "trekking routes";
    categorySpecificInstruction = "Focus on well-known multi-day trekking expeditions in mountainous regions of Nepal.";
    exampleItemName = "Everest Base Camp Trek";
    exampleTagline = "Journey to the foot of the world's highest peak, an iconic Himalayan adventure.";
    exampleDuration = "12-14 days";
    exampleAccommodations = `["Tea Houses along the trail", "Lodges in Namche Bazaar"]`;
    exampleNearby = `["Kala Patthar viewpoint", "Tengboche Monastery"]`;
    exampleFood = `["Dal Bhat (lentil soup with rice)", "Sherpa stew", "Momos"]`;
    exampleRoute = "Fly from Kathmandu to Lukla (30 mins), then begin the trek.";
  } else if (category === "lakes") {
    itemFocus = "lakes";
    categorySpecificInstruction = "Highlight both famous and lesser-known lakes in Nepal, emphasizing their natural beauty and accessibility.";
    exampleItemName = "Phewa Lake";
    exampleTagline = "Pokhara's iconic lake, offering stunning Annapurna reflections, boating, and vibrant lakeside life.";
    exampleDuration = "1-2 days (to explore Pokhara and enjoy the lake)";
    exampleAccommodations = `["Lakeside Hotels (all budgets)", "Guesthouses", "Yoga Retreats"]`;
    exampleNearby = `["World Peace Pagoda", "Sarangkot Viewpoint", "Devi's Fall"]`;
    exampleFood = `["Fresh fish from the lake", "Nepali Thali sets", "International cuisine at Lakeside restaurants"]`;
    exampleRoute = "Fly to Pokhara (25 mins) or take a tourist bus (6-8 hours) from Kathmandu.";
  } else if (category === "cities") {
    itemFocus = "cities";
    categorySpecificInstruction = "Showcase cities in Nepal known for their cultural heritage, historical significance, or vibrant urban life.";
    exampleItemName = "Bhaktapur Durbar Square";
    exampleTagline = "A UNESCO World Heritage site, showcasing ancient Newari art, architecture, and vibrant traditions.";
    exampleDuration = "Full day visit";
    exampleAccommodations = `["Heritage Hotels in Bhaktapur", "Guesthouses", "Day trip from Kathmandu"]`;
    exampleNearby = `["Changu Narayan Temple", "Nagarkot (for views, if combined)"]`;
    exampleFood = `["Juju Dhau (King Curd)", "Newari Khaja Set", "Samay Baji"]`;
    exampleRoute = "Approx. 1-hour taxi or local bus ride east from Kathmandu.";
  } else if (category === "national-parks") {
    itemFocus = "national parks";
    categorySpecificInstruction = "Detail national parks in Nepal, focusing on their unique ecosystems, wildlife, and conservation efforts.";
    exampleItemName = "Chitwan National Park";
    exampleTagline = "A UNESCO World Heritage site in the Terai plains, home to rhinos, tigers, and diverse wildlife.";
    exampleDuration = "2-3 days";
    exampleAccommodations = `["Jungle Lodges inside the park", "Resorts in Sauraha", "Community Homestays"]`;
    exampleNearby = `["Tharu Village tours", "Elephant Breeding Center", "Devghat Dham"]`;
    exampleFood = `["Local Tharu cuisine", "Nepali Thali", "Freshwater fish"]`;
    exampleRoute = "Fly to Bharatpur (20 mins) then 30-min drive to Sauraha, or 5-6 hour tourist bus from Kathmandu/Pokhara.";
  } else if (category === "hike") {
    itemFocus = "hiking trails or scenic walks";
    categorySpecificInstruction = "Focus on popular day hiking trails and scenic walks located *within or immediately around the Kathmandu Valley*. These should be suitable for day trips. Examples include, but are not limited to, Champadevi, Shivapuri National Park trails (e.g., to Nagi Gompa or Bagdwar), Tarebhir, Sundarijal, Jamacho Gumba (Nagarjun Hill). Provide 3 to 4 distinct options.";
    exampleItemName = "Champadevi Hill Hike";
    exampleTagline = "A rewarding day hike near Kathmandu offering panoramic views of the valley and Himalayan ranges.";
    exampleDuration = "4-6 hours (round trip)";
    exampleAccommodations = `["Not applicable for day hike (start/end in Kathmandu)", "Tea shops along the trail for refreshments"]`;
    exampleNearby = `["Dakshinkali Temple (nearby starting point for some routes)"]`;
    exampleFood = `["Packed lunch and snacks recommended", "Local tea and noodles at trailside shops"]`;
    exampleRoute = "Drive from Kathmandu to a trailhead like Pharping or Hattiban (approx. 1-1.5 hours). Trail starts from there.";
  } else if (category === "scenic-views") {
    itemFocus = "scenic viewpoints or places renowned for breathtaking views";
    categorySpecificInstruction = "Highlight places in Nepal famous for their spectacular natural beauty, especially mountain panoramas, unique landscapes, or stunning sunrise/sunset views. Examples include Nagarkot, Poon Hill, Sarangkot, Kala Patthar, or viewpoints in Mustang/Manang.";
    exampleItemName = "Nagarkot View Tower";
    exampleTagline = "Offers expansive Himalayan sunrise and sunset views, including Mount Everest on clear days.";
    exampleDuration = "Overnight stay or early morning trip (1-2 days including travel from Kathmandu)";
    exampleAccommodations = `["Hotels with mountain views", "Resorts", "Guesthouses"]`;
    exampleNearby = `["Changu Narayan Temple (en route or nearby)", "Bhaktapur Durbar Square (can be combined)"]`;
    exampleFood = `["Local Nepali meals", "Continental options at hotels"]`;
    exampleRoute = "Approx. 1.5-2 hour drive east from Kathmandu.";
  }


  return `You are a Nepal travel expert. For the category "${category}", identify 3 to 4 distinct and popular ${itemFocus} in Nepal.
${categorySpecificInstruction}

For each of these ${itemFocus}, provide the following detailed information structured as a JSON object:
1.  **name:** The specific name of the place/item.
2.  **tagline:** A short, catchy, and descriptive tagline (1-2 sentences) that captures its essence.
3.  **suggestedDuration:** Suggested number of days or hours to spend (e.g., "10-12 days for the trek", "2-3 days", "Half-day tour", "6-7 hours hike").
4.  **accommodations:** A list (JSON array of strings) of 2-4 general types or examples of accommodations available (e.g., ["Tea Houses", "Lodges"], ["Luxury Hotels", "Boutique Guesthouses", "Homestays"]).
5.  **nearbyPlaces:** An optional list (JSON array of strings) of 2-3 other interesting places or attractions nearby. If none are particularly relevant or distinct, this can be an empty array or omitted.
6.  **food:** A list (JSON array of strings) of 2-4 famous local dishes, food specialties, or types of cuisine prominent in or around the area (e.g., ["Dal Bhat", "Thukpa"], ["Newari Khaja Set", "Momos"]).
7.  **routeFromKathmandu:** Brief information on how to reach this place from Kathmandu and the estimated travel duration/days from Kathmandu (e.g., "Fly to Lukla (30 mins) then trek for 8 days to reach the base camp", "Approx. 6-7 hour tourist bus ride from Kathmandu", "Located within Kathmandu valley, easily accessible by taxi (30 mins)", "1.5 hour drive to trailhead from Kathmandu for a day hike").

Your output MUST be a JSON object with a single key "recommendations". The value of "recommendations" must be an array of 3 or 4 objects, where each object contains all seven fields ('name', 'tagline', 'suggestedDuration', 'accommodations', 'nearbyPlaces', 'food', 'routeFromKathmandu') for one recommended item.

Example for one item in the "recommendations" array if the category was "${category}" and the item was "${exampleItemName}":
{
  "name": "${exampleItemName}",
  "tagline": "${exampleTagline}",
  "suggestedDuration": "${exampleDuration}",
  "accommodations": ${exampleAccommodations},
  "nearbyPlaces": ${exampleNearby},
  "food": ${exampleFood},
  "routeFromKathmandu": "${exampleRoute}"
}

Ensure your response strictly adheres to this JSON structure and provides all requested fields for each recommended item.
`;
};

const FALLBACK_IMAGE_URL_ITEM = "https://placehold.co/600x400.png?text=Nepal+Attraction";
const FALLBACK_ITEM_DETAILS: Omit<RecommendedItem, 'imageUrl' | 'imageAiHint' | 'name'> = {
    tagline: "An amazing destination in Nepal with unique experiences and beautiful sights.",
    suggestedDuration: "Varies",
    accommodations: ["Various options available"],
    nearbyPlaces: ["Many interesting spots nearby"],
    food: ["Local Nepali cuisine"],
    routeFromKathmandu: "Accessible from Kathmandu, travel time depends on the specific location."
};


export async function getRecommendations(
  input: GetRecommendationsInput
): Promise<GetRecommendationsOutput> {
  return getRecommendationsFlow(input);
}

const getRecommendationsFlow = ai.defineFlow(
  {
    name: 'getRecommendationsFlow',
    inputSchema: GetRecommendationsInputSchema,
    outputSchema: GetRecommendationsOutputSchema,
  },
  async ({ category }) => {
    let textItems: z.infer<typeof TextModelRecommendedItemSchema>[] = [];

    try {
      // Step 1: Get names and structured details from the text model
      const textPrompt = generateTextPromptStructure(category);
      const textResponse = await ai.generate({
        prompt: textPrompt,
        output: { schema: TextModelResponseSchema },
        config: { 
            temperature: 0.3,
            safetySettings: [ // Added safety settings
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            ],
        }
      });

      if (textResponse.output?.recommendations && textResponse.output.recommendations.length > 0) {
        textItems = textResponse.output.recommendations.map(item => ({
            ...FALLBACK_ITEM_DETAILS,
            name: item.name || `Unnamed ${category.slice(0,-1)}`, // Use singular form for unnamed
            tagline: item.tagline || FALLBACK_ITEM_DETAILS.tagline,
            suggestedDuration: item.suggestedDuration || FALLBACK_ITEM_DETAILS.suggestedDuration,
            accommodations: item.accommodations && item.accommodations.length > 0 ? item.accommodations : FALLBACK_ITEM_DETAILS.accommodations,
            nearbyPlaces: item.nearbyPlaces && item.nearbyPlaces.length > 0 ? item.nearbyPlaces : undefined,
            food: item.food && item.food.length > 0 ? item.food : FALLBACK_ITEM_DETAILS.food,
            routeFromKathmandu: item.routeFromKathmandu || FALLBACK_ITEM_DETAILS.routeFromKathmandu,
        }));
      } else {
        console.warn(`Text generation for category '${category}' returned no valid items or malformed data. Using fallback items.`);
        // Create 3 fallback items if AI fails
        textItems = Array(3).fill(null).map((_, i) => ({
            name: `Amazing ${category.endsWith('s') ? category.slice(0,-1) : category} #${i + 1}`, // Handle singular/plural better
            ...FALLBACK_ITEM_DETAILS,
        }));
      }
    } catch (error) {
      console.error(`Error generating text recommendations for category ${category}:`, error);
       textItems = Array(3).fill(null).map((_, i) => ({ // Create 3 fallback items
            name: `Beautiful ${category.endsWith('s') ? category.slice(0,-1) : category} #${i + 1}`,
            ...FALLBACK_ITEM_DETAILS,
        }));
    }

    // Step 2: Generate images for each item in parallel
    const imageGenerationPromises = textItems.map(item => {
      const itemNameStr = typeof item.name === 'string' ? item.name : `Unnamed ${category.slice(0,-1)}`;
      // Make image prompt more specific to the item and category
      const imagePrompt = `Generate a high-resolution, captivating travel photograph showcasing "${itemNameStr}" in Nepal, which is known as a prime example for the category '${category}'. The image should be scenic, inspiring, and suitable for a travel website. Focus on its most iconic aspect or viewpoint. Avoid any text overlays or people if not essential to the scene. Aim for a photorealistic style.`;

      return ai.generate({
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
      }).catch(imgError => { // Catch individual image generation errors
        console.error(`Error generating image for item '${itemNameStr}' in category ${category}:`, imgError);
        return null; // Return null or a specific error object if an image fails
      });
    });

    const imageResults = await Promise.allSettled(imageGenerationPromises);

    const finalItems: RecommendedItem[] = textItems.map((item, index) => {
      const itemNameStr = typeof item.name === 'string' ? item.name : `Unnamed ${category.slice(0,-1)}`;
      const imageAiHint = `${itemNameStr} ${category} Nepal`;
      let imageUrl = FALLBACK_IMAGE_URL_ITEM;

      const result = imageResults[index];
      if (result.status === 'fulfilled' && result.value && result.value.media?.url) {
        imageUrl = result.value.media.url;
      } else {
        if (result.status === 'rejected') {
             console.warn(`Image generation promise rejected for item '${itemNameStr}' in category '${category}'. Reason:`, result.reason);
        } else {
             console.warn(`Image generation for item '${itemNameStr}' in category '${category}' returned no media URL or failed. Using fallback.`);
        }
      }

      return {
        ...item,
        name: itemNameStr, // Ensure name is always a string
        imageUrl: imageUrl,
        imageAiHint: imageAiHint,
      };
    });

    if (finalItems.length === 0) { // Should not happen with fallback, but as a safeguard
        console.error(`No items could be processed for category ${category}. This is an unexpected state.`);
        // Return a single generic fallback if all else fails
        return {
            category: category,
            items: [{
                name: `Explore ${category}`,
                ...FALLBACK_ITEM_DETAILS,
                imageUrl: FALLBACK_IMAGE_URL_ITEM,
                imageAiHint: `${category} Nepal generic`
            }]
        };
    }

    return {
      category: category,
      items: finalItems,
    };
  }
);


    
