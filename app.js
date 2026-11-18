/* Ký Ức (bản web độc lập): dự án lưu trên máy, chạy offline; có thể nối với PicassoDraf của chính bạn. */
(function(){
'use strict';
const KEYS={settings:'kyUc.settings',last:'kyUc.lastProject'};
const SAVE_DELAY_MS=1500,SYNC_DEBOUNCE_MS=3000,SYNC_EVERY_MS=30000;
const $=id=>document.getElementById(id);
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const b=make('button',text,cls);b.type='button';b.onclick=fn;return b;};
const messageOf=e=>String(e?.message||e||'Lỗi không rõ');
const M=window.KyUcMerge;

/* Nếu trình duyệt chặn localStorage thì dùng bộ nhớ tạm (mất khi đóng trang) và báo cho người dùng. */
let storageOk=true;
const memory=new Map();
const storage=(()=>{
 try{localStorage.setItem('kyUc.probe','1');localStorage.removeItem('kyUc.probe');return localStorage;}
 catch(e){storageOk=false;return {getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,String(v));},removeItem:k=>{memory.delete(k);}};}
})();
const store=KyUcLocal.create(storage);
const settings={
 get(){try{const v=JSON.parse(storage.getItem(KEYS.settings)||'{}');return {base:String(v.base||''),code:String(v.code||'')};}catch(e){return {base:'',code:''};}},
 set(v){storage.setItem(KEYS.settings,JSON.stringify(v));},
};
const connected=()=>{const s=settings.get();return Boolean(s.base&&s.code);};

let current=null,ui=null,toastTimer=null,syncing=false,syncAgain=false,syncTimer=null,pcProjects=[];

function toast(text){const t=$('toast');t.textContent=text;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},4000);}

/* ---------- chip trạng thái ---------- */
const chip=make('span','','ky-chip');chip.setAttribute('role','status');
function setChip(state,text){chip.dataset.state=state;chip.textContent=text;}
function idleChip(){
 const p=current&&store.get(current);
 if(p?.link&&connected())setChip('ok','Đã nối · '+(p.sync?.at?'đã đồng bộ':'chưa đồng bộ'));else setChip('local','Chỉ trên máy');
}

/* ---------- đồng bộ với PicassoDraf ---------- */
function scheduleSync(delay){
 clearTimeout(syncTimer);
 if(!connected()||!current||!store.get(current)?.link)return;
 syncTimer=setTimeout(()=>syncNow(),delay);
}
async function syncNow(){
 const id=current;
 if(!id||!connected())return;
 const first=store.get(id);
 if(!first?.link){idleChip();return;}
 if(syncing){syncAgain=true;return;}
 if(navigator.onLine===false){setChip('offline','Máy tính đang tắt');return;}
 syncing=true;setChip('saving','Đang đồng bộ…');
 try{
  await flushAll();
  const p=store.get(id),s=settings.get();
  const client=KyUcSync.createClient({base:s.base,code:s.code});
  const r=await KyUcSync.syncProject(client,p.link.id,{cards:p.board.cards,blocks:p.screen.blocks,baseCards:p.sync?.baseCards??null,baseBlocks:p.sync?.baseBlocks??null});
  const q=store.get(id);
  if(!q||q.board.version!==p.board.version||q.screen.version!==p.screen.version){syncAgain=true;return;}  // bạn vừa sửa tiếp: làm lại
  const changed=!M.same(r.board.items,p.board.cards)||!M.same(r.screen.items,p.screen.blocks);
  store.applySync(id,{board:{version:q.board.version+1,cards:r.board.items},screen:{version:q.screen.version+1,blocks:r.screen.items},
   sync:{baseCards:r.board.items,baseBlocks:r.screen.items,at:new Date().toISOString()}});
  if(changed&&id===current)await reloadUi();
  setChip('ok','Đã nối · đã đồng bộ');
  if(r.conflicts)toast('Có chỗ sửa ở hai nơi. Tìm mục "(bản trên máy)" để xem và xoá bản không cần.');
 }catch(e){
  if(e.kind==='offline')setChip('offline','Máy tính đang tắt');   // im lặng, vẫn làm việc bình thường
  else setChip('error','Lỗi: '+messageOf(e));
 }finally{
  syncing=false;
  if(syncAgain){syncAgain=false;scheduleSync(SYNC_DEBOUNCE_MS);}
 }
}

