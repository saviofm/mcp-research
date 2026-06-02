# Joule MCP Research Server

Servidor MCP remoto em **SAP CAP Node.js / JavaScript puro** para agentes Joule. Expõe tools de pesquisa web que chamam o modelo **Perplexity Sonar** exclusivamente via **SAP Generative AI Hub / SAP AI Core** — nunca diretamente.

---

## Visão Geral

```
Joule Agent
  └─► MCP Client / Tool Call
        └─► CAP MCP Server (Cloud Foundry /mcp)
              └─► SAP Generative AI Hub / Orchestration Service
                    └─► Perplexity Sonar (sonar / sonar-pro)
                          └─► Resposta: answer + citations + sources
              └─► Joule Agent
```

---

## Diferença: cds-mcp vs Servidor MCP Runtime

| | cds-mcp (`@cap-js/mcp-server`) | Servidor MCP Runtime (este projeto) |
|---|---|---|
| **Função** | Apoio ao desenvolvimento no Claude Code | Servidor que o Joule consome em runtime |
| **Onde roda** | Local, no Claude Code | Cloud Foundry / BTP |
| **Quem usa** | Claude Code (desenvolvedor) | Agente Joule / MCP Client |
| **Endpoint** | Stdio (MCP local) | HTTP POST `/mcp` |
| **Deploy** | Não faz deploy | Deploy via MTA |

---

## Diferença: AI Core Service Instance, Resource Group e Resource no MTA

| Conceito | Valor padrão | Onde configurar |
|---|---|---|
| **Resource lógico no MTA** | `aicore-default` | `mta.yaml` (nome lógico) |
| **Service instance no Cloud Foundry** | `default_aicore` | `mta.yaml` → `service-name: default_aicore` |
| **AI Core Resource Group** | `default` | Env `AICORE_RESOURCE_GROUP=default` |

> O resource group é uma divisão lógica dentro do AI Core (não é o nome da service instance no CF).  
> O projeto espera que o resource group `default` **já exista** no seu tenant AI Core.

---

## Instalação

```bash
npm install
```

---

## Rodar Local (sem autenticação)

```bash
cp .env.example .env
# Edite .env se necessário
cds watch
```

O servidor inicia em `http://localhost:4004`.

- `GET  /health` → healthcheck público
- `POST /mcp`    → endpoint MCP (sem auth com `MCP_REQUIRE_AUTH=false`)

---

## Modo Híbrido com `.cdsrc-private.json`

O modo hybrid permite rodar localmente usando os serviços BTP reais (AI Core, XSUAA).

### 1. Login no Cloud Foundry

```bash
cf login
cf target -o <sua-org> -s <seu-space>
```

### 2. Bind das instâncias necessárias

```bash
# Bind do AI Core (instância existente chamada "default_aicore")
cds bind aicore --to default_aicore

# Bind do XSUAA (se quiser testar autenticação localmente)
cds bind auth --to <nome-da-instancia-xsuaa> --kind xsuaa
```

O `cds bind` cria/atualiza `.cdsrc-private.json` com as credenciais resolvidas.  
**Este arquivo está no `.gitignore` e nunca deve ser versionado.**

### 3. Rodar em modo híbrido

```bash
cds watch --profile hybrid
```

### 4. Inspecionar configuração resolvida

```bash
cds env get requires --profile hybrid --resolve-bindings
```

### 5. Exemplo de `.cdsrc-private.json` (estrutura, sem valores reais)

```json
{
  "requires": {
    "aicore": {
      "vcap": {
        "label": "aicore",
        "credentials": {
          "clientid": "...",
          "clientsecret": "...",
          "url": "...",
          "serviceurls": { "AI_API_URL": "..." }
        }
      }
    }
  }
}
```

