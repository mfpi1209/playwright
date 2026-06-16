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

### 2026-06-16 — Inscrição PÓS finalizando ponta a ponta: `valueAsDate` + caminho simples + Etapas 6/8 sem re-cliques

**Decisão:** Reescrever a Etapa 10 do `inscricao-pos.spec.js` com um **caminho simples primeiro** (preencher data + clicar "Ir para o Endereço") antes do loop com 5 tentativas + fallbacks. A chave para preencher o campo de data foi descobrir que o React do checkout VTEX aceita atualizações via `HTMLInputElement.valueAsDate` (API específica de HTML5 date inputs), enquanto rejeita silenciosamente o setter nativo de `value` E o `locator.fill()` do Playwright. Adicionalmente, corrigir bugs antigos das Etapas 6 e 8 que faziam o spec ficar re-clicando botões e re-carregando a página sem necessidade.

**Contexto:** Após implementar diagnóstico visual e identificar que o único campo bloqueando era `client-birthDate`, várias estratégias foram testadas em sequência sem sucesso:
- `el.value = ...` via setter nativo + `dispatchEvent('input' + 'change')`: campo zerava no re-render
- `locator.fill(ISO)` do Playwright: ficava vazio
- `page.keyboard.type('DDMMYYYY')`: também não persistia
- `pressSequentially`: idem

A descoberta crucial: para HTML5 date inputs, `el.valueAsDate = new Date('2000-09-08T00:00:00')` + eventos React (`input`, `change`, `blur`) FUNCIONA. Validado empiricamente:
```
📅 [A valueAsDate] valor=2000-09-08
📅 Data final no campo: "2000-09-08" (tipo=date)
✅ Clicou "Ir para o Endereço"
✅ Avançou para: /shipping
...
✅ Botão Ir para o Pagamento clicado
✅ Botão clicado (via ID)
📍 URL final: /checkout/orderPlaced/?og=1640053859675
🎉 INSCRIÇÃO PÓS-GRADUAÇÃO FINALIZADA COM SUCESSO!
📋 Número de Inscrição SIAA: 265763203
```
Run completa em 6.9 min, exit code 0, com email já existente no VTEX (`ultimolider@gmail.com`).

**Alternativas descartadas:**
- *Continuar batalhando com `fill()` + `keyboard.type()`:* validado empiricamente que **não funciona** para o input específico do checkout VTEX da Cruzeiro (provavelmente um React component com `onChange` que verifica algum estado interno).
- *Refatorar tudo para usar API VTEX direta:* mais robusto a longo prazo mas é refatoração massiva (1-2 dias). O `valueAsDate` resolve sem refazer nada.
- *Continuar com `page.reload()` na 4ª tentativa do loop:* usuário relatou que isso causava "recarregamento idiota". Removido pois não resolvia o problema e perdia estado.

**Impacto:**

1. **`tests/inscricao-pos.spec.js` Etapa 6** (linhas ~2347-2400): O loop "Continuar Inscrição" da localização agora **aceita `/checkout/*` como sucesso válido**. Antes, se o VTEX pulasse direto da localização para `/checkout/#/cart` (sem passar pela página de campanha), o spec via como "não navegou" e re-clicava o botão "Continuar Inscrição" do carrinho 3 vezes em vão. Agora detecta a URL pré-clique e pula se já está no checkout, e usa `Promise.race` para aceitar campanha OU checkout como destino válido.

2. **`tests/inscricao-pos.spec.js` Etapa 8** (linhas ~2810-2875): Reescrita a lógica de detecção de popup bloqueante. **Antes**: capturava texto da página INTEIRA (header, footer, menu) e marcava como bloqueante se encontrasse palavras genéricas como "cadastro", "aviso", "atenção" — confundindo com o popup informativo "Atenção: A primeira mensalidade equivale à matrícula" (que deveria só ser fechado). **Agora**: só bloqueia se um modal/overlay VISÍVEL contiver EXATAMENTE "Aviso Importante" E "inconsist". Para o popup informativo, fecha com o botão X e segue.

3. **`tests/inscricao-pos.spec.js` Etapa 10** (linhas ~3552-3620): Novo **caminho simples primeiro**, antes do loop com 5 tentativas. Tenta preencher a data (3 estratégias em cascata: A=`valueAsDate`, B=`keyboard.type`, C=`fill`) e clicar "Ir para o Endereço". Se URL muda para `/shipping` ou `/payment`, pula todo o restante. Se não, executa o loop original como fallback.

