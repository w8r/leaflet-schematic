import tape from 'tape';
import SvgOverlay from '../src/schematic';

const leafletCss = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.0-rc.2/leaflet.css';

const createMap = () => {
  let container = document.createElement('div');
  container.style.width = container.style.height = '500px';

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

tape('Schematic error handling', (t) => {

  t.test(' Pending network status', (t) => {
    const map = createMap();
    const schematicUrl = 'schematic_url';
    let svg = new SvgOverlay(schematicUrl, {
      usePathContainer: true,
      weight: 0.25,
      useRaster: true,
      load: function(url, callback) {
        t.equal(url, schematicUrl, 'requested url');
        // Skipp callback to emulate pending
        // callback(null, svgString);
      }
    })
      .once('load', function () {
        map.fitBounds(this.getBounds(), { animate: false });
      }).addTo(map);

    t.timeoutAfter(300);

    setTimeout(function() {
      var exception = false;

      try {
        map.removeLayer(svg);
      } catch (e) {
        exception = true;
      }

      t.notOk(exception, 'Schematic can be removed without loading');
    }, 100);

    t.plan(2);
  });

  t.end();
});
