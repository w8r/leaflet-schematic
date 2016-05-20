var L = require('leaflet');
require('leaflet-editable');

L.EditControl = L.Control.extend({

  options: {
    position: 'topleft',
    callback: null,
    renderer: null,
    kind: '',
    html: ''
  },

  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar'),
      link = L.DomUtil.create('a', '', container);
    var editTools = map.editTools;

    link.href = '#';
    link.title = 'Create a new ' + this.options.kind;
    link.innerHTML = this.options.html;
    L.DomEvent
      .on(link, 'click', L.DomEvent.stop)
      .on(link, 'click', function () {
        window.LAYER = editTools[this.options.callback].call(editTools, null, {
          renderer : this.options.renderer
        });
      }, this);

    return container;
  }

});


L.NewLineControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startPolyline',
    kind: 'line',
    html: '\\/\\'
  }
});


L.NewPolygonControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startPolygon',
    kind: 'polygon',
    html: '▰'
  }
});

L.NewMarkerControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startMarker',
    kind: 'marker',
    html: '🖈'
  }

});

L.NewRectangleControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startRectangle',
    kind: 'rectangle',
    html: '⬛'
  }
});

L.NewCircleControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startCircle',
    kind: 'circle',
    html: '⬤'
  }
});

module.exports = {
  Marker: L.NewMarkerControl,
  Line: L.NewLineControl,
  Polygon: L.NewPolygonControl,
  Rectangle: L.NewRectangleControl,
  Circle: L.NewCircleControl
};