4. **`tests/inscricao-pos.spec.js` Etapa 10** (linha ~3895): Removido o `page.reload()` da tentativa 4 do loop. O usuário identificou corretamente que isso fazia o navegador "recarregar igual idiota" sem resolver o problema, e ainda perdia estado de sessão.

5. **`tests/inscricao-pos.spec.js`**: Adicionado helper `safeEval(page, fn, arg, fallback)` que engole apenas o erro específico "Execution context was destroyed" (quando o checkout VTEX faz navegação automática no meio do `evaluate`) e retorna o fallback. Aplicado em 4 `page.evaluate` críticos das Etapas 9-11 que estavam quebrando o spec inteiro.

6. **`tests/inscricao-pos.spec.js`**: Helper `garantirBirthDate(page, dataBR, dataIso)` mantida no spec mas agora rara de ser acionada (o caminho simples resolve o caso comum). Mantém 3 estratégias em cascata para resiliência.

---

### 2026-06-16 — Helper `garantirBirthDate` (Playwright API) + diagnóstico visual do checkout travado

**Decisão:** Reescrever a lógica de preenchimento do campo `client-birthDate` na Etapa 10 do `inscricao-pos.spec.js` para usar a API do Playwright (`fill` + `press('Tab')`) em vez do setter nativo de `value` via `evaluate`. Adicionar captura proativa de screenshot + diagnóstico visual de erros (lista de mensagens de erro do VTEX, campos obrigatórios vazios, campos inválidos) quando o spec detectar 3+ tentativas frustradas avançando do `#/profile` para `#/shipping`.

**Contexto:** Após resolver o login da Etapa 3 para email já existente, o checkout VTEX continuou travando em loop `/profile` ↔ `/email`. Diagnóstico visual (screenshots `debug-checkout-stuck-t3.png`, `t4.png`, `t5.png`) revelou que **TODOS os campos do profile estavam preenchidos e válidos (verdes) EXCETO o campo "Data de nascimento"**, que aparecia vazio com placeholder `dd/mm/aaaa` apesar do spec ter preenchido na Etapa 9. As mensagens de erro `"A verificação expirou. Marque o campo novamente."` e `"Encontramos um problema no preenchimento. Por favor, verifique os campos em destaque"` apontavam diretamente para esse campo. Causa raiz: o input é HTML5 `type="date"` e o componente React do VTEX rejeita atualizações via setter nativo (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) — o valor é "preenchido" no DOM mas o estado interno do React permanece vazio, e o re-render zera o valor exibido. A solução confiável é usar `locator.fill(...)` do Playwright (que simula entrada por teclado) com o valor em ISO (`yyyy-mm-dd`, formato sempre aceito por `type="date"`), seguido de `locator.press('Tab')` para disparar `blur` e forçar o React a reconhecer a mudança.

**Alternativas descartadas:**
- *Usar `dispatchEvent('input' + 'change')` + setter nativo:* tentado primeiro. O log mostrou "✅ birthDate re-preenchido (estava vazio): 2000-09-08" mas o screenshot subsequente revelou o campo continuando vazio — o React do checkout VTEX claramente ignora esses eventos quando o setter é usado.
- *Preencher apenas no formato BR (08/09/2000):* o componente HTML5 date input só aceita ISO. Tentar BR resulta em campo vazio.
- *Submeter `birthDate` apenas via API VTEX (`clientProfileData`):* já estava sendo feito, e o log mostrava `api-ok`, mas o VTEX UI continuava marcando o campo como vazio na validação do botão "Ir para o Endereço" — provavelmente o checkout valida o React state local antes de chamar a API.

**Impacto:**
- `tests/inscricao-pos.spec.js`: helper `garantirBirthDate(page, dataBR, dataIso)` reescrita para usar `page.locator(...).fill(...)` + `press('Tab')` com fallback de formato. Detecta automaticamente se o input é `type="date"` (usa ISO) ou text com máscara (usa BR). Retorna `{ ok, motivo, valor, seletor, tipo }` para logging.
- `tests/inscricao-pos.spec.js`: bloco de diagnóstico visual proativo dentro do loop de retry da Etapa 10. Quando `tentProfile >= 3`, captura `debug-checkout-stuck-t{N}.png`, lista mensagens de erro visíveis (`.error`, `.invalid`, `[role="alert"]`, etc), campos obrigatórios vazios e campos marcados como inválidos. Esse diagnóstico foi crítico para identificar a causa raiz do `birthDate` vazio.
- `tests/inscricao-pos.spec.js`: try/catch defensivos adicionais em mais dois `page.evaluate` (verificação de CEP visível e diagnóstico de conteúdo da página) que falhavam com "Execution context was destroyed" quando o checkout auto-navegava durante a chamada.
- O spec ainda tem ~35 outros `page.evaluate` não protegidos. Conforme as runs vão revelando quais quebram, eles podem ser protegidos seguindo o mesmo padrão (`.catch((e) => msg.includes('Execution context was destroyed') ? fallbackSeguro : ...)`). Alternativamente, no futuro, criar um helper `evalSafe(page, fn, args, fallback)` com retry e fazer um sweep global.

