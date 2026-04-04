import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Sprout, Bird, DollarSign, ShoppingBasket, ClipboardList, AlertTriangle } from "lucide-react";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

const QUICK_LINKS = [
  { icon: Bird, label: "Flocks & Animals", href: "/farmops/flocks", description: "Manage your flock records" },
  { icon: ClipboardList, label: "Egg Inventory", href: "/farmops/eggs", description: "Track daily collections" },
  { icon: DollarSign, label: "Expenses", href: "/farmops/expenses", description: "Log and review expenses" },
  { icon: ShoppingBasket, label: "Orders", href: "/farmops/orders", description: "Manage customer preorders" },
];

export default function FarmOpsDashboard() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading, error } = useFarmopsMe();

  useEffect(() => {
    if (!isLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const { tenant, user } = session;
  const isTrialing = tenant.status === "trialing";
  const trialDaysLeft = tenant.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Trial banner */}
      {isTrialing && (
        <div className="mb-8 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="text-sm">
            <span className="font-semibold">
              {trialDaysLeft > 0 ? `${trialDaysLeft} days left in your free trial.` : "Your free trial has ended."}
            </span>{" "}
            {trialDaysLeft > 0
              ? "Choose a plan before it ends to keep your data and avoid interruption."
              : "Subscribe now to restore access."}
            {" "}
            <Link href="/farmops#pricing" className="underline font-semibold hover:text-amber-900">
              View plans
            </Link>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
            <p className="text-sm text-slate-500">
              Welcome back, {user.name} ·{" "}
              <span className="capitalize">{tenant.plan} plan</span>
            </p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <h2 className="text-lg font-bold text-slate-800 mb-5">Quick access</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {QUICK_LINKS.map(({ icon: Icon, label, href, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <Icon className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Account info */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Farm account</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 mb-0.5">Farm slug</dt>
            <dd className="font-mono font-medium text-slate-800">{tenant.slug}</dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Plan</dt>
            <dd className="font-medium text-slate-800 capitalize">{tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-slate-500 mb-0.5">Status</dt>
            <dd className="font-medium text-slate-800 capitalize">{tenant.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
