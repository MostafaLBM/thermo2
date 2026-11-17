/* Psychrometric process applet. Depends on model.js (window.Psychro). */
(() => {
'use strict';
const M = window.Psychro, $ = id => document.getElementById(id);
const {TMIN, TMAX, WCAP} = M;
const X0 = 40, X1 = 690, Y0 = 30, Y1 = 440;
const sx = t => X0 + (t - TMIN) / (TMAX - TMIN) * (X1 - X0);
let wTop = WCAP;
const sy = Wg => Y1 - Wg / wTop * (Y1 - Y0);
const KIND = {
  rh: {label: 'Relative humidity', unit: '%', d: 1},
  wb: {label: 'Wet-bulb temperature', unit: '°C', d: 2},
  dp: {label: 'Dew-point temperature', unit: '°C', d: 2},
  w:  {label: 'Humidity ratio', unit: 'g/kg', d: 2},
  h:  {label: 'Specific enthalpy', unit: 'kJ/kg', d: 2}
};
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const P = () => M.pAtm(state.alt);
const minus = s => s.replace(/^-(?=\d)/, '−');
const fx = (x, d) => { const s = x.toFixed(d); return minus(/^-0(\.0+)?$/.test(s) ? s.slice(1) : s); };
const sg = (x, d) => (x > 0 && Number(x.toFixed(d)) !== 0 ? '+' : '') + fx(x, d);

/* ---------- scenarios ---------- */
const sameW = (a, p) => M.wFrom(a.t, a.kind, a.val, p) * 1000;
const scenarios = [
  {name: 'Cooling and dehumidification · AHU cooling coil',
   why: 'Warm, humid return or mixed air passes over a cold coil below its dew point, so it cools and condenses water. The outlet is close to saturated.',
   context: 'The chord points toward the apparatus dew point; the contact factor measures how far along it the air travels.',
   notes: ['Inlet 28 °C, 60 % RH', 'Outlet 13 °C, 95 % RH'],
   build: () => [{t: 28, kind: 'rh', val: 60}, {t: 13, kind: 'rh', val: 95}]},
  {name: 'Sensible cooling · dry coil',
   why: 'Air is cooled without reaching its dew point, so humidity ratio is constant and the process is a horizontal line.',
   context: 'Typical of chilled beams and radiant-assisted systems whose surface stays above the room dew point.',
   notes: ['Inlet 35 °C, 30 % RH', 'Outlet 22 °C at the inlet humidity ratio'],
   build: p => { const a = {t: 35, kind: 'rh', val: 30}; return [a, {t: 22, kind: 'w', val: sameW(a, p)}]; }},
  {name: 'Sensible heating · winter preheat',
   why: 'A hot-water or electric coil raises dry-bulb temperature at constant humidity ratio; relative humidity falls sharply.',
   context: 'The low outlet RH is why winter heating is usually paired with humidification.',
   notes: ['Inlet 2 °C, 80 % RH', 'Outlet 24 °C at the inlet humidity ratio'],
   build: p => { const a = {t: 2, kind: 'rh', val: 80}; return [a, {t: 24, kind: 'w', val: sameW(a, p)}]; }},
  {name: 'Heating and humidification · winter air handler',
   why: 'Outdoor air is heated and then humidified to a comfort condition, giving a line that rises to the right.',
   context: 'The chord is the net effect; the real path is a horizontal heating leg followed by a humidifier leg.',
   notes: ['Inlet 5 °C, 50 % RH', 'Outlet 22 °C, 45 % RH'],
   build: () => [{t: 5, kind: 'rh', val: 50}, {t: 22, kind: 'rh', val: 45}]},
  {name: 'Evaporative cooling · direct, adiabatic',
   why: 'Air passes a wetted medium; sensible heat is traded for latent heat, moving it up and to the left along a constant wet-bulb line.',
   context: 'Total enthalpy is nearly unchanged, so the load is close to zero and the sensible heat ratio is not meaningful.',
   notes: ['Inlet 38 °C, 20 % RH', 'Saturation effectiveness 0.85, outlet on the inlet wet-bulb line'],
   build: p => {
     const a = {t: 38, kind: 'rh', val: 20}, wb = M.wetBulb(a.t, M.wFrom(a.t, a.kind, a.val, p), p);
     return [a, {t: a.t - 0.85 * (a.t - wb), kind: 'wb', val: wb}];
   }},
  {name: 'Steam humidification · isothermal',
   why: 'Steam injection adds moisture at nearly constant dry-bulb temperature, giving a vertical line.',
   context: 'The steam enthalpy supplies the latent load; the air-side balance here does not include it separately.',
   notes: ['Inlet 21 °C, 20 % RH', 'Outlet 21 °C, 45 % RH'],
   build: () => [{t: 21, kind: 'rh', val: 20}, {t: 21, kind: 'rh', val: 45}]},
  {name: 'Desiccant dehumidification · adiabatic',
   why: 'A sorbent removes water vapor and releases the heat of sorption into the air: humidity ratio falls and temperature rises at nearly constant enthalpy.',
   context: 'The outlet is hot and dry and usually needs sensible cooling afterward.',
   notes: ['Inlet 30 °C, 60 % RH', 'Outlet at the inlet enthalpy with W = 10.5 g/kg'],
   build: p => {
     const a = {t: 30, kind: 'rh', val: 60}, W = M.wFrom(a.t, a.kind, a.val, p), h = M.enthalpy(a.t, W), W2 = 0.0105;
     return [a, {t: (h - 2501 * W2) / (1.006 + 1.86 * W2), kind: 'h', val: h}];
   }}
];

const C = (kind, tc, bf) => ({type: 'coil', kind, tc, bf}), H = (hum, tinj, dw) => ({type: 'hum', hum, tinj, dw});
const ductScenarios = [
  {name: 'Empty duct',
   why: 'Nothing in the duct: the air leaves in the state it entered. Add cooling coils, heating coils and humidifiers below, in the order the air meets them.',
   context: 'Drag state 1 on the chart to change the inlet air.',
   notes: ['Inlet 30 °C, 60 % RH', 'No components'],
   build: () => ({s1: {t: 30, kind: 'rh', val: 60}, duct: []})},
  {name: 'Summer · cooling coil',
   why: 'A chilled-water coil cools and dehumidifies. The outlet lies on the chord from the inlet toward the saturated state at the coil surface temperature; BF sets how far along it the air gets.',
   context: 'Raise BF to see less cooling and less condensate at the same surface temperature.',
   notes: ['Inlet 30 °C, 60 % RH', 'C1 cooling coil, surface 8 °C, BF 0.20'],
   build: () => ({s1: {t: 30, kind: 'rh', val: 60}, duct: [C('cool', 8, 0.2)]})},
  {name: 'Summer · cooling coil + reheat',
   why: 'The coil dehumidifies below the dew point; a heating coil then reheats the air at constant humidity ratio to a comfortable temperature.',
   context: 'Reheat lowers the relative humidity again but adds a heating load on top of the cooling load.',
   notes: ['Inlet 30 °C, 60 % RH', 'C1 cooling coil, surface 8 °C, BF 0.20', 'C2 heating coil, surface 25 °C, BF 0.30'],
   build: () => ({s1: {t: 30, kind: 'rh', val: 60}, duct: [C('cool', 8, 0.2), C('heat', 25, 0.3)]})},
  {name: 'Winter · heating coil + steam humidifier',
   why: 'Cold air is heated at constant humidity ratio, then steam raises the humidity ratio with almost no change in dry-bulb temperature.',
   context: 'Steam carries about 2690 kJ/kg, so the supply is slightly warmer than the coil outlet.',
   notes: ['Inlet 10 °C, 30 % RH', 'C1 heating coil, surface 35 °C, BF 0.30', 'C2 humidifier, steam 100 °C, 4 g/kg'],
   build: () => ({s1: {t: 10, kind: 'rh', val: 30}, duct: [C('heat', 35, 0.3), H('steam', 100, 4)]})},
  {name: 'Winter · heating coil + water spray',
   why: 'The coil over-heats the air, then liquid water evaporates into it and cools it back along a nearly constant-enthalpy line.',
   context: 'The latent heat comes from the air, so the coil has to supply it; compare the coil load with the steam case.',
   notes: ['Inlet 10 °C, 30 % RH', 'C1 heating coil, surface 40 °C, BF 0.20', 'C2 humidifier, liquid water 15 °C, 5 g/kg'],
   build: () => ({s1: {t: 10, kind: 'rh', val: 30}, duct: [C('heat', 40, 0.2), H('water', 15, 5)]})}
];
const towerScenarios = [
  {name: 'Cool humid day vs hot dry day',
   why: 'One tower, two climates. On the cool humid day the warm, saturated exit air is far lighter than the ambient air. On the hot dry day the exit air is cooler than the ambient dry bulb and the density difference nearly vanishes.',
   context: 'The draft head falls by roughly an order of magnitude, so the tower moves far less air and the cold-water temperature drifts away from the wet bulb.',
   notes: ['Climate 1: 15 °C, 80 % RH', 'Climate 2: 45 °C, 10 % RH', 'Hot water 40 °C, 6000 kg/s, tower height 110 m'],
   build: () => ({s1: {t: 15, kind: 'rh', val: 80}, s2: {t: 45, kind: 'rh', val: 10}, tower: {Tin: 40, L: 6000, H: 110}})},
  {name: 'Mild day vs hot dry day',
   why: 'A typical mild day against the hot dry extreme, same tower and water side.',
   context: 'Compare the temperature and humidity bars in the density budget: the humidity term stays similar but the temperature term turns negative.',
   notes: ['Climate 1: 25 °C, 50 % RH', 'Climate 2: 45 °C, 10 % RH', 'Hot water 40 °C, 6000 kg/s, tower height 110 m'],
   build: () => ({s1: {t: 25, kind: 'rh', val: 50}, s2: {t: 45, kind: 'rh', val: 10}, tower: {Tin: 40, L: 6000, H: 110}})},
  {name: 'Hot humid day vs hot dry day',
   why: 'Both days are hot. The humid day still has a small wet-bulb depression but a better draft than the dry day.',
   context: 'Hot and humid is hard for cooling (small approach to the wet bulb); hot and dry is hard for draft.',
   notes: ['Climate 1: 35 °C, 60 % RH', 'Climate 2: 45 °C, 10 % RH', 'Hot water 40 °C, 6000 kg/s, tower height 110 m'],
   build: () => ({s1: {t: 35, kind: 'rh', val: 60}, s2: {t: 45, kind: 'rh', val: 10}, tower: {Tin: 40, L: 6000, H: 110}})},
  {name: 'Taller tower, mild vs hot dry',
   why: 'Draft head is proportional to height, so a taller stack should help the hot dry day. How much it helps is the question.',
   context: 'Compare with the 110 m case: raising the stack from 110 m to 200 m raises the hot-dry air flow by only about 8 %, because losses grow with the square of the flow and the cooling gets no cheaper.',
   notes: ['Climate 1: 25 °C, 50 % RH', 'Climate 2: 45 °C, 10 % RH', 'Hot water 40 °C, 6000 kg/s, tower height 200 m'],
   build: () => ({s1: {t: 25, kind: 'rh', val: 50}, s2: {t: 45, kind: 'rh', val: 10}, tower: {Tin: 40, L: 6000, H: 200}})}
];
const compTitle = c => c.type === 'hum' ? 'Humidifier' : c.kind === 'cool' ? 'Cooling coil' : 'Heating coil';
let state = {mode: 'free', ductScenario: 0, duct: [], towerScenario: 0, tower: {Tin: 40, L: 6000, H: 110},
  alt: 0, flow: 1, active: 0, preset: true, scenario: 0, s: [],
  layers: {rh: true, h: true, wb: false, v: true, sl: true}};
let note = '', bgKey = '', fg = null, drag = null;

/* ---------- controls ---------- */
const ctl = {};
function mkControl(parent, key, label, unit, min, max) {
  const box = document.createElement('div'); box.className = 'control';
  box.innerHTML = `<div class="input-head"><label id="${key}-label" for="${key}-number">${label}</label><span class="number-wrap"><input id="${key}-number" type="number" inputmode="decimal" min="${min}" max="${max}" step="any" aria-describedby="${key}-bounds"><small id="${key}-unit">${unit}</small></span></div><input class="range" id="${key}-range" type="range" min="${min}" max="${max}" step="any" aria-label="${label}"><div class="limits" id="${key}-bounds"><span></span><span></span></div>`;
  parent.append(box);
  const number = $(`${key}-number`), range = $(`${key}-range`);
  ctl[key] = {number, range};
  range.addEventListener('input', () => { setVal(key, Number(range.value)); });
  number.addEventListener('change', () => {
    if (!Number.isFinite(number.valueAsNumber)) { sync(); $('status').textContent = 'Please enter a numeric value.'; return; }
    const raw = number.valueAsNumber, v = clamp(raw, Number(range.min), Number(range.max));
    note = raw !== v ? 'Value adjusted to the supported range.' : '';
    setVal(key, v);
  });
  number.addEventListener('keydown', e => { if (e.key === 'Enter') { number.dispatchEvent(new Event('change')); number.blur(); } });
}
for (let i = 0; i < 2; i++) {
  const g = document.createElement('fieldset'); g.className = 'state-group'; g.id = `grp-${i}`;
  g.innerHTML = `<legend><i aria-hidden="true">${i + 1}</i>State ${i + 1} · ${i ? 'outlet' : 'inlet'}</legend>`;
  $('inputs').append(g);
  mkControl(g, `t${i}`, 'Dry-bulb temperature', '°C', TMIN, TMAX);
  const sel = document.createElement('select'); sel.id = `kind${i}`;
  sel.setAttribute('aria-label', `State ${i + 1}: second property`);
  sel.innerHTML = Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  g.append(sel);
  mkControl(g, `v${i}`, 'Value', '%', 0, 100);
  sel.addEventListener('change', () => {
    const s = state.s[i], p = P(), W = M.wFrom(s.t, s.kind, s.val, p);
    s.kind = sel.value; s.val = M.valueOf(s.t, W, s.kind, p); update();
  });
}
mkControl($('site'), 'flow', 'Volume flow at state 1', 'm³/s', 0.01, 20);
mkControl($('site'), 'alt', 'Altitude (standard atmosphere)', 'm', 0, 3000);
$('site').insertAdjacentHTML('beforeend', '<p class="hint" id="p-line"></p>');
const MAXC = 5;
function buildDuctList() {
  const box = $('duct-list'); box.innerHTML = '';
  state.duct.forEach((c, i) => {
    const g = document.createElement('fieldset'); g.className = 'state-group comp'; g.id = `comp-${i}`;
    g.innerHTML = `<div class="comp-head"><span class="comp-title"><i aria-hidden="true">C${i + 1}</i>${compTitle(c)}</span><span class="comp-tools"><button type="button" data-act="up" aria-label="Move C${i + 1} upstream" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-act="down" aria-label="Move C${i + 1} downstream" ${i === state.duct.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-act="del" aria-label="Remove C${i + 1}">✕</button></span></div>`;
    box.append(g);
    g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'del') state.duct.splice(i, 1);
      else { const j = act === 'up' ? i - 1 : i + 1; [state.duct[i], state.duct[j]] = [state.duct[j], state.duct[i]]; }
      state.preset = false; buildDuctList(); update();
    }));
    if (c.type === 'coil') {
      mkControl(g, `d${i}-tc`, 'Coil surface temperature', '°C', 0, 50);
      mkControl(g, `d${i}-bf`, 'Bypass factor, BF', '', 0, 1);
    } else {
      const sel = document.createElement('select'); sel.id = `d${i}-hum`; sel.setAttribute('aria-label', `C${i + 1}: injected water phase`);
      sel.innerHTML = '<option value="steam">Steam</option><option value="water">Liquid water</option>';
      g.append(sel);
      sel.addEventListener('change', () => { c.hum = sel.value; c.tinj = sel.value === 'steam' ? 100 : 15; state.preset = false; update(); });
      mkControl(g, `d${i}-tinj`, 'Injection temperature', '°C', 1, 180);
      mkControl(g, `d${i}-dw`, 'Water injected', 'g/kg', 0, 30);
      $(`d${i}-dw-label`).textContent = 'Water injected (per kg dry air)';
    }
  });
  const full = state.duct.length >= MAXC;
  ['add-cool', 'add-heat', 'add-hum'].forEach(id => { $(id).disabled = full; });
}
const addComp = c => { if (state.duct.length >= MAXC) return; state.duct.push(c); state.preset = false; buildDuctList(); update(); };
$('add-cool').addEventListener('click', () => addComp(C('cool', 8, 0.2)));
$('add-heat').addEventListener('click', () => addComp(C('heat', 40, 0.3)));
$('add-hum').addEventListener('click', () => addComp(H('steam', 100, 3)));

