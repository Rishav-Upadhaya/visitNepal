// src/app/api/generate-district-description/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getDistrictDescription, type GetDistrictDescriptionInput, type GetDistrictDescriptionOutput } from '@/ai/flows/get-district-description-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { districtName } = body as GetDistrictDescriptionInput;

    if (!districtName || typeof districtName !== 'string' || districtName.trim() === "") {
      return NextResponse.json({ error: 'districtName is required and must be a non-empty string.' }, { status: 400 });
    }

    console.log(`API: Received request to generate description for district: ${districtName}`);

    const result: GetDistrictDescriptionOutput = await getDistrictDescription({ districtName });

    if (result && typeof result.description === 'string') {
        console.log(`API: Successfully generated description for ${districtName}`);
        return NextResponse.json(result);
    } else {
        // This case should ideally be handled within the flow itself by returning a fallback
        console.error(`API: AI flow returned an invalid or empty description for ${districtName}. Result:`, result);
        return NextResponse.json({ error: `Failed to generate a valid description for ${districtName}. AI returned an unexpected result.` }, { status: 500 });
    }

  } catch (error) {
    console.error('API Error in /api/generate-district-description:', error);
    let errorMessage = 'Failed to generate district description.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    // Check if it's a Zod validation error or other specific error types from the flow if needed
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
