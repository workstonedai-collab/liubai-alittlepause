import { stickerById } from './scrapbook-stickers.js';
import { createLocalValue } from './local-settings.js';
import {ART} from './mini-model.js';
export const SCRAPBOOK_TEMPLATES=[
  {id:'plain',zh:'留白纸页',en:'Blank page',layout:'flow',paper:'plain',prompts:[]},
  {id:'photo',zh:'照片日记',en:'Photo diary',layout:'grid',paper:'plain',prompts:['想为这张照片留下的话：','Words for this moment:']},
  {id:'week',zh:'一周回顾',en:'Weekly reflection',layout:'columns',paper:'lined',prompts:['这一周想留下的事：\n\n让我轻松一点的时刻：\n\n下周想留给自己的时间：','Moments to keep:\n\nA little relief:\n\nTime for myself next week:']},
  {id:'daily',zh:'日常一页',en:'A day in a page',layout:'flow',paper:'lined',prompts:['今天的一件小事：\n\n此刻的感受：','One small moment:\n\nHow I feel:']},
  {id:'travel',zh:'旅行见闻',en:'Travel notes',layout:'columns',paper:'plain',prompts:['走过的地方：\n\n难忘的画面：\n\n想再次回来的理由：','Places visited:\n\nA moment to remember:\n\nA reason to return:']},
  {id:'reading',zh:'阅读摘记',en:'Reading notes',layout:'flow',paper:'dots',prompts:['书名与作者：\n\n想留下的一句话：\n\n我的想法：','Title and author:\n\nA line to keep:\n\nMy thoughts:']},
  {id:'gratitude',zh:'值得感谢',en:'Gratitude',layout:'flow',paper:'plain',prompts:['今天值得感谢的三件小事：\n\n1.\n2.\n3.','Three little things I appreciate:\n\n1.\n2.\n3.']},
  {id:'collage',zh:'自由拼贴',en:'Free collage',layout:'collage',paper:'grid',prompts:[]}
];
export const newDesign=()=>({version:1,book:'default',favorite:false,layout:'flow',paper:'plain',ink:'#344d43',font:'serif',weather:'',backdrop:'',placements:[],stamps:[],strokes:[]});
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
export function validateDesign(d,blocks=[]){
  if(d&&d.backdrop===undefined)d.backdrop='';
  if(d&&typeof d.backdrop!=='string'||d?.backdrop&&!ART.some(a=>a.id===d.backdrop))throw Error('mediaInvalid');
  const base=newDesign();if(!d||Object.keys(d).sort().join()!==Object.keys(base).sort().join()||d.version!==1||typeof d.book!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(d.book)||typeof d.favorite!=='boolean'||!['flow','columns','grid','collage'].includes(d.layout)||!['plain','lined','grid','dots'].includes(d.paper)||!/^#[a-f0-9]{6}$/i.test(d.ink)||!['serif','sans'].includes(d.font)||!['','sun','cloud','rain','snow'].includes(d.weather)||!Array.isArray(d.placements)||d.placements.length>24||!Array.isArray(d.stamps)||d.stamps.length>20||!Array.isArray(d.strokes)||d.strokes.length>100)throw Error('mediaInvalid');
  const ids=new Set();for(const p of d.placements){if(Object.keys(p).sort().join()!=='group,height,id,locked,rotation,width,x,y,z'||!blocks.some(b=>b.id===p.id)||ids.has(p.id)||!finite(p.x,0,100)||!finite(p.y,0,100)||!finite(p.width,5,100)||!finite(p.height,5,100)||p.x+p.width>100.01||p.y+p.height>100.01||!finite(p.rotation,-45,45)||!Number.isInteger(p.z)||p.z<0||p.z>100||typeof p.locked!=='boolean'||typeof p.group!=='string'||p.group.length>80)throw Error('mediaInvalid');ids.add(p.id);}
  for(const s of d.stamps)if(Object.keys(s).filter(k=>!['art','scale'].includes(k)).sort().join()!=='id,rotation,text,x,y'||Object.keys(s).some(k=>!['id','rotation','text','x','y','art','scale'].includes(k))||s.art!==undefined&&!stickerById(s.art)||s.scale!==undefined&&!finite(s.scale,.5,2)||typeof s.id!=='string'||s.id.length>128||typeof s.text!=='string'||s.text.length>40||!finite(s.x,0,90)||!finite(s.y,0,95)||!finite(s.rotation,-45,45))throw Error('mediaInvalid');
  let points=0;for(const s of d.strokes){if(Object.keys(s).sort().join()!=='color,id,points,width'||typeof s.id!=='string'||s.id.length>128||!/^#[a-f0-9]{6}$/i.test(s.color)||!finite(s.width,.1,5)||!Array.isArray(s.points)||!s.points.length||s.points.length>1000||s.points.some(p=>!Array.isArray(p)||p.length!==2||!finite(p[0],0,100)||!finite(p[1],0,100)))throw Error('mediaInvalid');points+=s.points.length;}if(points>10000)throw Error('mediaInvalid');if(JSON.stringify(d).length>262144)throw Error('mediaInvalid');return structuredClone(d);
}
export function ensurePlacements(row){row.design??=newDesign();const old=row.design.placements;
  row.design.placements=row.blocks.map((b,i)=>old.find(p=>p.id===b.id)||{id:b.id,x:5+(i%2)*46,y:4+Math.floor(i/2)*24%72,width:42,height:22,rotation:0,z:i,locked:false,group:''});return row;
}
export function applyScrapbookTemplate(row,id,language='zh'){
  const template=SCRAPBOOK_TEMPLATES.find(t=>t.id===id);if(!template)throw Error('mediaInvalid');row.design??=newDesign();row.template=id;row.design.layout=template.layout;row.design.paper=template.paper;
  if(!row.photos.length&&row.blocks.every(b=>b.type==='text'&&!b.text.trim())&&template.prompts.length)row.blocks=[{id:row.blocks[0]?.id||crypto.randomUUID(),type:'text',text:template.prompts[language==='zh'?0:1]}];
  ensurePlacements(row);return row;
}
export function createScrapbookLibrary(storage){const init={version:1,books:[{id:'default',title:'',color:'#e8eee0'}],recipes:[]};
  return createLocalValue(storage,'liubai.scrapbook-library.v1',init,v=>{if(!v||Object.keys(v).sort().join()!=='books,recipes,version'||v.version!==1||!Array.isArray(v.books)||!v.books.length||v.books.length>20||new Set(v.books.map(b=>b.id)).size!==v.books.length||!v.books.some(b=>b.id==='default')||!Array.isArray(v.recipes)||v.recipes.length>12)throw Error('mediaInvalid');
    for(const b of v.books)if(Object.keys(b).sort().join()!=='color,id,title'||!/^[a-zA-Z0-9_-]{1,128}$/.test(b.id)||typeof b.title!=='string'||b.title.length>60||!/^#[a-f0-9]{6}$/i.test(b.color))throw Error('mediaInvalid');
    for(const r of v.recipes){if(Object.keys(r).sort().join()!=='author,design,id,license,title'||!/^[a-zA-Z0-9_-]{1,128}$/.test(r.id)||typeof r.title!=='string'||r.title.length>60||typeof r.author!=='string'||r.author.length>80||!['personal','CC0','CC-BY-4.0'].includes(r.license))throw Error('mediaInvalid');validateDesign(r.design,[]);}return v;
  });
}
