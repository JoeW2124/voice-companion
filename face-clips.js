// Liora's face v11: lifelike generated clips, two stacked <video>s crossfading by state. All clips start & end on the same frame, so chaining is seamless.
const V='?v=11',BASE='clips/';
const SETS={idle:['idle'],listening:['listen'],thinking:['listen','idle'],speaking:['talk1','talk2','talk3','talk4']};
export function createFace(opts={}){
 const log=opts.log||(()=>{});
 const root=document.createElement('div');root.id='face';
 root.innerHTML='<img id=fimg alt="" src="liora.jpg'+V+'"><video muted playsinline webkit-playsinline preload=auto disablepictureinpicture></video><video muted playsinline webkit-playsinline preload=auto disablepictureinpicture></video>';
 const css=document.createElement('style');css.textContent=`
#face{position:fixed;top:0;bottom:0;left:50%;height:100%;width:max(100vw,56.25vh);transform:translateX(-50%);pointer-events:none;z-index:0;mix-blend-mode:screen;
 -webkit-mask-image:linear-gradient(to bottom,#000 78%,transparent 100%);mask-image:linear-gradient(to bottom,#000 78%,transparent 100%)}
@media (min-aspect-ratio:3/4){#face{width:min(100vw,72vh);-webkit-mask-image:radial-gradient(ellipse 50% 62% at 50% 42%,#000 58%,rgba(0,0,0,.5) 80%,transparent 100%);mask-image:radial-gradient(ellipse 50% 62% at 50% 42%,#000 58%,rgba(0,0,0,.5) 80%,transparent 100%)}}
#face video,#face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;opacity:0;transition:opacity .45s ease;background:transparent}
#face img{transition:opacity .8s}#face .on{opacity:1}`;
 document.head.appendChild(css);const cv=document.getElementById('cv');if(cv)cv.after(root);else document.body.appendChild(root);
 const img=root.querySelector('img'),vids=[...root.querySelectorAll('video')];let cur=0,state='idle',clip='',ok=false,dead=false,switching=false,fails=0,lastTalk='';
 img.onload=()=>{if(!ok)img.classList.add('on')};
 for(const v of vids){v.muted=true;v.defaultMuted=true;v.setAttribute('muted','');v.playsInline=true;v.loop=false;v.disableRemotePlayback=true;
  v.addEventListener('ended',()=>{if(v===vids[cur])next(false)});
  v.addEventListener('error',()=>{if(v===vids[cur]||switching){fails++;log('face clip error',clip,v.error&&v.error.code);if(fails>3){dead=true;img.classList.add('on');vids.forEach(x=>x.classList.remove('on'))}}})}
 // warm the HTTP cache so state switches are instant
 const all=[...new Set(Object.values(SETS).flat())];setTimeout(()=>all.forEach(n=>fetch(BASE+n+'.mp4'+V).catch(()=>{})),300);
 function pick(){const s=SETS[state]||SETS.idle;if(state==='speaking'){const c=s.filter(n=>n!==lastTalk);lastTalk=c[Math.random()*c.length|0];return lastTalk}return s[Math.random()*s.length|0]}
 let gen=0;
 async function next(cross){if(dead)return;const g=++gen;const name=pick();const a=vids[cur],b=vids[1-cur];switching=true;
  b.src=BASE+name+'.mp4'+V;try{b.currentTime=0}catch{}
  try{await b.play()}catch(e){if(g!==gen)return;switching=false;log('face play blocked',String(e&&e.name||e));img.classList.add('on');armGesture();return}
  if(g!==gen){return}
  const swap=()=>{b.classList.add('on');a.classList.remove('on');cur=1-cur;clip=name;switching=false;ok=true;fails=0;img.classList.remove('on');window.__vc&&(__vc.faceClip=name);
   setTimeout(()=>{if(vids[1-cur]===a&&g===gen)try{a.pause()}catch{}},cross?520:60)};
  if(!cross){a.style.transition=b.style.transition='none';swap();requestAnimationFrame(()=>{a.style.transition=b.style.transition=''})}else swap()}
 let armed=false;function armGesture(){if(armed)return;armed=true;const go=()=>{armed=false;removeEventListener('pointerdown',go,true);removeEventListener('touchend',go,true);next(true)};addEventListener('pointerdown',go,true);addEventListener('touchend',go,true)}
 function set(s){const k=s==='thinking'?'listening':s;const prev=state==='thinking'?'listening':state;state=s;if(k===prev&&ok)return;next(true)}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!dead){const v=vids[cur];if(v&&v.paused)v.play().catch(()=>armGesture())}});
 next(false);
 return {set,get clip(){return clip},get ok(){return ok&&!dead},root}}
