import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Podcast } from "@shared/schema";
import { SequentialAudioPlayer } from "./sequential-audio-player";

interface PodcastDetailsModalProps {
  podcast: Podcast & { audioChunkUrls?: string[] };
  isOpen: boolean;
  onClose: () => void;
}

export function PodcastDetailsModal({ podcast, isOpen, onClose }: PodcastDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  
  // Detectar clique fora do modal para fechar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Adicionar classe para prevenir scroll no body quando o modal está aberto
      document.body.classList.add("overflow-hidden");
      // Atraso para a animação de entrada
      setMounted(true);
    } else {
      setMounted(false);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        ref={modalRef} 
        className={`relative w-full max-w-5xl bg-gray-900 rounded-xl shadow-xl overflow-hidden transition-all duration-300 ${mounted ? 'scale-100' : 'scale-95'}`}
      >
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 z-10 text-gray-300 hover:text-white hover:bg-gray-800/50"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
        
        <div className="flex flex-col md:flex-row">
          {/* Imagem do podcast */}
          <div className="w-full md:w-1/3 bg-gray-800 flex items-center justify-center p-4">
            <div className="aspect-square w-full max-w-xs overflow-hidden rounded-lg shadow-lg bg-gray-700">
              <img 
                src={podcast.coverImageUrl || defaultCoverUrl} 
                alt={podcast.title} 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          {/* Detalhes e player */}
          <div className="w-full md:w-2/3 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-2xl font-bold line-clamp-2">{podcast.title}</h2>
              <p className="text-gray-300 mt-1 mb-2">por {podcast.author}</p>
              <p className="text-gray-400 text-sm mb-1">
                {formatDuration(podcast.duration)} • {formatFileSize(podcast.fileSize)}
              </p>
              <p className="text-gray-300 line-clamp-3 mt-4">{podcast.description}</p>
            </div>
            
            {/* Player de áudio */}
            <div className="mt-auto">
              {podcast.audioUrl && (
                <div className="mt-4">
                  {podcast.audioChunkUrls && podcast.audioChunkUrls.length > 0 ? (
                    <SequentialAudioPlayer 
                      audioUrls={podcast.audioChunkUrls} 
                      metadata={{
                        title: podcast.title,
                        author: podcast.author
                      }}
                      autoplay={true}
                    />
                  ) : (
                    <audio 
                      controls 
                      className="w-full rounded" 
                      autoPlay
                      src={podcast.audioUrl}
                    />
                  )}
                </div>
              )}
            </div>
            
            {/* Botões de ação */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-primary hover:bg-primary/10 border-primary hover:text-primary">
                <a href={podcast.audioUrl} download target="_blank" rel="noopener noreferrer">
                  Download MP3
                </a>
              </Button>
              <Button variant="ghost" size="sm">
                Compartilhar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}