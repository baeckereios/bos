/*
  BäckereiOS · Satellit – Demo-Tour
  tour_abspieler.js – der eine Abspieler für alle Geschichten (eine Mechanik, viele Aufrufer).
  Stand: 11.11.2026, 05:15 Uhr MEZ (Bau-Chat Tempo-Knopf). Vorher 10.10.2026 (Grundgerüst, Doku 2026-10-09_DEMO_TOUR.md)

  Eine Geschichten-Seite ruft nur auf:
    BOS_TOUR.geschichte({
      titel:'…', untertitel:'…',
      geplant:false,                       // true = Funktion ist in Planung (gestrichelte Marke)
      zurueck:{href:'…', name:'…'},        // optional: vorige Geschichte
      weiter:{href:'…', name:'…'},         // optional: nächste Geschichte
      tempo:0.6,                           // optional: Faktor auf alle Szenendauern
      szenen:[ {n:'Szenentitel', d:7000, t:'Bildunterschrift', m(F){ return '<svg-Inhalt>'; }} ]
    });
  Standard-Tempo 0.6 (Ulf, 10.10.2026: Szenen waren zu langsam).
  Unter der Bühne läuft ein Balken mit, damit man sieht: es geht von selbst weiter.
  m(F) bekommt die Zeichen-Bausteine (BOS_FIGUREN) übergeben.

  TEMPO-KNOPF (Stand 11.11.2026)
    In der Steuerleiste rechts neben „Nächste Szene“ steht ein Knopf mit dem Wort der Stufe.
    Jedes Antippen schaltet weiter: Normal → Schnell → Langsam → Normal …
    Stufenfaktor auf die Standzeit einer Szene: Langsam 2,0 · Normal 1,0 · Schnell 0,5.
      Standzeit = max(MINDEST, round(d × tempo der Geschichte × Stufenfaktor))
    Nur die Standzeit ändert sich, die Bewegungen in den Bildern laufen immer gleich schnell.
    Umschalten mitten in der Szene: Der gelaufene Anteil bleibt, der Rest läuft in der neuen Dauer,
    der Balken macht von seiner Breite aus weiter. Angehalten oder bei „Bewegung reduzieren“
    wechselt nur die Anzeige; die Stufe gilt, sobald abgespielt wird.
    Merken: localStorage-Schlüssel „bos_tour_tempo“ = langsam | normal | schnell (sonst normal),
    gilt für alle Geschichten in diesem Browser auf diesem Gerät. Lesen und Schreiben in try/catch:
    Ist der Speicher gesperrt (privates Fenster, Kiosk-Browser), wirkt der Knopf trotzdem auf der
    offenen Seite, nur gemerkt wird nichts. Das ist ABSICHTLICH kein roter Kasten (der Nutzer
    verliert nichts außer der Bequemlichkeit), sondern nur console.warn mit der echten Meldung.
    Auf schmalen Geräten (unter 396 px Fensterbreite) steht der Knopf in einer eigenen kurzen Zeile
    unter der Steuerleiste, rechtsbündig (tour_geschichte.css, gemessen mit 7 Szenenpunkten).

  MINDESTDAUER
    Eine Szene endet nie, bevor ihre Bewegungen fertig sind. Beim Zeichnen jeder Szene wird gemessen:
      MINDEST = max(3200, Ende der letzten endlichen Bewegung in der Szene + 800 ms)
    (alle Animationen unter #sc, getComputedTiming().endTime; Endlos-Animationen zählen nicht).
    So sind auch künftige Geschichten geschützt, ohne Tabelle.

  Baut die ganze Seite selbst auf (Kopf, Bühne, Steuerung, Fußzeile).
  Fehler: immer sichtbar mit err.message, console.error zusätzlich.

  ÄNDERUNGEN
    2026-11-11 · 05:15 · Tempo-Knopf (Anweisung Kontroll-Chat 11.11., 05:13; Ulf 05:11/05:12), Mindestdauer
      gemessen statt fest 3200 ms. Leertaste auf einem Knopf drückt jetzt diesen Knopf (vorher immer
      Abspielen/Anhalten). SESSION_2026-11-11_TOUR_TEMPO_KNOPF_BAU.md
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

/* Tempo-Stufen (siehe Kopf). FOLGE = Reihenfolge beim Antippen. */
const STUFEN={langsam:{wort:'Langsam',faktor:2},normal:{wort:'Normal',faktor:1},schnell:{wort:'Schnell',faktor:0.5}};
const FOLGE={normal:'schnell',schnell:'langsam',langsam:'normal'};
const TEMPO_SCHLUESSEL='bos_tour_tempo';
function tempoLesen(){
  try{
    const w=window.localStorage.getItem(TEMPO_SCHLUESSEL);
    return Object.prototype.hasOwnProperty.call(STUFEN,w)?w:'normal';
  }catch(err){
    console.warn('Tour: Tempo konnte nicht gelesen werden, es gilt Normal —',err&&err.message);
    return 'normal';
  }
}
function tempoMerken(stufe){
  try{window.localStorage.setItem(TEMPO_SCHLUESSEL,stufe);}
  catch(err){console.warn('Tour: Tempo kann auf diesem Gerät nicht gemerkt werden, es gilt nur für diese Seite —',err&&err.message);}
}

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
    <span class="umbruch" aria-hidden="true"></span>
    <button id="tempo" class="tempo" type="button"></button>
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
    let stufe=tempoLesen();
    let mindest=3200;               // beim Zeichnen jeder Szene neu gemessen (miss())
    let start=0,laufDauer=0;        // Beginn und Dauer der laufenden Standzeit (performance.now)
    function dauer(k){return Math.max(mindest,Math.round((SZ[k].d||7000)*TEMPO*STUFEN[stufe].faktor));}
    /* Ende der letzten endlichen Bewegung in der gerade gezeichneten Szene + 800 ms, mindestens 3200 */
    function miss(sc){
      let ende=0;
      try{
        (sc.getAnimations?sc.getAnimations({subtree:true}):[]).forEach(a=>{
          const e=a.effect&&a.effect.getComputedTiming().endTime;
          if(typeof e==='number'&&isFinite(e)&&e>ende)ende=e;
        });
      }catch(err){console.warn('Tour: Bewegungen der Szene nicht messbar, es gilt 3,2 s —',err&&err.message);}
      return Math.max(3200,Math.ceil(ende)+800);
    }
    function balken(ms,ab){
      const b=$('lauf');
      b.style.transition='none';b.style.width=((ab||0)*100)+'%';
      b.getBoundingClientRect();
      if(ms){b.style.transition='width '+ms+'ms linear';b.style.width='100%';}
    }
    function weiterNach(ms){
      clearTimeout(timer);
      timer=setTimeout(()=>{if(i<SZ.length-1)show(i+1);else setPlay(false);},ms);
    }
    function setPlay(p){
      playing=p;
      $('play').innerHTML=p?ICON_PAUSE:ICON_PLAY;
      clearTimeout(timer);
      if(p){
        laufDauer=dauer(i);start=performance.now();
        balken(laufDauer);weiterNach(laufDauer);
      }else balken(0);
    }
    function tempoAnzeigen(){
      const t=$('tempo'),naechste=FOLGE[stufe];
      t.textContent=STUFEN[stufe].wort;
      t.dataset.stufe=stufe;
      t.setAttribute('aria-label','Tempo: '+STUFEN[stufe].wort+'. Antippen für '+STUFEN[naechste].wort+'.');
    }
    function tempoWechseln(){
      stufe=FOLGE[stufe];
      tempoAnzeigen();
      tempoMerken(stufe);
      if(!playing)return;          // angehalten / Bewegung reduziert: gilt beim nächsten Abspielen
      const jetzt=performance.now();
      const anteil=laufDauer?Math.min(1,Math.max(0,(jetzt-start)/laufDauer)):0;
      const neu=dauer(i),rest=Math.max(0,Math.round((1-anteil)*neu));
      start=jetzt-anteil*neu;laufDauer=neu;   // so tun, als liefe die Szene schon immer im neuen Tempo
      balken(rest,anteil);weiterNach(rest);
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
        mindest=miss(sc);
        sc.style.opacity=1;
        [...$('dots').children].forEach((d,k)=>d.classList.toggle('on',k===i));
        setPlay(playing);
      },reduziert?0:140);
    }
    tempoAnzeigen();
    $('next').onclick=()=>show(i+1);
    $('prev').onclick=()=>show(i-1);
    $('stage').onclick=()=>show(i+1);
    $('tempo').onclick=e=>{e.stopPropagation();tempoWechseln();};
    $('play').onclick=()=>{if(!playing&&i===SZ.length-1){playing=true;show(0);}else setPlay(!playing);};
    document.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight')show(i+1);
      else if(e.key==='ArrowLeft')show(i-1);
      else if(e.key===' '){
        if(e.target&&e.target.closest&&e.target.closest('button'))return; // Leertaste drückt den Knopf, auf dem man steht
        e.preventDefault();$('play').click();
      }
    });
    show(0);
  }catch(err){
    zeigeFehler('Die Geschichte konnte nicht gestartet werden',err);
  }
}

window.BOS_TOUR={geschichte,zeigeFehler};
})();
