import { writeFileSync } from 'node:fs';

const BG='oklch(0.135 0.028 288)', AM='oklch(0.86 0.16 76)', AMD='oklch(0.72 0.16 66)';
const RED='oklch(0.64 0.22 28)', REDL='oklch(0.80 0.17 34)';
const CARD='linear-gradient(100deg, oklch(0.235 0.030 288) 0%, oklch(0.185 0.026 288) 72%)';
const BRD='oklch(0.30 0.032 288)';
const E={
  fire :{n:'Огонь',  c:'oklch(0.68 0.20 32)', g:'oklch(0.86 0.15 44)'},
  water:{n:'Вода',   c:'oklch(0.66 0.16 248)',g:'oklch(0.84 0.11 240)'},
  earth:{n:'Земля',  c:'oklch(0.72 0.16 152)',g:'oklch(0.88 0.13 148)'},
  air  :{n:'Воздух', c:'oklch(0.90 0.02 250)',g:'oklch(0.97 0.01 250)'},
  void :{n:'Пустота',c:'oklch(0.64 0.21 305)',g:'oklch(0.82 0.16 308)'},
};
const ORDER=['fire','water','earth','air','void'];
const TH=7;

const NODES={
  fire :{sum:10, emp:0, parts:[['Иван',5],['вы',3],['Марк',2]]},
  water:{sum:6,  emp:1, parts:[['Аня',4],['Пётр',2]]},
  earth:{sum:7,  emp:0, parts:[['вы',4],['Лена',3]]},
  air  :{sum:1,  emp:0, parts:[['Марк',1]]},
  void :{sum:5,  emp:0, parts:[['Пётр',3],['Иван',2]]},
};

const gemDot=(k,s,lit=1)=>`<div style="width:${s}px;height:${s}px;border-radius:${s}px;flex-shrink:0;background:radial-gradient(circle at 34% 28%, ${E[k].g}, ${E[k].c} 62%, oklch(0.16 0.03 288));${lit?`box-shadow:0 0 ${s}px ${E[k].c}, inset 0 1px 1px rgba(255,255,255,.55);`:'opacity:.4;'}"></div>`;

const ava=(name,s=24)=>{
  const me = name==='вы';
  return `<div style="width:${s}px;height:${s}px;border-radius:${s}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    font-size:${s*0.42}px;font-weight:600;font-family:Barlow,system-ui,sans-serif;
    background:${me?'linear-gradient(oklch(0.44 0.10 70), oklch(0.30 0.07 66))':'oklch(0.26 0.03 288)'};
    color:${me?AM:'oklch(0.74 0.02 288)'};
    border:1px solid ${me?'oklch(0.62 0.13 72)':'oklch(0.33 0.03 288)'};">${me?'В':name[0]}</div>`;
};

const grain=`
  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;pointer-events:none;" aria-hidden="true">
    <defs><filter id="g-n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/></filter></defs>
    <rect width="375" height="812" filter="url(#g-n)"/>
  </svg>
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 96% 56% at 50% 26%, transparent 44%, rgba(4,3,8,.62) 100%);"></div>`;

