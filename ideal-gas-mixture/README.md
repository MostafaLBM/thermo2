# Ideal gas mixture — Chapter 13

Open `index.html` via the course homepage. Uses the shared applet stylesheet and responsive Inputs / Results navigation. No dependencies or build step.

Adapted from the supplied Dalton’s law demo. Two species have masses 1 and 4. Default counts are 100 and 60, kT = 2.25, width = 4.5, height = 4.2, and diameter = 0 (ideal gas). Sliders and numeric fields control both counts, thermal energy, width, and diameter. Pause freezes the simulation; reset restores all defaults.

This is a 2D reduced-unit teaching model, not a 3D engineering property calculator. Ideal pressures are N_i kT / area. Measured pressures use wall momentum transfer with a two-second exponential average. Finite particle samples fluctuate. Positive diameter enables an approximate elastic hard-disk comparison; overlap correction and discrete timesteps limit accuracy, particularly at high crowding. Species wall-force contributions in this mode are not Dalton’s hypothetical isolated-gas pressures. Changing inputs clears pressure averaging. Empty mixtures have zero pressure and undefined pressure ratio.

Finite velocity samples are normalized separately in x and y for each species to satisfy m Σv_axis² = N kT on initialization, count/temperature changes, and return to diameter zero. This removes persistent random temperature offsets in the collisionless ideal case; wall-pressure measurements still fluctuate over their averaging window.
