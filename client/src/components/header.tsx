import { Button } from "@/components/ui/button";
import { Mic, LogIn, LogOut, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Função para redirecionar para login
  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  // Função para logout
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  // Função para obter iniciais para o avatar
  const getUserInitials = (): string => {
    if (!user || !user.username) return '?';
    return user.username.substring(0, 2).toUpperCase();
  };
  
  return (
    <header className="bg-[#0A0A0A] shadow-md">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href={isAuthenticated ? "/portuguese" : "/"}>
          <div className="flex items-center gap-3 cursor-pointer">
            <Mic className="text-primary text-3xl" />
            <h1 className="text-xl font-bold text-foreground">PODKST.AI</h1>
          </div>
        </Link>
        
        <div className="flex items-center gap-4">
          
          {!isLoading && (
            isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full p-0 w-10 h-10 flex items-center justify-center">
                    <Avatar className="h-8 w-8 border-2 border-primary">
                      <AvatarImage src={user?.profileImageUrl || ''} alt={user?.username || 'User'} />
                      <AvatarFallback className="bg-primary text-black font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    Minha Conta
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="flex flex-col items-start">
                    <div className="flex items-center">
                      <span className="font-medium">{user?.username || 'User'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user?.email || ''}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Link href="/profile">
                    <DropdownMenuItem>
                      <User className="h-4 w-4 mr-2" />
                      <span>Perfil</span>
                    </DropdownMenuItem>
                  </Link>
                  
                  <Link href="/admin">
                    <DropdownMenuItem>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-2" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>Administração</span>
                    </DropdownMenuItem>
                  </Link>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                    <LogOut className="h-4 w-4 mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                className="rounded-full bg-primary hover:bg-accent text-black font-medium"
                onClick={handleLogin}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>
            )
          )}
        </div>
        
        <Button variant="ghost" size="icon" className="md:hidden text-foreground text-xl">
          <Mic className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
