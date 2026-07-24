<?php
/**
 * PulsePatrika — API front controller.
 * All /api/* requests are routed here via .htaccess.
 * Compatible with PHP 7.3+.
 */
declare(strict_types=1);

require __DIR__ . '/../backend/config/config.php';
require __DIR__ . '/../backend/config/database.php';

// PSR-4-ish autoloader for App\ namespace.
spl_autoload_register(function ($class) {
    if (strpos($class, 'App\\') === 0) {
        $rel = str_replace(['App\\', '\\'], ['', '/'], $class);
        $file = __DIR__ . '/../backend/src/' . $rel . '.php';
        if (is_file($file)) require $file;
    }
});

use App\Core\Router;
use App\Core\Response;
use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\EditorialController;
use App\Controllers\ProductionController;
use App\Controllers\PageController;
use App\Controllers\HrController;
use App\Controllers\LegalController;
use App\Controllers\AlertsController;
use App\Controllers\ReportsController;
use App\Controllers\AiController;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

$r = new Router();

$r->post('/auth/login', function () { return (new AuthController())->login(); });
$r->get('/auth/me',     function () { return (new AuthController())->me(); });

$r->get('/dashboard',   function () { return (new DashboardController())->index(); });
$r->get('/editorial',   function () { return (new EditorialController())->index(); });
$r->get('/production',  function () { return (new ProductionController())->index(); });
$r->get('/pages',       function () { return (new PageController())->index(); });

$r->get('/hr/employees',    function () { return (new HrController())->employees(); });
$r->post('/hr/employees',   function () { return (new HrController())->saveEmployee(); });
$r->get('/hr/retirements',  function () { return (new HrController())->retirements(); });

$r->get('/legal',                function ()      { return (new LegalController())->index(); });
$r->post('/legal',               function ()      { return (new LegalController())->saveCase(); });
$r->add('DELETE', '/legal/{id}', function ($a)    { return (new LegalController())->deleteCase($a); });

$r->get('/alerts',                 function () { return (new AlertsController())->index(); });
$r->post('/alerts/send-telegram',  function () { return (new AlertsController())->sendTelegram(); });
$r->get('/alerts/telegram-config', function () { return (new AlertsController())->telegramConfig(); });
$r->get('/alerts/telegram-test',   function () { return (new AlertsController())->testTelegram(); });

$r->get('/reports', function () { return (new ReportsController())->index(); });

$r->post('/ai/assistant', function () { return (new AiController())->assistant(); });

$r->get('/', function () {
    return Response::json(['service' => 'Patrika Newsroom API', 'status' => 'ok']);
});

$r->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