const shell=(phase,body,bg='')=>`<!doctype html>
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
      <div style="font-size:10.5px;letter-spacing:.08em;color:oklch(0.52 0.02 288);">раунд 9 / 18</div>
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

/* ═══ РАСКРЫТИЕ ═══ трещина ушла в левое поле, карточки развернулись под данные */
{
const crackPts=[[16,0],[9,44],[22,92],[12,140],[24,190],[10,238],[23,288],[13,336],[25,386],[11,434],[22,486],[15,534]];
const CP='M'+crackPts.map(p=>p.join(' ')).join(' L');
let y=0, cards='', branches='';
for(const k of ORDER){
  const d=NODES[k], over=d.sum>TH;   // полоска нормирована по Порогу, а не по максимуму внутри узла
  const h=38+d.parts.length*27+12;
  branches+=`<path d="M${crackPts.find(p=>p[1]>=Math.min(534,y+h/2))?24:24} ${y+h/2} L34 ${y+h/2}" stroke="${AMD}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><circle cx="34" cy="${y+h/2}" r="2.4" fill="${AM}" opacity=".75"/>`;
  cards+=`<div style="position:absolute;left:34px;top:${y}px;width:317px;height:${h}px;box-sizing:border-box;padding:9px 11px;border-radius:13px;background:${CARD};border:1px solid ${over?'oklch(0.40 0.11 30)':BRD};box-shadow:inset 2px 0 0 oklch(0.62 0.13 70 / .5), 0 5px 14px rgba(0,0,0,.5)${over?`, 0 0 22px -6px ${RED}`:''};">
    <div style="display:flex;align-items:center;gap:8px;height:26px;">
      ${gemDot(k,13)}
      <div style="font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:600;">${E[k].n}</div>
      ${d.emp?`<div style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:linear-gradient(oklch(0.46 0.11 72), oklch(0.34 0.08 68));color:${AM};">×2</div>`:''}
      <div style="flex-grow:1;"></div>
      <div style="display:flex;align-items:baseline;gap:5px;">
        <div style="font-family:Cinzel,Georgia,serif;font-size:21px;font-weight:700;line-height:1;color:${over?REDL:'oklch(0.94 0.01 288)'};${over?`text-shadow:0 0 14px ${RED};`:''}">${d.sum}</div>
        <div style="font-size:10px;color:${over?REDL:'oklch(0.50 0.02 288)'};">${over?`› ${TH}`:`из ${TH}`}</div>
      </div>
    </div>
    <div style="height:1px;background:oklch(0.28 0.03 288);margin:3px 0 5px 0;"></div>
    ${d.parts.map(([nm,v])=>`<div style="display:flex;align-items:center;gap:9px;height:27px;">
      ${ava(nm,22)}
      <div style="font-size:12.5px;width:44px;color:${nm==='вы'?AM:'oklch(0.82 0.015 288)'};font-weight:${nm==='вы'?600:400};">${nm}</div>
      <div style="flex-grow:1;height:7px;border-radius:4px;background:oklch(0.22 0.026 288);overflow:hidden;">
        <div style="width:${Math.min(100,Math.round(v/TH*100))}%;height:100%;border-radius:4px;background:linear-gradient(90deg, ${E[k].c}, ${E[k].g});opacity:${over?.55:.9};"></div>
      </div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;width:20px;text-align:right;">${v}</div>
    </div>`).join('')}
  </div>`;
  y+=h+9;
}
const body=`
  <div style="position:relative;height:${y-9}px;margin:2px 12px 0 12px;">
    <svg width="351" height="${y-9}" viewBox="0 0 351 540" preserveAspectRatio="none" style="position:absolute;inset:0;" aria-hidden="true">
      <path d="${CP}" stroke="${AMD}" stroke-width="15" stroke-linecap="round" fill="none" opacity=".14"/>
      <path d="${CP}" stroke="${AMD}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>
      <path d="${CP}" stroke="oklch(0.97 0.08 84)" stroke-width="1.7" stroke-linecap="round" fill="none"/>
    </svg>
    <svg width="351" height="${y-9}" viewBox="0 0 351 ${y-9}" style="position:absolute;inset:0;" aria-hidden="true">${branches}</svg>
    ${cards}
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="margin:0 12px 9px 12px;padding:9px 12px;border-radius:12px;background:oklch(0.19 0.030 288);border:1px solid ${BRD};display:flex;align-items:center;gap:10px;">
    <div style="font-size:11.5px;line-height:1.35;color:oklch(0.70 0.02 288);">Стопки вскрыты. Порог этого раунда — <span style="color:${AM};font-weight:600;">7</span>. Огонь набрал <span style="color:${REDL};font-weight:600;">10</span>.</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;padding:0 12px 15px 12px;">
    <div style="font-size:11px;color:oklch(0.50 0.02 288);text-decoration:underline;text-underline-offset:3px;">Пропустить</div>
    <div style="flex-grow:1;"></div>
    <div style="height:48px;padding:0 26px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:700;letter-spacing:.08em;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5), 0 0 30px oklch(0.80 0.16 72 / .35);">РЕЗОНАНС →</div>
  </div>`;
writeFileSync('Reveal.dc.html', shell('Раскрытие', body));
}

/* ═══ РЕЗОНАНС ═══ */
const crackBg=(flareY,col)=>`
  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;" aria-hidden="true">
    <path d="M188 92 L172 150 L196 210 L166 272 L192 334 L170 396 L194 458 L168 520 L190 582 L172 644 L192 706 L178 768 L188 812"
          stroke="${AMD}" stroke-width="15" stroke-linecap="round" fill="none" opacity=".07"/>
    <path d="M188 92 L172 150 L196 210 L166 272 L192 334 L170 396 L194 458 L168 520 L190 582 L172 644 L192 706 L178 768 L188 812"
          stroke="${AMD}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity=".18"/>
    <path d="M188 92 L172 150 L196 210 L166 272 L192 334 L170 396 L194 458 L168 520 L190 582 L172 644 L192 706 L178 768 L188 812"
          stroke="oklch(0.97 0.08 84)" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".30"/>
  </svg>
  <div style="position:absolute;left:50%;top:${flareY}px;transform:translate(-50%,-50%);width:460px;height:340px;pointer-events:none;
       background:radial-gradient(ellipse at center, ${col} 0%, transparent 62%);opacity:.26;"></div>`;

