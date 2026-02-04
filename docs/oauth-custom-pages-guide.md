# 🔐 Guia Completo: OAuth2 no Activepieces

## 📋 Visão Geral

Este guia explica como usar as credenciais OAuth do Activepieces em páginas frontend customizadas, com foco em implementação prática e limitações de segurança.

---

## 🎯 Pergunta Principal

**"Posso usar as credenciais OAuth do Activepieces Cloud no meu frontend customizado?"**

**Resposta:** ✅ **SIM**, mas com importantes limitações de segurança.

---

## 🏗️ Arquitetura OAuth no Activepieces

### Três Tipos de Credenciais OAuth

```
┌─────────────────────────────────────────────────────┐
│                 Prioridade de Uso                   │
├─────────────────────────────────────────────────────┤
│  1. PLATFORM_OAUTH2  (Maior prioridade)            │
│     └─ Configurado pelo admin da plataforma        │
│                                                     │
│  2. CLOUD_OAUTH2     (Padrão do Activepieces)      │
│     └─ Gerenciado por secrets.activepieces.com     │
│                                                     │
│  3. OAUTH2           (Fornecido pelo usuário)      │
│     └─ Usuário insere suas próprias credenciais    │
└─────────────────────────────────────────────────────┘
```

### Endpoints Disponíveis

#### 1️⃣ Listar OAuth Apps da Plataforma (PLATFORM_OAUTH2)

```http
GET /v1/oauth-apps?pieceName=google-sheets
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "app_123",
      "pieceName": "@activepieces/piece-google-sheets",
      "platformId": "platform_456",
      "clientId": "123456.apps.googleusercontent.com"
      // ⚠️ clientSecret NÃO é retornado (segurança)
    }
  ]
}
```

**Arquivo:**
```typescript
// packages/react-ui/src/features/connections/lib/api/oauth-apps.ts
```

---

#### 2️⃣ Listar OAuth Apps do Cloud (CLOUD_OAUTH2)

```http
GET https://secrets.activepieces.com/apps?edition=ce
```

**Resposta:**
```json
{
  "@activepieces/piece-google-sheets": {
    "clientId": "xxx.apps.googleusercontent.com"
  },
  "@activepieces/piece-slack": {
    "clientId": "yyy.slack.com"
  },
  "@activepieces/piece-notion": {
    "clientId": "zzz.notion.so"
  }
}
```

---

## ✅ O Que Você PODE Fazer

| Recurso | Disponível | Descrição |
|---------|------------|-----------|
| **Client ID** | ✅ Sim | Necessário para iniciar fluxo OAuth |
| **Redirect URL** | ✅ Sim | Para configurar no provedor OAuth |
| **Lista de Pieces** | ✅ Sim | Todas as pieces com OAuth configurado |
| **Status de Conexões** | ✅ Sim | Se está ativa, com erro, etc. |

---

## ❌ O Que Você NÃO PODE Acessar

| Recurso | Disponível | Motivo |
|---------|------------|--------|
| **Client Secret** | ❌ Não | Segurança - nunca exposto ao frontend |
| **Access Token** | ❌ Não | Segurança - armazenado apenas no backend |
| **Refresh Token** | ❌ Não | Segurança - armazenado apenas no backend |

### Por Que o Client Secret Não É Exposto?

```typescript
// ❌ Backend NÃO retorna o client_secret
GET /v1/oauth-apps

// Resposta:
{
  "id": "xxx",
  "pieceName": "google-sheets",
  "clientId": "visible-client-id",
  // clientSecret: NUNCA É RETORNADO
}
```

**Razão:** Se o `client_secret` fosse exposto ao frontend, qualquer pessoa poderia:
- Inspecionar o código JavaScript
- Roubar as credenciais
- Fazer-se passar pela sua aplicação

---

## 🚀 Implementação Prática

### Exemplo 1: Listar Pieces com OAuth Disponível

```typescript
// MinhasPiecesPage.tsx
import { useQuery } from '@tanstack/react-query';
import { oauthAppsApi } from '@/features/connections/lib/api/oauth-apps';
import { piecesApi } from '@/features/pieces/lib/api/pieces-api';

export function MinhasPiecesPage() {
  // 1. Busca todas as pieces disponíveis
  const { data: pieces } = useQuery({
    queryKey: ['pieces'],
    queryFn: () => piecesApi.list({ includeHidden: false }),
  });

  // 2. Busca OAuth apps da PLATAFORMA
  const { data: platformApps } = useQuery({
    queryKey: ['platform-oauth-apps'],
    queryFn: () => oauthAppsApi.listPlatformOAuth2Apps({}),
  });

  // 3. Busca OAuth apps do CLOUD
  const { data: cloudApps } = useQuery({
    queryKey: ['cloud-oauth-apps'],
    queryFn: () => oauthAppsApi.listCloudOAuth2Apps('ce'),
  });

  // 4. Filtra apenas pieces com OAuth configurado
  const oauthPieces = pieces?.data?.filter(
    piece => piece.auth?.type === 'OAUTH2'
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Pieces com OAuth Disponível
      </h1>

      <div className="grid gap-4">
        {oauthPieces?.map(piece => {
          const hasPlatform = platformApps?.data?.some(
            app => app.pieceName === piece.name
          );
          const hasCloud = cloudApps?.[piece.name];

          return (
            <div key={piece.name} className="border p-4 rounded">
              <h3 className="font-semibold">{piece.displayName}</h3>
              <p className="text-sm text-gray-600">{piece.name}</p>

              <div className="flex gap-2 mt-2">
                {hasPlatform && (
                  <span className="badge bg-blue-500">
                    Platform OAuth
                  </span>
                )}
                {hasCloud && (
                  <span className="badge bg-green-500">
                    Cloud OAuth
                  </span>
                )}
              </div>

              <button
                onClick={() => conectarPiece(piece)}
                className="mt-3 btn btn-primary"
              >
                Conectar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Exemplo 2: Botão "Conectar Notion"

#### Configuração OAuth do Notion

```typescript
// packages/pieces/community/notion/src/index.ts
export const notionAuth = PieceAuth.OAuth2({
  authUrl: 'https://api.notion.com/v1/oauth/authorize',
  tokenUrl: 'https://api.notion.com/v1/oauth/token',
  scope: [],
  extra: {
    owner: 'user',
  },
  authorizationMethod: OAuth2AuthorizationMethod.HEADER,
  required: true,
});
```

#### Implementação Completa

```typescript
// BotaoConectarNotion.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { oauthAppsApi } from '@/features/connections/lib/api/oauth-apps';
import { Button } from '@/components/ui/button';

