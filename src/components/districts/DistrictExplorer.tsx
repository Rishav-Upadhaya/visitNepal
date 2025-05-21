
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { suggestHiddenGems, type SuggestHiddenGemsOutput } from '@/ai/flows/hidden-gems-suggestions';
import { getDistrictDetails, type GetDistrictDetailsOutput } from '@/ai/flows/get-district-details-flow'; 
import { generateDistrictImage, type GenerateDistrictImageOutput } from '@/ai/flows/generate-district-image-flow'; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, MapPin, Lightbulb, Building, Trees, Utensils, Sparkles, Info, Search, ImageOff, Compass } from 'lucide-react'; 
import { useToast } from "@/hooks/use-toast";
import { nepalDistricts, type DistrictName, nepalDistrictsByRegion } from '@/types';
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"; 
import { ScrollArea } from '@/components/ui/scroll-area'; 
import { logUserEvent } from '@/lib/logger'; // Import the logger

const formSchema = z.object({
  districtName: z.custom<DistrictName>((val) => nepalDistricts.includes(val as DistrictName), {
    message: "Please select a valid district.",
  }),
  userPreferences: z.string().optional(),
});

type DistrictDetailsState = GetDistrictDetailsOutput | 'loading' | null;
type DistrictImageState = string | 'loading' | null | 'error'; 

