
// src/lib/logger.ts
"use client"; // This utility will be used by client components

interface LogEventOptions {
  eventName: string;
  eventData?: Record<string, any>;
}

export async function logUserEvent({ eventName, eventData }: LogEventOptions): Promise<void> {
  try {
    const payload = {
      eventName,
      eventData: eventData || {},
      timestamp: new Date().toISOString(),
      path: window.location.pathname + window.location.search,
    };

    // Fire-and-forget for simplicity, no need to await or handle response in client usually
    fetch('/api/log-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(error => {
      // Log client-side error if the fetch itself fails (e.g., network down)
      // This won't catch server-side errors from the API route, those are logged on the server.
      console.error('Client-side error logging event:', error);
    });
  } catch (error) {
    console.error('Error constructing log payload:', error);
  }
}
