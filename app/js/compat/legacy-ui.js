
window.SAHREEJ_SUPABASE_URL = "https://neohwquxzrbqheaierpp.supabase.co";
window.SAHREEJ_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xm3a8wuolDwomUgNk9W1mg_s11ow-k5";
window.sahreejSupabase = null;
try {
  if (window.supabase?.createClient) {
    window.sahreejSupabase = window.supabase.createClient(
      window.SAHREEJ_SUPABASE_URL,
      window.SAHREEJ_SUPABASE_PUBLISHABLE_KEY
    );
  }
} catch (e) {
  console.warn('Sahreej backend init failed', e);
}


/* ---- preserved legacy module boundary ---- */


const Beirut=[33.8938,35.5018]; let address=''; let chosen={size:'',price:0,eta:''}; let maps={};
function toast(t){let e=document.getElementById('toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',1800)}
function resetViewScroll(el){
  if(!el)return;
  const reset=()=>{
    try{el.scrollTop=0;el.scrollLeft=0}catch(_){}
    try{document.scrollingElement&&(document.scrollingElement.scrollTop=0)}catch(_){}
    try{window.scrollTo(0,0)}catch(_){}
  };
  reset();
  requestAnimationFrame(reset);
}
function showTab(id){
  ['home','activity','account'].forEach(x=>document.getElementById(x).style.display=x===id?'block':'none');
  resetViewScroll(document.getElementById(id));
}
function openMenu(){document.getElementById('menuov').classList.add('active')} function closeMenu(){document.getElementById('menuov').classList.remove('active')}
function openScreen(id){
  const el=document.getElementById(id);if(!el)return;
  el.classList.add('active');
  resetViewScroll(el);
}
function closeScreen(id){
  const el=document.getElementById(id);if(!el)return;
  el.classList.remove('active');
  try{el.scrollTop=0;el.scrollLeft=0}catch(_){}
}
function openLocation(){openScreen('locationScreen')} function openAuth(){
  setAuthRole('customer');
  setCustomerAuthMode(localStorage.getItem('sahreejCustomerRegistered')==='1'?'signin':'signup');
  openScreen('auth');
}
function mapBase(id,center=Beirut,zoom=13){if(typeof L==='undefined')return null; if(maps[id]){setTimeout(()=>maps[id].invalidateSize(),50);return maps[id]};let m=L.map(id,{zoomControl:false}).setView(center,zoom);if(window.SahreejCore&&window.SahreejCore.addBaseTiles){window.SahreejCore.addBaseTiles(m)}else{L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:'Tiles &copy; Esri'}).addTo(m)}maps[id]=m;setTimeout(()=>m.invalidateSize(),100);return m}
function initHome(){let m=mapBase('homeMap');if(m){
      L.circleMarker(Beirut,{
        radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1
      }).addTo(m);
    }}
function setLocation(v){address=v;document.getElementById('homeAddress').textContent=v;closeScreen('locationScreen');openSelector()}
function useGPS(homeOnly){if(!navigator.geolocation){toast('Location is not available');return}navigator.geolocation.getCurrentPosition(p=>{let ll=[p.coords.latitude,p.coords.longitude];let m=mapBase('homeMap',ll,15);if(m)m.setView(ll,15);if(homeOnly)return;setLocation('Current location')},()=>toast('Please allow location access'))}
function openMapPicker(){closeScreen('locationScreen');openScreen('mapPicker');setTimeout(()=>mapBase('pickMap',Beirut,15),100)}
function confirmMapLocation(){let m=maps.pickMap,c=m?m.getCenter():null;address=c?`Pinned location · ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`:'Pinned location';document.getElementById('homeAddress').textContent=address;closeScreen('mapPicker');openSelector()}
function openSelector(){if(!address){openLocation();return}document.getElementById('selectAddress').textContent=address;openScreen('selector');setTimeout(()=>{let m=mapBase('selectMap',Beirut,14);if(m){m.eachLayer(l=>{});m.setView(Beirut,14)}},100)}
function pickTanker(el){document.querySelectorAll('.tanker').forEach(x=>x.classList.remove('selected'));el.classList.add('selected');chosen={size:el.dataset.size,price:+el.dataset.price,eta:el.dataset.eta};document.getElementById('chooseBtn').textContent=`Choose ${chosen.size} · $${chosen.price}`}
function openConfirm(){closeScreen('selector');document.getElementById('cSize').textContent=chosen.size;document.getElementById('cPrice').textContent='$'+chosen.price;document.getElementById('cAddress').textContent=address;document.getElementById('requestBtn').textContent=`Request tanker · $${chosen.price}`;openScreen('confirm')}
/* Legacy demo delivery simulator removed in V8.12. Live order state is owned by js/core/customer.js + tracking.js. */
window.addEventListener('load',()=>{initHome();setTimeout(()=>{document.getElementById('splash').classList.add('hide');setTimeout(()=>document.getElementById('splash').remove(),350)},1100)})

let authRole='customer';
function setAuthRole(role){
  authRole=role;
  document.getElementById('roleCustomer').classList.toggle('active',role==='customer');
  document.getElementById('roleDriver').classList.toggle('active',role==='driver');
  document.getElementById('customerAuth').style.display=role==='customer'?'block':'none';
  document.getElementById('otpStep').style.display='none';
  document.getElementById('driverAuth').style.display=role==='driver'?'block':'none';
  if(role==='customer') setCustomerAuthMode(window.customerAuthMode||'signin');
  if(role==='driver') setDriverAuthMode('signin');
}
function sendDemoOtp(){
  const phone=document.getElementById('authPhone').value.trim();
  const normalized=phone.replace(/\s+/g,'');
  if(!/^\d{7,8}$/.test(normalized)){toast('Enter a valid Lebanese mobile number');return;}

  const mode=window.customerAuthMode||'signin';
  const savedPhone=(localStorage.getItem('sahreejCustomerPhone')||'').replace(/\s+/g,'');
  const registered=localStorage.getItem('sahreejCustomerRegistered')==='1';

  if(mode==='signin'){
    if(!registered || normalized!==savedPhone){
      toast('No account found for this number. Choose Sign up.');
      return;
    }
  }else{
    const name=document.getElementById('authName').value.trim();
    if(!name){toast('Enter your name');return;}
    window.pendingCustomerName=name;
  }

  window.pendingCustomerPhone=phone;
  document.getElementById('customerAuth').style.display='none';
  document.getElementById('otpStep').style.display='block';
  document.getElementById('otpCode').value='';
  document.getElementById('otpCopy').textContent=
    mode==='signup'?'Verify your number to create your Sahreej account. Continue to verify your phone number.':
                    'Verify your number to sign in. Continue to verify your phone number.';
}
function verifyDemoOtp(){
  const code=document.getElementById('otpCode').value.trim();
  if(!/^\d{4}$/.test(code)){toast('Enter a 4-digit verification code');return;}

  const mode=window.customerAuthMode||'signin';
  const phone=window.pendingCustomerPhone||document.getElementById('authPhone').value.trim();

  if(mode==='signup'){
    const name=window.pendingCustomerName||document.getElementById('authName').value.trim()||'Customer';
    localStorage.setItem('sahreejCustomerName',name);
    localStorage.setItem('sahreejCustomerPhone',phone);
    localStorage.setItem('sahreejCustomerRegistered','1');
  }

  localStorage.setItem('sahreejCustomerSignedIn','1');
  applySignedInState();
  closeScreen('auth');
  showCustomerTab('account');
  toast(mode==='signup'?'Account created':'Signed in');
}
function applySignedInState(){
  const signed=localStorage.getItem('sahreejCustomerSignedIn')==='1';
  if(signed){
    document.getElementById('accountName').textContent=localStorage.getItem('sahreejCustomerName')||'Bachir';
    document.getElementById('accountSub').textContent='+961 '+(localStorage.getItem('sahreejCustomerPhone')||'');
    document.getElementById('accountAvatar').textContent=(localStorage.getItem('sahreejCustomerName')||'B')[0].toUpperCase();
  }else{
    document.getElementById('accountName').textContent='Guest';
    document.getElementById('accountSub').textContent='Sign in to save your details';
    document.getElementById('accountAvatar').textContent='G';
  }
}
function openDriverOnboarding(){
  closeScreen('auth');
  openScreen('driverOnboarding');
}
function openAccountPanel(type){
  const title=document.getElementById('accountPanelTitle');
  const body=document.getElementById('accountPanelBody');
  const content={
    payments:['Payments',`<div class="card"><strong>Cash on delivery</strong><span class="muted">Default payment method</span></div><button class="secondary" onclick="toast('Card payments can be added when payment gateway is connected')">Add payment method</button>`],
    places:['Saved places',`<div class="card"><div class="row"><div><strong>Home</strong><span class="muted">Achrafieh, Beirut</span></div><b>›</b></div></div><div class="card"><div class="row"><div><strong>Work</strong><span class="muted">Downtown Beirut</span></div><b>›</b></div></div><button class="secondary" onclick="toast('Saved place editor')">Add saved place</button>`],
    help:['Help',`<div class="card"><strong>Order support</strong><span class="muted">Get help with an active or past delivery.</span></div><div class="card"><strong>Account support</strong><span class="muted">Sign-in, payments and account questions.</span></div>`],
    settings:['Settings',`<div class="card"><div class="row"><span>Notifications</span><strong>On</strong></div></div><div class="card"><div class="row"><span>Language</span><strong>English</strong></div></div><div class="card"><div class="row"><span>Privacy</span><b>›</b></div></div>`]
  };
  title.textContent=content[type][0]; body.innerHTML=content[type][1]; openScreen('accountPanel');
}

