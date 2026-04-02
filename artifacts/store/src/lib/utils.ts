import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

export function formatPickupDate(date: string | Date, opts?: { includeTime?: boolean }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const base: Intl.DateTimeFormatOptions = {
    timeZone: "America/Detroit",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  if (opts?.includeTime) {
    base.hour = "numeric";
    base.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("en-US", base).format(d);
}


export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}
