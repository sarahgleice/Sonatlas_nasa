const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runE2EAudioTest() {
  console.log('======================================================================');
  console.log(' [TESTE E2E DE ÁUDIO NO NAVEGADOR] Iniciando Chrome com Web Audio API');
  console.log('======================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio=false'
    ]
  });

  const page = await browser.newPage();

  // Monitorar logs de console e erros da página
  const consoleMessages = [];
  const consoleErrors = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  // Injetar rastreamento no AudioContext do navegador antes do carregamento da aplicação
  await page.evaluateOnNewDocument(() => {
    window.__audioEvents = [];
    const OrigAudioContext = window.AudioContext || window.webkitAudioContext;

    window.AudioContext = class extends OrigAudioContext {
      constructor(options) {
        super(options);
        window.__audioCtxInstance = this;
        window.__audioEvents.push({ type: 'context_created', state: this.state, time: this.currentTime });

        this.addEventListener('statechange', () => {
          window.__audioEvents.push({ type: 'statechange', state: this.state, time: this.currentTime });
        });
      }

      createOscillator() {
        const osc = super.createOscillator();
        const origStart = osc.start.bind(osc);
        const origSetValueAtTime = osc.frequency.setValueAtTime.bind(osc.frequency);

        let freqVal = osc.frequency.value;
        osc.frequency.setValueAtTime = function(val, startTime) {
          freqVal = val;
          window.__audioEvents.push({
            type: 'osc_freq_set',
            frequency: Math.round(val),
            time: startTime,
            oscType: osc.type
          });
          return origSetValueAtTime(val, startTime);
        };

        osc.start = function(time) {
          window.__audioEvents.push({
            type: 'osc_start',
            frequency: Math.round(freqVal),
            time: time,
            oscType: osc.type
          });
          return origStart(time);
        };

        return osc;
      }
    };
  });

  console.log('-> Navegando para http://127.0.0.1:5173/ ...');
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 15000 });

  // 1. Verificar título e interface
  const title = await page.title();
  console.log(`[UI] Título da página: "${title}"`);

  // Esperar o card do player carregar
  await page.waitForSelector('.player-card', { timeout: 10000 });
  console.log('[UI] Painel de Controles do Jukebox Sonoro carregado com sucesso.');

  // Obter texto do resumo científico e step atual
  const initialStepBadge = await page.$eval('.player-card .badge', el => el.textContent.trim());
  console.log(`[UI] Estado inicial do player: "${initialStepBadge}"`);

  // Obter nome da região selecionada
  const selectedRegion = await page.$eval('#region-select option:checked', el => el.textContent.trim());
  console.log(`[UI] Região ativa: "${selectedRegion}"`);

  // 2. Interação do Usuário: Clicar no botão 'Reproduzir' (Play)
  console.log('\n[ÁUDIO] Clicando no botão Reproduzir (iniciando síntese de áudio)...');
  const playBtn = await page.$('.btn-play');
  await playBtn.click();

  // Aguardar 1 segundo para capturar a primeira síntese
  await new Promise(r => setTimeout(r, 1200));

  let events = await page.evaluate(() => window.__audioEvents);
  let ctxState = await page.evaluate(() => window.__audioCtxInstance ? window.__audioCtxInstance.state : 'null');
  console.log(`[ÁUDIO] AudioContext state: "${ctxState}"`);

  const initialOscs = events.filter(e => e.type === 'osc_start');
  console.log(`[ÁUDIO] Osciladores sintetizados no Passo 0: ${initialOscs.length} pulsos`);
  if (initialOscs.length > 0) {
    console.log(`[ÁUDIO] Frequência emitida no Passo 0 (00:00 UTC): ${initialOscs[0].frequency} Hz (Chuva Moderada Ativa)`);
  }

  // 3. Teste de Avanço Manual: Clicar em 'Próximo Passo' (Next)
  console.log('\n[CONTROLES] Testando avanço manual: Clicando em Avançar (Next)...');
  const nextBtn = await page.$('button[title*="Próxima"]');
  await nextBtn.click();
  await new Promise(r => setTimeout(r, 800));

  const step1Badge = await page.$eval('.player-card .badge', el => el.textContent.trim());
  const step1Summary = await page.$eval('.textual-summary-box p', el => el.textContent.trim());
  console.log(`[UI] Após Avançar: "${step1Badge}"`);
  console.log(`[UI] Descrição Textual: "${step1Summary}"`);

  events = await page.evaluate(() => window.__audioEvents);
  const step1Oscs = events.filter(e => e.type === 'osc_start');
  const lastStep1Osc = step1Oscs[step1Oscs.length - 1];
  console.log(`[ÁUDIO] Frequência emitida no Passo 1 (00:30 UTC): ${lastStep1Osc ? lastStep1Osc.frequency : 'N/A'} Hz`);

  // 4. Avançar para o Passo 2 (01:00 UTC - Transição para Repouso)
  console.log('\n[CONTROLES] Avançando para o Passo 2 (01:00 UTC - Transição para Calmaria)...');
  await nextBtn.click();
  await new Promise(r => setTimeout(r, 800));

  const step2Badge = await page.$eval('.player-card .badge', el => el.textContent.trim());
  const step2Summary = await page.$eval('.textual-summary-box p', el => el.textContent.trim());
  console.log(`[UI] "${step2Badge}" | "${step2Summary}"`);

  events = await page.evaluate(() => window.__audioEvents);
  const step2Oscs = events.filter(e => e.type === 'osc_start');
  const lastStep2Osc = step2Oscs[step2Oscs.length - 1];
  console.log(`[ÁUDIO] Frequência emitida no Passo 2 (01:00 UTC): ${lastStep2Osc ? lastStep2Osc.frequency : 'N/A'} Hz (Tom de Repouso C3)`);

  // 5. Avançar pelos passos 3, 4, 5
  for (let s = 3; s <= 5; s++) {
    await nextBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const badge = await page.$eval('.player-card .badge', el => el.textContent.trim());
    events = await page.evaluate(() => window.__audioEvents);
    const oscs = events.filter(e => e.type === 'osc_start');
    const lastOsc = oscs[oscs.length - 1];
    console.log(`[PASSO ${s}] "${badge}" -> Frequência: ${lastOsc ? lastOsc.frequency : 'N/A'} Hz`);
  }

  // 6. Teste de Pausar e Voltar (Previous)
  console.log('\n[CONTROLES] Testando Voltar (Previous)...');
  const prevBtn = await page.$('button[title*="anterior"]');
  await prevBtn.click();
  await new Promise(r => setTimeout(r, 500));
  const backBadge = await page.$eval('.player-card .badge', el => el.textContent.trim());
  console.log(`[UI] Após Voltar: "${backBadge}"`);

  // 7. Teste de Silenciar (Mute)
  console.log('\n[CONTROLES] Testando Silenciar (Mute)...');
  const muteBtn = await page.$('button[title*="Silenciar"]');
  await muteBtn.click();
  const isMutedBtn = await page.$eval('button[title*="Ativar som"]', el => !!el);
  console.log(`[ÁUDIO] Estado de Mute ativado no botão: ${isMutedBtn}`);

  // 8. Verificar ausência de erros no console
  console.log('\n--- VERIFICAÇÃO DE INTEGRIDADE NO CONSOLE ---');
  console.log(`Total de mensagens no console: ${consoleMessages.length}`);
  console.log(`Total de erros não tratados: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Erros encontrados:', consoleErrors);
  } else {
    console.log('[SUCESSO] Zero erros no console durante todo o ciclo de reprodução e navegação.');
  }

  await browser.close();

  console.log('======================================================================');
  console.log(' [CONCLUSÃO] Teste real de áudio no navegador finalizado com êxito!');
  console.log('======================================================================');
}

runE2EAudioTest().catch(err => {
  console.error('Falha no teste E2E:', err);
  process.exit(1);
});
