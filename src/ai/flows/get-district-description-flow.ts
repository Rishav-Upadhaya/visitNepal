
'use server';
/**
 * @fileOverview Generates a short description for a Nepalese district using AI.
 *
 * - getDistrictDescription - A function that generates a district description.
 * - GetDistrictDescriptionInput - The input type for the getDistrictDescription function.
 * - GetDistrictDescriptionOutput - The return type for the getDistrictDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetDistrictDescriptionInputSchema = z.object({
  districtName: z.string().describe('The name of the Nepalese district.'),
});
export type GetDistrictDescriptionInput = z.infer<typeof GetDistrictDescriptionInputSchema>;

const GetDistrictDescriptionOutputSchema = z.object({
  description: z.string().describe('A concise, engaging, one-sentence travel-oriented description for the district.'),
});
export type GetDistrictDescriptionOutput = z.infer<typeof GetDistrictDescriptionOutputSchema>;

export async function getDistrictDescription(input: GetDistrictDescriptionInput): Promise<GetDistrictDescriptionOutput> {
  if (!input.districtName || input.districtName.trim() === "") {
    console.warn("getDistrictDescription: districtName is empty, returning default description.");
    return { description: "Explore this fascinating district of Nepal to discover its unique attractions and culture." };
  }
  return getDistrictDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getDistrictDescriptionPrompt',
  input: {schema: GetDistrictDescriptionInputSchema},
  output: {schema: GetDistrictDescriptionOutputSchema},
  prompt: `You are a helpful travel assistant. Generate a concise, engaging, one-sentence travel-oriented description for the Nepalese district of {{{districtName}}}.
Focus on what makes it unique for a tourist or a key highlight.
The description should be suitable for a map info box.
Example for 'Kathmandu': Kathmandu, the vibrant capital, is a captivating blend of ancient temples, rich cultural heritage, and bustling city life.
Example for 'Solukhumbu': Solukhumbu is renowned as the gateway to Mount Everest, offering breathtaking Himalayan treks and unique Sherpa culture.
Example for 'Chitwan': Chitwan National Park offers thrilling jungle safaris with chances to see rhinos, tigers, and diverse wildlife in Nepal's Terai.

District: {{{districtName}}}
Description:
`,
});

const getDistrictDescriptionFlow = ai.defineFlow(
  {
    name: 'getDistrictDescriptionFlow',
    inputSchema: GetDistrictDescriptionInputSchema,
    outputSchema: GetDistrictDescriptionOutputSchema,
  },
  async (input): Promise<GetDistrictDescriptionOutput> => {
    try {
      const llmResponse = await prompt(input);

      if (llmResponse && llmResponse.output && typeof llmResponse.output.description === 'string' && llmResponse.output.description.trim() !== "") {
        return llmResponse.output;
      } else {
        console.warn(`AI did not return a valid description object for ${input.districtName}. LLM response:`, JSON.stringify(llmResponse));
        return { description: `Discover the unique charm and attractions of ${input.districtName}, a notable district in Nepal.` }; // Fallback
      }
    } catch (error) {
      console.error(`Error in getDistrictDescriptionFlow for ${input.districtName}:`, error);
      // Return a structured error or fallback description adhering to the schema
      return { description: `Information for ${input.districtName} is being updated. Explore its rich heritage and natural beauty!` };
    }
  }
);
