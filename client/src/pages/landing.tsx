import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Globe, Zap, Headphones, Users, Star, ArrowRight, Play, ThumbsUp, Award } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  const isMobile = useIsMobile();
  
  // Redirecionar usuários autenticados para a página de podcasts em português
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/portuguese');
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  // Não executar nenhuma requisição de dados enquanto estiver nesta página
  
  // Se ainda está carregando ou está autenticado, não mostrar nada até o redirecionamento
  if (isLoading || isAuthenticated) return null;
  
  // Função para iniciar a jornada do usuário
  const handleGetStarted = () => {
    window.location.href = '/api/login';
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-b from-black to-background">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iLjA1Ij48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTRNMTQgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTRNMzYgMTRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTRNMTQgMTRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] bg-fixed"></div>
        <div className="container relative z-10 px-4 mx-auto">
          <div className="flex flex-col items-center justify-center gap-6 text-center">
            <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-primary/30 text-primary bg-primary/10">
              Transforme Texto em Podcasts de Qualidade Profissional
            </Badge>
            
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              <span className="block">Crie Podcasts Incríveis com</span>
              <span className="relative inline-block mt-2">
                <span className="text-primary">Inteligência Artificial</span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-primary/30 rounded"></span>
              </span>
            </h1>
            
            <p className="max-w-2xl mt-6 text-xl text-muted-foreground">
              Transforme suas ideias em conversas envolventes com vozes naturais em português brasileiro.
              Gere, edite e compartilhe podcasts em minutos, sem equipamento de áudio.
            </p>
            
            <div className="flex flex-col items-center gap-4 mt-8 sm:flex-row">
              <Button 
                size="lg" 
                className="gap-2 px-6 text-lg font-semibold rounded-full bg-primary hover:bg-primary/90 text-black"
                onClick={handleGetStarted}
              >
                Começar Agora
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <Link href="/api/login" className="flex items-center gap-2 text-primary hover:underline">
                <Play className="w-4 h-4" />
                Conheça Nossa Demo
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-14 md:grid-cols-4">
              {[
                { icon: <Zap className="w-6 h-6 text-primary" />, text: "Fácil de Usar" },
                { icon: <Globe className="w-6 h-6 text-primary" />, text: "Português Brasileiro" },
                { icon: <Mic className="w-6 h-6 text-primary" />, text: "Vozes Naturais" },
                { icon: <Headphones className="w-6 h-6 text-primary" />, text: "Qualidade Profissional" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center p-4 text-center">
                  {item.icon}
                  <span className="mt-2 text-sm font-medium text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Recursos Exclusivos
            </h2>
            <p className="max-w-2xl mt-4 text-muted-foreground">
              Tudo que você precisa para criar podcasts incríveis sem sair do navegador
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7 2.5 9.5 5 12"/><path d="M9 7l2.5 2.5L9 12"/><path d="M13 7h6"/><path d="M6 17h6"/><path d="M15 17h3"/></svg>,
                title: "Geração de Script Automatizada",
                description: "Gere conversações completas em segundos com a IA. Basta fornecer um tema e receber um roteiro pronto para gravação."
              },
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>,
                title: "Vozes Brasileiras Naturais",
                description: "Acesso a 12 vozes premium em português brasileiro, com tecnologia Google Cloud Chirp3-HD de última geração."
              },
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 4v4"/><path d="M12 16v4"/><path d="m16.24 7.76 2.83-2.83"/><path d="m4.93 19.07 2.83-2.83"/><path d="m19.07 19.07-2.83-2.83"/><path d="m4.93 4.93 2.83 2.83"/></svg>,
                title: "Processamento em Nuvem",
                description: "Gere áudio de alta qualidade sem usar recursos do seu dispositivo, com processamento rápido e eficiente na nuvem."
              },
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                title: "Múltiplos Personagens",
                description: "Crie diálogos naturais entre diferentes personagens, escolhendo vozes masculinas e femininas para criar um podcast dinâmico."
              },
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>,
                title: "Armazenamento em Nuvem",
                description: "Seus podcasts ficam armazenados na nuvem e disponíveis para acesso de qualquer lugar a qualquer momento."
              },
              {
                icon: <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 6h.01"/><path d="M18 12h.01"/><path d="M18 18h.01"/></svg>,
                title: "Personalização Completa",
                description: "Controle total sobre o conteúdo, tom e estilo dos seus podcasts. Edite o roteiro para se adequar perfeitamente ao seu estilo."
              },
            ].map((feature, i) => (
              <Card key={i} className="overflow-hidden border-none bg-foreground/5 hover:bg-foreground/10 transition-colors">
                <CardContent className="p-6">
                  <div className="p-3 mb-4 rounded-lg w-fit bg-primary/10">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* Como Funciona Section */}
      <section className="py-24 bg-foreground/5">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Como Funciona
            </h2>
            <p className="max-w-2xl mt-4 text-muted-foreground">
              Crie seu podcast em apenas três passos simples
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute left-0 right-0 hidden h-1 -translate-y-1/2 md:block top-1/2 bg-primary/20"></div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Escolha o Tema",
                  description: "Escolha um tema para seu podcast e deixe nossa IA gerar automaticamente um roteiro envolvente, ou crie seu próprio texto."
                },
                {
                  step: "2",
                  title: "Selecione as Vozes",
                  description: "Escolha entre 12 vozes de alta qualidade em português brasileiro para dar vida aos seus personagens."
                },
                {
                  step: "3",
                  title: "Gere e Compartilhe",
                  description: "Nosso sistema processa o áudio na nuvem e disponibiliza seu podcast para download e compartilhamento em minutos."
                },
              ].map((step, i) => (
                <div key={i} className="relative flex flex-col items-center p-6 text-center">
                  <div className="z-10 flex items-center justify-center w-12 h-12 mb-4 font-bold text-black rounded-full bg-primary">
                    {step.step}
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-24 bg-background">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Usuários Satisfeitos
            </h2>
            <p className="max-w-2xl mt-4 text-muted-foreground">
              Veja o que nossos usuários dizem sobre a plataforma
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                name: "Roberto Silva",
                role: "Produtor de Conteúdo",
                avatar: "R",
                quote: "Incrível como a qualidade das vozes em português é natural. Economizo horas de gravação e edição."
              },
              {
                name: "Carla Mendes",
                role: "Influenciadora Digital",
                avatar: "C",
                quote: "Finalmente posso criar podcasts profissionais sem precisar de equipamento caro ou estúdio. As vozes brasileiras são excelentes!"
              },
              {
                name: "Daniel Costa",
                role: "Professor Universitário",
                avatar: "D",
                quote: "Uso para criar material didático em formato de podcast. Meus alunos adoram e a produção é extremamente rápida."
              },
            ].map((testimonial, i) => (
              <Card key={i} className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex items-center justify-center w-10 h-10 mr-3 text-lg font-semibold text-primary rounded-full bg-primary/20">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                  <div className="flex mb-3">
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-primary" fill="currentColor" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">{testimonial.quote}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 text-center bg-gradient-to-br from-primary/20 via-background to-primary/10">
        <div className="container px-4 mx-auto">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Pronto para Revolucionar seus Podcasts?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Crie seu primeiro podcast com qualidade profissional em minutos.
              Experimente grátis ou faça login para acessar todos os recursos.
            </p>
            <div className="flex flex-col items-center gap-4 mt-8 sm:flex-row sm:justify-center">
              <Button 
                size="lg" 
                className="gap-2 px-6 text-lg font-semibold rounded-full bg-primary hover:bg-primary/90 text-black"
                onClick={handleGetStarted}
              >
                Criar Conta Gratuita
                <ArrowRight className="w-5 h-5" />
              </Button>
              
              <Link href="/api/login" className="flex items-center gap-2 text-primary hover:underline">
                <Play className="w-4 h-4" />
                Conheça Nossa Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}