mkControl($('tower-group'), 'Tin', 'Hot-water inlet temperature', '°C', 30, 50);
mkControl($('tower-group'), 'Lw', 'Water flow', 'kg/s', 2000, 10000);
mkControl($('tower-group'), 'Ht', 'Tower height', 'm', 50, 200);
function setVal(key, v) {
  const m = /^([tv])([01])$/.exec(key);
  if (m) { const s = state.s[+m[2]]; if (m[1] === 't') s.t = v; else s.val = v; } else if (key === 'Tin' || key === 'Lw' || key === 'Ht') state.tower[{Tin: 'Tin', Lw: 'L', Ht: 'H'}[key]] = v; else if (/^d\d+-/.test(key)) { const [, i, k] = /^d(\d+)-(.+)$/.exec(key); state.duct[+i][k] = v; } else state[key] = v;
  state.preset = false; update();
}
function sync() {
  const p = P();
  state.s.forEach((s, i) => {
    s.t = clamp(s.t, TMIN, TMAX);
    const [lo, hi] = M.bounds(s.t, s.kind, p), k = KIND[s.kind];
    s.val = clamp(s.val, lo, hi);
    $(`kind${i}`).value = s.kind;
    $(`v${i}-label`).textContent = k.label;
    $(`v${i}-unit`).textContent = k.unit;
    setCtl(`t${i}`, s.t, TMIN, TMAX, 2, '°C');
    setCtl(`v${i}`, s.val, lo, hi, k.d, k.unit);
  });
  setCtl('flow', state.flow, 0.01, 20, 2, 'm³/s');
  setCtl('alt', state.alt, 0, 3000, 0, 'm');
  [0, 1].forEach(i => { const on = state.active === i; $(`pick-${i}`).setAttribute('aria-checked', on); });
  const dm = state.mode === 'duct', tm = state.mode === 'tower';
  wTop = tm ? 70 : WCAP;
  if (dm) state.active = 0;
  $('grp-1').hidden = $('pick-wrap').hidden = dm; $('duct-controls').hidden = !dm;
  $('proc-panel').hidden = dm || tm; $('tower-controls').hidden = !tm; $('tower-panel').hidden = $('tower-account').hidden = !tm;
  ctl.flow.number.closest('.control').hidden = tm;
  $('grp-0').querySelector('legend').innerHTML = `<i aria-hidden="true">1</i>${tm ? 'Climate 1 · reference' : 'State 1 · inlet'}`;
  $('grp-1').querySelector('legend').innerHTML = `<i aria-hidden="true">2</i>${tm ? 'Climate 2' : 'State 2 · outlet'}`;
  $('pick-0').innerHTML = tm ? 'Climate 1<small>reference</small>' : 'State 1<small>inlet</small>';
  $('pick-1').innerHTML = tm ? 'Climate 2<small>comparison</small>' : 'State 2<small>outlet</small>'; $('duct-panel').hidden = $('duct-account').hidden = !dm;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === state.mode));
  $('chart-eyebrow').textContent = dm ? 'DRAG POINT 1 · OTHER POINTS ARE COMPUTED' : tm ? 'DRAG THE AMBIENT POINTS · PRIMED POINTS ARE EXIT AIR' : 'DRAG THE NUMBERED POINTS';
  if (tm) {
    const T = state.tower;
    T.Tin = clamp(T.Tin, 30, 50); T.L = clamp(T.L, 2000, 10000); T.H = clamp(T.H, 50, 200);
    setCtl('Tin', T.Tin, 30, 50, 1, '°C'); setCtl('Lw', T.L, 2000, 10000, 0, 'kg/s'); setCtl('Ht', T.H, 50, 200, 0, 'm');
  }
  if (dm) {
    let cur = derive(0, p);
    state.duct.forEach((c, i) => {
      if (c.type === 'coil') {
        const [lo, hi] = c.kind === 'cool' ? [0, 30] : [10, 50];
        c.tc = clamp(c.tc, lo, hi); c.bf = clamp(c.bf, 0, 1);
        setCtl(`d${i}-tc`, c.tc, lo, hi, 2, '°C'); setCtl(`d${i}-bf`, c.bf, 0, 1, 2, '');
      } else {
        const steam = c.hum === 'steam', lo = steam ? 100 : 1, hi = steam ? 180 : 95;
        c.tinj = clamp(c.tinj, lo, hi);
        let r = M.step(cur, c, p);
        if (c.dw > r.maxDW * 1000) { c.dw = r.maxDW * 1000; r = M.step(cur, c, p); }
        c.dw = Math.max(0, c.dw);
        $(`d${i}-hum`).value = c.hum;
        setCtl(`d${i}-tinj`, c.tinj, lo, hi, 1, '°C'); setCtl(`d${i}-dw`, c.dw, 0, r.maxDW * 1000, 2, 'g/kg');
      }
      cur = M.step(cur, c, p).out;
    });
  }
  $('preset').checked = state.preset;
  $('preset-status').textContent = state.preset ? 'Process preset' : 'Custom settings · based on the selected scenario';
  $('p-line').textContent = `Barometric pressure ${p.toFixed(3)} kPa. Altitude changes the saturation curve and every derived property.`;
}
function setCtl(key, val, lo, hi, d, unit) {
  const {range, number} = ctl[key];
  range.min = number.min = String(lo); range.max = number.max = String(hi);
  if (document.activeElement !== number) number.value = String(Number(val.toFixed(d + 2)));
  range.value = String(val);
  const b = $(`${key}-bounds`).children;
  b[0].textContent = `${fx(lo, d)} ${unit}`; b[1].textContent = `${fx(hi, d)} ${unit}`;
}

