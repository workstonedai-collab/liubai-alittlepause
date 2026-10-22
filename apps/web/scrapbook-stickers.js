// Original vector stationery, not copied from a third-party sticker pack.
export const STICKERS=[
 {id:'leaf-corner',zh:'枝叶角饰',en:'Leaf corner',fill:'#c4d1b7',line:'#668064',path:'M10 72Q30 36 71 10 M25 49Q6 43 7 24Q30 25 25 49Z M39 34Q30 12 44 5Q55 21 39 34Z M42 34Q60 35 72 24Q59 14 42 34Z M25 51Q42 58 58 44Q39 34 25 51Z'}, 
 {id:'leaf',zh:'叶片',en:'Leaf',fill:'#9fb595',line:'#4b7059',path:'M14 65Q8 12 68 12Q74 68 14 65Z M14 65 57 24 M30 49 28 32 M43 38 59 40'},
 {id:'bloom',zh:'小花',en:'Blossom',fill:'#ddbd9d',line:'#8b7057',path:'M40 28C16 4 7 36 27 42C3 61 34 79 40 55C57 79 81 57 54 42C80 28 56 3 40 28Z M35 40a6 6 0 1 0 12 0a6 6 0 1 0-12 0'},
 {id:'moon',zh:'月牙',en:'Moon',fill:'#ead9a7',line:'#9c8b65',path:'M57 12A31 31 0 1 0 67 59A30 30 0 0 1 57 12Z'},
 {id:'star',zh:'星星',en:'Star',fill:'#e5c995',line:'#9e855d',path:'m40 10 9 20 23 3-17 16 4 23-19-11-20 11 4-23L7 33l24-3Z'},
 {id:'tape',zh:'纸胶带',en:'Paper tape',fill:'#c7d2bc',line:'#83967a',path:'m8 25 6-5 5 5 5-5 5 5 5-5 5 5 5-5 5 5 5-5 5 5 5-5 8 5v30l-6 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5-5-5-5 5-8-5Z'},
 {id:'note',zh:'便签',en:'Note',fill:'#efe0b1',line:'#b49e68',path:'M13 13h54v42L53 69H13Z M53 69V55h14 M24 30h31M24 40h26M24 50h18'},
 {id:'cloud',zh:'云朵',en:'Cloud',fill:'#dce7e5',line:'#8ea5a2',path:'M19 59C-1 55 5 32 22 34C21 8 57 6 60 32C81 27 86 57 65 59Z'},
 {id:'sprout',zh:'新芽',en:'Sprout',fill:'#b6c9a7',line:'#608363',path:'M40 70V36 M40 48Q8 51 10 19Q39 16 40 48Z M40 38Q40 7 70 11Q73 42 40 38Z'}
];
export const stickerById=id=>STICKERS.find(s=>s.id===id);
export function stickerSVG(id){const s=stickerById(id);return s?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" aria-hidden="true"><path d="${s.path}" fill="${s.fill}" stroke="${s.line}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`:'';}