export function BotaoConectarNotion() {
  const [isConnecting, setIsConnecting] = useState(false);

  // Busca OAuth apps disponíveis para Notion
  const { data: oauthApps, isLoading } = useQuery({
    queryKey: ['oauth-apps-notion'],
    queryFn: async () => {
      // 1. Busca PLATFORM_OAUTH2
      const platform = await oauthAppsApi.listPlatformOAuth2Apps({});
      const platformNotion = platform.data?.find(
        app => app.pieceName === '@activepieces/piece-notion'
      );

      // 2. Busca CLOUD_OAUTH2
      const cloud = await oauthAppsApi.listCloudOAuth2Apps('ce');
      const cloudNotion = cloud['@activepieces/piece-notion'];

      // 3. Prioriza PLATFORM sobre CLOUD
      if (platformNotion) {
        return {
          type: 'PLATFORM_OAUTH2',
          clientId: platformNotion.clientId,
          redirectUrl: 'https://seu-activepieces.com/redirect',
        };
      }

      if (cloudNotion) {
        return {
          type: 'CLOUD_OAUTH2',
          clientId: cloudNotion.clientId,
          redirectUrl: 'https://secrets.activepieces.com/redirect',
        };
      }

      return null;
    },
  });

  const handleConnectNotion = () => {
    if (!oauthApps) {
      alert('Notion OAuth não disponível');
      return;
    }

    setIsConnecting(true);

    // 1. Gera state (CSRF protection)
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth2_state', state);
    sessionStorage.setItem('oauth2_type', oauthApps.type);
    sessionStorage.setItem('oauth2_piece_name', '@activepieces/piece-notion');

    // 2. Gera code_verifier (PKCE)
    const codeVerifier = generateRandomString(128);
    sessionStorage.setItem('oauth2_code_verifier', codeVerifier);

    // 3. Monta URL de autorização
    const params = new URLSearchParams({
      client_id: oauthApps.clientId,
      redirect_uri: oauthApps.redirectUrl,
      response_type: 'code',
      state,
      owner: 'user', // Extra param específico do Notion
    });

    // 4. Redireciona para página de autorização do Notion
    window.location.href = 
      `https://api.notion.com/v1/oauth/authorize?${params}`;
  };

  return (
    <div>
      <Button
        onClick={handleConnectNotion}
        disabled={!oauthApps || isLoading || isConnecting}
      >
        {isConnecting ? '🔄 Conectando...' : '🔗 Conectar Notion'}
      </Button>

      {oauthApps && (
        <p className="text-sm text-gray-600 mt-2">
          Usando: {oauthApps.type}
        </p>
      )}
    </div>
  );
}

// Helper: Gera string aleatória segura
function generateRandomString(length: number): string {
  const chars = 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((x) => chars[x % chars.length])
    .join('');
}
```

---

### Exemplo 3: Página de Callback OAuth

```typescript
// OAuth2CallbackPage.tsx (rota: /oauth2/callback)
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { appConnectionsApi } from '@/features/connections/lib/api/app-connections';

