import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Sprout } from "lucide-react";
import { useFarmopsRegister } from "@/hooks/useFarmopsAuth";

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export default function FarmOpsRegister() {
  const [, setLocation] = useLocation();
  const register = useFarmopsRegister();

  const [farmName, setFarmName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFarmNameChange = (v: string) => {
    setFarmName(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(slugify(v));
    setSlugEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ farmName, slug, ownerName, email, password });
      setLocation("/farmops/verify-email");
    } catch (err: any) {
      setError(err?.error ?? err?.message ?? "Registration failed. Please try again.");
    }
  };

  const field =
    "w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm";
  const label = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
            <Sprout className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Create your farm account</h1>
          <p className="text-slate-500 mt-2 text-sm">14-day free trial · No credit card required</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={label}>Farm name</label>
              <input
                type="text"
                className={field}
                placeholder="Sunrise Acres"
                value={farmName}
                onChange={(e) => handleFarmNameChange(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div>
              <label className={label}>Farm URL slug</label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 transition-all">
                <span className="px-3 py-3 text-sm text-slate-400 border-r border-slate-300 bg-slate-100 whitespace-nowrap">
                  farmops.jackpinefarms.farm/
                </span>
                <input
                  type="text"
                  className="flex-1 px-3 py-3 bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="sunrise-acres"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                  minLength={3}
                  maxLength={50}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div>
              <label className={label}>Your name</label>
              <input
                type="text"
                className={field}
                placeholder="Jane Smith"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div>
              <label className={label}>Email address</label>
              <input
                type="email"
                className={field}
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={label}>Password</label>
              <input
                type="password"
                className={field}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {register.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create account & start trial"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link href="/farmops/login" className="text-emerald-700 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
