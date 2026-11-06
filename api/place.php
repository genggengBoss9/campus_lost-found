<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

send_cors(['GET', 'OPTIONS']);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['success' => false, 'message' => 'Method not allowed.']);
}

require_api_key();
rate_limit('place', 30, 600);

$lat = $_GET['lat'] ?? null;
$lng = $_GET['lng'] ?? null;
if (!is_numeric($lat) || !is_numeric($lng)) {
    respond(422, ['success' => false, 'message' => 'Latitude and longitude are required.', 'errors' => [
        'lat' => 'Latitude and longitude are required.',
    ]]);
}

$latitude = (float) $lat;
$longitude = (float) $lng;
if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
    respond(422, ['success' => false, 'message' => 'That location is not valid.']);
}

$payload = fetch_place($latitude, $longitude);
$name = is_array($payload) ? place_label($payload) : '';
if ($name === '') {
    respond(200, ['success' => false, 'message' => 'No place name was found for that pin.']);
}

respond(200, ['success' => true, 'message' => 'Place found.', 'data' => ['name' => $name]]);

function fetch_place(float $latitude, float $longitude): ?array
{
    $url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat='
        . rawurlencode((string) $latitude)
        . '&lon='
        . rawurlencode((string) $longitude);

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'header' => "User-Agent: CampusLostFound/1.0 (student prototype)\r\nAccept: application/json\r\n",
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if (!is_string($body) || $body === '') {
        return null;
    }

    $decoded = json_decode($body, true);

    return is_array($decoded) ? $decoded : null;
}

function place_label(array $data): string
{
    $address = is_array($data['address'] ?? null) ? $data['address'] : [];
    $parts = [];
    foreach (['amenity', 'road', 'neighbourhood', 'suburb', 'quarter', 'city', 'town', 'village'] as $key) {
        if (!isset($address[$key]) || !is_string($address[$key]) || $address[$key] === '') {
            continue;
        }
        if (!in_array($address[$key], $parts, true)) {
            $parts[] = $address[$key];
        }
        if (count($parts) === 2) {
            break;
        }
    }

    if ($parts !== []) {
        return implode(', ', $parts);
    }

    $display = $data['display_name'] ?? '';
    if (!is_string($display) || $display === '') {
        return '';
    }

    $bits = array_slice(array_map(trim(...), explode(',', $display)), 0, 2);

    return implode(', ', array_filter($bits, static fn (string $bit): bool => $bit !== ''));
}
