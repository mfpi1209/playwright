// ═══════════════════════════════════════════════════════════════════════════
// HELPERS COMPARTILHADOS DO CHECKOUT VTEX (Cruzeiro do Sul)
//
// Extraidos do inscricao-pos.spec.js apos validacao empirica end-to-end.
// Reaproveitados por todos os specs (vestibular, ENEM, ENEM sem nota,
// transferencia, pos-graduacao, pos-graduacao gravado).
//
// Cobrem 3 problemas estruturais do checkout VTEX da Cruzeiro:
//   1. Cliente com email ja cadastrado fica em loop /profile <-> /email
//   2. Campo de data de nascimento (HTML5 date) eh rejeitado por setter
//      nativo / fill() / keyboard.type() - so aceita valueAsDate
//   3. page.evaluate quebra com "Execution context was destroyed" quando
//      o checkout VTEX faz navegacao automatica no meio do callback
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrapper "safe" para page.evaluate. Quando o checkout VTEX faz navegacao
 * automatica (cliente logado), o contexto JS do evaluate eh destruido e
 * gera "Execution context was destroyed". Este wrapper engole esse erro
 * especifico e retorna o fallback (sem propagar). Demais erros sao re-throw.
 */
async function safeEval(page, fn, arg, fallback) {
  try {
    return (arg !== undefined) ? await page.evaluate(fn, arg) : await page.evaluate(fn);
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (msg.includes('Execution context was destroyed') ||
        msg.includes('Target page, context or browser has been closed') ||
        msg.includes('navigation')) {
      return fallback;
    }
    throw e;
  }
}

/**
 * Quando o cliente nao esta autenticado de fato (passwordless sem codigo),
 * o checkout VTEX renderiza a etapa #/email antes de #/profile. Se o spec
 * ignorar isso, fica em loop entre /profile e /email. Esse helper detecta
 * #/email, preenche o email (caso vazio) e avanca para /profile via UI +
 * via API (clientProfileData).
 *
 * Retorna true se conseguiu sair de /email, false se permaneceu.
 */
