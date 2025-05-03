import { useEffect, useRef } from "react";

interface AudioPlayerOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  volume?: number;
  autoplay?: boolean;
}

export function useAudioPlayer(url: string, options: AudioPlayerOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    // Initialize audio element
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      
      // Set volume
      if (options.volume !== undefined) {
        audioRef.current.volume = Math.max(0, Math.min(1, options.volume));
      }
      
      // Set up event listeners
      if (options.onPlay) {
        audioRef.current.addEventListener('play', options.onPlay);
      }
      
      if (options.onPause) {
        audioRef.current.addEventListener('pause', options.onPause);
      }
      
      if (options.onEnded) {
        audioRef.current.addEventListener('ended', options.onEnded);
      }
      
      // Autoplay if specified
      if (options.autoplay) {
        audioRef.current.play().catch(error => {
          console.error('Failed to autoplay:', error);
        });
      }
    } else {
      // Update audio source if URL changes
      if (audioRef.current.src !== url) {
        audioRef.current.src = url;
        
        // If it was playing before, start playing the new source
        if (!audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            console.error('Failed to play new source:', error);
          });
        }
      }
    }
    
    // Clean up event listeners on unmount
    return () => {
      if (audioRef.current) {
        if (options.onPlay) {
          audioRef.current.removeEventListener('play', options.onPlay);
        }
        
        if (options.onPause) {
          audioRef.current.removeEventListener('pause', options.onPause);
        }
        
        if (options.onEnded) {
          audioRef.current.removeEventListener('ended', options.onEnded);
        }
        
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [url, options]);
  
  // Control functions
  const play = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => {
        console.error('Failed to play:', error);
      });
    }
  };
  
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  const togglePlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        play();
      } else {
        pause();
      }
    }
  };
  
  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  };
  
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };
  
  return {
    play,
    pause,
    togglePlay,
    setVolume,
    seekTo,
    audioElement: audioRef.current,
  };
}