const queue=(cur,done)=>`<div style="display:flex;gap:6px;padding:0 12px 8px 12px;">
  ${ORDER.map(k=>{
    const isCur=k===cur, isDone=done.includes(k);
    return `<div style="flex:1;height:46px;border-radius:10px;box-sizing:border-box;padding:0 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
      background:${isCur?'linear-gradient(oklch(0.30 0.07 68), oklch(0.22 0.05 66))':'oklch(0.175 0.026 288)'};
      border:1px solid ${isCur?'oklch(0.64 0.13 72)':'oklch(0.25 0.03 288)'};
      ${isCur?`box-shadow:0 0 18px -4px ${AMD};`:''}">
      ${gemDot(k,10,isCur||isDone?1:0)}
      <div style="font-size:8.5px;letter-spacing:.03em;color:${isCur?AM:isDone?'oklch(0.56 0.02 288)':'oklch(0.38 0.02 288)'};">${E[k].n}</div>
    </div>`;
  }).join('')}
</div>`;

const gauge=(sum,over)=>{
  const max=Math.max(sum,TH)*1.25, thP=TH/max*100, fP=sum/max*100;
  return `<div style="margin:0 14px;">
    <div style="position:relative;height:16px;border-radius:9px;background:oklch(0.20 0.026 288);box-shadow:inset 0 2px 5px rgba(0,0,0,.6);overflow:visible;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(fP,thP)}%;border-radius:9px 0 0 9px;background:linear-gradient(90deg, oklch(0.46 0.10 70), ${AMD});"></div>
      ${over?`<div style="position:absolute;left:${thP}%;top:-2px;bottom:-2px;width:${fP-thP}%;border-radius:0 10px 10px 0;background:linear-gradient(90deg, ${RED}, ${REDL});box-shadow:0 0 20px ${RED};"></div>`:''}
      <div style="position:absolute;left:${thP}%;top:-7px;bottom:-7px;width:2px;background:${over?REDL:AM};box-shadow:0 0 8px ${over?RED:AM};"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:9px;">
      <div style="font-size:11px;color:oklch(0.60 0.02 288);">сумма на узле <span style="font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;color:${over?REDL:'oklch(0.94 0.01 288)'};">${sum}</span></div>
      <div style="font-size:11px;color:oklch(0.60 0.02 288);">порог <span style="font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;color:${AM};">${TH}</span></div>
    </div>
  </div>`;
};

const head=(k,over)=>`<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:30px 0 24px 0;">
  ${over?`<div style="position:absolute;left:50%;top:68px;transform:translate(-50%,-50%);width:300px;height:150px;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse, ${RED} 0%, transparent 66%);opacity:.30;"></div>`:
        `<div style="position:absolute;left:50%;top:68px;transform:translate(-50%,-50%);width:270px;height:150px;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse, ${E[k].c} 0%, transparent 66%);opacity:.22;"></div>`}
  <div style="position:relative;">${gemDot(k,76)}</div>
  <div style="position:relative;font-family:Cinzel,Georgia,serif;font-size:33px;font-weight:700;letter-spacing:.07em;">${E[k].n}</div>
</div>`;

const row=(nm,txt,val,col)=>`<div style="display:flex;align-items:center;gap:11px;height:42px;">
  ${ava(nm,26)}
  <div style="font-size:13px;color:${nm==='вы'?AM:'oklch(0.84 0.015 288)'};font-weight:${nm==='вы'?600:400};width:46px;">${nm}</div>
  <div style="font-size:12px;color:oklch(0.58 0.02 288);flex-grow:1;">${txt}</div>
  <div style="font-size:13px;font-weight:600;color:${col};">${val}</div>
</div>`;

