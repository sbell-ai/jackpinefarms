import { useGetSiteSettings } from "@workspace/api-client-react";
import { SiteImageUploader } from "@/components/admin/SiteImageUploader";
import { Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const IMAGE_SLOTS = [
  {
    key: "image.hero_bg",
    label: "Home Page Hero",
    description: "Full-width background photo on the home page.",
    fallback: `${BASE}images/hero-bg.jpg`,
  },
  {
    key: "image.logo",
    label: "Farm Logo",
    description: "Logo shown in the navigation bar and footer.",
    fallback: `${BASE}images/logo.png`,
  },
  {
    key: "image.checkout_hero",
    label: "Checkout Banner",
    description: "Banner image at the top of the checkout page.",
    fallback: `${BASE}images/checkout-hero.png`,
  },
  {
    key: "image.home_promise",
    label: "Promise Section Photo",
    description: 'Photo beside "The Jack Pine Promise" section on the home page.',
    fallback: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=800&q=80",
  },
  {
    key: "image.about_farm",
    label: "About Page Photo",
    description: "Farm landscape image on the Our Story / About page.",
    fallback: "https://pixabay.com/get/g38f317c0f9f359c2d37723a48902c4a484a546ad499a306b93b56021742b4bfcc63a12e4dd446dfe76599e09466a7d6bb5894208e2f99925caf88aa0060a0b51_1280.jpg",
  },
  {
    key: "image.how_we_pasture",
    label: "How We Raise Them – Pasture Photo",
    description: 'Pasture/land image in the "True Pasture Raised" section.',
    fallback: "https://pixabay.com/get/g27363507b289c0d668275bdf140bc91146030b4daa710f9f7a3795301792362addc33384d168bd84b4bcd9eaf77913bc1ea8f3b44f781b3da4309d479f4202f1_1280.jpg",
  },
  {
    key: "image.how_we_feed",
    label: "How We Raise Them – Feed Photo",
    description: 'Grain/feed image in the "Non-GMO Feed" section.',
    fallback: "https://pixabay.com/get/gfbeb1c72db35e62592a594faf40308f92977b9b859073740d980ef8704251cb4be1784bcebb71e1de9040afa32822162_1280.jpg",
  },
  {
    key: "image.product_fallback",
    label: "Product Fallback Image",
    description: "Shown for products that have no photos uploaded yet.",
    fallback: "https://images.unsplash.com/photo-1598965402089-897ce52e8355?w=600&q=80",
  },
];

export default function SiteImages() {
  const { data: settings, isLoading } = useGetSiteSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary">Site Images</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload custom photos for each part of your storefront. Changes are live immediately — no redeployment needed. Click the red × on any image to revert to the default.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {IMAGE_SLOTS.map((slot) => (
          <SiteImageUploader
            key={slot.key}
            settingKey={slot.key}
            label={slot.label}
            description={slot.description}
            currentUrl={settings?.[slot.key] ?? ""}
            fallbackUrl={slot.fallback}
          />
        ))}
      </div>
    </div>
  );
}
