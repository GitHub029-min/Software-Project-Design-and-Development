const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const AREAS={Gulshan:[23.7925,90.4078],Dhanmondi:[23.7461,90.3742],Mirpur:[23.8223,90.3654],Uttara:[23.8759,90.3795],Mohammadpur:[23.7662,90.3589],'Old Dhaka':[23.7104,90.4074]};
const DEPOT=[23.7597,90.3925];let lastReceipt=null,me=null,cart=JSON.parse(sessionStorage.cart||'[]');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Live Server (port 55xx) cannot run PHP, so it calls XAMPP's Apache instead. Change bloomverse2 if your htdocs folder has another name.
const API=/^55\d\d$/.test(location.port)?'http://'+location.hostname+'/bloomverse2/api.php':'api.php';
const api=async(a,d,raw)=>{const t=await(await fetch(API+'?action='+a,{credentials:'include',...(d?{method:'POST',body:raw?d:JSON.stringify(d)}:{})})).text();if(t.trim().startsWith('<?php'))return{error:'PHP is not running for api.php. Open the site through XAMPP at http://localhost/bloomverse/ (not Live Server or a double-clicked file) and keep the folder inside C:/xampp/htdocs.'};try{return JSON.parse(t)}catch(e){return{error:'Server error: '+t.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,220)}}};
const toast=t=>{$('#toast').textContent=t;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,2500)};
const needLogin=m=>{toast('Please log in to '+m);go('auth')};
const done=(r,m)=>r.error?toast(r.error):m&&toast(m);
const form=f=>Object.fromEntries(new FormData(f));
const go=p=>{document.body.classList.toggle('bgpic',p!='home');$$('main>section').forEach(s=>s.hidden=s.id!=p);P[p]?.()};
const saveCart=()=>{sessionStorage.cart=JSON.stringify(cart);$('#cnt').textContent=cart.reduce((n,i)=>n+i.qty,0)};
const dist=(a,b)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(b[0]-a[0])/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(r(b[1]-a[1])/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const img=(f,g)=>`<div class="arch"><img src="images/${f}"${g?` data-f="${g}"`:''} alt="" onerror="if(this.dataset.f){this.src='images/'+this.dataset.f;delete this.dataset.f}else this.remove()"></div>`;
const areaOpts=Object.keys(AREAS).map(a=>`<option>${a}</option>`).join('');
const P={
receipt(){const d=lastReceipt;if(!d)return go('shop');
 $('#receipt').innerHTML=`<div class="card rcpt"><h2>Order placed. Thank you!</h2><p>Order #${d.id} &middot; ${esc(d.date)}</p>
 <div><b>${esc(d.name)}</b><br>${esc(d.phone)}<br>${esc(d.address)}<br>Delivery area: ${esc(d.area)}</div>
 <table>${d.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.qty} x Tk ${i.price}</td><td>Tk ${i.qty*i.price}</td></tr>`).join('')}<tr><td colspan="2"><b>Total</b></td><td><b>Tk ${d.total}</b></td></tr></table>
 <p class="cod"><b>Payment method: Cash on Delivery</b><br>Please keep Tk ${d.total} ready when the rider arrives.</p>
 <div class="bar noprint"><button class="pri" id="dlPdf">Download receipt (PDF)</button><button id="goOrd">My orders</button><button id="goShop">Continue shopping</button></div></div>`;
 $('#dlPdf').onclick=()=>pdf(d);$('#goShop').onclick=()=>go('shop');$('#goOrd').onclick=()=>go('orders')},
async home(){const c=['Plants','Seeds','Fertilizers','Flowers','Tools'];$('#cats').innerHTML=c.map(x=>`<div class="card">${img('cat-'+x.toLowerCase()+'.jpg')}<h3>${x}</h3><button data-cat="${x}">Browse ${x.toLowerCase()}</button></div>`).join('');
 $$('[data-cat]').forEach(b=>b.onclick=()=>{$('#cat').value=b.dataset.cat;go('shop')})},
async shop(){const qs=new URLSearchParams({q:$('#q').value,cat:$('#cat').value});$$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.c==$('#cat').value));let l;try{l=await api('products&'+qs)}catch(e){l={error:'Cannot reach api.php. Open the site at http://localhost/bloomverse/ (not by double-clicking index.html) and keep api.php in the same folder.'}}if(!Array.isArray(l))return $('#prods').innerHTML='<p><b>Could not load products.</b><br>'+esc(l.error||'Unknown error')+'</p>';
 const feat=!$('#cat').value&&!$('#q').value.trim();
 if(feat)l=['Plants','Flowers','Seeds','Fertilizers','Tools'].map(c=>l.find(p=>p.category==c)).filter(Boolean);
 $('#hint').textContent=feat?'One pick from each section. Choose a section above to see everything in it.':'';
 $('#prods').classList.toggle('feat',feat);
 $('#prods').innerHTML=l.map(p=>`<div class="card">${img(p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.jpg','p'+p.id+'.jpg')}<h3>${esc(p.name)}</h3><span class="tag">${p.category}${p.eco==1?' / Eco-certified':''}</span>
 <div>Tk ${p.price} &middot; ${p.stock} left &middot; ${p.rating?p.rating+'/5':'No ratings'}</div>
 <button class="pri" data-add="${p.id}" data-n="${esc(p.name)}" data-pr="${p.price}">Add to cart</button><button data-rev="${p.id}">Reviews</button>${feat?`<button data-see="${p.category}">See all ${p.category.toLowerCase()}</button>`:''}</div>`).join('')||'<p>No products match. Try another search.</p>';
 $$('[data-add]').forEach(b=>b.onclick=()=>{if(!me)return needLogin('add items to your cart');const i=cart.find(x=>x.id==b.dataset.add);i?i.qty++:cart.push({id:b.dataset.add,name:b.dataset.n,price:+b.dataset.pr,qty:1});saveCart();toast('Added to cart')});
 $$('[data-rev]').forEach(b=>b.onclick=()=>reviews(b.dataset.rev));$$('[data-see]').forEach(b=>b.onclick=()=>{$('#cat').value=b.dataset.see;P.shop()})},
async orders(){const b=$('#myOrders');if(!me){b.innerHTML='<p>Log in to see your orders.</p><button class="pri" id="ordLogin">Log in</button>';$('#ordLogin').onclick=()=>go('auth');return}
 const o=await api('myorders');
 b.innerHTML=o.length?`<div class="grid">${o.map(x=>`<div class="card"><b>Order #${x.id}</b><span class="tag">${x.status}</span>${x.cust_name?`<div>${esc(x.cust_name)}</div>`:''}${x.phone?`<div>${esc(x.phone)}</div>`:''}${x.address?`<div>${esc(x.address)}</div>`:''}<div><small>Delivery area: ${esc(x.area)}</small></div><div>Total Tk ${x.total} &middot; Cash on Delivery</div><small>${esc(x.created)}</small></div>`).join('')}</div>`:'<p>You have not placed any orders yet.</p><button class="pri" id="ordShop">Go to shop</button>';
 if($('#ordShop'))$('#ordShop').onclick=()=>{$('#cat').value='';go('shop')}},
doctor(){scanHist()},
async swap(){$('.areas').innerHTML=areaOpts;const l=await api('swaps');
 $('#swaps').innerHTML=l.map(s=>`<div class="card">${me&&(me.id==s.user_id||me.role=='admin')?`<button class="x" data-del="${s.id}" aria-label="Remove listing" title="Remove this listing">&times;</button>`:''}${s.has_photo==1?`<div class="arch"><img src="${API}?action=swap_img&id=${s.id}" alt=""></div>`:img('swap.jpg')}<h3>${esc(s.title)}</h3><span class="tag">${s.type}</span><div>${esc(s.area)} &middot; by ${esc(s.owner)}</div><div>${s.interested} interested</div>
 <button data-int="${s.id}">I'm interested</button></div>`).join('')||'<p>No listings yet. Create the first one.</p>';
 $$('[data-int]').forEach(b=>b.onclick=async()=>{done(await api('swap_interest',{id:b.dataset.int}),'Owner will see your interest');P.swap()});
 $$('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this listing? This cannot be undone.'))return;done(await api('swap_del',{id:b.dataset.del}),'Listing removed');P.swap()})},
