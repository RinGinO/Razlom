import { writeFileSync } from 'node:fs';

/* Свет один на всю сцену: сверху-слева. azimuth 225 в SVG,
   значит тени в CSS уходят вправо-вниз: смещения +x +y. */
const AZ = 225, EL = 40;

const material = (id, {lc, spec, sc, f1, f2, seed, expo}) => `
  <filter id="${id}" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="${f1}" numOctaves="3" seed="${seed}" result="macro"/>
    <feTurbulence type="fractalNoise" baseFrequency="${f2}" numOctaves="4" seed="${seed + 7}" result="micro"/>
    <feComposite in="macro" in2="micro" operator="arithmetic" k1="0" k2="0.72" k3="0.42" k4="0" result="bump"/>
    <feGaussianBlur in="bump" stdDeviation="0.35" result="soft"/>
    <feDiffuseLighting in="soft" lighting-color="${lc}" surfaceScale="${sc}" result="diff">
      <feDistantLight azimuth="${AZ}" elevation="${EL}"/>
    </feDiffuseLighting>
    <feSpecularLighting in="soft" surfaceScale="${sc}" specularConstant="${spec}" specularExponent="${expo}" lighting-color="#fff3dd" result="sp">
      <feDistantLight azimuth="${AZ}" elevation="${EL}"/>
    </feSpecularLighting>
    <feComposite in="sp" in2="diff" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
  </filter>`;

const DEFS = `
  ${material('m-wall',  {lc:'#6f6559', spec:0.28, sc:5.0, f1:'0.0045 0.0065', f2:'0.055',       seed:3,  expo:9})}
  ${material('m-slab',  {lc:'#8a8072', spec:0.45, sc:3.0, f1:'0.010 0.013',   f2:'0.10',        seed:12, expo:14})}
  ${material('m-bronze',{lc:'#9d7642', spec:1.35, sc:1.5, f1:'0.9 0.010',     f2:'0.55 0.020',  seed:21, expo:34})}
  <filter id="m-grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="42"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>`;

/* гранёный кристалл: несколько плоскостей + блик + каустика на камне */
const gem = (lit, a, b, c) => `
  <div style="position:relative;width:32px;height:46px;flex-shrink:0;">
    ${lit ? `<div style="position:absolute;left:-13px;top:6px;width:58px;height:40px;border-radius:50%;background:radial-gradient(ellipse, ${a} 0%, transparent 68%);opacity:.55;filter:blur(5px);"></div>` : ''}
    <div style="position:absolute;inset:0;clip-path:polygon(50% 0%, 100% 27%, 84% 100%, 16% 100%, 0% 27%);background:${c};"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(50% 0%, 100% 27%, 50% 44%);background:linear-gradient(200deg, ${a}, ${b});"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(50% 0%, 50% 44%, 0% 27%);background:linear-gradient(150deg, ${b}, ${c});"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(0% 27%, 50% 44%, 16% 100%);background:linear-gradient(20deg, ${c}, ${b});"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(50% 44%, 100% 27%, 84% 100%);background:linear-gradient(340deg, ${c}, ${a});opacity:.85;"></div>
    <div style="position:absolute;inset:0;clip-path:polygon(50% 44%, 84% 100%, 16% 100%);background:linear-gradient(0deg, ${b}, ${c});opacity:.9;"></div>
    <div style="position:absolute;left:7px;top:5px;width:7px;height:15px;transform:rotate(16deg);border-radius:60%;background:linear-gradient(rgba(255,255,255,.92), rgba(255,255,255,0));filter:blur(.6px);"></div>
    ${lit ? `<div style="position:absolute;inset:-3px;clip-path:polygon(50% 0%, 100% 27%, 84% 100%, 16% 100%, 0% 27%);box-shadow:0 0 22px 6px ${a};opacity:.5;"></div>` : ''}
  </div>`;

