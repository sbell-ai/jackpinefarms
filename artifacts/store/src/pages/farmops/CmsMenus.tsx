import { useState, useEffect } from "react";
import { Navigation, Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFarmopsMe } from "@/hooks/useFarmopsAuth";
import { useLocation } from "wouter";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all";
const btnPrimary =
  "px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

interface MenuItem {
  id?: number;
  label: string;
  url: string;
  parentId: number | null;
}

export default function FarmOpsCmsMenus() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useFarmopsMe();

  useEffect(() => {
    if (!sessionLoading && !session) setLocation("/farmops/login");
  }, [session, sessionLoading, setLocation]);

  const isAdmin = session?.user?.role === "owner" || session?.user?.role === "admin";

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/farmops/cms/menus/header", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          const flat: MenuItem[] = [];
          for (const item of data.items ?? []) {
            flat.push({ id: item.id, label: item.label, url: item.url, parentId: null });
            for (const child of item.children ?? []) {
              flat.push({ id: child.id, label: child.label, url: child.url, parentId: item.id });
            }
          }
          setItems(flat);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateItem = (idx: number, field: keyof MenuItem, value: string | number | null) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
    setDirty(true);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { label: "", url: "/", parentId: null }]);
    setDirty(true);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[next]] = [updated[next]!, updated[idx]!];
    setItems(updated);
    setDirty(true);
  };

  const saveMenu = async () => {
    // Validate: all items must have label and url
    const invalid = items.some((i) => !i.label.trim() || !i.url.trim());
    if (invalid) {
      toast({ title: "All items must have a label and URL", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/farmops/cms/menus/header/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: items.map((i) => ({ label: i.label.trim(), url: i.url.trim(), parentId: i.parentId ?? null })) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setDirty(false);
      toast({ title: "Navigation menu saved" });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Navigation className="w-6 h-6 text-emerald-600" />
          Navigation Menu
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Edit the header navigation links shown on your storefront.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {items.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No menu items yet.{isAdmin ? " Add your first link below." : ""}
              </p>
            )}

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0 || !isAdmin}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-20"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(idx, 1)}
                      disabled={idx === items.length - 1 || !isAdmin}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-20"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={item.label}
                    onChange={(e) => updateItem(idx, "label", e.target.value)}
                    placeholder="Label (e.g. Shop)"
                    disabled={!isAdmin}
                    className={inputCls}
                  />
                  <input
                    value={item.url}
                    onChange={(e) => updateItem(idx, "url", e.target.value)}
                    placeholder="URL (e.g. /shop)"
                    disabled={!isAdmin}
                    className={inputCls}
                  />
                  <select
                    value={item.parentId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateItem(idx, "parentId", val === "" ? null : Number(val));
                    }}
                    disabled={!isAdmin}
                    className={inputCls}
                  >
                    <option value="">Top level</option>
                    {items
                      .filter((other, otherIdx) => otherIdx !== idx && other.parentId === null)
                      .map((other, i) => (
                        <option key={i} value={other.id ?? ""}>
                          ↳ {other.label}
                        </option>
                      ))}
                  </select>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={addItem}
                  disabled={items.length >= 20}
                  className="flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={saveMenu}
                  disabled={saving || !dirty}
                  className={btnPrimary + " flex items-center gap-2"}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save Menu"}
                </button>
              </div>
            )}

            {!isAdmin && (
              <p className="text-xs text-slate-400 pt-2">
                You have read-only access. Contact an admin to edit the menu.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
