import axios from "axios";

interface TtsServiceResponse {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

class TtsService {
  private readonly apiUrl = "https://flask-api-955132768795.us-central1.run.app/api/tts/generate-audio";
  
  /**
   * Generate audio from text using the TTS API
   */
  async generateAudio(text: string, voice: string): Promise<TtsServiceResponse> {
    try {
      // Validate text length before sending to API
      if (text.length > 2000) {
        console.warn("Text may be too long for TTS API, length:", text.length);
      }
      
      // Make request to backend proxy to avoid CORS issues
      // We need to send both text and voice to conform to the server's expectations
      const response = await axios.post("/api/generate-audio", {
        text,
        voice // This is required by server validation
      });
      
      if (!response.data || !response.data.audio_url) {
        return {
          success: false,
          error: "Invalid response from TTS API"
        };
      }
      
      return {
        success: true,
        audioUrl: response.data.audio_url,
        // Estimate duration based on words (average speaking rate: 150 words per minute)
        duration: Math.max(3, Math.ceil(text.split(/\s+/).length / 2.5))
      };
    } catch (error) {
      console.error("Error calling TTS API:", error);
      
      // Better error handling for specific TTS API errors
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        
        // Check for the specific TTS API error
        if (typeof errorMessage === 'string' && 
            (errorMessage.includes("MultiSpeakerMarkup is too long") || 
             errorMessage.includes("Text is too long"))) {
          return {
            success: false,
            error: "Your conversation is too long or complex for the TTS service. Please use shorter segments or reduce the number of speaker changes."
          };
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }
      
      return {
        success: false,
        error: String(error)
      };
    }
  }
}

export const ttsService = new TtsService();