const N = [
  {n:'Огонь',   sub:'красная эссенция',      v:3, lit:1, sel:0, emp:0, g:['oklch(0.86 0.16 42)','oklch(0.62 0.21 30)','oklch(0.34 0.14 26)'], tint:'oklch(0.66 0.21 30)'},
  {n:'Вода',    sub:'синяя эссенция',        v:0, lit:0, sel:0, emp:1, g:['oklch(0.48 0.06 248)','oklch(0.34 0.05 248)','oklch(0.22 0.035 248)'], tint:'oklch(0.60 0.15 248)'},
  {n:'Земля',   sub:'зелёная эссенция',      v:4, lit:1, sel:1, emp:0, g:['oklch(0.90 0.13 156)','oklch(0.64 0.16 150)','oklch(0.36 0.11 148)'], tint:'oklch(0.70 0.16 152)'},
  {n:'Воздух',  sub:'белая эссенция',        v:0, lit:0, sel:0, emp:0, g:['oklch(0.56 0.012 250)','oklch(0.42 0.010 250)','oklch(0.28 0.008 250)'], tint:'oklch(0.80 0.02 250)'},
  {n:'Пустота', sub:'фиолетовая эссенция',   v:0, lit:0, sel:0, emp:0, g:['oklch(0.46 0.09 305)','oklch(0.33 0.07 305)','oklch(0.21 0.05 305)'], tint:'oklch(0.60 0.19 305)'},
];

/* фаска + отброшенная тень вправо-вниз + грязь в углублении */
const RAISED = `inset 1.5px 1.5px 0 rgba(255,236,205,.16), inset -1.5px -1.5px 0 rgba(0,0,0,.55), 5px 6px 12px rgba(0,0,0,.55), 2px 2px 3px rgba(0,0,0,.45)`;
const ENGRAVE = `text-shadow: -1px -1.5px 1.2px rgba(0,0,0,.92), 1px 1.5px 0.6px rgba(255,232,190,.24);`;

const btn = (plus, dim) => `
  <div style="position:relative;width:44px;height:44px;border-radius:22px;overflow:hidden;${dim?'opacity:.4;':''}
       box-shadow: inset 1.5px 1.5px 0 rgba(255,228,180,${plus?'.55':'.40'}), inset -2px -2px 4px rgba(0,0,0,.6), 4px 5px 9px rgba(0,0,0,.55)${plus?', 0 0 16px oklch(0.78 0.15 70 / .45)':''};">
    <svg width="44" height="44" viewBox="0 0 44 44" style="position:absolute;inset:0;" aria-hidden="true"><rect width="44" height="44" filter="url(#m-bronze)"/></svg>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 30% 24%, rgba(255,236,196,${plus?'.55':'.34'}), transparent 62%), radial-gradient(ellipse 90% 80% at 72% 82%, rgba(24,14,6,.55), transparent 60%);"></div>
    <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-family:Spectral,Georgia,serif;font-size:21px;color:oklch(0.26 0.05 58);text-shadow:0 1.5px 0 rgba(255,236,190,.5), 0 -1px 1px rgba(0,0,0,.45);">${plus?'+':'−'}</div>
  </div>`;

