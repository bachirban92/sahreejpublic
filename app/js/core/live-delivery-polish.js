(function(){
  'use strict';
  const S=window.SahreejCore||{};
  const q=id=>document.getElementById(id);

  if(!q('sahreejLiveDeliveryStyles')){
    const s=document.createElement('style');
    s.id='sahreejLiveDeliveryStyles';
    s.textContent=`
      #tracking .sheet{box-shadow:0 -10px 35px rgba(0,0,0,.12)}
      #trackingSheet{padding-bottom:max(18px,env(safe-area-inset-bottom))}
      .driver-public-card{box-shadow:0 8px 24px rgba(0,0,0,.07)}
      .driver-public-tanker{aspect-ratio:16/9;height:auto!important;background:#eef1f2}
      .driver-public-tanker img{width:100%;height:100%;object-fit:cover;object-position:center}
      .driver-public-avatar{width:64px!important;height:64px!important;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.12)}
      .driver-public-avatar img{width:100%;height:100%;object-fit:cover;object-position:center}
      .trip-progress{position:relative;margin:8px 2px 18px;display:grid!important;grid-template-columns:repeat(4,1fr);gap:0}
      .trip-progress:before{content:'';position:absolute;left:6%;right:6%;top:6px;height:3px;background:#e7e7e7;border-radius:99px;z-index:0}
      .trip-progress span{position:relative;z-index:1;width:14px!important;height:14px!important;border-radius:50%;background:#e7e7e7!important;justify-self:center;border:3px solid #fff;box-shadow:0 0 0 1px #ddd}
      .trip-progress span.on{background:#111!important;box-shadow:0 0 0 1px #111}
      .live-stage-labels{display:grid;grid-template-columns:repeat(4,1fr);font-size:10px;color:#777;text-align:center;margin-top:-12px;margin-bottom:16px}
      .live-stage-labels .active{color:#111;font-weight:900}
      .tracking-status-note{margin:10px 0 14px;padding:12px 14px;border-radius:14px;background:#f7f7f7;font-size:13px;color:#555}
      #cancelCustomerOrderBtn{min-height:48px}
      #v8DriverAction,#v8DriverCancel{min-height:52px}
      #v8DriverAction:disabled,#v8DriverCancel:disabled,#cancelCustomerOrderBtn:disabled{opacity:.55;cursor:wait}
    `;
    document.head.appendChild(s);
  }

  function stageIndex(status){
    if(status==='assigned') return 0;
    if(status==='driver_arrived') return 1;
    if(status==='delivering') return 2;
    if(status==='delivered') return 3;
    return -1;
  }

  function statusNote(status){
    if(status==='assigned') return 'Your driver is heading to the delivery point. You can still cancel at this stage.';
    if(status==='driver_arrived') return 'Your tanker has arrived. Cancellation is now disabled because the driver is at the delivery point.';
    if(status==='delivering') return 'Water delivery is in progress. The order cannot be cancelled now.';
    if(status==='delivered') return 'Delivery completed.';
    return '';
  }

  function polishTracking(order){
    const host=q('realAssignedDriverHost');
    if(!host||!order) return;
    const idx=stageIndex(order.status);
    if(idx>=0 && !host.querySelector('.live-stage-labels')){
      const labels=document.createElement('div');
      labels.className='live-stage-labels';
      labels.innerHTML=['On the way','Arrived','Delivering','Done'].map((x,i)=>`<span class="${i<=idx?'active':''}">${x}</span>`).join('');
      const progress=host.querySelector('.trip-progress');
      if(progress) progress.insertAdjacentElement('afterend',labels);
    }
    let note=host.querySelector('.tracking-status-note');
    const text=statusNote(order.status);
    if(text){
      if(!note){note=document.createElement('div');note.className='tracking-status-note';host.prepend(note);}
      note.textContent=text;
    }
  }

  S.polishTracking=polishTracking;
})();
