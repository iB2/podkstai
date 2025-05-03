export type SpeakerType = "male" | "female";

export interface TextLine {
  speaker: string;
  text: string;
}

export interface ProcessedTextChunk {
  index: number;
  text: string;
  lines: TextLine[];
  speakerVoices: Record<string, SpeakerType>;
}

interface ProcessingOptions {
  firstSpeaker: SpeakerType;
  secondSpeaker: SpeakerType;
  maxChunkSize?: number;
}

/**
 * Process conversation text into chunks that can be sent to TTS API
 */
export function processText(text: string, options: ProcessingOptions): ProcessedTextChunk[] {
  const {
    firstSpeaker,
    secondSpeaker,
    maxChunkSize = 2000  // Increased chunk size from 500 to 2000 as requested
  } = options;
  
  if (!text || text.trim() === '') {
    return [];
  }

  // Split the text into lines and process each line
  const lines = text.split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Look for "Speaker: Text" pattern
      const match = line.match(/^([^:]+):(.*)/);
      if (match) {
        return {
          speaker: match[1].trim(),
          text: match[2].trim()
        };
      }
      
      // If no match, treat entire line as text from unknown speaker
      return {
        speaker: 'Unknown',
        text: line.trim()
      };
    });
  
  if (lines.length === 0) {
    return [];
  }
  
  // Build a map of speaker names to voices
  const speakerVoices: Record<string, SpeakerType> = {};
  
  // First speaker in the conversation always gets the primary voice
  if (lines.length > 0) {
    // Always assign the first speaker (position-wise) to the primary voice
    const firstSpeakerName = lines[0].speaker;
    speakerVoices[firstSpeakerName] = firstSpeaker;
    
    // Track speakers we've already assigned
    const assignedSpeakers = new Set<string>([firstSpeakerName]);
    
    // For all other speakers, assign the opposite voice
    for (const line of lines) {
      const speaker = line.speaker;
      if (!assignedSpeakers.has(speaker)) {
        speakerVoices[speaker] = secondSpeaker;
        assignedSpeakers.add(speaker);
      }
    }
  }
  
  // Chunk the lines to stay under the max size
  const chunks: ProcessedTextChunk[] = [];
  let currentChunk: TextLine[] = [];
  let currentSize = 0;
  let chunkIndex = 0;
  
  for (const line of lines) {
    const lineSize = line.text.length;
    
    // If adding this line would exceed the max chunk size, start a new chunk
    if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.map(l => `${l.speaker}: ${l.text}`).join('\n'),
        lines: currentChunk,
        speakerVoices
      });
      
      currentChunk = [];
      currentSize = 0;
    }
    
    currentChunk.push(line);
    currentSize += lineSize;
  }
  
  // Add the last chunk if there's anything left
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.map(l => `${l.speaker}: ${l.text}`).join('\n'),
      lines: currentChunk,
      speakerVoices
    });
  }
  
  return chunks;
}
