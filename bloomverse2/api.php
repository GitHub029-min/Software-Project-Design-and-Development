<?php
session_set_cookie_params(["httponly" => true, "samesite" => "Lax"]);
session_start();
header("Content-Type: application/json");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: same-origin");
$o = $_SERVER["HTTP_ORIGIN"] ?? "";
if (preg_match('#^http://(localhost|127\.0\.0\.1):\d+$#', $o)) {
    header("Access-Control-Allow-Origin: " . $o);
    header("Access-Control-Allow-Credentials: true");
}
if (($_SERVER["REQUEST_METHOD"] ?? "") == "OPTIONS") {
    exit();
}
set_exception_handler(function ($e) {
    error_log("BloomVerse: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Server error. Please try again."]);
});
$db = new PDO(
    "mysql:host=" .
        (getenv("BV_DB_HOST") ?: "localhost") .
        ";dbname=" .
        (getenv("BV_DB") ?: "bloomverse") .
        ";charset=utf8mb4",
    getenv("BV_DB_USER") ?: "root",
    getenv("BV_DB_PASS") ?: "",
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);
function q($sql, $p = [])
{
    global $db;
    $s = $db->prepare($sql);
    $s->execute($p);
    return $s;
}
function out($d)
{
    echo json_encode($d);
    exit();
}
function pimg_check($f)
{
    if (!function_exists("imagecreatefromstring")) {
        return "PHP GD extension is off. Enable extension=gd in php.ini and restart Apache.";
    }
    if (
        $f["error"] ||
        $f["size"] > 12e6 ||
        !in_array(@getimagesize($f["tmp_name"])["mime"] ?? "", [
            "image/jpeg",
            "image/png",
        ])
    ) {
        return "Upload a JPG or PNG photo under 12MB.";
    }
    return null;
}
function pimg_save($f, $id)
{
    $im = imagecreatefromstring(file_get_contents($f["tmp_name"]));
    $im = imagescale($im, min(900, imagesx($im)));
    $dir = __DIR__ . "/images";
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    return @imagejpeg($im, $dir . "/p" . $id . ".jpg", 82);
}
function pvalid($in)
{
    if (trim($in["name"] ?? "") === "") {
        return "Enter the product name";
    }
    if (
        !in_array($in["category"] ?? "", [
            "Plants",
            "Seeds",
            "Fertilizers",
            "Flowers",
            "Tools",
        ])
    ) {
        return "Choose a valid category";
    }
    if (!is_numeric($in["price"] ?? null) || $in["price"] < 0) {
        return "Price must be a number, 0 or more";
    }
    if (
        !is_numeric($in["stock"] ?? null) ||
        $in["stock"] < 0 ||
        (int) $in["stock"] != $in["stock"]
    ) {
        return "Stock must be a whole number, 0 or more";
    }
    return null;
}
function need($role = null)
{
    global $u;
    if (!$u || ($role && $u["role"] != $role)) {
        http_response_code(403);
        out(["error" => "Login with the right account first"]);
    }
}
if (empty($_SESSION["setup"])) {
    if (!q("SHOW COLUMNS FROM users LIKE 'on_shift'")->fetch()) {
        q("ALTER TABLE users ADD on_shift TINYINT DEFAULT 0");
    }
    if (!q("SHOW COLUMNS FROM orders LIKE 'delivered_at'")->fetch()) {
        q("ALTER TABLE orders ADD delivered_at DATETIME NULL");
    }
    if (!q("SHOW COLUMNS FROM products LIKE 'active'")->fetch()) {
        q("ALTER TABLE products ADD active TINYINT DEFAULT 1");
    }
    if (!q("SHOW COLUMNS FROM products LIKE 'cost'")->fetch()) {
        q("ALTER TABLE products ADD cost DECIMAL(8,2) DEFAULT 100.00");
    }
    if (!q("SELECT 1 FROM users WHERE role='admin'")->fetch()) {
        q(
            "INSERT INTO users(name,email,password,role) VALUES('Admin','admin@bloomverse.com',?,'admin')",
            [password_hash("admin123", PASSWORD_DEFAULT)]
        );
    }
    $_SESSION["setup"] = 1;
}
$a = $_GET["action"] ?? "";
$in = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$u = $_SESSION["u"] ?? null;
if ($u) {
    $cr = q("SELECT name,role FROM users WHERE id=?", [$u["id"]])->fetch();
    if (!$cr) {
        session_destroy();
        $u = null;
    } else {
        $u["name"] = $cr["name"];
        $u["role"] = $cr["role"];
        $_SESSION["u"] = $u;
    }
}
switch ($a) {
    case "register":
        if (trim($in["name"] ?? "") === "") {
            out(["error" => "Enter your name"]);
        }
        if (!filter_var($in["email"] ?? "", FILTER_VALIDATE_EMAIL)) {
            out(["error" => "Enter a valid email address"]);
        }
        if (strlen($in["password"] ?? "") < 6) {
            out(["error" => "Password needs 6+ characters"]);
        }
        try {
            q("INSERT INTO users(name,email,password) VALUES(?,?,?)", [
                $in["name"],
                $in["email"],
                password_hash($in["password"], PASSWORD_DEFAULT),
            ]);
            out(["ok" => 1]);
        } catch (Exception $e) {
            out(["error" => "Email already used"]);
        }
    case "login":
        $r = q("SELECT * FROM users WHERE email=?", [
            $in["email"] ?? "",
        ])->fetch();
        if (!$r || !password_verify($in["password"] ?? "", $r["password"])) {
            out(["error" => "Wrong email or password"]);
        }
        $_SESSION["u"] = [
            "id" => $r["id"],
            "name" => $r["name"],
            "role" => $r["role"],
        ];
        out($_SESSION["u"]);
    case "logout":
        session_destroy();
        out(["ok" => 1]);
    case "me":
        out($u);
    case "products":
        $w = ["p.active=1"];
        $p = [];
        if (!empty($_GET["q"])) {
            $w[] = "name LIKE ?";
            $p[] = "%" . $_GET["q"] . "%";
        }
        if (!empty($_GET["cat"])) {
            $w[] = "category=?";
            $p[] = $_GET["cat"];
        }
        if (!empty($_GET["eco"])) {
            $w[] = "eco=1";
        }
        out(
            q(
                "SELECT p.*,(SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.product_id=p.id AND flagged=0) rating FROM products p WHERE " .
                    implode(" AND ", $w),
                $p
            )->fetchAll()
        );
    case "reviews":
        out(
            q(
                "SELECT r.id,r.rating,r.comment,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE product_id=? AND flagged=0",
                [$_GET["id"]]
            )->fetchAll()
        );
    case "review":
        need();
        if (
            !q(
                "SELECT 1 FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND o.status='Delivered'",
                [$u["id"], $in["id"]]
            )->fetch()
        ) {
            out([
                "error" =>
                    "Only customers who received this product can review it",
            ]);
        }
        q(
            "INSERT INTO reviews(product_id,user_id,rating,comment) VALUES(?,?,?,?)",
            [
                $in["id"],
                $u["id"],
                max(1, min(5, (int) $in["rating"])),
                substr($in["comment"], 0, 300),
            ]
        );
        out(["ok" => 1]);
    case "flag":
        need();
        q("UPDATE reviews SET flagged=1 WHERE id=?", [$in["id"]]);
        out(["ok" => 1]);
    case "order":
        need();
        $nm = trim($in["name"] ?? "");
        $ph = preg_replace("/[\s-]/", "", $in["phone"] ?? "");
        $ad = trim($in["address"] ?? "");
        if (
            $nm === "" ||
            !preg_match('/^(\+?88)?01\d{9}$/', $ph) ||
            strlen($ad) < 10
        ) {
            out([
                "error" =>
                    "Enter your name, a valid phone number (01XXXXXXXXX) and your full address",
            ]);
        }
        if (empty($in["items"]) || !is_array($in["items"])) {
            out(["error" => "Your cart is empty"]);
        }
        $db->beginTransaction();
        $t = 0;
        q(
            "INSERT INTO orders(user_id,cust_name,phone,address,area,lat,lng,total) VALUES(?,?,?,?,?,?,?,0)",
            [$u["id"], $nm, $ph, $ad, $in["area"], $in["lat"], $in["lng"]]
        );
        $oid = $db->lastInsertId();
        foreach ($in["items"] as $i) {
            $p = q("SELECT * FROM products WHERE id=? FOR UPDATE", [
                $i["id"],
            ])->fetch();
            $n = max(1, (int) $i["qty"]);
            if (!$p || !$p["active"] || $p["stock"] < $n) {
                $db->rollBack();
                out([
                    "error" => "Not enough stock for " . ($p["name"] ?? "item"),
                ]);
            }
            q("UPDATE products SET stock=stock-? WHERE id=?", [$n, $p["id"]]);
            q("INSERT INTO order_items VALUES(?,?,?,?)", [
                $oid,
                $p["id"],
                $n,
                $p["price"],
            ]);
            $t += $n * $p["price"];
        }
        q("UPDATE orders SET total=? WHERE id=?", [$t, $oid]);
        $db->commit();
        out(["ok" => 1, "id" => $oid, "total" => $t]);
    case "myorders":
        need();
        out(
            q(
                "SELECT id,cust_name,phone,address,area,total,status,created FROM orders WHERE user_id=? ORDER BY id DESC",
                [$u["id"]]
            )->fetchAll()
        );
    case "swaps":
        out(
            q(
                "SELECT s.id,s.user_id,s.title,s.type,s.area,(s.photo IS NOT NULL) has_photo,u.name owner,(SELECT COUNT(*) FROM swap_interests i WHERE i.post_id=s.id) interested FROM swap_posts s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC"
            )->fetchAll()
        );
    case "swap_add":
        need();
        $ph = null;
        $f = $_FILES["photo"] ?? null;
        if (trim($in["title"] ?? "") === "") {
            out(["error" => "Enter the plant name"]);
        }
        if ($f && $f["error"] !== UPLOAD_ERR_NO_FILE) {
            if (!function_exists("imagecreatefromstring")) {
                out([
                    "error" =>
                        "PHP GD extension is off. Enable extension=gd in php.ini and restart Apache.",
                ]);
            }
            if (
                $f["error"] ||
                $f["size"] > 12e6 ||
                !in_array(@getimagesize($f["tmp_name"])["mime"] ?? "", [
                    "image/jpeg",
                    "image/png",
                ])
            ) {
                out(["error" => "Upload a JPG or PNG photo under 12MB."]);
            }
            $im = imagecreatefromstring(file_get_contents($f["tmp_name"]));
            $im = imagescale($im, min(700, imagesx($im)));
            ob_start();
            imagejpeg($im, null, 72);
            $ph = base64_encode(ob_get_clean());
        }
        q(
            "INSERT INTO swap_posts(user_id,title,type,area,photo) VALUES(?,?,?,?,?)",
            [
                $u["id"],
                substr(trim($in["title"]), 0, 100),
                ($in["type"] ?? "") == "Swap" ? "Swap" : "Free adoption",
                $in["area"] ?? "",
                $ph,
            ]
        );
        out(["ok" => 1]);
    case "swap_img":
        $r = q("SELECT photo FROM swap_posts WHERE id=?", [
            $_GET["id"] ?? 0,
        ])->fetch();
        if (!$r || !$r["photo"]) {
            http_response_code(404);
            exit();
        }
        header("Content-Type: image/jpeg");
        header("Cache-Control: public, max-age=86400");
        echo base64_decode($r["photo"]);
        exit();
    case "swap_del":
        need();
        $r = q("SELECT user_id FROM swap_posts WHERE id=?", [
            $in["id"] ?? 0,
        ])->fetch();
        if (!$r || ($r["user_id"] != $u["id"] && $u["role"] != "admin")) {
            out(["error" => "You can only remove your own listings"]);
        }
        q("DELETE FROM swap_interests WHERE post_id=?", [$in["id"]]);
        q("DELETE FROM swap_posts WHERE id=?", [$in["id"]]);
        out(["ok" => 1]);
    case "swap_interest":
        need();
        q("INSERT IGNORE INTO swap_interests VALUES(?,?)", [
            $in["id"],
            $u["id"],
        ]);
        out(["ok" => 1]);
    case "scan":
        need();
        $f = $_FILES["img"] ?? null;
        if (!function_exists("imagecreatefromstring")) {
            out([
                "error" =>
                    "PHP GD extension is off. In XAMPP open php.ini, remove the ; before extension=gd, then restart Apache.",
            ]);
        }
        if (
            !$f ||
            $f["error"] ||
            $f["size"] > 8e6 ||
            !in_array(@getimagesize($f["tmp_name"])["mime"] ?? "", [
                "image/jpeg",
                "image/png",
            ])
        ) {
            out(["error" => "Upload a JPG or PNG photo under 8MB."]);
        }
        $im = imagescale(
            imagecreatefromstring(file_get_contents($f["tmp_name"])),
            80,
            80
        );
        $g = $y = $b = $d = $n = 0;
        for ($x = 16; $x < 64; $x++) {
            for ($z = 16; $z < 64; $z++) {
                $c = imagecolorat($im, $x, $z);
                $r = ($c >> 16) & 255;
                $gr = ($c >> 8) & 255;
                $bl = $c & 255;
                $mx = max($r, $gr, $bl);
                $mn = min($r, $gr, $bl);
                $v = $mx / 255;
                $s = $mx ? ($mx - $mn) / $mx : 0;
                if ($v < 0.18) {
                    $d++;
                    $n++;
                    continue;
                }
                if ($s < 0.12) {
                    if ($v < 0.35) {
                        $d++;
                        $n++;
                    }
                    continue;
                }
                if ($mx == $r) {
                    $h = 60 * fmod(($gr - $bl) / ($mx - $mn), 6);
                } elseif ($mx == $gr) {
                    $h = 60 * (($bl - $r) / ($mx - $mn) + 2);
                } else {
                    $h = 60 * (($r - $gr) / ($mx - $mn) + 4);
                }
                if ($h < 0) {
                    $h += 360;
                }
                $n++;
                if ($h >= 70 && $h <= 170) {
                    $g++;
                } elseif ($h >= 38 && $h < 70) {
                    $y++;
                } else {
                    $b++;
                }
            };
        }
        $n = max(1, $n);
        $gp = $g / $n;
        $yp = $y / $n;
        $bp = $b / $n;
        $dp = $d / $n;
        $idx = (int) round((100 * ($g + 0.4 * $y)) / $n);
        if ($bp + $dp >= 0.3) {
            $is = "Leaf burn or dying tissue: large brown or dark patches";
            $st = [
                "Trim the badly damaged leaves with clean scissors.",
                "Check the cause: strong afternoon sun, too little water, or soggy soil.",
                "Move the plant to bright indirect light and water only when the top 2 cm of soil is dry.",
                "If the patches keep spreading, spray neem oil and repot in fresh, well-draining soil.",
            ];
        } elseif ($bp >= 0.05 && ($yp >= 0.12 || $dp >= 0.02)) {
            $is =
                "Leaf spot disease (fungal or bacterial): brown spots with yellowing";
            $st = [
                "Pick off and bin the spotted leaves. Do not put them in compost.",
                "Water the soil, not the leaves, and do it in the morning.",
                "Spray neem oil solution (or a copper fungicide) every 7 days for 3 weeks.",
                "Give the plant more space and airflow, and keep fallen leaves away from the pot.",
            ];
        } elseif ($yp >= 0.35) {
            $is =
                "Yellowing leaves: overwatering, low nutrients or too little light";
            $st = [
                "Feel the soil. If it is wet, stop watering until the top layer dries.",
                "Make sure the pot has drainage holes.",
                "Add vermicompost or a balanced NPK fertilizer once a month.",
                "Move the plant to bright, indirect light.",
            ];
        } elseif ($idx >= 70) {
            $is = "Looks healthy";
            $st = [
                "Keep your current watering routine.",
                "Wipe dust off the leaves now and then.",
                "Feed lightly once a month in the growing season.",
            ];
        } else {
            $is = "Mild leaf stress: some discolouration";
            $st = [
                "Check soil moisture and light first.",
                "Remove any fully yellow or dry leaves.",
                "Take another photo in a week to see if it changes.",
            ];
        }
        q("INSERT INTO health_logs(user_id,health_index,issue) VALUES(?,?,?)", [
            $u["id"],
            $idx,
            $is,
        ]);
        out([
            "index" => $idx,
            "issue" => $is,
            "steps" => $st,
            "mix" => [
                "green" => round($gp * 100),
                "yellow" => round($yp * 100),
                "brown" => round(($bp + $dp) * 100),
            ],
            "history" => q(
                "SELECT health_index,issue,created FROM health_logs WHERE user_id=? ORDER BY id DESC LIMIT 5",
                [$u["id"]]
            )->fetchAll(),
        ]);
    case "scans":
        need();
        out(
            q(
                "SELECT health_index,issue,created FROM health_logs WHERE user_id=? ORDER BY id DESC LIMIT 10",
                [$u["id"]]
            )->fetchAll()
        );
    case "route":
        need("rider");
        out([
            "shift" => (int) q("SELECT on_shift FROM users WHERE id=?", [
                $u["id"],
            ])->fetchColumn(),
            "orders" => q(
                "SELECT id,cust_name,phone,address,area,lat,lng,total,status FROM orders WHERE rider_id=? AND status!='Delivered' ORDER BY id",
                [$u["id"]]
            )->fetchAll(),
            "open" => q(
                "SELECT id,cust_name,address,area,lat,lng,total FROM orders WHERE rider_id IS NULL AND status='Placed' ORDER BY id"
            )->fetchAll(),
            "stats" => q(
                "SELECT COUNT(*) done,IFNULL(SUM(total),0) cash FROM orders WHERE rider_id=? AND status='Delivered' AND DATE(delivered_at)=CURDATE()",
                [$u["id"]]
            )->fetch(),
        ]);
    case "accept":
        need("rider");
        if (
            !q("SELECT on_shift FROM users WHERE id=?", [
                $u["id"],
            ])->fetchColumn()
        ) {
            out(["error" => "Start your shift first"]);
        }
        if (
            !q(
                "UPDATE orders SET rider_id=?,status='Out for delivery' WHERE id=? AND rider_id IS NULL AND status='Placed'",
                [$u["id"], $in["id"] ?? 0]
            )->rowCount()
        ) {
            out(["error" => "This order was already taken"]);
        }
        out(["ok" => 1]);
    case "shift":
        need("rider");
        q("UPDATE users SET on_shift=1-on_shift WHERE id=?", [$u["id"]]);
        out(["ok" => 1]);
    case "deliver":
        need("rider");
        q(
            "UPDATE orders SET status='Delivered',delivered_at=NOW() WHERE id=? AND rider_id=?",
            [$in["id"], $u["id"]]
        );
        out(["ok" => 1]);
    case "admin":
        need("admin");
        out([
            "stats" => q(
                "SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM orders) orders,(SELECT IFNULL(SUM(total),0) FROM orders) revenue,(SELECT COUNT(*) FROM swap_posts) swaps"
            )->fetch(),
            "profit_loss" => q(
                "SELECT DATE_FORMAT(o.created, '%Y-%m') as month, SUM(i.qty * i.price) as revenue, SUM(i.qty * p.cost) as cost, SUM(i.qty * (i.price - p.cost)) as profit FROM orders o JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id WHERE o.status='Delivered' GROUP BY month ORDER BY month DESC LIMIT 6"
            )->fetchAll(),
            "orders" => q(
                "SELECT o.id,o.cust_name,o.phone,o.address,o.area,o.total,o.status,o.rider_id FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 20"
            )->fetchAll(),
            "riders" => q(
                "SELECT id,name,on_shift FROM users WHERE role='rider'"
            )->fetchAll(),
            "flagged" => q(
                "SELECT id,comment FROM reviews WHERE flagged=1"
            )->fetchAll(),
            "products" => q(
                "SELECT id,name,category,price,cost,stock,eco FROM products WHERE active=1 ORDER BY id"
            )->fetchAll(),
        ]);
    case "a_assign":
        need("admin");
        if (
            !q("SELECT 1 FROM users WHERE id=? AND role='rider'", [
                $in["rider"] ?? 0,
            ])->fetch()
        ) {
            out(["error" => "Choose a valid rider"]);
        }
        $od = q("SELECT status FROM orders WHERE id=?", [
            $in["id"] ?? 0,
        ])->fetch();
        if (!$od || $od["status"] == "Delivered") {
            out(["error" => "Order not found or already delivered"]);
        }
        q("UPDATE orders SET rider_id=?,status='Out for delivery' WHERE id=?", [
            $in["rider"],
            $in["id"],
        ]);
        out(["ok" => 1]);
    case "a_role":
        need("admin");
        $r = q("SELECT id,role FROM users WHERE email=?", [
            trim($in["email"] ?? ""),
        ])->fetch();
        if (!$r) {
            out([
                "error" => "No account with this email. Sign up with it first.",
            ]);
        }
        if ($r["role"] != "user") {
            out(["error" => "This account is already " . $r["role"]]);
        }
        q("UPDATE users SET role='rider' WHERE id=?", [$r["id"]]);
        out(["ok" => 1]);
    case "a_eco":
        need("admin");
        q("UPDATE products SET eco=1-eco WHERE id=?", [$in["id"]]);
        out(["ok" => 1]);
    case "a_product":
        need("admin");
        $f = $_FILES["photo"] ?? null;
        $has = $f && $f["error"] !== UPLOAD_ERR_NO_FILE;
        if ($e = pvalid($in)) {
            out(["error" => $e]);
        }
        if ($has && ($e = pimg_check($f))) {
            out(["error" => $e]);
        }
        $cost = is_numeric($in["cost"] ?? null) ? $in["cost"] : ($in["price"] * 0.6);
        q("INSERT INTO products(name,category,price,cost,stock) VALUES(?,?,?,?,?)", [
            trim($in["name"]),
            $in["category"],
            $in["price"],
            $cost,
            $in["stock"],
        ]);
        $pid = $db->lastInsertId();
        if ($has && !pimg_save($f, $pid)) {
            out([
                "error" =>
                    "Product added, but the photo could not be saved. Make sure the images folder is writable.",
            ]);
        }
        out(["ok" => 1]);
    case "a_product_edit":
        need("admin");
        $pid = (int) ($in["id"] ?? 0);
        $f = $_FILES["photo"] ?? null;
        $has = $f && $f["error"] !== UPLOAD_ERR_NO_FILE;
        if (!q("SELECT 1 FROM products WHERE id=?", [$pid])->fetch()) {
            out(["error" => "Product not found"]);
        }
        if ($e = pvalid($in)) {
            out(["error" => $e]);
        }
        if ($has && ($e = pimg_check($f))) {
            out(["error" => $e]);
        }
        q("UPDATE products SET name=?,category=?,price=?,stock=? WHERE id=?", [
            trim($in["name"]),
            $in["category"],
            $in["price"],
            $in["stock"],
            $pid,
        ]);
        if ($has && !pimg_save($f, $pid)) {
            out([
                "error" =>
                    "Saved, but the photo could not be saved. Make sure the images folder is writable.",
            ]);
        }
        out(["ok" => 1]);
    case "a_delproduct":
        need("admin");
        q("UPDATE products SET active=0 WHERE id=?", [$in["id"] ?? 0]);
        out(["ok" => 1]);
    case "a_delreview":
        need("admin");
        q("DELETE FROM reviews WHERE id=?", [$in["id"]]);
        out(["ok" => 1]);
    case "a_swapdel":
        need("admin");
        q("DELETE FROM swap_interests WHERE post_id=?", [$in["id"]]);
        q("DELETE FROM swap_posts WHERE id=?", [$in["id"]]);
        out(["ok" => 1]);
    default:
        out(["error" => "Unknown action"]);
}
