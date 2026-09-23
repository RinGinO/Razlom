import { writeFileSync } from 'node:fs';

/* ── общие рисованные иконки стихий ───────────────────────── */
const icon = (id, c, c2) => ({
  fire:`<path d="M20 3c5 6.5 11.5 10.5 11.5 17.5a11.5 11.5 0 1 1-23 0C8.5 13.5 15 9.5 20 3z" fill="${c}"/><path d="M20 20.5c2.2 3 5 4.2 5 7.2a5 5 0 0 1-10 0c0-3 2.8-4.2 5-7.2z" fill="${c2}"/>`,
  water:`<g stroke="${c}" stroke-width="3.6" stroke-linecap="round" fill="none"><path d="M6 14.5c4.6-5 9.3-5 14 0s9.4 5 14 0"/><path d="M6 23c4.6-5 9.3-5 14 0s9.4 5 14 0"/><path d="M6 31.5c4.6-5 9.3-5 14 0s9.4 5 14 0"/></g>`,
  earth:`<path d="M3 33.5L15.5 11l6.5 11.5L26.5 15 37 33.5z" fill="${c}"/><path d="M15.5 11l3.6 6.4-3.6 2.2-3.2-2z" fill="${c2}"/>`,
  air:`<g stroke="${c}" stroke-width="3.6" stroke-linecap="round" fill="none"><path d="M5 13.5h17.5a5.2 5.2 0 1 0-5.2-5.2"/><path d="M5 22h22a5.6 5.6 0 1 1-5.6 5.6"/><path d="M5 30.5h12"/></g>`,
  void:`<circle cx="20" cy="20" r="14.5" stroke="${c}" stroke-width="3.2" fill="none"/><circle cx="20" cy="20" r="7.5" stroke="${c}" stroke-width="3.2" fill="none"/><circle cx="20" cy="20" r="3" fill="${c2}"/>`,
}[id]);
const svg = (id,c,c2,s) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true">${icon(id,c,c2)}</svg>`;

const N = [
  {id:'fire',  name:'Огонь',   v:3, emp:false, sel:false},
  {id:'water', name:'Вода',    v:0, emp:true,  sel:false},
  {id:'earth', name:'Земля',   v:4, emp:false, sel:true },
  {id:'air',   name:'Воздух',  v:0, emp:false, sel:false},
  {id:'void',  name:'Пустота', v:0, emp:false, sel:false},
];

const page = (font, body, bg) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${font}">
  <style>
    body { margin: 0; }
    a { color: oklch(0.60 0.16 40); }
    a:hover { color: oklch(0.50 0.16 40); }
  </style>
</helmet>
${body}
</x-dc>
<script data-dc-script data-props='{}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;