/* ---------- khung (sheet) dùng chung ---------- */
function openSheet(title,build){
 const overlay=$('sheet');overlay.hidden=false;overlay.replaceChildren();
 const box=make('section',undefined,'ky-card');box.setAttribute('role','dialog');box.setAttribute('aria-label',title);
 const close=()=>{overlay.hidden=true;overlay.replaceChildren();};
 overlay.onclick=e=>{if(e.target===overlay)close();};
 box.append(make('h2',title));
 build(box,close);
 box.append(button('Đóng',close));
 overlay.append(box);
 return close;
}
const field=(label,input)=>{const w=make('label',undefined,'ky-field');w.append(make('span',label),input);return w;};
const errorLine=()=>{const p=make('p','','ky-error');p.setAttribute('role','alert');return p;};

/* ---------- tạo / mở / đổi tên / xoá / xuất / nhập ---------- */
function projectName(id){return store.get(id)?.name||'Dự án';}
function paintProjectButton(){if(ui)ui.projectButton.textContent='📁 '+(current?projectName(current):'Chọn dự án');}
function download(name,text){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function exportCurrent(){
 if(!current)return;
 await flushAll();
 const p=store.get(current);download(KyUcLocal.exportFileName(p.name),KyUcLocal.exportProject(p));
 toast('Đã xuất file. Hãy gửi file này cho thầy/cô.');
}
function showProjects(){
 openSheet('Dự án',(box,close)=>{
  const list=make('div',undefined,'ky-list'),error=errorLine();
  const paint=()=>{
   list.replaceChildren();const rows=store.list();
   if(!rows.length)list.append(make('p','Chưa có dự án. Hãy tạo dự án đầu tiên bên dưới.','ky-sub'));
   for(const p of rows){
    const row=make('div',undefined,'ky-row');
    const open=button(p.name,async()=>{close();await openProject(p.id).catch(e=>toast(messageOf(e)));},'ky-item');
    if(p.id===current)open.setAttribute('aria-current','true');
    const ren=button('Đổi tên',()=>{
     const input=make('input');input.value=p.name;input.maxLength=120;
     const ok=button('Lưu',()=>{try{store.rename(p.id,input.value);paintProjectButton();paint();}catch(e){error.textContent=messageOf(e);}},'ky-primary');
     row.replaceChildren(input,ok);input.focus();input.select();
    });
    let armed=false;
    const del=button('Xoá',async()=>{
     if(!armed){armed=true;del.textContent='Bấm lại để xoá';setTimeout(()=>{armed=false;del.textContent='Xoá';},4000);return;}
     store.remove(p.id);
     if(p.id===current){current=null;storage.removeItem(KEYS.last);const next=store.list()[0];if(next)await openProject(next.id).catch(()=>{});else{paintProjectButton();idleChip();}}
     paint();
    },'ky-danger');
    row.append(open,ren,del);list.append(row);
   }
  };
  paint();
  const name=make('input');name.placeholder='Tên dự án mới';name.maxLength=120;
  const add=button('+ Dự án mới',async()=>{
   error.textContent='';
   try{const p=store.add(name.value);name.value='';close();await openProject(p.id);}catch(e){error.textContent=messageOf(e);}
  },'ky-primary');
  name.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();add.click();}};
  const row=make('div',undefined,'ky-row');row.append(name,add);
  const tools=make('div',undefined,'ky-row');
  const exportBtn=button('Xuất file',()=>exportCurrent().catch(e=>{error.textContent=messageOf(e);}));
  exportBtn.disabled=!current;
  tools.append(exportBtn,button('Nhập file',()=>{close();showImport();}));
  box.append(list,row,tools,error);
  if(!storageOk)box.append(make('p','Trình duyệt đang chặn bộ nhớ: dự án sẽ mất khi đóng trang. Hãy xuất file thường xuyên.','ky-error'));
 });
}
function showImport(){
 openSheet('Nhập file',(box,close)=>{
  const error=errorLine(),file=make('input');file.type='file';file.accept='.json,application/json';
  const target=make('select');
  target.append(new Option('Tạo thành dự án mới','new'));
  for(const p of store.list())target.append(new Option('Gộp vào: '+p.name,p.id));
  const go=button('Nhập',async()=>{
   error.textContent='';
   const f=file.files?.[0];if(!f){error.textContent='Hãy chọn một file .json.';return;}
   try{
    const data=KyUcLocal.parseImport(await f.text());
    if(target.value==='new'){const p=store.add(data.name,data.cards,data.blocks);close();await openProject(p.id);toast('Đã nhập thành dự án mới.');}
    else{
     if(target.value===current)await flushAll();
     const n=store.mergeInto(target.value,data.cards,data.blocks,M);close();
     if(target.value===current)await reloadUi();else await openProject(target.value);
     toast(n?'Đã gộp. Có '+n+' chỗ sửa ở hai nơi, tìm mục "(bản trên máy)".':'Đã gộp vào dự án.');
     scheduleSync(SYNC_DEBOUNCE_MS);
    }
   }catch(e){error.textContent=messageOf(e);}
  },'ky-primary');
  box.append(field('Chọn file .json',file),field('Nhập vào đâu?',target),go,error);
 });
}

