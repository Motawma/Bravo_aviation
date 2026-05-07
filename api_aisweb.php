<?php
/**
 * api_aisweb.php — Proxy de rotas com cache por ciclo AIRAC (28 dias)
 *
 * Fonte ativa:  Flightplandatabase.com (gratuito, imediato)
 * Fonte futura: DECEA AISWEB (comentada abaixo — ativar quando credenciais chegarem)
 *
 * Uso:
 *   GET api_aisweb.php?action=routes&dep=SBGR&arr=SBBR
 *   GET api_aisweb.php?action=airac
 *   GET api_aisweb.php?action=aerodrome&icao=SBGR
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// ─── Flightplandatabase.com ───────────────────────────────────────────────────
// Cadastro gratuito em https://flightplandatabase.com/api — aprovação imediata.
// Sem key: 100 req/dia. Com key gratuita: 2.500 req/dia.
define('FPDB_KEY',  'p7kj9dPZvDiQ9UUo1HmlQIX1wXsSwHhKLhbfkfNX');
define('FPDB_BASE', 'https://api.flightplandatabase.com');

// ─── DECEA AISWEB (aguardando credenciais) ────────────────────────────────────
// define('AISWEB_KEY',  'SUA_API_KEY_AQUI');
// define('AISWEB_PASS', 'SUA_API_PASS_AQUI');
// define('AISWEB_BASE', 'https://api.decea.mil.br/aisweb/');

define('CACHE_DIR', __DIR__ . '/cache/aisweb/');

// ─── Ciclo AIRAC ──────────────────────────────────────────────────────────────
function airacCycle(): array {
    $refTs   = strtotime('2024-01-25');  // AIRAC 2401
    $todayTs = strtotime('today');
    $idx     = (int)floor(($todayTs - $refTs) / (28 * 86400));

    $startTs = $refTs + ($idx * 28 * 86400);
    $endTs   = $startTs + (27 * 86400);

    $year    = (int)date('Y', $startTs);
    $firstIdx = (int)ceil((strtotime($year . '-01-01') - $refTs) / (28 * 86400));
    $cycleN  = $idx - $firstIdx + 1;

    return [
        'id'    => date('Ymd', $startTs),
        'label' => sprintf('AIRAC %s%02d', $year, $cycleN),
        'start' => date('Y-m-d', $startTs),
        'end'   => date('Y-m-d', $endTs),
        'next'  => date('Y-m-d', $endTs + 86400),
    ];
}

// ─── Cache ────────────────────────────────────────────────────────────────────
function cacheGet(string $key): ?array {
    $airac = airacCycle();
    $file  = CACHE_DIR . $airac['id'] . '_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    if (!file_exists($file)) return null;
    $data = json_decode(file_get_contents($file), true);
    if (!$data || ($data['_airac'] ?? '') !== $airac['id']) { @unlink($file); return null; }
    return $data;
}

function cachePut(string $key, array $payload): void {
    if (!is_dir(CACHE_DIR)) mkdir(CACHE_DIR, 0755, true);
    $airac = airacCycle();
    $file  = CACHE_DIR . $airac['id'] . '_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    $payload['_airac']  = $airac['id'];
    $payload['_cached'] = date('Y-m-d H:i:s');
    foreach (glob(CACHE_DIR . '*.json') as $f) {
        if (!str_starts_with(basename($f), $airac['id'])) unlink($f);
    }
    file_put_contents($file, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function httpGet(string $url, array $headers = []): ?string {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 20,
            'header'  => implode("\r\n", array_merge(
                ['User-Agent: BravoAviationVA/1.0'],
                $headers
            )) . "\r\n",
        ],
        'ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    return $raw === false ? null : $raw;
}

// ─── Converte nodes do FPDB em string de rota ICAO ───────────────────────────
function nodesToRouteString(array $nodes, string $dep, string $arr): string {
    $AWY = ['AWY-HI', 'AWY-LO', 'NAT', 'PACOT'];
    // Remove DEP e ARR dos extremos
    $mid = array_slice($nodes, 1, -1);
    if (!$mid) return '';

    $out = [$mid[0]['ident']];
    $i   = 1;
    while ($i < count($mid)) {
        $via = $mid[$i]['via'] ?? null;
        if ($via && in_array($via['type'] ?? '', $AWY)) {
            $airway = $via['ident'];
            $j = $i;
            while ($j < count($mid) && ($mid[$j]['via']['ident'] ?? '') === $airway) $j++;
            $out[] = $airway;
            $out[] = $mid[$j - 1]['ident'];
            $i = $j;
        } else {
            $out[] = $mid[$i]['ident'];
            $i++;
        }
    }
    return implode(' ', $out);
}

// ─── Extrai string de rota de um plano FPDB ──────────────────────────────────
function extractRoute(array $plan, string $dep, string $arr): string {
    // Tenta campo route como string (planos antigos/search)
    if (is_string($plan['route'] ?? null) && trim($plan['route']) !== '') {
        $r = trim(strtoupper($plan['route']));
        $r = trim(preg_replace('/^' . $dep . '\s+/', '', $r));
        $r = trim(preg_replace('/\s+' . $arr . '$/', '', $r));
        if ($r && $r !== 'DCT') return $r;
    }
    // Tenta nodes (planos com route como objeto)
    if (is_array($plan['route']['nodes'] ?? null)) {
        return nodesToRouteString($plan['route']['nodes'], $dep, $arr);
    }
    return '';
}

// ─── Flightplandatabase.com ───────────────────────────────────────────────────
function fpdbRoutes(string $dep, string $arr, int $fl = 350): array {
    $authHdr = FPDB_KEY ? 'Authorization: Basic ' . base64_encode(FPDB_KEY . ':') : '';
    $hdrs    = array_filter(['Accept: application/json', $authHdr]);

    // 1ª prioridade: planos enviados por usuários reais (/search)
    // Esses incluem SID/STAR e são mais próximos do SimBrief
    $url  = FPDB_BASE . '/search/plans?' . http_build_query([
        'fromICAO' => $dep, 'toICAO' => $arr,
        'limit'    => 5,    'sort'   => 'popularity',
    ]);
    $raw  = httpGet($url, $hdrs);
    $list = $raw ? json_decode($raw, true) : null;

    if (is_array($list) && count($list) > 0) {
        // Tenta cada plano da lista até encontrar um com rota válida
        foreach ($list as $item) {
            $detail = httpGet(FPDB_BASE . '/plan/' . $item['id'], $hdrs);
            $plan   = $detail ? json_decode($detail, true) : null;
            if (!$plan) continue;
            $routeStr = extractRoute($plan, $dep, $arr);
            if ($routeStr) {
                return [[
                    'route'    => $routeStr,
                    'level'    => isset($plan['maxAltitude']) ? (string)(int)($plan['maxAltitude'] / 100) : null,
                    'distance' => isset($plan['distance'])    ? (int)round($plan['distance']) : null,
                    'source'   => 'fpdb_search',
                ]];
            }
        }
    }

    // 2ª prioridade: auto/generate (rota algorítmica, sem SID/STAR)
    if (!FPDB_KEY) {
        return ['error' => 'Nenhuma rota encontrada para ' . $dep . '→' . $arr];
    }

    $body = json_encode([
        'fromICAO'   => $dep,   'toICAO'    => $arr,
        'useAWYHI'   => true,   'useAWYLO'  => true,
        'useNAT'     => false,  'usePACOT'  => false,
        'cruiseAlt'  => $fl * 100, 'cruiseSpeed' => 460,
    ]);
    $ctx = stream_context_create([
        'http' => [
            'method'  => 'POST', 'timeout' => 25,
            'header'  => implode("\r\n", [
                'User-Agent: BravoAviationVA/1.0',
                'Content-Type: application/json',
                'Accept: application/json', $authHdr,
            ]) . "\r\n",
            'content' => $body,
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $raw  = @file_get_contents(FPDB_BASE . '/auto/generate', false, $ctx);
    $gen  = $raw ? json_decode($raw, true) : null;

    if (!$gen || isset($gen['message']) || !isset($gen['id'])) {
        return ['error' => 'Nenhuma rota encontrada para ' . $dep . '→' . $arr];
    }

    $detail   = httpGet(FPDB_BASE . '/plan/' . $gen['id'], $hdrs);
    $fullPlan = $detail ? json_decode($detail, true) : null;
    $routeStr = $fullPlan ? extractRoute($fullPlan, $dep, $arr) : '';

    if (!$routeStr) {
        return ['error' => 'Rota sem waypoints para ' . $dep . '→' . $arr];
    }

    return [[
        'route'    => $routeStr,
        'level'    => isset($gen['maxAltitude']) ? (string)(int)($gen['maxAltitude'] / 100) : null,
        'distance' => isset($gen['distance'])    ? (int)round($gen['distance']) : null,
        'source'   => 'fpdb_generate',
    ]];
}

// ─── DECEA AISWEB (comentado — ativar quando credenciais chegarem) ─────────────
/*
function aiswebRoutes(string $dep, string $arr): array {
    $url = AISWEB_BASE . '?' . http_build_query([
        'apiKey'        => AISWEB_KEY,
        'apiPass'       => AISWEB_PASS,
        'response_type' => 'JSON',
        'area'          => 'rotasaereas',   // confirmar com documentação DECEA
        'icaoOrigem'    => $dep,            // confirmar com documentação DECEA
        'icaoDestino'   => $arr,            // confirmar com documentação DECEA
    ]);
    $raw = httpGet($url);
    if ($raw === null) return ['error' => 'Falha ao conectar com AISWEB/DECEA'];
    $data = json_decode($raw, true);
    if (!$data) return ['error' => 'Resposta inválida do AISWEB'];

    // Ajustar campos conforme estrutura real da resposta:
    $items = $data['rotasaereas'] ?? $data['rotas'] ?? $data['data'] ?? $data;
    if (!is_array($items)) return [];
    if (isset($items['rota'])) $items = [$items];

    $routes = [];
    foreach ($items as $item) {
        $wpts = $item['rota'] ?? $item['waypoints'] ?? $item['route'] ?? $item['descricao'] ?? '';
        if (!$wpts) continue;
        $routes[] = [
            'route'    => strtoupper(trim($wpts)),
            'level'    => $item['nivel']     ?? $item['fl']       ?? null,
            'distance' => $item['distancia'] ?? $item['distance'] ?? null,
            'eet'      => $item['eet']       ?? $item['tempo']    ?? null,
            'source'   => 'decea_aisweb',
        ];
    }
    return $routes;
}
*/

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleAirac(): void {
    echo json_encode(airacCycle(), JSON_PRETTY_PRINT);
}

