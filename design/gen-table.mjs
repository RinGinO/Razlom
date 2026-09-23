import { writeFileSync } from 'node:fs';

const INK='oklch(0.16 0.005 150)', FIELD='oklch(0.90 0.05 145)', CELL='oklch(0.955 0.03 128)';
const EP={1:'oklch(0.78 0.09 230)',2:'oklch(0.70 0.16 60)',3:'oklch(0.54 0.22 28)'};
const MK='oklch(0.50 0.17 315)';
const EPNAME={1:'Трещина',2:'Разлом',3:'Коллапс'};

const rounds=[
 {n:1,e:1,th:15,ov:false},{n:2,e:1,th:14,ov:false},{n:3,e:1,th:16,ov:false},
 {n:4,e:1,th:15,ov:false},{n:5,e:1,th:13,ov:true},{n:6,e:1,th:15,ov:false},
 {n:7,e:2,th:8,ov:false},{n:8,e:2,th:6,ov:true},{n:9,e:2,th:7,ov:false},
 {n:10,e:2,th:null,ov:false},{n:11,e:2,th:null,ov:false},{n:12,e:2,th:null,ov:false},
 {n:13,e:3,th:null,ov:false},{n:14,e:3,th:null,ov:false},{n:15,e:3,th:null,ov:false},
 {n:16,e:3,th:null,ov:false},{n:17,e:3,th:null,ov:false},{n:18,e:3,th:null,ov:false},
];
const NOW=9;
const market=[{c:'Сговор',p:5},{c:'Око',p:6},{c:'Тигель',p:6},{c:'Глубина',p:6},{c:'Печать',p:7},{c:'Зеркало',p:7}];

const burst=(col)=>`<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0.6l1.7 4.2 4.3-1.6-2.5 3.8 3.9 2.3-4.5.5 1 4.4-3.3-3.1-3.1 3.3.7-4.5-4.5-.8 3.8-2.5-2.7-3.7 4.4 1.4z" fill="${col}"/></svg>`;
const pawn=`<svg width="17" height="19" viewBox="0 0 18 20" aria-hidden="true"><ellipse cx="9" cy="17.6" rx="6.6" ry="2" fill="${INK}"/><path d="M9 1.6a3.2 3.2 0 0 1 2.2 5.5c1.7 1.4 2.7 4 2.9 9.1H3.9c.2-5.1 1.2-7.7 2.9-9.1A3.2 3.2 0 0 1 9 1.6z" fill="${INK}"/></svg>`;

function roundCell(r){
  const past=r.n<NOW, now=r.n===NOW;
  const bg = now ? 'oklch(0.985 0.045 95)' : CELL;
  let body;
  if(now) body=`<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">${pawn}<div style="font-size:9px;font-weight:600;letter-spacing:0.08em;color:${INK};">СЕЙЧАС</div></div>`;
  else if(past) body=`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="font-size:10px;color:oklch(0.45 0.02 150);">порог ${r.th}</div>${r.ov?burst('oklch(0.52 0.22 28)'):`<div style="font-size:10px;color:oklch(0.55 0.02 150);">чисто</div>`}</div>`;
  else body=`<div style="font-size:10px;color:oklch(0.66 0.02 150);">—</div>`;
  return `<div style="height:16px;background:${EP[r.e]};border-bottom:2px solid ${INK};flex-shrink:0;"></div>
      <div style="flex-grow:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:3px;">
        <div style="font-size:19px;font-weight:600;line-height:1;color:${INK};">${r.n}</div>
        ${body}
      </div>`;
}
function marketCell(m){
  return `<div style="height:16px;background:${MK};border-bottom:2px solid ${INK};flex-shrink:0;"></div>
      <div style="flex-grow:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:3px;">
        <div style="font-size:13px;font-weight:600;letter-spacing:0.02em;color:${INK};text-align:center;">${m.c}</div>
        <div style="display:flex;align-items:center;gap:3px;"><div style="width:9px;height:9px;border-radius:5px;background:${INK};"></div><div style="font-size:13px;font-weight:600;color:${INK};">${m.p}</div></div>
      </div>`;
}
function cell(x,y,w,h,rot,inner,bg){
  const iw = rot===0||rot===180 ? w : h, ih = rot===0||rot===180 ? h : w;
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;border:2px solid ${INK};background:${bg||CELL};overflow:hidden;">
    <div style="position:absolute;left:50%;top:50%;width:${iw-4}px;height:${ih-4}px;transform:translate(-50%,-50%) rotate(${rot}deg);display:flex;flex-direction:column;">${inner}</div>
  </div>`;
}
function corner(x,y,title,sub,accent){
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:108px;height:108px;box-sizing:border-box;border:2px solid ${INK};background:${CELL};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:7px;text-align:center;">
    <div style="width:34px;height:5px;background:${accent};"></div>
    <div style="font-size:12px;font-weight:600;line-height:1.15;letter-spacing:0.03em;color:${INK};">${title}</div>
    <div style="font-size:9.5px;line-height:1.25;color:oklch(0.44 0.02 150);">${sub}</div>
  </div>`;
}

