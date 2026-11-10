/*
  BäckereiOS · Satellit – Demo-Tour
  tour_kulisse.js – Orte und Requisiten für alle Geschichten.
  Stand: 10.11.2026, 21:42 Uhr MEZ (Bau-Chat Tour Stufe 1)
  Änderungen: 2026-11-10 · 21:42 · Erstfassung im Repo (Tour Stufe 1, Anweisung Kontroll-Chat 10.11., 19:17), gezeichnet
    vom Ideen-Chat (Entwurf 13. Fassung), unverändert übernommen. SESSION_2026-11-10_TOUR_FREUNDE_STUFE1_BAU.md

  Wird NACH tour_freunde.js geladen. Regel für die Tiefe: Der Hintergrund eines Ortes ist weich und
  ohne Kontur gezeichnet, Requisiten im Vordergrund haben Crumbles braune Kontur. So darf eine
  Karte oder Sprechblase über dem Hintergrund liegen, ohne dass es unruhig wird.

  F.ort(name, o)  Hintergrund mit Boden bei y = 212 (Figuren stehen gut bei y = 146):
    'backstube'  o.licht (x der Lampe, Vorgabe 180) · o.lampe:false · o.regal 'lr'|'l'|'r'|'' · o.nacht · o.fenster (x)
    'froster' · 'buero' · 'werkstatt' · 'lager' · 'zuhause' · 'strasse' · 'hof'
    'bos'    (im System, ohne Boden; o.ton 'gruen'|'creme')
    'tisch'  (Blick von oben auf eine Tischplatte)
  Requisiten: kessel, wagen, kuehlung, frosterRegal, frosterSchrank, band, drucker, ofen, lkw, bett,
    monitor, halle, kartons, bleche, stikken, tisch, blatt, klemmbrett, schluessel, kalender, qr,
    brotregal, balken, auge, papierkorb, schloss, stikkenofen, tablet, schalter, dkey (Türschlüssel = ein Recht), bund (Schlüsselbund), stationTablet, filiale, kacheln
*/
(function(){
'use strict';
const F=window.BOS_FIGUREN;
if(!F||!F.K){console.error('tour_kulisse.js: tour_freunde.js fehlt');return;}
const K=F.K;
const st=(f,w)=>`fill="${f}" stroke="${K}" stroke-width="${w||2}" stroke-linejoin="round" stroke-linecap="round"`;
let nr=0;

/* ------------------------------------------------------------ Hintergrund-Helfer */
function licht(x,a,b,cy){return `<circle cx="${x}" cy="${cy||116}" r="134" fill="${a}"/><circle cx="${x}" cy="${cy||116}" r="86" fill="${b}"/>`;}
function boden(c,l){
  let s=`<rect x="0" y="212" width="360" height="40" fill="${c}"/><path d="M0 212 H360" stroke="${l}" stroke-width="2"/><path d="M0 225 H360 M0 239 H360" stroke="${l}" stroke-width="1.1" fill="none"/>`;
  for(let x=-60;x<=420;x+=40)s+=`<line x1="${x}" y1="212" x2="${180+(x-180)*1.38}" y2="250" stroke="${l}" stroke-width="1.1"/>`;
  return s;
}
function dielen(c,l){
  let s=`<rect x="0" y="212" width="360" height="40" fill="${c}"/><path d="M0 212 H360" stroke="${l}" stroke-width="2"/><path d="M0 224 H360 M0 237 H360" stroke="${l}" stroke-width="1.1"/>`;
  [[40,212],[150,224],[250,212],[90,237],[310,224],[200,237]].forEach(([x,y])=>s+=`<line x1="${x}" y1="${y}" x2="${x}" y2="${y+13}" stroke="${l}" stroke-width="1.1"/>`);
  return s;
}
const brotW=(x,y,c)=>`<path d="M${x-13} ${y} q0 -13 13 -13 q13 0 13 13z" fill="${c}"/>`;

function backstube(o){
  const lx=o.licht==null?180:o.licht,n=!!o.nacht,regal=o.regal==null?(n?'l':'lr'):o.regal;
  let s=`<rect width="360" height="250" fill="${n?'#F3DAB1':'#F8E4C0'}"/>`+licht(lx,n?'#F8E6C5':'#FBEED3',n?'#FCF1D9':'#FDF5E3');
  s+=`<rect x="0" y="154" width="360" height="58" fill="${n?'#EDD2A4':'#F3D9AE'}"/><path d="M0 154 H360" stroke="#E2BD84" stroke-width="2"/><path d="M0 183 H360" stroke="#E7C792" stroke-width="1.1"/>`;
  for(let x=15;x<360;x+=30)s+=`<line x1="${x}" y1="154" x2="${x}" y2="212" stroke="#E7C792" stroke-width="1.1"/>`;
  const brett=(x)=>`<rect x="${x}" y="72" width="92" height="5" rx="2" fill="#DDB37A"/><path d="M${x+10} 77 v8 M${x+82} 77 v8" stroke="#DDB37A" stroke-width="3"/>`;
  if(regal.includes('l'))s+=brett(12)+brotW(34,72,'#E9C792')+brotW(64,72,'#E3BA80')+`<rect x="82" y="56" width="13" height="16" rx="3" fill="#EBD3A8"/><rect x="84" y="53" width="9" height="4" rx="1" fill="#DDB37A"/>`;
  if(regal.includes('r'))s+=brett(256)+`<rect x="264" y="55" width="13" height="17" rx="3" fill="#EBD3A8"/><rect x="266" y="52" width="9" height="4" rx="1" fill="#DDB37A"/>`+brotW(300,72,'#E3BA80')+brotW(330,72,'#E9C792');
  if(n){
    const fx=o.fenster==null?300:o.fenster;
    if(fx!==false)s+=`<rect x="${fx-36}" y="30" width="72" height="62" rx="5" fill="#DDB37A"/><rect x="${fx-31}" y="35" width="62" height="52" rx="3" fill="#35426B"/>`
      +`<path d="M${fx+12} 44 a11 11 0 1 0 8 19 a9 9 0 0 1 -8 -19z" fill="#F7DC8F"/>`
      +[[ -20,46,1.3],[-8,62,1],[-22,74,1.1],[4,78,1.2],[-2,44,.9]].map(([a,b,r])=>`<circle cx="${fx+a}" cy="${b}" r="${r}" fill="#FFFFFF"/>`).join('')
      +`<path d="M${fx} 35 v52 M${fx-31} 61 h62" stroke="#DDB37A" stroke-width="3"/><rect x="${fx-40}" y="90" width="80" height="5" rx="2" fill="#D2A66C"/>`;
  }
  if(o.lampe!==false)s+=`<path d="M${lx} 0 v20" stroke="#D2A66C" stroke-width="2.5"/><path d="M${lx-19} 36 q19 -30 38 0z" fill="#E9BE7C"/><ellipse cx="${lx}" cy="36" rx="19" ry="3.5" fill="#FFF3C4"/>`;
  return s+boden(n?'#DDA968':'#E3B273',n?'#CC9856':'#D6A262');
}
function froster(o){
  const lx=o.licht==null?150:o.licht;
  let s=`<rect width="360" height="250" fill="#DCEAF4"/>`+licht(lx,'#E4EFF7','#EDF5FA');
  for(let x=30;x<360;x+=55)s+=`<line x1="${x}" y1="0" x2="${x}" y2="212" stroke="#CBDDEB" stroke-width="1.6"/>`;
  s+=`<path d="M0 0 H360 V10 ${[340,318,300,276,250,232,206,184,160,138,112,90,66,40,18].map((x,i)=>`L${x} ${10+(i%3===0?12:i%3===1?6:9)} L${x-9} 10`).join(' ')} L0 10Z" fill="#F2F8FC"/>`;
  const flocke=(x,y,r)=>`<path d="M${x-r} ${y} h${2*r} M${x-r*.5} ${y-r*.87} l${r} ${r*1.74} M${x+r*.5} ${y-r*.87} l${-r} ${r*1.74}" stroke="#B4CFE4" stroke-width="1.6" stroke-linecap="round"/>`;
  s+=flocke(40,150,6)+flocke(190,58,5)+flocke(84,196,4.5)+flocke(200,170,4);
  return s+boden('#BCD3E5','#A7C3DA')+`<ellipse cx="70" cy="214" rx="60" ry="7" fill="#FFFFFF" opacity=".5"/><ellipse cx="280" cy="216" rx="70" ry="7" fill="#FFFFFF" opacity=".45"/>`;
}
function buero(o){
  const lx=o.licht==null?120:o.licht;
  let s=`<rect width="360" height="250" fill="#F2E7D5"/>`+licht(lx,'#F6EDDD','#FAF3E6');
  /* Fenster mit Jalousie */
  s+=`<rect x="14" y="26" width="78" height="86" rx="4" fill="#DFCDB0"/><rect x="19" y="31" width="68" height="76" rx="2" fill="#DCEBF3"/>`;
  for(let y=37;y<104;y+=9)s+=`<path d="M19 ${y} h68" stroke="#F4EBDC" stroke-width="3.2"/>`;
  s+=`<rect x="10" y="110" width="86" height="5" rx="2" fill="#D3BF9F"/>`;
  /* Ordnerregal */
  s+=`<rect x="262" y="138" width="88" height="74" rx="3" fill="#E3D2B6"/><rect x="267" y="143" width="78" height="30" fill="#EFE2CB"/><rect x="267" y="178" width="78" height="30" fill="#EFE2CB"/>`;
  ['#D9B9A6','#BFCFB4','#CDBFD9','#E3CD9A','#B9CCDA','#D9B9A6'].forEach((c,i)=>{s+=`<rect x="${270+i*12}" y="${146+(i%2)*2}" width="9" height="${27-(i%2)*2}" rx="1.5" fill="${c}"/>`;});
  ['#B9CCDA','#E3CD9A','#BFCFB4','#D9B9A6'].forEach((c,i)=>{s+=`<rect x="${270+i*12}" y="181" width="9" height="27" rx="1.5" fill="${c}"/>`;});
  /* Pflanze */
  s+=`<path d="M22 212 l3 -22 h16 l3 22z" fill="#D9B48C"/><path d="M33 190 q-16 -14 -12 -34 q12 10 12 34z M33 190 q16 -12 14 -30 q-14 8 -14 30z M33 190 q-2 -26 2 -40 q8 18 -2 40z" fill="#B7CFA2"/>`;
  s+=`<rect x="0" y="205" width="360" height="7" fill="#E4D3B8"/>`;
  return s+dielen('#D9AC76','#C99A62');
}
function werkstatt(o){
  let s=`<rect width="360" height="250" fill="#EFE6D8"/>`+licht(o.licht==null?110:o.licht,'#F4ECDF','#F8F2E8');
  s+=`<rect x="14" y="24" width="120" height="84" rx="4" fill="#E2D3BA"/>`;
  for(let y=34;y<104;y+=12)for(let x=24;x<130;x+=12)s+=`<circle cx="${x}" cy="${y}" r="1.2" fill="#D0BE9F"/>`;
  s+=`<path d="M34 40 v40 M26 40 h16" stroke="#C9B492" stroke-width="6" stroke-linecap="round"/>`
    +`<path d="M64 84 V52" stroke="#C9B492" stroke-width="5" stroke-linecap="round"/><circle cx="64" cy="44" r="8" fill="none" stroke="#C9B492" stroke-width="5"/>`
    +`<path d="M88 40 h30 l-6 14 h-24z" fill="#C9B492"/><rect x="92" y="56" width="8" height="30" rx="3" fill="#D6BE9A"/>`;
  s+=`<rect x="0" y="205" width="360" height="7" fill="#DDD0BB"/>`;
  return s+boden('#CFC6B6','#BEB4A2');
}
function lager(o){
  let s=`<rect width="360" height="250" fill="#ECE4D6"/>`+licht(o.licht==null?150:o.licht,'#F1EADE','#F6F1E8');
  const regal=(x)=>{let r=`<path d="M${x} 20 V212 M${x+96} 20 V212" stroke="#D8C9AE" stroke-width="5"/>`;
    [62,112,162].forEach((y,i)=>{r+=`<rect x="${x-2}" y="${y}" width="100" height="5" fill="#D8C9AE"/>`
      +`<rect x="${x+8+i*6}" y="${y-28}" width="30" height="28" rx="2" fill="${['#E6D5B4','#DCC8A2','#E6D5B4'][i]}"/><rect x="${x+46+i*4}" y="${y-22}" width="34" height="22" rx="2" fill="${['#DCC8A2','#E6D5B4','#D9C19A'][i]}"/>`;});
    return r;};
  s+=regal(8)+regal(250);
  s+=`<rect x="0" y="212" width="360" height="40" fill="#CEC5B5"/><path d="M0 212 H360" stroke="#BDB3A1" stroke-width="2"/><path d="M0 234 H360" stroke="#E6C866" stroke-width="4" stroke-dasharray="26 14"/>`;
  return s;
}
function zuhause(o){
  let s=`<rect width="360" height="250" fill="#F3E6DA"/>`+licht(o.licht==null?250:o.licht,'#F7EDE3','#FBF4EC');
  for(let x=24;x<360;x+=48)s+=`<path d="M${x} 0 V205" stroke="#EEDCCD" stroke-width="10"/>`;
  /* Fenster mit Morgensonne und Vorhang */
  s+=`<rect x="254" y="24" width="86" height="92" rx="4" fill="#DEC6B0"/><rect x="259" y="29" width="76" height="82" rx="2" fill="#FCEBC5"/><circle cx="312" cy="82" r="20" fill="#F9D98A"/><path d="M259 96 q20 -14 40 0 q18 12 36 -2 V111 H259Z" fill="#CFE0B8"/>`
    +`<path d="M297 29 v82 M259 70 h76" stroke="#DEC6B0" stroke-width="3"/><path d="M252 20 h18 q4 50 -8 98 h-10z" fill="#E9C7B4"/><path d="M342 20 h-18 q-4 50 8 98 h10z" fill="#E9C7B4"/><rect x="246" y="16" width="102" height="6" rx="3" fill="#D3B59C"/>`;
  /* Bild an der Wand */
  s+=`<rect x="22" y="36" width="50" height="40" rx="3" fill="#DEC6B0"/><rect x="27" y="41" width="40" height="30" fill="#F8EFE3"/><path d="M27 71 l12 -16 l9 10 l7 -7 l12 13z" fill="#D9CDB4"/><circle cx="58" cy="50" r="4" fill="#F4D9A0"/>`;
  s+=`<rect x="0" y="205" width="360" height="7" fill="#E5D0BD"/>`;
  return s+dielen('#D8B48A','#C8A075')+`<ellipse cx="180" cy="234" rx="120" ry="11" fill="#E9C7B4" opacity=".7"/>`;
}
function draussen(o,hof){
  let s=`<rect width="360" height="250" fill="#DCEEF9"/><circle cx="300" cy="46" r="26" fill="#FCEFC7"/><circle cx="300" cy="46" r="16" fill="#FBE3A0"/>`;
  const wolke=(x,y,k)=>`<g opacity=".95"><ellipse cx="${x}" cy="${y}" rx="${26*k}" ry="${10*k}" fill="#FFFFFF"/><ellipse cx="${x-14*k}" cy="${y-7*k}" rx="${13*k}" ry="${9*k}" fill="#FFFFFF"/><ellipse cx="${x+8*k}" cy="${y-10*k}" rx="${15*k}" ry="${11*k}" fill="#FFFFFF"/></g>`;
  s+=wolke(70,44,1)+wolke(200,30,.7);
  /* ferne Häuser */
  s+=`<path d="M0 212 V150 l22 -18 l22 18 v-14 h34 v-20 l20 -14 l20 14 v34 h30 v-22 h40 v-16 l24 -16 l24 16 v38 h36 v-26 h32 v-12 l16 -12 l16 12 V212Z" fill="#C5DCEC"/>`;
  [[14,160],[90,150],[98,170],[190,160],[236,150],[300,176]].forEach(([x,y])=>s+=`<rect x="${x}" y="${y}" width="9" height="11" rx="1" fill="#DCEEF9"/>`);
  s+=`<path d="M0 212 V196 q20 -12 44 -2 q22 -14 50 0 q26 -10 48 2 q30 -14 58 -2 q24 -10 50 2 q30 -12 56 0 q28 -8 54 2 V212Z" fill="#BCD8B0"/>`;
  if(hof)return s+`<rect x="0" y="212" width="360" height="40" fill="#D2CABB"/><path d="M0 212 H360" stroke="#BDB3A1" stroke-width="2"/><path d="M0 230 H360" stroke="#C4BBAA" stroke-width="1.2"/>`+[30,110,190,270,350].map(x=>`<line x1="${x}" y1="212" x2="${180+(x-180)*1.3}" y2="250" stroke="#C4BBAA" stroke-width="1.2"/>`).join('');
  return s+`<rect x="0" y="204" width="360" height="8" fill="#D8D0C2"/><rect x="0" y="212" width="360" height="40" fill="#A39F98"/><path d="M0 212 H360" stroke="#8E8A84" stroke-width="2"/>`;
}
function bos(o){
  const cr=o.ton==='creme',a=cr?'#FBF0DA':'#E7F4EC',b=cr?'#F6E6C6':'#DBEEE2',c=cr?'#FDF7E8':'#F1F9F4',p=cr?'#EDD9B2':'#C9E2D3';
  let s=`<rect width="360" height="250" fill="${a}"/><circle cx="${o.licht==null?180:o.licht}" cy="125" r="150" fill="${b}"/><circle cx="${o.licht==null?180:o.licht}" cy="125" r="96" fill="${c}"/>`;
  for(let y=14;y<250;y+=24)for(let x=12+(y%48?12:0);x<360;x+=24)s+=`<circle cx="${x}" cy="${y}" r="1.3" fill="${p}"/>`;
  return s;
}
function tischplatte(o){
  let s=`<rect width="360" height="250" fill="#D9AC76"/>`;
  [18,56,92,134,170,208,240].forEach((y,i)=>s+=`<path d="M0 ${y} q90 ${i%2?6:-6} 180 0 t180 0" stroke="#CC9C63" stroke-width="1.6" fill="none"/>`);
  s+=`<ellipse cx="60" cy="120" rx="16" ry="7" fill="none" stroke="#CC9C63" stroke-width="1.4"/><ellipse cx="300" cy="64" rx="12" ry="5" fill="none" stroke="#CC9C63" stroke-width="1.4"/>`;
  return s;
}
function ort(name,o){
  o=o||{};
  switch(name){
    case 'backstube':return backstube(o);
    case 'froster':return froster(o);
    case 'buero':return buero(o);
    case 'werkstatt':return werkstatt(o);
    case 'lager':return lager(o);
    case 'zuhause':return zuhause(o);
    case 'strasse':return draussen(o,false);
    case 'hof':return draussen(o,true);
    case 'bos':return bos(o);
    case 'tisch':return tischplatte(o);
  }
  throw new Error('Unbekannter Ort: '+name);
}

/* ------------------------------------------------------------ Requisiten (mit Kontur) */
/* Knetkessel, Mitte x, steht auf dem Boden */
function kessel(x,voll){
  return `<rect x="${x-32}" y="202" width="64" height="10" rx="4" ${st('#8E8A84')}/>`
    +`<path d="M${x-45} 153 L${x-36} 198 Q${x} 208 ${x+36} 198 L${x+45} 153Z" ${st('#C9D0D6',2.2)}/>`
    +`<path d="M${x-32} 164 L${x-27} 192" stroke="#EEF2F5" stroke-width="5" stroke-linecap="round"/>`
    +`<path d="M${x+22} 166 L${x+19} 190" stroke="#AEB8C0" stroke-width="3" stroke-linecap="round"/>`
    +`<ellipse cx="${x}" cy="153" rx="45" ry="9.5" ${st(voll?'#F6E3BF':'#E6EAED',2.2)}/>`
    +(voll?`<path d="M${x-38} 152 q4 -22 24 -20 q8 -9 18 -1 q22 -4 32 21" ${st('#F6E3BF',2.2)}/><path d="M${x-45} 153 a45 9.5 0 0 0 90 0" fill="none" stroke="${K}" stroke-width="2.2"/><path d="M${x-12} 140 q6 -5 12 0 M${x+8} 146 q5 -4 10 0" stroke="#E2C894" stroke-width="2" fill="none" stroke-linecap="round"/>`
      :`<ellipse cx="${x}" cy="155" rx="36" ry="5.5" fill="#B9C2C9"/>`);
}
/* Rollwagen mit Säcken */
function wagen(x,an,name){
  const sack=(sx,c)=>`<path d="M${sx-11} 186 q-2 -14 1 -22 q1 -5 4 -7 l-1 -4 h14 l-1 4 q3 2 4 7 q3 8 1 22 z" ${st(c,1.8)}/>`
    +`<path d="M${sx-5} 157 h10" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/><path d="M${sx-6} 172 h12" stroke="#B9A98C" stroke-width="1.3" stroke-linecap="round"/>`;
  return `<path d="M${x-4} 150 v36" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>`
    +sack(x+14,'#F4EEDF')+sack(x+37,'#F6E3BF')+sack(x+60,'#F4EEDF')
    +`<rect x="${x-4}" y="186" width="82" height="8" rx="2" fill="${an?'#9FE1CB':'#C9B79A'}" stroke="${an?'#0F6E56':K}" stroke-width="${an?2.6:2}"/>`
    +`<circle cx="${x+10}" cy="203" r="6.5" ${st('#5F5E5A')}/><circle cx="${x+10}" cy="203" r="2" fill="#D3D1C7"/><circle cx="${x+64}" cy="203" r="6.5" ${st('#5F5E5A')}/><circle cx="${x+64}" cy="203" r="2" fill="#D3D1C7"/>`
    +(name?F.chip(x+37,128,name,'middle'):'');
}
function kuehlung(x){
  return `<rect x="${x}" y="92" width="56" height="120" rx="6" ${st('#DCE8F0',2.2)}/><path d="M${x} 134 h56" stroke="${K}" stroke-width="1.8"/>`
    +`<path d="M${x+47} 106 v16 M${x+47} 144 v20" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`
    +`<path d="M${x+18} 104 v18 M${x+10} 108.5 l16 9 M${x+26} 108.5 l-16 9" stroke="#378ADD" stroke-width="2" stroke-linecap="round"/>`
    +`<path d="M${x+7} 100 v104" stroke="#F3F8FB" stroke-width="3" stroke-linecap="round"/>`+F.chip(x+28,66,'Kühlung','middle');
}
/* Regal im Froster mit Kisten, x = linker Holm, Breite 122 */
function frosterRegal(x){
  const cols=['#FAC775','#F5C4B3','#C0DD97','#B5D4F4'];let b='';
  [82,132,182].forEach((y,r)=>{
    [8,36,64,92].forEach((dx,k)=>{if((dx+y)%3)b+=`<rect x="${x+dx}" y="${y-20}" width="23" height="20" rx="2.5" ${st(cols[(k+r)%4],1.8)}/><path d="M${x+dx} ${y-15} q5 4 11.5 0 t11.5 0 v-3 a2.5 2.5 0 0 0 -2.5 -2.5 h-18 a2.5 2.5 0 0 0 -2.5 2.5z" fill="#FFFFFF" stroke="${K}" stroke-width="1.2"/><rect x="${x+dx+6}" y="${y-9}" width="11" height="5" rx="1" fill="#FFFDF6" opacity=".8"/>`;});
    b+=`<rect x="${x-2}" y="${y}" width="126" height="5" rx="1.5" ${st('#AEBFCC',1.8)}/>`;
  });
  return `<path d="M${x} 44 V212 M${x+122} 44 V212" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M${x} 44 V212 M${x+122} 44 V212" stroke="#AEBFCC" stroke-width="2.6" stroke-linecap="round"/>`+b;
}
/* Tiefkühlschrank mit Glastür, x = links, 120 breit */
function frosterSchrank(x){
  let s=`<rect x="${x}" y="62" width="120" height="150" rx="7" ${st('#D2DCE4',2.2)}/><rect x="${x}" y="62" width="120" height="20" rx="7" ${st('#B8C6D1',2.2)}/>`
    +`<rect x="${x+78}" y="67" width="32" height="11" rx="3" fill="#2F3B48"/><text x="${x+94}" y="76" text-anchor="middle" style="fill:#9FE1CB;font-size:8px;font-weight:700;${F.FONT}">−18°</text>`
    +`<rect x="${x+12}" y="90" width="84" height="112" rx="4" ${st('#EAF4FA',2)}/>`;
  [124,160,196].forEach((y,i)=>{s+=`<path d="M${x+14} ${y} h80" stroke="${K}" stroke-width="1.6"/>`;
    [0,1,2].forEach(k=>{if(i<2||k<1)s+=`<path d="M${x+20+k*25} ${y-2} q3 -13 11 -13 q8 0 11 13z" ${st(i===0?'#F3BE6E':'#EDB05C',1.5)}/><path d="M${x+27+k*25} ${y-12} l2 8 M${x+33+k*25} ${y-12} l2 8" stroke="${K}" stroke-width="1" opacity=".6"/>`;});});
  s+=`<path d="M${x+20} 96 l10 22 M${x+30} 96 l6 13" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".8"/>`
    +`<path d="M${x+106} 120 v46" stroke="${K}" stroke-width="5.5" stroke-linecap="round"/><path d="M${x+106} 120 v46" stroke="#F1F5F8" stroke-width="2" stroke-linecap="round"/>`
    +`<path d="M${x+2} 82 q8 7 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t6 -2" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`;
  return s;
}
/* Brötchenstraße: Band von x bis x+210 */
function band(x){
  let r='',w='';
  for(let i=0;i<7;i++)r+=`<circle cx="${x+15+i*30}" cy="171" r="4.2" ${st('#E6EAED',1.6)}/>`;
  [30,72,114,156].forEach((dx,i)=>w+=`<g class="pop" style="--d:${.2+i*.25}s"><ellipse cx="${x+dx+34}" cy="156" rx="12" ry="7" ${st('#F3BE6E',1.9)}/><path d="M${x+dx+28} 154 q6 -4 12 0" stroke="${K}" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`);
  return `<path d="M${x+52} 178 v34 M${x+178} 178 v34" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M${x+52} 178 v34 M${x+178} 178 v34" stroke="#AEB8C0" stroke-width="2.4" stroke-linecap="round"/>`
    +`<rect x="${x+18}" y="164" width="200" height="14" rx="7" ${st('#B9C2C9',2.2)}/>${r}`
    +`<rect x="${x-6}" y="112" width="46" height="100" rx="6" ${st('#C9D0D6',2.2)}/><path d="M${x} 112 l6 -22 h22 l6 22z" ${st('#E6EAED',2)}/>`
    +`<circle cx="${x+9}" cy="132" r="4" fill="#639922" stroke="${K}" stroke-width="1.4"/><circle cx="${x+23}" cy="132" r="4" fill="#E24B4A" stroke="${K}" stroke-width="1.4"/><path d="M${x+4} 150 h30 M${x+4} 158 h22" stroke="${K}" stroke-width="1.4" opacity=".5"/>`
    +w;
}
/* Drucker auf einem Schränkchen, Mitte x; das Blatt fährt hoch */
function drucker(x){
  return `<g class="up" style="--d:.4s"><rect x="${x-32}" y="58" width="64" height="82" rx="2" ${st('#FFFDF6',2)}/>`
    +`<text x="${x}" y="76" text-anchor="middle" style="fill:${K};font-size:10px;font-weight:600;${F.FONT}">Wochenplan</text>`
    +`<path d="M${x-24} 88 h48 M${x-24} 99 h48 M${x-24} 110 h36" stroke="#C9B79A" stroke-width="1.5"/></g>`
    +`<rect x="${x-52}" y="172" width="104" height="40" rx="3" ${st('#D9B48C',2.2)}/><path d="M${x} 172 v40 M${x-10} 190 h4 M${x+6} 190 h4" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/>`
    +`<rect x="${x-62}" y="120" width="124" height="52" rx="10" ${st('#EDE9E1',2.2)}/><rect x="${x-44}" y="126" width="88" height="6" rx="3" fill="${K}"/>`
    +`<rect x="${x-50}" y="150" width="56" height="12" rx="3" ${st('#DCD6CA',1.6)}/><circle cx="${x+44}" cy="156" r="4.5" fill="#639922" stroke="${K}" stroke-width="1.5"/><circle cx="${x+28}" cy="156" r="4.5" fill="#F7C86A" stroke="${K}" stroke-width="1.5"/>`;
}
function qr(x,y){
  let q='';[[0,0],[2,0],[0,2],[1,1],[2,2],[3,1],[1,3],[3,3]].forEach(([a,b])=>q+=`<rect x="${x+5+a*7}" y="${y+5+b*7}" width="6" height="6" fill="${K}"/>`);
  return `<rect x="${x}" y="${y}" width="38" height="38" rx="3" ${st('#FFFFFF',2)}/>${q}`;
}
/* Etagenofen: x,y = oben links, 140×162 bis zum Boden. o.kaputt = Nr. der klemmenden Tür (0–2), o.qr = QR-Schild links */
function ofen(x,o){
  o=o||{};
  const tx=o.qr?x+56:x+14,tw=o.qr?72:112;
  let s=`<path d="M${x+14} 200 v12 M${x+126} 200 v12" stroke="${K}" stroke-width="6" stroke-linecap="round"/>`
    +`<rect x="${x}" y="46" width="140" height="156" rx="7" ${st('#C9D0D6',2.2)}/><rect x="${x}" y="46" width="140" height="16" rx="7" ${st('#AEB8C0',2.2)}/>`
    +`<circle cx="${x+16}" cy="54" r="3.2" fill="#E24B4A" stroke="${K}" stroke-width="1.2"/><circle cx="${x+28}" cy="54" r="3.2" fill="#F7C86A" stroke="${K}" stroke-width="1.2"/><rect x="${x+92}" y="50" width="38" height="8" rx="2" fill="#2F3B48"/>`;
  [0,1,2].forEach(i=>{
    const y=70+i*44,k=o.kaputt===i;
    s+=`<rect x="${tx}" y="${y}" width="${tw}" height="34" rx="4" fill="#4A3327" stroke="${k?'#E24B4A':K}" stroke-width="${k?3:2}"/>`
      +`<rect class="hz-glut" x="${tx+5}" y="${y+5}" width="${tw-10}" height="24" rx="3" fill="#F2A24E" opacity=".9"/>`
      +[0.22,0.5,0.78].map(f=>`<path d="M${tx+tw*f-9} ${y+27} q0 -11 9 -11 q9 0 9 11z" fill="#C97B36"/>`).join('')
      +`<path d="M${tx+8} ${y+9} l10 14" stroke="#FFE7BF" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`
      +`<path d="M${tx+10} ${y-3} h${tw-20}" stroke="${K}" stroke-width="4.6" stroke-linecap="round"/><path d="M${tx+10} ${y-3} h${tw-20}" stroke="#EEF2F5" stroke-width="1.8" stroke-linecap="round"/>`;
  });
  if(o.qr)s+=qr(x+9,104);
  return s;
}
/* Stikkenofen: x = links, 120 breit, steht auf dem Boden. o.qr = QR-Schild an der Seite */
function stikkenofen(x,o){
  o=o||{};
  let s=`<path d="M${x+12} 202 v10 M${x+108} 202 v10" stroke="${K}" stroke-width="6" stroke-linecap="round"/>`
    +`<rect x="${x}" y="34" width="120" height="170" rx="7" ${st('#C9D0D6',2.2)}/><rect x="${x}" y="34" width="120" height="22" rx="7" ${st('#AEB8C0',2.2)}/>`
    +`<rect x="${x+10}" y="40" width="40" height="10" rx="2" fill="#2F3B48"/><text x="${x+30}" y="48.5" text-anchor="middle" style="fill:#F7C86A;font-size:8px;font-weight:700;${F.FONT}">230°</text>`
    +`<circle cx="${x+96}" cy="45" r="3.2" fill="#639922" stroke="${K}" stroke-width="1.2"/><circle cx="${x+108}" cy="45" r="3.2" fill="#F7C86A" stroke="${K}" stroke-width="1.2"/>`
    +`<path d="M${x+80} 56 V204" stroke="${K}" stroke-width="1.8"/>`
    +`<rect x="${x+9}" y="64" width="64" height="132" rx="5" ${st('#B9C2C9',2)}/><rect x="${x+16}" y="72" width="50" height="116" rx="4" fill="#4A3327" stroke="${K}" stroke-width="1.8"/>`
    +`<rect class="hz-glut" x="${x+20}" y="76" width="42" height="108" rx="3" fill="#F2A24E" opacity=".9"/>`;
  [0,1,2,3,4].forEach(i=>{const y=94+i*21;s+=`<path d="M${x+20} ${y} h42" stroke="#7A4A24" stroke-width="1.6"/>`
    +[0,1].map(k=>`<path d="M${x+24+k*19} ${y-1} q0 -9 8 -9 q8 0 8 9z" fill="#C97B36"/>`).join('');});
  s+=`<path d="M${x+22} 80 l9 16" stroke="#FFE7BF" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`
    +`<path d="M${x+73} 104 v52" stroke="${K}" stroke-width="5.5" stroke-linecap="round"/><path d="M${x+73} 104 v52" stroke="#EEF2F5" stroke-width="2" stroke-linecap="round"/>`;
  if(o.qr)s+=`<g transform="translate(${x+85} 96) scale(.8)">${qr(0,0)}</g>`;
  return s;
}
/* Tablet quer: x,y oben links, w×h; inhalt = SVG für den Bildschirm */
function tablet(x,y,w,h,inhalt){
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" ${st('#3A2A22',2.4)}/><rect x="${x+9}" y="${y+9}" width="${w-18}" height="${h-18}" rx="5" fill="#FFFDF6"/>${inhalt||''}`;
}
/* Ein/Aus-Schalter mit Beschriftung: x,y oben links */
function schalter(x,y,txt,an){
  const w=txt.length*6.6+16;
  return `<rect x="${x}" y="${y}" width="${w+46}" height="26" rx="13" ${st('#FFFDF6',1.8)}/><text x="${x+12}" y="${y+17}" style="fill:${K};font-size:11px;${F.FONT}">${txt}</text>`
    +`<rect x="${x+w+4}" y="${y+5}" width="34" height="16" rx="8" fill="${an?'#9FE1CB':'#D3D1C7'}" stroke="${K}" stroke-width="1.5"/><circle cx="${x+w+(an?29:13)}" cy="${y+13}" r="5.5" fill="#FFFFFF" stroke="${K}" stroke-width="1.5"/>`;
}
/* Ein Schlüssel = ein Recht. x,y = Mitte des Schlüsselkopfs; o.dreh Grad, o.gross, o.leer (nur gestrichelter Umriss) */
function dkey(x,y,f,o){
  o=o||{};
  const a=o.leer?`fill="none" stroke="${K}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".7"`:st(f,1.9);
  return `<g transform="translate(${x} ${y}) rotate(${o.dreh||0}) scale(${o.gross||1})"><path d="M-2.4 6 h4.8 v9 h5 v3.4 h-5 v2.6 h4 v3.4 h-4 v3 q-2.4 3 -4.8 0z" ${a}/>`
    +`<circle r="7.5" ${a}/>${o.leer?'':`<circle r="2.7" fill="#FFFDF6" stroke="${K}" stroke-width="1.5"/>`}</g>`;
}
/* Schlüsselbund: Ring bei x,y, Schlüssel hängen gefächert darunter */
function bund(x,y,farben,gross){
  const n=farben.length,s=gross||1;
  let k='';farben.forEach((f,i)=>{const w=n===1?0:-26+52*i/(n-1);k+=`<g transform="rotate(${w})">${dkey(0,15,f)}</g>`;});
  return `<g transform="translate(${x} ${y}) scale(${s})">${k}<circle r="8.5" fill="none" stroke="${K}" stroke-width="5"/><circle r="8.5" fill="none" stroke="#C9D0D6" stroke-width="2"/></g>`;
}
/* Kleine Kachelwand für einen Bildschirm: farben = Liste, null = nicht freigeschaltet */
function kacheln(x,y,farben,sp,gr){
  const g=gr||18,l=g+5;
  return farben.map((f,i)=>{const kx=x+(i%(sp||3))*l,ky=y+Math.floor(i/(sp||3))*l;
    return f?`<rect x="${kx}" y="${ky}" width="${g}" height="${g}" rx="4.5" fill="${f}" stroke="${K}" stroke-width="1.4"/>`
            :`<rect x="${kx}" y="${ky}" width="${g}" height="${g}" rx="4.5" fill="none" stroke="#C9B79A" stroke-width="1.3" stroke-dasharray="3 3"/>`;}).join('');
}
/* Tablet einer Station auf einem Ständer: Mitte x, steht auf dem Boden */
function stationTablet(x,name){
  return `<path d="M${x} 152 V206" stroke="${K}" stroke-width="7" stroke-linecap="round"/><path d="M${x} 152 V206" stroke="#AEB8C0" stroke-width="3" stroke-linecap="round"/>`
    +`<rect x="${x-22}" y="204" width="44" height="8" rx="4" ${st('#8E8A84')}/>`
    +tablet(x-42,94,84,60,kacheln(x-31,105,['#C0DD97','#FAC775','#B5D4F4','#C0DD97','#9FE1CB','#FAC775'],3,16))
    +(name?F.chip(x,66,name,'middle'):'');
}
/* Filiale: x = links, 150 breit */
function filiale(x){
  let m='';for(let i=0;i<6;i++)m+=`<path d="M${x-8+i*27.7} 96 h27.7 l-2 22 q-11.8 9 -23.7 0z" ${st(i%2?'#FFFDF6':'#F4C0D1',1.8)}/>`;
  return `<rect x="${x}" y="70" width="150" height="142" rx="4" ${st('#F6F0E4',2.2)}/><rect x="${x-6}" y="60" width="162" height="14" rx="4" ${st('#C97B5B',2.2)}/>`
    +`<rect x="${x+38}" y="76" width="74" height="18" rx="4" ${st('#FFFDF6',1.6)}/><text x="${x+75}" y="89" text-anchor="middle" style="fill:${K};font-size:11px;font-weight:600;${F.FONT}">Filiale</text>`+m
    +`<rect x="${x+12}" y="134" width="74" height="50" rx="3" ${st('#E6F1FB',2)}/><path d="M${x+12} 172 h74" stroke="${K}" stroke-width="1.6"/>`
    +[0,1,2].map(i=>`<path d="M${x+20+i*22} 172 q0 -12 9 -12 q9 0 9 12z" ${st(i===1?'#EDB05C':'#F3BE6E',1.5)}/>`).join('')
    +`<path d="M${x+20} 140 l8 16" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`
    +`<rect x="${x+100}" y="134" width="36" height="78" rx="3" ${st('#D9B48C',2)}/><rect x="${x+106}" y="140" width="24" height="30" rx="2" ${st('#E6F1FB',1.6)}/><circle cx="${x+106}" cy="180" r="2.2" fill="${K}"/>`;
}
/* Verkaufsregal: x = links, 116 breit, steht auf dem Boden. voll = Zahl der gefüllten Böden (0–3) */
function brotregal(x,voll){
  let s=`<rect x="${x}" y="78" width="116" height="134" rx="5" ${st('#D9B48C',2.2)}/><rect x="${x+7}" y="85" width="102" height="120" rx="3" fill="#F6EAD6" stroke="${K}" stroke-width="1.6"/>`;
  [0,1,2].forEach(i=>{const y=122+i*40;
    s+=`<path d="M${x+7} ${y} h102" stroke="${K}" stroke-width="2"/>`;
    if(i<(voll||0))[0,1,2].forEach(k=>{s+=`<path d="M${x+14+k*32} ${y-1} q0 -19 13 -19 q13 0 13 19z" ${st(['#E0A060','#D08355','#EDB05C'][(i+k)%3],1.7)}/><path d="M${x+21+k*32} ${y-15} l3 7 M${x+29+k*32} ${y-15} l3 7" stroke="${K}" stroke-width="1.1" opacity=".6"/>`;});
    else s+=`<circle cx="${x+30+i*9}" cy="${y-3}" r="1.5" fill="#C9A26B"/><circle cx="${x+70-i*7}" cy="${y-2.5}" r="1.2" fill="#C9A26B"/><circle cx="${x+52}" cy="${y-3}" r="1" fill="#C9A26B"/>`;
  });
  return s;
}
/* Balken: x,y = links unten; werte 0..1, labels darunter; o.h Höhe, o.b Breite, o.farben, o.aus = Index eines Ausreißers */
function balken(x,y,werte,labels,o){
  o=o||{};const h=o.h||90,b=o.b||24,l=b+10;
  let s=`<path d="M${x-6} ${y} h${werte.length*l+4}" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`;
  werte.forEach((w,i)=>{const bx=x+i*l,bh=Math.max(4,w*h),aus=o.aus===i,f=(o.farben&&o.farben[i])||'#FAC775';
    s+=`<g class="pop" style="--d:${(o.d||.2)+i*.15}s"><rect x="${bx}" y="${y-bh}" width="${b}" height="${bh}" rx="3" fill="${aus?'none':f}" stroke="${aus?'#E24B4A':K}" stroke-width="${aus?2.2:1.8}" ${aus?'stroke-dasharray="5 4"':''}/>`
      +(labels?`<text x="${bx+b/2}" y="${y+15}" text-anchor="middle" style="fill:${K};font-size:11px;${F.FONT}">${labels[i]}</text>`:'')+`</g>`;});
  return s;
}
/* Auge (Überwachung), durch = durchgestrichen. x,y = Mitte */
function auge(x,y,durch,gross){
  return `<g transform="translate(${x} ${y}) scale(${gross||1})"><path d="M-24 0 Q0 -22 24 0 Q0 22 -24 0Z" ${st('#FFFDF6',2.4)}/><circle r="8.5" ${st('#B5D4F4',2)}/><circle r="3.4" fill="${K}"/>`
    +(durch?`<path d="M-22 18 L22 -18" stroke="#FFFDF6" stroke-width="9" stroke-linecap="round"/><path d="M-22 18 L22 -18" stroke="#E24B4A" stroke-width="4.5" stroke-linecap="round"/>`:'')+`</g>`;
}
function papierkorb(x){
  return `<path d="M${x-18} 172 l5 40 h26 l5 -40z" ${st('#B9C2C9',2)}/><path d="M${x-10} 180 l3 26 M${x} 180 v26 M${x+10} 180 l-3 26" stroke="${K}" stroke-width="1.3" opacity=".6"/><rect x="${x-21}" y="166" width="42" height="7" rx="3" ${st('#AEB8C0',2)}/>`
    +`<path d="M${x-9} 166 l-5 -14 l12 4 l4 -12 l10 22z" ${st('#FFFDF6',1.6)}/>`;
}
function schloss(x,y){
  return `<path d="M${x-5} ${y} v-5 a5 5 0 0 1 10 0 v5" fill="none" stroke="${K}" stroke-width="2.2"/><rect x="${x-8}" y="${y}" width="16" height="12" rx="3" ${st('#F7C86A',1.8)}/>`;
}
/* Lieferwagen, fährt nach rechts. kopf = SVG für den Fahrer */
function lkw(kopf){
  return `<rect x="48" y="184" width="254" height="10" rx="4" ${st('#5F5E5A',2)}/>`
    +`<rect x="52" y="80" width="172" height="106" rx="7" ${st('#FFFDF6',2.2)}/>`
    +`<path d="M52 104 h172" stroke="#F4C0D1" stroke-width="10"/><path d="M52 118 h172" stroke="#D4537E" stroke-width="2.5"/>`
    +`<path d="M84 158 q0 -22 22 -22 q22 0 22 22z" ${st('#F3BE6E',2)}/><path d="M96 142 l5 9 M106 139 l5 9 M116 142 l4 8" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>`
    +`<text x="172" y="154" text-anchor="middle" style="fill:${K};font-size:12px;font-weight:600;${F.FONT}">Filialtour</text>`
    +`<path d="M226 186 V112 h40 q8 0 12 8 l16 30 q3 6 3 12 v24 z" ${st('#F4C0D1',2.2)}/>`
    +`<path d="M234 120 h30 q4 0 6 4 l12 22 h-48 z" ${st('#E6F1FB',2)}/>`+(kopf||'')
    +`<path d="M234 146 h48" stroke="${K}" stroke-width="2"/><path d="M240 124 l8 18" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`
    +`<path d="M232 154 v30 M240 162 h8" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/><rect x="284" y="140" width="6" height="12" rx="2" ${st('#5F5E5A',1.5)}/>`
    +`<rect x="287" y="164" width="10" height="9" rx="2.5" ${st('#FAC775',1.6)}/><rect x="292" y="178" width="12" height="7" rx="3" ${st('#B9C2C9',1.6)}/>`
    +[96,256].map(x=>`<circle cx="${x}" cy="198" r="15" ${st('#444441',2.2)}/><circle cx="${x}" cy="198" r="6.5" ${st('#D3D1C7',1.5)}/><circle cx="${x}" cy="198" r="1.8" fill="${K}"/>`).join('');
}
/* Bett mit Nachttisch. kopf = SVG für den, der drin liegt (Kopf liegt bei etwa 84,137) */
function bett(kopf){
  return `<path d="M62 190 v22 M278 190 v22" stroke="${K}" stroke-width="6" stroke-linecap="round"/>`
    +`<rect x="44" y="104" width="14" height="96" rx="5" ${st('#C99A6B',2.2)}/><rect x="276" y="150" width="12" height="50" rx="5" ${st('#C99A6B',2.2)}/>`
    +`<rect x="54" y="152" width="228" height="40" rx="9" ${st('#FFFDF6',2.2)}/>`
    +`<path d="M60 160 q0 -30 30 -30 h8 q26 0 26 30z" ${st('#FFFFFF',2.2)}/>`+(kopf||'')
    +`<path d="M104 150 q8 -8 20 -7 h146 q10 0 10 10 v18 q0 10 -10 10 h-166z" ${st('#B5D4F4',2.2)}/>`
    +`<path d="M104 150 q6 12 0 31" stroke="${K}" stroke-width="2" fill="none"/><path d="M118 147 q6 14 0 34" stroke="#DCEBF8" stroke-width="5" fill="none" stroke-linecap="round"/>`
    +[150,190,230].map((x,i)=>`<circle cx="${x}" cy="${158+(i%2)*10}" r="3" fill="#DCEBF8"/><circle cx="${x+20}" cy="${168-(i%2)*10}" r="3" fill="#DCEBF8"/>`).join('')
    +`<rect x="298" y="162" width="44" height="50" rx="4" ${st('#C99A6B',2.2)}/><path d="M298 186 h44 M316 174 h8 M316 198 h8" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>`
    +`<path d="M308 162 v-10 q0 -3 3 -3 h12 q3 0 3 3 v10z" ${st('#FFFDF6',1.8)}/><path d="M326 153 q7 0 6 5 q-1 4 -6 3" fill="none" stroke="${K}" stroke-width="1.8"/>`
    +`<path class="hz-dampf" style="--d:0s" d="M313 146 q-3 -5 0 -9" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/><path class="hz-dampf" style="--d:1.2s" d="M320 146 q3 -5 0 -9" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
}
/* Monitor an der Wand: x,y = oben links, 160×106; inhalt = SVG für den Bildschirm */
function monitor(x,y,inhalt){
  return `<path d="M${x+80} ${y+106} v18 M${x+56} ${y+126} h48" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`
    +`<rect x="${x}" y="${y}" width="160" height="106" rx="9" ${st('#3A2A22',2.4)}/><rect x="${x+10}" y="${y+10}" width="140" height="86" rx="4" fill="#FFFDF6"/>${inhalt||''}`
    +`<circle cx="${x+80}" cy="${y+101}" r="1.6" fill="#9FE1CB"/>`;
}
/* Lagerhalle mit Rolltor, das hochfährt. x = linke Wand */
function halle(x){
  const id='torclip'+(++nr);
  return `<path d="M${x} 212 V62 l85 -30 l85 30 V212Z" ${st('#F6F0E4',2.2)}/><path d="M${x-8} 66 l93 -33 l93 33" fill="none" stroke="${K}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x-8} 66 l93 -33 l93 33" fill="none" stroke="#C97B5B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    +`<rect x="${x+62}" y="52" width="46" height="18" rx="4" ${st('#FFFDF6',1.6)}/><text x="${x+85}" y="65" text-anchor="middle" style="fill:${K};font-size:10px;font-weight:600;${F.FONT}">LAGER</text>`
    +`<rect x="${x+24}" y="90" width="122" height="122" fill="#4A4038" stroke="${K}" stroke-width="2.2"/>`
    +`<rect x="${x+36}" y="150" width="30" height="62" fill="#5E5347"/><rect x="${x+76}" y="130" width="36" height="82" fill="#5E5347"/><rect x="${x+118}" y="164" width="22" height="48" fill="#5E5347"/>`
    +`<clipPath id="${id}"><rect x="${x+24}" y="90" width="122" height="122"/></clipPath><g clip-path="url(#${id})"><g class="hoch" style="--d:.5s;--h:-112px">`
    +[0,1,2,3,4,5].map(i=>`<rect x="${x+24}" y="${90+i*20.4}" width="122" height="20.4" fill="#D3D1C7" stroke="${K}" stroke-width="1.4"/>`).join('')+`</g></g>`
    +`<path d="M${x+20} 90 h130" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`;
}
function kartons(x,y){
  const k=(a,b)=>`<rect x="${a}" y="${b}" width="26" height="21" rx="2" ${st('#E8C590',1.8)}/><path d="M${a} ${b+7} h26 M${a+13} ${b} v7" stroke="${K}" stroke-width="1.3"/>`;
  return k(x,y)+k(x+28,y)+k(x+56,y)+k(x+14,y-21)+k(x+42,y-21);
}
/* Blechstapel: x,y = links unten, n Bleche, Breite w */
function bleche(x,y,n,w){
  let b='';for(let i=0;i<n;i++)b+=`<rect x="${x}" y="${y-5-i*6}" width="${w||60}" height="5" rx="1.5" ${st('#B9C2C9',1.4)}/>`;
  return b;
}
/* Stikkenwagen, fast leer. x = links, 112 breit */
function stikken(x,n){
  let s=`<path d="M${x} 96 V204 M${x+112} 96 V204 M${x} 96 H${x+112}" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x} 96 V204 M${x+112} 96 V204 M${x} 96 H${x+112}" fill="none" stroke="#AEB8C0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  for(let i=0;i<7;i++)s+=`<path d="M${x+4} ${112+i*13} h8 M${x+100} ${112+i*13} h8" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`;
  s+=bleche(x+8,194,n==null?3:n,96);
  return s+`<circle cx="${x+8}" cy="206" r="6" ${st('#5F5E5A')}/><circle cx="${x+104}" cy="206" r="6" ${st('#5F5E5A')}/>`;
}
function tisch(x,y,w){
  return `<path d="M${x+14} ${y+10} V212 M${x+w-14} ${y+10} V212" stroke="${K}" stroke-width="6.5" stroke-linecap="round"/><path d="M${x+14} ${y+10} V212 M${x+w-14} ${y+10} V212" stroke="#C99A6B" stroke-width="2.8" stroke-linecap="round"/>`
    +`<rect x="${x}" y="${y}" width="${w}" height="11" rx="4" ${st('#D9B48C',2.2)}/>`;
}
/* Großes Blatt mit Überschrift und Zeilen */
function blatt(x,y,w,h,titel){
  let l='';for(let yy=y+50;yy<=y+h-18;yy+=16)l+=`<path d="M${x+18} ${yy} h${w-44+((yy*7)%3)*8}" stroke="#C9B79A" stroke-width="1.5" stroke-linecap="round"/>`;
  return `<rect x="${x+5}" y="${y+6}" width="${w}" height="${h}" rx="3" fill="${K}" opacity=".16"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ${st('#FFFDF6',2.2)}/>`
    +`<text x="${x+w/2}" y="${y+30}" text-anchor="middle" style="fill:${K};font-size:15px;font-weight:600;${F.FONT}">${titel}</text><path d="M${x+18} ${y+38} h${w-36}" stroke="${K}" stroke-width="1.6"/>${l}`;
}
function klemmbrett(x,y){
  return `<rect x="${x}" y="${y}" width="22" height="28" rx="2.5" ${st('#C99A6B',1.8)}/><rect x="${x+3}" y="${y+4}" width="16" height="21" rx="1" fill="#FFFDF6"/><rect x="${x+6}" y="${y-2}" width="10" height="5" rx="1.5" ${st('#AEB8C0',1.4)}/>`
    +`<path d="M${x+6} ${y+10} h10 M${x+6} ${y+15} h10 M${x+6} ${y+20} h6" stroke="${K}" stroke-width="1.1"/>`;
}
/* Schraubenschlüssel: Griff bei x,y, Kopf nach rechts oben */
function schluessel(x,y,cls,stil){
  return `<g class="${cls||''}" style="${stil||''}"><path d="M${x} ${y} l22 -24" stroke="${K}" stroke-width="8.5" stroke-linecap="round"/><path d="M${x} ${y} l22 -24" stroke="#AEB8C0" stroke-width="4.5" stroke-linecap="round"/>`
    +`<circle cx="${x+26}" cy="${y-29}" r="8.5" fill="none" stroke="${K}" stroke-width="7.5"/><circle cx="${x+26}" cy="${y-29}" r="8.5" fill="none" stroke="#AEB8C0" stroke-width="3.6"/></g>`;
}
/* Wandkalender mit eingekreistem Tag: x,y oben links, 132×64 */
function kalender(x,y,kopf,tag){
  const tage=['Mo','Di','Mi','Do','Fr','Sa'];let k='';
  tage.forEach((t,i)=>{const tx=x+16+i*20;k+=`<text x="${tx}" y="${y+46}" text-anchor="middle" style="fill:${K};font-size:11px;${F.FONT}">${t}</text>`;
    if(t===tag)k+=`<circle class="pop" style="--d:1.2s" cx="${tx}" cy="${y+42}" r="10.5" fill="none" stroke="#D85A30" stroke-width="2.4"/>`;});
  return `<path d="M${x+66} ${y-10} v10" stroke="${K}" stroke-width="2"/><circle cx="${x+66}" cy="${y-11}" r="2.6" fill="${K}"/>`
    +`<rect x="${x}" y="${y}" width="132" height="64" rx="6" ${st('#FFFDF6',2.2)}/><path d="M${x} ${y+22} v-16 a6 6 0 0 1 6 -6 h120 a6 6 0 0 1 6 6 v16z" ${st('#F5C4B3',2.2)}/>`
    +`<text x="${x+66}" y="${y+15}" text-anchor="middle" style="fill:${K};font-size:11px;font-weight:600;${F.FONT}">${kopf}</text>${k}`;
}

Object.assign(F,{ort,kessel,wagen,kuehlung,frosterRegal,frosterSchrank,band,drucker,ofen,lkw,bett,monitor,halle,kartons,bleche,stikken,tisch,blatt,klemmbrett,schluessel,kalender,qr,brotregal,balken,auge,papierkorb,schloss,stikkenofen,tablet,schalter,dkey,bund,kacheln,stationTablet,filiale});
})();
