# Nepal Explore

## Description

Nepal Explore is a Next.js application designed to help users explore Nepal, discover its districts, plan trips, and create virtual postcards. It leverages AI to generate itineraries, district descriptions, and recommendations, providing a rich and interactive experience for travelers and those interested in learning more about Nepal.

## Features

*   **Interactive Map:** Explore Nepal's districts using an interactive map.
*   **District Explorer:** Discover detailed information about each district, including descriptions and images.
*   **AI-Powered Itinerary Planner:** Generate personalized travel itineraries based on your preferences. You can also suggest modifications to refine your itinerary.
*   **Virtual Postcard Creator:** Create and share virtual postcards featuring stunning landscapes and cultural elements of Nepal.
*   **Recommendation Engine:** Get recommendations for places to visit and activities to do based on AI algorithms.
*   **User Authentication:** Sign up, sign in, and manage your account.
*   **Sustainability Focus:** Learn about sustainable travel practices in Nepal.

## Technologies Used

*   **Next.js:** React framework for building the user interface.
*   **TypeScript:** Programming language for type safety and improved code quality.
*   **Tailwind CSS:** CSS framework for styling the application.
*   **Firebase:** Backend platform for authentication, data storage, and more.
*   **Genkit:** Used for AI flows such as itinerary generation and district descriptions.
*   **TopoJSON:** Used for storing geographical data for the interactive map.
*   **Various UI Libraries:** Radix UI, Shadcn UI

## Project Structure

*   `src/app`: Contains the Next.js application routes and pages.
*   `src/components`: Houses reusable React components.
*   `src/lib`: Includes utility functions and Firebase initialization.
*   `src/types`: Defines TypeScript types used throughout the application.
*   `public/data`: Stores data files, including TopoJSON files for the map.
*   `src/ai`: Contains AI related flows implemented using Genkit.
*   `src/hooks`: Includes custom React hooks.

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    ```

2.  Navigate to the project directory:

    ```bash
    cd nepal-explore
    ```

3.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

4.  Set up Firebase: Create a Firebase project and configure the necessary credentials in `src/lib/firebase.ts`.

5.  Configure Environment Variables: Ensure you have the necessary environment variables configured for your AI flows and other services.

## Running the Project

1.  Start the development server:

    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

2.  Open your browser and visit `http://localhost:3000` to view the application.

## AI Flows

The project utilizes several AI flows to enhance the user experience:

*   `src/ai/flows/ai-itinerary-tool.ts`: Generates travel itineraries.
*   `src/ai/flows/generate-district-image-flow.ts`: Generates images for districts.
*   `src/ai/flows/get-district-description-flow.ts`: Generates descriptions for districts.
*   `src/ai/flows/get-district-details-flow.ts`: Fetches detailed information about districts.
*   `src/ai/flows/get-place-description-flow.ts`: Generates descriptions for specific places.
*   `src/ai/flows/get-recommendations-flow.ts`: Provides recommendations for places and activities.
*   `src/ai/flows/hidden-gems-suggestions.ts`: Suggests hidden gems in Nepal.
*   `src/ai/flows/tour-guide-chat-flow.ts`: Implements a tour guide chatbot.
*   `src/ai/flows/virtual-postcards.ts`: Creates virtual postcards.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues to suggest improvements or report bugs.

## License

[MIT](https://opensource.org/license/mit/)