const rows = N.map(x => `
  <div style="position:relative;height:74px;border-radius:5px;overflow:hidden;box-shadow:${RAISED}${x.sel?', 0 0 0 1.5px oklch(0.62 0.13 72 / .8)':''};">
    <svg width="347" height="74" viewBox="0 0 347 74" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:74px;" aria-hidden="true"><rect width="347" height="74" filter="url(#m-slab)"/></svg>
    <div style="position:absolute;inset:0;background:
      linear-gradient(128deg, rgba(255,238,208,.14) 0%, transparent 34%),
      radial-gradient(ellipse 40% 120% at 8% 50%, ${x.tint} 0%, transparent 62%),
      linear-gradient(rgba(14,10,6,.18), rgba(8,6,4,.5));
      ${x.lit?'':'filter:saturate(.5);'}"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:9px;background:linear-gradient(transparent, rgba(10,7,4,.62));"></div>
    <div style="position:relative;display:flex;align-items:center;gap:13px;height:74px;padding:0 12px;">
      ${gem(x.lit, ...x.g)}
      <div style="display:flex;flex-direction:column;flex-grow:1;gap:2px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-family:Cinzel,Georgia,serif;font-size:14px;font-weight:600;color:oklch(0.74 0.03 76);${ENGRAVE}">${x.n}</div>
          ${x.emp?`<div style="position:relative;font-family:Cinzel,Georgia,serif;font-size:8.5px;font-weight:700;letter-spacing:.1em;padding:2.5px 7px;border-radius:2px;background:linear-gradient(155deg, oklch(0.74 0.13 80), oklch(0.42 0.10 66));color:oklch(0.18 0.04 58);box-shadow:inset 1px 1px 0 rgba(255,244,210,.6), inset -1px -1px 2px rgba(0,0,0,.5), 2px 3px 5px rgba(0,0,0,.5);">УСИЛЕН ×2</div>`:''}
        </div>
        <div style="font-size:10px;letter-spacing:.05em;color:oklch(0.60 0.02 74);text-shadow:0 -1px 1px rgba(0,0,0,.75);">${x.sub}</div>
      </div>
      <div style="font-family:Cinzel,Georgia,serif;font-size:29px;font-weight:700;min-width:22px;text-align:right;color:${x.v?'oklch(0.46 0.05 68)':'oklch(0.36 0.02 68)'};${ENGRAVE}">${x.v}</div>
      <div style="display:flex;gap:6px;">${btn(false, !x.v)}${btn(true, false)}</div>
    </div>
  </div>`).join('');

const pip = (a,b,on) => `<div style="width:15px;height:15px;border-radius:8px;background:radial-gradient(circle at 32% 25%, ${a} 0%, ${b} 58%, rgba(0,0,0,.6) 100%);box-shadow:${on?`0 0 9px ${a}, `:''}inset 1px 1.5px 1.5px rgba(255,255,255,.75), 2px 3px 4px rgba(0,0,0,.6);"></div>`;

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Spectral:wght@400;500;600&display=swap">
  <style>
    body { margin: 0; }
    a { color: oklch(0.78 0.12 78); }
    a:hover { color: oklch(0.88 0.12 78); }
  </style>