> ⚠️ Nunca versione valores reais. O arquivo acima é apenas estrutura de exemplo.

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `AICORE_RESOURCE_GROUP` | `default` | Resource group no AI Core (deve existir previamente) |
| `GENAIHUB_MODEL_NAME` | `sonar` | Nome do modelo no Generative AI Hub |
| `GENAIHUB_MODEL_VERSION` | `latest` | Versão do modelo |
| `GENAIHUB_ALLOWED_MODELS` | `sonar,sonar-pro` | Allowlist de modelos permitidos |
| `MCP_REQUIRE_AUTH` | `false` | `true` em produção — exige Bearer Token XSUAA |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |
| `PORT` | `4004` | Porta local |

> ⚠️ **Nunca** defina `PERPLEXITY_API_KEY`. O projeto não usa chamada direta à Perplexity.

### Nome do Modelo

O nome exato do modelo Perplexity Sonar no seu tenant deve ser validado em:

**AI Launchpad → ML Operations → Models**

Valores possíveis: `sonar`, `sonar-pro`. Use `GENAIHUB_MODEL_NAME` para ajustar.

---

## Testes

```bash
node --test test/**/*.test.js
```

Usa o **Node.js test runner nativo** (sem dependências externas). Testa:
- Healthcheck
- Validação de query vazia/longa
- maxSources acima do limite
- Autenticação: sem token → 401
- Guardrail: query com PII → bloqueada
- Estrutura de erro: sem stack trace, sem tokens
- Registry de tools: 4 tools presentes
- Ausência de `PERPLEXITY_API_KEY`

---

## Deploy com MTA no BTP Cloud Foundry

### Pré-requisitos no AI Launchpad (obrigatório antes do deploy)

O MTA **não cria** Configuration nem Deployment no AI Core — esses objetos precisam existir previamente. Sem um Deployment em status `RUNNING` para o modelo `sonar` no resource group `default`, todas as chamadas ao Generative AI Hub falharão.

**Checklist no AI Launchpad antes de fazer o deploy:**

- [ ] Acesse: **AI Launchpad → selecione a instância `default_aicore` → resource group `default`**
- [ ] **ML Operations → Configurations → Create**
  - Scenario: `foundation-models`
  - Executable: selecione o executável correspondente ao Perplexity Sonar listado no seu tenant
  - Model: confirme o nome exato (ex: `sonar` ou `sonar-pro`) em **ML Operations → Models**
  - Name: qualquer nome descritivo, ex: `perplexity-sonar-default`
- [ ] **ML Operations → Deployments → Create** a partir da configuration acima
  - Aguarde o status mudar para `RUNNING` (pode levar alguns minutos)
- [ ] Anote o nome exato do modelo e ajuste `GENAIHUB_MODEL_NAME` no `mta.yaml` e `.env` se necessário

> ⚠️ **O MTA só faz binding da service instance** (`default_aicore`). Ele não interage com a API interna do AI Core. Configuration e Deployment são responsabilidade sua no AI Launchpad.

### Sequência completa de deploy

```
1. AI Launchpad: criar Configuration + Deployment para sonar no resource group default
2. Aguardar Deployment com status RUNNING
3. Confirmar nome exato do modelo e ajustar GENAIHUB_MODEL_NAME se necessário
4. mbt build
5. cf deploy mta_archives/joule-mcp-research-server_1.0.0.mtar
6. Atribuir role collections no BTP Cockpit
7. Validar com GET /health
8. Validar com genaihub_model_healthcheck via MCP Inspector
```

### Pré-requisitos de ferramentas

- MBT (MTA Build Tool): `npm install -g mbt`
- CF CLI com plugin MTA: `cf install-plugin multiapps`
- Instância de AI Core existente com nome `default_aicore` no seu Cloud Foundry space
- Resource group `default` ativo no AI Core com Deployment `RUNNING` para o modelo configurado

### Build e Deploy

```bash
mbt build
cf deploy mta_archives/joule-mcp-research-server_1.0.0.mtar
```

### O que o MTA faz

| Recurso | Ação |
|---|---|
| `joule-mcp-xsuaa` | **Cria** instância XSUAA (managed-service) |
| `aicore-default` | **Referencia** instância existente `default_aicore` (existing-service) |

### O que o MTA NÃO faz

