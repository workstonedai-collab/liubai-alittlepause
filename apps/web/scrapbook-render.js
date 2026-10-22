import { stickerById,stickerSVG } from './scrapbook-stickers.js';
import { newDesign, ensurePlacements } from './scrapbook-design.js';
import {artURL} from './mini-model.js';
const weather={sun:'晴',cloud:'阴',rain:'雨',snow:'雪'};
export function scrapbookHTML(row,{esc,url,language='zh'}){
  const d=row.design||newDesign(),copy=structuredClone(row);ensurePlacements(copy);
  const items=row.blocks.map(b=>{const p=copy.design.placements.find(p=>p.id===b.id),photo=b.type==='photo'?row.photos.find(p=>p.id===b.photo):null;
    const style=d.layout==='collage'?`left:${p.x}%;top:${p.y}%;width:${p.width}%;height:${p.height}%;transform:rotate(${p.rotation}deg);z-index:${p.z}`:'';
    return `<div class="scrapbook-display-block" data-page-block="${b.id}" style="${style}">${photo?`<figure><img src="${url(photo.blob)}" alt="${esc(b.caption||photo.name)}"><figcaption>${esc(b.caption)}</figcaption></figure>`:`<p>${esc(b.text)}</p>`}</div>`;
  }).join('');
  const strokes=d.strokes.length?`<svg class="scrapbook-ink" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="${language==='zh'?'手写笔迹':'Handwritten marks'}">${d.strokes.map(s=>s.points.length===1?`<circle cx="${s.points[0][0]}" cy="${s.points[0][1]}" r="${s.width/2}" fill="${s.color}"/>`:`<polyline points="${s.points.map(p=>p.join(',')).join(' ')}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`:'';
  return `<div class="scrapbook-paper scrapbook-designed layout-${d.layout} paper-${d.paper} font-${d.font}" style="--scrapbook-ink:${d.ink}">${d.backdrop?`<img class="scrapbook-art-backdrop" src="${artURL(d.backdrop)}" alt="">`:``}<header class="scrapbook-page-heading"><h3>${esc(row.title)}</h3><small>${esc(new Date(row.date).toLocaleDateString(language==='zh'?'zh-CN':'en-US'))}${d.weather?' · '+esc(language==='zh'?weather[d.weather]:d.weather):''}</small></header><div class="scrapbook-stage">${items}${d.stamps.map(s=>`<span class="scrapbook-stamp ${s.art?'art-sticker':''}" data-page-stamp="${esc(s.id)}" role="img" aria-label="${esc(s.text)}" style="left:${s.x}%;top:${s.y}%;transform:rotate(${s.rotation}deg) scale(${s.scale||1})">${s.art?stickerSVG(s.art):esc(s.text)}</span>`).join('')}${strokes}</div></div>`;
}
function lines(context,text,width){const result=[];for(const paragraph of text.split('\n')){let line='';for(const letter of paragraph){if(line&&context.measureText(line+letter).width>width){result.push(line);line=letter;}else line+=letter;}result.push(line);}return result;}
export async function renderScrapbookImage(row,{language='zh'}={}){
  const d=row.design||newDesign(),width=900,pad=55,font=25,line=42,gap=24,stageWidth=width-pad*2;
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d'),loaded=new Map();
  try{
    for(const photo of row.photos)loaded.set(photo.id,await createImageBitmap(photo.blob));
    const family=d.font==='serif'?'serif':'sans-serif';context.font=`36px ${family}`;
    const titleLines=lines(context,row.title,stageWidth),stageTop=85+titleLines.length*50;
    const copy=structuredClone(row);ensurePlacements(copy);let cells=[],stageHeight=0;
    const measure=(b,w)=>{context.font=`${b.type==='text'?font:18}px ${family}`;
      if(b.type==='text')return lines(context,b.text,w).length*line+20;
      const bitmap=loaded.get(b.photo),h=d.layout==='grid'?w:Math.min(650,w*bitmap.height/bitmap.width);
      return h+15+lines(context,b.caption,w).length*28+20;
    };
    if(d.layout==='collage'){
      stageHeight=stageWidth*4/3;
      cells=[...row.blocks].sort((a,b)=>copy.design.placements.find(p=>p.id===a.id).z-copy.design.placements.find(p=>p.id===b.id).z).map(b=>{
        const p=copy.design.placements.find(p=>p.id===b.id);return {b,x:p.x/100*stageWidth,y:p.y/100*stageHeight,w:p.width/100*stageWidth,h:p.height/100*stageHeight,rotation:p.rotation};});
    }else{
      const columns=d.layout==='columns'?2:d.layout==='grid'?3:1;let pending=[],cursor=0;
      const flush=()=>{if(!pending.length)return;const h=Math.max(...pending.map(c=>c.h));cells.push(...pending.map((c,i)=>({...c,x:i*((stageWidth-gap*(columns-1))/columns+gap),y:cursor})));cursor+=h+gap;pending=[];};
      for(const b of row.blocks){
        if(d.layout==='grid'&&b.type==='text'){flush();const h=measure(b,stageWidth);cells.push({b,x:0,y:cursor,w:stageWidth,h});cursor+=h+gap;}
        else{const w=(stageWidth-gap*(columns-1))/columns;pending.push({b,w,h:measure(b,w)});if(pending.length===columns)flush();}
      }flush();stageHeight=Math.max(260,cursor);
    }
    const height=Math.max(700,stageTop+stageHeight+pad);if(height>12000)throw Error('scrapbookExportLimit');canvas.width=width;canvas.height=height;
    context.fillStyle='#fbfaf4';context.fillRect(0,0,width,height);context.strokeStyle='#dbe1d5';context.lineWidth=1;
    if(['lined','grid'].includes(d.paper))for(let y=pad;y<height;y+=38){context.beginPath();context.moveTo(0,y);context.lineTo(width,y);context.stroke();}
    if(d.paper==='grid')for(let x=pad;x<width;x+=38){context.beginPath();context.moveTo(x,0);context.lineTo(x,height);context.stroke();}
    if(d.paper==='dots'){context.fillStyle='#d1dacb';for(let x=pad;x<width;x+=30)for(let y=pad;y<height;y+=30){context.beginPath();context.arc(x,y,1.4,0,Math.PI*2);context.fill();}}
    if(d.backdrop){const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=artURL(d.backdrop);});context.save();context.globalAlpha=.75;if(d.backdrop==='botanical-paper')context.drawImage(image,0,0,width,height);else if(d.backdrop==='sticker-leaf-corner')context.drawImage(image,width-width*.45,0,width*.45,width*.45);else context.drawImage(image,0,0,width,width*image.height/image.width);context.restore();}
    context.fillStyle=d.ink;context.font=`36px ${family}`;titleLines.forEach((text,i)=>context.fillText(text,pad,65+i*50));context.font='18px sans-serif';
    context.fillText(new Date(row.date).toLocaleDateString(language==='zh'?'zh-CN':'en-US')+(d.weather?' · '+(language==='zh'?weather[d.weather]:d.weather):''),pad,65+titleLines.length*50);
    for(const c of cells){const {b,w,h}=c;context.save();context.translate(pad+c.x,stageTop+c.y);
      if(d.layout==='collage'){context.translate(w/2,h/2);context.rotate(c.rotation*Math.PI/180);context.translate(-w/2,-h/2);context.beginPath();context.rect(0,0,w,h);context.clip();}
      context.fillStyle=d.ink;
      if(b.type==='text'){context.font=`${font}px ${family}`;lines(context,b.text,w).forEach((text,i)=>context.fillText(text,0,font+i*line));}
      else{const image=loaded.get(b.photo);let imageHeight=d.layout==='grid'?w:Math.min(d.layout==='collage'?Math.max(1,h-42):650,w*image.height/image.width);
        if(d.layout==='grid'){const edge=Math.min(image.width,image.height);context.drawImage(image,(image.width-edge)/2,(image.height-edge)/2,edge,edge,0,0,w,w);}
        else{const scale=Math.min(w/image.width,imageHeight/image.height);context.drawImage(image,(w-image.width*scale)/2,0,image.width*scale,image.height*scale);}
        context.font='18px sans-serif';lines(context,b.caption,w).forEach((text,i)=>context.fillText(text,0,imageHeight+35+i*28));
      }context.restore();
    }
    for(const s of d.strokes){context.strokeStyle=s.color;context.lineWidth=s.width/100*stageWidth;context.lineCap='round';context.lineJoin='round';context.beginPath();s.points.forEach((p,i)=>context[i?'lineTo':'moveTo'](pad+p[0]/100*stageWidth,stageTop+p[1]/100*stageHeight));context.stroke();if(s.points.length===1){context.fillStyle=s.color;context.beginPath();context.ellipse(pad+s.points[0][0]/100*stageWidth,stageTop+s.points[0][1]/100*stageHeight,s.width/200*stageWidth,s.width/200*stageHeight,0,0,Math.PI*2);context.fill();}}
    for(const s of d.stamps){context.save();context.translate(pad+s.x/100*stageWidth,stageTop+s.y/100*stageHeight);context.rotate(s.rotation*Math.PI/180);context.scale(s.scale||1,s.scale||1);const art=stickerById(s.art);if(art){const size=stageWidth*.14;context.scale(size/80,size/80);const path=new Path2D(art.path);context.fillStyle=art.fill;context.strokeStyle=art.line;context.lineWidth=1.5;context.lineCap='round';context.lineJoin='round';context.fill(path);context.stroke(path);}else{context.fillStyle=d.ink;context.font='24px serif';context.fillText(s.text,0,24);}context.restore();}
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('export')),'image/png'));
  }finally{loaded.forEach(image=>image.close());}
}
