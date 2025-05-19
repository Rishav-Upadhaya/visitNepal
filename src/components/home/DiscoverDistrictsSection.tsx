// src/components/home/DiscoverDistrictsSection.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MapPinned, Search, Filter, Building, Trees, Utensils, Lightbulb, ChevronRight } from 'lucide-react';
import type { DistrictName } from '@/types';

interface DistrictFeature {
  name: DistrictName;
  tagline: string;
  image: string;
  imageHint: string;
  alt: string; // Added alt text field
  attractions: string[];
  accommodations: string[];
  activities: string[];
  localTips: string[];
}

const featuredDistrictsData: DistrictFeature[] = [
  {
    name: "Kathmandu",
    tagline: "The vibrant capital, rich in culture and history. Home to ancient temples and bustling markets. Plan your Kathmandu tour!",
    image: "/images/discoverdistrict/ktm.png",
    imageHint: "Kathmandu city temple",
    alt: "Aerial view of Pashupatinath Temple complex in Kathmandu, a major attraction for Nepal tours.",
    attractions: ["Pashupatinath Temple", "Boudhanath Stupa", "Swayambhunath (Monkey Temple)", "Kathmandu Durbar Square"],
    accommodations: ["Luxury Hotels", "Boutique Guesthouses", "Budget Hostels"],
    activities: ["Heritage Walks", "Rickshaw Rides in Thamel", " Everest Mountain Flight"],
    localTips: ["Try Newari cuisine.", "Bargain respectfully when shopping.", "Explore early morning for less crowds."]
  },
  {
    name: "Pokhara",
    tagline: "A picturesque city, nestled by Phewa Lake, offering stunning Himalayan mountain views and adventure activities. Visit Pokhara on your Nepal travel.",
    image: "/images/discoverdistrict/pkr.png",
    imageHint: "Pokhara lake mountain",
    alt: "Colorful boats on Phewa Lake with the Annapurna mountain range in the background, Pokhara, Nepal.",
    attractions: ["Phewa Lake & Tal Barahi Temple", "World Peace Pagoda", "Sarangkot Viewpoint", "Devi's Fall"],
    accommodations: ["Lakeside Hotels", "Yoga Retreats", "Homestays"],
    activities: ["Boating", "Paragliding", "Zip-lining", "Annapurna Trek Start Point"],
    localTips: ["Enjoy a sunrise from Sarangkot.", "Rent a scooter to explore.", "Try fresh fish from the lake."]
  },
  {
    name: "Chitwan",
    tagline: "Home to Chitwan National Park, a UNESCO site renowned for its diverse wildlife including rhinos and tigers. Explore Chitwan during your Nepal visit.",
    image: "/images/discoverdistrict/chitwan.png",
    imageHint: "Chitwan wildlife rhino",
    alt: "A one-horned rhinoceros wading through grasslands in Chitwan National Park, a highlight of Nepal wildlife tours.",
    attractions: ["Chitwan National Park", "Tharu Village", "Elephant Breeding Center"],
    accommodations: ["Jungle Lodges", "Resorts", "Community Homestays"],
    activities: ["Jeep Safari", "Canoe Ride", "Bird Watching", "Jungle Walk"],
    localTips: ["Hire a local guide for safaris.", "Respect wildlife and maintain distance.", "Learn about Tharu culture."]
  },
  {
    name: "Lumbini",
    tagline: "The birthplace of Lord Buddha, a sacred pilgrimage site with monasteries and temples from around the world. Tour Lumbini, Nepal.",
    image: "/images/discoverdistrict/lumibni.png",
    imageHint: "Lumbini temple peace",
    alt: "The sacred garden and Maya Devi Temple in Lumbini, birthplace of Buddha, a key Nepal pilgrimage site.",
    attractions: ["Maya Devi Temple", "Ashoka Pillar", "World Peace Pagoda (Lumbini)", "International Monastic Zone"],
    accommodations: ["Monastery Guesthouses", "Pilgrim Hotels", "Standard Hotels"],
    activities: ["Monastery Tours", "Meditation Retreats", "Cycling around Sacred Garden"],
    localTips: ["Dress modestly.", "Maintain silence in sacred areas.", "Explore by e-rickshaw or bicycle."]
  }
];


