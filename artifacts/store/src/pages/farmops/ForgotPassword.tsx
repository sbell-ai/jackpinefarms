import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Sprout } from "lucide-react";
import { useFarmopsForgotPassword } from "@/hooks/useFarmopsAuth";

export default function FarmOpsForgotPassword() {
  const forgot = useFarmopsForgotPassword();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgot.mutateAsync({ email });
    setSubmitted(true);
  };

  const field =
    "w-full px-4 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm";

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
            <Sprout className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-slate-500 mt-2 text-sm">
            We'll send a reset link to your email if an account exists.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {submitted ? (
            <div className="text-center py-4">
              <p className="text-slate-700 font-medium mb-2">Check your inbox</p>
              <p className="text-slate-500 text-sm mb-6">
                If an account exists for that email, a reset link has been sent. The link expires in 1 hour.
              </p>
              <Link href="/farmops/login" className="text-emerald-700 font-semibold hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  className={field}
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={forgot.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {forgot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
              </button>

              <p className="text-center text-sm text-slate-500">
                <Link href="/farmops/login" className="text-emerald-700 font-semibold hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
