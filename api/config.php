<?php
declare(strict_types=1);

if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    http_response_code(404);
    exit;
}

ini_set('display_errors', '0');

const DB_HOST = 'localhost';
const DB_NAME = 'campus_lost_found';
const DB_USER = 'root';
const DB_PASS = '';

const API_KEY = 'change-me';

const APP_BASE_URL = '';

function get_db_connection(): PDO
{
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_cors(array $methods): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header('Cache-Control: no-store');

    $allowedOrigins = [
        'http://localhost',
        'https://localhost',
        'capacitor://localhost',
        'ionic://localhost',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && origin_allowed($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
    header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');
    header('Content-Type: application/json; charset=utf-8');
}

function origin_allowed(string $origin, array $allowedOrigins): bool
{
    if (in_array($origin, $allowedOrigins, true)) {
        return true;
    }

    return (bool) preg_match(
        '#\Ahttps?://(?:localhost|127\.0\.0\.1|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d{1,5})?\z#',
        $origin
    );
}

function require_api_key(): void
{
    $given = $_SERVER['HTTP_X_API_KEY'] ?? '';
    if (!is_string($given) || $given === '' || !hash_equals(API_KEY, $given)) {
        respond(401, ['success' => false, 'message' => 'Request was not accepted.']);
    }
}

function rate_limit(string $bucket, int $limit, int $windowSeconds): void
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'rate';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        respond(500, ['success' => false, 'message' => 'Internal server error.']);
    }

    $file = $dir . DIRECTORY_SEPARATOR . hash('sha256', $bucket . '|' . client_ip()) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $decoded = json_decode((string) file_get_contents($file), true);
        if (is_array($decoded)) {
            foreach ($decoded as $hit) {
                if (is_int($hit) && $hit > $now - $windowSeconds) {
                    $hits[] = $hit;
                }
            }
        }
    }

    if (count($hits) >= $limit) {
        header('Retry-After: ' . (string) $windowSeconds);
        respond(429, ['success' => false, 'message' => 'Too many requests. Please wait and try again.']);
    }

    $hits[] = $now;
    file_put_contents($file, json_encode($hits), LOCK_EX);
}

function client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    return is_string($ip) && $ip !== '' ? $ip : '0.0.0.0';
}
