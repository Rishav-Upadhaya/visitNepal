
"use client";

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Star, Info, ImageOff, ThumbsUp, Mountain, Waves, Building2, Trees, Sparkles, MapPin, Clock, Home, Utensils, RouteIcon, Compass } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRecommendations, type GetRecommendationsOutput, type RecommendationCategory, type RecommendedItem } from '@/ai/flows/get-recommendations-flow';
import { logUserEvent } from '@/lib/logger';
import { Separator } from '@/components/ui/separator';

const categories: { name: string; id: RecommendationCategory; icon: React.ElementType; description: string; }[] = [
  { name: "Treks", id: "treks", icon: Mountain, description: "Discover legendary trails and breathtaking Himalayan vistas." },
  { name: "Lakes", id: "lakes", icon: Waves, description: "Explore serene glacial lakes and vibrant lakeside towns." },
  { name: "Cities", id: "cities", icon: Building2, description: "Immerse yourself in ancient cultures and bustling urban centers." },
  { name: "National Parks", id: "national-parks", icon: Trees, description: "Encounter diverse wildlife in pristine natural reserves." },
  { name: "Mountains", id: "mountains", icon: ThumbsUp, description: "Witness the majesty of the world's highest peaks and stunning panoramas." },
];

export default function RecommendationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<RecommendationCategory | null>(null);
  const [recommendationData, setRecommendationData] = useState<GetRecommendationsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  type ImageErrorState = { [itemName: string]: boolean };
  const [itemImageErrors, setItemImageErrors] = useState<ImageErrorState>({});


  useEffect(() => {
     logUserEvent({ eventName: 'PageView', eventData: { page: 'RecommendationsPage' } });
  }, []);

  const fetchRecommendations = useCallback(async (category: RecommendationCategory) => {
    setSelectedCategory(category);
    setIsLoading(true);
    setError(null);
    setRecommendationData(null);
    setItemImageErrors({}); 
    logUserEvent({ eventName: 'FetchRecommendationsAttempt', eventData: { category }});

    try {
      const result = await getRecommendations({ category });
      setRecommendationData(result);
      logUserEvent({ eventName: 'FetchRecommendationsSuccess', eventData: { category, itemCount: result.items.length }});
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

  const handleItemImageError = (itemName: string) => {
    setItemImageErrors(prev => ({ ...prev, [itemName]: true }));
  };

  const currentCategoryDetails = selectedCategory ? categories.find(c => c.id === selectedCategory) : null;

  const renderDetailItem = (icon: React.ElementType, label: string, value?: string | string[] | null) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    const IconComponent = icon;
    return (
      <div className="mb-2.5">
        <h4 className="text-sm font-semibold text-primary mb-1 flex items-center">
          <IconComponent className="h-4 w-4 mr-2" />
          {label}:
        </h4>
        {Array.isArray(value) ? (
          <ul className="list-disc list-inside text-xs text-muted-foreground pl-1 space-y-0.5">
            {value.map((val, idx) => <li key={idx}>{val}</li>)}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground whitespace-pre-line">{value}</p>
        )}
      </div>
    );
  };


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

      <div id="category-content" className="mt-12 min-h-[300px] w-full">
        {isLoading && (
          <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border max-w-lg mx-auto">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
            <CardTitle className="text-2xl text-primary">Fetching Recommendations...</CardTitle>
            <CardDescription className="text-lg mt-2">
              Our AI is working its magic for {currentCategoryDetails?.name || 'your selection'}!
            </CardDescription>
          </Card>
        )}

        {!isLoading && error && (
          <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-destructive/10 border-destructive p-6 max-w-lg mx-auto">
            <Info className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl text-destructive">Something Went Wrong</CardTitle>
            <CardDescription className="text-lg mt-2 text-destructive/90">
              Sorry, recommendations could not be loaded. Please try a different category or try again later. <br /> ({error})
            </CardDescription>
          </Card>
        )}

        {!isLoading && !error && recommendationData && recommendationData.items.length > 0 && (
          <>
            {currentCategoryDetails && (
              <div className="text-center mb-8 md:mb-12">
                <h2 className="text-3xl font-bold text-primary mb-2">Recommendations for {currentCategoryDetails.name}</h2>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto">{currentCategoryDetails.description}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {recommendationData.items.map((item: RecommendedItem) => (
                <Card key={item.name} className="shadow-xl overflow-hidden border flex flex-col bg-card hover:shadow-2xl transition-shadow duration-300">
                  <div className="relative aspect-video w-full">
                    {!itemImageErrors[item.name] && item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={`AI generated image for ${item.name}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        onError={() => {
                            console.warn(`Failed to load image: ${item.imageUrl} for item ${item.name}`);
                            handleItemImageError(item.name);
                        }}
                        priority={recommendationData.items.indexOf(item) < 2} 
                        data-ai-hint={item.imageAiHint || `${item.name} ${recommendationData.category}`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
                        <ImageOff className="h-16 w-16 mb-2" />
                        <p>Image not available</p>
                      </div>
                    )}
                  </div>
                  <CardHeader className="p-4 pb-2 md:p-5 md:pb-3">
                    <CardTitle className="text-lg md:text-xl font-bold text-primary">{item.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 md:p-5 md:pt-0 flex-grow flex flex-col text-xs">
                    {renderDetailItem(Sparkles, "Tagline", item.tagline)}
                    {renderDetailItem(Clock, "Suggested Duration", item.suggestedDuration)}
                    {renderDetailItem(Home, "Accommodations", item.accommodations)}
                    {item.nearbyPlaces && item.nearbyPlaces.length > 0 && renderDetailItem(Compass, "Nearby Places", item.nearbyPlaces)}
                    {renderDetailItem(Utensils, "Local Food", item.food)}
                    {renderDetailItem(RouteIcon, "Route from Kathmandu", item.routeFromKathmandu)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
        
        {!isLoading && !error && recommendationData && recommendationData.items.length === 0 && (
             <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border p-6 max-w-lg mx-auto">
                <Info className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-2xl">No Specific Items Found</CardTitle>
                <CardDescription className="text-lg mt-2">
                  AI couldn't find specific recommendations for {currentCategoryDetails?.name || 'this category'} at the moment. Please try another category.
                </CardDescription>
            </Card>
        )}

        {!isLoading && !error && !recommendationData && (
           <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border p-6 max-w-lg mx-auto">
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
    
