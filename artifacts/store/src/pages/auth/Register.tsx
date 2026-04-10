import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthRegister } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Lock, User, Phone } from "lucide-react";
import { getAuthMeQueryKey } from "@workspace/api-client-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { validatePassword } from "@/lib/passwordStrength";

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  
  const redirectTo = new URLSearchParams(window.location.search).get("redirect") ?? "/account";

  const registerMutation = useAuthRegister({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAuthMeQueryKey() });
        setLocation(redirectTo);
      }
    }
  });

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
    if (!email || !password || !name) return;
    if (phone.length < 10) {
      setPhoneError("Phone number must be at least 10 digits");
      return;
    }
    const result = validatePassword(password);
    if (!result.valid) {
      setPasswordError(result.message);
      return;
    }
    try {
      await registerMutation.mutateAsync({
        data: { name, email, password, phone }
      });
    } catch (err) {
      // Error is caught by mutation state
    }
  };

  const isPasswordValid = password === "" || validatePassword(password).valid;

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground mt-2">Join Jack Pine Farm for easy ordering</p>
        </div>

        <div className="bg-card border border-border p-8 rounded-3xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Jane Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                  <Phone className="w-5 h-5" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Your phone number is used to send order confirmation and pickup notifications via SMS.</p>
              {phoneError && <p className="text-sm text-destructive mt-1">{phoneError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                leftIcon={<Lock className="w-5 h-5" />}
                className="w-full pl-12 pr-10 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Min 8 characters"
                required
              />
              {passwordError && (
                <p className="text-sm text-destructive mt-1">{passwordError}</p>
              )}
              {!passwordError && password && (
                <p className="text-xs text-muted-foreground mt-1">
                  Strong password: 8+ chars, uppercase, lowercase, and a number.
                </p>
              )}
              {!password && (
                <p className="text-xs text-muted-foreground mt-1">
                  Strong password: 8+ chars, uppercase, lowercase, and a number.
                </p>
              )}
            </div>

            {registerMutation.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium">
                Registration failed. Email might be in use.
              </div>
            )}

            <button 
              type="submit"
              disabled={registerMutation.isPending || !email || !password || !name || !isPasswordValid || phone.length < 10}
              className="w-full flex justify-center items-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-50 mt-2"
            >
              {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-bold text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