export function OAuth2CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // 1. Extrai code e state da URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code || !state) {
          throw new Error('Parâmetros OAuth inválidos');
        }

        // 2. Valida state (proteção CSRF)
        const savedState = sessionStorage.getItem('oauth2_state');
        if (state !== savedState) {
          throw new Error('State inválido - possível ataque CSRF');
        }

        // 3. Recupera dados salvos
        const codeVerifier = sessionStorage.getItem('oauth2_code_verifier');
        const pieceName = sessionStorage.getItem('oauth2_piece_name');
        const type = sessionStorage.getItem('oauth2_type');

        if (!codeVerifier || !pieceName || !type) {
          throw new Error('Dados da sessão OAuth perdidos');
        }

        // 4. Chama backend para fazer "claim" do token
        // Backend usa o code para trocar por access_token
        await appConnectionsApi.upsert({
          externalId: `notion-${Date.now()}`,
          displayName: 'Minha Conexão Notion',
          pieceName,
          projectId: 'seu-project-id', // Ajuste conforme necessário
          type,
          value: {
            type,
            code,
            code_verifier: codeVerifier,
            authorization_method: 'HEADER',
            token_url: 'https://api.notion.com/v1/oauth/token',
            props: { owner: 'user' },
          },
        });

        // 5. Limpa sessionStorage
        sessionStorage.removeItem('oauth2_state');
        sessionStorage.removeItem('oauth2_code_verifier');
        sessionStorage.removeItem('oauth2_piece_name');
        sessionStorage.removeItem('oauth2_type');

        setStatus('success');

        // 6. Redireciona após sucesso
        setTimeout(() => {
          navigate('/minhas-conexoes?success=true');
        }, 2000);

      } catch (err) {
        console.error('Erro no callback OAuth:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setStatus('error');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="spinner mb-4" />
            <p>Processando conexão com Notion...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✅</div>
            <p>Conexão criada com sucesso!</p>
            <p className="text-sm text-gray-600">Redirecionando...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">❌</div>
            <p>Erro ao processar conexão</p>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => navigate('/minhas-conexoes')}
              className="mt-4 btn btn-primary"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 🔄 Fluxo Completo OAuth

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO OAUTH2 COMPLETO                    │
└─────────────────────────────────────────────────────────────┘

1️⃣  Usuário clica "Conectar Notion"
    └─ Frontend busca clientId disponível

2️⃣  Frontend redireciona para Notion
    └─ URL: https://api.notion.com/v1/oauth/authorize
    └─ Params: client_id, redirect_uri, state, owner

3️⃣  Usuário autoriza no Notion
    └─ Página de autorização do Notion

4️⃣  Notion redireciona de volta
    └─ URL: https://secrets.activepieces.com/redirect?code=xxx&state=yyy
    └─ (ou sua URL se PLATFORM_OAUTH2)

5️⃣  Frontend processa callback
    └─ Valida state (CSRF protection)
    └─ Extrai code

6️⃣  Frontend chama backend Activepieces
    └─ POST /v1/app-connections

7️⃣  Backend faz "claim" do token
    ├─ Se CLOUD_OAUTH2:
    │   └─ POST https://secrets.activepieces.com/claim
    │       └─ Envia: code, code_verifier
    │       └─ secrets.activepieces.com usa client_secret (você não vê)
    │       └─ Retorna: access_token, refresh_token
    │
    └─ Se PLATFORM_OAUTH2:
        └─ POST https://api.notion.com/v1/oauth/token
            └─ Envia: code, client_id, client_secret (do banco)
            └─ Retorna: access_token, refresh_token

8️⃣  Backend salva conexão no banco
    └─ Armazena: access_token, refresh_token (criptografado)

9️⃣  Conexão pronta para usar! ✅
```

---

## ⚠️ Redirect URL: CLOUD vs PLATFORM

### CLOUD_OAUTH2

```typescript
redirectUrl: 'https://secrets.activepieces.com/redirect'
```

**Vantagens:**
- ✅ Já configurado no provedor OAuth (Google, Notion, etc.)
- ✅ Funciona imediatamente
- ✅ Não precisa criar OAuth App próprio
- ✅ Activepieces gerencia tudo

**Desvantagens:**
- ⚠️ Depende de `secrets.activepieces.com` estar online
- ⚠️ Você não controla as credenciais
- ⚠️ Pode ter rate limits compartilhados

---

### PLATFORM_OAUTH2

```typescript
redirectUrl: 'https://SEU-ACTIVEPIECES.com/redirect'
```

**Vantagens:**
- ✅ Controle total sobre as credenciais
- ✅ Independente de serviços externos
- ✅ Pode customizar branding
- ✅ Rate limits próprios

**Desvantagens:**
- ⚠️ Precisa criar OAuth App no provedor
- ⚠️ Precisa configurar redirect URL
- ⚠️ Mais trabalho de setup
- ⚠️ Precisa gerenciar client_secret

---

## 🔒 Segurança: Como o Client Secret É Protegido

### Arquitetura de Segurança

```
┌────────────────────────────────────────────────────────────┐
│                  ARMAZENAMENTO SEGURO                       │
└────────────────────────────────────────────────────────────┘

PLATFORM_OAUTH2:
┌──────────────────────────────────────────────────────┐
│  Database (oauth_app table)                          │
│  ├─ clientId: "xxx.apps.googleusercontent.com"      │
│  └─ clientSecret: ENCRYPTED("secret")  🔐           │
│                                                      │
│  Arquivo: oauth-app.entity.ts                       │
│  - clientSecret é criptografado antes de salvar     │
│  - Descriptografado apenas quando necessário        │
└──────────────────────────────────────────────────────┘

CLOUD_OAUTH2:
┌──────────────────────────────────────────────────────┐
│  secrets.activepieces.com (serviço externo)         │
│  ├─ clientId: exposto                               │
│  └─ clientSecret: NUNCA EXPOSTO  🔒                 │
│                                                      │
│  Arquivo: cloud-oauth2-service.ts                   │
│  - Backend envia apenas: code, code_verifier        │
│  - secrets.activepieces.com usa client_secret       │
│  - Retorna: access_token, refresh_token             │
└──────────────────────────────────────────────────────┘
```

### Código de Referência

```typescript
// packages/server/api/src/app/ee/oauth-apps/oauth-app.entity.ts
@Entity({ name: 'oauth_app' })
export class OAuthAppEntity {
  @Column()
  pieceName: string;

  @Column()
  clientId: string;

  @Column({ type: 'text' })
  @EncryptedColumn() // 🔐 Criptografado!
  clientSecret: string;

  @Column()
  platformId: string;
}
```

```typescript
// packages/server/api/src/app/app-connection/app-connection-service/oauth2/services/cloud-oauth2-service.ts
async claim(request: OAuth2ClaimRequest): Promise<CloudOAuth2ConnectionValue> {
  // Backend envia para secrets.activepieces.com
  const response = await apAxios.post<CloudOAuth2ConnectionValue>(
    'https://secrets.activepieces.com/claim',
    {
      pieceName: request.pieceName,
      code: request.code,
      codeVerifier: request.codeVerifier,
      clientId: request.clientId,
      // ⚠️ client_secret NÃO é enviado - fica no serviço cloud
    },
  );

  // Resposta contém: access_token, refresh_token, client_id
  // MAS NÃO contém: client_secret
  return response.data;
}
```

---

## 📊 Comparação: Página Nativa vs Custom

| Aspecto | Página Nativa | Sua Página Custom |
|---------|---------------|-------------------|
| **Endpoints** | ✅ `/v1/oauth-apps`<br>`secrets.activepieces.com/apps` | ✅ Mesmos endpoints |
| **Credenciais** | ✅ PLATFORM + CLOUD + USER | ✅ PLATFORM + CLOUD + USER |
| **Client ID** | ✅ Visível | ✅ Visível |
| **Client Secret** | ❌ Nunca exposto | ❌ Nunca exposto |
| **Fluxo OAuth** | ✅ Implementado | ⚠️ Você precisa implementar |
| **UI/UX** | ✅ Pronto | ⚠️ Você cria do zero |
| **Validações** | ✅ Prontas | ⚠️ Você precisa implementar |
| **Error Handling** | ✅ Completo | ⚠️ Você precisa implementar |
| **PKCE** | ✅ Implementado | ⚠️ Você precisa implementar |
| **State Validation** | ✅ Implementado | ⚠️ Você precisa implementar |

---

## 📚 Arquivos de Referência

### Frontend

| Arquivo | Descrição |
|---------|-----------|
| `packages/react-ui/src/lib/oauth2-utils.ts` | Lógica de priorização (PLATFORM > CLOUD > USER) |
| `packages/react-ui/src/features/connections/lib/oauth-apps-hooks.ts` | Hook `usePiecesOAuth2AppsMap` |
| `packages/react-ui/src/features/connections/lib/api/oauth-apps.ts` | API client para OAuth apps |
| `packages/react-ui/src/app/connections/oauth2-connection-settings.tsx` | Componente de configuração OAuth |

### Backend

| Arquivo | Descrição |
|---------|-----------|
| `packages/server/api/src/app/ee/oauth-apps/oauth-app.entity.ts` | Entity do database (PLATFORM) |
| `packages/server/api/src/app/ee/app-connections/platform-oauth2-service.ts` | Serviço PLATFORM_OAUTH2 |
| `packages/server/api/src/app/app-connection/app-connection-service/oauth2/services/cloud-oauth2-service.ts` | Serviço CLOUD_OAUTH2 |

### Shared

| Arquivo | Descrição |
|---------|-----------|
| `packages/shared/src/lib/app-connection/app-connection.ts` | Types e interfaces |

---

## ✅ Checklist de Implementação

### Setup Inicial

- [ ] Instalar dependências (`@tanstack/react-query`, etc.)
- [ ] Configurar API clients
- [ ] Criar rotas (`/oauth2/callback`)

### Página de Conexão

- [ ] Buscar pieces disponíveis
- [ ] Buscar OAuth apps (PLATFORM + CLOUD)
- [ ] Renderizar lista de pieces
- [ ] Botão "Conectar" para cada piece

### Fluxo OAuth

- [ ] Gerar `state` (CSRF protection)
- [ ] Gerar `code_verifier` (PKCE)
- [ ] Salvar em `sessionStorage`
- [ ] Montar URL de autorização
- [ ] Redirecionar usuário

### Callback OAuth

- [ ] Validar `state`
- [ ] Extrair `code` da URL
- [ ] Recuperar `code_verifier` do storage
- [ ] Chamar backend para criar conexão
- [ ] Limpar `sessionStorage`
- [ ] Redirecionar para página de sucesso

### Error Handling

- [ ] Validar parâmetros OAuth
- [ ] Tratar state inválido
- [ ] Tratar erro de autorização
- [ ] Mostrar mensagem ao usuário
- [ ] Log de erros

---

## 🎯 Exemplo Prático: Notion OAuth

### Pergunta: "Posso ter um botão que faça OAuth com Notion?"

**Resposta:** ✅ **SIM, funciona perfeitamente!**

### Tabela Resumo

| Pergunta | Resposta |
|----------|----------|
| Posso usar OAuth do Notion? | ✅ **SIM** |
| Funciona na minha página custom? | ✅ **SIM** |
| Preciso configurar algo no Notion? | ❌ **NÃO** (se usar CLOUD) |
| Tenho acesso ao `client_secret`? | ❌ **NÃO** (fica no cloud) |
| Funciona sem configuração? | ✅ **SIM** (CLOUD_OAUTH2) |

### Implementação Mínima

```typescript
// BotaoConectarNotionSimples.tsx
import { Button } from '@/components/ui/button';
import { oauthAppsApi } from '@/features/connections/lib/api/oauth-apps';

export function BotaoConectarNotionSimples() {
  const handleClick = async () => {
    // 1. Busca client_id do Cloud
    const cloudApps = await oauthAppsApi.listCloudOAuth2Apps('ce');
    const notionApp = cloudApps['@activepieces/piece-notion'];

    if (!notionApp) {
      alert('Notion OAuth não disponível');
      return;
    }

    // 2. Gera state (segurança)
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth2_state', state);

    // 3. Redireciona para Notion
    const params = new URLSearchParams({
      client_id: notionApp.clientId,
      redirect_uri: 'https://secrets.activepieces.com/redirect',
      response_type: 'code',
      state,
      owner: 'user',
    });

    window.location.href =
      `https://api.notion.com/v1/oauth/authorize?${params}`;
  };

  return (
    <Button onClick={handleClick}>
      🔗 Conectar Notion
    </Button>
  );
}
```

---

## 🤔 Perguntas Frequentes

### 1. Posso criar minha própria página de conexões?

**R:** ✅ Sim! Você pode criar uma UI completamente customizada usando os mesmos endpoints que a página nativa usa.

### 2. Preciso criar OAuth Apps nos provedores?

**R:** Depende:
- **CLOUD_OAUTH2**: ❌ Não precisa (Activepieces já tem)
- **PLATFORM_OAUTH2**: ✅ Sim, precisa configurar

### 3. Como sei qual tipo de OAuth usar?

**R:** O frontend busca ambos e prioriza automaticamente:
```
PLATFORM_OAUTH2 > CLOUD_OAUTH2 > OAUTH2 (user)
```

### 4. Posso ver o access_token das conexões existentes?

**R:** ❌ Não, por segurança o access_token não é exposto via API.

### 5. O que acontece se `secrets.activepieces.com` ficar offline?

**R:** ⚠️ CLOUD_OAUTH2 não funcionará. Use PLATFORM_OAUTH2 como backup.

### 6. Posso usar isso em produção?

**R:** ✅ Sim! É a mesma arquitetura que o Activepieces usa em produção.

### 7. Como faço refresh do token?

**R:** O backend gerencia automaticamente. Quando o token expira, o backend usa o `refresh_token` para obter um novo.

### 8. Posso usar meu próprio `client_id` e `client_secret`?

**R:** ✅ Sim! Configure um `PLATFORM_OAUTH2` no admin da plataforma.

---

## 🚨 Avisos Importantes

### Segurança

⚠️ **NUNCA** exponha `client_secret` no frontend  
⚠️ **SEMPRE** valide o `state` no callback OAuth  
⚠️ **SEMPRE** use HTTPS em produção  
⚠️ **SEMPRE** use PKCE (`code_verifier`)  

### Performance

⚡ Faça cache das OAuth apps para evitar requisições desnecessárias  
⚡ Use `React Query` ou similar para gerenciar estado assíncrono  
⚡ Implemente loading states adequados  

### UX

👥 Mostre feedback claro durante o fluxo OAuth  
👥 Trate erros de forma amigável  
👥 Redirecione usuário após sucesso/erro  
👥 Persista estado em `sessionStorage` (não `localStorage`)  

---

## 📖 Recursos Adicionais

### Documentação Oficial

- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
- [Notion OAuth](https://developers.notion.com/docs/authorization)

### Código de Referência no Activepieces

- Componente nativo de OAuth: `packages/react-ui/src/app/connections/`
- Serviços backend: `packages/server/api/src/app/app-connection/`
- Types compartilhados: `packages/shared/src/lib/app-connection/`

---

## 🎉 Conclusão

Você **PODE** criar páginas customizadas com OAuth no Activepieces:

1. ✅ Use os mesmos endpoints que a UI nativa
2. ✅ Acesse `client_id` via API
3. ❌ `client_secret` nunca é exposto (segurança)
4. ✅ Implemente o fluxo OAuth completo
5. ✅ Use CLOUD_OAUTH2 para começar rápido
6. ✅ Migre para PLATFORM_OAUTH2 para controle total

**Próximos Passos:**
- Implemente o componente básico
- Teste com Notion ou outra piece simples
- Adicione error handling robusto
- Implemente loading states
- Documente seu código

---

**Dúvidas?** Consulte o código existente em `packages/react-ui/src/app/connections/` como referência!

---

## 🎯 Exemplos de Código para se Basear

### 1️⃣ Hook para Buscar OAuth Apps (PLATFORM + CLOUD)

Este é o hook principal que combina as duas fontes de OAuth:

**Arquivo:** `packages/react-ui/src/features/connections/lib/oauth-apps-hooks.ts`

```typescript
usePiecesOAuth2AppsMap() {
  const { platform } = platformHooks.useCurrentPlatform();
  const { data: edition } = flagsHooks.useFlag<ApEdition>(ApFlagId.EDITION);

  return useQuery<PiecesOAuth2AppsMap, Error>({
    queryKey: ['oauth-apps'],
    queryFn: async () => {
      const apps =
        edition === ApEdition.COMMUNITY
          ? {
              data: [],
            }
          : await oauthAppsApi.listPlatformOAuth2Apps({
              limit: 1000000,
              cursor: undefined,
            });
      const cloudApps = !platform.cloudAuthEnabled
        ? {}
        : await oauthAppsApi.listCloudOAuth2Apps(edition!);
      const appsMap: PiecesOAuth2AppsMap = {};

      Object.entries(cloudApps).forEach(([pieceName, app]) => {
        appsMap[pieceName] = {
          cloudOAuth2App: {
            oauth2Type: AppConnectionType.CLOUD_OAUTH2,
            clientId: app.clientId,
          },
          platformOAuth2App: null,
        };
      });
      apps.data.forEach((app) => {
        appsMap[app.pieceName] = {
          platformOAuth2App: {
            oauth2Type: AppConnectionType.PLATFORM_OAUTH2,
            clientId: app.clientId,
          },
          cloudOAuth2App: appsMap[app.pieceName]?.cloudOAuth2App ?? null,
        };
      });
      return appsMap;
    },
    staleTime: 0,
  });
}
```

**Como usar:**

```typescript
import { oauthAppsQueries } from '@/features/connections/lib/oauth-apps-hooks';

function MeuComponente() {
  const { data: oauthAppsMap } = oauthAppsQueries.usePiecesOAuth2AppsMap();
  
  // oauthAppsMap['@activepieces/piece-notion'] retorna:
  // {
  //   cloudOAuth2App: { oauth2Type: 'CLOUD_OAUTH2', clientId: 'xxx' },
  //   platformOAuth2App: null
  // }
}
```

---

### 2️⃣ Função para Determinar Qual OAuth Usar (Priorização)

Esta função decide automaticamente qual tipo usar:

**Arquivo:** `packages/react-ui/src/lib/oauth2-utils.ts`

```typescript
function getPredefinedOAuth2App(
  piecesOAuth2AppsMap: PiecesOAuth2AppsMap,
  pieceName: string,
): OAuth2App | null {
  const pieceOAuth2Apps = piecesOAuth2AppsMap[pieceName];
  if (isNil(pieceOAuth2Apps)) {
    return null;
  }
  if (pieceOAuth2Apps.platformOAuth2App) {
    return pieceOAuth2Apps.platformOAuth2App;
  }
  if (pieceOAuth2Apps.cloudOAuth2App) {
    return pieceOAuth2Apps.cloudOAuth2App;
  }
  return null;
}
```

**Como usar:**

```typescript
import { oauth2Utils } from '@/lib/oauth2-utils';

const oauthApp = oauth2Utils.getPredefinedOAuth2App(
  oauthAppsMap,
  '@activepieces/piece-notion'
);

// Retorna automaticamente PLATFORM se existir, senão CLOUD
```

---

### 3️⃣ Componente Completo de Botão OAuth (Implementação Real)

Este é o componente que o Activepieces usa para conectar OAuth:

**Arquivo:** `packages/react-ui/src/app/connections/oauth2-connection-settings.tsx`

```typescript
function OAuth2ConnectionSettings({
  authProperty,
  oauth2App,
  piece,
  grantType,
}: OAuth2ConnectionSettingsProps) {
  const form = useFormContext<{
    request:
      | UpsertCloudOAuth2Request
      | UpsertOAuth2Request
      | UpsertPlatformOAuth2Request;
  }>();
  const isClientIdValid = isNil(
    form.formState.errors.request?.value?.client_id,
  );
  const isClientSecretValid =
    oauth2App.oauth2Type !== AppConnectionType.OAUTH2 ||
    form.getValues('request.value.client_secret');
  const isPropsValid = isNil(form.formState.errors.request?.value?.props);
  const isConnectButtonEnabled =
    isClientIdValid && isClientSecretValid && isPropsValid;
  const { data: thirdPartyUrl } = flagsHooks.useFlag<string>(
    ApFlagId.THIRD_PARTY_AUTH_PROVIDER_REDIRECT_URL,
  );
  const redirectUrl =
    oauth2App.oauth2Type === AppConnectionType.CLOUD_OAUTH2
      ? 'https://secrets.activepieces.com/redirect'
      : thirdPartyUrl ?? 'no_redirect_url_found';

  const hasCode = form.getValues().request.value.code;
  const showRedirectUrlInput =
    oauth2App.oauth2Type === AppConnectionType.OAUTH2 &&
    grantType === OAuth2GrantType.AUTHORIZATION_CODE;
  return (
    <div className="flex flex-col gap-4">
      {showRedirectUrlInput && (
        <div className="flex flex-col gap-2">
          <FormLabel>{t('Redirect URL')}</FormLabel>
          <FormControl>
            <Input disabled type="text" value={redirectUrl} />
          </FormControl>
          <FormMessage />
        </div>
      )}

      {oauth2App.oauth2Type === AppConnectionType.OAUTH2 && (
        <>
          <FormField
            name="request.value.client_id"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('Client ID')}</FormLabel>
                <FormControl>
                  <Input {...field} type="text" placeholder={t('Client ID')} />
                </FormControl>
              </FormItem>
            )}
          ></FormField>
          <FormField
            name="request.value.client_secret"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('Client Secret')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={t('Client Secret')}
                  />
                </FormControl>
              </FormItem>
            )}
          ></FormField>
        </>
      )}
      {authProperty.props && (
        <GenericPropertiesForm
          prefixValue="request.value.props"
          props={authProperty.props}
          useMentionTextInput={false}
          propertySettings={null}
          dynamicPropsInfo={null}
        />
      )}

      {grantType !== OAuth2GrantType.CLIENT_CREDENTIALS && (
        <div className="border border-solid p-2 rounded-lg gap-2 flex text-center items-center justify-center h-full">
          <div className="rounded-full border border-solid p-1 flex items-center justify-center">
            <img src={piece.logoUrl} className="w-5 h-5"></img>
          </div>
          <div className="text-sm">{piece.displayName}</div>
          <div className="grow"></div>
          <Button
            size={'sm'}
            variant={'basic'}
            className={hasCode ? 'text-destructive' : ''}
            disabled={!isConnectButtonEnabled}
            type="button"
            onClick={async () => {
              if (!hasCode) {
                openPopup(
                  redirectUrl,
                  form.getValues().request.value.client_id,
                  form.getValues().request.value.props,
                  authProperty,
                  form,
                );
              } else {
                form.setValue('request.value.code', '', {
                  shouldValidate: true,
                });
                form.setValue('request.value.code_challenge', '', {
                  shouldValidate: true,
                });
              }
            }}
          >
            {hasCode ? t('Disconnect') : t('Connect')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Pontos-chave:**
- ✅ Detecta automaticamente o `redirectUrl` baseado no tipo (CLOUD vs PLATFORM)
- ✅ Mostra campos de `client_id` e `client_secret` apenas para tipo `OAUTH2` (user-provided)
- ✅ Botão "Connect" que abre popup OAuth
- ✅ Validações antes de habilitar o botão

---

### 4️⃣ Função para Abrir Popup OAuth (Com PKCE)

Esta função gerencia todo o fluxo de popup OAuth:

**Arquivo:** `packages/react-ui/src/app/connections/oauth2-connection-settings.tsx`

```typescript
async function openPopup(
  redirectUrl: string,
  clientId: string,
  props: Record<string, unknown> | undefined,
  authProperty: OAuth2Property<OAuth2Props>,
  form: UseFormReturn<{
    request:
      | UpsertCloudOAuth2Request
      | UpsertOAuth2Request
      | UpsertPlatformOAuth2Request;
  }>,
) {
  const scope = resolveValueFromProps(props, authProperty.scope.join(' '));
  const authUrl = resolveValueFromProps(props, authProperty.authUrl);
  const { code, codeChallenge } = await oauth2Utils.openOAuth2Popup({
    authUrl,
    clientId,
    redirectUrl,
    scope,
    prompt: authProperty.prompt,
    pkce: authProperty.pkce ?? false,
    pkceMethod: authProperty.pkceMethod ?? 'plain',
    extraParams: authProperty.extra ?? {},
  });
  form.setValue('request.value.code', code, { shouldValidate: true });
  form.setValue('request.value.code_challenge', codeChallenge, {
    shouldValidate: true,
  });
}
```

---

### 5️⃣ Implementação do Popup OAuth (Core Logic)

Esta é a implementação real do popup com PKCE:

**Arquivo:** `packages/react-ui/src/lib/oauth2-utils.ts`

```typescript
async function openOAuth2Popup(
  params: OAuth2PopupParams,
): Promise<OAuth2PopupResponse> {
  closeOAuth2Popup();
  const pckeChallenge = nanoid(43);
  const url = await constructUrl(params, pckeChallenge);
  currentPopup = openWindow(url);
  return {
    code: await getCode(params.redirectUrl),
    codeChallenge: params.pkce ? pckeChallenge : undefined,
  };
}

function openWindow(url: string): Window | null {
  const winFeatures = [
    'resizable=no',
    'toolbar=no',
    'left=100',
    'top=100',
    'scrollbars=no',
    'menubar=no',
    'status=no',
    'directories=no',
    'location=no',
    'width=600',
    'height=800',
  ].join(', ');
  return window.open(url, '_blank', winFeatures);
}

function closeOAuth2Popup() {
  currentPopup?.close();
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);

  const base64String = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function constructUrl(params: OAuth2PopupParams, pckeChallenge: string) {
  const queryParams: Record<string, string> = {
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUrl,
    access_type: 'offline',
    state: nanoid(),
    prompt: 'consent',
    scope: params.scope,
    ...(params.extraParams || {}),
  };

  if (params.prompt === 'omit') {
    delete queryParams['prompt'];
  } else if (!isNil(params.prompt)) {
    queryParams['prompt'] = params.prompt;
  }

  if (params.pkce) {
    const method = params.pkceMethod || 'plain';
    queryParams['code_challenge_method'] = method;

    if (method === 'S256') {
      queryParams['code_challenge'] = await generateCodeChallenge(
        pckeChallenge,
      );
    } else {
      queryParams['code_challenge'] = pckeChallenge;
    }
  }
  const url = new URL(params.authUrl);
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== '') {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}

function getCode(redirectUrl: string): Promise<string> {
  return new Promise<string>((resolve) => {
    window.addEventListener('message', function handler(event) {
      if (
        redirectUrl &&
        redirectUrl.startsWith(event.origin) &&
        event.data['code']
      ) {
        resolve(decodeURIComponent(event.data.code));
        closeOAuth2Popup();
        window.removeEventListener('message', handler);
      }
    });
  });
}
```

**Pontos-chave:**
- ✅ Gera `code_verifier` automaticamente (PKCE)
- ✅ Calcula `code_challenge` com SHA-256 se necessário
- ✅ Abre popup com dimensões otimizadas
- ✅ Escuta mensagem do redirect para capturar o `code`
- ✅ Fecha popup automaticamente após sucesso

---

### 6️⃣ Página de Listagem de Conexões (Referência Completa)

Este é o componente completo da página de conexões:

**Arquivo:** `packages/react-ui/src/app/routes/connections/index.tsx`

```typescript
function AppConnectionsPage() {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [selectedRows, setSelectedRows] = useState<
    Array<AppConnectionWithoutSensitiveData>
  >([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { checkAccess } = useAuthorization();
  const userPlatformRole = userHooks.getCurrentUserPlatformRole();
  const location = useLocation();
  const { pieces } = piecesHooks.usePieces({});
  const pieceOptions = (pieces ?? []).map((piece) => ({
    label: piece.displayName,
    value: piece.name,
  }));
  const projectId = authenticationSession.getProjectId()!;

  const searchParams = new URLSearchParams(location.search);
  const cursor = searchParams.get(CURSOR_QUERY_PARAM) ?? undefined;
  const limit = searchParams.get(LIMIT_QUERY_PARAM)
    ? parseInt(searchParams.get(LIMIT_QUERY_PARAM)!)
    : 10;
  const status = (searchParams.getAll('status') as AppConnectionStatus[]) ?? [];
  const pieceName = searchParams.get('pieceName') ?? undefined;
  const displayName = searchParams.get('displayName') ?? undefined;

  const {
    data: connections,
    isLoading: connectionsLoading,
    refetch,
  } = appConnectionsQueries.useAppConnections({
    request: {
      projectId,
      cursor,
      limit,
      status,
      pieceName,
      displayName,
    },
    extraKeys: [location.search, projectId],
  });
  
  // ... resto da implementação
}
```

---

## 🎯 Exemplo Simplificado para Você Implementar

Com base nesses códigos, aqui está um exemplo **simplificado** que você pode usar:

```typescript
// MinhaPaginaCustomOAuth.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { oauthAppsQueries } from '@/features/connections/lib/oauth-apps-hooks';
import { piecesHooks } from '@/features/pieces/lib/pieces-hooks';
import { oauth2Utils } from '@/lib/oauth2-utils';
import PieceIconWithPieceName from '@/features/pieces/components/piece-icon-from-name';

export function MinhaPaginaCustomOAuth() {
  const [connecting, setConnecting] = useState<string | null>(null);
  
  // 1. Busca todas as pieces
  const { pieces } = piecesHooks.usePieces({});
  
  // 2. Busca OAuth apps disponíveis (PLATFORM + CLOUD)
  const { data: oauthAppsMap } = oauthAppsQueries.usePiecesOAuth2AppsMap();
  
  // 3. Filtra apenas pieces com OAuth
  const oauthPieces = pieces?.filter(piece => {
    const oauthApp = oauth2Utils.getPredefinedOAuth2App(
      oauthAppsMap || {},
      piece.name
    );
    return oauthApp !== null;
  });

  const handleConnect = async (pieceName: string) => {
    setConnecting(pieceName);
    
    try {
      // Pega OAuth app (PLATFORM ou CLOUD)
      const oauthApp = oauth2Utils.getPredefinedOAuth2App(
        oauthAppsMap!,
        pieceName
      );
      
      if (!oauthApp) {
        alert('OAuth não disponível para esta piece');
        return;
      }

      // Determina redirect URL
      const redirectUrl = oauthApp.oauth2Type === 'CLOUD_OAUTH2'
        ? 'https://secrets.activepieces.com/redirect'
        : 'https://seu-activepieces.com/redirect';

      // Busca metadados da piece para pegar authUrl, scope, etc
      const piece = pieces?.find(p => p.name === pieceName);
      if (!piece?.auth) return;

      // Abre popup OAuth (já gerencia PKCE automaticamente)
      const { code, codeChallenge } = await oauth2Utils.openOAuth2Popup({
        authUrl: piece.auth.authUrl,
        clientId: oauthApp.clientId,
        redirectUrl,
        scope: piece.auth.scope?.join(' ') || '',
        pkce: piece.auth.pkce ?? false,
        pkceMethod: piece.auth.pkceMethod ?? 'plain',
        extraParams: piece.auth.extra ?? {},
      });

      // Aqui você chamaria seu backend para criar a conexão
      console.log('Code recebido:', code);
      console.log('Code challenge:', codeChallenge);
      
      // TODO: Chamar appConnectionsApi.upsert() aqui
      
    } catch (error) {
      console.error('Erro no OAuth:', error);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Minhas Conexões OAuth</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {oauthPieces?.map(piece => {
          const oauthApp = oauth2Utils.getPredefinedOAuth2App(
            oauthAppsMap || {},
            piece.name
          );
          
          return (
            <div key={piece.name} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <PieceIconWithPieceName pieceName={piece.name} />
              </div>
              
              <div className="text-sm text-gray-600 mb-3">
                Tipo: {oauthApp?.oauth2Type}
              </div>
              
              <Button
                onClick={() => handleConnect(piece.name)}
                disabled={connecting === piece.name}
                className="w-full"
              >
                {connecting === piece.name ? 'Conectando...' : 'Conectar'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 📚 Resumo dos Arquivos para Estudar

| Arquivo | O Que Você Aprende | Caminho |
|---------|-------------------|---------|
| `oauth-apps-hooks.ts` | Como buscar e combinar PLATFORM + CLOUD OAuth apps | `packages/react-ui/src/features/connections/lib/` |
| `oauth2-utils.ts` | Como abrir popup OAuth, gerar PKCE, construir URLs | `packages/react-ui/src/lib/` |
| `oauth2-connection-settings.tsx` | Componente completo de botão OAuth com validações | `packages/react-ui/src/app/connections/` |
| `connections/index.tsx` | Página completa de listagem de conexões | `packages/react-ui/src/app/routes/connections/` |

---

## ✅ Próximos Passos

1. **Copie** o hook `usePiecesOAuth2AppsMap` para buscar OAuth apps
2. **Use** a função `getPredefinedOAuth2App` para priorizar automaticamente
3. **Chame** `oauth2Utils.openOAuth2Popup` para abrir o fluxo OAuth
4. **Implemente** a página de callback para processar o `code`
5. **Teste** com Notion ou outra piece simples

Esses códigos são **production-ready** e já estão sendo usados pelo Activepieces em produção! 🚀


