/**
 * SCRIPT DE MIGRAÇÃO DE ROTAS — Bravo Aviation
 *
 * O que faz:
 *  1. Renomeia flightNumber de TAM → BRV em todas as rotas
 *  2. Adiciona campo `category` (L / M / H) conforme a aeronave
 *
 * Categorias ICAO de turbulência de esteira:
 *  L (Light)  — MTOW < 7.000 kg  | ex: Cessna, ATR-42
 *  M (Medium) — 7.000–136.000 kg | ex: A319, A320, A321, B737, E195
 *  H (Heavy)  — MTOW > 136.000 kg| ex: A330, B767, B777, B747, A380
 *
 * Como usar:
 *  1. Abra admin.html e faça login como admin
 *  2. F12 → Console
 *  3. fetch('migrate_routes.js').then(r=>r.text()).then(eval)
 */

(async function migrateRoutes() {

  if (typeof db === 'undefined') {
    console.error('❌ Execute este script na página admin.html.');
    return;
  }

  /* ── Mapa de categorias por aeronave ── */
  const CATEGORY = {
    // Light
    'C172': 'L', 'C208': 'L', 'PC12': 'L', 'ATR42': 'L', 'E120': 'L',
    'BE20': 'L', 'BE30': 'L', 'C25A': 'L', 'C25B': 'L', 'C25C': 'L',
    // Medium
    'A318': 'M', 'A319': 'M', 'A320': 'M', 'A321': 'M',
    'B731': 'M', 'B732': 'M', 'B733': 'M', 'B734': 'M',
    'B735': 'M', 'B736': 'M', 'B737': 'M', 'B738': 'M', 'B739': 'M',
    'B737-700': 'M', 'B737-800': 'M', 'B737-900': 'M',
    'Airbus A320': 'M', 'Airbus A319': 'M', 'Airbus A321': 'M',
    'Boeing 737-800': 'M', 'Boeing 737-700': 'M', 'Boeing 737-900': 'M',
    'E170': 'M', 'E175': 'M', 'E190': 'M', 'E195': 'M',
    'CRJ9': 'M', 'CRJ7': 'M', 'CRJ2': 'M',
    // Heavy
    'A330': 'H', 'A332': 'H', 'A333': 'H', 'A339': 'H',
    'A340': 'H', 'A342': 'H', 'A343': 'H', 'A345': 'H', 'A346': 'H',
    'A350': 'H', 'A359': 'H', 'A35K': 'H',
    'A380': 'H', 'A388': 'H',
    'B744': 'H', 'B747': 'H', 'B748': 'H',
    'B752': 'H', 'B753': 'H', 'B762': 'H', 'B763': 'H', 'B764': 'H',
    'B772': 'H', 'B773': 'H', 'B77L': 'H', 'B77W': 'H',
    'B787': 'H', 'B788': 'H', 'B789': 'H', 'B78X': 'H',
    'Boeing 777': 'H', 'Boeing 747': 'H', 'Boeing 787': 'H',
    'Airbus A330': 'H', 'Airbus A350': 'H', 'Airbus A380': 'H',
  };

  function getCategory(aircraft) {
    if (!aircraft) return 'M';
    // Busca direta
    if (CATEGORY[aircraft]) return CATEGORY[aircraft];
    // Busca parcial (ex: "Airbus A320neo" → M)
    const key = Object.keys(CATEGORY).find(k =>
      aircraft.toUpperCase().includes(k.toUpperCase())
    );
    return key ? CATEGORY[key] : 'M';
  }

  console.log('📦 Carregando rotas do Firestore...');

  const snap = await db.collection('routes').get();
  if (snap.empty) { console.warn('⚠️ Nenhuma rota encontrada.'); return; }

  console.log(`🔄 ${snap.size} rotas encontradas. Iniciando migração...`);

  const CHUNK = 450;
  const docs  = snap.docs;
  let updated = 0;

  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + CHUNK);

    chunk.forEach(doc => {
      const data = doc.data();
      const oldFlight = data.flightNumber || '';
      const newFlight = oldFlight.replace(/^TAM/i, 'BRV');
      const category  = getCategory(data.aircraft);

      batch.update(doc.ref, {
        flightNumber: newFlight,
        category:     category
      });
    });

    await batch.commit();
    updated += chunk.length;
    console.log(`  → ${updated}/${docs.length} rotas atualizadas...`);
  }

  console.log(`✅ Migração concluída! ${updated} rotas atualizadas.`);
  console.log('   • TAM → BRV nos números de voo');
  console.log('   • Campo category (L/M/H) adicionado');
  console.log('   Recarregue Admin → Rotas para confirmar.');

})();