/* ══ З · РИСОВАННЫЙ МИР ═══════════════════════════════════ */
{
const INK='oklch(0.30 0.05 50)', CREAM='oklch(0.985 0.016 85)';
const COL={fire:['oklch(0.60 0.19 32)','oklch(0.78 0.16 60)'],water:['oklch(0.56 0.14 245)','oklch(0.75 0.11 235)'],
           earth:['oklch(0.55 0.14 150)','oklch(0.78 0.12 130)'],air:['oklch(0.62 0.03 240)','oklch(0.88 0.02 240)'],
           void:['oklch(0.50 0.18 305)','oklch(0.72 0.15 310)']};
const tilt=[-1.4,0.9,-0.5,1.2,-1.0];
let cards='';
N.forEach((n,i)=>{
  const [c,c2]=COL[n.id];
  cards+=`<div style="width:164px;height:326px;box-sizing:border-box;padding:14px 12px 12px 12px;border-radius:16px;background:${CREAM};border:${n.sel?'3px solid oklch(0.58 0.19 40)':'2.5px solid '+INK};transform:rotate(${tilt[i]}deg);box-shadow:${n.sel?'0 5px 0 oklch(0.58 0.19 40 / 0.45)':'0 4px 0 '+INK+' / 0.30'};display:flex;flex-direction:column;align-items:center;gap:9px;">
    <div style="position:relative;width:96px;height:96px;border-radius:50px;background:${c2};border:2.5px solid ${INK};display:flex;align-items:center;justify-content:center;">
      ${svg(n.id,c,CREAM,54)}
      ${n.emp?`<div style="position:absolute;right:-10px;top:-6px;transform:rotate(9deg);background:oklch(0.84 0.16 88);border:2.5px solid ${INK};border-radius:9px;padding:1px 7px;font-size:13px;font-weight:700;color:${INK};">×2</div>`:''}
    </div>
    <div style="font-family:Podkova,Georgia,serif;font-size:21px;font-weight:700;color:${INK};">${n.name}</div>
    <div style="display:flex;align-items:baseline;gap:5px;">
      <div style="font-family:Podkova,Georgia,serif;font-size:44px;font-weight:800;line-height:1;color:${n.v?INK:'oklch(0.75 0.03 70)'};">${n.v}</div>
      <div style="font-size:12px;color:oklch(0.55 0.04 55);">маны</div>
    </div>
    <div style="flex-grow:1;"></div>
    <div style="display:flex;gap:9px;">
      <button style="width:54px;height:52px;border-radius:12px;border:2.5px solid ${INK};background:oklch(0.92 0.025 82);color:${INK};font-size:25px;font-family:Rubik,system-ui,sans-serif;line-height:1;box-shadow:0 3px 0 ${INK};">−</button>
      <button style="width:54px;height:52px;border-radius:12px;border:2.5px solid ${INK};background:oklch(0.66 0.18 42);color:oklch(0.99 0.01 85);font-size:25px;font-family:Rubik,system-ui,sans-serif;line-height:1;box-shadow:0 3px 0 ${INK};">+</button>
    </div>
  </div>`;
});
const gems=N.map((n,i)=>{const[c,c2]=COL[n.id];const val=[2,1,3,0,1][i];
  return `<div style="display:flex;align-items:center;gap:4px;"><div style="width:22px;height:22px;border-radius:12px;background:${c};border:2px solid ${INK};"></div><div style="font-size:16px;font-weight:600;color:${val?INK:'oklch(0.70 0.03 70)'};">${val}</div></div>`}).join('');
const faces=[1,1,1,0,0,0].map((r,i)=>`<div style="width:36px;height:36px;border-radius:19px;border:2.5px solid ${INK};background:${r?'oklch(0.72 0.15 145)':'oklch(0.90 0.02 80)'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:${INK};">${['И','П','А','Л','М','Т'][i]}</div>`).join('');

const body=`<div style="width:940px;height:680px;box-sizing:border-box;position:relative;overflow:hidden;font-family:Rubik,system-ui,sans-serif;color:${INK};background-color:oklch(0.935 0.032 80);background-image:radial-gradient(oklch(0.88 0.04 74 / 0.5) 0.7px, transparent 0.7px);background-size:8px 8px;display:flex;flex-direction:column;">

  <div style="display:flex;align-items:center;gap:18px;padding:16px 24px 10px 24px;">
    <div style="font-family:Podkova,Georgia,serif;font-size:26px;font-weight:800;letter-spacing:0.06em;">РАЗЛОМ</div>
    <div style="font-size:13px;color:oklch(0.50 0.04 55);">Эпоха II «Разлом» · раунд 9 из 18</div>
    <div style="flex-grow:1;"></div>
    <div style="display:flex;align-items:center;gap:12px;transform:rotate(-1.2deg);background:oklch(0.99 0.02 88);border:3px solid oklch(0.52 0.20 32);border-radius:16px;padding:7px 20px 7px 16px;box-shadow:0 4px 0 oklch(0.52 0.20 32 / 0.4);">
      <div style="text-align:right;line-height:1.15;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;color:oklch(0.52 0.20 32);">ПОРОГ</div>
        <div style="font-size:11px;color:oklch(0.52 0.04 55);">выше — схлопнется</div>
      </div>
      <div style="font-family:Podkova,Georgia,serif;font-size:54px;font-weight:800;line-height:1;color:oklch(0.48 0.21 32);">7</div>
    </div>
  </div>

  <div style="display:flex;justify-content:center;gap:14px;padding:6px 24px 0 24px;">${cards}</div>

  <div style="flex-grow:1;"></div>

  <div style="display:flex;align-items:center;gap:16px;padding:12px 24px 18px 24px;">
    <div style="display:flex;flex-direction:column;gap:7px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.52 0.04 55);">Ваша эссенция</div>
      <div style="display:flex;align-items:center;gap:11px;">${gems}
        <div style="width:2px;height:24px;background:oklch(0.82 0.03 75);margin:0 3px;"></div>
        <div style="font-size:13px;font-weight:600;color:oklch(0.48 0.16 305);">Скверна 1</div>
        <div style="font-size:13px;font-weight:600;color:oklch(0.48 0.04 55);">Чары 2</div>
      </div>
    </div>
    <div style="flex-grow:1;"></div>
    <div style="display:flex;flex-direction:column;gap:7px;align-items:flex-end;">
      <div style="display:flex;align-items:center;gap:9px;"><div style="font-size:12px;color:oklch(0.50 0.04 55);">готовы 3 из 6</div><div style="display:flex;gap:6px;">${faces}</div></div>
      <div style="display:flex;align-items:center;gap:12px;">
        <button style="height:56px;padding:0 18px;border-radius:14px;border:2.5px dashed oklch(0.55 0.15 305);background:oklch(0.94 0.03 308);color:oklch(0.44 0.17 305);font-size:13px;font-weight:600;font-family:Rubik,system-ui,sans-serif;">Черпнуть из бездны<br>+2 маны за 1 Скверну</button>
        <div style="text-align:right;line-height:1.1;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.52 0.04 55);">Мана</div>
          <div style="font-family:Podkova,Georgia,serif;font-size:38px;font-weight:800;line-height:1;">1<span style="font-size:16px;font-weight:600;color:oklch(0.55 0.04 55);"> / 8</span></div>
        </div>
        <button style="height:64px;padding:0 40px;border-radius:16px;border:3px solid ${INK};background:oklch(0.66 0.18 42);color:oklch(0.99 0.01 85);font-size:22px;font-weight:600;letter-spacing:0.05em;font-family:Podkova,Georgia,serif;box-shadow:0 5px 0 ${INK};">Готово</button>
      </div>
    </div>
  </div>

</div>`;
writeFileSync('Hand.dc.html', page('https://fonts.googleapis.com/css2?family=Podkova:wght@600;700;800&family=Rubik:wght@400;500;600;700&display=swap', body));
}

