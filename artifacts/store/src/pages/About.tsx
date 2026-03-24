export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-serif font-bold text-primary mb-6">Our Story</h1>
        <p className="text-xl text-muted-foreground">A small farm with a big commitment to doing things right.</p>
      </div>

      <div className="prose prose-lg prose-p:text-muted-foreground prose-headings:text-primary prose-headings:font-serif mx-auto">
        <p className="lead text-2xl font-medium text-foreground mb-10 text-center">
          Jack Pine Farm was born from a desire to connect our community with food they can trust.
        </p>

        {/* farm scene placeholder */},
        <img src="https://pixabay.com/get/g38f317c0f9f359c2d37723a48902c4a484a546ad499a306b93b56021742b4bfcc63a12e4dd446dfe76599e09466a7d6bb5894208e2f99925caf88aa0060a0b51_1280.jpg" alt="Farm landscape" className="w-full rounded-3xl shadow-lg mb-12 border-4 border-white object-cover aspect-video" />

        <div className="bg-card p-10 rounded-3xl border border-border shadow-sm mb-12">
          <h2 className="text-3xl mt-0">Roots in the Soil</h2>
          <p>
            When we acquired our 70 acres, we saw an opportunity to step away from the industrial food system and build something resilient. We focus exclusively on pastured poultry—duck and chicken eggs, alongside meat chickens and turkeys—because we believe birds are meant to be outdoors, foraging in the sun.
          </p>
          <p>
            The name "Jack Pine Farm" represents resilience and growth. Just as the Jack Pine tree thrives in challenging environments, we are building an agricultural model that regenerates the land rather than depleting it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-primary/5 p-8 rounded-2xl border border-primary/10">
            <h3 className="text-2xl mt-0 text-primary">Community Focus</h3>
            <p className="text-base">
              We don't ship our products across the country. Our focus is entirely on our local community. When you buy from Jack Pine Farm, you're picking up directly from the people who raised your food.
            </p>
          </div>
          <div className="bg-accent/5 p-8 rounded-2xl border border-accent/10">
            <h3 className="text-2xl mt-0 text-accent">Real Food</h3>
            <p className="text-base">
              No shortcuts. Our birds get non-GMO feed, fresh air, and regular moves to new pasture. It's more work, but the result is a superior product you can feel good about feeding your family.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