let cells='';
cells+=corner(0,0,'НАЧАЛО','драфт архимагов<br>8 маны каждому','oklch(0.45 0.02 150)');
cells+=corner(672,0,'СХОЖДЕНИЕ I','+2 ПО за каждое<br>большинство',EP[1]);
cells+=corner(672,672,'СХОЖДЕНИЕ II','+3 ПО за каждое<br>большинство',EP[2]);
cells+=corner(0,672,'СХОЖДЕНИЕ III','+5 ПО, затем<br>финальный подсчёт',EP[3]);
for(let i=0;i<6;i++){const r=rounds[i];cells+=cell(108+i*94,0,94,108,180,roundCell(r),r.n===NOW?'oklch(0.985 0.045 95)':CELL);}
for(let i=0;i<6;i++){const r=rounds[6+i];cells+=cell(672,108+i*94,108,94,-90,roundCell(r),r.n===NOW?'oklch(0.985 0.045 95)':CELL);}
for(let i=0;i<6;i++){const r=rounds[12+i];cells+=cell(672-94-i*94,672,94,108,0,roundCell(r),r.n===NOW?'oklch(0.985 0.045 95)':CELL);}
for(let i=0;i<6;i++){cells+=cell(0,672-94-i*94,108,94,90,marketCell(market[i]),CELL);}

const nodes=[
 {name:'Огонь',col:'oklch(0.56 0.20 28)',v:3,dx:0,dy:-190,sel:false,emp:false},
 {name:'Вода',col:'oklch(0.52 0.16 250)',v:0,dx:180.7,dy:-58.7,sel:false,emp:true},
 {name:'Земля',col:'oklch(0.54 0.15 150)',v:4,dx:111.7,dy:153.7,sel:true,emp:false},
 {name:'Воздух',col:'oklch(0.87 0.01 250)',v:0,dx:-111.7,dy:153.7,sel:false,emp:false},
 {name:'Пустота',col:'oklch(0.48 0.19 305)',v:0,dx:-180.7,dy:-58.7,sel:false,emp:false},
];
let nodeHtml='';
for(const n of nodes){
  const L=Math.round(282+n.dx-75), T=Math.round(282+n.dy-56);
  nodeHtml+=`<div style="position:absolute;left:${L}px;top:${T}px;width:150px;height:112px;box-sizing:border-box;border:${n.sel?'3.5px solid oklch(0.52 0.20 45)':'2.5px solid '+INK};background:${n.sel?'oklch(0.99 0.03 92)':CELL};display:flex;flex-direction:column;overflow:hidden;box-shadow:0 2px 0 ${n.sel?'oklch(0.52 0.20 45 / 0.5)':INK+' / 0.35'};">
    <div style="height:20px;background:${n.col};border-bottom:2px solid ${INK};display:flex;align-items:center;justify-content:flex-end;padding-right:5px;">${n.emp?`<div style="font-size:10px;font-weight:600;background:oklch(0.86 0.16 92);color:${INK};padding:0 5px;border-radius:2px;line-height:1.5;">×2</div>`:''}</div>
    <div style="flex-grow:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
      <div style="font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${INK};">${n.name}</div>
      <div style="font-size:34px;font-weight:600;line-height:1;color:${n.v?INK:'oklch(0.72 0.02 140)'};">${n.v}</div>
      <div style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:oklch(0.55 0.02 150);">маны</div>
    </div>
  </div>`;
}

