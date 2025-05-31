
"use client";

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Star, Info, ImageOff, ThumbsUp, Mountain, Waves, Building2, Trees, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRecommendations, type GetRecommendationsOutput, type RecommendationCategory } from '@/ai/flows/get-recommendations-flow';
import type { Metadata } from 'next';
import { logUserEvent } from '@/lib/logger';

// Static metadata for the Recommendations page - this needs to be in a separate layout.tsx or handled differently for client components
// For now, we'll focus on the page functionality. If dynamic metadata is needed based on category, it's more complex.

// export const metadata: Metadata = { // This won't work directly in a "use client" component for static generation
//   title: 'AI Travel Recommendations for Nepal | Visit Nepal',
//   description: 'Get AI-powered travel recommendations for treks, lakes, cities, national parks, and mountains in Nepal. Plan your perfect tour.',
//   keywords: ['Nepal Recommendations', 'AI Travel Nepal', 'Nepal Treks', 'Nepal Lakes', 'Nepal Cities', 'Nepal National Parks', 'Nepal Mountains', 'Travel AI'],
// };


const categories: { name: string; id: RecommendationCategory; icon: React.ElementType }[] = [
  { name: "Treks", id: "treks", icon: Mountain },
  { name: "Lakes", id: "lakes", icon: Waves },
  { name: "Cities", id: "cities", icon: Building2 },
  { name: "National Parks", id: "national-parks", icon: Trees },
  { name: "Mountains", id: "mountains", icon: ThumbsUp }, // Using ThumbsUp as a general "Best Of" for mountains
];

export default function RecommendationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<RecommendationCategory | null>(null);
  const [recommendation, setRecommendation] = useState<GetRecommendationsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
     logUserEvent({ eventName: 'PageView', eventData: { page: 'RecommendationsPage' } });
  }, []);

  const fetchRecommendations = useCallback(async (category: RecommendationCategory) => {
    setSelectedCategory(category);
    setIsLoading(true);
    setError(null);
    setRecommendation(null);
    setImageError(false);
    logUserEvent({ eventName: 'FetchRecommendationsAttempt', eventData: { category }});

    try {
      const result = await getRecommendations({ category });
      setRecommendation(result);
      if (!result.imageUrl || result.imageUrl.includes('placehold.co')) {
        // If AI didn't provide an image or it's a known placeholder, flag it.
        // This isn't strictly necessary if the flow always returns a valid URL (even if placeholder)
        // but can be useful for more specific frontend handling.
      }
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
      const errorMessage = e instanceof Error ? e.message : "Could not load recommendations.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
       logUserEvent({ eventName: 'FetchRecommendationsFailure', eventData: { category, error: errorMessage }});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return (
    <div className="container py-12 md:py-16">
      <div className="text-center mb-12">
        <Star className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-primary">Discover Nepal's Best</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          Let our AI guide you! Select a category to get personalized recommendations for your Nepal adventure.
        </p>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-semibold text-center text-foreground mb-6">Choose a Category:</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="lg"
              className={`text-base h-14 ${selectedCategory === cat.id ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'border-primary text-primary hover:bg-primary/10'}`}
              onClick={() => fetchRecommendations(cat.id)}
              disabled={isLoading && selectedCategory === cat.id}
            >
              {isLoading && selectedCategory === cat.id ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <cat.icon className="mr-2 h-5 w-5" />
              )}
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      <div id="category-content" className="mt-12 min-h-[300px]">
        {isLoading && (
          <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
            <CardTitle className="text-2xl text-primary">Fetching Recommendations...</CardTitle>
            <CardDescription className="text-lg mt-2">
              Our AI is working its magic for {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'you'}!
            </CardDescription>
          </Card>
        )}

        {!isLoading && error && (
          <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-destructive/10 border-destructive p-6">
            <Info className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl text-destructive">Something Went Wrong</CardTitle>
            <CardDescription className="text-lg mt-2 text-destructive/90">
              Sorry, recommendations could not be loaded. Please try a different category or try again later. <br /> ({error})
            </CardDescription>
          </Card>
        )}

        {!isLoading && !error && recommendation && (
          <Card className="shadow-xl overflow-hidden border">
            <CardHeader className="bg-primary/5 p-6">
              <CardTitle className="text-3xl text-primary flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-accent" />
                AI Recommendations for {categories.find(c => c.id === recommendation.category)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid md:grid-cols-2 gap-6 items-start">
              <div className="relative aspect-video w-full rounded-lg overflow-hidden shadow-md border bg-muted">
                {!imageError && recommendation.imageUrl ? (
                  <Image
                    src={recommendation.imageUrl}
                    alt={`AI generated image for ${recommendation.category} in Nepal`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    onError={() => {
                        console.warn(`Failed to load image: ${recommendation.imageUrl}`);
                        setImageError(true);
                    }}
                    data-ai-hint={`${recommendation.category} nepal`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
                    <ImageOff className="h-16 w-16 mb-2" />
                    <p>Image not available</p>
                  </div>
                )}
              </div>
              <div className="prose prose-lg dark:prose-invert max-w-none text-foreground/90">
                 <p className="whitespace-pre-line leading-relaxed">{recommendation.text}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && !recommendation && (
           <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border p-6">
            <Star className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-2xl">Ready for Recommendations?</CardTitle>
            <CardDescription className="text-lg mt-2">
              Select a category above to see what Nepal has to offer!
            </CardDescription>
          </Card>
        )}
      </div>
    </div>
  );
}