/* ---------- cài đặt: Kết nối Picasso ---------- */
function showSettings(){
 openSheet('Cài đặt',box=>{
  const cur=settings.get(),error=errorLine(),info=make('p','','ky-sub');
  box.append(make('p','Kết nối Picasso là tuỳ chọn. Không nối thì Ký Ức vẫn dùng bình thường, chỉ lưu trên máy này.','ky-sub'));
  const base=make('input');base.type='url';base.value=cur.base;base.placeholder='https://ten-may.ts.net:8445';base.autocomplete='off';base.autocapitalize='off';base.spellcheck=false;
  const code=make('input');code.type='password';code.value=cur.code;code.autocomplete='off';code.spellcheck=false;code.placeholder='Mã hiện trên máy tính';
  const linkBox=make('div',undefined,'ky-linkbox');
  function paintLink(){
   linkBox.replaceChildren();
   const p=current&&store.get(current);
   if(!p||!connected())return;
   linkBox.append(make('h3','Dự án đang mở: '+p.name));
   if(p.link){
    linkBox.append(make('p','Đang nối với: '+p.link.name,'ky-sub'),button('Bỏ nối',()=>{store.setLink(p.id,null);paintLink();idleChip();}));
   }else if(!pcProjects.length){
    linkBox.append(button('Tải danh sách dự án trên máy tính',async()=>{
     try{const s=settings.get();pcProjects=await KyUcSync.createClient({base:s.base,code:s.code}).listProjects();paintLink();}
     catch(e){error.textContent=messageOf(e);}
    }));
   }else{
    const pick=make('select');for(const x of pcProjects)pick.append(new Option(x.name,x.id));
    linkBox.append(field('Nối với dự án trên máy tính',pick),button('Nối',()=>{
     const x=pcProjects.find(y=>y.id===pick.value);if(!x)return;
     store.setLink(p.id,{id:x.id,name:x.name});paintLink();idleChip();scheduleSync(200);toast('Đã nối. Đang đồng bộ…');
    },'ky-primary'));
   }
  }
  const test=button('Lưu và thử kết nối',async()=>{
   error.textContent='';info.textContent='';test.disabled=true;
   try{
    const origin=KyUcSync.normalizeBase(base.value);
    const client=KyUcSync.createClient({base:origin,code:code.value});
    pcProjects=await client.listProjects();
    settings.set({base:origin,code:code.value.trim()});base.value=origin;
    info.textContent='Kết nối được. Máy tính có '+pcProjects.length+' dự án.';
    paintLink();idleChip();scheduleSync(500);
   }catch(e){error.textContent=e.kind==='offline'?'Không kết nối được. Kiểm tra Tailscale và máy tính đang bật.':messageOf(e);}
   finally{test.disabled=false;}
  },'ky-primary');
  const off=button('Ngắt kết nối',()=>{settings.set({base:'',code:''});base.value='';code.value='';pcProjects=[];info.textContent='Đã ngắt kết nối.';paintLink();idleChip();},'ky-danger');
  box.append(field('Địa chỉ PicassoDraf (https)',base),field('Mã ghép đôi',code),test,info,error,linkBox,off);
  paintLink();
 });
}