export function DiscoverDistrictsSection() {
  const [searchTerm, setSearchTerm] = useState('');

  // Basic search filter for featured districts (can be expanded)
  const filteredDistricts = featuredDistrictsData.filter(district =>
    district.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    district.tagline.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-primary">Discover Nepal: 77 Districts</h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore the diverse beauty and culture of Nepal, one district at a time. Find your next travel destination or tour inspiration.
          </p>
        </div>

        <div className="mb-10 md:mb-12 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:flex-grow">
            <Input
              type="search"
              placeholder="Search districts (e.g., Kathmandu, Solukhumbu...) for your Nepal visit"
              className="pl-10 h-12 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search Nepal Districts"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
           {/* Filter button - functionality not implemented yet */}
          {/* <Button variant="outline" size="lg" className="h-12 w-full sm:w-auto">
            <Filter className="mr-2 h-5 w-5" /> Filter
          </Button> */}
        </div>

        {/* Map Placeholder - Future implementation */}
        {/* <div className="mb-12 p-6 bg-muted/50 rounded-lg text-center border">
          <h3 className="text-2xl font-semibold text-primary">Interactive District Map</h3>
          <p className="text-muted-foreground mt-2">
            (Coming Soon) Visualize all 77 districts and filter by your interests for Nepal travel.
          </p>
        </div> */}

        <div className="grid md:grid-cols-2 gap-8">
          {filteredDistricts.map((district) => (
            <Card key={district.name} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col bg-card">
              <CardHeader className="p-0 relative">
                <div className="aspect-video w-full relative">
                  <Image
                    src={district.image}
                    alt={district.alt} // Use the descriptive alt text
                    data-ai-hint={district.imageHint}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw" // Responsive sizes
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                    <h3 className="text-3xl font-bold text-white">{district.name}</h3>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-grow">
                <CardDescription className="mb-4 text-muted-foreground text-base h-16 overflow-hidden">
                  {district.tagline}
                </CardDescription>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="attractions">
                    <AccordionTrigger className="text-lg font-medium hover:text-primary">
                      <div className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /> Top Attractions</div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                        {district.attractions.slice(0,3).map(item => <li key={item}>{item}</li>)}
                        {district.attractions.length > 3 && <li>And more attractions for your tour...</li>}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="accommodations">
                    <AccordionTrigger className="text-lg font-medium hover:text-primary">
                     <div className="flex items-center gap-2"><Building className="h-5 w-5 text-primary" /> Accommodations</div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                        {district.accommodations.slice(0,2).map(item => <li key={item}>{item}</li>)}
                         {district.accommodations.length > 2 && <li>Various options available for your visit.</li>}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="activities">
                    <AccordionTrigger className="text-lg font-medium hover:text-primary">
                      <div className="flex items-center gap-2"><Trees className="h-5 w-5 text-primary" /> Activities</div>
                    </AccordionTrigger>
                     <AccordionContent>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                        {district.activities.slice(0,2).map(item => <li key={item}>{item}</li>)}
                        {district.activities.length > 2 && <li>And more activities for your travel...</li>}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                   <AccordionItem value="local-tips">
                    <AccordionTrigger className="text-lg font-medium hover:text-primary">
                      <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" /> Local Tips</div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <ul className="list-disc pl-5 mt-1 space-y-1 text-muted-foreground">
                        {district.localTips.slice(0,2).map(item => <li key={item}>{item}</li>)}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
                <div className="p-6 pt-0 mt-auto">
                    <Button variant="outline" asChild className="w-full text-primary border-primary hover:bg-primary/10 hover:text-primary">
                        <Link href={`/districts?name=${district.name}`} prefetch={false}> {/* Prefetch false if potentially many links */}
                            Explore {district.name} in Detail
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </Card>
          ))}
        </div>

        {filteredDistricts.length === 0 && searchTerm && (
          <p className="text-center text-muted-foreground text-lg mt-10">No districts match your search for "{searchTerm}". Try a different term or explore all districts.</p>
        )}

        <div className="mt-16 text-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md px-8 py-6 text-lg">
            <Link href="/districts" prefetch={true}>
              Explore All 77 Districts
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
           {/* <p className="text-muted-foreground mt-3 text-sm">(Full district explorer coming soon!)</p> */}
        </div>
      </div>
    </section>
  );
}