window.addEventListener("load",applySignedInState);

let driverJobStage=0;
function submitDriverRegistration(){
  const name=document.getElementById('driverName').value.trim();
  const phone=document.getElementById('driverRegPhone').value.trim();
  const plate=document.getElementById('driverPlate').value.trim();
  const capacity=document.getElementById('driverCapacity').value;
  if(!name || !phone || !plate){toast('Complete the required driver details');return;}

  const profile={name,phone,plate,capacity,status:'approved'};
  localStorage.setItem('sahreejDriverProfile',JSON.stringify(profile));
  localStorage.setItem('sahreejDriver','1');
  localStorage.setItem('sahreejRole','driver');

  closeScreen('driverOnboarding');
  enterDriverMode();
  toast('Driver profile created');
}
function toggleDriverOnline(){
  const on=document.getElementById('driverOnlineToggle').checked;
  document.getElementById('driverOnlineTitle').textContent=on?"You're online":"You're offline";
  document.getElementById('driverOnlineSub').textContent=on?"Looking for nearby requests.":"Go online to receive tanker requests.";
  document.getElementById('driverWaiting').style.display=on?'none':'block';
  {const _e=document.getElementById('driverRequest');if(_e)_e.style.display='none';}
  if(on) setTimeout(()=>{ if(document.getElementById('driverOnlineToggle').checked) {const _e=document.getElementById('driverRequest');if(_e)_e.style.display='block';} },900);
}
// V8.13: legacy simulated driver lifecycle removed. Canonical live lifecycle is owned by js/core/driver.js.
function declineDriverDemo(){}
function acceptDriverDemo(){}
function renderDriverJob(){}
function advanceDriverJob(){}
function switchToCustomer(){
  localStorage.setItem('sahreejRole','customer');
  showCustomerTab('home');
}

