var L = require('leaflet');
var SvgOverlay = global.SvgOverlay = require('../../src/svgoverlay');
var xhr = global.xhr = require('xhr');

//global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
  minZoom: 0,
  maxZoom: 20,
  center: [0, 0],
  zoom: 1,
  crs: L.Util.extend({}, L.CRS.Simple, {
    //transformation: new L.Transformation(1/0.03632478632478633, 0, -1/0.03632478632478633, 0),
    transformation: new L.Transformation(2, 0, -2, 0),
    //bounds: L.bounds([-200*180, -200*90], [200*180, 200*90]),
    infinite: false
  }),
  inertia: !L.Browser.ie
});

L.SVG.prototype.options.padding = 0.5;

var svg = global.svg = null;

map.on('click', function(evt) {
  console.log('map', evt.originalEvent.target,
    evt.latlng, svg.projectPoint(evt.latlng));
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
      // global.rect = L.rectangle(svg.getBounds().pad(-0.25), {
      //   renderer: svg._renderer
      // }).addTo(map);
    }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select)
