var L = global.L || require('leaflet');
var SvgOverlay = require('../../src/svgoverlay');
global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
  minZoom: 1,
  maxZoom: 20,
  center: [0, 0],
  zoom: 1,
  crs: L.CRS.Simple,
  inertia: !L.Browser.ie
});

var drawnItems = L.featureGroup().addTo(map);
var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    }
});
map.on('draw:created', function (e) {
  map.addLayer(e.layer);
});

var svg = global.svg = null;

map.on('click', function(e) {
  console.log('map', e.originalEvent.target);
});

var select = document.querySelector('#select-schematic');
function onSelect() {
  console.log(this.value);
  if (svg) map.removeLayer(svg);

  svg = global.svg = new SvgOverlay(this.value)
    .once('load', function() {
      map.fitBounds(svg.getBounds(), { animate: false });
    }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select)
