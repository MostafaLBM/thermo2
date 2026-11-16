/* Moist-air model: ASHRAE Handbook-Fundamentals (2017) ch. 1 correlations, SI.
   Plain script (no modules, no workers) so the applet also runs from file://.
   Humidity ratio W is kg water / kg dry air internally; kind 'w' is g/kg at the interface. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Psychro = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const EPS = 0.621945;          // M_water / M_dry-air
  const RDA = 0.287042;          // kJ/(kg K), dry air
  const TMIN = 0, TMAX = 50;     // chart window, °C (ASHRAE Chart No. 1)
  const WCAP = 30;               // chart window, g/kg
  const CPA = 1.006, CPV = 1.86, HG0 = 2501;

  /* Standard atmosphere, kPa, geometric altitude Z in m (troposphere). */
  const pAtm = Z => 101.325 * Math.pow(1 - 2.25577e-5 * Z, 5.2559);

  /* Saturation pressure of water (t >= 0) or ice (t < 0), kPa; Hyland-Wexler. */
  function pws(t) {
    const T = t + 273.15;
    const lnp = t < 0
      ? -5.6745359e3 / T + 6.3925247 - 9.677843e-3 * T + 6.2215701e-7 * T * T + 2.0747825e-9 * T ** 3 - 9.484024e-13 * T ** 4 + 4.1635019 * Math.log(T)
      : -5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T * T - 1.4452093e-8 * T ** 3 + 6.5459673 * Math.log(T);
    return Math.exp(lnp) / 1000;
  }
  const Ws = (t, p) => { const e = pws(t); return EPS * e / (p - e); };
  const Wmax = (t, p) => Math.min(Ws(t, p), WCAP / 1000);
  const pwOfW = (W, p) => p * W / (EPS + W);
  const enthalpy = (t, W) => CPA * t + W * (HG0 + CPV * t);
  const volume = (t, W, p) => RDA * (t + 273.15) * (1 + 1.607858 * W) / p;

  function dewPoint(pw) {
    let lo = -90, hi = 100;
    if (pw <= pws(lo)) return lo;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (pws(m) < pw) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  /* W of moist air at dry bulb t whose thermodynamic wet bulb is tw (ASHRAE eq. 33 / 35). */
  function wbW(t, tw, p) {
    const Wsw = Ws(tw, p);
    return tw >= 0
      ? ((HG0 - 2.326 * tw) * Wsw - CPA * (t - tw)) / (HG0 + CPV * t - 4.186 * tw)
      : ((2830 - 0.24 * tw) * Wsw - CPA * (t - tw)) / (2830 + CPV * t - 2.1 * tw);
  }
  function wetBulb(t, W, p) {
    if (W >= Ws(t, p)) return t;
    let lo = -60, hi = t;
    if (wbW(t, lo, p) >= W) return lo;
    for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (wbW(t, m, p) > W) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }

  /* Unclamped W from (t, kind, val). kind: rh [%], wb [°C], dp [°C], w [g/kg], h [kJ/kg]. */
  function wRaw(t, kind, val, p) {
    switch (kind) {
      case 'rh': { const e = val / 100 * pws(t); return EPS * e / (p - e); }
      case 'wb': return wbW(t, Math.min(val, t), p);
      case 'dp': { const e = pws(Math.min(val, t)); return EPS * e / (p - e); }
      case 'w': return val / 1000;
      case 'h': return (val - CPA * t) / (HG0 + CPV * t);
    }
    return NaN;
  }
  const wFrom = (t, kind, val, p) => Math.max(0, Math.min(Wmax(t, p), wRaw(t, kind, val, p)));
  function valueOf(t, W, kind, p) {
    switch (kind) {
      case 'rh': return 100 * pwOfW(W, p) / pws(t);
      case 'wb': return wetBulb(t, W, p);
      case 'dp': return dewPoint(pwOfW(W, p));
      case 'w': return W * 1000;
      case 'h': return enthalpy(t, W);
    }
    return NaN;
  }
  /* Range of `kind` available at dry bulb t: from dry air to the chart/saturation limit. */
  function bounds(t, kind, p) {
    return [valueOf(t, kind === 'dp' ? 1e-4 : 0, kind, p), valueOf(t, Wmax(t, p), kind, p)];
  }

  function props(t, W, p) {
    const pw = pwOfW(W, p), v = volume(t, W, p);
    return { t, W, Wg: W * 1000, h: enthalpy(t, W), v, pw, rho: (1 + W) / v,
      rh: 100 * pw / pws(t), tdp: dewPoint(pw), twb: wetBulb(t, W, p), mu: W / Ws(t, p) };
  }

  /* Extend chord 1->2 beyond state 2 until it meets saturation (apparatus dew point). */
  function adp(a, b, p) {
    const dt = b.t - a.t, dW = b.W - a.W;
    if (!(dt < -1e-9 && dW < -1e-12)) return null;
    const g = s => a.W + s * dW - Ws(a.t + s * dt, p);
    if (g(1) >= -1e-9) return { s: 1, t: b.t, W: b.W };
    const smax = (a.t + 20) / -dt;
    let s0 = 1, s1 = null;
    for (let s = 1.01; s <= smax; s += 0.01) { if (g(s) >= 0) { s1 = s; break; } s0 = s; }
    if (s1 === null) return null;
    for (let i = 0; i < 50; i++) { const m = (s0 + s1) / 2; if (g(m) >= 0) s1 = m; else s0 = m; }
    const s = (s0 + s1) / 2;
    return { s, t: a.t + s * dt, W: a.W + s * dW };
  }

  function classify(a, b) {
    const dt = b.t - a.t, dWg = (b.W - a.W) * 1000, dh = b.h - a.h;
    const T = Math.abs(dt) < 0.05, H = Math.abs(dWg) < 0.005;
    if (T && H) return 'No process (states coincide)';
    if (H) return dt > 0 ? 'Sensible heating' : 'Sensible cooling';
    if (T) return dWg > 0 ? 'Isothermal humidification (steam)' : 'Isothermal dehumidification';
    if (dt > 0 && dWg > 0) return 'Heating and humidification';
    if (dt < 0 && dWg < 0) return 'Cooling and dehumidification';
    if (dt < 0 && dWg > 0) {
      if (Math.abs(b.twb - a.twb) < 0.2) return 'Evaporative cooling (adiabatic humidification, constant wet bulb)';
      return 'Cooling and humidification';
    }
    return Math.abs(dh) < 1 ? 'Adiabatic dehumidification (≈ constant enthalpy)' : 'Heating and dehumidification';
  }

  /* Process a -> b at volume flow Vdot [m³/s] measured at state a. Positive = added to the air. */
  function process(a, b, p, Vdot) {
    const dt = b.t - a.t, dW = b.W - a.W, dh = b.h - a.h;
    const qs = (CPA + CPV * a.W) * dt;            // sensible: t1 -> t2 at constant W1
    const ql = dW * (HG0 + CPV * b.t);            // latent: W1 -> W2 at t2
    const m = Vdot / a.v;                          // dry-air mass flow, kg/s
    const out = { dt, dW, dWg: dW * 1000, dh, qs, ql, m, Vout: m * b.v,
      Q: m * dh, Qs: m * qs, Ql: m * ql, mw: m * dW,
      SHR: Math.abs(dh) > 0.05 * (Math.abs(qs) + Math.abs(ql)) && Math.abs(dh) > 1e-6 ? qs / dh : null,   // undefined for (near-)adiabatic processes
      slope: Math.abs(dW) > 1e-7 ? dh / dW : null,
      name: classify(a, b), adp: null, beta: null, coil: null };
    if (dt < 0 && dW < 0) {
      out.coil = m * ((a.h - b.h) - (a.W - b.W) * 4.186 * b.t);   // heat removed, condensate leaves at t2
      const x = adp(a, b, p);
      if (x) { out.adp = x; out.beta = 1 / x.s; }
    }
    return out;
  }


  /* Duct components. Coil: {type:'coil', kind:'cool'|'heat', tc surface °C, bf bypass factor}.
     Humidifier: {type:'hum', hum:'steam'|'water', tinj °C, dw g/kg dry air}.
     A cooling coil only acts when its surface is below the air temperature, a heating coil only when above. */
  function coil(a, c, p) {
    const eff = 1 - c.bf, tc = c.tc, Wc = Ws(tc, p);
    const active = eff > 1e-9 && (c.kind === 'cool' ? tc < a.t : tc > a.t);
    if (!active) return { out: a, active: false, wet: false, eff, Wc, mcSpec: 0, hc: 4.186 * tc };
    const wet = c.kind === 'cool' && Wc < a.W;               // surface below the inlet dew point
    const t2 = a.t - eff * (a.t - tc);
    const W2 = Math.min(wet ? a.W - eff * (a.W - Wc) : a.W, Ws(t2, p));
    return { out: props(t2, W2, p), active: true, wet, eff, Wc, mcSpec: wet ? a.W - W2 : 0, hc: 4.186 * tc };
  }
  function humidifier(a, c, p) {
    const hinj = c.hum === 'steam' ? HG0 + CPV * c.tinj : 4.186 * c.tinj;   // kJ/kg water
    const solve = dW => { const W3 = a.W + dW; return { W3, t3: (a.h + dW * hinj - HG0 * W3) / (CPA + CPV * W3) }; };
    const feasible = dW => { const x = solve(dW); return x.W3 <= Ws(x.t3, p) + 1e-12 && x.W3 <= WCAP / 1000 + 1e-12 && x.t3 <= TMAX && x.t3 >= TMIN; };
    let lo = 0, hi = WCAP / 1000;
    if (feasible(hi)) lo = hi; else for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (feasible(m)) lo = m; else hi = m; }
    const dW = Math.max(0, Math.min(c.dw / 1000, lo)), x = solve(dW);
    return { out: props(x.t3, x.W3, p), dW, maxDW: lo, hinj, clamped: c.dw / 1000 > lo + 1e-9 };
  }
  const step = (a, c, p) => c.type === 'coil' ? coil(a, c, p) : humidifier(a, c, p);

  /* Run inlet a through the listed components. Vdot is the volume flow at a.
     Heat terms are air side, positive = added to the air. */
  function duct(a, comps, p, Vdot) {
    const m = Vdot / a.v, states = [a], steps = [];
    let Qc = 0, mc = 0, mInj = 0, Ehum = 0, cond = 0;
    for (const c of comps) {
      const cur = states[states.length - 1], r = step(cur, c, p), o = r.out;
      const st = { type: c.type, cfg: c, in: cur, out: o, ...r };
      if (c.type === 'coil') {
        st.mc = m * r.mcSpec; st.Q = m * (o.h - cur.h) + st.mc * r.hc;
        st.Qs = m * (CPA + CPV * cur.W) * (o.t - cur.t); st.Ql = m * (o.W - cur.W) * (HG0 + CPV * o.t);
        Qc += st.Q; mc += st.mc; cond += st.mc * r.hc;
      } else {
        st.mInj = m * r.dW; st.Ehum = st.mInj * r.hinj; mInj += st.mInj; Ehum += st.Ehum;
      }
      steps.push(st); states.push(o);
    }
    const last = states[states.length - 1];
    return { m, states, steps, Qcoils: Qc, mc, mInj, Ehum, Vout: m * last.v, dh: last.h - a.h,
      balance: m * (last.h - a.h) - (Qc - cond + Ehum) };
  }

  return { coil, humidifier, step, duct, EPS, RDA, TMIN, TMAX, WCAP, pAtm, pws, Ws, Wmax, pwOfW, enthalpy, volume, dewPoint, wbW, wetBulb,
    wRaw, wFrom, valueOf, bounds, props, adp, classify, process };
});
