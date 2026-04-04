import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminLogin, getAdminMeQueryKey } from "@workspace/api-client-react";
import { Store, Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("admin@jackpinefarms.farm");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const loginMutation = useAdminLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      await loginMutation.mutateAsync({
        data: { email, password }
      });
      queryClient.setQueryData(getAdminMeQueryKey(), { authenticated: true });
      setLocation("/admin/products");
    } catch (err) {
      // Handled by mutation UI state
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] bg-[url('/images/texture-bg.png')] mix-blend-overlay"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center mb-6 shadow-lg border-4 border-white">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">FarmOps Admin</h1>
          <p className="text-muted-foreground mt-2">Manage Jack Pine Farm catalog</p>
        </div>

        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                placeholder="admin@jackpinefarms.farm"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-5 h-5" />}
                className="w-full pl-12 pr-10 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground"
                placeholder="••••••••"
              />
              {loginMutation.isError && (
                <p className="text-destructive text-sm font-medium mt-2">Invalid credentials</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending || !email || !password}
              className="w-full flex justify-center items-center gap-2 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Forgot your password? Contact the farm owner.
          </p>
        </div>
      </div>
    </div>
  );
}
