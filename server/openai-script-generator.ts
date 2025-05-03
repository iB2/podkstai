import { log } from './vite';
import { generateEnhancedPodcastScript } from './perplexity-service';

/**
 * Gera um roteiro de podcast baseado em um tópico usando o fluxo avançado multi-etapas
 * que combina interpretação, pesquisa, estratégia, escrita e edição
 * 
 * @param topic O tema ou assunto para o podcast
 * @returns O roteiro formatado para o podcast
 */
export async function generatePodcastScript(topic: string): Promise<string> {
  try {
    log(`Iniciando geração de roteiro avançado para o tema: ${topic}`, 'script-gen');
    
    // Usar o novo fluxo inspirado no crewAI
    const { script, title, description } = await generateEnhancedPodcastScript(topic);
    
    log(`Roteiro avançado gerado com sucesso (${script.length} caracteres)`, 'script-gen');
    log(`Título: ${title}`, 'script-gen');
    log(`Descrição: ${description}`, 'script-gen');
    
    // Formatar adequadamente o script
    const formattedScript = formatScriptResult(script);
    
    return formattedScript;
  } catch (error: any) {
    log(`Erro na geração do roteiro avançado: ${error.message}`, 'script-gen');
    console.error('Script generation error:', error);
    throw new Error(`Falha ao gerar roteiro do podcast: ${error.message}`);
  }
}

/**
 * Formata o script para garantir que esteja no formato correto
 * 
 * @param rawScript O texto bruto do script gerado
 * @returns O script formatado corretamente
 */
function formatScriptResult(rawScript: string): string {
  // Garantir que o texto esteja no formato correto
  let formattedScript = rawScript.trim();
  
  // Substituir qualquer variação de "Apresentador" pelo formato exato esperado
  formattedScript = formattedScript
    .replace(/apresentador\s*1\s*:/gi, 'Apresentador 1:')
    .replace(/apresentador\s*2\s*:/gi, 'Apresentador 2:')
    .replace(/host\s*1\s*:/gi, 'Apresentador 1:')
    .replace(/host\s*2\s*:/gi, 'Apresentador 2:')
    .replace(/locutor\s*1\s*:/gi, 'Apresentador 1:')
    .replace(/locutor\s*2\s*:/gi, 'Apresentador 2:');
  
  // Garantir que cada fala comece em uma nova linha
  formattedScript = formattedScript
    .replace(/(\bApresentador \d+:)/g, '\n$1')
    .replace(/\n\n+/g, '\n')
    .trim();
  
  return formattedScript;
}