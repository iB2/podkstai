import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";

/**
 * Hook para obter o estado de autenticação do usuário
 * 
 * @returns Objeto com informações do usuário autenticado e estado de carregamento
 */
export function useAuth() {
  // Query para buscar o usuário autenticado
  const { 
    data: user, 
    isLoading,
    error
  } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: 1,
    retryDelay: 1000,
    // Não mostrar erros no console para 401 (esperado quando não autenticado)
    gcTime: 0
  });
  
  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error
  };
}