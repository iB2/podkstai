import { useState, useEffect } from 'react';
import { useSequentialAudioPlayer } from '@/hooks/use-sequential-audio-player';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Volume1, 
  VolumeX 
} from 'lucide-react';
import './audio-player-styles.css';

interface SequentialAudioPlayerProps {
  audioUrls: string[];
  metadata: {
    title: string;
    author: string;
  };
  autoplay?: boolean;
}

export function SequentialAudioPlayer({ audioUrls, metadata, autoplay = false }: SequentialAudioPlayerProps) {
  const [volume, setVolume] = useState(0.8);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState('0:00');
  const [durationDisplay, setDurationDisplay] = useState('0:00');
  const [progress, setProgress] = useState(0);
  
  const {
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume: setPlayerVolume,
    skipToSegment,
    currentTime,
    duration,
    isPlaying,
    loaded,
    currentSegment,
    totalSegments
  } = useSequentialAudioPlayer(audioUrls, {
    volume,
    autoplay, // Pass the autoplay prop to the hook
    onPlay: () => console.log('Playing'),
    onPause: () => console.log('Paused'),
    onEnded: () => console.log('Playback ended'),
    onSegmentChange: (index) => console.log(`Switched to segment ${index}`)
  });
  
  // Format time display (convert seconds to mm:ss format)
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Update time displays and progress
  useEffect(() => {
    if (loaded && duration > 0) {
      setCurrentTimeDisplay(formatTime(currentTime));
      setDurationDisplay(formatTime(duration));
      setProgress((currentTime / duration) * 100);
    }
  }, [currentTime, duration, loaded]);
  
  // Update volume
  const handleVolumeChange = (newVolume: number[]) => {
    const value = newVolume[0];
    setVolume(value);
    setPlayerVolume(value);
  };
  
  // Handle seeking
  const handleSeek = (newProgress: number[]) => {
    if (duration > 0) {
      const newTime = (newProgress[0] / 100) * duration;
      seekTo(newTime);
      
      // Log seek operation for debugging
      console.log(`Seeking to ${newTime.toFixed(1)}s (${newProgress[0].toFixed(1)}% of ${duration.toFixed(1)}s total)`);
      if (totalSegments > 1) {
        console.log(`Multi-segment podcast: currently at segment ${currentSegment + 1}/${totalSegments}`);
      }
    }
  };
  
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX className="h-5 w-5" />;
    if (volume < 0.5) return <Volume1 className="h-5 w-5" />;
    return <Volume2 className="h-5 w-5" />;
  };
  
  return (
    <Card className="bg-[#282828] shadow-lg">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          {/* Metadata */}
          <div className="flex flex-col">
            <h3 className="text-lg font-medium text-white">
              {metadata.title}
            </h3>
            <p className="text-sm text-gray-400">
              {metadata.author}
            </p>
          </div>
          
          {/* Add a hidden debug info section that's only visible during development */}
          {process.env.NODE_ENV === 'development' && totalSegments > 1 ? (
            <div className="text-xs text-gray-400 opacity-50">
              <span>
                Debug: Playing segment {currentSegment + 1} of {totalSegments}
              </span>
            </div>
          ) : null}
          
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="sequential-player-slider relative h-2 w-full rounded-full overflow-hidden bg-[#3E3E3E]">
              {/* Barra de progresso verde */}
              <div 
                className="absolute h-full bg-[#F3930B] left-0 top-0 transition-all"
                style={{ width: `${progress}%` }}
              />
              
              {/* Thumb (bolinha de controle) */}
              <div 
                className="thumb"
                style={{ left: `${progress}%` }}
              />
              
              {/* Slider invisível para capturar cliques */}
              <Slider 
                value={[progress]} 
                min={0} 
                max={100} 
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer absolute inset-0 opacity-0 z-20" 
                disabled={!loaded}
              />
            </div>
            
            <div className="flex justify-between text-xs text-gray-400">
              <div>{currentTimeDisplay}</div>
              <div>{durationDisplay}</div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 justify-center w-20">
              {/* Hide skip buttons to make it appear as a single continuous audio file */}
              {/* <Button
                variant="ghost"
                size="sm"
                onClick={() => skipToSegment(currentSegment - 1)}
                disabled={currentSegment === 0 || !loaded}
                className="text-gray-300 hover:text-white hover:bg-[#333333]"
              >
                <SkipBack className="h-5 w-5" />
              </Button> */}
              
              <Button
                size="icon"
                variant="default"
                className="rounded-full bg-primary hover:bg-primary/90 h-10 w-10"
                onClick={togglePlay}
                disabled={!loaded || audioUrls.length === 0}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              
              {/* <Button
                variant="ghost"
                size="sm"
                onClick={() => skipToSegment(currentSegment + 1)}
                disabled={currentSegment === totalSegments - 1 || !loaded}
                className="text-gray-300 hover:text-white hover:bg-[#333333]"
              >
                <SkipForward className="h-5 w-5" />
              </Button> */}
            </div>
            
            {/* Volume control */}
            <div className="flex items-center space-x-2 w-32">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newVolume = volume === 0 ? 0.5 : 0;
                  setVolume(newVolume);
                  setPlayerVolume(newVolume);
                }}
                className="text-gray-300 hover:text-white hover:bg-[#333333]"
              >
                {getVolumeIcon()}
              </Button>
              
              <div className="sequential-player-slider relative h-2 w-full rounded-full overflow-hidden bg-[#3E3E3E]">
                {/* Barra de volume verde */}
                <div 
                  className="absolute h-full bg-[#F3930B] left-0 top-0 transition-all"
                  style={{ width: `${volume * 100}%` }}
                />
                
                {/* Thumb (bolinha de controle) */}
                <div 
                  className="thumb"
                  style={{ left: `${volume * 100}%` }}
                />
                
                {/* Slider invisível para capturar cliques */}
                <Slider
                  value={[volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(val) => handleVolumeChange([val[0] / 100])}
                  className="cursor-pointer absolute inset-0 opacity-0 z-20"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}