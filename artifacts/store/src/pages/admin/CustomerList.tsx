import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  useAdminListCustomers,
  getAdminListCustomersQueryKey,
  useAdminCreateCustomer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function NewCustomerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useAdminCreateCustomer({
    mutation: {
      onSuccess: (customer: any) => {
        qc.invalidateQueries({ queryKey: getAdminListCustomersQueryKey({}) });
        toast({ title: "Customer created" });
        onClose();
        navigate(`/admin/customers/${customer.id}`);
      },
      onError: (e: any) => {
        const msg = e.response?.data?.error ?? e.message;
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    create.mutate({
      data: {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">New Customer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Full name"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email <span className="text-xs text-muted-foreground">(optional)</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="email@example.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Phone <span className="text-xs text-muted-foreground">(optional)</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="555-555-5555"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Walk-in customer, prefers phone contact, etc."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create Customer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCustomerList() {
  const [showNew, setShowNew] = useState(false);

  const { data: customers = [], isLoading, isError } = useAdminListCustomers(
    {},
    { query: { queryKey: getAdminListCustomersQueryKey({}) } }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load customers. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showNew && <NewCustomerModal onClose={() => setShowNew(false)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No customers yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Orders</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer: any) => (
                <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${customer.id}`}>
                      <div className="font-medium text-foreground hover:text-primary cursor-pointer">
                        {customer.name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">{customer.email ?? "No email"}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customer.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {customer.orderCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(customer.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${customer.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
