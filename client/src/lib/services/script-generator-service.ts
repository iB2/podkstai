/**
 * Interface para a resposta da API de geração de scripts
 */
export interface GenerateScriptResponse {
  success: boolean;
  script?: string;
  title?: string;
  description?: string;
  error?: string;
  status?: GenerationStatus;
}

/**
 * Interface para o status da geração
 */
export interface GenerationStatus {
  inProgress: boolean;
  step: GenerationStep;
  progress: number;
  userId?: string;
  theme?: string;
  startTime?: string;
  elapsedTime?: number;
  message?: string;
}

/**
 * Etapas do processo de geração
 */
export type GenerationStep = 
  | "idle" 
  | "interpreting" 
  | "researching" 
  | "strategizing" 
  | "writing" 
  | "editing"
  | "complete";

/**
 * Serviço para geração de scripts de podcast usando API avançada multi-etapas
 */
export const scriptGeneratorService = {
  /**
   * Inicia o processo assíncrono de geração de roteiro
   * 
   * @param topic Tema ou assunto para o podcast
   * @returns Um objeto com o status inicial da geração
   */
  async generateScript(topic: string): Promise<GenerateScriptResponse> {
    try {
      // Verificar se o tema foi fornecido
      if (!topic || topic.trim() === '') {
        return {
          success: false,
          error: 'É necessário fornecer um tema para o podcast.'
        };
      }
      
      // Chamar a API para iniciar a geração do script
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao iniciar a geração do script');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Erro ao iniciar geração de script:', error);
      return {
        success: false,
        error: error.message || 'Falha ao iniciar geração do script. Por favor, tente novamente.'
      };
    }
  },
  
  /**
   * Verifica o status atual da geração do script
   * 
   * @returns O status atual da geração
   */
  async checkGenerationStatus(): Promise<GenerationStatus> {
    try {
      const response = await fetch('/api/script-generation/status');
      
      if (!response.ok) {
        throw new Error('Falha ao verificar status da geração');
      }
      
      const status = await response.json();
      
      // Log apenas quando o status muda para complete
      if (status.step === 'complete' && !status.inProgress) {
        console.log("[ScriptGenerator] Status completo detectado:", status);
      }
      
      return status;
    } catch (error) {
      console.error('Erro ao verificar status da geração:', error);
      return {
        inProgress: false,
        step: 'idle',
        progress: 0,
        message: 'Erro ao verificar status'
      };
    }
  },
  
  /**
   * Obtém o resultado final da geração de script
   * 
   * @returns O script completo com título e descrição
   */
  async getGenerationResult(): Promise<GenerateScriptResponse> {
    try {
      console.log("[ScriptGenerator] Solicitando resultado final da geração...");
      const response = await fetch('/api/script-generation/result');
      
      if (!response.ok) {
        // Se ainda estiver processando (202)
        if (response.status === 202) {
          const data = await response.json();
          console.log("[ScriptGenerator] A geração ainda está em andamento:", data.status);
          return {
            success: false,
            error: 'A geração ainda está em andamento',
            status: data.status
          };
        }
        
        const errorData = await response.json();
        console.error("[ScriptGenerator] Erro ao obter script:", errorData);
        throw new Error(errorData.message || 'Falha ao obter o script gerado');
      }
      
      const result = await response.json();
      console.log("[ScriptGenerator] Script gerado com sucesso:", result.title);
      return result;
    } catch (error: any) {
      console.error('[ScriptGenerator] Erro ao obter resultado da geração:', error);
      return {
        success: false,
        error: error.message || 'Falha ao obter o script gerado. Por favor, tente novamente.'
      };
    }
  }
};