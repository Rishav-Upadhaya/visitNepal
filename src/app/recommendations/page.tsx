
"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { Loader2, Star, Info, ImageOff, Mountain, Waves, Building2, Trees, Sparkles, MapPin, Clock, Home, Utensils, Route as RouteIcon, Compass, Search, ChevronLeft, Calendar, Map, MessageCircleQuestion, Sunrise } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getRecommendations, type GetRecommendationsOutput, type RecommendationCategory, type RecommendedItem } from '@/ai/flows/get-recommendations-flow';
import { getPlaceDescription, type GetPlaceDescriptionOutput } from '@/ai/flows/get-place-description-flow';
import { NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL } from '@/types';
import { logUserEvent } from '@/lib/logger';
import { cn } from '@/lib/utils';

const categories: { name: string; id: RecommendationCategory; icon: React.ElementType; description: string; }[] = [
  { name: "Treks", id: "treks", icon: Mountain, description: "Discover legendary trails and breathtaking Himalayan vistas." },
  { name: "Lakes", id: "lakes", icon: Waves, description: "Explore serene glacial lakes and vibrant lakeside towns." },
  { name: "Cities", id: "cities", icon: Building2, description: "Immerse yourself in ancient cultures and bustling urban centers." },
  { name: "National Parks", id: "national-parks", icon: Trees, description: "Encounter diverse wildlife in pristine natural reserves." },
  { name: "Hike", id: "hike", icon: Mountain, description: "Explore scenic day hiking trails and enjoyable walks with beautiful views within or around the Kathmandu Valley." },
  { name: "Scenic Views", id: "scenic-views", icon: Sunrise, description: "Witness stunning panoramas from famous viewpoints across Nepal." },
];

type ActiveView = 'categories' | 'searchResult';

