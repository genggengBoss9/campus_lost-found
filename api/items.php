<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

send_cors(['GET', 'POST', 'OPTIONS']);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const ITEM_COLUMNS = 'id, kind, title, category, description, photo_path, latitude, longitude, created_at, updated_at';

const CATEGORIES = ['ID', 'Electronics', 'Clothing', 'Other'];

const KINDS = ['lost', 'found'];

function read_json_body(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > 5 * 1024 * 1024) {
        respond(413, ['success' => false, 'message' => 'The request is too large.']);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        respond(400, ['success' => false, 'message' => 'Request body is required.']);
    }
    if (strlen($raw) > 5 * 1024 * 1024) {
        respond(413, ['success' => false, 'message' => 'The request is too large.']);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(400, ['success' => false, 'message' => 'Invalid JSON request body.']);
    }

    return $decoded;
}

function public_base(): string
{
    if (APP_BASE_URL !== '') {
        return rtrim(APP_BASE_URL, '/');
    }

    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    if (!is_string($host) || !preg_match('/\A[A-Za-z0-9.-]+(?::\d{1,5})?\z/', $host)) {
        $host = 'localhost';
    }
    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/items.php'));
    $root = preg_replace('#/api/[^/]+$#', '', $script) ?? '';

    return $scheme . '://' . $host . rtrim($root, '/');
}

function shape_item(array $row): array
{
    $photoPath = $row['photo_path'] !== null && $row['photo_path'] !== ''
        ? (string) $row['photo_path']
        : null;

    return [
        'id' => (int) $row['id'],
        'kind' => (string) $row['kind'],
        'title' => (string) $row['title'],
        'category' => (string) $row['category'],
        'description' => (string) $row['description'],
        'photo_path' => $photoPath,
        'photo_url' => $photoPath === null ? null : public_base() . '/' . $photoPath,
        'latitude' => (float) $row['latitude'],
        'longitude' => (float) $row['longitude'],
        'created_at' => (string) $row['created_at'],
        'updated_at' => (string) $row['updated_at'],
    ];
}

