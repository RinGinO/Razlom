import { writeFileSync } from 'node:fs';

const BG='oklch(0.135 0.028 288)', AM='oklch(0.86 0.16 76)', AMD='oklch(0.72 0.16 66)';
const RED='oklch(0.64 0.22 28)', REDL='oklch(0.80 0.17 34)';
const CARD='linear-gradient(100deg, oklch(0.235 0.030 288) 0%, oklch(0.185 0.026 288) 72%)';
const BRD='oklch(0.30 0.032 288)';
const GRN='oklch(0.72 0.16 152)', GRNL='oklch(0.88 0.13 148)';

const C={
 red   :{n:'красная',    c:'oklch(0.68 0.20 32)', g:'oklch(0.86 0.15 44)'},
 blue  :{n:'синяя',      c:'oklch(0.66 0.16 248)',g:'oklch(0.84 0.11 240)'},
 green :{n:'зелёная',    c:'oklch(0.72 0.16 152)',g:'oklch(0.88 0.13 148)'},
 white :{n:'белая',      c:'oklch(0.90 0.02 250)',g:'oklch(0.97 0.01 250)'},
 purple:{n:'фиолетовая', c:'oklch(0.64 0.21 305)',g:'oklch(0.82 0.16 308)'},
};
const CK=['red','blue','green','white','purple'];

const pip=(k,s,lit=1)=>`<div style="width:${s}px;height:${s}px;border-radius:${s}px;flex-shrink:0;background:radial-gradient(circle at 34% 28%, ${C[k].g}, ${C[k].c} 62%, oklch(0.16 0.03 288));${lit?`box-shadow:0 0 ${Math.round(s*0.8)}px ${C[k].c}, inset 0 1px 1px rgba(255,255,255,.55);`:'opacity:.34;'}"></div>`;

const ava=(name,s=24)=>{const me=name==='вы';
  return `<div style="width:${s}px;height:${s}px;border-radius:${s}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${(s*0.42).toFixed(1)}px;font-weight:600;
    background:${me?'linear-gradient(oklch(0.44 0.10 70), oklch(0.30 0.07 66))':'oklch(0.26 0.03 288)'};color:${me?AM:'oklch(0.74 0.02 288)'};
    border:1px solid ${me?'oklch(0.62 0.13 72)':'oklch(0.33 0.03 288)'};">${me?'В':name[0]}</div>`;};

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
      <div style="font-size:10.5px;letter-spacing:.08em;color:oklch(0.52 0.02 288);">${sub}</div>
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

const nextBtn=(label,left='Пропустить')=>`
  <div style="display:flex;align-items:center;gap:12px;padding:0 12px 15px 12px;">
    <div style="font-size:11px;white-space:nowrap;color:oklch(0.50 0.02 288);text-decoration:underline;text-underline-offset:3px;">${left}</div>
    <div style="flex-grow:1;"></div>
    <div style="height:48px;padding:0 24px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;font-family:Cinzel,Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.06em;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">${label}</div>
  </div>`;