/* ---------- hướng dẫn ---------- */
function showGuide(){
 openSheet('Hướng dẫn',box=>{
  const steps=[
   ['1. Cài ra màn hình chính','Trên điện thoại, mở menu của trình duyệt rồi chọn "Thêm vào màn hình chính" (iPhone: nút Chia sẻ, sau đó "Thêm vào MH chính").'],
   ['2. Dùng không cần mạng','Mở Ký Ức một lần khi có mạng. Sau đó bạn viết, thêm thẻ, sửa kịch bản ở đâu cũng được. Mọi thứ lưu ngay trên máy.'],
   ['3. Nối với PicassoDraf của bạn (không bắt buộc)','Cần Tailscale có HTTPS và mã ghép đôi hiện trên máy tính. Vào Cài đặt, nhập địa chỉ và mã, bấm thử kết nối, rồi chọn dự án để nối. Ký Ức sẽ tự đồng bộ khi máy tính bật.'],
   ['4. Gửi bài cho thầy/cô','Mở "Dự án", bấm "Xuất file". Ký Ức tạo một file .json mang tên dự án. Gửi file đó cho thầy/cô.'],
  ];
  const wrap=make('div',undefined,'ky-steps');
  for(const [t,d] of steps){const s=make('div');s.append(make('strong',t),make('p',d,'ky-sub'));wrap.append(s);}
  box.append(wrap);
 });
}

/* ---------- gắn Vùng Ký Ức và Kịch bản ---------- */
const offlineOnly=what=>()=>{throw new Error(what+' cần máy tính, bản này chưa dùng được.');};

function buildUi(){
 const projectButton=button('📁 …',showProjects,'memory-link ky-project');
 const gear=button('⚙',showSettings,'memory-link');gear.setAttribute('aria-label','Cài đặt');
 const help=button('?',showGuide,'memory-link');help.setAttribute('aria-label','Hướng dẫn');
 const script=PicassoScriptPage.mount({
  saveDelay:SAVE_DELAY_MS,
  save:async(project,version,blocks)=>{const r=store.save(project,'screen',version,blocks);scheduleSync(SYNC_DEBOUNCE_MS);return {version:r.version,blocks:r.items};},
  load:async()=>{const v=store.view(current,'screen');return {version:v.version,blocks:v.items};},
  score:offlineOnly('Chấm kịch bản'),
  cardText:id=>{const c=store.get(current)?.board.cards.find(x=>x.id===id);return c?String(c.caption||''):null;},
  cardInfo:async card=>({title:String(card.caption||'').split(/\r?\n/)[0].slice(0,60),text:String(card.caption||'')}),
  reveal:id=>board.reveal(id),
  toast,
 });
 const board=PicassoMemoryBoard.mount({
  persistent:true,
  title:'Ký Ức',
  saveDelay:SAVE_DELAY_MS,
  below:script.el,
  cardAction:{label:'✍ Viết',aria:'Viết kịch bản cho thẻ này',run:card=>script.write(card)},
  toolbar:[projectButton,chip,gear,help],
  storageScope:()=>'local',
  load:async()=>{const v=store.view(current,'board');return {project:current,board:{version:v.version,cards:v.items}};},
  save:async(project,version,cards)=>{const r=store.save(project,'board',version,cards);scheduleSync(SYNC_DEBOUNCE_MS);return {version:r.version,cards:r.items};},
  merge:M.mergeCards,
  isConflict:M.isConflictError,
 });
 return {board,script,projectButton};
}

async function flushAll(){
 if(!ui)return;
 await ui.board.flush().catch(()=>{});
 await ui.script.saveScreenplay().catch(()=>{});
}
/* Nạp lại giao diện từ kho; bỏ qua nếu bạn đang có chữ chưa lưu (lần lưu sau sẽ tự gộp). */
async function reloadUi(){
 if(!ui||!current||ui.board.isDirty()||ui.script.isDirty())return;
 const v=store.view(current,'screen');
 ui.script.open(current,{version:v.version,blocks:v.items});
 await ui.board.refresh();
}
async function openProject(id){
 if(!ui)ui=buildUi();
 await flushAll();
 if(!store.get(id))throw new Error('Không tìm thấy dự án.');
 current=id;storage.setItem(KEYS.last,id);
 paintProjectButton();
 const v=store.view(id,'screen');
 ui.script.open(id,{version:v.version,blocks:v.items});
 await ui.board.reopen();
 idleChip();scheduleSync(300);
}

function boot(){
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSync(300);});
 window.addEventListener('online',()=>scheduleSync(500));
 setInterval(()=>{if(document.visibilityState==='visible')scheduleSync(0);},SYNC_EVERY_MS);
 ui=buildUi();
 const rows=store.list(),last=storage.getItem(KEYS.last)||'';
 const first=rows.find(p=>p.id===last)||rows[0];
 if(first)openProject(first.id).catch(e=>toast(messageOf(e)));
 else{idleChip();paintProjectButton();showProjects();}
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
})();
