# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

**joule-mcp-research-server** — Servidor MCP remoto em SAP CAP Node.js/JavaScript para agentes Joule. Expõe tools de pesquisa web que chamam Perplexity Sonar via **SAP Generative AI Hub / SAP AI Core** (nunca diretamente).

## cds-mcp — Apoio de Desenvolvimento

O `@cap-js/mcp-server` está disponível como ferramenta de desenvolvimento. **Antes de criar ou alterar modelos CDS, serviços, annotations ou configurações CAP**:

1. Use `search_model` para entender entidades e serviços existentes
2. Use `search_docs` para validar sintaxe CAP, padrões de handlers e anotações
3. Nunca chute sintaxe CDS — valide primeiro

Configuração local (copie `.mcp.json.example` para `.mcp.json`):
```json
{ "mcpServers": { "cds-mcp": { "command": "npx", "args": ["-y", "@cap-js/mcp-server"] } } }
```

## Módulos ES vs CommonJS

- `"type": "module"` no `package.json` — projeto usa **ES Modules**
- `@sap-ai-sdk/orchestration` é ESM puro; importado com `await import(...)` no runtime
- `@sap/cds` v8 suporta ESM
- Nunca use `require()` — use `import` ou `await import()`

## Comandos Essenciais

```bash
npm install
cds watch                          # dev local (auth desabilitada)
cds watch --profile hybrid         # dev com serviços BTP reais
node --test test/**/*.test.js      # testes (Node.js test runner nativo)
cds build                          # build para deploy
```

## Variáveis Obrigatórias

```
AICORE_RESOURCE_GROUP=default
GENAIHUB_MODEL_NAME=sonar
MCP_REQUIRE_AUTH=false             # dev local; true em produção
```

## Estrutura Principal

```
srv/
  server.js           # entry point CAP (cds.on('bootstrap'))
  mcp/
    server.js         # registra /mcp e /health no Express
    tools.js          # registry das 4 tools MCP
    tool-sonar-answer.js
    tool-sap-search.js
    tool-guardrails.js
    tool-healthcheck.js
  clients/
    genaihub.js       # OrchestrationClient (dynamic import ESM)
  security/
    auth.js           # middleware XSUAA Bearer token
  utils/
    logger.js / validators.js / persistence.js
db/schema.cds         # entidade ResearchLogs
srv/research-service.cds  # ResearchAdminService (@requires ResearchAdmin)
```

## Regras Invioláveis

- **Nunca** chamar `api.perplexity.ai` diretamente
- **Nunca** usar `PERPLEXITY_API_KEY`
- **Nunca** versionar `.cdsrc-private.json`, `.env`, `service-key*.json`
- **Nunca** logar tokens, client_secret, Authorization header
- **Nunca** retornar stack trace em resposta externa
- Toda resposta de tool deve ser JSON estruturado (ver formato em `tool-sonar-answer.js`)
- Modelo configurável via `GENAIHUB_MODEL_NAME`; validado contra allowlist `GENAIHUB_ALLOWED_MODELS`

## Modo Hybrid

```bash
cf login && cf target -o <org> -s <space>
cds bind auth --to <xsuaa-instance> --kind xsuaa
cds bind aicore --to default
cds watch --profile hybrid
```

O `.cdsrc-private.json` gerado pelo `cds bind` está no `.gitignore`.

## Deploy BTP

```bash
mbt build
cf deploy mta_archives/joule-mcp-research-server_1.0.0.mtar
```

O AI Core usa `existing-service` no `mta.yaml` — não cria nova instância.
