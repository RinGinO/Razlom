import { writeFileSync } from 'node:fs';

const AMBER='oklch(0.86 0.16 76)', AMBER_D='oklch(0.72 0.16 66)';
const BG='oklch(0.135 0.028 288)';
const H=600;                       // высота поля трещины
const CARD_H=80, TOP=152, PITCH=92, CARD_W=156; // карточки начинаются ниже блока Порога

/* Резкая трещина стартует ПОД Порогом — выше только рассеянное устье.
   Поэтому подпись и слово ПОРОГ больше ничего не пересекает. */
const PTS=[[175,140],[165,182],[186,224],[168,268],[189,310],[169,352],[187,396],
           [163,438],[184,480],[167,522],[186,564],[175,600]];
/* x трещины на заданной высоте — чтобы гнёзда садились точно на неё */
const crackX=(y)=>{
  for(let i=0;i<PTS.length-1;i++){
    const [x1,y1]=PTS[i],[x2,y2]=PTS[i+1];
    if(y>=y1&&y<=y2) return x1+(x2-x1)*((y-y1)/(y2-y1));
  }
  return 175;
};
const PATH='M'+PTS.map(p=>p.join(' ')).join(' L');

const N=[
 {n:'Огонь',  c:'oklch(0.68 0.20 32)', g:'oklch(0.86 0.15 44)', v:3, side:'l', emp:0},
 {n:'Вода',   c:'oklch(0.66 0.16 248)',g:'oklch(0.84 0.11 240)',v:0, side:'r', emp:1},
 {n:'Земля',  c:'oklch(0.72 0.16 152)',g:'oklch(0.88 0.13 148)',v:4, side:'l', emp:0},
 {n:'Воздух', c:'oklch(0.90 0.02 250)',g:'oklch(0.97 0.01 250)',v:0, side:'r', emp:0},
 {n:'Пустота',c:'oklch(0.64 0.21 305)',g:'oklch(0.82 0.16 308)',v:0, side:'l', emp:0},
].map((x,i)=>({...x, y:TOP+i*PITCH, by:TOP+i*PITCH+CARD_H/2}));

const branches=N.map(x=>{
  const cx = crackX(x.by);
  const ex = x.side==='l' ? CARD_W+2 : 351-CARD_W-2;
  return `<path d="M${cx.toFixed(1)} ${x.by} L${ex} ${x.by}" stroke="${AMBER_D}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
          <circle cx="${cx.toFixed(1)}" cy="${x.by}" r="3.4" fill="${AMBER}" opacity=".95"/>
          <circle cx="${cx.toFixed(1)}" cy="${x.by}" r="7" fill="${AMBER}" opacity=".18"/>`;
}).join('');

const btn=(plus,dim)=>`<div style="width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  font-family:Barlow,system-ui,sans-serif;font-size:23px;line-height:1;
  ${plus
    ? `border:1px solid oklch(0.58 0.13 70);background:linear-gradient(oklch(0.34 0.08 68), oklch(0.25 0.06 66));color:${AMBER};box-shadow:inset 0 1px 0 oklch(0.72 0.14 74 / .45), 0 2px 6px rgba(0,0,0,.5);`
    : `border:1px solid oklch(0.30 0.03 288);background:oklch(0.21 0.026 288);color:${dim?'oklch(0.33 0.02 288)':'oklch(0.80 0.01 288)'};box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 2px 6px rgba(0,0,0,.45);`}
  ">${plus?'+':'−'}</div>`;

