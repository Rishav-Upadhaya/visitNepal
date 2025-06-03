import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Enhanced metadata for SEO
export const metadata: Metadata = {
  title: {
    default: 'Visit Nepal - Travel, Tour & Explore the Himalayas',
    template: '%s | Visit Nepal - Travel & Tour Guide', // Template for sub-pages
  },
  description: 'Your ultimate guide to travel and tours in Nepal. Plan your visit, explore majestic Himalayas, discover 77 districts, find hidden gems, and book your adventure with our AI-powered platform.',
  keywords: ['Nepal', 'Visit Nepal', 'Travel Nepal', 'Nepal Tour', 'Himalayas', 'Trekking Nepal', 'Kathmandu', 'Pokhara', 'Everest', 'Annapurna', 'Nepal Tourism', 'Explore Nepal', 'Nepal Adventure', 'Nepal Districts'],
  openGraph: {
      title: 'Visit Nepal - Travel, Tour & Explore the Himalayas',
      description: 'Your ultimate guide to travel and tours in Nepal. Plan your visit, explore majestic Himalayas, and book your adventure.',
      url: 'https://visitnepal.vercel.app', // Replace with your actual domain
      siteName: 'Visit Nepal',
      // images: [ // Add a default social sharing image
      //   {
      //     url: 'https://your-website-url.com/og-image.png', // Replace with your image URL
      //     width: 1200,
      //     height: 630,
      //   },
      // ],
      locale: 'en_US',
      type: 'website',
  },
  twitter: {
     card: 'summary_large_image',
     title: 'Visit Nepal - Travel, Tour & Explore the Himalayas',
     description: 'Your ultimate guide to travel and tours in Nepal. Plan your adventure.',
     // siteId: 'yourTwitterSiteId', // Optional: Your Twitter ID
     // creator: '@yourTwitterHandle', // Optional: Your Twitter handle
     // images: ['https://your-website-url.com/twitter-image.png'], // Optional: Replace with your image URL
  },
  robots: { // Basic robots directives
      index: true,
      follow: true,
      googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
      },
  },
  // Optional: Add icons/manifest for better PWA/bookmarking experience
  // icons: {
  //   icon: '/favicon.ico',
  //   shortcut: '/favicon-16x16.png',
  //   apple: '/apple-touch-icon.png',
  // },
  // manifest: '/site.webmanifest',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
