/* Kịch bản: một trang viết liên tục dưới dải thẻ của Vùng Ký Ức. Mỗi khối là bản sao của thẻ (hoặc khối tự do); sửa ở đây không đổi thẻ. */
(function(root){
'use strict';
const MARKS=[['vo','V.O'],['motion','Motion'],['tulieu','Tư liệu'],['quay','Quay']];
const LABEL=Object.fromEntries(MARKS);
const SAVE_DELAY=1000,HOLD_MS=500,HOLD_SLOP=10,EDGE=70,EDGE_STEP=14;
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,label,cls)=>{const b=make('button',text,cls);b.type='button';b.onclick=fn;if(label)b.setAttribute('aria-label',label);return b;};
const uid=()=>'b'+crypto.randomUUID().replace(/-/g,'').slice(0,20);
const hashText=s=>{let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return h.toString(36)+'.'+s.length;};
const dotColor=id=>'hsl('+(parseInt(hashText(id),36)%360)+' 52% 50%)';
const linesOf=text=>String(text||'').split(/\r?\n/).map(t=>({text:t,mark:null}));
const blockText=b=>b.lines.map(l=>l.text).join('\n');
const fit=ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';};
const band=score=>score>=70?'good':score>=40?'mid':'low';

/* Nhấn giữ ~0,5 giây rồi kéo; hủy nếu ngón tay/chuột trượt quá 10px, nhả hoặc cuộn trước đó. */
function onHold(target,fire,busyNow){
 let timer=null,start=null;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 target.addEventListener('pointerdown',e=>{if(e.button>0)return;cancel();start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{timer=null;fire(start);},HOLD_MS);});
 target.addEventListener('pointermove',e=>{if(timer&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>HOLD_SLOP)cancel();});
 target.addEventListener('contextmenu',e=>{if(timer||busyNow())e.preventDefault();});
 for(const name of ['pointerup','pointercancel','pointerleave'])target.addEventListener(name,cancel);
}

