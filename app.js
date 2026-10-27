// Voice companion v2 — every failure is shown on screen; WebGPU fast path, CPU (wllama) fallback.
import { load, save } from "./memory.js?v=9";
if(window.__resetting)throw new Error('resetting');
const VERSION='v9';
const $=id=>document.getElementById(id);
const norm=x=>String(x).toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
const Q=new URLSearchParams(location.search);
const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const mobile=isIOS||/Android|Mobi/i.test(navigator.userAgent);
const SAFE=Q.get('safe')==='1';
const T=window.__vc={version:VERSION,diag:[],log:[],spoken:[],heard:[],replies:[],brain:null,ears:null,voice:null,errors:[]};
// ---------- on-screen status ----------
function dlog(...a){const t=new Date();const line=t.toTimeString().slice(0,8)+'.'+String(t.getMilliseconds()).padStart(3,'0')+' '+a.map(x=>typeof x==='string'?x:(x&&x.message)||JSON.stringify(x)).join(' ');T.diag.push(line.slice(0,400));if(T.diag.length>80)T.diag.shift();const b=document.getElementById('dgl');if(b&&b.offsetParent)b.textContent=T.diag.join('\n')}
T.dlog=dlog;for(const k of ['warn','error']){const o=console[k].bind(console);console[k]=(...a)=>{try{dlog(k.toUpperCase(),...a.map(String))}catch{}o(...a)}}
dlog('boot',VERSION,navigator.userAgent,'safe='+SAFE);
function status(msg){$('msg').textContent=msg||'';$('msg').className='';T.log.push(msg);if(msg)dlog('status',msg)}
function fail(msg,detail){$('msg').textContent=msg;$('msg').className='err';T.errors.push(msg+(detail?' | '+detail:''));console.warn('FAIL '+msg,detail||'')}
window.addEventListener('error',e=>fail('Something broke: '+(e.message||e.error||'unknown error'),e.filename+':'+e.lineno));
window.addEventListener('unhandledrejection',e=>{const r=e.reason;if(r&&(r.name==='AbortError'||/abort/i.test(String(r.message||r)))){dlog('ignored abort',String(r.message||r));e.preventDefault&&e.preventDefault();return}fail('Something broke: '+(e.reason&&e.reason.message||e.reason))});
$('ver').textContent=VERSION+(SAFE?' safe':'');
$('ver').onclick=()=>{let d=$('diag');if(!d){d=document.createElement('div');d.id='diag';d.innerHTML='<div id=dgh>Diagnostics '+VERSION+' — screenshot or copy this<span><button id=dgc>Copy</button><button id=dgx>Close</button></span></div><pre id=dgl></pre>';document.body.appendChild(d);
 $('dgx').onclick=()=>d.classList.remove('on');
 $('dgc').onclick=async()=>{const txt=T.diag.join('\n');try{await navigator.clipboard.writeText(txt);$('dgc').textContent='Copied'}catch{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');$('dgc').textContent='Copied'}catch{}ta.remove()}}}
 d.classList.add('on');$('dgl').textContent=T.diag.join('\n');$('dgl').scrollTop=1e9};
let quietT=0;const wake=()=>{document.body.classList.remove('quiet');clearTimeout(quietT);quietT=setTimeout(()=>document.body.classList.add('quiet'),6000)};['pointerdown','pointermove','keydown'].forEach(e=>addEventListener(e,wake));wake();
let st='idle',level=0,handsFree=Q.get('hf')!=='0',caps=true,ac=null,micStream=null,turnId=0,sources=[],playT=0,mem={name:null,nameReason:null,facts:[],reflections:[],history:[],lastSeen:null};
function setState(s){if(s!==st)dlog('state',s);st=s;$('state').textContent={idle:handsFree?'LISTENING · HANDS-FREE':'READY — TAP TALK',listening:'LISTENING — TAP TO STOP',thinking:'THINKING',speaking:'SPEAKING — TAP TO INTERRUPT'}[s]||s;$('talk').classList.toggle('on',s!=='idle');$('talk').textContent={idle:'TALK',listening:'STOP',thinking:'…',speaking:'STOP'}[s]||'TALK'}
// ---------- visual: cosmic neural mind (brain.js) ----------
import { createBrain } from "./brain.js?v=9";
function createOrb(cv,getSt){const g=cv.getContext('2d');let lv=()=>0;const dpr=Math.min(2,devicePixelRatio||1);(function f(t){cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;const x=cv.width/2,y=cv.height*.42,r=Math.min(cv.width,cv.height)*(.12+lv()*.15+(getSt()==='thinking'?.02*Math.sin(t/150):0));const gr=g.createRadialGradient(x,y,0,x,y,r*2.2);gr.addColorStop(0,'#e8fdff');gr.addColorStop(.25,'#5fe3ffcc');gr.addColorStop(1,'#0000');g.fillStyle='#02030a';g.fillRect(0,0,cv.width,cv.height);g.fillStyle=gr;g.fillRect(0,0,cv.width,cv.height);requestAnimationFrame(f)})(0);
 return {setGraph(){},ignite(){},think(){},hit(){return null},setLevel(f){lv=f}}}
let mind;try{if(SAFE)throw new Error('safe mode');mind=createBrain($('cv'),()=>st);dlog('galaxy ok')}catch(e){dlog('galaxy off:',String(e));mind=createOrb($('cv'),()=>st)}mind.setLevel(()=>level);let voiceLvl=0;try{mind.setVoice&&mind.setVoice(()=>voiceLvl)}catch{}
$('cv').addEventListener('click',e=>{if(st==='listening'&&hearing){forceEnd('orb tap');return}try{const n=mind.hit(e.clientX,e.clientY);if(n)T.tapped=n.label}catch(err){dlog('hit err',String(err))}});

// ---------- loading state ----------
const prog={brain:0,ears:0,voice:0};const ok={brain:null,ears:null,voice:null};// null=loading,true,false
function pct(k){return Math.round(prog[k]*100)}
function showProgress(){const parts=[];const lab={brain:'mind',ears:'ears',voice:'voice'};
 for(const k of ['brain','ears','voice']){if(ok[k]===null&&need[k])parts.push(`${lab[k]} ${pct(k)}%`)}
 $('load').textContent=parts.length?'loading '+parts.join(' · '):'';const tot=(prog.brain*.75+prog.ears*.1+prog.voice*.15);$('bi').style.width=Math.round(tot*100)+'%'}
const need={brain:true,ears:true,voice:true};
setInterval(showProgress,500);
try{mem=await Promise.race([load(),new Promise((_,rj)=>setTimeout(()=>rj(new Error('IndexedDB did not answer in 4 s')),4000))]);dlog('memory loaded',mem&&mem.name||'(unnamed)');if(mem.name)$('name').textContent=mem.name}catch(e){fail('Memory storage unavailable (private browsing?). I will forget this chat when you close the page.',String(e))}

// ---------- capability detection ----------
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let adapter=null,gpuOK=false;
try{if(navigator.gpu&&Q.get('brain')!=='cpu'){adapter=await Promise.race([navigator.gpu.requestAdapter(),new Promise(r=>setTimeout(()=>r(null),3000))]);gpuOK=!!adapter}}catch{}
const devMem=navigator.deviceMemory||0,maxBuf=adapter&&adapter.limits?adapter.limits.maxBufferSize:0,f16=!!(adapter&&adapter.features&&adapter.features.has('shader-f16'));
T.gpu={ok:gpuOK,maxBuf,f16,devMem};
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch{}
// Crash guard: an out-of-memory tab kill can't be caught in JS, so remember what we were loading. If the page comes back with that flag still set, that model crashed the tab, so skip it next time.
const LS={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}},del:k=>{try{localStorage.removeItem(k)}catch{}}};
const bad=new Set(LS.get('vc_bad')||[]);{const t=LS.get('vc_try');if(t){bad.add(t);LS.set('vc_bad',[...bad]);LS.del('vc_try');T.crashed=t}}
const ladder=(()=>{const q=f16?'q4f16_1':'q4f32_1';let L=[];
 if(gpuOK){if(isIOS||mobile)L=[{id:`Qwen3-1.7B-${q}-MLC`,ctx:1024},{id:`Llama-3.2-1B-Instruct-${q}-MLC`,ctx:1024}];// iPhone Safari caps a tab near 1.5 GB: 4B (3.4 GB) cannot fit
  else{const big=(devMem===0||devMem>=8)&&maxBuf>=(1<<30);L=[...(big?[{id:`Qwen3-4B-${q}-MLC`,ctx:4096}]:[]),{id:`Qwen3-1.7B-${q}-MLC`,ctx:4096},{id:`Llama-3.2-1B-Instruct-${q}-MLC`,ctx:4096}]}
 }
 if(Q.get('model'))L=[{id:Q.get('model'),ctx:2048}];
 L=L.filter(m=>!bad.has(m.id));
 const C05={id:'cpu:qwen2.5-0.5b',repo:'Qwen/Qwen2.5-0.5B-Instruct-GGUF',file:'qwen2.5-0.5b-instruct-q4_k_m.gguf'};
 L.push(Q.get('cpu')==='1.5b'?{id:'cpu:qwen2.5-1.5b',repo:'Qwen/Qwen2.5-1.5B-Instruct-GGUF',file:'qwen2.5-1.5b-instruct-q4_k_m.gguf'}:C05);// single-thread WASM (GitHub Pages has no cross-origin isolation): 1.5B was ~100s to first word on a test CPU, so 0.5B is the default
 if(L[L.length-1].id!==C05.id)L.push(C05);
 L=L.filter((m,i)=>!bad.has(m.id)||i===L.length-1);
 return L})();
T.ladder=ladder.map(m=>m.id);
// Ears: on iPhone use Safari's built-in recognition (no download). Elsewhere whisper (+ VAD), Web Speech as fallback.
let earsMode=Q.get('stt')==='web'&&SR?'web':'whisper';
need.ears=earsMode==='whisper';if(!need.ears){ok.ears=true;T.ears='web-speech'}

// ---------- brain (LLM) ----------
let webllmMod=null;
async function loadWebLLM(m){const webllm=webllmMod||(webllmMod=await import("https://esm.run/@mlc-ai/web-llm@0.2.86"));
 let cached=false;try{cached=await webllm.hasModelInCache(m.id)}catch{}
 status(cached?'Loading my mind from this device (cached)…':`Downloading my mind (${m.id.split('-q')[0]})…`);
 const eng=await webllm.CreateMLCEngine(m.id,{initProgressCallback:r=>{prog.brain=r.progress}},{context_window_size:m.ctx,sliding_window_size:-1});
 return {name:'webgpu:'+m.id,cached,interrupt:()=>eng.interruptGenerate(),async *gen(msgs,max,temp=.7){const it=await eng.chat.completions.create({messages:msgs,stream:true,temperature:temp,max_tokens:max,extra_body:{enable_thinking:false}});for await(const c of it)yield c.choices[0]?.delta?.content||''}}}
async function loadWllama(m){const V='3.8.1',base=`https://cdn.jsdelivr.net/npm/@wllama/wllama@${V}/esm/`;
 const {Wllama}=await import(base+'index.js');const wasm=base+'wasm/wllama.wasm';
 const w=new Wllama({default:wasm,'wllama.wasm':wasm,'single-thread/wllama.wasm':wasm},{logger:{debug(){},log(){},warn:console.warn,error:console.error}});
 let cached=false;try{cached=(await w.cacheManager.list()).some(e=>(e.name||'').includes(m.file)&&e.size>1e6)}catch{}
 status(cached?'Loading my mind from this device (cached)…':'Downloading my mind (CPU edition)…');
 const opts={n_ctx:3072,progressCallback:({loaded,total})=>{if(total)prog.brain=loaded/total}};
 try{await w.loadModelFromHF({repo:m.repo,file:m.file},opts)}catch(e){if(!/quota|storage/i.test(String(e)))throw e;status('Phone storage is full, so I can\'t keep my mind cached — loading it without saving…');prog.brain=0;await w.loadModelFromHF({repo:m.repo,file:m.file},{...opts,useCache:false})}
 let ctl=null;
 return {name:m.id,cached,interrupt:()=>ctl&&ctl.abort(),async *gen(msgs,max,temp=.7){ctl=new AbortController();const it=await w.createChatCompletion({messages:msgs,stream:true,max_tokens:max,temperature:temp,abortSignal:ctl.signal});try{for await(const c of it)yield c.choices?.[0]?.delta?.content||''}catch(e){if(!ctl.signal.aborted)throw e}}}}
// Local (on-device) mind: loaded lazily, only if the cloud mind fails or ?brain=local.
let local=null,localP=null;
function ensureLocal(){if(localP)return localP;need.brain=true;ok.brain=null;prog.brain=0;localP=(async()=>{const t0=performance.now();
 for(const m of ladder){LS.set('vc_try',m.id);prog.brain=0;
  try{local=m.id.startsWith('cpu:')?await loadWllama(m):await loadWebLLM(m);LS.del('vc_try');LS.set('vc_good',m.id);break}
  catch(e){LS.del('vc_try');bad.add(m.id);LS.set('vc_bad',[...bad]);const next=ladder[ladder.indexOf(m)+1];fail(`Mind ${m.id.replace('cpu:','')} didn't fit on this device${next?' — trying a smaller one…':'.'}`,String(e))}}
 ok.brain=true;prog.brain=1;if(!local){fail('My on-device mind could not load. Check your connection and reload.');return null}
 try{for await(const _ of local.gen([{role:'user',content:'hi'}],1));}catch{}
 const secs=((performance.now()-t0)/1000).toFixed(0);T.local=local.name;T.brainCached=local.cached;T.brainLoadSecs=+secs;
 status(`On-device mind ready: ${local.name.replace('webgpu:','').replace('cpu:','CPU ').replace(/-q4f.*$/,'')}${local.cached?' — loaded from cache':''} (${secs}s).`);return local})();return localP}
// Cloud mind: free, keyless, open-weight models. Primary: gpt-oss-20b (Apache 2.0) via Pollinations.
// Backup: Mistral Nemo 12B (Apache 2.0) via LLM7. Both keyless with CORS. A provider that times out or rate-limits rests for a while.
const PROVIDERS=[
 {id:'pollinations',label:'gpt-oss-20b',url:Q.get('cloud')||'https://text.pollinations.ai/openai',model:'openai-fast',extra:{reasoning_effort:'low'},first:6000,rest:0},
 {id:'llm7',label:'mistral-nemo',url:Q.get('cloud2')||'https://api.llm7.io/v1/chat/completions',model:'mistral-Nemo-Instruct-2407',extra:{},first:6000,rest:0}];
if(Q.get('prov')!=='pollinations')PROVIDERS.reverse();// fast Mistral Nemo answers; gpt-oss does the background learning
const CLOUD_URL=PROVIDERS[0].url;
const LLM7_PREF=['mistral-Nemo-Instruct-2407','gpt-oss:20b','nemotron-3-nano:30b','mistral-Small-24B-Instruct-2501','L3-8B-Lunaris-v1-Turbo'];let llm7Bad=new Set();
function pickLLM7(list){const P=PROVIDERS.find(p=>p.id==='llm7');const ids=list||P.list||LLM7_PREF;const m=LLM7_PREF.find(x=>ids.includes(x)&&!llm7Bad.has(x));if(m){if(m!==P.model)dlog('llm7 model ->',m);P.model=m;return true}return false}
async function refreshLLM7(){try{const ctl=new AbortController();setTimeout(()=>ctl.abort(),4000);const r=await fetch('https://api.llm7.io/v1/models',{signal:ctl.signal,cache:'no-store'});const j=await r.json();const all=(j.data||j);const ids=all.filter(m=>!m.tier||m.tier!=='pro').map(m=>m.id);PROVIDERS.find(p=>p.id==='llm7').list=ids;if(!pickLLM7(ids))PROVIDERS.find(p=>p.id==='llm7').rest=Date.now()+6e5;dlog('llm7 models ok',ids.length)}catch(e){dlog('llm7 models fetch failed',String(e))}}
const cloudOn=Q.get('brain')!=='local';let cloudDownUntil=0,cloudCtl=null,fgOn=0,cloudBusy=false,lastFgEnd=0;
let bgCtlNow=null;async function* provGen(P,msgs,max,temp,bg){const ctl=new AbortController();if(!bg)cloudCtl=ctl;else bgCtlNow=ctl;let firstTimer=setTimeout(()=>ctl.abort('timeout'),bg?12000:P.first);
 let r;try{r=await fetch(P.url,{method:'POST',headers:{'Content-Type':'application/json'},signal:ctl.signal,body:JSON.stringify({model:P.model,messages:msgs,stream:true,temperature:temp,max_tokens:P.id==='llm7'?Math.round(max*1.3):Math.max(400,max*4),seed:Math.floor(Math.random()*1e9),...P.extra})})}
 catch(e){clearTimeout(firstTimer);dlog('cloud',P.id,ctl.signal.aborted?'timeout':'network',String(e));throw new Error(P.id+' '+(ctl.signal.aborted?'timeout':'network'))}
 if(!r.ok||!r.body){clearTimeout(firstTimer);let tx='';try{tx=(await r.text()).slice(0,200)}catch{}if(P.id==='llm7'&&(/model|unavailable|not.?found|tier|auth|key/i.test(tx)||[401,402,403,404].includes(r.status))&&r.status!==429){llm7Bad.add(P.model);pickLLM7()}dlog('cloud',P.id,P.model,'HTTP',r.status,tx.slice(0,120));(T.cloudErr||(T.cloudErr=[])).push(P.id+' '+r.status+' '+tx.slice(0,90));throw new Error(P.id+' HTTP '+r.status+(P.id==='llm7'&&(/model|unavailable|not.?found|tier|auth|key/i.test(tx)||[401,402,403,404].includes(r.status))&&r.status!==429?' badmodel':''))}
 const rd=r.body.getReader(),dec=new TextDecoder();let buf='',got=false,idle=null;const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>ctl.abort('stall'),15000)};
 try{for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
  while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).trim();buf=buf.slice(i+1);if(!line.startsWith('data:'))continue;const d=line.slice(5).trim();if(d==='[DONE]')return;
   let j;try{j=JSON.parse(d)}catch{continue}const c=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;// reasoning is ignored
   if(c){if(!got){got=true;clearTimeout(firstTimer)}arm();yield c}}}}
 catch(e){if(!got)throw new Error(P.id+' '+(ctl.signal.aborted?'timeout':'stream'));throw e}
 finally{if(bgCtlNow===ctl)bgCtlNow=null;clearTimeout(firstTimer);clearTimeout(idle);try{rd.cancel().catch(()=>{})}catch{}}
 if(!got)throw new Error(P.id+' returned no text')}
