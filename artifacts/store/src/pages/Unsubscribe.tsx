import { useState } from "react";
import { useSearch } from "wouter";
import {
  useGetUnsubscribePreferences,
  getGetUnsubscribePreferencesQueryKey,
  useProcessUnsubscribe,
  useProcessResubscribe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unsubscribe() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";
  const qc = useQueryClient();

  const [done, setDone] = useState(false);
  const [globalDone, setGlobalDone] = useState(false);
  const [resubscribed, setResubscribed] = useState(false);

  const { data, isLoading, isError } = useGetUnsubscribePreferences(
    { token },
    { query: { queryKey: getGetUnsubscribePreferencesQueryKey({ token }), enabled: !!token } }
  );

  const unsubscribe = useProcessUnsubscribe({
    mutation: {
      onSuccess: (_: any, variables: any) => {
        if (variables.data.globalUnsubscribe) {
          setGlobalDone(true);
        } else {
          setDone(true);
        }
        qc.invalidateQueries({ queryKey: getGetUnsubscribePreferencesQueryKey({ token }) });
      },
    },
  });

  const resubscribe = useProcessResubscribe({
    mutation: {
      onSuccess: () => {
        setResubscribed(true);
        setGlobalDone(false);
        qc.invalidateQueries({ queryKey: getGetUnsubscribePreferencesQueryKey({ token }) });
      },
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Invalid Link</h1>
          <p className="text-muted-foreground text-sm">
            This unsubscribe link is missing its token. Please use the link from your email.
          </p>
          <Link href="/" className="text-primary hover:underline text-sm">Return to store</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Link Expired or Invalid</h1>
          <p className="text-muted-foreground text-sm">
            This unsubscribe link is no longer valid. You may have already unsubscribed, or the link has expired.
          </p>
          <Link href="/" className="text-primary hover:underline text-sm">Return to store</Link>
        </div>
      </div>
    );
  }

  if (resubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-teal-600 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Re-subscribed</h1>
          <p className="text-muted-foreground text-sm">
            You've been re-subscribed to Jack Pine Farm notifications. We'll let you know when items are available.
          </p>
          <Link href="/" className="text-primary hover:underline text-sm">Return to store</Link>
        </div>
      </div>
    );
  }

  if (done || globalDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-teal-600 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">
            {globalDone ? "Globally Unsubscribed" : "Unsubscribed"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {globalDone
              ? "You've been removed from all Jack Pine Farm notification emails."
              : `You've been removed from restock notifications for ${data?.productName ?? "this product"}.`}
          </p>
          {globalDone && (
            <Button
              variant="outline"
              className="mt-2"
              disabled={resubscribe.isPending}
              onClick={() => resubscribe.mutate({ data: { token } })}
            >
              {resubscribe.isPending ? "Processing…" : "Changed your mind? Re-subscribe"}
            </Button>
          )}
          <div>
            <Link href="/" className="text-primary hover:underline text-sm">Return to store</Link>
          </div>
        </div>
      </div>
    );
  }

  const isGloballyUnsubscribed = data?.globalUnsubscribe;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Notification Preferences</h1>
          <p className="text-muted-foreground text-sm">
            Managing notifications for <span className="font-medium text-foreground">{data?.email}</span>
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {isGloballyUnsubscribed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
                You are currently unsubscribed from all Jack Pine Farm notifications.
              </div>
              <Button
                className="w-full"
                disabled={resubscribe.isPending}
                onClick={() => resubscribe.mutate({ data: { token } })}
              >
                {resubscribe.isPending ? "Processing…" : "Re-subscribe to notifications"}
              </Button>
            </div>
          ) : (
            <>
              {data?.productName && (
                <div className="space-y-2">
                  <p className="text-sm text-foreground font-medium">
                    Unsubscribe from &ldquo;{data.productName}&rdquo; restock alerts
                  </p>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={unsubscribe.isPending}
                    onClick={() => unsubscribe.mutate({ data: { token, globalUnsubscribe: false } })}
                  >
                    {unsubscribe.isPending ? "Processing…" : `Stop ${data.productName} notifications`}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-foreground font-medium">
                  Unsubscribe from all Jack Pine Farm notifications
                </p>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={unsubscribe.isPending}
                  onClick={() => unsubscribe.mutate({ data: { token, globalUnsubscribe: true } })}
                >
                  {unsubscribe.isPending ? "Processing…" : "Stop all notifications"}
                </Button>
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground text-center">
            <Link href="/" className="text-primary hover:underline">
              Return to the store
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
