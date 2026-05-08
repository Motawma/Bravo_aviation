// ── FIREBASE (ESM CDN via require não funciona no Electron sem bundler)
// Usamos o SDK compat carregado via script tag via webPreferences allowRunningInsecureContent
// ou injetado no index.html. Aqui assumimos que o firebase global está disponível
// via uma tag <script> no index.html. Vamos usar importação dinâmica de módulos ES.

// Carrega Firebase via CDN (já que não há bundler)
// Este arquivo é carregado APÓS o script tag firebase no index.html
// — veja que index.html NÃO tem as tags firebase ainda, adicionamos aqui via DOM.

(async () => {
  // ── Injeta scripts Firebase no documento ──────────────────────────────────
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

  // ── Config Firebase ───────────────────────────────────────────────────────
  const FB_CONFIG = {
    apiKey:            'AIzaSyC2dDGhKjzHSclyFwUFNGA60DtXAjLEJ6I',
    authDomain:        'bravo-aviation.firebaseapp.com',
    projectId:         'bravo-aviation',
    storageBucket:     'bravo-aviation.firebasestorage.app',
    messagingSenderId: '712016002234',
    appId:             '1:712016002234:web:ce7a8e39c28bc6d8ca5683'
  };
  firebase.initializeApp(FB_CONFIG);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // ── Auto-update ───────────────────────────────────────────────────────────
  if (window.acars) {
    window.acars.onUpdateAvail((info) => {
      const banner = $('update-banner');
      if (!banner) return;
      $('update-version').textContent = 'v' + info.version;
      banner.classList.add('show');
    });
    window.acars.onUpdateProgress((pct) => {
      const btn = $('btn-install-update');
      if (btn && btn.disabled) btn.textContent = `Baixando... ${pct}%`;
    });
    window.acars.onUpdateReady(() => {
      const btn = $('btn-install-update');
      if (!btn) return;
      if (flightActive) {
        btn.textContent = '↺ Instalar após pouso';
        btn.disabled = false;
        btn.title = 'O app será reiniciado automaticamente após o pouso';
      } else {
        btn.textContent = '↺ Reiniciar e atualizar';
        btn.disabled = false;
      }
    });
    window.acars.onUpdateDeferred(() => {
      const btn = $('btn-install-update');
      if (btn) { btn.textContent = '↺ Instalar após pouso'; btn.disabled = false; }
    });
    window.acars.onUpdateError(() => {
      const btn = $('btn-install-update');
      if (btn) { btn.textContent = 'Erro'; btn.disabled = true; }
      const link = $('btn-update-manual');
      if (link) {
        const ver = $('update-version')?.textContent?.replace('v','') || '';
        link.href = `https://github.com/Motawma/Bravo_aviation/releases/latest`;
        link.style.display = 'inline';
      }
    });
  }

  // ── Estado global ─────────────────────────────────────────────────────────
  let currentUser      = null;
  let userData         = null;
  let simConnected     = false;
  let simType          = null;
  let discordWebhookUrl = null;
  let aircraftTitle = null;
  let flightActive  = false;
  let pendingFlightUnsub = null;
  const activeAlerts = {};

  // Log de voo
  let logPrevState  = null;
  let logLastPhase  = null;

  // Dados de voo
  let flightStart     = null;
  let timerInterval   = null;
  let lastSimData     = null;
  let lastSimDataTime = 0;
  let fuelAtStart   = null;
  let maxAlt        = 0;
  let maxSpd        = 0;
  let totalDist     = 0;
  let lastLat       = null;
  let lastLon       = null;
  let liveInterval      = null;
  let liveFlightPushed  = false;
  let flightSessionId   = null;
  let sessionInterval   = null;

  // FOQA
  const foqaViolations = [];
  let flightOp         = 0;
  let tookOff          = false;
  let tookOffFlapsIdx  = null;
  let tookOffWeightKg  = 0;
  let peakGForce       = 1.0;
  let fuelKgAtStart    = 0;
  let fuelKgPrev       = 0;
  let singleEngTaxiSec = 0;
  let singleEngOPGiven = false;
  let prevGearDown     = false;
  let prevFlapsIndex   = 0;
  let landingRate      = 0;
  let cruiseWindowStart = null;
  let cruiseConfirmed   = false;
  let cruiseReported    = false;
  let hasLanded         = false;
  let postLandingStaticSec = 0;
  let prevOnGrnd        = false;
  let prevEng1          = false;
  let prevEng2          = false;
  let overspeed10kSec   = 0;

  // ── Utilitários ───────────────────────────────────────────────────────────
  function $ (id) { return document.getElementById(id); }

  // ── Sistema de alertas em tempo real ─────────────────────────────────────
  function showAlert(key, icon, title, detail, secsLeft, total) {
    const panel = $('alert-panel');
    if (!panel) return;
    let card = $('alert-' + key);
    if (!card) {
      card = document.createElement('div');
      card.id = 'alert-' + key;
      card.className = 'alert-card';
      card.innerHTML =
        `<span style="font-size:20px">${icon}</span>` +
        `<div class="alert-body">` +
          `<div class="alert-title">${title}</div>` +
          `<div class="alert-detail" id="alert-det-${key}">${detail}</div>` +
        `</div>` +
        `<div class="alert-cd" id="alert-cd-${key}"></div>`;
      panel.appendChild(card);
      activeAlerts[key] = true;
    }
    const cdEl  = $('alert-cd-' + key);
    const detEl = $('alert-det-' + key);
    if (detEl) detEl.textContent = detail;
    if (cdEl) {
      if (secsLeft <= 0) {
        cdEl.textContent = '✕';
        card.classList.add('danger');
        card.classList.remove('urgent');
      } else {
        cdEl.textContent = secsLeft + 's';
        card.classList.toggle('urgent', secsLeft <= 10);
        card.classList.toggle('danger', false);
      }
    }
  }

  function dismissAlert(key) {
    const card = $('alert-' + key);
    if (card) card.remove();
    delete activeAlerts[key];
  }

  function clearAllAlerts() {
    Object.keys(activeAlerts).forEach(k => dismissAlert(k));
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function fmt(n, dec = 0) {
    return Number(n).toFixed(dec).replace('.', ',');
  }

  function fmtDur(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // nm
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function classifyLanding(fpm) {
    if (fpm <= 150)  return 'Pouso Suave 🧈 (Butter)';
    if (fpm <= 300)  return 'Pouso Normal ✅ (Firme)';
    if (fpm <= 500)  return 'Pouso Duro ⚠️ (Hard)';
    return 'Pouso Crítico ❌ (Check Gear)';
  }

  function flightPhase(spd, alt, vs, onGround) {
    if (onGround)              return spd >= 40 ? 'DECOLAGEM' : 'SOLO';
    if (alt < 50 && spd < 40) return 'SOLO'; // fallback: dados iniciais sem onGround
    if (vs > 500)              return 'DECOLAGEM';
    if (vs > 200)              return 'SUBIDA';
    if (vs < -200)             return 'DESCIDA';
    if (alt > 8000 && Math.abs(vs) <= 200) {
      const plannedFL = parseInt(document.getElementById('inp-fl')?.value) || 0;
      if (plannedFL > 0) return cruiseConfirmed ? 'CRUZEIRO' : 'VOO';
      return 'CRUZEIRO';
    }
    if (alt <= 8000)           return 'APROXIMAÇÃO';
    return 'VOO';
  }

  // Aeronaves sem luzes beacon tradicionais (turboprops GA, alguns jatos pequenos)
  // Para essas aeronaves o check de beacon é ignorado no FOQA
  const NO_BEACON_AIRCRAFT = [
    'TBM', 'PC-12', 'PC12', 'KING AIR', 'KINGAIR',
    'KODIAK', 'CARAVAN', 'GRAND CARAVAN',
    'SR22', 'SR20', 'CIRRUS',
    'DA40', 'DA42', 'DA62', 'DIAMOND',
    'CESSNA 172', 'C172', 'CESSNA 182', 'C182',
    'PIPER', 'SEMINOLE', 'ARCHER',
    'PHENOM 100', 'PHENOM 300',
  ];
  function acHasBeacon(title) {
    const t = (title || '').toUpperCase();
    return !NO_BEACON_AIRCRAFT.some(p => t.includes(p));
  }

  // ── Limitações de aeronaves ───────────────────────────────────────────────
  const AC_LIMITS = {
    A320: { mtow:77000, mlw:66000, maxAlt:39100, maxTailwind:10, maxSpdbrake:315,
            validDepFlaps:[1,2,3], minFob:1600, maxGear:280,
            flapsMaxSpd:{ 1:230, 2:215, 3:200, 4:185, 5:177 } },
    B737: { mtow:79016, mlw:66361, maxAlt:41000, maxTailwind:15, maxSpdbrake:320,
            validDepFlaps:[1,5,10,15,25], minFob:1500, maxGear:270,
            flapsMaxSpd:{ 1:265, 5:255, 10:215, 15:205, 25:190, 30:175, 40:165 } }
  };
  function getAcLimits(title) {
    const t = (title || '').toUpperCase();
    if (t.includes('A320') || t.includes('A319') || t.includes('A321') ||
        t.includes('A318') || t.includes('A32N') || t.includes('FENIX'))
      return AC_LIMITS.A320;
    return null; // sem limites específicos para outras aeronaves
  }
  function tailwindKts(windDir, windSpd, hdg) {
    const diff = (windDir - hdg + 360) % 360;
    return windSpd * -Math.cos(diff * Math.PI / 180);
  }

  // ── Log de voo ────────────────────────────────────────────────────────────
  function logTs() {
    return new Date().toTimeString().slice(0, 8);
  }

  function addLogEntry(icon, msg, dim = false) {
    const el = $('flight-log');
    if (!el) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-ts">${logTs()}</span><span class="log-icon">${icon}</span><span class="log-msg${dim ? ' dim' : ''}">${msg}</span>`;
    el.appendChild(entry);
    el.scrollTop = el.scrollHeight;
  }

  window.clearLog = () => {
    const el = $('flight-log');
    if (el) el.innerHTML = '';
  };

  function detectLogEvents(d) {
    const p = logPrevState;

    if (!p) {
      // Primeiro pacote após reset — loga o estado atual dos itens já ativos
      if (d.eng1)          addLogEntry('🔴', 'Motor 1 acionado');
      if (d.eng2)          addLogEntry('🔴', 'Motor 2 acionado');
      if (d.beaconLight)   addLogEntry('🔆', 'Beacon ligado');
      if (d.navLight)      addLogEntry('🟢', 'Luzes de navegação ligadas');
      if (d.strobeLight)   addLogEntry('✦',  'Strobes ligados');
      if (d.taxiLight)     addLogEntry('💡', 'Luzes de taxi ligadas');
      if (d.landingLights) addLogEntry('💡', 'Luzes de pouso ligadas');
      if ((d.flapsIndex || 0) > 0) addLogEntry('🛫', `Flaps posição ${d.flapsIndex}`);
      logPrevState = { ...d };
      return;
    }

    const changed = (key) => p[key] !== d[key];

    if (changed('eng1')) addLogEntry(d.eng1 ? '🔴' : '⭕', d.eng1 ? 'Motor 1 acionado' : 'Motor 1 desligado');
    if (changed('eng2')) addLogEntry(d.eng2 ? '🔴' : '⭕', d.eng2 ? 'Motor 2 acionado' : 'Motor 2 desligado');

    if (changed('beaconLight')) addLogEntry('🔆', d.beaconLight ? 'Beacon ligado' : 'Beacon desligado', !d.beaconLight);
    if (changed('navLight'))    addLogEntry('🟢', d.navLight    ? 'Luzes de navegação ligadas' : 'Luzes de navegação desligadas', !d.navLight);
    if (changed('taxiLight'))   addLogEntry('💡', d.taxiLight   ? 'Luzes de taxi ligadas' : 'Luzes de taxi desligadas', !d.taxiLight);
    if (changed('strobeLight')) addLogEntry('✦',  d.strobeLight ? 'Strobes ligados' : 'Strobes desligados', !d.strobeLight);
    if (changed('landingLights')) addLogEntry('💡', d.landingLights ? 'Luzes de pouso ligadas' : 'Luzes de pouso desligadas', !d.landingLights);

    if (changed('flapsIndex')) {
      const ias = Math.round(d.spd);
      if (d.flapsIndex === 0) addLogEntry('🛫', `Flaps recolhidos — ${ias} kts`);
      else if (d.flapsIndex > (p.flapsIndex || 0)) addLogEntry('🛬', `Flaps posição ${d.flapsIndex} — ${ias} kts`);
      else addLogEntry('🛫', `Flaps reduzidos para posição ${d.flapsIndex} — ${ias} kts`);
    }

    if (changed('gearDown')) {
      const ias = Math.round(d.spd);
      addLogEntry(d.gearDown ? '⬇️' : '⬆️',
        d.gearDown ? `Trem de pouso extendido — ${ias} kts` : `Trem de pouso recolhido — ${ias} kts`);
    }

    if (changed('onGround') && !d.onGround) addLogEntry('✈️', `Decolagem — ${Math.round(d.spd)} kts`);
    if (changed('onGround') &&  d.onGround && d.spd > 10) {
      const tvs = Math.round(d.touchdownVS || 0);
      addLogEntry('🛬', `Pouso — ${Math.round(d.spd)} kts | -${tvs} FPM — ${classifyLanding(tvs)}`);
    }

    const phase = flightPhase(d.spd, d.alt, d.vs, d.onGround);
    if (phase !== logLastPhase) {
      const icons = { 'SOLO':'🅿️', 'DECOLAGEM':'🛫', 'SUBIDA':'📈', 'CRUZEIRO':'✈️', 'DESCIDA':'📉', 'APROXIMAÇÃO':'🛬', 'VOO':'✈️' };
      if (logLastPhase !== null) addLogEntry(icons[phase] || '📋', `Fase: ${phase}`, true);
      logLastPhase = phase;
    }

    logPrevState = { ...d };
  }

  function updateStartBtn() {
    const dep = $('inp-dep').value.trim();
    const arr = $('inp-arr').value.trim();
    const ready = simConnected && aircraftTitle && dep.length >= 3 && arr.length >= 3;
    $('btn-start').disabled = !ready || flightActive;
    $('btn-stop').disabled  = !flightActive;
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  function showMain() {
    $('topbar').style.display = 'flex';
    const verEl = $('app-version');
    if (verEl && window.acars?.getVersion) verEl.textContent = 'v' + window.acars.getVersion();
    showScreen('screen-main');
    addLogEntry('✅', 'ACARS pronto — conecte o simulador para iniciar');
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  $('btn-login').addEventListener('click', async () => {
    const email = $('inp-email').value.trim();
    const pass  = $('inp-pass').value;
    $('login-err').textContent = '';
    $('btn-login').disabled = true;

    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      const snap = await db.collection('users').doc(cred.user.uid).get();
      if (!snap.exists) {
        $('login-err').textContent = 'Conta não encontrada no sistema Bravo Aviation.';
        await auth.signOut();
        return;
      }
      userData    = snap.data();
      currentUser = cred.user;
      onLoginSuccess();
    } catch (e) {
      const msgs = {
        'auth/user-not-found':   'E-mail não encontrado.',
        'auth/wrong-password':   'Senha incorreta.',
        'auth/invalid-email':    'E-mail inválido.',
        'auth/too-many-requests':'Muitas tentativas. Aguarde um momento.'
      };
      $('login-err').textContent = msgs[e.code] || e.message;
    } finally {
      $('btn-login').disabled = false;
    }
  });

  $('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-login').click(); });

  auth.onAuthStateChanged(async fbUser => {
    if (!fbUser || currentUser) return;
    const snap = await db.collection('users').doc(fbUser.uid).get();
    if (!snap.exists) return;
    userData    = snap.data();
    currentUser = fbUser;
    onLoginSuccess();
  });

  async function onLoginSuccess() {
    $('topbar-name').textContent = userData.name || currentUser.email;
    $('topbar-vid').textContent  = 'VID ' + (userData.vid || '—');
    // Carrega webhook Discord para notificações de PIREP
    db.collection('siteConfig').doc('1501341988757311528').get()
      .then(s => { if (s.exists) discordWebhookUrl = s.data().webhookUrl || null; })
      .catch(() => {});
    showMain();
    setupPendingFlightListener();
    setupSimListeners();
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  $('btn-logout').addEventListener('click', async () => {
    if (flightActive) { alert('Encerre o voo antes de sair.'); return; }
    if (pendingFlightUnsub) { pendingFlightUnsub(); pendingFlightUnsub = null; }
    window.acars.removeListeners();
    await window.acars.disconnectSim();
    await auth.signOut();
    currentUser = null; userData = null; simConnected = false;
    $('topbar').style.display = 'none';
    showScreen('screen-login');
  });

  // ── Rota pendente — listener em tempo real ────────────────────────────────
  function applyPendingFlight(pf) {
    $('inp-dep').value = pf.dep          || '';
    $('inp-arr').value = pf.arr          || '';
    $('inp-fl').value  = pf.plannedFL    || '';
    $('inp-fn').value  = pf.flightNumber || '';
    $('inp-obs').value = pf.obs          || '';
    const badge = $('route-loaded-badge');
    if (badge) {
      badge.textContent = '✓ ' + (pf.flightNumber || pf.dep + '→' + pf.arr) + ' carregado do site';
      badge.style.display = '';
    }
    updateStartBtn();
    // pendingFlight NÃO é deletado aqui — só no startFlight()
    // assim o brief.html continua legível enquanto o piloto ainda não iniciou o voo
  }

  function setupPendingFlightListener() {
    if (pendingFlightUnsub) { pendingFlightUnsub(); pendingFlightUnsub = null; }
    pendingFlightUnsub = db.collection('users').doc(currentUser.uid)
      .onSnapshot(snap => {
        if (!snap.exists || flightActive) return;
        const pf = snap.data()?.pendingFlight;
        if (!pf) return;
        applyPendingFlight(pf);
      }, () => {});
  }

  async function loadPendingFlight() {
    try {
      const snap = await db.collection('users').doc(currentUser.uid).get();
      const pf   = snap.data()?.pendingFlight;
      if (!pf) return;
      applyPendingFlight(pf);
    } catch (_) {}
  }

  window.reloadPendingFlight = async () => {
    const btn = $('btn-reload-route');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    await loadPendingFlight();
    if (btn) { btn.disabled = false; btn.textContent = '↻ Recarregar'; }
  };

  // ── Sim listeners (IPC) ───────────────────────────────────────────────────
  function setupSimListeners() {
    window.acars.onSimStatus(({ connected, type }) => {
      simConnected  = connected;
      simType       = connected ? type : null;
      const dot     = $('sim-dot');
      const label   = $('sim-label');
      if (connected) {
        dot.className   = 'dot on';
        label.textContent = (type === 'msfs' ? 'MSFS' : 'X-Plane') + ' Conectado';
        $('btn-connect-msfs').style.display   = 'none';
        $('btn-connect-xp').style.display     = 'none';
        $('btn-disconnect-sim').style.display = '';
        logPrevState = null;
        logLastPhase = null;
        addLogEntry('🔌', `Simulador conectado (${type === 'msfs' ? 'MSFS' : 'X-Plane'})`);

        // Se após 6s nenhum dado chegar, o MSFS provavelmente está no menu sem voo
        setTimeout(() => {
          if (simConnected && !lastSimData) {
            addLogEntry('⚠', 'Nenhum dado recebido — carregue um voo no MSFS e volte ao cockpit');
          }
        }, 6000);
      } else {
        dot.className   = 'dot';
        label.textContent = 'Desconectado';
        aircraftTitle   = null;
        lastSimData     = null;
        $('ac-title').textContent = '—';
        $('btn-connect-msfs').style.display   = '';
        $('btn-connect-xp').style.display     = '';
        $('btn-disconnect-sim').style.display = 'none';
      }
      updateStartBtn();
    });

    window.acars.onSimData(data => {
      if (data._simException !== undefined) {
        addLogEntry('✗', `SimConnect exceção ${data._simException} — var[${data._simExIndex}]: "${data._simExVar}"`);
        return;
      }

      lastSimData     = data;
      lastSimDataTime = Date.now();

      // Detecta aeronave carregada
      if (data.aircraft && data.aircraft !== aircraftTitle) {
        aircraftTitle = data.aircraft;
        $('ac-title').textContent = aircraftTitle;
        if (aircraftTitle === 'MSFS Aircraft') {
          addLogEntry('⚠', 'Nenhum voo carregado no MSFS — carregue uma aeronave e volte ao cockpit antes de iniciar', false);
        } else {
          addLogEntry('✈️', `Aeronave: ${aircraftTitle}`, true);
        }
        updateStartBtn();
      }

      detectLogEvents(data);

      if (!flightActive) return;
      processTelemetry(data);
    });
  }

  // ── Conectar / Desconectar simulador ──────────────────────────────────────
  window.connectSim = async (type) => {
    $('btn-connect-msfs').disabled = true;
    $('btn-connect-xp').disabled   = true;
    const res = await window.acars.connectSim(type);
    if (!res.ok) {
      alert('Erro ao conectar: ' + res.error);
      $('btn-connect-msfs').disabled = false;
      $('btn-connect-xp').disabled   = false;
    }
  };

  window.disconnectSim = async () => {
    await window.acars.disconnectSim();
  };

  // ── Iniciar voo ───────────────────────────────────────────────────────────
  window.startFlight = async () => {
    flightActive    = true;
    if (window.acars?.setFlightState) window.acars.setFlightState(true);
    flightStart     = Date.now();
    fuelAtStart     = lastSimData?.fuel ?? 0;
    maxAlt          = 0; maxSpd = 0; totalDist = 0;
    lastLat         = lastSimData?.lat ?? null;
    lastLon         = lastSimData?.lon ?? null;
    tookOff          = false;
    tookOffFlapsIdx  = null;
    tookOffWeightKg  = 0;
    peakGForce       = 1.0;
    fuelKgAtStart    = lastSimData?.fuelWeightKg ?? 0;
    fuelKgPrev       = fuelKgAtStart;
    singleEngTaxiSec = 0;
    singleEngOPGiven = false;
    prevGearDown     = lastSimData?.gearDown ?? false;
    prevFlapsIndex   = lastSimData?.flapsIndex ?? 0;
    flightOp         = 0;
    landingRate      = 0;
    cruiseWindowStart = null;
    cruiseConfirmed   = false;
    cruiseReported    = false;
    hasLanded             = false;
    postLandingStaticSec  = 0;
    prevOnGrnd            = false;
    prevEng1          = lastSimData?.eng1 ?? false;
    prevEng2          = lastSimData?.eng2 ?? false;
    overspeed10kSec   = 0;
    foqaViolations.length = 0;
    logPrevState = null;
    logLastPhase = null;
    liveFlightPushed = false;
    clearAllAlerts();

    // Sessão de voo persistente — usada para recuperação se o app fechar durante o voo
    flightSessionId = currentUser.uid + '_' + flightStart;
    sessionInterval = setInterval(updateFlightSession, 300000); // checkpoint a cada 5 min
    db.collection('flight_sessions').doc(flightSessionId).set({
      uid:          currentUser.uid,
      pilotName:    userData.name || '',
      pilotVid:     userData.vid  || '',
      dep:          $('inp-dep').value.trim().toUpperCase(),
      arr:          $('inp-arr').value.trim().toUpperCase(),
      aircraft:     aircraftTitle || '',
      fl:           $('inp-fl').value.trim(),
      fn:           $('inp-fn').value.trim().toUpperCase(),
      network:      document.querySelector('input[name="network"]:checked')?.value || 'Offline',
      sim:          simType === 'msfs' ? 'MSFS' : 'X-Plane',
      startedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      lastUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
      status:       'active',
      pirepId:      null,
      maxAlt: 0, maxSpd: 0, totalDist: 0, elapsedSecs: 0,
      lastPhase: 'SOLO', lastAlt: 0, lastSpd: 0,
      foqaScore: 100, violations: []
    }).catch(() => {});

    $('panel-tele').style.display  = '';
    $('panel-viols').style.display = '';
    updateStartBtn();
    addLogEntry('▶', `Voo iniciado — ${$('inp-dep').value} → ${$('inp-arr').value}`);

    // Captura estado atual imediatamente para que mudanças sejam detectadas no próximo pacote
    if (lastSimData) detectLogEvents(lastSimData);

    // Timer + vigilância de dados parados
    let dataStaleWarned = false;
    lastSimDataTime = Date.now(); // garante que não dispara imediatamente
    timerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - flightStart) / 1000);
      $('tele-timer').textContent = fmtDur(secs);
      if (!dataStaleWarned && Date.now() - lastSimDataTime > 8000) {
        dataStaleWarned = true;
        addLogEntry('⚠', 'Sem dados do simulador — verifique a conexão ou carregue um voo no MSFS');
      }
    }, 1000);

    // Live tracking (a cada 5s)
    await pushLiveFlight();
    liveInterval = setInterval(pushLiveFlight, 5000);

    // Apaga pendingFlight do Firestore
    await db.collection('users').doc(currentUser.uid).update({ pendingFlight: firebase.firestore.FieldValue.delete() }).catch(() => {});
  };

  // ── Processar telemetria durante o voo ────────────────────────────────────
  function processTelemetry(d) {
    const { alt, spd, vs, hdg, fuel, onGround,
            landingLights, eng1, eng2, beaconLight, strobeLight, navLight,
            flapsIndex, gearDown,
            altAgl, gForce, simRate, totalWeightKg, fuelWeightKg,
            spoilersPos, stallWarning, overspeedWarning, bankDeg,
            windDir, windSpd } = d;
    const lim = getAcLimits(aircraftTitle);

    if (alt > maxAlt) maxAlt = alt;
    if (spd > maxSpd) maxSpd = spd;
    if (lastLat !== null) {
      const dist = haversine(lastLat, lastLon, d.lat, d.lon);
      if (dist < 50) totalDist += dist;
    }
    lastLat = d.lat; lastLon = d.lon;

    const phase = flightPhase(spd, alt, vs, onGround);
    $('tele-phase').textContent = phase;
    $('t-alt').textContent  = fmt(alt) + ' ft';
    $('t-spd').textContent  = fmt(spd) + ' kts';
    $('t-vs').textContent   = (vs >= 0 ? '+' : '') + fmt(vs) + ' fpm';
    $('t-hdg').textContent  = fmt(hdg) + '°';
    $('t-fuel').textContent = fmt(fuel, 0) + ' gal';
    $('t-dist').textContent = fmt(totalDist, 0) + ' nm';

    // Solo efetivo: SimConnect onGround OU alt < 50ft E spd < 40kts
    // (evita falsos positivos durante inicialização da aeronave)
    const agl = altAgl || alt;
    const effectivelyOnGround = onGround || (agl < 50 && spd < 40);

    // ── [CoC] Simulação acelerada ────────────────────────────────────────────
    if (simRate > 1.0) {
      addFoqaViolation('sim_rate_fast', `Taxa de simulação ${(simRate||1).toFixed(0)}x detectada`, 100, 'CoC');
    }

    // ── [Ov] Beacon desligado com motores (ignorado para aeronaves sem beacon)
    if (acHasBeacon(aircraftTitle) && (eng1 || eng2) && !beaconLight) {
      addFoqaViolation('beacon_off', 'Luzes beacon desligadas com motores acionados', 5, 'Ov');
    }

    // ── [Ov] Strobes/Nav desligados durante o voo ───────────────────────────
    if (!effectivelyOnGround) {
      if (!strobeLight) addFoqaViolation('strobes_off', 'Luzes strobes desligadas durante o voo', 5, 'Ov');
      if (!navLight)    addFoqaViolation('nav_off',     'Luzes de navegação desligadas durante o voo', 5, 'Ov');
    }

    // ── Decolagem detectada ──────────────────────────────────────────────────
    if (!tookOff && spd > 80 && !effectivelyOnGround) {
      tookOff         = true;
      tookOffFlapsIdx = flapsIndex;
      tookOffWeightKg = totalWeightKg || 0;

      if (lim) {
        // Flaps incorretos na decolagem (A320 only)
        if (!lim.validDepFlaps.includes(flapsIndex)) {
          addFoqaViolation('dep_flaps_wrong', `Flaps de decolagem incorretos (posição ${flapsIndex})`, 10, 'Ov');
        } else {
          flightOp += 5;
          addLogEntry('⭐', '+5 OP — Flaps de decolagem corretos');
        }
        // MTOW (A320 only)
        if (totalWeightKg > lim.mtow) {
          addFoqaViolation('exceed_mtow', `Excedeu MTOW (${Math.round(totalWeightKg)} kg)`, 10, 'Ov');
        }
        // Vento de cauda na decolagem (A320 only)
        if (windSpd > 0) {
          const tw = tailwindKts(windDir || 0, windSpd, hdg);
          if (tw > lim.maxTailwind) {
            addFoqaViolation('tailwind_dep', `Vento de cauda na decolagem (${tw.toFixed(0)} kts)`, 15, 'Ov');
          }
        }
      }
    }

    // ── Checks em voo (após decolagem) ──────────────────────────────────────
    if (tookOff && !onGround) {
      // Teto máximo (A320 only)
      if (lim && alt > lim.maxAlt) {
        addFoqaViolation('exceed_ceiling', `Excedeu teto máximo (${Math.round(alt)} ft)`, 10, 'Ov');
      }
      // Reabastecimento em voo (todas as aeronaves)
      if (fuelWeightKg && fuelKgPrev > 0 && fuelWeightKg > fuelKgPrev + 50) {
        addFoqaViolation('fuel_refill', 'Reabastecimento em voo detectado', 100, 'CoC');
      }
      // Landing lights acesas > 10.000ft na subida (todas as aeronaves)
      if (alt > 10000 && vs > 200 && landingLights) {
        addFoqaViolation('ll_above_10k', 'Luzes de pouso acesas acima de 10.000 ft na subida', 5, 'Ov');
      }
      // Speed brakes em alta velocidade (A320 only)
      if (lim && (spoilersPos || 0) > 2000 && spd > lim.maxSpdbrake) {
        addFoqaViolation('speedbrake_overspeed', `Speed brakes acionados acima de ${lim.maxSpdbrake} kts`, 10, 'Ov');
      }
      // Stall / Overspeed warning
      if (stallWarning)     addFoqaViolation('stall_warn',    'Aviso de stall acionado', 15, 'Ov');
      if (overspeedWarning) addFoqaViolation('overspeed_warn','Aviso de overspeed acionado', 15, 'Ov');
      // Bank angle
      if (Math.abs(bankDeg || 0) > 35) {
        addFoqaViolation('bank_angle', `Bank angle excessivo (${Math.round(Math.abs(bankDeg))}°)`, 15, 'Ov');
      }
      // Aproximação desestabilizada a 1000ft AGL
      const agl = altAgl || alt;
      if (agl > 900 && agl < 1100 && vs < 0) {
        if (spd > 200 || vs < -1500) {
          addFoqaViolation('unstabilized_approach',
            `Aproximação desestabilizada (${Math.round(spd)} kts / ${Math.round(vs)} fpm)`, 100, 'CoC');
        }
      }
      // Peak G-force pré-pouso
      if (agl < 500 && (gForce || 0) > peakGForce) peakGForce = gForce;
    }

    // ── Cruzeiro: confirmação por FL planejado ±200ft por 30s ────────────────
    if (tookOff && !onGround) {
      const plannedFL = parseInt($('inp-fl').value) || 0;
      const targetAlt = plannedFL * 100;
      if (targetAlt > 0) {
        if (Math.abs(alt - targetAlt) <= 200) {
          if (!cruiseWindowStart) cruiseWindowStart = Date.now();
          else if (!cruiseConfirmed && Date.now() - cruiseWindowStart >= 30000) {
            cruiseConfirmed = true;
            if (!cruiseReported) {
              cruiseReported = true;
              addLogEntry('✈️', `Cruzeiro confirmado — FL${plannedFL} (${Math.round(alt)} ft)`);
            }
          }
        } else {
          cruiseWindowStart = null;
          if (cruiseConfirmed && alt < targetAlt - 1000) cruiseConfirmed = false;
        }
      }
    }

    // ── Overspeed < 10.000 ft — tolerância 60s contínuos ────────────────────
    if (tookOff && !effectivelyOnGround && spd > 255 && alt < 10000) {
      overspeed10kSec++;
      const secsLeft = Math.max(0, 60 - overspeed10kSec);
      showAlert(
        'overspeed_10k', '⚡', 'OVERSPEED < 10.000 ft',
        `IAS ${Math.round(spd)} kts  •  Alt ${Math.round(alt).toLocaleString('pt-BR')} ft`,
        secsLeft, 60
      );
      if (overspeed10kSec === 60) {
        addFoqaViolation('overspeed_10k',
          `Velocidade > 255 kts abaixo de 10.000 ft por 60s — ${Math.round(spd)} kts`, 15, 'Ov');
      }
    } else {
      if (overspeed10kSec > 0) dismissAlert('overspeed_10k');
      overspeed10kSec = 0;
    }

    // ── Fuel weight tracking ─────────────────────────────────────────────────
    if (fuelWeightKg) fuelKgPrev = fuelWeightKg;

    // ── Extensão/retração de trem (A320 only) ────────────────────────────────
    if (lim) {
      if (gearDown && !prevGearDown && spd > lim.maxGear) {
        addFoqaViolation('gear_ext_speed', `Trem extendido em velocidade incompatível (${Math.round(spd)} kts)`, 5, 'Ov');
      }
      if (!gearDown && prevGearDown && spd > lim.maxGear) {
        addFoqaViolation('gear_ret_speed', `Trem recolhido em velocidade incompatível (${Math.round(spd)} kts)`, 5, 'Ov');
      }
    }
    prevGearDown = gearDown;

    // ── Flaps em velocidade incompatível (A320 only) ──────────────────────────
    if (lim && flapsIndex !== prevFlapsIndex && flapsIndex > 0) {
      const maxFlapSpd = lim.flapsMaxSpd[flapsIndex];
      if (maxFlapSpd && spd > maxFlapSpd) {
        addFoqaViolation('flap_overspeed',
          `Flaps posição ${flapsIndex} em ${Math.round(spd)} kts (máx ${maxFlapSpd} kts)`, 5, 'Ov');
      }
    }
    prevFlapsIndex = flapsIndex;

    prevEng1 = eng1;
    prevEng2 = eng2;

    // ── Single engine taxi ────────────────────────────────────────────────────
    if (onGround && eng1 !== eng2) {
      singleEngTaxiSec++;
      if (singleEngTaxiSec >= 180 && !singleEngOPGiven) {
        singleEngOPGiven = true;
        addLogEntry('⭐', '+10 OP — Taxi com motor único por 3 minutos');
      }
    } else if (onGround) {
      singleEngTaxiSec = 0;
    }

    // ── Touchdown: captura dados no momento do impacto ───────────────────────
    if (tookOff && !prevOnGrnd && onGround) {
      hasLanded = true;
      landingRate = d.touchdownVS > 0 ? d.touchdownVS : Math.abs(Math.min(vs, 0));
      const lg = Math.max(peakGForce, gForce || 1.0);
      if (lg > 2.0) {
        addFoqaViolation('gforce_coc', `G-force no pouso superior a 2.0G (${lg.toFixed(2)}G)`, 100, 'CoC');
      } else if (lg > 1.5) {
        addFoqaViolation('gforce_ov', `G-force no pouso 1.5-2.0G (${lg.toFixed(2)}G)`, 15, 'Ov');
      }
      if (lim) {
        if (totalWeightKg > lim.mlw) {
          addFoqaViolation('exceed_mlw', `Excedeu MLW no pouso (${Math.round(totalWeightKg)} kg)`, 10, 'Ov');
        }
        if (fuelWeightKg && fuelWeightKg < lim.minFob) {
          addFoqaViolation('fob_low', `FOB abaixo do mínimo no pouso (${Math.round(fuelWeightKg)} kg)`, 10, 'Ov');
        }
        if (windSpd > 0) {
          const tw = tailwindKts(windDir || 0, windSpd, hdg);
          if (tw > lim.maxTailwind) {
            addFoqaViolation('tailwind_arr', `Vento de cauda no pouso (${tw.toFixed(0)} kts)`, 15, 'Ov');
          }
        }
        if (gearDown && flapsIndex >= 3) {
          flightOp += 5;
          addLogEntry('⭐', '+5 OP — Configuração de pouso correta (flaps + trem)');
        }
      }
    }
    prevOnGrnd = onGround;

    // ── Finalização de voo ───────────────────────────────────────────────────
    // Não exige motores desligados: alguns addons (Fenix, PMDG) podem manter eng1/eng2
    // em estado ambíguo; a condição de parada por 60s cobre todos os casos
    if (tookOff && hasLanded && onGround && spd < 2) {
      if (d.parkingBrake || (!eng1 && !eng2)) {
        onLanding();
      } else {
        postLandingStaticSec++;
        if (postLandingStaticSec === 30) addLogEntry('ℹ️', 'Aguardando parada completa — finalizando em 30s...');
        if (postLandingStaticSec >= 60) onLanding();
      }
    } else if (!(tookOff && hasLanded && onGround)) {
      postLandingStaticSec = 0;
    }
  }

  function addFoqaViolation(type, desc, pts, cat) {
    if (foqaViolations.find(v => v.type === type)) return;
    foqaViolations.push({ type, desc, pts, cat });
    if (cat === 'CoC') addLogEntry('✗', `[CoC] ${desc}`);
    else               addLogEntry('⚠', `[Ov -${pts}pts] ${desc}`);
    renderViolations();
  }

  function renderViolations() {
    const list   = $('violations-list');
    const scoreEl = $('foqa-score-live');
    const ovDed  = foqaViolations.filter(v => v.cat === 'Ov').reduce((s, v) => s + v.pts, 0);
    const hasCoc = foqaViolations.some(v => v.cat === 'CoC');
    const score  = Math.max(0, 100 - ovDed);
    const rejected = hasCoc || ovDed > 25;
    if (scoreEl) {
      scoreEl.textContent = rejected ? 'FOQA: REPROVADO' : `FOQA: ${score}/100`;
      scoreEl.className = 'foqa-live' + (rejected ? ' bad' : score === 100 ? ' perfect' : '');
    }
    if (foqaViolations.length === 0) {
      list.innerHTML = '<span class="viol-ok">✓ Nenhuma violação detectada</span>';
      return;
    }
    const coc = foqaViolations.filter(v => v.cat === 'CoC');
    const ov  = foqaViolations.filter(v => v.cat === 'Ov');
    list.innerHTML = [
      ...coc.map(v => `<div class="viol-coc"><span class="vi">✗</span><span>[CoC] ${v.desc}</span></div>`),
      ...ov.map(v  => `<div class="viol-err"><span class="vi">⚠</span><span>[Ov -${v.pts}] ${v.desc}</span></div>`)
    ].join('');
  }

  // ── Pouso detectado ───────────────────────────────────────────────────────
  async function onLanding() {
    if (!flightActive) return;
    flightActive = false;
    if (window.acars?.setFlightState) window.acars.setFlightState(false);
    addLogEntry('🛬', `Taxa de pouso: -${Math.round(landingRate)} FPM — ${classifyLanding(Math.round(landingRate))}`);
    clearInterval(timerInterval);
    clearInterval(liveInterval);

    const dur     = Math.floor((Date.now() - flightStart) / 1000);
    const fuelUsed = Math.max(0, fuelAtStart - (lastSimData?.fuel ?? fuelAtStart));

    // FOQA
    const cocViols  = foqaViolations.filter(v => v.cat === 'CoC');
    const ovDed     = foqaViolations.filter(v => v.cat === 'Ov').reduce((s, v) => s + v.pts, 0);
    const hardLanding  = landingRate > 500;
    const foqaRejected = cocViols.length > 0 || ovDed > 25 || hardLanding;
    const foqaScore    = Math.max(0, 100 - ovDed);
    const status       = foqaRejected ? 'rejected' : 'pending';
    const rejectReason = hardLanding ? 'hard_landing' :
                         cocViols.length > 0 ? cocViols[0].type : 'foqa_exceeded';

    // OP Points
    if (singleEngOPGiven) flightOp += 10;
    if (foqaScore === 100 && !foqaRejected) {
      flightOp += 50;
      addLogEntry('⭐', '+50 OP — FOQA 100%');
    }
    if (totalDist > 2000) {
      flightOp += 50;
      addLogEntry('⭐', '+50 OP — Voo longo (>2000 nm)');
    }
    addLogEntry('📋', `FOQA: ${foqaScore}/100 | OP ganhos: +${flightOp}`);

    const dep     = $('inp-dep').value.trim().toUpperCase();
    const arr     = $('inp-arr').value.trim().toUpperCase();
    const fl      = $('inp-fl').value.trim();
    const fn      = $('inp-fn').value.trim().toUpperCase();
    const obs     = $('inp-obs').value.trim();
    const netEl   = document.querySelector('input[name="network"]:checked');
    const network = netEl ? netEl.value : 'Offline';

    const pirep = {
      pilotId:      currentUser.uid,
      userId:       currentUser.uid,
      pilotName:    userData.name || '',
      pilotVid:     userData.vid  || '',
      dep, arr,
      ac:           userData.aircraft || aircraftTitle || '',
      fl, fn, obs,
      dur:          fmtDur(dur),
      date:         new Date().toISOString().split('T')[0],
      sim:          simType === 'msfs' ? 'MSFS' : 'X-Plane',
      network,
      status,
      source:       'acars',
      maxAlt:       Math.round(maxAlt),
      maxSpd:       Math.round(maxSpd),
      fuelUsed:     Math.round(fuelUsed),
      landingRate:  Math.round(landingRate),
      distance:     Math.round(totalDist),
      foqaScore,
      foqaViolations: foqaViolations.map(({ type, desc, pts, cat }) => ({ type, desc, pts, cat })),
      autoRejected: foqaRejected,
      rejectReason: foqaRejected ? rejectReason : null,
      opEarned:     flightOp,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };

    let pirepRef   = null;
    let pirepSaved = false;
    try {
      pirepRef = await db.collection('pireps').add(pirep);
      pirepSaved = true;
    } catch (err) {
      addLogEntry('⚠', 'Erro ao salvar PIREP — tentando novamente em 8s...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      try {
        pirepRef = await db.collection('pireps').add(pirep);
        pirepSaved = true;
        addLogEntry('✅', 'PIREP salvo na segunda tentativa');
      } catch (err2) {
        addLogEntry('✗', `Falha ao salvar PIREP: ${err2.message} — contate a administração`);
      }
    }

    // Fecha a sessão de voo — completed se PIREP salvo, abandoned se falhou
    if (flightSessionId) {
      db.collection('flight_sessions').doc(flightSessionId).update({
        status:       pirepSaved ? 'completed' : 'abandoned',
        pirepId:      pirepRef?.id || null,
        lastUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
        elapsedSecs:  dur,
        maxAlt, maxSpd, totalDist, foqaScore,
        violations:   foqaViolations.map(({ type, desc, pts, cat }) => ({ type, desc, pts, cat }))
      }).catch(() => {});
      clearInterval(sessionInterval);
      flightSessionId = null;
      sessionInterval = null;
    }

    if (foqaRejected) notifyDiscordRejected(pirep, rejectReason, foqaScore);

    const userUpdate = {
      flights:        firebase.firestore.FieldValue.increment(1),
      hours:          firebase.firestore.FieldValue.increment(+(dur / 3600).toFixed(2)),
      currentAirport: arr,
    };
    if (!foqaRejected && flightOp > 0) {
      userUpdate.opPoints = firebase.firestore.FieldValue.increment(flightOp);
    }
    await db.collection('users').doc(currentUser.uid).update(userUpdate).catch(() => {});
    await db.collection('liveflights').doc(currentUser.uid).delete().catch(() => {});

    showSummary({ dep, arr, dur, landingRate, maxAlt, maxSpd, fuelUsed, foqaScore,
                  status, foqaViolations, totalDist, flightOp, hardLanding });
  }

  // ── Encerrar manualmente ──────────────────────────────────────────────────
  window.stopFlight = async () => {
    if (!confirm('Finalizar o voo agora? O PIREP será descartado.')) return;
    flightActive = false;
    if (window.acars?.setFlightState) window.acars.setFlightState(false);
    clearInterval(timerInterval);
    clearInterval(liveInterval);
    if (flightSessionId) {
      db.collection('flight_sessions').doc(flightSessionId).update({
        status:       'abandoned',
        lastUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
        elapsedSecs:  flightStart ? Math.floor((Date.now() - flightStart) / 1000) : 0
      }).catch(() => {});
      clearInterval(sessionInterval);
      flightSessionId = null;
      sessionInterval = null;
    }
    await db.collection('liveflights').doc(currentUser.uid).delete().catch(() => {});
    resetFlight();
  };

  function resetFlight() {
    clearInterval(sessionInterval);
    sessionInterval = null;
    $('panel-tele').style.display  = 'none';
    $('panel-viols').style.display = 'none';
    $('violations-list').innerHTML = '<span class="viol-ok">✓ Nenhuma violação detectada</span>';
    const scoreEl = $('foqa-score-live');
    if (scoreEl) { scoreEl.textContent = 'FOQA: 100/100'; scoreEl.className = 'foqa-live perfect'; }
    $('tele-timer').textContent = '00:00:00';
    updateStartBtn();
  }

  // Limpa liveflight se o app for fechado durante um voo ativo
  window.addEventListener('beforeunload', () => {
    if (flightActive && currentUser) {
      db.collection('liveflights').doc(currentUser.uid).delete().catch(() => {});
    }
  });

  // ── Live tracking ─────────────────────────────────────────────────────────
  const PHASE_EN = {
    'SOLO':'taxi', 'DECOLAGEM':'climb', 'SUBIDA':'climb',
    'CRUZEIRO':'cruise', 'DESCIDA':'descent', 'APROXIMAÇÃO':'approach', 'VOO':'cruise'
  };

  async function pushLiveFlight() {
    if (!lastSimData || !flightActive) return;
    const d = lastSimData;
    const phase = PHASE_EN[flightPhase(d.spd, d.alt, d.vs, d.onGround)] || 'taxi';

    const payload = {
      pilotName: userData.name || '',
      dep:       $('inp-dep').value.trim().toUpperCase(),
      arr:       $('inp-arr').value.trim().toUpperCase(),
      aircraft:  aircraftTitle || '',
      phase,
      lat:       d.lat, lon: d.lon,
      alt:       Math.round(d.alt),
      spd:       Math.round(d.spd),
      hdg:       Math.round(((d.hdg || 0) + 360) % 360),
      vs:        Math.round(d.vs),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!liveFlightPushed) {
      payload.startedAt = firebase.firestore.FieldValue.serverTimestamp();
      liveFlightPushed = true;
    }

    await db.collection('liveflights').doc(currentUser.uid).set(payload, { merge: true }).catch(() => {});
  }

  // ── Checkpoint de sessão de voo (a cada 5 min) ───────────────────────────
  function updateFlightSession() {
    if (!flightSessionId || !flightActive || !flightStart) return;
    const phase  = lastSimData
      ? flightPhase(lastSimData.spd, lastSimData.alt, lastSimData.vs, lastSimData.onGround)
      : 'VOO';
    const ovDed  = foqaViolations.filter(v => v.cat === 'Ov').reduce((s, v) => s + v.pts, 0);
    db.collection('flight_sessions').doc(flightSessionId).update({
      lastUpdateAt: firebase.firestore.FieldValue.serverTimestamp(),
      elapsedSecs:  Math.floor((Date.now() - flightStart) / 1000),
      maxAlt, maxSpd, totalDist,
      lastPhase:    phase,
      foqaScore:    Math.max(0, 100 - ovDed),
      violations:   foqaViolations.map(({ type, desc, pts, cat }) => ({ type, desc, pts, cat })),
      lastAlt:      Math.round(lastSimData?.alt || 0),
      lastSpd:      Math.round(lastSimData?.spd || 0),
      sim:          simType === 'msfs' ? 'MSFS' : 'X-Plane',
    }).catch(() => {});
  }

  // ── Notificação Discord — PIREP auto-rejeitado ───────────────────────────
  function notifyDiscordRejected(pirep, rejectReason, foqaScore) {
    if (!discordWebhookUrl) return;
    const reasonMap = {
      hard_landing:   '🛬 Pouso acima de 500 FPM',
      foqa_exceeded:  '📉 Score FOQA abaixo do mínimo',
    };
    const reasonLabel = reasonMap[rejectReason] || rejectReason || 'Violação FOQA';
    const embed = {
      title: '❌ PIREP Recusado (ACARS)',
      color: 0xDC3545,
      fields: [
        { name: '👤 Piloto',    value: userData?.name || '—',          inline: true },
        { name: '🪪 Callsign',  value: userData?.callsign || '—',      inline: true },
        { name: '✈️ Aeronave',  value: pirep.aircraft || '—',          inline: true },
        { name: '🛫 Rota',      value: `${pirep.dep} → ${pirep.arr}`,  inline: true },
        { name: '⏱️ Duração',   value: pirep.dur || '—',               inline: true },
        { name: '🏆 Score FOQA',value: `${foqaScore}/100`,             inline: true },
        { name: '⚠️ Motivo',    value: reasonLabel,                    inline: false },
      ],
      footer: { text: 'Bravo Aviation · ACARS Auto-Rejeição' },
      timestamp: new Date().toISOString()
    };
    if (pirep.landingRate != null)
      embed.fields.push({ name: '🛬 Taxa de pouso', value: `${pirep.landingRate} FPM`, inline: true });
    fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    }).catch(() => {});
  }

  // ── Tela de resumo ────────────────────────────────────────────────────────
  function showSummary({ dep, arr, dur, landingRate, maxAlt, maxSpd, fuelUsed, foqaScore,
                         status, foqaViolations, totalDist, flightOp, hardLanding }) {
    const rejected = status === 'rejected';
    const coc = foqaViolations.filter(v => v.cat === 'CoC');
    const ov  = foqaViolations.filter(v => v.cat === 'Ov');

    $('sum-score').textContent = rejected ? '✗' : foqaScore;
    $('sum-score').className   = 'summary-score' + (rejected ? ' bad' : foqaScore === 100 ? ' perfect' : '');

    const badgeClass = rejected ? 'badge-rejected' : 'badge-pending';
    const badgeText  = rejected
      ? (hardLanding ? 'REPROVADO — POUSO DURO' : coc.length ? 'REPROVADO — VIOLAÇÃO CoC' : 'REPROVADO — FOQA')
      : 'PENDENTE DE APROVAÇÃO';
    $('sum-status-badge').innerHTML = `<span class="summary-badge ${badgeClass}">${badgeText}</span>`;

    $('sum-route').textContent = `${dep} → ${arr}`;
    $('sum-dur').textContent   = fmtDur(dur);
    $('sum-lr').textContent    = Math.round(landingRate) + ' FPM' + (hardLanding ? ' ⚠' : '');
    $('sum-alt').textContent   = fmt(maxAlt) + ' ft';
    $('sum-spd').textContent   = fmt(maxSpd) + ' kts';
    $('sum-fuel').textContent  = fmt(fuelUsed, 0) + ' gal';
    $('sum-dist').textContent  = fmt(totalDist, 0) + ' nm';

    const opEl = $('sum-op');
    if (opEl) opEl.textContent = (flightOp > 0 ? '+' : '') + flightOp + ' pontos';

    const violsEl = $('sum-viols');
    if (foqaViolations.length === 0 && !hardLanding) {
      violsEl.innerHTML = '<span class="viol-ok">✓ FOQA 100% — Nenhuma violação</span>';
    } else {
      violsEl.innerHTML = [
        ...coc.map(v => `<div class="viol-coc"><span class="vi">✗</span><span>[CoC] ${v.desc}</span></div>`),
        ...ov.map(v  => `<div class="viol-err"><span class="vi">⚠</span><span>[Ov -${v.pts}pts] ${v.desc}</span></div>`),
        hardLanding ? `<div class="viol-coc"><span class="vi">✗</span><span>Pouso duro — ${Math.round(landingRate)} FPM</span></div>` : ''
      ].join('');
    }

    $('topbar').style.display = 'flex';
    showScreen('screen-summary');
  }

  // ── Novo voo ──────────────────────────────────────────────────────────────
  window.newFlight = async () => {
    resetFlight();
    await loadPendingFlight();
    showScreen('screen-main');
  };

  // Inputs de rota disparam updateStartBtn
  ['inp-dep','inp-arr'].forEach(id => $(id).addEventListener('input', updateStartBtn));

})();
