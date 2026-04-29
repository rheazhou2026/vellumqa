import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Auth from "./pages/Auth";
import RequireAuth from "./components/RequireAuth";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/app/Dashboard";
import Encounters from "./pages/app/Encounters";
import EncounterDetail from "./pages/app/EncounterDetail";
import EvaluationReport from "./pages/app/EvaluationReport";
import Review from "./pages/app/Review";
import ReviewTask from "./pages/app/ReviewTask";
import Analytics from "./pages/app/Analytics";
import Compliance from "./pages/app/Compliance";
import Governance from "./pages/app/Governance";
import Settings from "./pages/app/Settings";
import Integrations from "./pages/app/Integrations";
import Team from "./pages/app/Team";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/encounters" element={<Encounters />} />
            <Route path="/encounters/:id" element={<EncounterDetail />} />
            <Route path="/encounters/:id/eval" element={<EvaluationReport />} />
            <Route path="/review" element={<Review />} />
            <Route path="/review/:id" element={<ReviewTask />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/analytics/:tab" element={<Analytics />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/compliance/:tab" element={<Compliance />} />
            <Route path="/governance" element={<Governance />} />
            <Route path="/governance/:tab" element={<Governance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/integrations" element={<Integrations />} />
            <Route path="/settings/team" element={<Team />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