export default function RecommendationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<RecommendationCategory | null>(null);
  const [recommendationData, setRecommendationData] = useState<GetRecommendationsOutput | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [searchResult, setSearchResult] = useState<GetPlaceDescriptionOutput | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('categories');
  
  const { toast } = useToast();
  const pageTopRef = useRef<HTMLDivElement>(null);

  type ImageErrorState = { [itemName: string]: boolean };
  const [itemImageErrors, setItemImageErrors] = useState<ImageErrorState>({});
  const [searchImageError, setSearchImageError] = useState(false);


  useEffect(() => {
     logUserEvent({ eventName: 'PageView', eventData: { page: 'RecommendationsPage' } });
  }, []);

  const fetchRecommendations = useCallback(async (category: RecommendationCategory) => {
    setSelectedCategory(category);
    setIsLoadingCategories(true);
    setCategoryError(null);
    setRecommendationData(null);
    setItemImageErrors({});
    setActiveView('categories'); 
    logUserEvent({ eventName: 'FetchRecommendationsAttempt', eventData: { category }});

    try {
      const result = await getRecommendations({ category });
      setRecommendationData(result);
      logUserEvent({ eventName: 'FetchRecommendationsSuccess', eventData: { category, itemCount: result.items.length }});
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
      const errorMessage = e instanceof Error ? e.message : "Could not load recommendations.";
      setCategoryError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
       logUserEvent({ eventName: 'FetchRecommendationsFailure', eventData: { category, error: errorMessage }});
    } finally {
      setIsLoadingCategories(false);
    }
  }, [toast]);

  const handleGeneralSearch = useCallback(async (query?: string) => {
    const placeToSearch = query || searchQuery;
    if (!placeToSearch.trim()) {
        toast({ title: "Search Query Needed", description: "Please enter a place name to search.", variant: "default" });
        return;
    }
    setIsSearchingPlace(true);
    setSearchError(null);
    setSearchResult(null);
    setSearchImageError(false);
    setActiveView('searchResult');
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    logUserEvent({ eventName: 'GeneralSearchAttempt', eventData: { query: placeToSearch }});

    try {
        const result = await getPlaceDescription({ placeName: placeToSearch });
        setSearchResult(result);
        logUserEvent({ eventName: 'GeneralSearchSuccess', eventData: { query: placeToSearch, resultName: result.name }});
    } catch (e) {
        console.error("Failed to fetch place description:", e);
        const errorMessage = e instanceof Error ? e.message : `Could not load details for "${placeToSearch}".`;
        setSearchError(errorMessage);
        toast({
            title: "Search Error",
            description: errorMessage,
            variant: "destructive",
        });
        logUserEvent({ eventName: 'GeneralSearchFailure', eventData: { query: placeToSearch, error: errorMessage }});
    } finally {
        setIsSearchingPlace(false);
    }
  }, [searchQuery, toast]);

  const handleItemCardSearch = (placeName: string) => {
    setSearchQuery(placeName); 
    handleGeneralSearch(placeName); 
  };

  const handleItemImageError = (itemName: string) => {
    setItemImageErrors(prev => ({ ...prev, [itemName]: true }));
  };
  
  const handleSearchImageError = () => {
    setSearchImageError(true);
  };

  const currentCategoryDetails = selectedCategory ? categories.find(c => c.id === selectedCategory) : null;

  const renderDetailAccordionItem = (icon: React.ElementType, label: string, value?: string | string[] | null, keyPrefix: string = 'detail') => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    const IconComponent = icon;
    const uniqueValue = `${keyPrefix}-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <AccordionItem value={uniqueValue} key={uniqueValue}>
        <AccordionTrigger className="text-base font-medium hover:text-primary py-3 px-1">
          <div className="flex items-center gap-2">
            <IconComponent className="h-5 w-5 text-primary" /> {label}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-1 pb-2 px-1 text-sm">
          {Array.isArray(value) ? (
            <ul className="list-disc list-inside text-muted-foreground pl-2 space-y-1">
              {value.map((val, idx) => <li key={`${uniqueValue}-val-${idx}`}>{val}</li>)}
            </ul>
          ) : (
            <p className="text-muted-foreground whitespace-pre-line">{value}</p>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const isSearchResultNotFoundInNepal = searchResult?.description === NOT_FOUND_IN_NEPAL_DESCRIPTION_SENTINEL;

  return (
    <div className="container py-12 md:py-16" ref={pageTopRef}>
      <div className="text-center mb-10">
        <Star className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold tracking-tight text-primary">Discover Nepal's Best</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          Explore AI-powered recommendations or search for specific places in Nepal.
        </p>
      </div>

      
      <Card className="mb-10 bg-background border-none shadow-none">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
            <Input
              type="search"
              placeholder="Search any place in Nepal (e.g., 'Rara Lake', 'Patan Durbar Square')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isSearchingPlace && handleGeneralSearch()}
              className="h-11 md:h-12 text-base flex-grow"
              aria-label="Search for a place in Nepal"
            />
            <Button
              onClick={() => handleGeneralSearch()}
              disabled={isSearchingPlace || !searchQuery.trim()}
              className="w-full sm:w-auto h-11 md:h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isSearchingPlace ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
              Search Place
            </Button>
          </div>
        </CardContent>
      </Card>
      
      
      <div id="content-display-area" className="mt-8 min-h-[300px] w-full">
        {activeView === 'searchResult' && (
          <>
            <Button variant="outline" onClick={() => setActiveView('categories')} className="mb-6 text-primary border-primary hover:bg-primary/10">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Categories
            </Button>
            {isSearchingPlace && (
              <Card className="shadow-xl flex flex-col items-center justify-center min-h-[400px] text-center bg-muted/30 border max-w-2xl mx-auto">
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
                <CardTitle className="text-2xl text-primary">Searching for {searchQuery}...</CardTitle>
                <CardDescription className="text-lg mt-2">
                  Our AI is gathering details for you!
                </CardDescription>
              </Card>
            )}
            {!isSearchingPlace && searchError && (
              <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-destructive/10 border-destructive p-6 max-w-2xl mx-auto">
                <Info className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-2xl text-destructive">Search Failed</CardTitle>
                <CardDescription className="text-lg mt-2 text-destructive/90">
                  {searchError}
                </CardDescription>
              </Card>
            )}
            {!isSearchingPlace && !searchError && searchResult && (
              isSearchResultNotFoundInNepal ? (
                <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 p-6 max-w-2xl mx-auto">
                  <Info className="h-12 w-12 text-amber-500 dark:text-amber-400 mx-auto mb-4" />
                  <CardTitle className="text-2xl text-amber-700 dark:text-amber-300">Place Information Not Available</CardTitle>
                  <CardDescription className="text-lg mt-2 text-amber-600 dark:text-amber-500">
                     Our AI could not find specific details for "{searchResult.name}" within Nepal. Please ensure the name is correct and the place is located in Nepal, or try a different search.
                  </CardDescription>
                </Card>
              ) : (
                <Card className="shadow-xl overflow-hidden border flex flex-col bg-card hover:shadow-2xl transition-shadow duration-300 max-w-2xl mx-auto">
                  <div className="relative aspect-[16/10] w-full">
                    {!searchImageError && searchResult.imageUrl ? (
                      <Image
                        src={searchResult.imageUrl}
                        alt={`AI generated image for ${searchResult.name}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 66vw, 50vw"
                        onError={handleSearchImageError}
                        priority
                        data-ai-hint={searchResult.imageAiHint || `${searchResult.name} Nepal`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
                        <ImageOff className="h-16 w-16 mb-2" />
                        <p>Image not available</p>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                      <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{searchResult.name}</h2>
                    </div>
                  </div>
                  <CardContent className="p-4 md:p-6 flex-grow flex flex-col">
                    <p className="text-md text-muted-foreground mb-1 italic">{searchResult.tagline}</p>
                    <p className="text-base text-foreground mb-4 whitespace-pre-line">{searchResult.description}</p>
                    <Accordion type="single" collapsible className="w-full -mx-1">
                      {renderDetailAccordionItem(Map, "Key Attractions / Activities", searchResult.attractions, `search-attr-${searchResult.name.replace(/\s+/g, '-')}`)}
                      {renderDetailAccordionItem(RouteIcon, "How to Reach", searchResult.howToReach, `search-howtoreach-${searchResult.name.replace(/\s+/g, '-')}`)}
                      {renderDetailAccordionItem(Calendar, "Best Time to Visit", searchResult.bestTimeToVisit, `search-time-${searchResult.name.replace(/\s+/g, '-')}`)}
                      {renderDetailAccordionItem(MessageCircleQuestion, "Local Tips", searchResult.localTips, `search-tips-${searchResult.name.replace(/\s+/g, '-')}`)}
                    </Accordion>
                  </CardContent>
                </Card>
              )
            )}
          </>
        )}

        {activeView === 'categories' && (
          <>
            <div className="mb-10">
              <h2 className="text-2xl font-semibold text-center text-foreground mb-6">Or, Browse by Category:</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto"> 
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="lg"
                    className={`text-base h-14 ${selectedCategory === cat.id ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'border-primary text-primary hover:bg-primary/10'}`}
                    onClick={() => fetchRecommendations(cat.id)}
                    disabled={isLoadingCategories && selectedCategory === cat.id}
                  >
                    {isLoadingCategories && selectedCategory === cat.id ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <cat.icon className="mr-2 h-5 w-5" />
                    )}
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>

            {isLoadingCategories && (
              <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border max-w-lg mx-auto">
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
                <CardTitle className="text-2xl text-primary">Fetching Recommendations...</CardTitle>
                <CardDescription className="text-lg mt-2">
                  Our AI is working its magic for {currentCategoryDetails?.name || 'your selection'}!
                </CardDescription>
              </Card>
            )}

            {!isLoadingCategories && categoryError && (
              <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-destructive/10 border-destructive p-6 max-w-lg mx-auto">
                <Info className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-2xl text-destructive">Something Went Wrong</CardTitle>
                <CardDescription className="text-lg mt-2 text-destructive/90">
                  Sorry, recommendations could not be loaded. ({categoryError})
                </CardDescription>
              </Card>
            )}

            {!isLoadingCategories && !categoryError && recommendationData && recommendationData.items.length > 0 && (
              <>
                {currentCategoryDetails && (
                  <div className="text-center mb-8 md:mb-12">
                    <h2 className="text-3xl font-bold text-primary mb-2">Recommendations for {currentCategoryDetails.name}</h2>
                    <p className="text-lg text-muted-foreground max-w-xl mx-auto">{currentCategoryDetails.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {recommendationData.items.map((item: RecommendedItem) => (
                    <Card key={item.name} className="shadow-xl overflow-hidden border flex flex-col bg-card hover:shadow-2xl transition-shadow duration-300">
                      <div className="relative aspect-video w-full">
                        {!itemImageErrors[item.name] && item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={`AI generated image for ${item.name}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
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
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                            <h3 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">{item.name}</h3>
                        </div>
                      </div>
                      <CardContent className="p-4 pt-3 md:p-5 md:pt-4 flex-grow flex flex-col">
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 h-12">{item.tagline}</p> 
                        <Accordion type="single" collapsible className="w-full -mx-1">
                            {renderDetailAccordionItem(Clock, "Suggested Duration", item.suggestedDuration, `cat-duration-${item.name.replace(/\s+/g, '-')}`)}
                            {renderDetailAccordionItem(Home, "Accommodations", item.accommodations, `cat-accomo-${item.name.replace(/\s+/g, '-')}`)}
                            {item.nearbyPlaces && item.nearbyPlaces.length > 0 && renderDetailAccordionItem(Compass, "Nearby Places", item.nearbyPlaces, `cat-nearby-${item.name.replace(/\s+/g, '-')}`)}
                            {renderDetailAccordionItem(Utensils, "Local Food", item.food, `cat-food-${item.name.replace(/\s+/g, '-')}`)}
                            {renderDetailAccordionItem(RouteIcon, "Route from Kathmandu", item.routeFromKathmandu, `cat-route-${item.name.replace(/\s+/g, '-')}`)}
                        </Accordion>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="mt-auto w-full"
                            onClick={() => handleItemCardSearch(item.name)}
                        >
                           <Search className="mr-2 h-4 w-4"/> Explore Details for {item.name}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {!isLoadingCategories && !categoryError && recommendationData && recommendationData.items.length === 0 && (
                <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border p-6 max-w-lg mx-auto">
                    <Info className="h-12 w-12 text-primary mx-auto mb-4" />
                    <CardTitle className="text-2xl">No Specific Items Found</CardTitle>
                    <CardDescription className="text-lg mt-2">
                    AI couldn't find specific recommendations for {currentCategoryDetails?.name || 'this category'} at the moment. Please try another category or use the search bar above.
                    </CardDescription>
                </Card>
            )}

            {!isLoadingCategories && !categoryError && !recommendationData && (
              <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center bg-muted/30 border p-6 max-w-lg mx-auto">
                <Star className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-2xl">Ready for Recommendations?</CardTitle>
                <CardDescription className="text-lg mt-2">
                  Select a category above or search for a place to see what Nepal has to offer!
                </CardDescription>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
    

    


    





    