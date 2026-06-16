# Decisões técnicas do projeto

Este arquivo registra decisões estruturais (escolhas de stack, padrão, mudança de dependência) seguindo a regra de governança do projeto.

---

### 2026-06-16 — Adoção de `playwright-extra` + `puppeteer-extra-plugin-stealth` no fluxo do `inscricao.spec.js`

**Decisão:** Os testes Playwright que dependem do checkout VTEX da Cruzeiro do Sul (atualmente apenas `tests/inscricao.spec.js` — Vestibular Múltipla Escolha) passam a usar o fixture `tests/stealth-fixture.js`, que ativa o plugin stealth no navegador Chromium.

**Contexto:** O VTEX da Cruzeiro adotou validação por reCAPTCHA (provavelmente Enterprise) na etapa `#/profile` do checkout. Sem stealth, o reCAPTCHA detectava `navigator.webdriver` e demais sinais de automação, exigindo desafio. O script disparava o erro `"A verificação expirou. Marque o campo novamente."` e timeoutava em 7 min sem concluir a inscrição. Foram feitas 3 execuções consecutivas com dados distintos confirmando que o problema não era específico de e-mail/CPF, mas estrutural. Após ativar o stealth, a primeira execução concluiu o fluxo completo (orderPlaced + captura do link da prova) em 5.9 min, sem intervenção manual.

**Alternativas descartadas:**
- *Pausar o teste e marcar reCAPTCHA manualmente:* funcionaria mas exige intervenção humana a cada execução, inviabilizando o uso pelo `server.js` (API que dispara o spec via processo filho).
- *Patch só no clique do botão "Prosseguir" do shipping:* não resolveria a causa-raiz; o estado do pedido já ficava inconsistente desde o `#/profile` por causa do skip-via-hash.
- *Instalar `playwright-stealth` standalone:* abandonado pelo mantenedor; `playwright-extra` é o caminho atual e suportado.

**Impacto:**
- 2 devDependencies novas: `playwright-extra` e `puppeteer-extra-plugin-stealth` (~49 pacotes transitivos).
- 1 arquivo novo: `tests/stealth-fixture.js` (fixture que reescreve a fixture `browser` do Playwright Test e injeta o plugin stealth).
- 1 linha alterada em `tests/inscricao.spec.js` (substitui `import { test, expect } from '@playwright/test'` por `const { test, expect } = require('./stealth-fixture')`).
- Headless mode é controlado pelo `playwright.config.js` (`headless: false` atualmente) e respeitado pelo fixture.

---

### 2026-06-16 — Migração do stealth fixture para todos os specs de ingresso

**Decisão:** Aplicar o mesmo padrão estabelecido no `inscricao.spec.js` (uso do `tests/stealth-fixture.js`) para todos os demais specs que executam fluxo de ingresso na VTEX da Cruzeiro: `inscricao-pos.spec.js`, `inscricao-enem.spec.js`, `inscricao-enem-sem-nota.spec.js`, `inscricao-transferencia.spec.js` e `inscricao-pos-gravado.spec.js`.

**Contexto:** Após validar que o stealth resolve o bloqueio do reCAPTCHA no `inscricao.spec.js` (Vestibular Múltipla Escolha), surgiu a necessidade de garantir que os outros fluxos de ingresso (Pós, ENEM, ENEM sem nota, Transferência) não sejam afetados pelo mesmo problema quando o `server.js` os disparar. A mudança é mecânica (1 linha por arquivo) e segue o mesmo padrão validado em produção.

**Alternativas descartadas:**
- *Migrar só sob demanda quando cada fluxo travar:* descartado por gerar incidentes desnecessários e dificultar diagnóstico futuro.
- *Centralizar o `chromium.use(stealth)` num arquivo de setup global do Playwright:* descartado por ser mais invasivo (mexe na config do projeto) sem ganho relevante — o fixture atual já é compartilhado e cobre todos os casos.

