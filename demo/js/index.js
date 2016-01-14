var L = global.L || require('leaflet');
var SvgOverlay = require('../../src/svgoverlay');
global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
    minZoom: 1,
    maxZoom: 20,
    center: [0, 0],
    zoom: 1,
    crs: L.CRS.Simple
});

var drawnItems = L.featureGroup().addTo(map);
var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems
    }
});
//map.addControl(drawControl);
map.on('draw:created', function (e) {
  map.addLayer(e.layer);
});

var svg = global.s = new SvgOverlay('data/3.svg')
.once('load', function() {
  map.fitBounds(svg.getBounds(), { animate: false });
}).addTo(map);


map.on('click', function(e) {
  console.log('map', e.originalEvent.target);
});
