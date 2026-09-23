import { writeFileSync } from 'node:fs';

const BG='oklch(0.135 0.028 288)', AM='oklch(0.86 0.16 76)', AMD='oklch(0.72 0.16 66)';
const RED='oklch(0.64 0.22 28)', REDL='oklch(0.80 0.17 34)';
const CARD='linear-gradient(100deg, oklch(0.235 0.030 288) 0%, oklch(0.185 0.026 288) 72%)';
const BRD='oklch(0.30 0.032 288)';

const ava=(n,s=26)=>{const me=n==='вы';
  return `<div style="width:${s}px;height:${s}px;border-radius:${s}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${(s*0.42).toFixed(1)}px;font-weight:600;
    background:${me?'linear-gradient(oklch(0.44 0.10 70), oklch(0.30 0.07 66))':'oklch(0.26 0.03 288)'};color:${me?AM:'oklch(0.76 0.02 288)'};
    border:1px solid ${me?'oklch(0.62 0.13 72)':'oklch(0.33 0.03 288)'};">${me?'В':n[0]}</div>`;};

const grain=`
  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;pointer-events:none;" aria-hidden="true">
    <defs><filter id="g-n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/></filter></defs>
    <rect width="375" height="812" filter="url(#g-n)"/>
  </svg>
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 96% 56% at 50% 26%, transparent 44%, rgba(4,3,8,.62) 100%);"></div>`;

const crackBg=(op=1)=>`
  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;pointer-events:none;" aria-hidden="true">
    <path d="M188 60 L172 130 L196 200 L166 272 L192 344 L170 416 L194 488 L168 560 L190 632 L172 704 L192 776 L182 812"
          stroke="${AMD}" stroke-width="15" stroke-linecap="round" fill="none" opacity="${.06*op}"/>
    <path d="M188 60 L172 130 L196 200 L166 272 L192 344 L170 416 L194 488 L168 560 L190 632 L172 704 L192 776 L182 812"
          stroke="${AMD}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="${.15*op}"/>
    <path d="M188 60 L172 130 L196 200 L166 272 L192 344 L170 416 L194 488 L168 560 L190 632 L172 704 L192 776 L182 812"
          stroke="oklch(0.97 0.08 84)" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="${.26*op}"/>
  </svg>`;

