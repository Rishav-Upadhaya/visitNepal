"use client"; // This directive marks the component as a Client Component

import { Hero } from '@/components/home/Hero';
import { WhyNepal } from '@/components/home/WhyNepal';
import { DiscoverDistrictsSection } from '@/components/home/DiscoverDistrictsSection';
import { SustainabilitySection } from '@/components/home/SustainabilitySection'; 
import { useEffect } from 'react'; // Client-side hook
import { logUserEvent } from '@/lib/logger'; // Import the logger

export default function HomePage() {
  useEffect(() => {
    logUserEvent({ eventName: 'PageView', eventData: { page: 'HomePage' } });
  }, []);

  return (
    <>
      <Hero />
      <WhyNepal />
      <DiscoverDistrictsSection />
      <SustainabilitySection /> 
    </>
  );
}