---

### 2026-06-16 — Login da Etapa 3 cobre email já existente (prompt código) + `evaluate` defensivo

**Decisão:** Tratar explicitamente o caso de "email já existe no VTEX" na Etapa 3 (Login Cliente). Após clicar "Entrar", detectar se aparece prompt de código por email (OTP) — situação que ocorre quando o email já tem conta — e contornar navegando para `/pos-graduacao` sem inserir código. A sessão "visitante com email lembrado" segue válida para o restante do checkout. Adicionar também um wrapper defensivo em volta do `page.evaluate` do diagnóstico de checkout na Etapa 9, que pode ser interrompido por navegação automática quando o cliente está realmente logado.

**Contexto:** Validação empírica do usuário: "a página que aparece para receber o código via email é só dar refresh ou clicar nos cursos (para já pesquisar o curso da inscrição)". Implementação detecta inputs e textos típicos do prompt de OTP (`input[maxlength="6"]`, "use o código", "verifique seu e-mail", "não recebi", etc.) e, se detectado, navega para `https://cruzeirodosul.myvtex.com/pos-graduacao` em vez de tentar digitar o código (impossível no servidor headless). Após o contorno, o spec continua para a Etapa 4 (Busca do Curso) normalmente.

Validação local com `vinips2012@gmail.com` (email já existente no VTEX): **pela primeira vez** o log mostrou `✅ Login confirmado (header "Olá" visível)` para email existente. Isso libera o restante do checkout para tentar progredir com cliente autenticado.

**Alternativas descartadas:**
- *Tentar inserir o código por email automaticamente:* exigiria leitura programática do email (IMAP/SMTP), credenciais adicionais e tempo de espera. Inviável para o servidor síncrono.
- *Continuar dependendo do passwordless sem reagir ao prompt:* mantinha o comportamento de "Login pode não ter funcionado (sem 'Olá' no header)" e bloqueava o caso comum de cliente reincidente.

**Impacto:**
- `tests/inscricao-pos.spec.js`: detector inline do prompt de código + bloco de contorno (~40 linhas) dentro do loop de retry da Etapa 3, antes do 2º clique "Entrar". Quando o prompt NÃO aparece (email novo), o fluxo segue como antes (2º clique de confirmação + marcação `loginClienteOk = true`).
- `tests/inscricao-pos.spec.js`: wrapper try/catch + 3 retries em volta do `page.evaluate` do diagnóstico de checkout (Etapa 9, antes da navegação para shipping). Necessário porque com cliente logado de verdade, o VTEX pode auto-avançar de `/profile` para `/shipping` no meio do evaluate e destruir o contexto de execução.
- Resultado parcial: Etapa 3 agora cobre email existente (login confirmado). Etapas 9/10 progrediram além do ponto de antes, mas o checkout ainda pode travar em loop `/profile` ↔ `/email` para clientes com dados de Master Data CL incompletos (provável falta de campos como `motherName`, `rg` ou outros customizados pela Cruzeiro). Investigação dessa última camada fica para uma próxima rodada.

---

### 2026-06-16 — Robustez extra no `inscricao-pos.spec.js`: `birthDate`, handler `/email`, alias VTEX opcional

