import { useState } from "react";
import { Link } from "wouter";
import {
  Bird,
  ClipboardList,
  DollarSign,
  ShoppingBasket,
  Users,
  BarChart3,
  CircleCheck,
  ArrowRight,
  Sprout,
  Menu,
  X,
  Quote,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: AlertCircle,
    heading: "You've got five spreadsheets and none of them agree.",
    body: "Flock counts in one tab, egg inventory in another, preorders in a third. Every season you spend hours reconciling numbers that should just be there.",
  },
  {
    icon: AlertCircle,
    heading: "Preorder season means three weeks of email chaos.",
    body: "Customers reply-all to confirmations. Someone double-books a pickup slot. You're copying order details by hand into a deposit spreadsheet the night before.",
  },
  {
    icon: AlertCircle,
    heading: "At the end of the month, you're guessing at your margins.",
    body: "Feed costs, vet bills, labor — scattered across receipts and memory. Tax season is a scramble. You know the farm is profitable, but you can't prove it.",
  },
];

const FEATURES = [
  {
    icon: Bird,
    title: "Flock & Animal Tracking",
    description:
      "Know exactly how many birds you have, track movements between paddocks, log health events, and stay on top of mortality rates in real time.",
  },
  {
    icon: ClipboardList,
    title: "Egg Inventory Management",
    description:
      "Record daily collections by type, manage inventory lots, allocate eggs to customer orders, and catch shortfalls before pickup day.",
  },
  {
    icon: DollarSign,
    title: "Expense Tracking",
    description:
      "Categorize every dollar spent — feed, supplies, labor, vet bills. Filter by date or category and export a full summary at tax time.",
  },
  {
    icon: ShoppingBasket,
    title: "Order & Pickup Management",
    description:
      "Run preorder batches, schedule pickup events, track fulfillment, and send customers automated confirmations — no spreadsheets required.",
  },
  {
    icon: Users,
    title: "Team Access",
    description:
      "Invite farm hands, partners, or a bookkeeper with role-based permissions. Owners see everything; members see only what they need.",
  },
  {
    icon: BarChart3,
    title: "Reporting & Exports",
    description:
      "Summarize revenue, expenses, and flock data by date range. Export to CSV for your accountant or import into your own tools.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    description: "Perfect for sole operators and very small flocks.",
    highlight: false,
    features: [
      "Up to 100 orders/month",
      "1 admin user",
      "Flock & egg tracking",
      "Expense tracking",
      "CSV Report Exports",
      "Order & pickup management",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "$59",
    description: "For farms that are scaling and need more horsepower.",
    highlight: true,
    features: [
      "Everything in Starter",
      "Unlimited Orders",
      "Up to 5 users",
      "Priority email support",
      "Reporting dashboards",
      "Custom domain (included)",
    ],
  },
  {
    name: "Pro",
    price: "$99",
    description: "For established operations with full teams.",
    highlight: false,
    features: [
      "Unlimited users",
      "Everything in Growth",
      "API access",
      "White-label option (add-on)",
      "Dedicated onboarding call",
    ],
  },
];

const ADDONS = [
  { name: "Custom domain", price: "+$10/mo" },
  { name: "SMS notifications", price: "+$15/mo/1000 SMS messages" },
  { name: "Additional admin users", price: "+$10/mo per user" },
  { name: "White-label branding", price: "+$49/mo" },
  { name: "Onboarding & setup assistance", price: "$99 one-time" },
];

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/farmops" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[hsl(148,26%,23%)] flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl text-[hsl(148,26%,23%)] tracking-tight">
              JP Farm<span className="text-[hsl(14,52%,54%)]">Ops</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-stone-600 hover:text-[hsl(148,26%,23%)] transition-colors font-medium">
              Features
            </a>
            <a href="#pricing" className="text-sm text-stone-600 hover:text-[hsl(148,26%,23%)] transition-colors font-medium">
              Pricing
            </a>
            <Link href="/farmops/login" className="text-sm text-stone-600 hover:text-[hsl(148,26%,23%)] transition-colors font-medium">
              Sign in
            </Link>
            <Link
              href="/farmops/register"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(148,26%,23%)] text-white text-sm font-semibold hover:bg-[hsl(148,26%,18%)] transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-3">
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm font-medium text-stone-700 py-2">Features</a>
          <a href="#pricing" onClick={() => setOpen(false)} className="block text-sm font-medium text-stone-700 py-2">Pricing</a>
          <Link href="/farmops/login" className="block text-sm font-medium text-stone-700 py-2">Sign in</Link>
          <Link
            href="/farmops/register"
            className="block text-center px-4 py-2.5 rounded-lg bg-[hsl(148,26%,23%)] text-white text-sm font-semibold"
          >
            Start Free Trial
          </Link>
        </div>
      )}
    </header>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FarmOpsLanding() {
  return (
    <div className="text-stone-900 scroll-smooth">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[hsl(148,26%,14%)]">
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "url('/images/texture-bg.png')",
            backgroundSize: "400px 400px",
          }}
        />
        {/* Warm glow */}
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] opacity-10 rounded-full bg-[hsl(14,52%,54%)] blur-[120px] translate-x-1/4 translate-y-1/4" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-40">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm font-medium mb-8">
              <Sprout className="w-4 h-4 text-[hsl(135,60%,70%)]" />
              14-day free trial · No credit card required
            </span>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-7">
              Run Your Farm.{" "}
              <span className="block text-[hsl(135,40%,72%)]">
                Not Your Spreadsheets.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-10 max-w-2xl">
              JP FarmOps gives small farms a professional online presence, automated
              preorder management, and the tools to grow — without the tech
              headaches.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href="/farmops/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-[hsl(148,26%,18%)] font-bold text-base hover:bg-stone-100 transition-colors shadow-lg"
              >
                Start Free — No Credit Card Required
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/25 text-white/80 font-semibold text-base hover:bg-white/10 transition-colors"
              >
                See pricing
              </a>
            </div>

            <p className="text-sm text-white/40 flex items-center gap-1.5">
              <CircleCheck className="w-4 h-4 text-[hsl(135,40%,65%)]" />
              Trusted by Jack Pine Farms. Built for farms like yours.
            </p>
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-[hsl(40,33%,96%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-5">
              Sound familiar?
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              You started farming to grow things — not to manage fourteen tabs in
              a spreadsheet. But somewhere between tracking flock movements,
              processing preorders, and chasing down egg inventory, the admin
              work took over. You're spending evenings updating rows instead of
              planning for next season.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map(({ icon: Icon, heading, body }) => (
              <div
                key={heading}
                className="bg-white rounded-2xl p-7 border border-stone-200 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(14,52%,94%)] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[hsl(14,52%,44%)]" />
                </div>
                <h3 className="font-semibold text-stone-900 mb-3 leading-snug">{heading}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4">
              Everything your farm needs.{" "}
              <span className="text-[hsl(148,26%,30%)]">Nothing it doesn't.</span>
            </h2>
            <p className="text-stone-500 text-lg max-w-xl mx-auto">
              Purpose-built tools that match how small diversified farms actually
              work — not retrofitted enterprise software.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group bg-[hsl(40,33%,98%)] rounded-2xl p-7 border border-stone-200 hover:border-[hsl(148,26%,60%)] hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[hsl(148,26%,93%)] flex items-center justify-center mb-5 group-hover:bg-[hsl(148,26%,88%)] transition-colors">
                  <Icon className="w-5 h-5 text-[hsl(148,26%,28%)]" />
                </div>
                <h3 className="text-base font-bold text-stone-900 mb-2">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────────────── */}
      <section className="py-24 bg-[hsl(148,26%,14%)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white/90 mb-12">
            From one farm to many.
          </h2>

          <div className="relative bg-white/5 border border-white/10 rounded-3xl px-8 md:px-14 py-12">
            <Quote className="absolute top-8 left-8 w-8 h-8 text-[hsl(14,52%,54%)]/40" />
            <blockquote className="text-lg md:text-xl text-white/80 leading-relaxed mb-8 italic">
              "Before JP FarmOps, I was juggling spreadsheets, texts, and sticky
              notes just to manage preorders. Now customers sign up online, I
              know my inventory in real time, and I'm not spending my evenings
              doing data entry. It's exactly what we needed."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(148,26%,30%)] flex items-center justify-center text-white font-bold text-sm">
                SB
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Stephanie Bellinger</div>
                <div className="text-xs text-white/50">Jack Pine Farm · Reed City & Tustin, MI</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-[hsl(40,33%,97%)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4">
              Simple, transparent pricing.
            </h2>
            <p className="text-stone-500 text-lg">
              All plans include a full 14-day free trial. No credit card required to start.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-12">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border transition-all h-full ${
                  plan.highlight
                    ? "bg-[hsl(148,26%,23%)] border-[hsl(148,26%,35%)] shadow-2xl md:scale-[1.04] md:-translate-y-2"
                    : "bg-white border-stone-200 shadow-sm hover:shadow-md hover:-translate-y-1"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-block px-4 py-1 rounded-full bg-[hsl(14,52%,54%)] text-white text-xs font-bold shadow-md">
                      Most Popular
                    </span>
                  </div>
                )}

                  <div className="p-8 flex flex-col h-full">
                  <h3 className={`text-xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-stone-900"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mb-6 ${plan.highlight ? "text-white/60" : "text-stone-500"}`}>
                    {plan.description}
                  </p>
                  <div className="mb-8">
                    <span className={`text-5xl font-bold tracking-tight ${plan.highlight ? "text-white" : "text-stone-900"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ml-1.5 ${plan.highlight ? "text-white/50" : "text-stone-400"}`}>
                      / month
                    </span>
                  </div>

                    <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CircleCheck
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            plan.highlight ? "text-[hsl(135,40%,65%)]" : "text-[hsl(148,26%,40%)]"
                          }`}
                        />
                        <span className={plan.highlight ? "text-white/80" : "text-stone-700"}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/farmops/register"
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                      plan.highlight
                        ? "bg-white text-[hsl(148,26%,23%)] hover:bg-stone-100"
                        : "bg-[hsl(148,26%,23%)] text-white hover:bg-[hsl(148,26%,18%)]"
                    }`}
                  >
                    Start free trial
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">
                Add-ons — available on any plan
              </h3>
              <p className="text-stone-500 text-sm mt-1">
                Extend your subscription with exactly what you need.
              </p>
            </div>
            <div className="divide-y divide-stone-100">
              {ADDONS.map(({ name, price }) => (
                <details key={name} className="group">
                  <summary className="flex items-center justify-between px-8 py-4 cursor-pointer list-none">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-90" />
                      <span className="text-sm font-medium text-stone-700">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-[hsl(148,26%,30%)] ml-4 whitespace-nowrap">
                      {price}
                    </span>
                  </summary>
                  <div className="px-8 pb-4 pt-1 text-sm text-stone-500 pl-14">
                    Details coming soon.
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-28 bg-[hsl(148,26%,14%)] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-10 rounded-full bg-[hsl(135,40%,50%)] blur-[100px]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-6">
            Your farm deserves better tools.
          </h2>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Start your 14-day free trial today. No credit card. No commitment.
            Cancel any time.
          </p>
          <Link
            href="/farmops/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white text-[hsl(148,26%,18%)] font-bold text-base hover:bg-stone-100 transition-colors shadow-lg"
          >
            Start Free — No Credit Card Required
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-white/30 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/farmops/login" className="text-white/60 underline hover:text-white transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-stone-950 text-white/40 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[hsl(148,26%,30%)] flex items-center justify-center">
              <Sprout className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white/60">JP FarmOps</span>
            <span className="text-white/20">·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <a
            href="https://jackpinefarms.farm"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/70 transition-colors"
          >
            jackpinefarms.farm
          </a>
        </div>
      </footer>
    </div>
  );
}
