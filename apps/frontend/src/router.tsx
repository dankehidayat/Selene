// apps/frontend/src/router.tsx
import { lazy, Suspense } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/pages/Dashboard";
import { NotFound } from "@/pages/NotFound";

// Route-level code splitting: the heavy / secondary pages load on demand.
// Dashboard stays eager (it is the primary landing page after login).
const DataLog = lazy(() =>
  import("@/pages/DataLog").then((m) => ({ default: m.DataLog })),
);
const Analytics = lazy(() =>
  import("@/pages/Analytics").then((m) => ({ default: m.Analytics })),
);
const AdminPage = lazy(() =>
  import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const Login = lazy(() =>
  import("@/pages/Login").then((m) => ({ default: m.Login })),
);
const Register = lazy(() =>
  import("@/pages/Register").then((m) => ({ default: m.Register })),
);
const ForgotPassword = lazy(() =>
  import("@/pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import("@/pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const Impressum = lazy(() =>
  import("@/pages/Impressum").then((m) => ({ default: m.Impressum })),
);
const Glossary = lazy(() =>
  import("@/pages/Glossary").then((m) => ({ default: m.Glossary })),
);

/** Quiet, on-brand fallback while a lazy route chunk loads. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 dark:border-gray-700 dark:border-t-blue-400"
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

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
        <Suspense fallback={<PageFallback />}>
          <DataLog />
        </Suspense>
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
        <Suspense fallback={<PageFallback />}>
          <Analytics />
        </Suspense>
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
        <Suspense fallback={<PageFallback />}>
          <AdminPage />
        </Suspense>
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
        <Suspense fallback={<PageFallback />}>
          <Impressum />
        </Suspense>
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
        <Suspense fallback={<PageFallback />}>
          <Glossary />
        </Suspense>
      </Layout>
    </ProtectedRoute>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => (
    <Suspense fallback={<PageFallback />}>
      <Login />
    </Suspense>
  ),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: () => (
    <Suspense fallback={<PageFallback />}>
      <Register />
    </Suspense>
  ),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: () => (
    <Suspense fallback={<PageFallback />}>
      <ForgotPassword />
    </Suspense>
  ),
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: () => (
    <Suspense fallback={<PageFallback />}>
      <ResetPassword />
    </Suspense>
  ),
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