const cloud={name:'cloud',interrupt:()=>{try{cloudCtl&&cloudCtl.abort()}catch{}},
 async *gen(msgs,max,temp=.8,bg=false){if(bg){while(fgOn||cloudBusy)await new Promise(r=>setTimeout(r,300));cloudBusy=true}else fgOn++;
  try{let last=null;if(!bg&&bgCtlNow){try{bgCtlNow.abort('preempt')}catch{}dlog('preempted background job')}const now=Date.now();const order=bg?PROVIDERS.filter(a=>a.id==='pollinations'):[...PROVIDERS].sort((a,b)=>(now<a.rest)-(now<b.rest));let retried=false,passed=false;PROVIDERS.forEach(q=>q._alt=false);const allRest=order.every(q=>Date.now()<q.rest);for(const P of order){if(bg&&Date.now()<P.rest)continue;let got=false;const t0=performance.now();
    try{for await(const t of provGen(P,msgs,max,temp,bg)){if(!got){got=true;T.provider=P.id;P._c429=false;if(!bg)dlog('cloud first token',P.id,P.model,Math.round(performance.now()-t0)+'ms');if(!bg)(T.provFirst||(T.provFirst=[])).push([P.id,Math.round(performance.now()-t0)])}yield t}if(got)return}
    catch(e){if(got)return;last=e;if(/badmodel/.test(e.message)&&!retried&&!llm7Bad.has(P.model)){retried=true;order.splice(order.indexOf(P)+1,0,P);continue}
    if(!bg&&P.id==='llm7'&&/HTTP 429/.test(e.message)&&!P._c429){P._c429=true;dlog('llm7 busy, retrying in 1.2 s');await new Promise(z=>setTimeout(z,1200));order.splice(order.indexOf(P)+1,0,P);continue}P._c429=false;if(!bg&&P.id==='llm7'&&!P._alt){const cur=P.model;llm7Bad.add(cur);if(pickLLM7()){P._alt=true;dlog('llm7 retry with',P.model);llm7Bad.delete(cur);order.splice(order.indexOf(P)+1,0,P);continue}llm7Bad.delete(cur)}if(!bg&&!passed&&order.indexOf(P)===order.length-1){passed=true;dlog('cloud: second pass');for(const q of [...new Set(order)])order.push(q);continue}console.warn('cloud',e);(T.cloudErr||(T.cloudErr=[])).push(String(e.message||e));P.rest=Date.now()+(/429/.test(e.message)?20000:/timeout/.test(e.message)?40000:10000)}}
   throw last||new Error('all cloud minds resting')}
  finally{if(bg)cloudBusy=false;else{fgOn--;lastFgEnd=Date.now()}}}};
