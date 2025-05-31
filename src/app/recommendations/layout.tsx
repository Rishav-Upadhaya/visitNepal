
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Travel Recommendations for Nepal | Visit Nepal',
  description: 'Get AI-powered travel recommendations for treks, lakes, cities, national parks, and mountains in Nepal. Plan your perfect tour with Visit Nepal.',
  keywords: ['Nepal Recommendations', 'AI Travel Nepal', 'Nepal Treks', 'Nepal Lakes', 'Nepal Cities', 'Nepal National Parks', 'Nepal Mountains', 'Travel AI', 'Visit Nepal Guide'],
  openGraph: {
      title: 'AI Travel Recommendations for Nepal | Visit Nepal',
      description: 'Discover AI-curated recommendations for your Nepal adventure.',
      // Add a relevant image URL for social sharing if available
      // images: [{ url: 'https://your-domain.com/og-recommendations.jpg' }],
  },
  twitter: {
      title: 'AI Travel Recommendations for Nepal | Visit Nepal',
      description: 'Explore AI-powered suggestions for travel in Nepal.',
      // card: 'summary_large_image',
      // images: ['https://your-domain.com/twitter-recommendations.jpg'],
  }
};

export default function RecommendationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
