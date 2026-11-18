/* Kho dự án trên máy cho Ký Ức: localStorage, mỗi dự án một khoá. Có xuất/nhập file .json.
   Dự án: {id,name,created,updated,board:{version,cards},screen:{version,blocks},link:{id,name}|null,sync:{...}}. */
(function(root){
'use strict';
const INDEX_KEY='kyUc.index',PROJECT_PREFIX='kyUc.p.';
const FORMAT='ky-uc',FORMAT_VERSION=1,MAX_IMPORT_BYTES=3*1024*1024,MAX_NAME=120;
const CONFLICT_TEXT='Dự án đã đổi ở thiết bị khác';
const ID_PATTERN=/^[a-zA-Z0-9_-]{1,70}$/;
const clone=v=>JSON.parse(JSON.stringify(v));
const newId=prefix=>{
 const bytes=new Uint8Array(8);
 (root.crypto||require('crypto').webcrypto).getRandomValues(bytes);
 return prefix+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
};
const cleanName=text=>String(text??'').replace(/\s+/g,' ').trim().slice(0,MAX_NAME);

function create(storage){
 const read=key=>{try{const raw=storage.getItem(key);return raw?JSON.parse(raw):null;}catch(e){return null;}};
 const write=(key,value)=>{
  try{storage.setItem(key,JSON.stringify(value));}
  catch(e){throw new Error('Bộ nhớ máy đã đầy. Hãy xuất file rồi xoá bớt dự án cũ.');}
 };
 const ids=()=>{const list=read(INDEX_KEY);return Array.isArray(list)?list.filter(x=>typeof x==='string'):[];};
 const get=id=>{const p=read(PROJECT_PREFIX+id);return p&&p.id===id?p:null;};
 const need=id=>{const p=get(id);if(!p)throw new Error('Không tìm thấy dự án.');return p;};
 const put=p=>write(PROJECT_PREFIX+p.id,{...p,updated:new Date().toISOString()});
 const blank=(name,cards,blocks)=>({id:newId('p'),name:cleanName(name)||'Dự án mới',created:new Date().toISOString(),updated:'',
  board:{version:1,cards:cards||[]},screen:{version:1,blocks:blocks||[]},link:null,sync:{baseCards:null,baseBlocks:null}});

 function list(){return ids().map(get).filter(Boolean).map(p=>({id:p.id,name:p.name,link:p.link,updated:p.updated}));}
 function add(name,cards,blocks){
  const p=blank(name,cards,blocks);put(p);write(INDEX_KEY,[...ids(),p.id]);return get(p.id);
 }
 function rename(id,name){const n=cleanName(name);if(!n)throw new Error('Tên dự án không được để trống.');put({...need(id),name:n});}
 function remove(id){
  try{storage.removeItem(PROJECT_PREFIX+id);storage.removeItem('picassodrafMemory:'+id+':local');storage.removeItem('picassoScreenplay:'+id);}catch(e){}
  write(INDEX_KEY,ids().filter(x=>x!==id));
 }
 /* Lưu một phần ('board' hoặc 'screen'); version phải khớp, khác thì báo "đã đổi ở thiết bị khác" để bên gọi gộp. */
 function save(id,part,expected,items){
  const p=need(id),key=part==='board'?'cards':'blocks',cur=p[part];
  if(expected!==cur.version)throw new Error(CONFLICT_TEXT);
  const next={version:cur.version+1,[key]:clone(items)};
  put({...p,[part]:next});return {version:next.version,items:clone(items)};
 }
 const view=(id,part)=>{const p=need(id),cur=p[part];return {version:cur.version,items:clone(part==='board'?cur.cards:cur.blocks)};};
 /* Ghi kết quả đồng bộ (đổi cả hai phần, bản gốc và liên kết) trong một lần ghi. */
 function applySync(id,patch){const p=need(id);put({...p,...clone(patch)});}
 function setLink(id,link){const p=need(id);put({...p,link:link||null,sync:{baseCards:null,baseBlocks:null}});}
 function mergeInto(id,cards,blocks,M){
  const p=need(id),c=M.mergeCards(null,p.board.cards,cards),b=M.mergeBlocks(null,p.screen.blocks,blocks);
  put({...p,board:{version:p.board.version+1,cards:c.items},screen:{version:p.screen.version+1,blocks:b.items}});
  return c.conflicts+b.conflicts;
 }
 return {list,get,add,rename,remove,save,view,applySync,setLink,mergeInto,ids};
}

/* ---------- xuất / nhập file ---------- */
function exportProject(p){
 return JSON.stringify({format:FORMAT,version:FORMAT_VERSION,name:p.name,exported:new Date().toISOString(),
  memory_board:{cards:p.board.cards},screenplay:{blocks:p.screen.blocks}},null,2);
}
function exportFileName(name){
 const base=String(name||'').replace(/[\/:*?"<>|\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,60);
 return (base||'ky-uc')+'.json';
}
const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
/* Kiểm tra file nhập: trả {name,cards,blocks} hoặc ném lỗi tiếng Việt dễ hiểu. */
function parseImport(text){
 if(typeof text!=='string'||!text.trim())throw new Error('File trống.');
 if(text.length>MAX_IMPORT_BYTES)throw new Error('File quá lớn (tối đa 3 MB).');
 let data;try{data=JSON.parse(text.replace(/^﻿/,''));}catch(e){throw new Error('File không đọc được. Hãy chọn file .json xuất từ Ký Ức.');}
 if(!isObject(data)||data.format!==FORMAT)throw new Error('Đây không phải file xuất từ Ký Ức.');
 const cards=data.memory_board?.cards,blocks=data.screenplay?.blocks;
 if(!Array.isArray(cards)||!Array.isArray(blocks))throw new Error('File thiếu thẻ hoặc kịch bản.');
 const seen=new Set();
 const fixId=(item,prefix)=>{
  if(!isObject(item))throw new Error('File có mục không hợp lệ.');
  let id=item.id;if(typeof id!=='string'||!ID_PATTERN.test(id)||seen.has(id))id=newId(prefix);
  seen.add(id);return {...item,id};
 };
 return {name:cleanName(data.name)||'Dự án nhập',cards:cards.map(c=>fixId(c,'c')),blocks:blocks.map(b=>fixId(b,'b'))};
}

const api={create,exportProject,exportFileName,parseImport,newId,cleanName,CONFLICT_TEXT,FORMAT};
if(typeof module==='object'&&module.exports)module.exports=api;else root.KyUcLocal=api;
})(typeof window==='undefined'?globalThis:window);
