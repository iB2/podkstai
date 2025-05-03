import { useState, useRef, useEffect } from "react";
import { formatDistance } from "date-fns";
import { Play, Pause, Download, Share, Plus, Clock, FileAudio, Puzzle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SequentialAudioPlayer } from "@/components/sequential-audio-player";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Podcast, PodcastAudioChunk } from "@shared/schema";
import "./audio-player-styles.css";

// Type definition for podcast data with audio chunks
interface PodcastWithAudioChunks extends Podcast {
  audioChunks?: PodcastAudioChunk[];
  audioChunkUrls?: string[]; // Array of chunk URLs for sequential playback
}

interface AudioPreviewProps {
  audioData: {
    url: string;
    duration: number;
    chunks: number;
    size: number;
  };
  metadata: {
    title: string;
    author: string;
  };
  podcastId?: number; // Optional podcast ID to fetch audio chunks
}

export function AudioPreview({ audioData, metadata, podcastId }: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Fetch podcast details including audio chunks if podcast ID is provided
  const { data: podcastData } = useQuery<PodcastWithAudioChunks>({
    queryKey: [`/api/podcasts/${podcastId || 0}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!podcastId,
    refetchInterval: 5000, // Refetch every 5 seconds to get merged audio URL updates
  });
  
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
  
  // Handle play button click
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    // Stop any other playing audio elements first
    document.querySelectorAll('audio').forEach(audio => {
      if (audio !== audioRef.current) {
        audio.pause();
      }
    });
    
    if (audioRef.current.paused) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((error) => {
            console.error("Error playing audio:", error);
            setIsPlaying(false);
          });
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  // Set up event listeners using useEffect that runs whenever the audioRef or URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Pause any other playing audio elements when mounting this component
    document.querySelectorAll('audio').forEach(otherAudio => {
      if (otherAudio !== audio && !otherAudio.paused) {
        otherAudio.pause();
      }
    });
    
    const handlePlay = () => {
      // Pause all other audio elements when this one plays
      document.querySelectorAll('audio').forEach(otherAudio => {
        if (otherAudio !== audio && !otherAudio.paused) {
          otherAudio.pause();
        }
      });
      setIsPlaying(true);
    };
    
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      
      // Make sure to pause the audio when unmounting
      if (!audio.paused) {
        audio.pause();
      }
    };
  }, [audioRef.current, audioData.url]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioData.url;
    link.download = `${metadata.title.replace(/\s+/g, '-').toLowerCase()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: metadata.title,
          text: `Check out my podcast: ${metadata.title} by ${metadata.author}`,
          url: audioData.url,
        })
        .catch((error) => console.log('Error sharing', error));
    } else {
      navigator.clipboard.writeText(audioData.url);
      alert('Link copied to clipboard!');
    }
  };

  const handleCreateNew = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className="mb-8 bg-gradient-to-r from-[#282828] to-[#121212] shadow-lg">
      <CardHeader className="border-b border-[#333333]">
        <CardTitle className="flex items-center gap-2">
          <span className="text-primary">🎧</span>
          Your Generated Podcast
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audio Info Column */}
          <Card className="bg-[#121212] border-[#333333]">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-3xl text-gray-500">🎵</span>
                </div>
                
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">{metadata.title}</h4>
                  <p className="text-sm text-gray-400">By {metadata.author}</p>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{formatDuration(podcastData?.duration || audioData.duration)}</span>
                    </div>
                    <div className="flex items-center">
                      <FileAudio className="h-3 w-3 mr-1" />
                      <span>{formatFileSize(podcastData?.fileSize || audioData.size)}</span>
                    </div>
                    <div className="flex items-center col-span-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{formatDistance(new Date(), new Date(), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Audio Player Column */}
          <div className="lg:col-span-2">
            <Card className="bg-[#121212] border-[#333333]">
              <CardContent className="p-5">
                {/* Use merged audio file if available, otherwise use sequential player for chunks */}
                {podcastData && podcastData.audioUrl ? (
                  <div className="mb-4">
                    <div className="relative mb-4">
                      <img 
                        src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=1600&q=80" 
                        alt="Audio waveform" 
                        className="w-full h-32 object-cover rounded-lg opacity-50"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button 
                          onClick={togglePlay}
                          className="bg-primary hover:bg-accent rounded-full h-16 w-16 flex items-center justify-center transition cursor-pointer"
                        >
                          {isPlaying ? (
                            <Pause className="text-black text-2xl" />
                          ) : (
                            <Play className="text-black text-2xl ml-1" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <audio 
                      ref={audioRef}
                      controls 
                      className="w-full audio-player rounded-lg mb-4"
                      src={podcastData.audioUrl}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      preload="metadata"
                      controlsList="nodownload"
                    />
                    
                    <div className="mt-2 text-center text-xs text-primary">
                      Full podcast • {formatDuration(podcastData.duration || audioData.duration)} total
                    </div>
                  </div>
                ) : podcastData && 'audioChunkUrls' in podcastData && Array.isArray(podcastData.audioChunkUrls) && podcastData.audioChunkUrls.length > 0 ? (
                  <div className="mb-4">
                    <SequentialAudioPlayer 
                      audioUrls={podcastData.audioChunkUrls}
                      metadata={metadata}
                      autoplay={true}
                    />
                    <div className="mt-2 text-center text-xs text-primary">
                      Full podcast • {formatDuration(audioData.duration)} total
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-4">
                      <img 
                        src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-1.2.1&auto=format&fit=crop&w=1600&q=80" 
                        alt="Audio waveform" 
                        className="w-full h-32 object-cover rounded-lg opacity-50"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button 
                          onClick={togglePlay}
                          className="bg-primary hover:bg-accent rounded-full h-16 w-16 flex items-center justify-center transition cursor-pointer"
                        >
                          {isPlaying ? (
                            <Pause className="text-black text-2xl" />
                          ) : (
                            <Play className="text-black text-2xl ml-1" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <audio 
                      ref={audioRef}
                      controls 
                      className="w-full audio-player rounded-lg mb-4"
                      src={audioData.url}
                      preload="metadata"
                      controlsList="nodownload"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    ></audio>
                  </>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleDownload}
                    variant="outline" 
                    className="flex-1 bg-transparent border border-[#333333] hover:bg-[#252525] text-foreground"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span>Download MP3</span>
                  </Button>
                  
                  <Button 
                    onClick={handleShare}
                    variant="outline" 
                    className="flex-1 bg-transparent border border-[#333333] hover:bg-[#252525] text-foreground"
                  >
                    <Share className="h-4 w-4 mr-2" />
                    <span>Share</span>
                  </Button>
                  
                  <Button 
                    onClick={handleCreateNew}
                    variant="outline" 
                    className="flex-1 bg-transparent border border-[#333333] hover:bg-[#252525] text-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span>Create New</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
