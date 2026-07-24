# Sistema de Negociações Bancárias

Sistema web para gestão centralizada de negociações bancárias e negociação de dívidas para escritórios de advocacia.

**Desenvolvido para:** Paccola & Pelegrini Sociedade de Advogados

## Funcionalidades

✓ **Cadastro de clientes** — Armazenar informações básicas, dados de dívida e valor disponível
✓ **Registro de ligações** — Documentar cada contato com banco (data, número, resumo)
✓ **Gestão de negociações** — Rastrear propostas, contrapropostas e acordos
✓ **Histórico formal** — Comprovação de trabalho realizado para apresentar ao cliente
✓ **Filtros avançados** — Buscar por status, valor disponível, mês de conclusão
✓ **Autenticação segura** — Login com email/senha via Supabase
✓ **Dados compartilhados** — Múltiplos advogados acessam simultaneamente

## Stack tecnológico

- **Frontend:** React 18 + Vite
- **Backend:** Supabase (PostgreSQL + autenticação)
- **Hospedagem:** Vercel ou Cloudflare Pages
- **Estilos:** CSS com variáveis personalizadas

## Instalação rápida

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/sistema-negociacoes.git
cd sistema-negociacoes
npm install
```

### 2. Configurar Supabase

1. Crie conta gratuita em [supabase.com](https://supabase.com)
2. Crie novo projeto (região: São Paulo)
3. Vá em **SQL Editor** → **New Query** → Cole o script abaixo:

```sql
-- Tabela de clientes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf_cnpj text not null,
  telefone text not null,
  email text,
  tipo_divida text,
  banco text,
  valor_divida_inicial decimal(15,2),
  valor_divida_atualizado decimal(15,2),
  percentual_honorarios decimal(5,2),
  valor_disponivel decimal(15,2),
  observacoes text,
  status text default 'em-negociacao',
  ultimo_contato date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de ligações/contatos
create table public.ligacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  data_ligacao date not null,
  banco text not null,
  numero_ligado text not null,
  resumo text not null,
  created_at timestamptz default now()
);

-- Tabela de negociações concluídas
create table public.negociacoes_concluidas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  valor_final_acordo decimal(15,2) not null,
  valor_honorarios decimal(15,2) not null,
  data_formalizacao date not null,
  responsavel text,
  created_at timestamptz default now()
);

-- Índices para performance
create index clientes_nome_idx on clientes (lower(nome));
create index clientes_status_idx on clientes (status);
create index ligacoes_cliente_idx on ligacoes (cliente_id);
create index negociacoes_cliente_idx on negociacoes_concluidas (cliente_id);
create index negociacoes_data_idx on negociacoes_concluidas (data_formalizacao);

-- Row Level Security
alter table public.clientes enable row level security;
alter table public.ligacoes enable row level security;
alter table public.negociacoes_concluidas enable row level security;

create policy "auth_clientes" on public.clientes for all to authenticated using (true);
create policy "auth_ligacoes" on public.ligacoes for all to authenticated using (true);
create policy "auth_negociacoes" on public.negociacoes_concluidas for all to authenticated using (true);
```

4. Vá em **Authentication** → **Users** → **Add User** e crie usuários para cada advogado
5. Marque **"Auto Confirm User"** para evitar necessidade de confirmação por email
6. Vá em **Settings → API** → Copie **Project URL** e **anon public key**

### 3. Configurar variáveis de ambiente

Crie arquivo `.env.local` na raiz do projeto:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

### 4. Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:5173`

### 5. Deploy no Vercel

1. Faça push para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Conecte seu repositório GitHub
4. Adicione as variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
5. Clique em Deploy

## Como usar

### Cadastro de novo cliente

1. Clique em **"+ Novo cliente"**
2. Preencha nome, CPF, contato
3. Informe banco e tipo de dívida
4. **Valor atualizado da dívida é opcional** — pode ser preenchido depois
5. Configure percentual de honorários (padrão 20%)
6. Clique em **"Cadastrar cliente"**

### Registrar ligação com banco

1. Selecione o cliente na lista principal
2. Clique em **"+ Registrar ligação"**
3. Preencha:
   - Data da ligação
   - Banco contactado
   - Número ligado
   - Resumo do atendimento
4. Clique em **"Salvar ligação"**

### Marcar negociação como concluída

1. Dentro do cliente, role para **"Marcar negociação como concluída"**
2. Preencha:
   - Valor final do acordo (obrigatório)
   - Honorários do escritório (obrigatório)
   - Data de formalização
   - Responsável pela negociação
3. Clique em **"✓ Concluir negociação"**

### Filtros

**Na página inicial, você pode filtrar por:**
- Status (Em negociação / Concluído)
- Valor disponível (Com valor / Sem valor)
- Mês de conclusão (mostra clientes com negociações concluídas naquele mês)
- Busca por nome ou CPF

## Estrutura de pastas

```
sistema-negociacoes/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── Dashboard.css
│   │   ├── ClienteForm.jsx
│   │   ├── ClienteForm.css
│   │   ├── ClienteDetalhes.jsx
│   │   ├── ClienteDetalhes.css
│   │   ├── Login.jsx
│   │   └── Login.css
│   ├── lib/
│   │   └── supabase.js
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Informações importantes

**Campo de valor atualizado da dívida:**
- Não é obrigatório no cadastro
- Pode ser preenchido posteriormente conforme as ligações com o banco
- Facilita cálculos de desconto ao finalizar a negociação

**Filtro por mês de conclusão:**
- Mostra apenas clientes que tiveram negociações concluídas naquele mês
- Útil para análise mensal de resultados

**Autenticação:**
- Cada advogado tem seu próprio login
- Todos acessam os mesmos dados (compartilhados no Supabase)
- Sessão fica ativa no navegador

## Suporte

Para dúvidas ou sugestões, contate a equipe de desenvolvimento.

## Licença

Propriedade de Paccola & Pelegrini Sociedade de Advogados
