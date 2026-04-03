import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, MailCheck, Sprout, XCircle } from "lucide-react";
import { useFarmopsVerifyEmail } from "@/hooks/useFarmopsAuth";

export default function FarmOpsVerifyEmail() {
  const [status, setStatus] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const verify = useFarmopsVerifyEmail();
  const [, setLocation] = useLocation();

  // Auto-verify if token present in URL
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    setStatus("loading");
    verify
      .mutateAsync({ token })
      .then(() => setStatus("success"))
      .catch((err: any) => {
        setErrorMsg(err?.error ?? "Verification failed.");
        setStatus("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p>Verifying your email…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-6">
            <MailCheck className="w-8 h-8 text-emerald-700" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Email verified!</h1>
          <p className="text-slate-500 mb-8">Your email address has been confirmed. You're all set.</p>
          <Link
            href="/farmops/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification failed</h1>
          <p className="text-slate-500 mb-6">{errorMsg ?? "The link may have expired or already been used."}</p>
          <Link href="/farmops/login" className="text-emerald-700 font-semibold hover:underline text-sm">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // No token in URL — show "check your inbox" state
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-6">
          <Sprout className="w-8 h-8 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your inbox</h1>
        <p className="text-slate-500 mb-4">
          We sent a verification link to your email address. Click the link to confirm your account.
        </p>
        <p className="text-slate-400 text-sm mb-8">
          Your 14-day trial is already running — you can use FarmOps right away.
        </p>
        <Link
          href="/farmops/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