const cards=N.map(x=>{
  const L=x.side==='l', lit=x.v>0;
  const rim = L
    ? `inset -2px 0 0 oklch(0.62 0.13 70 / .55), -1px 0 0 rgba(0,0,0,.4), 10px 0 26px -10px oklch(0.78 0.15 70 / .5)`
    : `inset 2px 0 0 oklch(0.62 0.13 70 / .55), 1px 0 0 rgba(0,0,0,.4), -10px 0 26px -10px oklch(0.78 0.15 70 / .5)`;
  return `<div style="position:absolute;${L?'left:0':'right:0'};top:${x.y}px;width:${CARD_W}px;height:${CARD_H}px;box-sizing:border-box;
    padding:8px 11px;border-radius:14px;overflow:hidden;
    background:linear-gradient(${L?'100deg':'260deg'}, oklch(0.235 0.030 288) 0%, oklch(0.185 0.026 288) 72%);
    border:1px solid oklch(0.30 0.032 288);box-shadow:${rim}, 0 6px 16px rgba(0,0,0,.55);">
    ${lit?`<div style="position:absolute;${L?'left:-24px':'right:-24px'};top:-18px;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle, ${x.c} 0%, transparent 68%);opacity:.20;"></div>`:''}
    <div style="position:relative;display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;align-items:center;gap:8px;height:20px;">
        <div style="width:13px;height:13px;border-radius:7px;background:radial-gradient(circle at 34% 28%, ${x.g}, ${x.c} 62%, oklch(0.16 0.03 288));
             ${lit?`box-shadow:0 0 14px ${x.c}, inset 0 1px 1px rgba(255,255,255,.6);`:`opacity:.42;box-shadow:inset 0 1px 1px rgba(255,255,255,.25);`}"></div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:15px;font-weight:600;color:${lit?'oklch(0.94 0.01 288)':'oklch(0.66 0.015 288)'};">${x.n}</div>
        ${x.emp?`<div style="font-size:9px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:4px;background:linear-gradient(oklch(0.46 0.11 72), oklch(0.34 0.08 68));color:${AMBER};box-shadow:inset 0 1px 0 oklch(0.66 0.13 76 / .5);">×2</div>`:''}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-grow:1;">
        ${btn(false,!lit)}
        <div style="font-family:Cinzel,Georgia,serif;font-size:30px;font-weight:700;line-height:1;text-align:center;color:${lit?'oklch(0.96 0.01 288)':'oklch(0.34 0.02 288)'};${lit?`text-shadow:0 0 18px ${x.c};`:''}">${x.v}</div>
        ${btn(true,false)}
      </div>
    </div>
  </div>`;
}).join('');

const gems=[['oklch(0.68 0.20 32)','oklch(0.86 0.15 44)',2],['oklch(0.66 0.16 248)','oklch(0.84 0.11 240)',1],
            ['oklch(0.72 0.16 152)','oklch(0.88 0.13 148)',3],['oklch(0.90 0.02 250)','oklch(0.97 0.01 250)',0],
            ['oklch(0.64 0.21 305)','oklch(0.82 0.16 308)',1]]
  .map(([c,g,v])=>`<div style="display:flex;align-items:center;gap:4px;">
    <div style="width:14px;height:14px;border-radius:8px;background:radial-gradient(circle at 34% 28%, ${g}, ${c} 62%, oklch(0.16 0.03 288));${v?`box-shadow:0 0 10px ${c}, inset 0 1px 1px rgba(255,255,255,.55);`:'opacity:.4;'}"></div>
    <div style="font-size:12px;font-weight:600;color:${v?'oklch(0.88 0.01 288)':'oklch(0.42 0.02 288)'};">${v}</div></div>`).join('');