const shell=(phase,sub,body,bg='')=>`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Cinzel:wght@600;700&display=swap">
  <style>
    body { margin: 0; }
    a { color: ${AM}; } a:hover { color: oklch(0.94 0.13 80); }
  </style>
</helmet>
<div style="width:375px;height:812px;box-sizing:border-box;position:relative;overflow:hidden;background:${BG};font-family:Barlow,system-ui,sans-serif;color:oklch(0.92 0.01 288);">
  ${bg}
  <div style="position:relative;height:100%;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:13px 16px 6px 16px;">
      <div style="display:flex;align-items:baseline;gap:9px;">
        <div style="font-family:Cinzel,Georgia,serif;font-size:13px;font-weight:700;letter-spacing:.2em;color:oklch(0.86 0.09 78);">РАЗЛОМ</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${AMD};">${phase}</div>
      </div>
      <div style="font-size:10.5px;letter-spacing:.08em;white-space:nowrap;margin-left:14px;color:oklch(0.52 0.02 288);">${sub}</div>
    </div>
    ${body}
  </div>
  ${grain}
</div>
</x-dc>
<script data-dc-script data-props='{}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;

/* ═══════════ ЛОББИ ═══════════ */
{
const players=[['Иван',1],['вы',0],['Аня',0],['Пётр',0],['Лена',0]];
const modes=[['Короткий','4 раунда в эпохе · 12 всего','~25 мин',0],
             ['Стандартный','6 раундов в эпохе · 18 всего','~45 мин',1],
             ['Долгий','8 раундов в эпохе · 24 всего','~60 мин',0]];
const body=`
  <div style="margin:14px 14px 0 14px;padding:16px;border-radius:14px;background:${CARD};border:1px solid ${BRD};text-align:center;">
    <div style="font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:oklch(0.52 0.02 288);">Код комнаты</div>
    <div style="font-family:Cinzel,Georgia,serif;font-size:38px;font-weight:700;letter-spacing:.16em;color:oklch(0.96 0.05 84);text-shadow:0 0 30px oklch(0.80 0.15 72 / .6);margin-top:4px;">К7-ВРЗЛ</div>
    <div style="display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:7px 14px;border-radius:9px;border:1px solid ${BRD};background:oklch(0.20 0.026 288);">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.2" y="5.2" width="8.4" height="8.4" rx="1.6" stroke="oklch(0.74 0.02 288)" stroke-width="1.4"/><path d="M10.8 5.2V3.6a1.2 1.2 0 0 0-1.2-1.2H3.6a1.2 1.2 0 0 0-1.2 1.2v6a1.2 1.2 0 0 0 1.2 1.2h1.6" stroke="oklch(0.74 0.02 288)" stroke-width="1.4"/></svg>
      <div style="font-size:12px;color:oklch(0.80 0.02 288);">Скопировать ссылку</div>
    </div>
  </div>

  <div style="margin:16px 14px 0 14px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);">Игроки</div>
      <div style="font-size:10.5px;color:oklch(0.50 0.02 288);">5 из 8</div>
    </div>
    ${players.map(([n,host])=>`<div style="display:flex;align-items:center;gap:11px;height:40px;padding:0 11px;box-sizing:border-box;border-radius:11px;background:${n==='вы'?'linear-gradient(100deg, oklch(0.26 0.05 70), oklch(0.19 0.03 68))':CARD};border:1px solid ${n==='вы'?'oklch(0.48 0.10 72)':BRD};margin-bottom:6px;">
      ${ava(n,26)}
      <div style="flex-grow:1;font-size:13.5px;color:${n==='вы'?AM:'oklch(0.88 0.015 288)'};font-weight:${n==='вы'?600:400};">${n}</div>
      ${host?`<div style="font-size:10px;padding:2px 7px;border-radius:5px;background:oklch(0.28 0.04 288);color:oklch(0.72 0.02 288);">создал</div>`:''}
      <div style="width:8px;height:8px;border-radius:5px;background:radial-gradient(circle at 32% 26%, oklch(0.90 0.12 152), oklch(0.56 0.15 150));box-shadow:0 0 8px oklch(0.66 0.15 150 / .8);"></div>
    </div>`).join('')}
    <div style="display:flex;align-items:center;gap:11px;height:40px;padding:0 11px;box-sizing:border-box;border-radius:11px;border:1px dashed oklch(0.30 0.03 288);">
      <div style="width:26px;height:26px;border-radius:14px;border:1px dashed oklch(0.34 0.03 288);"></div>
      <div style="flex-grow:1;font-size:13px;color:oklch(0.46 0.02 288);">свободное место</div>
    </div>
  </div>

  <div style="margin:16px 14px 0 14px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin-bottom:7px;">Режим</div>
    <div style="display:flex;gap:7px;">
      ${modes.map(([n,d,t,sel])=>`<div style="flex:1;padding:9px 8px;box-sizing:border-box;border-radius:11px;background:${sel?'linear-gradient(150deg, oklch(0.28 0.055 70), oklch(0.20 0.035 68))':CARD};border:${sel?'2px solid oklch(0.64 0.13 72)':'1px solid '+BRD};text-align:center;">
        <div style="font-size:12.5px;font-weight:600;color:${sel?AM:'oklch(0.82 0.015 288)'};">${n}</div>
        <div style="font-size:9.5px;line-height:1.35;color:oklch(0.54 0.02 288);margin-top:3px;">${d}</div>
        <div style="font-size:10px;color:${sel?'oklch(0.72 0.06 76)':'oklch(0.48 0.02 288)'};margin-top:3px;">${t}</div>
      </div>`).join('')}
    </div>
  </div>

  <div style="margin:14px 14px 0 14px;padding:10px 12px;border-radius:11px;background:oklch(0.18 0.026 288);border:1px solid oklch(0.26 0.03 288);">
    <div style="font-size:11px;line-height:1.45;color:oklch(0.70 0.02 288);">На пятерых в игре четыре узла: Огонь, Вода, Земля, со второй эпохи Воздух. <span style="color:${AM};">С шестым игроком добавится Пустота.</span></div>
  </div>

  <div style="flex-grow:1;min-height:6px;"></div>

  <div style="margin:0 14px 8px 14px;font-size:10.5px;line-height:1.45;color:oklch(0.54 0.02 288);">Комната живёт по коду сколько угодно. Ходов на время нет — можно уйти на сутки и вернуться.</div>
  <div style="padding:0 14px 15px 14px;">
    <div style="height:52px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;letter-spacing:.1em;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">НАЧАТЬ ПАРТИЮ</div>
  </div>`;
writeFileSync('Lobby.dc.html', shell('Лобби','ожидание игроков', body, crackBg(0.4)));
}

/* ═══════════ ДРАФТ АРХИМАГОВ ═══════════ */
{
const glyph={
 keeper:`<path d="M20 5l12 4.5v9c0 7.6-5 13.4-12 16-7-2.6-12-8.4-12-16v-9z" stroke="${AM}" stroke-width="2.2" fill="none"/>`,
 seer:`<path d="M4 20c5-7.5 11-11 16-11s11 3.5 16 11c-5 7.5-11 11-16 11S9 27.5 4 20z" stroke="${AM}" stroke-width="2.2" fill="none"/><circle cx="20" cy="20" r="4.6" fill="${AM}"/>`,
 void:`<circle cx="20" cy="20" r="14" stroke="${AM}" stroke-width="2.2" fill="none"/><circle cx="20" cy="20" r="7.5" stroke="${AM}" stroke-width="2.2" fill="none"/><circle cx="20" cy="20" r="2.6" fill="${AM}"/>`,
};
const cards=[
 {k:'keeper',n:'Хранитель', a:'При перегрузке не получает Скверну и забирает половину эссенции узла, округляя вниз.', note:'', sel:1},
 {k:'seer',  n:'Провидец',  a:'Видит Порог и усиленные узлы следующего раунда.', note:'', sel:0},
 {k:'void',  n:'Владыка Пустоты', a:'Скверна даёт +4 маны вместо +2. Пустота приносит ему двойную эссенцию.', note:'раздаётся только на 6–8 игроков', sel:0},
];
const body=`
  <div style="padding:16px 16px 0 16px;">
    <div style="font-family:Cinzel,Georgia,serif;font-size:29px;font-weight:700;letter-spacing:.04em;">Выберите архимага</div>
    <div style="font-size:11.5px;line-height:1.4;color:oklch(0.66 0.02 288);margin-top:5px;">Три случайных из восьми. Выбор скрыт до конца драфта — двое могут взять одного и того же.</div>
  </div>
  <div style="margin:16px 14px 0 14px;">
    ${cards.map(c=>`<div style="display:flex;align-items:flex-start;gap:13px;padding:15px 14px;box-sizing:border-box;border-radius:14px;margin-bottom:11px;
      background:${c.sel?'linear-gradient(140deg, oklch(0.27 0.055 70), oklch(0.19 0.032 68))':CARD};
      border:${c.sel?'2px solid oklch(0.66 0.13 72)':'1px solid '+BRD};${c.sel?'box-shadow:0 0 30px -10px '+AMD+';':''}">
      <div style="width:58px;height:58px;border-radius:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${c.sel?'oklch(0.24 0.05 70)':'oklch(0.20 0.026 288)'};border:1px solid ${c.sel?'oklch(0.50 0.10 72)':BRD};">
        <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">${glyph[c.k]}</svg>
      </div>
      <div style="flex-grow:1;">
        <div style="font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:700;">${c.n}</div>
        <div style="font-size:11.5px;line-height:1.45;color:oklch(0.72 0.02 288);margin-top:5px;">${c.a}</div>
        ${c.note?`<div style="font-size:10px;color:oklch(0.52 0.02 288);margin-top:6px;">${c.note}</div>`:''}
      </div>
      ${c.sel?`<div style="width:22px;height:22px;border-radius:12px;flex-shrink:0;background:${AM};display:flex;align-items:center;justify-content:center;">
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 8.4l3 3 6.2-7" stroke="oklch(0.18 0.04 60)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>`:`<div style="width:22px;height:22px;border-radius:12px;flex-shrink:0;border:1.5px solid oklch(0.32 0.03 288);"></div>`}
    </div>`).join('')}
  </div>
  <div style="margin:4px 14px 0 14px;padding:12px 13px;border-radius:12px;background:oklch(0.18 0.026 288);border:1px solid oklch(0.27 0.03 288);">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);">С чего начинаете</div>
    <div style="display:flex;align-items:center;gap:16px;margin-top:9px;">
      <div><div style="font-family:Cinzel,Georgia,serif;font-size:22px;font-weight:700;color:${AM};">8</div><div style="font-size:10px;color:oklch(0.56 0.02 288);margin-top:1px;">маны</div></div>
      <div><div style="font-family:Cinzel,Georgia,serif;font-size:22px;font-weight:700;color:oklch(0.46 0.02 288);">0</div><div style="font-size:10px;color:oklch(0.56 0.02 288);margin-top:1px;">эссенции</div></div>
      <div><div style="font-family:Cinzel,Georgia,serif;font-size:22px;font-weight:700;color:oklch(0.46 0.02 288);">0</div><div style="font-size:10px;color:oklch(0.56 0.02 288);margin-top:1px;">Скверны</div></div>
      <div style="width:1px;height:34px;background:oklch(0.28 0.03 288);"></div>
      <div style="flex-grow:1;font-size:10.5px;line-height:1.4;color:oklch(0.62 0.02 288);">На рынке 6 карт Эпохи I</div>
    </div>
  </div>
  <div style="margin:10px 14px 0 14px;font-size:10.5px;line-height:1.4;color:oklch(0.54 0.02 288);">Две невыбранные карты уйдут в сброс. После драфта архимаг становится виден всем.</div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:0 14px 8px 14px;">
    <div style="font-size:10px;white-space:nowrap;color:oklch(0.54 0.02 288);">выбрали 3 из 6</div>
    <div style="display:flex;gap:4px;">${[1,1,1,0,0,0].map(f=>`<div style="width:9px;height:9px;border-radius:5px;background:${f?'radial-gradient(circle at 32% 26%, oklch(0.96 0.11 84), oklch(0.72 0.15 74))':'oklch(0.26 0.025 288)'};${f?'box-shadow:0 0 9px oklch(0.82 0.15 76 / .9);':'box-shadow:inset 0 1px 2px rgba(0,0,0,.7);'}"></div>`).join('')}</div>
  </div>
  <div style="padding:0 14px 15px 14px;">
    <div style="height:52px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;letter-spacing:.1em;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">ВЗЯТЬ ХРАНИТЕЛЯ</div>
  </div>`;
writeFileSync('Draft.dc.html', shell('Драфт','перед первым раундом', body, crackBg(0.4)));
}
console.log('готово: Lobby, Draft');

/* ═══════════ ВАРИАНТЫ ПОЛЯ: выгорание и два состояния ожидания ═══════════ */
const H=600, CARD_H=80, TOP=152, PITCH=92, CARD_W=156;
const PTS=[[175,140],[165,182],[186,224],[168,268],[189,310],[169,352],[187,396],
           [163,438],[184,480],[167,522],[186,564],[175,600]];
const PATH='M'+PTS.map(p=>p.join(' ')).join(' L');
const crackX=(y)=>{for(let i=0;i<PTS.length-1;i++){const[x1,y1]=PTS[i],[x2,y2]=PTS[i+1];
  if(y>=y1&&y<=y2) return x1+(x2-x1)*((y-y1)/(y2-y1));} return 175;};

const btn2=(plus,dim,locked)=>`<div style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:23px;line-height:1;
  ${locked?`border:1px solid oklch(0.24 0.026 288);background:oklch(0.175 0.024 288);color:oklch(0.30 0.02 288);`
   :plus?`border:1px solid oklch(0.58 0.13 70);background:linear-gradient(oklch(0.34 0.08 68), oklch(0.25 0.06 66));color:${AM};box-shadow:inset 0 1px 0 oklch(0.72 0.14 74 / .45), 0 2px 6px rgba(0,0,0,.5);`
   :`border:1px solid oklch(0.30 0.03 288);background:oklch(0.21 0.026 288);color:${dim?'oklch(0.33 0.02 288)':'oklch(0.80 0.01 288)'};box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 2px 6px rgba(0,0,0,.45);`}
  ">${plus?'+':'−'}</div>`;

