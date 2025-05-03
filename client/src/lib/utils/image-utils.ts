/**
 * Utilitários para lidar com imagens na aplicação
 */

// URL de imagem de fallback confiável (fundo laranja) - estatica na aplicação para não quebrar
export const DEFAULT_PODCAST_IMAGE = '/podcast-cover-orange.jpg';

/**
 * Verifica se uma URL é válida
 * @param url URL para verificar
 * @returns true se a URL é válida, false caso contrário
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  // Verificar se é uma URL válida
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Retorna a URL da imagem ou o fallback em caso de erro
 * @param url URL da imagem
 * @returns URL segura para uso
 */
export function getSafeImageUrl(url: string | null | undefined): string {
  return isValidImageUrl(url) ? url! : DEFAULT_PODCAST_IMAGE;
}

/**
 * Handler para erros de carregamento de imagem
 * @param event Evento de erro
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const target = event.target as HTMLImageElement;
  target.onerror = null; // Evitar loops infinitos
  target.src = DEFAULT_PODCAST_IMAGE;
}