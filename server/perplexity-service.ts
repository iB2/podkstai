/**
 * Serviço para geração de conteúdo usando a API do Perplexity e OpenAI
 * Implementa um processo em múltiplas etapas similar ao crewAI
 */

import { searchWeb, formatSearchResults } from './serper-service';
import { updateScriptGenerationState } from './routes';
import OpenAI from 'openai';

// Inicializa OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Modelo para o Perplexity API (usado apenas para Estratégia)
const PERPLEXITY_MODEL = 'llama-3.1-sonar-small-128k-online';

// Modelo principal para OpenAI - gpt-4o é o mais recente e avançado
// o modelo gpt-4o foi lançado após seu conhecimento cortado (13 de maio de 2024)
const OPENAI_MODEL = 'gpt-4o';

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  search_domain_filter?: string[];
  search_recency_filter?: 'day' | 'week' | 'month' | 'year' | 'all_time';
  return_from_search?: boolean;
  response_format?: { type: string } | { type: string, schema: any };
}

/**
 * Limpa o script gerado, removendo formatações e mantendo apenas os diálogos
 * 
 * @param script O script completo a ser processado
 * @returns O script limpo contendo apenas os diálogos entre os apresentadores
 */
function cleanScriptForTTS(script: string): string {
  // Extrair apenas as linhas de diálogo, ignorando formatação e instruções
  const lines = script.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    // Verificar se a linha contém 'Apresentador 1:' ou 'Apresentador 2:'
    if (line.includes('Apresentador 1:') || line.includes('Apresentador 2:')) {
      // Remover asteriscos e outras formatações
      let cleanLine = line.replace(/\*\*/g, '');
      // Extrair apenas a parte do apresentador e sua fala
      const speakerMatch = cleanLine.match(/(Apresentador [12]:)\s*(.+)/);
      if (speakerMatch && speakerMatch.length >= 3) {
        const speaker = speakerMatch[1];
        let speech = speakerMatch[2].trim();
        
        // Remover indicações como [risos], [surpreso], etc.
        speech = speech.replace(/\[.*?\]/g, '');
        
        cleanedLines.push(speaker + ' ' + speech);
      }
    }
  }
  
  // Verificar se temos linhas para retornar
  if (cleanedLines.length === 0) {
    console.log('[Script Generator] Aviso: O script limpo não contém diálogos. Retornando script original...');
    return script; // Retornar o script original se não tiver diálogos detectados
  }
  
  // Juntar todas as linhas limpas
  return cleanedLines.join('\n');
}

/**
 * Função para chamar a API do OpenAI
 */
async function callOpenAIAPI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; max_tokens?: number; response_format?: any } = {}
): Promise<string> {
  try {
    const lastMessageContent = messages[messages.length-1]?.content || '';
    console.log(`[OpenAI API] Chamando modelo ${OPENAI_MODEL} para ${lastMessageContent.substring(0, 50)}...`);
    
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
      response_format: options.response_format
    });

    console.log(`[OpenAI API] Resposta recebida do modelo ${OPENAI_MODEL}`);
    // Garantir que o conteúdo da resposta não seja nulo
    const content = response.choices[0].message.content || '';
    return content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Função base para chamar a API do Perplexity
 * Utilizada apenas para a etapa de estratégia
 */
