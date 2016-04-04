var L = require('leaflet');
var SvgOverlay = global.SvgOverlay = require('../../src/svgoverlay3');
var xhr = global.xhr = require('xhr');

global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
  minZoom: 0,
  maxZoom: 20,
  center: [0, 0],
  zoom: 1,
  crs: L.CRS.Simple,
  inertia: !L.Browser.ie
});

var svg = global.svg = null;

map.on('click', function(e) {
  console.log('map', e.originalEvent.target);
});

var select = document.querySelector('#select-schematic');
function onSelect() {
  if (svg) map.removeLayer(svg);

  svg = global.svg = new SvgOverlay(this.value, {
    usePathContainer: true,
    //useRaster: true,
    load: function(url, callback) {
      xhr({
        uri: url,
        headers: {
          "Content-Type": "image/svg+xml"
        }
      }, function (err, resp, svg) {
        callback(err, svg);
      });
    }
  })
    .once('load', function() {
      map.fitBounds(svg.getBounds(), { animate: false });
    }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select)
