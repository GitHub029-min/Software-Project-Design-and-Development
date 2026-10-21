const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const AREAS={Gulshan:[23.7925,90.4078],Dhanmondi:[23.7461,90.3742],Mirpur:[23.8223,90.3654],Uttara:[23.8759,90.3795],Mohammadpur:[23.7662,90.3589],'Old Dhaka':[23.7104,90.4074]};
const DEPOT=[23.7597,90.3925];let me=null,cart=JSON.parse(sessionStorage.cart||'[]');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=async(a,d,raw)=>(await fetch('api.php?action='+a,d?{method:'POST',body:raw?d:JSON.stringify(d)}:{})).json();
const toast=t=>{$('#toast').textContent=t;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,2500)};
const done=(r,m)=>r.error?toast(r.error):m&&toast(m);
const form=f=>Object.fromEntries(new FormData(f));
const go=p=>{document.body.classList.toggle('bgpic',p!='home');$$('main>section').forEach(s=>s.hidden=s.id!=p);P[p]?.()};
const saveCart=()=>{sessionStorage.cart=JSON.stringify(cart);$('#cnt').textContent=cart.reduce((n,i)=>n+i.qty,0)};
const dist=(a,b)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(b[0]-a[0])/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(r(b[1]-a[1])/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const img=f=>`<div class="arch"><img src="images/${f}" alt="" onerror="this.remove()"></div>`;
const areaOpts=Object.keys(AREAS).map(a=>`<option>${a}</option>`).join('');
const P={
async home(){const c=['Plants','Seeds','Fertilizers','Flowers','Tools'];$('#cats').innerHTML=c.map(x=>`<div class="card">${img('cat-'+x.toLowerCase()+'.jpg')}<h3>${x}</h3><button data-cat="${x}">Browse ${x.toLowerCase()}</button></div>`).join('');
 $$('[data-cat]').forEach(b=>b.onclick=()=>{$('#cat').value=b.dataset.cat;go('shop')})},
async shop(){const qs=new URLSearchParams({q:$('#q').value,cat:$('#cat').value,eco:$('#eco').checked?1:0});$$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.c==$('#cat').value));let l;try{l=await api('products&'+qs)}catch(e){l=null}if(!Array.isArray(l))return $('#prods').innerHTML='<p>Could not load products. Check that Apache and MySQL are running and database.sql is imported.</p>';
 $('#prods').innerHTML=l.map(p=>`<div class="card">${img('p'+p.id+'.jpg')}<h3>${esc(p.name)}</h3><span class="tag">${p.category}${p.eco==1?' / Eco-certified':''}</span>
 <div>Tk ${p.price} &middot; ${p.stock} left &middot; ${p.rating?p.rating+'/5':'No ratings'}</div>
 <button class="pri" data-add="${p.id}" data-n="${esc(p.name)}" data-pr="${p.price}">Add to cart</button><button data-rev="${p.id}">Reviews</button></div>`).join('')||'<p>No products match. Try another search.</p>';
 $$('[data-add]').forEach(b=>b.onclick=()=>{const i=cart.find(x=>x.id==b.dataset.add);i?i.qty++:cart.push({id:b.dataset.add,name:b.dataset.n,price:+b.dataset.pr,qty:1});saveCart();toast('Added to cart')});
 $$('[data-rev]').forEach(b=>b.onclick=()=>reviews(b.dataset.rev))},
doctor(){},
async swap(){$('.areas').innerHTML=areaOpts;const l=await api('swaps');
 $('#swaps').innerHTML=l.map(s=>`<div class="card">${img('swap.jpg')}<h3>${esc(s.title)}</h3><span class="tag">${s.type}</span><div>${esc(s.area)} &middot; by ${esc(s.owner)}</div><div>${s.interested} interested</div>
 <button data-int="${s.id}">I'm interested</button></div>`).join('')||'<p>No listings yet. Create the first one.</p>';
 $$('[data-int]').forEach(b=>b.onclick=async()=>{done(await api('swap_interest',{id:b.dataset.int}),'Owner will see your interest');P.swap()})},
