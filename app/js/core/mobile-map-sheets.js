(function(){
  'use strict';

  const mobile=window.matchMedia('(max-width:600px)');
  const configs=[
    {screenId:'tracking',sheet:'#trackingSheet',map:'.fullmap',ratios:{expanded:.14,middle:.40,collapsed:.62}},
    {screenId:'selector',sheet:'.select-sheet',map:'.fullmap',ratios:{expanded:.12,middle:.38,collapsed:.60}}
  ];

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

  function setup(config){
    const screen=document.getElementById(config.screenId);
    const sheet=screen?.querySelector(config.sheet);
    const map=screen?.querySelector(config.map);
    if(!screen||!sheet||!map||screen.dataset.mapSheetReady==='1')return null;

    screen.dataset.mapSheetReady='1';
    screen.classList.add('map-sheet-managed');

    const grabber=document.createElement('button');
    grabber.type='button';
    grabber.className='map-sheet-grabber';
    grabber.setAttribute('aria-label','Drag to resize map and delivery details');
    grabber.setAttribute('aria-expanded','false');
    sheet.insertBefore(grabber,sheet.firstChild);

    let state='middle';
    let dragStartY=0;
    let dragStartTop=0;
    let dragging=false;
    let moved=false;

    function height(){
      const rect=screen.getBoundingClientRect();
      return rect.height||window.innerHeight||700;
    }

    function snapTop(which){
      const h=height();
      const ratio=config.ratios[which]??config.ratios.middle;
      return clamp(Math.round(h*ratio),96,Math.max(120,h-180));
    }

    function currentTop(){
      const raw=getComputedStyle(screen).getPropertyValue('--sahreej-sheet-top');
      const n=parseFloat(raw);
      return Number.isFinite(n)?n:snapTop(state);
    }

    function applyTop(top,animate=true){
      if(!mobile.matches)return;
      if(!animate)screen.classList.add('map-sheet-dragging');
      const h=height();
      const bounded=clamp(top,snapTop('expanded'),snapTop('collapsed'));
      screen.style.setProperty('--sahreej-sheet-top',bounded+'px');
      if(animate)screen.classList.remove('map-sheet-dragging');
    }

    function setState(next,animate=true){
      state=next;
      grabber.setAttribute('aria-expanded',String(next==='expanded'));
      applyTop(snapTop(next),animate);
      if(next!=='expanded')sheet.scrollTop=0;
      // Do not dispatch a synthetic window resize here.
      // The module already listens to resize and dispatching one from setState()
      // creates an endless setState -> resize -> setState loop on mobile Safari.
      // Leaflet maps only need their own size invalidated after the sheet settles.
      setTimeout(()=>{
        try{
          ['homeMap','pickMap','selectMap','trackMap'].forEach(id=>{
            const el=document.getElementById(id);
            if(!el)return;
            const map=Object.values(window.maps||{}).find(m=>m&&m._container===el);
            map?.invalidateSize?.({pan:false});
          });
        }catch(_){}
      },animate?240:0);
    }

    function nearestState(top){
      return ['expanded','middle','collapsed']
        .map(name=>({name,d:Math.abs(top-snapTop(name))}))
        .sort((a,b)=>a.d-b.d)[0].name;
    }

    grabber.addEventListener('pointerdown',event=>{
      if(!mobile.matches)return;
      dragging=true;
      moved=false;
      dragStartY=event.clientY;
      dragStartTop=currentTop();
      screen.classList.add('map-sheet-dragging');
      try{grabber.setPointerCapture(event.pointerId);}catch(_){}
    });

    grabber.addEventListener('pointermove',event=>{
      if(!dragging||!mobile.matches)return;
      const delta=event.clientY-dragStartY;
      if(Math.abs(delta)>4)moved=true;
      applyTop(dragStartTop+delta,false);
    });

    function finish(event){
      if(!dragging)return;
      dragging=false;
      screen.classList.remove('map-sheet-dragging');
      const delta=event.clientY-dragStartY;
      let next;
      if(delta<-52)next='expanded';
      else if(delta>52)next='collapsed';
      else next=nearestState(currentTop());
      setState(next,true);
    }

    grabber.addEventListener('pointerup',finish);
    grabber.addEventListener('pointercancel',finish);

    grabber.addEventListener('click',()=>{
      if(moved)return;
      setState(state==='expanded'?'middle':'expanded',true);
    });

    const observer=new MutationObserver(()=>{
      if(screen.classList.contains('active')&&mobile.matches){
        requestAnimationFrame(()=>setState(state,false));
      }
    });
    observer.observe(screen,{attributes:true,attributeFilter:['class']});

    window.addEventListener('resize',()=>setState(state,false),{passive:true});
    setState('middle',false);

    return {setState,getState:()=>state};
  }

  function init(){
    const controllers=configs.map(setup).filter(Boolean);
    window.SahreejMapSheets={
      controllers,
      expandTracking:()=>controllers[0]?.setState('expanded'),
      collapseTracking:()=>controllers[0]?.setState('collapsed')
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
