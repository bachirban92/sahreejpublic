(function(){
  'use strict';
  const S=window.SahreejCore||{};
  const q=id=>document.getElementById(id);
  const money=n=>'$'+Number(n||0).toFixed(2);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pretty=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
  const dateTime=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString();};
  const DOC_LABELS={id:'Identity document',driving_license:'Driving licence',vehicle_registration:'Vehicle registration',insurance:'Vehicle insurance'};

  async function session(){
    if(S.requireSession) return S.requireSession();
    const {data}=await window.sahreejSupabase.auth.getSession();
    if(!data?.session) throw new Error('Authentication required');
    return data.session;
  }

  function openPanel(title,html){
    q('accountPanelTitle').textContent=title;
    q('accountPanelBody').innerHTML=html;
    if(typeof window.openScreen==='function') window.openScreen('accountPanel');
    else q('accountPanel')?.classList.add('active');
  }

  function loading(title,label){
    openPanel(title,`<div class="driver-account-loading"><div class="driver-account-spinner"></div><strong>${esc(label)}</strong></div>`);
  }

  async function currentProfile(){
    try{
      if(S.currentDriverProfile) return await S.currentDriverProfile();
      const s=await session();
      const {data,error}=await window.sahreejSupabase.from('driver_profiles').select('*').eq('user_id',s.user.id).maybeSingle();
      if(error) throw error; return data;
    }catch(_){return null;}
  }

  function normalizeStatus(data){
    if(Array.isArray(data)) return data[0]||null;
    return data||null;
  }

  async function getDriverDocuments(){
    const s=await session();
    // Read the real document rows so storage_path + mime_type are available for preview.
    const {data,error}=await window.sahreejSupabase.from('driver_documents')
      .select('id,driver_id,type,storage_path,original_filename,mime_type,verified,uploaded_at,rejection_reason,reviewed_at')
      .eq('driver_id',s.user.id)
      .order('uploaded_at',{ascending:false});
    if(error) throw error;
    return data||[];
  }

  async function loadDocuments(){
    loading('Documents','Loading your documents…');
    try{
      await session();
      const [{data:statusData,error:statusError},docs] = await Promise.all([
        window.sahreejSupabase.rpc('get_my_driver_application_status'),
        getDriverDocuments()
      ]);
      if(statusError) throw statusError;
      const status=normalizeStatus(statusData);
      const appStatus=status?.status||'pending';
      const rows=Object.keys(DOC_LABELS).map(type=>{
        const d=docs.find(x=>x?.type===type)||null;
        const state=d?.verified?'Verified':d?.rejection_reason?'Needs attention':d?.original_filename?'Pending review':'Not uploaded';
        const cls=d?.verified?'verified':d?.rejection_reason?'rejected':d?.original_filename?'pending':'missing';
        const action=d?.storage_path?`<button class="doc-open-btn" onclick="SahreejDriverAccount.openDocument('${esc(type)}')">View document</button>`:'';
        return `<div class="driver-doc-row ${cls}">
          <div class="driver-doc-icon">${d?.verified?'✓':d?.rejection_reason?'!':'▣'}</div>
          <div class="driver-doc-main"><strong>${DOC_LABELS[type]}</strong><span>${esc(d?.original_filename||state)}</span>${d?.original_filename?`<small>${state}${d?.uploaded_at?' · '+esc(dateTime(d.uploaded_at)):''}</small>`:''}${d?.rejection_reason?`<small class="doc-reason">${esc(d.rejection_reason)}</small>`:''}</div>
          ${action}
        </div>`;
      }).join('');
      window.SahreejDriverAccount._docs=docs;
      openPanel('Documents',`
        <div class="driver-account-hero">
          <div><small>APPLICATION STATUS</small><strong>${esc(pretty(appStatus))}</strong></div>
          <span class="driver-status-pill ${esc(appStatus)}">${esc(pretty(appStatus))}</span>
        </div>
        ${status?.rejection_reason?`<div class="driver-account-warning"><strong>Application note</strong><span>${esc(status.rejection_reason)}</span></div>`:''}
        <div class="driver-account-section-title">Your submitted documents</div>
        <div class="driver-doc-list">${rows}</div>
        <div class="driver-account-note">Tap <strong>View document</strong> to open the actual file stored with your driver application.</div>
      `);
    }catch(err){
      console.warn('driver documents',err);
      openPanel('Documents',`<div class="driver-account-error"><strong>Could not load documents</strong><span>${esc(err?.message||'Please try again.')}</span><button onclick="SahreejDriverAccount.loadDocuments()">Try again</button></div>`);
    }
  }

  async function openDocument(type){
    try{
      const d=(window.SahreejDriverAccount._docs||[]).find(x=>x?.type===type);
      if(!d?.storage_path) throw new Error('Document file is unavailable');
      loading('Document','Opening secure document…');
      const {data,error}=await window.sahreejSupabase.storage.from('driver-documents').createSignedUrl(d.storage_path,300);
      if(error) throw error;
      if(!data?.signedUrl) throw new Error('Could not create document link');
      const mime=String(d.mime_type||'').toLowerCase();
      const url=esc(data.signedUrl);
      let viewer='';
      if(mime.startsWith('image/')) viewer=`<img class="driver-doc-preview-image" src="${url}" alt="${esc(DOC_LABELS[type]||'Document')}">`;
      else viewer=`<iframe class="driver-doc-preview-frame" src="${url}" title="${esc(DOC_LABELS[type]||'Document')}"></iframe>`;
      openPanel(DOC_LABELS[type]||'Document',`
        <button class="driver-doc-back" onclick="SahreejDriverAccount.loadDocuments()">‹ Back to documents</button>
        <div class="driver-doc-preview-meta"><strong>${esc(d.original_filename||DOC_LABELS[type]||'Document')}</strong><span>${d.verified?'Verified':'Submitted'}</span></div>
        <div class="driver-doc-preview">${viewer}</div>
        <a class="driver-doc-external" href="${url}" target="_blank" rel="noopener noreferrer">Open full screen</a>
      `);
    }catch(err){
      console.warn('driver document preview',err);
      openPanel('Document',`<div class="driver-account-error"><strong>Could not open document</strong><span>${esc(err?.message||'Please try again.')}</span><button onclick="SahreejDriverAccount.loadDocuments()">Back to documents</button></div>`);
    }
  }

  async function deliveredOrders(){
    const s=await session();
    const {data,error}=await window.sahreejSupabase.from('orders')
      .select('id,status,payment_method,customer_price_usd,platform_fee_usd,driver_earnings_usd,delivered_at')
      .eq('driver_id',s.user.id).eq('status','delivered').order('delivered_at',{ascending:false}).limit(500);
    if(error) throw error;
    return data||[];
  }

  function ledgerLabel(type){
    const m={order_earning:'Delivery earning',platform_fee_due:'Sahreej commission',payment:'Payment to Sahreej',adjustment_credit:'Credit',adjustment_debit:'Debit'};
    return m[type]||pretty(type);
  }

  async function getSettlementSummary(){
    // V8.17 backend summary is authoritative and reads actual delivered orders server-side.
    const {data,error}=await window.sahreejSupabase.rpc('get_my_driver_settlement_summary_v2');
    if(error) return null;
    return Array.isArray(data)?(data[0]||null):data;
  }

  async function getLedger(){
    const {data,error}=await window.sahreejSupabase.rpc('get_my_driver_ledger',{p_limit:100});
    return error?[]:(data||[]);
  }

  async function loadSettlement(){
    loading('Settlement','Calculating your commission…');
    try{
      await session();
      const [summary,ledger,orders] = await Promise.all([
        getSettlementSummary(),
        getLedger(),
        deliveredOrders().catch(()=>[])
      ]);

      // Fallback for a deployment where the V8.17 SQL has not been run yet.
      const fallbackEarnings=orders.reduce((s,o)=>s+Number(o.driver_earnings_usd||0),0);
      const fallbackAllFees=orders.reduce((s,o)=>s+Number(o.platform_fee_usd||0),0);
      const fallbackCashOrders=orders.filter(o=>String(o.payment_method||'').toLowerCase().includes('cash'));
      const fallbackCashCollected=fallbackCashOrders.reduce((s,o)=>s+Number(o.customer_price_usd||0),0);
      const fallbackCashFees=fallbackCashOrders.reduce((s,o)=>s+Number(o.platform_fee_usd||0),0);

      const payments=ledger.filter(x=>x.type==='payment').reduce((s,x)=>s+Math.abs(Number(x.amount_usd||0)),0);
      const credits=ledger.filter(x=>x.type==='adjustment_credit').reduce((s,x)=>s+Math.abs(Number(x.amount_usd||0)),0);
      const debits=ledger.filter(x=>x.type==='adjustment_debit').reduce((s,x)=>s+Math.abs(Number(x.amount_usd||0)),0);

      const cashCollected=Number(summary?.cash_collected_usd ?? fallbackCashCollected);
      const earnings=Number(summary?.driver_earnings_usd ?? fallbackEarnings);
      const allCommission=Number(summary?.total_platform_fee_usd ?? fallbackAllFees);
      const cashCommission=Number(summary?.cash_commission_due_usd ?? fallbackCashFees);
      const deliveredTrips=Number(summary?.delivered_trips ?? orders.length);
      const paid=payments;
      const due=Math.max(0,cashCommission-paid-credits+debits);

      const settlementRows=ledger.length?ledger.slice(0,30).map(x=>`<div class="settlement-row"><div><strong>${esc(ledgerLabel(x.type))}</strong><span>${esc(x.note||dateTime(x.created_at))}</span></div><strong>${money(x.amount_usd)}</strong></div>`).join(''):'<div class="driver-account-empty"><strong>No payments recorded yet</strong><span>When Sahreej records a settlement payment, it will appear here and reduce the amount due.</span></div>';

      openPanel('Settlement',`
        <div class="settlement-due-card"><small>YOU NEED TO PAY SAHREEJ</small><strong>${money(due)}</strong><span>This is Sahreej commission from completed <b>cash</b> deliveries, minus recorded payments or credits.</span></div>
        <div class="settlement-grid">
          <div><small>Cash collected</small><strong>${money(cashCollected)}</strong></div>
          <div><small>Your earnings</small><strong>${money(earnings)}</strong></div>
          <div><small>Cash commission due</small><strong>${money(cashCommission)}</strong></div>
          <div><small>Paid to Sahreej</small><strong>${money(paid)}</strong></div>
        </div>
        <div class="settlement-summary-line"><span>Completed deliveries</span><strong>${deliveredTrips}</strong></div>
        <div class="settlement-summary-line"><span>Total commission across all delivered orders</span><strong>${money(allCommission)}</strong></div>
        <div class="driver-account-section-title">Settlement activity</div>
        <div class="settlement-list">${settlementRows}</div>
        ${!summary?'<div class="driver-account-warning"><strong>Backend settlement summary not installed yet</strong><span>Run the V8.17 SQL so commission is calculated server-side from actual completed orders.</span></div>':''}
      `);
    }catch(err){
      console.warn('driver settlement',err);
      openPanel('Settlement',`<div class="driver-account-error"><strong>Could not load settlement</strong><span>${esc(err?.message||'Please try again.')}</span><button onclick="SahreejDriverAccount.loadSettlement()">Try again</button></div>`);
    }
  }

  async function loadVehicle(){
    loading('My tanker','Loading tanker details…');
    const p=await currentProfile();
    openPanel('My tanker',`<div class="driver-account-detail-card"><div><small>Capacity</small><strong>${p?.tanker_capacity_l?Number(p.tanker_capacity_l).toLocaleString()+' L':'—'}</strong></div><div><small>Plate</small><strong>${esc(p?.vehicle_plate||'—')}</strong></div><div><small>Status</small><strong>${esc(pretty(p?.status||'—'))}</strong></div></div>`);
  }

  async function loadDriverSettings(){
    loading('Driver settings','Loading account settings…');
    let deletion=null;
    try{
      await session();
      const {data,error}=await window.sahreejSupabase.rpc('get_my_account_deletion_request');
      if(error)throw error;
      deletion=Array.isArray(data)?data[0]:data;
    }catch(_){}

    const active=deletion&&['requested','pending_settlement','processing'].includes(String(deletion.status||''));
    const note=active
      ? deletion.status==='pending_settlement'
        ? 'Your deletion request is waiting for your Sahreej settlement balance to be cleared.'
        : deletion.status==='processing'
          ? 'Your account deletion request is being processed.'
          : 'Your account deletion request has been received.'
      : '';

    openPanel('Driver settings',`
      <div class="card"><div class="row"><span>Notifications</span><button class="secondary" type="button" onclick="SahreejNotifications?.panel?.()">Open</button></div></div>
      <div class="card"><div class="row"><span>Language</span><strong>English</strong></div></div>
      ${active?`<div class="driver-account-warning"><strong>Account deletion requested</strong><span>${esc(note)}</span></div>`:
        '<button class="secondary" type="button" onclick="SahreejDriverAccount.requestDeletion()">Delete driver account</button>'}
    `);
  }

  async function requestDeletion(){
    const ok=confirm('Request permanent deletion of your Sahreej driver account and associated personal data? You must finish active deliveries, and any settlement due to Sahreej must be cleared first.');
    if(!ok)return;
    const reason=prompt('Reason (optional):','');
    if(reason===null)return;
    try{
      const {data,error}=await window.sahreejSupabase.rpc('request_my_account_deletion',{p_reason:reason.trim()||null});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(typeof toast==='function')toast(row?.status==='pending_settlement'?'Deletion requested · settlement must be cleared first':'Account deletion requested');
      await loadDriverSettings();
    }catch(err){
      if(typeof toast==='function')toast(err?.message||'Could not request account deletion');
    }
  }

  window.SahreejDriverAccount={loadDocuments,loadSettlement,openDocument,loadDriverSettings,requestDeletion,_docs:[]};
  window.openDriverAccountPanel=function(type){
    if(type==='documents') return loadDocuments();
    if(type==='settlement') return loadSettlement();
    if(type==='vehicle') return loadVehicle();
    if(type==='settings') return loadDriverSettings();
    if(typeof window.toast==='function') window.toast('Use Activity to view delivery history');
  };
})();