/* ---------- scenarios ---------- */
const scList = () => state.mode === 'duct' ? ductScenarios : state.mode === 'tower' ? towerScenarios : scenarios;
function applyScenario() {
  const dm = state.mode === 'duct', tm = state.mode === 'tower', idx = dm ? state.ductScenario : tm ? state.towerScenario : state.scenario, sc = scList()[idx], p = P();
  $('scenario').innerHTML = scList().map((x, k) => `<option value="${k}">${x.name}</option>`).join('');
  if (dm) { const b = sc.build(p); state.s = [{...b.s1}, {...b.s1}]; state.duct = b.duct.map(x => ({...x})); buildDuctList(); }
  else if (tm) { const b = sc.build(p); state.s = [{...b.s1}, {...b.s2}]; state.tower = {...b.tower}; }
  else state.s = sc.build(p).map(x => ({...x}));
  state.preset = true;
  $('scenario').value = idx;
  $('application-name').textContent = sc.name;
  $('why').textContent = sc.why; $('context').textContent = sc.context;
  $('scenario-details').innerHTML = `<p>Illustrative setup:</p><ul>${sc.notes.map(n => `<li>${n}</li>`).join('')}</ul><p>Teaching assumptions, not equipment ratings.</p>`;
  update();
}
$('scenario').addEventListener('change', () => { state[{duct: 'ductScenario', tower: 'towerScenario'}[state.mode] || 'scenario'] = Number($('scenario').value); applyScenario(); });
$('preset').addEventListener('change', () => { if ($('preset').checked) applyScenario(); else { state.preset = false; sync(); } });
$('reset').addEventListener('click', () => { state.alt = 0; state.flow = 1; state.scenario = 0; state.ductScenario = 0; state.towerScenario = 0; applyScenario(); });
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (state.mode !== b.dataset.mode) { state.mode = b.dataset.mode; applyScenario(); } }));
[0, 1].forEach(i => $(`pick-${i}`).addEventListener('click', () => { state.active = i; sync(); renderChart(lastDerived); }));
for (const k of ['rh', 'h', 'wb', 'v', 'sl']) $(`layer-${k}`).addEventListener('change', e => { state.layers[k] = e.target.checked; renderChart(lastDerived); });

