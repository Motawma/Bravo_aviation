/**
 * SCRIPT DE IMPORTAÇÃO DE ROTAS — Bravo Aviation
 *
 * Como usar:
 * 1. Abra admin.html no navegador e faça login como admin
 * 2. Abra o DevTools (F12) → aba Console
 * 3. Cole todo este script e pressione Enter
 * 4. Aguarde a mensagem "✅ X rotas importadas com sucesso!"
 */

(async function importRoutes() {

  if (typeof db === 'undefined') {
    console.error('❌ Execute este script na página admin.html com o Firebase já carregado.');
    return;
  }

  const ROUTES = [
    { flightNumber:'BRV9106',  aircraft:'A320', category:'M', dep:'SBGR', arr:'SBRP', plannedFL:'280', eet:'01:00', distance:155  },
    { flightNumber:'BRV4726',  aircraft:'A320', category:'M', dep:'SBGR', arr:'SBJP', plannedFL:'350', eet:'02:50', distance:1365 },
    { flightNumber:'TAM8048',  aircraft:'A320', dep:'SBGR', arr:'SACO', plannedFL:'360', eet:'02:56', distance:1107 },
    { flightNumber:'TAM8050',  aircraft:'A320', dep:'SBGR', arr:'SACO', plannedFL:'360', eet:'02:56', distance:1107 },
    { flightNumber:'TAM3020',  aircraft:'A320', dep:'SBGR', arr:'SBFZ', plannedFL:'350', eet:'03:05', distance:1267 },
    { flightNumber:'TAM3119',  aircraft:'A320', dep:'SBGR', arr:'SBCG', plannedFL:'340', eet:'01:35', distance:489  },
    { flightNumber:'TAM3128',  aircraft:'A320', dep:'SBGR', arr:'SBCG', plannedFL:'340', eet:'01:35', distance:489  },
    { flightNumber:'TAM3134',  aircraft:'A320', dep:'SBGR', arr:'SBFL', plannedFL:'340', eet:'01:05', distance:277  },
    { flightNumber:'TAM3147',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3194',  aircraft:'A320', dep:'SBGR', arr:'SBTE', plannedFL:'340', eet:'03:00', distance:1123 },
    { flightNumber:'TAM3196',  aircraft:'A320', dep:'SBGR', arr:'SBTE', plannedFL:'340', eet:'03:00', distance:1123 },
    { flightNumber:'TAM3202',  aircraft:'A320', dep:'SBGR', arr:'SBFI', plannedFL:'340', eet:'01:30', distance:456  },
    { flightNumber:'TAM3206',  aircraft:'A320', dep:'SBGR', arr:'SBFI', plannedFL:'340', eet:'01:30', distance:456  },
    { flightNumber:'TAM3207',  aircraft:'A320', dep:'SBGR', arr:'SBAR', plannedFL:'350', eet:'02:15', distance:920  },
    { flightNumber:'TAM3208',  aircraft:'A320', dep:'SBGR', arr:'SBUL', plannedFL:'340', eet:'01:00', distance:290  },
    { flightNumber:'TAM3210',  aircraft:'A320', dep:'SBGR', arr:'SBUL', plannedFL:'340', eet:'01:00', distance:290  },
    { flightNumber:'TAM3216',  aircraft:'A320', dep:'SBGR', arr:'SBMG', plannedFL:'340', eet:'01:05', distance:305  },
    { flightNumber:'TAM3218',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3222',  aircraft:'A320', dep:'SBGR', arr:'SBVT', plannedFL:'350', eet:'01:10', distance:393  },
    { flightNumber:'TAM3228',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3230',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3232',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3239',  aircraft:'A320', dep:'SBGR', arr:'SBSL', plannedFL:'340', eet:'03:15', distance:1258 },
    { flightNumber:'TAM3240',  aircraft:'A320', dep:'SBGR', arr:'SBPS', plannedFL:'350', eet:'01:35', distance:591  },
    { flightNumber:'TAM3244',  aircraft:'A320', dep:'SBGR', arr:'SBPS', plannedFL:'350', eet:'01:35', distance:591  },
    { flightNumber:'TAM3254',  aircraft:'A320', dep:'SBGR', arr:'SBIL', plannedFL:'350', eet:'01:45', distance:667  },
    { flightNumber:'TAM3257',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM3261',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3263',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM3265',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM3266',  aircraft:'A320', dep:'SBGR', arr:'SBGO', plannedFL:'340', eet:'01:15', distance:437  },
    { flightNumber:'TAM3276',  aircraft:'A320', dep:'SBGR', arr:'SBCH', plannedFL:'340', eet:'01:20', distance:402  },
    { flightNumber:'TAM3278',  aircraft:'A320', dep:'SBGR', arr:'SBCH', plannedFL:'340', eet:'01:20', distance:402  },
    { flightNumber:'TAM3282',  aircraft:'A320', dep:'SBGR', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:194  },
    { flightNumber:'TAM3286',  aircraft:'A320', dep:'SBGR', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:194  },
    { flightNumber:'TAM3288',  aircraft:'A320', dep:'SBGR', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:194  },
    { flightNumber:'TAM3296',  aircraft:'A320', dep:'SBGR', arr:'SBEG', plannedFL:'340', eet:'03:40', distance:1456 },
    { flightNumber:'TAM3300',  aircraft:'A320', dep:'SBGR', arr:'SBFL', plannedFL:'340', eet:'01:05', distance:277  },
    { flightNumber:'TAM3302',  aircraft:'A320', dep:'SBGR', arr:'SBFL', plannedFL:'340', eet:'01:05', distance:277  },
    { flightNumber:'TAM3304',  aircraft:'A320', dep:'SBGR', arr:'SBNF', plannedFL:'320', eet:'01:00', distance:238  },
    { flightNumber:'TAM3306',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3314',  aircraft:'A320', dep:'SBGR', arr:'SBPS', plannedFL:'350', eet:'01:35', distance:591  },
    { flightNumber:'TAM3316',  aircraft:'A320', dep:'SBGR', arr:'SBFZ', plannedFL:'350', eet:'03:05', distance:1267 },
    { flightNumber:'TAM3320',  aircraft:'A320', dep:'SBGR', arr:'SBFZ', plannedFL:'350', eet:'03:05', distance:1267 },
    { flightNumber:'TAM3332',  aircraft:'A320', dep:'SBGR', arr:'SBVT', plannedFL:'350', eet:'01:10', distance:393  },
    { flightNumber:'TAM3334',  aircraft:'A320', dep:'SBGR', arr:'SBVT', plannedFL:'350', eet:'01:10', distance:393  },
    { flightNumber:'TAM3336',  aircraft:'A320', dep:'SBGR', arr:'SBVT', plannedFL:'350', eet:'01:10', distance:393  },
    { flightNumber:'TAM3340',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM3344',  aircraft:'A320', dep:'SBGR', arr:'SBCF', plannedFL:'330', eet:'00:55', distance:268  },
    { flightNumber:'TAM3346',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3350',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3352',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM3354',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3356',  aircraft:'A320', dep:'SBGR', arr:'SBFL', plannedFL:'340', eet:'01:05', distance:277  },
    { flightNumber:'TAM3366',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM3372',  aircraft:'A320', dep:'SBGR', arr:'SBGO', plannedFL:'340', eet:'01:15', distance:437  },
    { flightNumber:'TAM3374',  aircraft:'A320', dep:'SBGR', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1134 },
    { flightNumber:'TAM3376',  aircraft:'A320', dep:'SBGR', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1134 },
    { flightNumber:'TAM3378',  aircraft:'A320', dep:'SBGR', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1134 },
    { flightNumber:'TAM3388',  aircraft:'A320', dep:'SBGR', arr:'SBPL', plannedFL:'350', eet:'02:20', distance:910  },
    { flightNumber:'TAM3394',  aircraft:'A320', dep:'SBGR', arr:'SBPJ', plannedFL:'340', eet:'02:10', distance:796  },
    { flightNumber:'TAM3396',  aircraft:'A320', dep:'SBGR', arr:'SBPS', plannedFL:'350', eet:'01:35', distance:591  },
    { flightNumber:'TAM3398',  aircraft:'A320', dep:'SBGR', arr:'SBMK', plannedFL:'350', eet:'01:10', distance:430  },
    { flightNumber:'TAM3401',  aircraft:'A320', dep:'SBGR', arr:'SBCA', plannedFL:'340', eet:'01:20', distance:396  },
    { flightNumber:'TAM3404',  aircraft:'A320', dep:'SBGR', arr:'SBNF', plannedFL:'320', eet:'01:00', distance:238  },
    { flightNumber:'TAM3405',  aircraft:'A320', dep:'SBGR', arr:'SBDB', plannedFL:'340', eet:'01:50', distance:569  },
    { flightNumber:'TAM3408',  aircraft:'A320', dep:'SBGR', arr:'SBNF', plannedFL:'320', eet:'01:00', distance:238  },
    { flightNumber:'TAM3416',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3418',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3420',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3422',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3424',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3426',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM3446',  aircraft:'A320', dep:'SBGR', arr:'SBMO', plannedFL:'350', eet:'02:35', distance:1036 },
    { flightNumber:'TAM3448',  aircraft:'A320', dep:'SBGR', arr:'SBMO', plannedFL:'350', eet:'02:35', distance:1036 },
    { flightNumber:'TAM3450',  aircraft:'A320', dep:'SBGR', arr:'SBMO', plannedFL:'350', eet:'02:35', distance:1036 },
    { flightNumber:'TAM3452',  aircraft:'A320', dep:'SBGR', arr:'SBMO', plannedFL:'350', eet:'02:35', distance:1036 },
    { flightNumber:'TAM3458',  aircraft:'A320', dep:'SBGR', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1134 },
    { flightNumber:'TAM3470',  aircraft:'A320', dep:'SBGR', arr:'SBJE', plannedFL:'350', eet:'03:05', distance:1282 },
    { flightNumber:'TAM3514',  aircraft:'A320', dep:'SBGR', arr:'SBPF', plannedFL:'340', eet:'01:25', distance:428  },
    { flightNumber:'TAM3518',  aircraft:'A320', dep:'SBGR', arr:'SBGO', plannedFL:'340', eet:'01:15', distance:437  },
    { flightNumber:'TAM3521',  aircraft:'A320', dep:'SBGR', arr:'SBDO', plannedFL:'340', eet:'01:30', distance:472  },
    { flightNumber:'TAM3534',  aircraft:'A320', dep:'SBGR', arr:'SBCG', plannedFL:'340', eet:'01:35', distance:489  },
    { flightNumber:'TAM3538',  aircraft:'A320', dep:'SBGR', arr:'SBVC', plannedFL:'350', eet:'01:35', distance:604  },
    { flightNumber:'TAM3544',  aircraft:'A320', dep:'SBGR', arr:'SBGO', plannedFL:'340', eet:'01:15', distance:437  },
    { flightNumber:'TAM3545',  aircraft:'A320', dep:'SBGR', arr:'SBCF', plannedFL:'330', eet:'00:55', distance:268  },
    { flightNumber:'TAM3546',  aircraft:'A320', dep:'SBGR', arr:'SBGO', plannedFL:'340', eet:'01:15', distance:437  },
    { flightNumber:'TAM3556',  aircraft:'A320', dep:'SBGR', arr:'SBCF', plannedFL:'330', eet:'00:55', distance:268  },
    { flightNumber:'TAM3560',  aircraft:'A320', dep:'SBGR', arr:'SBEG', plannedFL:'340', eet:'03:40', distance:1456 },
    { flightNumber:'TAM3562',  aircraft:'A320', dep:'SBGR', arr:'SBEG', plannedFL:'340', eet:'03:40', distance:1456 },
    { flightNumber:'TAM3576',  aircraft:'A320', dep:'SBGR', arr:'SBCY', plannedFL:'340', eet:'02:00', distance:717  },
    { flightNumber:'TAM3596',  aircraft:'A320', dep:'SBGR', arr:'SBUR', plannedFL:'340', eet:'01:00', distance:235  },
    { flightNumber:'TAM3604',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3612',  aircraft:'A320', dep:'SBGR', arr:'SBSL', plannedFL:'340', eet:'03:15', distance:1258 },
    { flightNumber:'TAM3618',  aircraft:'A320', dep:'SBGR', arr:'SBUL', plannedFL:'340', eet:'01:00', distance:290  },
    { flightNumber:'TAM3620',  aircraft:'A320', dep:'SBGR', arr:'SBCY', plannedFL:'340', eet:'02:00', distance:717  },
    { flightNumber:'TAM3638',  aircraft:'A320', dep:'SBGR', arr:'SBCY', plannedFL:'340', eet:'02:00', distance:717  },
    { flightNumber:'TAM3652',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM3654',  aircraft:'A320', dep:'SBGR', arr:'SBRB', plannedFL:'340', eet:'03:40', distance:1473 },
    { flightNumber:'TAM3661',  aircraft:'A320', dep:'SBGR', arr:'SBPV', plannedFL:'340', eet:'03:30', distance:1336 },
    { flightNumber:'TAM3664',  aircraft:'A320', dep:'SBGR', arr:'SBSI', plannedFL:'340', eet:'02:35', distance:866  },
    { flightNumber:'TAM3670',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM3676',  aircraft:'A320', dep:'SBGR', arr:'SBRF', plannedFL:'350', eet:'02:45', distance:1134 },
    { flightNumber:'TAM3690',  aircraft:'A320', dep:'SBGR', arr:'SBLO', plannedFL:'340', eet:'01:00', distance:257  },
    { flightNumber:'TAM3698',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM3707',  aircraft:'A320', dep:'SBGR', arr:'SBMO', plannedFL:'350', eet:'02:35', distance:1036 },
    { flightNumber:'TAM3735',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3744',  aircraft:'A320', dep:'SBGR', arr:'SBAR', plannedFL:'350', eet:'02:15', distance:920  },
    { flightNumber:'TAM3765',  aircraft:'A320', dep:'SBGR', arr:'SBFZ', plannedFL:'350', eet:'03:05', distance:1267 },
    { flightNumber:'TAM3790',  aircraft:'A320', dep:'SBGR', arr:'SBCF', plannedFL:'330', eet:'00:55', distance:268  },
    { flightNumber:'TAM3830',  aircraft:'A320', dep:'SBGR', arr:'SBJU', plannedFL:'350', eet:'02:35', distance:1058 },
    { flightNumber:'TAM3832',  aircraft:'A320', dep:'SBGR', arr:'SBPJ', plannedFL:'340', eet:'02:10', distance:796  },
    { flightNumber:'TAM3834',  aircraft:'A320', dep:'SBGR', arr:'SBSG', plannedFL:'350', eet:'03:00', distance:1239 },
    { flightNumber:'TAM3836',  aircraft:'A320', dep:'SBGR', arr:'SBSR', plannedFL:'260', eet:'00:50', distance:226  },
    { flightNumber:'TAM3838',  aircraft:'A320', dep:'SBGR', arr:'SBCX', plannedFL:'340', eet:'01:30', distance:428  },
    { flightNumber:'TAM3842',  aircraft:'A320', dep:'SBGR', arr:'SBTE', plannedFL:'340', eet:'03:00', distance:1123 },
    { flightNumber:'TAM3860',  aircraft:'A320', dep:'SBGR', arr:'SBMQ', plannedFL:'340', eet:'03:40', distance:1435 },
    { flightNumber:'TAM3872',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM3874',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM3880',  aircraft:'A320', dep:'SBGR', arr:'SBRP', plannedFL:'260', eet:'00:45', distance:155  },
    { flightNumber:'TAM3896',  aircraft:'A320', dep:'SBGR', arr:'SBBV', plannedFL:'340', eet:'04:20', distance:1783 },
    { flightNumber:'TAM3960',  aircraft:'A320', dep:'SBGR', arr:'SBIZ', plannedFL:'340', eet:'02:50', distance:1076 },
    { flightNumber:'TAM4518',  aircraft:'A320', dep:'SBGR', arr:'SBFL', plannedFL:'340', eet:'01:05', distance:277  },
    { flightNumber:'TAM4522',  aircraft:'A320', dep:'SBGR', arr:'SBPL', plannedFL:'350', eet:'02:20', distance:910  },
    { flightNumber:'TAM4524',  aircraft:'A320', dep:'SBGR', arr:'SBPA', plannedFL:'340', eet:'01:30', distance:467  },
    { flightNumber:'TAM4531',  aircraft:'A320', dep:'SBGR', arr:'SBLO', plannedFL:'340', eet:'01:00', distance:257  },
    { flightNumber:'TAM4538',  aircraft:'A320', dep:'SBGR', arr:'SBEG', plannedFL:'340', eet:'03:40', distance:1456 },
    { flightNumber:'TAM4540',  aircraft:'A320', dep:'SBGR', arr:'SBCF', plannedFL:'330', eet:'00:55', distance:268  },
    { flightNumber:'TAM4545',  aircraft:'A320', dep:'SBGR', arr:'SBEG', plannedFL:'340', eet:'03:40', distance:1456 },
    { flightNumber:'TAM4548',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM4549',  aircraft:'A320', dep:'SBGR', arr:'SBMG', plannedFL:'340', eet:'01:05', distance:305  },
    { flightNumber:'TAM4550',  aircraft:'A320', dep:'SBGR', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:194  },
    { flightNumber:'TAM4596',  aircraft:'A320', dep:'SBGR', arr:'SBBE', plannedFL:'340', eet:'03:25', distance:1329 },
    { flightNumber:'TAM4602',  aircraft:'A320', dep:'SBGR', arr:'SBIL', plannedFL:'350', eet:'01:45', distance:667  },
    { flightNumber:'TAM4610',  aircraft:'A320', dep:'SBGR', arr:'SBMG', plannedFL:'340', eet:'01:05', distance:305  },
    { flightNumber:'TAM4662',  aircraft:'A320', dep:'SBGR', arr:'SBJV', plannedFL:'300', eet:'00:50', distance:209  },
    { flightNumber:'TAM4672',  aircraft:'A320', dep:'SBGR', arr:'SBGL', plannedFL:'250', eet:'00:40', distance:181  },
    { flightNumber:'TAM4676',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM4702',  aircraft:'A320', dep:'SBGR', arr:'SBAR', plannedFL:'350', eet:'02:15', distance:920  },
    { flightNumber:'TAM4703',  aircraft:'A320', dep:'SBGR', arr:'SBBR', plannedFL:'340', eet:'01:20', distance:461  },
    { flightNumber:'TAM4708',  aircraft:'A320', dep:'SBGR', arr:'SBCT', plannedFL:'300', eet:'00:50', distance:194  },
    { flightNumber:'TAM4722',  aircraft:'A320', dep:'SBGR', arr:'SBSV', plannedFL:'350', eet:'02:00', distance:784  },
    { flightNumber:'TAM4742',  aircraft:'A320', dep:'SBGR', arr:'SBSL', plannedFL:'340', eet:'03:15', distance:1258 },
    { flightNumber:'TAM4770',  aircraft:'A320', dep:'SBGR', arr:'SBJA', plannedFL:'340', eet:'01:10', distance:344  },
    { flightNumber:'TAM9018',  aircraft:'A320', dep:'SBGR', arr:'SBLO', plannedFL:'340', eet:'01:00', distance:257  },
  ];

  const CHUNK = 450; // Firestore limite de 500 por batch
  const ts    = firebase.firestore.FieldValue.serverTimestamp();
  let total   = 0;

  console.log(`📦 Iniciando importação de ${ROUTES.length} rotas...`);

  for (let i = 0; i < ROUTES.length; i += CHUNK) {
    const chunk = ROUTES.slice(i, i + CHUNK);
    const batch = db.batch();

    chunk.forEach(r => {
      const ref = db.collection('routes').doc();
      batch.set(ref, { ...r, active: true, createdAt: ts });
    });

    await batch.commit();
    total += chunk.length;
    console.log(`  → ${total}/${ROUTES.length} rotas enviadas...`);
  }

  console.log(`✅ ${total} rotas importadas com sucesso! Recarregue a seção Rotas no admin.`);

})();
