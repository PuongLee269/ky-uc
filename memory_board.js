/* Spatial story cards. No model calls; all editing happens locally. */
(function(root){
'use strict';
const ICONS=[
 ['home','🏡','Ngôi nhà trên thảo nguyên','nha home lang que khoi dau'],['question','❓','Dấu hỏi chấm','hoi question bi an'],['eye','👁️','Con mắt','mat eye nhin'],['quest','📜','Cuộn giấy nhiệm vụ','nhiem vu quest cuon giay'],['book','📖','Cuốn sách','sach book kien thuc'],['swords','⚔️','Hai thanh kiếm chặn nhau','kiem xung dot conflict'],['fallen','🙇','Người gục ngã','nguoi nga that bai'],['bulb','💡','Bóng đèn','den y tuong idea'],['mandarin','🍊','Quả quýt','quyt cam orange'],
 ['heart','❤️','Trái tim','tinh yeu heart'],['door','🚪','Cánh cửa','cua khoi dau'],['mountain','⛰️','Ngọn núi','nui thu thach'],['road','🛤️','Con đường','duong hanh trinh'],['sun','☀️','Mặt trời','mat troi ngay'],['moon','🌙','Mặt trăng','trang dem'],['rain','🌧️','Cơn mưa','mua buon'],['tree','🌳','Cây xanh','cay thien nhien'],['flower','🌸','Bông hoa','hoa flower'],['camera','🎥','Máy quay','may quay phim'],['person','🧑','Nhân vật','nhan vat nguoi'],['people','🫂','Gặp gỡ','gap go ban be'],['clock','⏳','Đồng hồ cát','thoi gian cho doi'],['key','🗝️','Chìa khóa','chia khoa giai dap'],['map','🗺️','Bản đồ','ban do noi chon'],['fire','🔥','Ngọn lửa','lua cao trao'],['flag','🏁','Về đích','ket thuc dich'],['music','🎵','Âm nhạc','nhac am thanh'],['wave','🌊','Sóng biển','song bien nuoc'],['star','⭐','Ngôi sao','sao mong uoc'],['puzzle','🧩','Mảnh ghép','ghep ket noi']
].map(([id,glyph,name,keywords])=>({id,glyph,name,keywords}));
ICONS.push(...[["crystals", "💎", "Pha lê", "pha le tinh the crystals"], ["sprout", "🌱", "Mầm cây", "mam cay sprout khoi dau"], ["mask", "🎭", "Mặt nạ", "mat na mask an giau"], ["letter", "✉️", "Bức thư", "buc thu letter tin nhan"], ["potion", "⚗️", "Thuốc phép", "thuoc phep potion phep thuat"], ["quill", "🪶", "Bút lông", "but long quill viet"], ["lantern", "🏮", "Đèn lồng", "den long lantern anh sang"], ["tent", "⛺", "Lều trại", "leu trai tent nghi chan"], ["telescope", "🔭", "Kính thiên văn", "kinh thien van telescope nhin xa"], ["stones", "🪨", "Đá cân bằng", "da can bang stones binh yen"], ["lotus", "🪷", "Hoa sen", "hoa sen lotus thanh than"]].map(([id,glyph,name,keywords])=>({id,glyph,name,keywords})));
const CARD_ART={"home": "card_01_01_cottage.png", "question": "card_01_02_question_mark.png", "eye": "card_01_03_eye.png", "quest": "card_01_04_scroll.png", "book": "card_01_05_open_book.png", "swords": "card_01_06_crossed_swords.png", "fallen": "card_03_04_wanderer.png", "bulb": "card_01_08_lightbulb.png", "mandarin": "card_02_01_orange.png", "heart": "card_02_02_heart.png", "door": "card_02_03_door.png", "mountain": "card_02_04_mountain.png", "road": "card_02_05_winding_road.png", "sun": "card_02_06_sun.png", "moon": "card_02_07_moon.png", "rain": "card_02_08_rain_cloud.png", "tree": "card_03_01_tree.png", "flower": "card_03_02_flower.png", "camera": "card_03_03_film_camera.png", "person": "card_03_04_wanderer.png", "people": "card_01_07_people.png", "clock": "card_03_05_hourglass.png", "key": "card_03_06_key.png", "map": "card_03_07_treasure_map.png", "fire": "card_03_08_flame.png", "flag": "card_04_01_finish_flag.png", "music": "card_04_02_music.png", "wave": "card_04_03_ocean_wave.png", "star": "card_04_04_star.png", "puzzle": "card_04_05_puzzle_piece.png", "crystals": "card_04_06_crystals.png", "sprout": "card_04_07_sprout.png", "mask": "card_04_08_mask.png", "letter": "card_05_01_letter.png", "potion": "card_05_02_potion.png", "quill": "card_05_03_quill.png", "lantern": "card_05_04_lantern.png", "tent": "card_05_05_tent.png", "telescope": "card_05_06_telescope.png", "stones": "card_05_07_stacked_stones.png", "lotus": "card_05_08_lotus.png"};
for(const icon of ICONS){icon.image="story-cards/"+CARD_ART[icon.id]+"?v=1";if(icon.id==="fallen")icon.legacyOnly=true;}

function loadArt(image,url){
 let retries=0;
 image.onerror=()=>{if(retries>=2)return;const attempt=++retries;setTimeout(()=>{if(image.isConnected)image.src=url+(url.includes('?')?'&':'?')+'retry='+attempt;},250*attempt);};
 image.src=url;
}
const LABELS=['','Ex','Cx','Cm','R'],W=132,H=160,GAP=24;
const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const iconFor=id=>ICONS.find(icon=>icon.id===id)||ICONS[0];
function ordered(cards){
 const remaining=[...cards].sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id)),result=[];
 while(remaining.length){const top=remaining[0].y,row=remaining.filter(c=>c.y<top+H/2);row.sort((a,b)=>a.x-b.x||a.y-b.y||a.id.localeCompare(b.id));result.push(...row);for(const c of row)remaining.splice(remaining.indexOf(c),1);}
 return result;
}
function snap(card,cards,x,y){
 let dx=11,dy=11,guideX=null,guideY=null;
 for(const other of cards){if(other.id===card.id)continue;
  for(const target of [other.x,other.x-W-GAP,other.x+W+GAP])if(Math.abs(target-x)<Math.abs(dx)){dx=target-x;guideX=target===other.x?target+W/2:target;}
  for(const target of [other.y,other.y-H-GAP,other.y+H+GAP])if(Math.abs(target-y)<Math.abs(dy)){dy=target-y;guideY=target===other.y?target+H/2:target;}
 }
 return {x:Math.max(0,Math.min(5800,x+(Math.abs(dx)<=10?dx:0))),y:Math.max(0,Math.min(5800,y+(Math.abs(dy)<=10?dy:0))),guideX,guideY};
}
function mount(options){
 const DEFAULT_SECONDS=3;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,label)=>{const b=make('button',text);b.type='button';b.onclick=fn;if(label)b.setAttribute('aria-label',label);return b;};
 const page=make('section',undefined,'memory-page');page.hidden=true;page.addEventListener('pointerdown',e=>{if(e.target.closest('button'))cancelCardTap();});page.setAttribute('aria-label','Vùng Ký Ức');
 const toolbar=make('header',undefined,'memory-toolbar'),back=options.persistent?null:button(options.backLabel||'← Sáng tạo',close),heading=options.heading||make('h1',options.title||'Vùng Ký Ức');
 const add=button('＋',()=>openIcons(null),'Thêm thẻ ký ức'),done=button(options.actionLabel||'Hoàn thành',async()=>{done.disabled=true;try{await save();await options.action(project,ordered(cards));}catch(e){status.textContent=e.message;}finally{done.disabled=false;}});add.className='memory-add';done.className='memory-done';done.hidden=!options.action;
 const chartBtn=button('📈 Người xem chấm',()=>{closeMenu(true);toggleChart();});chartBtn.className='memory-menu-item';chartBtn.setAttribute('role','menuitem');chartBtn.setAttribute('aria-pressed','false');chartBtn.hidden=!options.viewer;
 /* Menu ⋯: các việc ít dùng (Dựng tinh, Cài đặt, Người xem chấm, chạy lại…). options.menu() trả về danh sách {label,run|href,disabled}; {chart:true} là chỗ của Người xem chấm. */
 const moreBtn=button('⋯',()=>{if(menu.hidden)openMenu();else closeMenu(true);},'Thêm tùy chọn');moreBtn.className='memory-more-btn';moreBtn.setAttribute('aria-haspopup','menu');moreBtn.setAttribute('aria-expanded','false');
 const menu=make('div',undefined,'memory-menu');menu.setAttribute('role','menu');menu.hidden=true;
 const moreWrap=make('span',undefined,'memory-more');moreWrap.append(moreBtn,menu);
 function menuItem(item){
  if(item.chart)return chartBtn;
  const node=item.href?make('a',item.label):button(item.label,()=>{closeMenu(true);item.run?.();});
  if(item.href){node.href=item.href;node.onclick=()=>closeMenu();}
  node.className='memory-menu-item';node.setAttribute('role','menuitem');if(item.disabled)node.disabled=true;
  return node;
 }
 const menuNodes=()=>[...menu.children].filter(n=>!n.disabled);
 function openMenu(){
  const items=(options.menu?options.menu():[{chart:true}]).filter(i=>!i.chart||options.viewer);
  menu.replaceChildren(...items.map(menuItem));menu.hidden=false;moreBtn.setAttribute('aria-expanded','true');menuNodes()[0]?.focus();
 }
 function closeMenu(refocus){if(menu.hidden)return;menu.hidden=true;moreBtn.setAttribute('aria-expanded','false');if(refocus)moreBtn.focus();}
 menu.addEventListener('keydown',e=>{
  const nodes=menuNodes(),i=nodes.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){e.preventDefault();nodes[(i+1)%nodes.length]?.focus();}
  else if(e.key==='ArrowUp'){e.preventDefault();nodes[(i<=0?nodes.length:i)-1]?.focus();}
  else if(e.key==='Home'){e.preventDefault();nodes[0]?.focus();}
  else if(e.key==='End'){e.preventDefault();nodes[nodes.length-1]?.focus();}
  else if(e.key==='Tab')closeMenu(true);
 });
 page.addEventListener('pointerdown',e=>{if(!menu.hidden&&!moreWrap.contains(e.target))closeMenu();});
 toolbar.append(...(back?[back]:[]),heading,...(options.toolbar||[]),moreWrap,add,done);
 const hint=make('p',options.doubleClickOpen?'Bấm thẻ để ghi chú · Bấm đúp thẻ để xem thẻ con · Bấm đúp vùng trống để thêm thẻ':'Nhấp đúp vùng trống để thêm thẻ · Kéo thẻ để xếp chuyện · Chạm thẻ để ghi chú','memory-hint');hint.hidden=true;  // chỉ hiện khi bảng chưa có thẻ
 const status=make('p','', 'memory-status');status.setAttribute('role','status');const statusRow=make('div',undefined,'memory-statusrow');statusRow.append(status,...(options.statusExtra||[]));
 const viewport=make('div',undefined,'memory-viewport');viewport.tabIndex=0;viewport.setAttribute('aria-label','Không gian sắp xếp thẻ. Cuộn hoặc kéo nền để di chuyển.');
 const surface=make('div',undefined,'memory-surface');viewport.append(surface);
 const guideX=make('div',undefined,'memory-guide vertical'),guideY=make('div',undefined,'memory-guide horizontal');guideX.hidden=guideY.hidden=true;
 const empty=make('div','Một câu chuyện bắt đầu từ một ký ức.\nBấm ＋ để tạo thẻ đầu tiên.','memory-empty');
 const emotionHost=make('div',undefined,'memory-chart-host');emotionHost.hidden=true;
 function toggleChart(force){const show=force??emotionHost.hidden;emotionHost.hidden=!show;chartBtn.setAttribute('aria-pressed',String(show));if(show)viewerChart?.refresh().catch(()=>{});}
 emotionHost.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();toggleChart(false);moreBtn.focus();}});const workspace=make('div',undefined,'memory-workspace');workspace.append(viewport,emotionHost);if(options.below){workspace.classList.add('has-script');workspace.append(options.below);}page.append(toolbar,hint,statusRow,workspace);document.body.append(page);
 const shade=make('div',undefined,'memory-shade');shade.hidden=true;const dialog=make('section',undefined,'memory-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');shade.append(dialog);page.append(shade);
 let cards=[],baseCards=[],version=0,project=null,dirty=false,revision=0,timer=null,saveQueue=Promise.resolve(),active=false,pointerEditing=false,selected=null,lastFocus=null,returnFocus=null,noteEditor=null,backdropStarted=false;
 let loaded=false,emotion=null,viewerChart=null,viewerRatings={},cardTap=null,lastDouble=null;
 function cancelCardTap(){if(cardTap){clearTimeout(cardTap.timer);cardTap=null;}}
 function clickCard(card){
  if(!options.doubleClickOpen){openCard(card);return;}
  const now=Date.now();
  if(lastDouble&&lastDouble.id===card.id&&now-lastDouble.at<550)return;
  if(cardTap&&cardTap.id===card.id){cancelCardTap();lastDouble={id:card.id,at:now};openCard(card);return;}
  cancelCardTap();cardTap={id:card.id,timer:setTimeout(()=>{cardTap=null;if(active)openNote(card);},500)};
 }
 const storageKey=p=>'picassodrafMemory:'+p+(options.storageScope?':'+options.storageScope():'');
 function local(){try{localStorage.setItem(storageKey(project),JSON.stringify({cards,baseCards,version,dirty}));}catch(e){status.textContent='Bộ nhớ thiết bị đầy; giữ trang mở và thử lưu lại.';}}
 function conflictNote(n){status.textContent='Có thẻ sửa ở hai nơi ('+n+') — xem và xoá bản "(bản trên máy)" không cần';}
 function changed(){revision++;dirty=true;local();clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),options.saveDelay||500);}
 function save(){clearTimeout(timer);saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  if(!dirty)return;
  for(let attempt=0;attempt<2;attempt++){
   const sent=revision,pid=project,payload=structuredClone(cards);
   status.textContent='Đang lưu Vùng Ký Ức…';
   try{
    const value=await options.save(pid,version,payload);if(project!==pid)return;
    version=value.version;baseCards=structuredClone(value.cards||payload);
    if(sent===revision){dirty=Boolean(options.reconcile&&pointerEditing);if(options.reconcile&&value.cards&&!pointerEditing){cards=structuredClone(value.cards);render();}}
    local();status.textContent=dirty?'Có thay đổi mới đang chờ lưu.':'Đã lưu · '+cards.length+' thẻ';const copies=options.merge?cards.filter(c=>String(c.caption||'').startsWith('(bản trên máy)')).length:0;if(copies)conflictNote(copies);
    if(dirty){clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),500);}return;
   }catch(error){
    if(attempt===0&&options.merge&&options.isConflict?.(error)){
     if(pointerEditing){dirty=true;local();clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),500);return;}
     const latest=await options.load();if(latest.project!==project)throw error;
     const m=options.merge(baseCards,cards,latest.board.cards);cards=m.items;baseCards=structuredClone(latest.board.cards);version=latest.board.version;
     revision++;dirty=true;local();render();if(m.conflicts)conflictNote(m.conflicts);continue;
    }
    if(attempt===0&&options.reconcile&&/Thẻ con đã thay đổi/.test(error.message)){
     if(pointerEditing){dirty=true;local();clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),500);return;}
     const latest=await options.load();if(latest.project!==project)throw error;
     cards=options.reconcile({localCards:cards,baseCards,remoteCards:latest.board.cards});
     baseCards=structuredClone(latest.board.cards);version=latest.board.version;revision++;dirty=true;local();render();continue;
    }
    status.textContent=error.message;local();throw error;
   }
  }
 });return saveQueue;}
 if(options.persistent){page.hidden=false;document.body.classList.add('memory-open');status.textContent='Đang tải dự án…';add.disabled=true;}
 async function open(){
  if(active)return;returnFocus=document.activeElement;page.hidden=false;active=true;document.body.classList.add('memory-open');status.textContent='Đang tải…';add.disabled=done.disabled=true;
  try{const value=await options.load();loaded=true;project=value.project;version=value.board.version;cards=structuredClone(value.board.cards);baseCards=structuredClone(value.board.cards);dirty=false;
   let cached;try{cached=JSON.parse(localStorage.getItem(storageKey(project))||'null');}catch(e){}
   if(cached?.dirty&&Array.isArray(cached.cards)){
    if(options.merge){const m=options.merge(cached.baseCards||null,cached.cards,value.board.cards);cards=m.items;baseCards=structuredClone(value.board.cards);if(m.conflicts)conflictNote(m.conflicts);}
    else if(options.reconcile){cards=options.reconcile({localCards:cached.cards,baseCards:cached.baseCards||null,remoteCards:value.board.cards});}
    else{cards=cached.cards;version=cached.version;}
    dirty=true;if(!status.textContent.startsWith('Có thẻ'))status.textContent='Đã khôi phục các thẻ chưa lưu trên thiết bị này.';
   }
   else status.textContent='Đã tải · '+cards.length+' thẻ';
   render();if(dirty)changed();if(options.viewer&&root.PicassoEmotion){if(!viewerChart){viewerChart=root.PicassoEmotion.mount(emotionHost,{title:'Người xem chấm',viewerOnly:true,updated:value=>{viewerRatings=value.ratings||{};emotion?.set({cards:ordered(cards),ratings:viewerRatings,selected:selected?.id});},read:async()=>({cards:ordered(cards),...await options.viewer(project)}),grade:async()=>{await save();await options.grade(project,null);await viewerChart.refresh();}});}await viewerChart.refresh();}add.disabled=done.disabled=false;back?.focus();
  }catch(error){status.textContent=error.message;if(options.retryOpen){active=false;throw error;}}
 }
 function close(){cancelCardTap();viewerChart?.stop();emotion?.stop();hideDialog();page.hidden=true;active=false;document.body.classList.remove('memory-open');save().catch(()=>{});returnFocus?.focus();options.closed?.();}
 function dimensions(){surface.style.width=Math.max(viewport.clientWidth,1800,...cards.map(c=>c.x+W+250))+'px';surface.style.height=Math.max(viewport.clientHeight,1200,...cards.map(c=>c.y+H+250))+'px';}
 function orderBadges(){for(const [i,card] of ordered(cards).entries()){const n=surface.querySelector('[data-order="'+card.id+'"]');if(n)n.textContent=String(i+1).padStart(2,'0');}emotion?.set({cards:ordered(cards),ratings:viewerRatings,selected:selected?.id});viewerChart?.set({cards:ordered(cards),ratings:viewerRatings,selected:selected?.id});}
 function render(){surface.replaceChildren();surface.append(empty,guideX,guideY);
  if(options.technical){const technical=button('📦 Cài đặt kỹ thuật',()=>options.technical(),'Cài đặt kỹ thuật');technical.className='memory-technical';surface.append(technical);}
empty.hidden=!!cards.length;hint.hidden=!!cards.length;guideX.hidden=guideY.hidden=true;
  for(const card of cards){
   const icon=iconFor(card.icon),node=make('div',undefined,'memory-card');node.dataset.card=card.id;node.style.left=card.x+'px';node.style.top=(card.y+(options.technical?70:0))+'px';node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',icon.name+' · '+(card.label||'Chưa có nhãn')+' · '+(card.caption||'Chạm để ghi chú'));
   const order=make('span',undefined,'memory-order');order.dataset.order=card.id;
   const label=button(card.label||'Nhãn',()=>openLabels(card),'Chọn nhãn cho thẻ '+icon.name);label.className='memory-label';
   const glyph=make('img',undefined,'memory-card-art');loadArt(glyph,icon.image);glyph.alt='';glyph.draggable=false;node.classList.add('memory-art-card');const caption=make('span',card.caption||'Chạm để ghi chú','memory-caption');
   const editNote=button('✎',()=>options.editNote?options.editNote(project,structuredClone(card)):openNote(card),'Ghi chú thẻ '+icon.name);editNote.className='memory-edit-note';
   const changeIcon=button('◇',()=>openIcons(card),'Đổi icon thẻ '+icon.name);changeIcon.className='memory-change-icon';
   node.append(order,label,glyph,caption,editNote,changeIcon);if(options.cardAction)node.classList.add('memory-has-write');if(card.source==='script'){const b=make('span','từ kịch bản','memory-script-badge');b.title='Thẻ tự tạo từ dòng đã đánh nhãn trong kịch bản';node.append(b);}if(options.cardAction){const w=button(options.cardAction.label,()=>options.cardAction.run(structuredClone(card)),options.cardAction.aria);w.className='memory-write';node.append(w);}if(options.applications){const scope=button(options.applications[card.scope||'ai']||options.applications.ai,()=>openLabels(card),'Phạm vi áp dụng của thẻ');scope.className='memory-scope';node.append(scope);}surface.append(node);
   let drag=null,suppressTap=false;
   node.onpointerdown=e=>{if(e.target.closest('button')||e.button!==0)return;pointerEditing=true;suppressTap=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:card.x,startY:card.y,moved:false};node.setPointerCapture(e.pointerId);};
   node.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;cancelCardTap();node.classList.add('dragging');
    const pos=snap(card,cards,drag.startX+dx,drag.startY+dy);card.x=pos.x;card.y=pos.y;node.style.left=card.x+'px';node.style.top=(card.y+(options.technical?70:0))+'px';
    guideX.hidden=pos.guideX===null;guideY.hidden=pos.guideY===null;guideX.style.left=pos.guideX+'px';guideY.style.top=pos.guideY+'px';dimensions();
   };
   function finish(e,cancelled){if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;pointerEditing=false;node.classList.remove('dragging');guideX.hidden=guideY.hidden=true;suppressTap=moved||cancelled;if(moved){changed();orderBadges();}}
   node.onpointerup=e=>finish(e,false);node.onpointercancel=e=>finish(e,true);
   node.onclick=e=>{if(e.target.closest('button'))return;if(suppressTap){suppressTap=false;return;}clickCard(card);};
   node.ondblclick=e=>{if(!options.doubleClickOpen||e.target.closest('button')||suppressTap)return;e.preventDefault();cancelCardTap();if(lastDouble&&lastDouble.id===card.id&&Date.now()-lastDouble.at<550)return;lastDouble={id:card.id,at:Date.now()};openCard(card);};
   node.onkeydown=e=>{if(e.target!==node)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();cancelCardTap();if(options.doubleClickOpen){if(e.key==='Enter')openCard(card);else openNote(card);}else openCard(card);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();card.x=Math.max(0,Math.min(5800,card.x+(e.key==='ArrowRight'?24:e.key==='ArrowLeft'?-24:0)));card.y=Math.max(0,Math.min(5800,card.y+(e.key==='ArrowDown'?24:e.key==='ArrowUp'?-24:0)));node.style.left=card.x+'px';node.style.top=(card.y+(options.technical?70:0))+'px';changed();orderBadges();dimensions();}};
  }dimensions();orderBadges();emotion?.set({cards:ordered(cards),ratings:viewerRatings,selected:selected?.id});viewerChart?.set({cards:ordered(cards),ratings:viewerRatings,selected:selected?.id});
 }
 let pan=null;
 viewport.onpointerdown=e=>{if(e.target!==surface&&e.target!==viewport&&e.target!==empty)return;cancelCardTap();if(e.pointerType==='touch'||e.button!==0)return;pan={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);};
 viewport.onpointermove=e=>{if(!pan||pan.id!==e.pointerId)return;viewport.scrollLeft=pan.left-(e.clientX-pan.x);viewport.scrollTop=pan.top-(e.clientY-pan.y);};
 viewport.onpointerup=viewport.onpointercancel=()=>{pan=null;};
 function blankTarget(target){return target===surface||target===viewport||target===empty;}
 function addAtPoint(e){
  cancelCardTap();
  if(!shade.hidden||!blankTarget(e.target))return;
  const bounds=surface.getBoundingClientRect();
  const x=Math.max(0,Math.min(5800,Math.round((e.clientX-bounds.left)/24)*24));
  const y=Math.max(0,Math.min(5800,Math.round((e.clientY-bounds.top-(options.technical?70:0))/24)*24));
  e.preventDefault();openIcons(null,{x,y});
 }
 viewport.ondblclick=addAtPoint;
 let touchStart=null,lastTap=null;
 viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&blankTarget(e.target))touchStart={id:e.pointerId,x:e.clientX,y:e.clientY};});
 viewport.addEventListener('pointercancel',()=>{touchStart=lastTap=null;});
 viewport.addEventListener('pointerup',e=>{
  if(e.pointerType!=='touch'||!touchStart||touchStart.id!==e.pointerId)return;
  const start=touchStart;touchStart=null;
  if(!blankTarget(e.target)||Math.hypot(e.clientX-start.x,e.clientY-start.y)>10){lastTap=null;return;}
  const now=Date.now();
  if(lastTap&&now-lastTap.time<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<24){lastTap=null;addAtPoint(e);}
  else lastTap={time:now,x:e.clientX,y:e.clientY};
 });
 async function openCard(card){
  selected=card;viewerChart?.set({cards:ordered(cards),ratings:viewerRatings,selected:card.id});emotion?.set({cards:ordered(cards),ratings:viewerRatings,selected:card.id});
  if(!options.openCard){openNote(card);return;}
  try{await save();await options.openCard(project,structuredClone(card),ordered(cards));}catch(e){status.textContent=e.message;}
 }
 function refreshCaption(card){
  const node=surface.querySelector('[data-card="'+card.id+'"]');if(!node)return;
  node.querySelector('.memory-caption').textContent=card.caption||'Chạm để ghi chú';
  node.setAttribute('aria-label',iconFor(card.icon).name+' · '+(card.label||'Chưa có nhãn')+' · '+(card.caption||'Chạm để ghi chú'));
 }
 function commitNote(){
  if(!noteEditor)return;const {card,text}=noteEditor;
  if(cards.includes(card)&&card.caption!==text.value){card.caption=text.value;refreshCaption(card);changed();}
 }
 function showDialog(title){cancelCardTap();commitNote();noteEditor=null;backdropStarted=false;lastFocus=document.activeElement;dialog.replaceChildren();dialog.setAttribute('aria-label',title);const head=make('div',undefined,'memory-dialog-head');head.append(make('h2',title),button('Đóng',hideDialog));dialog.append(head);shade.hidden=false;return dialog;}
 function hideDialog(){commitNote();noteEditor=null;backdropStarted=false;shade.hidden=true;save().catch(()=>{});lastFocus?.isConnected&&lastFocus.focus();}
 shade.onpointerdown=e=>{backdropStarted=e.target===shade;};
 shade.onpointercancel=()=>{backdropStarted=false;};
 shade.onclick=e=>{const dismiss=backdropStarted&&e.target===shade;backdropStarted=false;if(dismiss)hideDialog();};
 page.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!menu.hidden)closeMenu(true);else if(!shade.hidden)hideDialog();else if(!options.persistent)close();return;}if(e.key==='Tab'&&!shade.hidden){const nodes=[...dialog.querySelectorAll('button,input,textarea,select')].filter(n=>!n.disabled&&!n.hidden);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 function openIcons(card,newPosition=null){
  selected=card;const host=showDialog(card?'Đổi hình':'Chọn hình cho thẻ mới');const search=make('input');search.type='search';search.placeholder='Tìm thẻ: nhà, mắt, kiếm, quýt…';search.setAttribute('aria-label','Tìm icon');const grid=make('div',undefined,'memory-icon-grid');host.append(search,grid);
  function results(){grid.replaceChildren();const term=fold(search.value);for(const icon of ICONS.filter(i=>!i.legacyOnly&&fold(i.name+' '+i.keywords).includes(term))){let choiceStarted=false;const b=button('',event=>{if(event?.isTrusted&&event.detail>0&&!choiceStarted)return;choiceStarted=false;if(selected){selected.icon=icon.id;}else{let x=newPosition?.x??Math.round((viewport.scrollLeft+32)/24)*24,y=newPosition?.y??Math.round((viewport.scrollTop+32)/24)*24;while(cards.some(c=>Math.abs(c.x-x)<W&&Math.abs(c.y-y)<H)){x+=W+GAP;if(x>viewport.scrollLeft+Math.max(viewport.clientWidth-W,160)){x=Math.round((viewport.scrollLeft+32)/24)*24;y+=H+GAP;}}cards.push({id:crypto.randomUUID(),icon:icon.id,label:'',caption:'',x:Math.min(5800,x),y:Math.min(5800,y),...(options.applications?{scope:'ai'}:{})});}changed();hideDialog();render();},icon.name);b.onpointerdown=()=>{choiceStarted=true;};b.onpointercancel=()=>{choiceStarted=false;};const art=make('img',undefined,'memory-picker-art');loadArt(art,icon.image);art.alt='';art.loading='lazy';art.draggable=false;b.append(art,make('small',icon.name));grid.append(b);}if(!grid.children.length)grid.append(make('p','Không tìm thấy icon.'));}
  search.oninput=results;results();search.focus();
 }
 function openLabels(card){
  const host=showDialog('Chọn nhãn'),choices=make('div',undefined,'memory-label-options');
  for(const label of options.labels||LABELS){
   const b=button(label||'Không nhãn',()=>{card.label=label;changed();if(!options.applications){hideDialog();render();return;}for(const n of choices.children)n.setAttribute('aria-pressed',String(n.dataset.label===label));render();});
   b.dataset.label=label;b.setAttribute('aria-pressed',String(card.label===label));choices.append(b);
  }
  host.append(choices);
  if(options.applications){
   host.append(make('h3','Áp dụng','memory-apply-heading'));const applications=make('div',undefined,'memory-label-options'),explain=make('p',undefined,'memory-apply-hint');
   const hints={whole:'Áp dụng cho toàn bộ thẻ lớn này.',specific:'Áp dụng cho câu hoặc đoạn được nhắc đến trong nội dung thẻ.',ai:'Agent chủ động chọn vị trí áp dụng phù hợp với ý tưởng.'};
   for(const [value,label]of Object.entries(options.applications)){
    const b=button(label,()=>{card.scope=value;changed();for(const n of applications.children)n.setAttribute('aria-pressed',String(n.dataset.scope===value));explain.textContent=hints[value];render();});
    b.dataset.scope=value;b.setAttribute('aria-pressed',String((card.scope||'ai')===value));applications.append(b);
   }
   explain.textContent=hints[card.scope||'ai'];host.append(applications,explain,button('Xong',hideDialog));
  }
  choices.querySelector('button')?.focus();
 }
 function openNote(card){const host=showDialog('Chú thích · '+iconFor(card.icon).name),text=make('textarea');text.value=card.caption;text.rows=6;text.maxLength=5000;text.placeholder='Ký ức này kể điều gì?';text.setAttribute('aria-label','Chú thích thẻ');noteEditor={card,text};text.oninput=commitNote;text.oncompositionend=commitNote;const autoSaveHint=make('p','Tự lưu khi viết · Đóng rồi mở lại vẫn giữ nội dung.','memory-status');const actions=make('div',undefined,'memory-note-actions');actions.append(button('Lưu chú thích',()=>{commitNote();hideDialog();render();}),button('Đổi hình',()=>openIcons(card)),button('Xóa thẻ',()=>{cards=cards.filter(c=>c.id!==card.id);changed();hideDialog();render();}));host.append(text,autoSaveHint);if(options.duration)host.append(durationField(card));host.append(actions);text.focus();}
 function durationField(card){
  const wrap=make('label','Thời lượng (giây)','memory-duration'),input=make('input'),auto=button('Auto',()=>{if(auto.getAttribute('aria-pressed')==='true')send(Number(input.value)>0?Number(input.value):DEFAULT_SECONDS);else send(null);});input.type='number';input.min='0.1';input.step='0.1';input.inputMode='decimal';
  const show=value=>{const on=value===null||value===undefined;auto.setAttribute('aria-pressed',String(on));input.disabled=on;input.placeholder=on?'Auto – AI tự quyết':'';input.value=on?'':value;};
  const send=value=>options.duration.set(project,card.id,value).then(()=>{show(value);status.textContent=value===null?'Auto: AI tự quyết thời lượng thẻ.':'Đã lưu thời lượng '+value+' giây.';}).catch(e=>{status.textContent=e.message;});
  show(null);options.duration.get(project,card.id).then(value=>{if(input.isConnected)show(value??null);}).catch(()=>{});
  input.onchange=()=>{const value=Number(input.value);if(!(value>0)){status.textContent='Thời lượng phải lớn hơn 0.';return;}send(value);};
  wrap.append(auto);
  wrap.append(input);return wrap;
 }
 window.addEventListener('beforeunload',e=>{commitNote();if(dirty){local();e.preventDefault();e.returnValue='';}});
 function reveal(id){const n=surface.querySelector('[data-card="'+id+'"]');if(!n)return false;n.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});n.classList.add('memory-flash');setTimeout(()=>n.classList.remove('memory-flash'),1500);return true;}
 return {count:()=>loaded?cards.length:null,open,reopen:async()=>{if(project)await save().catch(()=>{});active=false;return open();},close,reveal,flush:()=>save(),isDirty:()=>dirty,refresh:async()=>{if(options.reconcile)await save();const value=await options.load();if(value.project===project){cards=structuredClone(value.board.cards);version=value.board.version;if(options.reconcile){baseCards=structuredClone(cards);dirty=false;local();}render();await emotion?.refresh();}}};
}
const api={mount,ICONS,LABELS,ordered,snap};if(typeof module==='object'&&module.exports)module.exports=api;else root.PicassoMemoryBoard=api;
})(typeof window==='undefined'?globalThis:window);
