/*
  BäckereiOS · Satellit – Demo-Tour
  tour_freunde.js – Crumble and Friends statt Strichmännchen.
  Stand: 10.11.2026, 21:42 Uhr MEZ (Bau-Chat Tour Stufe 1)

  Wird NACH tour_figuren.js geladen. Ersetzt F.fig durch einen gezeichneten Hamster im Crumble-Stil.
  Schnittstelle wie fig(): x,y = Kopfmitte, Füße bei y+72 · o.c Farbe · o.hair 'tuft'|'bun'|'cap'
    o.aL/o.aR Arm als [dx,dy] ab Schulter · o.mund 'lachen'|'wow'|'sorge' · o.brille
  Die Rollenfarbe (FARBEN) steckt in der Schürze, das Fell unterscheidet die Personen.
  Die alten Strichmännchen bleiben als F.figStrich erhalten.

  Form: pummelig, kein Hals, aber mit Kontur: Backenfell steht ab, darunter eine kleine
  Kerbe, unten breite Hüften. Keine Herzen.

  Zusätze: o.winken · o.huepf · o.schlaf · o.muetze · o.krank · o.gross (Maßstab) · o.blick (-1 links … 1 rechts) · o.kunde (ohne Schürze)
    F.figTab(x,y,o)                 Figur hält ein Tablet vor dem Bauch
    F.kopf(x,y,o)                   nur der Kopf (Bett, Fahrerhaus); o.gross, o.drehen
    F.rein(svg,{von:-140,d:.2})     Figur watschelt herein (von = Weg in px)
    F.loch(x,y,zustand,d,breite)    der echte Crumble (PNG aus hamster_figur/loch/) taucht aus dem Loch auf
    F.namensschild(x,y,txt,d)       Schild unter einer Figur
    F.chip(x,y,txt,anker)           kleines Etikett (anker 'start'|'middle'|'end')
    F.lichter(y)                    Lichterkette
    F.bueste(x,y,zustand,d,breite)  der echte Crumble ohne Loch (steht mit der Unterkante auf y)
    F.status(x,y,art,txt,d,anker)   Status-Etikett rot/gelb/gruen mit Punkt und Wort
    F.schluss(zustand,txt,o)        Crumbles Auftritt am Ende jeder Geschichte (unten rechts aus dem Loch; txt = kurze Sprechblase oder leer; o.x)
  Außerdem: Sprechblase mit kurzem Zipfel statt langer Linie (F.bub), und alle Bausteine aus
  tour_figuren.js zeichnen mit Crumbles brauner Kontur statt Schwarz (ein Bild aus einem Guss).

  Bilder für F.loch: BOS_FREUNDE.lochPfad (Vorgabe '../hamster_figur/loch/'); eine Prüfseite kann
  BOS_FREUNDE.lochDaten = {winken:'data:…'} setzen, dann wird nichts nachgeladen.

  ÄNDERUNGEN
    2026-11-10 · 21:42 · Erstfassung im Repo (Tour Stufe 1, Anweisung Kontroll-Chat 10.11., 19:17), gezeichnet vom
      Ideen-Chat (Entwurf 13. Fassung). Einzige Änderung gegenüber dem Entwurf: F.loch richtet jede Büste an
      ihrer eigenen Schnittkante aus (SCHNITT, Werte aus hamster_figur/loch/loch.json) — vorher schwebte
      Crumble je nach Büste bis zu 10 px über dem Loch (Meldung Ulf 10.11., 21:39).
      SESSION_2026-11-10_TOUR_FREUNDE_STUFE1_BAU.md
*/
(function(){
'use strict';
const F=window.BOS_FIGUREN;
if(!F){console.error('tour_freunde.js: tour_figuren.js fehlt');return;}

const K='#522814', D='#3A1F12', CREME='#FBEBD0', ROSA='#F59A9A', FUSS='#F9C9B4';
const ALT='#2C2C2A';

/* Fell je Person (f = Fell, b = Bauch/Gesicht) */
const FELL={
  o:{f:'#E0A060',b:'#FBEBD0',name:'Paul'},     g:{f:'#F6E2B8',b:'#FFF8EA',name:'Pauline'},
  b:{f:'#C4B5A6',b:'#F4ECE2',name:'Karl'},     r:{f:'#D08355',b:'#F8E2CC',name:'Fritz'},
  n:{f:'#B3A79C',b:'#F2EBE4',name:'Franz'},    t:{f:'#F0B463',b:'#FBEBD0',name:'Ben'},
  v:{f:'#9A6845',b:'#F0D9C0',name:'Hannes'},   p:{f:'#8A7568',b:'#F7EFE6',name:'Fred'},
  c:{f:'#F0B463',b:'#FBEBD0',name:'Crumble'},
  u:{f:'#8FA0AE',b:'#EEF2F5',name:'der Bäcker'}   /* ohne Namen: der Bäcker, der BäckereiOS baut */
};
F.FARBEN.u='#4B5A66';
let z=0;

/* Alles aus tour_figuren.js auf die braune Kontur umstellen */
['bub','karte','schild','tab','paper','uhr','text','haken','stempel','mitte','logo'].forEach(n=>{
  const f=F[n]; if(typeof f==='function')F[n]=(...a)=>String(f(...a)).split(ALT).join(K);
});
F.K=K; F.INK=K;
F.S0=F.S0.split(ALT).join(K); F.SF=F.SF.split(ALT).join(K); F.T=F.T.split(ALT).join(K);

function arm(sx,sy,v,fell,cls){
  const dx=v[0],dy=v[1],mx=dx/2+(dy>0?(dx>0?-3:3):0),my=dy/2+(dy<0?3:-2),d=`M0 0 Q${mx} ${my} ${dx} ${dy}`;
  return `<g transform="translate(${sx} ${sy})"><g class="${cls||''}">`
    +`<path d="${d}" stroke="${K}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${fell}" stroke-width="6.2" fill="none" stroke-linecap="round"/>`
    +`<ellipse cx="${dx}" cy="${dy}" rx="4.8" ry="4.3" fill="${CREME}" stroke="${K}" stroke-width="1.9"/></g></g>`;
}
function auge(x,b){return `<ellipse cx="${x+b}" cy="-3" rx="3.9" ry="4.7" fill="${D}"/><circle cx="${x+b+1.4}" cy="-4.9" r="1.5" fill="#FFF"/><circle cx="${x+b-1.3}" cy="-1.1" r=".75" fill="#FFF"/>`;}

function gesicht(o,fell){
  const b=(o.blick||0)*1.3, m=o.mund||(o.wow?'wow':'lachen');
  let s=`<path d="M0 -21 C4 -15 3 -9 0 -6 C-3 -9 -4 -15 0 -21Z" fill="${fell.b}"/>`
    +`<path d="M-23 4 Q-12 -4 0 1 Q12 -4 23 4 Q25 11 22 15 Q10 20 0 20 Q-10 20 -22 15 Q-25 11 -23 4Z" fill="${fell.b}"/>`
    +`<ellipse cx="-16.5" cy="8" rx="4.6" ry="2.7" fill="${ROSA}" opacity=".75"/><ellipse cx="16.5" cy="8" rx="4.6" ry="2.7" fill="${ROSA}" opacity=".75"/>`;
  s+=o.schlaf?`<path d="M-13 -3 q4 4 8 0 M5 -3 q4 4 8 0" stroke="${K}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
    :`<g class="hz-auge" style="--bd:${(z*1.37)%3.5}s">${auge(-9,b)}${auge(9,b)}</g>`;
  s+=`<ellipse cx="0" cy="3.6" rx="2.5" ry="1.9" fill="${ROSA}" stroke="${K}" stroke-width="1.1"/>`;
  if(m==='wow')s+=`<ellipse cx="0" cy="10.4" rx="2.4" ry="3" fill="${D}"/>`;
  else if(m==='sorge')s+=`<path d="M-4.5 11 q4.5 -4 9 0" stroke="${K}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    +`<path d="M-14.5 -11 l6.5 -2.4 M14.5 -11 l-6.5 -2.4" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`
    +`<path class="hz-tropfen" d="M22 -13 q3 5 0 7 q-3 -2 0 -7z" fill="#B5D4F4" stroke="${K}" stroke-width="1.2"/>`;
  else s+=`<path d="M0 5.6 v1.9 M0 7.5 q-3 3 -5.6 .4 M0 7.5 q3 3 5.6 .4" stroke="${K}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M-2.4 9.2 q2.4 4.8 4.8 0z" fill="${D}"/>`;
  if(o.brille)s+=`<circle cx="-9" cy="-3" r="6.8" fill="none" stroke="${K}" stroke-width="1.7"/><circle cx="9" cy="-3" r="6.8" fill="none" stroke="${K}" stroke-width="1.7"/><path d="M-2.2 -3 h4.4" stroke="${K}" stroke-width="1.7"/>`;
  return s;
}
function schmuck(o,c,fell){
  const r=F.FARBEN[c]||'#888';
  if(o.krank)return `<path d="M-15 -16 q15 -8 30 0 l-2 8 q-13 -6 -26 0z" fill="#B5D4F4" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12.5 l15 -6" stroke="#E24B4A" stroke-width="3" stroke-linecap="round"/>`;
  if(o.muetze)return `<path d="M-13 -19 q-10 -13 2 -19 q4 -10 11 -4 q7 -6 11 4 q12 6 2 19z" fill="#FFF" stroke="${K}" stroke-width="2" stroke-linejoin="round"/><path d="M-13 -19 h26" stroke="${K}" stroke-width="2"/>`;
  if(o.hair==='cap')return `<path d="M-19 -12 Q0 -37 19 -12Z" fill="${r}" stroke="${K}" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 -13 q11 -1 17 3" stroke="${K}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if(o.hair==='bun')return `<g transform="translate(-14 -20) rotate(-20)"><path d="M0 0 l-9 -5 v10z M0 0 l9 -5 v10z" fill="${r}" stroke="${K}" stroke-width="1.8" stroke-linejoin="round"/><circle r="2.6" fill="${r}" stroke="${K}" stroke-width="1.6"/></g>`;
  if(o.hair==='tuft')return `<path d="M-5 -21 q1 -8 4 -3 q2 -8 4 0 q4 -5 3 4" fill="${fell.f}" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>`;
  return '';
}
function ohren(fell){
  return `<g class="hz-ohr" style="--od:${(z*2.3)%6}s"><circle cx="-18" cy="-15" r="8" fill="${fell.f}" stroke="${K}" stroke-width="2.4"/><circle cx="-18" cy="-15" r="4.2" fill="${ROSA}"/></g>`
    +`<circle cx="18" cy="-15" r="8" fill="${fell.f}" stroke="${K}" stroke-width="2.4"/><circle cx="18" cy="-15" r="4.2" fill="${ROSA}"/>`;
}
/* Umriss: Kopf mit abstehendem Backenfell, Kerbe, breite Hüften – ein Stück */
const UMRISS='M0 -22 C15 -22 25 -13 26 -1 C26.5 4 27.5 8 31 12 L25 15 C24.5 17 23.5 18.5 22.5 20 C29 26 33.5 38 31.5 51 C30 61 21 68.5 9 69 L-9 69 C-21 68.5 -30 61 -31.5 51 C-33.5 38 -29 26 -22.5 20 C-23.5 18.5 -24.5 17 -25 15 L-31 12 C-27.5 8 -26.5 4 -26 -1 C-25 -13 -15 -22 0 -22Z';
const KOPF='M0 -22 C15 -22 25 -13 26 -1 C26.5 4 27.5 8 31 12 L25 15 C20 21 9 23 0 23 C-9 23 -20 21 -25 15 L-31 12 C-27.5 8 -26.5 4 -26 -1 C-25 -13 -15 -22 0 -22Z';

function hamster(x,y,o={}){
  z++;
  const c=o.c||'o',fell=FELL[c]||FELL.c,s=o.gross||(c==='t'?.88:1),aL=o.aL||[-3,17],aR=o.aR||[3,17],r=F.FARBEN[c];
  const g=`<ellipse cx="0" cy="72.5" rx="31" ry="3.8" fill="${K}" opacity=".14"/>`
   +`<g class="hz-atmen${o.huepf?' hz-huepf':''}" style="--ad:${(z*.71)%3}s">`
   +`<g class="hz-schwanz"><circle cx="29" cy="56" r="4.4" fill="${fell.f}" stroke="${K}" stroke-width="2.1"/></g>`
   +ohren(fell)
   +`<path d="${UMRISS}" fill="${fell.f}" stroke="${K}" stroke-width="2.7" stroke-linejoin="round"/>`
   +`<ellipse cx="0" cy="45" rx="17" ry="17" fill="${fell.b}"/>`
   +`<path d="M-27.5 46 q1.5 11 11 16 M27.5 46 q-1.5 11 -11 16" stroke="${K}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".45"/>`
   +(r&&c!=='c'&&!o.kunde?`<path d="M-13.5 23 Q0 19 13.5 23 L17 53 Q0 62 -17 53Z" fill="${r}" stroke="${K}" stroke-width="1.9" stroke-linejoin="round"/><path d="M-6 38 h12 v6 q-6 3 -12 0z" fill="none" stroke="${K}" stroke-width="1.2" opacity=".6"/>`:'')
   +`<path d="M-13 6 L-28 3.5 M-13 8.5 L-29 10 M13 6 L28 3.5 M13 8.5 L29 10" stroke="${K}" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".75"/>`
   +gesicht(o,fell)+schmuck(o,c,fell)
   +(o.schlaf?`<g class="hz-zzz"><text x="22" y="-22" style="fill:${K};font-size:12px;font-weight:700;${F.FONT}">z</text><text x="30" y="-32" style="fill:${K};font-size:9px;font-weight:700;${F.FONT}">z</text></g>`:'')
   +(o.vorArm||'')
   +arm(-24,27,aL,fell.f,'')+arm(24,27,aR,fell.f,o.winken?'hz-winken':'')
   +`<ellipse cx="-11.5" cy="69.5" rx="8.5" ry="3.9" fill="${FUSS}" stroke="${K}" stroke-width="2.1"/><ellipse cx="11.5" cy="69.5" rx="8.5" ry="3.9" fill="${FUSS}" stroke="${K}" stroke-width="2.1"/>`
   +`</g>`;
  return `<g class="hz" transform="${s===1?`translate(${x} ${y})`:`translate(${x} ${y+72}) scale(${s}) translate(0 -72)`}">${g}</g>`;
}
function crumble(x,y,o={}){return hamster(x,y,Object.assign({c:'c'},o));}

/* Figur mit Tablet vor dem Bauch (Pfoten greifen darüber) */
function figTab(x,y,o={}){
  const tab=`<rect x="-14" y="31" width="28" height="19" rx="3" fill="#E6F1FB" stroke="${K}" stroke-width="2"/><path d="M-8 38 h16 M-8 43 h10" stroke="#378ADD" stroke-width="1.5" stroke-linecap="round"/>`;
  return hamster(x,y,Object.assign({},o,{aL:[9,15],aR:[-9,15],vorArm:tab+(o.aufTab||'')}));
}

/* Nur der Kopf */
function kopfAllein(x,y,o={}){
  z++;
  const c=o.c||'o',fell=FELL[c]||FELL.c;
  return `<g transform="translate(${x} ${y}) rotate(${o.drehen||0}) scale(${o.gross||1})">${ohren(fell)}`
    +`<path d="${KOPF}" fill="${fell.f}" stroke="${K}" stroke-width="2.7" stroke-linejoin="round"/>${gesicht(o,fell)}${schmuck(o,c,fell)}</g>`;
}

function rein(svg,o={}){
  const von=o.von==null?-140:o.von,d=o.d==null?.2:o.d,dauer=o.dauer||1.4;
  return `<g class="hz-rein" style="--von:${von}px;--d:${d}s;--dauer:${dauer}s"><g class="hz-wackel" style="--d:${d}s;--dauer:${dauer}s">${svg}</g></g>`;
}
function namensschild(x,y,txt,d){
  const w=txt.length*7+18;
  return `<g class="pop" style="--d:${d==null?.6:d}s"><rect x="${x-w/2}" y="${y}" width="${w}" height="20" rx="10" fill="#FFFDF6" stroke="${K}" stroke-width="1.8"/>`
    +`<text x="${x}" y="${y+14}" text-anchor="middle" style="fill:${K};font-size:11px;font-weight:600;${F.FONT}">${txt}</text></g>`;
}
function chip(x,y,txt,anker){
  const w=txt.length*6.4+16,x0=anker==='end'?x-w:anker==='middle'?x-w/2:x;
  return `<rect x="${x0}" y="${y}" width="${w}" height="20" rx="10" fill="#FFFDF6" stroke="${K}" stroke-width="1.5" opacity=".95"/>`
    +`<text x="${x0+w/2}" y="${y+14}" text-anchor="middle" style="fill:${K};font-size:11px;${F.FONT}">${txt}</text>`;
}
/* Sprechblase mit kurzem Zipfel in Richtung tx,ty */
function bub(x,y,w,txt,tx,ty,d){
  const seite=Math.abs(ty-(y+15))<20&&(tx<x||tx>x+w);
  let zipfel;
  if(seite){
    const bx=tx<x?x:x+w,by=y+15,r=tx<x?-1:1,L=Math.min(14,Math.abs(tx-bx)*.6),py=by+(ty-by)*.5;
    zipfel=`<path d="M${bx} ${by-6} L${bx+r*L} ${py} L${bx} ${by+6}" fill="#FFFDF6" stroke="${K}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M${bx-r*1.2} ${by-4.6} v9.2" stroke="#FFFDF6" stroke-width="3"/>`;
  }else{
    const unten=ty>y+15,by=unten?y+30:y,bx=Math.max(x+20,Math.min(x+w-20,x+w/2+(tx-(x+w/2))*.55));
    const dx=tx-bx,dy=ty-by,len=Math.max(1,Math.hypot(dx,dy)),L=Math.min(15,len*.6),px=bx+dx/len*L,py=by+dy/len*L;
    zipfel=`<path d="M${bx-7} ${by} L${px} ${py} L${bx+7} ${by}" fill="#FFFDF6" stroke="${K}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M${bx-5.6} ${by+(unten?-1.2:1.2)} h11.2" stroke="#FFFDF6" stroke-width="3"/>`;
  }
  return `<g class="pop" style="--d:${d==null?.5:d}s"><rect x="${x}" y="${y}" width="${w}" height="30" rx="15" fill="#FFFDF6" stroke="${K}" stroke-width="2.2"/>${zipfel}`
    +`<text x="${x+w/2}" y="${y+20}" text-anchor="middle" style="fill:${K};font-size:13px;${F.FONT}">${txt}</text></g>`;
}
/* Der echte Crumble aus dem Loch (PNG-Büste der Tür, 252×300).
   Jede Büste endet unten an einer anderen Stelle (schnitt_y aus hamster_figur/loch/loch.json, in Bildpixeln).
   Diese Kante sitzt 2 px unter der Lochmitte, sonst schwebt Crumble über dem Loch (Ulf 10.11., 21:39). */
const SCHNITT={neutral:227,blinzeln:227,winken:206,zwinkern:206,wangen:206,lachen:216,daumen:214,besorgt:217,gaehnen:215,pfote:215,schlafen:216,herzen:215};
function loch(x,y,zustand,d,breite){
  const S=window.BOS_FREUNDE||{},zz=zustand||'winken';
  const href=(S.lochDaten&&S.lochDaten[zz])||((S.lochPfad||'../hamster_figur/loch/')+zz+'.png');
  const id='lochclip'+(++z),w=breite||58,h=w*300/252,oben=y-h*(SCHNITT[zz]||240)/300+2;
  return `<defs><clipPath id="${id}"><rect x="${x-w}" y="${y-h-20}" width="${w*2}" height="${h+20}"/></clipPath></defs>`
    +`<ellipse cx="${x}" cy="${y}" rx="${w*.62}" ry="8" fill="#3A2A1E"/>`
    +`<g clip-path="url(#${id})"><g class="up" style="--d:${d==null?.3:d}s"><image href="${href}" x="${x-w/2}" y="${oben}" width="${w}" height="${h}"/></g></g>`
    +`<path d="M${x-w*.62} ${y} a${w*.62} 8 0 0 0 ${w*1.24} 0" fill="none" stroke="#3A2A1E" stroke-width="3"/>`;
}
/* Crumble ohne Loch, z. B. auf der Taskleiste */
function bueste(x,y,zustand,d,breite){
  const S=window.BOS_FREUNDE||{},zz=zustand||'neutral';
  const href=(S.lochDaten&&S.lochDaten[zz])||((S.lochPfad||'../hamster_figur/loch/')+zz+'.png');
  const id='bclip'+(++z),w=breite||58,h=w*300/252;
  return `<defs><clipPath id="${id}"><rect x="${x-w}" y="${y-h-20}" width="${w*2}" height="${h+20}"/></clipPath></defs>`
    +`<g clip-path="url(#${id})"><g class="up" style="--d:${d==null?.3:d}s"><image href="${href}" x="${x-w/2}" y="${y-h*.8}" width="${w}" height="${h}"/></g></g>`;
}
/* Crumbles Schlussauftritt: immer unten rechts, immer aus dem Loch */
function schluss(zustand,txt,o){
  o=o||{};
  const x=o.x==null?326:o.x,y=238,d=o.d==null?1.8:o.d;
  let s=loch(x,y,zustand||'daumen',d,50);
  if(txt){const w=txt.length*7.2+28;s+=bub(Math.min(x+26,352)-w,150,w,txt,x-4,y-44,d+.5);}
  return s;
}
/* Status-Etikett der Reparaturanfrage: art 'rot'|'gelb'|'gruen' */
function status(x,y,art,txt,d,anker,breite){
  const C={rot:['#FCEBEB','#A32D2D','#E24B4A'],gelb:['#FAEEDA','#854F0B','#F2B33D'],gruen:['#EAF3DE','#3B6D11','#639922']}[art];
  const w=breite||txt.length*7.4+40,x0=anker==='middle'?x-w/2:x;
  return `<g class="stamp" style="--d:${d==null?.5:d}s"><rect x="${x0}" y="${y}" width="${w}" height="28" rx="14" fill="${C[0]}" stroke="${C[1]}" stroke-width="2.2"/>`
    +`<circle cx="${x0+16}" cy="${y+14}" r="6" fill="${C[2]}" stroke="${K}" stroke-width="1.4"/>`
    +`<text x="${x0+28}" y="${y+19}" style="fill:${C[1]};font-size:13px;font-weight:600;${F.FONT}">${txt}</text></g>`;
}
function lichter(y){
  const farben=['#F59A9A','#F7C86A','#9FD9B8','#F7C86A','#F59A9A','#9FD9B8','#F7C86A','#F59A9A'];
  let s=`<path d="M-5 ${y} Q90 ${y+26} 180 ${y+6} Q270 ${y+26} 365 ${y}" stroke="${K}" stroke-width="1.5" fill="none"/>`;
  farben.forEach((f,k)=>{const x=22+k*45,l=x<180,t=l?(x+5)/185:(x-180)/185,y0=l?y:y+6,y2=l?y+6:y,yy=(1-t)*(1-t)*y0+2*t*(1-t)*(y+26)+t*t*y2;
    s+=`<ellipse class="hz-licht" style="--d:${k*.3}s" cx="${x}" cy="${yy+6}" rx="4.5" ry="6" fill="${f}" stroke="${K}" stroke-width="1.5"/>`;});
  return s;
}

/* Animationen der Figuren – kommen beim fertigen Bau in tour_geschichte.css */
const st=document.createElement('style');st.id='tour-freunde-css';
st.textContent=`
.hz-atmen{transform-box:fill-box;transform-origin:50% 100%;animation:hzAtmen 3.2s ease-in-out var(--ad,0s) infinite}
.hz-atmen.hz-huepf{animation:hzHuepf .7s ease-in-out var(--ad,0s) infinite}
.hz-auge{transform-box:fill-box;transform-origin:50% 50%;animation:hzBlinzeln 4.2s linear var(--bd,0s) infinite}
.hz-ohr{transform-box:fill-box;transform-origin:70% 90%;animation:hzOhr 6s ease-in-out var(--od,0s) infinite}
.hz-schwanz{transform-box:fill-box;transform-origin:0% 50%;animation:hzSchw 2.2s ease-in-out infinite}
.hz-winken{animation:hzWinken .9s ease-in-out infinite alternate}
.hz-tropfen{animation:hzTropfen 1.6s ease-in infinite}
.hz-zzz{animation:hzZzz 2.4s ease-in-out infinite}
.hz-licht{animation:hzLicht 1.8s ease-in-out var(--d,0s) infinite alternate}
.hz-rein{animation:hzRein var(--dauer,1.4s) ease-out var(--d,.2s) both}
.hz-wackel{transform-box:fill-box;transform-origin:50% 100%;animation:hzWackel .28s ease-in-out var(--d,.2s) 5 alternate}
.hz-glut{animation:hzLicht 1.4s ease-in-out infinite alternate}
.hz-dampf{animation:hzDampf 3s ease-out var(--d,0s) infinite;opacity:0}
@keyframes hzAtmen{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.028)}}
@keyframes hzHuepf{0%,100%{transform:translateY(0) scale(1,1)}15%{transform:translateY(0) scale(1.06,.92)}45%{transform:translateY(-14px) scale(.97,1.04)}75%{transform:translateY(0) scale(1.04,.95)}}
@keyframes hzBlinzeln{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.1)}}
@keyframes hzOhr{0%,88%,100%{transform:rotate(0)}91%{transform:rotate(-14deg)}94%{transform:rotate(4deg)}}
@keyframes hzSchw{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(14deg)}}
@keyframes hzWinken{from{transform:rotate(-20deg)}to{transform:rotate(24deg)}}
@keyframes hzTropfen{0%{opacity:0;transform:translateY(-3px)}30%{opacity:1}100%{opacity:0;transform:translateY(10px)}}
@keyframes hzZzz{0%,100%{opacity:.3;transform:translateY(2px)}50%{opacity:1;transform:translateY(-3px)}}
@keyframes hzLicht{from{opacity:.55}to{opacity:1}}
@keyframes hzRein{from{transform:translateX(var(--von))}to{transform:translateX(0)}}
@keyframes hzWackel{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
@keyframes hzDampf{0%{opacity:0;transform:translateY(0)}25%{opacity:.8}100%{opacity:0;transform:translateY(-22px)}}
@media (prefers-reduced-motion: reduce){
  .hz-atmen,.hz-auge,.hz-ohr,.hz-schwanz,.hz-winken,.hz-tropfen,.hz-zzz,.hz-wackel,.hz-licht,.hz-glut,.hz-dampf{animation:none!important}
  .hz-rein{animation-duration:.01ms!important;animation-delay:0s!important}
}`;
(document.head||document.documentElement).appendChild(st);

F.figStrich=F.fig;
F.fig=hamster; F.hamster=hamster; F.crumble=crumble; F.figTab=figTab; F.kopf=kopfAllein;
F.rein=rein; F.loch=loch; F.namensschild=namensschild; F.chip=chip; F.bub=bub; F.lichter=lichter; F.bueste=bueste; F.schluss=schluss; F.status=status; F.FELL=FELL;
window.BOS_FREUNDE=Object.assign({lochPfad:'../hamster_figur/loch/'},window.BOS_FREUNDE||{});
})();
