import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirecionar para a página de perfil se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation('/profile');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleLogin = () => {
    // Redirecionar para o endpoint Express que inicia o fluxo de login Replit
    window.location.href = '/api/login';
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-md w-full bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Bem-vindo ao PODKST.AI</CardTitle>
          <CardDescription>
            Entre para acessar seus podcasts e criar novos conteúdos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-6">
              Ao fazer login, você terá acesso a todos os seus podcasts criados anteriormente
              e poderá criar novos conteúdos personalizados.
            </p>
            
            <div className="flex justify-center">
              <img 
                src="https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80" 
                alt="Podcast illustration" 
                className="rounded-lg max-h-48 object-cover mb-6" 
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleLogin} 
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
                Verificando...
              </>
            ) : (
              'Entrar com Replit'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}