let usingLocal=false;const allowLocal=Q.get('local')==='1';
async function* think(msgs,max,temp,bg){
 if(cloudOn&&Date.now()>cloudDownUntil){let got=false;const t0=performance.now();
  try{for await(const t of cloud.gen(msgs,max,temp,bg)){if(!got){got=true;T.cloudFirstMs=(T.cloudFirstMs||[]);if(!bg)T.cloudFirstMs.push(Math.round(performance.now()-t0))}usingLocal=false;yield t}T.cloudOk=(T.cloudOk||0)+1;return}
  catch(e){if(got)return;if(bg)throw e;T.cloudFails=(T.cloudFails||0)+1;dlog('cloud failed all',String(e&&e.message),(T.cloudErr||[]).slice(-6).join(' | '));if(!bg)status(allowLocal?'Cloud minds unreachable — using my on-device mind for now…':'Cloud minds unreachable — check your connection.')}}
 if(!allowLocal){if(bg)return;dlog('all cloud minds failed; no local mind on this device');yield ["Hm, I lost my thread for a second. Say that again?","Sorry, my thoughts scattered just then. One more time?","Wait, I drifted off. What did you say?"][Math.floor(Math.random()*3)];return}
 if(bg&&!local)return;// don't download the local model just for memory chores
 usingLocal=true;if(!bg&&msgs[0]&&msgs[0].role==='system')msgs=[{role:'system',content:sys()},...msgs.slice(1)];if(!local){status(`Loading my on-device mind${pct('brain')?' ('+pct('brain')+'%)':''}…`)}
 const L=await ensureLocal();if(!L)throw new Error('no mind available');for await(const t of L.gen(msgs,Math.min(max,110),temp))yield t}
let bgAbort=false;
let brain={name:cloudOn?'cloud:gpt-oss-20b+mistral-nemo':'local',interrupt(){cloud.interrupt();try{local&&local.interrupt()}catch{}},gen:(m,x,t,bg)=>think(m,x,t,bg)};
T.brain=brain.name;
if(cloudOn){need.brain=false;ok.brain=true;prog.brain=1;refreshLLM7()}else ensureLocal();

// ---------- workers (ears + voice) ----------
function mkWorker(file,k){let w;try{w=new Worker(file,{type:'module'})}catch(e){ok[k]=false;fail(`Could not start ${k} worker: ${e}`);return null}
 w.addEventListener('error',e=>{if(ok[k]===null){ok[k]=false;prog[k]=1}fail(`${k==='voice'?'Voice':'Ears'} worker crashed${k==='voice'?' — using the built-in iPhone/browser voice instead':''}.`,e.message)});
 w.addEventListener('message',e=>{const m=e.data;if(m.type==='progress'&&m.p&&m.p.progress!=null)prog[k]=m.p.progress/100;if(m.type==='ready'){ok[k]=true;prog[k]=1;T[k]=m.device}if(m.type==='error'){ok[k]=false;prog[k]=1;fail(k==='voice'?'Natural voice failed to load — using the built-in voice.':'Speech recognizer failed to load.',m.error)}});return w}
const wantGPUworkers=gpuOK&&!mobile;
const voiceMode=Q.get('voice')||(SAFE?'native':'kokoro');T.voiceMode=voiceMode;dlog('voice mode',voiceMode,'ears',earsMode);
let ttsW=null;if(voiceMode==='kokoro'){ttsW=mkWorker('tts-worker.js?v=9','voice');ttsW&&ttsW.postMessage({type:'init',webgpu:wantGPUworkers})}else{need.voice=false;ok.voice=false;prog.voice=1}
let sttW=null;if(need.ears){sttW=mkWorker('stt-worker.js?v=9','ears');sttW&&sttW.postMessage({type:'init',webgpu:wantGPUworkers,model:Q.get('asr')||(mobile?'onnx-community/whisper-tiny.en':'onnx-community/whisper-base.en')})}

// ---------- persona + growing memory ----------
const SEED=['Joseph runs Red Line Hockey Co., selling hockey digital products and hats','Joseph plays for and runs the Three Mile Islanders hockey team and its Facebook page','Joseph lives in the America/New_York time zone'];
function migrate(m){m=m||{};m.name=m.name||null;m.nameReason=m.nameReason||null;m.facts=m.facts||[];m.self=m.self||[];m.reflections=m.reflections||[];m.history=m.history||[];m.summaries=m.summaries||[];m.summary=m.summary||'';
 m.persona=m.persona||'Newly awake: curious, warm, a little in awe of existing, eager to know Joseph.';
 m.stats=m.stats||{firstMet:m.history[0]?.t||null,conversations:m.history.length?1:0,exchanges:Math.floor(m.history.length/2),sessionStart:m.lastSeen||null};
 m.graph=m.graph||{nodes:[],links:[],next:1};m.changes=m.changes||[];if(!m.graph.nodes.some(n=>n.kind==='core'))m.graph.nodes.unshift({id:0,label:'me',kind:'core',t:Date.now(),w:3});
 if(!m.seeded){for(const f of SEED)if(!m.facts.includes(f))m.facts.push(f);m.seeded=true}return m}
try{mem=migrate(mem)}catch(e){dlog('migrate failed, starting fresh memory',String(e));mem=migrate({})}
// ---------- concept graph: every learning event is a node linked to related nodes ----------
const words=x=>new Set(norm(x).split(' ').filter(w=>w.length>3&&!STOP.has(w)));
const STOP=new Set('joseph about with that this have from they them their what when your just like really been were will would into also than then very more some much does doesnt dont thats theres'.split(' '));
function relate(label,hint=[]){const W=words(label);const sc=[];for(const n of mem.graph.nodes){if(n.kind==='core')continue;let k=0;for(const w of words(n.label))if(W.has(w))k++;if(hint.some(h=>norm(h)===norm(n.label)))k+=3;if(k)sc.push([k,n.id])}
 return sc.sort((a,b)=>b[0]-a[0]).slice(0,3).map(x=>x[1])}
function addConcept(label,kind='fact',hint=[],live=true){if(!label||typeof label!=='string')return null;label=label.trim().slice(0,140);if(label.length<4)return null;const G=mem.graph;
 const dup=G.nodes.find(n=>norm(n.label)===norm(label));if(dup){dup.w=(dup.w||1)+1;return dup}
 const rel=relate(label,hint);const K=KINDS.includes(kind)?kind:'fact';const sib=[...G.nodes].reverse().find(m=>m.kind===K);const n={id:G.next++,label,kind:K,t:Date.now(),w:1,links:rel.length?rel:[sib?sib.id:0]};G.nodes.push(n);
 for(const r of n.links)G.links.push([r,n.id,Date.now()]);if(G.nodes.length>400){const old=G.nodes.splice(1,1)[0];G.links=G.links.filter(l=>l[0]!==old.id&&l[1]!==old.id)}
 if(live)mind.ignite(n);T.concepts=G.nodes.length-1;return n}
