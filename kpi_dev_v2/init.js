async function fetchEmployee(employee){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const url=`${SHEET_BASE}?gid=${encodeURIComponent(employee.gid)}&single=true&output=csv&v=${Date.now()}`;
  const response=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const raw=await response.text();if(raw.length>5_000_000)throw new Error('Sheet exceeds the 5 MB safety limit.');
  return parseEmployeeCsv(raw,employee);
 }finally{clearTimeout(timer);}
}
async function refreshSheet(){
 if(state.refreshing)return;state.refreshing=true;renderAll();
 const results=await Promise.allSettled(EMPLOYEES.map(e=>fetchEmployee(e)));
 results.forEach((result,i)=>{
  const e=EMPLOYEES[i],old=state.source[e.id];
  if(result.status==='fulfilled'){state.records[e.id]=result.value;state.source[e.id]={status:'live',lastSuccess:new Date()};}
  else{state.source[e.id]={status:old.lastSuccess?'stale':'unavailable',lastSuccess:old.lastSuccess||null};console.warn(`Could not load the published tab for ${e.name}.`,result.reason);}
 });
 state.refreshing=false;state.lastChecked=new Date();renderAll();
}
initializeLogos();
refreshSheet();
setInterval(()=>{if(!document.hidden)refreshSheet();},5*60*1000);

// Keep the decorative video off for reduced motion and while viewing the dashboard.
if(window.matchMedia){const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');if(motionPreference.addEventListener)motionPreference.addEventListener('change',syncLandingVideo);else if(motionPreference.addListener)motionPreference.addListener(syncLandingVideo);}
syncLandingVideo();

// One-time architectural entrance, label decoding and subtle pointer drift.
(function(){
 const landing=$('landing'),background=landing.querySelector('.landing-motion');
 const motion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');
 const reduced=()=>!!(motion&&motion.matches);
 const labels=[...landing.querySelectorAll('.landing-decode')];
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 labels.forEach(el=>{el.dataset.label=el.textContent;});
 function settle(el){if(el._decodeFrame)cancelAnimationFrame(el._decodeFrame);clearTimeout(el._decodeTimeout);el.textContent=el.dataset.label;el.style.width='';}
 function decode(el){
  settle(el);if(reduced())return;
  el.style.width=Math.ceil(el.getBoundingClientRect().width*100)/100+'px';
  const text=el.dataset.label,start=performance.now();let rollAt=0,random=[];
  function frame(now){const progress=Math.min(1,(now-start)/400),front=progress*text.length;if(now-rollAt>=45||!random.length){random=Array.from(text,()=>alphabet[Math.floor(Math.random()*alphabet.length)]);rollAt=now;}
   let out='';for(let i=0;i<text.length;i++){if(i<front)out+=text[i];else if(i<front+3.6)out+=text[i]===' '?' ':random[i];else break;}el.textContent=out;
   if(progress<1)el._decodeFrame=requestAnimationFrame(frame);else settle(el);
  }
  el._decodeFrame=requestAnimationFrame(frame);el._decodeTimeout=setTimeout(()=>settle(el),900);
 }
 labels.forEach(el=>el.closest('button').addEventListener('pointerenter',()=>decode(el)));
 if(!reduced()){
  landing.classList.add('anim');labels.forEach((el,i)=>setTimeout(()=>{if(landing.classList.contains('active'))decode(el);},900+i*60));
  setTimeout(()=>landing.classList.remove('anim'),2200);setTimeout(()=>labels.forEach(settle),2600);
 }
 let tx=0,ty=0,cx=0,cy=0,running=false;
 function tick(){
  if(reduced()||!landing.classList.contains('active')){background.style.transform='';running=false;return;}
  cx+=(tx-cx)*.045;cy+=(ty-cy)*.045;const w=landing.clientWidth,h=landing.clientHeight;
  const dx=-cx*w*.0156,dy=-cy*h*.015,scale=1+2*Math.max(Math.abs(cx*.0156),Math.abs(cy*.015))+.014*Math.max(0,cy);
  background.style.transform=`translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
  if(Math.abs(tx-cx)<.0004&&Math.abs(ty-cy)<.0004){running=false;return;}requestAnimationFrame(tick);
 }
 function wake(){if(!running&&!reduced()){running=true;requestAnimationFrame(tick);}}
 landing.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||reduced())return;const rect=landing.getBoundingClientRect();tx=(e.clientX-rect.left)/rect.width*2-1;ty=(e.clientY-rect.top)/rect.height*2-1;wake();},{passive:true});
 landing.addEventListener('pointerleave',()=>{tx=0;ty=0;wake();});
 if(motion&&motion.addEventListener)motion.addEventListener('change',()=>{if(reduced()){landing.classList.remove('anim');labels.forEach(settle);background.style.transform='';}});
})();
