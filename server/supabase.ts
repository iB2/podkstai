import { createClient } from '@supabase/supabase-js';
import type { 
  User, UpsertUser,
  Podcast, InsertPodcast,
  PodcastAudioChunk, InsertPodcastAudioChunk
} from '@shared/schema';

// Environment variables validation
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables must be set');
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Define table names
const TABLES = {
  USERS: 'users',
  PODCASTS: 'podcasts',
  PODCAST_AUDIO_CHUNKS: 'podcast_audio_chunks'
};

export class SupabaseStorage {
  // User methods
  async createUser(userData: any): Promise<User> {
    // Mantemos este método por compatibilidade, mas redirecionamos para upsertUser
    return this.upsertUser(userData);
  }
  
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
    
    // No case conversion needed for users as the fields match
    return data as User;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('username', username)
      .single();
      
    if (error) {
      // If the error is because no rows were returned, return undefined
      if (error.code === 'PGRST116') {
        return undefined;
      }
      console.error('Error fetching user by username:', error);
      return undefined;
    }
    
    // No case conversion needed for users as the fields match
    return data as User;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Converte chaves camelCase para snake_case quando necessário
    const snakeCaseUser = {
      id: userData.id,
      username: userData.username,
      email: userData.email || null,
      first_name: userData.firstName || null,
      last_name: userData.lastName || null,
      bio: userData.bio || null,
      profile_image_url: userData.profileImageUrl || null,
      updated_at: new Date()
    };
    
    // Tenta inserir o usuário com on_conflict para fazer upsert
    const { data, error } = await supabase
      .from(TABLES.USERS)
      .upsert([snakeCaseUser], { 
        onConflict: 'id'
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error upserting user:", error);
      throw new Error(`Error upserting user: ${error.message}`);
    }
    
    // Converte snake_case de volta para camelCase
    const user: User = {
      id: data.id,
      username: data.username,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      bio: data.bio,
      profileImageUrl: data.profile_image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
    return user;
  }

  // Podcast methods
  async getAllPodcasts(): Promise<Podcast[]> {
    console.log("Supabase: buscando todos os podcasts");
    const { data, error } = await supabase
      .from(TABLES.PODCASTS)
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching podcasts:', error);
      return [];
    }
    
    console.log(`Supabase: encontrados ${data?.length || 0} podcasts:`, data);
    
    // Convert snake_case to camelCase
    const camelCasePodcasts = data.map(podcast => ({
      id: podcast.id,
      userId: podcast.user_id,
      title: podcast.title,
      author: podcast.author,
      description: podcast.description,
      category: podcast.category,
      language: podcast.language || 'en', // Add language field with default to 'en'
      audioUrl: podcast.audio_url,
      coverImageUrl: podcast.cover_image_url,
      duration: podcast.duration,
      chunkCount: podcast.chunk_count,
      fileSize: podcast.file_size,
      conversation: podcast.conversation,
      createdAt: podcast.created_at,
      metadata: podcast.metadata
    }));
    
    console.log(`Supabase: retornando ${camelCasePodcasts.length} podcasts após conversão`);
    return camelCasePodcasts;
  }

  async getPodcast(id: number): Promise<Podcast | undefined> {
    const { data, error } = await supabase
      .from(TABLES.PODCASTS)
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error fetching podcast:', error);
      return undefined;
    }
    
