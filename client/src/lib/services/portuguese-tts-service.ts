import { apiRequest } from "@/lib/queryClient";
import type { Podcast } from "@shared/schema";
import type { PortuguesePodcastFormValues } from "@/lib/schemas/portuguese-podcast";

// Define types for Portuguese voices
export interface PortugueseVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

// Type for audio generation response
export interface GenerateAudioResponse {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
  podcast?: Podcast;
}

// Create podcast response
interface CreatePodcastResponse extends Podcast {}

// Parse the conversation text into a format suitable for the Google TTS API
const parseConversation = (text: string): { speaker: string, text: string }[] => {
  // Split by new lines and process each line
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const conversation = [];
  
  for (const line of lines) {
    // Look for pattern "Name: Text" 
    const match = line.match(/^([^:]+):(.*)/);
    if (match) {
      const [, speaker, text] = match;
      conversation.push({
        speaker: speaker.trim(),
        text: text.trim()
      });
    } else {
      // If no speaker prefix is found, add to the last speaker's text
      if (conversation.length > 0) {
        const lastItem = conversation[conversation.length - 1];
        lastItem.text += ' ' + line.trim();
      } else {
        // If this is the first line and has no speaker prefix, use a default
        conversation.push({
          speaker: 'Speaker',
          text: line.trim()
        });
      }
    }
  }
  
  return conversation;
};

// Portuguese TTS Service
export const portugueseTtsService = {
  // Get available Portuguese voices
  async getVoices(): Promise<PortugueseVoice[]> {
    try {
      const response = await apiRequest<PortugueseVoice[]>(
        'GET',
        '/api/portuguese-voices'
      );
      return response;
    } catch (error) {
      console.error('Error fetching Portuguese voices:', error);
      return [];
    }
  },
  
  // Generate audio from conversation
  async generateAudio(
    formData: PortuguesePodcastFormValues
  ): Promise<GenerateAudioResponse> {
    try {
      // Extract form data
      const { 
        conversation: conversationText, 
        firstSpeakerVoice, 
        secondSpeakerVoice,
        title,
        author,
        description,
        category
      } = formData;
      
      // Parse the conversation into a structured format
      const parsedConversation = parseConversation(conversationText);
      
      // Map speakers to their voice IDs
      // First appeared speaker gets firstSpeakerVoice, others get secondSpeakerVoice
      const speakerVoiceMap = new Map<string, string>();
      
      for (const item of parsedConversation) {
        if (!speakerVoiceMap.has(item.speaker)) {
          // If this is the first speaker, assign the first voice
          if (speakerVoiceMap.size === 0) {
            speakerVoiceMap.set(item.speaker, firstSpeakerVoice);
          } else {
            // Otherwise, assign the second voice
            speakerVoiceMap.set(item.speaker, secondSpeakerVoice);
          }
        }
      }
      
      // Create the conversation array with voice assignments
      const conversation = parsedConversation.map(item => ({
        text: item.text,
        voiceId: speakerVoiceMap.get(item.speaker) || firstSpeakerVoice
      }));
      
      // Prepare metadata
      const metadata = {
        title,
        author,
        description,
        category
      };
      
      console.log('Sending Portuguese TTS request with metadata:', metadata);
      
      // Send to API
      const response = await apiRequest<GenerateAudioResponse>(
        'POST',
        '/api/portuguese-tts/generate',
        {
          conversation,
          language: 'pt-BR',
          metadata
        }
      );
      
      return response;
    } catch (error) {
      console.error('Error generating Portuguese audio:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  // Create a podcast with the generated audio
  async createPodcast(podcastData: any): Promise<CreatePodcastResponse> {
    try {
      const response = await apiRequest<CreatePodcastResponse>(
        'POST',
        '/api/podcasts',
        podcastData
      );
      
      return response;
    } catch (error) {
      console.error('Error creating podcast:', error);
      throw error;
    }
  }
};