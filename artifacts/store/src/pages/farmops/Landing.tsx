import { Link } from "wouter";
import {
  Bird,
  ClipboardList,
  DollarSign,
  ShoppingBasket,
  Users,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sprout,
} from "lucide-react";
import { useState } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────

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
      "1 admin user",
      "Flock & egg tracking",
      "Expense tracking",
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
      "Up to 5 users",
      "Everything in Starter",
      "CSV data exports",
      "Priority email support",
      "Reporting dashboards",
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
      "Dedicated onboarding",
    ],
  },
];

const ADDONS = [
  { name: "Custom domain", price: "+$10/mo" },
  { name: "SMS notifications", price: "+$15/mo" },
  { name: "Additional admin users", price: "+$10/mo per user" },
  { name: "White-label branding", price: "+$25/mo" },
  { name: "Onboarding & setup assistance", price: "$99 one-time" },
];

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes — every new account gets a full 14 days free. No credit card required to start.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Absolutely. Cancel from your account settings any time and you won't be billed again. Your data stays accessible until the end of your billing period.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You'll be prompted to choose a plan. If you don't subscribe, your account pauses and your data is preserved for 30 days.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrade or downgrade at any time. Changes take effect at the next billing cycle.",
  },
  {
    q: "Is my farm data secure?",
    a: "All data is encrypted in transit and at rest. Each farm's data is strictly isolated — no tenant can see another's records.",
  },
  {
    q: "Do you offer support?",
    a: "Email support is included on all plans. Growth and Pro customers get priority response times.",
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        className="w-full flex justify-between items-center py-5 text-left text-slate-900 font-medium hover:text-emerald-700 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-slate-600 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FarmOpsLanding() {
  return (
    <div className="text-slate-900">
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 text-sm font-medium mb-6">
              <Sprout className="w-4 h-4" />
              14-day free trial · No credit card required
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Farm management software built for{" "}
              <span className="text-emerald-300">small farms</span>
            </h1>
            <p className="text-lg md:text-xl text-emerald-100 leading-relaxed mb-10 max-w-2xl">
              Track your flocks, manage egg inventory, run preorders, and keep
              expenses organized — all in one place. Built by farmers, for farmers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/farmops/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-emerald-900 font-bold text-base hover:bg-emerald-50 transition-colors shadow-lg"
              >
                Start your free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-emerald-400/50 text-emerald-100 font-semibold text-base hover:bg-emerald-800/50 transition-colors"
              >
                See pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-emerald-700 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              ["14-day", "Free trial"],
              ["3 plans", "Starter → Pro"],
              ["5 add-ons", "À la carte"],
              ["100%", "Data isolation"],
            ].map(([num, label]) => (
              <div key={label}>
                <div className="text-2xl font-bold text-emerald-100">{num}</div>
                <div className="text-sm text-emerald-300 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything your farm needs
            </h2>
            <p className="text-slate-600 text-lg max-w-xl mx-auto">
              Purpose-built tools that match how small diversified farms actually work —
              not retrofitted enterprise software.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-emerald-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-600 text-lg">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border ${
                  plan.highlight
                    ? "bg-emerald-700 border-emerald-600 text-white shadow-xl scale-[1.02]"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-emerald-100 text-xs font-semibold mb-4">
                    Most popular
                  </span>
                )}
                <h3
                  className={`text-xl font-bold mb-1 ${
                    plan.highlight ? "text-white" : "text-slate-900"
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm mb-6 ${
                    plan.highlight ? "text-emerald-200" : "text-slate-500"
                  }`}
                >
                  {plan.description}
                </p>
                <div className="mb-8">
                  <span
                    className={`text-4xl font-bold ${
                      plan.highlight ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm ml-1 ${
                      plan.highlight ? "text-emerald-200" : "text-slate-500"
                    }`}
                  >
                    /month
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.highlight ? "text-emerald-300" : "text-emerald-600"
                        }`}
                      />
                      <span className={plan.highlight ? "text-emerald-50" : "text-slate-700"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/farmops/register"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? "bg-white text-emerald-800 hover:bg-emerald-50"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Add-ons — available on any plan
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Extend your subscription with exactly what you need.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ADDONS.map(({ name, price }) => (
                <div
                  key={name}
                  className="flex items-center justify-between bg-white rounded-xl px-5 py-4 border border-slate-200"
                >
                  <span className="text-sm font-medium text-slate-800">{name}</span>
                  <span className="text-sm font-bold text-emerald-700 ml-4 whitespace-nowrap">
                    {price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Frequently asked questions
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-8">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 bg-emerald-900 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-5">
            Ready to run a tighter operation?
          </h2>
          <p className="text-emerald-200 text-lg mb-10">
            Start your 14-day free trial today. No credit card. No commitment.
            Cancel any time.
          </p>
          <Link
            href="/farmops/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-white text-emerald-900 font-bold text-base hover:bg-emerald-50 transition-colors shadow-lg"
          >
            Create your farm account
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-emerald-400 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/farmops/login" className="text-emerald-200 underline hover:text-white">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
