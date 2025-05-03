import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPodcastSchema, insertPodcastAudioChunkSchema } from "@shared/schema";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { supabaseStorage } from "./supabase";
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import { availablePortugueseVoices, processPortugueseConversation } from './googleTts';
import { generatePodcastScript } from './openai-script-generator';
import { setupAuth, isAuthenticated } from './replitAuth';

// Objeto para controlar o rate limiting
const rateLimiter = {
  lastDemoScriptRequest: 0
};

// Estado global para rastrear o progresso da geração de scripts
type GenerationStep = "idle" | "interpreting" | "researching" | "strategizing" | "writing" | "editing" | "complete";

// Interface para o resultado do script gerado
interface ScriptResult {
  script: string;
  title: string;
  description: string;
}

interface ScriptGenerationState {
  inProgress: boolean;
  step: GenerationStep;
  progress: number;
  userId?: string;
  theme?: string;
  startTime?: Date;
  message?: string; // Mensagem de erro ou status
  lastResult?: ScriptResult; // Armazena o último resultado gerado com sucesso
}

// Estado global da geração (um único processo por vez)
const scriptGenerationState: ScriptGenerationState = {
  inProgress: false,
  step: "idle",
  progress: 0
};

// Função para atualizar o estado da geração
export function updateScriptGenerationState(update: Partial<ScriptGenerationState>) {
  Object.assign(scriptGenerationState, update);
  // Logar mudanças de estado
  if (update.step) {
    console.log(`[Script Generator] Progress: ${update.step} (${scriptGenerationState.progress || 0}%)`);
  }
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// TTS API endpoint
const TTS_API_URL = "https://flask-api-955132768795.us-central1.run.app/api/tts/generate-audio";

// Helper function to merge audio chunks using FFmpeg
async function mergeAudioChunks(urls: string[], podcastId: number): Promise<{ url: string, totalChunks: number, fileSize: number }> {
  // Sort the URLs by their filename/path which should contain the chunk index
  const sortedUrls = [...urls].sort((a, b) => {
    // Extract numbers from the URLs as a simple sorting mechanism
    const aMatch = a.match(/\d+/);
    const bMatch = b.match(/\d+/);
    
    if (aMatch && bMatch) {
      return parseInt(aMatch[0]) - parseInt(bMatch[0]);
    }
    
    return 0; // If we can't extract numbers, keep original order
  });
  
  // Download all audio files
  console.log("Downloading audio chunks...");
  console.log("URLs to download:", JSON.stringify(sortedUrls));
  const chunksData = [];
  
  for (let i = 0; i < sortedUrls.length; i++) {
    try {
      console.log(`Starting download for chunk ${i + 1}/${sortedUrls.length}: ${sortedUrls[i]}`);
      const response = await axios.get(sortedUrls[i], { 
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        }
      });
      console.log(`Download successful: ${response.status} ${response.statusText}`);
      console.log(`Content-Type: ${response.headers['content-type']}`);
      chunksData.push(response.data);
      console.log(`Downloaded chunk ${i + 1}/${sortedUrls.length} (${response.data.byteLength} bytes)`);
    } catch (error: any) {
      console.error(`Failed to download chunk ${i + 1}:`, error.message || 'Unknown error');
      if (error.response) {
        console.error(`Response error status: ${error.response.status}`);
        console.error(`Response headers:`, error.response.headers);
      }
      // Continue with other chunks
    }
  }
  
  if (chunksData.length === 0) {
    throw new Error("Failed to download any audio chunks");
  }
  
  // Use FFmpeg to properly merge audio files
  console.log(`Processing ${chunksData.length} audio chunks with FFmpeg...`);
  
  // Create a temporary directory to store audio files
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-merge-'));
  console.log(`Created temporary directory: ${tempDir}`);
  
  try {
    // Save each audio chunk to a temporary file
    const chunkPaths: string[] = [];
    let totalSize = 0;
    
    for (let i = 0; i < chunksData.length; i++) {
      const chunk = chunksData[i];
      if (!chunk || typeof chunk.byteLength !== 'number') {
        console.error(`Invalid chunk at index ${i}:`, chunk);
        throw new Error(`Invalid chunk data at index ${i}`);
      }
      
      const chunkPath = path.join(tempDir, `chunk-${i}.mp3`);
      fs.writeFileSync(chunkPath, Buffer.from(chunk));
      chunkPaths.push(chunkPath);
      totalSize += chunk.byteLength;
      console.log(`Saved chunk ${i} to ${chunkPath} (${chunk.byteLength} bytes)`);
    }
    
    // Create a file list for FFmpeg
    const fileListPath = path.join(tempDir, 'filelist.txt');
    const fileListContent = chunkPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(fileListPath, fileListContent);
    
    console.log(`Created FFmpeg file list at ${fileListPath}`);
    console.log(fileListContent);
    
    // Output path for the merged file
    const mergedFilePath = path.join(tempDir, 'merged.mp3');
    
    // Use FFmpeg to convert and merge the files
    // This approach handles files with different encodings/formats
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -ar 44100 -ac 2 -b:a 192k "${mergedFilePath}"`;
    console.log(`Executing FFmpeg command: ${ffmpegCommand}`);
    
    execSync(ffmpegCommand, { stdio: 'inherit' });
    
    console.log(`FFmpeg successfully merged files to ${mergedFilePath}`);
    
    // Read the merged file into a buffer
    const mergedBuffer = fs.readFileSync(mergedFilePath);
    console.log(`Read merged file into buffer (${mergedBuffer.byteLength} bytes)`);
    
    // Generate a unique filename for the merged audio
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const mergedFileName = `merged-podcast-${podcastId}-${timestamp}-${randomId}.mp3`;
    
    // Upload the merged file to Supabase storage
    console.log("Uploading merged audio to Supabase...");
    const mergedUrl = await supabaseStorage.uploadMergedAudio(
      mergedBuffer, 
      mergedFileName, 
      'audio/mpeg'
    );
    
    console.log(`Uploaded merged audio to ${mergedUrl}`);
    
    // Update the podcast record with the merged audio URL
    const updatedPodcast = await supabaseStorage.updatePodcastAudio(
      podcastId,
      mergedUrl,
      mergedBuffer.byteLength
    );
    
    console.log(`Updated podcast ${podcastId} with merged audio URL`);
    
    // Clean up temporary files
    try {
      // Clean up individual files first (more verbose logging)
      chunkPaths.forEach(p => {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      });
      if (fs.existsSync(fileListPath)) {
        fs.unlinkSync(fileListPath);
      }
      if (fs.existsSync(mergedFilePath)) {
        fs.unlinkSync(mergedFilePath);
      }
      
      // Then remove the entire directory to ensure everything is cleaned up
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary directory and files`);
    } catch (cleanupError) {
      console.error(`Non-fatal error during cleanup:`, cleanupError);
      // Continue even if cleanup fails
    }
    
    return {
      url: mergedUrl,
      totalChunks: chunksData.length,
      fileSize: mergedBuffer.byteLength
    };
  } catch (error) {
    console.error(`Error during FFmpeg processing:`, error);
    // Attempt to clean up the temp directory if it exists
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error(`Error cleaning up temp directory: ${cleanupError}`);
    }
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação Replit
  await setupAuth(app);

  // Rota para obter informações do usuário autenticado
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Rota de administração protegida
  app.get("/api/admin/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const username = req.user.claims.username;
      
      // Se chegou aqui, é um usuário autenticado
      res.json({ 
        status: "ok", 
        message: "Você está autenticado e tem acesso a recursos administrativos",
        user: {
          id: userId,
          username: username,
          isAdmin: true
        },
        stats: {
          totalUsers: 1, // Simplificado para o exemplo
          totalPodcasts: (await storage.getAllPodcasts()).length,
          serverUptime: process.uptime()
        }
      });
    } catch (error) {
      console.error("Error accessing admin resources:", error);
      res.status(500).json({ message: "Failed to access admin resources" });
    }
  });

  // Portuguese TTS Endpoints
  
  // Get available Portuguese voices
  app.get("/api/portuguese-voices", async (req, res) => {
    try {
      res.json(availablePortugueseVoices);
    } catch (error) {
      console.error("Error fetching Portuguese voices:", error);
      res.status(500).json({ message: "Failed to fetch Portuguese voices" });
    }
  });
  
  // Rota para verificar o status da geração de scripts
  app.get("/api/script-generation/status", async (req, res) => {
    try {
      res.json({
        ...scriptGenerationState,
        // Calcular há quanto tempo a geração está em andamento (se estiver)
        elapsedTime: scriptGenerationState.startTime 
          ? Math.floor((Date.now() - scriptGenerationState.startTime.getTime()) / 1000)
          : 0
      });
    } catch (error) {
      console.error("Error fetching script generation status:", error);
      res.status(500).json({ message: "Failed to fetch generation status" });
    }
  });
  
  // Generate audio using Google TTS
  app.post("/api/portuguese-tts/generate", async (req, res) => {
    try {
      const { conversation, language, metadata } = req.body;
      
      console.log("Received Portuguese TTS request with metadata:", metadata);
      
      if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid conversation format. Expected non-empty array." 
        });
      }
      
      // Get the voice IDs from the conversation
      const firstSpeakerVoice = conversation[0]?.voiceId;
      // Find a second speaker voice that's different from the first one
      const secondSpeakerVoice = conversation.find(item => item.voiceId !== firstSpeakerVoice)?.voiceId || 
                              availablePortugueseVoices.find(v => v.id !== firstSpeakerVoice)?.id || 
                              availablePortugueseVoices[1]?.id;
      
      if (!firstSpeakerVoice || !secondSpeakerVoice) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing voice IDs for speakers" 
        });
      }
      
      // Reconstruct the conversation text
      const conversationText = conversation.map(item => {
        const speakerName = item.voiceId === firstSpeakerVoice ? "Speaker 1" : "Speaker 2";
        return `${speakerName}: ${item.text}`;
      }).join("\n");
      
      console.log("Processing Portuguese conversation...");
      
      // Process the conversation with Google TTS
      const result = await processPortugueseConversation(
        conversationText,
        firstSpeakerVoice,
        secondSpeakerVoice
      );
      
      console.log("Portuguese conversation processed successfully");
      
      // Verificar se o usuário está autenticado
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ 
          success: false, 
          error: "Você precisa estar autenticado para usar esta funcionalidade" 
        });
      }
      
      // Upload individual audio segments to Supabase
      console.log(`Uploading ${result.tempFiles.length} temporary audio segments to Supabase...`);
      const timestamp = Date.now();
      const chunkUrls = [];
      
      // Upload each temp file to Supabase
      for (let i = 0; i < result.tempFiles.length; i++) {
        try {
          const tempFile = result.tempFiles[i];
          console.log(`Processing temp file ${i + 1}/${result.tempFiles.length}: ${tempFile}`);
          
          // Read file content
          const tempFileContent = fs.readFileSync(tempFile);
          const tempFileName = `temp-chunk-${timestamp}-${i}.mp3`;
          
          // Base64 encode the file content
          const base64Data = tempFileContent.toString('base64');
          
          // Upload to Supabase
          const chunkUrl = await supabaseStorage.uploadAudio(
            base64Data,
            tempFileName,
            'audio/mpeg'
          );
          
          chunkUrls.push(chunkUrl);
          console.log(`Temporary chunk ${i+1} uploaded to Supabase: ${tempFileName}`);
          
          // Cleanup local file after upload
          fs.unlinkSync(tempFile);
        } catch (chunkError) {
          console.error(`Error uploading chunk ${i}:`, chunkError);
          // Continue with other chunks even if one fails
        }
      }
      
      // Upload the merged audio file to Supabase
      console.log("Uploading merged audio to Supabase...");
      const audioBuffer = fs.readFileSync(result.audioUrl);
      const filename = `portuguese-podcast-${timestamp}.mp3`;
      const uploadResult = await supabaseStorage.uploadMergedAudio(
        audioBuffer.buffer, 
        filename,
        'audio/mpeg'
      );
      
      console.log("Merged audio uploaded successfully:", uploadResult);
      
      // Obter ID do usuário autenticado
      // @ts-ignore
      const userId = req.user.claims?.sub;
      console.log("Using authenticated user ID for Portuguese podcast:", userId);
      
      // Create a podcast record in the database
      const podcastData = {
        userId: userId,
        title: metadata?.title || "Conversa em Português",
        author: metadata?.author || "Usuário Demo",
        description: metadata?.description || "Podcast gerado automaticamente usando TTS em português",
        category: metadata?.category || "Português",
        language: "pt-BR",
        audioUrl: uploadResult,
        coverImageUrl: '/src/assets/images/default_thumb_podcast.png',
        duration: Math.round(result.duration), // Convertendo para inteiro para evitar erro de validação
        chunkCount: chunkUrls.length, // Número de chunks que foram processados
        fileSize: result.size,
        conversation: JSON.stringify(conversation)
      };
      
      console.log("Creating podcast record with data:", podcastData);
      
      // Validate podcast data
      const validationResult = insertPodcastSchema.safeParse(podcastData);
      
      if (!validationResult.success) {
        console.error("Validation error:", JSON.stringify(validationResult.error.format(), null, 2));
        throw new Error("Invalid podcast data");
      }
      
      // Create the podcast record
      const podcast = await storage.createPodcast(validationResult.data);
      console.log("Podcast created successfully:", podcast);
      
      // Agora vamos criar os registros para os chunks de áudio
      for (let i = 0; i < chunkUrls.length; i++) {
        try {
          // Criar um registro para cada chunk no banco de dados
          const chunkData = {
            podcastId: podcast.id,
            chunkIndex: i,
            audioUrl: chunkUrls[i],
            duration: 0, // Não temos essa informação, então usamos um valor padrão
            fileSize: 0, // Não temos essa informação, então usamos um valor padrão
            text: `Chunk ${i+1} de ${chunkUrls.length}`,
            speakerMap: "{}"
          };
          
          // Validar e salvar o chunk
          const chunkResult = insertPodcastAudioChunkSchema.safeParse(chunkData);
          
          if (chunkResult.success) {
            const savedChunk = await storage.createPodcastAudioChunk(chunkResult.data);
            console.log(`Chunk ${i+1} salvo no banco de dados:`, savedChunk.id);
          } else {
            console.error(`Erro de validação ao salvar chunk ${i+1}:`, 
              JSON.stringify(chunkResult.error.format(), null, 2));
          }
        } catch (chunkDbError) {
          console.error(`Erro ao salvar chunk ${i+1} no banco de dados:`, chunkDbError);
          // Continuar mesmo se falhar a criação de alguns chunks
        }
      }
      
      // Delete the temporary file
      fs.unlinkSync(result.audioUrl);
      console.log("Temporary file deleted");
      
      // Return the result
      res.json({
        success: true,
        podcast: podcast,
        audioUrl: uploadResult,
        duration: result.duration,
        fileSize: result.size
      });
    } catch (error: any) {
      console.error("Error generating Portuguese audio:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Failed to generate Portuguese audio" 
      });
    }
  });

  // Get all podcasts with security and user-specific filtering
  app.get("/api/podcasts", async (req, res) => {
    try {
      // Obtém o ID do usuário autenticado (se disponível)
      const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
        ? (req.user as any).claims?.sub 
        : null;
      
      // Determina qual ID de usuário usar para filtragem
      let userIdToFilter: string | null = null;
      
      if (authenticatedUserId) {
        // Se o usuário está autenticado, mostrar apenas seus podcasts
        userIdToFilter = authenticatedUserId;
        console.log(`Filtrando podcasts para usuário autenticado: ${userIdToFilter}`);
      } else if (req.query.userId) {
        // Se um ID de usuário foi especificado como parâmetro e o usuário não está autenticado, rejeitar
        return res.status(403).json({ 
          message: "Acesso negado: você precisa estar autenticado para ver podcasts de outros usuários" 
        });
      } else {
        // Se não tem usuário autenticado, retornar lista vazia
        return res.json([]);
      }
      
      // Buscar todos os podcasts
      const allPodcasts = await storage.getAllPodcasts();
      console.log(`Total de podcasts no banco: ${allPodcasts.length}`);
      
      // Log detalhado dos podcasts para depuração
      allPodcasts.forEach((podcast, index) => {
        console.log(`Podcast ${index + 1}: ID=${podcast.id}, userId=${podcast.userId}, title=${podcast.title}`);
      });
      
      // Aplicar filtro de usuário
      const podcasts = userIdToFilter 
        ? allPodcasts.filter(podcast => {
            console.log(`Comparando podcast.userId=${podcast.userId} (${typeof podcast.userId}) com userIdToFilter=${userIdToFilter} (${typeof userIdToFilter})`);
            
            // Verifica se os IDs são compatíveis após a conversão para string
            // Isso resolve problemas de comparação entre tipos diferentes (número vs string)
            const podcastUserIdStr = String(podcast.userId);
            const userIdToFilterStr = String(userIdToFilter);
            
            console.log(`Comparando como strings: ${podcastUserIdStr} === ${userIdToFilterStr} => ${podcastUserIdStr === userIdToFilterStr}`);
            
            // Retorna true se os IDs corresponderem como strings
            return podcastUserIdStr === userIdToFilterStr;
          })
        : [];
      
      console.log(`Podcasts após filtragem: ${podcasts.length}`);
      
      res.json(podcasts);
    } catch (error) {
      console.error("Error fetching podcasts:", error);
      res.status(500).json({ message: "Failed to fetch podcasts" });
    }
  });
  
  // Generate podcast script with authentication requirement
  app.post("/api/generate-script", isAuthenticated, async (req, res) => {
    try {
      // Verificar se já existe um processo de geração em andamento
      if (scriptGenerationState.inProgress) {
        return res.status(429).json({
          success: false,
          error: "Já existe um processo de geração em andamento. Aguarde a conclusão ou verifique o status.",
          status: scriptGenerationState
        });
      }
      
      // Usar ID do usuário autenticado
      const userId = (req.user as any).claims?.sub;
      console.log(`Script sendo gerado pelo usuário autenticado: ${userId}`);
      
      const { topic } = req.body;
      
      if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        return res.status(400).json({
          success: false,
          error: "O tema do podcast é obrigatório"
        });
      }
      
      console.log(`Iniciando geração avançada de script para o tema: ${topic}`);
      
      // Inicializar o estado de geração
      updateScriptGenerationState({
        inProgress: true,
        step: "idle",
        progress: 0,
        userId,
        theme: topic.trim(),
        startTime: new Date()
      });
      
      // Iniciar processo de geração em segundo plano
      (async () => {
        try {
          // Importar dinamicamente para evitar loop de dependência circular
          const { generateEnhancedPodcastScript } = await import('./perplexity-service');
          await generateEnhancedPodcastScript(topic.trim());
        } catch (genError) {
          console.error("Erro na geração em segundo plano:", genError);
          updateScriptGenerationState({
            inProgress: false,
            step: "idle",
            progress: 0
          });
        }
      })();
      
      // Responder imediatamente com status inicial
      return res.json({
        success: true,
        status: {
          ...scriptGenerationState,
          message: "Geração de script iniciada. Use a rota /api/script-generation/status para verificar o progresso."
        }
      });
    } catch (error: any) {
      console.error("Error initiating script generation:", error);
      // Resetar estado em caso de erro
      updateScriptGenerationState({
        inProgress: false,
        step: "idle",
        progress: 0
      });
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to initiate script generation"
      });
    }
  });
  
  // Rota para verificar o status da geração do script
  app.get("/api/script-generation/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims?.sub;
      
      // Se a geração for de outro usuário, negar acesso
      if (scriptGenerationState.userId && scriptGenerationState.userId !== userId) {
        return res.status(403).json({
          inProgress: false,
          step: "idle",
          progress: 0,
          message: "Você não tem permissão para acessar este status."
        });
      }
      
      // Calcular tempo decorrido
      const elapsedTime = scriptGenerationState.startTime 
        ? Math.floor((Date.now() - scriptGenerationState.startTime.getTime()) / 1000)
        : 0;
      
      // Retornar o estado atual da geração
      return res.json({
        ...scriptGenerationState,
        elapsedTime
      });
    } catch (error) {
      console.error("Error checking generation status:", error);
      return res.status(500).json({
        inProgress: false,
        step: "idle",
        progress: 0,
        message: "Erro ao verificar status da geração"
      });
    }
  });
  
  // Rota para obter o resultado final do script gerado
  app.get("/api/script-generation/result", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims?.sub;
      
      // Se a geração ainda estiver em andamento, retornar um erro
      if (scriptGenerationState.inProgress) {
        return res.status(202).json({
          success: false,
          message: "A geração ainda está em andamento. Aguarde a conclusão.",
          status: {
            ...scriptGenerationState,
            elapsedTime: scriptGenerationState.startTime 
              ? Math.floor((Date.now() - scriptGenerationState.startTime.getTime()) / 1000)
              : 0
          }
        });
      }
      
      // Se a geração não foi iniciada, retornar um erro
      if (scriptGenerationState.step === "idle" || !scriptGenerationState.theme) {
        return res.status(404).json({
          success: false,
          message: "Nenhuma geração de script foi iniciada ou concluída."
        });
      }
      
      // Se a geração for de outro usuário, negar acesso
      if (scriptGenerationState.userId && scriptGenerationState.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para acessar este script."
        });
      }
      
      // Se o script foi completado com sucesso (step === "complete"), não precisamos gerar novamente
      if (scriptGenerationState.step === "complete" && 
          scriptGenerationState.lastResult && 
          scriptGenerationState.lastResult.script) {
        
        console.log("Retornando resultado em cache do script previamente gerado");
        return res.json({
          success: true,
          script: scriptGenerationState.lastResult.script,
          title: scriptGenerationState.lastResult.title,
          description: scriptGenerationState.lastResult.description,
          theme: scriptGenerationState.theme
        });
      }
      
      // Se o script não estiver completo ou não tiver um resultado armazenado,
      // avisamos o cliente que precisa esperar a conclusão primeiro
      return res.status(202).json({
        success: false,
        message: "Geração incompleta ou resultado não disponível. Por favor, aguarde a conclusão do processo.",
        status: scriptGenerationState
      });
    } catch (error: any) {
      console.error("Error fetching script result:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch script result"
      });
    }
  });

  // Get a single podcast by ID with authentication check
  app.get("/api/podcasts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const podcast = await storage.getPodcast(id);
      
      if (!podcast) {
        return res.status(404).json({ message: "Podcast not found" });
      }
      
      // Verificar se o usuário tem permissão para acessar este podcast
      // Permitir acesso se:
      // 1. O podcast pertence ao usuário autenticado
      // 2. O podcast pertence ao usuário demo (para demonstração)
      // 3. O usuário tem permissões administrativas (implementação futura)
      const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
        ? (req.user as any).claims?.sub 
        : null;
      
      const isDemoContent = String(podcast.userId) === 'demo-user-1';
      const isOwner = authenticatedUserId && String(podcast.userId) === String(authenticatedUserId);
      
      // Se não for conteúdo demo e não for o proprietário, negar acesso
      if (!isDemoContent && !isOwner) {
        console.log(`Acesso negado ao podcast ${id}. User ID: ${authenticatedUserId}, Podcast userId: ${podcast.userId}`);
        return res.status(403).json({ 
          message: "You don't have permission to access this podcast"
        });
      }
      
      console.log(`Acesso permitido ao podcast ${id} para o usuário ${authenticatedUserId}`);
      
      
      // Get all audio chunks for this podcast and include them in the response
      try {
        const audioChunks = await storage.getPodcastAudioChunks(id);
        
        // Sort chunks by index to ensure correct playback order
        const sortedChunks = audioChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
        
        // Include the sorted audio chunks in the response
        res.json({
          ...podcast,
          audioChunks: sortedChunks,
          // Include an array of just the URLs for easy sequential playback
          audioChunkUrls: sortedChunks.map(chunk => chunk.audioUrl)
        });
      } catch (chunksError) {
        // If we fail to get chunks, still return the podcast data
        console.error("Error fetching podcast audio chunks:", chunksError);
        res.json(podcast);
      }
    } catch (error) {
      console.error("Error fetching podcast:", error);
      res.status(500).json({ message: "Failed to fetch podcast" });
    }
  });

  // Create a new podcast
  app.post("/api/podcasts", async (req, res) => {
    try {
      // Log the body for debugging
      console.log("POST /api/podcasts request body:", JSON.stringify(req.body));
      
      // Get the validation schema and print it for debugging
      console.log("Podcast schema fields:", Object.keys(insertPodcastSchema.shape));
      
      // Check if the user is authenticated
      let userId;
      
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        // If user is authenticated, use their ID from the session
        userId = (req.user as any).claims?.sub;
        console.log("Using authenticated user ID:", userId);
      } else {
        // Fall back to demo user if not authenticated
        let defaultUser;
        
        try {
          // Check if we have a demo user already
          console.log("User not authenticated, looking for demo user...");
          defaultUser = await storage.getUserByUsername("demo");
          
          if (!defaultUser) {
            console.log("Creating default demo user...");
            // Create a default user for demo purposes
            defaultUser = await storage.upsertUser({
              id: "demo-user-1",
              username: "demo"
            });
            console.log("Default user created:", defaultUser);
          } else {
            console.log("Using existing demo user:", defaultUser);
          }
          
          userId = defaultUser.id;
        } catch (userError) {
          console.error("Error with demo user:", userError);
          return res.status(500).json({ message: "Failed to ensure default user exists" });
        }
      }
      
      // Use the appropriate user ID
      const podcastData = {
        ...req.body,
        userId,
        coverImageUrl: req.body.coverImageUrl || '/src/assets/images/default_thumb_podcast.png'
      };
      
      console.log("Podcast data with demo userId:", JSON.stringify(podcastData));
      
      // Manually log all required fields
      console.log("Does data have all required fields?");
      console.log("- userId present:", podcastData.userId !== undefined);
      console.log("- title present:", podcastData.title !== undefined);
      console.log("- author present:", podcastData.author !== undefined);
      console.log("- description present:", podcastData.description !== undefined);
      console.log("- category present:", podcastData.category !== undefined);
      console.log("- audioUrl present:", podcastData.audioUrl !== undefined);
      console.log("- duration present:", podcastData.duration !== undefined);
      console.log("- chunkCount present:", podcastData.chunkCount !== undefined);
      console.log("- fileSize present:", podcastData.fileSize !== undefined);
      console.log("- conversation present:", podcastData.conversation !== undefined);
      
      const result = insertPodcastSchema.safeParse(podcastData);
      
      if (!result.success) {
        // Print detailed error information
        console.error("Validation error:", JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ message: "Invalid podcast data", errors: result.error.format() });
      }
      
      const podcast = await storage.createPodcast(result.data);
      res.status(201).json(podcast);
    } catch (error) {
      console.error("Error creating podcast:", error);
      res.status(500).json({ message: "Failed to create podcast" });
    }
  });

  // Create a podcast audio chunk with authentication check
  app.post("/api/podcast-chunks", async (req, res) => {
    try {
      const result = insertPodcastAudioChunkSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid chunk data", errors: result.error.format() });
      }
      
      // Verificar se o usuário tem permissão para adicionar chunks a este podcast
      if (result.data.podcastId) {
        const podcast = await storage.getPodcast(result.data.podcastId);
        
        if (podcast) {
          // Verificar acesso com os mesmos critérios usados na rota GET
          const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
            ? (req.user as any).claims?.sub 
            : null;
          
          const isDemoContent = String(podcast.userId) === 'demo-user-1';
          const isOwner = authenticatedUserId && String(podcast.userId) === String(authenticatedUserId);
          
          if (!isDemoContent && !isOwner) {
            console.log(`Acesso negado para adicionar chunks ao podcast ${podcast.id}. User ID: ${authenticatedUserId}, Podcast userId: ${podcast.userId}`);
            return res.status(403).json({ 
              message: "You don't have permission to modify this podcast"
            });
          }
        }
      }
      
      const chunk = await storage.createPodcastAudioChunk(result.data);
      res.status(201).json(chunk);
    } catch (error) {
      console.error("Error creating podcast chunk:", error);
      res.status(500).json({ message: "Failed to create podcast chunk" });
    }
  });

  // Generate audio from text using TTS API
  app.post("/api/generate-audio", async (req, res) => {
    try {
      // Print entire request body for debugging
      console.log("FULL CLIENT REQUEST BODY:", JSON.stringify(req.body));
      
      // Required: We need the text to synthesize
      let text = req.body.text;
      
      if (!text) {
        return res.status(400).json({ message: "Text parameter is required" });
      }
      
      // Enforce maximum text length to prevent TTS API errors
      // Increased from 450 to 1900 to match frontend changes
      const MAX_SAFE_LENGTH = 1900;
      if (text.length > MAX_SAFE_LENGTH) {
        console.warn(`Text is too long (${text.length} chars), truncating to ${MAX_SAFE_LENGTH} chars`);
        
        // Try to cut at a natural boundary like a line break
        let truncationPoint = text.lastIndexOf('\n', MAX_SAFE_LENGTH);
        
        // If we can't find a line break, cut at the last space before the limit
        if (truncationPoint === -1) {
          truncationPoint = text.lastIndexOf(' ', MAX_SAFE_LENGTH);
        }
        
        // If all else fails, just truncate at the limit
        if (truncationPoint === -1 || truncationPoint < MAX_SAFE_LENGTH * 0.8) {
          truncationPoint = MAX_SAFE_LENGTH;
        }
        
        text = text.substring(0, truncationPoint);
      }
      
      // This is the EXACT curl command that works (tested via bash):
      // curl --location 'https://flask-api-955132768795.us-central1.run.app/api/tts/generate-audio' \
      // --header 'Content-Type: application/json' \
      // --data '{
      //     "text": "Hello world text here",
      //     "voices": ["R", "S"],
      //     "position": [1, 0],
      //     "author_name":"Mariana Tiengo",
      //     "author_id": "odsadddddddds",
      //     "description": "blrioda2331312333sodasodjfiosjffasdasdsa",
      //     "podcast_title": "Mariana by Mariana",
      //     "author_description":"",
      //     "content_type": "",
      //     "type": 0
      // }'
      
      // Determine the position based on the first speaker's gender in the text
      // Extract the first speaker and gender from the request
      let position = [1, 0]; // Default: man first (R voice), woman second (S voice)
      
      try {
        // If speaker_map exists in the request, use it to determine position
        if (req.body.speaker_map && typeof req.body.speaker_map === 'string') {
          const speakerMap = JSON.parse(req.body.speaker_map);
          const firstSpeaker = Object.keys(speakerMap)[0];
          
          if (speakerMap[firstSpeaker]?.toLowerCase() === 'female') {
            position = [0, 1]; // Woman first (S voice), man second (R voice)
            console.log(`First speaker (${firstSpeaker}) is female, setting position to [0, 1]`);
          } else {
            console.log(`First speaker (${firstSpeaker}) is male, setting position to [1, 0]`);
          }
        }
      } catch (err) {
        console.error("Error parsing speaker map:", err);
        // Fallback to default position if there's an error
      }
      
      // Create the request for the TTS API
      const payload = {
        text: text,
        voices: ["R", "S"],
        position: position,
        author_name: "Mariana Tiengo",
        author_id: "odsadddddddds",
        description: "blrioda2331312333sodasodjfiosjffasdasdsa",
        podcast_title: "Mariana by Mariana",
        author_description: "",
        content_type: "",
        type: 0,
        typeVoice: 0  // Adding typeVoice parameter for Google TTS
      };
      
      console.log(`Using position [${position}] for text-to-speech conversion`);
      
      console.log("TTS API Payload:", JSON.stringify(payload, null, 2));
      
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error("API Error:", response.status, errorData);
          
          // Check for content length/markup error
          if (errorData.error && errorData.error.includes("MultiSpeakerMarkup is too long")) {
            return res.status(413).json({ 
              message: "Text is too long for the TTS service. Please use shorter text segments or fewer speakers.",
              details: "The conversation is too complex for the TTS API to process. Try breaking it into smaller parts."
            });
          }
          
          return res.status(response.status).json({ 
            message: "Failed to generate audio", 
            details: errorData.error || "API request failed"
          });
        } catch (jsonError) {
          console.error("Error parsing API error response:", jsonError);
          return res.status(response.status).json({ 
            message: "Failed to generate audio", 
            details: "Unknown API error: " + response.statusText
          });
        }
      }
      
      const data = await response.json();
      
      if (!data || !data.audio_url) {
        return res.status(500).json({ message: "Failed to generate audio, invalid response from TTS API" });
      }
      
      // Return the response data directly
      res.json(data);
    } catch (err) {
      const error = err as Error;
      console.error("Error generating audio:", error);
      
      // Simplified error handling for fetch approach
      res.status(500).json({ 
        message: "Failed to generate audio",
        details: error.message || "Unknown error"
      });
    }
  });

  // Upload audio file to Supabase storage with authentication check
  app.post("/api/upload-audio", async (req, res) => {
    try {
      // Verifica se há informações de usuário autenticado para logs
      const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
        ? (req.user as any).claims?.sub 
        : null;
      
      // Logging do upload
      if (authenticatedUserId) {
        console.log(`Upload de áudio solicitado pelo usuário: ${authenticatedUserId}`);
      } else {
        console.log(`Upload de áudio solicitado por usuário não autenticado`);
      }
      
      const { fileName, fileData, contentType } = req.body;
      
      if (!fileName || !fileData || !contentType) {
        return res.status(400).json({ message: "FileName, fileData, and contentType are required" });
      }
      
      // Validação básica do tipo de arquivo
      if (!contentType.startsWith('audio/')) {
        return res.status(400).json({ message: "Only audio files are allowed" });
      }
      
      // Validação do tamanho do arquivo (limite de 10MB)
      const buffer = Buffer.from(fileData, 'base64');
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      
      if (buffer.length > maxSizeBytes) {
        return res.status(413).json({ 
          message: "File too large", 
          details: `Maximum file size is 10MB, received ${(buffer.length / (1024 * 1024)).toFixed(2)}MB` 
        });
      }
      
      // Geração de nome de arquivo seguro
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      const extension = fileName.split('.').pop() || 'mp3';
      const secureFileName = `podcast-${timestamp}-${randomId}.${extension}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('podcast-audio')
        .upload(secureFileName, buffer, {
          contentType,
          upsert: true
        });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('podcast-audio')
        .getPublicUrl(secureFileName);
      
      res.json({ 
        success: true, 
        url: urlData.publicUrl,
        fileName: secureFileName
      });
    } catch (error) {
      console.error("Error uploading audio:", error);
      res.status(500).json({ message: "Failed to upload audio to storage" });
    }
  });

  // Merge multiple audio chunks into a single audio file with authentication check
  app.post("/api/merge-audio-chunks", async (req, res) => {
    try {
      const { urls, podcastId } = req.body;
      
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ 
          message: "Missing or invalid 'urls' parameter. Must be a non-empty array of audio URLs." 
        });
      }
      
      if (!podcastId) {
        return res.status(400).json({ 
          message: "Missing 'podcastId' parameter. Required to link merged audio to podcast." 
        });
      }
      
      // Verificar se o usuário tem permissão para trabalhar com este podcast
      const podcast = await storage.getPodcast(podcastId);
      
      if (podcast) {
        // Verificar acesso com os mesmos critérios usados em outras rotas
        const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
          ? (req.user as any).claims?.sub 
          : null;
        
        const isDemoContent = String(podcast.userId) === 'demo-user-1';
        const isOwner = authenticatedUserId && String(podcast.userId) === String(authenticatedUserId);
        
        if (!isDemoContent && !isOwner) {
          console.log(`Acesso negado para mesclar áudio do podcast ${podcast.id}. User ID: ${authenticatedUserId}, Podcast userId: ${podcast.userId}`);
          return res.status(403).json({ 
            message: "You don't have permission to modify this podcast"
          });
        }
      } else {
        return res.status(404).json({ message: "Podcast not found" });
      }
      
      console.log(`Request to merge ${urls.length} audio chunks for podcast ${podcastId}`);
      
      // If there's only one URL, just return it without merging
      if (urls.length === 1) {
        return res.json({ mergedUrl: urls[0], totalChunks: 1 });
      }
      
      // Implementation of audio chunk merging using FFmpeg
      const mergeResult = await mergeAudioChunks(urls, podcastId);
      
      // Return success response with the URL to the merged audio
      return res.json({ 
        success: true,
        mergedUrl: mergeResult.url,
        totalChunks: mergeResult.totalChunks,
        fileSize: mergeResult.fileSize
      });
    } catch (error: any) {
      console.error("Error merging audio chunks:", error);
      console.error("Error details:", error.stack || "No stack trace available");
      res.status(500).json({ 
        message: "Failed to merge audio chunks", 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? (error.stack || "") : undefined
      });
    }
  });

  // Get available Portuguese voices
  app.get("/api/portuguese-voices", (req, res) => {
    try {
      res.json(availablePortugueseVoices);
    } catch (error: any) {
      console.error("Error fetching Portuguese voices:", error);
      res.status(500).json({ message: "Failed to fetch Portuguese voices" });
    }
  });

  // Generate audio from text using Google TTS for Portuguese with authentication log
  app.post("/api/generate-portuguese-audio", async (req, res) => {
    try {
      // Verifica se há informações de usuário autenticado para logs de segurança
      const authenticatedUserId = req.isAuthenticated && req.isAuthenticated() && req.user 
        ? (req.user as any).claims?.sub 
        : null;
      
      // Logging de segurança
      if (authenticatedUserId) {
        console.log(`Geração de áudio em português solicitada pelo usuário: ${authenticatedUserId}`);
      } else {
        console.log(`Geração de áudio em português solicitada por usuário não autenticado`);
      }
      
      console.log("Portuguese TTS Request:", JSON.stringify(req.body, null, 2));
      
      // Required parameters
      const { text, firstSpeakerVoice, secondSpeakerVoice } = req.body;
      
      // Validation
      if (!text) {
        return res.status(400).json({ message: "Text parameter is required" });
      }
      
      // Limite de texto para evitar abuso da API (50.000 caracteres)
      const MAX_TEXT_LENGTH = 50000;
      if (text.length > MAX_TEXT_LENGTH) {
        return res.status(413).json({ 
          message: "Text too long", 
          details: `Maximum text length is ${MAX_TEXT_LENGTH} characters, received ${text.length}` 
        });
      }
      
      if (!firstSpeakerVoice || !secondSpeakerVoice) {
        return res.status(400).json({ message: "Both speaker voices are required" });
      }
      
      // Check if the voices exist in our available voices
      const validVoices = availablePortugueseVoices.map(v => v.id);
      if (!validVoices.includes(firstSpeakerVoice) || !validVoices.includes(secondSpeakerVoice)) {
        return res.status(400).json({ 
          message: "Invalid voice ID", 
          validVoices
        });
      }
      
      // Process the conversation
      const result = await processPortugueseConversation(
        text,
        firstSpeakerVoice,
        secondSpeakerVoice
      );
      
      // Upload the file to Supabase storage
      console.log("Uploading Portuguese audio to Supabase...");
      const audioBuffer = fs.readFileSync(result.audioUrl);
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      
      // Atribuir ID do usuário ao arquivo, se disponível
      const userPrefix = authenticatedUserId ? `user-${authenticatedUserId.substring(0, 8)}-` : '';
      const fileName = `portuguese-podcast-${userPrefix}${timestamp}-${randomId}.mp3`;
      
      const audioUrl = await supabaseStorage.uploadMergedAudio(
        audioBuffer,
        fileName,
        'audio/mpeg'
      );
      
      // Clean up the local file
      fs.unlinkSync(result.audioUrl);
      
      // Return the result
      res.json({
        success: true,
        audioUrl,
        duration: result.duration,
        fileSize: result.size
      });
    } catch (error: any) {
      console.error("Error generating Portuguese audio:", error);
      res.status(500).json({ 
        message: "Failed to generate Portuguese audio", 
        error: error.message,
        // Não expor stack trace em produção
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
  
  // Create a new Portuguese podcast
  app.post("/api/portuguese-podcasts", async (req, res) => {
    try {
      // Check if the user is authenticated
      let userId;
      
      if (req.isAuthenticated && req.isAuthenticated() && req.user) {
        // If user is authenticated, use their ID from the session
        userId = (req.user as any).claims?.sub;
        console.log("Using authenticated user ID for Portuguese podcast:", userId);
      } else {
        // Fall back to demo user if not authenticated
        let defaultUser;
        
        try {
          console.log("User not authenticated, looking for demo user...");
          defaultUser = await storage.getUserByUsername("demo");
          
          if (!defaultUser) {
            console.log("Creating default demo user...");
            defaultUser = await storage.upsertUser({
              id: "demo-user-1",
              username: "demo"
            });
          }
          
          userId = defaultUser.id;
        } catch (userError) {
          console.error("Error with demo user:", userError);
          return res.status(500).json({ message: "Failed to ensure default user exists" });
        }
      }
      
      // Create metadata for the podcast
      const podcastData = {
        ...req.body,
        userId,
        category: req.body.category || "portuguese",
        coverImageUrl: req.body.coverImageUrl || '/src/assets/images/default_thumb_podcast.png',
        metadata: {
          ...req.body.metadata,
          language: "pt-BR"
        }
      };
      
      // Validate and create the podcast
      const result = insertPodcastSchema.safeParse(podcastData);
      
      if (!result.success) {
        console.error("Validation error:", JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ message: "Invalid podcast data", errors: result.error.format() });
      }
      
      const podcast = await storage.createPodcast(result.data);
      res.status(201).json(podcast);
    } catch (error: any) {
      console.error("Error creating Portuguese podcast:", error);
      res.status(500).json({ message: "Failed to create Portuguese podcast", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
