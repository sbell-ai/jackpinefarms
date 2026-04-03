import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Sprout } from "lucide-react";
import { useFarmopsLogin } from "@/hooks/useFarmopsAuth";

export default function FarmOpsLogin() {
  const [, setLocation] = useLocation();
  const login = useFarmopsLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      setLocation("/farmops/dashboard");
    } catch (err: any) {
      setError(err?.error === "multiple_tenants"
        ? "This email is linked to multiple accounts. Please contact support."
        : err?.error ?? "Invalid email or password.");
    }
  };

  const field =
    "w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm";
  const label = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
            <Sprout className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 mt-2 text-sm">Sign in to your FarmOps account</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <Link
                  href="/farmops/forgot-password"
                  className="text-xs text-emerald-700 hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                className={field}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{" "}
            <Link href="/farmops/register" className="text-emerald-700 font-semibold hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