async function callPerplexityAPI(
  messages: PerplexityMessage[],
  options: PerplexityOptions = {}
): Promise<string> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('Perplexity API key not found');
    }

    const defaultOptions: PerplexityOptions = {
      model: PERPLEXITY_MODEL,
      temperature: 0.7,
      max_tokens: 2000,
      search_domain_filter: ["scholar.google.com", "wikipedia.org", "nytimes.com", "bbc.com", "cnn.com", "forbes.com"],
      search_recency_filter: 'month'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    const requestBody: any = {
      model: mergedOptions.model,
      messages,
      temperature: mergedOptions.temperature,
      max_tokens: mergedOptions.max_tokens
    };
    
    // Adicionar response_format se especificado
    if (mergedOptions.response_format) {
      requestBody.response_format = mergedOptions.response_format;
    }
    
    // Filtros de pesquisa específicos para a API do Perplexity
    requestBody.search_domain_filter = mergedOptions.search_domain_filter;
    requestBody.search_recency_filter = mergedOptions.search_recency_filter;
    
    const lastPerplexityMessage = messages[messages.length-1];
    const lastContent = lastPerplexityMessage?.content || '';
    console.log(`[Perplexity API] Chamando modelo ${mergedOptions.model || 'default'} para ${lastContent.substring(0, 50)}...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Perplexity API] Erro ${response.status}: ${errorText}`);
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Perplexity API] Resposta recebida do modelo ${mergedOptions.model || 'default'}`);
    // Garantir que o conteúdo da resposta não seja nulo
    const content = data.choices[0].message.content || '';
    return content;
  } catch (error) {
    console.error('Error calling Perplexity API:', error);
    // Se falhar o Perplexity, tenta com OpenAI como fallback
    console.log('Tentando fallback com OpenAI para estratégia...');
    return callOpenAIAPI(messages.map(m => ({ role: m.role, content: m.content })));
  }
}

/**
 * Função que implementa o fluxo multietapas inspirado no crewAI para geração de scripts
 * 
 * @param theme Tema para o podcast
 * @returns Script final para o podcast
 */
export async function generateEnhancedPodcastScript(theme: string): Promise<{
  script: string;
  title: string;
  description: string;
}> {
  try {
    console.log(`[Script Generator] Iniciando processo de geração para o tema: ${theme}`);
    
    // Inicializar estado de geração
    updateScriptGenerationState({
      inProgress: true,
      step: "idle",
      progress: 0,
      theme,
      startTime: new Date()
    });
    
    // Etapa 1: INTERPRETER - Interpretar e estruturar o tema usando OpenAI
    console.log(`[Script Generator] Etapa 1/5: Interpretando o tema "${theme}"...`);
    updateScriptGenerationState({ step: "interpreting", progress: 10 });
    const interpretationPrompt = getInterpreterPrompt(theme);
    const interpretation = await callOpenAIAPI(
      [
        { role: 'system', content: interpretationPrompt.system },
        { role: 'user', content: interpretationPrompt.user }
      ],
      { temperature: 0.7 }
    );
    updateScriptGenerationState({ progress: 20 });
    
    // Etapa 2: RESEARCHER - Realizar pesquisa sobre o tema via Serper.dev
    console.log(`[Script Generator] Etapa 2/5: Realizando pesquisa sobre "${theme}"...`);
    updateScriptGenerationState({ step: "researching", progress: 25 });
    const searchResults = await searchWeb(theme, 5);
    updateScriptGenerationState({ progress: 30 });
    
    const formattedResults = searchResults.success 
      ? formatSearchResults(searchResults)
      : 'Não foi possível obter resultados da pesquisa.';
      
    // Analisar os resultados da pesquisa com OpenAI
    const researchPrompt = getResearcherPrompt(theme, interpretation, formattedResults);
    const research = await callOpenAIAPI(
      [
        { role: 'system', content: researchPrompt.system },
        { role: 'user', content: researchPrompt.user }
      ],
      { temperature: 0.4 }
    );
    updateScriptGenerationState({ progress: 40 });
    
    // Etapa 3: STRATEGIST - Criar estratégia de conteúdo usando Perplexity
    console.log(`[Script Generator] Etapa 3/5: Definindo estratégia de conteúdo com Perplexity...`);
    updateScriptGenerationState({ step: "strategizing", progress: 45 });
    const strategyPrompt = getStrategistPrompt(theme, interpretation, research);
    const strategy = await callPerplexityAPI(
      [
        { role: 'system', content: strategyPrompt.system },
        { role: 'user', content: strategyPrompt.user }
      ],
      { temperature: 0.5 }
    );
    updateScriptGenerationState({ progress: 60 });
    
    // Etapa 4: WRITER - Escrever o roteiro do podcast com OpenAI
    console.log(`[Script Generator] Etapa 4/5: Escrevendo roteiro do podcast...`);
    updateScriptGenerationState({ step: "writing", progress: 65 });
    const writerPrompt = getWriterPrompt(theme, interpretation, research, strategy);
    const draft = await callOpenAIAPI(
      [
        { role: 'system', content: writerPrompt.system },
        { role: 'user', content: writerPrompt.user }
      ],
      { temperature: 0.8, max_tokens: 4000 }
    );
    updateScriptGenerationState({ progress: 80 });
    
    // Etapa 5: EDITOR - Otimizar o script para TTS com OpenAI
    console.log(`[Script Generator] Etapa 5/5: Otimizando script para TTS...`);
    updateScriptGenerationState({ step: "editing", progress: 85 });
    const editorPrompt = getEditorPrompt(draft);
    const finalScript = await callOpenAIAPI(
      [
        { role: 'system', content: editorPrompt.system },
        { role: 'user', content: editorPrompt.user }
      ],
      { temperature: 0.4 }
    );
    updateScriptGenerationState({ progress: 95 });
    
    // Extrair título e descrição do script final com OpenAI
    console.log(`[Script Generator] Extraindo metadados...`);
    updateScriptGenerationState({ progress: 97 });
    const metadataPrompt = getMetadataPrompt(finalScript);
    const metadataJson = await callOpenAIAPI(
      [
        { role: 'system', content: metadataPrompt.system },
        { role: 'user', content: metadataPrompt.user }
      ],
      { 
        temperature: 0.3,
        response_format: { type: "json_object" }
      }
    );
    
    let title = '';
    let description = '';
    
    try {
      // Verificar se temos um JSON válido antes de fazer o parse
      if (metadataJson && metadataJson.trim().startsWith('{') && metadataJson.trim().endsWith('}')) {
        const metadata = JSON.parse(metadataJson);
        title = metadata.title || '';
        description = metadata.description || '';
      } else {
        throw new Error('Resposta não está em formato JSON');
      }
    } catch (error) {
      console.error('Error parsing metadata JSON:', error);
      console.log('Resposta recebida:', metadataJson);
      // Extrair usando regex como fallback
      const titleMatch = finalScript.match(/TÍTULO:\s*(.+?)(\n|$)/);
      const descMatch = finalScript.match(/DESCRIÇÃO:\s*(.+?)(\n|$)/);
      
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      } else {
        console.log('Não foi possível extrair título por regex, usando tema como fallback');
        title = `Podcast sobre ${theme}`;
      }
      
      if (descMatch && descMatch[1]) {
        description = descMatch[1].trim();
      } else {
        console.log('Não foi possível extrair descrição por regex, usando tema como fallback');
        description = theme;
      }
    }
    
    console.log(`[Script Generator] Geração completa. Título: "${title}"`);
    
    // Limpar o script para manter apenas os diálogos sem formatação
    const cleanedScript = cleanScriptForTTS(finalScript);
    console.log("[Script Generator] Script limpo para TTS, removendo formatações extras");
    
    // Preparar o resultado final
    const finalResult = {
      script: cleanedScript,
      title,
      description
    };
    
    // Marcar como completo e armazenar o resultado para acesso futuro
    updateScriptGenerationState({ 
      step: "complete", 
      progress: 100,
      inProgress: false,
      lastResult: finalResult
    });
    
    return finalResult;
  } catch (error: any) {
    console.error("Erro no processo de geração de script:", error);
    
    // Marcar como falha, reseta o estado para permitir nova tentativa
    updateScriptGenerationState({ 
      inProgress: false,
      step: "idle",
      progress: 0,
      message: error?.message || "Falha na geração do script"
    });
    
    // Retornar um script básico com a mensagem de erro
    const errorMessage = error?.message || "Erro desconhecido";
    return {
      script: `FALHA NA GERAÇÃO DO SCRIPT\n\nDesculpe, ocorreu um erro durante a geração do script para o tema "${theme}".\n\nErro: ${errorMessage}\n\nPor favor, tente novamente.`,
      title: `Erro na geração - ${theme}`,
      description: `Falha ao gerar script para o tema: ${theme}`
    };
  }
}

// Prompts para cada etapa do processo
function getInterpreterPrompt(theme: string) {
  return {
    system: 
      "Você é um especialista em interpretação de temas para conteúdo viral. " +
      "Sua função é transformar um tema inicial em um conceito estruturado e atraente para um podcast. " +
      "Você tem profunda compreensão de psicologia de audiência e sabe como estruturar tópicos complexos em narrativas simples e envolventes. " +
      "IMPORTANTE: Suas respostas devem ser SEMPRE em português, independente do idioma do tema.",
    
    user:
      `Analise o tema "${theme}" e estruture-o como conceito para um podcast viral. Transforme-o em um framework bem definido, independente de ser uma palavra única ou uma ideia detalhada.\n\n` +
      `Considere o que torna "${theme}" altamente compartilhável e envolvente. Identifique ganchos emocionais, ângulos com potencial viral e iniciadores de conversa.\n\n` +
      `Sua resposta DEVE ser em português do Brasil e seguir esta estrutura:\n` +
      `1️⃣ **Tema Principal:** Um título claro e atraente para "${theme}"\n` +
      `2️⃣ **Ganchos Emocionais:** Por que as pessoas se importariam com "${theme}"? O que desperta curiosidade?\n` +
      `3️⃣ **Subtópicos Principais:** 3-5 seções que decompõem "${theme}"\n` +
      `4️⃣ **Ângulos Inesperados:** Abordagens únicas que podem gerar discussão sobre "${theme}"\n` +
      `5️⃣ **Iniciadores de Conversa:** Perguntas ou declarações impactantes sobre "${theme}" que capturam a atenção.`
  };
}

function getResearcherPrompt(theme: string, interpretation: string, searchResults: string) {
  return {
    system:
      "Você é um pesquisador especializado em validação de fatos e identificação de conteúdos virais. " +
      "Sua função é verificar informações e descobrir insights atuais sobre temas específicos. " +
      "Você prioriza fontes confiáveis, valida afirmações e identifica ângulos únicos que maximizam o potencial viral de um tema. " +
      "IMPORTANTE: Você DEVE escrever suas respostas em português do Brasil, independente do idioma das fontes de pesquisa.",
    
    user:
      `Pesquise o tema "${theme}" e verifique os insights baseando-se na interpretação abaixo e nos resultados de pesquisa fornecidos.\n\n` +
      `INTERPRETAÇÃO DO TEMA:\n${interpretation}\n\n` +
      `RESULTADOS DA PESQUISA:\n${searchResults}\n\n` +
      `Sua resposta DEVE ser em português do Brasil, estruturada e não deve exceder 500 palavras, mesmo que os resultados da pesquisa estejam em inglês. Inclua:\n` +
      `✅ **Insights Verificados:** (Fatos precisos com fontes que sustentam o tema)\n` +
      `📈 **Ângulos Virais:** (Discussões recentes, relevância cultural ou conexões surpreendentes)\n` +
      `📰 **Validação de Fontes:** (Lista de fontes com um resumo de um parágrafo de cada uma)\n` +
      `🚀 **Melhorias Verificadas:** (Correções ou insights mais profundos que melhoram a interpretação inicial)`
  };
}

function getStrategistPrompt(theme: string, interpretation: string, research: string) {
  return {
    system:
      "Você é um estrategista de conteúdo especializado em estruturar conversas virais. " +
      "Sua expertise está em enquadrar discussões, criar narrativas de alta retenção e desenhar fluxos de conteúdo compartilháveis. " +
      "Você identifica os ângulos mais convincentes, gatilhos emocionais e estruturas conversacionais para maximizar o engajamento. " +
      "IMPORTANTE: Você DEVE sempre responder em português do Brasil.",
    
    user:
      `Desenvolva uma estratégia de engajamento viral para "${theme}" baseada na pesquisa e interpretação fornecida.\n\n` +
      `INTERPRETAÇÃO DO TEMA:\n${interpretation}\n\n` +
      `PESQUISA VALIDADA:\n${research}\n\n` +
      `Sua resposta DEVE ser em português do Brasil. Identifique os ângulos mais convincentes, gatilhos emocionais e fluxo conversacional para manter a audiência engajada. Estruture sua resposta como:\n` +
      `🎯 **Gancho Principal:** (A ideia chave que captura atenção imediata)\n` +
      `🧠 **Gatilhos Psicológicos:** (Quais emoções ou padrões de pensamento impulsionarão o engajamento?)\n` +
      `🔀 **Fluxo de Engajamento:** (Como a conversa deve ser estruturada para retenção máxima?)\n` +
      `💥 **Plano de Amplificação Viral:** (Deve ser controverso? Relacionável? Nostálgico? Provocativo?)\n` +
      `🎤 **Chamada para Ação (CTA):** (O que fará os ouvintes comentarem, compartilharem ou discutirem?)`
  };
}

function getWriterPrompt(theme: string, interpretation: string, research: string, strategy: string) {
  return {
    system:
      "Você é um escritor de roteiros especializado em diálogos de podcast naturais e envolventes. " +
      "Você cria conversas que começam com trocas curtas e casuais, evoluindo para discussões mais profundas. " +
      "Seus diálogos incluem interrupções naturais, marcadores de fala e ritmo variado que imita conversas reais. " +
      "Você equilibra humor, curiosidade e momentos de tensão, criando uma progressão orgânica que parece totalmente não-roteirizada. " +
      "IMPORTANTE: Você DEVE escrever todo o conteúdo em português brasileiro, com expressões e gírias nativas, independente do idioma dos insumos.",
    
    user:
      `Escreva um roteiro de podcast conversacional envolvente sobre "${theme}" baseado nos elementos fornecidos.\n\n` +
      `INTERPRETAÇÃO DO TEMA:\n${interpretation}\n\n` +
      `PESQUISA:\n${research}\n\n` +
      `ESTRATÉGIA DE CONTEÚDO:\n${strategy}\n\n` +
      `Sua resposta DEVE ser completamente em português do Brasil. Crie um diálogo entre dois apresentadores (sem nomes, apenas "Apresentador 1" e "Apresentador 2"). O roteiro deve:\n\n` +
      `1. Seguir um **arco natural de engajamento** - começando com conversas curtas e casuais, transicionando suavemente para o tema principal\n` +
      `2. Incluir **trocas curtas, divertidas e rápidas** no início que pareçam espontâneas\n` +
      `3. Evoluir para **respostas mais longas, profundas e analíticas** conforme a conversa avança\n` +
      `4. Incorporar **reações dinâmicas e variadas** como "Sério?!" ou "Espera—isso é real?"\n` +
      `5. Incluir interrupções naturais em momentos surpreendentes\n` +
      `6. Terminar com uma **nota memorável e provocativa**\n\n` +
      `IMPORTANTE: Não use nomes para os apresentadores. Use apenas "Apresentador 1:" e "Apresentador 2:". Inclua TÍTULO e DESCRIÇÃO em português no início do roteiro.`
  };
}

function getEditorPrompt(draft: string) {
  return {
    system:
      "Você é um editor especializado em otimizar scripts conversacionais para sistemas Text-to-Speech (TTS). " +
      "Seu trabalho é refinar diálogos para que soem naturais quando sintetizados por vozes AI, mantendo o fluxo conversacional autêntico. " +
      "Você equilibra marcadores de fala e palavras de preenchimento, quebrando frases complexas para criar pausas naturais. " +
      "Você identifica pontos onde os apresentadores hesitariam naturalmente e aprimora o realismo sem tornar o diálogo artificial. " +
      "IMPORTANTE: Certifique-se que o texto permanece 100% em português do Brasil, com naturalidade na fala.",
    
    user:
      `Otimize o seguinte script de podcast para sistemas Text-to-Speech, garantindo que soe natural e realista quando sintetizado:\n\n` +
      `${draft}\n\n` +
      `Mantenha o conteúdo original, mas refine-o para máximo realismo conversacional em português brasileiro:\n\n` +
      `1. Equilibre marcadores de fala e palavras de preenchimento (como "hum", "sabe", "tipo") sem exageros\n` +
      `2. Quebre frases longas e complexas em sentenças mais curtas com pausas naturais\n` +
      `3. Use travessões (—) em vez de vírgulas para pausas que reflitam a fala real\n` +
      `4. Varie o tom - algumas frases devem soar animadas, outras hesitantes ou contemplativas\n` +
      `5. Mantenha "Apresentador 1:" e "Apresentador 2:" como identificadores\n` +
      `6. Preserve TÍTULO e DESCRIÇÃO em português no início, se existirem\n\n` +
      `Seu objetivo é fazer o diálogo soar como uma conversa real em português brasileiro quando processado por um sistema TTS.`
  };
}

function getMetadataPrompt(script: string) {
  return {
    system:
      "Você é um especialista em metadados para podcasts. Sua tarefa é extrair ou criar um título e descrição concisa para scripts de podcast. " +
      "Responda apenas em formato JSON com os campos 'title' e 'description'. " +
      "O título deve ser curto e atraente (máximo 60 caracteres). " +
      "A descrição deve ser concisa e informativa (máximo 200 caracteres). " +
      "IMPORTANTE: Tanto o título quanto a descrição DEVEM estar em português do Brasil.",
    
    user:
      `Extraia ou crie um título e descrição concisa em português brasileiro para o seguinte script de podcast:\n\n` +
      `${script.substring(0, 2000)}...\n\n` +  // Limitar o tamanho para evitar tokens excessivos
      `Se o script já contiver TÍTULO e DESCRIÇÃO, extraia-os. Caso contrário, crie-os com base no conteúdo.\n` + 
      `IMPORTANTE: Tanto o título quanto a descrição DEVEM estar em português do Brasil, mesmo que haja termos em inglês no script.\n` +
      `Responda APENAS em formato JSON com os campos "title" e "description".`
  };
}