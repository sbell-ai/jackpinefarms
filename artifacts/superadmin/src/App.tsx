import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/auth-guard";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tenants from "@/pages/tenants";
import TenantDetail from "@/pages/tenant-detail";
import Billing from "@/pages/billing";
import PlatformAdmins from "@/pages/platform-admins";
import AuditLogs from "@/pages/audit-logs";
import ChangePassword from "@/pages/change-password";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function ProtectedApp() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/change-password" component={ChangePassword} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/">{() => <Redirect to="/dashboard" />}</Route>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/tenants/:id" component={TenantDetail} />
              <Route path="/tenants" component={Tenants} />
              <Route path="/billing" component={Billing} />
              <Route path="/admins" component={PlatformAdmins} />
              <Route path="/audit-logs" component={AuditLogs} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={ProtectedApp} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
