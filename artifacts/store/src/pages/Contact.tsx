import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(120, "Subject is too long"),
  message: z.string().min(10, "Message must be at least 10 characters").max(3000, "Message is too long (max 3000 characters)"),
  company: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", subject: "", message: "", company: "" },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setServerError("Something went wrong. Please try again or email us directly.");
        return;
      }
      setSubmitted(true);
      reset();
    } catch {
      setServerError("Unable to send your message. Please check your connection and try again.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <h1 className="text-5xl font-serif font-bold text-primary mb-6">Get in Touch</h1>
        <p className="text-lg text-muted-foreground">
          Have a question about an order, our practices, or pickup times? Send us a message and we'll get back to you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="bg-card p-10 rounded-3xl border border-border shadow-sm">
          <h2 className="text-3xl font-serif font-bold text-foreground mb-8">Farm Details</h2>
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1 text-foreground">Location</h3>
                <p className="text-muted-foreground">Jack Pine Farm</p>
                <p className="text-muted-foreground">Local Pickup Only</p>
                <p className="text-sm text-accent mt-2 font-medium">
                  Directions provided in order confirmation emails.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1 text-foreground">Email</h3>
                <a
                  href="mailto:steph@jackpinefarms.farm"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  hello@jackpinefarms.farm
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card p-10 rounded-3xl border border-border shadow-sm">
          <h2 className="text-3xl font-serif font-bold text-foreground mb-8">Send a Message</h2>

          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <CheckCircle className="w-14 h-14 text-green-500" />
              <h3 className="text-xl font-bold text-foreground">Message sent!</h3>
              <p className="text-muted-foreground max-w-sm">
                Thanks for reaching out. We'll get back to you as soon as we can.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              <input
                type="text"
                {...register("company")}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
              />

              <div className="space-y-1.5">
                <label htmlFor="contact-name" className="block text-sm font-bold text-foreground">
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Smith"
                  {...register("name")}
                  className={`w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.name ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="block text-sm font-bold text-foreground">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@example.com"
                  {...register("email")}
                  className={`w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.email ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-subject" className="block text-sm font-bold text-foreground">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  placeholder="Question about my order"
                  {...register("subject")}
                  className={`w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                    errors.subject ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.subject && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.subject.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="block text-sm font-bold text-foreground">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  placeholder="How can we help you?"
                  {...register("message")}
                  className={`w-full px-4 py-3 rounded-xl bg-background border transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none ${
                    errors.message ? "border-destructive" : "border-border"
                  }`}
                />
                {errors.message && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errors.message.message}
                  </p>
                )}
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
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