    // Convert snake_case to camelCase
    const camelCasePodcast: Podcast = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      author: data.author,
      description: data.description,
      category: data.category,
      language: data.language || 'en', // Add language field with default to 'en'
      audioUrl: data.audio_url,
      coverImageUrl: data.cover_image_url,
      duration: data.duration,
      chunkCount: data.chunk_count,
      fileSize: data.file_size,
      conversation: data.conversation,
      createdAt: data.created_at,
      metadata: data.metadata
    };
    
    return camelCasePodcast;
  }

  async createPodcast(podcast: InsertPodcast): Promise<Podcast> {
    // Convert camelCase to snake_case for Supabase
    // This is necessary because Drizzle schema uses camelCase in JS but the database uses snake_case
    const snakeCasePodcast = {
      user_id: podcast.userId,
      title: podcast.title,
      author: podcast.author,
      description: podcast.description,
      category: podcast.category,
      language: podcast.language || 'en', // Add language field with default to 'en'
      audio_url: podcast.audioUrl,
      cover_image_url: podcast.coverImageUrl || '/src/assets/images/default_thumb_podcast.png',
      duration: podcast.duration,
      chunk_count: podcast.chunkCount,
      file_size: podcast.fileSize,
      conversation: podcast.conversation,
      metadata: podcast.metadata
    };
    
    console.log("Inserting podcast with snake_case keys:", snakeCasePodcast);
    
    const { data, error } = await supabase
      .from(TABLES.PODCASTS)
      .insert(snakeCasePodcast)
      .select()
      .single();
      
    if (error) {
      console.error("Supabase insert error:", error);
      throw new Error(`Error creating podcast: ${error.message}`);
    }
    
    console.log("Podcast created successfully:", data);
    
    // Convert the returned snake_case data back to camelCase
    const camelCasePodcast: Podcast = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      author: data.author,
      description: data.description,
      category: data.category,
      language: data.language || 'en', // Add language field with default to 'en'
      audioUrl: data.audio_url,
      coverImageUrl: data.cover_image_url,
      duration: data.duration,
      chunkCount: data.chunk_count,
      fileSize: data.file_size,
      conversation: data.conversation,
      createdAt: data.created_at,
      metadata: data.metadata
    };
    
    return camelCasePodcast;
  }

  // Podcast audio chunk methods
  async getPodcastAudioChunks(podcastId: number): Promise<PodcastAudioChunk[]> {
    const { data, error } = await supabase
      .from(TABLES.PODCAST_AUDIO_CHUNKS)
      .select('*')
      .eq('podcast_id', podcastId)
      .order('chunk_index', { ascending: true });
      
    if (error) {
      console.error('Error fetching podcast audio chunks:', error);
      return [];
    }
    
    // Convert snake_case to camelCase
    const camelCaseChunks = data.map(chunk => ({
      id: chunk.id,
      podcastId: chunk.podcast_id,
      chunkIndex: chunk.chunk_index,
      audioUrl: chunk.audio_url,
      duration: chunk.duration,
      fileSize: chunk.file_size,
      text: chunk.text,
      speakerMap: chunk.speaker_map,
      createdAt: chunk.created_at
    }));
    
    return camelCaseChunks;
  }

  async createPodcastAudioChunk(chunk: InsertPodcastAudioChunk): Promise<PodcastAudioChunk> {
    // Convert camelCase to snake_case
    const snakeCaseChunk = {
      podcast_id: chunk.podcastId,
      chunk_index: chunk.chunkIndex,
      audio_url: chunk.audioUrl,
      duration: chunk.duration,
      file_size: chunk.fileSize,
      text: chunk.text,
      speaker_map: chunk.speakerMap
    };
    
    console.log("Inserting audio chunk with snake_case keys:", snakeCaseChunk);
    
    const { data, error } = await supabase
      .from(TABLES.PODCAST_AUDIO_CHUNKS)
      .insert(snakeCaseChunk)
      .select()
      .single();
      
    if (error) {
      console.error("Supabase insert error for audio chunk:", error);
      throw new Error(`Error creating podcast audio chunk: ${error.message}`);
    }
    
    // Convert snake_case back to camelCase
    const camelCaseChunk: PodcastAudioChunk = {
      id: data.id,
      podcastId: data.podcast_id,
      chunkIndex: data.chunk_index,
      audioUrl: data.audio_url,
      duration: data.duration,
      fileSize: data.file_size,
      text: data.text,
      speakerMap: data.speaker_map,
      createdAt: data.created_at
    };
    
    return camelCaseChunk;
  }

  // Supabase Storage methods
  async uploadAudio(fileData: string, filePath: string, contentType: string): Promise<string> {
    try {
      // Make sure the podcast_audio bucket exists
      await this.createBucketIfNotExists('podcast_audio');
      
      const { data, error } = await supabase.storage
        .from('podcast_audio')
        .upload(filePath, Buffer.from(fileData, 'base64'), {
          contentType,
          upsert: true
        });
        
      if (error) {
        console.error(`Error uploading file: ${error.message}`);
        throw new Error(`Error uploading file: ${error.message}`);
      }
      
      if (!data || !data.path) {
        throw new Error('Upload succeeded but no file path was returned');
      }
      
      console.log(`Upload successful to path: ${data.path}`);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('podcast_audio')
        .getPublicUrl(data.path);
        
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not generate public URL for uploaded file');
      }
      
      console.log(`Generated public URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error in uploadAudio:', error);
      throw error;
    }
  }
  
  // Add a new bucket for merged audio files if it doesn't exist
  async createBucketIfNotExists(bucketName: string): Promise<void> {
    try {
      // Check if bucket exists
      const { error: getBucketError } = await supabase.storage.getBucket(bucketName);
      
      // Create bucket if it doesn't exist
      if (getBucketError) {
        const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        if (createBucketError) {
          console.error(`Error creating bucket ${bucketName}:`, createBucketError);
          throw new Error(`Failed to create bucket ${bucketName}: ${createBucketError.message}`);
        }
        
        console.log(`Created new bucket: ${bucketName}`);
      }
    } catch (error) {
      console.error('Error checking/creating bucket:', error);
      // Continue even if this fails - bucket might already exist
    }
  }
  
  // Upload merged audio file to a dedicated merged_podcasts bucket
  async uploadMergedAudio(
    arrayBuffer: ArrayBuffer, 
    fileName: string, 
    contentType: string = 'audio/mpeg'
  ): Promise<string> {
    try {
      console.log(`Uploading merged audio file: ${fileName} (${arrayBuffer.byteLength} bytes)`);
      
      const bucketName = 'merged_podcasts';
      
      // Create bucket if needed
      await this.createBucketIfNotExists(bucketName);
      
      // Upload the merged file
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: true
        });
        
      if (error) {
        console.error('Error uploading merged audio:', error);
        throw new Error(`Error uploading merged audio: ${error.message}`);
      }
      
      if (!data || !data.path) {
        throw new Error('Upload succeeded but no file path was returned');
      }
      
      console.log(`Upload successful to path: ${data.path}`);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);
        
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not generate public URL for uploaded file');
      }
      
      console.log(`Generated public URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error in uploadMergedAudio:', error);
      // If this is a known error type, re-throw it
      if (error.message) {
        throw error;
      }
      // Otherwise, wrap in a generic error
      throw new Error(`Failed to process merged audio: ${error}`);
    }
  }
  
  // Update podcast with the merged audio URL
  async updatePodcastAudio(podcastId: number, audioUrl: string, fileSize: number): Promise<Podcast> {
    console.log(`Updating podcast ${podcastId} with merged audio URL: ${audioUrl}, size: ${fileSize} bytes`);
    
    try {
      const { data, error } = await supabase
        .from(TABLES.PODCASTS)
        .update({ 
          audio_url: audioUrl,
          file_size: fileSize
          // Only update fields that are in our schema
        })
        .eq('id', podcastId)
        .select('*')
        .single();
      
      if (error) {
        console.error('Error updating podcast with merged audio:', error);
        throw new Error(`Failed to update podcast with merged audio: ${error.message}`);
      }
      
      // Convert snake_case to camelCase
      const camelCasePodcast: Podcast = {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        author: data.author,
        description: data.description,
        category: data.category,
        language: data.language || 'en', // Add language field with default to 'en'
        audioUrl: data.audio_url,
        coverImageUrl: data.cover_image_url,
        duration: data.duration,
        chunkCount: data.chunk_count,
        fileSize: data.file_size,
        conversation: data.conversation,
        createdAt: data.created_at,
        metadata: data.metadata
      };
      
      return camelCasePodcast;
    } catch (error) {
      console.error('Unexpected error updating podcast audio:', error);
      throw error;
    }
  }
}

export const supabaseStorage = new SupabaseStorage();