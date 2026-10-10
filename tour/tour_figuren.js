/*
  BäckereiOS · Satellit – Demo-Tour
  tour_figuren.js – Zeichen-Bausteine für alle Geschichten (Figuren, Bühne, Requisiten).
  Stand: 10.10.2026 (Grundgerüst, Doku 2026-10-09_DEMO_TOUR.md)

  Alles liefert SVG-Text zurück. Bühne ist immer 360 × 250, Boden bei y = 212.
  Feste Figurenfarben (über alle Geschichten gleich):
    'o' orange = Paul · 'g' grün = Pauline · 'b' blau = Karl · 'r' koralle = Frühschicht
    'n' grau = Produktionsleitung (mit Brille) · 't' türkis = Ben (Azubi)
    'v' violett = Hannes (Haustechnik) · 'p' rosa = Fred (Fahrer)
    Die Frühschicht-Figur (koralle) heißt Fritz.
  Neue Farbe: Eintrag in FARBEN ergänzen, sonst nichts.
*/
(function(){
'use strict';
const INK='#2C2C2A',SOFT='#888780';
const S0=`stroke:${INK};stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round`;
const SF=`stroke:${INK};stroke-width:2.2;fill:#FFFFFF;stroke-linejoin:round`;
const FONT='font-family:system-ui,sans-serif';
const T=`fill:${INK};font-size:13px;${FONT}`;
const TS=`fill:${SOFT};font-size:11px;${FONT}`;

const FARBEN={o:'#EF9F27',g:'#639922',b:'#378ADD',r:'#D85A30',v:'#7F77DD',n:'#888780',t:'#1D9E75',p:'#D4537E'};

/* Muster für die Strichschraffur der Körper – kommt einmal in <defs> */
function defs(){
  return Object.entries(FARBEN).map(([k,c])=>
    `<pattern id="h-${k}" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(35)">`
    +`<rect width="4" height="4" fill="#FFFFFF"/><line x1="0" y1="0" x2="0" y2="4" stroke="${c}" stroke-width="2.2"/></pattern>`
  ).join('');
}

/* Hintergrundfläche, optional mit Boden */
function bg(c,floorC){
  return `<rect x="0" y="0" width="360" height="250" fill="${c}"/>`
    +(floorC?`<rect x="0" y="212" width="360" height="40" fill="${floorC}"/>`
      +`<line x1="0" y1="212" x2="360" y2="212" style="stroke:#B4B2A9;stroke-width:1.5"/>`:'');
}

function limb(sx,sy,dx,dy){
  const ex=sx+dx,ey=sy+dy,mx=sx+dx/2+(dy>0?(dx>0?-3:3):0),my=sy+dy/2+(dy<0?3:-2);
  return `<path d="M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}" style="stroke:${INK};stroke-width:2;fill:none;stroke-linecap:round"/>`
    +`<circle cx="${ex}" cy="${ey}" r="2.6" style="stroke:${INK};stroke-width:1.6;fill:#FFFFFF"/>`;
}

/*
  Figur. x,y = Kopfmitte, Füße bei y+72 (für Boden 212 also y = 140 oder höher stellen).
  o.c     Farbe ('o','g','b','r','v')
  o.hair  'tuft' | 'bun' | 'cap'
  o.aL/aR Arm links/rechts als [dx,dy] ab Schulter
  o.mund  'lachen' (Standard) | 'wow' | 'sorge'
  o.brille true = Brille (Produktionsleitung)
*/
function fig(x,y,o={}){
  const aL=o.aL||[-9,18],aR=o.aR||[9,18],c=o.c||'o';let h='';
  if(o.hair==='bun')h=`<path d="M${x+12} ${y-12} q9 -2 8 7" style="${S0}"/>`;
  else if(o.hair==='cap')h=`<path d="M${x-15} ${y-6} Q${x} ${y-28} ${x+15} ${y-6} Z" style="stroke:${INK};stroke-width:2.2;fill:#B5D4F4"/><line x1="${x+11}" y1="${y-6}" x2="${x+25}" y2="${y-4}" style="${S0}"/>`;
  else if(o.hair==='tuft')h=`<path d="M${x-3} ${y-17} l-1 -6 M${x} ${y-18} l0 -7 M${x+3} ${y-17} l2 -6" style="${S0}"/>`;
  const mund=o.mund||(o.wow?'wow':'lachen');
  let m;
  if(mund==='wow')m=`<ellipse cx="${x}" cy="${y+7}" rx="3.5" ry="4.2" style="${S0}"/>`;
  else if(mund==='sorge')m=`<path d="M${x-7} ${y+9} Q${x} ${y+3} ${x+7} ${y+9}" style="${S0}"/>`
    +`<path d="M${x-10} ${y-8} l6 -3 M${x+10} ${y-8} l-6 -3" style="${S0}"/>`;
  else m=`<path d="M${x-9} ${y+3} Q${x} ${y+14} ${x+9} ${y+3}" style="${S0}"/>`;
  return `<ellipse cx="${x}" cy="${y+74}" rx="24" ry="3.5" fill="#D3D1C7" opacity=".7"/>
<path d="M${x-5} ${y+51} Q${x-7} ${y+62} ${x-6} ${y+71}" style="${S0}"/><ellipse cx="${x-10}" cy="${y+72}" rx="5" ry="2.6" style="${SF}"/>
<path d="M${x+5} ${y+51} Q${x+7} ${y+62} ${x+6} ${y+71}" style="${S0}"/><ellipse cx="${x+10}" cy="${y+72}" rx="5" ry="2.6" style="${SF}"/>
<ellipse cx="${x}" cy="${y+36}" rx="12" ry="17" style="stroke:${INK};stroke-width:2;fill:url(#h-${c})"/>
${limb(x-10,y+29,aL[0],aL[1])}${limb(x+10,y+29,aR[0],aR[1])}
<circle cx="${x}" cy="${y}" r="17" style="${SF}"/>${h}
<ellipse cx="${x-5}" cy="${y-3}" rx="1.7" ry="2.7" fill="${INK}"/><ellipse cx="${x+5}" cy="${y-3}" rx="1.7" ry="2.7" fill="${INK}"/>${m}`
+(o.brille?`<circle cx="${x-6}" cy="${y-3}" r="5" style="${S0};stroke-width:1.6"/><circle cx="${x+6}" cy="${y-3}" r="5" style="${S0};stroke-width:1.6"/><path d="M${x-1} ${y-3} h2" style="${S0};stroke-width:1.6"/>`:'');
}

/* Bildschirm-/Zettelkarte mit Kopfzeile und Textzeilen.
   zeilen: Array aus Text oder {t:'…', farbe:'#…', fett:true, gestrichelt:true} */
function karte(x,y,w,h,titel,zeilen,kopfFarbe){
  let z='';
  (zeilen||[]).forEach((r,k)=>{
    const o=typeof r==='string'?{t:r}:r, yy=y+44+k*19;
    if(o.gestrichelt)z+=`<rect x="${x+8}" y="${yy-13}" width="${w-16}" height="18" rx="4" style="fill:#FCEBEB;stroke:#E24B4A;stroke-width:1.6;stroke-dasharray:4 3"/>`;
    if(o.hinter)z+=`<rect x="${x+8}" y="${yy-13}" width="${w-16}" height="18" rx="4" fill="${o.hinter}"/>`;
    z+=`<text x="${x+12}" y="${yy}" style="fill:${o.farbe||INK};font-size:12px;${o.fett?'font-weight:600;':''}${FONT}">${o.t}</text>`;
  });
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" style="${SF}"/>`
    +`<path d="M${x} ${y+8} a8 8 0 0 1 8 -8 h${w-16} a8 8 0 0 1 8 8 v18 h-${w} z" fill="${kopfFarbe||'#E6F1FB'}" stroke="${INK}" stroke-width="2.2"/>`
    +`<text x="${x+w/2}" y="${y+18}" text-anchor="middle" style="fill:${INK};font-size:12px;font-weight:600;${FONT}">${titel}</text>`+z;
}

/* Haken in einem Kreis (erscheint nach d Sekunden) */
function haken(cx,cy,d){
  return `<g class="pop" style="--d:${d==null?.5:d}s"><circle cx="${cx}" cy="${cy}" r="11" fill="#C0DD97" stroke="#3B6D11" stroke-width="2"/>`
    +`<path d="M${cx-5} ${cy} l3.5 3.5 l6.5 -7" stroke="#3B6D11" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/* Tablet in der Hand */
function tab(x,y){
  return `<rect x="${x}" y="${y}" width="26" height="18" rx="3" style="stroke:${INK};stroke-width:2;fill:#E6F1FB"/>`
    +`<line x1="${x+5}" y1="${y+6}" x2="${x+20}" y2="${y+6}" style="stroke:#378ADD;stroke-width:1.5"/>`;
}

/* Kleiner Zettel. cls = '' | 'fly' (fliegt und verschwindet) | 'stay' (fliegt und bleibt)
   st z. B. '--d:.9s;--dx:190px;--dy:-125px' */
function paper(x,y,cls,st){
  return `<g class="${cls||''}" style="${st||''}"><rect x="${x-7}" y="${y-9}" width="14" height="18" rx="1.5" style="stroke:${INK};stroke-width:1.6;fill:#FFFFFF"/>`
    +`<path d="M${x-3} ${y-3} h6 M${x-3} ${y+1} h6 M${x-3} ${y+5} h4" style="stroke:${INK};stroke-width:1.2"/></g>`;
}

/* Sprechblase: Kasten bei x,y mit Breite w, Zipfel zeigt auf tx,ty, erscheint nach d Sekunden */
function bub(x,y,w,txt,tx,ty,d){
  return `<g class="pop" style="--d:${d==null?.5:d}s"><path d="M${x+w-24} ${y+30} L${tx} ${ty}" style="${S0}"/>`
    +`<rect x="${x}" y="${y}" width="${w}" height="30" rx="15" style="${SF}"/>`
    +`<text x="${x+w/2}" y="${y+20}" text-anchor="middle" style="${T}">${txt}</text></g>`;
}

/* Ortsschild oben links */
function schild(x,y,txt){
  const w=txt.length*7.4+20;
  return `<rect x="${x}" y="${y}" width="${w}" height="24" rx="5" style="${SF}"/>`
    +`<text x="${x+w/2}" y="${y+17}" text-anchor="middle" style="${T}">${txt}</text>`;
}

/* Schriftzug BäckereiOS */
function logo(x,y,size){
  return `<text x="${x}" y="${y}" text-anchor="middle" style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:${size}px">`
    +`<tspan fill="#085041">Bäckerei</tspan><tspan fill="#BA7517" font-style="italic">OS</tspan></text>`;
}

/* Die Mitte: BäckereiOS als grüne Kapsel */
function mitte(cx,cy){
  return `<rect x="${cx-68}" y="${cy-30}" width="136" height="60" rx="16" style="stroke:#0F6E56;stroke-width:2.6;fill:#9FE1CB"/>`
    +logo(cx,cy+7,20);
}

/* Stempel für Geplantes – immer gestrichelt, wie überall in BäckereiOS */
function stempel(cx,cy,zeile1,zeile2){
  return `<g class="stamp"><g transform="rotate(-8 ${cx} ${cy})">`
    +`<rect x="${cx-76}" y="${cy-24}" width="152" height="48" rx="8" style="fill:#FAEEDA;stroke:#BA7517;stroke-width:2.2;stroke-dasharray:6 4"/>`
    +`<text x="${cx}" y="${cy-4}" text-anchor="middle" style="fill:#633806;font-size:14px;font-weight:600;${FONT}">${zeile1}</text>`
    +`<text x="${cx}" y="${cy+14}" text-anchor="middle" style="fill:#633806;font-size:12px;${FONT}">${zeile2||'in Planung'}</text></g></g>`;
}

/* Uhr mit laufendem Zeiger */
function uhr(cx,cy,txt){
  return `<circle cx="${cx}" cy="${cy}" r="20" style="${SF}"/>`
    +`<line class="hand" style="--ox:${cx}px;--oy:${cy}px" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy-13}" stroke="#D85A30" stroke-width="2.6" stroke-linecap="round"/>`
    +(txt?`<text x="${cx+28}" y="${cy+5}" style="${T}">${txt}</text>`:'');
}

function text(x,y,txt,klein,anker){
  return `<text x="${x}" y="${y}" text-anchor="${anker||'start'}" style="${klein?TS:T}">${txt}</text>`;
}

window.BOS_FIGUREN={INK,SOFT,S0,SF,T,TS,FONT,FARBEN,defs,bg,fig,tab,paper,bub,schild,logo,mitte,stempel,uhr,text,karte,haken};
})();
