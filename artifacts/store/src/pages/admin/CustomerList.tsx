import { Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminListCustomers,
  getAdminListCustomersQueryKey,
} from "@workspace/api-client-react";
import { Users, ChevronRight } from "lucide-react";

export default function AdminCustomerList() {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-muted-foreground mt-1">{customers.length} registered customer{customers.length !== 1 ? "s" : ""}</p>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No registered customers yet.</p>
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
                      <div className="text-xs text-muted-foreground">{customer.email}</div>
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