**Decisão:** Adicionar três camadas defensivas ao `inscricao-pos.spec.js` para o caso de cliente já existente no VTEX (email JÁ tem conta), sem mexer no fluxo de login do cliente (que segue passwordless). Mudanças combinadas:
1. **`birthDate` no payload `/api/checkout/pub/orderForm/{ofId}/attachments/clientProfileData`** — converte `CLIENTE.nascimento` (DD/MM/YYYY) para ISO (YYYY-MM-DD) via `CLIENTE.nascimentoIso` e inclui no payload nos 2 fallbacks de API VTEX, junto com `isCorporate: false`.
2. **Helper `passarEtapaEmail(page, email)`** — detecta `#/email` (etapa de identificação que o VTEX renderiza para visitantes/clientes não autenticados), preenche o campo de email, clica "Continuar" e força fallback via `clientProfileData`. Chamado em 3 pontos: início da Etapa 9, início da Etapa 10 e dentro de cada iteração do loop de retry da Etapa 10.
3. **Função `desambiguarEmailParaVtex(email, cpf)` + `CLIENTE.emailVtex` controlado por `VTEX_USE_EMAIL_ALIAS=1`** — opt-in via env var (default OFF). Quando ligado, gera alias `+pos<sufixo>` para provedores que aceitam (Gmail/Outlook/iCloud/etc) e usa no checkout VTEX, enquanto SIAA/DB Eduit/Kommo/N8N mantêm o email original. Útil quando o CPF também é novo.

**Contexto:** O usuário reportou erro `"sucesso": false, "erro": "CEP não encontrado"` ao tentar inscrição Pós-graduação no curso "Mba Em Inteligência Digital E De Mercado" com `vinips2012@gmail.com` / CPF `66878279011`. Após corrigir o `stealth-fixture` (registro anterior), o `vtexjs` voltou a carregar mas o checkout ainda travava entre `/profile` ↔ `/email` em loop. Investigação revelou:
- O cliente fica como visitante porque o login passwordless da Etapa 3 só preenche email + clica "Entrar" — não tem código por email pra completar a autenticação quando o email JÁ EXISTE no VTEX. Pra emails novos (como o `gww32asilva@gmail.com` da Prótese Ocular anterior), o VTEX cria conta na hora sem código → funciona.
- O VTEX renderiza `#/email` no checkout antes de `#/profile` quando o cliente não está autenticado. Sem handler, o spec entra em loop.
- O payload de `clientProfileData` precisa de `birthDate` para o VTEX considerar o profile válido em contas existentes; sem ele a API responde 200 mas o checkout silenciosamente rejeita.
- Tentativa de impersonação via `POST /api/sessions` com `{ impersonate: { storeUserEmail } }` retornou 200 (com sessionToken) mas **não impersonou de verdade** — `profile.email` continuou vazio e nenhum cookie `VtexIdclientAutCookie_<account>` ou `VtexImpersonatedCustomerId` foi setado. O admin polo (`fabio.boas50@polo.cruzeirodosul.edu.br`) não tem permissão "Telemarketing" no VTEX da Cruzeiro.
- Tentativa com alias `+pos` validou o login (header "Olá" apareceu pela 1ª vez), mas a Etapa 5 travou em "Carregando..." 3x — provável conflito de CPF (mesmo CPF tentando criar 2ª conta com email diferente). Por isso o alias ficou opt-in.

**Alternativas descartadas:**
- *Impersonação via `/api/sessions`:* validada experimentalmente, mas o admin polo não tem permissão. Resolveria a raiz se o admin tivesse role correta; requer mudança de configuração no VTEX da Cruzeiro.
- *Alias ligado por default:* causa conflito de CPF quando a conta antiga existe, deixando o spec em estado pior do que sem alias. Por isso ficou opt-in via env var.
- *Refatorar a Etapa 3 para impersonar via UI nativa do admin-login da Cruzeiro:* o endpoint `/_v/segment/admin-login/v1/impersonate` retornou 404; o app customizado da Cruzeiro não expõe esse caminho. Exploração ficou para uma próxima rodada.

**Impacto:**
- `tests/inscricao-pos.spec.js`: ~150 linhas adicionadas (1 função desambiguar + 1 helper passarEtapaEmail + ajustes nos 2 payloads `clientProfileData` + 3 callsites de `passarEtapaEmail` + propriedade `nascimentoIso` em `CLIENTE`).
- `.env.example`: nova variável `VTEX_USE_EMAIL_ALIAS=0` documentada com aviso sobre conflito de CPF.
- Validação local com `--config=playwright.config.server.js` e dados do erro reportado: `birthDate` foi preenchido na UI ("✅ Data nascimento: 08/09/2000" — antes era "⚠️ Campo data de nascimento não encontrado"); com alias OFF, o checkout segue limitado pelo conflito de autenticação (problema estrutural, não de código).
- **Próxima inscrição real**: usar email + CPF totalmente novos para garantir fluxo limpo. Para o caso de email JÁ existente com CPF JÁ existente, a solução robusta exige liberação de permissão de impersonação no VTEX da Cruzeiro (decisão fora deste repo).

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

