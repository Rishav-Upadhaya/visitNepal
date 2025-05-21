
// src/app/api/log-event/route.ts
import { NextResponse, type NextRequest } from 'next/server';

interface LogEventPayload {
  eventName: string;
  eventData?: Record<string, any>;
  timestamp?: string;
  path?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LogEventPayload;
    const { eventName, eventData, timestamp, path } = body;

    // Basic validation
    if (!eventName || typeof eventName !== 'string') {
      return NextResponse.json({ error: 'eventName is required and must be a string.' }, { status: 400 });
    }

    const logTimestamp = timestamp || new Date().toISOString();
    const logPath = path || 'N/A';

    // Prepare eventData string for logging
    const eventDataString = (eventData && Object.keys(eventData).length > 0)
      ? JSON.stringify(eventData)
      : 'None';

    // Log to server console with the new refined format
    console.log(`[USER_ACTION] ${eventName} { ${eventDataString} } on page ${logPath} at ${logTimestamp}`);

    return NextResponse.json({ message: 'Event logged successfully' }, { status: 200 });
  } catch (error) {
    console.error('[LOG_API_ERROR] Error processing log event:', error);
    let errorMessage = 'Failed to process log event.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
