import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const FARMOPS_ME_KEY = ["farmops", "me"] as const;

interface FarmopsTenant {
  id: number;
  slug: string;
  name: string;
  status: string;
  plan: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

interface FarmopsUser {
  id: number;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface FarmopsSession {
  tenant: FarmopsTenant;
  user: FarmopsUser;
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export function useFarmopsMe() {
  return useQuery<FarmopsSession>({
    queryKey: FARMOPS_ME_KEY,
    queryFn: () => apiFetch("/api/farmops/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFarmopsRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      farmName: string;
      slug: string;
      ownerName: string;
      email: string;
      password: string;
    }) =>
      apiFetch("/api/farmops/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data: FarmopsSession) => {
      qc.setQueryData(FARMOPS_ME_KEY, data);
    },
  });
}

export function useFarmopsLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch("/api/farmops/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data: FarmopsSession) => {
      qc.setQueryData(FARMOPS_ME_KEY, data);
    },
  });
}

export function useFarmopsLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/api/farmops/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(FARMOPS_ME_KEY, null);
    },
  });
}

export function useFarmopsForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) =>
      apiFetch("/api/farmops/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  });
}

export function useFarmopsResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      apiFetch("/api/farmops/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  });
}

export function useFarmopsVerifyEmail() {
  return useMutation({
    mutationFn: (body: { token: string }) =>
      apiFetch("/api/farmops/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  });
}
