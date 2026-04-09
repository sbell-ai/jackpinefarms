class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface PlatformAdmin {
  id: number;
  email: string;
  name: string;
  role: "owner" | "support";
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  ownerEmail: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  plan: "starter" | "growth" | "pro";
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  stripeSubscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  userCount?: number;
}

export interface TenantUser {
  id: number;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DashboardData {
  counts: { total: number; active: number; trialing: number; past_due: number; canceled: number; paused: number };
  mrr: number;
  trialsExpiring: Tenant[];
  recentSignups: Tenant[];
}

export interface TenantsResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SubscriptionAddon {
  id: number;
  tenantId: number;
  addonType: "custom_domain" | "sms_notifications" | "extra_admin_users" | "white_label";
  quantity: number;
  createdAt: string;
}

export interface TenantDetailResponse {
  tenant: Tenant;
  users: TenantUser[];
  addons: SubscriptionAddon[];
  usage: { userCount: number; inviteCount: number };
}

export interface AuditLog {
  id: number;
  action: string;
  targetType: string | null;
  targetId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  adminId: number | null;
  adminEmail: string | null;
  adminName: string | null;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BillingData {
  counts: { total: number; active: number; trialing: number; past_due: number; canceled: number; paused: number };
  mrr: number;
  tenants: Tenant[];
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<PlatformAdmin>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<{ message: string }>("/logout", { method: "POST" }),

  me: () => apiFetch<PlatformAdmin>("/me"),

  dashboard: () => apiFetch<DashboardData>("/dashboard"),

  tenants: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch<TenantsResponse>(`/tenants${qs ? `?${qs}` : ""}`);
  },

  tenant: (id: number) => apiFetch<TenantDetailResponse>(`/tenants/${id}`),

  suspendTenant: (id: number) =>
    apiFetch<Tenant>(`/tenants/${id}/suspend`, { method: "POST" }),

  reactivateTenant: (id: number) =>
    apiFetch<Tenant>(`/tenants/${id}/reactivate`, { method: "POST" }),

  changePlan: (id: number, plan: string) =>
    apiFetch<Tenant>(`/tenants/${id}/change-plan`, {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  extendTrial: (id: number, trialEndsAt: string) =>
    apiFetch<Tenant>(`/tenants/${id}/extend-trial`, {
      method: "POST",
      body: JSON.stringify({ trialEndsAt }),
    }),

  createTenant: (data: {
    slug: string;
    name: string;
    ownerEmail: string;
    plan: "starter" | "growth" | "pro";
    status: "trialing" | "active" | "past_due" | "canceled" | "paused";
    trialEndsAt?: string;
  }) =>
    apiFetch<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  billing: () => apiFetch<BillingData>("/billing"),

  admins: () => apiFetch<PlatformAdmin[]>("/admins"),

  createAdmin: (data: { email: string; name: string; role: "owner" | "support" }) =>
    apiFetch<PlatformAdmin & { tempPassword: string }>("/admins", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deactivateAdmin: (id: number) =>
    apiFetch<{ message: string; id: number; email: string }>(`/admins/${id}/deactivate`, {
      method: "POST",
    }),

  resetAdminPassword: (id: number) =>
    apiFetch<{ id: number; email: string; tempPassword: string }>(`/admins/${id}/reset-password`, {
      method: "POST",
    }),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string }>("/me/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  addAddon: (tenantId: number, addonType: string, quantity: number) =>
    apiFetch<SubscriptionAddon>(`/tenants/${tenantId}/addons`, {
      method: "POST",
      body: JSON.stringify({ addonType, quantity }),
    }),

  removeAddon: (tenantId: number, addonType: string) =>
    apiFetch<{ message: string }>(`/tenants/${tenantId}/addons/${addonType}`, {
      method: "DELETE",
    }),

  setTempPassword: (tenantId: number, userId: number) =>
    apiFetch<{ message: string }>(`/tenants/${tenantId}/users/${userId}/set-temp-password`, {
      method: "POST",
    }),

  auditLogs: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch<AuditLogsResponse>(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
