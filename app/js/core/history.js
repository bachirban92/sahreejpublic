(function(){
  'use strict';
  const S=window.SahreejCore, q=S.q;
  const money=n=>'$'+Number(n||0).toFixed(2);
  const fmtDate=v=>{if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';return d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
  const startOfToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const startOfWeek=()=>{const d=startOfToday();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const reasonBlock=o=>o.cancellation_reason?`<div class="history-reason"><small>Cancellation reason</small><span>${esc(o.cancellation_reason)}</span></div>`:'';

  let customerOrdersCache=[];

  async function driverOrders(){
    const session=await S.requireSession();
    const {data,error}=await window.sahreejSupabase.from('orders').select('*').eq('driver_id',session.user.id).order('requested_at',{ascending:false}).limit(100);
    if(error) throw error;return data||[];
  }

  async function driverCancellationHistory(){
    try{
      const {data,error}=await window.sahreejSupabase.rpc('get_my_driver_cancellation_history');
      if(error) throw error;
      return Array.isArray(data)?data:[];
    }catch(e){console.warn('driverCancellationHistory',e);return [];}
  }

  async function refreshDriverMetrics(){
    try{
      const [orders,profile,cancelledByDriver]=await Promise.all([driverOrders(),S.currentDriverProfile ? S.currentDriverProfile().catch(()=>null) : Promise.resolve(null),driverCancellationHistory()]);
      const delivered=orders.filter(o=>o.status==='delivered');const today=startOfToday(),week=startOfWeek();const deliveredAt=o=>new Date(o.delivered_at||o.updated_at||o.requested_at||0);
      const todayRows=delivered.filter(o=>deliveredAt(o)>=today);const weekRows=delivered.filter(o=>deliveredAt(o)>=week);
      const todayEarn=todayRows.reduce((s,o)=>s+Number(o.driver_earnings_usd||0),0),weekEarn=weekRows.reduce((s,o)=>s+Number(o.driver_earnings_usd||0),0);
      const cash=weekRows.filter(o=>String(o.payment_method||'').toLowerCase().includes('cash')).reduce((s,o)=>s+Number(o.customer_price_usd||0),0);
      const fees=weekRows.reduce((s,o)=>s+Number(o.platform_fee_usd||0),0);

      if(q('driverHomeToday'))q('driverHomeToday').textContent=money(todayEarn);if(q('driverHomeTrips'))q('driverHomeTrips').textContent=String(todayRows.length);if(q('driverHomeTodayTrips'))q('driverHomeTodayTrips').textContent=String(todayRows.length);
      if(q('driverWeekEarnings'))q('driverWeekEarnings').textContent=money(weekEarn);if(q('driverTripCount'))q('driverTripCount').textContent=String(weekRows.length);if(q('driverTodayEarnings'))q('driverTodayEarnings').textContent=money(todayEarn);if(q('driverTodayTrips'))q('driverTodayTrips').textContent=String(todayRows.length);if(q('driverCashCollected'))q('driverCashCollected').textContent=money(cash);if(q('driverFeesDue'))q('driverFeesDue').textContent=money(fees);if(q('driverNetEarnings'))q('driverNetEarnings').textContent=money(weekEarn);

      const history=orders.filter(o=>S.TERMINAL.includes(o.status));const list=q('driverActivityList');
      if(list){
        const terminalRows=history.map(o=>{const isDelivered=o.status==='delivered';const amount=isDelivered?money(o.driver_earnings_usd):'—';return {when:new Date(o.delivered_at||o.cancelled_at||o.updated_at||o.requested_at||0).getTime(),html:`<div class="driver-list-card"><div class="row"><div><strong>${Number(o.tanker_capacity_l||0).toLocaleString()} L delivery</strong><span class="muted">${esc(o.delivery_address||'Delivery')}</span></div><strong>${amount}</strong></div><div class="row"><span class="status">${String(o.status).replaceAll('_',' ').toUpperCase()}</span><span class="muted">${fmtDate(o.delivered_at||o.cancelled_at||o.updated_at||o.requested_at)}</span></div>${reasonBlock(o)}</div>`};});
        const cancelledRows=(cancelledByDriver||[]).map(o=>({when:new Date(o.event_at||0).getTime(),html:`<div class="driver-list-card"><div class="row"><div><strong>${Number(o.tanker_capacity_l||0).toLocaleString()} L delivery</strong><span class="muted">${esc(o.delivery_address||'Delivery')}</span></div><strong>—</strong></div><div class="row"><span class="status">CANCELLED BY YOU</span><span class="muted">${fmtDate(o.event_at)}</span></div>${o.cancellation_reason?`<div class="history-reason"><small>Cancellation reason</small><span>${esc(o.cancellation_reason)}</span></div>`:''}</div>`}));
        const rows=[...terminalRows,...cancelledRows].sort((a,b)=>b.when-a.when);
        if(!rows.length)list.innerHTML='<div class="driver-list-card"><strong>No completed deliveries yet</strong><span class="muted">Your completed and cancelled deliveries will appear here.</span></div>';
        else list.innerHTML=rows.map(x=>x.html).join('');
      }
      return {orders,delivered,todayRows,weekRows};
    }catch(e){console.warn('refreshDriverMetrics',e);return null}
  }
  S.refreshDriverMetrics=refreshDriverMetrics;

  function ensureDetailScreen(){
    if(q('customerOrderDetail'))return q('customerOrderDetail');
    const section=document.createElement('section');section.className='screen';section.id='customerOrderDetail';
    section.innerHTML='<div class="head"><button class="back" id="customerOrderDetailBack" aria-label="Back to activity">‹</button><strong>Order details</strong></div><div class="body" id="customerOrderDetailBody"></div>';
    document.body.appendChild(section);
    q('customerOrderDetailBack').onclick=()=>{try{closeScreen('customerOrderDetail')}catch(_){section.classList.remove('active')}};
    return section;
  }

  async function assignedDriver(orderId){
    try{
      const {data,error}=await window.sahreejSupabase.rpc('get_my_assigned_driver_details_v2',{p_order_id:orderId});
      if(error)return null;return Array.isArray(data)?data[0]:data;
    }catch(_){return null;}
  }

  window.sahreejOpenCustomerOrder=async function(orderId){
    const order=customerOrdersCache.find(x=>x.id===orderId);if(!order)return;
    const screen=ensureDetailScreen(),body=q('customerOrderDetailBody');
    if(body)body.innerHTML='<div class="card"><strong>Loading order details…</strong></div>';
    try{openScreen('customerOrderDetail')}catch(_){screen.classList.add('active')}
    const driver=order.driver_id?await assignedDriver(order.id):null;
    const delivered=order.status==='delivered';
    const verified=delivered&&!!order.delivery_pin_verified_at;
    body.innerHTML=`
      <div class="order-detail-hero"><span class="status">${esc(String(order.status||'').replaceAll('_',' ').toUpperCase())}</span><h2>${Number(order.tanker_capacity_l||0).toLocaleString()} L water delivery</h2><strong>${money(order.customer_price_usd)}</strong></div>
      <div class="card order-detail-grid">
        <div><small>Delivery address</small><strong>${esc(order.delivery_address||'Pinned delivery location')}</strong></div>
        <div><small>Payment</small><strong>${esc(order.payment_method||'Cash on delivery')}</strong></div>
        ${order.delivery_instructions?`<div><small>Delivery instructions</small><strong>${esc(order.delivery_instructions)}</strong></div>`:''}
        <div><small>Requested</small><strong>${esc(fmtDate(order.requested_at)||'—')}</strong></div>
        ${order.arrived_at?`<div><small>Driver arrived</small><strong>${esc(fmtDate(order.arrived_at))}</strong></div>`:''}
        ${order.delivery_started_at?`<div><small>Delivery started</small><strong>${esc(fmtDate(order.delivery_started_at))}</strong></div>`:''}
        ${order.delivered_at?`<div><small>Delivered</small><strong>${esc(fmtDate(order.delivered_at))}</strong></div>`:''}
      </div>
      ${driver?`<div class="card"><small>DRIVER</small><strong>${esc(driver.full_name||'Driver')}</strong><span class="muted">Plate ${esc(driver.vehicle_plate||'—')} · ${Number(driver.tanker_capacity_l||order.tanker_capacity_l||0).toLocaleString()} L</span></div>`:''}
      ${verified?'<div class="order-verified">✓ Delivery confirmed with customer PIN</div>':''}
      ${reasonBlock(order)}
      <div class="order-detail-actions">
        <button class="primary" onclick="sahreejReorder('${order.id}')">Reorder</button>
        ${delivered?`<button class="secondary" onclick="sahreejReportOrderProblem('${order.id}')">Report a problem</button>`:''}
      </div>`;
  };

  window.sahreejReorder=function(orderId){
    const order=customerOrdersCache.find(x=>x.id===orderId);if(!order)return;
    const lat=Number(order.delivery_latitude),lng=Number(order.delivery_longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)){if(typeof toast==='function')toast('This old order has no saved map location');return;}
    window.sahreejDeliveryCoords={lat,lng};
    window.deliveryAddress=order.delivery_address||'Pinned delivery location';
    window.address=window.deliveryAddress;
    window.selectedTankerCapacity=Number(order.tanker_capacity_l||0);
    window.selectedCapacity=window.selectedTankerCapacity;
    try{closeScreen('customerOrderDetail')}catch(_){}
    if(typeof openSelector==='function')openSelector();
    else if(typeof openScreen==='function')openScreen('selector');
    setTimeout(()=>{
      const options=[...document.querySelectorAll('#selector .tanker')];
      const target=options.find(el=>Number(el.dataset?.capacity||String(el.dataset?.size||'').replace(/\D/g,''))===window.selectedTankerCapacity);
      if(target){target.click();}
    },350);
    if(typeof toast==='function')toast('Current price will be shown before you order');
  };

  window.sahreejReportOrderProblem=async function(orderId){
    const order=customerOrdersCache.find(x=>x.id===orderId);if(!order)return;
    const choices='Choose issue type:\n1. Water quantity\n2. Driver issue\n3. Payment issue\n4. Late delivery\n5. Other';
    const selected=prompt(choices);if(selected===null)return;
    const map={1:'water_quantity',2:'driver_issue',3:'payment_issue',4:'late_delivery',5:'other'};
    const category=map[String(selected).trim()]||'other';
    const description=prompt('Please describe what happened:');if(description===null)return;
    const clean=description.trim();if(clean.length<5){if(typeof toast==='function')toast('Please add a little more detail');return;}
    try{
      const subjectMap={water_quantity:'Water quantity issue',driver_issue:'Driver issue',payment_issue:'Payment issue',late_delivery:'Late delivery',other:'Delivery issue'};
      const {error}=await window.sahreejSupabase.rpc('create_support_case',{p_order_id:order.id,p_role:'customer',p_category:category,p_subject:subjectMap[category],p_description:clean});
      if(error)throw error;
      if(typeof toast==='function')toast('Problem reported to Sahreej support');
    }catch(e){S.runtimeError?.('Could not report problem',e.message||String(e));}
  };

  async function refreshCustomerActivity(){
    const list=q('activityList');if(!list)return;
    try{
      const session=await S.requireSession();const {data,error}=await window.sahreejSupabase.from('orders').select('*').eq('customer_id',session.user.id).order('requested_at',{ascending:false}).limit(100);if(error)throw error;const rows=data||[];customerOrdersCache=rows;
      if(!rows.length){list.innerHTML='<div class="card"><strong>No orders yet</strong><span class="muted">Your Sahreej orders will appear here.</span></div>';return;}
      list.innerHTML=rows.map(o=>`<button class="customer-order-row" onclick="sahreejOpenCustomerOrder('${o.id}')"><div class="row"><div><strong>${Number(o.tanker_capacity_l||0).toLocaleString()} L</strong><span class="muted">${esc(o.delivery_address||'Delivery')}</span></div><strong>${money(o.customer_price_usd)}</strong></div><div class="row" style="margin-top:10px"><span class="status">${String(o.status||'').replaceAll('_',' ').toUpperCase()}</span><span class="muted">${fmtDate(o.delivered_at||o.cancelled_at||o.updated_at||o.requested_at)}</span></div>${o.status==='delivered'&&o.delivery_pin_verified_at?'<div class="history-pin-ok">✓ PIN confirmed</div>':''}${reasonBlock(o)}<div class="history-open">View details ›</div></button>`).join('');
    }catch(e){console.warn('refreshCustomerActivity',e)}
  }
  S.refreshCustomerActivity=refreshCustomerActivity;

  if(!q('sahreejHistoryStyles')){
    const s=document.createElement('style');s.id='sahreejHistoryStyles';s.textContent=`
      .history-reason{margin-top:10px;padding:10px 12px;border-radius:12px;background:#f7f7f7}.history-reason small{display:block;color:#777;margin-bottom:3px}.history-reason span{display:block;font-weight:700}
      .customer-order-row{display:block;width:100%;text-align:left;border:1px solid #e8e8e8;background:#fff;border-radius:20px;padding:16px;margin-bottom:12px;color:#111;font:inherit}.customer-order-row:active{transform:scale(.995)}
      .history-open{margin-top:11px;padding-top:10px;border-top:1px solid #eee;font-weight:850;font-size:13px}.history-pin-ok{display:inline-block;margin-top:10px;padding:6px 9px;border-radius:999px;background:#edf8ef;color:#17632b;font-size:12px;font-weight:850}
      .order-detail-hero{padding:18px 2px 12px}.order-detail-hero h2{margin:8px 0 4px}.order-detail-hero>strong{font-size:28px}.order-detail-grid{display:grid;gap:14px}.order-detail-grid small,.card small{display:block;color:#777;margin-bottom:3px}.order-detail-grid strong{display:block;line-height:1.35}
      .order-verified{margin:12px 0;padding:13px 14px;border-radius:15px;background:#edf8ef;color:#17632b;font-weight:850}.order-detail-actions{display:grid;gap:10px;margin:16px 0 28px}.order-detail-actions button{min-height:52px}
    `;document.head.appendChild(s);
  }

  const previousShowCustomerTab=window.showCustomerTab;
  window.showCustomerTab=function(id){const r=typeof previousShowCustomerTab==='function'?previousShowCustomerTab.apply(this,arguments):undefined;if(id==='activity')setTimeout(()=>refreshCustomerActivity(),0);if(id==='home')setTimeout(()=>S.restoreCustomerState?.(),50);return r;};
  try{showCustomerTab=window.showCustomerTab}catch(_){}
})();
