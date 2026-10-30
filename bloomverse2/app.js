const $ = s => document.querySelector(s),
	$$ = s => document.querySelectorAll(s);
const AREAS = {
	Gulshan: [23.7925, 90.4078],
	Dhanmondi: [23.7461, 90.3742],
	Mirpur: [23.8223, 90.3654],
	Uttara: [23.8759, 90.3795],
	Mohammadpur: [23.7662, 90.3589],
	'Old Dhaka': [23.7104, 90.4074]
};
const DEPOT = [23.7597, 90.3925];
let lastReceipt = null,
	rmap = null,
	me = null,
	cart = JSON.parse(sessionStorage.cart || '[]');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;'
} [c]));
const API = /^55\d\d$/.test(location.port) ? 'http://' + location.hostname + '/bloomverse2/api.php' : 'api.php';
const api = async (a, d, raw) => {
	const t = await (await fetch(API + '?action=' + a, {
		credentials: 'include',
		...(d ? {
			method: 'POST',
			body: raw ? d : JSON.stringify(d)
		} : {})
	})).text();
	if (t.trim().startsWith('<?php')) return {
		error: 'PHP is not running for api.php. Open the site through XAMPP at http://localhost/bloomverse/'
	};
	try {
		return JSON.parse(t)
	} catch {
		return {
			error: 'Server error: ' + t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
		}
	}
};
const toast = t => {
	$('#toast').textContent = t;
	$('#toast').hidden = false;
	setTimeout(() => $('#toast').hidden = true, 2500)
};
const needLogin = m => {
	toast('Please log in to ' + m);
	go('auth')
};
const done = (r, m) => r.error ? toast(r.error) : m && toast(m);
const form = f => Object.fromEntries(new FormData(f));
const go = p => {
	document.body.classList.toggle('bgpic', p != 'home');
	$$('main>section').forEach(s => s.hidden = s.id != p);
	P[p]?.()
};
const saveCart = () => {
	sessionStorage.cart = JSON.stringify(cart);
	$('#cnt').textContent = cart.reduce((n, i) => n + i.qty, 0)
};
const dist = (a, b) => {
	const r = x => x * Math.PI / 180,
		h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(h))
};
const img = (f, g) => `<div class="arch"><img src="images/${f}"${g?` data-f="${g}"`:''} alt="" onerror="if(this.dataset.f){this.src='images/'+this.dataset.f;delete this.dataset.f}else this.remove()"></div>`;
const areaOpts = Object.keys(AREAS).map(a => `<option>${a}</option>`).join('');
const P = {
	receipt() {
		const d = lastReceipt;
		if (!d) return go('shop');
		$('#receipt').innerHTML = `<div class="card rcpt"><h2>Order placed. Thank you!</h2><p>Order #${d.id} &middot; ${esc(d.date)}</p>
 <div><b>${esc(d.name)}</b><br>${esc(d.phone)}<br>${esc(d.address)}<br>Delivery area: ${esc(d.area)}</div>
 <table>${d.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.qty} x Tk ${i.price}</td><td>Tk ${i.qty*i.price}</td></tr>`).join('')}<tr><td colspan="2"><b>Total</b></td><td><b>Tk ${d.total}</b></td></tr></table>
 <p class="cod"><b>Payment method: Cash on Delivery</b><br>Please keep Tk ${d.total} ready when the rider arrives.</p>
 <div class="bar noprint"><button class="pri" id="dlPdf">Download receipt (PDF)</button><button id="goOrd">My orders</button><button id="goShop">Continue shopping</button></div></div>`;
		$('#dlPdf').onclick = () => pdf(d);
		$('#goShop').onclick = () => go('shop');
		$('#goOrd').onclick = () => go('orders')
	},
	async home() {
		const c = ['Plants', 'Seeds', 'Fertilizers', 'Flowers', 'Tools'];
		$('#cats').innerHTML = c.map(x => `<div class="card">${img('cat-'+x.toLowerCase()+'.jpg')}<h3>${x}</h3><button data-cat="${x}">Browse ${x.toLowerCase()}</button></div>`).join('');
		$$('[data-cat]').forEach(b => b.onclick = () => {
			$('#cat').value = b.dataset.cat;
			go('shop')
		})
	},
	async shop() {
		const qs = new URLSearchParams({
			q: $('#q').value,
			cat: $('#cat').value
		});
		$$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.c == $('#cat').value));
		let l;
		try {
			l = await api('products&' + qs)
		} catch {
			l = {
				error: 'Cannot reach api.php.'
			}
		}
		if (!Array.isArray(l)) return $('#prods').innerHTML = '<p><b>Could not load products.</b></p>';
		const feat = !$('#cat').value && !$('#q').value.trim();
		if (feat) l = ['Plants', 'Flowers', 'Seeds', 'Fertilizers', 'Tools'].map(c => l.find(p => p.category == c)).filter(Boolean);
		$('#hint').textContent = feat ? 'One pick from each section. Choose a section above to see everything in it.' : '';
		$('#prods').classList.toggle('feat', feat);
		$('#prods').innerHTML = l.map(p => `<div class="card">${img('p'+p.id+'.jpg',p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.jpg')}<h3>${esc(p.name)}</h3><span class="tag">${p.category}${p.eco==1?' / Eco-certified':''}</span>
 <div>Tk ${p.price} &middot; ${p.stock} left &middot; ${p.rating?p.rating+'/5':'No ratings'}</div>
 <div class="acts"><button class="pri" data-add="${p.id}" data-n="${esc(p.name)}" data-pr="${p.price}">Add to cart</button><button data-rev="${p.id}">Reviews</button>${feat?`<button data-see="${p.category}">See all ${p.category.toLowerCase()}</button>`:''}</div>${me?.role=='admin'?`<div class="acts"><button data-ped="${p.id}">Edit</button><button data-prm="${p.id}">Remove</button></div>`:''}</div>`).join('') || '<p>No products match. Try another search.</p>';
		$$('[data-add]').forEach(b => b.onclick = () => {
			if (!me) return needLogin('add items to your cart');
			const i = cart.find(x => x.id == b.dataset.add);
			i ? i.qty++ : cart.push({
				id: b.dataset.add,
				name: b.dataset.n,
				price: +b.dataset.pr,
				qty: 1
			});
			saveCart();
			toast('Added to cart')
		});
		$$('[data-ped]').forEach(b => b.onclick = () => {
			window.aEdit = b.dataset.ped;
			window.aTab = 'products';
			go('admin')
		});
		$$('[data-prm]').forEach(b => b.onclick = async () => {
			const p = l.find(x => x.id == b.dataset.prm);
			if (confirm('Remove "' + p.name + '" from the shop?')) {
				done(await api('a_delproduct', {
					id: p.id
				}), 'Product removed');
				P.shop()
			}
		});
		$$('[data-rev]').forEach(b => b.onclick = () => reviews(b.dataset.rev));
		$$('[data-see]').forEach(b => b.onclick = () => {
			$('#cat').value = b.dataset.see;
			P.shop()
		})
	},
	async orders() {
		const b = $('#myOrders');
		if (!me) {
			b.innerHTML = '<p>Log in to see your orders.</p><button class="pri" id="ordLogin">Log in</button>';
			$('#ordLogin').onclick = () => go('auth');
			return
		}
		const o = await api('myorders');
		b.innerHTML = o.length ? `<div class="grid">${o.map(x=>`<div class="card"><b>Order #${x.id}</b><span class="tag">${x.status}</span>${x.cust_name?`<div>${esc(x.cust_name)}</div>`:''}${x.phone?`<div>${esc(x.phone)}</div>`:''}${x.address?`<div>${esc(x.address)}</div>`:''}<div><small>Delivery area: ${esc(x.area)}</small></div><div>Total Tk ${x.total} &middot; Cash on Delivery</div><small>${esc(x.created)}</small></div>`).join('')}</div>` : '<p>You have not placed any orders yet.</p><button class="pri" id="ordShop">Go to shop</button>';
		if ($('#ordShop')) $('#ordShop').onclick = () => {
			$('#cat').value = '';
			go('shop')
		}
	},
	doctor() {
		scanHist()
	},
	async swap() {
		$('.areas').innerHTML = areaOpts;
		const l = await api('swaps');
		$('#swaps').innerHTML = l.map(s => `<div class="card">${me&&(me.id==s.user_id||me.role=='admin')?`<button class="x" data-del="${s.id}" aria-label="Remove listing" title="Remove this listing">&times;</button>`:''}${s.has_photo==1?`<div class="arch"><img src="${API}?action=swap_img&id=${s.id}" alt=""></div>`:img('swap.jpg')}<h3>${esc(s.title)}</h3><span class="tag">${s.type}</span><div>${esc(s.area)} &middot; by ${esc(s.owner)}</div><div>${s.interested} interested</div>
 <button data-int="${s.id}">I'm interested</button></div>`).join('') || '<p>No listings yet. Create the first one.</p>';
		$$('[data-int]').forEach(b => b.onclick = async () => {
			done(await api('swap_interest', {
				id: b.dataset.int
			}), 'Owner will see your interest');
			P.swap()
		});
		$$('[data-del]').forEach(b => b.onclick = async () => {
			if (!confirm('Remove this listing? This cannot be undone.')) return;
			done(await api('swap_del', {
				id: b.dataset.del
			}), 'Listing removed');
			P.swap()
		})
	},
	async route() {
		const d = await api('route');
		if (d.error) return $('#routeOut').innerHTML = '<p>Log in as a rider to see your route.</p>';
		if (rmap) {
			rmap.remove();
			rmap = null
		}
		const box = $('#routeOut'),
			st = d.stats,
			card = (a, b) => `<div class="card"><small>${a}</small><h3>${b}</h3></div>`;
		const shiftBtn = `<div class="bar"><button class="${d.shift?'pri':''}" id="shift">${d.shift?'On shift: tap to go off':'Off shift: tap to start'}</button></div>`;
		const bind = () => $('#shift').onclick = async () => {
			done(await api('shift', {}), d.shift ? 'You are off shift' : 'Shift started');
			P.route()
		};
		if (!d.shift) {
			box.innerHTML = shiftBtn + `<div class="grid">${card('Delivered today',st.done)}${card('Cash collected today','Tk '+st.cash)}</div><p>Go on shift to see your route.</p>`;
			return bind()
		}
		const {
			seq,
			km,
			naive
		} = plan(d.orders), saved = Math.max(0, naive - km), pts = [DEPOT, ...seq.map(s => [s.lat, s.lng])];
		box.innerHTML = shiftBtn + `<div class="grid">${card('Stops left',seq.length)}${card('Delivered today',st.done)}${card('Cash collected today','Tk '+st.cash)}${card('Route length',`<span id="rKm">${km.toFixed(1)}</span> km`)}${card('Est. time',`<span id="rMin">${Math.round(km/20*60+seq.length*3)}</span> min`)}${card('CO2 saved (approx)',Math.round(saved*100)+' g')}</div>
 <h3>New orders waiting (${d.open.length})</h3>${d.open.length?`<table>${d.open.map(o=>`<tr><td>Order #${o.id} &middot; ${esc(o.cust_name)}<br><small>${esc(o.address)} &middot; Area: ${esc(o.area)} &middot; Collect Tk ${o.total}</small></td><td>${dist(DEPOT,[o.lat,o.lng]).toFixed(1)} km from depot</td><td><button class="pri" data-acc="${o.id}">Accept for delivery</button></td></tr>`).join('')}</table>`:'<p>No new orders right now.</p>'}
 <h3>My route</h3>
 <div id="rmap"></div>
 <table>${seq.map((o,i)=>`<tr><td>${i+1}</td><td>Order #${o.id} &middot; ${esc(o.cust_name)}<br><small>${esc(o.address)} &middot; Area: ${esc(o.area)} &middot; Collect Tk ${o.total}</small></td><td><a href="tel:${esc(o.phone)}">Call</a> &middot; <a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}">Navigate</a></td><td><button data-dl="${o.id}">Mark delivered</button></td></tr>`).join('')||'<tr><td>No active orders assigned to you.</td></tr>'}</table>
 <small>Stops are optimized with Nearest Neighbor + 2-opt shortest path algorithm.</small>`;
		bind();
		if (window.L) {
			const m = rmap = L.map('rmap');
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap'
			}).addTo(m);
			const line = L.polyline(pts, {
				color: '#1F4D3A',
				weight: 4,
				dashArray: '8 8'
			}).addTo(m);
			pts.forEach((p, i) => L.marker(p, {
				icon: L.divIcon({
					className: '',
					html: `<div class="stop${i?'':' depot'}">${i||'D'}</div>`,
					iconSize: [30, 30],
					iconAnchor: [15, 15]
				})
			}).addTo(m).bindPopup(i ? `#${seq[i-1].id} ${esc(seq[i-1].cust_name)}` : 'Depot'));
			if (seq.length) {
				m.fitBounds(L.latLngBounds(pts).pad(.2));
				roadRoute(pts).then(r => {
					if (!r || rmap !== m || !$('#rKm')) return;
					line.setLatLngs(r.line).setStyle({
						dashArray: null
					});
					$('#rKm').textContent = r.km.toFixed(1);
					$('#rMin').textContent = Math.round(r.min + seq.length * 3)
				})
			} else m.setView(DEPOT, 12)
		} else $('#rmap').innerHTML = '<p>Map library did not load.</p>';
		$$('[data-acc]').forEach(b => b.onclick = async () => {
			done(await api('accept', {
				id: b.dataset.acc
			}), 'Added to your route');
			P.route()
		});
		$$('[data-dl]').forEach(b => b.onclick = async () => {
			done(await api('deliver', {
				id: b.dataset.dl
			}), 'Delivered');
			P.route()
		})
	},
	async cart() {
		const t = cart.reduce((s, i) => s + i.qty * i.price, 0);
		$('#cartOut').innerHTML = cart.length ? `<table>${cart.map((i,k)=>`<tr><td>${esc(i.name)}</td><td>Tk ${i.price} x ${i.qty}</td><td><button data-rm="${k}">Remove</button></td></tr>`).join('')}</table>
 ${me?`<div class="card checkout"><h3>Delivery details</h3><input id="cn" placeholder="Full name" value="${esc(me.name)}" aria-label="Full name"><input id="cp" placeholder="Phone (01XXXXXXXXX)" inputmode="tel" aria-label="Phone number"><textarea id="ca" rows="3" placeholder="Full address (house, road, area)" aria-label="Full address"></textarea><small>Delivery area</small><select id="area" aria-label="Delivery area">${areaOpts}</select><p class="cod">Payment method: <b>Cash on Delivery</b></p><div class="bar"><b>Total Tk ${t}</b><button class="pri" id="buy">Proceed to checkout</button></div></div>`:`<div class="bar"><b>Total Tk ${t}</b><button class="pri" id="cartLogin">Log in to checkout</button></div>`}` : '<p>Your cart is empty.</p>';
		$$('[data-rm]').forEach(b => b.onclick = () => {
			cart.splice(b.dataset.rm, 1);
			saveCart();
			P.cart()
		});
		if ($('#cartLogin')) $('#cartLogin').onclick = () => go('auth');
		if ($('#buy')) $('#buy').onclick = async () => {
			if (!$('#cn').value.trim() || !$('#cp').value.trim() || $('#ca').value.trim().length < 10) return toast('Please fill in your name, phone and full address');
			const a = $('#area').value,
				r = await api('order', {
					items: cart,
					area: a,
					lat: AREAS[a][0] + (Math.random() - .5) * .012,
					lng: AREAS[a][1] + (Math.random() - .5) * .012,
					name: $('#cn').value.trim(),
					phone: $('#cp').value.trim(),
					address: $('#ca').value.trim()
				});
			if (r.ok) {
				lastReceipt = {
					id: r.id,
					total: r.total,
					date: new Date().toLocaleString('en-GB'),
					name: $('#cn').value.trim(),
					phone: $('#cp').value.trim(),
					address: $('#ca').value.trim(),
					area: a,
					items: cart.map(i => ({
						name: i.name,
						qty: i.qty,
						price: i.price
					}))
				};
				cart = [];
				saveCart();
				go('receipt')
			} else done(r)
		};
	},
	auth() {
		$('.flip').hidden = !!me;
		$('#profile').hidden = !me;
		if (!me) return;
		$('#pName').textContent = me.name;
		$('#pRole').textContent = me.role == 'user' ? 'Customer' : me.role[0].toUpperCase() + me.role.slice(1);
		const L = [
			['orders', 'My orders'],
			['cart', 'Cart'],
			['doctor', 'Plant doctor'],
			['swap', 'Swap hub']
		];
		if (me.role == 'rider') L.push(['route', 'Green route']);
		if (me.role == 'admin') L.push(['admin', 'Admin dashboard']);
		$('#pLinks').innerHTML = L.map(l => `<button data-go="${l[0]}">${l[1]}</button>`).join('');
		$$('#pLinks [data-go]').forEach(b => b.onclick = () => go(b.dataset.go))
	},
	async admin() {
		const d = await api('admin');
		if (d.error) return $('#adminOut').innerHTML = '<p>Admin access only.</p>';
		const s = d.stats,
			pl = d.profit_loss || [],
			T = window.aTab || 'orders',
			CATS = ['Plants', 'Flowers', 'Seeds', 'Fertilizers', 'Tools'],
			E = d.products.find(p => p.id == window.aEdit);
		const tabs = [
			['orders', 'Orders'],
			['profit', 'Profit & Loss'],
			['products', 'Products'],
			['reviews', 'Reviews'],
			['riders', 'Riders']
		];
		const V = {
			orders: `<div class="grid">${[['Users',s.users],['Orders',s.orders],['Revenue','Tk '+s.revenue],['Swap listings',s.swaps]].map(x=>`<div class="card"><small>${x[0]}</small><h3>${x[1]}</h3></div>`).join('')}</div>
 <h3>Recent orders</h3><table>${d.orders.map(o=>`<tr><td>#${o.id}</td><td>${esc(o.cust_name)}<br><small>${esc(o.phone)}</small></td><td>${esc(o.address)}<br><small>Area: ${esc(o.area)}</small></td><td>Tk ${o.total}</td><td>${o.status}</td><td>${o.rider_id?'Assigned':`<select data-as="${o.id}"><option value="">Assign rider</option>${d.riders.map(r=>`<option value="${r.id}">${esc(r.name)}${r.on_shift==1?' (on shift)':' (off shift)'}</option>`).join('')}</select>`}</td></tr>`).join('')}</table>`,
			profit: `<h3>Monthly Profit & Loss Chart / Report</h3>
 <table><tr><th>Month</th><th>Total Revenue</th><th>Total Cost</th><th>Net Profit / Loss</th></tr>${pl.map(row=>{const p=+row.profit;return `<tr><td><b>${esc(row.month)}</b></td><td>Tk ${row.revenue}</td><td>Tk ${row.cost}</td><td style="color:${p>=0?'#1F4D3A':'#c9457a'}"><b>Tk ${row.profit}</b> ${p>=0?'(Profit)':'(Loss)'}</td></tr>`}).join('')||'<tr><td colspan="4">No delivered orders yet to calculate profit/loss.</td></tr>'}</table>`,
			products: `<h3>Add product</h3><form id="pf" class="bar"><input name="name" placeholder="Name" required><select name="category">${CATS.map(c=>`<option>${c}</option>`).join('')}</select><input name="price" type="number" step="0.01" placeholder="Selling Price" required><input name="cost" type="number" step="0.01" placeholder="Buying Cost" required><input name="stock" type="number" placeholder="Stock" required><input type="file" name="photo" accept="image/jpeg,image/png" aria-label="Product photo"><button class="pri">Add product</button></form>
 ${E?`<h3>Edit: ${esc(E.name)}</h3><form id="ef" class="bar"><input type="hidden" name="id" value="${E.id}"><input name="name" value="${esc(E.name)}" required><select name="category">${CATS.map(c=>`<option${c==E.category?' selected':''}>${c}</option>`).join('')}</select><input name="price" type="number" step="0.01" value="${E.price}" required><input name="stock" type="number" value="${E.stock}" required><input type="file" name="photo" accept="image/jpeg,image/png" aria-label="New photo"><button class="pri">Save changes</button><button type="button" id="ecancel">Cancel</button></form>`:''}
 <h3>All products</h3><table>${d.products.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.category}</td><td>Tk ${p.price}</td><td>Tk ${p.cost||'N/A'}</td><td>${p.stock} left</td><td><button data-ed="${p.id}">Edit</button> <button data-eco="${p.id}">${p.eco==1?'Eco-certified':'Not certified'}</button> <button data-dp="${p.id}">Remove</button></td></tr>`).join('')}</table>`,
			reviews: `<h3>Moderation queue</h3>${d.flagged.map(f=>`<div class="bar">${esc(f.comment)} <button data-dr="${f.id}">Delete review</button></div>`).join('')||'<p>No flagged reviews.</p>'}`,
			riders: `<h3>Make a user a rider</h3><form id="rf" class="bar"><input name="email" type="email" placeholder="user@email.com" required><button>Make rider</button></form>
 <h3>Riders</h3>${d.riders.map(r=>`<p>${esc(r.name)}: ${r.on_shift==1?'on shift':'off shift'}</p>`).join('')||'<p>No riders yet.</p>'}`
		};
		$('#adminOut').innerHTML = `<div class="tabs">${tabs.map(t=>`<button data-at="${t[0]}" class="${t[0]==T?'on':''}">${t[1]}</button>`).join('')}</div>` + V[T];
		$$('[data-at]').forEach(b => b.onclick = () => {
			window.aTab = b.dataset.at;
			P.admin()
		});
		const act = async (a, x, m, raw) => {
			done(await api(a, x, raw), m);
			P.admin()
		};
		$$('[data-as]').forEach(e => e.onchange = () => e.value && act('a_assign', {
			id: e.dataset.as,
			rider: e.value
		}, 'Rider assigned'));
		$$('[data-dp]').forEach(b => b.onclick = () => {
			const p = d.products.find(x => x.id == b.dataset.dp);
			confirm('Remove "' + p.name + '" from the shop?') && act('a_delproduct', {
				id: b.dataset.dp
			}, 'Product removed')
		});
		$$('[data-ed]').forEach(b => b.onclick = () => {
			window.aEdit = b.dataset.ed;
			P.admin()
		});
		if ($('#ef')) {
			$('#ef').onsubmit = async e => {
				e.preventDefault();
				const r = await api('a_product_edit', new FormData(e.target), 1);
				done(r, 'Product updated');
				if (!r.error) window.aEdit = null;
				P.admin()
			};
			$('#ecancel').onclick = () => {
				window.aEdit = null;
				P.admin()
			}
		}
		$$('[data-eco]').forEach(b => b.onclick = () => act('a_eco', {
			id: b.dataset.eco
		}));
		$$('[data-dr]').forEach(b => b.onclick = () => act('a_delreview', {
			id: b.dataset.dr
		}, 'Review deleted'));
		if ($('#pf')) $('#pf').onsubmit = e => {
			e.preventDefault();
			act('a_product', new FormData(e.target), 'Product added', 1)
		};
		if ($('#rf')) $('#rf').onsubmit = e => {
			e.preventDefault();
			act('a_role', form(e.target), 'Role updated')
		}
	}
};
// Green Route: Nearest Neighbor + 2-opt Shortest Path Algorithm
function plan(stops) {
	const len = s => {
		let c = DEPOT,
			t = 0;
		s.forEach(o => {
			t += dist(c, [o.lat, o.lng]);
			c = [o.lat, o.lng]
		});
		return t
	};
	let cur = DEPOT,
		left = [...stops],
		seq = [];
	while (left.length) {
		let bi = 0,
			bd = 1e9;
		left.forEach((s, i) => {
			const x = dist(cur, [s.lat, s.lng]);
			if (x < bd) {
				bd = x;
				bi = i
			}
		});
		cur = [left[bi].lat, left[bi].lng];
		seq.push(left.splice(bi, 1)[0])
	}
	for (let better = true; better;) {
		better = false;
		for (let i = 0; i < seq.length - 1; i++)
			for (let j = i + 1; j < seq.length; j++) {
				const t = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
				if (len(t) < len(seq) - 1e-9) {
					seq = t;
					better = true
				}
			}
	}
	return {
		seq,
		km: len(seq),
		naive: len(stops)
	}
}
async function roadRoute(pts) {
	try {
		const c = new AbortController();
		setTimeout(() => c.abort(), 5000);
		const r = await (await fetch('https://router.project-osrm.org/route/v1/driving/' + pts.map(p => p[1] + ',' + p[0]).join(';') + '?overview=full&geometries=geojson', {
				signal: c.signal
			})).json(),
			x = r.routes && r.routes[0];
		return x ? {
			line: x.geometry.coordinates.map(c => [c[1], c[0]]),
			km: x.distance / 1000,
			min: x.duration / 60
		} : null
	} catch {
		return null
	}
}
function pdf(d) {
	const J = window.jspdf && window.jspdf.jsPDF;
	if (!J) return toast('PDF tool did not load.');
	const p = new J(),
		L = 16;
	let y = 20;
	const t = (s, x = L, z = 11, b = 0) => {
		p.setFontSize(z);
		p.setFont('helvetica', b ? 'bold' : 'normal');
		p.text(String(s), x, y)
	};
	t('BloomVerse', L, 20, 1);
	y += 8;
	t('Order receipt', L, 12);
	y += 12;
	t('Order #' + d.id + '    ' + d.date);
	y += 8;
	t('Name: ' + d.name);
	y += 7;
	t('Phone: ' + d.phone);
	y += 7;
	p.splitTextToSize('Address: ' + d.address, 175).forEach(l => {
		t(l);
		y += 6
	});
	t('Delivery area: ' + d.area);
	y += 12;
	t('Item', L, 11, 1);
	t('Qty', 120, 11, 1);
	t('Price', 140, 11, 1);
	t('Amount', 170, 11, 1);
	y += 7;
	d.items.forEach(i => {
		if (y > 270) {
			p.addPage();
			y = 20
		}
		t(i.name, L);
		t(i.qty, 120);
		t(i.price, 140);
		t(i.qty * i.price, 170);
		y += 6
	});
	y += 6;
	t('Total: Tk ' + d.total, L, 12, 1);
	y += 12;
	t('Payment method: Cash on Delivery', L, 11, 1);
	y += 7;
	t('Please keep Tk ' + d.total + ' ready when the rider arrives.', L);
	p.save('BloomVerse-order-' + d.id + '.pdf')
}
async function scanHist() {
	const b = $('#scanHist');
	if (!me) {
		b.innerHTML = '';
		return
	}
	const h = await api('scans');
	b.innerHTML = Array.isArray(h) && h.length ? `<h3>Recent scans</h3><table><tr><th>Date</th><th>Index</th><th>Result</th></tr>${h.map(x=>`<tr><td>${esc(String(x.created).slice(0,16))}</td><td>${x.health_index}</td><td>${esc(x.issue)}</td></tr>`).join('')}</table>` : ''
}
async function reviews(id) {
	const l = await api('reviews&id=' + id),
		r = $('#rev');
	r.hidden = false;
	r.innerHTML = `<h3>Reviews</h3>${l.map(x=>`<div>${'&#9733;'.repeat(x.rating)} ${esc(x.comment)} <small>by ${esc(x.name)}</small> <button data-fl="${x.id}">Flag</button></div>`).join('')||'<p>No reviews yet.</p>'}
 ${me?`<form class="bar" id="rf2"><select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select><input name="comment" placeholder="Share how it grew" required><button class="pri">Post review</button></form>`:`<p>Log in to write a review. <button class="pri" id="rvLogin">Log in</button></p>`}`;
	if ($('#rvLogin')) $('#rvLogin').onclick = () => go('auth');
	if ($('#rf2')) $('#rf2').onsubmit = async e => {
		e.preventDefault();
		done(await api('review', {
			...form(e.target),
			id
		}), 'Review posted');
		reviews(id)
	};
	$$('[data-fl]').forEach(b => b.onclick = async () => {
		if (!me) return needLogin('flag a review');
		done(await api('flag', {
			id: b.dataset.fl
		}), 'Sent to moderation');
		reviews(id)
	})
}
async function refresh() {
	me = await api('me');
	$('#nAuth').textContent = me ? me.name : 'Log in';
	$('#nRoute').hidden = me?.role != 'rider';
	$('#nAdmin').hidden = me?.role != 'admin';
	$('#nOrders').hidden = !me
}
$$('[data-p]').forEach(b => b.onclick = () => {
	if (b.dataset.p == 'shop') $('#cat').value = '';
	go(b.dataset.p)
});
$$('#tabs button').forEach(b => b.onclick = () => {
	$('#cat').value = b.dataset.c;
	P.shop()
});
$('#go').onclick = P.shop;
$('#loginForm').onsubmit = async e => {
	e.preventDefault();
	const r = await api('login', form(e.target));
	done(r, 'Welcome back');
	await refresh();
	r.error || go('home')
};
$('#regForm').onsubmit = async e => {
	e.preventDefault();
	const r = await api('register', form(e.target));
	done(r, 'Account created. Log in now.');
	r.error || $('.flip-in').classList.remove('flipped')
};
$('#logout').onclick = async () => {
	await api('logout');
	cart = [];
	saveCart();
	await refresh();
	go('home')
};
$('#swapForm').onsubmit = async e => {
	e.preventDefault();
	if (!me) return needLogin('create a listing');
	const r = await api('swap_add', new FormData(e.target), 1);
	done(r, 'Listing created');
	if (!r.error) {
		e.target.reset();
		$('#swapPrev').hidden = true
	}
	P.swap()
};
$('#swapForm [name=photo]').onchange = e => {
	const f = e.target.files[0],
		p = $('#swapPrev');
	p.hidden = !f;
	if (f) p.src = URL.createObjectURL(f)
};
$('#scan').onclick = async () => {
	const f = $('#img').files[0],
		o = $('#scanOut');
	if (!f) return o.innerHTML = '<p>Choose a leaf photo first.</p>';
	if (!me) {
		o.innerHTML = '<p>Please log in to scan a leaf.</p><button class="pri" id="scLogin">Log in</button>';
		$('#scLogin').onclick = () => go('auth');
		return
	}
	o.innerHTML = '<p>Scanning your leaf using image processing & ML heuristics...</p>';
	const d = new FormData();
	d.append('img', f);
	const r = await api('scan', d, 1);
	if (r.error) return o.innerHTML = '<p><b>Could not scan:</b> ' + esc(r.error) + '</p>';
	o.innerHTML = `<div class="card scan"><div class="arch"><img src="${URL.createObjectURL(f)}" alt=""></div><div class="res"><div class="ring" style="background:conic-gradient(var(--bottle) ${r.index}%,var(--moss) 0)"><span>${r.index}</span></div>
 <b>${esc(r.issue)}</b><small>Analysis: green ${r.mix.green}% &middot; yellow ${r.mix.yellow}% &middot; brown/dark ${r.mix.brown}%</small>
 <b>Recommended Solutions</b><ul>${r.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
 <small>Note: For deep machine learning (CNN/PlantVillage dataset), connect a Python TensorFlow/Flask backend.</small></div></div>`;
	scanHist()
};
$('#toSign').onclick = () => $('.flip-in').classList.add('flipped');
$('#toLog').onclick = () => $('.flip-in').classList.remove('flipped');
$$('#auth input[type=password]').forEach(i => {
	i.onfocus = () => $('.plant').classList.add('shy');
	i.onblur = () => $('.plant').classList.remove('shy')
});
$('.auth-stage').onmousemove = e => {
	const r = e.currentTarget.getBoundingClientRect(),
		f = $('.flip').style;
	f.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 14 + 'deg');
	f.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 10 + 'deg')
};
saveCart();
refresh();
go('home');
