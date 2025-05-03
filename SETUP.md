# Configuração do PODKST.AI

Este documento contém as instruções para configurar e iniciar o projeto PODKST.AI em um ambiente de desenvolvimento.

## Pré-requisitos

- Node.js 18.x ou superior
- npm 8.x ou superior
- PostgreSQL 14.x ou superior
- Acesso às seguintes APIs:
  - OpenAI API (para geração de conteúdo)
  - Google Cloud Text-to-Speech (para conversão de texto em áudio)
  - Serper.dev (para pesquisa em tempo real)
  - Perplexity API (para estratégia de conteúdo)
  - Supabase (para banco de dados e armazenamento)

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```
# Banco de dados
DATABASE_URL=sua_url_de_conexao_postgresql

# OpenAI
OPENAI_API_KEY=sua_chave_api_openai

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=caminho_para_seu_arquivo_de_credenciais_json

# Serper.dev
SERPER_API_KEY=sua_chave_api_serper

# Perplexity
PERPLEXITY_API_KEY=sua_chave_api_perplexity

# Supabase
SUPABASE_URL=sua_url_supabase
SUPABASE_KEY=sua_chave_supabase

# Autenticação (Replit)
SESSION_SECRET=uma_string_aleatória_e_segura
```

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/podkst-ai.git
   cd podkst-ai
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o banco de dados:
   ```bash
   npm run db:push
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

5. Acesse a aplicação em `http://localhost:5000`

## Estrutura do Projeto

- `client/`: Frontend da aplicação (React + Vite)
- `server/`: Backend da aplicação (Express)
- `shared/`: Tipos e esquemas compartilhados entre frontend e backend
- `drizzle/`: Arquivos relacionados ao ORM Drizzle

## Fluxo de Trabalho

1. Desenvolvimento:
   ```bash
   npm run dev
   ```

2. Build para produção:
   ```bash
   npm run build
   ```

3. Iniciar em modo produção:
   ```bash
   npm start
   ```

## Características do Ambiente de Produção

Em produção, a aplicação PODKST.AI utiliza:

- Replit como plataforma de hospedagem
- Supabase para armazenamento de arquivos de áudio
- Autenticação via Replit Auth (OpenID Connect)
- Processamento assíncrono para geração de conteúdo

## Suporte

Para questões e suporte, por favor, abra uma issue no repositório GitHub.