async route(){const l=await api('route');if(l.error)return $('#routeOut').innerHTML='<p>Log in as a rider to see your route.</p>';
 let cur=DEPOT,left=[...l],seq=[],km=0;while(left.length){left.sort((a,b)=>dist(cur,[a.lat,a.lng])-dist(cur,[b.lat,b.lng]));const n=left.shift();km+=dist(cur,[n.lat,n.lng]);cur=[n.lat,n.lng];seq.push(n)}
 const pts=[DEPOT,...seq.map(o=>[o.lat,o.lng])],la=pts.map(p=>p[0]),lo=pts.map(p=>p[1]),mx=(v,a)=>(v-Math.min(...a))/((Math.max(...a)-Math.min(...a))||1);
 const xy=p=>[20+mx(p[1],lo)*260,280-mx(p[0],la)*260];
 $('#routeOut').innerHTML=`<p>${seq.length} stops &middot; ${km.toFixed(1)} km &middot; about ${Math.round(km/20*60)} min at 20 km/h</p>
 <svg viewBox="0 0 300 300" width="300"><polyline fill="none" stroke="#2F5D3A" stroke-width="2" points="${pts.map(p=>xy(p).join(',')).join(' ')}"/>${pts.map((p,i)=>`<circle cx="${xy(p)[0]}" cy="${xy(p)[1]}" r="6" fill="${i?'#E9A23B':'#5A3E2B'}"/>`).join('')}</svg>
 <table>${seq.map((o,i)=>`<tr><td>${i+1}</td><td>Order #${o.id} &middot; ${esc(o.area)}</td><td>${o.status}</td><td><button data-dl="${o.id}">Mark delivered</button></td></tr>`).join('')||'<tr><td>No active orders assigned to you.</td></tr>'}</table>`;
 $$('[data-dl]').forEach(b=>b.onclick=async()=>{done(await api('deliver',{id:b.dataset.dl,status:'Delivered'}),'Delivered');P.route()})},
