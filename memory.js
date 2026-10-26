// IndexedDB key-value memory on the device (opened lazily; every call settles, never hangs)
let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{let r;try{r=indexedDB.open('companion',1)}catch(e){return rej(e)}
 r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{try{d.close()}catch{}dbp=null};res(d)};r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('IndexedDB blocked by another open tab'))});
 dbp.catch(()=>{dbp=null});return dbp}
const get=async k=>{const d=await db();return new Promise((r,j)=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})};
const put=async(k,v)=>{const d=await db();return new Promise((r,j)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=r;t.onerror=t.onabort=()=>j(t.error)})};
export async function load(){return (await get('mem'))||{name:null,nameReason:null,facts:[],reflections:[],history:[],lastSeen:null}}
export async function save(m){await put('mem',m)}
