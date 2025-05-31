
'use server';
/**
 * @fileOverview Provides travel recommendations (multiple items per category, each with text and image) for Nepal using AI.
 *
 * - getRecommendations - Fetches AI-generated text and images for multiple items within a category.
 * - GetRecommendationsInput - Input type for the getRecommendations function.
 * - GetRecommendationsOutput - Output type for the getRecommendations function.
 * - RecommendationCategory - Type for recommendation categories.
 * - RecommendedItem - Type for individual recommended items.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CATEGORIES = ["treks", "lakes", "cities", "national-parks", "mountains"] as const;
const CategoryEnum = z.enum(CATEGORIES);
export type RecommendationCategory = z.infer<typeof CategoryEnum>;

const GetRecommendationsInputSchema = z.object({
  category: CategoryEnum.describe('The category for which to get recommendations.'),
});
export type GetRecommendationsInput = z.infer<typeof GetRecommendationsInputSchema>;

// Schema for what the text model should return (list of names and descriptions)
const TextModelRecommendedItemSchema = z.object({
  name: z.string().describe("The specific name of the recommended place or item (e.g., 'Everest Base Camp Trek', 'Phewa Lake')."),
  description: z.string().describe("A short, engaging description (2-3 sentences) of this specific item, including unique aspects or tips."),
});

const TextModelResponseSchema = z.object({
  recommendations: z.array(TextModelRecommendedItemSchema).min(2).max(4).describe("An array of 2 to 4 recommended places/items for the given category, each with a name and description.")
});

// Schema for the final output of the FLOW (includes imageUrl for each item)
const FinalRecommendedItemSchema = TextModelRecommendedItemSchema.extend({
  imageUrl: z.string().url().describe("URL of the generated image for this specific item."),
  imageAiHint: z.string().optional().describe("Keywords for Unsplash/placeholder if AI image fails for this item.")
});
export type RecommendedItem = z.infer<typeof FinalRecommendedItemSchema>;

const GetRecommendationsOutputSchema = z.object({
  category: CategoryEnum.describe('The category for which recommendations were generated.'),
  items: z.array(FinalRecommendedItemSchema).describe('A list of recommended items for the category, each with its own name, description, and image URL.'),
});
export type GetRecommendationsOutput = z.infer<typeof GetRecommendationsOutputSchema>;


const generateTextPromptStructure = (category: RecommendationCategory): string => {
  let itemFocus = "places or activities";
  if (category === "treks") itemFocus = "treks";
  if (category === "lakes") itemFocus = "lakes";
  if (category === "cities") itemFocus = "cities";
  if (category === "national-parks") itemFocus = "national parks";
  if (category === "mountains") itemFocus = "mountains or famous viewpoints";

  return `You are a Nepal travel expert. For the category "${category}", identify 3 distinct and popular ${itemFocus} in Nepal.
For each of these 3 ${itemFocus}, provide:
1.  A 'name' (e.g., "Annapurna Base Camp Trek", "Phewa Lake", "Kathmandu Durbar Square").
2.  A 'description' (2-3 sentences) highlighting its key features, what makes it special for a tourist, and perhaps a brief tip (e.g., best season, unique experience).

Your output MUST be a JSON object with a single key "recommendations". The value of "recommendations" must be an array of 3 objects, where each object contains the 'name' and 'description' for one recommended item.

Example for category "lakes":
{
  "recommendations": [
    {
      "name": "Phewa Lake",
      "description": "Pokhara's iconic lake, offering stunning Annapurna reflections, boating, and the Tal Barahi Temple on an island. Lakeside offers vibrant cafes and shops. Best visited during spring or autumn for clear views."
    },
    {
      "name": "Rara Lake",
      "description": "Nepal's largest lake, a pristine gem in remote Mugu district. Known for its crystal-clear waters, surrounding forests, and tranquility. Requires a flight and trek, ideal for off-beat adventurers."
    },
    {
      "name": "Shey Phoksundo Lake",
      "description": "A breathtaking turquoise alpine lake in Dolpo, famous for its vivid color and the nearby Bonpo monastery. Featured in Eric Valli's 'Himalaya'. A remote and rewarding trek."
    }
  ]
}

Ensure your response strictly adheres to this JSON structure.
`;
};

const FALLBACK_IMAGE_URL_ITEM = "https://placehold.co/600x400.png?text=Nepal+Attraction";
const FALLBACK_DESCRIPTION_ITEM = "Discover this amazing attraction in Nepal, offering unique experiences and beautiful sights. Plan your visit to explore its wonders!";


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
      // Step 1: Get names and descriptions from the text model
      const textPrompt = generateTextPromptStructure(category);
      const textResponse = await ai.generate({
        prompt: textPrompt,
        output: { schema: TextModelResponseSchema }, // Expecting JSON output based on this schema
        config: { temperature: 0.5 } // Adjust temperature for creativity vs. factuality
      });
      
      if (textResponse.output?.recommendations && textResponse.output.recommendations.length > 0) {
        textItems = textResponse.output.recommendations;
      } else {
        console.warn(`Text generation for category '${category}' returned no valid items. Using fallback items.`);
        // Create 2-3 generic fallback items if text generation fails
        textItems = Array(3).fill(null).map((_, i) => ({
            name: `Amazing ${category.slice(0,-1)} #${i + 1}`, // e.g. Amazing trek #1
            description: `Explore this fantastic ${category.slice(0,-1)} in Nepal, known for its unique features and stunning beauty. A must-visit for adventurers and nature lovers alike.`,
        }));
      }
    } catch (error) {
      console.error(`Error generating text recommendations for category ${category}:`, error);
      // Fallback if text generation completely fails
       textItems = Array(3).fill(null).map((_, i) => ({
            name: `Beautiful ${category.slice(0,-1)} #${i + 1}`,
            description: `Discover one of Nepal's prime ${category.slice(0,-1)} offering breathtaking views and unforgettable experiences. Ensure to check local conditions before your visit.`,
        }));
    }

    // Step 2: Generate images for each item
    const finalItems: RecommendedItem[] = [];

    for (const item of textItems) {
      let imageUrl = FALLBACK_IMAGE_URL_ITEM;
      const imageAiHint = `${item.name} ${category} Nepal`; // Construct hint

      try {
        const imagePrompt = `Generate a high-resolution, captivating travel photograph showcasing "${item.name}" in Nepal, relevant to the category '${category}'. The image should be scenic, inspiring, and suitable for a travel website. Avoid any text overlays or people if not essential to the scene. Focus on natural beauty or iconic man-made structures if applicable.`;
        
        const imageGenResponse = await ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: imagePrompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
             safetySettings: [ // Lenient safety settings
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
          console.warn(`Image generation for item '${item.name}' in category '${category}' returned no media URL. Using fallback.`);
        }
      } catch (imgError) {
        console.error(`Error generating image for item '${item.name}' in category ${category}:`, imgError);
        // imageUrl remains FALLBACK_IMAGE_URL_ITEM
      }
      
      finalItems.push({
        name: item.name || `Unnamed ${category.slice(0,-1)}`,
        description: item.description || FALLBACK_DESCRIPTION_ITEM,
        imageUrl: imageUrl,
        imageAiHint: imageAiHint,
      });
    }
    
    if (finalItems.length === 0) { // Should not happen if textItems fallback works
        console.error(`No items could be processed for category ${category}. This is an unexpected state.`);
        // Potentially return a more generic error structure or throw
        return {
            category: category,
            items: [{
                name: `Explore ${category}`,
                description: "No specific recommendations available at the moment. Nepal offers diverse experiences in this category!",
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

    