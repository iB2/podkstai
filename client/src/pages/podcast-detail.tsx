import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { Podcast } from "@shared/schema";
import { SequentialAudioPlayer } from "@/components/sequential-audio-player";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Helmet } from "react-helmet";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/protected-route";

export default function PodcastDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Redirecionar para página principal se não tiver ID
  useEffect(() => {
    if (!id) {
      setLocation("/");
    }
  }, [id, setLocation]);
  
  const { data: podcast, isLoading, error } = useQuery<Podcast & { audioChunkUrls?: string[] }>({
    queryKey: ["/api/podcasts", id],
    enabled: !!id
  });
  
  // Redirecionar se houver erro ou o usuário não estiver autenticado
  useEffect(() => {
    if (error) {
      console.error("Erro ao carregar podcast:", error);
      setLocation("/");
    }
  }, [error, setLocation]);
  
  const defaultCoverUrl = "/src/assets/images/default_thumb_podcast.png";
  
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDate = (date: any) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
    }).format(dateObj);
  };
  
  return (
    <ProtectedRoute>
      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 flex-grow">
        <Helmet>
          <title>{podcast ? `${podcast.title} | PODKST.AI` : 'Carregando podcast... | PODKST.AI'}</title>
          <meta name="description" content={podcast?.description || 'Detalhes do podcast'} />
        </Helmet>
        
        <div className="mb-6">
          <Button 
            variant="ghost" 
            className="pl-0" 
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Esquerda - Skeleton de imagem */}
            <div className="w-full md:w-1/3">
              <Skeleton className="aspect-square w-full rounded-lg" />
            </div>
            
            {/* Direita - Skeleton de conteúdo */}
            <div className="w-full md:w-2/3 flex flex-col">
              <Skeleton className="h-8 w-3/4 mb-4" />
              <Skeleton className="h-6 w-1/2 mb-4" />
              <Skeleton className="h-4 w-1/3 mb-6" />
              <Skeleton className="h-20 w-full mb-6" />
              <Skeleton className="h-12 w-full mb-6" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </div>
        ) : podcast ? (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Esquerda - Imagem */}
            <div className="w-full md:w-1/3">
              <div className="aspect-square w-full overflow-hidden rounded-lg shadow-lg bg-gray-800">
                <img 
                  src={podcast.coverImageUrl || defaultCoverUrl} 
                  alt={podcast.title} 
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Detalhes adicionais abaixo da imagem em dispositivos móveis e tablet */}
              <div className="mt-4 md:mt-6 space-y-3 md:hidden">
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Publicado em</h3>
                  <p className="text-white">{formatDate(podcast.createdAt)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Categoria</h3>
                  <p className="text-white">{podcast.category || 'Geral'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Duração</h3>
                  <p className="text-white">{formatDuration(podcast.duration)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Tamanho do arquivo</h3>
                  <p className="text-white">{formatFileSize(podcast.fileSize)}</p>
                </div>
              </div>
            </div>
            
            {/* Direita - Conteúdo */}
            <div className="w-full md:w-2/3 flex flex-col">
              <div>
                <h1 className="text-3xl font-bold">{podcast.title}</h1>
                <p className="text-xl text-gray-300 mt-2">por {podcast.author}</p>
                <p className="text-gray-400 text-sm mt-1 mb-4">
                  {formatDuration(podcast.duration)} • {formatFileSize(podcast.fileSize)}
                </p>
                
                <Separator className="my-4" />
                
                <div className="my-4">
                  <h2 className="text-xl font-medium mb-2">Descrição</h2>
                  <p className="text-gray-300 whitespace-pre-line">{podcast.description}</p>
                </div>
                
                <div className="hidden md:block mt-6 mb-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Publicado em</h3>
                      <p>{formatDate(podcast.createdAt)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Categoria</h3>
                      <p>{podcast.category || 'Geral'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Duração</h3>
                      <p>{formatDuration(podcast.duration)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400">Tamanho do arquivo</h3>
                      <p>{formatFileSize(podcast.fileSize)}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Player de áudio */}
              <div className="mt-6">
                <h2 className="text-xl font-medium mb-3">Ouça agora</h2>
                {podcast.audioChunkUrls && podcast.audioChunkUrls.length > 0 ? (
                  <SequentialAudioPlayer 
                    audioUrls={podcast.audioChunkUrls} 
                    metadata={{
                      title: podcast.title,
                      author: podcast.author
                    }}
                  />
                ) : podcast.audioUrl ? (
                  <audio 
                    controls 
                    className="w-full rounded"
                    src={podcast.audioUrl}
                  />
                ) : (
                  <div className="p-4 border rounded border-gray-700 bg-gray-800 text-gray-300">
                    Áudio não disponível
                  </div>
                )}
              </div>
              
              {/* Botões de ação */}
              <div className="mt-6 flex gap-2">
                {podcast.audioUrl && (
                  <Button variant="outline" className="text-primary hover:bg-primary/10 border-primary hover:text-primary">
                    <a href={podcast.audioUrl} download target="_blank" rel="noopener noreferrer" className="flex items-center">
                      <Download className="mr-2 h-4 w-4" />
                      Download MP3
                    </a>
                  </Button>
                )}
                <Button variant="ghost">
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl mb-2">Podcast não encontrado</h2>
            <p className="text-gray-300 mb-6">O podcast que você está procurando não existe ou você não tem permissão para acessá-lo.</p>
            <Button onClick={() => setLocation("/")}>Voltar para a página inicial</Button>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}