/* ══════ 1. ВОЗВРАТ ══════ */
{
const ledger=[
 {t:'Осталось в запасе',       s:'не выкладывали',                     v:'1',  col:'oklch(0.80 0.015 288)', k:null},
 {t:'Огонь · перегрузка',      s:'узел не взят — мана вернулась',      v:'+3', col:GRNL, k:'red'},
 {t:'Земля · первое место',    s:'победа оплачена — мана сгорела',     v:'−4', col:REDL, k:'green'},
 {t:'Доход раунда',            s:'всем поровну',                       v:'+3', col:GRNL, k:null},
];
const body=`
  <div style="padding:22px 16px 6px 16px;">
    <div style="font-family:Cinzel,Georgia,serif;font-size:30px;font-weight:700;letter-spacing:.05em;">Возврат</div>
    <div style="margin-top:9px;padding:11px 13px;border-radius:12px;background:oklch(0.20 0.045 70);border:1px solid oklch(0.40 0.09 70);">
      <div style="font-size:13px;font-weight:600;color:${AM};">Мана расходуется только при победе</div>
      <div style="font-size:11.5px;line-height:1.4;color:oklch(0.72 0.03 288);margin-top:3px;">Поэтому проигрывать дёшево: отстающий копит запас и через два-три раунда продавит любой узел.</div>
    </div>
  </div>
  <div style="margin:18px 16px 0 16px;">
    ${ledger.map(r=>`<div style="display:flex;align-items:center;gap:11px;height:50px;border-bottom:1px solid oklch(0.22 0.026 288);">
      ${r.k?pip(r.k,14):`<div style="width:14px;"></div>`}
      <div style="flex-grow:1;">
        <div style="font-size:13.5px;color:oklch(0.90 0.01 288);">${r.t}</div>
        <div style="font-size:10.5px;color:oklch(0.54 0.02 288);margin-top:1px;">${r.s}</div>
      </div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:24px;font-weight:700;color:${r.col};">${r.v}</div>
    </div>`).join('')}
  </div>
  <div style="margin:20px 16px 0 16px;display:flex;align-items:center;gap:14px;">
    <div style="flex-grow:1;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.52 0.02 288);">Запас на следующий раунд</div>
      <div style="height:12px;border-radius:7px;background:oklch(0.20 0.026 288);box-shadow:inset 0 2px 4px rgba(0,0,0,.6);margin-top:8px;overflow:hidden;">
        <div style="width:58.3%;height:100%;border-radius:7px;background:linear-gradient(90deg, oklch(0.50 0.11 70), ${AM});"></div>
      </div>
      <div style="font-size:10.5px;color:oklch(0.54 0.02 288);margin-top:6px;">предел запаса 12 — излишек сгорел бы</div>
    </div>
    <div style="display:flex;align-items:baseline;gap:3px;">
      <div style="font-family:Cinzel,Georgia,serif;font-size:52px;font-weight:700;line-height:1;color:oklch(0.96 0.05 84);text-shadow:0 0 30px oklch(0.80 0.15 72 / .7);">7</div>
      <div style="font-size:15px;color:oklch(0.52 0.02 288);">/ 12</div>
    </div>
  </div>
  <div style="margin:18px 16px 0 16px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);">Запас соперников</div>
      <div style="font-size:10px;color:oklch(0.44 0.02 288);">мана видна всем</div>
    </div>
    ${[['Иван',10],['Марк',8],['Лена',8],['вы',7],['Пётр',6],['Аня',5]].map(([n,v])=>`
      <div style="display:flex;align-items:center;gap:10px;height:28px;${n==='вы'?'background:oklch(0.22 0.04 70);border-radius:8px;padding:0 8px;margin:0 -8px;':''}">
        ${ava(n,22)}
        <div style="flex-grow:1;font-size:12.5px;color:${n==='вы'?AM:'oklch(0.84 0.015 288)'};font-weight:${n==='вы'?600:400};">${n}</div>
        <div style="width:104px;height:6px;border-radius:4px;background:oklch(0.20 0.026 288);overflow:hidden;">
          <div style="width:${Math.round(v/12*100)}%;height:100%;border-radius:4px;background:linear-gradient(90deg, oklch(0.46 0.09 70), ${AM});opacity:${n==='вы'?1:.6};"></div>
        </div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;width:22px;text-align:right;">${v}</div>
      </div>`).join('')}
    <div style="font-size:10.5px;line-height:1.4;color:oklch(0.62 0.025 288);margin-top:9px;">Иван не взял в этом раунде ни одного узла — и потому уходит в следующий с самым большим запасом.</div>
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  ${nextBtn('К СТРОИТЕЛЬСТВУ →')}`;
writeFileSync('Upkeep.dc.html', shell('Возврат','раунд 9 / 18', body, crackBg(0.7)));
}

