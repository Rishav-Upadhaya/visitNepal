import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Palette, MountainSnow, PawPrint } from 'lucide-react'; // Updated icons for better representation

const categories = [
  {
    title: "Rich Culture & Heritage",
    icon: Palette,
    description: "Discover ancient temples, vibrant festivals, and the warm hospitality of the Nepali people. Explore UNESCO World Heritage sites in Kathmandu Valley on your Nepal tour.",
    image: "https://placehold.co/600x400.png",
    hint: "Nepal temple festival",
    alt: "Colorful prayer flags fluttering at a historic temple in Kathmandu, Nepal, showcasing rich culture.", // Descriptive alt text
  },
  {
    title: "Thrilling Adventures",
    icon: MountainSnow,
    description: "Embark on world-class treks like Everest Base Camp and Annapurna Circuit, or try rafting, paragliding, and bungee jumping amidst stunning landscapes during your Nepal travel.",
    image: "https://placehold.co/600x400.png",
    hint: "Nepal trekking mountain",
    alt: "Trekkers approaching a snow-capped peak in the Himalayas, representing adventure travel in Nepal.", // Descriptive alt text
  },
  {
    title: "Diverse Wildlife",
    icon: PawPrint, // Using PawPrint for wildlife
    description: "Explore national parks teeming with rare species like the Bengal tiger, one-horned rhinoceros, and elusive snow leopard. A paradise for nature lovers visiting Nepal.",
    image: "https://placehold.co/600x400.png",
    hint: "Nepal rhino tiger",
    alt: "A one-horned rhinoceros grazing in Chitwan National Park, highlighting Nepal's diverse wildlife.", // Descriptive alt text
  }
];

export function WhyNepal() {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-primary">Why Visit Nepal?</h2>
           <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover a land of breathtaking beauty, spiritual serenity, and unparalleled adventure for your next travel or tour.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {categories.map((category) => (
            <Card key={category.title} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col bg-card">
              <CardHeader className="p-0">
                <div className="aspect-video relative w-full">
                  <Image
                    src={category.image} // Changed from generateImage(category.hint)
                    alt={category.alt} // Use the descriptive alt text
                    data-ai-hint={category.hint}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" // Add sizes prop
                  />
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-grow flex flex-col">
                <div className="flex items-center mb-3">
                  <category.icon className="h-8 w-8 text-accent mr-3" />
                  <CardTitle className="text-xl text-primary">{category.title}</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-base">
                  {category.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
