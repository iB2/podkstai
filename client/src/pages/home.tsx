import { HeroSection } from "@/components/hero-section";
import { PodcastForm } from "@/components/podcast-form";
import { PodcastGallery } from "@/components/podcast-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { MicIcon, MessageSquareTextIcon, BrainCircuitIcon, LanguagesIcon, VolumeIcon, HeadphonesIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Helmet } from "react-helmet";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  
  return (
    <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 flex-grow">
      <Helmet>
        <title>PODKST.AI - Crie podcasts profissionais a partir de texto em minutos</title>
        <meta name="description" content="Transforme textos em podcasts profissionais com vozes naturais em português e inglês. Nossa tecnologia avançada de IA gera conteúdo envolvente com múltiplas vozes." />
        <meta name="keywords" content="podcasts, IA, inteligência artificial, text-to-speech, TTS, áudio, podcasting, português, conteúdo digital" />
        <meta property="og:title" content="PODKST.AI - Podcasts profissionais gerados por IA" />
        <meta property="og:description" content="Transforme ideias em podcasts profissionais com vozes naturais em português. Nossa tecnologia avançada de IA gera conteúdo envolvente rapidamente." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PODKST.AI - Podcasts profissionais gerados por IA" />
        <meta name="twitter:description" content="Transforme texto em podcasts com vozes naturais em português. Nossa IA avançada gera conteúdo envolvente rapidamente." />
      </Helmet>
      
      <HeroSection 
        title="Transforme Texto em Podcast Profissional"
        subtitle="Crie podcasts com vozes naturais em português, a partir de conversas ou scripts em apenas alguns cliques"
        gradient="from-primary/80 to-gray-800/80"
        imageSrc="https://plus.unsplash.com/premium_photo-1681980149875-c43de7fcf9ea?q=80&w=2070&auto=format&fit=crop"
        imageAlt="Microfone profissional de estúdio com equipamentos de áudio para podcast"
      />
      
      <section className="my-12 text-center">
        <div className="max-w-3xl mx-auto mb-8">
          <h2 className="text-3xl font-bold mb-2">Amplifique Suas Ideias Com Áudio</h2>
          <p className="text-lg text-gray-200">
            PODKST.AI transforma qualquer texto em podcasts envolventes com vozes reais e naturais.
            Perfeito para criadores de conteúdo, educadores e profissionais de marketing.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white px-6">
            <Link href={isAuthenticated ? "/portuguese" : "/api/login"}>
              Comece Agora - Grátis
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-primary text-primary hover:bg-primary/10">
            <a href="#recursos">Ver Recursos</a>
          </Button>
        </div>
      </section>
      
      <section id="recursos" className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Recursos Principais</h2>
          <p className="text-lg text-gray-200 max-w-2xl mx-auto">
            Nossa plataforma combina inteligência artificial avançada com processamento de linguagem natural para criar podcasts de alta qualidade.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <LanguagesIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Podcasts em Português</CardTitle>
              <CardDescription>
                Vozes naturais de alta qualidade com a tecnologia Chirp3-HD do Google para sotaque e entonação brasileiros autênticos.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <MessageSquareTextIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Roteiros Gerados por IA</CardTitle>
              <CardDescription>
                Inteligência avançada com múltiplos estágios de criação: interpretação, pesquisa, estratégia, escrita e edição de roteiros.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <MicIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Múltiplas Vozes</CardTitle>
              <CardDescription>
                Alterne automaticamente entre locutores masculinos e femininos para criar uma experiência de podcast multi-voz realista.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <HeadphonesIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Player Sequencial</CardTitle>
              <CardDescription>
                Reproduza segmentos de áudio sem emendas com nosso player especializado que gerencia transições suaves entre trechos.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <VolumeIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Processamento de Áudio</CardTitle>
              <CardDescription>
                Nosso sistema gerencia automaticamente segmentos longos, combinando-os em um arquivo final de alta qualidade.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-gray-800 bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
            <CardHeader>
              <BrainCircuitIcon className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Pesquisa em Tempo Real</CardTitle>
              <CardDescription>
                Integração com Serper.dev e Perplexity para criação de conteúdo informado e atualizado para seus podcasts.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
      
      <section className="py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Como Funciona</h2>
          <p className="text-lg text-gray-200 max-w-2xl mx-auto">
            Três passos simples para transformar suas ideias em podcasts profissionais
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">1</div>
            <h3 className="text-xl font-semibold mb-2">Escreva ou Gere</h3>
            <p className="text-gray-300">Escreva sua conversa ou deixe nossa IA criar um roteiro profissional a partir de um tema.</p>
          </div>
          
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">2</div>
            <h3 className="text-xl font-semibold mb-2">Selecione Vozes</h3>
            <p className="text-gray-300">Escolha entre diversas vozes masculinas e femininas para seus apresentadores.</p>
          </div>
          
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">3</div>
            <h3 className="text-xl font-semibold mb-2">Gere e Compartilhe</h3>
            <p className="text-gray-300">Obtenha seu podcast em formato MP3 pronto para publicação em qualquer plataforma.</p>
          </div>
        </div>
        
        <div className="text-center mt-10">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white px-8">
            <Link href={isAuthenticated ? "/portuguese" : "/api/login"}>
              Criar Meu Primeiro Podcast
            </Link>
          </Button>
        </div>
      </section>
      
      <section className="my-12 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Pronto para transformar suas ideias em podcasts profissionais?
          </h2>
          <p className="text-lg mb-8">
            Faça login e comece a criar podcasts de qualidade profissional em minutos.
          </p>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white px-10">
            <Link href={isAuthenticated ? "/portuguese" : "/api/login"}>
              {isAuthenticated ? "Acessar Minha Conta" : "Login / Cadastro"}
            </Link>
          </Button>
        </div>
      </section>
      
      <PodcastGallery />
    </main>
  );
}
