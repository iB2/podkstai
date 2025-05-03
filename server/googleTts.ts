import fs from 'fs';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { log } from './vite';
import axios from 'axios';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const execPromise = util.promisify(exec);
const writeFilePromise = util.promisify(fs.writeFile);

// Google Cloud credentials as a JSON string in environment variable
const CREDENTIALS_STRING = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

interface GoogleTtsOptions {
  text: string;
  voiceName: string;
  outputFormat?: 'MP3' | 'LINEAR16';
}

// Função para dividir o texto em partes menores
function splitTextIntoChunks(text: string, maxChunkLength = 1000): string[] {
  if (text.length <= maxChunkLength) return [text];
  
  const chunks: string[] = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    // Encontrar um ponto para cortar o texto (no máximo maxChunkLength caracteres)
    let cutPoint = maxChunkLength;
    if (remainingText.length > maxChunkLength) {
      // Tentar cortar em pontuações para manter a naturalidade
      const punctuationMarks = ['.', '!', '?', ';', ':', ','];
      
      // Procurar a pontuação mais próxima do limite máximo
      for (const mark of punctuationMarks) {
        const lastIndex = remainingText.lastIndexOf(mark, maxChunkLength);
        if (lastIndex > 0 && lastIndex > cutPoint - 200) { // Pelo menos 200 caracteres antes do limite
          cutPoint = lastIndex + 1; // Incluir a pontuação
          break;
        }
      }
    } else {
      cutPoint = remainingText.length;
    }
    
    chunks.push(remainingText.substring(0, cutPoint));
    remainingText = remainingText.substring(cutPoint).trim();
  }
  
  return chunks;
}

