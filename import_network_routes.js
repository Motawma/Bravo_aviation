/**
 * IMPORT NETWORK ROUTES — Bravo Aviation
 * Cria malha completa: retornos para SBGR + conexões entre hubs
 *
 * Como usar:
 * 1. Abra admin.html e faça login
 * 2. F12 → Console
 * 3. fetch('/import_network_routes.js').then(r=>r.text()).then(eval)
 */

(async function importNetwork() {
  if (typeof db === 'undefined') {
    console.error('❌ Execute na página admin.html com Firebase carregado.');
    return;
  }

  const ROUTES = [

    // ═══════════════════════════════════════════════════════════
    // RETORNOS → SBGR (todos os destinos voltando para o hub)
    // ═══════════════════════════════════════════════════════════
    { dep:'SBGL', arr:'SBGR', plannedFL:'250', eet:'00:40', distance:181  },
    { dep:'SBBR', arr:'SBGR', plannedFL:'340', eet:'01:20', distance:461  },
    { dep:'SBCF', arr:'SBGR', plannedFL:'330', eet:'00:55', distance:268  },
    { dep:'SBPA', arr:'SBGR', plannedFL:'340', eet:'01:30', distance:467  },
    { dep:'SBCT', arr:'SBGR', plannedFL:'300', eet:'00:50', distance:194  },
    { dep:'SBFL', arr:'SBGR', plannedFL:'340', eet:'01:05', distance:277  },
    { dep:'SBNF', arr:'SBGR', plannedFL:'320', eet:'01:00', distance:238  },
    { dep:'SBSV', arr:'SBGR', plannedFL:'350', eet:'02:00', distance:784  },
    { dep:'SBRF', arr:'SBGR', plannedFL:'350', eet:'02:45', distance:1134 },
    { dep:'SBFZ', arr:'SBGR', plannedFL:'350', eet:'03:05', distance:1267 },
    { dep:'SBMO', arr:'SBGR', plannedFL:'350', eet:'02:35', distance:1036 },
    { dep:'SBTE', arr:'SBGR', plannedFL:'340', eet:'03:00', distance:1123 },
    { dep:'SBBE', arr:'SBGR', plannedFL:'340', eet:'03:25', distance:1329 },
    { dep:'SBSL', arr:'SBGR', plannedFL:'340', eet:'03:15', distance:1258 },
    { dep:'SBEG', arr:'SBGR', plannedFL:'340', eet:'03:40', distance:1456 },
    { dep:'SBPV', arr:'SBGR', plannedFL:'340', eet:'03:30', distance:1336 },
    { dep:'SBBV', arr:'SBGR', plannedFL:'340', eet:'04:20', distance:1783 },
    { dep:'SBMQ', arr:'SBGR', plannedFL:'340', eet:'03:40', distance:1435 },
    { dep:'SBRB', arr:'SBGR', plannedFL:'340', eet:'03:40', distance:1473 },
    { dep:'SBGO', arr:'SBGR', plannedFL:'340', eet:'01:15', distance:437  },
    { dep:'SBCG', arr:'SBGR', plannedFL:'340', eet:'01:35', distance:489  },
    { dep:'SBCY', arr:'SBGR', plannedFL:'340', eet:'02:00', distance:717  },
    { dep:'SBUL', arr:'SBGR', plannedFL:'340', eet:'01:00', distance:290  },
    { dep:'SBMG', arr:'SBGR', plannedFL:'340', eet:'01:05', distance:305  },
    { dep:'SBLO', arr:'SBGR', plannedFL:'340', eet:'01:00', distance:257  },
    { dep:'SBVT', arr:'SBGR', plannedFL:'350', eet:'01:10', distance:393  },
    { dep:'SBAR', arr:'SBGR', plannedFL:'350', eet:'02:15', distance:920  },
    { dep:'SBPS', arr:'SBGR', plannedFL:'350', eet:'01:35', distance:591  },
    { dep:'SBIL', arr:'SBGR', plannedFL:'350', eet:'01:45', distance:667  },
    { dep:'SBFI', arr:'SBGR', plannedFL:'340', eet:'01:30', distance:456  },
    { dep:'SBPF', arr:'SBGR', plannedFL:'340', eet:'01:25', distance:428  },
    { dep:'SBPJ', arr:'SBGR', plannedFL:'340', eet:'02:10', distance:796  },
    { dep:'SBPL', arr:'SBGR', plannedFL:'350', eet:'02:20', distance:910  },
    { dep:'SBSI', arr:'SBGR', plannedFL:'340', eet:'02:35', distance:866  },
    { dep:'SBDB', arr:'SBGR', plannedFL:'340', eet:'01:50', distance:569  },
    { dep:'SBVC', arr:'SBGR', plannedFL:'350', eet:'01:35', distance:604  },
    { dep:'SBCA', arr:'SBGR', plannedFL:'340', eet:'01:20', distance:396  },
    { dep:'SBCH', arr:'SBGR', plannedFL:'340', eet:'01:20', distance:402  },
    { dep:'SBDO', arr:'SBGR', plannedFL:'340', eet:'01:30', distance:472  },
    { dep:'SBUR', arr:'SBGR', plannedFL:'340', eet:'01:00', distance:235  },
    { dep:'SBRP', arr:'SBGR', plannedFL:'280', eet:'01:00', distance:155  },
    { dep:'SBSR', arr:'SBGR', plannedFL:'260', eet:'00:50', distance:226  },
    { dep:'SBCX', arr:'SBGR', plannedFL:'340', eet:'01:30', distance:428  },
    { dep:'SBMK', arr:'SBGR', plannedFL:'350', eet:'01:10', distance:430  },
    { dep:'SBJU', arr:'SBGR', plannedFL:'350', eet:'02:35', distance:1058 },
    { dep:'SBSG', arr:'SBGR', plannedFL:'350', eet:'03:00', distance:1239 },
    { dep:'SBJA', arr:'SBGR', plannedFL:'340', eet:'01:10', distance:344  },
    { dep:'SBJV', arr:'SBGR', plannedFL:'300', eet:'00:50', distance:209  },
    { dep:'SBIZ', arr:'SBGR', plannedFL:'340', eet:'02:50', distance:1076 },
    { dep:'SBJP', arr:'SBGR', plannedFL:'350', eet:'02:50', distance:1365 },
    { dep:'SBJE', arr:'SBGR', plannedFL:'350', eet:'03:05', distance:1282 },
    { dep:'SACO',  arr:'SBGR', plannedFL:'360', eet:'02:56', distance:1107 },

    // ═══════════════════════════════════════════════════════════
    // SBBR (BRASÍLIA) — Hub secundário, conecta tudo
    // ═══════════════════════════════════════════════════════════
    { dep:'SBBR', arr:'SBGL', plannedFL:'260', eet:'01:05', distance:430  },
    { dep:'SBGL', arr:'SBBR', plannedFL:'260', eet:'01:05', distance:430  },
    { dep:'SBBR', arr:'SBCF', plannedFL:'290', eet:'01:00', distance:340  },
    { dep:'SBCF', arr:'SBBR', plannedFL:'290', eet:'01:00', distance:340  },
    { dep:'SBBR', arr:'SBPA', plannedFL:'340', eet:'02:00', distance:870  },
    { dep:'SBPA', arr:'SBBR', plannedFL:'340', eet:'02:00', distance:870  },
    { dep:'SBBR', arr:'SBCT', plannedFL:'320', eet:'01:30', distance:584  },
    { dep:'SBCT', arr:'SBBR', plannedFL:'320', eet:'01:30', distance:584  },
    { dep:'SBBR', arr:'SBFZ', plannedFL:'350', eet:'02:00', distance:860  },
    { dep:'SBFZ', arr:'SBBR', plannedFL:'350', eet:'02:00', distance:860  },
    { dep:'SBBR', arr:'SBSV', plannedFL:'340', eet:'01:35', distance:632  },
    { dep:'SBSV', arr:'SBBR', plannedFL:'340', eet:'01:35', distance:632  },
    { dep:'SBBR', arr:'SBRF', plannedFL:'350', eet:'02:10', distance:905  },
    { dep:'SBRF', arr:'SBBR', plannedFL:'350', eet:'02:10', distance:905  },
    { dep:'SBBR', arr:'SBBE', plannedFL:'340', eet:'02:00', distance:793  },
    { dep:'SBBE', arr:'SBBR', plannedFL:'340', eet:'02:00', distance:793  },
    { dep:'SBBR', arr:'SBEG', plannedFL:'340', eet:'02:40', distance:1039 },
    { dep:'SBEG', arr:'SBBR', plannedFL:'340', eet:'02:40', distance:1039 },
    { dep:'SBBR', arr:'SBGO', plannedFL:'260', eet:'00:45', distance:145  },
    { dep:'SBGO', arr:'SBBR', plannedFL:'260', eet:'00:45', distance:145  },
    { dep:'SBBR', arr:'SBCG', plannedFL:'300', eet:'01:00', distance:366  },
    { dep:'SBCG', arr:'SBBR', plannedFL:'300', eet:'01:00', distance:366  },
    { dep:'SBBR', arr:'SBMO', plannedFL:'350', eet:'01:35', distance:693  },
    { dep:'SBMO', arr:'SBBR', plannedFL:'350', eet:'01:35', distance:693  },
    { dep:'SBBR', arr:'SBPV', plannedFL:'340', eet:'02:20', distance:927  },
    { dep:'SBPV', arr:'SBBR', plannedFL:'340', eet:'02:20', distance:927  },
    { dep:'SBBR', arr:'SBCY', plannedFL:'320', eet:'01:20', distance:503  },
    { dep:'SBCY', arr:'SBBR', plannedFL:'320', eet:'01:20', distance:503  },
    { dep:'SBBR', arr:'SBSL', plannedFL:'340', eet:'02:10', distance:884  },
    { dep:'SBSL', arr:'SBBR', plannedFL:'340', eet:'02:10', distance:884  },
    { dep:'SBBR', arr:'SBTE', plannedFL:'340', eet:'01:40', distance:675  },
    { dep:'SBTE', arr:'SBBR', plannedFL:'340', eet:'01:40', distance:675  },
    { dep:'SBBR', arr:'SBJU', plannedFL:'350', eet:'01:20', distance:552  },
    { dep:'SBJU', arr:'SBBR', plannedFL:'350', eet:'01:20', distance:552  },

    // ═══════════════════════════════════════════════════════════
    // NORDESTE — Salvador, Recife, Fortaleza, Maceió, João Pessoa
    // ═══════════════════════════════════════════════════════════
    { dep:'SBSV', arr:'SBRF', plannedFL:'270', eet:'01:00', distance:369  },
    { dep:'SBRF', arr:'SBSV', plannedFL:'270', eet:'01:00', distance:369  },
    { dep:'SBSV', arr:'SBFZ', plannedFL:'320', eet:'01:20', distance:504  },
    { dep:'SBFZ', arr:'SBSV', plannedFL:'320', eet:'01:20', distance:504  },
    { dep:'SBSV', arr:'SBMO', plannedFL:'300', eet:'00:50', distance:294  },
    { dep:'SBMO', arr:'SBSV', plannedFL:'300', eet:'00:50', distance:294  },
    { dep:'SBSV', arr:'SBBE', plannedFL:'340', eet:'01:50', distance:740  },
    { dep:'SBBE', arr:'SBSV', plannedFL:'340', eet:'01:50', distance:740  },
    { dep:'SBRF', arr:'SBFZ', plannedFL:'300', eet:'01:00', distance:362  },
    { dep:'SBFZ', arr:'SBRF', plannedFL:'300', eet:'01:00', distance:362  },
    { dep:'SBRF', arr:'SBMO', plannedFL:'260', eet:'00:40', distance:191  },
    { dep:'SBMO', arr:'SBRF', plannedFL:'260', eet:'00:40', distance:191  },
    { dep:'SBRF', arr:'SBBE', plannedFL:'340', eet:'02:00', distance:791  },
    { dep:'SBBE', arr:'SBRF', plannedFL:'340', eet:'02:00', distance:791  },
    { dep:'SBFZ', arr:'SBBE', plannedFL:'340', eet:'01:45', distance:681  },
    { dep:'SBBE', arr:'SBFZ', plannedFL:'340', eet:'01:45', distance:681  },
    { dep:'SBFZ', arr:'SBMO', plannedFL:'280', eet:'00:55', distance:302  },
    { dep:'SBMO', arr:'SBFZ', plannedFL:'280', eet:'00:55', distance:302  },
    { dep:'SBSV', arr:'SBAR', plannedFL:'280', eet:'00:50', distance:264  },
    { dep:'SBAR', arr:'SBSV', plannedFL:'280', eet:'00:50', distance:264  },
    { dep:'SBRF', arr:'SBJP', plannedFL:'240', eet:'00:35', distance:109  },
    { dep:'SBJP', arr:'SBRF', plannedFL:'240', eet:'00:35', distance:109  },
    { dep:'SBFZ', arr:'SBJE', plannedFL:'260', eet:'00:30', distance:98   },
    { dep:'SBJE', arr:'SBFZ', plannedFL:'260', eet:'00:30', distance:98   },
    { dep:'SBFZ', arr:'SBTE', plannedFL:'300', eet:'00:55', distance:339  },
    { dep:'SBTE', arr:'SBFZ', plannedFL:'300', eet:'00:55', distance:339  },
    { dep:'SBRF', arr:'SBSG', plannedFL:'270', eet:'00:45', distance:229  },
    { dep:'SBSG', arr:'SBRF', plannedFL:'270', eet:'00:45', distance:229  },

    // ═══════════════════════════════════════════════════════════
    // NORTE — Belém, Manaus, Porto Velho, Boa Vista, Macapá
    // ═══════════════════════════════════════════════════════════
    { dep:'SBBE', arr:'SBEG', plannedFL:'340', eet:'01:30', distance:587  },
    { dep:'SBEG', arr:'SBBE', plannedFL:'340', eet:'01:30', distance:587  },
    { dep:'SBBE', arr:'SBSL', plannedFL:'300', eet:'00:40', distance:122  },
    { dep:'SBSL', arr:'SBBE', plannedFL:'300', eet:'00:40', distance:122  },
    { dep:'SBEG', arr:'SBPV', plannedFL:'320', eet:'00:50', distance:268  },
    { dep:'SBPV', arr:'SBEG', plannedFL:'320', eet:'00:50', distance:268  },
    { dep:'SBEG', arr:'SBBV', plannedFL:'300', eet:'01:00', distance:388  },
    { dep:'SBBV', arr:'SBEG', plannedFL:'300', eet:'01:00', distance:388  },
    { dep:'SBEG', arr:'SBMQ', plannedFL:'300', eet:'00:40', distance:154  },
    { dep:'SBMQ', arr:'SBEG', plannedFL:'300', eet:'00:40', distance:154  },
    { dep:'SBEG', arr:'SBRB', plannedFL:'320', eet:'01:00', distance:340  },
    { dep:'SBRB', arr:'SBEG', plannedFL:'320', eet:'01:00', distance:340  },
    { dep:'SBEG', arr:'SBIZ', plannedFL:'320', eet:'01:10', distance:412  },
    { dep:'SBIZ', arr:'SBEG', plannedFL:'320', eet:'01:10', distance:412  },
    { dep:'SBBE', arr:'SBIZ', plannedFL:'310', eet:'00:55', distance:295  },
    { dep:'SBIZ', arr:'SBBE', plannedFL:'310', eet:'00:55', distance:295  },

    // ═══════════════════════════════════════════════════════════
    // SUL — Porto Alegre, Curitiba, Florianópolis, Navegantes
    // ═══════════════════════════════════════════════════════════
    { dep:'SBPA', arr:'SBCT', plannedFL:'300', eet:'00:40', distance:198  },
    { dep:'SBCT', arr:'SBPA', plannedFL:'300', eet:'00:40', distance:198  },
    { dep:'SBPA', arr:'SBFL', plannedFL:'300', eet:'00:30', distance:118  },
    { dep:'SBFL', arr:'SBPA', plannedFL:'300', eet:'00:30', distance:118  },
    { dep:'SBPA', arr:'SBNF', plannedFL:'280', eet:'00:35', distance:131  },
    { dep:'SBNF', arr:'SBPA', plannedFL:'280', eet:'00:35', distance:131  },
    { dep:'SBPA', arr:'SBCF', plannedFL:'320', eet:'01:25', distance:514  },
    { dep:'SBCF', arr:'SBPA', plannedFL:'320', eet:'01:25', distance:514  },
    { dep:'SBCT', arr:'SBFL', plannedFL:'280', eet:'00:30', distance:114  },
    { dep:'SBFL', arr:'SBCT', plannedFL:'280', eet:'00:30', distance:114  },
    { dep:'SBCT', arr:'SBNF', plannedFL:'260', eet:'00:25', distance:87   },
    { dep:'SBNF', arr:'SBCT', plannedFL:'260', eet:'00:25', distance:87   },
    { dep:'SBCT', arr:'SBCF', plannedFL:'300', eet:'01:00', distance:318  },
    { dep:'SBCF', arr:'SBCT', plannedFL:'300', eet:'01:00', distance:318  },
    { dep:'SBPA', arr:'SBGL', plannedFL:'320', eet:'01:30', distance:533  },
    { dep:'SBGL', arr:'SBPA', plannedFL:'320', eet:'01:30', distance:533  },
    { dep:'SBCT', arr:'SBGL', plannedFL:'300', eet:'00:50', distance:238  },
    { dep:'SBGL', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:238  },
    { dep:'SBPA', arr:'SBCX', plannedFL:'280', eet:'00:50', distance:200  },
    { dep:'SBCX', arr:'SBPA', plannedFL:'280', eet:'00:50', distance:200  },

    // ═══════════════════════════════════════════════════════════
    // CENTRO-OESTE — Brasília, Goiânia, Campo Grande, Cuiabá
    // ═══════════════════════════════════════════════════════════
    { dep:'SBGO', arr:'SBCG', plannedFL:'300', eet:'01:00', distance:375  },
    { dep:'SBCG', arr:'SBGO', plannedFL:'300', eet:'01:00', distance:375  },
    { dep:'SBGO', arr:'SBCY', plannedFL:'310', eet:'01:10', distance:401  },
    { dep:'SBCY', arr:'SBGO', plannedFL:'310', eet:'01:10', distance:401  },
    { dep:'SBCG', arr:'SBCY', plannedFL:'300', eet:'00:55', distance:302  },
    { dep:'SBCY', arr:'SBCG', plannedFL:'300', eet:'00:55', distance:302  },
    { dep:'SBCG', arr:'SBPV', plannedFL:'320', eet:'01:30', distance:560  },
    { dep:'SBPV', arr:'SBCG', plannedFL:'320', eet:'01:30', distance:560  },

    // ═══════════════════════════════════════════════════════════
    // RIO / MINAS — Galeão, Confins, Vitória
    // ═══════════════════════════════════════════════════════════
    { dep:'SBGL', arr:'SBCF', plannedFL:'240', eet:'00:55', distance:257  },
    { dep:'SBCF', arr:'SBGL', plannedFL:'240', eet:'00:55', distance:257  },
    { dep:'SBGL', arr:'SBVT', plannedFL:'240', eet:'00:40', distance:183  },
    { dep:'SBVT', arr:'SBGL', plannedFL:'240', eet:'00:40', distance:183  },
    { dep:'SBGL', arr:'SBSV', plannedFL:'340', eet:'01:55', distance:780  },
    { dep:'SBSV', arr:'SBGL', plannedFL:'340', eet:'01:55', distance:780  },
    { dep:'SBGL', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1100 },
    { dep:'SBRF', arr:'SBGL', plannedFL:'350', eet:'02:45', distance:1100 },
    { dep:'SBCF', arr:'SBVT', plannedFL:'240', eet:'00:45', distance:215  },
    { dep:'SBVT', arr:'SBCF', plannedFL:'240', eet:'00:45', distance:215  },

  ];

  // Gera números BRV sequenciais a partir de 5000
  const ts = firebase.firestore.FieldValue.serverTimestamp();
  let nextNum = 5000;
  const CHUNK = 400;
  let total = 0;

  // Adiciona flightNumber e campos padrão
  const full = ROUTES.map(r => ({
    flightNumber: 'BRV' + nextNum++,
    aircraft:     'A320',
    category:     'M',
    active:       true,
    route:        '',
    createdAt:    ts,
    ...r
  }));

  console.log(`📦 Criando ${full.length} rotas da malha...`);

  for (let i = 0; i < full.length; i += CHUNK) {
    const batch = db.batch();
    full.slice(i, i + CHUNK).forEach(r => {
      batch.set(db.collection('routes').doc(), r);
    });
    await batch.commit();
    total += Math.min(CHUNK, full.length - i);
    console.log(`  ✓ ${total}/${full.length} rotas criadas`);
  }

  console.log(`✅ ${total} rotas importadas com sucesso! Malha completa ativa.`);
})();
