import { useAuth } from "@/hooks/useAuth";
import { HeroSection } from "@/components/hero-section";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Music, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type Podcast } from "@shared/schema";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Buscar podcasts do usuário atual
  const { data: userPodcasts, isLoading: isPodcastsLoading } = useQuery<Podcast[]>({
    queryKey: ["/api/podcasts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/podcasts?userId=${user.id}`);
      if (!response.ok) throw new Error("Failed to fetch user podcasts");
      return response.json();
    },
    enabled: !!user?.id, // Só executa a query quando temos o ID do usuário
  });

  useEffect(() => {
    // Mostrar toast de boas-vindas quando o usuário carregar
    if (isAuthenticated && user) {
      toast({
        title: "Login bem-sucedido!",
        description: `Bem-vindo, ${user.username || 'usuário'}!`,
        duration: 3000,
      });
    }
  }, [isAuthenticated, user, toast]);

  return (
    <div className="container mx-auto px-4 py-8">
      <HeroSection
        title="Seu Perfil"
        subtitle="Gerencie suas informações e podcasts"
        gradient="from-pink-700 via-violet-700 to-purple-500"
      />

      <div className="mt-12 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Carregando dados do usuário...</p>
          </div>
        ) : isAuthenticated ? (
          <div className="space-y-8">
            <Card className="bg-card shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Informações Pessoais</CardTitle>
                    <CardDescription>
                      Seus dados de perfil do Replit
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nome de Usuário</p>
                    <div className="flex items-center">
                      <p className="font-medium">{user?.username || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">
                      {user?.email || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">
                      {((user?.firstName || user?.lastName) 
                        ? `${user?.firstName || ''} ${user?.lastName || ''}` 
                        : 'N/A')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">ID</p>
                    <p className="font-medium text-xs opacity-50">{user?.id || 'N/A'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Biografia</h3>
                  <p className="text-sm">
                    {user?.bio || 'Nenhuma biografia disponível.'}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <div></div> {/* Espaçador */}
                <Button
                  variant="destructive"
                  onClick={() => window.location.href = '/api/logout'}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </CardFooter>
            </Card>

            <Card className="bg-card shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Seus Podcasts</CardTitle>
                  <CardDescription>Podcasts que você criou</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Link href="/portuguese">
                    <Button className="flex items-center" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo em Português
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="flex items-center" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo em Inglês
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {isPodcastsLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                    <p className="text-muted-foreground">Carregando seus podcasts...</p>
                  </div>
                ) : userPodcasts && userPodcasts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userPodcasts.map((podcast) => (
                      <Link key={podcast.id} href={`/api/podcasts/${podcast.id}`}>
                        <Card className="cursor-pointer hover:bg-accent/5 transition-colors h-full">
                          <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base line-clamp-1">{podcast.title}</CardTitle>
                              <Badge variant={podcast.language === 'pt-BR' ? 'default' : 'secondary'} className="ml-2">
                                {podcast.language === 'pt-BR' ? 'PT' : 'EN'}
                              </Badge>
                            </div>
                            <CardDescription className="line-clamp-1">{podcast.author}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 pb-2">
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {podcast.description}
                            </p>
                          </CardContent>
                          <CardFooter className="p-4 pt-0 flex items-center text-xs text-muted-foreground">
                            <Music className="h-3 w-3 mr-1" />
                            <span>{Math.floor(podcast.duration / 60)}:{(podcast.duration % 60).toString().padStart(2, '0')}</span>
                            <span className="mx-2">•</span>
                            <span>{(podcast.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(podcast.createdAt).toLocaleDateString()}</span>
                          </CardFooter>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-muted inline-flex rounded-full p-3 mb-4">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nenhum podcast encontrado</h3>
                    <p className="text-muted-foreground mb-4">
                      Você ainda não criou nenhum podcast. Comece criando um agora!
                    </p>
                    <div className="flex justify-center gap-4">
                      <Link href="/portuguese">
                        <Button>Criar em Português</Button>
                      </Link>
                      <Link href="/">
                        <Button variant="outline">Criar em Inglês</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="max-w-lg mx-auto bg-card shadow-lg">
            <CardHeader className="text-center">
              <CardTitle>Não autenticado</CardTitle>
              <CardDescription>
                Você precisa fazer login para visualizar esta página.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pt-2 pb-6">
              <Button 
                size="lg" 
                onClick={() => window.location.href = '/api/login'}
              >
                Fazer Login
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}