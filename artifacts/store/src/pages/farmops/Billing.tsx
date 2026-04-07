import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFarmopsMe } from "../../hooks/useFarmopsAuth";

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingState {
  plan: "starter" | "growth" | "pro" | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused" | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  hasStripeCustomer: boolean;
  hasActiveSubscription: boolean;
  onboardingPurchased: boolean;
  stripeConfigured: boolean;
  addons: { addonType: string; quantity: number; createdAt: string }[];
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Plan display data ─────────────────────────────────────────────────────────

const PLANS = [
  { key: "starter", label: "Starter", price: "$29/mo", description: "Up to 100 orders/month, basic reporting" },
  { key: "growth",  label: "Growth",  price: "$59/mo", description: "Unlimited orders, advanced analytics, export" },
  { key: "pro",     label: "Pro",     price: "$99/mo", description: "Everything + white-label & priority support" },
] as const;

const ADDON_LABELS: Record<string, string> = {
  custom_domain:      "Custom Domain",
  sms_notifications:  "SMS Notifications",
  extra_admin_users:  "Extra Admin Users",
  white_label:        "White Label",
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BillingState["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    trialing:  { label: "Trial",     cls: "bg-blue-100 text-blue-800" },
    active:    { label: "Active",    cls: "bg-green-100 text-green-800" },
    past_due:  { label: "Past Due",  cls: "bg-yellow-100 text-yellow-800" },
    canceled:  { label: "Canceled",  cls: "bg-red-100 text-red-800" },
    paused:    { label: "Paused",    cls: "bg-gray-100 text-gray-600" },
  };
  const info = status ? (map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }) : { label: "None", cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FarmOpsBilling() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useFarmopsMe();

  const { data: billing, isLoading: billingLoading, error: billingError } = useQuery<BillingState>({
    queryKey: ["farmops-billing"],
    queryFn: () => apiFetch("/farmops/billing"),
    enabled: !!me,
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) =>
      apiFetch<{ url: string }>("/farmops/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>("/farmops/billing/portal", { method: "POST" }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>("/farmops/billing/onboarding", { method: "POST" }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const addonMutation = useMutation({
    mutationFn: ({ action, addon }: { action: "add" | "remove"; addon: string }) =>
      apiFetch("/farmops/billing/addons", {
        method: "POST",
        body: JSON.stringify({ action, addon, quantity: 1 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["farmops-billing"] }),
  });

  // Auth guard
  if (!meLoading && !me) {
    navigate("/farmops/login");
    return null;
  }

  if (meLoading || billingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (billingError || !billing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600">Unable to load billing information. Please try again.</p>
      </div>
    );
  }

  const trialDaysLeft = billing.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  const activeAddonKeys = new Set(billing.addons.map((a) => a.addonType));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing &amp; Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your FarmOps plan and add-ons.</p>
      </div>

      {/* Status overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
          <StatusBadge status={billing.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Plan</span>
            <p className="font-medium capitalize">{billing.plan ?? "None"}</p>
          </div>
          {billing.trialEndsAt && billing.status === "trialing" && (
            <div>
              <span className="text-gray-500">Trial ends</span>
              <p className="font-medium">
                {new Date(billing.trialEndsAt).toLocaleDateString()} ({trialDaysLeft} days left)
              </p>
            </div>
          )}
          {billing.currentPeriodEndsAt && billing.status === "active" && (
            <div>
              <span className="text-gray-500">Next billing date</span>
              <p className="font-medium">{new Date(billing.currentPeriodEndsAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        {billing.status === "trialing" && trialDaysLeft <= 7 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Your trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}. Subscribe now to keep access.
          </div>
        )}

        {billing.status === "past_due" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            Your payment is past due. Please update your payment method to avoid losing access.
          </div>
        )}

        {billing.hasActiveSubscription && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="mt-2 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {portalMutation.isPending ? "Redirecting…" : "Manage Billing / Cancel"}
          </button>
        )}
      </div>

      {/* Plan selection (only shown when not on an active paid subscription) */}
      {billing.stripeConfigured && !billing.hasActiveSubscription && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscribe to a Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = billing.plan === plan.key;
              return (
                <div
                  key={plan.key}
                  className={`border rounded-xl p-5 flex flex-col gap-3 ${
                    plan.key === "growth" ? "border-emerald-500 ring-1 ring-emerald-500" : "border-gray-200"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{plan.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{plan.price}</p>
                    <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                  </div>
                  <button
                    onClick={() => checkoutMutation.mutate(plan.key)}
                    disabled={checkoutMutation.isPending || isCurrent}
                    className={`mt-auto w-full py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50 ${
                      plan.key === "growth"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    }`}
                  >
                    {checkoutMutation.isPending ? "Redirecting…" : isCurrent ? "Current Plan" : `Subscribe to ${plan.label}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add-ons (only when subscribed) */}
      {billing.hasActiveSubscription && billing.stripeConfigured && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add-ons</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {Object.entries(ADDON_LABELS).map(([key, label]) => {
              const isActive = activeAddonKeys.has(key);
              const addon = billing.addons.find((a) => a.addonType === key);
              return (
                <div key={key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    {isActive && addon && (
                      <p className="text-xs text-gray-500">
                        Active since {new Date(addon.createdAt).toLocaleDateString()}
                        {addon.quantity > 1 ? ` · qty ${addon.quantity}` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      addonMutation.mutate({ action: isActive ? "remove" : "add", addon: key })
                    }
                    disabled={addonMutation.isPending}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                      isActive
                        ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {isActive ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Onboarding */}
      {billing.stripeConfigured && !billing.onboardingPurchased && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900">One-Time Onboarding</h2>
          <p className="mt-1 text-sm text-gray-600">
            Get a 60-minute guided setup call with our team and a custom data import — $99 one-time fee.
          </p>
          <button
            onClick={() => onboardingMutation.mutate()}
            disabled={onboardingMutation.isPending}
            className="mt-4 inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {onboardingMutation.isPending ? "Redirecting…" : "Purchase Onboarding — $99"}
          </button>
        </div>
      )}

      {billing.onboardingPurchased && (
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Onboarding purchased — our team will reach out shortly.
        </div>
      )}

      {!billing.stripeConfigured && (
        <p className="text-sm text-gray-400 italic">Billing is not configured on this server.</p>
      )}
    </div>
  );
}
