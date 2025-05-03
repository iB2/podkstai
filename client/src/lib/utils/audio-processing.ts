import axios from "axios";
import { ProcessedTextChunk } from "./text-processing";

export interface AudioChunk {
  url: string;
  duration: number;
  fileSize: number;
  chunkIndex: number;
  text: string;
  speakerMap: Record<string, string>;
}

export interface MergedAudio {
  url: string;
  duration: number;
  size: number;
}

// Generate audio from processed text chunk
export async function generateAudio(chunk: ProcessedTextChunk): Promise<AudioChunk> {
  try {
    // DEBUG: Log what chunk we're receiving
    console.log("generateAudio received chunk:", JSON.stringify(chunk, null, 2));
    
    // Format the text properly for the TTS API
    // We need to remove speaker names from being read aloud and limit to 2000 chars max
    // Construct formatted text WITHOUT speaker names from the lines array
    let formattedText = "";
    
    // Build proper text WITHOUT speaker names from the structured lines
    for (const line of chunk.lines) {
      // Add ONLY the line's text WITHOUT the speaker name prefix to avoid TTS reading it
      formattedText += `${line.text}\n`;
    }
    
    // Enforce a limit but allowing for larger chunks as requested
    const MAX_SAFE_LENGTH = 1900; // Conservative margin below the 2000 limit
    if (formattedText.length > MAX_SAFE_LENGTH) {
      console.warn(`Text chunk too long (${formattedText.length} chars), truncating to ${MAX_SAFE_LENGTH}`);
      
      // Try to cut at a natural boundary like a line break
      let truncationPoint = formattedText.lastIndexOf('\n', MAX_SAFE_LENGTH);
      
      // If we can't find a line break, cut at the last space before the limit
      if (truncationPoint === -1) {
        truncationPoint = formattedText.lastIndexOf(' ', MAX_SAFE_LENGTH);
      }
      
      // If all else fails, just truncate at the limit
      if (truncationPoint === -1) {
        truncationPoint = MAX_SAFE_LENGTH;
      }
      
      formattedText = formattedText.substring(0, truncationPoint);
    }
    
    // Log the formatted text for debugging
    console.log("Sending formatted conversation text:", formattedText);
    
    // Prepare payload for API request
    const requestPayload = { text: formattedText };
    console.log("Request payload:", JSON.stringify(requestPayload));
    
    // Send request to our backend proxy
    const response = await fetch('/api/generate-audio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });
    
    // Handle error responses
    if (!response.ok) {
      let errorMessage: string;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.details || `Failed to generate audio: ${response.statusText}`;
        
        // Special handling for the MultiSpeakerMarkup error
        if (errorMessage.includes("MultiSpeakerMarkup is too long") || 
            errorMessage.includes("Text is too long")) {
          throw new Error("The conversation is too complex. Try using shorter sentences or fewer speaker changes.");
        }
      } catch (e) {
        // If we can't parse the JSON, use the status text
        errorMessage = `Failed to generate audio: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Process successful response
    const audioResult = await response.json();
    
    if (!audioResult || !audioResult.audio_url) {
      throw new Error('Invalid response from TTS API');
    }
    
    // Calculate audio properties
    // Estimate duration based on word count (rough estimate: 150 words per minute)
    const wordCount = formattedText.split(/\s+/).length;
    const estimatedDuration = Math.max(3, Math.ceil(wordCount / 2.5));
    
    // Estimate file size based on duration (rough estimate: 16kb per second of audio)
    const estimatedFileSize = estimatedDuration * 16 * 1024;
    
    return {
      url: audioResult.audio_url || "",
      duration: audioResult.duration || estimatedDuration,
      fileSize: estimatedFileSize,
      chunkIndex: chunk.index,
      text: chunk.text,
      speakerMap: chunk.speakerVoices,
    };
  } catch (error) {
    console.error("Error generating audio:", error);
    throw new Error(`Failed to generate audio: ${(error as Error).message}`);
  }
}

// Merge multiple audio chunks into a single audio file or return single chunk directly
export async function mergeAudioChunks(chunks: AudioChunk[], podcastId?: number): Promise<MergedAudio> {
  try {
    console.log(`Merging ${chunks.length} audio chunks...`);
    
    // Sort chunks by index
    const sortedChunks = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    
    // If there's only one chunk, just return it directly without trying to merge
    if (sortedChunks.length === 1) {
      console.log("Only one chunk exists, returning it directly without merging");
      const singleChunk = sortedChunks[0];
      // Convert float duration to integer to avoid database issues
      const roundedDuration = Math.round(singleChunk.duration);
      console.log(`Converting duration from ${singleChunk.duration} to ${roundedDuration} seconds`);
      return {
        url: singleChunk.url,
        duration: roundedDuration,
        size: singleChunk.fileSize
      };
    }
    
    // For multiple chunks, we need to merge them via our API
    console.log(`Multiple chunks detected (${sortedChunks.length}) - initiating merge process`);
    
    // Calculate total duration and size to report accurate stats
    let totalDuration = 0;
    let totalSize = 0;
    
    sortedChunks.forEach(chunk => {
      totalDuration += chunk.duration;
      totalSize += chunk.fileSize;
    });
    
    // Round the duration to an integer to avoid database issues
    const roundedDuration = Math.round(totalDuration);
    console.log(`Total duration: ${totalDuration}, rounded to ${roundedDuration} seconds`);
    
    try {
      // Extract the URLs of all audio chunks for merging
      const audioUrls = sortedChunks.map(chunk => chunk.url);
      
      // If no podcast ID was provided explicitly, try to extract it from the URL
      if (!podcastId) {
        try {
          // Try to extract podcastId from window.location
          if (window && window.location && window.location.pathname) {
            const pathMatch = window.location.pathname.match(/\/podcasts\/(\d+)/);
            if (pathMatch && pathMatch[1]) {
              podcastId = parseInt(pathMatch[1]);
            }
          }
        } catch (e) {
          console.warn("Could not extract podcastId from URL:", e);
        }
      }
      
      // Log whether we have a podcast ID
      if (podcastId) {
        console.log(`Using podcast ID ${podcastId} for audio merging`);
      } else {
        console.warn("No podcast ID available for audio merging - this may cause issues");
      }
      
      // Send request to merge the audio files
      const mergeResponse = await fetch('/api/merge-audio-chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          urls: audioUrls,
          podcastId: podcastId 
        })
      });
      
      if (!mergeResponse.ok) {
        console.warn(`Audio merge API returned status ${mergeResponse.status}`);
        
        try {
          // Try to parse the error response
          const errorResponse = await mergeResponse.json();
          console.error("Audio merge error details:", errorResponse);
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        
        console.warn("Falling back to using all chunks separately. The final audio might have gaps or inconsistencies.");
        
        // In case of failure, fall back to the first chunk - it's better than nothing
        return {
          url: sortedChunks[0].url,
          duration: roundedDuration,
          size: totalSize
        };
      }
      
      // Process the merge response
      const mergeResult = await mergeResponse.json();
      
      if (!mergeResult || !mergeResult.mergedUrl) {
        console.warn("Audio merge API returned invalid response. Falling back to using the first chunk.");
        // In case of an invalid response, fall back to the first chunk
        return {
          url: sortedChunks[0].url,
          duration: roundedDuration,
          size: totalSize
        };
      }
      
      console.log(`Successfully merged ${sortedChunks.length} chunks into a single audio file`);
      
      // Return the merged audio URL with the total duration and size
      return {
        url: mergeResult.mergedUrl,
        duration: roundedDuration, 
        size: totalSize
      };
    } catch (mergeError) {
      console.error("Error merging audio chunks:", mergeError);
      console.warn("Falling back to using the longest chunk as the merged audio");
      
      // Find the chunk with the longest duration as a fallback
      const longestChunk = sortedChunks.reduce((longest, current) => 
        current.duration > longest.duration ? current : longest, sortedChunks[0]);
      
      return {
        url: longestChunk.url,
        duration: roundedDuration,
        size: totalSize
      };
    }
  } catch (error) {
    console.error("Error processing audio chunks:", error);
    throw new Error(`Failed to process audio chunks: ${(error as Error).message}`);
  }
}