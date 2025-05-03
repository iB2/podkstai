import { useQuery } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import { History, Play, Pause, Lock, ExternalLink } from "lucide-react";
import { Podcast } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PodcastDetailsModal } from "./podcast-details-modal";
import { Link, useLocation } from "wouter";

export function PodcastGallery() {
  const { user, isAuthenticated } = useAuth();
  
  // Fetch podcasts with more frequent refetching (every 5 seconds)
  const { data: podcasts, isLoading, error, refetch } = useQuery<Podcast[]>({
    queryKey: ['/api/podcasts', user?.id],
    queryFn: async () => {
      // Se o usuário estiver autenticado, buscar seus podcasts
      // Não precisamos passar o userId, pois o servidor já filtra automaticamente pelo usuário autenticado
      const response = await fetch('/api/podcasts');
      if (!response.ok) throw new Error("Failed to fetch podcasts");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds to get merged audio updates
    staleTime: 1000 // Consider data stale after 1 second to allow quick refreshes
  });
  
  // Force a refetch when the component mounts to get the latest data
  useEffect(() => {
    refetch();
  }, [refetch]);
  
  // State to track which podcast is playing and modal display
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [showModal, setShowModal] = useState(false);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  
  // Function to show the podcast detail modal
  const openPodcastDetail = async (podcast: Podcast) => {
    // Parar a reprodução se estiver tocando
    if (playingId === podcast.id && audioRefs.current[podcast.id]) {
      audioRefs.current[podcast.id]?.pause();
      setPlayingId(null);
    }
    
    try {
      // Buscar detalhes completos do podcast com chunks
      const response = await fetch(`/api/podcasts/${podcast.id}`);
      if (response.ok) {
        const podcastDetail = await response.json();
        setSelectedPodcast(podcastDetail);
        setShowModal(true);
      } else {
        console.error(`Failed to fetch podcast details: ${response.status}`);
        // Usar os dados básicos se falhar a obtenção dos chunks
        setSelectedPodcast(podcast);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error fetching podcast details:", error);
      // Fallback para mostrar o podcast básico sem chunks
      setSelectedPodcast(podcast);
      setShowModal(true);
    }
  };
  
  // Handle play/pause for a specific podcast
  const togglePlay = (podcast: Podcast) => {
    const audio = audioRefs.current[podcast.id];
    if (!audio) return;
    
    // If this podcast is currently playing, pause it
    if (playingId === podcast.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // If another podcast is playing, pause it first
      if (playingId !== null && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      
      // Play the selected podcast
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setPlayingId(podcast.id);
            console.log(`Playing podcast ${podcast.id}`);
          })
          .catch((error: unknown) => {
            console.error(`Error playing podcast ${podcast.id}:`, error);
          });
      }
    }
  };
  
  // Clean up audio elements on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size from bytes to MB with 1 decimal place
  const formatFileSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <History className="text-primary" />
            Your Podcasts
          </h3>
        </div>
        <div className="flex space-x-6 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-[#282828] rounded-lg overflow-hidden shadow-lg animate-pulse min-w-[250px] w-[250px]">
              <div className="w-full h-48 bg-[#333333]"></div>
              <CardContent className="p-4">
                <div className="h-6 bg-[#333333] rounded mb-2"></div>
                <div className="h-4 bg-[#333333] rounded w-3/4 mb-3"></div>
                <div className="flex justify-between">
                  <div className="h-3 bg-[#333333] rounded w-1/3"></div>
                  <div className="h-3 bg-[#333333] rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <History className="text-primary" />
            Your Podcasts
          </h3>
        </div>
        <Card className="bg-[#282828] p-6">
          <p className="text-red-400">Error loading podcasts: {error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
            Try Again
          </Button>
        </Card>
      </section>
    );
  }

  if (!podcasts || podcasts.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <History className="text-primary" />
            Your Podcasts
          </h3>
        </div>
        <Card className="bg-[#282828] p-6 text-center">
          <p className="text-muted-foreground mb-2">No podcasts created yet</p>
          <p className="text-sm text-muted-foreground mb-4">Your podcasts will appear here once you create them</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <History className="text-primary" />
          Your Podcasts
        </h3>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {podcasts.map((podcast) => (
            <CarouselItem key={podcast.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
              <Card 
                className="bg-[#282828] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all"
              >
                <div className="relative group">
                  <img 
                    src={podcast.coverImageUrl || "/src/assets/images/default_thumb_podcast.png"} 
                    alt={podcast.title} 
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; // Prevent infinite loops
                      target.src = "/src/assets/images/default_thumb_podcast.png";
                    }}
                  />
                  
                  {/* Overlay with play button */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      onClick={() => togglePlay(podcast)}
                      className="bg-primary hover:bg-accent rounded-full h-14 w-14 flex items-center justify-center transition"
                    >
                      {playingId === podcast.id ? (
                        <Pause className="text-black text-xl" />
                      ) : (
                        <Play className="text-black text-xl ml-1" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Hidden audio element - used for the standard player approach */}
                  <audio 
                    ref={(el) => audioRefs.current[podcast.id] = el} 
                    src={podcast.audioUrl}
                    onEnded={() => setPlayingId(null)}
                    className="hidden"
                  />
                  
                  {/* We're only using this audio element for basic playback.
                      For a more sophisticated experience, users can click on the podcast
                      card to open a detailed view with the sequential player */}
                </div>
                
                <CardContent 
                  className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => openPodcastDetail(podcast)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-foreground line-clamp-2 h-12 overflow-hidden">{podcast.title}</h4>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="ml-1 p-1 h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevenir que clique no botão abra o modal
                        const url = `/podcast/${podcast.id}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">By {podcast.author}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>
                      {formatDuration(podcast.duration)} • {formatFileSize(podcast.fileSize || 0)}
                    </span>
                    <span>{formatDistance(new Date(podcast.createdAt), new Date(), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="flex justify-end gap-2 mt-4">
          <CarouselPrevious className="static bg-[#333333] hover:bg-[#444444] transform-none" />
          <CarouselNext className="static bg-[#333333] hover:bg-[#444444] transform-none" />
        </div>
      </Carousel>
      
      {/* Modal de detalhes do podcast */}
      {selectedPodcast && (
        <PodcastDetailsModal 
          podcast={selectedPodcast}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}
