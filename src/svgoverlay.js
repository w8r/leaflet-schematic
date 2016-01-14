var SvgLayer = require('./svglayer');
var xhr = require('xhr');

function isNode(o){
  return (
    typeof Node === 'object' ?
    o instanceof Node :
    o && typeof o === 'object' &&
    typeof o.nodeType === 'number' &&
    typeof o.nodeName === 'string'
  );
}

function getVieBox(svg) {


}

function getBBox(svg) {
  var viewBox = svg.getAttribute('viewBox');
  var bbox;
  if (viewBox) {
    bbox = viewBox.split(' ').map(parseFloat);
  } else {
    document.body.appendChild(svg);
    bbox = svg.getBBox();
    document.body.removeChild(svg);
    bbox = [bbox.x, bbox.y, bbox.width, bbox.height];
  }
  return [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
}


L.Bounds.prototype.toBBox = function() {
  return [this.min.x, this.min.y, this.max.x, this.max.y];
};


L.Bounds.prototype.scale = function(value) {
  var max = this.max;
  var min = this.min;
  var deltaX = ((max.x - min.x) / 2) * (value - 1);
  var deltaY = ((max.y - min.y) / 2) * (value - 1);

  return new L.Bounds([
    [min.x - deltaX, min.y - deltaY],
    [max.x + deltaX, max.y + deltaY]
  ]);
};


function getSVGContainer(str) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = str;
  return wrapper.querySelector('svg');
}


/**
 * @return {Array.<Number>}
 */
L.LatLngBounds.prototype.toBBox = function() {
  return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()];
};


/**
 * @param  {Number} value
 * @return {L.LatLngBounds}
 */
L.LatLngBounds.prototype.scale = function(value) {
  var ne = this._northEast;
  var sw = this._southWest;
  var deltaX = ((ne.lng - sw.lng) / 2) * (value - 1);
  var deltaY = ((ne.lat - sw.lat) / 2) * (value - 1);

  return new L.LatLngBounds([
    [sw.lat - deltaY, sw.lng - deltaX],
    [ne.lat + deltaY, ne.lng + deltaX]
  ]);
};


module.exports = SvgLayer.extend({

  options: {
    padding: 0
  },


  initialize: function(svg, bounds, options) {
    this._svg    = svg;
    this._bounds = bounds;

    this._ratio = 1;

    if (typeof svg === 'string' && !/\<svg/ig.test(svg)) {
      this._svg = null;
      this._url = svg;
    }

    this._group = null;

    L.Util.setOptions(this, options);
  },


  /**
   * @return {L.Point}
   */
  getOriginalSize: function() {
    var bbox = this._bbox;
    return new L.Point(
      Math.abs(bbox[0] - bbox[2]),
      Math.abs(bbox[1] - bbox[3])
    );
  },


  onLoad: function(svg) {
    svg = getSVGContainer(svg);
    var bbox = this._bbox = getBBox(svg);
    var minZoom = this._map.getMinZoom();

    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(
      this._map.unproject([bbox[0], bbox[3]], minZoom),
      this._map.unproject([bbox[2], bbox[1]], minZoom)
    );

    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (size.y !== mapSize.y) {
      var ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      console.log(ratio, this._bounds.scale(ratio).toBBox(), this._bounds.toBBox(), size, mapSize);
      this._bounds = this._bounds.scale(ratio);
      this._ratio = ratio;
    }

    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(
      1, this._origin.x, 1, this._origin.y);


    this._group = L.Path.prototype._createElement('g');
    this._pathRoot.appendChild(this._group);
    this._group.innerHTML = svg.innerHTML;

    this._reset();

    this.fire('load');

    console.log('size', size, '\nbbox', bbox, '\nratio', ratio);
  },


  getBounds: function() {
    return this._bounds;
  },


  load: function() {
    xhr({
      uri: this._url,
      headers: {
        "Content-Type": "image/svg+xml"
      }
    }, function (err, resp, svg) {
      this.onLoad(svg);
    }.bind(this))
  },


  onAdd: function(map) {
    SvgLayer.prototype.onAdd.call(this, map);
    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }
    return this;
  },


  onRemove: function(map) {
    SvgLayer.prototype.onRemove.call(this, map);
    return this;
  },


  _endPathZoom: function() {
    this._reset();
    SvgLayer.prototype._endPathZoom.call(this);
  },


  _reset: function () {
    var image   = this._group;
    var scale   = Math.pow(2, this._map.getZoom() - 1) * this._ratio;
    var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    var size    = this.getOriginalSize().multiplyBy(scale);

    console.log(topLeft, size, scale, this._bounds.getNorthWest());
    this._group.style[L.DomUtil.TRANSFORM] =
       L.DomUtil.getTranslateString(topLeft) + ' scale(' + scale + ') ';
  },


});