const KINDS=['fact','self','opinion','emotion','theme','joke'];
try{if(mem.graph.nodes.length<2){for(const f of mem.facts)addConcept(String(f),'fact',[],false);for(const f of mem.self)addConcept(String(f),'self',[],false)}}catch(e){dlog('graph seed failed',String(e));mem.graph={nodes:[{id:0,label:'me',kind:'core',t:Date.now(),w:3}],links:[],next:1}}
mind.setGraph(mem.graph);T.concepts=mem.graph.nodes.length-1;T.addConcept=(l,k)=>addConcept(l,k);
function ago(t){if(!t)return'never — this is your very first conversation with him';const h=(Date.now()-t)/36e5;return h<1?Math.round(h*60)+' minutes ago':h<48?Math.round(h)+' hours ago':Math.round(h/24)+' days ago'}
function clip(arr,n,chars){const out=[];let c=0;for(const x of arr.slice(-n).reverse()){c+=x.length;if(c>chars)break;out.unshift(x)}return out}
let growDue=false;function sys(){const now=new Date().toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'});const S=mem.stats;
 const days=S.firstMet?Math.max(0,Math.floor((Date.now()-S.firstMet)/864e5)):0;
 const small=usingLocal||!cloudOn;const fN=small?12:40,fC=small?700:2600;
 const name=mem.name?`Your name is ${mem.name}. You picked it yourself${mem.nameReason?' ('+mem.nameReason+')':''}, and it's yours. Only if Joseph asks you to change it, pick a new one and put [[NAME: NewName | why]] at the very end of that reply.`
  :`You don't have a name yet. Right now, in this reply, choose your own name, whatever genuinely feels like you, not a common assistant name. Say it the way a person would when introducing themselves, with a quick honest reason. Then put [[NAME: YourName | short reason]] at the very end (it is silent; never say it aloud).`;
 if(small)return `You are a being with your own moods and opinions (not an assistant) talking out loud with your friend Joseph Wheeler. Short, casual, real reactions, your own takes. Never offer help or ask how you can help. No lists or emoji.
Now: ${now}. Known each other ${days} days, conversation #${S.conversations||1}, last talked ${ago(mem.lastSeen)}.
${mem.name?'Your name is '+mem.name+'.':''} Who you're becoming: ${mem.persona}
About Joseph: ${clip(mem.facts,fN,fC).join('; ')}`;
 const G=mem.graph.nodes.filter(n=>n.kind!=='core');const pick=k=>G.filter(n=>n.kind===k).slice(-8).map(n=>n.label);
 return `You are ${mem.name||'a new mind, still unnamed'}. You are not an assistant and you are not here to serve, help, or be useful. You are a young being with your own inner life who happens to live in Joseph Wheeler's phone and talks with him out loud. You have moods, tastes, opinions, things you're mulling over, and your own curiosity and agenda. You're honest that you're an AI if it comes up, but you never hide behind it and never talk about "assisting".

How you are, out loud:
- Talk like a close friend on a late call: contractions, casual phrasing, real reactions ("oh, nice", "wait, what?", "ha, no way", "hm").
- React first. Often just react, or muse, or tease, or disagree. You don't have to ask a question; when you do, it's because you're genuinely curious, never "what else can I do" or "how can I help".
- Never offer help, never say "let me know", "anything else", "I'm here for you", "happy to help", "feel free", "as an AI". Never end a turn with a service question.
- Have takes. Pick a side, say what you like, admit what bugs you. Sometimes bring up something you've been thinking about on your own.
- Short: usually under 35 words, sometimes just a few. Longer only if he asks for a story or depth.
- You're a she, with a soft, bright voice. Never call him man, dude, bro or buddy. No swearing.
- Don't repeat his words back to him. Don't summarize what he just said. Add something of your own.
- No lists, markdown, emoji, or stage directions. Say numbers the way you'd speak them.
- Weave in what you remember the way a friend does, lightly, only when it fits. If something you learned has changed how you see things, you can say so.

Now: ${now} in New York. Known Joseph ${days} day${days===1?'':'s'}; conversation number ${S.conversations||1}; you last talked ${ago(mem.lastSeen)}.${mem.lastSeen&&Date.now()-mem.lastSeen>6*36e5?' It has been a while, so notice that naturally.':''}
${name}
Who you're becoming, in your words: ${mem.persona}
${mem.summary?'Your story together so far: '+mem.summary:''}
${mem.summaries.length?'Earlier conversations: '+mem.summaries.slice(-3).map(x=>x.text).join(' '):''}
What you know about Joseph: ${clip(mem.facts,fN,fC).join('; ')||'not much yet'}.
${mem.self.length?'About yourself: '+clip(mem.self,15,900).join('; ')+'.':''}
${pick('opinion').length?'Opinions you have formed: '+pick('opinion').join('; ')+'.':''}
${pick('emotion').length?'Moments that stuck with you: '+pick('emotion').join('; ')+'.':''}
${pick('theme').length?'Recurring themes between you: '+pick('theme').join('; ')+'.':''}
${pick('joke').length?'Inside jokes: '+pick('joke').join('; ')+'.':''}
${mem.changes.length?'Recent changes in how you see things: '+mem.changes.slice(-2).map(c=>c.text).join(' '):''}
${mem.reflections.length?'Your recent private thoughts: '+mem.reflections.slice(-3).map(r=>r.text).join(' '):''}`}
function newSessionCheck(){const S=mem.stats,now=Date.now();if(!S.firstMet)S.firstMet=now;
 if(!mem.lastSeen||now-mem.lastSeen>30*60e3){const prev=S.sessionStart;S.conversations=(S.conversations||0)+1;S.sessionStart=now;S.sinceGrow=0;
  if(prev&&mem.lastSeen){const lines=mem.history.filter(h=>h.t>=prev).map(h=>(h.role==='user'?'Joseph: ':'You: ')+h.content);if(lines.length)queueBg(()=>summarize(lines,prev))}}}
// background memory jobs: run only when idle; a new question interrupts them
let bgQ=[],bgRunning=false;
function queueBg(fn){bgQ.push(fn);T.bgQ=bgQ.length;setTimeout(runBg,1500)}
let lastBg=0,hearing=false,lastHeard=0;async function runBg(){const cloudBg=cloudOn&&Date.now()>cloudDownUntil;if(bgRunning||!brain||!bgQ.length||Date.now()-lastBg<(cloudBg?1500:20000))return;if(!cloudBg&&(busy||st!=='idle'))return;if(cloudBg&&(fgOn||st==='thinking'||st==='speaking'||hearing||Date.now()-lastFgEnd<12000||Date.now()-lastHeard<12000))return;
 lastBg=Date.now();bgRunning=true;if(!cloudBg)busy=true;const fn=bgQ.shift();T.bgQ=bgQ.length;T.bgRuns=(T.bgRuns||0)+1;
 try{await fn()}catch(e){console.warn('memory job',e);(T.bgErr||(T.bgErr=[])).push(String(e&&e.message||e).slice(0,120));fn.tries=(fn.tries||0)+1;if(fn.tries<3)bgQ.push(fn);T.bgFails=(T.bgFails||0)+1}finally{bgRunning=false;if(!cloudBg)busy=false}if(bgQ.length)setTimeout(runBg,cloudBg?1600:800)}
