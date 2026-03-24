import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  useAuthMe, getAuthMeQueryKey, 
  useAuthLogout, 
  useAuthUpdateProfile,
  useListMyOrders, getListMyOrdersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, LogOut, User, Package, Settings, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: session, isLoading, isError } = useAuthMe({
    query: { queryKey: getAuthMeQueryKey(), retry: false }
  });

  const { data: orders, isLoading: loadingOrders } = useListMyOrders({
    query: { 
      queryKey: getListMyOrdersQueryKey(),
      enabled: !!session?.id
    }
  });

  const logoutMutation = useAuthLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAuthMeQueryKey() });
        setLocation("/auth/login");
      }
    }
  });

  const updateProfileMutation = useAuthUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAuthMeQueryKey() });
        toast({ title: "Profile updated successfully" });
      }
    }
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (session?.id) {
      setName(session.name || "");
      setPhone(session.phone || "");
    }
  }, [session]);

  useEffect(() => {
    if (!isLoading && (isError || !session?.id)) {
      setLocation("/auth/login");
    }
  }, [isLoading, isError, session, setLocation]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileMutation.mutateAsync({
        data: { name, phone: phone || null }
      });
    } catch (err) {}
  };

  if (isLoading || !session?.id) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-12">
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-border">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">My Account</h1>
          <p className="text-muted-foreground mt-2">Welcome back, {session.name}</p>
        </div>
        <button 
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Profile Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Settings className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">Details</h2>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-foreground">Email</label>
                <input 
                  type="email" 
                  value={session.email} 
                  disabled 
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-foreground">Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-foreground">Phone</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-background border border-border focus:ring-2 focus:border-primary transition-all"
                />
              </div>
              
              <button 
                type="submit"
                disabled={updateProfileMutation.isPending || (name === session.name && phone === (session.phone || ""))}
                className="w-full mt-4 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Changes"}
              </button>
            </form>
          </div>
        </div>

        {/* Order History */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Package className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">Order History</h2>
            </div>

            {loadingOrders ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
            ) : orders?.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 rounded-2xl border border-dashed border-border">
                <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
                <Link href="/shop" className="text-primary font-bold hover:underline">Start Shopping</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders?.map(order => (
                  <Link 
                    key={order.id} 
                    href={`/account/orders/${order.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-foreground">Order #{order.id.toString().padStart(5, '0')}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider
                          ${order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' : 
                            order.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 
                            'bg-primary/10 text-primary'}`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "MMMM d, yyyy")} • {order.paymentMethod === 'stripe' ? 'Card' : 'Cash'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-4 sm:mt-0">
                      <span className="font-bold text-lg">{formatMoney(order.totalInCents)}</span>
                      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
