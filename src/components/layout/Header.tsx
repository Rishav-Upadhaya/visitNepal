
"use client"; // Add this directive

import Link from 'next/link';
import { MapPinned, Route, Search, Menu, Mountain, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { logUserEvent } from '@/lib/logger'; // Import the logger

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/districts', label: 'Districts', icon: MapPinned },
  { href: '/plan-trip', label: 'Plan Your Trip', icon: Route },
];

export function Header() {
  const handleNavClick = (label: string, href: string) => {
    logUserEvent({ eventName: 'NavClick', eventData: { label, href } });
  };

  const handleStartPlanningClick = () => {
    logUserEvent({ eventName: 'HeaderStartPlanningClick', eventData: { target: '/plan-trip' } });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" prefetch={true} onClick={() => handleNavClick('Logo', '/')}>
          <Mountain className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-primary">Visit Nepal</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-8 text-base font-medium">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-accent flex items-center gap-1.5"
              prefetch={true}
              onClick={() => handleNavClick(item.label, item.href)}
            >
               <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center space-x-4">
          <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
            <Link href="/plan-trip" prefetch={true} onClick={handleStartPlanningClick}>
              <Search className="mr-2 h-4 w-4" />
              Start Planning
            </Link>
          </Button>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[320px] bg-background p-0">
              <SheetPrimitive.Title className="sr-only">Mobile Navigation Menu</SheetPrimitive.Title>
              <div className="flex h-full flex-col">
                <div className="p-6 border-b">
                  <SheetClose asChild>
                    <Link href="/" className="flex items-center gap-2" onClick={() => handleNavClick('MobileLogo', '/')}>
                      <Mountain className="h-8 w-8 text-primary" />
                      <span className="text-xl font-bold text-primary">Visit Nepal</span>
                    </Link>
                  </SheetClose>
                </div>
                <nav className="flex-1 flex flex-col gap-1 p-4">
                  {navItems.map((item) => (
                     <SheetClose asChild key={item.label}>
                        <Link
                        href={item.href}
                        className="flex items-center gap-3 rounded-md px-3 py-3 text-lg font-medium transition-colors hover:bg-muted hover:text-primary"
                        onClick={() => handleNavClick(`Mobile${item.label}`, item.href)}
                        >
                        <item.icon className="h-5 w-5 text-primary" />
                        {item.label}
                        </Link>
                    </SheetClose>
                  ))}
                </nav>
                <Separator />
                <div className="p-4 space-y-3">
                    <SheetClose asChild>
                        <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground w-full" asChild>
                            <Link href="/plan-trip" onClick={handleStartPlanningClick}>
                            <Search className="mr-2 h-4 w-4" />
                            Start Planning
                            </Link>
                        </Button>
                    </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

// Need to import SheetPrimitive for the SheetTitle to be recognized by the linter
import * as SheetPrimitive from "@radix-ui/react-dialog";