/* ---------- update / results ---------- */
let lastDerived = null;
const derive = (i, p) => { const s = state.s[i], W = M.wFrom(s.t, s.kind, s.val, p); return M.props(s.t, W, p); };
function update() {
  const p = P();
  sync();
  const a = derive(0, p);
  let d;
  if (state.mode === 'duct') {
    const r = M.duct(a, state.duct, p, state.flow);
    d = {mode: 'duct', a, r, p};
    const lim = r.steps.findIndex(x => x.clamped);
    if (lim >= 0 && !note) note = `C${lim + 1} injection limited so its outlet stays unsaturated and on the chart.`;
    renderDuct(d);
  } else if (state.mode === 'tower') {
    const b = derive(1, p), t1 = M.tower(a, state.tower, p), t2 = M.tower(b, state.tower, p);
    d = {mode: 'tower', a, b, t1, t2, p};
    const bad = [t1, t2].findIndex(x => !x.ok);
    if (bad >= 0 && !note) note = `Climate ${bad + 1}: ${[t1, t2][bad].reason}`;
    renderTower(d);
  } else {
    const b = derive(1, p);
    d = {mode: 'free', a, b, pr: M.process(a, b, p, state.flow), p};
    renderResults(d);
  }
  lastDerived = d; window.currentProcess = d;
  renderChart(d);
  if (state.mode === 'duct') drawDuct(d);
  if (state.mode === 'tower') drawBudget(d);
  $('status').textContent = note || 'Moist-air properties: ASHRAE Fundamentals correlations; enhancement factor neglected.';
  note = '';
}
const setMetrics = (l1, s1, l2, s2, l3, s3) => { [['m1', l1, s1], ['m2', l2, s2], ['m3', l3, s3]].forEach(([k, l, sm]) => { $(`${k}-l`).textContent = l; $(`${k}-s`).textContent = sm; }); };
const stateRows = rows => rows.map(([s, n, loc]) => `<tr><td>${n}</td><td>${loc}</td><td>${fx(s.t, 2)}</td><td>${fx(s.twb, 2)}</td><td>${fx(s.tdp, 2)}</td><td>${fx(s.rh, 1)}</td><td>${fx(s.Wg, 3)}</td><td>${fx(s.h, 2)}</td><td>${fx(s.v, 4)}</td><td>${fx(s.pw, 3)}</td></tr>`).join('');
function renderResults({a, b, pr, p}) {
  setMetrics('Total heat transfer', 'kW · positive heats the air', 'Sensible heat ratio', 'q sensible / q total', 'Moisture change', 'kg/h · positive adds water');
  const q = Math.abs(pr.Q) < 1e-9 ? null : pr.Q;
  $('qtot-m').textContent = sg(pr.Q, 2);
  $('shr').textContent = pr.SHR === null || q === null ? '—' : fx(pr.SHR, 2);
  $('water-m').textContent = sg(pr.mw * 3600, 2);
  $('proc-tag').textContent = pr.name.toUpperCase();
  const d = {dT: `${sg(pr.dt, 2)} K`, dWg: `${sg(pr.dWg, 3)} g/kg`, dh: `${sg(pr.dh, 2)} kJ/kg`,
    mda: `${fx(pr.m, 4)} kg/s`, qtot: `${sg(pr.Q, 3)} kW`, qsen: `${sg(pr.Qs, 3)} kW`, qlat: `${sg(pr.Ql, 3)} kW`,
    water: `${sg(pr.mw * 3600, 3)} kg/h`, slope: pr.slope === null ? '—' : `${fx(pr.slope, 0)} kJ/kg`,
    vout: `${fx(pr.Vout, 3)} m³/s`, coil: pr.coil === null ? '—' : `${fx(pr.coil, 3)} kW removed`,
    adp: pr.adp ? `${fx(pr.adp.t, 2)} °C` : '—', beta: pr.beta === null ? '—' : fx(pr.beta, 3)};
  for (const [id, v] of Object.entries(d)) $(id).textContent = v;
  $('states').innerHTML = stateRows([[a, 1, 'Inlet'], [b, 2, 'Outlet']]);
  $('chart-tag').textContent = `p = ${p.toFixed(3)} kPa · Z = ${Math.round(state.alt)} m`;
}
function renderDuct({a, r, p}) {
  setMetrics('Net coil load', 'kW · air side, positive heats the air', 'Condensate removed', 'kg/h · drains from the coils', 'Water injected', 'kg/h · from the humidifiers');
  $('qtot-m').textContent = sg(r.Qcoils, 2); $('shr').textContent = fx(r.mc * 3600, 2); $('water-m').textContent = fx(r.mInj * 3600, 2);
  const n = r.steps.length;
  $('duct-tag').textContent = n ? `${n} COMPONENT${n > 1 ? 'S' : ''}` : 'EMPTY DUCT';
  $('duct-steps').innerHTML = n ? r.steps.map((st, i) => {
    const c = st.cfg, name = `C${i + 1} · ${compTitle(c)}`, dt = st.out.t - st.in.t, dW = (st.out.W - st.in.W) * 1000;
    const setting = c.type === 'coil'
      ? `surface ${fx(c.tc, 1)} °C · BF ${fx(c.bf, 2)} · ${!st.active ? 'no effect' : st.wet ? 'wet' : 'dry'}`
      : `${c.hum === 'steam' ? 'steam' : 'liquid'} ${fx(c.tinj, 0)} °C`;
    const load = c.type === 'coil' ? sg(st.Q, 3) : st.Ehum > 0 ? '+' + fx(st.Ehum, 3) : '0.000';
    const water = c.type === 'coil' ? (st.wet ? sg(-st.mc * 3600, 2) : '—') : sg(st.mInj * 3600, 2);
    return `<tr><td>${name}</td><td>${setting}</td><td>${sg(dt, 2)}</td><td>${sg(dW, 2)}</td><td>${load}</td><td>${water}</td></tr>`;
  }).join('') : '<tr><td colspan="6">No components in the duct.</td></tr>';
  const d = {'d-m': `${fx(r.m, 4)} kg/s`, 'd-vs': `${fx(r.Vout, 3)} m³/s`, 'd-dh': `${sg(r.dh, 2)} kJ/kg`, 'd-qc': `${sg(r.Qcoils, 3)} kW`,
    'd-mc': `${fx(r.mc * 3600, 3)} kg/h`, 'd-minj': `${fx(r.mInj * 3600, 3)} kg/h`, 'd-ehum': `${fx(r.Ehum, 3)} kW`, 'd-bal': `${fx(r.balance, 4)} kW`};
  for (const [id, v] of Object.entries(d)) $(id).textContent = v;
  $('states').innerHTML = stateRows(r.states.map((q, i) => [q, i + 1, i === 0 ? 'Inlet' : `After C${i} · ${compTitle(r.steps[i - 1].cfg)}${i === n ? ' (supply)' : ''}`]));
  $('chart-tag').textContent = `p = ${p.toFixed(3)} kPa · Z = ${Math.round(state.alt)} m`;
}