export async function generateAudioWithGoogleTts(options: GoogleTtsOptions): Promise<Buffer> {
  try {
    log(`Generating audio with Google TTS for voice: ${options.voiceName}`, 'google-tts');
    
    // Verificar se o texto é muito longo e dividir em partes se necessário
    const MAX_CHUNK_LENGTH = 1000; // Máximo de caracteres por chamada
    const textChunks = splitTextIntoChunks(options.text, MAX_CHUNK_LENGTH);
    
    if (textChunks.length > 1) {
      log(`Texto dividido em ${textChunks.length} partes para processamento`, 'google-tts');
    }
    
    // Parse credentials from environment variable
    let credentials;
    try {
      credentials = JSON.parse(CREDENTIALS_STRING);
      log('Successfully parsed Google Cloud credentials from environment variable', 'google-tts');
    } catch (err: any) {
      log('Error parsing credentials JSON: ' + err.message, 'google-tts');
      throw new Error('Invalid Google Cloud credentials format');
    }
    
    // Get access token for Google API using JWT
    log('Getting access token using parsed credentials', 'google-tts');
    
    // Use JWT auth to get an access token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // Token valid for 1 hour
    
    const jwtHeader = {
      alg: 'RS256', 
      typ: 'JWT',
      kid: credentials.private_key_id
    };
    
    const jwtClaimSet = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUrl,
      exp: expiry,
      iat: now
    };
    
    // Use node's crypto module to sign JWT
    // crypto is imported at the top of the file
    
    // Encode header and claim set
    const encodeBase64Url = (obj: any) => {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };
    
    const header = encodeBase64Url(jwtHeader);
    const claimSet = encodeBase64Url(jwtClaimSet);
    const toSign = `${header}.${claimSet}`;
    
    // Sign the JWT
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(toSign);
    sign.end();
    const signature = sign.sign(credentials.private_key, 'base64');
    
    // Create the full JWT
    const signatureEncoded = signature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const jwt = `${toSign}.${signatureEncoded}`;
    
    // Exchange JWT for access token
    const tokenResponse = await axios.post(tokenUrl, {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    // Se o texto foi dividido em partes, processar cada parte e juntar os resultados
    if (textChunks.length > 1) {
      // Processar cada parte do texto separadamente
      const audioBuffers: Buffer[] = [];
      
      for (let i = 0; i < textChunks.length; i++) {
        log(`Processando parte ${i+1}/${textChunks.length} do texto`, 'google-tts');
        
        // Configurar requisição para este chunk
        const apiUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
        const requestBody = {
          input: {
            text: textChunks[i]
          },
          voice: {
            languageCode: "pt-BR",
            name: options.voiceName
          },
          audioConfig: {
            audioEncoding: 'MP3' // Sempre usar MP3 para consistência
          }
        };
        
        try {
          const response = await axios.post(apiUrl, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (!response.data.audioContent) {
            throw new Error(`Parte ${i+1}: Nenhum conteúdo de áudio recebido`);
          }
          
          // Decodificar conteúdo de áudio
          const chunkBuffer = Buffer.from(response.data.audioContent, 'base64');
          audioBuffers.push(chunkBuffer);
          
          // Esperar um pouco entre as requisições para evitar rate limiting
          if (i < textChunks.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (chunkError: any) {
          log(`Erro ao processar parte ${i+1}: ${chunkError.message}`, 'google-tts');
          throw new Error(`Falha ao processar parte ${i+1} do texto: ${chunkError.message}`);
        }
      }
      
      // Combinar todos os chunks em um único arquivo MP3
      log(`Combinando ${audioBuffers.length} partes de áudio...`, 'google-tts');
      
      // Salvar cada buffer como um arquivo temporário
      const tempFiles: string[] = [];
      for (let i = 0; i < audioBuffers.length; i++) {
        const tempPath = path.join(process.cwd(), `temp-chunk-${i}.mp3`);
        await writeFilePromise(tempPath, audioBuffers[i]);
        tempFiles.push(tempPath);
      }
      
      // Criar um arquivo de lista para o ffmpeg
      const fileListPath = path.join(process.cwd(), 'chunk-list.txt');
      const fileListContent = tempFiles.map(f => `file '${f}'`).join('\n');
      await writeFilePromise(fileListPath, fileListContent);
      
      // Combinar usando ffmpeg
      const combinedPath = path.join(process.cwd(), 'temp-combined.mp3');
      await execPromise(`ffmpeg -f concat -safe 0 -i ${fileListPath} -c copy ${combinedPath}`);
      
      // Ler o arquivo combinado
      const combinedBuffer = fs.readFileSync(combinedPath);
      
      // Limpar arquivos temporários
      tempFiles.forEach(file => fs.unlinkSync(file));
      fs.unlinkSync(fileListPath);
      fs.unlinkSync(combinedPath);
      
      return combinedBuffer;
    } else {
      // Processar texto único normalmente
      const apiUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
      const requestBody = {
        input: {
          text: options.text
        },
        voice: {
          languageCode: "pt-BR",
          name: options.voiceName
        },
        audioConfig: {
          audioEncoding: 'MP3' // Usar diretamente MP3 em vez de LINEAR16 para evitar conversão
        }
      };
      
      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.data.audioContent) {
        throw new Error('Nenhum conteúdo de áudio recebido da API do Google');
      }
      
      // Decodificar diretamente como MP3
      const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
      return audioBuffer;
    }
  } catch (error: any) {
    log(`Error generating audio with Google TTS: ${error.message}`, 'google-tts');
    console.error('Google TTS Error Details:', error);
    throw new Error(`Failed to generate audio: ${error.message}`);
  }
}

export const availablePortugueseVoices = [
  // Vozes femininas
  { id: 'pt-BR-Chirp3-HD-Aoede', name: 'Aoede (Feminina)', gender: 'female' },
  { id: 'pt-BR-Chirp3-HD-Kore', name: 'Kore (Feminina)', gender: 'female' },
  { id: 'pt-BR-Chirp3-HD-Leda', name: 'Leda (Feminina)', gender: 'female' },
  { id: 'pt-BR-Chirp3-HD-Zephyr', name: 'Zephyr (Feminina)', gender: 'female' },
  { id: 'pt-BR-Chirp3-HD-Erinome', name: 'Erinome (Feminina)', gender: 'female' },
  { id: 'pt-BR-Chirp3-HD-Vindemiatrix', name: 'Vindemiatrix (Feminina)', gender: 'female' },
  
  // Vozes masculinas
  { id: 'pt-BR-Chirp3-HD-Charon', name: 'Charon (Masculina)', gender: 'male' },
  { id: 'pt-BR-Chirp3-HD-Fenrir', name: 'Fenrir (Masculina)', gender: 'male' },
  { id: 'pt-BR-Chirp3-HD-Orus', name: 'Orus (Masculina)', gender: 'male' },
  { id: 'pt-BR-Chirp3-HD-Puck', name: 'Puck (Masculina)', gender: 'male' },
  { id: 'pt-BR-Chirp3-HD-Iapetus', name: 'Iapetus (Masculina)', gender: 'male' },
  { id: 'pt-BR-Chirp3-HD-Umbriel', name: 'Umbriel (Masculina)', gender: 'male' }
];

// Função para dividir texto longo de uma fala em partes menores
function splitSpeakerText(text: string, maxLength = 500): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let remainingText = text;
  
  while (remainingText.length > 0) {
    let cutPoint = Math.min(maxLength, remainingText.length);
    
    if (remainingText.length > maxLength) {
      // Tentar cortar em pontuações para manter a naturalidade
      const punctuationMarks = ['.', '!', '?', ';', ':', ','];
      
      for (const mark of punctuationMarks) {
        const lastIndex = remainingText.lastIndexOf(mark, maxLength);
        if (lastIndex > 0 && lastIndex > cutPoint - 200) { // Pelo menos 200 caracteres antes do limite
          cutPoint = lastIndex + 1; // Incluir a pontuação
          break;
        }
      }
    }
    
    chunks.push(remainingText.substring(0, cutPoint).trim());
    remainingText = remainingText.substring(cutPoint).trim();
  }
  
  return chunks;
}

// Process a conversation between two speakers
export async function processPortugueseConversation(
  conversation: string,
  firstSpeaker: string,
  secondSpeaker: string
): Promise<{ audioUrl: string, duration: number, size: number, tempFiles: string[] }> {
  try {
    log(`Processando conversa em português. Voz primária: ${firstSpeaker}, Voz secundária: ${secondSpeaker}`, 'google-tts');
    
    // Split conversation by lines
    const lines = conversation.split('\n').filter(line => line.trim() !== '');
    
    // Identify speakers and their lines
    const speakerMap: Record<string, string> = {};
    let processedLines: { text: string; speaker: string }[] = [];
    
    for (const line of lines) {
      // Check if line starts with a speaker name followed by colon
      const match = line.match(/^([^:]+):\s*(.+)$/);
      
      if (match) {
        const [, speaker, text] = match;
        if (!speakerMap[speaker]) {
          // Assign voice based on order of appearance
          speakerMap[speaker] = Object.keys(speakerMap).length === 0 ? firstSpeaker : secondSpeaker;
        }
        
        processedLines.push({ text: text.trim(), speaker: speakerMap[speaker] });
      } else {
        // If no speaker is identified, continue previous speaker's text
        if (processedLines.length > 0) {
          processedLines[processedLines.length - 1].text += ' ' + line.trim();
        } else {
          // If this is the first line without a speaker, assume it's the first speaker
          processedLines.push({ text: line.trim(), speaker: firstSpeaker });
        }
      }
    }
    
    // Dividir falas longas em chunks menores, preservando o falante
    let expandedLines: { text: string; speaker: string }[] = [];
    const MAX_TEXT_LENGTH = 400; // Tamanho máximo para cada pedaço de fala
    
    for (const line of processedLines) {
      // Verificar se a linha precisa ser dividida
      if (line.text.length > MAX_TEXT_LENGTH) {
        const chunks = splitSpeakerText(line.text, MAX_TEXT_LENGTH);
        log(`Dividindo fala longa em ${chunks.length} partes`, 'google-tts');
        
        // Adicionar cada chunk como uma linha separada, mantendo o mesmo falante
        chunks.forEach(chunk => {
          expandedLines.push({ text: chunk, speaker: line.speaker });
        });
      } else {
        expandedLines.push(line);
      }
    }
    
    log(`Conversa processada: ${expandedLines.length} segmentos de áudio serão gerados`, 'google-tts');
    
    // Generate audio for each speaker's lines
    const audioResults = [];
    
    // Processar sequencialmente cada linha de diálogo para evitar sobrecarregar a API
    for (let i = 0; i < expandedLines.length; i++) {
      const { text, speaker } = expandedLines[i];
      
      // Log para acompanhamento do progresso
      log(`Gerando áudio para segmento ${i+1}/${expandedLines.length} (${speaker})`, 'google-tts');
      
      try {
        // Verificar se já há pausas explícitas no texto
        let textWithPause = text;
        if (i < expandedLines.length - 1 && !text.endsWith('.') && !text.endsWith('!') && !text.endsWith('?')) {
          textWithPause = `${text}.`;
        }
        
        // Remover qualquer tag SSML que possa existir, como [pause medium]
        const cleanText = textWithPause.replace(/\[pause.*?\]/gi, '');
        
        // Generate audio for this line
        const audioBuffer = await generateAudioWithGoogleTts({
          text: cleanText,
          voiceName: speaker,
          outputFormat: 'MP3'
        });
        
        audioResults.push({
          buffer: audioBuffer,
          index: i
        });
        
        // Pequena pausa entre chamadas para evitar rate limiting
        if (i < expandedLines.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (lineError: any) {
        log(`Erro ao gerar áudio para segmento ${i+1}: ${lineError.message}`, 'google-tts');
        // Continue with other lines even if one fails
      }
    }
    
    if (audioResults.length === 0) {
      throw new Error("Nenhum segmento de áudio foi gerado com sucesso");
    }
    
    log(`${audioResults.length} segmentos de áudio gerados com sucesso`, 'google-tts');
    
    // Ordenar os resultados pelo índice original
    audioResults.sort((a, b) => a.index - b.index);
    
    // Merge the audio segments using ffmpeg
    // For simplicity, we'll save each segment to disk temporarily
    const tempFiles = [];
    
    for (let i = 0; i < audioResults.length; i++) {
      const tempFilePath = path.join(process.cwd(), `temp-segment-${i}.mp3`);
      await writeFilePromise(tempFilePath, audioResults[i].buffer);
      tempFiles.push(tempFilePath);
    }
    
    // Create a file listing all segments for ffmpeg
    const fileListPath = path.join(process.cwd(), 'file-list.txt');
    const fileListContent = tempFiles.map(f => `file '${f}'`).join('\n');
    await writeFilePromise(fileListPath, fileListContent);
    
    // Merge using ffmpeg
    const outputPath = path.join(process.cwd(), `portuguese-podcast-${Date.now()}.mp3`);
    log(`Combinando ${tempFiles.length} arquivos de áudio em ${outputPath}`, 'google-tts');
    
    await execPromise(`ffmpeg -f concat -safe 0 -i ${fileListPath} -c copy ${outputPath}`);
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSize = stats.size;
    
    // Get audio duration using ffprobe
    const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${outputPath}`);
    const duration = parseFloat(stdout.trim());
    
    log(`Podcast gerado com sucesso: ${duration.toFixed(2)}s, ${(fileSize/1024/1024).toFixed(2)}MB`, 'google-tts');
    
    // Limpar o arquivo de lista, mas manter os arquivos temporários para upload posterior
    fs.unlinkSync(fileListPath);
    
    // Return the path to the merged file, its duration, size, and temp files
    return {
      audioUrl: outputPath,
      duration,
      size: fileSize,
      tempFiles: [...tempFiles] // Incluir arquivos temporários para upload posterior
    };
  } catch (error: any) {
    log(`Error processing Portuguese conversation: ${error.message}`, 'google-tts');
    console.error('Processing Error Details:', error);
    throw new Error(`Failed to process conversation: ${error.message}`);
  }
}