import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, ArrowRight, Zap, Globe, Headphones } from 'lucide-react';
import { Link } from 'wouter';

export default function SimpleLandingPage() {
  // Função para iniciar a jornada do usuário
  const handleGetStarted = () => {
    window.location.href = '/api/login';
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20">
          <div className="container px-4 mx-auto">
            <div className="flex flex-col items-center max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center w-16 h-16 mb-8 rounded-full bg-primary/20">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                <span className="block">PODKST.AI</span>
                <span className="block mt-2 text-primary">Conversas Inteligentes</span>
              </h1>
              
              <p className="mt-6 text-xl text-gray-400">
                Transforme texto em podcasts com vozes naturais em português.
                Crie diálogos envolventes com IA em minutos.
              </p>
              
              <div className="flex flex-col items-center gap-4 mt-10 sm:flex-row">
                <Button 
                  size="lg" 
                  className="w-full gap-2 text-lg font-medium rounded-full sm:w-auto bg-primary hover:bg-primary/90 text-black"
                  onClick={handleGetStarted}
                >
                  Começar Agora
                  <ArrowRight className="w-5 h-5" />
                </Button>
                
                <Link href="/portuguese" className="text-primary hover:underline">
                  Experimentar em Modo Demo
                </Link>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features */}
        <section className="py-12 bg-zinc-900">
          <div className="container px-4 mx-auto">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
              <Card className="p-6 border-none bg-zinc-800">
                <Zap className="w-10 h-10 mb-4 text-primary" />
                <h3 className="mb-2 text-xl font-medium">Geração com IA</h3>
                <p className="text-gray-400">
                  Gere roteiros de podcast automaticamente com nossa avançada inteligência artificial.
                </p>
              </Card>
              
              <Card className="p-6 border-none bg-zinc-800">
                <Globe className="w-10 h-10 mb-4 text-primary" />
                <h3 className="mb-2 text-xl font-medium">Vozes Brasileiras</h3>
                <p className="text-gray-400">
                  Acesso a 12 vozes naturais em português brasileiro para seus podcasts.
                </p>
              </Card>
              
              <Card className="p-6 border-none bg-zinc-800">
                <Headphones className="w-10 h-10 mb-4 text-primary" />
                <h3 className="mb-2 text-xl font-medium">Pronto para Compartilhar</h3>
                <p className="text-gray-400">
                  Compartilhe seus podcasts diretamente ou baixe os arquivos para usar em qualquer plataforma.
                </p>
              </Card>
            </div>
            
            <div className="flex justify-center mt-12">
              <Button 
                size="lg"
                className="gap-2 text-lg font-medium rounded-full bg-primary hover:bg-primary/90 text-black"
                onClick={handleGetStarted}
              >
                Criar Conta Grátis
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500 bg-black">
        <p>© 2025 PODKST.AI. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}