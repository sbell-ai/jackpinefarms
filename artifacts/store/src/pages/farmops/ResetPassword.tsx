import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Sprout } from "lucide-react";
import { useFarmopsResetPassword } from "@/hooks/useFarmopsAuth";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { validatePassword } from "@/lib/passwordStrength";

export default function FarmOpsResetPassword() {
  const reset = useFarmopsResetPassword();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value) {
      const result = validatePassword(value);
      setPasswordError(result.valid ? "" : result.message);
    } else {
      setPasswordError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const strength = validatePassword(password);
    if (!strength.valid) {
      setPasswordError(strength.message);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await reset.mutateAsync({ token, password });
      setLocation("/farmops/login?reset=1");
    } catch (err: any) {
      setError(err?.error ?? "Reset failed. The link may have expired.");
    }
  };

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-slate-600 mb-4">Invalid reset link.</p>
          <Link href="/farmops/forgot-password" className="text-emerald-700 font-semibold hover:underline text-sm">
            Request a new one
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
            <Sprout className="w-7 h-7 text-emerald-700" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Set a new password</h1>
          <p className="text-slate-500 mt-2 text-sm">Must be at least 8 characters.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
              <PasswordInput
                variant="farmops"
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
              />
              {passwordError ? (
                <p className="text-xs text-red-600 mt-1">{passwordError}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  Strong password: 8+ chars, uppercase, lowercase, and a number.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
              <PasswordInput
                variant="farmops"
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 text-sm"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              disabled={reset.isPending || !!passwordError || !password || !confirm}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {reset.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