function renderTower({a, b, t1, t2, p}) {
  const v = (r, fn) => r.ok ? fn(r) : '—', pair = fn => `${v(t1, fn)} → ${v(t2, fn)}`;
  setMetrics('Air flow, 1 → 2', 'kg/s · natural draft', 'Draft head, 1 → 2', 'Pa · g·H·(ρ amb − ρ exit)', 'Approach, 1 → 2', 'K · cold water − wet bulb');
  $('qtot-m').textContent = pair(r => fx(r.G, 0)); $('shr').textContent = pair(r => fx(r.dp, 1)); $('water-m').textContent = pair(r => fx(r.approach, 1));
  const rows = [
    ['Ambient dry bulb / RH', (r, s) => `${fx(s.t, 1)} °C / ${fx(s.rh, 0)} %`, true],
    ['Ambient wet bulb', (r, s) => `${fx(s.twb, 1)} °C`, true],
    ['Air flow, G', r => `${fx(r.G, 0)} kg/s`],
    ['Water-to-air ratio, L/G', r => fx(r.LG, 2)],
    ['Draft head', r => `${fx(r.dp, 1)} Pa`],
    ['Density difference, ρ amb − ρ exit', r => `${fx(r.drho * 1000, 1)} g/m³`],
    ['… temperature effect', r => `${sg(r.dTpart * 1000, 1)} g/m³`],
    ['… humidity effect', r => `${sg(r.dHpart * 1000, 1)} g/m³`],
    ['Cold-water temperature', r => `${fx(r.Tout, 1)} °C`],
    ['Range', r => `${fx(r.range, 1)} K`],
    ['Approach', r => `${fx(r.approach, 1)} K`],
    ['Heat rejected', r => `${fx(r.Q, 1)} MW`],
    ['Evaporation (make-up)', r => `${fx(r.evap, 1)} kg/s · ${fx(r.makeup, 2)} % of L`],
    ['Exit air, t / RH', r => `${fx(r.e.t, 1)} °C / ${fx(r.e.rh, 0)} %`],
    ['Visible plume at mixing with ambient', r => r.visible ? 'yes' : 'no']
  ];
  $('tower-rows').innerHTML = rows.map(([lab, fn, amb]) => `<tr><td>${lab}</td>${[[t1, a], [t2, b]].map(([r, s]) => `<td>${amb ? fn(r, s) : r.ok ? fn(r) : '—'}</td>`).join('')}</tr>`).join('');
  const sr = [[a, '1', 'Ambient, climate 1']];
  if (t1.ok) sr.push([t1.e, '1′', 'Exit air, climate 1']);
  sr.push([b, '2', 'Ambient, climate 2']);
  if (t2.ok) sr.push([t2.e, '2′', 'Exit air, climate 2']);
  $('states').innerHTML = stateRows(sr);
  $('chart-tag').textContent = `p = ${p.toFixed(3)} kPa · Z = ${Math.round(state.alt)} m`;
}
const TCOL = ['#19363d', '#c15a2c'];
function buildFgTower({a, b, t1, t2}) {
  let s = '';
  [[a, t1], [b, t2]].forEach(([amb, r], i) => {
    const col = TCOL[i], x = sx(amb.t), y = sy(amb.Wg);
    s += `<line class="drop" x1="${x}" x2="${x}" y1="${y}" y2="${Y1}"/>`;
    if (!r.ok) return;
    const pts = r.path.map(q => [sx(q.t), sy(q.Wg)]), mid = pts[Math.floor(pts.length / 2)], nxt = pts[Math.floor(pts.length / 2) + 1];
    s += `<path d="M${r.mix.map(q => sx(q[0]).toFixed(1) + ' ' + sy(q[1]).toFixed(1)).join('L')}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="2 4" opacity=".75"><title>Mixing line, exit air with ambient${r.visible ? ' (crosses saturation: visible plume)' : ''}</title></path>`;
    s += path(pts, 'proc', `style="stroke:${col}"`) + arrow(mid, nxt, col);
  });
  [[t1, 0], [t2, 1]].forEach(([r, i]) => {
    if (!r.ok) return;
    const x = sx(r.e.t), y = sy(r.e.Wg);
    s += `<g><title>Exit air, climate ${i + 1}: ${fx(r.e.t, 1)} °C, ${fx(r.e.rh, 0)} % RH</title><circle cx="${x}" cy="${y}" r="13" class="state-badge" style="stroke:${TCOL[i]}"/>${text(x, y, `${i + 1}′`, 'badge-text')}</g>`;
  });
  [[a, 0], [b, 1]].forEach(([q, i]) => {
    const x = sx(q.t), y = sy(q.Wg);
    s += `<g class="handle" data-i="${i}"><title>Climate ${i + 1}: ${fx(q.t, 2)} °C, ${fx(q.Wg, 2)} g/kg, ${fx(q.rh, 1)} % RH</title>${state.active === i ? `<circle class="ring" cx="${x}" cy="${y}" r="17"/>` : ''}<circle cx="${x}" cy="${y}" r="26" fill="transparent"/><circle class="state-badge" cx="${x}" cy="${y}" r="11" style="stroke:${TCOL[i]}"/>${text(x, y, i + 1, 'badge-text')}</g>`;
  });
  return s;
}
function drawBudget({a, b, t1, t2}) {
  const T = (x, y, s_, cls, anc = 'start') => text(x, y, s_, cls, `text-anchor="${anc}"`);
  const items = [[a, t1, 0], [b, t2, 1]], ok = items.filter(x => x[1].ok);
  const mx = Math.max(1e-3, ...ok.flatMap(([, r]) => [Math.abs(r.dTpart), Math.abs(r.dHpart), Math.abs(r.drho)])) * 1000;
  const x0 = 470, k = 190 / mx;
  let s = `<line x1="${x0}" x2="${x0}" y1="14" y2="244" stroke="#56746c" stroke-width="1.5"/>`;
  s += T(x0 + 6, 12, 'exit air lighter → helps draft', 'device-note') + T(x0 - 6, 12, '← exit air heavier', 'device-note', 'end');
  let y = 28;
  for (const [amb, r, i] of items) {
    s += T(10, y + 12, `Climate ${i + 1}`, 'device-label') + T(10, y + 28, `${fx(amb.t, 0)} °C · ${fx(amb.rh, 0)} % RH`, 'device-note');
    if (!r.ok) { s += T(x0 + 6, y + 30, r.reason, 'device-note'); y += 112; continue; }
    [['Temperature effect', r.dTpart, '#3372a3'], ['Humidity effect', r.dHpart, '#176c67'], ['Net, ρ amb − ρ exit', r.drho, '#19363d']].forEach(([lab, val, col], j) => {
      const yy = y + j * 28, w = val * 1000 * k;
      s += `<rect x="${w >= 0 ? x0 : x0 + w}" y="${yy}" width="${Math.max(Math.abs(w), 1)}" height="18" fill="${col}"><title>${lab}: ${sg(val * 1000, 1)} g/m³</title></rect>`;
      s += T(750, yy + 13, `${sg(val * 1000, 1)} g/m³`, 'device-note', 'end');
      s += T(140, yy + 13, lab, 'device-note');
    });
    y += 112;
  }
  $('budget').innerHTML = s;
}