/* ══════ 2. СТРОИТЕЛЬСТВО ══════ */
{
const market=[
 {n:'Сговор', p:5, e:'При ничьей за первое место ты считаешься победителем'},
 {n:'Око',    p:6, e:'До вскрытия видишь, на скольких узлах стоят соперники'},
 {n:'Тигель', p:6, e:'В момент подсчёта 2 эссенции одного цвета → 1 любого', sel:1},
 {n:'Глубина',p:6, e:'Скверна даёт +4 маны вместо +2'},
 {n:'Печать', p:7, e:'Раз в раунд объявляешь узел закрытым для соперника'},
 {n:'Зеркало',p:7, e:'Предзаявка: поменять местами свои стопки на двух узлах'},
];
const mine={red:2,blue:1,green:6,white:0,purple:1};
const body=`
  <div style="margin:6px 12px 0 12px;padding:10px 12px;border-radius:12px;background:${CARD};border:1px solid ${BRD};">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:oklch(0.52 0.02 288);">Ваша эссенция</div>
      <div style="flex-grow:1;"></div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${CK.map(k=>`<div style="display:flex;align-items:center;gap:3px;">${pip(k,13,mine[k]>0)}<div style="font-size:12px;font-weight:600;color:${mine[k]?'oklch(0.90 0.01 288)':'oklch(0.42 0.02 288)'};">${mine[k]}</div></div>`).join('')}
        <div style="font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;margin-left:4px;">10</div>
      </div>
    </div>
    <div style="font-size:10.5px;line-height:1.35;color:oklch(0.74 0.09 40);margin-top:7px;">Потраченная эссенция не считается на Схождении — покупка стоит вам большинства.</div>
  </div>
  <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin:12px 12px 6px 12px;">Рынок Эпохи II · 6 карт</div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 12px 0 12px;">
    ${market.map(m=>`<div style="height:124px;box-sizing:border-box;padding:10px 11px;border-radius:12px;background:${m.sel?'linear-gradient(150deg, oklch(0.27 0.055 70), oklch(0.20 0.035 68))':CARD};border:${m.sel?'2px solid oklch(0.66 0.13 72)':'1px solid '+BRD};${m.sel?'box-shadow:0 0 24px -8px '+AMD+';':''}display:flex;flex-direction:column;">
      <div style="display:flex;align-items:baseline;gap:7px;">
        <div style="font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:700;flex-grow:1;">${m.n}</div>
        <div style="display:flex;align-items:center;gap:3px;">
          <div style="width:11px;height:11px;border-radius:6px;background:linear-gradient(oklch(0.72 0.03 288), oklch(0.44 0.02 288));"></div>
          <div style="font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;color:${AM};">${m.p}</div>
        </div>
      </div>
      <div style="font-size:10px;line-height:1.42;color:oklch(0.66 0.02 288);margin-top:6px;">${m.e}</div>
    </div>`).join('')}
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="margin:0 12px 9px 12px;padding:10px 12px;border-radius:12px;background:linear-gradient(150deg, oklch(0.26 0.05 70), oklch(0.19 0.032 68));border:1px solid oklch(0.52 0.11 72);">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="flex-grow:1;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:oklch(0.60 0.06 76);">Берёте</div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:700;margin-top:1px;">Тигель <span style="font-size:13px;color:oklch(0.62 0.02 288);">· цена 6</span></div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:oklch(0.56 0.02 288);">надбавка</div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:19px;font-weight:700;color:${AM};">+1</div>
      </div>
      <div style="display:flex;gap:6px;">
        <div style="width:40px;height:40px;border-radius:11px;border:1px solid oklch(0.32 0.03 288);background:oklch(0.21 0.026 288);color:oklch(0.80 0.01 288);display:flex;align-items:center;justify-content:center;font-size:21px;">−</div>
        <div style="width:40px;height:40px;border-radius:11px;border:1px solid oklch(0.58 0.13 70);background:linear-gradient(oklch(0.34 0.08 68), oklch(0.25 0.06 66));color:${AM};display:flex;align-items:center;justify-content:center;font-size:21px;">+</div>
      </div>
    </div>
    <div style="font-size:10.5px;color:oklch(0.68 0.025 288);margin-top:8px;border-top:1px solid oklch(0.34 0.05 70);padding-top:7px;">Спишется 7 эссенции любых цветов · останется <span style="color:${AM};font-weight:600;">3</span> · при равной ставке решает меньшая Скверна</div>
  </div>
  <div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:0 12px 8px 12px;">
    <div style="font-size:10px;white-space:nowrap;color:oklch(0.54 0.02 288);">готовы 2 из 6</div>
    <div style="display:flex;gap:4px;">${[1,1,0,0,0,0].map(f=>`<div style="width:9px;height:9px;border-radius:5px;background:${f?'radial-gradient(circle at 32% 26%, oklch(0.96 0.11 84), oklch(0.72 0.15 74))':'oklch(0.26 0.025 288)'};${f?'box-shadow:0 0 9px oklch(0.82 0.15 76 / .9);':'box-shadow:inset 0 1px 2px rgba(0,0,0,.7);'}"></div>`).join('')}</div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;padding:0 12px 15px 12px;">
    <div style="height:48px;padding:0 22px;border-radius:13px;border:1px solid ${BRD};background:oklch(0.19 0.026 288);color:oklch(0.72 0.02 288);display:flex;align-items:center;font-size:13.5px;white-space:nowrap;">Пасовать</div>
    <div style="flex-grow:1;"></div>
    <div style="height:48px;padding:0 30px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:700;letter-spacing:.08em;white-space:nowrap;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5);">ГОТОВО</div>
  </div>`;
writeFileSync('Building.dc.html', shell('Строительство','раунд 9 / 18', body, crackBg(0.45)));
}