| Objeto | Responsável |
|---|---|
| AI Core Configuration | Você, manualmente no AI Launchpad |
| AI Core Deployment | Você, manualmente no AI Launchpad |
| Resource group `default` | Você, previamente no AI Launchpad |

---

## Segurança XSUAA

### Scopes

| Scope | Acesso |
|---|---|
| `ResearchViewer` | Recursos básicos / healthcheck |
| `ResearchUser` | Executar tools MCP de pesquisa |
| `ResearchAdmin` | Logs administrativos e estatísticas |

### Role Collections (atribuir no BTP Cockpit)

- `Joule_MCP_Research_User` → usuários do Joule que precisam usar as tools
- `Joule_MCP_Research_Admin` → administradores

### Endpoint `/health`

Público — não requer token. Retorna apenas status, modelo configurado e resource group. Não expõe credenciais.

---

## Testar `/health`

```bash
curl http://localhost:4004/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "joule-mcp-research-server",
  "timestamp": "...",
  "model": "sonar",
  "resourceGroup": "default"
}
```

---

## Testar `/mcp` (tools/list)

```bash
curl -X POST http://localhost:4004/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Testar chamada ao Generative AI Hub

Usando MCP Inspector (instalação local):

```bash
npx @modelcontextprotocol/inspector http://localhost:4004/mcp
```

No Inspector, chame `perplexity_sonar_answer` com:
```json
{ "query": "What is SAP CAP?" }
```

---

## Configurar no Joule Studio / MCP Client

No Joule Studio ou no cliente MCP que consumirá o servidor, configure:

```
URL:     https://<app-url>.cfapps.<region>.hana.ondemand.com/mcp
Método:  HTTP POST (Streamable HTTP)
Auth:    Bearer Token (XSUAA)
Scope:   <xsappname>.ResearchUser
```

O `<app-url>` é o hostname atribuído pelo Cloud Foundry após o deploy.

---

## Troubleshooting

### `ERR_REQUIRE_ESM` ao importar `@sap-ai-sdk/orchestration`

O SDK é ESM puro. O projeto usa `"type": "module"`. Se ocorrer esse erro, verifique se não há arquivos `.js` usando `require()` para importar o SDK. Use `await import('@sap-ai-sdk/orchestration')`.

### AI Core retorna 401 / 403

- Verifique se o binding foi feito: `cds env get requires --profile hybrid --resolve-bindings`
- Verifique se o resource group `default` existe no AI Launchpad
- Verifique se o modelo está deployado no resource group

### Modelo não encontrado (404)

- Valide o nome exato do modelo em: AI Launchpad → ML Operations → Models
- Ajuste `GENAIHUB_MODEL_NAME` para o nome correto

### `/mcp` retorna 401 em produção

- Certifique-se de que `MCP_REQUIRE_AUTH=true` está configurado (padrão em produção)
- O cliente deve enviar `Authorization: Bearer <token>` com scope `ResearchUser`

### `cds bind` não encontra a instância

```bash
cf services  # lista todas as service instances no space
cf service default_aicore  # inspeciona a instância "default_aicore"
```

---

## Boas Práticas de Segurança

- Nunca versionar `.cdsrc-private.json`, `.env` ou service keys
- Nunca logar `Authorization` header, tokens ou client_secret
- Nunca retornar stack trace em respostas externas
- Usar `MCP_REQUIRE_AUTH=true` em qualquer ambiente não-local
- Rotacionar service keys regularmente no BTP Cockpit
- Aplicar principle of least privilege: atribuir apenas `ResearchUser` para usuários normais

---

## Limitações Conhecidas

- Citações dependem do suporte do modelo no Generative AI Hub. Se o modelo não retornar `citations` na resposta, o servidor faz fallback extraindo URLs do texto.
- O projeto usa SQLite em memória para desenvolvimento local. Logs são perdidos ao reiniciar.
- Streaming de respostas não está implementado nesta versão (respostas completas).
- O nome exato do modelo Perplexity Sonar no Generative AI Hub pode variar por tenant e região — sempre valide no AI Launchpad.
