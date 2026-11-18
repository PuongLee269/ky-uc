/* Gộp bản sửa hai nơi theo từng id (3 bên: bản gốc, bản trên máy, bản mới nhất trên GitHub).
   Mục sửa ở cả hai nơi: giữ bản từ xa, thêm bản trên máy ngay sau với tiền tố "(bản trên máy) ".
   Cũng đặt window.PicassoOffline (chỉ phần gộp) vì script_page.js gọi tên này. */
(function(root){
'use strict';
const COPY_PREFIX='(bản trên máy) ';
const CONFLICT_BANNER='Có đoạn sửa ở hai nơi — xem và xoá bản không cần';
const CONFLICT_MESSAGE='Dự án đã đổi ở thiết bị khác';

/* So sánh không phụ thuộc thứ tự khoá (PC ghi file bằng Python có thể xếp khoá khác). */
function canon(value){
 if(Array.isArray(value))return value.map(canon);
 if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value).sort())out[k]=canon(value[k]);return out;}
 return value;
}
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
const clone=v=>JSON.parse(JSON.stringify(v));
const newId=prefix=>{
 const bytes=new Uint8Array(10);
 (root.crypto||require('crypto').webcrypto).getRandomValues(bytes);
 return prefix+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
};
const isConflictError=e=>/đã đổi ở thiết bị khác/.test(e?.message||'');

const copyCard=card=>({...clone(card),id:newId('c'),caption:card.caption?.startsWith(COPY_PREFIX)?card.caption:(COPY_PREFIX+(card.caption||'')).slice(0,5000),x:Math.min(5800,(card.x||0)+30),y:Math.min(5800,(card.y||0)+30)});
const copyBlock=block=>({...clone(block),id:newId('b'),title:block.title?.startsWith(COPY_PREFIX)?block.title:(COPY_PREFIX+(block.title||'')).slice(0,500)});

function mergeRemoteItem(result,base,local,remote,makeCopy){
 if(same(local,remote)||(base&&same(local,base))){result.items.push(remote);return;}
 if(base&&same(remote,base)){result.items.push(local);return;}
 result.items.push(remote,makeCopy(local));result.conflicts++;
}
function insertLocalOnly(items,list,at,baseMap){
 const local=list[at],base=baseMap.get(local.id);
 if(base&&same(base,local))return;                 // đã xoá ở nơi kia, ở đây chưa sửa: theo nơi kia
 let index=items.length;
 for(let i=at-1;i>=0;i--){const found=items.findIndex(x=>x.id===list[i].id);if(found>=0){index=found+1;break;}}
 items.splice(index,0,local);
}
function mergeById(base,local,remote,makeCopy){
 const baseMap=new Map((base||[]).map(i=>[i.id,i])),localMap=new Map(local.map(i=>[i.id,i])),remoteIds=new Set(remote.map(i=>i.id));
 const result={items:[],conflicts:0};
 for(const r of remote){
  const l=localMap.get(r.id),b=baseMap.get(r.id);
  if(!l){if(!(b&&same(b,r)))result.items.push(r);continue;}   // xoá ở máy này: chỉ xoá khi nơi kia không sửa
  mergeRemoteItem(result,b,l,r,makeCopy);
 }
 local.forEach((l,at)=>{if(!remoteIds.has(l.id))insertLocalOnly(result.items,local,at,baseMap);});
 return result;
}
const mergeCards=(base,local,remote)=>mergeById(base,local,remote,copyCard);
const mergeBlocks=(base,local,remote)=>mergeById(base,local,remote,copyBlock);

const api={COPY_PREFIX,CONFLICT_BANNER,CONFLICT_MESSAGE,same,clone,isConflictError,mergeCards,mergeBlocks};
if(typeof module==='object'&&module.exports)module.exports=api;
else{root.KyUcMerge=api;root.PicassoOffline={COPY_PREFIX,CONFLICT_BANNER,isConflictError,mergeCards,mergeBlocks};}
})(typeof window==='undefined'?globalThis:window);
