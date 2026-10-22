<?php
session_start(); header('Content-Type: application/json');
$o=$_SERVER['HTTP_ORIGIN']??'';if(preg_match('#^http://(localhost|127\.0\.0\.1):\d+$#',$o)){header('Access-Control-Allow-Origin: '.$o);header('Access-Control-Allow-Credentials: true');}
if(($_SERVER['REQUEST_METHOD']??'')=='OPTIONS')exit;
set_exception_handler(function($e){http_response_code(500);echo json_encode(['error'=>$e->getMessage()]);});
$db=new PDO('mysql:host=localhost;dbname=bloomverse;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function q($sql,$p=[]){global $db;$s=$db->prepare($sql);$s->execute($p);return $s;}
function out($d){echo json_encode($d);exit;}
function need($role=null){global $u;if(!$u||($role&&$u['role']!=$role)){http_response_code(403);out(['error'=>'Login with the right account first']);}}
if(!q("SELECT 1 FROM users WHERE role='admin'")->fetch())
 q("INSERT INTO users(name,email,password,role) VALUES('Admin','admin@bloomverse.com',?,'admin')",[password_hash('admin123',PASSWORD_DEFAULT)]);
$a=$_GET['action']??''; $in=json_decode(file_get_contents('php://input'),true)??$_POST; $u=$_SESSION['u']??null;
switch($a){
case 'register':
 if(strlen($in['password']??'')<6)out(['error'=>'Password needs 6+ characters']);
 try{q("INSERT INTO users(name,email,password) VALUES(?,?,?)",[$in['name'],$in['email'],password_hash($in['password'],PASSWORD_DEFAULT)]);out(['ok'=>1]);}
 catch(Exception $e){out(['error'=>'Email already used']);}
case 'login':
 $r=q("SELECT * FROM users WHERE email=?",[$in['email']??''])->fetch();
 if(!$r||!password_verify($in['password']??'',$r['password']))out(['error'=>'Wrong email or password']);
 $_SESSION['u']=['id'=>$r['id'],'name'=>$r['name'],'role'=>$r['role']];out($_SESSION['u']);
case 'logout': session_destroy();out(['ok'=>1]);
case 'me': out($u);
case 'products':
 $w=['1'];$p=[];
 if(!empty($_GET['q'])){$w[]='name LIKE ?';$p[]='%'.$_GET['q'].'%';}
 if(!empty($_GET['cat'])){$w[]='category=?';$p[]=$_GET['cat'];}
 if(!empty($_GET['eco'])){$w[]='eco=1';}
 out(q("SELECT p.*,(SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.product_id=p.id AND flagged=0) rating FROM products p WHERE ".implode(' AND ',$w),$p)->fetchAll());
case 'reviews': out(q("SELECT r.id,r.rating,r.comment,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE product_id=? AND flagged=0",[$_GET['id']])->fetchAll());
case 'review':
 need();
 if(!q("SELECT 1 FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND o.status='Delivered'",[$u['id'],$in['id']])->fetch())out(['error'=>'Only customers who received this product can review it']);
 q("INSERT INTO reviews(product_id,user_id,rating,comment) VALUES(?,?,?,?)",[$in['id'],$u['id'],max(1,min(5,(int)$in['rating'])),substr($in['comment'],0,300)]);out(['ok'=>1]);
case 'flag': need();q("UPDATE reviews SET flagged=1 WHERE id=?",[$in['id']]);out(['ok'=>1]);
case 'order':
 need();$nm=trim($in['name']??'');$ph=preg_replace('/[\s-]/','',$in['phone']??'');$ad=trim($in['address']??'');
 if($nm===''||!preg_match('/^(\+?88)?01\d{9}$/',$ph)||strlen($ad)<10)out(['error'=>'Enter your name, a valid phone number (01XXXXXXXXX) and your full address']);
 $db->beginTransaction();$t=0;
 q("INSERT INTO orders(user_id,cust_name,phone,address,area,lat,lng,total) VALUES(?,?,?,?,?,?,?,0)",[$u['id'],$nm,$ph,$ad,$in['area'],$in['lat'],$in['lng']]);$oid=$db->lastInsertId();
 foreach($in['items'] as $i){
  $p=q("SELECT * FROM products WHERE id=? FOR UPDATE",[$i['id']])->fetch();$n=max(1,(int)$i['qty']);
  if(!$p||$p['stock']<$n){$db->rollBack();out(['error'=>'Not enough stock for '.($p['name']??'item')]);}
  q("UPDATE products SET stock=stock-? WHERE id=?",[$n,$p['id']]);
  q("INSERT INTO order_items VALUES(?,?,?,?)",[$oid,$p['id'],$n,$p['price']]);$t+=$n*$p['price'];}
 q("UPDATE orders SET total=? WHERE id=?",[$t,$oid]);$db->commit();out(['ok'=>1,'id'=>$oid,'total'=>$t]);
case 'myorders': need();out(q("SELECT id,cust_name,phone,address,area,total,status,created FROM orders WHERE user_id=? ORDER BY id DESC",[$u['id']])->fetchAll());
case 'swaps': out(q("SELECT s.*,u.name owner,(SELECT COUNT(*) FROM swap_interests i WHERE i.post_id=s.id) interested FROM swap_posts s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC")->fetchAll());
case 'swap_add': need();q("INSERT INTO swap_posts(user_id,title,type,area) VALUES(?,?,?,?)",[$u['id'],$in['title'],$in['type']=='Swap'?'Swap':'Free adoption',$in['area']]);out(['ok'=>1]);
case 'swap_interest': need();q("INSERT IGNORE INTO swap_interests VALUES(?,?)",[$in['id'],$u['id']]);out(['ok'=>1]);
case 'scan':
 need();$f=$_FILES['img']??null;
 if(!$f||$f['error']||$f['size']>4e6||!in_array(@getimagesize($f['tmp_name'])['mime']??'',['image/jpeg','image/png']))out(['error'=>'Upload a JPG or PNG under 4MB']);
 $im=imagescale(imagecreatefromstring(file_get_contents($f['tmp_name'])),50,50);$g=$y=$d=0;
 for($x=0;$x<50;$x++)for($z=0;$z<50;$z++){$c=imagecolorat($im,$x,$z);$r=($c>>16)&255;$gr=($c>>8)&255;$b=$c&255;
  if($r+$gr+$b<150)$d++;elseif($gr>$r&&$gr>$b)$g++;elseif($r>$b+30&&$gr>$b)$y++;}
 $idx=(int)round(100*$g/max(1,$g+$y+$d));
 if($idx>=70){$is='Looks healthy';$rem='Keep the current watering routine.';}
 elseif($y>$d){$is='Yellowing leaves: possible overwatering or nutrient deficiency';$rem='Water less often and add vermicompost.';}
 else{$is='Dark spots: possible fungal infection';$rem='Remove affected leaves and spray neem oil solution.';}
 q("INSERT INTO health_logs(user_id,health_index,issue) VALUES(?,?,?)",[$u['id'],$idx,$is]);
 out(['index'=>$idx,'issue'=>$is,'remedy'=>$rem,'history'=>q("SELECT health_index,issue,created FROM health_logs WHERE user_id=? ORDER BY id DESC LIMIT 5",[$u['id']])->fetchAll()]);
case 'route': need('rider');out(q("SELECT id,cust_name,phone,address,area,lat,lng,status FROM orders WHERE rider_id=? AND status!='Delivered'",[$u['id']])->fetchAll());
case 'deliver': need('rider');q("UPDATE orders SET status=? WHERE id=? AND rider_id=?",[$in['status']=='Delivered'?'Delivered':'Out for delivery',$in['id'],$u['id']]);out(['ok'=>1]);
case 'admin':
 need('admin');
 out(['stats'=>q("SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM orders) orders,(SELECT IFNULL(SUM(total),0) FROM orders) revenue,(SELECT COUNT(*) FROM swap_posts) swaps")->fetch(),
 'orders'=>q("SELECT o.id,o.cust_name,o.phone,o.address,o.area,o.total,o.status,o.rider_id FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 20")->fetchAll(),
 'riders'=>q("SELECT id,name FROM users WHERE role='rider'")->fetchAll(),
 'flagged'=>q("SELECT id,comment FROM reviews WHERE flagged=1")->fetchAll(),
 'products'=>q("SELECT id,name,eco FROM products")->fetchAll()]);
case 'a_assign': need('admin');q("UPDATE orders SET rider_id=?,status='Out for delivery' WHERE id=?",[$in['rider'],$in['id']]);out(['ok'=>1]);
case 'a_role': need('admin');q("UPDATE users SET role='rider' WHERE email=? AND role='user'",[$in['email']]);out(['ok'=>1]);
case 'a_eco': need('admin');q("UPDATE products SET eco=1-eco WHERE id=?",[$in['id']]);out(['ok'=>1]);
case 'a_product': need('admin');q("INSERT INTO products(name,category,price,stock) VALUES(?,?,?,?)",[$in['name'],$in['category'],$in['price'],$in['stock']]);out(['ok'=>1]);
case 'a_delreview': need('admin');q("DELETE FROM reviews WHERE id=?",[$in['id']]);out(['ok'=>1]);
case 'a_swapdel': need('admin');q("DELETE FROM swap_interests WHERE post_id=?",[$in['id']]);q("DELETE FROM swap_posts WHERE id=?",[$in['id']]);out(['ok'=>1]);
default: out(['error'=>'Unknown action']);
}
