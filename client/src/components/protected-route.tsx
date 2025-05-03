import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * Componente que protege rotas para usuários autenticados
 * Se o usuário não estiver autenticado, redireciona para a página especificada
 */
export function ProtectedRoute({ 
  children, 
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Enquanto verifica a autenticação, mostra um loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Verificando autenticação...</p>
      </div>
    );
  }

  // Se não estiver autenticado, redireciona
  if (!isAuthenticated) {
    return <Redirect to={redirectTo} />;
  }

  // Se estiver autenticado, renderiza o conteúdo
  return <>{children}</>;
}