function mount(opts){
 const el=make('section',undefined,'script-host');el.setAttribute('aria-label','Kịch bản');
 const head=make('header',undefined,'sp-head'),status=make('span','','sp-status');status.setAttribute('role','status');
 const scoreAll=button('Chấm cả kịch bản',()=>scoreWhole().catch(e=>opts.toast(e.message)),'Chấm cả kịch bản','sp-score-all');
 const done=button('Xong',()=>exitFocus(),'Thoát chế độ viết tập trung','sp-done');
 const copyBtn=button('Copy',()=>copyScript(),'Chép cả kịch bản','sp-copy');
 head.append(make('h2','Kịch bản'),status,scoreAll,copyBtn,done);
 /* Chép cả kịch bản thành chữ thường: tiêu đề khối, mỗi dòng kèm nhãn [V.O] [Motion]... */
 function scriptText(){const label=Object.fromEntries(MARKS);return blocks.map(b=>[b.title.trim(),...b.lines.filter(l=>l.text.trim()).map(l=>(l.mark?'['+label[l.mark]+'] ':'')+l.text.trim())].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');}
 async function copyScript(){const text=scriptText();if(!text){opts.toast('Chưa có chữ nào để chép.');return;}
  try{await navigator.clipboard.writeText(text);}catch(e){const t=make('textarea');t.value=text;t.style.cssText='position:fixed;opacity:0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok){opts.toast('Không chép được, trình duyệt chặn.');return;}}
  copyBtn.textContent='Đã chép ✓';setTimeout(()=>{copyBtn.textContent='Copy';},1500);}
 const empty=make('p','Chưa có kịch bản. Bấm ✍ Viết trên một thẻ để chép chữ của thẻ vào đây, hoặc bấm ＋ Khối mới để viết tự do.','sp-empty');
 const page=make('div',undefined,'sp-page'),addFree=button('＋ Khối mới',()=>{const b=newBlock();blocks.push(b);render();touched();focusTitle(b);},'Thêm khối viết tự do','sp-add');
 const barWrap=make('div',undefined,'sp-barwrap'),bar=make('div',undefined,'sp-bar');bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Nhãn dòng kịch bản');
 const chips=MARKS.map(([mark,label])=>{const b=button(label,()=>{const line=markTarget();if(line)toggleMark(line,mark);else opts.toast('Chạm vào một dòng trước khi gán nhãn.');},'Gán nhãn '+label+' cho dòng đang viết','sp-chip');b.dataset.mark=mark;b.setAttribute('aria-pressed','false');b.onpointerdown=e=>e.preventDefault();return b;});
 bar.append(...chips);barWrap.append(bar);const conflictBar=make('p','','sp-conflict');conflictBar.hidden=true;conflictBar.setAttribute('role','alert');
 el.append(head,conflictBar,empty,page,addFree,barWrap);
 /* Thanh 4 nhãn ẩn sẵn; chạm đúp vào khối kịch bản mới hiện (thoát Xong thì ẩn lại). */
 barWrap.hidden=true;let lastTap=0;
 function showBar(){if(!barWrap.hidden)return;barWrap.hidden=false;keyboard();requestAnimationFrame(keepCaret);}
 page.addEventListener('pointerup',e=>{if(e.button>0)return;const now=e.timeStamp;if(now-lastTap<350)showBar();lastTap=now;});
 page.addEventListener('dblclick',showBar);
 let pid=null,version=0,blocks=[],ratings={},busy=false,rev=0,dirty=false,timer=null,inflight=Promise.resolve(),pollTimer=null,base=[],cur={block:null,line:null},titleBlock=null,lastLine=null,focusOn=false,drag=null;
 const rows=new WeakMap();
 const cacheKey=()=>'picassoScreenplay:'+pid;
 const cache=()=>{try{localStorage.setItem(cacheKey(),JSON.stringify({version,blocks,dirty,base}));}catch(e){}};
 const newBlock=()=>({id:uid(),card_id:null,card_hash:'',title:'',lines:[{text:'',mark:null}]});
 const nodeOf=id=>page.querySelector('[data-id="'+id+'"]');
 const staleText=b=>{if(!b.card_id)return null;const t=opts.cardText(b.card_id);return t!==null&&t!==undefined&&hashText(t)!==b.card_hash?t:null;};

 function touched(){rev++;dirty=true;cache();status.textContent='Đang lưu…';clearTimeout(timer);timer=setTimeout(()=>saveScreenplay().catch(()=>{}),opts.saveDelay||SAVE_DELAY);}
 /* Mọi thao tác lưu đi qua đây; bản nháp luôn có sẵn trong localStorage. */
 function saveScreenplay(){
  clearTimeout(timer);
  inflight=inflight.catch(()=>{}).then(async()=>{
   if(!dirty||!pid)return;
   for(let attempt=0;attempt<2;attempt++){
    const sent=rev,project=pid,payload=structuredClone(blocks);status.textContent='Đang lưu…';
    try{
     const value=await opts.save(project,version,payload);if(project!==pid)return;
     version=value.version;base=payload;if(sent===rev)dirty=false;cache();status.textContent=dirty?'Đang lưu…':'Đã lưu';
     sync(value);return;
    }catch(error){
     if(attempt===0&&await mergeLatest(error))continue;
     status.textContent=error.message;cache();throw error;
    }
   }
  });
  return inflight;
 }

 /* Chip nhãn: dòng đang gõ; nếu đang ở tiêu đề thì dòng đầu của khối đó; không có thì dòng sửa gần nhất. */
 function markTarget(){if(cur.line)return cur.line;if(titleBlock&&blocks.includes(titleBlock))return titleBlock.lines[0]||null;return lastLine&&blocks.some(b=>b.lines.includes(lastLine))?lastLine:null;}
 /* Bản trên máy và bản máy chủ cùng đổi: gộp từng khối theo bản gốc, khối sửa ở hai nơi giữ cả hai. */
 async function mergeLatest(error){
  const net=root.PicassoOffline;if(!net?.isConflictError(error))return false;
  const latest=await opts.load();if(!latest)return false;
  const m=net.mergeBlocks(base,blocks,latest.blocks||[]);
  blocks=m.items;base=structuredClone(latest.blocks||[]);version=latest.version;rev++;dirty=true;cache();render();return true;
 }
 function paintConflict(){
  const n=blocks.filter(b=>String(b.title||'').startsWith(root.PicassoOffline?.COPY_PREFIX||'(bản trên máy) ')).length;
  conflictBar.hidden=!n;conflictBar.textContent=n?(root.PicassoOffline?.CONFLICT_BANNER||'Có đoạn sửa ở hai nơi — xem và xoá bản không cần'):'';
 }
 function mark(line,value){line.mark=value;const row=rows.get(line);if(!row)return;row.dataset.mark=value||'';const pill=row.querySelector('.sp-pill');pill.hidden=!value;pill.textContent=LABEL[value]||'';paintIndent(row);fit(row.querySelector('textarea'));}
 function paintIndent(row){const ta=row.querySelector('textarea'),pill=row.querySelector('.sp-pill');ta.style.textIndent=pill.hidden?'':(pill.offsetWidth+6)+'px';}
 function toggleMark(line,value){mark(line,line.mark===value?null:value);touched();refreshChips();}
 function refreshChips(){for(const c of chips)c.setAttribute('aria-pressed',String(cur.line?.mark===c.dataset.mark));}

 function focusTitle(block){requestAnimationFrame(()=>{const n=nodeOf(block.id);n?.scrollIntoView({block:'center',behavior:'smooth'});n?.querySelector('.sp-title').focus();});}
 function focusLine(line,caret){const ta=rows.get(line)?.querySelector('textarea');if(!ta)return;ta.focus();const at=caret===undefined?ta.value.length:caret;ta.setSelectionRange(at,at);}
 function rebuild(block,line,caret){const old=nodeOf(block.id);const fresh=buildBlock(block);old.replaceWith(fresh);fresh.querySelectorAll('.sp-line').forEach(paintIndent);fresh.querySelectorAll('textarea').forEach(fit);if(line)focusLine(line,caret);}

 function lineKey(e,block,line,ta){
  if(e.altKey&&/^Digit[1-4]$/.test(e.code)){e.preventDefault();toggleMark(line,MARKS[Number(e.code.slice(5))-1][0]);return;}
  if(e.isComposing)return;
  const i=block.lines.indexOf(line);
  if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey){e.preventDefault();splitLine(block,line,i,ta);return;}
  if(e.key==='Backspace'&&ta.selectionStart===0&&ta.selectionEnd===0){
   if(line.mark){e.preventDefault();mark(line,null);touched();refreshChips();}
   else if(i>0){e.preventDefault();const prev=block.lines[i-1],at=prev.text.length;prev.text+=line.text;block.lines.splice(i,1);touched();rebuild(block,prev,at);}
  }
 }
 function splitLine(block,line,i,ta){
  const atEnd=ta.selectionStart===ta.value.length&&ta.selectionEnd===ta.value.length;
  if(atEnd&&!line.text&&i>0&&i===block.lines.length-1){   // dòng trống cuối khối + Enter = sang khối kế tiếp
   block.lines.pop();const next=newBlock();blocks.splice(blocks.indexOf(block)+1,0,next);render();touched();focusTitle(next);return;
  }
  const before=ta.value.slice(0,ta.selectionStart),after=ta.value.slice(ta.selectionEnd),added={text:after,mark:null};
  line.text=before;block.lines.splice(i+1,0,added);touched();rebuild(block,added,0);
 }

 function buildLine(block,line){
  const row=make('div',undefined,'sp-line');rows.set(line,row);
  const pill=button('',()=>{mark(line,null);touched();refreshChips();},'Bỏ nhãn dòng','sp-pill');pill.tabIndex=-1;pill.onpointerdown=e=>e.preventDefault();
  const ta=make('textarea');ta.rows=1;ta.value=line.text;ta.maxLength=20000;ta.spellcheck=false;ta.setAttribute('aria-label','Dòng kịch bản');
  ta.oninput=()=>{line.text=ta.value;fit(ta);touched();};
  ta.onfocus=()=>{enterFocus();cur={block,line};lastLine=line;titleBlock=null;refreshChips();};
  ta.onkeydown=e=>lineKey(e,block,line,ta);
  onHold(ta,point=>startDrag('line',block,line,point),()=>Boolean(drag));
  row.append(pill,ta);row.dataset.mark=line.mark||'';pill.hidden=!line.mark;pill.textContent=LABEL[line.mark]||'';
  return row;
 }
 function buildBlock(block){
  const node=make('article',undefined,'sp-block');node.dataset.id=block.id;if(String(block.title||'').startsWith('(bản trên máy)'))node.classList.add('sp-local-copy');
  const dot=button('',()=>opts.reveal(block.card_id),'Xem thẻ liên kết','sp-dot');dot.hidden=!block.card_id;dot.style.background=dotColor(block.card_id||'');
  const main=make('div',undefined,'sp-main'),title=make('textarea',undefined,'sp-title');title.rows=1;
  title.value=block.title;title.maxLength=500;title.placeholder='Tiêu đề khối';title.setAttribute('aria-label','Tiêu đề khối');
  title.oninput=()=>{if(title.value.includes('\n'))title.value=title.value.replace(/\s*\n\s*/g,' ');block.title=title.value;fit(title);touched();};requestAnimationFrame(()=>fit(title));
  title.onfocus=()=>{enterFocus();titleBlock=block;cur={block,line:null};refreshChips();};
  title.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();focusLine(block.lines[0],0);}};
  onHold(title,point=>startDrag('block',block,null,point),()=>Boolean(drag));
  const stale=button('Thẻ đã đổi · cập nhật?',()=>recopy(block),'Cập nhật khối theo thẻ đã đổi','sp-stale');stale.hidden=staleText(block)===null;
  const lines=make('div',undefined,'sp-lines');for(const line of block.lines)lines.append(buildLine(block,line));
  const side=make('div',undefined,'sp-side'),slot=make('div',undefined,'sp-slot');
  const del=button('✕',()=>removeBlock(block),'Xóa khối khỏi kịch bản','sp-del');
  side.append(slot,del);main.append(title,stale,lines);node.append(dot,main,side);paintBadge(block,slot);
  return node;
 }
 function render(){page.replaceChildren(...blocks.map(buildBlock));empty.hidden=blocks.length>0;paintConflict();requestAnimationFrame(()=>{page.querySelectorAll('.sp-line').forEach(paintIndent);page.querySelectorAll('textarea').forEach(fit);});}
 function removeBlock(block){
  if(blockText(block).trim()&&!root.confirm('Xóa khối này khỏi kịch bản? Thẻ trong Vùng Ký Ức không bị ảnh hưởng.'))return;
  blocks=blocks.filter(b=>b!==block);if(cur.block===block)cur={block:null,line:null};render();touched();
 }
 function recopy(block){
  const text=staleText(block);if(text===null)return;
  if(!root.confirm('Thay chữ trong khối bằng nội dung mới của thẻ? Phần Anh đã sửa trong khối này sẽ mất.'))return;
  block.lines=linesOf(text);block.card_hash=hashText(text);touched();rebuild(block);
 }

 /* Điểm Người xem ở lề phải của từng khối. */
 function paintBadge(block,slot){
  slot.replaceChildren();const r=ratings['sp_'+block.id];if(!r)return;
  const ok=r.status==='scored',b=button(ok?String(r.score):r.status==='failed'?'!':'…',()=>note.hidden=!note.hidden,'Điểm Người xem','sp-badge');
  b.dataset.band=ok?band(r.score):'none';b.classList.toggle('stale',Boolean(r.stale));
  const note=make('div',ok?r.reason+' · Nguy cơ rời xem '+r.exitRisk+'%'+(r.stale?' (điểm cũ, cần chấm lại)':''):r.error||'Đang chấm…','sp-note');note.hidden=true;
  slot.append(b,note);
 }
 function sync(view){
  if(!view)return;ratings=view.ratings||{};busy=Boolean(view.busy);
  scoreAll.disabled=busy;scoreAll.textContent=busy?'Đang chấm…':'Chấm cả kịch bản';
  for(const b of blocks){const n=nodeOf(b.id);if(!n)continue;paintBadge(b,n.querySelector('.sp-slot'));n.querySelector('.sp-stale').hidden=staleText(b)===null;}
  clearTimeout(pollTimer);if(busy)pollTimer=setTimeout(()=>opts.load().catch(()=>{}),3000);
 }
 async function scoreWhole(){
  await saveScreenplay();
  if(!blocks.some(b=>b.title.trim()||blockText(b).trim())){opts.toast('Chưa có chữ nào để chấm.');return;}
  await opts.score(pid);sync(await opts.load());
 }

 /* Chế độ viết tập trung: ẩn mọi thứ khác; thoát bằng nút Xong, Escape hoặc nút Back. */
 function enterFocus(){
  if(focusOn)return;focusOn=true;document.body.classList.add('sp-focus');
  try{history.pushState({spFocus:1},'');}catch(e){}
  keyboard();
 }
 function exitFocus(fromPop){
  if(!focusOn)return;focusOn=false;endDrag();document.body.classList.remove('sp-focus');
  barWrap.hidden=true;document.activeElement?.blur?.();el.style.top=el.style.height=el.style.bottom=barWrap.style.top='';
  if(fromPop!==true&&history.state?.spFocus){try{history.back();}catch(e){}}
 }
 root.addEventListener('popstate',()=>{if(focusOn)exitFocus(true);});
 el.addEventListener('keydown',e=>{if(e.key==='Escape'&&focusOn){e.preventDefault();e.stopPropagation();if(drag)endDrag();else exitFocus();}});

 /* Nhấn giữ một dòng (hoặc tiêu đề) rồi kéo để chuyển chỗ; thả xong lưu qua saveScreenplay(). */
 const swallow=e=>{if(e.cancelable)e.preventDefault();};
 function scrollerOf(){for(let n=page.parentElement;n;n=n.parentElement){const o=getComputedStyle(n).overflowY;if((o==='auto'||o==='scroll')&&n.scrollHeight>n.clientHeight)return n;}return document.scrollingElement;}
 function dropSpot(kind,y,block,line){
  if(kind==='block'){
   let last=null;
   for(const b of blocks){if(b===block)continue;const n=nodeOf(b.id);if(!n)continue;const r=n.getBoundingClientRect();if(y<r.top+r.height/2)return {y:r.top,at:blocks.indexOf(b)};last=r;}
   return last?{y:last.bottom,at:blocks.length}:null;
  }
  let prev=null;
  for(const b of blocks)for(let i=0;i<b.lines.length;i++){
   const l=b.lines[i],row=l===line?null:rows.get(l);if(!row)continue;
   const r=row.getBoundingClientRect();
   if(y<r.top+r.height/2){
    if(i===0&&prev&&prev.b!==b&&y<r.top)return {y:prev.r.bottom,b:prev.b,at:prev.b.lines.length};
    return {y:r.top,b,at:i};
   }
   prev={b,r};
  }
  return prev?{y:prev.r.bottom,b:prev.b,at:prev.b.lines.length}:null;
 }
 function startDrag(kind,block,line,point){
  if(drag)return;
  const src=kind==='block'?nodeOf(block.id):rows.get(line);if(!src)return;
  navigator.vibrate?.(15);
  const label=(kind==='block'?(block.title||blockText(block)):line.text).trim().slice(0,100);
  const ghost=make('div',label||(kind==='block'?'Khối':'Dòng trống'),'sp-ghost'),indicator=make('div',undefined,'sp-drop');
  const rect=src.getBoundingClientRect(),pr=page.getBoundingClientRect();
  ghost.style.left=Math.max(6,rect.left)+'px';ghost.style.width=Math.min(rect.width,innerWidth-12)+'px';
  indicator.style.left=pr.left+'px';indicator.style.width=pr.width+'px';
  document.body.append(ghost,indicator);src.classList.add('sp-dragsrc');document.body.classList.add('sp-dragging');
  root.getSelection?.()?.removeAllRanges();
  drag={kind,block,line,src,ghost,indicator,y:point.y,spot:null,scroller:scrollerOf(),raf:0};
  const move=e=>{drag.y=e.clientY;paintDrag();};
  const up=e=>{drag.y=e.clientY;dropDrag();};
  const lis=[['pointermove',move],['pointerup',up],['pointercancel',()=>endDrag()],['touchmove',swallow,{passive:false}],['selectstart',swallow],['contextmenu',swallow]];
  for(const [n,f,o] of lis)document.addEventListener(n,f,o);
  drag.off=()=>{for(const [n,f,o] of lis)document.removeEventListener(n,f,o);};
  const tick=()=>{
   if(!drag)return;const sc=drag.scroller,whole=sc===document.scrollingElement,box=whole?{top:0,bottom:innerHeight}:sc.getBoundingClientRect();
   if(drag.y<box.top+EDGE)sc.scrollTop-=EDGE_STEP;else if(drag.y>box.bottom-EDGE)sc.scrollTop+=EDGE_STEP;
   paintDrag();drag.raf=requestAnimationFrame(tick);
  };
  paintDrag();drag.raf=requestAnimationFrame(tick);
 }
 function paintDrag(){
  if(!drag)return;
  drag.ghost.style.top=(drag.y-18)+'px';
  drag.spot=dropSpot(drag.kind,drag.y,drag.block,drag.line);
  drag.indicator.hidden=!drag.spot;if(drag.spot)drag.indicator.style.top=(drag.spot.y-2)+'px';
 }
 function endDrag(){
  if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(d.raf);d.off();d.ghost.remove();d.indicator.remove();
  d.src.classList.remove('sp-dragsrc');document.body.classList.remove('sp-dragging');
 }
 function dropDrag(){
  const d=drag;if(!d)return;const spot=d.spot;endDrag();if(!spot)return;
  if(d.kind==='block'){
   const from=blocks.indexOf(d.block);let at=spot.at;if(from<at)at--;
   if(from===at)return;blocks.splice(from,1);blocks.splice(at,0,d.block);
  }else{
   const src=blocks.find(b=>b.lines.includes(d.line)),from=src.lines.indexOf(d.line);let at=spot.at;
   if(src===spot.b&&from<at)at--;
   if(src===spot.b&&from===at)return;
   src.lines.splice(from,1);if(!src.lines.length)src.lines.push({text:'',mark:null});
   spot.b.lines.splice(at,0,d.line);
  }
  render();touched();saveScreenplay().catch(()=>{});
 }

 /* Thanh nhãn luôn nằm trên bàn phím điện thoại. */
 function keyboard(){const vv=root.visualViewport;if(!vv||!focusOn){el.style.top=el.style.height=el.style.bottom=barWrap.style.top='';return;}el.style.top=vv.offsetTop+'px';el.style.height=vv.height+'px';el.style.bottom='auto';barWrap.style.top=(vv.offsetTop+vv.height-barWrap.offsetHeight)+'px';keepCaret();}
 /* Giữ dòng đang gõ nằm trên thanh nhãn và bàn phím. */
 function keepCaret(){const a=document.activeElement;if(!focusOn||!a||!el.contains(a)||a.tagName!=='TEXTAREA')return;const box=el.getBoundingClientRect(),r=a.getBoundingClientRect(),limit=box.bottom-barWrap.offsetHeight-24;const atEnd=a.selectionStart>=a.value.length-1,lineH=parseFloat(getComputedStyle(a).lineHeight)||30;const target=atEnd?r.bottom:Math.min(r.bottom,r.top+lineH*2);if(target>limit)el.scrollTop+=target-limit;else if(r.top<box.top+60)el.scrollTop-=box.top+60-r.top;}
 el.addEventListener('input',()=>requestAnimationFrame(keepCaret));el.addEventListener('focusin',()=>setTimeout(keepCaret,300));
 root.visualViewport?.addEventListener('resize',keyboard);root.visualViewport?.addEventListener('scroll',keyboard);
 root.addEventListener('resize',()=>page.querySelectorAll('textarea').forEach(fit));
 /* Thanh Draft cố định phía dưới: chừa chỗ để không che thanh nhãn và cuối kịch bản. */
 function trackBottomBar(){
  const bottom=document.querySelector('.bottom');if(!bottom||!root.ResizeObserver)return;
  const set=()=>document.documentElement.style.setProperty('--bottom-bar',(getComputedStyle(bottom).display==='none'?0:Math.ceil(bottom.getBoundingClientRect().height))+'px');
  new ResizeObserver(set).observe(bottom);set();
 }
 trackBottomBar();

 function reveal(id){const n=nodeOf(id);if(!n)return;n.scrollIntoView({block:'center',behavior:'smooth'});n.classList.add('sp-flash');setTimeout(()=>n.classList.remove('sp-flash'),1500);}
 async function write(card){
  const found=blocks.find(b=>b.card_id===card.id);if(found){reveal(found.id);return;}
  let info;try{info=await opts.cardInfo(card);}catch(e){opts.toast(e.message);return;}
  const block={id:uid(),card_id:card.id,card_hash:hashText(info.text),title:info.title,lines:linesOf(info.text)};
  const at=blocks.indexOf(cur.block);blocks.splice(at<0?blocks.length:at+1,0,block);
  render();touched();reveal(block.id);
 }
 function open(project,view){
  pid=project;version=view.version;blocks=structuredClone(view.blocks||[]);base=structuredClone(blocks);dirty=false;cur={block:null,line:null};status.textContent=blocks.length?'Đã lưu':'';
  let cached=null;try{cached=JSON.parse(localStorage.getItem(cacheKey())||'null');}catch(e){}
  if(cached?.dirty&&Array.isArray(cached.blocks)){
   const net=root.PicassoOffline;
   if(net)blocks=net.mergeBlocks(cached.base||null,cached.blocks,blocks).items;else{blocks=cached.blocks;version=cached.version;}
   touched();status.textContent='Đã khôi phục bản chưa lưu trên thiết bị này.';
  }
  render();sync(view);
 }
 return {el,open,sync,write,saveScreenplay,isDirty:()=>dirty};
}
const api={mount,hashText};if(typeof module==='object'&&module.exports)module.exports=api;else root.PicassoScriptPage=api;
})(typeof window==='undefined'?globalThis:window);
