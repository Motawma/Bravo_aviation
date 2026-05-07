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
define('FPDB_KEY',  '');          // deixe vazio para usar sem autenticação
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
    $ctx = stream_context_create(['http' => [
        'timeout' => 15,
        'header'  => implode("\r\n", array_merge(
            ['User-Agent: BravoAviationVA/1.0'],
            $headers
        )) . "\r\n",
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    return $raw === false ? null : $raw;
}

// ─── Flightplandatabase.com ───────────────────────────────────────────────────
function fpdbRoutes(string $dep, string $arr): array {
    $headers = FPDB_KEY ? ['Authorization: Token ' . FPDB_KEY] : [];

    // Busca até 10 planos arquivados entre os dois aeródromos, ordenados por votos
    $url = FPDB_BASE . '/search/plans?' . http_build_query([
        'fromICAO' => $dep,
        'toICAO'   => $arr,
        'limit'    => 10,
        'sort'     => 'created',   // mais recentes primeiro
    ]);

    $raw = httpGet($url, $headers);
    if ($raw === null) return ['error' => 'Falha ao conectar com flightplandatabase.com'];

    $data = json_decode($raw, true);
    if (!is_array($data)) return ['error' => 'Resposta inválida da API.'];

    // A API retorna array direto (não wrapped em "data")
    $plans  = isset($data[0]) ? $data : ($data['data'] ?? []);
    $routes = [];

    foreach ($plans as $plan) {
        $route = trim(strtoupper($plan['route'] ?? ''));
        if (!$route || $route === 'DCT') continue;

        // Remove DEP e ARR do início/fim da string se estiverem presentes
        $route = preg_replace('/^' . $dep . '\s+/', '', $route);
        $route = preg_replace('/\s+' . $arr . '$/', '', $route);
        $route = trim($route);

        if (!$route) continue;

        $routes[] = [
            'route'    => $route,
            'level'    => isset($plan['cruisingAlt']) ? (string)(int)($plan['cruisingAlt'] / 100) : null,
            'distance' => isset($plan['distance'])    ? (int)round($plan['distance'] * 0.539957)   : null, // km→NM
            'eet'      => null,
            'source'   => 'flightplandatabase',
        ];
    }

    if (!$routes) {
        return ['error' => 'Nenhuma rota encontrada no Flightplandatabase para ' . $dep . '→' . $arr . '. Insira manualmente.'];
    }

    // Deduplica por string de rota
    $seen = [];
    $routes = array_filter($routes, function($r) use (&$seen) {
        if (isset($seen[$r['route']])) return false;
        $seen[$r['route']] = true;
        return true;
    });

    return array_values($routes);
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

    if (strlen($dep) !== 4 || strlen($arr) !== 4) {
        echo json_encode(['error' => 'ICAOs inválidos. Use 4 letras. Ex: SBGR']); return;
    }

    $cacheKey = 'route_' . $dep . '_' . $arr;
    $cached   = cacheGet($cacheKey);
    if ($cached) { $cached['_source'] = 'cache'; echo json_encode($cached, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); return; }

    // ── Fonte ativa: Flightplandatabase ──────────────────────────────────────
    $routes = fpdbRoutes($dep, $arr);

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