const html=`<!doctype html>
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
    a { color: ${AMBER}; } a:hover { color: oklch(0.94 0.13 80); }
  </style>
</helmet>
<div style="width:375px;height:812px;box-sizing:border-box;position:relative;overflow:hidden;background:${BG};font-family:Barlow,system-ui,sans-serif;color:oklch(0.92 0.01 288);">

  <div style="position:relative;height:100%;display:flex;flex-direction:column;">

    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:13px 16px 5px 16px;">
      <div style="font-family:Cinzel,Georgia,serif;font-size:13px;font-weight:700;letter-spacing:.2em;color:oklch(0.86 0.09 78);">РАЗЛОМ</div>
      <div style="font-size:10.5px;letter-spacing:.08em;color:oklch(0.52 0.02 288);">Эпоха II · раунд 9 / 18 · награда 3</div>
    </div>

    <div style="position:relative;height:${H}px;margin:0 12px;">

      <!-- устье: только рассеянный градиент, гаснущий в ноль. Никаких сплошных заливок -->
      <div style="position:absolute;left:50%;top:74px;transform:translate(-50%,-50%);width:400px;height:290px;pointer-events:none;
           background:radial-gradient(ellipse at center, oklch(0.78 0.16 70 / .30) 0%, oklch(0.74 0.16 68 / .13) 34%, oklch(0.70 0.15 66 / .05) 60%, transparent 78%);"></div>
      <div style="position:absolute;left:50%;top:88px;transform:translate(-50%,-50%);width:190px;height:170px;pointer-events:none;
           background:radial-gradient(ellipse at center, oklch(0.90 0.14 76 / .26) 0%, oklch(0.84 0.15 72 / .08) 46%, transparent 74%);"></div>

      <svg width="351" height="${H}" viewBox="0 0 351 ${H}" style="position:absolute;inset:0;" aria-hidden="true">
        <path d="${PATH}" stroke="${AMBER_D}" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".16"/>
        <path d="${PATH}" stroke="${AMBER_D}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".62"/>
        <path d="${PATH}" stroke="oklch(0.97 0.08 84)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        ${branches}
      </svg>

      <div style="position:absolute;left:0;right:0;top:14px;display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.34em;color:oklch(0.88 0.11 80);text-shadow:0 0 18px oklch(0.80 0.16 72 / .9);">ПОРОГ</div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:78px;font-weight:700;line-height:1.02;color:oklch(0.98 0.05 84);text-shadow:0 0 64px oklch(0.84 0.17 70), 0 0 30px oklch(0.86 0.16 74 / .85), 0 0 12px oklch(0.92 0.13 78 / .7);">7</div>
        <div style="margin-top:3px;font-size:10.5px;color:oklch(0.80 0.03 84);text-shadow:0 0 14px ${BG}, 0 0 26px ${BG};">сумма выше — узел схлопнется</div>
      </div>

      ${cards}
    </div>

    <div style="flex-grow:1;min-height:2px;"></div>

    <div style="display:flex;align-items:center;gap:9px;padding:0 16px 8px 16px;">
      <div style="display:flex;align-items:center;gap:9px;">${gems}</div>
      <div style="flex-grow:1;"></div>
      <div style="font-size:11px;font-weight:600;color:oklch(0.74 0.13 306);">Скверна 1</div>
      <div style="font-size:11px;font-weight:600;color:oklch(0.60 0.02 288);">Чары 2</div>
    </div>

    <div style="padding:0 12px 9px 12px;">
      <div style="height:42px;border-radius:12px;border:1px dashed oklch(0.44 0.11 305);background:linear-gradient(oklch(0.22 0.045 302), oklch(0.17 0.032 300));display:flex;align-items:center;justify-content:center;font-size:12px;color:oklch(0.78 0.12 305);">Черпнуть из бездны · +2 маны за 1 Скверну</div>
    </div>

    <div style="display:flex;align-items:center;gap:13px;padding:10px 12px 15px 12px;border-top:1px solid oklch(0.24 0.028 288);background:linear-gradient(oklch(0.165 0.028 288), oklch(0.125 0.022 288));">
      <div style="display:flex;flex-direction:column;gap:1px;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:.16em;color:oklch(0.52 0.02 288);">МАНА</div>
        <div style="display:flex;align-items:baseline;gap:3px;">
          <div style="font-family:Cinzel,Georgia,serif;font-size:30px;font-weight:700;line-height:1;color:oklch(0.96 0.05 84);text-shadow:0 0 20px oklch(0.80 0.15 72 / .8);">1</div>
          <div style="font-size:12px;color:oklch(0.50 0.02 288);">/ 8</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex-grow:1;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;">
          <div style="font-size:10px;color:oklch(0.54 0.02 288);">готовы 3 из 6</div>
          <div style="display:flex;gap:4px;">
            ${[1,1,1,0,0,0].map(f=>f
              ?`<div style="width:9px;height:9px;border-radius:5px;background:radial-gradient(circle at 32% 26%, oklch(0.96 0.11 84), oklch(0.72 0.15 74));box-shadow:0 0 9px oklch(0.82 0.15 76 / .9);"></div>`
              :`<div style="width:9px;height:9px;border-radius:5px;background:oklch(0.26 0.025 288);box-shadow:inset 0 1px 2px rgba(0,0,0,.7);"></div>`).join('')}
          </div>
        </div>
        <div style="height:48px;border-radius:13px;background:linear-gradient(oklch(0.88 0.15 80), oklch(0.74 0.17 64));color:oklch(0.17 0.04 60);display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;letter-spacing:.1em;box-shadow:inset 0 1.5px 0 rgba(255,244,214,.65), 0 4px 14px rgba(0,0,0,.5), 0 0 30px oklch(0.80 0.16 72 / .35);">ГОТОВО</div>
      </div>
    </div>

  </div>

  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;pointer-events:none;" aria-hidden="true">
    <defs><filter id="r-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="17"/><feColorMatrix type="saturate" values="0"/></filter></defs>
    <rect width="375" height="812" filter="url(#r-grain)"/>
  </svg>
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 96% 56% at 50% 26%, transparent 44%, rgba(4,3,8,.62) 100%);"></div>

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
writeFileSync('Rift.dc.html', html);

/* проверка геометрии: подпись не должна пересекаться с первой карточкой */
const capBottom = 14 + 15 + 80 + 3 + 19;
console.log(`низ подписи ≈ ${capBottom}px, верх карточки Огня = ${TOP}px, зазор ${TOP-capBottom}px`);
console.log(`низ последней карточки = ${TOP+4*PITCH+CARD_H}px, высота поля = ${H}px`);
console.log('Rift.dc.html:', html.length, 'байт');