/* ══════ 3. СХОЖДЕНИЕ ══════ */
{
const rows=[
 {k:'red',   lead:[['Иван',6]],            rest:[['Марк',4],['вы',2]],  me:0},
 {k:'blue',  lead:[['Аня',7]],             rest:[['Пётр',3],['вы',1]],  me:0},
 {k:'green', lead:[['вы',6]],              rest:[['Лена',4]],           me:1},
 {k:'white', lead:[['Марк',5]],            rest:[['Иван',2]],           me:0},
 {k:'purple',lead:[['Пётр',5],['Лена',5]], rest:[['вы',1]],             me:0},
];
const body=`
  <div style="padding:16px 16px 4px 16px;">
    <div style="display:flex;align-items:baseline;gap:11px;">
      <div style="font-family:Cinzel,Georgia,serif;font-size:29px;font-weight:700;letter-spacing:.04em;">Схождение II</div>
      <div style="font-size:13px;color:${AM};font-weight:600;">+3 ПО</div>
    </div>
    <div style="font-size:11.5px;line-height:1.4;color:oklch(0.66 0.02 288);margin-top:5px;">За каждый цвет — тому, у кого его больше всего прямо сейчас. Очки фиксируются, эссенция остаётся.</div>
  </div>
  <div style="margin:12px 12px 0 12px;">
    ${rows.map(r=>{const tie=r.lead.length>1;
      return `<div style="display:flex;align-items:center;gap:11px;height:66px;padding:0 11px;box-sizing:border-box;border-radius:11px;background:${r.me?'linear-gradient(100deg, oklch(0.25 0.05 152), oklch(0.19 0.03 150))':CARD};border:1px solid ${r.me?'oklch(0.44 0.10 152)':BRD};margin-bottom:7px;">
      ${pip(r.k,20)}
      <div style="width:74px;">
        <div style="font-size:12.5px;color:oklch(0.86 0.015 288);">${C[r.k].n}</div>
        <div style="font-size:10px;color:oklch(0.50 0.02 288);margin-top:1px;">${tie?'ничья':'большинство'}</div>
      </div>
      <div style="flex-grow:1;display:flex;align-items:center;gap:7px;">
        ${r.lead.map(([n,v])=>`<div style="display:flex;align-items:center;gap:5px;">${ava(n,24)}<div style="font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;color:${C[r.k].g};">${v}</div></div>`).join('')}
        <div style="width:1px;height:20px;background:oklch(0.30 0.03 288);"></div>
        ${r.rest.map(([n,v])=>`<div style="display:flex;align-items:center;gap:4px;opacity:.55;">${ava(n,19)}<div style="font-size:12px;">${v}</div></div>`).join('')}
      </div>
      <div style="font-size:12.5px;font-weight:600;color:${r.me?GRNL:'oklch(0.62 0.02 288)'};">${tie?'+3 обоим':'+3'}</div>
    </div>`;}).join('')}
  </div>
  <div style="margin:4px 12px 0 12px;padding:12px 13px;border-radius:12px;background:linear-gradient(150deg, oklch(0.26 0.05 152), oklch(0.19 0.03 150));border:1px solid oklch(0.46 0.11 152);display:flex;align-items:center;gap:12px;">
    <div style="flex-grow:1;">
      <div style="font-size:11px;color:oklch(0.74 0.05 152);">Вы взяли одно большинство — зелёное</div>
      <div style="font-size:10.5px;color:oklch(0.60 0.03 288);margin-top:2px;">всего за две эпохи: 5 ПО</div>
    </div>
    <div style="font-family:Cinzel,Georgia,serif;font-size:34px;font-weight:700;color:${GRNL};">+3</div>
  </div>
  <div style="flex-grow:1;min-height:6px;"></div>
  <div style="margin:0 12px 10px 12px;padding:10px 13px;border-radius:12px;background:oklch(0.20 0.04 30);border:1px solid oklch(0.40 0.09 30);">
    <div style="font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${REDL};">Дальше — Эпоха III «Коллапс»</div>
    <div style="font-size:11px;line-height:1.45;color:oklch(0.74 0.03 288);margin-top:4px;">Рынок Чар сбрасывается · коэффициент Порога падает до 0,9 · награда за узел вырастает до 5 · перегруженные узлы выгорают навсегда.</div>
  </div>
  ${nextBtn('НАЧАТЬ ЭПОХУ III →','История')}`;
writeFileSync('Convergence.dc.html', shell('Схождение','конец раунда 12', body, crackBg(0.55)));
}