async cart(){const t=cart.reduce((s,i)=>s+i.qty*i.price,0);
 $('#cartOut').innerHTML=cart.length?`<table>${cart.map((i,k)=>`<tr><td>${esc(i.name)}</td><td>Tk ${i.price} x ${i.qty}</td><td><button data-rm="${k}">Remove</button></td></tr>`).join('')}</table>
 <div class="bar"><b>Total Tk ${t}</b><select id="area">${areaOpts}</select><button class="pri" id="buy">Place order</button></div>`:'<p>Your cart is empty. Visit the shop to add plants.</p>';
 $$('[data-rm]').forEach(b=>b.onclick=()=>{cart.splice(b.dataset.rm,1);saveCart();P.cart()});
 if($('#buy'))$('#buy').onclick=async()=>{const a=$('#area').value,r=await api('order',{items:cart,area:a,lat:AREAS[a][0],lng:AREAS[a][1]});
  if(r.ok){cart=[];saveCart();toast('Order #'+r.id+' placed. Total Tk '+r.total);P.cart()}else done(r)};
 const o=await api('myorders');$('#myOrders').innerHTML=o.length?`<h3>Your orders</h3><table>${o.map(x=>`<tr><td>#${x.id}</td><td>${esc(x.area)}</td><td>Tk ${x.total}</td><td>${x.status}</td></tr>`).join('')}</table>`:''},
auth(){$('#logout').hidden=!me;$('.auth-stage').hidden=!!me},
async admin(){const d=await api('admin');if(d.error)return $('#adminOut').innerHTML='<p>Admin access only.</p>';const s=d.stats;
 $('#adminOut').innerHTML=`<div class="grid">${[['Users',s.users],['Orders',s.orders],['Revenue','Tk '+s.revenue],['Swap listings',s.swaps]].map(x=>`<div class="card"><small>${x[0]}</small><h3>${x[1]}</h3></div>`).join('')}</div>
 <h3>Recent orders</h3><table>${d.orders.map(o=>`<tr><td>#${o.id}</td><td>${esc(o.name)}</td><td>${esc(o.area)}</td><td>Tk ${o.total}</td><td>${o.status}</td><td>${o.rider_id?'Assigned':`<select data-as="${o.id}"><option value="">Assign rider</option>${d.riders.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`}</td></tr>`).join('')}</table>
 <h3>Eco-certification</h3><div class="bar">${d.products.map(p=>`<button data-eco="${p.id}">${esc(p.name)}: ${p.eco==1?'certified':'not certified'}</button>`).join('')}</div>
 <h3>Moderation queue</h3>${d.flagged.map(f=>`<div class="bar">${esc(f.comment)} <button data-dr="${f.id}">Delete review</button></div>`).join('')||'<p>No flagged reviews.</p>'}
 <h3>Add product</h3><form id="pf" class="bar"><input name="name" placeholder="Name" required><select name="category"><option>Plants</option><option>Seeds</option><option>Fertilizers</option><option>Flowers</option><option>Tools</option></select><input name="price" type="number" placeholder="Price" required><input name="stock" type="number" placeholder="Stock" required><button class="pri">Add product</button></form>
 <h3>Make a user a rider</h3><form id="rf" class="bar"><input name="email" type="email" placeholder="user@email.com" required><button>Make rider</button></form>`;
 const act=async(a,x,m)=>{done(await api(a,x),m);P.admin()};
 $$('[data-as]').forEach(e=>e.onchange=()=>e.value&&act('a_assign',{id:e.dataset.as,rider:e.value},'Rider assigned'));
 $$('[data-eco]').forEach(b=>b.onclick=()=>act('a_eco',{id:b.dataset.eco}));$$('[data-dr]').forEach(b=>b.onclick=()=>act('a_delreview',{id:b.dataset.dr},'Review deleted'));
 $('#pf').onsubmit=e=>{e.preventDefault();act('a_product',form(e.target),'Product added')};$('#rf').onsubmit=e=>{e.preventDefault();act('a_role',form(e.target),'Role updated')}}};
async function reviews(id){const l=await api('reviews&id='+id),r=$('#rev');r.hidden=false;
 r.innerHTML=`<h3>Reviews</h3>${l.map(x=>`<div>${'&#9733;'.repeat(x.rating)} ${esc(x.comment)} <small>by ${esc(x.name)}</small> <button data-fl="${x.id}">Flag</button></div>`).join('')||'<p>No reviews yet.</p>'}
 <form class="bar" id="rf2"><select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select><input name="comment" placeholder="Share how it grew" required><button class="pri">Post review</button></form>`;
 $('#rf2').onsubmit=async e=>{e.preventDefault();done(await api('review',{...form(e.target),id}),'Review posted');reviews(id)};
 $$('[data-fl]').forEach(b=>b.onclick=async()=>{done(await api('flag',{id:b.dataset.fl}),'Sent to moderation');reviews(id)})}
async function refresh(){me=await api('me');$('#nAuth').textContent=me?me.name:'Log in';$('#nRoute').hidden=me?.role!='rider';$('#nAdmin').hidden=me?.role!='admin'}
$$('[data-p]').forEach(b=>b.onclick=()=>{if(b.dataset.p=='shop')$('#cat').value='';go(b.dataset.p)});
$$('#tabs button').forEach(b=>b.onclick=()=>{$('#cat').value=b.dataset.c;P.shop()});$('#go').onclick=P.shop;
$('#loginForm').onsubmit=async e=>{e.preventDefault();const r=await api('login',form(e.target));done(r,'Welcome back');await refresh();r.error||go('home')};
$('#regForm').onsubmit=async e=>{e.preventDefault();const r=await api('register',form(e.target));done(r,'Account created. Log in now.');r.error||$('.flip-in').classList.remove('flipped')};
$('#logout').onclick=async()=>{await api('logout');await refresh();go('home')};
$('#swapForm').onsubmit=async e=>{e.preventDefault();done(await api('swap_add',form(e.target)),'Listing created');P.swap()};
$('#scan').onclick=async()=>{const f=$('#img').files[0];if(!f)return toast('Choose a photo first');const d=new FormData();d.append('img',f);const r=await api('scan',d,1);if(r.error)return toast(r.error);
 $('#scanOut').innerHTML=`<div class="card scan"><div class="arch"><img src="${URL.createObjectURL(f)}" alt=""></div><div class="ring" style="background:conic-gradient(var(--moss) ${r.index}%,var(--leaf) 0)"><span>${r.index}</span></div><b>${esc(r.issue)}</b><p>${esc(r.remedy)}</p>
 <small>Recent scans: ${r.history.map(h=>h.health_index).join(', ')}</small></div>`};
$('#toSign').onclick=()=>$('.flip-in').classList.add('flipped');$('#toLog').onclick=()=>$('.flip-in').classList.remove('flipped');
$$('#auth input[type=password]').forEach(i=>{i.onfocus=()=>$('.plant').classList.add('shy');i.onblur=()=>$('.plant').classList.remove('shy')});
$('.auth-stage').onmousemove=e=>{const r=e.currentTarget.getBoundingClientRect(),f=$('.flip').style;f.setProperty('--ry',((e.clientX-r.left)/r.width-.5)*14+'deg');f.setProperty('--rx',-((e.clientY-r.top)/r.height-.5)*10+'deg')};
saveCart();refresh();go('home');