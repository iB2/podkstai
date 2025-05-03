import axios from "axios";

interface SupabaseUploadResponse {
  success: boolean;
  url?: string;
  fileName?: string;
  error?: string;
}

class SupabaseService {
  /**
   * Upload audio to Supabase storage via the backend proxy
   */
  async uploadAudio(audioData: Blob, fileName: string): Promise<SupabaseUploadResponse> {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove the data URL prefix (e.g., "data:audio/mpeg;base64,")
          const base64Content = base64data.split(',')[1];
          resolve(base64Content);
        };
      });
      
      reader.readAsDataURL(audioData);
      const base64 = await base64Promise;
      
      // Call backend API to upload to Supabase
      const response = await axios.post("/api/upload-audio", {
        fileName,
        fileData: base64,
        contentType: audioData.type || "audio/mpeg"
      });
      
      return {
        success: true,
        url: response.data.url,
        fileName: response.data.fileName
      };
    } catch (error) {
      console.error("Error uploading to Supabase:", error);
      return {
        success: false,
        error: axios.isAxiosError(error) 
          ? error.response?.data?.message || error.message
          : String(error)
      };
    }
  }
}

export const supabaseService = new SupabaseService();