/* ══════ 4. ИТОГИ ══════ */
{
const mine={red:3,blue:2,green:4,white:1,purple:1};
const parts=[
 {t:'Эссенция в руке',        s:'11 штук · по 1 ПО',                v:'+11'},
 {t:'Бонусы Схождений',       s:'I +2 · II +3 · III +10',           v:'+15'},
 {t:'Полные наборы',          s:'1 набор из пяти цветов · по 5 ПО', v:'+5'},
 {t:'Чары «в финале»',        s:'Венец',                            v:'+4'},
];
const board=[['Аня',33],['вы',29],['Иван',27],['Марк',24],['Пётр',22],['Лена',19]];
const body=`
  <div style="display:flex;align-items:center;gap:13px;padding:16px 16px 0 16px;">
    <div style="width:60px;height:60px;border-radius:32px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(150deg, oklch(0.42 0.08 70), oklch(0.28 0.05 66));border:2px solid oklch(0.66 0.13 72);box-shadow:0 0 26px -6px ${AMD};">
      <div style="font-family:Cinzel,Georgia,serif;font-size:24px;font-weight:700;line-height:1;color:${AM};">2</div>
      <div style="font-size:8.5px;letter-spacing:.1em;color:oklch(0.66 0.05 76);">МЕСТО</div>
    </div>
    <div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:27px;font-weight:700;letter-spacing:.04em;">Итоги</div>
      <div style="font-size:11.5px;color:oklch(0.62 0.02 288);margin-top:3px;">18 раундов · Аня впереди на 4 ПО</div>
    </div>
  </div>
  <div style="margin:16px 14px 0 14px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin-bottom:5px;">Ваш подсчёт</div>
    ${parts.map(p=>`<div style="display:flex;align-items:center;gap:10px;height:44px;border-bottom:1px solid oklch(0.22 0.026 288);">
      <div style="flex-grow:1;">
        <div style="font-size:13px;color:oklch(0.90 0.01 288);">${p.t}</div>
        <div style="font-size:10px;color:oklch(0.52 0.02 288);margin-top:1px;">${p.s}</div>
      </div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:20px;font-weight:700;color:${GRNL};">${p.v}</div>
    </div>`).join('')}
    <div style="display:flex;align-items:center;gap:10px;height:48px;border-bottom:1px solid oklch(0.22 0.026 288);">
      <div style="flex-grow:1;">
        <div style="font-size:13px;color:${REDL};">Скверна</div>
        <div style="font-size:10px;color:oklch(0.60 0.06 30);margin-top:1px;">3 жетона · штраф n(n+1)/2 = 6</div>
      </div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:20px;font-weight:700;color:${REDL};">−6</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding-top:12px;">
      <div style="font-size:13px;font-weight:600;letter-spacing:.06em;flex-grow:1;">ИТОГО</div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:44px;font-weight:700;line-height:1;color:oklch(0.96 0.05 84);text-shadow:0 0 30px oklch(0.80 0.15 72 / .7);">29</div>
    </div>
  </div>
  <div style="margin:14px 14px 0 14px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:oklch(0.50 0.02 288);margin-bottom:5px;">Стол</div>
    ${board.map(([n,v],i)=>`<div style="display:flex;align-items:center;gap:10px;height:31px;${n==='вы'?'background:oklch(0.22 0.04 70);border-radius:8px;padding:0 8px;margin:0 -8px;':''}">
      <div style="width:14px;font-size:11px;color:oklch(0.48 0.02 288);">${i+1}</div>
      ${ava(n,22)}
      <div style="flex-grow:1;font-size:12.5px;color:${n==='вы'?AM:'oklch(0.84 0.015 288)'};font-weight:${n==='вы'?600:400};">${n}</div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:16px;font-weight:700;">${v}</div>
    </div>`).join('')}
  </div>
  <div style="flex-grow:1;min-height:4px;"></div>
  ${nextBtn('РЕВАНШ →','В лобби')}`;
writeFileSync('Final.dc.html', shell('Финал','партия завершена', body, crackBg(0.35)));
}

console.log('готово: Upkeep, Building, Convergence, Final');
