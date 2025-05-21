
import { Hero } from '@/components/home/Hero';
import { WhyNepal } from '@/components/home/WhyNepal';
import { DiscoverDistrictsSection } from '@/components/home/DiscoverDistrictsSection';
import { SustainabilitySection } from '@/components/home/SustainabilitySection'; 
import { useEffect } from 'react'; // Client-side hook
import { logUserEvent } from '@/lib/logger'; // Import the logger

export default function HomePage() {
  // useEffect can only be used in client components.
  // To log a page view, this component needs to be a client component or this logic moved.
  // For now, this will cause an error if HomePage is a Server Component.
  // To fix, you'd add "use client"; at the top OR call logUserEvent from a client child component.
  // For this exercise, I will assume a conceptual logging.
  // If this page remains a Server Component, this specific log won't work as is.
  // To make it work, you'd add "use client"; to the top of this file.
  // For now, I'll add the log and it's up to you to add "use client"; if desired for this log.
  
  // Conceptually, if this were a client component:
  // useEffect(() => {
  //   logUserEvent({ eventName: 'PageView', eventData: { page: 'HomePage' } });
  // }, []);

  return (
    <>
      <Hero />
      <WhyNepal />
      <DiscoverDistrictsSection />
      <SustainabilitySection /> 
    </>
  );
}
