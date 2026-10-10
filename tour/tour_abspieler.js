/*
  BäckereiOS · Satellit – Demo-Tour
  tour_abspieler.js – der eine Abspieler für alle Geschichten (eine Mechanik, viele Aufrufer).
  Stand: 10.10.2026 (Grundgerüst, Doku 2026-10-09_DEMO_TOUR.md)

  Eine Geschichten-Seite ruft nur auf:
    BOS_TOUR.geschichte({
      titel:'…', untertitel:'…',
      geplant:false,                       // true = Funktion ist in Planung (gestrichelte Marke)
      zurueck:{href:'…', name:'…'},        // optional: vorige Geschichte
      weiter:{href:'…', name:'…'},         // optional: nächste Geschichte
      tempo:0.6,                           // optional: Faktor auf alle Szenendauern
      szenen:[ {n:'Szenentitel', d:7000, t:'Bildunterschrift', m(F){ return '<svg-Inhalt>'; }} ]
    });
  Standard-Tempo 0.6 (Ulf, 10.10.2026: Szenen waren zu langsam). Eine Szene steht
  aber mindestens 3,2 s, damit die Animationen darin fertig werden.
  Unter der Bühne läuft ein Balken mit, damit man sieht: es geht von selbst weiter.
  m(F) bekommt die Zeichen-Bausteine (BOS_FIGUREN) übergeben.

  Baut die ganze Seite selbst auf (Kopf, Bühne, Steuerung, Fußzeile).
  Fehler: immer sichtbar mit err.message, console.error zusätzlich.
*/
(function(){
'use strict';

const ICON_PLAY='<svg viewBox="0 0 24 24"><path d="M8 4v16l11-8z"/></svg>';
const ICON_PAUSE='<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
const ICON_ZURUECK='<svg viewBox="0 0 24 24"><path d="M16 4v16L5 12z"/></svg>';

function zeigeFehler(text,err){
  console.error(text,err);
  let box=document.getElementById('err');
  if(!box){
    box=document.createElement('div');box.id='err';box.className='err';box.setAttribute('role','alert');
    (document.querySelector('.wrap')||document.body).prepend(box);
  }
  box.textContent=text+(err&&err.message?' — '+err.message:'');
  box.hidden=false;
}
window.addEventListener('error',e=>zeigeFehler('Unerwarteter Fehler auf dieser Seite',e.error||{message:e.message}));

function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

function seiteBauen(cfg,F){
  document.title=cfg.titel+' · BäckereiOS Einblick';
  const nav=(cfg.zurueck||cfg.weiter)?
    `<nav class="weiter">`
    +(cfg.zurueck?`<a href="${esc(cfg.zurueck.href)}">‹ Vorige Geschichte<b>${esc(cfg.zurueck.name)}</b></a>`:'<span></span>')
    +(cfg.weiter?`<a class="rechts" href="${esc(cfg.weiter.href)}">Nächste Geschichte ›<b>${esc(cfg.weiter.name)}</b></a>`:'<span></span>')
    +`</nav>`:'';
  const wrap=document.createElement('div');
  wrap.className='wrap';
  wrap.innerHTML=`
  <header>
    <a class="back" href="tour.html">‹ Übersicht</a>
    <div class="brand">Bäckerei<em>OS</em></div>
  </header>
  <h1>${esc(cfg.titel)}</h1>
  <p class="sub">${esc(cfg.untertitel||'')}</p>
  <svg class="stage" id="stage" viewBox="0 0 360 250" role="img" aria-label="${esc(cfg.titel)}">
    <defs>${F.defs()}<clipPath id="clip"><rect x="0" y="0" width="360" height="250" rx="12"/></clipPath></defs>
    <rect x="0" y="0" width="360" height="250" rx="12" fill="#FFFDF6"/>
    <g clip-path="url(#clip)"><g id="sc"></g></g>
  </svg>
  <div class="laufband" aria-hidden="true"><i id="lauf"></i></div>
  <div class="chip${cfg.geplant?' geplant':''}" id="chip"></div>
  <p class="cap" id="cap" aria-live="polite"></p>
  <div class="err" id="err" role="alert" hidden></div>
  <div class="ctrl">
    <button id="prev" aria-label="Vorige Szene">${ICON_ZURUECK}</button>
    <button id="play" aria-label="Abspielen oder anhalten"></button>
    <div class="dots" id="dots"></div>
    <button id="next" aria-label="Nächste Szene">${ICON_PLAY}</button>
  </div>
  ${nav}
  <footer>Bäckerei<b style="color:var(--amber)">OS</b> · Satellit — <em>verbindet, was zusammengehört</em><br>
    Alle Personen sind frei erfunden.</footer>`;
  document.body.prepend(wrap);
}

function geschichte(cfg){
  try{
    const F=window.BOS_FIGUREN;
    if(!F)throw new Error('tour_figuren.js fehlt oder wurde nicht geladen');
    if(!cfg||!Array.isArray(cfg.szenen)||!cfg.szenen.length)throw new Error('Das Drehbuch enthält keine Szenen');
    seiteBauen(cfg,F);

    const $=id=>document.getElementById(id);
    const SZ=cfg.szenen;
    const reduziert=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i=0,playing=!reduziert,timer=null;
    SZ.forEach(()=>$('dots').appendChild(document.createElement('span')));

    const TEMPO=typeof cfg.tempo==='number'?cfg.tempo:0.6;
    function dauer(k){return Math.max(3200,Math.round((SZ[k].d||7000)*TEMPO));}
    function balken(ms){
      const b=$('lauf');
      b.style.transition='none';b.style.width='0%';
      b.getBoundingClientRect();
      if(ms){b.style.transition='width '+ms+'ms linear';b.style.width='100%';}
    }
    function setPlay(p){
      playing=p;
      $('play').innerHTML=p?ICON_PAUSE:ICON_PLAY;
      clearTimeout(timer);
      if(p){
        const ms=dauer(i);balken(ms);
        timer=setTimeout(()=>{if(i<SZ.length-1)show(i+1);else setPlay(false);},ms);
      }else balken(0);
    }
    function show(n){
      i=(n+SZ.length)%SZ.length;
      const sc=$('sc');sc.style.opacity=0;
      setTimeout(()=>{
        try{
          sc.innerHTML=SZ[i].m(F);
          $('cap').textContent=SZ[i].t||'';
          $('chip').textContent='Szene '+(i+1)+' von '+SZ.length+' · '+(SZ[i].n||'');
        }catch(err){
          zeigeFehler('Szene '+(i+1)+' konnte nicht gezeichnet werden',err);
        }
        sc.style.opacity=1;
        [...$('dots').children].forEach((d,k)=>d.classList.toggle('on',k===i));
        setPlay(playing);
      },reduziert?0:140);
    }
    $('next').onclick=()=>show(i+1);
    $('prev').onclick=()=>show(i-1);
    $('stage').onclick=()=>show(i+1);
    $('play').onclick=()=>{if(!playing&&i===SZ.length-1){playing=true;show(0);}else setPlay(!playing);};
    document.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight')show(i+1);
      else if(e.key==='ArrowLeft')show(i-1);
      else if(e.key===' '){e.preventDefault();$('play').click();}
    });
    show(0);
  }catch(err){
    zeigeFehler('Die Geschichte konnte nicht gestartet werden',err);
  }
}

window.BOS_TOUR={geschichte,zeigeFehler};
})();