</helmet>
<div style="width:375px;height:812px;box-sizing:border-box;position:relative;overflow:hidden;background:#241f19;font-family:Spectral,Georgia,serif;color:oklch(0.84 0.02 78);">

  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;" aria-hidden="true">
    <defs>${DEFS}</defs>
    <rect width="375" height="812" filter="url(#m-wall)"/>
  </svg>

  <!-- свет трещины сверху и отражённый янтарь на стене -->
  <div style="position:absolute;inset:0;background:
    radial-gradient(ellipse 70% 26% at 50% 4%, oklch(0.86 0.16 72 / .40) 0%, transparent 66%),
    radial-gradient(ellipse 120% 50% at 50% 0%, oklch(0.70 0.13 66 / .16) 0%, transparent 70%),
    linear-gradient(rgba(12,8,5,.20) 0%, rgba(6,4,3,.62) 78%, rgba(4,3,2,.82) 100%);"></div>

  <div style="position:relative;height:100%;display:flex;flex-direction:column;">

    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:13px 16px 4px 16px;">
      <div style="font-family:Cinzel,Georgia,serif;font-size:11px;font-weight:600;letter-spacing:.22em;color:oklch(0.58 0.05 76);${ENGRAVE}">ЭПОХА II</div>
      <div style="font-size:11px;letter-spacing:.08em;color:oklch(0.52 0.02 74);text-shadow:0 -1px 1px rgba(0,0,0,.8);">раунд 9 / 18</div>
    </div>

    <div style="margin:4px 14px 13px 14px;position:relative;border-radius:6px;overflow:hidden;box-shadow:inset 2px 2px 0 rgba(255,236,205,.15), inset -2px -2px 0 rgba(0,0,0,.6), 6px 8px 18px rgba(0,0,0,.6);">
      <svg width="347" height="120" viewBox="0 0 347 120" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:120px;" aria-hidden="true"><rect width="347" height="120" filter="url(#m-slab)"/></svg>
      <div style="position:absolute;inset:0;background:
        linear-gradient(128deg, rgba(255,240,212,.15) 0%, transparent 30%),
        radial-gradient(ellipse 58% 70% at 50% 58%, oklch(0.80 0.16 70 / .34), transparent 72%),
        linear-gradient(rgba(14,10,6,.12), rgba(8,5,3,.48));"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(transparent, rgba(10,7,4,.66));"></div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:120px;gap:2px;">
        <div style="font-family:Cinzel,Georgia,serif;font-size:9px;font-weight:700;letter-spacing:.3em;color:oklch(0.46 0.06 68);${ENGRAVE}">ПОРОГ СТАБИЛЬНОСТИ</div>
        <div style="font-family:Cinzel,Georgia,serif;font-size:74px;font-weight:700;line-height:1.04;color:oklch(0.42 0.07 64);text-shadow:-2px -2.5px 2px rgba(0,0,0,.95), 2px 2.5px 1px rgba(255,236,196,.26), 0 0 30px oklch(0.82 0.16 70 / .45);">7</div>
        <div style="font-size:10.5px;color:oklch(0.50 0.02 72);text-shadow:0 -1px 1px rgba(0,0,0,.8);">сумма выше — узел схлопнется</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:9px;padding:0 14px;">${rows}</div>

    <div style="flex-grow:1;min-height:6px;"></div>

    <div style="padding:0 14px 9px 14px;">
      <div style="position:relative;height:44px;border-radius:5px;overflow:hidden;box-shadow:inset 1.5px 1.5px 0 rgba(190,150,220,.18), inset -1.5px -1.5px 0 rgba(0,0,0,.6), 4px 5px 10px rgba(0,0,0,.55);">
        <svg width="347" height="44" viewBox="0 0 347 44" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:44px;" aria-hidden="true"><rect width="347" height="44" filter="url(#m-slab)"/></svg>
        <div style="position:absolute;inset:0;background:linear-gradient(128deg, rgba(226,196,246,.12), transparent 32%), linear-gradient(oklch(0.26 0.10 305 / .72), oklch(0.11 0.05 305 / .88));"></div>
        <div style="position:relative;height:44px;display:flex;align-items:center;justify-content:center;font-size:11.5px;letter-spacing:.04em;color:oklch(0.76 0.11 305);text-shadow:0 -1px 1.2px rgba(0,0,0,.92);">Черпнуть из бездны · +2 маны за 1 Скверну</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;padding:0 16px 9px 16px;">
      <div style="display:flex;align-items:center;gap:5px;">
        ${pip('oklch(0.88 0.14 38)','oklch(0.52 0.20 30)',1)}<div style="font-size:12px;font-weight:600;color:oklch(0.80 0.02 78);text-shadow:0 -1px 1px rgba(0,0,0,.8);">2</div>
        ${pip('oklch(0.86 0.10 246)','oklch(0.50 0.15 248)',1)}<div style="font-size:12px;font-weight:600;color:oklch(0.80 0.02 78);text-shadow:0 -1px 1px rgba(0,0,0,.8);">1</div>
        ${pip('oklch(0.90 0.12 154)','oklch(0.56 0.16 152)',1)}<div style="font-size:12px;font-weight:600;color:oklch(0.80 0.02 78);text-shadow:0 -1px 1px rgba(0,0,0,.8);">3</div>
        ${pip('oklch(0.62 0.012 250)','oklch(0.36 0.010 250)',0)}<div style="font-size:12px;font-weight:600;color:oklch(0.44 0.02 72);text-shadow:0 -1px 1px rgba(0,0,0,.8);">0</div>
        ${pip('oklch(0.84 0.14 308)','oklch(0.48 0.19 305)',1)}<div style="font-size:12px;font-weight:600;color:oklch(0.80 0.02 78);text-shadow:0 -1px 1px rgba(0,0,0,.8);">1</div>
      </div>
      <div style="flex-grow:1;"></div>
      <div style="font-size:11px;color:oklch(0.66 0.11 305);text-shadow:0 -1px 1px rgba(0,0,0,.85);">Скверна 1</div>
      <div style="font-size:11px;color:oklch(0.58 0.02 75);text-shadow:0 -1px 1px rgba(0,0,0,.85);">Чары 2</div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;padding:0 16px 9px 16px;">
      <div style="font-size:10.5px;color:oklch(0.50 0.02 74);text-shadow:0 -1px 1px rgba(0,0,0,.85);">готовы 3 из 6</div>
      <div style="display:flex;gap:5px;">
        ${[1,1,1,0,0,0].map(f=>f
          ? `<div style="width:9px;height:9px;border-radius:5px;background:radial-gradient(circle at 32% 26%, oklch(0.94 0.12 82), oklch(0.66 0.15 72));box-shadow:0 0 8px oklch(0.78 0.15 74 / .95), inset 0 1px 1px rgba(255,255,255,.6);"></div>`
          : `<div style="width:9px;height:9px;border-radius:5px;background:oklch(0.20 0.01 68);box-shadow:inset 1px 1.5px 2px rgba(0,0,0,.9), 0 1px 0 rgba(150,124,92,.16);"></div>`).join('')}
      </div>
    </div>

    <div style="position:relative;padding:12px 14px 16px 14px;">
      <div style="position:absolute;inset:0;background:linear-gradient(rgba(10,7,4,.42), rgba(5,3,2,.86));box-shadow:inset 0 2px 0 rgba(255,236,200,.10);"></div>
      <div style="position:relative;display:flex;align-items:center;gap:13px;">
        <div style="display:flex;flex-direction:column;gap:1px;">
          <div style="font-family:Cinzel,Georgia,serif;font-size:8.5px;font-weight:600;letter-spacing:.2em;color:oklch(0.50 0.03 76);text-shadow:0 -1px 1px rgba(0,0,0,.9);">МАНА</div>
          <div style="display:flex;align-items:baseline;gap:3px;">
            <div style="font-family:Cinzel,Georgia,serif;font-size:32px;font-weight:700;line-height:1;color:oklch(0.90 0.09 80);text-shadow:0 0 20px oklch(0.78 0.15 72 / .85), 0 -1px 1px rgba(0,0,0,.6);">1</div>
            <div style="font-size:12px;color:oklch(0.48 0.02 74);">/ 8</div>
          </div>
        </div>
        <div style="position:relative;flex-grow:1;height:54px;border-radius:6px;overflow:hidden;box-shadow:inset 2px 2px 0 rgba(255,240,205,.55), inset -2px -3px 6px rgba(0,0,0,.55), 5px 7px 14px rgba(0,0,0,.65), 0 0 28px oklch(0.78 0.15 72 / .32);">
          <svg width="240" height="54" viewBox="0 0 240 54" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:54px;" aria-hidden="true"><rect width="240" height="54" filter="url(#m-bronze)"/></svg>
          <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 90% at 22% 18%, rgba(255,238,196,.6), transparent 60%), radial-gradient(ellipse 80% 90% at 82% 88%, rgba(28,16,6,.6), transparent 62%);"></div>
          <div style="position:relative;height:54px;display:flex;align-items:center;justify-content:center;font-family:Cinzel,Georgia,serif;font-size:17px;font-weight:700;letter-spacing:.15em;color:oklch(0.22 0.05 56);text-shadow:0 1.5px 0 rgba(255,242,200,.55), 0 -1px 1px rgba(0,0,0,.4);">ГОТОВО</div>
        </div>
      </div>
    </div>

  </div>

  <!-- общее зерно поверх всего: то, что склеивает слои в одну картинку -->
  <svg width="375" height="812" viewBox="0 0 375 812" style="position:absolute;inset:0;opacity:.085;mix-blend-mode:overlay;pointer-events:none;" aria-hidden="true">
    <rect width="375" height="812" filter="url(#m-grain)"/>
  </svg>
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 92% 62% at 50% 44%, transparent 42%, rgba(6,4,3,.55) 100%);"></div>

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
writeFileSync('Real.dc.html', html);
console.log('Real.dc.html:', html.length, 'байт');