function getDriverProfile(){
  try{return JSON.parse(localStorage.getItem('sahreejDriverProfile')||'null')}catch(e){return null}
}
function getDriverStats(){
  try{return JSON.parse(localStorage.getItem('sahreejDriverStats')||'null')||{trips:0,today:0,week:0,cash:0,fees:0,net:0,rating:'—',history:[]}}catch(e){
    return {trips:0,today:0,week:0,cash:0,fees:0,net:0,rating:'—',history:[]}
  }
}
function saveDriverStats(stats){localStorage.setItem('sahreejDriverStats',JSON.stringify(stats))}
function enterDriverMode(){
  const profile=getDriverProfile();
  if(!profile){openDriverEntry();return;}
  localStorage.setItem('sahreejRole','driver');
  ['home','activity','account'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  document.getElementById('customerNav').style.display='none';
  document.getElementById('driverNav').style.display='grid';
  document.getElementById('driverDashName').textContent=profile.name||'Driver';
  document.getElementById('driverAccountName').textContent=profile.name||'Driver';
  document.getElementById('driverAccountMeta').textContent=(profile.capacity||'—')+' · Plate '+(profile.plate||'—');
  document.getElementById('driverAvatar').textContent=(profile.name||'D')[0].toUpperCase();
  restoreDriverOperationalState();
  showDriverPage('driverDashboard');
}
function showDriverPage(id){
  const ids=['driverDashboard','driverActivityPage','driverEarningsPage','driverAccountPage'];
  ids.forEach(pid=>{
    const el=document.getElementById(pid);
    if(!el)return;
    const active=pid===id;
    el.classList.toggle('active',active);
    el.style.display=active?'block':'none';
  });
  ['dnavHome','dnavActivity','dnavEarnings','dnavAccount'].forEach(bid=>document.getElementById(bid)?.classList.remove('active'));
  const map={driverDashboard:'dnavHome',driverActivityPage:'dnavActivity',driverEarningsPage:'dnavEarnings',driverAccountPage:'dnavAccount'};
  document.getElementById(map[id])?.classList.add('active');
  if(typeof renderDriverStats==='function')renderDriverStats();
}
function showCustomerTab(id){
  ['driverDashboard','driverActivityPage','driverEarningsPage','driverAccountPage'].forEach(pid=>{
    const el=document.getElementById(pid); if(el){el.style.display='none';el.classList.remove('active');}
  });
  document.getElementById('driverNav').style.display='none';
  document.getElementById('customerNav').style.display='grid';
  ['home','activity','account'].forEach(pid=>{const el=document.getElementById(pid);if(el)el.style.display=pid===id?'block':'none';});
  ['cnavHome','cnavActivity','cnavAccount'].forEach(bid=>document.getElementById(bid)?.classList.remove('active'));
  const map={home:'cnavHome',activity:'cnavActivity',account:'cnavAccount'};
  document.getElementById(map[id])?.classList.add('active');
  resetViewScroll(document.getElementById(id));
  if(id==='activity')renderCustomerActivity();
  if(id==='account')applySignedInState();
}
function renderDriverStats(){
  const st=getDriverStats();
  const profile=getDriverProfile();
  if(profile){
    document.getElementById('driverDashName').textContent=profile.name;
    document.getElementById('driverAccountName').textContent=profile.name;
    document.getElementById('driverAccountMeta').textContent=profile.capacity+' · Plate '+profile.plate;
  }
  document.getElementById('driverWeekEarnings').textContent='$'+st.week.toFixed(2);
  document.getElementById('driverTripCount').textContent=st.trips;
  document.getElementById('driverTodayEarnings').textContent='$'+st.today.toFixed(2);
  document.getElementById('driverRating').textContent=st.rating;
  document.getElementById('driverCashCollected').textContent='$'+st.cash.toFixed(2);
  document.getElementById('driverFeesDue').textContent='$'+st.fees.toFixed(2);
  document.getElementById('driverNetEarnings').textContent='$'+st.net.toFixed(2);

  const list=document.getElementById('driverActivityList');
  if(list){
    if(!st.history.length){
      list.innerHTML='<div class="driver-list-card"><strong>No completed deliveries yet</strong><span class="muted">Your completed and cancelled deliveries will appear here.</span></div>';
    }else{
      list.innerHTML=st.history.slice().reverse().map(h=>`<div class="driver-list-card"><div class="row"><div><strong>${h.size} delivery</strong><span class="muted">${h.location}</span></div><strong>$${h.net.toFixed(2)}</strong></div><div class="row"><span class="status">DELIVERED</span><span class="muted">${h.date}</span></div></div>`).join('');
    }
  }
}
function openDriverAccountPanel(type){
  const profile=getDriverProfile(), st=getDriverStats();
  const content={
    vehicle:['My tanker',`<div class="card"><div class="row"><span>Capacity</span><strong>${profile?.capacity||'—'}</strong></div><div class="row"><span>Plate</span><strong>${profile?.plate||'—'}</strong></div></div>`],
    documents:['Documents','<div class="card"><strong>Driver documents</strong><span class="muted">ID, driving licence and vehicle documents.</span></div>'],
    settlement:['Settlement',`<div class="card"><div class="row"><span>Cash collected</span><strong>$${st.cash.toFixed(2)}</strong></div><div class="row"><span>Sahreej fees due</span><strong>$${st.fees.toFixed(2)}</strong></div><div class="row"><span>Net earnings</span><strong>$${st.net.toFixed(2)}</strong></div></div>`],
    history:['Delivery history',document.getElementById('driverActivityList')?.innerHTML||'']
  };
  document.getElementById('accountPanelTitle').textContent=content[type][0];
  document.getElementById('accountPanelBody').innerHTML=content[type][1];
  openScreen('accountPanel');
}
function driverSignOut(){
  persistDriverState();
  localStorage.removeItem('sahreejDriverSession');
  localStorage.setItem('sahreejRole','customer');
  showCustomerTab('account');
  toast('Signed out');
}
function driverLogin(){
  const profile=getDriverProfile();
  if(!profile){toast('No driver account found. Choose Sign up.');setDriverAuthMode('signup');return;}
  const typed=(document.getElementById('driverPhone')?.value||'').replace(/\s/g,'');
  const saved=(profile.phone||'').replace(/\s/g,'');
  if(!typed){toast('Enter your mobile number');return;}
  if(saved && typed!==saved){toast('No driver account found for this number');return;}
  localStorage.setItem('sahreejDriverSession','1');
  localStorage.setItem('sahreejRole','driver');
  closeScreen('auth');
  enterDriverMode();
}

function restoreAppRole(){
  applySignedInState();
  const role=localStorage.getItem('sahreejRole')||'customer';
  const profile=getDriverProfile();
  if(role==='driver' && profile){
    enterDriverMode();
  }else{
    showCustomerTab('home');
  }
}

window.addEventListener("load",()=>setTimeout(restoreAppRole,50));

/* ===== NAVIGATION + STATE AUDIT LAYER ===== */
function money(n){ return '$'+Number(n||0).toFixed(2).replace(/\.00$/,''); }

function getCustomerOrders(){
  try{return JSON.parse(localStorage.getItem('sahreejCustomerOrders')||'[]')}catch(e){return []}
}
function saveCustomerOrders(v){localStorage.setItem('sahreejCustomerOrders',JSON.stringify(v))}
function getActiveCustomerOrder(){
  try{return JSON.parse(localStorage.getItem('sahreejActiveOrder')||'null')}catch(e){return null}
}
function saveActiveCustomerOrder(v){
  if(v) localStorage.setItem('sahreejActiveOrder',JSON.stringify(v));
  else localStorage.removeItem('sahreejActiveOrder');
}
function getPayment(){
  try{return JSON.parse(localStorage.getItem('sahreejPayment')||'{"code":"CASH","label":"Cash on delivery"}')}catch(e){return {code:'CASH',label:'Cash on delivery'}}
}
function setPayment(code,label){
  localStorage.setItem('sahreejPayment',JSON.stringify({code,label}));
  applyPaymentState();
  closeScreen('accountPanel');
  toast(label+' selected');
}
function applyPaymentState(){
  const p=getPayment();
  const code=document.getElementById('payCode'), label=document.getElementById('payLabel'), cp=document.getElementById('confirmPayment');
  if(code)code.textContent=p.code;if(label)label.textContent=p.label;if(cp)cp.textContent=p.label;
}

function filterLocationOptions(){
  const q=(document.getElementById('locationSearch')?.value||'').toLowerCase();
  document.querySelectorAll('.location-option').forEach(el=>el.style.display=el.innerText.toLowerCase().includes(q)?'flex':'none');
}

function handleCustomerAuthButton(){
  if(localStorage.getItem('sahreejCustomerSignedIn')==='1'){
    openCustomerProfilePanel();
  }else openAuth();
}
function openCustomerProfilePanel(){
  const name=(localStorage.getItem('sahreejCustomerName')||'').trim();
  const phone=localStorage.getItem('sahreejCustomerPhone')||'';
  document.getElementById('accountPanelTitle').textContent='Profile';
  document.getElementById('accountPanelBody').innerHTML=`
    <div class="card">
      <div class="row"><span>Name</span><strong>${name||'Not set'}</strong></div>
      <div class="row"><span>Phone</span><strong>+961 ${phone}</strong></div>
    </div>
    <button class="primary" onclick="editCustomerProfileName()">${name?'Edit name':'Add your name'}</button>
    <button class="secondary" onclick="customerSignOut()">Sign out</button>`;
  openScreen('accountPanel');
}
async function editCustomerProfileName(){
  const current=(localStorage.getItem('sahreejCustomerName')||'').trim();
  const entered=window.prompt('Customer name',current);
  if(entered===null) return;
  const name=entered.trim();
  if(!name){toast('Enter your name');return;}
  const phone=localStorage.getItem('sahreejCustomerPhone')||'';
  try{
    const {error}=await window.sahreejSupabase.rpc('save_my_customer_profile',{
      p_full_name:name,
      p_phone:phone||null
    });
    if(error) throw error;
    localStorage.setItem('sahreejCustomerName',name);
    openCustomerProfilePanel();
    toast('Name updated');
  }catch(err){
    console.error('Customer name update failed',err);
    toast(err?.message||'Could not update name');
  }
}
window.editCustomerProfileName=editCustomerProfileName;
function customerSignOut(){
  localStorage.removeItem('sahreejCustomerSignedIn');
  localStorage.removeItem('sahreejCustomerPhone');
  closeScreen('accountPanel');
  applySignedInState();
  toast('Signed out');
}
const _applySignedInState=applySignedInState;
applySignedInState=function(){
  _applySignedInState();
  const signed=localStorage.getItem('sahreejCustomerSignedIn')==='1';
  const lab=document.getElementById('customerAuthLabel');
  if(lab)lab.textContent=signed?'Profile':'Sign in / Sign up';
};

function openDriverEntry(){
  const profile=getDriverProfile();
  openScreen('auth');
  setAuthRole('driver');
  setDriverAuthMode(profile?'signin':'signup');
  if(profile){
    const input=document.getElementById('driverPhone');
    if(input)input.value=profile.phone||'';
    const hint=document.getElementById('driverLoginHint');
    if(hint)hint.textContent='Registered driver: +961 '+(profile.phone||'');
  }
}
const _driverLogin=driverLogin;
driverLogin=function(){
  const profile=getDriverProfile();
  if(!profile){closeScreen('auth');openDriverOnboarding();return;}
  const typed=(document.getElementById('driverPhone')?.value||'').replace(/\s/g,'');
  const saved=(profile.phone||'').replace(/\s/g,'');
  if(typed && saved && typed!==saved){toast('This number is not registered as a driver');return;}
  localStorage.setItem('sahreejDriverSession','1');
  _driverLogin();
};

function renderCustomerActivity(){
  const active=getActiveCustomerOrder();
  const area=document.getElementById('activeOrderArea');
  if(area){
    area.innerHTML=active?`<div class="card active-order">
      <span class="status">${active.stageLabel||'DRIVER ASSIGNED'}</span>
      <div class="row" style="margin-top:10px"><div><strong>${active.size} tanker</strong><span class="muted">${active.address}</span></div><strong>${money(active.price)}</strong></div>
      <div class="mini-actions"><button class="primary" onclick="resumeTracking()">Track order</button></div>
    </div>`:'';
  }
  const list=document.getElementById('activityList');
  const orders=getCustomerOrders().slice().reverse();
  if(list){
    list.innerHTML=orders.length?orders.map((o,i)=>`<div class="card">
      <div class="row"><div><strong>${o.size} tanker</strong><span class="muted">${o.address}</span></div><strong>${money(o.price)}</strong></div>
      <div class="row" style="margin-top:10px"><span class="status">${o.status||'DELIVERED'}</span><span class="muted">${o.date||''}</span></div>
      <div class="mini-actions"><button class="secondary" onclick="reorderCustomer(${orders.length-1-i})">Reorder</button></div>
    </div>`).join(''):'<div class="card"><strong>No orders yet</strong><span class="muted">Your deliveries will appear here.</span></div>';
  }
}
function reorderCustomer(index){
  const orders=getCustomerOrders(); const o=orders[index]; if(!o)return;
  address=o.address; chosen={size:o.size,price:o.price,eta:o.eta||''};
  document.getElementById('homeAddress').textContent=address;
  showCustomerTab('home'); openSelector();
  document.querySelectorAll('.tanker').forEach(el=>{
    const yes=el.dataset.size===chosen.size;el.classList.toggle('selected',yes);
    if(yes) document.getElementById('chooseBtn').textContent=`Choose ${chosen.size} · $${chosen.price}`;
  });
}
const _showTab=showTab;
showTab=function(id){
  _showTab(id);
  if(id==='activity')renderCustomerActivity();
  if(id==='account')applySignedInState();
};

const _openConfirm=openConfirm;
openConfirm=function(){
  _openConfirm();
  applyPaymentState();
};

const _requestTanker=requestTanker;
requestTanker=function(){
  const order={id:Date.now(),size:chosen.size,price:chosen.price,eta:chosen.eta,address,payment:getPayment().label,stage:0,stageLabel:'DRIVER ASSIGNED'};
  saveActiveCustomerOrder(order);
  _requestTanker();
  renderCustomerActivity();
};
function syncActiveCustomerStage(){
  const o=getActiveCustomerOrder();if(!o)return;
  o.stage=deliveryStage;
  o.stageLabel=deliveryStage===0?'DRIVER ASSIGNED':deliveryStage===1?'DRIVER ARRIVED':'DELIVERING';
  saveActiveCustomerOrder(o);renderCustomerActivity();
}
const _advanceDeliveryDemo=advanceDeliveryDemo;
advanceDeliveryDemo=function(){
  _advanceDeliveryDemo();
  if(getActiveCustomerOrder())syncActiveCustomerStage();
};
function resumeTracking(){
  const o=getActiveCustomerOrder();if(!o)return;
  address=o.address;chosen={size:o.size,price:o.price,eta:o.eta};deliveryStage=o.stage||0;
  document.getElementById('trackSize').textContent=o.size;
  document.getElementById('trackPrice').textContent=money(o.price);
  document.getElementById('trackAddress').textContent=o.address;
  openScreen('tracking');renderDeliveryStage();
  setTimeout(()=>mapBase('trackMap',Beirut,14),100);
}
const _completeDemo=completeDemo;
completeDemo=function(){
  const o=getActiveCustomerOrder()||{size:chosen.size,price:chosen.price,address};
  const history=getCustomerOrders();
  history.push({...o,status:'DELIVERED',date:new Date().toLocaleDateString()});
  saveCustomerOrders(history);saveActiveCustomerOrder(null);
  _completeDemo();renderCustomerActivity();
};

const _openAccountPanel=openAccountPanel;
openAccountPanel=function(type){
  if(type==='payments'){
    const p=getPayment();
    document.getElementById('accountPanelTitle').textContent='Payments';
    document.getElementById('accountPanelBody').innerHTML=`
      <button class="payment-choice selected" onclick="setPayment('CASH','Cash on delivery')"><span><strong>Cash</strong><span class="muted">Pay the driver at delivery</span></span><b>✓</b></button>`;
    openScreen('accountPanel');return;
  }
  if(type==='places'){
    const home=localStorage.getItem('sahreejHome')||'Achrafieh, Beirut';
    const work=localStorage.getItem('sahreejWork')||'Downtown Beirut';
    document.getElementById('accountPanelTitle').textContent='Saved places';
    document.getElementById('accountPanelBody').innerHTML=`
      <div class="card"><div class="row"><div><strong>Home</strong><span class="muted">${home}</span></div><button class="chip" onclick="savePlace('home')">Edit</button></div></div>
      <div class="card"><div class="row"><div><strong>Work</strong><span class="muted">${work}</span></div><button class="chip" onclick="savePlace('work')">Edit</button></div></div>`;
    openScreen('accountPanel');return;
  }
  _openAccountPanel(type);
};
function savePlace(type){
  const current=type==='home'?(localStorage.getItem('sahreejHome')||'Achrafieh, Beirut'):(localStorage.getItem('sahreejWork')||'Downtown Beirut');
  const next=prompt('Enter '+type+' location',current);
  if(!next)return;
  localStorage.setItem(type==='home'?'sahreejHome':'sahreejWork',next);
  openAccountPanel('places');toast(type[0].toUpperCase()+type.slice(1)+' saved');
}

function persistDriverState(){
  localStorage.setItem('sahreejDriverOnline',document.getElementById('driverOnlineToggle')?.checked?'1':'0');
  localStorage.setItem('sahreejDriverJobStage',String(driverJobStage));
  localStorage.setItem('sahreejDriverJobActive',document.getElementById('driverActive')?.style.display==='block'?'1':'0');
}
const _toggleDriverOnline=toggleDriverOnline;
toggleDriverOnline=function(){_toggleDriverOnline();persistDriverState();};
const _acceptDriverDemo=acceptDriverDemo;
acceptDriverDemo=function(){_acceptDriverDemo();persistDriverState();renderDriverStats();};
const _declineDriverDemo=declineDriverDemo;
declineDriverDemo=function(){_declineDriverDemo();persistDriverState();};
const _advanceDriverJob=advanceDriverJob;
advanceDriverJob=function(){_advanceDriverJob();persistDriverState();renderDriverStats();};

const _renderDriverStats=renderDriverStats;
renderDriverStats=function(){
  _renderDriverStats();
  const st=getDriverStats();
  const a=document.getElementById('driverHomeToday'),b=document.getElementById('driverHomeTrips'),c=document.getElementById('driverHomeRating');
  if(a)a.textContent=money(st.today);if(b)b.textContent=st.trips;if(c)c.textContent=st.rating;
  const active=document.getElementById('driverActiveJobCard');
  if(active)active.style.display=localStorage.getItem('sahreejDriverJobActive')==='1'?'block':'none';
};

function restoreDriverOperationalState(){
  const online=localStorage.getItem('sahreejDriverOnline')==='1';
  const toggle=document.getElementById('driverOnlineToggle');
  if(toggle){toggle.checked=online;
    document.getElementById('driverOnlineTitle').textContent=online?"You're online":"You're offline";
    document.getElementById('driverOnlineSub').textContent=online?"Looking for nearby requests.":"Go online to receive tanker requests.";
  }
  const active=localStorage.getItem('sahreejDriverJobActive')==='1';
  driverJobStage=Number(localStorage.getItem('sahreejDriverJobStage')||0);
  if(active){
    document.getElementById('driverWaiting').style.display='none';
    {const _e=document.getElementById('driverRequest');if(_e)_e.style.display='none';}
    {const _e=document.getElementById('driverActive');if(_e)_e.style.display='block';}
    renderDriverJob();
  }else{
    {const _e=document.getElementById('driverActive');if(_e)_e.style.display='none';}
    document.getElementById('driverWaiting').style.display=online?'none':'block';
    if(online){const _e=document.getElementById('driverRequest');if(_e)_e.style.display='block';}
    const wh=document.querySelector('#driverWaiting h2');
    const wm=document.querySelector('#driverWaiting .muted');
    if(wh)wh.textContent=online?'Looking for requests':'Ready when you are';
    if(wm)wm.textContent=online?'Nearby customer requests will appear here.':'Go online and nearby customer requests will appear here.';
  }
  renderDriverStats();
}
const _enterDriverMode=enterDriverMode;
enterDriverMode=function(){_enterDriverMode();restoreDriverOperationalState();};

const _switchToCustomer=switchToCustomer;
switchToCustomer=function(){persistDriverState();_switchToCustomer();};

const _driverSignOut=driverSignOut;
driverSignOut=function(){persistDriverState();_driverSignOut();};

const _restoreAppRole=restoreAppRole;
restoreAppRole=function(){
  _restoreAppRole();
  applyPaymentState();
  renderCustomerActivity();
  const profile=getDriverProfile();
  const hint=document.getElementById('driverLoginHint');
  if(hint&&profile)hint.textContent='Registered driver: +961 '+profile.phone;
};


window.customerAuthMode='signin';
function setCustomerAuthMode(mode){
  window.customerAuthMode=mode;
  const signup=mode==='signup';
  document.getElementById('customerSignInTab')?.classList.toggle('active',!signup);
  document.getElementById('customerSignUpTab')?.classList.toggle('active',signup);
  document.getElementById('customerNameWrap').style.display=signup?'block':'none';
  document.getElementById('customerAuthTitle').textContent=signup?'Create your account':'Welcome back';
  document.getElementById('customerAuthCopy').textContent=signup
    ?'Create a Sahreej customer account with your name and mobile number.'
    :'Enter the mobile number used for your Sahreej account.';
  document.getElementById('customerAuthContinue').textContent=signup?'Create account':'Sign in';
  document.getElementById('customerAuth').style.display='block';
  document.getElementById('otpStep').style.display='none';
}


window.driverAuthMode='signin';
function setDriverAuthMode(mode){
  window.driverAuthMode=mode;
  const signup=mode==='signup';
  document.getElementById('driverSignInTab')?.classList.toggle('active',!signup);
  document.getElementById('driverSignUpTab')?.classList.toggle('active',signup);
  document.getElementById('driverSignInPane').style.display=signup?'none':'block';
  document.getElementById('driverSignUpPane').style.display=signup?'block':'none';
}



/* ===== SAHREEJ V1 FINAL FLOW OVERRIDES ===== */

customerSignOut=function(){
  // Sign out only clears the session. The registered account remains available for Sign in.
  localStorage.removeItem('sahreejCustomerSignedIn');
  closeScreen('accountPanel');
  applySignedInState();
  showCustomerTab('account');
  toast('Signed out');
};

driverLogin=function(){
  const profile=getDriverProfile();
  if(!profile){
    toast('No driver account found. Choose Sign up.');
    setDriverAuthMode('signup');
    return;
  }
  const typed=(document.getElementById('driverPhone')?.value||'').replace(/\s/g,'');
  const saved=(profile.phone||'').replace(/\s/g,'');
  if(!typed){toast('Enter your mobile number');return;}
  if(saved && typed!==saved){toast('No driver account found for this number');return;}
  localStorage.setItem('sahreejDriverSession','1');
  localStorage.setItem('sahreejRole','driver');
  closeScreen('auth');
  enterDriverMode();
};

driverSignOut=function(){
  persistDriverState();
  localStorage.removeItem('sahreejDriverSession');
  localStorage.setItem('sahreejRole','customer');
  showCustomerTab('account');
  toast('Signed out');
};

// V8.13: obsolete local driver job simulator removed.
advanceDriverJob=function(){};


completeDemo=function(){};
advanceDeliveryDemo=function(){};


restoreAppRole=function(){
  applySignedInState();
  applyPaymentState();
  renderCustomerActivity();

  const role=localStorage.getItem('sahreejRole')||'customer';
  const profile=getDriverProfile();

  if(role==='driver' && profile){
    enterDriverMode();
    return;
  }

  showCustomerTab('home');

  // If the app is reopened while a customer delivery is active, restore tracking.
  if(getActiveCustomerOrder()){
    setTimeout(()=>resumeTracking(),120);
  }
};

// One iPhone/Safari-safe driver navigation listener.
document.addEventListener('DOMContentLoaded',()=>{
  const links={
    dnavHome:'driverDashboard',
    dnavActivity:'driverActivityPage',
    dnavEarnings:'driverEarningsPage',
    dnavAccount:'driverAccountPage'
  };
  Object.entries(links).forEach(([buttonId,pageId])=>{
    const button=document.getElementById(buttonId);
    if(!button)return;
    button.addEventListener('touchend',event=>{
      event.preventDefault();
      showDriverPage(pageId);
    },{passive:false});
  });
});


/* ===== SAHREEJ V1.1 PUBLISH-READINESS OVERRIDES ===== */
window.sahreejPendingAction = null;

function isCustomerSignedIn(){
  return localStorage.getItem('sahreejCustomerSignedIn')==='1';
}

function updateOrderAuthNotice(){
  const notice=document.getElementById('orderAuthNotice');
  const btn=document.getElementById('requestBtn');
  if(!notice||!btn)return;
  const signed=isCustomerSignedIn();
  notice.style.display=signed?'none':'block';
  btn.textContent=signed
    ?`Request tanker · $${chosen.price}`
    :`Sign in to order · $${chosen.price}`;
}

const _v11OpenConfirm=openConfirm;
openConfirm=function(){
  _v11OpenConfirm();
  updateOrderAuthNotice();
};

const _v11RequestTanker=requestTanker;
requestTanker=function(){
  if(!isCustomerSignedIn()){
    window.sahreejPendingAction='confirmOrder';
    closeScreen('confirm');
    openAuth();
    toast('Sign in or create an account to place your order');
    return;
  }
  window.sahreejPendingAction=null;
  _v11RequestTanker();
};

// Wrap OTP verification so ordering resumes at the confirmation screen after authentication.
const _v11VerifyDemoOtp=verifyDemoOtp;
verifyDemoOtp=function(){
  const before=isCustomerSignedIn();
  _v11VerifyDemoOtp();
  if(!before && isCustomerSignedIn() && window.sahreejPendingAction==='confirmOrder'){
    window.sahreejPendingAction=null;
    setTimeout(()=>{
      showCustomerTab('home');
      openConfirm();
      toast('Signed in. Review and place your order.');
    },80);
  }
};

function getDriverDocumentNames(){
  const ids=['driverDocId','driverDocLicense','driverDocVehicle','driverDocInsurance'];
  const names={};
  ids.forEach(id=>{
    const input=document.getElementById(id);
    names[id]=input?.files?.[0]?.name||'';
  });
  return names;
}

function updateDriverDocStatus(){
  const docs=getDriverDocumentNames();
  const count=Object.values(docs).filter(Boolean).length;
  const el=document.getElementById('driverDocStatus');
  if(el) el.textContent=`${count} of 4 documents selected`;
}

submitDriverRegistration=function(){
  const name=document.getElementById('driverName').value.trim();
  const phone=document.getElementById('driverRegPhone').value.trim();
  const plate=document.getElementById('driverPlate').value.trim();
  const capacity=document.getElementById('driverCapacity').value;
  if(!name || !phone || !plate){toast('Complete the required driver details');return;}

  const docs=getDriverDocumentNames();
  const missing=Object.values(docs).some(v=>!v);
  if(missing){
    toast('Upload all 4 required driver documents');
    return;
  }

  const profile={
    name,phone,plate,capacity,
    status:'approved',
    documents:{
      identity:docs.driverDocId,
      drivingLicence:docs.driverDocLicense,
      vehicleRegistration:docs.driverDocVehicle,
      insurance:docs.driverDocInsurance
    }
  };
  localStorage.setItem('sahreejDriverProfile',JSON.stringify(profile));
  localStorage.setItem('sahreejDriver','1');
  localStorage.setItem('sahreejDriverSession','1');
  localStorage.setItem('sahreejRole','driver');
  closeScreen('driverOnboarding');
  enterDriverMode();
  toast('Driver profile created');
};

// Show uploaded document names in Driver Account.
const _v11OpenDriverAccountPanel=openDriverAccountPanel;
openDriverAccountPanel=function(type){
  if(type==='documents'){
    const profile=getDriverProfile()||{};
    const d=profile.documents||{};
    document.getElementById('accountPanelTitle').textContent='Driver documents';
    document.getElementById('accountPanelBody').innerHTML=`
      <div class="card"><strong>National ID / Passport</strong><span class="muted">${d.identity||'Not uploaded'}</span></div>
      <div class="card"><strong>Driving licence</strong><span class="muted">${d.drivingLicence||'Not uploaded'}</span></div>
      <div class="card"><strong>Vehicle registration</strong><span class="muted">${d.vehicleRegistration||'Not uploaded'}</span></div>
      <div class="card"><strong>Vehicle insurance</strong><span class="muted">${d.insurance||'Not uploaded'}</span></div>
      <span class="muted">Production will support replacing files and admin approval.</span>`;
    openScreen('accountPanel');
    return;
  }
  _v11OpenDriverAccountPanel(type);
};


/* ===== SAHREEJ V1.2 MVP COMPLETENESS ===== */

function requireCustomerSignInForOrder(){
  const signed=localStorage.getItem('sahreejCustomerSignedIn')==='1';
  if(signed) return true;
  localStorage.setItem('sahreejPostAuthAction','continueOrder');
  setAuthRole('customer');
  setCustomerAuthMode(localStorage.getItem('sahreejCustomerRegistered')==='1'?'signin':'signup');
  openScreen('auth');
  toast('Sign in to place your order');
  return false;
}

const _v12_requestTanker=requestTanker;
requestTanker=function(){
  if(!requireCustomerSignInForOrder()) return;
  _v12_requestTanker();
};

function continuePostAuthAction(){
  const a=localStorage.getItem('sahreejPostAuthAction');
  if(a==='continueOrder'){
    localStorage.removeItem('sahreejPostAuthAction');
    closeScreen('auth');
    openConfirm();
  }
}

if(typeof verifyDemoOtp==='function'){
  const _v12_verifyDemoOtp=verifyDemoOtp;
  verifyDemoOtp=function(){
    _v12_verifyDemoOtp();
    setTimeout(()=>{
      if(localStorage.getItem('sahreejCustomerSignedIn')==='1') continuePostAuthAction();
    },0);
  };
}

function cancelCustomerOrder(){
  const o=getActiveCustomerOrder();
  if(!o){toast('No active order');return;}
  if(deliveryStage>=2){
    toast('This delivery is already in progress');
    return;
  }
  const ok=confirm('Cancel this tanker order?');
  if(!ok)return;
  const history=getCustomerOrders();
  history.push({...o,status:'CANCELLED',date:new Date().toLocaleDateString()});
  saveCustomerOrders(history);
  saveActiveCustomerOrder(null);
  closeScreen('tracking');
  renderCustomerActivity();
  showCustomerTab('activity');
  toast('Order cancelled');
}

function openCustomerSupport(){
  if(typeof window.sahreejCreateSupportCase==='function'){
    window.sahreejCreateSupportCase('customer',window.sahreejActiveServerOrderId||localStorage.getItem('sahreejActiveServerOrderId'));
    return;
  }
  document.getElementById('accountPanelTitle').textContent='Help & support';
  document.getElementById('accountPanelBody').innerHTML='<div class="card"><strong>Support</strong><span class="muted">Support is loading. Please try again.</span></div>';
  openScreen('accountPanel');
}

const _v12_openAccountPanel=openAccountPanel;
openAccountPanel=function(type){
  if(type==='support'){openCustomerSupport();return;}
  _v12_openAccountPanel(type);
};

function openDriverSupport(){
  if(typeof window.sahreejCreateSupportCase==='function'){
    window.sahreejCreateSupportCase('driver',localStorage.getItem('sahreejDriverActiveServerOrderId')||null);
    return;
  }
  document.getElementById('accountPanelTitle').textContent='Driver support';
  document.getElementById('accountPanelBody').innerHTML='<div class="card"><strong>Support</strong><span class="muted">Support is loading. Please try again.</span></div>';
  openScreen('accountPanel');
}

submitDriverRegistration=function(){
  const name=document.getElementById('driverName').value.trim();
  const phone=document.getElementById('driverRegPhone').value.trim();
  const plate=document.getElementById('driverPlate').value.trim();
  const capacity=document.getElementById('driverCapacity').value;
  const docs=[
    document.getElementById('driverDocId')?.files?.[0],
    document.getElementById('driverDocLicense')?.files?.[0],
    document.getElementById('driverDocVehicle')?.files?.[0],
    document.getElementById('driverDocInsurance')?.files?.[0]
  ];
  if(!name || !phone || !plate){
    toast('Complete the required driver details');
    return;
  }
  if(docs.some(x=>!x)){
    toast('Upload all required driver documents');
    return;
  }
  const profile={
    name,phone,plate,capacity,
    status:'pending',
    documents:{
      id:docs[0].name,
      license:docs[1].name,
      registration:docs[2].name,
      insurance:docs[3].name
    }
  };
  localStorage.setItem('sahreejDriverProfile',JSON.stringify(profile));
  localStorage.setItem('sahreejDriver','1');
  localStorage.setItem('sahreejDriverSession','1');
  localStorage.setItem('sahreejRole','driver');

  const st=document.getElementById('driverRegistrationStatus');
  if(st)st.textContent='Documents submitted · Pending approval';

  closeScreen('driverOnboarding');
  enterDriverMode();
  toast('Registration submitted for approval');
};

function driverCanGoOnline(){
  const p=getDriverProfile();
  return !!p && p.status==='approved';
}

const _v12_toggleDriverOnline=toggleDriverOnline;
toggleDriverOnline=function(){
  const toggle=document.getElementById('driverOnlineToggle');
  if(toggle?.checked && !driverCanGoOnline()){
    toggle.checked=false;
    const p=getDriverProfile();
    if(p && p.status==='pending'){
      toast('Driver approval is pending');
    }else{
      toast('Driver profile is not approved');
    }
    return;
  }
  _v12_toggleDriverOnline();
  persistDriverState();
};

const _v12_enterDriverMode=enterDriverMode;
enterDriverMode=function(){
  _v12_enterDriverMode();
  const p=getDriverProfile();
  if(!p)return;
  const meta=document.getElementById('driverAccountMeta');
  if(meta) meta.textContent=(p.capacity||'—')+' · Plate '+(p.plate||'—')+' · '+(p.status==='approved'?'Approved':'Pending approval');
  const onlineToggle=document.getElementById('driverOnlineToggle');
  if(onlineToggle && p.status!=='approved'){
    onlineToggle.checked=false;
    onlineToggle.disabled=true;
    document.getElementById('driverOnlineTitle').textContent='Approval pending';
    document.getElementById('driverOnlineSub').textContent='You can go online after Sahreej approves your driver documents.';
  } else if(onlineToggle) {
    onlineToggle.disabled=false;
  }
};

// Prototype self-approval removed. Driver approval is server/admin-only.
const _v12_renderDriverStats=renderDriverStats;
renderDriverStats=function(){
  _v12_renderDriverStats();
  document.getElementById('driverApprovalPrototype')?.remove();
};

/* ===== SAHREEJ V1.3 LIVE SUPABASE CONNECTION ===== */
window.sahreejBackendStatus = 'connecting';

async function sahreejLoadLivePricing(){
  if(!window.sahreejSupabase){
    window.sahreejBackendStatus='offline';
    return false;
  }
  try{
    const {data,error}=await window.sahreejSupabase
      .from('pricing')
      .select('tanker_capacity_l,customer_price_usd,platform_fee_pct,active')
      .eq('active',true)
      .order('tanker_capacity_l',{ascending:true});
    if(error) throw error;
    if(!Array.isArray(data) || !data.length) throw new Error('No live pricing rows');

    const byCapacity={};
    data.forEach(row=>byCapacity[Number(row.tanker_capacity_l)]=row);

    document.querySelectorAll('.tanker').forEach(card=>{
      const raw=(card.dataset.size||'').replace(/[^0-9]/g,'');
      const capacity=Number(raw);
      const row=byCapacity[capacity];
      if(!row)return;
      const price=Number(row.customer_price_usd);
      card.dataset.price=String(price);
      const priceEl=card.querySelector('.price');
      if(priceEl){
        const small=priceEl.querySelector('small');
        priceEl.childNodes.forEach(n=>{
          if(n.nodeType===Node.TEXT_NODE)n.remove();
        });
        priceEl.insertBefore(document.createTextNode('$'+price+' '),small||null);
      }
    });

    // Keep the currently selected tanker's price in sync with backend.
    const selected=document.querySelector('.tanker.selected');
    if(selected && typeof pickTanker==='function') pickTanker(selected);

    window.sahreejBackendStatus='online';
    localStorage.setItem('sahreejBackendLastConnectedAt',new Date().toISOString());
    return true;
  }catch(err){
    console.warn('Live Sahreej pricing unavailable',err);
    window.sahreejBackendStatus='offline';
    return false;
  }
}

async function sahreejBackendHealth(){
  if(!window.sahreejSupabase)return {online:false,message:'Backend client unavailable'};
  try{
    const {data,error}=await window.sahreejSupabase
      .from('pricing').select('tanker_capacity_l').limit(1);
    if(error)throw error;
    return {online:true,message:'Connected to Sahreej backend'};
  }catch(e){
    return {online:false,message:e.message||'Backend unavailable'};
  }
}

// This will become the production order call once real user authentication is enabled.
async function sahreejCreateServerOrder(order){
  if(!window.sahreejSupabase)throw new Error('Backend unavailable');
  const {data:{session}}=await window.sahreejSupabase.auth.getSession();
  if(!session)throw new Error('Real Supabase authentication is not enabled yet');

  const {data,error}=await window.sahreejSupabase.rpc('create_order',{
    p_capacity:Number(String(order.size||'').replace(/[^0-9]/g,'')),
    p_payment_method:order.paymentMethod||'cash',
    p_delivery_address:order.location||'Delivery location',
    p_lat:order.latitude??null,
    p_lng:order.longitude??null
  });
  if(error)throw error;
  return data;
}

async function sahreejCancelServerOrder(orderId,reason=''){
  if(!window.sahreejSupabase)throw new Error('Backend unavailable');
  const {data,error}=await window.sahreejSupabase.rpc('cancel_my_order',{
    p_order_id:orderId,
    p_reason:reason
  });
  if(error)throw error;
  return data;
}

// Connect immediately. The prototype keeps its local fallback until real OTP is configured.
window.addEventListener('load',()=>{
  sahreejLoadLivePricing();
});


/* ===== SAHREEJ V1.4 FREE REAL MAPS + ROUTING =====
   Prototype services:
   - CARTO/OSM tiles already used by the app
   - Nominatim (OpenStreetMap) for Lebanon address search/reverse geocoding
   - OSRM public router for road routes, distance and ETA
   These public endpoints are for development/testing; production should use
   a dedicated/self-hosted service or a provider with an SLA.
*/
window.sahreejDeliveryCoords = window.sahreejDeliveryCoords || null;
window.sahreejSearchTimer = null;
window.sahreejSearchAbort = null;
window.sahreejRouteLayer = null;
window.sahreejDriverMarker = null;
window.sahreejCustomerMarker = null;

function sahreejShortAddress(item){
  const a=item.address||{};
  const main=a.road||a.neighbourhood||a.suburb||a.village||a.town||a.city||a.municipality||item.name||'Selected location';
  const area=a.city||a.town||a.village||a.municipality||a.state_district||'Lebanon';
  return main===area ? `${main}, Lebanon` : `${main}, ${area}`;
}

async function sahreejSearchLocations(q){
  const box=document.getElementById('liveLocationResults');
  q=(q||'').trim();
  clearTimeout(window.sahreejSearchTimer);
  if(window.sahreejSearchAbort){try{window.sahreejSearchAbort.abort()}catch(e){}}
  if(q.length<3){ if(box){box.style.display='none';box.innerHTML=''} return; }

  if(box){box.style.display='block';box.innerHTML='<div class="live-location-state">Searching Lebanon…</div>'}

  window.sahreejSearchTimer=setTimeout(async()=>{
    try{
      window.sahreejSearchAbort=new AbortController();
      const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=lb&limit=5&q='+encodeURIComponent(q);
      const res=await fetch(url,{signal:window.sahreejSearchAbort.signal,headers:{'Accept':'application/json','Accept-Language':'en'}});
      if(!res.ok) throw new Error('Search unavailable');
      const items=await res.json();
      if(!box)return;
      if(!items.length){
        box.innerHTML='<div class="live-location-state">No matching location found in Lebanon.</div>';
        return;
      }
      box.innerHTML=items.map((item,i)=>{
        const short=sahreejShortAddress(item);
        const detail=(item.display_name||short).replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const payload=encodeURIComponent(JSON.stringify({lat:+item.lat,lng:+item.lon,label:short,detail:item.display_name||short}));
        return `<button class="live-location-result" onclick="sahreejChooseSearchResult('${payload}')">
          <span class="locpin">📍</span><span><strong>${short.replace(/</g,'&lt;')}</strong><small>${detail}</small></span>
        </button>`;
      }).join('');
    }catch(err){
      if(err.name==='AbortError')return;
      if(box) box.innerHTML='<div class="live-location-state">Address search is temporarily unavailable. You can still choose on map.</div>';
    }
  },700);
}

function sahreejChooseSearchResult(encoded){
  const item=JSON.parse(decodeURIComponent(encoded));
  window.sahreejDeliveryCoords=[item.lat,item.lng];
  const input=document.getElementById('locationSearch');
  const box=document.getElementById('liveLocationResults');
  if(input)input.value=item.label;
  if(box){box.style.display='none';box.innerHTML=''}
  setLocation(item.label);
}

async function sahreejReverseGeocode(lat,lng){
  try{
    const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const res=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'en'}});
    if(!res.ok) throw new Error();
    const item=await res.json();
    return sahreejShortAddress(item);
  }catch(e){
    return `Pinned location · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// Override the old GPS behavior so the precise coordinate is retained and named.
useGPS=function(homeOnly){
  if(!navigator.geolocation){toast('Location is not available on this device');return}
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(async p=>{
    const lat=p.coords.latitude,lng=p.coords.longitude,ll=[lat,lng];
    window.sahreejDeliveryCoords=ll;
    const home=mapBase('homeMap',ll,16);
    if(home)home.setView(ll,16);
    if(homeOnly){toast('Location updated');return}
    const label=await sahreejReverseGeocode(lat,lng);
    setLocation(label);
  },err=>{
    toast(err && err.code===1 ? 'Location permission was denied' : 'Could not get your location');
  },{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
};

// Override map picker: open at current selected coordinate when available.
openMapPicker=function(){
  closeScreen('locationScreen');
  openScreen('mapPicker');
  setTimeout(()=>{
    const center=window.sahreejDeliveryCoords||Beirut;
    const m=mapBase('pickMap',center,16);
    if(m){m.setView(center,16);m.invalidateSize()}
  },100);
};

confirmMapLocation=async function(){
  const m=maps.pickMap,c=m?m.getCenter():null;
  if(!c){toast('Map is not ready');return}
  window.sahreejDeliveryCoords=[c.lat,c.lng];
  const btn=document.querySelector('#mapPicker .map-confirm .primary');
  const prior=btn?btn.textContent:'Confirm this location';
  if(btn){btn.disabled=true;btn.textContent='Finding address…'}
  const label=await sahreejReverseGeocode(c.lat,c.lng);
  address=label;
  document.getElementById('homeAddress').textContent=label;
  if(btn){btn.disabled=false;btn.textContent=prior}
  closeScreen('mapPicker');
  openSelector();
};

// Make selector center on the real delivery point and show it.
openSelector=function(){
  if(!address){openLocation();return}
  document.getElementById('selectAddress').textContent=address;
  openScreen('selector');
  setTimeout(()=>{
    const center=window.sahreejDeliveryCoords||Beirut;
    const m=mapBase('selectMap',center,16);
    if(!m)return;
    m.setView(center,16);
    if(window.sahreejSelectorMarker){try{m.removeLayer(window.sahreejSelectorMarker)}catch(e){}}
    window.sahreejSelectorMarker=L.circleMarker(center,{radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1})
      .addTo(m).bindPopup('Delivery location');
  },100);
};

async function sahreejGetRoadRoute(from,to){
  const url=`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=false`;
  const res=await fetch(url,{headers:{'Accept':'application/json'}});
  if(!res.ok)throw new Error('Routing unavailable');
  const json=await res.json();
  if(json.code!=='Ok'||!json.routes?.length)throw new Error('No driving route found');
  return json.routes[0];
}

function sahreejDriverStartFor(customer){
  // Prototype driver position: a nearby point east/south of the customer.
  // Real driver GPS will replace this later.
  return [customer[0]+0.018,customer[1]+0.024];
}

async function sahreejRenderRealTrackingRoute(){
  const customer=window.sahreejDeliveryCoords||Beirut;
  const driver=sahreejDriverStartFor(customer);
  const m=mapBase('trackMap',customer,14);
  if(!m)return;

  // Remove previous vector/marker overlays while keeping the tile layer.
  m.eachLayer(layer=>{
    if(layer instanceof L.TileLayer)return;
    try{m.removeLayer(layer)}catch(e){}
  });

  window.sahreejCustomerMarker=L.circleMarker(customer,{
    radius:8,weight:4,color:'#fff',fillColor:'#111',fillOpacity:1
  }).addTo(m).bindPopup('Delivery location');

  const driverIcon=L.divIcon({
    className:'',
    html:'<div class="uber-driver-marker"><img class="tanker-brand-icon" src="assets/tanker.svg" alt="Water tanker"></div>',
    iconSize:[42,42],iconAnchor:[21,21]
  });
  window.sahreejDriverMarker=L.marker(driver,{icon:driverIcon}).addTo(m).bindPopup('Sahreej driver · Sahreej tanker');

  try{
    const route=await sahreejGetRoadRoute(driver,customer);
    const coords=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    window.sahreejRouteLayer=L.polyline(coords,{weight:6,opacity:.88,color:'#111'}).addTo(m);
    m.fitBounds(window.sahreejRouteLayer.getBounds(),{padding:[55,55]});

    const km=route.distance/1000;
    const mins=Math.max(1,Math.round(route.duration/60));
    const eta=document.getElementById('liveEta');
    const sub=document.getElementById('trackSub');
    if(eta)eta.textContent=`${mins} min · ${km.toFixed(1)} km`;
    if(sub)sub.textContent=`Sahreej driver is following the road route to ${address}.`;

    let pill=document.getElementById('realRoutePill');
    if(!pill){
      pill=document.createElement('div');
      pill.id='realRoutePill';
      pill.className='route-info-pill';
      const mapWrap=document.getElementById('trackMap')?.parentElement;
      if(mapWrap)mapWrap.appendChild(pill);
    }
    if(pill)pill.textContent=`${mins} min · ${km.toFixed(1)} km`;
  }catch(err){
    const line=L.polyline([driver,customer],{weight:5,opacity:.8,color:'#111',dashArray:'8 8'}).addTo(m);
    m.fitBounds(line.getBounds(),{padding:[55,55]});
    const eta=document.getElementById('liveEta');
    if(eta)eta.textContent='Route temporarily unavailable';
  }
}

// Wrap the existing prototype request flow, then replace its straight line with a real road route.
const sahreejV13RequestTanker=requestTanker;
requestTanker=function(){
  sahreejV13RequestTanker();
  setTimeout(()=>sahreejRenderRealTrackingRoute(),450);
};



/* Runtime compatibility ends here.
   Delivery, dispatch, tracking, history, support and driver lifecycle are owned by js/core modules. */