/* ══ И · ТОЛСТЫЕ КАРТЫ ════════════════════════════════════ */
{
const INK='oklch(0.15 0.04 292)', CARD='oklch(0.975 0.018 90)';
const COL={fire:['oklch(0.63 0.23 30)','oklch(0.82 0.17 62)'],water:['oklch(0.60 0.19 250)','oklch(0.80 0.13 235)'],
           earth:['oklch(0.64 0.19 150)','oklch(0.84 0.15 135)'],air:['oklch(0.66 0.03 240)','oklch(0.92 0.02 240)'],
           void:['oklch(0.56 0.24 305)','oklch(0.76 0.18 310)']};
const tilt=[-2.5,1.6,0,-1.6,2.5], lift=[10,2,-6,2,10];
let cards='';
N.forEach((n,i)=>{
  const [c,c2]=COL[n.id];
  cards+=`<div style="width:166px;height:300px;box-sizing:border-box;border-radius:14px;background:${CARD};border:4px solid ${INK};transform:rotate(${tilt[i]}deg) translateY(${lift[i]}px);box-shadow:0 8px 0 ${INK}${n.sel?', 0 0 0 5px oklch(0.82 0.19 88)':''};display:flex;flex-direction:column;overflow:hidden;">
    <div style="height:74px;background:${c};border-bottom:4px solid ${INK};display:flex;align-items:center;justify-content:center;position:relative;">
      ${svg(n.id,CARD,c2,46)}
      ${n.emp?`<div style="position:absolute;top:6px;right:7px;background:oklch(0.86 0.19 90);border:3px solid ${INK};border-radius:8px;padding:0 7px;font-size:15px;font-weight:700;color:${INK};line-height:1.35;">×2</div>`:''}
    </div>
    <div style="flex-grow:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${INK};">${n.name}</div>
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:52px;font-weight:800;line-height:1.1;color:${n.v?INK:'oklch(0.80 0.02 90)'};">${n.v}</div>
    </div>
    <div style="display:flex;border-top:4px solid ${INK};">
      <button style="flex:1;height:56px;border:none;border-right:4px solid ${INK};background:oklch(0.90 0.02 90);color:${INK};font-size:28px;font-family:Unbounded,system-ui,sans-serif;line-height:1;">−</button>
      <button style="flex:1;height:56px;border:none;background:oklch(0.82 0.19 88);color:${INK};font-size:28px;font-family:Unbounded,system-ui,sans-serif;line-height:1;">+</button>
    </div>
  </div>`;
});
const chips=N.map((n,i)=>{const[c]=COL[n.id];const val=[2,1,3,0,1][i];
  return `<div style="display:flex;align-items:center;gap:5px;"><div style="width:24px;height:24px;border-radius:13px;background:${c};border:3px solid ${INK};"></div><div style="font-family:Unbounded,system-ui,sans-serif;font-size:16px;font-weight:700;color:${val?'oklch(0.97 0.01 90)':'oklch(0.50 0.05 292)'};">${val}</div></div>`}).join('');

const body=`<div style="width:940px;height:680px;box-sizing:border-box;position:relative;overflow:hidden;font-family:Rubik,system-ui,sans-serif;background:oklch(0.22 0.07 293);display:flex;flex-direction:column;">
  <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(115deg, oklch(0.26 0.08 295 / 0.55) 0 26px, transparent 26px 52px);"></div>

  <div style="position:relative;display:flex;align-items:flex-start;gap:22px;padding:20px 26px 0 26px;">
    <div style="display:flex;flex-direction:column;">
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.3em;color:oklch(0.82 0.19 88);">ПОРОГ</div>
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:96px;font-weight:800;line-height:0.92;color:oklch(0.98 0.02 90);text-shadow:0 6px 0 oklch(0.15 0.04 292);">7</div>
      <div style="font-size:13px;color:oklch(0.72 0.06 292);margin-top:2px;">сумма выше — узел схлопнется</div>
    </div>
    <div style="flex-grow:1;"></div>
    <div style="text-align:right;padding-top:6px;">
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:17px;font-weight:700;letter-spacing:0.1em;color:oklch(0.97 0.01 90);">РАЗЛОМ</div>
      <div style="font-size:13px;color:oklch(0.72 0.06 292);margin-top:3px;">Эпоха II · раунд 9 / 18</div>
      <div style="display:flex;align-items:center;gap:7px;justify-content:flex-end;margin-top:9px;">
        <div style="font-size:12px;color:oklch(0.70 0.06 292);">готовы 3 из 6</div>
        <div style="display:flex;gap:5px;">${[1,1,1,0,0,0].map(f=>`<div style="width:11px;height:11px;border-radius:6px;border:2.5px solid ${INK};box-sizing:border-box;background:${f?'oklch(0.82 0.19 88)':'oklch(0.42 0.06 292)'};"></div>`).join('')}</div>
      </div>
    </div>
  </div>

  <div style="position:relative;display:flex;justify-content:center;align-items:flex-start;gap:13px;padding:14px 26px 0 26px;">${cards}</div>

  <div style="flex-grow:1;"></div>

  <div style="position:relative;display:flex;align-items:center;gap:18px;padding:0 26px 20px 26px;">
    <div style="display:flex;align-items:center;gap:13px;">${chips}</div>
    <div style="width:3px;height:26px;background:oklch(0.36 0.07 292);"></div>
    <div style="font-size:13px;font-weight:600;color:oklch(0.76 0.16 308);">Скверна 1</div>
    <div style="font-size:13px;font-weight:600;color:oklch(0.70 0.06 292);">Чары 2</div>
    <div style="flex-grow:1;"></div>
    <button style="height:54px;padding:0 16px;border-radius:11px;border:3px solid oklch(0.60 0.18 308);background:oklch(0.30 0.09 302);color:oklch(0.84 0.15 308);font-size:12.5px;font-weight:600;font-family:Rubik,system-ui,sans-serif;line-height:1.3;">Черпнуть из бездны<br>+2 маны за 1 Скверну</button>
    <div style="text-align:right;line-height:1;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;color:oklch(0.70 0.06 292);">МАНА</div>
      <div style="font-family:Unbounded,system-ui,sans-serif;font-size:36px;font-weight:800;color:oklch(0.98 0.02 90);margin-top:4px;">1<span style="font-size:16px;color:oklch(0.68 0.06 292);"> / 8</span></div>
    </div>
    <button style="height:64px;padding:0 44px;border-radius:13px;border:4px solid ${INK};background:oklch(0.82 0.19 88);color:${INK};font-family:Unbounded,system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:0.04em;box-shadow:0 7px 0 ${INK};">ГОТОВО</button>
  </div>

</div>`;
writeFileSync('Chunky.dc.html', page('https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800&family=Rubik:wght@400;500;600;700&display=swap', body));
}

