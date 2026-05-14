// ─────────────────────────────────────────────────────────────────────────────
// Migração inicial: popula a coleção 'downloads' no Firestore com os itens
// que estavam hardcoded no dashboard.html.
//
// Como usar: abra admin.html, abra o console (F12) e cole este script.
// Execute apenas UMA VEZ. Verifique antes se a coleção já existe.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  // Verifica se já existe algum item
  const check = await db.collection('downloads').limit(1).get();
  if (!check.empty) {
    console.warn('⚠️ A coleção downloads já tem itens. Migração cancelada para evitar duplicatas.');
    console.log('   Itens existentes:', check.docs.map(d => d.data().name));
    return;
  }

  const items = [
    {
      type: 'ACARS — Windows',
      name: 'Bravo ACARS v1.2.51',
      desc: 'App oficial da Bravo Aviation para registrar voos automaticamente. Conecta ao MSFS 2020/2024 e X-Plane 11/12. Registra PIREPs com telemetria completa.',
      ver: 'v1.2.51', size: '88 MB', date: 'Mai 2026',
      url: 'https://drive.google.com/file/d/1UD4C6xZoK4YQ2-3jVq_uVvzR_SufuYAo/view?usp=sharing',
      thumb: '', order: 0
    },
    {
      type: 'Livery — MSFS 2024',
      name: 'BRV Boeing 737-800',
      desc: 'Livery oficial Bravo Aviation para Boeing 737-800 no MSFS 2024.',
      ver: 'v1.2', size: '28 MB', date: 'Abr 2025',
      url: '', thumb: '', order: 1
    },
    {
      type: 'Livery — MSFS 2024',
      name: 'BRV Airbus A320',
      desc: 'Livery oficial Bravo Aviation para Airbus A320 no MSFS 2024.',
      ver: 'v1.1', size: '22 MB', date: 'Mar 2025',
      url: 'https://drive.google.com/drive/folders/1pMAZMqdtNB5YZE10xDj45mBRc5Kkx8tK?usp=drive_link',
      thumb: '', order: 2
    },
    {
      type: 'Livery — X-Plane 12',
      name: 'BRV Boeing 737-800 XP12',
      desc: 'Livery oficial para o Boeing 737-800 Zibo no X-Plane 12.',
      ver: 'v1.0', size: '18 MB', date: 'Mar 2025',
      url: '', thumb: '', order: 3
    },
    {
      type: 'Manual',
      name: 'Manual de Operações BRV',
      desc: 'Procedimentos operacionais padrão, políticas de voo e regras da VA.',
      ver: 'v2.0', size: '3.2 MB', date: 'Jan 2025',
      url: '', thumb: '', order: 4
    },
    {
      type: 'Manual',
      name: 'SOP — Boeing 737-800',
      desc: 'Standard Operating Procedures para a frota Boeing 737-800.',
      ver: 'v1.5', size: '5.1 MB', date: 'Fev 2025',
      url: '', thumb: '', order: 5
    },
    {
      type: 'Manual',
      name: 'SOP — Airbus A320',
      desc: 'Standard Operating Procedures para a frota Airbus A320.',
      ver: 'v1.3', size: '4.8 MB', date: 'Fev 2025',
      url: '', thumb: '', order: 6
    }
  ];

  const batch = db.batch();
  items.forEach(item => {
    const ref = db.collection('downloads').doc();
    batch.set(ref, { ...item, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  });

  await batch.commit();
  console.log('✅ Migração concluída! ' + items.length + ' itens criados na coleção downloads.');
  console.log('   Acesse Admin → Downloads para gerenciar os itens.');
})();
