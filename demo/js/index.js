var L = require('leaflet');
var SvgOverlay = global.SvgOverlay = require('../../src/schematic');
var xhr = global.xhr = require('xhr');
var saveAs = require('browser-filesaver').saveAs;

//global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
  minZoom: 0,
  maxZoom: 20,
  center: [0, 0],
  zoom: 1,
  crs: L.Util.extend({}, L.CRS.Simple, {
    //transformation: new L.Transformation(1/0.03632478632478633, 0, -1/0.03632478632478633, 0),
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
  if (svg) {
    map.removeLayer(svg);
    map.off('mousemove', trackPosition, map);
  }

  svg = global.svg = new SvgOverlay(this.value, {
    usePathContainer: true,
    //opacity: 1,
    weight: 0.25,
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
      map.on('mousemove', trackPosition, map);

      global.rect = L.rectangle(svg.getBounds().pad(-0.25), {
         renderer: svg._renderer,
         weight: 1,
         color: 'green'
      }).addTo(map);

      // global.referenceRect = L.rectangle(svg.getBounds().pad(-0.25), {
      //     weight: 1,
      //     color: 'red'
      // }).addTo(map);

    }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select);


L.DomEvent.on(document.querySelector('#dl'), 'click', function() {
  saveAs(new Blob([svg.exportSVG(true)]), 'schematic.svg');
});


function trackPosition(evt) {
  if (evt.originalEvent.shiftKey) {
    console.log(
      evt.latlng,
      svg.projectPoint(evt.latlng).toString(),
      svg.unprojectPoint(svg.projectPoint(evt.latlng))
    );
  }
}

