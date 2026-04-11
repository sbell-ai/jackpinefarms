import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, User, Lock, Building2, ImageIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";

const btnPrimary =
  "px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// ─── Reusable section card ────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-emerald-600">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FarmOpsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  const isOwner = session?.user?.role === "owner";

  // ── Farm settings state ──
  const [farmName, setFarmName] = useState("");
  const [farmNameSaving, setFarmNameSaving] = useState(false);

  // ── Branding state ──
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Profile state ──
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePhoneError, setProfilePhoneError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Password state ──
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwSaving, setPwSaving] = useState(false);

  // Seed form values from session once loaded
  useEffect(() => {
    if (session) {
      setFarmName(session.tenant?.name ?? "");
      setProfileName(session.user?.name ?? "");
      setProfilePhone(session.user?.phone ?? "");
    }
  }, [session]);

  const logoObjectKey = session?.tenant?.logoObjectKey ?? null;
  const logoUrl = logoObjectKey ? `/api/storage${logoObjectKey}` : null;

  // ── Upload logo ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      // Step 1: Get presigned upload URL
      const urlRes = await fetch("/api/farmops/storage/request-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload directly to GCS
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Step 3: Save objectPath on the tenant
      const saveRes = await fetch("/api/farmops/settings/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoObjectKey: objectPath }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error ?? "Failed to save logo");
      }
      toast({ title: "Logo updated" });
      qc.invalidateQueries({ queryKey: ["farmops-me"] });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // ── Remove logo ──
  const removeLogo = async () => {
    try {
      const res = await fetch("/api/farmops/settings/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoObjectKey: null }),
      });
      if (!res.ok) throw new Error("Failed to remove logo");
      toast({ title: "Logo removed" });
      qc.invalidateQueries({ queryKey: ["farmops-me"] });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    }
  };

  // ── Save farm name ──
  const saveFarmName = async () => {
    if (!farmName.trim()) return;
    setFarmNameSaving(true);
    try {
      const res = await fetch("/api/farmops/settings/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: farmName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: "Farm name updated" });
      // Invalidate /me so nav + other components pick up new name
      qc.invalidateQueries({ queryKey: ["farmops-me"] });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setFarmNameSaving(false);
    }
  };

  // ── Save profile name ──
  const saveProfile = async () => {
    if (!profileName.trim()) return;
    if (profilePhone.trim().length < 10) {
      setProfilePhoneError("Phone number must be at least 10 digits");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/farmops/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: profileName.trim(), phone: profilePhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: ["farmops-me"] });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ──
  const changePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) return;
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "New password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/farmops/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update password");
      toast({ title: "Password updated" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const pwValid =
    !!pwForm.currentPassword &&
    pwForm.newPassword.length >= 8 &&
    pwForm.newPassword === pwForm.confirmPassword;

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your farm and account settings.
        </p>
      </div>

      {/* ── Farm Settings ──────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Building2 className="w-5 h-5" />}
        title="Farm Settings"
        subtitle={
          isOwner
            ? "Update your farm's display name."
            : "Only the account owner can edit farm settings."
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Farm name</label>
            <input
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isOwner && farmName.trim()) saveFarmName();
              }}
              disabled={!isOwner}
              placeholder="Your farm name"
              className={inputCls + (!isOwner ? " bg-slate-50 text-slate-400 cursor-not-allowed" : "")}
            />
          </div>
          {isOwner && (
            <button
              onClick={saveFarmName}
              disabled={!farmName.trim() || farmNameSaving}
              className={btnPrimary}
            >
              {farmNameSaving ? "Saving…" : "Save Farm Name"}
            </button>
          )}
          {!isOwner && (
            <p className="text-xs text-slate-400">
              Signed in as <span className="font-medium capitalize">{session?.user?.role}</span> —
              contact your account owner to update farm settings.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Storefront Branding ────────────────────────────────────────────── */}
      <SectionCard
        icon={<ImageIcon className="w-5 h-5" />}
        title="Storefront Branding"
        subtitle={
          isOwner
            ? "Upload your farm's logo for your public storefront."
            : "Only the account owner can edit branding."
        }
      >
        <div className="space-y-4">
          {logoUrl && (
            <div className="flex items-center gap-3">
              <img
                src={logoUrl}
                alt="Current logo"
                className="h-16 w-16 object-contain rounded-lg border border-slate-200 p-2 bg-white"
              />
              <span className="text-sm text-slate-500">Current logo</span>
            </div>
          )}
          {!logoUrl && (
            <p className="text-sm text-slate-400">No logo uploaded yet.</p>
          )}
          {isOwner && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className={btnPrimary}
              >
                {logoUploading ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {logoUrl && (
                <button
                  onClick={removeLogo}
                  className="text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {!isOwner && (
            <p className="text-xs text-slate-400">
              Signed in as <span className="font-medium capitalize">{session?.user?.role}</span> —
              contact your account owner to update branding.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Your Profile ───────────────────────────────────────────────────── */}
      <SectionCard
        icon={<User className="w-5 h-5" />}
        title="Your Profile"
        subtitle="Update your display name."
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Full name</label>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && profileName.trim()) saveProfile();
              }}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Phone number</label>
            <input
              type="tel"
              value={profilePhone}
              onChange={(e) => { setProfilePhone(e.target.value); setProfilePhoneError(""); }}
              placeholder="(555) 123-4567"
              className={inputCls}
            />
            <p className="text-xs text-slate-400">
              Your phone number is used to send order confirmation and pickup notifications via SMS.
            </p>
            {profilePhoneError && <p className="text-xs text-red-500 mt-1">{profilePhoneError}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Email</label>
            <input
              value={session?.user?.email ?? ""}
              disabled
              className={inputCls + " bg-slate-50 text-slate-400 cursor-not-allowed"}
            />
            <p className="text-xs text-slate-400">Email cannot be changed.</p>
          </div>
          <button
            onClick={saveProfile}
            disabled={!profileName.trim() || profilePhone.trim().length < 10 || profileSaving}
            className={btnPrimary}
          >
            {profileSaving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </SectionCard>

      {/* ── Change Password ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Lock className="w-5 h-5" />}
        title="Change Password"
        subtitle="Choose a strong password of at least 8 characters."
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Current password</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
              placeholder="Current password"
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">New password</label>
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="New password (min 8 characters)"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Confirm new password</label>
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
              className={inputCls}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === "Enter" && pwValid) changePassword();
              }}
            />
            {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords don't match.</p>
            )}
          </div>
          <button
            onClick={changePassword}
            disabled={!pwValid || pwSaving}
            className={btnPrimary}
          >
            {pwSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
