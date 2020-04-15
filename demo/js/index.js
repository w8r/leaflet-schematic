var SvgOverlay = require('../../src/schematic');
var xhr = require('xhr');
var saveAs = require('browser-filesaver').saveAs;
var Draw = require('./editable');

//global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
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

var controls = global.controls = [
  new Draw.Line(),
  new Draw.Polygon(),
  new Draw.Rectangle()
];
controls.forEach(map.addControl, map);

L.SVG.prototype.options.padding = 0.5;

var svg = global.svg = null;

map.on('click', function (evt) {
  console.log('map', evt.originalEvent.target,
    evt.latlng, evt, map.hasLayer(svg) ? svg.projectPoint(evt.latlng) : evt);
});

var select = document.querySelector('#select-schematic');
function onSelect() {
  if (svg) {
    map.removeLayer(svg);
    map.off('mousemove', trackPosition, map);
  }

  svg = global.svg = new SvgOverlay(this.value, {
    usePathContainer: true,
    //opacity: 1,
    weight: 0.25,
    //useRaster: true,
    load: function (url, callback) {

      if ('pending' === url) {
        alert('Test network pending, no data will be shown. Switch to another svg');
        return;
      }

      xhr({
        uri: url,
        headers: {
          'Content-Type': 'image/svg+xml'
        }
      }, function (err, resp, svg) {
        if (200 !== resp.statusCode) {
          err = resp.statusCode;
          alert('Network error', err);
        }
        callback(err, svg);
      });
    }
  })
    .once('load', function () {

      // use schematic renderer
      controls.forEach(function (control) {
        control.options.renderer = svg._renderer;
      });

      map.fitBounds(svg.getBounds(), { animate: false });
      map.on('mousemove', trackPosition, map);

    }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select);


L.DomEvent.on(document.querySelector('#dl'), 'click', function () {
  saveAs(new Blob([svg.exportSVG(true)]), 'schematic.svg');
});


function trackPosition(evt) {
  if (evt.originalEvent.shiftKey) {
    console.log(
      evt.latlng,
      svg.projectPoint(evt.latlng).toString(),
      svg.unprojectPoint(svg.projectPoint(evt.latlng)),
      evt.originalEvent.target
    );
  }
}
