import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import Dashboard from "./pages/app/Dashboard";
import Review from "./pages/app/Review";
import Bulk from "./pages/app/Bulk";
import Guidelines from "./pages/app/Guidelines";
import Analytics from "./pages/app/Analytics";
import Sources from "./pages/app/Sources";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="review" element={<Review />} />
            <Route path="review/:analysisId" element={<Review />} />
            <Route path="bulk" element={<Bulk />} />
            <Route path="bulk/:batchId" element={<Bulk />} />
            <Route path="guidelines" element={<Guidelines />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="sources" element={<Sources />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
