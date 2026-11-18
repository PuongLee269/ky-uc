/* Kết nối Picasso (tuỳ chọn): đồng bộ một dự án trên máy với một dự án trên PicassoDraf.
   Mã ghép đôi chỉ đi trong header X-Picasso-Pairing, không bao giờ nằm trong địa chỉ URL. */
(function(root){
'use strict';
const TIMEOUT_MS=10000,MAX_TRIES=3;
const M=root.KyUcMerge||(typeof require==='function'?require('./merge.js'):null);

/* Chỉ nhận địa chỉ https; bỏ đường dẫn, query và tài khoản để mã/chuỗi lạ không lọt vào URL. */
function normalizeBase(text){
 let url;try{url=new URL(String(text||'').trim());}catch(e){throw new Error('Địa chỉ chưa đúng. Ví dụ: https://may-cua-ban.ts.net:8445');}
 if(url.protocol!=='https:')throw new Error('Địa chỉ phải bắt đầu bằng https://');
 return url.origin;
}
const fail=(kind,message)=>Object.assign(new Error(message),{kind});

function createClient({base,code,fetchImpl}){
 const doFetch=fetchImpl||((...a)=>root.fetch(...a));
 const origin=normalizeBase(base);
 const pairing=String(code||'').trim();
 if(!pairing)throw new Error('Chưa nhập mã ghép đôi.');
 async function request(path,body){
  const ctl=typeof AbortController==='function'?new AbortController():null;
  const timer=ctl?setTimeout(()=>ctl.abort(),TIMEOUT_MS):null;
  const headers={'X-Picasso-Pairing':pairing};
  const init={method:body===undefined?'GET':'POST',headers,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'};
  if(ctl)init.signal=ctl.signal;
  if(body!==undefined){headers['Content-Type']='application/json';init.body=JSON.stringify(body);}
  let res;
  try{res=await doFetch(origin+path,init);}
  catch(e){throw fail('offline','Không kết nối được tới máy tính.');}
  finally{if(timer)clearTimeout(timer);}
  let data=null;try{data=await res.json();}catch(e){}
  if(res.status===403)throw fail('auth','Mã ghép đôi chưa đúng.');
  if(!res.ok)throw fail('http',(data&&data.error)||('Máy tính trả lỗi '+res.status+'.'));
  return data||{};
 }
 return {
  origin,
  async listProjects(){const d=await request('/api/projects');return (d.projects||[]).filter(p=>p&&p.id).map(p=>({id:String(p.id),name:String(p.name||p.id)}));},
  creative:id=>request('/api/creative?project_id='+encodeURIComponent(id)),
  postMemory:(id,version,cards)=>request('/api/creative/memory',{project_id:id,version,cards}),
  postScreenplay:(id,version,blocks)=>request('/api/creative/screenplay',{project_id:id,version,blocks}),
 };
}

/* Đồng bộ một phần: gộp 3 bên rồi đẩy lên; gặp lỗi phiên bản thì tải lại và gộp lại (tối đa 3 lần). */
async function syncPart({base,local,remote,refetch,post,pick,mergeFn}){
 let current=remote;
 for(let attempt=0;attempt<MAX_TRIES;attempt++){
  const remoteItems=pick(current),merged=mergeFn(base,local,remoteItems);
  if(M.same(merged.items,remoteItems))return {items:remoteItems,version:current.version,conflicts:merged.conflicts};
  try{
   const saved=await post(current.version,merged.items);
   return {items:pick(saved),version:saved.version,conflicts:merged.conflicts};
  }catch(e){
   if(!M.isConflictError(e)||attempt===MAX_TRIES-1)throw e;
   current=await refetch();
  }
 }
}

/* state: {cards,blocks,baseCards,baseBlocks}. Trả về bản mới để ghi vào kho trên máy. */
async function syncProject(client,pcId,state){
 const data=await client.creative(pcId);
 const board=await syncPart({base:state.baseCards,local:state.cards,remote:data.memory_board||{version:0,cards:[]},
  refetch:async()=>(await client.creative(pcId)).memory_board,post:(v,items)=>client.postMemory(pcId,v,items),
  pick:x=>x.cards||[],mergeFn:M.mergeCards});
 const screen=await syncPart({base:state.baseBlocks,local:state.blocks,remote:data.screenplay||{version:0,blocks:[]},
  refetch:async()=>(await client.creative(pcId)).screenplay,post:(v,items)=>client.postScreenplay(pcId,v,items),
  pick:x=>x.blocks||[],mergeFn:M.mergeBlocks});
 return {board,screen,conflicts:board.conflicts+screen.conflicts};
}

const api={normalizeBase,createClient,syncProject,MAX_TRIES};
if(typeof module==='object'&&module.exports)module.exports=api;else root.KyUcSync=api;
})(typeof window==='undefined'?globalThis:window);
