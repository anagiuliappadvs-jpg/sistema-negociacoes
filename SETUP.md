# Setup rápido — 5 passos

## Passo 1: Clonar repositório

```bash
git clone https://github.com/seu-usuario/sistema-negociacoes.git
cd sistema-negociacoes
npm install
```

## Passo 2: Criar projeto Supabase

1. Vá para [supabase.com](https://supabase.com) → Sign Up
2. Crie novo projeto
3. Escolha nome: "sistema-negociacoes"
4. Senha forte (copie para guardar)
5. Região: **South America (São Paulo)**
6. Aguarde ~2 minutos para criar

## Passo 3: Criar tabelas no banco

1. No Supabase, vá em **SQL Editor** (menu esquerdo)
2. Clique **"+ New Query"**
3. Cole o código do `README.md` (seção "Configurar Supabase")
4. Clique **"Run"**

## Passo 4: Criar usuários

1. Vá em **Authentication** → **Users**
2. Clique **"+ Add user"**
3. Email: advogada1@escritorio.com.br
4. Senha: (escolha uma)
5. **Marque "Auto Confirm User"**
6. Clique "Create user"
7. Repita para cada advogado

## Passo 5: Configurar .env.local

1. Abra Supabase → **Settings** → **API**
2. Copie o **Project URL**
3. Copie o **anon public key**
4. Crie arquivo `.env.local` na raiz do projeto:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
```

5. Salve o arquivo

## Rodar localmente

```bash
npm run dev
```

Abra http://localhost:5173 e faça login

## Deploy no Vercel

1. Faça push para GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique **"Add New"** → **"Project"**
4. Selecione seu repositório
5. Em **"Environment Variables"** adicione:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Clique **"Deploy"**

Pronto! Sua aplicação estará online em minutos.

## Troubleshooting

**"Erro de autenticação"**
- Verifique se as variáveis `.env.local` estão corretas
- Confirme se criou os usuários no Supabase

**"Tabelas não existem"**
- Verifique se rodou o script SQL completo
- Vá em **Table Editor** para confirmar se as tabelas existem

**"Componentes não carregam"**
- Execute `npm install` novamente
- Limpe a pasta `node_modules`: `rm -rf node_modules && npm install`

## Próximos passos

- [ ] Ajustar cores/tema conforme identidade visual do escritório
- [ ] Treinar equipe no sistema
- [ ] Configurar backup automático no Supabase
- [ ] Adicionar mais campos se necessário
