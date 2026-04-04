import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Lock as LockIcon, Leaf, CheckCircle2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { validatePassword } from "@/lib/passwordStrength";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
    if (!password || !confirmPassword) return;
    const strength = validatePassword(password);
    if (!strength.valid) {
      setPasswordError(strength.message);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Invalid Reset Link</h2>
          <p className="text-muted-foreground mb-6">This password reset link is invalid or has expired.</p>
          <Link href="/auth/forgot-password" className="text-primary hover:underline font-medium">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4 border border-primary/20">
            <Leaf className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">New Password</h1>
          <p className="text-muted-foreground mt-2">Enter a new password for your account</p>
        </div>

        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto border border-primary/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Password updated!</h2>
              <p className="text-muted-foreground text-sm">
                Your password has been changed successfully. You can now log in with your new password.
              </p>
              <Link
                href="/auth/login"
                className="block mt-4 text-primary hover:underline font-medium text-sm"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">New password</label>
                <PasswordInput
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  leftIcon={<LockIcon className="w-5 h-5" />}
                  className="w-full pl-12 pr-10 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="At least 8 characters"
                />
                {passwordError ? (
                  <p className="text-sm text-destructive">{passwordError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Strong password: 8+ chars, uppercase, lowercase, and a number.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Confirm new password</label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<LockIcon className="w-5 h-5" />}
                  className="w-full pl-12 pr-10 py-3 bg-background border border-border rounded-xl text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Repeat your password"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword || !!passwordError}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