/* ---------- drawing helpers ---------- */
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, s, cls = '', extra = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" ${extra}>${esc(s)}</text>`;
const path = (pts, cls, extra = '') => pts.length < 2 ? '' : `<path class="${cls}" ${extra} d="${pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('')}"/>`;
const toXY = seg => seg.map(([t, Wg]) => [sx(t), sy(Wg)]);

/* Sample W(t) along the dry-bulb axis, keeping only the part inside the chart and below saturation. */
function trace(fn, p) {
  const step = 0.25, n = Math.round((TMAX - TMIN) / step);
  const ok = t => { const W = fn(t); if (!Number.isFinite(W) || W < -1e-9 || W > Math.min(M.Ws(t, p), wTop / 1000) + 1e-9) return NaN; return Math.max(0, W); };
  const refine = (tin, tout) => { for (let k = 0; k < 30; k++) { const m = (tin + tout) / 2; if (Number.isNaN(ok(m))) tout = m; else tin = m; } return [tin, ok(tin) * 1000]; };
  const segs = []; let cur = null, prev = null;
  for (let i = 0; i <= n; i++) {
    const t = TMIN + i * step, W = ok(t);
    if (!Number.isNaN(W)) {
      if (!cur) { cur = []; segs.push(cur); if (prev !== null) cur.push(refine(t, prev)); }
      cur.push([t, W * 1000]);
    } else if (cur) { cur.push(refine(prev, t)); cur = null; }
    prev = t;
  }
  return segs.filter(s => s.length > 1);
}

/* ---------- static chart layers (depend on pressure and layer switches) ---------- */
function buildBg(p) {
  let s = '';
  const sat = trace(t => M.Ws(t, p), p)[0] || [];
  if (sat.length) s += `<path class="oversat" d="M${toXY(sat).map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')}L${X0} ${Y0}Z"/>`;
  s += '<g clip-path="url(#chart-clip)">';
  for (let t = 5; t < TMAX; t += 5) s += `<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${Y0}" y2="${Y1}"/>`;
  const gStep = wTop > 40 ? 10 : 5;
  for (let W = gStep; W < wTop; W += gStep) s += `<line class="grid" x1="${X0}" x2="${X1}" y1="${sy(W)}" y2="${sy(W)}"/>`;
  s += '</g>';
  const L = state.layers;
  if (L.v) for (let v = Math.ceil(M.RDA * (TMIN + 273.15) / p / 0.02 - 1e-9) * 0.02; v <= M.RDA * (TMAX + 273.15) * (1 + 1.607858 * wTop / 1000) / p + 1e-9; v += 0.02) {
    const segs = trace(t => (v * p / (M.RDA * (t + 273.15)) - 1) / 1.607858, p);
    let lab = '';
    for (const sg_ of segs) { s += path(toXY(sg_), 'v-line'); const e = sg_[sg_.length - 1]; if (e[1] < 0.2 && e[0] < TMAX - 1) lab = text(sx(e[0]), Y1 - 4, v.toFixed(2), 'lbl v', 'text-anchor="middle"'); }
    s += lab;
  }
  const hStep = wTop > 40 ? 20 : 10, hMax = Math.ceil(M.enthalpy(TMAX, wTop / 1000) / 10) * 10;
  if (L.h) for (let h = 0; h <= hMax; h += hStep) {
    const segs = trace(t => M.wRaw(t, 'h', h, p), p);
    for (const sg_ of segs) s += path(toXY(sg_), 'h-line');
    if (segs.length) { const f = segs[0][0]; s += text(sx(f[0]) - 3, sy(f[1]) - (f[1] >= wTop - 0.01 ? 16 : 5), String(h), 'lbl h', 'text-anchor="end"'); }
  }
  if (L.wb) for (let tw = 0; tw <= (wTop > 40 ? 46 : 32); tw += wTop > 40 ? 4 : 2) {
    const segs = trace(t => t < tw ? NaN : M.wRaw(t, 'wb', tw, p), p);
    for (const sg_ of segs) s += path(toXY(sg_), 'wb-line');
    if (segs.length) { const f = segs[0][0]; s += text(sx(f[0]) - 5, sy(f[1]) + 4, String(tw), 'lbl wb', 'text-anchor="end"'); }
  }
  if (L.rh) for (let rh = 10; rh < 100; rh += 10) {
    const segs = trace(t => M.wRaw(t, 'rh', rh, p), p);
    for (const sg_ of segs) s += path(toXY(sg_), 'rh-line');
    if (segs.length) {
      const seg = segs[segs.length - 1], e = seg[seg.length - 1];
      s += e[1] >= wTop - 0.01 ? text(sx(e[0]), Y0 - 4, `${rh}%`, 'lbl rh', 'text-anchor="middle"')
                               : text(sx(e[0]) - 3, sy(e[1]) - 3, `${rh}%`, 'lbl rh', 'text-anchor="end"');
    }
  }
  s += path(toXY(sat), 'sat-line');
  if (sat.length) { const e = sat[sat.length - 1]; s += text(sx(e[0]) - 6, Y0 - 4, 'saturation', 'lbl rh', 'text-anchor="end"'); }
  s += `<rect class="frame" x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/>`;
  for (let t = TMIN; t <= TMAX; t += 5) s += text(sx(t), Y1 + 18, t, 'tick', 'text-anchor="middle"');
  for (let W = 0; W <= wTop; W += gStep) s += text(X1 + 7, sy(W) + 4, W, 'tick');
  s += text((X0 + X1) / 2, Y1 + 42, 'Dry-bulb temperature, t [°C]', 'axis-label', 'text-anchor="middle"');
  s += `<text class="axis-label" transform="translate(${X1 + 50} ${(Y0 + Y1) / 2}) rotate(90)" text-anchor="middle">Humidity ratio, W [g water / kg dry air]</text>`;
  return s;
}

