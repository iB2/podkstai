import { PodcastGallery } from "@/components/podcast-gallery";
import { PortuguesePodcastForm } from "@/components/portuguese-podcast-form";
import { HeroSection } from "@/components/hero-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Search, BrainCircuit, PenLine, Edit3, FileText } from "lucide-react";
import { 
  scriptGeneratorService, 
  type GenerationStep,
  type GenerationStatus 
} from "@/lib/services/script-generator-service";
import { Progress } from "@/components/ui/progress";

export default function PortuguesePage() {
  const [activeTab, setActiveTab] = useState("tema");
  const [themeText, setThemeText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedScript, setGeneratedScript] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const { toast } = useToast();

  // Recuperar dados do localStorage ao inicializar
  useEffect(() => {
    const savedTheme = localStorage.getItem("podcastTheme");
    if (savedTheme) {
      setThemeText(savedTheme);
    }
  }, []);

  // Salvar tema no localStorage sempre que mudar
  useEffect(() => {
    if (themeText.trim()) {
      localStorage.setItem("podcastTheme", themeText);
    }
  }, [themeText]);

  // Função para monitorar o progresso da geração
  useEffect(() => {
    if (!isGenerating) return;
    
    // Iniciar polling para verificar o status da geração
    const checkGenerationStatus = async () => {
      try {
        const status = await scriptGeneratorService.checkGenerationStatus();
        
        console.log("Status da geração:", status);
        
        // Atualizar o estado com o progresso atual
        if (status.step) {
          setGenerationStep(status.step);
          setGenerationProgress(status.progress || 0);
          
          // Se a geração foi concluída, buscar o resultado
          if (status.step === "complete" && !status.inProgress) {
            console.log("Geração completa detectada! Buscando script...");
            try {
              await fetchGeneratedScript();
            } catch (fetchError) {
              console.error("Erro ao buscar script após completar:", fetchError);
              
              // Se houver erro ao buscar o script, verificar se há mensagem de erro no status
              if (status.message) {
                toast({
                  title: "Erro na geração do script",
                  description: status.message || "Ocorreu um erro durante o processo de geração.",
                  variant: "destructive"
                });
              }
              
              // Finalizar o estado de geração mesmo com erro
              setIsGenerating(false);
            }
          }
          
          // Verificar se há mensagem de erro no status mesmo que não esteja completo
          if (status.message && status.message.includes("error")) {
            console.error("Erro detectado no status:", status.message);
            toast({
              title: "Erro na geração do script",
              description: status.message || "Ocorreu um erro durante o processo de geração.",
              variant: "destructive"
            });
            setIsGenerating(false);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar status da geração:", error);
      }
    };
    
    console.log("Iniciando polling de status da geração");
    
    // Verificar status a cada 2 segundos
    const interval = setInterval(checkGenerationStatus, 2000);
    checkGenerationStatus(); // Verificar imediatamente
    
    // Limpar o intervalo quando o componente for desmontado ou geração concluída
    return () => {
      console.log("Finalizando polling de status da geração");
      clearInterval(interval);
    };
  }, [isGenerating]);
  
  // Função para buscar o script gerado quando concluído
  const fetchGeneratedScript = async () => {
    try {
      const result = await scriptGeneratorService.getGenerationResult();
      
      if (result.success && result.script) {
        // Armazenar o script e metadados gerados
        setGeneratedScript(result.script);
        setGeneratedTitle(result.title || "");
        setGeneratedDescription(result.description || "");
        
        // Pequeno atraso para mostrar que está completo antes de mudar de tela
        setTimeout(() => {
          // Mudar para a aba do formulário
          setActiveTab("script");
          // Finalizar estado de geração
          setIsGenerating(false);
        }, 1000);
        
        toast({
          title: "Script gerado com sucesso!",
          description: "Seu roteiro de podcast está pronto para gravação.",
          variant: "default"
        });
      } else if (result.status && result.status.inProgress) {
        // Ainda processando - continuar aguardando
        console.log("Script ainda está sendo gerado...");
      } else {
        // Erro
        throw new Error(result.error || "Erro ao buscar script gerado");
      }
    } catch (error:any) {
      console.error("Erro ao buscar resultado da geração:", error);
      toast({
        title: "Erro ao recuperar script",
        description: error.message || "Não foi possível obter o script gerado.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!themeText.trim()) {
      toast({
        title: "Tema necessário",
        description: "Por favor, forneça um tema para o podcast.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Iniciar geração e mostrar indicador de progresso
      setIsGenerating(true);
      setGenerationStep("idle");
      setGenerationProgress(0);
      
      // Chamar a API para iniciar a geração assíncrona
      const result = await scriptGeneratorService.generateScript(themeText);
      
      if (result.success) {
        // Continuar verificando o status (o polling em useEffect ficará responsável)
        toast({
          title: "Geração iniciada!",
          description: "O script está sendo gerado. Este processo utiliza múltiplas etapas com busca na web e pode levar alguns minutos.",
        });
        
        // Se o resultado já veio com informações de status, atualizar
        if (result.status) {
          setGenerationStep(result.status.step);
          setGenerationProgress(result.status.progress || 0);
        }
      } else {
        throw new Error(result.error || "Falha ao iniciar a geração do script.");
      }
    } catch (error: any) {
      console.error("Erro na geração:", error);
      toast({
        title: "Erro na geração do script",
        description: error.message || "Ocorreu um erro inesperado. Por favor, tente novamente.",
        variant: "destructive"
      });
      
      // Reset em caso de erro
      setIsGenerating(false);
      setGenerationStep("idle");
      setGenerationProgress(0);
    }
  };

  const handleHaveScript = () => {
    // Apenas muda para a aba do formulário sem gerar script
    setActiveTab("script");
  };

  // Renderizar o indicador de etapa correta
  const renderStepIcon = (step: GenerationStep) => {
    switch (step) {
      case "interpreting":
        return <BrainCircuit className="h-5 w-5 text-[#F3930B]" />;
      case "researching":
        return <Search className="h-5 w-5 text-[#F3930B]" />;
      case "strategizing":
        return <PenLine className="h-5 w-5 text-[#F3930B]" />;
      case "writing":
        return <Edit3 className="h-5 w-5 text-[#F3930B]" />;
      case "editing":
        return <FileText className="h-5 w-5 text-[#F3930B]" />;
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-[#F3930B]" />;
    }
  };

  // Texto da etapa atual
  const getStepText = (step: GenerationStep) => {
    switch (step) {
      case "interpreting":
        return "Interpretando e estruturando o tema...";
      case "researching":
        return "Pesquisando informações atualizadas...";
      case "strategizing":
        return "Criando estratégia de engajamento...";
      case "writing":
        return "Escrevendo roteiro com diálogo natural...";
      case "editing":
        return "Otimizando para síntese de voz...";
      case "complete":
        return "Script gerado com sucesso!";
      default:
        return "Iniciando...";
    }
  };

  return (
    <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 flex-grow">
      <HeroSection 
        title="Criador de Podcast em Português"
        subtitle="Use tecnologia avançada de síntese de voz para criar podcasts em português brasileiro com vozes Chirp3-HD do Google Cloud"
        gradient="from-[#F3930B]/70 to-[#D97706]/70"
        imageSrc="/src/assets/images/podkst_hero.png"
        imageAlt="Fundo laranja para podcast em português"
      />
      
      <PodcastGallery />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tema">Definir Tema</TabsTrigger>
          <TabsTrigger value="script">Criar Script</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tema">
          <Card>
            <CardHeader>
              <CardTitle>Defina o tema do seu podcast</CardTitle>
              <CardDescription>
                Descreva o tema, objetivo ou ideia principal do seu podcast. Nossa IA avançada gerará um roteiro personalizado com pesquisa em tempo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Ex: Quero um podcast sobre inteligência artificial e seu impacto na educação, discutindo benefícios e desafios para professores e alunos..."
                className="min-h-[200px]"
                value={themeText}
                onChange={(e) => setThemeText(e.target.value)}
              />
              
              {isGenerating && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {renderStepIcon(generationStep)}
                      <span className="font-medium text-sm">{getStepText(generationStep)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{generationProgress}%</span>
                  </div>
                  
                  <Progress value={generationProgress} className="h-2" />
                  
                  {/* Etapas do processo */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs text-muted-foreground mt-3">
                    <div className={`flex items-center ${generationStep === "interpreting" ? "text-[#F3930B] font-medium" : generationProgress >= 20 ? "text-green-500" : ""}`}>
                      <span className="mr-1">{generationProgress >= 20 ? "✓" : "1."}</span> Interpretação
                    </div>
                    <div className={`flex items-center ${generationStep === "researching" ? "text-[#F3930B] font-medium" : generationProgress >= 40 ? "text-green-500" : ""}`}>
                      <span className="mr-1">{generationProgress >= 40 ? "✓" : "2."}</span> Pesquisa
                    </div>
                    <div className={`flex items-center ${generationStep === "strategizing" ? "text-[#F3930B] font-medium" : generationProgress >= 60 ? "text-green-500" : ""}`}>
                      <span className="mr-1">{generationProgress >= 60 ? "✓" : "3."}</span> Estratégia
                    </div>
                    <div className={`flex items-center ${generationStep === "writing" ? "text-[#F3930B] font-medium" : generationProgress >= 80 ? "text-green-500" : ""}`}>
                      <span className="mr-1">{generationProgress >= 80 ? "✓" : "4."}</span> Escrita
                    </div>
                    <div className={`flex items-center ${generationStep === "editing" || generationStep === "complete" ? "text-[#F3930B] font-medium" : generationProgress >= 100 ? "text-green-500" : ""}`}>
                      <span className="mr-1">{generationProgress >= 100 ? "✓" : "5."}</span> Edição
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between gap-4 flex-col sm:flex-row">
              <Button 
                onClick={handleGenerateScript} 
                className="w-full sm:flex-1 bg-[#F3930B] hover:bg-[#F3930B]/80"
                disabled={!themeText.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando Script...
                  </>
                ) : (
                  "Gerar Script com IA Avançada"
                )}
              </Button>
              <Button 
                onClick={handleHaveScript} 
                variant="outline"
                className="w-full sm:flex-1"
                disabled={isGenerating}
              >
                Já Tenho Meu Script
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="script">
          <PortuguesePodcastForm 
            initialTheme={themeText} 
            initialScript={generatedScript}
            initialTitle={generatedTitle}
            initialDescription={generatedDescription}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}