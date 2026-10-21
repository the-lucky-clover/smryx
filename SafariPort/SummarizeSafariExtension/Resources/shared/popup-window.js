function it(frame, runtimeId) {
  const gap = 12;
  let x = 0, y = gap, gesture = null;
  const chromeLayer = document.createElement('div');
  chromeLayer.setAttribute('data-smryx-window-controls', '');
  chromeLayer.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:1000000000000';
  const shadow = chromeLayer.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = '.handle{position:fixed;pointer-events:auto;touch-action:none;border:0;padding:0;background:transparent;box-sizing:border-box}.handle:hover,.handle:focus-visible{background:rgba(105,155,215,.22);outline:1px solid rgba(105,155,215,.65);border-radius:5px}.shield{position:fixed;inset:0;pointer-events:auto;touch-action:none;user-select:none}';
  shadow.append(style);
  const directions = ['n','s','e','w','ne','nw','se','sw'];
  const handles = directions.map(direction => {
    const handle = document.createElement('div');
    handle.className = 'handle';
    handle.dataset.edge = direction;
    handle.title = 'Resize summary window';
    handle.style.cursor = direction+'-resize';
    handle.addEventListener('pointerdown', event => {
      if(event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      start(direction, event.screenX, event.screenY);
    });
    shadow.append(handle);return handle;
  });
  document.documentElement.append(chromeLayer);
  Object.assign(frame.style,{position:'fixed',top:'0px',left:'0px',resize:'none',overflow:'hidden',transition:'none',minWidth:'0px',minHeight:'0px'});
  function bounds(){return {width:Math.max(1,document.documentElement.clientWidth),height:Math.max(1,document.documentElement.clientHeight)};}
  function render(){
    if(!frame.isConnected){cleanup();return;}
    const visible = getComputedStyle(frame).display !== 'none';
    chromeLayer.style.display = visible ? 'block':'none';
    if(!visible) {stop();return;}
    const v=bounds(), w=frame.offsetWidth,h=frame.offsetHeight;
    x=Math.max(gap,Math.min(x,Math.max(gap,v.width-w-gap)));
    y=Math.max(gap,Math.min(y,Math.max(gap,v.height-h-gap)));
    const transform=`translate(${x}px, ${y}px)`;
    if(frame.style.transform!==transform)frame.style.transform=transform;
    for(const handle of handles){
      const d=handle.dataset.edge,corner=d.length===2;
      const width=corner?22:(d==='n'||d==='s'?Math.max(0,w-32):10);
      const height=corner?22:(d==='e'||d==='w'?Math.max(0,h-32):10);
      const left=corner?(d.includes('w')?x-5:x+w-17):(d==='w'?x-5:d==='e'?x+w-5:x+16);
      const top=corner?(d.includes('n')?y-5:y+h-17):(d==='n'?y-5:d==='s'?y+h-5:y+16);
      Object.assign(handle.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
    }
  }
  function stop(){gesture=null;shadow.querySelector('.shield')?.remove();}
  function start(edge,sx,sy){
    if(!Number.isFinite(sx)||!Number.isFinite(sy))return;
    stop();
    gesture={edge,sx,sy,x,y,w:frame.offsetWidth,h:frame.offsetHeight};
    const shield=document.createElement('div');shield.className='shield';shield.style.cursor=edge==='move'?'grabbing':edge+'-resize';shadow.append(shield);
    shield.addEventListener('pointermove',move);
    shield.addEventListener('pointerup',stop);
    shield.addEventListener('pointercancel',stop);
    // Mouse events can continue over the parent even when pointerdown began inside the iframe.
    shield.addEventListener('mousemove',move);
    shield.addEventListener('mouseup',stop);
  }
  function move(event){
    if(!gesture)return;
    if(event.buttons===0){stop();return;}
    const g=gesture,dx=event.screenX-g.sx,dy=event.screenY-g.sy,v=bounds();
    if(g.edge==='move'){x=g.x+dx;y=g.y+dy;}
    else {
      const minW=Math.min(320,v.width-gap*2),minH=Math.min(280,v.height-gap*2);
      let left=g.x,top=g.y,right=g.x+g.w,bottom=g.y+g.h;
      if(g.edge.includes('w'))left=Math.max(gap,Math.min(g.x+dx,right-minW));
      if(g.edge.includes('e'))right=Math.min(v.width-gap,Math.max(right+dx,left+minW));
      if(g.edge.includes('n'))top=Math.max(gap,Math.min(g.y+dy,bottom-minH));
      if(g.edge.includes('s'))bottom=Math.min(v.height-gap,Math.max(bottom+dy,top+minH));
      x=left;y=top;frame.style.width=(right-left)+'px';frame.style.height=(bottom-top)+'px';
    }
    render();event.preventDefault?.();
  }
  function message(event){
    if(event.source!==frame.contentWindow||event.data?.runtimeId!==runtimeId)return;
    if(getComputedStyle(frame).display==='none')return;
    if(event.data.type==='POPUP_DRAG_START')start('move',event.data.screenX,event.data.screenY);
    if(event.data.type==='POPUP_DRAG_MOVE'&&gesture?.edge==='move')move(event.data);
    if(event.data.type==='POPUP_DRAG_END')stop();
  }
  window.addEventListener('message',message);
  const blur=()=>{if(!document.hasFocus())stop();};
  window.addEventListener('blur',blur);
  const observer=new ResizeObserver(render);observer.observe(frame);
  const visibility=new MutationObserver(render);visibility.observe(frame,{attributes:true,attributeFilter:['style']});
  const removal=new MutationObserver(()=>{if(!frame.isConnected)cleanup();});removal.observe(frame.parentNode,{childList:true});
  function cleanup(){stop();observer.disconnect();visibility.disconnect();removal.disconnect();window.removeEventListener('message',message);window.removeEventListener('blur',blur);chromeLayer.remove();}
  frame._resetDrag=()=>{x=Math.max(gap,bounds().width-frame.offsetWidth-gap);y=gap;render();};
  frame._clampDrag=render;
  frame._resetDrag();
}