/* ---------- dynamic layer ---------- */
function buildFg(d) {
  if (d.mode === 'duct') return buildFgDuct(d);
  if (d.mode === 'tower') return buildFgTower(d);
  const {a, b, pr, p} = d;
  const pts = [a, b].map(q => [sx(q.t), sy(q.Wg)]);
  let s = '';
  for (const q of [a, b]) {
    const x = sx(q.t), y = sy(q.Wg), xs = sx(q.tdp);
    s += `<line class="drop" x1="${x}" x2="${x}" y1="${y}" y2="${Y1}"/>`;
    s += `<line class="drop" x1="${xs}" x2="${x}" y1="${y}" y2="${y}"/>`;
  }
  if (state.layers.sl && Math.abs(pr.dt) > 0.05 && Math.abs(pr.dWg) > 0.005) {
    const c = [sx(b.t), sy(a.Wg)];
    s += path([pts[0], c, pts[1]], 'split');
    s += text((pts[0][0] + c[0]) / 2, c[1] + (pr.dt > 0 ? 14 : -6), 'sensible', 'split-label', 'text-anchor="middle"');
    s += text(c[0] + (pr.dWg > 0 ? 6 : 6), (c[1] + pts[1][1]) / 2 + 4, 'latent', 'split-label');
  }
  if (pr.adp && pr.adp.s > 1.0005 && pr.adp.t >= TMIN) {
    const x = [sx(pr.adp.t), sy(pr.adp.W * 1000)];
    s += path([pts[1], x], 'adp-line');
    s += `<rect x="${x[0] - 4}" y="${x[1] - 4}" width="8" height="8" fill="#fffefa" stroke="#19363d" stroke-width="1.6" transform="rotate(45 ${x[0]} ${x[1]})"><title>Apparatus dew point ${fx(pr.adp.t, 2)} °C</title></rect>`;
    s += text(x[0] - 9, x[1] + 4, 'ADP', 'state-label', 'text-anchor="end"');
  }
  if (Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) > 1) {
    s += path(pts, 'proc');
    const mx = (pts[0][0] + pts[1][0]) / 2, my = (pts[0][1] + pts[1][1]) / 2;
    const ang = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) * 180 / Math.PI;
    s += `<path d="M-7 -6L3 0L-7 6" fill="none" stroke="#19363d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(${mx} ${my}) rotate(${ang})"/>`;
  }
  [a, b].forEach((q, i) => {
    const [x, y] = pts[i];
    s += `<g class="handle" data-i="${i}"><title>State ${i + 1} (${i ? 'outlet' : 'inlet'}): ${fx(q.t, 2)} °C, ${fx(q.Wg, 2)} g/kg, ${fx(q.rh, 1)} % RH</title>`;
    if (state.active === i) s += `<circle class="ring" cx="${x}" cy="${y}" r="17"/>`;
    s += `<circle cx="${x}" cy="${y}" r="26" fill="transparent"/><circle class="state-badge" cx="${x}" cy="${y}" r="11"/>` + text(x, y, i + 1, 'badge-text') + '</g>';
  });
  return s;
}
const arrow = (p0, p1, col) => {
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
  return `<path d="M-7 -6L3 0L-7 6" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(${mx} ${my}) rotate(${ang})"/>`;
};
function buildFgDuct({r}) {
  const pts = r.states.map(q => [sx(q.t), sy(q.Wg)]), far = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]) > 1;
  let s = '';
  r.states.forEach((q, i) => { s += `<line class="drop" x1="${pts[i][0]}" x2="${pts[i][0]}" y1="${pts[i][1]}" y2="${Y1}"/>`; });
  s += `<line class="drop" x1="${sx(r.states[0].tdp)}" x2="${pts[0][0]}" y1="${pts[0][1]}" y2="${pts[0][1]}"/>`;
  r.steps.forEach((st, i) => {
    const u = pts[i], v = pts[i + 1];
    if (st.type === 'coil') {
      if (st.wet && st.active && st.cfg.tc >= TMIN) {
        const x = [sx(st.cfg.tc), sy(st.Wc * 1000)];
        if (far(v, x)) {
          s += path([v, x], 'adp-line');
          s += `<rect x="${x[0] - 4}" y="${x[1] - 4}" width="8" height="8" fill="#fffefa" stroke="#19363d" stroke-width="1.6" transform="rotate(45 ${x[0]} ${x[1]})"><title>C${i + 1} coil surface (apparatus dew point) ${fx(st.cfg.tc, 2)} °C</title></rect>`;
        }
      }
      if (far(u, v)) s += path([u, v], 'proc') + arrow(u, v, '#19363d');
    } else if (far(u, v)) {
      const cls = st.cfg.hum === 'steam' ? 'hum-steam' : 'hum-water';
      s += path([u, v], cls) + arrow(u, v, st.cfg.hum === 'steam' ? '#c15a2c' : '#3372a3');
    }
  });
  let k = 0;
  const marks = r.states.map((q, i) => {
    k = i > 0 && !far(pts[i], pts[i - 1]) ? k + 1 : 0;
    return [pts[i][0] + 24 * k, pts[i][1] - (k ? 16 : 0)];
  });
  for (let i = r.states.length - 1; i >= 0; i--) {
    const q = r.states[i], [x, y] = marks[i], drag = i === 0;
    s += `<g ${drag ? 'class="handle" data-i="0"' : ''}><title>State ${i + 1}: ${fx(q.t, 2)} °C, ${fx(q.Wg, 2)} g/kg, ${fx(q.rh, 1)} % RH</title>${drag ? `<circle class="ring" cx="${x}" cy="${y}" r="17"/><circle cx="${x}" cy="${y}" r="26" fill="transparent"/>` : ''}<circle class="state-badge" cx="${x}" cy="${y}" r="11"/>${text(x, y, i + 1, 'badge-text')}</g>`;
  }
  return s;
}
function drawDuct({a, r}) {
  const n = r.steps.length, SP = 120, BW = 90, X0d = 110, cy = 185;
  const end = X0d + (n + 1) * SP + n * BW, W = end + 92;
  const T = (x, y, s_, cls, anc = 'middle') => text(x, y, s_, cls, `text-anchor="${anc}"`);
  $('duct').setAttribute('viewBox', `0 0 ${W} 330`);
  let s = '<defs><marker id="flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#56746c"/></marker></defs>';
  s += `<rect class="duct" x="${X0d}" y="140" width="${end - X0d}" height="90" rx="6"/>`;
  s += `<path d="M${end + 6} ${cy}H${W - 22}" fill="none" stroke="#56746c" stroke-width="2.5" marker-end="url(#flow)"/>`;
  s += `<path d="M30 ${cy}H${X0d - 6}" fill="none" stroke="#56746c" stroke-width="2.5" marker-end="url(#flow)"/>`;
  s += T(30, 160, 'Inlet air', 'device-note', 'start') + T(W - 22, 160, 'Supply air', 'device-note', 'end');
  r.states.forEach((q, i) => {
    const x = X0d + SP / 2 + i * (SP + BW);
    s += `<g><title>State ${i + 1}</title><circle cx="${x}" cy="${cy}" r="12" class="state-badge"/>${text(x, cy, i + 1, 'badge-text')}</g>`;
    s += T(x, 262, `t = ${fx(q.t, 1)} °C`, 'device-note') + T(x, 277, `φ = ${fx(q.rh, 0)} %`, 'device-note') + T(x, 292, `W = ${fx(q.Wg, 1)} g/kg`, 'device-note');
  });
  r.steps.forEach((st, i) => {
    const c = st.cfg, bx = X0d + SP + i * (SP + BW), cx = bx + BW / 2, id = `C${i + 1}`;
    if (c.type === 'coil') {
      const heat = c.kind === 'heat', fill = !st.active ? '#eef0ea' : heat ? '#fbe7d6' : '#dff1ed';
      s += `<rect x="${bx + 5}" y="128" width="${BW - 10}" height="114" rx="6" fill="${fill}" stroke="#78918b"/>`;
      for (let k = 0; k < 6; k++) s += `<line class="fin" x1="${bx + 18 + k * 11.5}" x2="${bx + 18 + k * 11.5}" y1="136" y2="234"/>`;
      s += T(cx, 96, `${id} · ${heat ? 'Heating coil' : 'Cooling coil'}`, 'device-label') + T(cx, 112, st.active ? `surface ${fx(c.tc, 1)} °C · BF ${fx(c.bf, 2)}` : 'no effect on this air', 'device-note');
      if (st.wet && st.mc > 0) s += `<path d="M${cx} 242V288" fill="none" stroke="#56746c" stroke-width="2" marker-end="url(#flow)"/>` + T(cx, 306, `condensate ${fx(st.mc * 3600, 2)} kg/h`, 'device-note');
    } else {
      const steam = c.hum === 'steam', col = steam ? '#c15a2c' : '#3372a3';
      s += `<rect x="${bx + 5}" y="128" width="${BW - 10}" height="114" rx="6" fill="${steam ? '#fbe7d6' : '#e3eef7'}" stroke="#78918b"/>`;
      for (let k = 0; k < 3; k++) s += `<circle cx="${bx + 22 + k * 23}" cy="${150 + (k % 2) * 8}" r="3.5" fill="${col}"/>`;
      s += T(cx, 262, `${id} · Humidifier`, 'device-label');
      if (st.dW > 1e-9) {
        s += `<path d="M${cx} 40V122" fill="none" stroke="${col}" stroke-width="2.5" marker-end="url(#flow)"/>` + T(cx + 10, 62, `${steam ? 'steam' : 'water'} ${fx(c.tinj, 0)} °C`, 'device-note', 'start') + T(cx + 10, 78, `${fx(st.mInj * 3600, 2)} kg/h`, 'device-note', 'start');
        s += T(cx, 278, `ΔW = ${fx(st.dW * 1000, 2)} g/kg`, 'device-note');
      } else s += T(cx, 278, 'off (no injection)', 'device-note');
    }
  });
  if (!n) s += T((X0d + end) / 2, 120, 'Empty duct · add components with the buttons on the left', 'device-note');
  s += T(W - 5, 322, 'Not to scale', 'device-note', 'end');
  $('duct').innerHTML = s;
}
const svg = $('chart');
svg.innerHTML = `<defs><clipPath id="chart-clip"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath></defs><g id="bg"></g><g id="fg"></g>`;
function renderChart(d) {
  if (!d) return;
  const key = `${d.p.toFixed(4)}|${wTop}|${Object.values(state.layers).join('')}`;
  if (key !== bgKey) { $('bg').innerHTML = buildBg(d.p); bgKey = key; }
  $('fg').innerHTML = buildFg(d);
}