export function DistrictExplorer() {
  const searchParams = useSearchParams();
  const initialDistrictFromUrl = searchParams.get('name') as DistrictName | null;

  const [selectedDistrict, setSelectedDistrict] = useState<DistrictName | null>(initialDistrictFromUrl);
  const [districtDetails, setDistrictDetails] = useState<DistrictDetailsState>(null); 
  const [districtImageUrl, setDistrictImageUrl] = useState<DistrictImageState>(null); 
  const [hiddenGems, setHiddenGems] = useState<SuggestHiddenGemsOutput | null>(null);
  const [isLoadingGems, setIsLoadingGems] = useState(false);
  const [districtFetchError, setDistrictFetchError] = useState<string | null>(null); 
  const [gemsError, setGemsError] = useState<string | null>(null); 
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      districtName: initialDistrictFromUrl || undefined,
      userPreferences: "",
    },
  });

  const fetchDistrictData = useCallback(async (districtName: DistrictName) => {
    setDistrictDetails('loading'); 
    setDistrictImageUrl('loading'); 
    setDistrictFetchError(null); 
    setHiddenGems(null); 
    setGemsError(null); 
    logUserEvent({ eventName: 'FetchDistrictDataAttempt', eventData: { district: districtName } });

    let detailsResult: GetDistrictDetailsOutput | null = null;

    try {
      detailsResult = await getDistrictDetails({ districtName });
      setDistrictDetails(detailsResult);
    } catch (e) {
      console.error("Error fetching district details:", e);
      const errorMessage = e instanceof Error ? e.message : "Could not fetch district details.";
      setDistrictFetchError(`Failed to fetch details for ${districtName}. ${errorMessage}`);
      setDistrictDetails(null); 
      setDistrictImageUrl(null); 
      toast({
        title: "Error",
        description: `Could not fetch details for ${districtName}.`,
        variant: "destructive",
      });
      logUserEvent({ eventName: 'FetchDistrictDataFailure', eventData: { district: districtName, error: errorMessage } });
      return; 
    }

    if (detailsResult) {
      try {
        const imageResult = await generateDistrictImage({ districtName });
        setDistrictImageUrl(imageResult.imageUrl); 
        logUserEvent({ eventName: 'FetchDistrictDataSuccess', eventData: { district: districtName } });
      } catch (imgErr) {
         console.error("Error generating district image:", imgErr);
         setDistrictImageUrl('error'); 
         toast({
           title: "Image Generation Failed",
           description: `Could not generate image for ${districtName}. Displaying details without image.`,
           variant: "default", 
         });
         logUserEvent({ eventName: 'GenerateDistrictImageFailure', eventData: { district: districtName, error: imgErr instanceof Error ? imgErr.message : 'Unknown error' } });
      }
    }
  }, [toast]); 

  useEffect(() => {
    if (initialDistrictFromUrl && nepalDistricts.includes(initialDistrictFromUrl)) {
      setSelectedDistrict(initialDistrictFromUrl);
       form.setValue("districtName", initialDistrictFromUrl);
       if (districtDetails === null || (districtDetails !== 'loading' && districtDetails?.name !== initialDistrictFromUrl)) {
            fetchDistrictData(initialDistrictFromUrl);
       }
    } else {
         setDistrictDetails(null); 
         setDistrictImageUrl(null); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDistrictFromUrl]); 

  useEffect(() => {
      if (selectedDistrict && selectedDistrict !== initialDistrictFromUrl && (districtDetails === null || (districtDetails !== 'loading' && districtDetails?.name !== selectedDistrict))) {
          fetchDistrictData(selectedDistrict);
          form.setValue("districtName", selectedDistrict);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrict, initialDistrictFromUrl, fetchDistrictData]);


  const onSuggestGemsSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsLoadingGems(true);
    setGemsError(null); 
    setHiddenGems(null);
    logUserEvent({ eventName: 'SuggestHiddenGemsAttempt', eventData: { district: values.districtName, preferences: values.userPreferences } });
    try {
      const result = await suggestHiddenGems({
        districtName: values.districtName,
        userPreferences: values.userPreferences || undefined, 
      });
      setHiddenGems(result);
      toast({
        title: "Hidden Gems Found!",
        description: `AI suggestions for ${values.districtName} generated.`,
      });
      logUserEvent({ eventName: 'SuggestHiddenGemsSuccess', eventData: { district: values.districtName, gemsCount: result.hiddenGems.length } });
    } catch (e) {
      console.error("Error fetching hidden gems:", e);
      const errorMessage = e instanceof Error ? e.message : "Could not fetch hidden gems.";
      setGemsError(`Failed to fetch hidden gems. ${errorMessage}`);
      toast({
        title: "Error",
        description: "Could not fetch hidden gems.",
        variant: "destructive",
      });
      logUserEvent({ eventName: 'SuggestHiddenGemsFailure', eventData: { district: values.districtName, error: errorMessage } });
    } finally {
      setIsLoadingGems(false);
    }
  }, [toast]); 


  const handleDistrictChange = useCallback((district: DistrictName) => {
    setSelectedDistrict(district);
    logUserEvent({ eventName: 'DistrictSelected', eventData: { district: district } });
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('name', district);
    window.history.pushState({}, '', `${window.location.pathname}?${currentParams.toString()}`);
  }, []); 

  const renderList = (items: string[] | undefined) => {
      if (!items || items.length === 0) {
          return <li className="text-muted-foreground italic text-sm md:text-base">Details coming soon...</li>;
      }
      return items.map((item, i) => <li key={i} className="text-sm md:text-base">{item}</li>);
  };


  return (
    <div className="container py-12 md:py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-primary">Explore Nepal's Districts</h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-xl sm:max-w-2xl mx-auto">
          Discover unique attractions, accommodations, AI-powered local tips, and more for each of Nepal's 77 districts. Plan your Nepal travel and tours efficiently.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 md:gap-8 items-start">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6 lg:sticky top-24">
          <Card className="shadow-lg border border-primary/20">
            <CardHeader className="bg-primary/5 p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-primary text-lg sm:text-xl"><Search className="h-5 w-5 sm:h-6 sm:w-6" /> Select a District</CardTitle>
              <CardDescription className="text-sm sm:text-base">Choose a district to see its details and get AI hidden gem suggestions for your Nepal visit.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <Label htmlFor="district-select" className="sr-only">Select a District</Label> 
              <Select
                 onValueChange={(value) => handleDistrictChange(value as DistrictName)}
                 value={selectedDistrict || undefined}
                 name="district-select" 
                >
                <SelectTrigger className="h-11 md:h-12 text-sm sm:text-base" id="district-select">
                  <SelectValue placeholder="Select a district" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(nepalDistrictsByRegion).map(([region, districts]) => (
                      <SelectGroup key={region}>
                          <SelectLabel className="font-bold text-xs sm:text-sm">{region}</SelectLabel>
                          {districts.map(d => (
                              <SelectItem key={d} value={d} className="text-sm sm:text-base">{d}</SelectItem>
                          ))}
                      </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedDistrict && (
            <Card className="shadow-lg border border-accent/20">
              <CardHeader className="bg-accent/5 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-accent text-lg sm:text-xl"><Lightbulb className="h-5 w-5 sm:h-6 sm:w-6" /> AI Hidden Gems</CardTitle>
                <CardDescription className="text-sm sm:text-base">Get AI-powered suggestions for {selectedDistrict} for your off-the-beaten-path tour.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <form onSubmit={form.handleSubmit(onSuggestGemsSubmit)} className="space-y-4">
                   <input type="hidden" {...form.register("districtName")} value={selectedDistrict || ''}/> 
                  <div>
                    <Label htmlFor="userPreferences" className="font-medium text-sm sm:text-base">Your Preferences (Optional)</Label>
                    <Textarea
                      id="userPreferences"
                      placeholder="e.g., interested in nature, history, food, offbeat trails for my Nepal travel..."
                      {...form.register("userPreferences")}
                      className="mt-1 text-sm sm:text-base min-h-[80px]"
                      aria-label="Your preferences for hidden gems"
                    />
                  </div>
                  <Button type="submit" disabled={isLoadingGems || districtDetails === 'loading'} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-sm sm:text-base py-2.5 h-auto">
                    {isLoadingGems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoadingGems ? "AI Searching..." : "Find Hidden Gems"}
                    <Sparkles className="ml-2 h-4 w-4" />
                  </Button>
                </form>
                 {gemsError && (
                  <Alert variant="destructive" className="mt-4 text-xs sm:text-sm">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{gemsError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>

         {/* Main Content Area */}
        <div className="lg:col-span-2">
          {(districtDetails === 'loading' || districtImageUrl === 'loading') && selectedDistrict && (
            <Card className="shadow-xl border">
               <CardHeader className="p-0">
                 <Skeleton className="aspect-[16/9] md:aspect-[1200/500] w-full rounded-t-lg" />
               </CardHeader>
               <CardContent className="p-4 md:p-6 space-y-4">
                 <Skeleton className="h-7 md:h-8 w-3/4 mb-2" /> 
                 <Skeleton className="h-5 md:h-6 w-1/2 mb-6" /> 
                  <div className="space-y-2">
                    <Skeleton className="h-9 md:h-10 w-full" />
                    <Skeleton className="h-9 md:h-10 w-full" />
                    <Skeleton className="h-9 md:h-10 w-full" />
                    <Skeleton className="h-9 md:h-10 w-full" />
                  </div>
               </CardContent>
            </Card>
          )}
           {districtFetchError && districtDetails !== 'loading' && (
             <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] text-center bg-destructive/10 border border-destructive p-4">
                <CardHeader>
                    <Info className="h-12 w-12 md:h-16 md:w-16 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-xl md:text-2xl text-destructive">Error Loading District Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="text-base md:text-lg text-destructive/90">{districtFetchError}</CardDescription>
                    <Button variant="outline" onClick={() => selectedDistrict && fetchDistrictData(selectedDistrict)} className="mt-6 border-destructive text-destructive hover:bg-destructive/10">
                      Try Again
                    </Button>
                </CardContent>
            </Card>
           )}

          {districtDetails && typeof districtDetails === 'object' && !districtFetchError && districtImageUrl !== 'loading' ? (
            <Card className="shadow-xl border">
               <CardHeader className="p-0">
                 <div className="aspect-[16/9] md:aspect-[1200/500] relative rounded-t-lg overflow-hidden bg-muted">
                   {districtImageUrl && typeof districtImageUrl === 'string' ? (
                      <Image
                        src={districtImageUrl} 
                        alt={`AI generated representation of ${districtDetails.name} district, Nepal. Key landmark or landscape for travel planning.`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 66vw"
                        priority 
                      />
                   ) : districtImageUrl === 'error' ? (
                       <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 text-muted-foreground p-4 text-center">
                           <ImageOff className="h-12 w-12 md:h-16 md:w-16 mb-2 md:mb-4 opacity-50" />
                           <p className="text-sm sm:text-base">Could not load image for {districtDetails.name}.</p>
                       </div>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-muted-foreground">
                         <Skeleton className="h-full w-full" /> 
                       </div>
                   )}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4 md:p-6 lg:p-8">
                     <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{districtDetails.name}</h2>
                     <p className="text-sm sm:text-md md:text-lg text-white/90 mt-1 drop-shadow-md">{districtDetails.tagline}</p>
                   </div>
                 </div>
               </CardHeader>
              <ScrollArea className="max-h-[calc(100vh-20rem)] md:max-h-[calc(100vh-25rem)] lg:max-h-[75vh] w-full"> {/* Adjusted max-height */}
                <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {isLoadingGems && (
                      <div className="flex items-center justify-center p-3 md:p-4 border rounded-lg bg-muted/50">
                          <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin text-accent" />
                          <p className="text-accent text-sm md:text-base font-medium">AI is searching for hidden gems...</p>
                      </div>
                  )}
                  {hiddenGems && !isLoadingGems && (
                      hiddenGems.hiddenGems.length > 0 ? (
                          <div className="space-y-2 md:space-y-3 p-3 md:p-4 border rounded-lg bg-accent/10 border-accent/30">
                              <h3 className="text-lg sm:text-xl font-semibold text-accent flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5" /> AI Hidden Gem Suggestions:
                              </h3>
                              <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm md:text-base">
                              {hiddenGems.hiddenGems.map((gem, index) => (
                                  <li key={index}>{gem}</li> 
                              ))}
                              </ul>
                          </div>
                       ) : (
                          !gemsError && ( 
                            <Alert className="bg-muted/50 text-xs sm:text-sm">
                              <Info className="h-4 w-4" />
                              <AlertTitle>No Specific Gems Found</AlertTitle>
                              <AlertDescription>AI couldn't find specific hidden gems based on the input, or none match your preferences. Explore the general attractions below!</AlertDescription>
                            </Alert>
                          )
                      )
                  )}

                  <Accordion type="single" collapsible className="w-full" defaultValue="attractions">
                    <AccordionItem value="attractions">
                      <AccordionTrigger className="text-lg sm:text-xl font-medium hover:text-primary py-2.5 md:py-3">
                        <div className="flex items-center gap-2"><MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Top Attractions</div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-2 md:pt-2 md:pb-3 text-sm md:text-base">
                         <p className="mb-1.5 md:mb-2 text-muted-foreground">Must-see places when you visit {districtDetails.name}:</p>
                        <ul className="list-disc pl-5 space-y-0.5 md:space-y-1 text-muted-foreground">
                          {renderList(districtDetails.attractions)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="accommodations">
                      <AccordionTrigger className="text-lg sm:text-xl font-medium hover:text-primary py-2.5 md:py-3">
                       <div className="flex items-center gap-2"><Building className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Accommodations</div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-2 md:pt-2 md:pb-3 text-sm md:text-base">
                         <p className="mb-1.5 md:mb-2 text-muted-foreground">Where to stay during your tour in {districtDetails.name}:</p>
                         <ul className="list-disc pl-5 space-y-0.5 md:space-y-1 text-muted-foreground">
                          {renderList(districtDetails.accommodations)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="activities">
                      <AccordionTrigger className="text-lg sm:text-xl font-medium hover:text-primary py-2.5 md:py-3">
                        <div className="flex items-center gap-2"><Trees className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Activities & Events</div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-2 md:pt-2 md:pb-3 text-sm md:text-base">
                         <p className="mb-1.5 md:mb-2 text-muted-foreground">Things to do and experience while travelling in {districtDetails.name}:</p>
                         <ul className="list-disc pl-5 space-y-0.5 md:space-y-1 text-muted-foreground">
                           {renderList(districtDetails.activities)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="food">
                      <AccordionTrigger className="text-lg sm:text-xl font-medium hover:text-primary py-2.5 md:py-3">
                        <div className="flex items-center gap-2"><Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Local Cuisine</div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-2 md:pt-2 md:pb-3 text-sm md:text-base">
                         <p className="mb-1.5 md:mb-2 text-muted-foreground">Taste the local flavors of {districtDetails.name} during your visit:</p>
                         <ul className="list-disc pl-5 space-y-0.5 md:space-y-1 text-muted-foreground">
                          {renderList(districtDetails.food)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </ScrollArea>
            </Card>
          ) : (
             !selectedDistrict && districtDetails !== 'loading' && !districtFetchError && (
                <Card className="shadow-xl flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] text-center bg-muted/30 border p-4">
                <CardHeader>
                    <Compass className="h-16 w-16 md:h-20 md:w-20 text-primary mx-auto mb-4 md:mb-6" />
                    <CardTitle className="text-2xl md:text-3xl">Select a District to Begin Your Nepal Exploration</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="text-base md:text-lg max-w-md mx-auto">
                    Choose a district from the list on the left to view its attractions, get AI-powered travel tips, and plan your perfect Nepal tour or visit.
                    </CardDescription>
                </CardContent>
                </Card>
             )
          )}
        </div>
      </div>
    </div>
  );
}
