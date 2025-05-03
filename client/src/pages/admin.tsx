import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ServerCrash, AlertTriangle, ShieldCheck, Users, Headphones, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface AdminStats {
  totalUsers: number;
  totalPodcasts: number;
  serverUptime: number;
}

interface AdminStatus {
  status: string;
  message: string;
  user: {
    id: string;
    username: string;
    isAdmin: boolean;
  };
  stats: AdminStats;
}

export default function AdminPage() {
  
  // Carregar dados do servidor
  const { data, isLoading, error, refetch } = useQuery<AdminStatus>({
    queryKey: ['/api/admin/status'],
    retry: false
  });
  
  return (
    <ProtectedRoute 
      redirectTo="/login"
    >
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Painel de Administração</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Atualizar Dados'
            )}
          </Button>
        </div>
        
        <div className="mb-8">
          <p className="text-muted-foreground mb-3">
            Esta é uma área restrita apenas para administradores.
          </p>
          {error ? (
            <Card className="bg-destructive/10 border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Acesso Negado
                </CardTitle>
                <CardDescription>
                  Ocorreu um erro ao verificar suas permissões.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Para acessar o painel de administração, você precisa estar autenticado com uma conta que tenha privilégios de administrador.
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/api/login'}
                  className="mr-2"
                >
                  Fazer Login com Replit
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.href = '/'}
                >
                  Voltar para Home
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border animate-pulse">
                      <CardHeader>
                        <div className="h-8 w-2/3 bg-muted rounded mb-3"></div>
                        <div className="h-4 w-1/2 bg-muted rounded"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-24 bg-muted rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : data ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Status do Servidor
                      </CardTitle>
                      <CardDescription>
                        Informações sobre o servidor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="font-medium text-4xl text-primary mb-3">
                        {data.status === 'ok' ? 'Online' : 'Problemas'}
                      </div>
                      <p className="text-muted-foreground text-sm mb-4">{data.message}</p>
                      <div className="text-sm">
                        <div className="flex justify-between py-1">
                          <span>Uptime:</span>
                          <span>{formatUptime(data.stats.serverUptime)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between py-1">
                          <span>Usuário:</span>
                          <span>{data.user.username}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Usuários
                      </CardTitle>
                      <CardDescription>
                        Estatísticas de usuários
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="font-medium text-4xl text-primary mb-3">
                        {data.stats.totalUsers}
                      </div>
                      <p className="text-muted-foreground text-sm mb-4">
                        Total de usuários registrados
                      </p>
                      <div className="text-sm">
                        <div className="flex justify-between py-1">
                          <span>ID Admin:</span>
                          <span className="truncate max-w-[120px]">{data.user.id}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between py-1">
                          <span>Permissões:</span>
                          <span>{data.user.isAdmin ? 'Administrador' : 'Usuário'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Headphones className="h-5 w-5 text-primary" />
                        Podcasts
                      </CardTitle>
                      <CardDescription>
                        Estatísticas de podcasts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="font-medium text-4xl text-primary mb-3">
                        {data.stats.totalPodcasts}
                      </div>
                      <p className="text-muted-foreground text-sm mb-4">
                        Total de podcasts criados
                      </p>
                      <div className="text-sm">
                        <div className="flex justify-between py-1">
                          <span>Média por usuário:</span>
                          <span>
                            {data.stats.totalUsers > 0 
                              ? (data.stats.totalPodcasts / data.stats.totalUsers).toFixed(1) 
                              : '0'}
                          </span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between py-1">
                          <span>Último acesso:</span>
                          <span>Agora</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="col-span-3 text-center py-12">
                  <ServerCrash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Função para formatar o tempo de uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}