function handleRoutes(string $dep, string $arr): void {
    $dep = strtoupper(preg_replace('/[^A-Z0-9]/', '', $dep));
    $arr = strtoupper(preg_replace('/[^A-Z0-9]/', '', $arr));
    $fl  = max(100, min(450, (int)($_GET['fl'] ?? 350)));

    if (strlen($dep) !== 4 || strlen($arr) !== 4) {
        echo json_encode(['error' => 'ICAOs inválidos. Use 4 letras. Ex: SBGR']); return;
    }

    $cacheKey = 'route_' . $dep . '_' . $arr;
    $cached   = cacheGet($cacheKey);
    if ($cached) { $cached['_source'] = 'cache'; echo json_encode($cached, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); return; }

    // ── Fonte ativa: Flightplandatabase ──────────────────────────────────────
    $routes = fpdbRoutes($dep, $arr, $fl);

    // ── Fonte futura: DECEA AISWEB (descomentar quando credenciais chegarem) ─
    // $routes = aiswebRoutes($dep, $arr);

    if (isset($routes['error'])) { echo json_encode($routes); return; }

    $result = [
        'dep'    => $dep,
        'arr'    => $arr,
        'airac'  => airacCycle(),
        'routes' => $routes,
    ];

    cachePut($cacheKey, $result);
    $result['_source'] = 'api';
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

function handleAerodrome(string $icao): void {
    // ── DECEA AISWEB (comentado — ativar quando credenciais chegarem) ─────────
    /*
    $icao = strtoupper(preg_replace('/[^A-Z0-9]/', '', $icao));
    if (strlen($icao) !== 4) { echo json_encode(['error' => 'ICAO inválido.']); return; }
    $cacheKey = 'aerodrome_' . $icao;
    $cached   = cacheGet($cacheKey);
    if ($cached) { $cached['_source'] = 'cache'; echo json_encode($cached); return; }
    $raw  = httpGet(AISWEB_BASE . '?' . http_build_query(['apiKey' => AISWEB_KEY, 'apiPass' => AISWEB_PASS, 'response_type' => 'JSON', 'area' => 'aerodromos', 'icao' => $icao]));
    $data = $raw ? (json_decode($raw, true) ?? []) : ['error' => 'Falha na conexão'];
    if (!isset($data['error'])) cachePut($cacheKey, $data);
    $data['_source'] = 'api';
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    */
    echo json_encode(['info' => 'Endpoint aerodrome disponível após ativação das credenciais DECEA.']);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'airac':
        handleAirac();
        break;

    case 'routes':
        $dep = $_GET['dep'] ?? '';
        $arr = $_GET['arr'] ?? '';
        if (!$dep || !$arr) { echo json_encode(['error' => 'Informe dep e arr. Ex: ?action=routes&dep=SBGR&arr=SBBR']); break; }
        handleRoutes($dep, $arr);
        break;

    case 'aerodrome':
        handleAerodrome($_GET['icao'] ?? '');
        break;

    case 'test':
        // Diagnóstico: retorna resposta bruta do FPDB para uma rota
        $dep = strtoupper(preg_replace('/[^A-Z0-9]/', '', $_GET['dep'] ?? 'SBGR'));
        $arr = strtoupper(preg_replace('/[^A-Z0-9]/', '', $_GET['arr'] ?? 'SBBR'));
        $sslCtx = ['verify_peer' => false, 'verify_peer_name' => false];
        $authHdr = FPDB_KEY ? 'Authorization: Basic ' . base64_encode(FPDB_KEY . ':') : '';
        // Testa GET search
        $hdrs = array_filter(['Accept: application/json', $authHdr]);
        $searchRaw = httpGet(FPDB_BASE . '/search/plans?fromICAO=' . $dep . '&toICAO=' . $arr . '&limit=2', $hdrs);
        $searchData = $searchRaw ? json_decode($searchRaw, true) : null;
        // Testa POST generate
        $body = json_encode(['fromICAO'=>$dep,'toICAO'=>$arr,'useAWYHI'=>true,'useAWYLO'=>true,'useNAT'=>false,'usePACOT'=>false,'cruiseAlt'=>35000,'cruiseSpeed'=>460]);
        $ctx = stream_context_create(['http'=>['method'=>'POST','timeout'=>25,'header'=>implode("\r\n",array_filter(['User-Agent: BravoAviationVA/1.0','Content-Type: application/json','Accept: application/json',$authHdr]))."\r\n",'content'=>$body],'ssl'=>$sslCtx]);
        $genRaw = @file_get_contents(FPDB_BASE . '/auto/generate', false, $ctx);
        $genData = $genRaw ? json_decode($genRaw, true) : null;
        // Busca detalhe do plano gerado
        $planId = $genData['id'] ?? null;
        $detailRaw = $planId ? httpGet(FPDB_BASE . '/plan/' . $planId, array_filter(['Accept: application/json', $authHdr])) : null;
        $detailData = $detailRaw ? json_decode($detailRaw, true) : null;
        $nodes = $detailData['route']['nodes'] ?? null;
        $routeStr = $nodes ? nodesToRouteString($nodes, $dep, $arr) : null;
        echo json_encode([
            'key_set'        => !empty(FPDB_KEY),
            'search_ok'      => $searchData !== null,
            'search_count'   => is_array($searchData) ? count($searchData) : 0,
            'generate_ok'    => $genData !== null,
            'generate_id'    => $planId,
            'generate_keys'  => $genData ? array_keys($genData) : null,
            'detail_ok'      => $detailData !== null,
            'detail_keys'    => $detailData ? array_keys($detailData) : null,
            'nodes_count'    => is_array($nodes) ? count($nodes) : 0,
            'route_string'   => $routeStr,
            'detail_route'   => is_string($detailData['route'] ?? null) ? $detailData['route'] : '(object/null)',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode([
            'status'  => 'BravoAviationVA — API de Rotas',
            'source'  => 'flightplandatabase.com',
            'airac'   => airacCycle(),
            'endpoints' => [
                '?action=airac'                    => 'Ciclo AIRAC vigente',
                '?action=routes&dep=SBGR&arr=SBBR' => 'Rotas entre dois aeródromos',
                '?action=aerodrome&icao=SBGR'      => 'Dados de aeródromo (requer DECEA)',
            ],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
