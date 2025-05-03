import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Music, Trash } from 'lucide-react';
import { portuguesePodcastFormSchema, type PortuguesePodcastFormValues } from '@/lib/schemas/portuguese-podcast';
import { portugueseTtsService, type PortugueseVoice, type GenerateAudioResponse } from '@/lib/services/portuguese-tts-service';
import { AudioPreview } from './audio-preview';

interface PortuguesePodcastFormProps {
  initialTheme?: string;
  initialScript?: string;
  initialTitle?: string;
  initialDescription?: string;
}

export function PortuguesePodcastForm({ 
  initialTheme = '', 
  initialScript = '', 
  initialTitle = '', 
  initialDescription = '' 
}: PortuguesePodcastFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [audioData, setAudioData] = useState<{
    url: string;
    duration: number;
    chunks: number;
    size: number;
  } | null>(null);
  const [metadata, setMetadata] = useState<{ title: string; author: string } | null>(null);
  const [podcastId, setPodcastId] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  
  // Get available Portuguese voices
  const { data: voices, isLoading: isLoadingVoices } = useQuery<PortugueseVoice[]>({
    queryKey: ['/api/portuguese-voices'],
  });
  
  // Filter voices by gender for easier selection
  const maleVoices = voices?.filter(v => v.gender === 'male') || [];
  const femaleVoices = voices?.filter(v => v.gender === 'female') || [];
  
  // Função para carregar valores salvos do localStorage
  const getSavedFormValues = (): Partial<PortuguesePodcastFormValues> => {
    try {
      const savedValues = localStorage.getItem('portuguesePodcastForm');
      if (savedValues) {
        return JSON.parse(savedValues);
      }
    } catch (error) {
      console.error('Erro ao carregar formulário salvo:', error);
    }
    return {};
  };
  
  // Form definition com valores do localStorage
  const form = useForm<PortuguesePodcastFormValues>({
    resolver: zodResolver(portuguesePodcastFormSchema),
    defaultValues: {
      title: getSavedFormValues().title || '',
      author: getSavedFormValues().author || '',
      description: getSavedFormValues().description || initialTheme || '',
      category: getSavedFormValues().category || 'technology',
      language: 'pt-BR',
      conversation: getSavedFormValues().conversation || '',
      firstSpeakerVoice: getSavedFormValues().firstSpeakerVoice || '',
      secondSpeakerVoice: getSavedFormValues().secondSpeakerVoice || ''
    }
  });
  
  // Set default voices when loaded
  useEffect(() => {
    if (voices && voices.length > 0 && !form.getValues().firstSpeakerVoice) {
      const defaultMaleVoice = maleVoices[0]?.id || '';
      const defaultFemaleVoice = femaleVoices[0]?.id || '';
      
      form.setValue('firstSpeakerVoice', defaultMaleVoice);
      form.setValue('secondSpeakerVoice', defaultFemaleVoice);
    }
  }, [voices, form, maleVoices, femaleVoices]);
  
  // Função para salvar valores no localStorage
  const saveFormValues = (values: Partial<PortuguesePodcastFormValues>) => {
    try {
      localStorage.setItem('portuguesePodcastForm', JSON.stringify(values));
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
    }
  };

  // Aplica o script e outros dados gerados quando disponíveis
  useEffect(() => {
    if (initialScript && initialScript.trim() !== '') {
      form.setValue('conversation', initialScript);
      
      // Usa o título gerado pelo OpenAI se disponível
      if (initialTitle && initialTitle.trim() !== '') {
        form.setValue('title', initialTitle);
      }
      // Caso contrário, tenta definir um título com base no tema
      else if (initialTheme && !form.getValues().title) {
        const themeWords = initialTheme.split(' ').slice(0, 5).join(' ');
        form.setValue('title', `Podcast sobre ${themeWords}`);
      }
      
      // Usa a descrição gerada pelo OpenAI se disponível
      if (initialDescription && initialDescription.trim() !== '') {
        form.setValue('description', initialDescription);
      }
      // Caso contrário, usa o tema como descrição
      else if (initialTheme && !form.getValues().description) {
        form.setValue('description', initialTheme);
      }
      
      // Define um autor padrão se não estiver preenchido
      if (!form.getValues().author) {
        form.setValue('author', 'Podcast Gerado por IA');
      }
      
      // Salva os valores iniciais no localStorage
      saveFormValues(form.getValues());
      
      toast({
        title: "Script carregado",
        description: "O script gerado foi aplicado ao formulário com título e descrição automáticos. Você pode editar tudo conforme necessário.",
      });
    }
  }, [initialScript, form, initialTheme, initialTitle, initialDescription, toast]);
  
  // Monitora mudanças no formulário e salva no localStorage
  useEffect(() => {
    const subscription = form.watch((values) => {
      saveFormValues(values as Partial<PortuguesePodcastFormValues>);
    });
    
    // Cleanup da subscription
    return () => subscription.unsubscribe();
  }, [form]);
  
  // Audio generation mutation
  const generateAudioMutation = useMutation({
    mutationFn: async (data: PortuguesePodcastFormValues) => {
      setIsProcessing(true);
      setProcessingStep('Analisando texto da conversa...');
      
      // Pequeno atraso para mostrar a primeira etapa
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProcessingStep('Processando falas dos apresentadores...');
      // Usamos o novo método que recebe todos os dados do formulário
      const response = await portugueseTtsService.generateAudio(data);
      
      if (!response.success || !response.audioUrl) {
        throw new Error(response.error || 'Falha ao gerar áudio');
      }
      
      setProcessingStep('Gerando arquivo de áudio...');
      
      return response;
    },
    onSuccess: (result) => {
      setProcessingStep('Áudio gerado com sucesso!');
      
      // Se o servidor retornou um podcast já criado, armazenamos o ID
      if (result.podcast?.id) {
        setPodcastId(result.podcast.id);
        
        // Mesmo com podcast já criado, configuramos os dados de áudio para o player
        setAudioData({
          url: result.audioUrl!,
          duration: Math.round(result.duration || 0),
          chunks: 1,
          size: result.fileSize || 0
        });
        
        // Definimos os metadados para o player
        setMetadata({
          title: result.podcast.title || form.getValues().title,
          author: result.podcast.author || form.getValues().author
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
        
        toast({
          title: 'Podcast gerado com sucesso!',
          description: 'Seu podcast foi processado, salvo e está disponível na galeria.',
        });
      } else {
        // Update audio data state
        setAudioData({
          url: result.audioUrl!,
          duration: Math.round(result.duration || 0), // Converter para inteiro
          chunks: 1, // Just a single file for Portuguese
          size: result.fileSize || 0
        });
        
        // Set metadata for preview
        const formData = form.getValues();
        setMetadata({
          title: formData.title,
          author: formData.author
        });
        
        // Salvar o podcast automaticamente
        setProcessingStep('Salvando podcast no banco de dados...');
        
        const podcastData = {
          title: form.getValues().title,
          author: form.getValues().author,
          description: form.getValues().description,
          category: form.getValues().category,
          language: 'pt-BR',
          audioUrl: result.audioUrl!,
          duration: Math.round(result.duration || 0), // Converter para inteiro
          fileSize: result.fileSize || 0,
          chunkCount: 1, // Just one file for Portuguese
          conversation: form.getValues().conversation,
          metadata: {
            firstSpeakerVoice: form.getValues().firstSpeakerVoice,
            secondSpeakerVoice: form.getValues().secondSpeakerVoice
          }
        };
        
        createPodcastMutation.mutate(podcastData);
        
        toast({
          title: 'Áudio gerado com sucesso!',
          description: 'Seu podcast está sendo salvo e logo estará disponível na galeria.',
        });
      }
      
      // Pequeno atraso para mostrar a mensagem de conclusão
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStep(null);
      }, 1000);
    },
    onError: (error: Error) => {
      setIsProcessing(false);
      setProcessingStep(null);
      toast({
        title: 'Erro ao gerar áudio',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Podcast creation mutation
  const createPodcastMutation = useMutation({
    mutationFn: async (data: any) => {
      return await portugueseTtsService.createPodcast(data);
    },
    onSuccess: (podcast) => {
      setPodcastId(podcast.id);
      
      // Se ainda não temos dados de áudio configurados, fazemos isso aqui
      if (!audioData || !metadata) {
        setAudioData({
          url: podcast.audioUrl,
          duration: podcast.duration || 0,
          chunks: podcast.chunkCount || 1,
          size: podcast.fileSize || 0
        });
        
        setMetadata({
          title: podcast.title,
          author: podcast.author
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
      
      toast({
        title: 'Podcast criado com sucesso!',
        description: 'Seu podcast foi salvo e está disponível na galeria.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar podcast',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Form submission handler
  const onSubmit = (data: PortuguesePodcastFormValues) => {
    generateAudioMutation.mutate(data);
  };
  
  // Função removida pois o salvamento agora é automático após a geração

  // Categories for podcasts
  const categories = [
    { value: 'technology', label: 'Tecnologia' },
    { value: 'business', label: 'Negócios' },
    { value: 'science', label: 'Ciência' },
    { value: 'health', label: 'Saúde' },
    { value: 'entertainment', label: 'Entretenimento' },
    { value: 'education', label: 'Educação' },
    { value: 'sports', label: 'Esportes' },
    { value: 'society', label: 'Sociedade' }
  ];
  
  return (
    <>
    
      <Card className="mb-8 bg-gradient-to-r from-[#282828] to-[#121212] shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="text-primary h-6 w-6" />
            Criador de Podcast em Português
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Podcast Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título do podcast" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Autor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do autor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Descrição do podcast" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Voice Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstSpeakerVoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primeira Voz</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a primeira voz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingVoices ? (
                            <SelectItem value="loading" disabled>Carregando vozes...</SelectItem>
                          ) : (
                            voices?.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="secondSpeakerVoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segunda Voz</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a segunda voz" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingVoices ? (
                            <SelectItem value="loading" disabled>Carregando vozes...</SelectItem>
                          ) : (
                            voices?.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Conversation Text */}
              <FormField
                control={form.control}
                name="conversation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conversa</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={`João: Olá Maria, como vai você hoje?\nMaria: Estou bem, obrigada por perguntar! E você?`} 
                        {...field} 
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Submission Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/80 text-white"
                  disabled={isProcessing || generateAudioMutation.isPending}
                >
                  {(isProcessing || generateAudioMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isProcessing ? 'Processando...' : 'Gerar Podcast'}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline"
                  className="sm:w-auto"
                  onClick={() => {
                    // Limpar localStorage
                    localStorage.removeItem('portuguesePodcastForm');
                    
                    // Resetar formulário
                    form.reset({
                      title: '',
                      author: '',
                      description: initialTheme || '',
                      category: 'technology',
                      language: 'pt-BR',
                      conversation: '',
                      firstSpeakerVoice: maleVoices[0]?.id || '',
                      secondSpeakerVoice: femaleVoices[0]?.id || ''
                    });
                    
                    toast({
                      title: "Formulário limpo",
                      description: "Todos os dados salvos foram removidos e o formulário foi redefinido.",
                    });
                  }}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Limpar Formulário
                </Button>
                
                {isProcessing && processingStep && (
                  <div className="mt-4 p-4 bg-[#1c1c1c] rounded-md border border-primary/20">
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                      <span className="text-sm font-medium">{processingStep}</span>
                    </div>
                    <div className="mt-2 h-1 w-full bg-[#333333] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500" 
                        style={{ 
                          width: processingStep.includes('Analisando') ? '25%' : 
                                 processingStep.includes('Processando') ? '50%' : 
                                 processingStep.includes('Gerando arquivo') ? '75%' : 
                                 processingStep.includes('Salvando') ? '90%' : '100%'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Audio Preview Section */}
      {audioData && metadata && (
        <AudioPreview 
          audioData={audioData} 
          metadata={metadata}
          podcastId={podcastId}
        />
      )}
    </>
  );
}