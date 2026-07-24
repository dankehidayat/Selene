// apps/frontend/src/router.tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/pages/Dashboard";
import { DataLog } from "@/pages/DataLog";
import { Analytics } from "@/pages/Analytics";
import { AdminPage } from "@/pages/AdminPage";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { Impressum } from "@/pages/Impressum";
import { Glossary } from "@/pages/Glossary";
import { NotFound } from "@/pages/NotFound";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFound />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <Dashboard />
      </Layout>
    </ProtectedRoute>
  ),
});

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/log",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <DataLog />
      </Layout>
    </ProtectedRoute>
  ),
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <Analytics />
      </Layout>
    </ProtectedRoute>
  ),
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <AdminPage />
      </Layout>
    </ProtectedRoute>
  ),
});

const impressumRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/impressum",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <Impressum />
      </Layout>
    </ProtectedRoute>
  ),
});

const glossaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/glossary",
  component: () => (
    <ProtectedRoute>
      <Layout>
        <Glossary />
      </Layout>
    </ProtectedRoute>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => <Login />,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: () => <Register />,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: () => <ForgotPassword />,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: () => <ResetPassword />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  logRoute,
  analyticsRoute,
  adminRoute,
  impressumRoute,
  glossaryRoute,
  loginRoute,
  registerRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => <NotFound />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
