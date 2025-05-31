
import { config } from 'dotenv';
config();

// Keep AI flow imports grouped
import '@/ai/flows/ai-itinerary-tool.ts';
import '@/ai/flows/generate-district-image-flow.ts';
import '@/ai/flows/get-district-description-flow.ts';
import '@/ai/flows/get-district-details-flow.ts';
import '@/ai/flows/hidden-gems-suggestions.ts';
import '@/ai/flows/tour-guide-chat-flow.ts';
import '@/ai/flows/virtual-postcards.ts';
import '@/ai/flows/get-recommendations-flow.ts'; // Added new flow
// Add new flows above this line if any future flows are created.

// Ensure this file is primarily for development-time Genkit flow registration.
// Avoid adding application logic here.