const rail=`
  <div style="position:absolute;left:820px;top:10px;width:320px;height:780px;display:flex;flex-direction:column;gap:10px;">

    <div style="border:2px solid ${INK};background:${CELL};padding:9px 12px;display:flex;align-items:center;gap:10px;">
      <div style="width:38px;height:38px;border:2px solid ${INK};border-radius:20px;background:oklch(0.70 0.15 152);flex-shrink:0;"></div>
      <div style="display:flex;flex-direction:column;gap:1px;">
        <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.48 0.02 150);">Ваш архимаг</div>
        <div style="font-size:15px;font-weight:600;color:${INK};">Хранитель</div>
        <div style="font-size:10px;color:oklch(0.45 0.02 150);">при перегрузке не берёт Скверну</div>
      </div>
    </div>

    <div style="border:2.5px solid oklch(0.52 0.20 45);background:oklch(0.99 0.03 92);padding:10px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 2px 0 oklch(0.52 0.20 45 / 0.45);">
      <div style="display:flex;flex-direction:column;gap:2px;flex-grow:1;">
        <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.48 0.02 150);">Ставите на</div>
        <div style="display:flex;align-items:center;gap:7px;">
          <div style="width:13px;height:13px;border:1.5px solid ${INK};background:oklch(0.54 0.15 150);box-sizing:border-box;"></div>
          <div style="font-size:18px;font-weight:600;color:${INK};">Земля</div>
        </div>
      </div>
      <button style="width:48px;height:48px;border:2.5px solid ${INK};background:oklch(0.88 0.03 128);color:${INK};font-size:24px;font-family:Jost,system-ui,sans-serif;line-height:1;box-shadow:0 2.5px 0 ${INK};">−</button>
      <div style="font-size:30px;font-weight:600;min-width:26px;text-align:center;line-height:1;color:${INK};">4</div>
      <button style="width:48px;height:48px;border:2.5px solid ${INK};background:oklch(0.62 0.19 45);color:oklch(0.99 0.01 90);font-size:24px;font-family:Jost,system-ui,sans-serif;line-height:1;box-shadow:0 2.5px 0 ${INK};">+</button>
    </div>

    <div style="border:2px solid ${INK};background:${CELL};padding:9px 12px;display:flex;align-items:center;gap:12px;">
      <div style="display:flex;flex-direction:column;gap:1px;">
        <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.48 0.02 150);">Мана</div>
        <div style="display:flex;align-items:baseline;gap:4px;"><div style="font-size:32px;font-weight:600;line-height:1;color:${INK};">1</div><div style="font-size:13px;color:oklch(0.50 0.02 150);">/ 8</div></div>
      </div>
      <div style="width:2px;height:38px;background:oklch(0.80 0.02 140);"></div>
      <div style="display:flex;flex-direction:column;gap:3px;flex-grow:1;">
        <div style="font-size:11px;color:oklch(0.42 0.02 150);">выложено 7 из 8</div>
        <div style="height:7px;border:1.5px solid ${INK};box-sizing:border-box;background:oklch(0.88 0.03 128);"><div style="width:87%;height:100%;background:oklch(0.62 0.19 45);"></div></div>
      </div>
    </div>

    <div style="border:2px solid ${INK};background:${CELL};padding:9px 12px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.48 0.02 150);">Ваша эссенция</div>
      <div style="display:flex;align-items:center;gap:5px;">
        <div style="width:17px;height:17px;border:1.5px solid ${INK};background:oklch(0.56 0.20 28);box-sizing:border-box;"></div><div style="font-size:14px;font-weight:600;color:${INK};">2</div>
        <div style="width:17px;height:17px;border:1.5px solid ${INK};background:oklch(0.52 0.16 250);box-sizing:border-box;margin-left:5px;"></div><div style="font-size:14px;font-weight:600;color:${INK};">1</div>
        <div style="width:17px;height:17px;border:1.5px solid ${INK};background:oklch(0.54 0.15 150);box-sizing:border-box;margin-left:5px;"></div><div style="font-size:14px;font-weight:600;color:${INK};">3</div>
        <div style="width:17px;height:17px;border:1.5px solid ${INK};background:oklch(0.94 0.01 250);box-sizing:border-box;margin-left:5px;"></div><div style="font-size:14px;font-weight:600;color:oklch(0.66 0.02 150);">0</div>
        <div style="width:17px;height:17px;border:1.5px solid ${INK};background:oklch(0.48 0.19 305);box-sizing:border-box;margin-left:5px;"></div><div style="font-size:14px;font-weight:600;color:${INK};">1</div>
        <div style="flex-grow:1;"></div>
        <div style="font-size:11px;font-weight:600;color:oklch(0.45 0.17 305);">Скверна 1</div>
      </div>
    </div>

    <div style="border:2px solid ${INK};background:${CELL};padding:9px 12px;display:flex;flex-direction:column;gap:6px;flex-grow:1;">
      <div style="display:flex;justify-content:space-between;">
        <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.48 0.02 150);">Соперники</div>
        <div style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:oklch(0.55 0.02 150);">эсс · скв · чар</div>
      </div>
      ${[['Иван','7 · 0 · 3',true],['Пётр','5 · 2 · 1',true],['Аня','9 · 1 · 2',false],['Лена','4 · 0 · 2',false],['Марк','6 · 3 · 4',false]]
        .map(([n,v,rdy])=>`<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1.5px solid oklch(0.85 0.02 140);">
          <div style="width:9px;height:9px;border-radius:5px;background:${rdy?'oklch(0.58 0.17 145)':'oklch(0.86 0.02 140)'};border:1.5px solid ${INK};box-sizing:border-box;"></div>
          <div style="font-size:13px;flex-grow:1;color:${INK};">${n}</div>
          <div style="font-size:12px;color:oklch(0.45 0.02 150);">${v}</div>
        </div>`).join('')}
    </div>

    <button style="height:44px;border:2px dashed oklch(0.52 0.15 305);background:oklch(0.93 0.03 310);color:oklch(0.40 0.17 305);font-size:12.5px;font-weight:600;font-family:Jost,system-ui,sans-serif;">Черпнуть из бездны · +2 маны за 1 Скверну</button>

    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;">
        <div style="font-size:11px;color:oklch(0.45 0.02 150);">готовы 3 из 6</div>
        <div style="display:flex;gap:4px;">${[1,1,1,0,0,0].map(f=>`<div style="width:9px;height:9px;border-radius:5px;border:1.5px solid ${INK};box-sizing:border-box;background:${f?'oklch(0.58 0.17 145)':'oklch(0.92 0.02 140)'};"></div>`).join('')}</div>
      </div>
      <button style="height:56px;border:2.5px solid ${INK};background:oklch(0.62 0.19 45);color:oklch(0.99 0.01 90);font-size:19px;font-weight:600;letter-spacing:0.06em;font-family:Jost,system-ui,sans-serif;box-shadow:0 3px 0 ${INK};">ГОТОВО</button>
    </div>

  </div>`;