function field({phase,sub,threshold,nodes,hand,mana,banner,bottom}){
  const N=nodes.map((x,i)=>({...x,y:TOP+i*PITCH,by:TOP+i*PITCH+CARD_H/2}));
  const branches=N.map(x=>{
    const cx=crackX(x.by), ex=x.side==='l'?CARD_W+2:351-CARD_W-2;
    if(x.burned){ const mid=(cx+ex)/2;
      return `<path d="M${cx.toFixed(1)} ${x.by} L${(cx+(mid-cx)*0.45).toFixed(1)} ${x.by}" stroke="oklch(0.34 0.02 288)" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M${(ex+(mid-ex)*0.45).toFixed(1)} ${x.by} L${ex} ${x.by}" stroke="oklch(0.30 0.02 288)" stroke-width="1.6" stroke-linecap="round"/>
              <circle cx="${cx.toFixed(1)}" cy="${x.by}" r="3" fill="oklch(0.36 0.02 288)"/>`; }
    return `<path d="M${cx.toFixed(1)} ${x.by} L${ex} ${x.by}" stroke="${AMD}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
            <circle cx="${cx.toFixed(1)}" cy="${x.by}" r="3.4" fill="${AM}" opacity=".95"/>
            <circle cx="${cx.toFixed(1)}" cy="${x.by}" r="7" fill="${AM}" opacity=".18"/>`;
  }).join('');
  const cards=N.map(x=>{
    const L=x.side==='l', lit=x.v>0 && !x.burned;
    if(x.burned) return `<div style="position:absolute;${L?'left:0':'right:0'};top:${x.y}px;width:${CARD_W}px;height:${CARD_H}px;box-sizing:border-box;padding:8px 11px;border-radius:14px;overflow:hidden;background:oklch(0.155 0.018 288);border:1px dashed oklch(0.27 0.022 288);">
      <div style="display:flex;flex-direction:column;height:100%;">
        <div style="display:flex;align-items:center;gap:8px;height:20px;">
          <div style="width:13px;height:13px;border-radius:7px;background:oklch(0.26 0.015 288);"></div>
          <div style="font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:600;color:oklch(0.42 0.015 288);">${x.n}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;flex-grow:1;gap:8px;">
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0.6l1.7 4.2 4.3-1.6-2.5 3.8 3.9 2.3-4.5.5 1 4.4-3.3-3.1-3.1 3.3.7-4.5-4.5-.8 3.8-2.5-2.7-3.7 4.4 1.4z" fill="oklch(0.34 0.02 288)"/></svg>
          <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:oklch(0.44 0.015 288);">ВЫГОРЕЛ</div>
        </div>
        <div style="font-size:9.5px;color:oklch(0.36 0.015 288);text-align:center;">перегрузка в 14-м раунде</div>
      </div>
    </div>`;
    const rim=L?`inset -2px 0 0 oklch(0.62 0.13 70 / .55), -1px 0 0 rgba(0,0,0,.4), 10px 0 26px -10px oklch(0.78 0.15 70 / .5)`
               :`inset 2px 0 0 oklch(0.62 0.13 70 / .55), 1px 0 0 rgba(0,0,0,.4), -10px 0 26px -10px oklch(0.78 0.15 70 / .5)`;
    return `<div style="position:absolute;${L?'left:0':'right:0'};top:${x.y}px;width:${CARD_W}px;height:${CARD_H}px;box-sizing:border-box;padding:8px 11px;border-radius:14px;overflow:hidden;
      background:linear-gradient(${L?'100deg':'260deg'}, oklch(0.235 0.030 288) 0%, oklch(0.185 0.026 288) 72%);border:1px solid oklch(0.30 0.032 288);box-shadow:${rim}, 0 6px 16px rgba(0,0,0,.55);">
      ${lit?`<div style="position:absolute;${L?'left:-24px':'right:-24px'};top:-18px;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle, ${x.c} 0%, transparent 68%);opacity:.20;"></div>`:''}
      <div style="position:relative;display:flex;flex-direction:column;height:100%;">
        <div style="display:flex;align-items:center;gap:8px;height:20px;">
          <div style="width:13px;height:13px;border-radius:7px;background:radial-gradient(circle at 34% 28%, ${x.g}, ${x.c} 62%, oklch(0.16 0.03 288));${lit?`box-shadow:0 0 14px ${x.c}, inset 0 1px 1px rgba(255,255,255,.6);`:`opacity:.42;`}"></div>
          <div style="font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:600;color:${lit?'oklch(0.94 0.01 288)':'oklch(0.66 0.015 288)'};">${x.n}</div>
          ${x.emp?`<div style="font-size:9px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:4px;background:linear-gradient(oklch(0.46 0.11 72), oklch(0.34 0.08 68));color:${AM};">×2</div>`:''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-grow:1;">
          ${btn2(false,!lit,bottom!=='normal')}
          <div style="font-family:Cinzel,Georgia,serif;font-size:30px;font-weight:700;line-height:1;color:${lit?'oklch(0.96 0.01 288)':'oklch(0.34 0.02 288)'};${lit?`text-shadow:0 0 18px ${x.c};`:''}">${x.v}</div>
          ${btn2(true,false,bottom!=='normal')}
        </div>
      </div>
    </div>`;
  }).join('');
  const gems=hand.map(([c,g,v])=>`<div style="display:flex;align-items:center;gap:4px;">
    <div style="width:14px;height:14px;border-radius:8px;background:radial-gradient(circle at 34% 28%, ${g}, ${c} 62%, oklch(0.16 0.03 288));${v?`box-shadow:0 0 10px ${c}, inset 0 1px 1px rgba(255,255,255,.55);`:'opacity:.4;'}"></div>
    <div style="font-size:12px;font-weight:600;color:${v?'oklch(0.88 0.01 288)':'oklch(0.42 0.02 288)'};">${v}</div></div>`).join('');
  const bar = bottom==='normal'
    ? `<div style="display:flex;flex-direction:column;gap:5px;flex-grow:1;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;">
          <div style="font-size:10px;white-space:nowrap;color:oklch(0.54 0.02 288);">готовы 2 из 6</div>
          <div style="display:flex;gap:4px;">${[1,1,0,0,0,0].map(f=>`<div style="width:9px;height:9px;border-radius:5px;background:${f?'radial-gradient(circle at 32% 26%, oklch(0.96 0.11 84), oklch(0.72 0.15 74))':'oklch(0.26 0.025 288)'};${f?'box-shadow:0 0 9px oklch(0.82 0.15 76 / .9);':'box-shadow:inset 0 1px 2px rgba(0,0,0,.7);'}"></div>`).join('')}</div>
        </div>
        <div style="height:48px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;letter-spacing:.1em;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">ГОТОВО</div>
      </div>`
    : `<div style="flex-grow:1;height:48px;border-radius:13px;border:1px solid oklch(0.36 0.035 288);background:oklch(0.20 0.026 288);display:flex;align-items:center;justify-content:center;gap:9px;">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 4.2V8l2.6 1.6" stroke="oklch(0.78 0.02 288)" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="6.2" stroke="oklch(0.78 0.02 288)" stroke-width="1.5"/></svg>
        <div style="font-size:14px;color:oklch(0.84 0.015 288);white-space:nowrap;">Снять готовность</div>
      </div>`;
  const bannerHtml = banner
    ? `<div style="margin:0 12px 9px 12px;padding:9px 12px;border-radius:12px;background:${banner.bg};border:1px solid ${banner.brd};display:flex;align-items:center;gap:10px;">
        ${banner.ava?ava(banner.ava,28):''}
        <div style="flex-grow:1;">
          <div style="font-size:13px;font-weight:600;color:${banner.col};">${banner.title}</div>
          <div style="font-size:10.5px;line-height:1.35;color:oklch(0.66 0.02 288);margin-top:2px;">${banner.sub}</div>
        </div>
      </div>`
    : `<div style="padding:0 12px 9px 12px;"><div style="height:42px;border-radius:12px;border:1px dashed oklch(0.44 0.11 305);background:linear-gradient(oklch(0.22 0.045 302), oklch(0.17 0.032 300));display:flex;align-items:center;justify-content:center;font-size:12px;color:oklch(0.78 0.12 305);">Черпнуть из бездны · +2 маны за 1 Скверну</div></div>`;
  const body=`
    <div style="position:relative;height:${H}px;margin:0 12px;">
      <div style="position:absolute;left:50%;top:74px;transform:translate(-50%,-50%);width:400px;height:290px;pointer-events:none;background:radial-gradient(ellipse at center, oklch(0.78 0.16 70 / .30) 0%, oklch(0.74 0.16 68 / .13) 34%, oklch(0.70 0.15 66 / .05) 60%, transparent 78%);"></div>
      <div style="position:absolute;left:50%;top:88px;transform:translate(-50%,-50%);width:190px;height:170px;pointer-events:none;background:radial-gradient(ellipse at center, oklch(0.90 0.14 76 / .26) 0%, oklch(0.84 0.15 72 / .08) 46%, transparent 74%);"></div>
      <svg width="351" height="${H}" viewBox="0 0 351 ${H}" style="position:absolute;inset:0;" aria-hidden="true">
        <path d="${PATH}" stroke="${AMD}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".16"/>
        <path d="${PATH}" stroke="${AMD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".62"/>
        <path d="${PATH}" stroke="oklch(0.97 0.08 84)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        ${branches}
      </svg>
      <div style="position:absolute;left:0;right:0;top:14px;display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.34em;color:oklch(0.88 0.11 80);text-shadow:0 0 18px oklch(0.80 0.16 72 / .9);">ПОРОГ</div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:78px;font-weight:700;line-height:1.02;color:oklch(0.98 0.05 84);text-shadow:0 0 64px oklch(0.84 0.17 70), 0 0 30px oklch(0.86 0.16 74 / .85), 0 0 12px oklch(0.92 0.13 78 / .7);">${threshold}</div>
        <div style="margin-top:3px;font-size:10.5px;color:oklch(0.80 0.03 84);text-shadow:0 0 14px ${BG}, 0 0 26px ${BG};">сумма выше — узел схлопнется</div>
      </div>
      ${cards}
    </div>
    <div style="flex-grow:1;min-height:2px;"></div>
    <div style="display:flex;align-items:center;gap:9px;padding:0 16px 8px 16px;">
      <div style="display:flex;align-items:center;gap:9px;">${gems}</div>
      <div style="flex-grow:1;"></div>
      <div style="font-size:11px;font-weight:600;color:oklch(0.74 0.13 306);">Скверна ${mana.corr}</div>
      <div style="font-size:11px;font-weight:600;color:oklch(0.60 0.02 288);">Чары ${mana.charms}</div>
    </div>
    ${bannerHtml}
    <div style="display:flex;align-items:center;gap:13px;padding:10px 12px 15px 12px;border-top:1px solid oklch(0.24 0.028 288);background:linear-gradient(oklch(0.165 0.028 288), oklch(0.125 0.022 288));">
      <div style="display:flex;flex-direction:column;gap:1px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:.16em;color:oklch(0.52 0.02 288);">МАНА</div>
        <div style="display:flex;align-items:baseline;gap:3px;">
          <div style="font-family:Cinzel,Georgia,serif;font-size:30px;font-weight:700;line-height:1;color:oklch(0.96 0.05 84);text-shadow:0 0 20px oklch(0.80 0.15 72 / .8);">${mana.left}</div>
          <div style="font-size:12px;color:oklch(0.50 0.02 288);">/ ${mana.cap}</div>
        </div>
      </div>
      ${bar}
    </div>`;
  return shell(phase,sub,body);
}

