import { CheckCircle2 } from "lucide-react";
import { useSiteImage } from "@/lib/useSiteImage";

export default function HowWeRaiseThem() {
  const pasturePhoto = useSiteImage(
    "image.how_we_pasture",
    "https://pixabay.com/get/g27363507b289c0d668275bdf140bc91146030b4daa710f9f7a3795301792362addc33384d168bd84b4bcd9eaf77913bc1ea8f3b44f781b3da4309d479f4202f1_1280.jpg"
  );
  const feedPhoto = useSiteImage(
    "image.how_we_feed",
    "https://pixabay.com/get/gfbeb1c72db35e62592a594faf40308f92977b9b859073740d980ef8704251cb4be1784bcebb71e1de9040afa32822162_1280.jpg"
  );

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('/images/texture-bg.png')] mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6">How We Raise Them</h1>
          <p className="text-xl md:text-2xl text-primary-foreground/90 font-medium max-w-2xl mx-auto leading-relaxed">
            Transparent farming practices. Birds roaming freely on 70 acres of pasture.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Practice 1: Pasture */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-accent/10 rounded-3xl transform -rotate-3"></div>
              <img src={pasturePhoto} alt="Lush green pasture grass" className="relative rounded-2xl shadow-xl w-full aspect-[4/3] object-cover border-4 border-white" />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-serif font-bold text-primary mb-6">True Pasture Raised</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Our birds aren't just given "access to the outdoors" — they live on it. We rotate our flocks across 70 acres of lush, diverse pasture. This constant movement ensures they always have fresh forage, while naturally fertilizing the land.
              </p>
              <ul className="space-y-4">
                {[
                  "Moved to fresh grass regularly",
                  "Free to scratch, forage, and express natural behaviors",
                  "Regenerative impact on the soil"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-accent shrink-0" />
                    <span className="text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Practice 2: Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
            <div>
              <h2 className="text-3xl font-serif font-bold text-primary mb-6">Non-GMO Feed</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                While pasture provides essential greens and bugs, poultry need grain to thrive. We supplement their foraging with a high-quality, locally-milled Non-GMO grain mix. 
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                We believe in keeping things simple and natural. No routine antibiotics, no synthetic growth promoters, and absolutely no genetically modified organisms in our feed bunks.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-primary/10 rounded-3xl transform rotate-2"></div>
              <img src={feedPhoto} alt="Natural grains" className="relative rounded-2xl shadow-xl w-full aspect-[4/3] object-cover border-4 border-white" />
            </div>
          </div>

          {/* Seasonality */}
          <div className="bg-card rounded-3xl p-8 md:p-12 border border-border shadow-sm text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-serif font-bold text-foreground mb-4">What to Expect</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Farming in harmony with nature means embracing seasonality. Our product availability changes with the weather, daylight, and natural life cycles of our flocks.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-6 bg-background rounded-2xl border border-border">
                <h3 className="font-bold text-primary mb-2 text-lg">Spring & Summer</h3>
                <p className="text-muted-foreground text-sm">Peak egg production and our first batches of meat birds hit the fresh spring grass.</p>
              </div>
              <div className="p-6 bg-background rounded-2xl border border-border">
                <h3 className="font-bold text-primary mb-2 text-lg">Fall</h3>
                <p className="text-muted-foreground text-sm">The highly anticipated Turkey harvest. Secure your deposit early for the holidays.</p>
              </div>
              <div className="p-6 bg-background rounded-2xl border border-border">
                <h3 className="font-bold text-primary mb-2 text-lg">Winter</h3>
                <p className="text-muted-foreground text-sm">A time of rest. Egg production slows naturally. Frozen meat inventory is sold until depleted.</p>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
