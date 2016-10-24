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
    zoom: 2,
    editable: true,
    crs: L.Util.extend({}, L.CRS.Simple, {
      infinite: false
    }),
    inertia: !L.Browser.ie
  });

  return map;
}

const width  = 500;
const height = 500;

const svgString = `
  <svg viewBox="0 0 ${width} ${height}">
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
          'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNTAwIDUwMCI+CiAgICA8Y2lyY2xlIGN4PSIyNTAiIGN5PSIyNTAiIHI9IjEwMCIgZmlsbD0iI2ZmMDAwMCIgaWQ9ImNpcmNsZSIvPgogIDwvc3ZnPg==', 'Base64');
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
    t.plan(4);
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
      setTimeout(() => {
        let schematic = evt.target;
        t.ok(schematic._canvasRenderer, 'canvas renderer is present');
        t.ok(schematic._raster, 'raster replacement is there');
        t.equals(schematic._rawData.indexOf('width="500"'), -1, 'width removed from processed');
        t.equals(schematic._rawData.indexOf('height="500"'), -1, 'height removed from processed');
      });
    }).addTo(map);
  });

  t.test(' export', (t) => {
    t.plan(10);

    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      weight: 0,
      useRaster: true,
      load: (url, callback) => callback(null, svgString)
    })
    .once('add',  (evt) => {
      setTimeout(() => {
        const schematic = evt.target;
        const zoom = map.getZoom();
        const exported = schematic.exportSVG();

        //console.log(map.getZoom(), schematic.exportSVG(true), matrix, 1 / Math.pow(2, map.getZoom()));

        t.equals(Object.prototype.toString.call(exported), '[object SVGSVGElement]', 'exports SVG element by default');
        t.equals(exported.firstChild.className.baseVal, 'svg-overlay', 'initial document is included');
        t.ok(exported.firstChild.querySelector('circle'), 'contents are there');
        t.equals(typeof schematic.exportSVG(true), 'string', 'optionally exports string');

        let exportedOverlay = schematic.exportSVG(false, true);
        t.equals(exportedOverlay.firstChild.className.baseVal, 'clip-group', 'optionally exports only clipped overlays as node');
        t.equals(typeof schematic.exportSVG(true, true), 'string', 'or as a string');

        let matrix = exported.querySelector('.clip-group').firstChild.getAttribute('transform');
        matrix = matrix.substring(7, matrix.length - 1).split(',').map(parseFloat);

        let scale = 1 / Math.pow(2, map.getZoom());
        t.equals(matrix[0], scale, 'x-scale');
        t.equals(matrix[3], scale, 'y-scale');

        t.equals(matrix[4], -width / (2 * Math.pow(2, zoom)), 'x positioned at scale');
        t.equals(matrix[4], -height / (2 * Math.pow(2, zoom)), 'y positioned at scale');
      });
    }).addTo(map);
  });

  t.end();
});