const RC={fire:['oklch(0.68 0.20 32)','oklch(0.86 0.15 44)'],water:['oklch(0.66 0.16 248)','oklch(0.84 0.11 240)'],
          earth:['oklch(0.72 0.16 152)','oklch(0.88 0.13 148)'],air:['oklch(0.90 0.02 250)','oklch(0.97 0.01 250)'],
          voi:['oklch(0.64 0.21 305)','oklch(0.82 0.16 308)']};
const HAND=(a,b,c,d,e)=>[[...RC.fire,a],[...RC.water,b],[...RC.earth,c],[...RC.air,d],[...RC.voi,e]];
const nd=(n,k,v,side,extra={})=>({n,c:RC[k][0],g:RC[k][1],v,side,emp:0,burned:0,...extra});

writeFileSync('Burned.dc.html', field({
  phase:'Плетение', sub:'Эпоха III · раунд 15 / 18', threshold:5,
  nodes:[nd('Огонь','fire',0,'l',{burned:1}), nd('Вода','water',0,'r'), nd('Земля','earth',5,'l'),
         nd('Воздух','air',0,'r'), nd('Пустота','voi',2,'l',{emp:1})],
  hand:HAND(3,2,5,1,2), mana:{left:3,cap:12,corr:2,charms:4}, banner:null, bottom:'normal'}));

