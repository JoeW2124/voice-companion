import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm";
let asr;
async function mk(gpu){return pipeline('automatic-speech-recognition','onnx-community/whisper-base.en',{device:gpu?'webgpu':'wasm',dtype:gpu?{encoder_model:'fp32',decoder_model_merged:'q4'}:'q8',progress_callback:p=>self.postMessage({type:'progress',p})})}
self.onmessage=async e=>{const m=e.data;
 if(m.type==='init'){let dev=m.webgpu?'webgpu':'wasm';try{try{asr=await mk(m.webgpu)}catch(err){if(!m.webgpu)throw err;dev='wasm';asr=await mk(false)}self.postMessage({type:'ready',device:dev})}catch(err){self.postMessage({type:'error',error:String(err)})}}
 if(m.type==='run'){try{const r=await asr(m.audio);self.postMessage({type:'text',id:m.id,text:(r.text||'').trim()})}catch(err){self.postMessage({type:'text',id:m.id,text:'',error:String(err)})}}};
