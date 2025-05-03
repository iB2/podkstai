import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import PortuguesePage from "@/pages/portuguese";
import PodcastDetail from "@/pages/podcast-detail";
import ProfilePage from "@/pages/profile";
import LoginPage from "@/pages/login";
import AdminPage from "@/pages/admin";
import SimpleLandingPage from "@/pages/simple-landing";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

/**
 * Router principal da aplicação
 * Contém rotas públicas e protegidas
 */
function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Redirecionar usuários autenticados para a página de podcasts em português,
  // independentemente da página que estejam acessando (exceto profile e admin)
  useEffect(() => {
    if (isAuthenticated) {
      // Se estiver na home ou em uma página que não seja admin ou profile
      if (
        location === "/" || 
        (location !== "/portuguese" && 
         location !== "/profile" && 
         location !== "/admin" && 
         !location.startsWith("/profile") && 
         !location.startsWith("/admin"))
      ) {
        setLocation("/portuguese");
      }
    }
  }, [isAuthenticated, location, setLocation]);
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Não mostrar Header na landing page */}
      {location !== "/" && <Header />}
      
      <Switch>
        {/* Landing Page (página inicial para usuários não logados) */}
        <Route path="/" component={SimpleLandingPage} />
        
        {/* Rotas públicas */}
        <Route path="/login" component={LoginPage} />
        
        {/* Rotas protegidas */}
        <Route path="/portuguese">
          <ProtectedRoute redirectTo="/login">
            <PortuguesePage />
          </ProtectedRoute>
        </Route>
        
        <Route path="/profile">
          <ProtectedRoute redirectTo="/login">
            <ProfilePage />
          </ProtectedRoute>
        </Route>
        
        {/* Rota de detalhes do podcast */}
        <Route path="/podcast/:id">
          <ProtectedRoute redirectTo="/login">
            <PodcastDetail />
          </ProtectedRoute>
        </Route>
        
        {/* Rotas de administração */}
        <Route path="/admin">
          <ProtectedRoute redirectTo="/login">
            <AdminPage />
          </ProtectedRoute>
        </Route>
        
        <Route component={NotFound} />
      </Switch>
      
      {/* Não mostrar Footer na landing page */}
      {location !== "/" && <Footer />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