/* ══ К · СЦЕНА У РАЗЛОМА ══════════════════════════════════ */
{
const COL={fire:['oklch(0.70 0.20 32)','oklch(0.88 0.14 70)'],water:['oklch(0.70 0.15 245)','oklch(0.88 0.09 230)'],
           earth:['oklch(0.74 0.16 150)','oklch(0.90 0.11 140)'],air:['oklch(0.92 0.02 240)','oklch(0.98 0.01 240)'],
           void:['oklch(0.64 0.21 305)','oklch(0.84 0.15 308)']};
const P=[{x:52,y:286,s:0.74},{x:214,y:366,s:0.88},{x:395,y:404,s:1.0},{x:606,y:366,s:0.88},{x:772,y:286,s:0.74}];
let altars='';
N.forEach((n,i)=>{
  const [c,c2]=COL[n.id]; const p=P[i];
  altars+=`<div style="position:absolute;left:${p.x}px;top:${p.y}px;transform:scale(${p.s});transform-origin:center bottom;opacity:${0.62+0.38*p.s};">
    <div style="width:150px;display:flex;flex-direction:column;align-items:center;gap:8px;">
      <div style="position:relative;width:104px;height:104px;border-radius:54px;background:radial-gradient(circle at 50% 42%, ${c} 0%, oklch(0.20 0.04 288) 74%);border:2px solid ${c};box-shadow:0 0 46px ${c}, inset 0 0 26px ${c2};display:flex;align-items:center;justify-content:center;">
        ${svg(n.id,c2,'oklch(0.99 0.01 90)',52)}
        ${n.emp?`<div style="position:absolute;top:-4px;right:-8px;background:oklch(0.86 0.15 82);border-radius:9px;padding:1px 8px;font-size:13px;font-weight:700;color:oklch(0.20 0.05 60);">×2</div>`:''}
      </div>
      <div style="width:132px;height:15px;border-radius:50%;background:radial-gradient(ellipse, ${c} 0%, transparent 70%);opacity:0.55;margin-top:-6px;"></div>
      <div style="font-family:'Yeseva One',Georgia,serif;font-size:19px;color:oklch(0.95 0.01 285);letter-spacing:0.04em;">${n.name}</div>
      <div style="display:flex;align-items:baseline;gap:5px;">
        <div style="font-family:'Yeseva One',Georgia,serif;font-size:${n.sel?42:34}px;line-height:1;color:${n.v?c2:'oklch(0.42 0.02 288)'};text-shadow:${n.v?`0 0 20px ${c}`:'none'};">${n.v}</div>
        <div style="font-size:12px;color:oklch(0.58 0.02 288);">маны</div>
      </div>
      ${n.sel?`<div style="display:flex;gap:8px;margin-top:2px;">
        <button style="width:50px;height:48px;border-radius:25px;border:1.5px solid oklch(0.42 0.03 288);background:oklch(0.24 0.03 288);color:oklch(0.90 0.01 288);font-size:24px;font-family:Manrope,system-ui,sans-serif;line-height:1;">−</button>
        <button style="width:50px;height:48px;border-radius:25px;border:1.5px solid ${c};background:oklch(0.32 0.09 150);color:${c2};font-size:24px;font-family:Manrope,system-ui,sans-serif;line-height:1;">+</button>
      </div>`:''}
    </div>
  </div>`;
});
const gems=N.map((n,i)=>{const[c,c2]=COL[n.id];const val=[2,1,3,0,1][i];
  return `<div style="display:flex;align-items:center;gap:5px;"><div style="width:17px;height:17px;border-radius:9px;background:${c};box-shadow:0 0 12px ${c};"></div><div style="font-size:15px;font-weight:600;color:${val?'oklch(0.94 0.01 285)':'oklch(0.45 0.02 288)'};">${val}</div></div>`}).join('');

const body=`<div style="width:940px;height:680px;box-sizing:border-box;position:relative;overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:oklch(0.93 0.01 285);background:radial-gradient(ellipse 60% 46% at 50% 30%, oklch(0.26 0.06 292) 0%, oklch(0.135 0.03 285) 62%, oklch(0.10 0.02 285) 100%);">

  <svg width="940" height="680" viewBox="0 0 940 680" style="position:absolute;inset:0;" aria-hidden="true">
    <path d="M470 -20 L446 66 L492 132 L440 214 L486 286 L452 344 L470 392 L488 344 L456 286 L502 214 L450 132 L494 66 Z" fill="oklch(0.16 0.05 296)"/>
    <path d="M470 -14 L452 66 L490 130 L446 212 L488 284 L458 342 L470 386" stroke="oklch(0.86 0.16 76)" stroke-width="3.2" stroke-linecap="round" fill="none" opacity="0.92"/>
    <path d="M470 -14 L452 66 L490 130 L446 212 L488 284 L458 342 L470 386" stroke="oklch(0.78 0.17 66)" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.28"/>
    <ellipse cx="470" cy="392" rx="200" ry="30" fill="oklch(0.72 0.16 70)" opacity="0.14"/>
  </svg>

  <div style="position:absolute;left:0;right:0;top:20px;display:flex;justify-content:space-between;align-items:flex-start;padding:0 28px;">
    <div>
      <div style="font-family:'Yeseva One',Georgia,serif;font-size:20px;letter-spacing:0.18em;color:oklch(0.90 0.06 80);">РАЗЛОМ</div>
      <div style="font-size:12px;color:oklch(0.60 0.02 288);margin-top:3px;">Эпоха II · раунд 9 из 18</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="font-size:12px;color:oklch(0.60 0.02 288);">готовы 3 из 6</div>
      <div style="display:flex;gap:5px;">${[1,1,1,0,0,0].map(f=>`<div style="width:9px;height:9px;border-radius:5px;background:${f?'oklch(0.80 0.15 78)':'oklch(0.30 0.02 288)'};"></div>`).join('')}</div>
    </div>
  </div>

  <div style="position:absolute;left:50%;top:120px;transform:translateX(-50%);text-align:center;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.32em;color:oklch(0.78 0.12 78);">ПОРОГ</div>
    <div style="font-family:'Yeseva One',Georgia,serif;font-size:104px;line-height:1;color:oklch(0.98 0.05 84);text-shadow:0 0 60px oklch(0.80 0.18 68), 0 0 18px oklch(0.90 0.14 76);">7</div>
    <div style="font-size:12px;color:oklch(0.60 0.03 288);margin-top:2px;">сумма выше — узел схлопнется</div>
  </div>

  ${altars}

  <div style="position:absolute;left:0;right:0;bottom:0;height:86px;display:flex;align-items:center;gap:18px;padding:0 28px;background:linear-gradient(oklch(0.10 0.02 285 / 0), oklch(0.10 0.02 285 / 0.92) 42%);">
    <div style="display:flex;align-items:center;gap:12px;">${gems}</div>
    <div style="width:1px;height:26px;background:oklch(0.32 0.02 288);"></div>
    <div style="font-size:12.5px;font-weight:600;color:oklch(0.74 0.14 308);">Скверна 1</div>
    <div style="font-size:12.5px;font-weight:600;color:oklch(0.62 0.02 288);">Чары 2</div>
    <div style="flex-grow:1;"></div>
    <button style="height:46px;padding:0 15px;border-radius:23px;border:1px dashed oklch(0.46 0.12 305);background:oklch(0.20 0.04 300);color:oklch(0.78 0.13 305);font-size:12px;font-family:Manrope,system-ui,sans-serif;">Черпнуть из бездны · +2 маны за 1 Скверну</button>
    <div style="text-align:right;line-height:1;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.18em;color:oklch(0.58 0.02 288);">МАНА</div>
      <div style="font-family:'Yeseva One',Georgia,serif;font-size:32px;color:oklch(0.96 0.04 84);margin-top:4px;">1<span style="font-size:15px;color:oklch(0.58 0.02 288);"> / 8</span></div>
    </div>
    <button style="height:52px;padding:0 38px;border-radius:26px;border:none;background:linear-gradient(oklch(0.86 0.16 80), oklch(0.74 0.17 62));color:oklch(0.18 0.04 60);font-size:17px;font-weight:800;letter-spacing:0.05em;font-family:Manrope,system-ui,sans-serif;box-shadow:0 0 34px oklch(0.78 0.16 70 / 0.55);">ГОТОВО</button>
  </div>

</div>`;
writeFileSync('Scene.dc.html', page('https://fonts.googleapis.com/css2?family=Yeseva+One&family=Manrope:wght@400;600;800&display=swap', body));
}

console.log('готово: Hand.dc.html, Chunky.dc.html, Scene.dc.html');
