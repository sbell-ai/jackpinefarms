import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { PublicLayout } from "./components/layout/PublicLayout";
import { AdminLayout } from "./components/layout/AdminLayout";

// Public Pages
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import HowWeRaiseThem from "./pages/HowWeRaiseThem";
import About from "./pages/About";
import Faq from "./pages/Faq";
import Contact from "./pages/Contact";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminLogin from "./pages/admin/Login";
import AdminProducts from "./pages/admin/ProductList";
import AdminProductForm from "./pages/admin/ProductForm";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <Switch>
      {/* Admin Auth is standalone */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin Protected Routes */}
      <Route path="/admin/products/new">
        <AdminLayout><AdminProductForm /></AdminLayout>
      </Route>
      <Route path="/admin/products/:id/edit">
        <AdminLayout><AdminProductForm /></AdminLayout>
      </Route>
      <Route path="/admin/products">
        <AdminLayout><AdminProducts /></AdminLayout>
      </Route>
      <Route path="/admin">
        <AdminLayout><AdminProducts /></AdminLayout>
      </Route>

      {/* Public Storefront Routes */}
      <Route path="/shop/:id">
        <PublicLayout><ProductDetail /></PublicLayout>
      </Route>
      <Route path="/shop">
        <PublicLayout><Shop /></PublicLayout>
      </Route>
      <Route path="/how-we-raise-them">
        <PublicLayout><HowWeRaiseThem /></PublicLayout>
      </Route>
      <Route path="/about">
        <PublicLayout><About /></PublicLayout>
      </Route>
      <Route path="/faq">
        <PublicLayout><Faq /></PublicLayout>
      </Route>
      <Route path="/contact">
        <PublicLayout><Contact /></PublicLayout>
      </Route>
      <Route path="/">
        <PublicLayout><Home /></PublicLayout>
      </Route>

      {/* Catch-all */}
      <Route>
        <PublicLayout><NotFound /></PublicLayout>
      </Route>
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
