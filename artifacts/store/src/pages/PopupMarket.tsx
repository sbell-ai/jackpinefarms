import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Phone,
  ShoppingBag,
  Clock,
  Star,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCT_OPTIONS = [
  "Fresh Eggs",
  "Seasonal Produce",
  "Herbs & Plants",
  "Honey & Preserves",
  "Pasture-Raised Meat",
  "Maple Syrup",
  "Wild Michigan Spruce Trees",
  "Artisan Goods",
];

const ATTENDEE_OPTIONS = ["Under 50", "50–150", "150–300", "300+"];

const EVENT_TYPE_OPTIONS = [
  "Neighborhood/HOA",
  "Corporate/Workplace",
  "Private Party",
  "Community/Civic",
  "School or Church",
  "Other",
];

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  organization: z.string().optional(),
  eventLocation: z.string().min(1, "Event location is required"),
  preferredDate: z.string().optional(),
  alternateDate: z.string().optional(),
  estimatedAttendees: z.string().optional(),
  eventType: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function PopupMarket() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [productsInterested, setProductsInterested] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      organization: "",
      eventLocation: "",
      preferredDate: "",
      alternateDate: "",
      estimatedAttendees: "",
      eventType: "",
      notes: "",
    },
  });

  const toggleProduct = (product: string) => {
    setProductsInterested((prev) =>
      prev.includes(product)
        ? prev.filter((p) => p !== product)
        : [...prev, product],
    );
  };

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/popup-market-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, productsInterested }),
      });
      if (res.status === 201) {
        setSubmitted(true);
        reset();
        setProductsInterested([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setServerError(
        (json as { error?: string }).error ??
          "Something went wrong. Please try again.",
      );
    } catch {
      setServerError(
        "Unable to submit your request. Please check your connection and try again.",
      );
    }
  };

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 text-center bg-background">
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-green-100 text-green-800 text-xs font-bold uppercase tracking-widest mb-6">
            Now booking 2025 events
          </span>
          <h1 className="text-5xl md:text-6xl font-bold mb-5 text-foreground">
            The Market{" "}
            <span className="font-serif italic text-primary">comes to you</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12">
            Jack Pine Farms brings fresh, farm-raised products directly to your
            neighborhood, workplace, or event.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16 mb-12">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">
                Farm-fresh
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                Products
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">
                Western Michigan
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                We travel to you
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">
                Flexible
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                Setup &amp; Scheduling
              </div>
            </div>
          </div>
          <hr className="border-border" />
        </div>
      </section>

      {/* What We Bring */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center mb-8">
            What we bring
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {(
              [
                {
                  Icon: Clock,
                  title: "Seasonal produce",
                  desc: "Eggs, vegetables, herbs, and more — harvested to order.",
                },
                {
                  Icon: ShoppingBag,
                  title: "Artisan goods",
                  desc: "Handmade, locally sourced, and carefully selected vendors.",
                },
                {
                  Icon: Star,
                  title: "Community experience",
                  desc: "Great for neighborhoods, corporate campuses, and private events.",
                },
                {
                  Icon: LayoutGrid,
                  title: "Customizable setup",
                  desc: "We tailor the market size and product mix to fit your event.",
                },
              ] as const
            ).map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-2xl p-6 flex items-start gap-4 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-green-700" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(
              [
                {
                  Icon: FileText,
                  step: "1",
                  title: "Submit Request",
                  desc: "Fill out the form below with your event details and what products you're interested in.",
                },
                {
                  Icon: Phone,
                  step: "2",
                  title: "We Confirm & Plan",
                  desc: "Our team reviews your request and reaches out within 2 business days to confirm details.",
                },
                {
                  Icon: ShoppingBag,
                  step: "3",
                  title: "Market Day",
                  desc: "We arrive with fresh, farm-raised products and set up a pop-up market experience for your guests.",
                },
              ] as const
            ).map(({ Icon, step, title, desc }) => (
              <div
                key={step}
                className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="text-xs font-bold text-accent uppercase tracking-widest mb-2">
                  Step {step}
                </div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-3">
                  {title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Area Map */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Where we travel
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            Our service area
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10">
            We travel throughout northwest and west-central Michigan — from Cheboygan to Grand Rapids and everywhere in between.
          </p>
          <img
            src="/images/mobile-market-service-area.png"
            alt="Map of Jack Pine Farms pop-up market service area in northwest and west-central Michigan"
            className="mx-auto w-full max-w-[600px] rounded-2xl border border-border shadow-sm"
          />
        </div>
      </section>

      {/* Request Form */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Request a Pop-Up Market
            </h2>
            <p className="text-muted-foreground text-lg">
              Tell us about your event and we'll be in touch soon.
            </p>
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-sm">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <CheckCircle className="w-14 h-14 text-green-500" />
                <h3 className="text-xl font-bold text-foreground">
                  Request received!
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  Your request has been received! We'll be in touch within 2
                  business days.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
                noValidate
              >
                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-name"
                      className="block text-sm font-bold text-foreground"
                    >
                      Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="pm-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Smith"
                      {...register("name")}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        errors.name ? "border-destructive" : "border-border",
                      )}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-email"
                      className="block text-sm font-bold text-foreground"
                    >
                      Email <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="pm-email"
                      type="email"
                      autoComplete="email"
                      placeholder="jane@example.com"
                      {...register("email")}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        errors.email ? "border-destructive" : "border-border",
                      )}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Phone + Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-phone"
                      className="block text-sm font-bold text-foreground"
                    >
                      Phone
                    </label>
                    <input
                      id="pm-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(555) 000-0000"
                      {...register("phone")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-org"
                      className="block text-sm font-bold text-foreground"
                    >
                      Organization / Neighborhood
                    </label>
                    <input
                      id="pm-org"
                      type="text"
                      placeholder="Maple Creek HOA"
                      {...register("organization")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Event Location */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="pm-location"
                    className="block text-sm font-bold text-foreground"
                  >
                    Event Location / Address{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="pm-location"
                    type="text"
                    placeholder="123 Main St, Anytown, MI"
                    {...register("eventLocation")}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                      errors.eventLocation
                        ? "border-destructive"
                        : "border-border",
                    )}
                  />
                  {errors.eventLocation && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.eventLocation.message}
                    </p>
                  )}
                </div>

                {/* Preferred + Alternate Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-preferred-date"
                      className="block text-sm font-bold text-foreground"
                    >
                      Preferred Date
                    </label>
                    <input
                      id="pm-preferred-date"
                      type="date"
                      {...register("preferredDate")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-alternate-date"
                      className="block text-sm font-bold text-foreground"
                    >
                      Alternate Date
                    </label>
                    <input
                      id="pm-alternate-date"
                      type="date"
                      {...register("alternateDate")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Estimated Attendees + Event Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-attendees"
                      className="block text-sm font-bold text-foreground"
                    >
                      Estimated Attendees
                    </label>
                    <select
                      id="pm-attendees"
                      {...register("estimatedAttendees")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Select range…</option>
                      {ATTENDEE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="pm-event-type"
                      className="block text-sm font-bold text-foreground"
                    >
                      Event Type
                    </label>
                    <select
                      id="pm-event-type"
                      {...register("eventType")}
                      className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Select type…</option>
                      {EVENT_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Products Interested */}
                <div className="space-y-2">
                  <span className="block text-sm font-bold text-foreground">
                    Products Interested In
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PRODUCT_OPTIONS.map((product) => {
                      const checked = productsInterested.includes(product);
                      return (
                        <label
                          key={product}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-all select-none",
                            checked
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background border-border text-foreground hover:border-primary/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggleProduct(product)}
                          />
                          <span
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                              checked
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {checked && (
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                viewBox="0 0 10 8"
                                fill="none"
                              >
                                <path
                                  d="M1 4l3 3 5-6"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          {product}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="pm-notes"
                    className="block text-sm font-bold text-foreground"
                  >
                    Additional Notes
                  </label>
                  <textarea
                    id="pm-notes"
                    rows={4}
                    placeholder="Any additional information about your event, specific needs, or questions…"
                    {...register("notes")}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>

                {serverError && (
                  <div className="flex items-start gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
