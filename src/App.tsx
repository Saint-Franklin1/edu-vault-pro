import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import StudentQR from "./pages/StudentQR.tsx";
import StudentBursaries from "./pages/StudentBursaries.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.tsx";
import AdminBursaries from "./pages/AdminBursaries.tsx";
import AdminApplications from "./pages/AdminApplications.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminRoles from "./pages/AdminRoles.tsx";
import Verify from "./pages/Verify.tsx";
import Legal from "./pages/Legal.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify/:user_id" element={<Verify />} />
          <Route path="/legal/:slug" element={<Legal />} />

          <Route path="/student" element={<ProtectedRoute require="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/qr" element={<ProtectedRoute require="student"><StudentQR /></ProtectedRoute>} />
          <Route path="/student/bursaries" element={<ProtectedRoute require="student"><StudentBursaries /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute require="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/overview" element={<ProtectedRoute require="admin"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/bursaries" element={<ProtectedRoute require="admin"><AdminBursaries /></ProtectedRoute>} />
          <Route path="/admin/applications" element={<ProtectedRoute require="admin"><AdminApplications /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute require="admin"><AdminAudit /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute require="admin"><AdminRoles /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