/* — перегрузка на Огне — */
{
const d=NODES.fire;
const body=`
  ${queue('fire',[])}
  ${head('fire',true)}
  ${gauge(d.sum,true)}
  <div style="margin:30px 14px 0 14px;padding:16px;border-radius:13px;background:linear-gradient(oklch(0.26 0.08 28), oklch(0.19 0.05 24));border:1px solid oklch(0.44 0.13 30);box-shadow:0 0 26px -8px ${RED};">
    <div style="display:flex;align-items:center;gap:9px;">
      <svg width="19" height="19" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0.6l1.7 4.2 4.3-1.6-2.5 3.8 3.9 2.3-4.5.5 1 4.4-3.3-3.1-3.1 3.3.7-4.5-4.5-.8 3.8-2.5-2.7-3.7 4.4 1.4z" fill="${REDL}"/></svg>
      <div style="font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:700;letter-spacing:.1em;color:${REDL};">ПЕРЕГРУЗКА</div>
    </div>
    <div style="font-size:12px;line-height:1.4;color:oklch(0.80 0.04 30);margin-top:6px;">Узел схлопнулся. Эссенцию не получает никто, а Скверну берут все, кто на нём стоял.</div>
  </div>
  <div style="margin:26px 14px 0 14px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin-bottom:6px;">Последствия</div>
    ${d.parts.map(([nm])=>row(nm,'выжжен Скверной','+1 Скверна',REDL)).join('')}
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="margin:0 14px 10px 14px;font-size:10.5px;line-height:1.4;color:oklch(0.64 0.025 288);">В Эпохе III такой узел ещё и выгорел бы — навсегда ушёл бы с поля.</div>
  <div style="display:flex;align-items:center;gap:12px;padding:0 12px 15px 12px;">
    <div style="font-size:11px;color:oklch(0.50 0.02 288);text-decoration:underline;text-underline-offset:3px;">Пропустить</div>
    <div style="flex-grow:1;"></div>
    <div style="height:48px;padding:0 24px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;gap:8px;font-family:Cinzel,Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.06em;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">ДАЛЬШЕ: ВОДА →</div>
  </div>`;
writeFileSync('Resonance.dc.html', shell('Резонанс', body, crackBg(232, RED)));
}

/* — узел взят ровно на Пороге — */
{
const d=NODES.earth;
const body=`
  ${queue('earth',['fire','water'])}
  ${head('earth',false)}
  ${gauge(d.sum,false)}
  <div style="margin:30px 14px 0 14px;padding:16px;border-radius:13px;background:linear-gradient(oklch(0.24 0.06 152), oklch(0.18 0.04 150));border:1px solid oklch(0.42 0.10 152);box-shadow:0 0 26px -10px ${E.earth.c};">
    <div style="display:flex;align-items:center;gap:9px;">
      <div style="font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:700;letter-spacing:.08em;color:${E.earth.g};">УЗЕЛ УСТОЯЛ</div>
    </div>
    <div style="font-size:12px;line-height:1.4;color:oklch(0.82 0.04 152);margin-top:6px;">Сумма ровно равна Порогу — это ещё не перегрузка. Узел разрешается как обычно.</div>
  </div>
  <div style="margin:26px 14px 0 14px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin-bottom:6px;">Награда</div>
    ${row('вы','первое место','+3 зелёной',E.earth.g)}
    ${row('Лена','второе место','+1 зелёной',E.earth.c)}
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="margin:0 14px 10px 14px;font-size:10.5px;line-height:1.4;color:oklch(0.64 0.025 288);">Дальше Возврат: ваши 4 маны с этого узла тратятся безвозвратно — мана уходит только за победу.</div>
  <div style="display:flex;align-items:center;gap:12px;padding:0 12px 15px 12px;">
    <div style="font-size:11px;color:oklch(0.50 0.02 288);text-decoration:underline;text-underline-offset:3px;">Пропустить</div>
    <div style="flex-grow:1;"></div>
    <div style="height:48px;padding:0 22px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;gap:8px;font-family:Cinzel,Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.06em;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">ДАЛЬШЕ: ВОЗДУХ →</div>
  </div>`;
writeFileSync('Resolve.dc.html', shell('Резонанс', body, crackBg(232, E.earth.c)));
}

console.log('готово: Reveal.dc.html, Resonance.dc.html, Resolve.dc.html');
