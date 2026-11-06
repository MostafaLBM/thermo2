# Thermodynamics II course website

The course homepage is `index.html`. Applets are at `applets/rankine/index.html`
and `applets/vapor-compression/index.html`, each with a return link to the homepage.
The homepage and every applet reside in this same repository; no separate
applet repositories are needed.

## Preview

For local preview, double-click `Start-local-preview.cmd` (requires Python).
It serves the files on localhost and opens the course homepage. Keep its window
open while previewing; press Ctrl+C to stop. The refrigeration WebAssembly engine
requires HTTP(S), so double-clicking HTML files alone will not run that applet.

On GitHub Pages no installation, backend or build is needed. All styles,
graphics, scripts and property engines are bundled locally; there is no CDN
dependency and all calculations run in the browser.

## Publish to GitHub Pages

1. Create one public repository for the entire course, for example `thermodynamics-ii`.
2. Extract `thermodynamics-ii-website.zip` and upload its contents, keeping
   `index.html` at the repository root alongside `course.css`, `assets/`, and
   `applets/`.
3. Settings > Pages > Deploy from a branch > main > / (root) > Save.
4. If named `thermodynamics-ii`, the site will be at
   https://mostafalbm.github.io/thermodynamics-ii/ .

Relative URLs allow the same package to work under another repository name.

## Add another applet later

Create `applets/<name>/` and place the new applet's files there. Duplicate the
`article.applet` block in the homepage, update its title, description, image and
links, and update the available-app count. Link back from the new applet with
`../../index.html`. No router, registry, or JavaScript framework is required.

Rankine and vapor-compression applets are currently listed. Additional applets
can be added in this same repository. Both use the shared `assets/applet.css`.

## Course content

The title, instructor, course ID, contact address, overview, module names, and
textbook details were taken from the supplied Thermodynamics II course outline.
Meeting times, grading, and course documents have not been published here.

The cycle graphic on the homepage is schematic. The Rankine applet calculates
its actual diagrams and values. Refer to applets/rankine/README.md for the
493-case MATLAB comparison and browser checks, and to its third-party notices
for the property-engine attribution.

The refrigeration applet uses CoolProp 7.2.0 WebAssembly for all 15 original
refrigerants and includes all 30 application presets. See its README for the
390-case MATLAB validation and its third-party notices for attribution.


## Responsive applet layout

At widths of 700 px or less, both applets offer sticky Inputs / Results tabs, touch-sized controls, and direct numeric entry. Switching views preserves values and scroll positions. Diagrams and state tables can be swiped horizontally to keep labels readable. Wider screens show independently scrolling controls and results. Without JavaScript navigation, sections remain stacked and accessible.


## Joule–Thomson applet (Chapter 12)

Open applets/joule-thomson/index.html through the course server or website. Seven real fluids, an analytical ideal-gas comparison, local inlet derivative, numerical inversion overlay, two-phase outlet handling, and guided experiments. Reuses the CoolProp engine in applets/vapor-compression/vendor; retain that folder. See the applet README for assumptions and units. Validated against 39 Python CoolProp 7.2.0 reference states, finite-difference inlet slopes, enthalpy conservation, and positive entropy generation.

## Ideal gas mixture (Chapter 13)

Open `applets/ideal-gas-mixture/index.html` from the fourth homepage card. Two-species particle simulation with ideal partial-pressure comparison, numeric entry, and the shared responsive applet layout. See its README for units and model limits.
