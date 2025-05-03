import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Garantir que o token HTTP-only seja incluído em todas as solicitações
// usando configurações de fetch compartilhadas
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
  // Adicionar credentials: 'include' para enviar cookies com cada solicitação
  const modifiedInit: RequestInit = {
    ...init,
    credentials: 'include',
  };
  return originalFetch.call(this, input, modifiedInit);
};

createRoot(document.getElementById("root")!).render(<App />);
