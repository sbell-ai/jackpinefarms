import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthMe } from "@workspace/api-client-react";
import { Loader2, CheckCircle, XCircle, LogIn } from "lucide-react";

export default function ClaimOrder() {
  const [, navigate] = useLocation();
  const { data: me, isLoading: meLoading } = useAuthMe();
  const [status, setStatus] = useState<"loading" | "claiming" | "success" | "error" | "needs_login">("loading");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (meLoading) return;

    if (!token) {
      setStatus("error");
      setMessage("Invalid claim link — no token found. Please check the link in your email.");
      return;
    }

    if (!me) {
      setStatus("needs_login");
      return;
    }

    // Logged in — attempt claim
    setStatus("claiming");
    fetch("/api/orders/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("success");
          setOrderId(data.orderId ?? null);
        } else {
          setStatus("error");
          setMessage(data.error ?? "Unable to claim order. The link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [meLoading, me, token]);

  const loginUrl = `/auth/login?redirect=${encodeURIComponent(`/auth/claim-order?token=${token ?? ""}`)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-card border border-border rounded-3xl shadow-sm p-10 w-full max-w-md text-center">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-6">Claim Your Order</h1>

        {(status === "loading" || status === "claiming") && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-60" />
            <p className="text-muted-foreground">
              {status === "loading" ? "Checking your session…" : "Linking your order…"}
            </p>
          </div>
        )}

        {status === "needs_login" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <LogIn className="w-12 h-12 text-primary" />
            <p className="text-foreground font-medium">Sign in to claim this order</p>
            <p className="text-sm text-muted-foreground">
              Create an account or sign in, then we'll link your order automatically.
            </p>
            <div className="flex flex-col gap-3 w-full mt-2">
              <Link href={loginUrl}>
                <button className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                  Sign In
                </button>
              </Link>
              <Link href={`/auth/register?redirect=${encodeURIComponent(`/auth/claim-order?token=${token ?? ""}`)}`}>
                <button className="w-full px-6 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors">
                  Create Account
                </button>
              </Link>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="w-12 h-12 text-green-600" />
            <p className="text-foreground font-medium">Order successfully linked to your account!</p>
            <div className="flex flex-col gap-3 w-full mt-2">
              {orderId && (
                <Link href={`/account/orders/${orderId}`}>
                  <button className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                    View Order
                  </button>
                </Link>
              )}
              <Link href="/account">
                <button className="w-full px-6 py-2.5 border border-border rounded-xl font-semibold hover:bg-muted transition-colors">
                  My Account
                </button>
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <XCircle className="w-12 h-12 text-destructive" />
            <p className="text-muted-foreground">{message}</p>
            <Link href="/account/orders">
              <button className="mt-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                View My Orders
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