/* ---------- chart interaction ---------- */
function dataAt(e) {
  const m = svg.getScreenCTM && svg.getScreenCTM();
  if (!m || !svg.createSVGPoint) return null;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(m.inverse());
  return {x: q.x, y: q.y, t: (q.x - X0) / (X1 - X0) * (TMAX - TMIN) + TMIN, Wg: (Y1 - q.y) / (Y1 - Y0) * wTop};
}
function place(i, t, Wg) {
  const s = state.s[i], p = P();
  s.t = clamp(t, TMIN, TMAX);
  const W = clamp(Wg / 1000, 0, M.Wmax(s.t, p));
  s.val = M.valueOf(s.t, W, s.kind, p);
  state.preset = false; update();
}
function nearestHandle(d) {
  const {a, b} = lastDerived;
  const dist = (state.mode === 'duct' ? [a] : [a, b]).map(q => Math.hypot(sx(q.t) - d.x, sy(q.Wg) - d.y));
  const i = dist.length === 1 || dist[0] <= dist[1] ? 0 : 1;
  return dist[i] <= 26 ? i : -1;
}
svg.addEventListener('pointerdown', e => {
  const d = dataAt(e); if (!d || !lastDerived) return;
  const inPlot = d.x >= X0 - 4 && d.x <= X1 + 4 && d.y >= Y0 - 4 && d.y <= Y1 + 4;
  const h = nearestHandle(d);
  if (h >= 0) { state.active = h; drag = {id: e.pointerId, i: h, moved: false}; }
  else if (inPlot) {
    if (e.pointerType === 'touch') { drag = {id: e.pointerId, i: state.active, tap: true, x: e.clientX, y: e.clientY}; return; }
    drag = {id: e.pointerId, i: state.active, moved: true};
    place(state.active, d.t, d.Wg);
  } else return;
  try { svg.setPointerCapture(e.pointerId); } catch (_) {}
  if (!drag.tap) e.preventDefault();
  sync();
});
svg.addEventListener('pointermove', e => {
  const d = dataAt(e); if (!d) return;
  if (drag && drag.id === e.pointerId && !drag.tap) { drag.moved = true; place(drag.i, d.t, d.Wg); }
  readout(d);
});
const endDrag = e => {
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.tap && e.type === 'pointerup' && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) {
    const d = dataAt(e); if (d) place(drag.i, d.t, d.Wg);
  }
  drag = null;
};
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
svg.addEventListener('pointerleave', () => { if (!drag) $('cursor').textContent = 'Move the pointer over the chart to read values.'; });
function readout(d) {
  const p = P();
  if (d.t < TMIN || d.t > TMAX || d.Wg < 0 || d.Wg > wTop) return;
  const W = d.Wg / 1000, ws = M.Ws(d.t, p);
  $('cursor').textContent = W > ws
    ? `t = ${fx(d.t, 1)} °C · W = ${fx(d.Wg, 2)} g/kg · above saturation`
    : `t = ${fx(d.t, 1)} °C · W = ${fx(d.Wg, 2)} g/kg · φ = ${fx(100 * M.pwOfW(W, p) / M.pws(d.t), 1)} % · h = ${fx(M.enthalpy(d.t, W), 1)} kJ/kg`;
}
$('chart-scroll').addEventListener('keydown', e => {
  const keys = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1]};
  if (!keys[e.key] || !lastDerived) return;
  e.preventDefault();
  const k = e.shiftKey ? 4 : 1, q = [lastDerived.a, lastDerived.b][state.active];
  place(state.active, q.t + keys[e.key][0] * 0.5 * k, q.Wg + keys[e.key][1] * 0.25 * k);
});

applyScenario();
})();
