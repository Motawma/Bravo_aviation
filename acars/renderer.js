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
    window.acars.onUpdateReady(() => {
      const btn = $('btn-install-update');
      if (btn) { btn.textContent = '↺ Reiniciar e atualizar'; btn.disabled = false; }
    });
  }

  // ── Estado global ─────────────────────────────────────────────────────────
  let currentUser   = null;
  let userData      = null;
  let simConnected  = false;
  let simType       = null;
  let aircraftTitle = null;
  let flightActive  = false;

  // Log de voo
  let logPrevState  = null;
  let logLastPhase  = null;

  // Dados de voo
  let flightStart   = null;
  let timerInterval = null;
  let lastSimData   = null;
  let fuelAtStart   = null;
  let maxAlt        = 0;
  let maxSpd        = 0;
  let totalDist     = 0;
  let lastLat       = null;
  let lastLon       = null;
  let liveInterval  = null;

  // Violações
  const violations  = [];
  let tookOff       = false;
  let tookOffWithoutLights = false;
  let overspeedTimer= 0;       // segundos contínuos em overspeed abaixo de 10k
  let overspeedFlagged = false;
  let transponderFlagged = false;
  let landingRate   = 0;

  // ── Utilitários ───────────────────────────────────────────────────────────
  function $ (id) { return document.getElementById(id); }

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

  function flightPhase(spd, alt, vs, onGround) {
    if (onGround && spd < 40)  return 'SOLO';
    if (onGround && spd >= 40) return 'DECOLAGEM';
    if (vs > 200)  return 'SUBIDA';
    if (vs < -200) return 'DESCIDA';
    if (alt > 8000 && Math.abs(vs) <= 200) return 'CRUZEIRO';
    if (alt <= 8000 && !onGround) return 'APROXIMAÇÃO';
    return 'VOO';
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
      if (d.flapsIndex === 0) addLogEntry('🛫', 'Flaps recolhidos');
      else if (d.flapsIndex > (p.flapsIndex || 0)) addLogEntry('🛬', `Flaps posição ${d.flapsIndex}`);
      else addLogEntry('🛫', `Flaps reduzidos para posição ${d.flapsIndex}`);
    }

    if (changed('gearDown')) addLogEntry(d.gearDown ? '⬇️' : '⬆️', d.gearDown ? 'Trem de pouso extendido' : 'Trem de pouso recolhido');

    if (changed('onGround') && !d.onGround) addLogEntry('✈️', 'Decolagem detectada');
    if (changed('onGround') &&  d.onGround && d.spd > 10) addLogEntry('🛬', `Pouso — ${Math.round(d.spd)} kts`);

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
    showScreen('screen-main');
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
    showMain();
    await loadPendingFlight();
    setupSimListeners();
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  $('btn-logout').addEventListener('click', async () => {
    if (flightActive) { alert('Encerre o voo antes de sair.'); return; }
    window.acars.removeListeners();
    await window.acars.disconnectSim();
    await auth.signOut();
    currentUser = null; userData = null; simConnected = false;
    $('topbar').style.display = 'none';
    showScreen('screen-login');
  });

  // ── Rota pendente (selecionada no dashboard) ──────────────────────────────
  async function loadPendingFlight() {
    try {
      const snap = await db.collection('users').doc(currentUser.uid).get();
      const pf   = snap.data()?.pendingFlight;
      if (!pf) return;
      $('inp-dep').value = pf.dep        || '';
      $('inp-arr').value = pf.arr        || '';
      $('inp-fl').value  = pf.plannedFL  || '';
      $('inp-obs').value = pf.obs        || '';
      const badge = $('route-loaded-badge');
      if (badge) {
        badge.textContent = '✓ ' + (pf.flightNumber || pf.dep + '→' + pf.arr) + ' carregado do site';
        badge.style.display = '';
      }
      updateStartBtn();
      // Apaga do Firestore para não reaparecer numa próxima abertura
      await db.collection('users').doc(currentUser.uid).update({
        pendingFlight: firebase.firestore.FieldValue.delete()
      });
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
        $('panel-log').style.display = '';
        logPrevState = null;
        logLastPhase = null;
        addLogEntry('🔌', `Simulador conectado (${type === 'msfs' ? 'MSFS' : 'X-Plane'})`);
      } else {
        dot.className   = 'dot';
        label.textContent = 'Desconectado';
        aircraftTitle   = null;
        $('ac-title').textContent = '—';
        $('btn-connect-msfs').style.display   = '';
        $('btn-connect-xp').style.display     = '';
        $('btn-disconnect-sim').style.display = 'none';
        $('panel-log').style.display = 'none';
      }
      updateStartBtn();
    });

    window.acars.onSimData(data => {
      lastSimData = data;

      // Detecta aeronave carregada
      if (data.aircraft && data.aircraft !== aircraftTitle) {
        aircraftTitle = data.aircraft;
        $('ac-title').textContent = aircraftTitle;
        addLogEntry('✈️', `Aeronave: ${aircraftTitle}`, true);
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
    flightStart     = Date.now();
    fuelAtStart     = lastSimData?.fuel ?? 0;
    maxAlt          = 0; maxSpd = 0; totalDist = 0;
    lastLat         = lastSimData?.lat ?? null;
    lastLon         = lastSimData?.lon ?? null;
    tookOff         = false;
    tookOffWithoutLights = false;
    overspeedTimer  = 0; overspeedFlagged = false;
    transponderFlagged = false;
    landingRate     = 0;
    violations.length = 0;

    $('panel-tele').style.display  = '';
    $('panel-viols').style.display = '';
    updateStartBtn();
    addLogEntry('▶', `Voo iniciado — ${$('inp-dep').value} → ${$('inp-arr').value}`);

    // Timer
    timerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - flightStart) / 1000);
      $('tele-timer').textContent = fmtDur(secs);
    }, 1000);

    // Live tracking (a cada 30s)
    await pushLiveFlight();
    liveInterval = setInterval(pushLiveFlight, 30000);

    // Apaga pendingFlight do Firestore
    await db.collection('users').doc(currentUser.uid).update({ pendingFlight: firebase.firestore.FieldValue.delete() }).catch(() => {});
  };

  // ── Processar telemetria durante o voo ────────────────────────────────────
  function processTelemetry(d) {
    const { alt, spd, vs, hdg, fuel, onGround, landingLights, transponderMode, aircraft } = d;

    // Atualiza máximos
    if (alt > maxAlt) maxAlt = alt;
    if (spd > maxSpd) maxSpd = spd;

    // Distância acumulada
    if (lastLat !== null) {
      const dist = haversine(lastLat, lastLon, d.lat, d.lon);
      if (dist < 50) totalDist += dist; // ignora saltos impossíveis
    }
    lastLat = d.lat; lastLon = d.lon;

    // Fase do voo
    const phase = flightPhase(spd, alt, vs, onGround);
    $('tele-phase').textContent = phase;

    // Telemetria na UI
    $('t-alt').textContent  = fmt(alt) + ' ft';
    $('t-spd').textContent  = fmt(spd) + ' kts';
    $('t-vs').textContent   = (vs >= 0 ? '+' : '') + fmt(vs) + ' fpm';
    $('t-hdg').textContent  = fmt(hdg) + '°';
    $('t-fuel').textContent = fmt(fuel, 0) + ' gal';
    $('t-dist').textContent = fmt(totalDist, 0) + ' nm';

    // ── Violação 1: decolou sem luzes de pouso ──────────────────────────────
    if (!tookOff && spd > 80 && !onGround) {
      tookOff = true;
      if (!landingLights) {
        tookOffWithoutLights = true;
        addViolation('no_landing_lights', 'Decolou sem luzes de pouso', 10);
      }
    }

    // ── Violação 2: transponder não em Modo C (acima de 1000ft AGL) ─────────
    if (!transponderFlagged && !onGround && alt > 1000) {
      const modeC = (simType === 'xplane') ? transponderMode === 3 : transponderMode === 4;
      if (!modeC) {
        transponderFlagged = true;
        addViolation('transponder', 'Transponder não estava em Modo C', 10);
      }
    }

    // ── Violação 3: overspeed abaixo de 10.000ft ─────────────────────────────
    if (!onGround && alt < 10000 && spd > 150) {
      overspeedTimer++;
      if (overspeedTimer >= 60 && !overspeedFlagged) {
        overspeedFlagged = true;
        addViolation('overspeed_10k', 'Velocidade > 150kts abaixo de 10.000ft', 15);
      }
    } else {
      overspeedTimer = 0;
    }

    // ── Detecção de pouso ────────────────────────────────────────────────────
    if (tookOff && onGround && spd < 40) {
      // Usa touchdownVS do MSFS se disponível, senão usa VS atual como fallback
      landingRate = d.touchdownVS > 0 ? d.touchdownVS : Math.abs(Math.min(vs, 0));
      onLanding();
    }
  }

  function addViolation(type, desc, penalty) {
    if (violations.find(v => v.type === type)) return;
    violations.push({ type, desc, penalty });
    renderViolations();
  }

  function renderViolations() {
    const list = $('violations-list');
    if (violations.length === 0) {
      list.innerHTML = '<span class="viol-ok">✓ Nenhuma violação detectada</span>';
      return;
    }
    list.innerHTML = violations.map(v =>
      `<div class="viol-err"><span class="vi">⚠</span><span>-${v.penalty}pts — ${v.desc}</span></div>`
    ).join('');
  }

  // ── Pouso detectado ───────────────────────────────────────────────────────
  async function onLanding() {
    if (!flightActive) return;
    flightActive = false;
    addLogEntry('🛬', `Pouso detectado — ${Math.round(lastSimData?.spd || 0)} kts, ${Math.round(landingRate)} FPM`);
    clearInterval(timerInterval);
    clearInterval(liveInterval);

    const dur  = Math.floor((Date.now() - flightStart) / 1000);
    const fuel = Math.max(0, fuelAtStart - (lastSimData?.fuel ?? fuelAtStart));

    // Score
    const totalPenalty = violations.reduce((acc, v) => acc + v.penalty, 0);
    const score        = Math.max(0, 100 - totalPenalty);

    // Hard landing?
    const hardLanding  = landingRate > 500;
    const status       = hardLanding ? 'rejected' : 'pending';

    // PIREP
    const dep  = $('inp-dep').value.trim().toUpperCase();
    const arr  = $('inp-arr').value.trim().toUpperCase();
    const fl   = $('inp-fl').value.trim();
    const obs  = $('inp-obs').value.trim();

    const pirep = {
      pilotId:      currentUser.uid,
      pilotName:    userData.name || '',
      pilotVid:     userData.vid  || '',
      dep, arr,
      ac:           userData.aircraft || aircraftTitle || '',
      fl,
      obs,
      dur:          fmtDur(dur),
      date:         new Date().toISOString().split('T')[0],
      sim:          simType === 'msfs' ? 'MSFS' : 'X-Plane',
      status,
      source:       'acars',
      maxAlt:       Math.round(maxAlt),
      maxSpd:       Math.round(maxSpd),
      fuelUsed:     Math.round(fuel),
      landingRate:  Math.round(landingRate),
      distance:     Math.round(totalDist),
      score,
      violations:   violations.map(({ type, desc }) => ({ type, desc })),
      autoRejected: hardLanding,
      rejectReason: hardLanding ? 'hard_landing' : null,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('pireps').add(pirep);

    // Atualiza horas/voos e posição do piloto
    await db.collection('users').doc(currentUser.uid).update({
      flights:        firebase.firestore.FieldValue.increment(1),
      hours:          firebase.firestore.FieldValue.increment(+(dur / 3600).toFixed(2)),
      currentAirport: arr
    }).catch(() => {});

    // Apaga liveflight
    await db.collection('liveflights').doc(currentUser.uid).delete().catch(() => {});

    showSummary({ dep, arr, dur, landingRate, maxAlt, maxSpd, fuel, score, status, violations, totalDist });
  }

  // ── Encerrar manualmente ──────────────────────────────────────────────────
  window.stopFlight = async () => {
    if (!confirm('Encerrar o voo agora? O PIREP será descartado.')) return;
    flightActive = false;
    clearInterval(timerInterval);
    clearInterval(liveInterval);
    await db.collection('liveflights').doc(currentUser.uid).delete().catch(() => {});
    resetFlight();
  };

  function resetFlight() {
    $('panel-tele').style.display  = 'none';
    $('panel-viols').style.display = 'none';
    $('violations-list').innerHTML = '<span class="viol-ok">✓ Nenhuma violação detectada</span>';
    $('tele-timer').textContent    = '00:00:00';
    updateStartBtn();
  }

  // ── Live tracking ─────────────────────────────────────────────────────────
  async function pushLiveFlight() {
    if (!lastSimData || !flightActive) return;
    const d = lastSimData;
    const phase = flightPhase(d.spd, d.alt, d.vs, d.onGround);

    await db.collection('liveflights').doc(currentUser.uid).set({
      pilotName: userData.name || '',
      dep:       $('inp-dep').value.trim().toUpperCase(),
      arr:       $('inp-arr').value.trim().toUpperCase(),
      aircraft:  aircraftTitle || '',
      phase,
      lat:       d.lat, lon: d.lon,
      alt:       Math.round(d.alt),
      spd:       Math.round(d.spd),
      hdg:       Math.round(d.hdg),
      vs:        Math.round(d.vs),
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  }

  // ── Tela de resumo ────────────────────────────────────────────────────────
  function showSummary({ dep, arr, dur, landingRate, maxAlt, maxSpd, fuel, score, status, violations, totalDist }) {
    const hardLanding = status === 'rejected';

    $('sum-score').textContent = hardLanding ? '✗' : score;
    $('sum-score').className   = 'summary-score' + (hardLanding ? ' bad' : '');

    const badgeClass = hardLanding ? 'badge-rejected' : (score >= 80 ? 'badge-ok' : 'badge-pending');
    const badgeText  = hardLanding ? 'PIREP REPROVADO — POUSO DURO' : (score >= 80 ? 'PIREP APROVADO' : 'AGUARDANDO REVISÃO');
    $('sum-status-badge').innerHTML = `<span class="summary-badge ${badgeClass}">${badgeText}</span>`;

    $('sum-route').textContent = `${dep} → ${arr}`;
    $('sum-dur').textContent   = fmtDur(dur);
    $('sum-lr').textContent    = Math.round(landingRate) + ' FPM' + (hardLanding ? ' ⚠' : '');
    $('sum-alt').textContent   = fmt(maxAlt) + ' ft';
    $('sum-spd').textContent   = fmt(maxSpd) + ' kts';
    $('sum-fuel').textContent  = fmt(fuel, 0) + ' gal';
    $('sum-dist').textContent  = fmt(totalDist, 0) + ' nm';

    const violsEl = $('sum-viols');
    if (violations.length === 0 && !hardLanding) {
      violsEl.innerHTML = '<span class="viol-ok">✓ Nenhuma violação</span>';
    } else {
      violsEl.innerHTML = violations.map(v =>
        `<div class="viol-err"><span class="vi">⚠</span><span>-${v.penalty}pts — ${v.desc}</span></div>`
      ).join('');
      if (hardLanding) {
        violsEl.innerHTML += '<div class="viol-err"><span class="vi">✗</span><span>Pouso duro (>' + Math.round(landingRate) + ' FPM) — PIREP reprovado</span></div>';
      }
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