function validate_item(array $input): array
{
    $kind = trim((string) ($input['kind'] ?? ''));
    $title = trim((string) ($input['title'] ?? ''));
    $category = trim((string) ($input['category'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $latitude = filter_var($input['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $longitude = filter_var($input['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $locationMessage = $kind === 'lost' ? 'Pin where you last saw it.' : 'Use my location before posting.';

    $errors = [];
    if (!in_array($kind, KINDS, true)) {
        $errors['kind'] = 'Choose Lost or Found.';
    }
    if ($title === '' || mb_strlen($title) < 3) {
        $errors['title'] = 'Title must be at least 3 characters.';
    } elseif (mb_strlen($title) > 150) {
        $errors['title'] = 'Title is too long. Maximum 150 characters only.';
    }
    if (!in_array($category, CATEGORIES, true)) {
        $errors['category'] = 'Choose a category.';
    }
    if ($description === '' || mb_strlen($description) < 5) {
        $errors['description'] = 'Note must be at least 5 characters.';
    } elseif (mb_strlen($description) > 500) {
        $errors['description'] = 'Note is too long. Maximum 500 characters only.';
    }
    if ($latitude === false || $latitude < -90 || $latitude > 90) {
        $errors['latitude'] = $locationMessage;
    }
    if ($longitude === false || $longitude < -180 || $longitude > 180) {
        $errors['longitude'] = $locationMessage;
    }

    if ($errors) {
        respond(422, [
            'success' => false,
            'message' => 'Validation failed.',
            'errors' => $errors,
        ]);
    }

    return [
        'kind' => $kind,
        'title' => $title,
        'category' => $category,
        'description' => $description,
        'latitude' => $latitude,
        'longitude' => $longitude,
    ];
}

function photo_error(string $message): void
{
    respond(422, [
        'success' => false,
        'message' => 'Validation failed.',
        'errors' => ['photo_data' => $message],
    ]);
}

function store_photo(mixed $photoData): ?string
{
    if ($photoData === null || $photoData === '') {
        return null;
    }
    if (!is_string($photoData)) {
        photo_error('Image must be JPG, PNG, or WEBP.');
    }

    $photoData = trim($photoData);
    if ($photoData === '') {
        return null;
    }

    if (!preg_match('#^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$#', $photoData, $matches)) {
        photo_error('Image must be JPG, PNG, or WEBP.');
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false) {
        photo_error('Image must be JPG, PNG, or WEBP.');
    }
    if (strlen($binary) > 3 * 1024 * 1024) {
        photo_error('Image must be 3MB or less.');
    }

    $info = @getimagesizefromstring($binary);
    $extensions = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp',
    ];
    if ($info === false || !isset($extensions[$info[2]]) || $info[0] > 8000 || $info[1] > 8000) {
        photo_error('Image must be JPG, PNG, or WEBP.');
    }

    $filename = 'f_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $extensions[$info[2]];
    $directory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'items';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        photo_error('Unable to save image.');
    }

    $absolute = $directory . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($absolute, $binary) === false) {
        photo_error('Unable to save image.');
    }

    return 'uploads/items/' . $filename;
}

function delete_photo(?string $storedPath): void
{
    if ($storedPath === null || !str_starts_with($storedPath, 'uploads/items/')) {
        return;
    }

    $filename = basename($storedPath);
    if (!preg_match('/\Af_[0-9]+_[a-f0-9]+\.(jpg|png|webp)\z/', $filename)) {
        return;
    }
    $absolute = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'items' . DIRECTORY_SEPARATOR . $filename;
    if (is_file($absolute)) {
        unlink($absolute);
    }
}

$storedPhoto = null;

try {
    $pdo = get_db_connection();
    $method = $_SERVER['REQUEST_METHOD'];
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

    if (isset($_GET['id']) && ($id === false || $id === null || $id < 1)) {
        respond(400, ['success' => false, 'message' => 'The id parameter must be a positive integer.']);
    }

    switch ($method) {
        case 'GET':
            if ($id !== null && $id !== false) {
                $stmt = $pdo->prepare('SELECT ' . ITEM_COLUMNS . ' FROM found_items WHERE id = :id');
                $stmt->execute(['id' => $id]);
                $item = $stmt->fetch();

                if (!$item) {
                    respond(404, ['success' => false, 'message' => 'Item not found.']);
                }

                respond(200, ['success' => true, 'data' => shape_item($item)]);
            }

            $stmt = $pdo->query('SELECT ' . ITEM_COLUMNS . ' FROM found_items ORDER BY id DESC');
            $items = [];
            foreach ($stmt->fetchAll() as $row) {
                $items[] = shape_item($row);
            }

            respond(200, ['success' => true, 'data' => $items]);

        case 'POST':
            require_api_key();
            rate_limit('post-item', 8, 600);
            $body = read_json_body();
            $item = validate_item($body);
            $storedPhoto = store_photo($body['photo_data'] ?? null);
            $item['photo_path'] = $storedPhoto;

            $stmt = $pdo->prepare(
                'INSERT INTO found_items (kind, title, category, description, photo_path, latitude, longitude)
                 VALUES (:kind, :title, :category, :description, :photo_path, :latitude, :longitude)'
            );
            $stmt->execute($item);

            $newId = (int) $pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT ' . ITEM_COLUMNS . ' FROM found_items WHERE id = :id');
            $stmt->execute(['id' => $newId]);
            $created = $stmt->fetch();
            if (!$created) {
                delete_photo($storedPhoto);
                respond(500, ['success' => false, 'message' => 'Internal server error.']);
            }

            respond(201, [
                'success' => true,
                'message' => 'Item posted.',
                'data' => shape_item($created),
            ]);

        default:
            header('Allow: GET, POST, OPTIONS');
            respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
} catch (PDOException $e) {
    delete_photo($storedPhoto);

    if ($e->getCode() === '23000') {
        respond(409, ['success' => false, 'message' => 'That item could not be saved.']);
    }

    error_log('Found items API database error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Database error. Check the PHP error log.']);
} catch (Throwable $e) {
    delete_photo($storedPhoto);
    error_log('Found items API unexpected error: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Internal server error.']);
}
