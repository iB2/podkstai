/**
 * Serviço para realizar buscas na web usando a API do Serper.dev
 * Permite obter informações atualizadas sobre o tema do podcast
 */

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  source?: string;
}

interface SerperResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
  };
  organic: SerperSearchResult[];
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
  };
  answerBox?: {
    title?: string;
    answer?: string;
  };
  relatedSearches?: string[];
  peopleAlsoAsk?: {
    question: string;
    answer: string;
  }[];
}

/**
 * Realiza uma busca na web usando a API do Serper.dev
 * 
 * @param query A consulta de busca
 * @param numResults Número de resultados a retornar (máximo 10)
 * @returns Resultados formatados da busca
 */
export async function searchWeb(query: string, numResults: number = 5): Promise<{
  success: boolean;
  results?: SerperSearchResult[];
  knowledgeGraph?: any;
  answerBox?: any;
  error?: string;
}> {
  try {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('Serper API key not found');
    }

    // Limitando o número de resultados para controlar os custos
    const safeNumResults = Math.min(numResults, 10);
    
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `${query} ${/^[a-zA-Z\s]*$/.test(query) ? '' : 'in english'}`.trim(), // Se não for já em inglês, adiciona "in english"
        gl: 'us', // Região EUA para resultados mais amplos
        hl: 'en', // Idioma inglês para melhor qualidade de fontes
        num: safeNumResults
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data: SerperResponse = await response.json();
    
    return {
      success: true,
      results: data.organic || [],
      knowledgeGraph: data.knowledgeGraph,
      answerBox: data.answerBox
    };
  } catch (error) {
    console.error('Error searching with Serper:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during web search'
    };
  }
}

/**
 * Formata os resultados da busca para um formato mais amigável
 * 
 * @param results Resultados brutos da API do Serper
 * @returns String formatada com as informações relevantes
 */
export function formatSearchResults(searchData: {
  results?: SerperSearchResult[];
  knowledgeGraph?: any;
  answerBox?: any;
}): string {
  let formattedResults = '';
  
  // Adicionar caixa de resposta se disponível
  if (searchData.answerBox) {
    formattedResults += `RESPOSTA DIRETA:\n${searchData.answerBox.title || ''}\n${searchData.answerBox.answer || ''}\n\n`;
  }
  
  // Adicionar knowledge graph se disponível
  if (searchData.knowledgeGraph) {
    formattedResults += `INFORMAÇÃO PRINCIPAL:\n${searchData.knowledgeGraph.title || ''} - ${searchData.knowledgeGraph.type || ''}\n${searchData.knowledgeGraph.description || ''}\n\n`;
  }
  
  // Adicionar resultados orgânicos
  if (searchData.results && searchData.results.length > 0) {
    formattedResults += `RESULTADOS PRINCIPAIS:\n\n`;
    
    searchData.results.forEach((result, index) => {
      formattedResults += `Fonte #${index + 1}: ${result.title}\n`;
      formattedResults += `URL: ${result.link}\n`;
      formattedResults += `Resumo: ${result.snippet}\n\n`;
    });
  }
  
  return formattedResults;
}