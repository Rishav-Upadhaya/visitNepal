
'use server';
/**
 * @fileOverview Provides travel recommendations (text and image) for a specific category in Nepal using AI.
 *
 * - getRecommendations - Fetches AI-generated text and an image for a category.
 * - GetRecommendationsInput - Input type for the getRecommendations function.
 * - GetRecommendationsOutput - Output type for the getRecommendations function.
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

const GetRecommendationsOutputSchema = z.object({
  text: z.string().describe('A descriptive paragraph with recommendations for the category.'),
  imageUrl: z.string().url().describe('A URL for a relevant image (either AI-generated data URI or a fallback URL).'),
  category: CategoryEnum.describe('The category for which recommendations were generated.'),
});
export type GetRecommendationsOutput = z.infer<typeof GetRecommendationsOutputSchema>;

const textPrompts: Record<RecommendationCategory, string> = {
  treks: "You are a Nepal travel expert. Provide a concise travel guide (around 150 words) describing 2-3 popular treks in Nepal suitable for different experience levels. Include brief highlights for each, common starting points, and the best seasons to visit. Focus on inspiring details.",
  lakes: "You are a Nepal travel expert. Describe 2-3 stunning lakes in Nepal (around 150 words), from well-known to slightly lesser-known. Mention their location, key attractions (e.g., boating, views, tranquility), and how to generally reach them. Highlight what makes each unique.",
  cities: "You are a Nepal travel expert. Highlight 2-3 major cities in Nepal (around 150 words), focusing on their unique character (e.g., historical, cultural, gateway to adventure). Briefly mention 1-2 key attractions for each and what makes them worth visiting for a tourist.",
  "national-parks": "You are a Nepal travel expert. Showcase 2-3 prominent National Parks in Nepal (around 150 words). For each, mention its primary wildlife or natural features, a key activity (e.g., safari, bird watching), and its general location. Emphasize conservation and unique ecosystems.",
  mountains: "You are a Nepal travel expert. Describe the allure of 2-3 iconic mountains or mountain ranges in Nepal (around 150 words), including famous peaks or regions known for panoramic views. Mention why they are significant for travelers (e.g., trekking, expeditions, breathtaking scenery, spiritual importance)."
};

const imagePrompts: Record<RecommendationCategory, string> = {
  treks: "Generate a high-resolution, captivating travel photograph of a famous trekking trail in the Nepal Himalayas with majestic mountains in the background and perhaps some trekkers. Scenic and inspiring. No text overlays.",
  lakes: "Generate a high-resolution, captivating travel photograph of a serene mountain lake in Nepal with reflections of snow-capped peaks or lush green hills. Peaceful and beautiful. No text overlays.",
  cities: "Generate a high-resolution, captivating travel photograph of a vibrant and culturally rich city scene in Nepal, possibly showing historical architecture like temples or stupas, or bustling local life and markets. Authentic and inviting. No text overlays.",
  "national-parks": "Generate a high-resolution, captivating travel photograph showcasing Nepal's National Parks: featuring diverse wildlife like a one-horned rhinoceros or a Bengal tiger in its natural Terai habitat, or a lush jungle landscape with unique flora. Focus on the wild beauty. No text overlays.",
  mountains: "Generate a high-resolution, captivating travel photograph of majestic snow-capped Himalayan peaks in Nepal, possibly at sunrise or sunset, showcasing their grandeur and scale. Awe-inspiring. No text overlays."
};

const FALLBACK_IMAGE_URL = "https://placehold.co/800x600.png?text=Nepal+Recommendation";
const FALLBACK_TEXT = "Nepal offers incredible experiences in this category. From breathtaking natural beauty to rich cultural encounters, there's so much to explore. Plan your adventure to discover the wonders that await!";


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
    const selectedTextPrompt = textPrompts[category];
    const selectedImagePrompt = imagePrompts[category];

    try {
      const [textResponse, imageResponse] = await Promise.all([
        ai.generate({ prompt: selectedTextPrompt }),
        ai.generate({
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: selectedImagePrompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            safetySettings: [ // Lenient safety settings for broader image generation
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            ],
          },
          output: { schema: z.string() } // Expecting text for image gen, then extract media
        })
      ]);
      
      const generatedText = textResponse.text || FALLBACK_TEXT;
      const generatedImageUrl = imageResponse.media?.url || FALLBACK_IMAGE_URL;

      if (!imageResponse.media?.url) {
        console.warn(`Image generation for category '${category}' returned no media URL. Using fallback.`);
      }
       if (!textResponse.text) {
        console.warn(`Text generation for category '${category}' returned no text. Using fallback.`);
      }

      return {
        text: generatedText,
        imageUrl: generatedImageUrl,
        category: category,
      };
    } catch (error) {
      console.error(`Error in getRecommendationsFlow for category ${category}:`, error);
      return {
        text: FALLBACK_TEXT,
        imageUrl: FALLBACK_IMAGE_URL,
        category: category,
      };
    }
  }
);