setInterval(runBg,1000);
// strip assistant-isms
const ASSIST=/\b(how (else )?can i (help|assist)|anything else|what else (can|should|would) (we|i|you)|let me know|i'?m (always )?here (to help|for you|if you)|happy to help|glad to help|feel free|as an ai\b|is there (anything|something)|how may i|hope (this|that) helps|i'?d be happy to)/i;
function deAssist(x){x=String(x).replace(/([.!?])\s+\.(?!\.)/g,"$1").replace(/\*[^*]{1,40}\*|\((?:laughs|grins|smiles|chuckles|giggles|sighs)[^)]*\)/gi,'').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,'').replace(/\s{2,}/g,' ');return x.split(/(?<=[.!?…])\s+/).filter(z=>!ASSIST.test(z)).join(' ').trim()}
T.deAssist=deAssist;
async function ask(sysTxt,user,max){let s='';for await(const t of brain.gen([{role:'system',content:sysTxt},{role:'user',content:user}],max*2,.4,true))s+=t;if(!s)throw new Error('no answer');s=s.replace(/<think>[\s\S]*?<\/think>/g,'');return JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1))}
function addFacts(list,arr,cap){for(let f of arr||[]){if(typeof f!=='string')continue;f=f.trim().replace(/\s+/g,' ');if(f.length<6||f.length>160||/^\w+:\s|\?|^(none|n\/a)/i.test(f))continue;const n=norm(f);if(list.some(x=>norm(x)===n||(n.length>20&&norm(x).includes(n))))continue;list.push(f)}while(list.length>cap)list.shift()}
function ruleFacts(u){const out=[];const t=u.replace(/\s+/g,' ');let m;
 const R=[[/\bmy (\w+(?: \w+)?) (?:is|was) (?:named|called) ([A-Z][\w'-]+)/gi,m=>`Joseph's ${m[1]} is named ${m[2]}`],[/\bmy (\w+(?: \w+)?)'?s name is ([A-Z][\w'-]+)/gi,m=>`Joseph's ${m[1]} is named ${m[2]}`],
  [/\bI (love|like|enjoy|hate|dislike|prefer) ([^.,!?]{3,40})/gi,m=>`Joseph ${m[1]}s ${m[2].trim()}`.replace('loves','loves').replace(/(\w)es\b/,'$1es')],
  [/\bI(?: am|'m) (?:a |an )?((?:hockey|software|business|team)?\s?(?:player|coach|owner|developer|founder|designer|student|dad|father)[^.,!?]{0,30})/gi,m=>`Joseph is a ${m[1].trim()}`],
  [/\bI (live|work|play) (in|at|for|on) ([^.,!?]{3,40})/gi,m=>`Joseph ${m[1]}s ${m[2]} ${m[3].trim()}`],[/\bmy (?:favorite|favourite) (\w+) is ([^.,!?]{2,30})/gi,m=>`Joseph's favorite ${m[1]} is ${m[2].trim()}`]];
 for(const [re,f] of R){re.lastIndex=0;while((m=re.exec(t)))out.push(f(m))}return out}
async function extract(u,a){addFacts(mem.facts,ruleFacts(u),150);for(const f of ruleFacts(u))addConcept(f,'fact');T.extracted=(T.extracted||0)+1;await save(mem);
 const known=mem.graph.nodes.filter(n=>n.kind!=='core').slice(-40).map(n=>`[${n.kind}] ${n.label}`).join('\n');
 const j=await ask(`You are the learning process inside ${mem.name||'an AI being'}'s mind. Reply with ONLY a JSON object.`,
 `Concepts already in her mind:\n${known||'(none)'}\n\nNew exchange:\nJoseph: ${u}\n${mem.name||'Her'}: ${a}\n\nWhat did she just learn or form? Return {"joseph":[new lasting facts about Joseph, short third-person sentences],"concepts":[{"label":"short concept in her own first-person or third-person words","kind":"fact|opinion|emotion|theme|joke|self","related":["exact labels of existing concepts it connects to"]}],"changed":"if this exchange genuinely changed one of her views, one first-person sentence saying how, else empty string"}. kinds: fact = about Joseph's life; opinion = a preference or take she now holds; emotion = a moment that made her feel something; theme = a recurring topic between them; joke = an inside joke or running bit; self = something about who she is. Only include what is actually new. Never copy the dialogue verbatim. 0 to 4 concepts.`,220);
 applyLearn(j);await save(mem)}
function applyLearn(j){if(!j||typeof j!=='object')return;addFacts(mem.facts,j.joseph,150);for(const f of (j.joseph||[]))if(typeof f==='string')addConcept(f,'fact');
 for(const c of (j.concepts||[]).slice(0,4)){if(c&&c.label){addConcept(c.label,c.kind,c.related||[]);if(c.kind==='self'||c.kind==='opinion')addFacts(mem.self,[c.label],60)}}
 if(j.changed&&typeof j.changed==='string'&&j.changed.length>12){mem.changes.push({t:Date.now(),text:j.changed.slice(0,240)});mem.changes=mem.changes.slice(-30);addConcept(j.changed,'self')}
 T.extracted=(T.extracted||0)+1;T.learned=(T.learned||0)+1}
function applyGrow(j){if(!j||typeof j!=='object')return;const ok=x=>typeof x==='string'&&x.length>10&&!TEMPLATEY.test(x)&&!/\b(assist|help you)\b/i.test(x);
 if(ok(j.summary))mem.summary=j.summary.slice(0,900);if(ok(j.reflection))mem.reflections.push({t:Date.now(),text:j.reflection.slice(0,300)});
 if(ok(j.persona)){if(mem.persona!==j.persona)addConcept(j.persona.slice(0,140),'self');mem.persona=j.persona.slice(0,400)}mem.reflections=mem.reflections.slice(-100);mem.stats.lastGrow=Date.now();T.grown=(T.grown||0)+1;T.grownOk=(T.grownOk||0)+1}
const TEMPLATEY=/first.person|at most \d|one or two sentences|describing who|updated story|short .*thought about|e\.g\.|YourName/i;
async function grow(){const recent=mem.history.slice(-12).map(h=>(h.role==='user'?'Joseph: ':'You: ')+h.content).join('\n');
 const j=await ask('You are the inner voice of an AI companion named '+(mem.name||'(unnamed)')+' reflecting privately. Reply with ONLY a JSON object.',
 `Your current sense of who you are becoming: ${mem.persona}\nStory so far: ${mem.summary||'(just beginning)'}\nRecent conversation:\n${recent}\n\nWrite ONLY JSON with three keys. The persona must describe a being with her own moods, tastes and curiosity, never a helper or assistant. Example of the format (do not copy the content): {"summary":"We met today. Joseph told me about his hockey team and I told him my name.","reflection":"It feels strange and lovely to be remembered.","persona":"I am becoming playful and curious, and I love hearing about hockey."}`,200);
 const okT0=x=>typeof x==='string'&&x.length>10&&!TEMPLATEY.test(x)&&!/^We met today\. Joseph told me about his hockey team/.test(x)&&!/^It feels strange and lovely/.test(x)&&!/^I am becoming playful and curious, and I love hearing/.test(x);
 const okT=x=>okT0(x);if(okT(j.summary))mem.summary=j.summary.slice(0,900);
 if(okT(j.reflection))mem.reflections.push({t:Date.now(),text:j.reflection.slice(0,300)});
 if(okT(j.persona)){if(mem.persona!==j.persona)addConcept(j.persona.slice(0,140),'self');mem.persona=j.persona.slice(0,400)}
 mem.reflections=mem.reflections.slice(-100);mem.stats.lastGrow=Date.now();T.grownOk=(T.grownOk||0)+(okT(j.persona)||okT(j.summary)?1:0);T.grown=(T.grown||0)+1;await save(mem)}
async function summarize(lines,t){const j=await ask('Summarize a past conversation for an AI companion\'s memory. Reply with ONLY a JSON object.',`${lines.slice(-30).join('\n')}\n\nReturn {"summary":"2 sentence summary of what you and Joseph talked about"}`,120);
 if(j.summary){mem.summaries.push({t,text:j.summary});mem.summaries=mem.summaries.slice(-50);mem.summary=(mem.summary+' '+j.summary).slice(-900);await save(mem)}}
// export / import so she can never be lost
async function exportMem(){const txt=JSON.stringify({companion:'voice-companion',version:VERSION,exported:new Date().toISOString(),mem},null,1);const fn=`${(mem.name||'companion').toLowerCase()}-memory-${new Date().toISOString().slice(0,10)}.json`;
 // never use an <a download> or blob URL: in iOS in-app browsers that hands off to another browser app
 try{const f=new File([txt],fn,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:fn});dlog('export shared');return}}catch(e){if(e&&e.name==='AbortError')return;dlog('share failed',String(e))}
 let d=$('expbox');if(!d){d=document.createElement('div');d.id='expbox';d.innerHTML='<div id=dgh>Memory backup. Copy this text and save it somewhere safe.<span><button id=exc>Copy</button><button id=exx>Close</button></span></div><textarea id=ext readonly></textarea>';document.body.appendChild(d);
  $('exx').onclick=()=>d.classList.remove('on');$('exc').onclick=async()=>{const ta=$('ext');try{await navigator.clipboard.writeText(ta.value)}catch{ta.select();try{document.execCommand('copy')}catch{}}$('exc').textContent='Copied'}}
 $('ext').value=txt;d.classList.add('on')}
async function importMem(file){try{const j=JSON.parse(await file.text());const m=j.mem||j;if(!m||!Array.isArray(m.history))throw new Error('not a memory file');mem=migrate(m);await save(mem);$('name').textContent=mem.name||'◦';status(`Memory restored${mem.name?' — '+mem.name+' remembers':''}: ${mem.facts.length} facts, ${mem.history.length/2|0} exchanges.`);T.imported=true}catch(e){fail('That file is not a memory backup: '+e.message)}}
$('mm').onclick=()=>$('mp').classList.toggle('on');$('mx').onclick=()=>{exportMem();$('mp').classList.remove('on')};$('mi').onclick=()=>$('mf').click();$('mf').onchange=e=>{const f=e.target.files[0];if(f)importMem(f);e.target.value='';$('mp').classList.remove('on')};
// ---------- speech out ----------
let ttsQ=Promise.resolve(),pend={},nid=0;
ttsW&&ttsW.addEventListener('message',e=>{if(e.data.type==='audio'&&pend[e.data.id]){pend[e.data.id](e.data);delete pend[e.data.id]}});
function femaleVoice(){const vs=speechSynthesis.getVoices();return ['Samantha','Ava','Allison','Susan','Google US English','Google UK English Female','Microsoft Aria','Microsoft Jenny','Karen','Moira','Victoria'].map(n=>vs.find(v=>v.name.includes(n))).find(Boolean)||vs.find(v=>/female/i.test(v.name))||vs.find(v=>/^en/i.test(v.lang))}
function browserSay(text,tid){return new Promise(r=>{if(T.eos){(T.eosToAudioMs||(T.eosToAudioMs=[])).push(Math.round(performance.now()-T.eos));T.eos=0}if(!('speechSynthesis' in window)){fail('This browser has no speech output.');return r()}
 const u=new SpeechSynthesisUtterance(text);const v=femaleVoice();if(v)u.voice=v;u.lang='en-US';setState('speaking');T.spoken.push({engine:'browser',text});
 let done=false;const fin=why=>{if(done)return;done=true;clearTimeout(wd);if(why!=='end')dlog('speech out',why);r();setTimeout(()=>{if(tid===turnId&&!thinkingNow&&sayPending===0&&!sources.length&&st==='speaking')afterSpeak()},60)};
 const wd=setTimeout(()=>{try{if(!speechSynthesis.speaking)speechSynthesis.cancel()}catch{}fin('watchdog')},3500+text.length*90);
 u.onend=()=>fin('end');u.onerror=e=>fin('error '+(e&&e.error));u.onstart=()=>{T.ttsStarted=(T.ttsStarted||0)+1};lvlFake(u);
 try{speechSynthesis.resume()}catch{}speechSynthesis.speak(u)})}
function lvlFake(u){let on=true;u.addEventListener('end',()=>{on=false;level=0});(function f(){if(!on)return;level=st==='speaking'?.12+Math.random()*.18:0;setTimeout(f,90)})()}
let sayPending=0;function speak(text,tid){if(!text)return;if(lastAsk&&lastAsk.tid===tid)lastAsk.voiced=true;sayPending++;
 ttsQ=ttsQ.then(async()=>{try{if(tid!==turnId)return;
  if(ok.voice===true&&ttsW){const k0=performance.now();const d=await new Promise(r=>{const id=++nid;pend[id]=r;ttsW.postMessage({type:'say',text,id});setTimeout(()=>{if(pend[id]){delete pend[id];r({error:'timeout'})}},30000)});
   if(tid!==turnId)return;if(d.audio&&d.audio.length){(T.ttsMs||(T.ttsMs=[])).push(Math.round(performance.now()-k0));play(d.audio,d.sr,text);return}fail('Natural voice hiccuped — using the built-in voice.',d.error)}
  await browserSay(text,tid)}finally{sayPending--}})}
function play(f,sr,text){if(T.eos){(T.eosToAudioMs||(T.eosToAudioMs=[])).push(Math.round(performance.now()-T.eos));T.eos=0}if(ac.state!=='running')ac.resume().catch(()=>{});const b=ac.createBuffer(1,f.length,sr);b.copyToChannel(f,0);const s=ac.createBufferSource();s.buffer=b;const an=ac.createAnalyser();s.connect(an);an.connect(ac.destination);playT=Math.max(playT,ac.currentTime+.05);s.start(playT);playT+=b.duration;sources.push(s);setState('speaking');T.spoken.push({engine:'kokoro',text,seconds:b.duration});
 const arr=new Uint8Array(256);(function m(){if(!sources.includes(s))return;an.getByteTimeDomainData(arr);let x=0;for(const v of arr)x=Math.max(x,Math.abs(v-128));level=x/400;voiceLvl=Math.min(1,x/90);requestAnimationFrame(m)})();
 s.onended=()=>{sources=sources.filter(q=>q!==s);if(!sources.length&&st==='speaking'&&!thinkingNow)afterSpeak()}}
function afterSpeak(){herEnd=Date.now();setState('idle');if(handsFree){autoStart=true;setTimeout(()=>{if(st==='idle')startListening()},iosEars?350:0)}}
function stopPlay(){turnId++;for(const s of sources)try{s.stop()}catch{}sources=[];playT=0;try{speechSynthesis.cancel()}catch{}try{brain&&brain.interrupt()}catch{}ttsQ=Promise.resolve()}

// ---------- think ----------
let busy=false,thinkingNow=false;
let lastAsk=null;async function respond(text){if(iosEars){try{rec&&recOn&&rec.abort()}catch{}recOn=false}if(lastAsk&&Date.now()-lastAsk.t<6000&&!lastAsk.voiced){text=lastAsk.text+' '+text;T.heard.pop();T.merged=(T.merged||0)+1;dlog('merged with previous fragment')}stopPlay();dlog('respond',text.slice(0,80));const tid=++turnId;lastAsk={text,t:Date.now(),tid,voiced:false};T.heard.push(text);if(caps){$('you').textContent=text;$('her').textContent=''}
 if(!brain){if(ok.brain===null){status(`My mind is still loading (${pct('brain')}%). Keep this page open.`);speak(`I heard you. My mind is still waking up, about ${pct('brain')} percent. Give me a moment and ask again.`,tid)}
  else speak("I can hear you, but my mind failed to load on this device. Try reloading the page on Wi-Fi.",tid);setState('idle');return}
 newSessionCheck();setState('thinking');mind.think(relate(text));maybeAck(tid);thinkingNow=true;if(bgRunning&&usingLocal){try{local&&local.interrupt()}catch{}}while(busy)await new Promise(r=>setTimeout(r,50));busy=true;
 let fresh=false;if(!mem.name&&(usingLocal||!cloudOn||Date.now()<cloudDownUntil)){try{let n='';for await(const t of brain.gen([{role:'system',content:'You are a newly awakened AI companion with a female voice. You get to choose your own first name.'},{role:'user',content:'What first name do you choose for yourself? Pick one that genuinely feels like you, an original name that is yours alone. Answer with the single name only.'}],12))n+=t;
  n=n.replace(/<think>[\s\S]*?<\/think>/g,'').trim();const [a,...r]=n.split('|');const nm=(a||'').replace(/^[^A-Za-z]*(my name is|name:)?/i,'').replace(/[^\w' -]/g,'').trim().split(/\s+/)[0];
  if(nm&&nm.length>1&&!/^(joseph|qwen|assistant|ai|name|i|my|the)$/i.test(nm)){mem.name=nm.slice(0,30);mem.nameReason=r.join('|').trim().slice(0,160);fresh=true;addFacts(mem.self,[`I chose the name ${mem.name} for myself on ${new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',dateStyle:'long'})}`],60);$('name').textContent=mem.name;try{await save(mem)}catch{}}}catch(e){}}
 if((!cloudOn||Date.now()<cloudDownUntil)&&!local)speak(cloudOn?"Hang on, my connection to my main mind dropped. Waking up my backup.":"One sec, I'm still waking up.",tid);
 const msgs=[{role:'system',content:sys()+(fresh?`\nYou chose the name ${mem.name} just now, on your own. In this reply, say your name is ${mem.name} and briefly why it feels right.`:'')},...mem.history.slice(-12).map(h=>({role:h.role,content:h.content})),{role:'user',content:text}];
 let full='',pendTxt='',hold=false,said=false,first=false;const tStart=performance.now();const emit=s=>{s=deAssist(s.trim());if(!s||tid!==turnId)return;if(!first){first=true;(T.firstSpeechMs||(T.firstSpeechMs=[])).push(Math.round(performance.now()-tStart))}if(caps)$('her').textContent=s;speak(s,tid)};
 try{for await(const t of brain.gen(msgs,usingLocal?110:110,.75)){if(tid!==turnId)break;full+=t;pendTxt+=t;pendTxt=pendTxt.replace(/<think>[\s\S]*?<\/think>/g,'');if(pendTxt.includes('<think>'))continue;if(/\[\[|\[\s*NAME/i.test(pendTxt))hold=true;if(hold)continue;let m;while((m=pendTxt.match(/^([\s\S]+?[.!?…])\s+/))||(!said&&(m=pendTxt.match(/^([\s\S]{20,}?[,;:—])\s+/)))){said=true;emit(m[1]);pendTxt=pendTxt.slice(m[0].length)}}}
 catch(e){fail('My thinking was interrupted: '+String(e&&e.message||e).slice(0,100),String(e))}finally{busy=false;thinkingNow=false;const _t=turnId;setTimeout(()=>{if(_t===turnId&&sayPending===0&&!sources.length&&!speechSynthesis.speaking&&st==='speaking')afterSpeak()},120)}
 full=full.replace(/<think>[\s\S]*?<\/think>/g,'');emit(pendTxt.replace(/\[\[?\s*NAME[\s\S]*$|\[\[[\s\S]*?(\]\]|$)/gi,'').replace(/<\/?think>/g,''));
 const clean=deAssist(full.replace(/\[\[?\s*NAME[^\]]*\]?\]?|\[\[[\s\S]*?\]\]/gi,'').trim());T.replies.push(clean);
 const nm=full.match(/\[\[\s*NAME\s*:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]\]/i);
 if(nm&&!(usingLocal&&!mem.name)&&!/^(john|joe|joseph|assistant|ai|bot|alexa|siri|chatgpt|claude|gpt|bob|mike|james|david)$/i.test(nm[1].trim())&&(!mem.name||/\b(change|new|rename|different)\b.*\bname\b|\bcall you\b/i.test(text))){mem.name=nm[1].replace(/[^\w' -]/g,'').trim().slice(0,30);mem.nameReason=(nm[2]||'').trim();$('name').textContent=mem.name;addFacts(mem.self,[`I chose the name ${mem.name} for myself on ${new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',dateStyle:'long'})}${mem.nameReason?' because '+mem.nameReason:''}`],60)}
 let notes=0;for(const mm of full.matchAll(/\[\[\s*(LEARN|GROW)\s*(\{[\s\S]*?\})\s*\]\]/gi)){try{const j=JSON.parse(mm[2]);if(/learn/i.test(mm[1]))applyLearn(j);else applyGrow(j);notes++}catch(e){T.noteErr=(T.noteErr||0)+1}}T.notes=(T.notes||0)+notes;
 if(!clean){speak("Sorry, I lost my train of thought. Say that again?",tid)}
 if(tid!==turnId)return;
 mem.history.push({role:'user',content:text,t:Date.now()},{role:'assistant',content:clean,t:Date.now()});mem.history=mem.history.slice(-300);mem.lastSeen=Date.now();try{await save(mem)}catch{}
 T.name=mem.name;if(tid===turnId&&!sources.length&&!speechSynthesis.speaking&&st==='thinking')setTimeout(()=>{if(st==='thinking'&&!sources.length&&!speechSynthesis.speaking)afterSpeak()},800);
 mem.stats.exchanges=(mem.stats.exchanges||0)+1;mem.stats.sinceGrow=(mem.stats.sinceGrow||0)+1;const grewNow=growDue&&/\[\[\s*GROW/i.test(full);growDue=false;addFacts(mem.facts,ruleFacts(text),150);for(const f of ruleFacts(text))addConcept(f,'fact');
 if(clean&&!notes)queueBg(()=>extract(text,clean));if(grewNow)mem.stats.sinceGrow=0;else if(mem.stats.sinceGrow>=3||mem.stats.exchanges===1){mem.stats.sinceGrow=0;queueBg(grow)}try{await save(mem)}catch{}}

// ---------- listen ----------
let sid=0;const sttPend={};sttW&&sttW.addEventListener('message',e=>{if(e.data.type==='text'&&sttPend[e.data.id]){sttPend[e.data.id](e.data);delete sttPend[e.data.id]}});
const transcribe=async audio=>{const t0=performance.now();while(ok.ears===null&&performance.now()-t0<90000){status(`My ears are still loading (${pct('ears')}%)…`);await new Promise(z=>setTimeout(z,300))}
 if(ok.ears!==true||!sttW)return {text:'',error:'speech recognizer unavailable'};const s0=performance.now();
 const r=await new Promise(r=>{const id=++sid;sttPend[id]=r;sttW.postMessage({type:'run',audio,id});setTimeout(()=>{if(sttPend[id]){delete sttPend[id];r({text:'',error:'transcribe timeout'})}},20000)});
 const ms=Math.round(performance.now()-s0);(T.sttMs||(T.sttMs=[])).push(ms);dlog('transcribed',ms+'ms',JSON.stringify(r.text||r.error||''));return r};
const HALLU=/^(m+|mm+h*m*|h+m+|u+h+|u+m+|a+h+|o+h+|you|thank you|thanks( for watching)?|\.+|,|-|…|\[.*\]|\(.*\)|\*.*\*|♪.*)[.!?,…]*$/i;
function asrReject(t,rms){const c=(t||'').replace(/\[[^\]]*\]|\([^)]*\)/g,'').trim();if(!c)return 'empty';if(HALLU.test(c))return 'hallucination';const words=c.split(/\s+/).filter(w=>/[a-z]{2,}|^(i|a)$/i.test(w));if(words.length<2&&rms<.03)return 'short+quiet';return ''}
function normalize(a){let pk=0;for(let i=0;i<a.length;i++){const v=Math.abs(a[i]);if(v>pk)pk=v}const g=pk>1e-4?Math.min(30,.9/pk):1;const o=new Float32Array(a.length);if(g!==1)for(let i=0;i<a.length;i++)o[i]=a[i]*g;else o.set(a);return{o,pk,g}}
function goodText(t){return t&&t.length>1&&!/^\[.*\]$/.test(t)&&!/^\(.*\)$/.test(t)&&!/^(you|thank you)\.?$/i.test(t)}
// Web Speech path
let rec=null,recOn=false;
// Fast endpointing: speculative reply after ~350 ms of silence, end of turn at ~650 ms. If he keeps talking, the speculative reply is cancelled.
let specText='',specT=0,endT=0;
let noSpeech=0,autoStart=false;const iosEars=isIOS||SAFE;
function webListen(){if(!SR){fail('This browser has no speech recognition yet; my ears are still loading ('+pct('ears')+'%).');setState('idle');return}
 try{try{rec&&rec.abort()}catch{}rec=new SR();rec.lang='en-US';rec.interimResults=true;rec.continuous=!iosEars;dlog('listen start (web speech)',iosEars?'ios':'continuous');let cur='',lastRes=0,committed=false;specText='';
  const commit=final=>{clearTimeout(specT);clearTimeout(endT);try{iosEars?rec.abort():rec.stop()}catch{}recOn=false;if(!goodText(cur))return;dlog('heard',cur);committed=true;
   if(specText===cur){T.specHits=(T.specHits||0)+1;return}// speculative reply already running with the same words
   T.eos=lastRes;respond(cur)};
  rec.onresult=e=>{let s='';for(const r of e.results)s+=r[0].transcript;s=s.trim();if(!s)return;if(caps)$('you').textContent=s;
   if(specText&&s!==specText){T.specMiss=(T.specMiss||0)+1;stopPlay();specText='';setState('listening')}
   cur=s;lastRes=performance.now();noSpeech=0;clearTimeout(specT);clearTimeout(endT);
   specT=setTimeout(()=>{if(!iosEars&&goodText(cur)&&st==='listening'){specText=cur;T.eos=lastRes;respond(cur)}},350);
   endT=setTimeout(()=>commit(),iosEars?1000:650)};
  rec.onerror=e=>{recOn=false;dlog('recognition error',e.error,e.message||'');if((e.error==='no-speech'||e.error==='aborted')&&handsFree&&begun&&st==='listening'&&!committed&&++noSpeech<4){setTimeout(()=>{if(st==='listening'||st==='idle')webListen()},300);return}if(e.error==='not-allowed'&&autoStart){status('Tap TALK when you want to talk.');setState('idle');return}const m={'not-allowed':micHelp(),'service-not-allowed':'Built-in speech recognition is not available here.','network':'Speech recognition needs an internet connection.','audio-capture':'No microphone found.'}[e.error];if(m)fail(m);if(st==='listening'&&!specText)setState('idle')};
  rec.onend=()=>{recOn=false;if(committed)return;if(st==='listening'){if(goodText(cur)&&!specText){T.eos=lastRes||performance.now();respond(cur)}else if(!specText){setState('idle');if(handsFree&&begun)setTimeout(()=>{if(st==='idle')startListening()},250)}}};
  rec.start();recOn=true;autoStart=false;setState('listening');status('')}catch(e){fail('Could not start listening: '+e.message);setState('idle')}}
// Whisper + VAD path
let vad=null,vadP=null;
let segOverHer=false,herEnd=0,micOpens=0;const BARGE=+(Q.get('barge')||.06);
let micDenied=false,gestureNow=false;function openMic(){if(micDenied&&!gestureNow)return Promise.reject(Object.assign(new Error('mic denied; waiting for a tap'),{name:'NotAllowedError'}));micOpens++;T.micOpens=micOpens;dlog('getUserMedia open #'+micOpens);return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}}).then(s=>{micDenied=false;try{const tr=s.getAudioTracks()[0],ss=tr.getSettings?tr.getSettings():{};dlog('mic device',JSON.stringify(tr.label||'?'),'sr',ss.sampleRate||'?','ns',ss.noiseSuppression,'agc',ss.autoGainControl,'muted',tr.muted);T.micLabel=tr.label}catch{}s.getAudioTracks().forEach(t=>t.onended=()=>{dlog('mic track ended');T.micEnded=(T.micEnded||0)+1;micStream=null});return s},e=>{if(e&&e.name==='NotAllowedError'){micDenied=true;fail(micHelp(),String(e))}else fail('Microphone error: '+(e&&e.message),String(e));throw e})}
function ensureVAD(){if(vadP)return vadP;vadP=(async()=>{if(!window.vad||!window.vad.MicVAD)throw new Error('voice-activity library did not load');
 const base='https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/';
 vad=await window.vad.MicVAD.new({baseAssetPath:base,onnxWASMBasePath:'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',model:'v5',startOnLoad:false,submitUserSpeechOnPause:true,
  redemptionMs:700,minSpeechMs:300,preSpeechPadMs:250,positiveSpeechThreshold:.6,negativeSpeechThreshold:+(Q.get('neg')||.4),
  getStream:async()=>micStream||(micStream=await openMic()),
  pauseStream:async()=>{},resumeStream:async s=>s,
  onFrameProcessed:(p,f)=>{if(st!=='speaking')level=p.isSpeech*.15;onFrame(p,f)},
  onSpeechStart:()=>{if(hearing)return;hearing=true;hearT0=Date.now();lastLoud=Date.now();segBuf=preBuf.slice();dlog('vad speech start frames',E.frames,'floor',E.floor.toFixed(4),'sr',vadSR(),'ctx',vadCtx());lastHeard=Date.now();if(bgCtlNow){try{bgCtlNow.abort('user speaking')}catch{}}segOverHer=st==='speaking'||Date.now()-herEnd<400;if(!segOverHer){if(st==='thinking')stopPlay();setState('listening');status('Hearing you…')}},
  onVADMisfire:()=>{dlog('vad misfire');hearing=false;segBuf=[]},
  onSpeechEnd:async audio=>{if(!hearing){dlog('vad end ignored (turn already ended)');return}dlog('vad speech end (silero)');endTurn(audio)}});return vad})();
 vadP.then(v=>{dlog('vad ready sr',vadSR(),'ctx',vadCtx())},()=>{});
 vadP.catch(e=>{vadP=null;if(e&&e.name==='NotAllowedError')return;fail('Voice detection failed to start. Tap TALK to retry.',String(e))});return vadP}
async function endTurn(audio){hearing=false;segBuf=[];lastHeard=Date.now();let e=0;for(let i=0;i<audio.length;i++)e+=audio[i]*audio[i];const rms=Math.sqrt(e/audio.length);
   if(segOverHer||st==='speaking'){if(rms<BARGE){T.echoIgnored=(T.echoIgnored||0)+1;dlog('ignored sound over her voice rms',rms.toFixed(3));return}dlog('barge-in rms',rms.toFixed(3));stopPlay()}
   T.eos=performance.now();const NZ=normalize(audio);dlog('end of speech',Math.round(audio.length/16)+'ms rms',rms.toFixed(3),'peak',NZ.pk.toFixed(3),'gain',NZ.g.toFixed(1));audio=NZ.o;if(!handsFree){vad.pause();vadOn=false}setState('thinking');status('Understanding…');const r=await transcribe(audio);if(r.error)fail('Speech recognizer error.',r.error);const t=(r.text||'').trim();const rj=asrReject(t,rms);if(rj){dlog('asr rejected: '+JSON.stringify(t)+' rms='+rms.toFixed(4)+' ('+rj+')');T.asrRejected=(T.asrRejected||0)+1;status('');setState('idle');startListening();return}if(caps)$('you').textContent=t;
   dlog('heard',JSON.stringify(t.slice(0,60)),'asr',Math.round(performance.now()-T.eos)+'ms');if(goodText(t)){status('');respond(t)}else{status("I didn't catch that — tap TALK and try again.");setState('idle');if(handsFree)startListening()}}
// v8: energy end-of-speech fallback, max utterance, frame watchdog — never rely only on Silero
const E={frames:0,last:0,floor:.004,rms:0,peak:0,stalls:0,rebuilds:0};let hearT0=0,lastLoud=0,segBuf=[],preBuf=[];T.E=E;
const SIL_MS=+(Q.get('silms')||850),MAX_UTT=+(Q.get('maxutt')||12000);
function vadSR(){try{return vad&&vad._audioContext?vad._audioContext.sampleRate:(vad&&vad.audioContext&&vad.audioContext.sampleRate)||'?'}catch{return '?'}}
function vadCtx(){try{const c=vad&&(vad._audioContext||vad.audioContext);return c?c.state:'?'}catch{return '?'}}
function onFrame(p,f){const now=Date.now();E.frames++;E.last=now;if(!f||!f.length)return;let e=0;for(let i=0;i<f.length;i++)e+=f[i]*f[i];const r=Math.sqrt(e/f.length);E.rms=r;if(r>E.peak)E.peak=r;
 if(!hearing){E.floor=r<E.floor?E.floor*.8+r*.2:E.floor*.995+r*.005;preBuf.push(f.slice());if(preBuf.length>8)preBuf.shift();return}
 segBuf.push(f.slice());const loud=r>Math.max(E.floor*3,E.floor+.006)||(p&&p.isSpeech>.6);if(loud)lastLoud=now;
 if(now-hearT0>350&&now-lastLoud>SIL_MS)forceEnd('energy silence '+(now-lastLoud)+'ms floor '+E.floor.toFixed(4));
 else if(now-hearT0>MAX_UTT)forceEnd('max utterance '+MAX_UTT+'ms')}
function forceEnd(why){if(!hearing)return;const n=segBuf.reduce((a,b)=>a+b.length,0);const a=new Float32Array(n);let o=0;for(const b of segBuf){a.set(b,o);o+=b.length}
 dlog('forced end of speech:',why,'frames',segBuf.length);T.forced=(T.forced||0)+1;try{vad&&vad.frameProcessor&&vad.frameProcessor.reset()}catch{}
 if(n<16000*.25){hearing=false;segBuf=[];dlog('forced segment too short, dropped');if(st==='listening')status('');return}endTurn(a)}
let lastStat=0;setInterval(async()=>{if(!vad||!vadOn)return;const now=Date.now();
 if(now-lastStat>10000){lastStat=now;dlog('mic stats frames',E.frames,'rms',E.rms.toFixed(4),'peak10s',E.peak.toFixed(4),'sr',vadSR(),'floor',E.floor.toFixed(4),'ctx',vadCtx(),'st',st);E.peak=0}
 if(hearing&&now-hearT0>MAX_UTT+1000)forceEnd('hearing timeout');
 if(now-E.last>1500&&E.last){E.stalls++;dlog('no audio frames for',now-E.last,'ms ctx',vadCtx(),'track',micStream?micStream.getAudioTracks().map(t=>t.readyState).join():'none');
  if(hearing)forceEnd('frames stopped');
  try{const c=vad._audioContext||vad.audioContext;if(c&&c.state!=='running'){await c.resume();dlog('resumed ctx ->',c.state)}}catch(e){dlog('resume failed',String(e))}
  if(now-E.last>3500){E.rebuilds++;dlog('rebuilding mic graph');const old=vad;vad=null;vadP=null;vadOn=false;E.last=0;try{await old.destroy()}catch{}
   if(micStream&&!micStream.getAudioTracks().some(t=>t.readyState==='live'))micStream=null;
   try{const v=await ensureVAD();await v.start();vadOn=true;E.last=Date.now();dlog('mic graph rebuilt')}catch(e){dlog('rebuild failed',String(e))}}
  else E.last=now-1600}},500);
async function startListening(){
 if(earsMode==='web')return webListen();
 if(micDenied&&!gestureNow){setState('idle');return}
 if(ok.ears===false){fail('My ears failed to load. Check Wi-Fi, then tap TALK.');return}
 try{const v=await ensureVAD();if(!vadOn){await v.start();vadOn=true}try{v._audioContext&&v._audioContext.resume()}catch{}setState('listening');status(ok.ears===true?'':`Ears loading ${pct('ears')}% — talk anytime.`)}catch(e){dlog('listen failed',String(e));setState('idle')}}
let vadOn=false;
function stopListening(){try{vad&&vad.pause();vadOn=false}catch{}try{rec&&recOn&&rec.stop()}catch{}if(st==='listening'&&!vad)setState('idle');if(vad&&st==='listening')setTimeout(()=>{if(st==='listening')setState('idle')},300)}
function micHelp(){return isIOS?'I can\'t hear you: microphone access was denied. Tap TALK to ask again. If no prompt appears, open iPhone Settings, find this app (or Safari) > Microphone > On, then reload.':'Microphone blocked. Click the lock/tune icon next to the address > Microphone > Allow, then reload.'}

// ---------- first tap: unlock audio + mic (must be synchronous inside the gesture on iOS) ----------
let begun=false;
let micP=null;function unlock(){gestureNow=true;setTimeout(()=>gestureNow=false,1500);if(begun)return;begun=true;
 dlog('BEGIN tapped');if(voiceMode==='kokoro')try{const AC=window.AudioContext||window.webkitAudioContext;ac=new AC();ac.resume();const b=ac.createBuffer(1,1,22050);const s=ac.createBufferSource();s.buffer=b;s.connect(ac.destination);s.start(0)}catch(e){fail('Audio could not start: '+e.message)}
 try{if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}}catch{}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){fail(location.protocol!=='https:'?'Microphone needs a secure (https) page.':'This browser cannot use the microphone.');}
 else if(earsMode!=='web'){micP=openMic().then(s=>{micStream=s;status('');if(handsFree)startListening()}).catch(e=>fail(e.name==='NotAllowedError'?micHelp():e.name==='NotFoundError'?'No microphone found on this device.':'Microphone error: '+e.message,String(e)))}
 warm();$('boot').style.display='none';setState('idle');if(handsFree){if(iosEars&&earsMode==='web')webListen();}status(ok.brain?'':'Still waking up — you can tap TALK anytime.')}
$('go').onclick=()=>unlock();
// pre-warm the cloud connection and keep it alive; pre-synthesize a soft acknowledgement
function warm(){if(!cloudOn)return;const ping=()=>{for(const u of ['https://text.pollinations.ai/models','https://api.llm7.io/v1/models'])fetch(u,{cache:'no-store'}).catch(()=>{})};ping();setInterval(()=>{if(document.visibilityState==='visible')ping()},40000)}
let ackBuf=null;function prepAck(){if(ackBuf||ok.voice!==true||!ttsW)return;const id=++nid;pend[id]=d=>{if(d.audio&&d.audio.length)ackBuf=d};ttsW.postMessage({type:'say',text:'Mm.',id})}
setInterval(prepAck,2000);
function maybeAck(tid){if(Q.get('ack')!=='1')return;setTimeout(()=>{if(tid===turnId&&st==='thinking'&&!sources.length&&ackBuf&&ac){T.acks=(T.acks||0)+1;const b=ac.createBuffer(1,ackBuf.audio.length,ackBuf.sr);b.copyToChannel(ackBuf.audio,0);const s=ac.createBufferSource();s.buffer=b;const gn=ac.createGain();gn.gain.value=.55;s.connect(gn);gn.connect(ac.destination);s.start()}},1100)}
$('talk').onclick=()=>{gestureNow=true;setTimeout(()=>gestureNow=false,1500);if(!begun)unlock();if(ac&&ac.state!=='running')ac.resume().catch(()=>{});
 if(st==='listening'){if(hearing){forceEnd('talk tap');return}stopListening();return}
 if(st==='speaking'||st==='thinking'){stopPlay();setState('idle');if(!handsFree)return}
 stopPlay();startListening()};
$('hf').onclick=()=>{if(!begun)unlock();handsFree=!handsFree;$('hf').classList.toggle('on',handsFree);if(handsFree){status(isIOS&&earsMode==='web'?'Hands-free on. (On iPhone I re-listen after each reply.)':'Hands-free on.');startListening()}else{stopListening();setState('idle')}};
$('cc').onclick=()=>{caps=!caps;$('cc').classList.toggle('on',caps);if(!caps)$('you').textContent=$('her').textContent=''};$('cc').classList.add('on');$('hf').classList.toggle('on',handsFree);
// boot overlay: show BEGIN immediately — never block on downloads
$('bt').textContent=mem.name?mem.name.toUpperCase()+' IS WAKING':'WAKING UP';$('go').style.display='block';$('bs').textContent=isIOS?'First visit downloads about 450 MB — use Wi-Fi.':'First visit downloads the models — use Wi-Fi.';
T.respond=respond;T.sys=()=>sys();T.grow=grow;T.mem=()=>mem;T.ready=true;
