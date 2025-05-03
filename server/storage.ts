import { 
  type User, type UpsertUser,
  type Podcast, type InsertPodcast,
  type PodcastAudioChunk, type InsertPodcastAudioChunk
} from "@shared/schema";
import { supabaseStorage } from "./supabase";

// Storage interface with required CRUD methods
export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;

  // Podcast methods
  getAllPodcasts(): Promise<Podcast[]>;
  getPodcast(id: number): Promise<Podcast | undefined>;
  createPodcast(podcast: InsertPodcast): Promise<Podcast>;

  // Podcast audio chunk methods
  getPodcastAudioChunks(podcastId: number): Promise<PodcastAudioChunk[]>;
  createPodcastAudioChunk(chunk: InsertPodcastAudioChunk): Promise<PodcastAudioChunk>;
}

// Memory storage implementation (now used as a fallback if needed)
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private podcasts: Map<number, Podcast>;
  private podcastAudioChunks: Map<number, PodcastAudioChunk>;
  private podcastId: number;
  private chunkId: number;

  constructor() {
    this.users = new Map();
    this.podcasts = new Map();
    this.podcastAudioChunks = new Map();
    this.podcastId = 1;
    this.chunkId = 1;
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: userData.id,
      username: userData.username,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      bio: userData.bio || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: this.users.has(userData.id) 
        ? this.users.get(userData.id)?.createdAt || now
        : now,
      updatedAt: now
    };
    this.users.set(userData.id, user);
    return user;
  }
  
  async createUser(userData: UpsertUser): Promise<User> {
    // Redireciona para upsertUser para manter compatibilidade com o código existente
    return this.upsertUser(userData);
  }

  // Podcast methods
  async getAllPodcasts(): Promise<Podcast[]> {
    return Array.from(this.podcasts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPodcast(id: number): Promise<Podcast | undefined> {
    return this.podcasts.get(id);
  }

  async createPodcast(insertPodcast: InsertPodcast): Promise<Podcast> {
    const id = this.podcastId++;
    const now = new Date();
    const podcast: Podcast = { 
      id,
      userId: insertPodcast.userId || null,
      title: insertPodcast.title,
      author: insertPodcast.author,
      description: insertPodcast.description,
      category: insertPodcast.category,
      language: insertPodcast.language || 'en',
      audioUrl: insertPodcast.audioUrl,
      duration: insertPodcast.duration,
      chunkCount: insertPodcast.chunkCount,
      fileSize: insertPodcast.fileSize,
      conversation: insertPodcast.conversation,
      metadata: insertPodcast.metadata || null,
      createdAt: now
    };
    this.podcasts.set(id, podcast);
    return podcast;
  }

  // Podcast audio chunk methods
  async getPodcastAudioChunks(podcastId: number): Promise<PodcastAudioChunk[]> {
    return Array.from(this.podcastAudioChunks.values())
      .filter(chunk => chunk.podcastId === podcastId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async createPodcastAudioChunk(insertChunk: InsertPodcastAudioChunk): Promise<PodcastAudioChunk> {
    const id = this.chunkId++;
    const now = new Date();
    const chunk: PodcastAudioChunk = {
      id,
      podcastId: insertChunk.podcastId,
      chunkIndex: insertChunk.chunkIndex,
      audioUrl: insertChunk.audioUrl,
      duration: insertChunk.duration,
      fileSize: insertChunk.fileSize,
      text: insertChunk.text,
      speakerMap: insertChunk.speakerMap || null,
      createdAt: now
    };
    this.podcastAudioChunks.set(id, chunk);
    return chunk;
  }
}

// Export the Supabase storage implementation
export const storage = supabaseStorage;
