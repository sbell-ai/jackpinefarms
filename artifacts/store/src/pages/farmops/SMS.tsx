import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";
import { format } from "date-fns";

const SMS_MAX_CHARS = 1600;

interface SmsMessage {
  id: number;
  toPhone: string;
  body: string;
  status: "sent" | "failed";
  twilioSid: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface SmsStatus {
  addonActive: boolean;
  twilioConfigured: boolean;
}

interface SendResult {
  sent: number;
  failed: number;
  results: Array<{ to: string; status: "sent" | "failed"; error?: string }>;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function FarmOpsSMS() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!sessionLoading && !session) {
      setLocation("/farmops/login");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: smsStatus, isLoading: statusLoading } = useQuery<SmsStatus>({
    queryKey: ["farmops-sms-status"],
    enabled: !!session,
    queryFn: () => apiFetch("/api/farmops/sms/status"),
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<SmsMessage[]>({
    queryKey: ["farmops-sms-messages", page],
    enabled: !!session && !!smsStatus?.addonActive,
    queryFn: () =>
      apiFetch(`/api/farmops/sms/messages?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`),
  });

  const sendMutation = useMutation<SendResult, Error, { recipients: string[]; message: string }>({
    mutationFn: (data) =>
      apiFetch("/api/farmops/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["farmops-sms-messages"] });
      toast({
        title: result.failed === 0
          ? `Sent ${result.sent} message${result.sent !== 1 ? "s" : ""}`
          : `${result.sent} sent, ${result.failed} failed`,
        variant: result.failed > 0 ? "destructive" : "default",
      });
      if (result.failed === 0) {
        setRecipientsRaw("");
        setMessage("");
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = parseRecipients(recipientsRaw);
    if (!recipients.length || !message.trim()) return;
    sendMutation.mutate({ recipients, message: message.trim() });
  };

  if (sessionLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

  if (!smsStatus?.addonActive) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-6">
          <MessageSquare className="w-7 h-7 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">SMS Notifications</h1>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Send text messages to your customers directly from FarmOps. Upgrade to add the SMS
          Notifications add-on to your subscription.
        </p>
        <Link
          href="/farmops/billing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors"
        >
          View billing options
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const recipients = parseRecipients(recipientsRaw);
  const charsLeft = SMS_MAX_CHARS - message.length;
  const isOverLimit = charsLeft < 0;
  const canSend = recipients.length > 0 && message.trim().length > 0 && !isOverLimit;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">SMS</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send text messages to your customers from {session.tenant.name}
        </p>
        {!smsStatus.twilioConfigured && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Twilio credentials not configured — messages will be logged but not sent.
          </div>
        )}
      </div>

      {/* Compose form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" />
          Compose message
        </h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Recipients{" "}
              <span className="font-normal text-slate-400">(one phone number per line, or comma-separated)</span>
            </label>
            <textarea
              rows={4}
              value={recipientsRaw}
              onChange={(e) => setRecipientsRaw(e.target.value)}
              placeholder={"+15551234567\n+15559876543"}
              className={inputCls + " font-mono resize-y"}
            />
            {recipients.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here…"
              className={inputCls + " resize-y"}
            />
            <p className={`text-xs mt-1 ${isOverLimit ? "text-red-600 font-semibold" : "text-slate-400"}`}>
              {isOverLimit ? `${Math.abs(charsLeft)} characters over limit` : `${charsLeft} characters remaining`}
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSend || sendMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sendMutation.isPending ? "Sending…" : `Send to ${recipients.length || 0} recipient${recipients.length !== 1 ? "s" : ""}`}
          </button>
        </form>
      </div>

      {/* Message log */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Message history</h2>
        </div>

        {msgsLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No messages sent yet</p>
            <p className="text-sm text-slate-400 mt-1">Messages you send will appear here.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="mt-0.5 shrink-0">
                    {msg.status === "sent" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-0.5">
                      <span className="font-mono text-sm font-medium text-slate-800">{msg.toPhone}</span>
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          msg.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {msg.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">{msg.body}</p>
                    {msg.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5">{msg.errorMessage}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={messages.length < PAGE_SIZE}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