const html=`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap">
  <style>
    body { margin: 0; }
    a { color: oklch(0.45 0.18 30); }
    a:hover { color: oklch(0.35 0.18 30); }
  </style>
</helmet>
<div style="width:1160px;height:800px;box-sizing:border-box;position:relative;background:oklch(0.20 0.012 150);font-family:Jost,system-ui,sans-serif;overflow:hidden;">

  <div style="position:absolute;left:20px;top:10px;width:780px;height:780px;box-sizing:border-box;border:3px solid ${INK};background:${FIELD};">
    ${cells}
    <div style="position:absolute;left:108px;top:108px;width:564px;height:564px;">
      <div style="position:absolute;left:14px;top:36px;transform:rotate(-28deg);transform-origin:left top;">
        <div style="background:oklch(0.55 0.21 30);border:2.5px solid ${INK};padding:7px 18px;box-shadow:3px 3px 0 ${INK} ;">
          <div style="font-size:30px;font-weight:700;letter-spacing:0.10em;color:oklch(0.98 0.02 90);line-height:1;">РАЗЛОМ</div>
        </div>
        <div style="font-size:10px;letter-spacing:0.06em;color:oklch(0.38 0.03 145);margin-top:5px;">Эпоха II · тесно · награда 3</div>
      </div>
      ${nodeHtml}
      <div style="position:absolute;left:207px;top:207px;width:150px;height:150px;border-radius:78px;box-sizing:border-box;border:3px solid ${INK};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background-color:oklch(0.20 0.035 300);background-image:linear-gradient(152deg,transparent 45%,oklch(0.60 0.16 62 / 0.8) 47.5%,oklch(0.88 0.15 82) 50%,oklch(0.60 0.16 62 / 0.8) 52.5%,transparent 55%);box-shadow:0 3px 0 ${INK};">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.2em;color:oklch(0.82 0.11 80);">ПОРОГ</div>
        <div style="font-size:60px;font-weight:600;line-height:1;color:oklch(0.97 0.06 84);text-shadow:0 0 18px oklch(0.78 0.16 70);">7</div>
        <div style="font-size:9.5px;color:oklch(0.70 0.05 80);">выше — схлопнется</div>
      </div>
    </div>
  </div>

  ${rail}

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
writeFileSync('Table.dc.html', html);
console.log('Table.dc.html:', html.length, 'байт');
