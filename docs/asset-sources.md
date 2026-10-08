# Element sources: what's off-the-shelf vs hand-rolled (2026-10-07)

| Element | Off-the-shelf | Hand-rolled part | Reference |
|---|---|---|---|
| Arcs + comet | globe.gl arcsData (arcDashLength/Gap/AnimateTime, gradient arcColor, arcStroke tube) | two-layer arc config (~20 lines) | https://vasturiano.github.io/globe.gl/example/random-arcs/ |
| Arc noise-dissolve after delivery | — | custom shader (v0.2) | Shopify BFCM 2023 globe post; psrdnoise https://github.com/stegu/psrdnoise |
| Dotted land | hexPolygonsData + hexPolygonUseDots + Natural Earth 110m countries GeoJSON | none | https://vasturiano.github.io/globe.gl/example/hexed-polygons/ |
| Night texture / stars | three-globe example images earth-night.jpg, night-sky.png | none | //unpkg.com/three-globe/example/img/ |
| Atmosphere | showAtmosphere / atmosphereColor / atmosphereAltitude | none | globe.gl README |
| Home beacon | ringsData (ripples) + pointsData/objectsData (light pillar) | small glow sprite | https://vasturiano.github.io/globe.gl/example/random-rings/ |
| Home 3D model (optional, zoomed-in only) | Kenney "House" CC0 via Poly Pizza (glTF) → objectsData | emissive/wireframe material swap | https://poly.pizza/m/7VSVwAg2T3 |
| Hub dots | pointsData (altitude 0) or particlesData | size by visit count | globe.gl README Particles layer |
| Delivery firework | particlesData or THREE.Points | ~50-line burst animation | Shopify post "Fireworks" |
| Bloom | postProcessingComposer() + three UnrealBloomPass | none | three.js examples/jsm/postprocessing |
| Camera fly | pointOfView({lat,lng,altitude}, ms) | horizon tilt via controls (optional) | globe.gl README; Shopify "Camera Animations" |
| Labels on hover | arcLabel / htmlElementsData | HTML/CSS | https://vasturiano.github.io/globe.gl/example/html-markers/ |
| UI icons | Lucide | none | https://lucide.dev |
| Carrier logos | Simple Icons (ups, fedex, usps, dhl present) — trademarks, follow brand rules | none | https://simpleicons.org |
| Fonts | Inter, JetBrains Mono (OFL) | none | Google Fonts |
| Postmark / stamp | — | hand-made SVG | — |
| Year card export | offscreen globe preserveDrawingBuffer + canvas compositing (or html-to-image for DOM parts) | layout | — |

Decision: no realistic house on the globe by default — at globe scale it's a few pixels and clashes with the glow style. Home = amber beacon (ripple rings + thin light pillar). Kenney house only as an optional zoomed-in easter egg.