async function passarEtapaEmail(page, email) {
  if (!page.url().includes('#/email')) return false;
  console.log('   📧 Etapa #/email detectada - tratando como visitante...');

  const seletoresEmail = [
    page.locator('#client-pre-email'),
    page.locator('input[name="email"]:visible'),
    page.locator('input[type="email"]:visible'),
    page.getByRole('textbox', { name: /e[-]?mail/i }),
  ];
  for (const campo of seletoresEmail) {
    try {
      if (await campo.first().isVisible({ timeout: 2000 })) {
        const atual = await campo.first().inputValue().catch(() => '');
        if (!atual || atual.toLowerCase() !== email.toLowerCase()) {
          await campo.first().click({ force: true });
          await campo.first().fill('');
          await campo.first().type(email, { delay: 40 });
          console.log(`   ✅ Email da etapa #/email preenchido: ${email}`);
        } else {
          console.log(`   ✅ Email da etapa #/email já preenchido: ${atual}`);
        }
        break;
      }
    } catch (e) {}
  }

  await page.waitForTimeout(800);
  const seletoresBtn = [
    page.locator('#btn-go-to-shipping'),
    page.getByRole('button', { name: /continuar/i }),
    page.getByRole('button', { name: /pr[óo]xim[ao]/i }),
    page.locator('button:has-text("Continuar")'),
    page.locator('button:has-text("Avançar")'),
  ];
  for (const btn of seletoresBtn) {
    try {
      if (await btn.first().isVisible({ timeout: 2000 })) {
        await btn.first().click({ force: true, timeout: 3000 }).catch(() => {});
        console.log('   ✅ Clicou em Continuar na etapa #/email');
        break;
      }
    } catch (e) {}
  }
  await page.waitForTimeout(1500);

  // Tambem envia via API para garantir persistencia no VTEX
  await safeEval(page, async (em) => {
    try {
      const vj = window.vtexjs && window.vtexjs.checkout;
      if (!vj) return;
      const of = vj.orderForm || (await vj.getOrderForm());
      if (!of || !of.orderFormId) return;
      await fetch(`/api/checkout/pub/orderForm/${of.orderFormId}/attachments/clientProfileData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, isCorporate: false }),
      });
    } catch (e) {}
  }, email, undefined);

  await page.waitForTimeout(2000);
  const novaUrl = page.url();
  console.log(`   📍 URL após etapa #/email: ${novaUrl.split('#')[1] || novaUrl}`);
  return novaUrl.includes('#/profile') ||
         novaUrl.includes('#/shipping') ||
         novaUrl.includes('#/payment');
}

/**
 * Preenche o campo client-birthDate do checkout VTEX em 3 estrategias:
 *   A) valueAsDate via evaluate (UNICA que funciona com React HTML5 date)
 *   B) keyboard.type DD MM YYYY
 *   C) page.locator.fill()
 *
 * Validado empiricamente: A funciona, B e C podem nao persistir devido
 * ao comportamento do componente React. Mantem B/C como fallback.
 *
 * Retorna { ok, motivo, valor, tipo } para logging.
 */
async function preencherDataNascimentoVtex(page, dataBR, dataIso) {
  const campo = page.locator(
    '#client-birthDate, #client-birth-date, input[name="birthDate"], input[type="date"]'
  ).first();

  if (!(await campo.isVisible({ timeout: 3000 }).catch(() => false))) {
    return { ok: false, motivo: 'campo-nao-visivel' };
  }

  await campo.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  const tipo = (await campo.getAttribute('type').catch(() => '')) || '';
  const disabled = await campo.getAttribute('disabled').catch(() => null);
  if (disabled !== null) {
    return { ok: true, motivo: 'campo-desabilitado', tipo };
  }

  const valorAtual = (await campo.inputValue().catch(() => '')) || '';
  if (valorAtual && (valorAtual === dataBR || valorAtual === dataIso)) {
    return { ok: true, motivo: 'ja-preenchido', valor: valorAtual, tipo };
  }

  const [dd, mm, yyyy] = (dataBR || '').split('/');

  // Estrategia A: valueAsDate (chave para React HTML5 date inputs)
  let v = await safeEval(page, ({ iso, dBR }) => {
    const sels = ['#client-birthDate', '#client-birth-date', 'input[name="birthDate"]', 'input[type="date"]'];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.offsetParent !== null && !el.disabled) {
        el.focus();
        try {
          if (el.type === 'date' && iso) {
            el.valueAsDate = new Date(iso + 'T00:00:00');
          } else {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, iso || dBR);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return el.value;
        } catch (e) { return ''; }
      }
    }
    return '';
  }, { iso: dataIso, dBR: dataBR }, '');
  if (v) return { ok: true, motivo: 're-preenchido-valueAsDate', valor: v, tipo };

  // Estrategia B: keyboard.type componente a componente
  if (dd && mm && yyyy) {
    await campo.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
    await page.keyboard.type(dd, { delay: 80 });
    await page.keyboard.type(mm, { delay: 80 });
    await page.keyboard.type(yyyy, { delay: 80 });
    await page.keyboard.press('Tab').catch(() => {});
    v = (await campo.inputValue().catch(() => '')) || '';
    if (v) return { ok: true, motivo: 're-preenchido-keyboard', valor: v, tipo };
  }

  // Estrategia C: fill direto (ultimo recurso)
  const valor = tipo === 'date' ? dataIso : dataBR;
  await campo.fill('').catch(() => {});
  await campo.fill(valor, { timeout: 2000 }).catch(() => {});
  await campo.press('Tab', { timeout: 1000 }).catch(() => {});
  v = (await campo.inputValue().catch(() => '')) || '';
  return { ok: !!v, motivo: v ? 're-preenchido-fill' : 'falha-fill', valor: v, tipo };
}

/**
 * Calcula data nos 2 formatos a partir de "DD/MM/YYYY" ou "YYYY-MM-DD".
 * Retorna { dataBR, dataIso }. Strings vazias se nao conseguir parsear.
 */
function calcularDatasNascimento(input) {
  if (!input) return { dataBR: '', dataIso: '' };
  const s = String(input).trim();

  // Formato BR: DD/MM/YYYY
  if (s.includes('/')) {
    const [dd, mm, yyyy] = s.split('/');
    if (dd && mm && yyyy) {
      const ddP = dd.padStart(2, '0');
      const mmP = mm.padStart(2, '0');
      return { dataBR: `${ddP}/${mmP}/${yyyy}`, dataIso: `${yyyy}-${mmP}-${ddP}` };
    }
  }

  // Formato ISO: YYYY-MM-DD
  if (s.includes('-') && s.length >= 10) {
    const [yyyy, mm, dd] = s.split('-');
    if (yyyy && mm && dd) {
      const ddP = dd.padStart(2, '0');
      const mmP = mm.padStart(2, '0');
      return { dataBR: `${ddP}/${mmP}/${yyyy}`, dataIso: `${yyyy}-${mmP}-${ddP}` };
    }
  }

  return { dataBR: s, dataIso: '' };
}

/**
 * Detecta prompt de codigo (OTP) que aparece quando o email ja existe no
 * VTEX. Spec headless nao pode digitar o codigo (chega no email do cliente),
 * entao a estrategia eh navegar para outra URL para fechar o prompt -
 * a sessao "visitante com email lembrado" segue valida.
 *
 * Retorna true se contornou (prompt estava presente), false se nao tinha
 * prompt (caminho normal).
 */
async function contornarPromptCodigoOtp(page, urlDestino) {
  const seletores = [
    page.locator('input[maxlength="6"]:visible').first(),
    page.locator('input[name*="otp" i]:visible').first(),
    page.locator('input[name*="code" i]:visible').first(),
    page.locator('input[placeholder*="código" i]:visible').first(),
    page.locator('input[placeholder*="codigo" i]:visible').first(),
    page.locator('text=/use o c[óo]digo/i').first(),
    page.locator('text=/digite o c[óo]digo/i').first(),
    page.locator('text=/enviamos um c[óo]digo/i').first(),
    page.locator('text=/verifique seu e[-]?mail/i').first(),
    page.locator('text=/n[ãa]o recebi/i').first(),
  ];
  let temPrompt = false;
  for (const s of seletores) {
    try {
      if (await s.isVisible({ timeout: 800 })) { temPrompt = true; break; }
    } catch (e) {}
  }
  if (!temPrompt) return false;

  console.log('   📧 Prompt de código detectado (email já existe no VTEX)');
  console.log(`   🔄 Contornando: navegando para ${urlDestino}`);
  try {
    await page.goto(urlDestino, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    console.log('   ✅ Contorno aplicado');
  } catch (e) {
    console.log(`   ⚠️ Erro ao navegar para ${urlDestino}: ${(e.message || '').slice(0, 60)}`);
  }
  return true;
}

module.exports = {
  safeEval,
  passarEtapaEmail,
  preencherDataNascimentoVtex,
  calcularDatasNascimento,
  contornarPromptCodigoOtp,
};
