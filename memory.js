// IndexedDB key-value memory on the device
const db=new Promise((res,rej)=>{const r=indexedDB.open('companion',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const get=async k=>{const d=await db;return new Promise(r=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>r(q.result)})};
const put=async(k,v)=>{const d=await db;return new Promise(r=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=r})};
export async function load(){return (await get('mem'))||{name:null,nameReason:null,facts:[],reflections:[],history:[],lastSeen:null}}
export async function save(m){await put('mem',m)}