async route(){const l=await api('route');if(l.error)return $('#routeOut').innerHTML='<p>Log in as a rider to see your route.</p>';
 let cur=DEPOT,left=[...l],seq=[],km=0;while(left.length){left.sort((a,b)=>dist(cur,[a.lat,a.lng])-dist(cur,[b.lat,b.lng]));const n=left.shift();km+=dist(cur,[n.lat,n.lng]);cur=[n.lat,n.lng];seq.push(n)}
 const pts=[DEPOT,...seq.map(o=>[o.lat,o.lng])],la=pts.map(p=>p[0]),lo=pts.map(p=>p[1]),mx=(v,a)=>(v-Math.min(...a))/((Math.max(...a)-Math.min(...a))||1);
 const xy=p=>[20+mx(p[1],lo)*260,280-mx(p[0],la)*260];
 $('#routeOut').innerHTML=`<p>${seq.length} stops &middot; ${km.toFixed(1)} km &middot; about ${Math.round(km/20*60)} min at 20 km/h</p>
 <svg viewBox="0 0 300 300" width="300"><polyline fill="none" stroke="#2F5D3A" stroke-width="2" points="${pts.map(p=>xy(p).join(',')).join(' ')}"/>${pts.map((p,i)=>`<circle cx="${xy(p)[0]}" cy="${xy(p)[1]}" r="6" fill="${i?'#E9A23B':'#5A3E2B'}"/>`).join('')}</svg>
 <table>${seq.map((o,i)=>`<tr><td>${i+1}</td><td>Order #${o.id} &middot; ${esc(o.cust_name)}<br><small>${esc(o.phone)} &middot; ${esc(o.address)} &middot; Area: ${esc(o.area)}</small></td><td>${o.status}</td><td><button data-dl="${o.id}">Mark delivered</button></td></tr>`).join('')||'<tr><td>No active orders assigned to you.</td></tr>'}</table>`;
 $$('[data-dl]').forEach(b=>b.onclick=async()=>{done(await api('deliver',{id:b.dataset.dl,status:'Delivered'}),'Delivered');P.route()})},