writeFileSync('Waiting.dc.html', field({
  phase:'Плетение', sub:'Эпоха II · раунд 9 / 18', threshold:7,
  nodes:[nd('Огонь','fire',3,'l'), nd('Вода','water',0,'r',{emp:1}), nd('Земля','earth',4,'l'),
         nd('Воздух','air',0,'r'), nd('Пустота','voi',0,'l')],
  hand:HAND(2,1,3,0,1), mana:{left:1,cap:8,corr:1,charms:2},
  banner:{ava:'Иван', title:'Ждём Ивана', sub:'Он ещё не нажал «Готово». Кнопки поторопить не существует.',
           col:'oklch(0.92 0.01 288)', bg:'oklch(0.19 0.026 288)', brd:'oklch(0.30 0.032 288)'},
  bottom:'waiting'}));

writeFileSync('Offline.dc.html', field({
  phase:'Плетение', sub:'Эпоха II · раунд 9 / 18', threshold:7,
  nodes:[nd('Огонь','fire',3,'l'), nd('Вода','water',0,'r',{emp:1}), nd('Земля','earth',4,'l'),
         nd('Воздух','air',0,'r'), nd('Пустота','voi',0,'l')],
  hand:HAND(2,1,3,0,1), mana:{left:1,cap:8,corr:1,charms:2},
  banner:{ava:'Иван', title:'Иван отключился', sub:'Стол ждёт возвращения. Заменить его нельзя — партия асинхронная.',
           col:REDL, bg:'oklch(0.20 0.045 30)', brd:'oklch(0.38 0.09 30)'},
  bottom:'offline'}));

console.log('готово: Burned, Waiting, Offline');
