import tape from 'tape';
import SvgOverlay from '../src/schematic';
import b64 from 'Base64'

const leafletCss = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0-rc.2/leaflet.css';

const createMap = () => {
  let container = document.createElement('div');
  container.style.width = container.style.height = '500px';
  document.body.appendChild(container);

  if (document.querySelector('#leaflet-style') === null) {
    let style  = document.createElement('link');
    style.rel  = 'stylesheet';
    style.type = 'text/css';
    style.href = leafletCss;
    style.id   = 'leaflet-style';

    document.head.appendChild(style);
  }

  const map = L.map(container, {
    minZoom: 0,
    maxZoom: 20,
    center: [0, 0],
    zoom: 1,
    editable: true,
    crs: L.Util.extend({}, L.CRS.Simple, {
      infinite: false
    }),
    inertia: !L.Browser.ie
  });

  return map;
}

const svgString = `
  <svg viewBox="0 0 500 500">
    <circle cx="250" cy="250" r="100" fill="#ff0000" id="circle" />
  </svg>`;

tape('Schematic layer', (t) => {

  t.test(' construct', (t) => {
    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      //opacity: 1,
      weight: 0.25,
      load: function(url, callback) {
        t.equal(url, schematicUrl, 'requested url');
        callback(null, svgString);
      }
    })
      .once('load', function (evt) {
        t.equals(evt.type, 'load', 'load event');
        t.equals(evt.target, this, 'evt target is schematic');
        t.deepEquals(this.getBounds().toBBox(), [ 0, -500, 500, 0 ], 'bounds calculated');
        t.ok(this.getDocument().querySelector('#circle'), 'content is present');
        t.deepEquals(this.getOriginalSize(), L.point(500, 500), 'get original size');
        map.fitBounds(this.getBounds(), { animate: false });

        t.equals(evt.target.toBase64(),
          'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNTAwIDUwMCIgd2lkdGg9IjUwMCIgaGVpZ2h0PSI1MDAiPgogICAgPGNpcmNsZSBjeD0iMjUwIiBjeT0iMjUwIiByPSIxMDAiIGZpbGw9IiNmZjAwMDAiIGlkPSJjaXJjbGUiLz4KICA8L3N2Zz4=', 'Base64');
      }).addTo(map);

    t.plan(7);
    t.end();
  });

  t.test(' projections', (t) => {
    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      //opacity: 1,
      weight: 0.25,
      load: (url, callback) => callback(null, svgString)
    })
    .once('load', function (evt) {
      map.fitBounds(this.getBounds(), { animate: false });
    })
    .once('add', (evt) => {
      t.deepEquals(evt.target.projectPoint(map.getCenter()),
        L.point(250, 250), 'project point');
      t.deepEquals(evt.target.unprojectPoint(L.point(250, 250)),
        map.getCenter(), 'unproject point');
      t.equals(evt.target.getRatio(), 1, 'ratio');
      t.deepEquals(evt.target._transformation,
        new L.Transformation(1, 250, 1, 250), 'transformation');
      t.deepEquals(
        evt.target.projectBounds(map.getBounds().pad(-0.25)).toBBox(),
        [ 125, 125, 375, 375 ], 'project bounds');
      t.deepEquals(
        evt.target.unprojectBounds(L.bounds([[125, 125], [375, 375]])).toBBox(),
        map.getBounds().pad(-0.25).toBBox(), 'unproject bounds');

      t.equals(typeof evt.target.project, 'function', 'project shortcut');
      t.equals(typeof evt.target.unproject, 'function', 'unproject shortcut');
    }).addTo(map);
    t.end();
  });

  t.test(' renderer', (t) => {
    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      //opacity: 1,
      weight: 0,
      useRaster: true,
      load: (url, callback) => callback(null, svgString)
    })
    .once('add',  (evt) => {
      let schematic = evt.target;
      t.ok(schematic._renderer instanceof L.SchematicRenderer, 'schematic renderer');
      t.equals(schematic._renderer.options.schematic, schematic, 'back reference is there');
      t.equals(schematic.getRenderer(), schematic._renderer, 'getter for renderer');
    }).addTo(map);

    t.end();
  });

  t.test(' alternative raster renderer', (t) => {
    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      //opacity: 1,
      weight: 0,
      useRaster: true,
      load: (url, callback) => callback(null, svgString)
    })
    .once('add',  (evt) => {
      let schematic = evt.target;
      t.ok(schematic._canvasRenderer, 'canvas renderer is present');
      t.ok(schematic._raster, 'raster replacement is there');
      t.equals(schematic._rawData.indexOf('width="500"'), -1, 'width removed from processed');
      t.equals(schematic._rawData.indexOf('height="500"'), -1, 'height removed from processed');
    }).addTo(map);

    t.end();
  });

  t.end();
});