async cart(){const t=cart.reduce((s,i)=>s+i.qty*i.price,0);
 $('#cartOut').innerHTML=cart.length?`<table>${cart.map((i,k)=>`<tr><td>${esc(i.name)}</td><td>Tk ${i.price} x ${i.qty}</td><td><button data-rm="${k}">Remove</button></td></tr>`).join('')}</table>
 ${me?`<div class="card checkout"><h3>Delivery details</h3><input id="cn" placeholder="Full name" value="${esc(me.name)}" aria-label="Full name"><input id="cp" placeholder="Phone (01XXXXXXXXX)" inputmode="tel" aria-label="Phone number"><textarea id="ca" rows="3" placeholder="Full address (house, road, area)" aria-label="Full address"></textarea><small>Delivery area (used for the rider's route)</small><select id="area" aria-label="Delivery area">${areaOpts}</select><p class="cod">Payment method: <b>Cash on Delivery</b></p><div class="bar"><b>Total Tk ${t}</b><button class="pri" id="buy">Proceed to checkout</button></div></div>`:`<div class="bar"><b>Total Tk ${t}</b><button class="pri" id="cartLogin">Log in to checkout</button></div>`}`:'<p>Your cart is empty. Visit the shop to add plants.</p>';
 $$('[data-rm]').forEach(b=>b.onclick=()=>{cart.splice(b.dataset.rm,1);saveCart();P.cart()});
 if($('#cartLogin'))$('#cartLogin').onclick=()=>go('auth');
 if($('#buy'))$('#buy').onclick=async()=>{if(!$('#cn').value.trim()||!$('#cp').value.trim()||$('#ca').value.trim().length<10)return toast('Please fill in your name, phone and full address');const a=$('#area').value,r=await api('order',{items:cart,area:a,lat:AREAS[a][0],lng:AREAS[a][1],name:$('#cn').value.trim(),phone:$('#cp').value.trim(),address:$('#ca').value.trim()});
  if(r.ok){lastReceipt={id:r.id,total:r.total,date:new Date().toLocaleString('en-GB'),name:$('#cn').value.trim(),phone:$('#cp').value.trim(),address:$('#ca').value.trim(),area:a,items:cart.map(i=>({name:i.name,qty:i.qty,price:i.price}))};cart=[];saveCart();go('receipt')}else done(r)};
 },
auth(){$('.flip').hidden=!!me;$('#profile').hidden=!me;if(!me)return;
 $('#pName').textContent=me.name;$('#pRole').textContent=me.role=='user'?'Customer':me.role[0].toUpperCase()+me.role.slice(1);
 const L=[['orders','My orders'],['cart','Cart'],['doctor','Plant doctor'],['swap','Swap hub']];if(me.role=='rider')L.push(['route','Green route']);if(me.role=='admin')L.push(['admin','Admin dashboard']);
 $('#pLinks').innerHTML=L.map(l=>`<button data-go="${l[0]}">${l[1]}</button>`).join('');$$('#pLinks [data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go))},
async admin(){const d=await api('admin');if(d.error)return $('#adminOut').innerHTML='<p>Admin access only.</p>';const s=d.stats;
 $('#adminOut').innerHTML=`<div class="grid">${[['Users',s.users],['Orders',s.orders],['Revenue','Tk '+s.revenue],['Swap listings',s.swaps]].map(x=>`<div class="card"><small>${x[0]}</small><h3>${x[1]}</h3></div>`).join('')}</div>
 <h3>Recent orders</h3><table>${d.orders.map(o=>`<tr><td>#${o.id}</td><td>${esc(o.cust_name)}<br><small>${esc(o.phone)}</small></td><td>${esc(o.address)}<br><small>Area: ${esc(o.area)}</small></td><td>Tk ${o.total}</td><td>${o.status}</td><td>${o.rider_id?'Assigned':`<select data-as="${o.id}"><option value="">Assign rider</option>${d.riders.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`}</td></tr>`).join('')}</table>
 <h3>Eco-certification</h3><div class="bar">${d.products.map(p=>`<button data-eco="${p.id}">${esc(p.name)}: ${p.eco==1?'certified':'not certified'}</button>`).join('')}</div>
 <h3>Moderation queue</h3>${d.flagged.map(f=>`<div class="bar">${esc(f.comment)} <button data-dr="${f.id}">Delete review</button></div>`).join('')||'<p>No flagged reviews.</p>'}
 <h3>Add product</h3><form id="pf" class="bar"><input name="name" placeholder="Name" required><select name="category"><option>Plants</option><option>Seeds</option><option>Fertilizers</option><option>Flowers</option><option>Tools</option></select><input name="price" type="number" placeholder="Price" required><input name="stock" type="number" placeholder="Stock" required><button class="pri">Add product</button></form>
 <h3>Make a user a rider</h3><form id="rf" class="bar"><input name="email" type="email" placeholder="user@email.com" required><button>Make rider</button></form>`;
 const act=async(a,x,m)=>{done(await api(a,x),m);P.admin()};
 $$('[data-as]').forEach(e=>e.onchange=()=>e.value&&act('a_assign',{id:e.dataset.as,rider:e.value},'Rider assigned'));
 $$('[data-eco]').forEach(b=>b.onclick=()=>act('a_eco',{id:b.dataset.eco}));$$('[data-dr]').forEach(b=>b.onclick=()=>act('a_delreview',{id:b.dataset.dr},'Review deleted'));
 $('#pf').onsubmit=e=>{e.preventDefault();act('a_product',form(e.target),'Product added')};$('#rf').onsubmit=e=>{e.preventDefault();act('a_role',form(e.target),'Role updated')}}};
function pdf(d){const J=window.jspdf&&window.jspdf.jsPDF;if(!J)return toast('PDF tool did not load. Check your internet and try again.');
 const p=new J(),L=16;let y=20;const t=(s,x=L,z=11,b=0)=>{p.setFontSize(z);p.setFont('helvetica',b?'bold':'normal');p.text(String(s),x,y)};
 t('BloomVerse',L,20,1);y+=8;t('Order receipt',L,12);y+=12;t('Order #'+d.id+'    '+d.date);y+=8;t('Name: '+d.name);y+=7;t('Phone: '+d.phone);y+=7;
 p.splitTextToSize('Address: '+d.address,175).forEach(l=>{t(l);y+=6});t('Delivery area: '+d.area);y+=12;
 t('Item',L,11,1);t('Qty',120,11,1);t('Price',140,11,1);t('Amount',170,11,1);y+=7;
 d.items.forEach(i=>{if(y>270){p.addPage();y=20}t(i.name,L);t(i.qty,120);t(i.price,140);t(i.qty*i.price,170);y+=6});
 y+=6;t('Total: Tk '+d.total,L,12,1);y+=12;t('Payment method: Cash on Delivery',L,11,1);y+=7;t('Please keep Tk '+d.total+' ready when the rider arrives.',L);
 p.save('BloomVerse-order-'+d.id+'.pdf')}
async function scanHist(){const b=$('#scanHist');if(!me){b.innerHTML='';return}const h=await api('scans');
 b.innerHTML=Array.isArray(h)&&h.length?`<h3>Recent scans</h3><table><tr><th>Date</th><th>Index</th><th>Result</th></tr>${h.map(x=>`<tr><td>${esc(String(x.created).slice(0,16))}</td><td>${x.health_index}</td><td>${esc(x.issue)}</td></tr>`).join('')}</table>`:''}
async function reviews(id){const l=await api('reviews&id='+id),r=$('#rev');r.hidden=false;
 r.innerHTML=`<h3>Reviews</h3>${l.map(x=>`<div>${'&#9733;'.repeat(x.rating)} ${esc(x.comment)} <small>by ${esc(x.name)}</small> <button data-fl="${x.id}">Flag</button></div>`).join('')||'<p>No reviews yet.</p>'}
 ${me?`<form class="bar" id="rf2"><select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select><input name="comment" placeholder="Share how it grew" required><button class="pri">Post review</button></form>`:`<p>Log in to write a review. <button class="pri" id="rvLogin">Log in</button></p>`}`;
 if($('#rvLogin'))$('#rvLogin').onclick=()=>go('auth');if($('#rf2'))$('#rf2').onsubmit=async e=>{e.preventDefault();done(await api('review',{...form(e.target),id}),'Review posted');reviews(id)};
 $$('[data-fl]').forEach(b=>b.onclick=async()=>{if(!me)return needLogin('flag a review');done(await api('flag',{id:b.dataset.fl}),'Sent to moderation');reviews(id)})}
async function refresh(){me=await api('me');$('#nAuth').textContent=me?me.name:'Log in';$('#nRoute').hidden=me?.role!='rider';$('#nAdmin').hidden=me?.role!='admin';$('#nOrders').hidden=!me}
$$('[data-p]').forEach(b=>b.onclick=()=>{if(b.dataset.p=='shop')$('#cat').value='';go(b.dataset.p)});
$$('#tabs button').forEach(b=>b.onclick=()=>{$('#cat').value=b.dataset.c;P.shop()});$('#go').onclick=P.shop;
$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=await api('login',form(e.target));done(r,'Welcome back');await refresh();r.error||go('home')};
$('#regForm').onsubmit=async e=>{e.preventDefault();const r=await api('register',form(e.target));done(r,'Account created. Log in now.');r.error||$('.flip-in').classList.remove('flipped')};
$('#logout').onclick=async()=>{await api('logout');cart=[];saveCart();await refresh();go('home')};
$('#swapForm').onsubmit=async e=>{e.preventDefault();if(!me)return needLogin('create a listing');const r=await api('swap_add',new FormData(e.target),1);done(r,'Listing created');if(!r.error){e.target.reset();$('#swapPrev').hidden=true}P.swap()};
$('#swapForm [name=photo]').onchange=e=>{const f=e.target.files[0],p=$('#swapPrev');p.hidden=!f;if(f)p.src=URL.createObjectURL(f)};
$('#scan').onclick=async()=>{const f=$('#img').files[0],o=$('#scanOut');
 if(!f)return o.innerHTML='<p>Choose a leaf photo first.</p>';
 if(!me){o.innerHTML='<p>Please log in to scan a leaf.</p><button class="pri" id="scLogin">Log in</button>';$('#scLogin').onclick=()=>go('auth');return}
 o.innerHTML='<p>Scanning your leaf...</p>';const d=new FormData();d.append('img',f);const r=await api('scan',d,1);
 if(r.error)return o.innerHTML='<p><b>Could not scan:</b> '+esc(r.error)+'</p>';
 o.innerHTML=`<div class="card scan"><div class="arch"><img src="${URL.createObjectURL(f)}" alt=""></div><div class="res"><div class="ring" style="background:conic-gradient(var(--bottle) ${r.index}%,var(--moss) 0)"><span>${r.index}</span></div>
 <b>${esc(r.issue)}</b><small>What we saw: green ${r.mix.green}% &middot; yellow ${r.mix.yellow}% &middot; brown or dark ${r.mix.brown}%</small>
 <b>What to do</b><ul>${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
 <small>This is a quick colour-based check, not a lab test. For a serious problem, ask a nursery expert.</small></div></div>`;scanHist()};
$('#toSign').onclick=()=>$('.flip-in').classList.add('flipped');$('#toLog').onclick=()=>$('.flip-in').classList.remove('flipped');
$$('#auth input[type=password]').forEach(i=>{i.onfocus=()=>$('.plant').classList.add('shy');i.onblur=()=>$('.plant').classList.remove('shy')});
$('.auth-stage').onmousemove=e=>{const r=e.currentTarget.getBoundingClientRect(),f=$('.flip').style;f.setProperty('--ry',((e.clientX-r.left)/r.width-.5)*14+'deg');f.setProperty('--rx',-((e.clientY-r.top)/r.height-.5)*10+'deg')};
saveCart();refresh();go('home');