**Impacto:**
- 5 specs alteradas (1 linha cada): substituição do `import { test, expect } from '@playwright/test'` (ou variação `require`) por `const { test, expect } = require('./stealth-fixture')`.
- `inscricao-pos.spec.js` foi executado em ambiente local após a migração com `POS_SKIP_PAGAMENTO_SIAA=1` (curso Prótese Ocular - 12 meses) e finalizou em 5.8 min, gerando inscrição `1640003857699` no VTEX sem disparar boleto/SIAA. Os outros 4 specs não foram executados ao vivo, mas a alteração é puramente mecânica e idêntica.
- `.env` recebeu `POS_SKIP_PAGAMENTO_SIAA=1` (alinhado ao padrão da rota `/inscricao-pos/sync` do `server.js`).
- Specs auxiliares que não fazem fluxo de ingresso (`continuar-pagamento.spec.js`, `download-boleto.spec.js`, `kommo-*.spec.js`, `teste-boleto.spec.js`) **não** foram migrados — caso enfrentem reCAPTCHA no futuro, podem ser migrados pelo mesmo procedimento (1 linha).

---

### 2026-06-16 — Correção do `stealth-fixture.js`: merge correto de `use:` global do config

**Decisão:** Reescrever o cálculo de `launchOptions` e `headless` dentro de `tests/stealth-fixture.js` para mergear corretamente o `use:` global do config + o `use:` do projeto, em vez de ler apenas o `testInfo.project.use`.

**Contexto:** Após o usuário rodar `inscricao-pos.spec.js` no servidor (Easypanel) com o curso "Mba Em Inteligência Digital E De Mercado", a API retornou `"erro": "CEP não encontrado."`. O log mostrava `Resultado busca endereço: sem-vtexjs`, `Número via API VTEX: sem-vtexjs`, `Campo data de nascimento não encontrado` e `Seção de endereço não expandiu, tentando navegar por hash` — sinais claros de que o `vtexjs` nunca carregava na página. O servidor usa `playwright.config.server.js`, que define `headless: true`, `userAgent: 'Chrome/120.0.0.0'`, `viewport: 1920x1080`, `locale: pt-BR`, `geolocation`, e `launchOptions.args: [--no-sandbox, --disable-gpu, --window-size=1920,1080, ...]` — tudo no nível `use:` global. O fixture stealth original lia apenas `testInfo.project.use.launchOptions` e `testInfo.project.use.headless`, descartando todas as configurações globais. Sem esses flags (especialmente o `userAgent` real do Chrome e os args Docker), o site detectava automação pelo navegador e renderizava o checkout em estado degradado, sem inicializar o `vtexjs`.

**Alternativas descartadas:**
- *Mover toda config do `use:` global para `projects[0].use`:* funcionaria mas espalha config entre arquivos e quebra a convenção do Playwright Test (que faz merge automático em cenários normais).
- *Aplicar stealth via `addInitScript` manual em vez de `playwright-extra`:* menos eficaz; o plugin completo já está validado em produção.
- *Adotar Xvfb no Dockerfile do servidor (display virtual para rodar headed):* mais robusto contra reCAPTCHA, mas requer alteração na imagem Docker do Easypanel. Considerado como próximo passo se o sintoma persistir após este fix.

**Impacto:**
- `tests/stealth-fixture.js` reescrito: nova função `mergeLaunchOptions(testInfo)` que combina `testInfo.config.use.launchOptions` + `testInfo.project.use.launchOptions`, concatena os arrays `args` deduplicando, e resolve `headless`/`slowMo` priorizando project sobre global.
- Validação local com `--config=playwright.config.server.js` (mesmo do servidor): `vtexjs` voltou a carregar (`api-ok` em vez de `sem-vtexjs`), data de nascimento foi preenchida, CEP e número aceitos via API VTEX. O sintoma raiz reportado pelo usuário foi corrigido.
- Sintoma secundário observado em local headless (checkout não avançou de `/profile` em algumas tentativas) pode ser causado por estado VTEX preexistente desse perfil ou por limitação residual de stealth+headless — será reavaliado após teste no servidor.

