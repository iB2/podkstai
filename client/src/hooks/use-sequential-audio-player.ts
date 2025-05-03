import { useState, useEffect, useRef } from "react";

interface SequentialAudioPlayerOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onSegmentChange?: (index: number) => void;
  volume?: number;
  autoplay?: boolean;
  segmentDurations?: number[]; // Array of known durations for each segment
}

export function useSequentialAudioPlayer(
  urls: string[], 
  options: SequentialAudioPlayerOptions = {}
) {
  // We'll initialize segment durations in the useEffect
  // State variables
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  // Track total duration and time offsets for all segments
  const totalDurationRef = useRef<number>(0);
  const segmentDurationsRef = useRef<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  
  // Refs for managing audio and tracking changes
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const updateIntervalRef = useRef<number | null>(null);
  const urlsRef = useRef<string[]>([]);
  const currentUrlIndexRef = useRef<number>(0);
  
  // Set up audio element and event listeners
  useEffect(() => {
    // Stop any currently playing audios first
    document.querySelectorAll('audio').forEach(audio => {
      if (!audio.paused) {
        audio.pause();
      }
    });
    
    const audio = new Audio();
    audioRef.current = audio;
    
    // Initialize with known durations if provided
    if (options.segmentDurations && options.segmentDurations.length > 0) {
      segmentDurationsRef.current = [...options.segmentDurations];
      totalDurationRef.current = options.segmentDurations.reduce((sum, val) => sum + val, 0);
      setDuration(totalDurationRef.current);
      console.log(`Initialized with ${options.segmentDurations.length} known segment durations, total: ${totalDurationRef.current}s`);
    }
    
    // Event handlers
    const handlePlay = () => {
      // Pause all other audio elements when this one plays
      document.querySelectorAll('audio').forEach(otherAudio => {
        if (otherAudio !== audioRef.current && !otherAudio.paused) {
          otherAudio.pause();
        }
      });
      
      setIsPlaying(true);
      if (options.onPlay) options.onPlay();
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (options.onPause) options.onPause();
    };
    
    const handleEnded = () => {
      // When a segment ends, move to the next one
      if (currentUrlIndex < urls.length - 1) {
        const nextIndex = currentUrlIndex + 1;
        setCurrentUrlIndex(nextIndex);
        
        if (options.onSegmentChange) {
          options.onSegmentChange(nextIndex);
        }
        
        // Always continue with the next segment automatically with a tiny delay
        // to allow for smooth transition between segments
        setTimeout(() => {
          // Make sure we're still mounted and have an audio element
          if (audioRef.current) {
            audioRef.current.play()
              .then(() => console.log(`Automatically playing next segment ${nextIndex + 1}/${urls.length}`))
              .catch(err => console.error("Failed to play next segment:", err));
          }
        }, 100); // Slightly longer delay to ensure smooth transition
      } else {
        // We reached the end of all segments
        setIsPlaying(false);
        if (options.onEnded) options.onEnded();
        console.log("Reached the end of all audio segments");
      }
    };
    
    const handleLoadedMetadata = () => {
      // Store the duration for this segment
      if (segmentDurationsRef.current.length <= currentUrlIndex) {
        // Add this segment's duration to our tracking array
        segmentDurationsRef.current[currentUrlIndex] = audio.duration;
        
        // Recalculate total duration whenever we get a new segment
        totalDurationRef.current = segmentDurationsRef.current.reduce((sum, val) => sum + val, 0);
        console.log(`Audio segment ${currentUrlIndex + 1} duration: ${audio.duration}s, total: ${totalDurationRef.current}s`);
      }
      
      // Use either this segment's duration or total duration if we have it
      setDuration(totalDurationRef.current > 0 ? totalDurationRef.current : audio.duration);
      setLoaded(true);
      
      // Start time update interval when loaded
      if (!updateIntervalRef.current) {
        updateIntervalRef.current = window.setInterval(() => {
          // Calculate the overall time position including previous segments
          const previousSegmentsDuration = segmentDurationsRef.current
            .slice(0, currentUrlIndex)
            .reduce((sum, val) => sum + val, 0);
            
          const adjustedCurrentTime = previousSegmentsDuration + audio.currentTime;
          setCurrentTime(adjustedCurrentTime);
        }, 100);
      }
    };
    
    const handleError = (e: ErrorEvent) => {
      console.error("Audio playback error:", e);
      setLoaded(false);
    };
    
    // Add event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    
    // Set initial volume
    if (options.volume !== undefined) {
      audio.volume = Math.max(0, Math.min(1, options.volume));
    }
    
    // Clean up
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      
      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      
      audio.pause();
      audioRef.current = null;
    };
  }, []);
  
  // Handle URL changes or segment navigation - importantly this ignores play/pause state changes
  useEffect(() => {
    if (!audioRef.current || urls.length === 0) return;
    
    const currentUrl = urls[currentUrlIndex];
    if (!currentUrl) return;
    
    // Check if URLs array or selected URL index has actually changed
    const urlsChanged = JSON.stringify(urlsRef.current) !== JSON.stringify(urls);
    const indexChanged = currentUrlIndexRef.current !== currentUrlIndex;
    
    // Only reload if URLs or current index actually changed
    if (urlsChanged || indexChanged) {
      // Update refs to track the latest URL array and index
      urlsRef.current = [...urls];
      currentUrlIndexRef.current = currentUrlIndex;
      
      // Load the new source
      setLoaded(false);
      audioRef.current.src = currentUrl;
      audioRef.current.load();
      
      console.log(`Loading audio segment ${currentUrlIndex + 1}/${urls.length}`);
      
      // Always autoplay subsequent segments after the first one starts playing
      // or if explicitly set to autoplay
      if (isPlaying || (currentUrlIndex === 0 && options.autoplay)) {
        audioRef.current.play().catch(err => {
          console.error("Failed to play audio:", err);
        });
      }
      
      if (options.onSegmentChange) {
        options.onSegmentChange(currentUrlIndex);
      }
    }
  }, [urls, currentUrlIndex, options.autoplay]);
  
  // Control functions
  const play = () => {
    if (audioRef.current && urls.length > 0) {
      // Pause all other audio elements before playing this one
      document.querySelectorAll('audio').forEach(otherAudio => {
        if (otherAudio !== audioRef.current && !otherAudio.paused) {
          otherAudio.pause();
        }
      });
      
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
    if (!audioRef.current || segmentDurationsRef.current.length === 0) return;
    
    // Find which segment contains the target time
    let targetSegment = 0;
    let segmentStartTime = 0;
    let segmentTime = time;
    
    // Loop through segments to find the right one
    for (let i = 0; i < segmentDurationsRef.current.length; i++) {
      const segmentDuration = segmentDurationsRef.current[i];
      const segmentEndTime = segmentStartTime + segmentDuration;
      
      if (time >= segmentStartTime && time < segmentEndTime) {
        // Found the segment that contains our target time
        targetSegment = i;
        segmentTime = time - segmentStartTime;
        break;
      }
      
      segmentStartTime += segmentDuration;
    }
    
    // If we're seeking to a different segment, switch to it
    if (targetSegment !== currentUrlIndex) {
      setCurrentUrlIndex(targetSegment);
      
      // We'll need to set the time after the segment loads
      // Store the target time to apply after segment loads
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = segmentTime;
        }
      }, 200);
    } else {
      // Same segment, just update the time
      audioRef.current.currentTime = segmentTime;
    }
  };
  
  const skipToSegment = (index: number) => {
    if (index >= 0 && index < urls.length) {
      setCurrentUrlIndex(index);
    }
  };
  
  return {
    play,
    pause,
    togglePlay,
    setVolume,
    seekTo,
    skipToSegment,
    audioElement: audioRef.current,
    isPlaying,
    currentTime,
    duration,
    loaded,
    currentSegment: currentUrlIndex,
    totalSegments: urls.length
  };
}