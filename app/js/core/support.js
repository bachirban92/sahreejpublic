(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const pretty=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
  const fmt=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};

  window.sahreejCreateSupportCase=async function(role,orderId=null){
    const allowed=role==='driver'
      ? [['customer_issue','Customer issue'],['wrong_location','Wrong location'],['payment_issue','Payment issue'],['cancelled_order','Cancelled order'],['other','Other']]
      : [['driver_issue','Driver issue'],['late_delivery','Late delivery'],['wrong_location','Wrong location'],['payment_issue','Payment issue'],['water_quantity','Water quantity'],['cancelled_order','Cancelled order'],['other','Other']];
    const menu=allowed.map((x,i)=>String(i+1)+'. '+x[1]).join('\n');
    const choice=prompt('Choose issue type:\n'+menu);
    if(choice===null)return false;
    const picked=allowed[Number(String(choice).trim())-1]||allowed.find(x=>x[0]===String(choice).trim())||allowed[allowed.length-1];
    const description=prompt('Please describe what happened:');
    if(description===null)return false;
    const clean=description.trim();
    if(clean.length<5){if(typeof toast==='function')toast('Please add a little more detail');return false;}
    try{
      const {error}=await window.sahreejSupabase.rpc('create_support_case',{
        p_order_id:orderId||null,
        p_role:role,
        p_category:picked[0],
        p_subject:picked[1],
        p_description:clean
      });
      if(error)throw error;
      if(typeof toast==='function')toast('Support case submitted');
      return true;
    }catch(e){
      if(typeof toast==='function')toast(e.message||'Could not submit support case');
      return false;
    }
  };

  async function loadCases(){
    const {data,error}=await window.sahreejSupabase.rpc('get_my_support_cases');
    if(error) throw error;
    return Array.isArray(data)?data:[];
  }

  async function openSupport(role){
    const title=q('accountPanelTitle'),body=q('accountPanelBody');
    if(!title||!body) return;
    title.textContent=role==='driver'?'Driver support':'Help & support';
    body.innerHTML='<div class="card"><strong>Loading support…</strong></div>';
    try{ if(typeof openScreen==='function') openScreen('accountPanel'); }catch(_){}
    try{
      const rows=(await loadCases()).filter(x=>x.role===role);
      body.innerHTML=`
        <div class="card support-list">
          <strong>How can we help?</strong>
          <span class="muted">Send a support request and track Sahreej's response here.</span>
          <button class="primary" id="realSupportCreate" style="margin-top:12px">Report a problem</button>
        </div>
        <div style="font-size:18px;font-weight:900;margin:18px 0 8px">Your support cases</div>
        ${rows.length?rows.map(x=>`
          <div class="card">
            <div class="row"><strong>${esc(x.subject||'Support case')}</strong><span class="status">${esc(pretty(x.status))}</span></div>
            <span class="muted">${esc(pretty(x.category))}${x.created_at?' · '+esc(fmt(x.created_at)):''}</span>
            ${x.order_id?`<span class="muted">Order: ${esc(x.order_id)}</span>`:''}
            <div style="margin-top:10px;line-height:1.4">${esc(x.description||'')}</div>
            ${x.admin_resolution?`<div class="order-verified" style="margin-top:10px"><strong>Sahreej response</strong><div style="margin-top:4px">${esc(x.admin_resolution)}</div></div>`:''}
          </div>`).join(''):'<div class="card"><span class="muted">No support cases yet.</span></div>'}`;
      q('realSupportCreate').onclick=async()=>{
        if(typeof window.sahreejCreateSupportCase!=='function'){
          if(typeof toast==='function') toast('Support is temporarily unavailable');
          return;
        }
        await window.sahreejCreateSupportCase(role,null);
        await openSupport(role);
      };
    }catch(e){
      body.innerHTML=`<div class="card"><strong>Could not load support</strong><span class="muted">${esc(e.message||'Try again')}</span><button class="secondary" id="supportRetry" style="margin-top:12px">Try again</button></div>`;
      q('supportRetry').onclick=()=>openSupport(role);
    }
  }

  window.openCustomerSupport=()=>openSupport('customer');
  window.openDriverSupport=()=>openSupport('driver');

  const previous=window.openAccountPanel;
  if(typeof previous==='function'){
    window.openAccountPanel=function(type){
      if(type==='help'||type==='support') return openSupport('customer');
      return previous.apply(this,arguments);
    };
  }
})();