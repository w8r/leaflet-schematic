(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).SVGOverlay = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = require('./src/svgoverlay');

},{"./src/svgoverlay":5}],2:[function(require,module,exports){
;(function () {

  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    var str = String(input);
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next str index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      str.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = str.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    var str = String(input).replace(/=+$/, '');
    if (str.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = str.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());

},{}],3:[function(require,module,exports){
'use strict';

var L = require('leaflet');

/**
 * @return {Array.<Number>}
 */
L.Bounds.prototype.toBBox = function () {
  return [this.min.x, this.min.y, this.max.x, this.max.y];
};

/**
 * @param  {Number} value
 * @return {L.Bounds}
 */
L.Bounds.prototype.scale = function (value) {
  var max = this.max;
  var min = this.min;
  var deltaX = (max.x - min.x) / 2 * (value - 1);
  var deltaY = (max.y - min.y) / 2 * (value - 1);

  return new L.Bounds([[min.x - deltaX, min.y - deltaY], [max.x + deltaX, max.y + deltaY]]);
};

/**
 * @return {Array.<Number>}
 */
L.LatLngBounds.prototype.toBBox = function () {
  return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()];
};

/**
 * @param  {Number} value
 * @return {L.LatLngBounds}
 */
L.LatLngBounds.prototype.scale = function (value) {
  var ne = this._northEast;
  var sw = this._southWest;
  var deltaX = (ne.lng - sw.lng) / 2 * (value - 1);
  var deltaY = (ne.lat - sw.lat) / 2 * (value - 1);

  return new L.LatLngBounds([[sw.lat - deltaY, sw.lng - deltaX], [ne.lat + deltaY, ne.lng + deltaX]]);
};

},{"leaflet":undefined}],4:[function(require,module,exports){
'use strict';

var L = require('leaflet');

module.exports = L.Class.extend({

  includes: L.Mixin.Events,

  options: {
    opacity: 1,
    padding: L.Path.CLIP_PADDING
  },

  /**
   * @class SvgLayer - basically, just the SVG container simiar to the one
   * used by leaflet internally to render vector layers
   *
   * @extends {L.Class}
   * @constructor
   * @param  {Object=} options
   */
  initialize: function initialize(options) {
    /**
     * @type {Element}
     */
    this._container = null;

    /**
     * @type {SVGElement}
     */
    this._pathRoot = null;

    /**
     * @type {L.Map}
     */
    this._map = null;

    /**
     * @type {L.Bounds}
     */
    this._pathViewport = null;

    /**
     * @type {Boolean}
     */
    this._pathZooming = false;

    L.Util.setOptions(this, options);
  },

  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  onAdd: function onAdd(map) {
    this._map = map;
    this._initPathRoot();
    return this;
  },

  /**
   * @param {L.Map} map
   * @return {SvgLayer}
   */
  addTo: function addTo(map) {
    map.addLayer(this);
    return this;
  },

  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  onRemove: function onRemove(map) {
    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      this._map.off({
        'zoomanim': this._animatePathZoom,
        'zoomend': this._endPathZoom
      }, this);
    }

    this._map.off('moveend', this._updateSvgViewport, this);
    this._map.getPanes().overlayPane.removeChild(this._container);
    return this;
  },

  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  removeFrom: function removeFrom(map) {
    map.removeLayer(this);
    return this;
  },

  /**
   * @return {SvgLayer}
   */
  bringToFront: function bringToFront() {
    var root = this._pathRoot.parentNode,
        path = this._pathRoot;

    if (path && root.lastChild !== path) {
      root.appendChild(path);
    }
    return this;
  },

  /**
   * @return {SvgLayer}
   */
  bringToBack: function bringToBack() {
    var root = this._pathRoot.parentNode;
    var path = this._pathRoot;
    var first = root.firstChild;

    if (path && first !== path) {
      root.insertBefore(path, first);
    }
    return this;
  },

  /**
   * Create svg root
   */
  _createRoot: function _createRoot() {
    this._pathRoot = L.Path.prototype._createElement('svg');
    this._container = L.DomUtil.create('div', 'leaflet-image-layer');
    this._container.appendChild(this._pathRoot);
  },

  /**
   * Init the root element
   */
  _initPathRoot: function _initPathRoot() {
    if (!this._pathRoot) {
      this._createRoot();
      this._map.getPanes().overlayPane.appendChild(this._container);

      if (this._map.options.zoomAnimation && L.Browser.any3d) {
        L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

        this._map.on({
          'zoomanim': this._animatePathZoom,
          'zoomend': this._endPathZoom
        }, this);
      } else {
        L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
      }

      this._map.on('moveend', this._updateSvgViewport, this);
      this._updateSvgViewport();
    }
  },

  /**
   * To override in the child classes
   * @return {L.Bounds}
   */
  _getViewport: function _getViewport() {
    return this._pathViewport;
  },

  /**
   * Update root position to get the viewport covered
   */
  _updateContentViewport: function _updateContentViewport() {
    var p = this.options.padding;
    var size = this._map.getSize();
    var panePos = L.DomUtil.getPosition(this._map._mapPane);
    var min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round());
    var max = min.add(size.multiplyBy(1 + p * 2)._round());

    this._pathViewport = new L.Bounds([min.x, min.y], [max.x, max.y]);
  },

  /**
   * @param  {ZoomEvent} e
   */
  _animatePathZoom: function _animatePathZoom(e) {
    var scale = this._map.getZoomScale(e.zoom);
    var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale)._add(this._getViewport().min);

    this._pathRoot.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

    this._pathZooming = true;
  },

  /**
   * Here we can do additional post-animation transforms
   */
  _endPathZoom: function _endPathZoom() {
    this._pathZooming = false;
  },

  /**
   * Apply the viewport correction
   */
  _updateSvgViewport: function _updateSvgViewport() {

    if (this._pathZooming) {
      // Do not update SVGs while a zoom animation is going on
      // otherwise the animation will break.
      // When the zoom animation ends we will be updated again anyway
      // This fixes the case where you do a momentum move and
      // zoom while the move is still ongoing.
      return;
    }

    this._updateContentViewport();

    var vp = this._getViewport();
    var min = vp.min;
    var max = vp.max;
    var width = max.x - min.x;
    var height = max.y - min.y;
    var root = this._pathRoot;
    var pane = this._map.getPanes().overlayPane;

    // Hack to make flicker on drag end on mobile webkit less irritating
    if (L.Browser.mobileWebkit) {
      this._container.removeChild(root);
    }

    L.DomUtil.setPosition(this._pathRoot, min);
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

    if (L.Browser.mobileWebkit) {
      this._container.appendChild(root);
    }
  }

});

},{"leaflet":undefined}],5:[function(require,module,exports){
'use strict';

var L = require('leaflet');
var SvgLayer = require('./svglayer');
var b64 = require('Base64');

require('./bounds');
require('./utils');

var SVGOverlay = SvgLayer.extend({

  options: {
    padding: 0.25,
    opacity: 1,
    useRaster: L.Browser.ie,
    adjustToScreen: true
    // load: function(url, callback) {}
  },

  /**
   * @constructor
   * @extends {SvgLayer}
   * @param  {String}         svg     SVG string or URL
   * @param  {L.LatLngBounds} bounds
   * @param  {Object=}        options
   */
  initialize: function initialize(svg, bounds, options) {

    /**
     * @type {String}
     */
    this._svg = svg;

    if (!(bounds instanceof L.LatLngBounds)) {
      options = bounds;
      bounds = null;
    }

    /**
     * @type {L.LatLngBounds}
     */
    this._bounds = bounds;

    /**
     * @type {Number}
     */
    this._ratio = 1;

    /**
     * @type {L.Point}
     */
    this._size = null;

    /**
     * @type {L.Point}
     */
    this._origin = null;

    /**
     * @type {L.Transformation}
     */
    this._transformation = null;

    /**
     * @type {String}
     */
    this._base64encoded = '';

    /**
     * @type {String}
     */
    this._rawData = '';

    if (typeof svg === 'string' && !/\<svg/ig.test(svg)) {
      this._svg = null;

      /**
       * @type {String}
       */
      this._url = svg;

      if (!options.load) {
        throw new Error('SVGOverlay requires external request implementation. ' + 'You have to provide `load` function with the options');
      }
    }

    /**
     * @type {SVGElement}
     */
    this._group = null;

    /**
     * @type {Element}
     */
    this._image = null;

    /**
     * @type {Canvas}
     */
    this._canvas = null;

    L.Util.setOptions(this, options);
  },

  /**
   * @return {L.Point}
   */
  getOriginalSize: function getOriginalSize() {
    var bbox = this._bbox;
    return new L.Point(Math.abs(bbox[0] - bbox[2]), Math.abs(bbox[1] - bbox[3]));
  },

  /**
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function onLoad(svg) {
    this._rawData = svg;
    svg = L.DomUtil.getSVGContainer(svg);
    var bbox = this._bbox = L.DomUtil.getSVGBBox(svg);
    var minZoom = this._map.getMinZoom();

    if (svg.getAttribute('viewBox') === null) {
      this._rawData = this._rawData.replace('<svg', '<svg viewBox="' + bbox.join(' ') + '"');
    }

    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(this._map.unproject([bbox[0], bbox[3]], minZoom), this._map.unproject([bbox[2], bbox[1]], minZoom));

    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (size.y !== mapSize.y && this.options.adjustToScreen) {
      var ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this._bounds = this._bounds.scale(ratio);
      this._ratio = ratio;
    }

    this._size = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._viewBoxOffset = L.point(this._bbox[0], this._bbox[1]);
    this._transformation = new L.Transformation(1, this._origin.x, 1, this._origin.y);

    this._group = L.Path.prototype._createElement('g');
    if (L.Browser.ie) {
      // innerHTML doesn't work for SVG in IE
      var child = svg.firstChild;
      do {
        this._group.appendChild(child);
        child = svg.firstChild;
      } while (child);
    } else {
      this._group.innerHTML = svg.innerHTML;
    }
    this._pathRoot.appendChild(this._group);

    this.fire('load');
    this._onMapZoomEnd();
    this._reset();
  },

  /**
   * @return {SVGElement}
   */
  getDocument: function getDocument() {
    return this._group;
  },

  /**
   * @return {L.LatLngBounds}
   */
  getBounds: function getBounds() {
    return this._bounds;
  },

  /**
   * @return {Number}
   */
  getRatio: function getRatio() {
    return this._ratio;
  },

  /**
   * Transform map coord to schematic point
   * @param  {L.LatLng} coord
   * @return {L.Point}
   */
  projectPoint: function projectPoint(coord) {
    return this._unscalePoint(this._map.project(coord, this._map.getMinZoom()));
  },

  /**
   * @param  {L.Point} pt
   * @return {L.LatLng}
   */
  unprojectPoint: function unprojectPoint(pt) {
    return this._map.unproject(this._scalePoint(pt), this._map.getMinZoom());
  },

  /**
   * @param {Number} opacity
   * @return {SVGLayer}
   */
  setOpacity: function setOpacity(opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },

  /**
   * @param  {L.Bounds} bounds
   * @return {L.LatLngBounds}
   */
  unprojectBounds: function unprojectBounds(bounds) {
    var sw = this.pointToMapCoord(bounds.min);
    var ne = this.pointToMapCoord(bounds.max);
    return L.latLngBounds(sw, ne);
  },

  /**
   * Transform layerBounds to schematic bbox
   * @param  {L.LatLngBounds} bounds
   * @return {L.Bounds}
   */
  projectBounds: function projectBounds(bounds) {
    return new L.Bounds(this.mapCoordToPoint(bounds.getSouthWest()), this.mapCoordToPoint(bounds.getNorthEast()));
  },

  /**
   * Loads svg via XHR
   */
  load: function load() {
    this.options.load(this._url, function (err, svg) {
      if (!err) {
        this.onLoad(svg);
      }
    }.bind(this));
  },

  /**
   * @param  {L.Map} map
   * @return {SVGOverlay}
   */
  onAdd: function onAdd(map) {
    SvgLayer.prototype.onAdd.call(this, map);

    map.on('zoomend', this._onMapZoomEnd, this).on('dragstart', this._onPreDrag, this).on('dragend', this._onDragEnd, this).on('viereset moveend', this._reset, this);

    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }
    return this;
  },

  /**
   * @param  {L.Map} map
   * @return {SVGOverlay}
   */
  onRemove: function onRemove(map) {
    SvgLayer.prototype.onRemove.call(this, map);
    map.off('zoomend', this._onMapZoomEnd, this).off('dragstart', this._onPreDrag, this).off('dragend', this._onDragEnd, this).off('viereset moveend', this._reset, this);
    return this;
  },

  /**
   * @param  {Function} callback
   * @param  {*=}       context
   * @return {SVGOverlay}
   */
  whenReady: function whenReady(callback, context) {
    if (this._bounds) {
      callback.call(context);
    } else {
      this.once('load', callback, context);
    }
    return this;
  },

  /**
   * Rasterizes the schematic
   * @return {Schematic}
   */
  toImage: function toImage() {
    var img = new Image();
    // this doesn't work in IE, force size
    // img.style.height = img.style.width = '100%';
    img.style.width = this._size.x + 'px';
    img.style.height = this._size.y + 'px';
    img.src = this.toBase64();

    var canvas = this._canvas || L.DomUtil.create('canvas', 'schematic-canvas');
    var ctx = canvas.getContext('2d');

    L.DomEvent.on(img, 'load', function () {
      var naturalSize = L.point(img.offsetWidth, img.offsetHeight);
      //console.log('natural', naturalSize);
      this._reset();
    }, this);

    if (!this._canvas) {
      this._canvas = canvas;
      this._container.insertBefore(canvas, this._container.firstChild);
    }
    img.style.opacity = 0;

    if (this._raster) {
      this._raster.parentNode.removeChild(this._raster);
      this._raster = null;
    }

    L.DomUtil.addClass(img, 'schematic-image');
    this._container.appendChild(img);
    this._raster = img;
    return this;
  },

  /**
   * Convert SVG data to base64 for rasterization
   * @return {String} base64 encoded SVG
   */
  toBase64: function toBase64() {
    //console.time('base64');
    var base64 = this._base64encoded || b64.btoa(unescape(encodeURIComponent(this._rawData)));
    this._base64encoded = base64;
    //console.timeEnd('base64');

    return 'data:image/svg+xml;base64,' + base64;
  },

  /**
   * We need to redraw on zoom end
   */
  _endPathZoom: function _endPathZoom() {
    this._reset();
    SvgLayer.prototype._endPathZoom.call(this);
  },

  /**
   * Scales projected point FROM viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _unscalePoint: function _unscalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).divideBy(this._ratio));
    // same as above, but not using transform matrix
    //return pt.subtract(this._origin)
    //  .multiplyBy(1/ this._ratio).add(this._origin);
  },

  /**
   * Scales projected point TO viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _scalePoint: function _scalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).multiplyBy(this._ratio));
    // equals to
    // return pt.subtract(this._origin)
    //   .multiplyBy(this._ratio).add(this._origin);
  },

  /**
   * Toggle canvas instead of SVG when dragging
   */
  _showRaster: function _showRaster() {
    if (this._canvas) {
      this._canvas.style.display = 'block';
      this._pathRoot.style.display = 'none';
    }
  },

  /**
   * Swap back to SVG
   */
  _hideRaster: function _hideRaster() {
    if (this._canvas) {
      this._canvas.style.display = 'none';
      this._pathRoot.style.display = 'block';
    }
  },

  /**
   * IE-only
   * Replace SVG with canvas before drag
   */
  _onPreDrag: function _onPreDrag() {
    if (this.options.useRaster) {
      this._showRaster();
    }
  },

  /**
   * Drag end: put SVG back in IE
   */
  _onDragEnd: function _onDragEnd() {
    if (this.options.useRaster) {
      this._hideRaster();
    }
  },

  /**
   * Re-render canvas on zoomend
   */
  _onMapZoomEnd: function _onMapZoomEnd() {
    if (this.options.useRaster) {
      this.toImage();
      this._hideRaster();
    }
  },

  /**
   * Sets conatiner opacity
   */
  _updateOpacity: function _updateOpacity() {
    L.DomUtil.setOpacity(this._container, this.options.opacity);
  },

  /**
   * Redraw shifed canvas
   * @param  {L.Point} topLeft
   * @param  {L.Point} size
   */
  _redrawCanvas: function _redrawCanvas(topLeft, size) {
    if (this._canvas) {
      var vp = this._getViewport();
      var canvas = this._canvas;
      var min = vp.min;
      var max = vp.max;
      var width = max.x - min.x;
      var height = max.y - min.y;

      var pos = topLeft.subtract(min);

      canvas.width = width;
      canvas.height = height;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      // console.log(width, height, size.x, size.y);

      var ctx = canvas.getContext('2d');
      L.Util.requestAnimFrame(function () {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(this._raster, pos.x, pos.y, size.x, size.y);

        // ctx.rect(pos.x, pos.y, size.x, size.y);
        // ctx.strokeStyle = 'red';
        // ctx.lineWidth = 0.1;
        // ctx.stroke();
      }, this);

      //this._pathRoot.style.opacity = 0.5;
    }
  },

  /**
   * Redraw - compensate the position and scale
   */
  _reset: function _reset() {
    var image = this._group;
    // scale is scale factor, zoom is zoom level
    var scale = Math.pow(2, this._map.getZoom() - 1) * this._ratio;
    var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    var size = this.getOriginalSize().multiplyBy(scale);
    var vpMin = this._getViewport().min;

    if (this._raster) {
      this._raster.style.width = size.x + 'px';
      this._raster.style.height = size.y + 'px';
      L.DomUtil.setPosition(this._raster, vpMin);
    }

    if (this._canvas) {
      this._redrawCanvas(topLeft, size);
      L.DomUtil.setPosition(this._canvas, vpMin);
    }

    // compensate viewbox dismissal with a shift here
    this._group.setAttribute('transform', L.DomUtil.getMatrixString(topLeft.subtract(this._viewBoxOffset.multiplyBy(scale)), scale));
  }

});

// export
L.SVGOverlay = SVGOverlay;
L.svgOverlay = function (svg, options) {
  return new SVGOverlay(svg, options);
};

module.exports = SVGOverlay;

},{"./bounds":3,"./svglayer":4,"./utils":6,"Base64":2,"leaflet":undefined}],6:[function(require,module,exports){
(function (global){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var L = require('leaflet');

// <use> tags are broken in IE in so many ways
if ('SVGElementInstance' in global) {
  Object.defineProperty(SVGElementInstance.prototype, 'className', {
    get: function get() {
      return this.correspondingElement.className.baseVal;
    },
    set: function set(val) {
      this.correspondingElement.className.baseVal = val;
    }
  });
}

/**
 * @param  {*}  o
 * @return {Boolean}
 */
L.DomUtil.isNode = function (o) {
  return (typeof Node === 'undefined' ? 'undefined' : _typeof(Node)) === 'object' ? o instanceof Node : o && (typeof o === 'undefined' ? 'undefined' : _typeof(o)) === 'object' && typeof o.nodeType === 'number' && typeof o.nodeName === 'string';
};

/**
 * @param  {SVGElement} svg
 * @return {Array.<Number>}
 */
L.DomUtil.getSVGBBox = function (svg) {
  var viewBox = svg.getAttribute('viewBox');
  var bbox;
  if (viewBox) {
    bbox = viewBox.split(' ').map(parseFloat);
  } else {
    var clone = svg.cloneNode(true);
    document.body.appendChild(clone);
    // bbox = clone.getBBox();
    bbox = calcSVGViewBoxFromNodes(clone);
    document.body.removeChild(clone);
    return bbox;
  }
  return [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
};

/**
 * Simply brute force: takes all svg nodes, calculates bounding box
 * @param  {SVGElement} svg
 * @return {Array.<Number>}
 */
function calcSVGViewBoxFromNodes(svg) {
  var bbox = [Infinity, Infinity, -Infinity, -Infinity];
  var nodes = [].slice.call(svg.querySelectorAll('*'));
  var min = Math.min,
      max = Math.max;

  for (var i = 0, len = nodes.length; i < len; i++) {
    var node = nodes[i];
    if (node.getBBox) {
      node = node.getBBox();

      bbox[0] = min(node.x, bbox[0]);
      bbox[1] = min(node.y, bbox[1]);

      bbox[2] = max(node.x + node.width, bbox[2]);
      bbox[3] = max(node.y + node.height, bbox[3]);
    }
  }
  return bbox;
}

/**
 * @param  {String} str
 * @return {SVGElement}
 */
L.DomUtil.getSVGContainer = function (str) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = str;
  return wrapper.querySelector('svg');
};

/**
 * @param  {L.Point} translate
 * @param  {Number}  scale
 * @return {String}
 */
L.DomUtil.getMatrixString = function (translate, scale) {
  return 'matrix(' + [scale, 0, 0, scale, translate.x, translate.y].join(',') + ')';
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"leaflet":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxrQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtCO0FBRXpDLE1BQUksTUFBTSxLQUFLLEdBQUwsQ0FGK0I7QUFHekMsTUFBSSxTQUFTLENBQUUsSUFBSSxDQUFKLEdBQVEsSUFBSSxDQUFKLENBQVQsR0FBa0IsQ0FBbEIsSUFBd0IsUUFBUSxDQUFSLENBQXpCLENBSDRCO0FBSXpDLE1BQUksU0FBUyxDQUFFLElBQUksQ0FBSixHQUFRLElBQUksQ0FBSixDQUFULEdBQWtCLENBQWxCLElBQXdCLFFBQVEsQ0FBUixDQUF6QixDQUo0Qjs7QUFNekMsU0FBTyxJQUFJLEVBQUUsTUFBRixDQUFTLENBQ2xCLENBQUMsSUFBSSxDQUFKLEdBQVEsTUFBUixFQUFnQixJQUFJLENBQUosR0FBUSxNQUFSLENBREMsRUFFbEIsQ0FBQyxJQUFJLENBQUosR0FBUSxNQUFSLEVBQWdCLElBQUksQ0FBSixHQUFRLE1BQVIsQ0FGQyxDQUFiLENBQVAsQ0FOeUM7Q0FBaEI7Ozs7O0FBZ0IzQixFQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLE1BQXpCLEdBQWtDLFlBQVc7QUFDM0MsU0FBTyxDQUFDLEtBQUssT0FBTCxFQUFELEVBQWlCLEtBQUssUUFBTCxFQUFqQixFQUFrQyxLQUFLLE9BQUwsRUFBbEMsRUFBa0QsS0FBSyxRQUFMLEVBQWxELENBQVAsQ0FEMkM7Q0FBWDs7Ozs7O0FBU2xDLEVBQUUsWUFBRixDQUFlLFNBQWYsQ0FBeUIsS0FBekIsR0FBaUMsVUFBUyxLQUFULEVBQWdCO0FBQy9DLE1BQUksS0FBSyxLQUFLLFVBQUwsQ0FEc0M7QUFFL0MsTUFBSSxLQUFLLEtBQUssVUFBTCxDQUZzQztBQUcvQyxNQUFJLFNBQVMsQ0FBRSxHQUFHLEdBQUgsR0FBUyxHQUFHLEdBQUgsQ0FBVixHQUFvQixDQUFwQixJQUEwQixRQUFRLENBQVIsQ0FBM0IsQ0FIa0M7QUFJL0MsTUFBSSxTQUFTLENBQUUsR0FBRyxHQUFILEdBQVMsR0FBRyxHQUFILENBQVYsR0FBb0IsQ0FBcEIsSUFBMEIsUUFBUSxDQUFSLENBQTNCLENBSmtDOztBQU0vQyxTQUFPLElBQUksRUFBRSxZQUFGLENBQWUsQ0FDeEIsQ0FBQyxHQUFHLEdBQUgsR0FBUyxNQUFULEVBQWlCLEdBQUcsR0FBSCxHQUFTLE1BQVQsQ0FETSxFQUV4QixDQUFDLEdBQUcsR0FBSCxHQUFTLE1BQVQsRUFBaUIsR0FBRyxHQUFILEdBQVMsTUFBVCxDQUZNLENBQW5CLENBQVAsQ0FOK0M7Q0FBaEI7Ozs7O0FDdkNqQyxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7O0FBRUosT0FBTyxPQUFQLEdBQWlCLEVBQUUsS0FBRixDQUFRLE1BQVIsQ0FBZTs7QUFFOUIsWUFBVSxFQUFFLEtBQUYsQ0FBUSxNQUFSOztBQUVWLFdBQVM7QUFDUCxhQUFTLENBQVQ7QUFDQSxhQUFTLEVBQUUsSUFBRixDQUFPLFlBQVA7R0FGWDs7Ozs7Ozs7OztBQWFBLGNBQVksb0JBQVMsT0FBVCxFQUFrQjs7OztBQUk1QixTQUFLLFVBQUwsR0FBa0IsSUFBbEI7Ozs7O0FBSjRCLFFBVTVCLENBQUssU0FBTCxHQUFrQixJQUFsQjs7Ozs7QUFWNEIsUUFnQjVCLENBQUssSUFBTCxHQUFZLElBQVo7Ozs7O0FBaEI0QixRQXNCNUIsQ0FBSyxhQUFMLEdBQXFCLElBQXJCOzs7OztBQXRCNEIsUUE0QjVCLENBQUssWUFBTCxHQUFvQixLQUFwQixDQTVCNEI7O0FBOEI1QixNQUFFLElBQUYsQ0FBTyxVQUFQLENBQWtCLElBQWxCLEVBQXdCLE9BQXhCLEVBOUI0QjtHQUFsQjs7Ozs7O0FBc0NaLFNBQU8sZUFBUyxHQUFULEVBQWM7QUFDbkIsU0FBSyxJQUFMLEdBQVksR0FBWixDQURtQjtBQUVuQixTQUFLLGFBQUwsR0FGbUI7QUFHbkIsV0FBTyxJQUFQLENBSG1CO0dBQWQ7Ozs7OztBQVdQLFNBQU8sZUFBUyxHQUFULEVBQWM7QUFDbkIsUUFBSSxRQUFKLENBQWEsSUFBYixFQURtQjtBQUVuQixXQUFPLElBQVAsQ0FGbUI7R0FBZDs7Ozs7O0FBVVAsWUFBVSxrQkFBUyxHQUFULEVBQWM7QUFDdEIsUUFBSSxLQUFLLElBQUwsQ0FBVSxPQUFWLENBQWtCLGFBQWxCLElBQW1DLEVBQUUsT0FBRixDQUFVLEtBQVYsRUFBaUI7QUFDdEQsV0FBSyxJQUFMLENBQVUsR0FBVixDQUFjO0FBQ1osb0JBQVksS0FBSyxnQkFBTDtBQUNaLG1CQUFXLEtBQUssWUFBTDtPQUZiLEVBR0csSUFISCxFQURzRDtLQUF4RDs7QUFPQSxTQUFLLElBQUwsQ0FBVSxHQUFWLENBQWMsU0FBZCxFQUF5QixLQUFLLGtCQUFMLEVBQXlCLElBQWxELEVBUnNCO0FBU3RCLFNBQUssSUFBTCxDQUFVLFFBQVYsR0FBcUIsV0FBckIsQ0FBaUMsV0FBakMsQ0FBNkMsS0FBSyxVQUFMLENBQTdDLENBVHNCO0FBVXRCLFdBQU8sSUFBUCxDQVZzQjtHQUFkOzs7Ozs7QUFrQlYsY0FBWSxvQkFBUyxHQUFULEVBQWM7QUFDeEIsUUFBSSxXQUFKLENBQWdCLElBQWhCLEVBRHdCO0FBRXhCLFdBQU8sSUFBUCxDQUZ3QjtHQUFkOzs7OztBQVNaLGdCQUFjLHdCQUFZO0FBQ3hCLFFBQUksT0FBTyxLQUFLLFNBQUwsQ0FBZSxVQUFmO1FBQ1AsT0FBTyxLQUFLLFNBQUwsQ0FGYTs7QUFJeEIsUUFBSSxRQUFRLEtBQUssU0FBTCxLQUFtQixJQUFuQixFQUF5QjtBQUNuQyxXQUFLLFdBQUwsQ0FBaUIsSUFBakIsRUFEbUM7S0FBckM7QUFHQSxXQUFPLElBQVAsQ0FQd0I7R0FBWjs7Ozs7QUFjZCxlQUFhLHVCQUFZO0FBQ3ZCLFFBQUksT0FBTyxLQUFLLFNBQUwsQ0FBZSxVQUFmLENBRFk7QUFFdkIsUUFBSSxPQUFPLEtBQUssU0FBTCxDQUZZO0FBR3ZCLFFBQUksUUFBUSxLQUFLLFVBQUwsQ0FIVzs7QUFLdkIsUUFBSSxRQUFRLFVBQVUsSUFBVixFQUFnQjtBQUMxQixXQUFLLFlBQUwsQ0FBa0IsSUFBbEIsRUFBd0IsS0FBeEIsRUFEMEI7S0FBNUI7QUFHQSxXQUFPLElBQVAsQ0FSdUI7R0FBWjs7Ozs7QUFlYixlQUFhLHVCQUFXO0FBQ3RCLFNBQUssU0FBTCxHQUFpQixFQUFFLElBQUYsQ0FBTyxTQUFQLENBQWlCLGNBQWpCLENBQWdDLEtBQWhDLENBQWpCLENBRHNCO0FBRXRCLFNBQUssVUFBTCxHQUFrQixFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCLEtBQWpCLEVBQXdCLHFCQUF4QixDQUFsQixDQUZzQjtBQUd0QixTQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsS0FBSyxTQUFMLENBQTVCLENBSHNCO0dBQVg7Ozs7O0FBVWIsaUJBQWUseUJBQVk7QUFDekIsUUFBSSxDQUFDLEtBQUssU0FBTCxFQUFnQjtBQUNuQixXQUFLLFdBQUwsR0FEbUI7QUFFbkIsV0FBSyxJQUFMLENBQVUsUUFBVixHQUFxQixXQUFyQixDQUFpQyxXQUFqQyxDQUE2QyxLQUFLLFVBQUwsQ0FBN0MsQ0FGbUI7O0FBSW5CLFVBQUksS0FBSyxJQUFMLENBQVUsT0FBVixDQUFrQixhQUFsQixJQUFtQyxFQUFFLE9BQUYsQ0FBVSxLQUFWLEVBQWlCO0FBQ3RELFVBQUUsT0FBRixDQUFVLFFBQVYsQ0FBbUIsS0FBSyxTQUFMLEVBQWdCLHVCQUFuQyxFQURzRDs7QUFHdEQsYUFBSyxJQUFMLENBQVUsRUFBVixDQUFhO0FBQ1gsc0JBQVksS0FBSyxnQkFBTDtBQUNaLHFCQUFXLEtBQUssWUFBTDtTQUZiLEVBR0csSUFISCxFQUhzRDtPQUF4RCxNQU9PO0FBQ0wsVUFBRSxPQUFGLENBQVUsUUFBVixDQUFtQixLQUFLLFNBQUwsRUFBZ0IsbUJBQW5DLEVBREs7T0FQUDs7QUFXQSxXQUFLLElBQUwsQ0FBVSxFQUFWLENBQWEsU0FBYixFQUF3QixLQUFLLGtCQUFMLEVBQXlCLElBQWpELEVBZm1CO0FBZ0JuQixXQUFLLGtCQUFMLEdBaEJtQjtLQUFyQjtHQURhOzs7Ozs7QUEwQmYsZ0JBQWMsd0JBQVc7QUFDdkIsV0FBTyxLQUFLLGFBQUwsQ0FEZ0I7R0FBWDs7Ozs7QUFRZCwwQkFBd0Isa0NBQVk7QUFDbEMsUUFBSSxJQUFJLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FEMEI7QUFFbEMsUUFBSSxPQUFPLEtBQUssSUFBTCxDQUFVLE9BQVYsRUFBUCxDQUY4QjtBQUdsQyxRQUFJLFVBQVUsRUFBRSxPQUFGLENBQVUsV0FBVixDQUFzQixLQUFLLElBQUwsQ0FBVSxRQUFWLENBQWhDLENBSDhCO0FBSWxDLFFBQUksTUFBTSxRQUFRLFVBQVIsQ0FBbUIsQ0FBQyxDQUFELENBQW5CLENBQXVCLFNBQXZCLENBQWlDLEtBQUssVUFBTCxDQUFnQixDQUFoQixFQUFtQixNQUFuQixFQUFqQyxDQUFOLENBSjhCO0FBS2xDLFFBQUksTUFBTSxJQUFJLEdBQUosQ0FBUSxLQUFLLFVBQUwsQ0FBZ0IsSUFBSSxJQUFJLENBQUosQ0FBcEIsQ0FBMkIsTUFBM0IsRUFBUixDQUFOLENBTDhCOztBQU9sQyxTQUFLLGFBQUwsR0FBcUIsSUFBSSxFQUFFLE1BQUYsQ0FBUyxDQUFDLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixDQUFyQixFQUE2QixDQUFDLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixDQUFyQyxDQUFyQixDQVBrQztHQUFaOzs7OztBQWN4QixvQkFBa0IsMEJBQVUsQ0FBVixFQUFhO0FBQzdCLFFBQUksUUFBUSxLQUFLLElBQUwsQ0FBVSxZQUFWLENBQXVCLEVBQUUsSUFBRixDQUEvQixDQUR5QjtBQUU3QixRQUFJLFNBQVMsS0FBSyxJQUFMLENBQ1YsZ0JBRFUsQ0FDTyxFQUFFLE1BQUYsQ0FEUCxDQUVWLFdBRlUsQ0FFRSxDQUFDLEtBQUQsQ0FGRixDQUdWLElBSFUsQ0FHTCxLQUFLLFlBQUwsR0FBb0IsR0FBcEIsQ0FISixDQUZ5Qjs7QUFPN0IsU0FBSyxTQUFMLENBQWUsS0FBZixDQUFxQixFQUFFLE9BQUYsQ0FBVSxTQUFWLENBQXJCLEdBQ0UsRUFBRSxPQUFGLENBQVUsa0JBQVYsQ0FBNkIsTUFBN0IsSUFBdUMsU0FBdkMsR0FBbUQsS0FBbkQsR0FBMkQsSUFBM0QsQ0FSMkI7O0FBVTdCLFNBQUssWUFBTCxHQUFvQixJQUFwQixDQVY2QjtHQUFiOzs7OztBQWlCbEIsZ0JBQWMsd0JBQVk7QUFDeEIsU0FBSyxZQUFMLEdBQW9CLEtBQXBCLENBRHdCO0dBQVo7Ozs7O0FBUWQsc0JBQW9CLDhCQUFZOztBQUU5QixRQUFJLEtBQUssWUFBTCxFQUFtQjs7Ozs7O0FBTXJCLGFBTnFCO0tBQXZCOztBQVNBLFNBQUssc0JBQUwsR0FYOEI7O0FBYTlCLFFBQUksS0FBUyxLQUFLLFlBQUwsRUFBVCxDQWIwQjtBQWM5QixRQUFJLE1BQVMsR0FBRyxHQUFILENBZGlCO0FBZTlCLFFBQUksTUFBUyxHQUFHLEdBQUgsQ0FmaUI7QUFnQjlCLFFBQUksUUFBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FoQlM7QUFpQjlCLFFBQUksU0FBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FqQlM7QUFrQjlCLFFBQUksT0FBUyxLQUFLLFNBQUwsQ0FsQmlCO0FBbUI5QixRQUFJLE9BQVMsS0FBSyxJQUFMLENBQVUsUUFBVixHQUFxQixXQUFyQjs7O0FBbkJpQixRQXNCMUIsRUFBRSxPQUFGLENBQVUsWUFBVixFQUF3QjtBQUMxQixXQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsSUFBNUIsRUFEMEI7S0FBNUI7O0FBSUEsTUFBRSxPQUFGLENBQVUsV0FBVixDQUFzQixLQUFLLFNBQUwsRUFBZ0IsR0FBdEMsRUExQjhCO0FBMkI5QixTQUFLLFlBQUwsQ0FBa0IsT0FBbEIsRUFBMkIsS0FBM0IsRUEzQjhCO0FBNEI5QixTQUFLLFlBQUwsQ0FBa0IsUUFBbEIsRUFBNEIsTUFBNUIsRUE1QjhCO0FBNkI5QixTQUFLLFlBQUwsQ0FBa0IsU0FBbEIsRUFBNkIsQ0FBQyxJQUFJLENBQUosRUFBTyxJQUFJLENBQUosRUFBTyxLQUFmLEVBQXNCLE1BQXRCLEVBQThCLElBQTlCLENBQW1DLEdBQW5DLENBQTdCLEVBN0I4Qjs7QUErQjlCLFFBQUksRUFBRSxPQUFGLENBQVUsWUFBVixFQUF3QjtBQUMxQixXQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsSUFBNUIsRUFEMEI7S0FBNUI7R0EvQmtCOztDQXZOTCxDQUFqQjs7Ozs7QUNGQSxJQUFJLElBQVcsUUFBUSxTQUFSLENBQVg7QUFDSixJQUFJLFdBQVcsUUFBUSxZQUFSLENBQVg7QUFDSixJQUFJLE1BQVcsUUFBUSxRQUFSLENBQVg7O0FBRUosUUFBUSxVQUFSO0FBQ0EsUUFBUSxTQUFSOztBQUVBLElBQUksYUFBYSxTQUFTLE1BQVQsQ0FBZ0I7O0FBRS9CLFdBQVM7QUFDUCxhQUFTLElBQVQ7QUFDQSxhQUFTLENBQVQ7QUFDQSxlQUFXLEVBQUUsT0FBRixDQUFVLEVBQVY7QUFDWCxvQkFBZ0IsSUFBaEI7O0FBSk8sR0FBVDs7Ozs7Ozs7O0FBZ0JBLGNBQVksb0JBQVMsR0FBVCxFQUFjLE1BQWQsRUFBc0IsT0FBdEIsRUFBK0I7Ozs7O0FBS3pDLFNBQUssSUFBTCxHQUFlLEdBQWYsQ0FMeUM7O0FBT3pDLFFBQUksRUFBRSxrQkFBa0IsRUFBRSxZQUFGLENBQXBCLEVBQXFDO0FBQ3ZDLGdCQUFVLE1BQVYsQ0FEdUM7QUFFdkMsZUFBUyxJQUFULENBRnVDO0tBQXpDOzs7OztBQVB5QyxRQWV6QyxDQUFLLE9BQUwsR0FBZSxNQUFmOzs7OztBQWZ5QyxRQW9CekMsQ0FBSyxNQUFMLEdBQWMsQ0FBZDs7Ozs7QUFwQnlDLFFBMEJ6QyxDQUFLLEtBQUwsR0FBYSxJQUFiOzs7OztBQTFCeUMsUUFnQ3pDLENBQUssT0FBTCxHQUFlLElBQWY7Ozs7O0FBaEN5QyxRQXNDekMsQ0FBSyxlQUFMLEdBQXVCLElBQXZCOzs7OztBQXRDeUMsUUE0Q3pDLENBQUssY0FBTCxHQUFzQixFQUF0Qjs7Ozs7QUE1Q3lDLFFBa0R6QyxDQUFLLFFBQUwsR0FBZ0IsRUFBaEIsQ0FsRHlDOztBQW9EekMsUUFBSSxPQUFPLEdBQVAsS0FBZSxRQUFmLElBQTJCLENBQUMsVUFBVSxJQUFWLENBQWUsR0FBZixDQUFELEVBQXNCO0FBQ25ELFdBQUssSUFBTCxHQUFZLElBQVo7Ozs7O0FBRG1ELFVBTW5ELENBQUssSUFBTCxHQUFZLEdBQVosQ0FObUQ7O0FBUW5ELFVBQUksQ0FBQyxRQUFRLElBQVIsRUFBYztBQUNqQixjQUFNLElBQUksS0FBSixDQUFVLDBEQUNkLHNEQURjLENBQWhCLENBRGlCO09BQW5CO0tBUkY7Ozs7O0FBcER5QyxRQXFFekMsQ0FBSyxNQUFMLEdBQWMsSUFBZDs7Ozs7QUFyRXlDLFFBMkV6QyxDQUFLLE1BQUwsR0FBYyxJQUFkOzs7OztBQTNFeUMsUUFpRnpDLENBQUssT0FBTCxHQUFlLElBQWYsQ0FqRnlDOztBQW1GekMsTUFBRSxJQUFGLENBQU8sVUFBUCxDQUFrQixJQUFsQixFQUF3QixPQUF4QixFQW5GeUM7R0FBL0I7Ozs7O0FBMEZaLG1CQUFpQiwyQkFBVztBQUMxQixRQUFJLE9BQU8sS0FBSyxLQUFMLENBRGU7QUFFMUIsV0FBTyxJQUFJLEVBQUUsS0FBRixDQUNULEtBQUssR0FBTCxDQUFTLEtBQUssQ0FBTCxJQUFVLEtBQUssQ0FBTCxDQUFWLENBREosRUFFTCxLQUFLLEdBQUwsQ0FBUyxLQUFLLENBQUwsSUFBVSxLQUFLLENBQUwsQ0FBVixDQUZKLENBQVAsQ0FGMEI7R0FBWDs7Ozs7O0FBYWpCLFVBQVEsZ0JBQVMsR0FBVCxFQUFjO0FBQ3BCLFNBQUssUUFBTCxHQUFnQixHQUFoQixDQURvQjtBQUVwQixVQUFNLEVBQUUsT0FBRixDQUFVLGVBQVYsQ0FBMEIsR0FBMUIsQ0FBTixDQUZvQjtBQUdwQixRQUFJLE9BQU8sS0FBSyxLQUFMLEdBQWEsRUFBRSxPQUFGLENBQVUsVUFBVixDQUFxQixHQUFyQixDQUFiLENBSFM7QUFJcEIsUUFBSSxVQUFVLEtBQUssSUFBTCxDQUFVLFVBQVYsRUFBVixDQUpnQjs7QUFNcEIsUUFBSSxJQUFJLFlBQUosQ0FBaUIsU0FBakIsTUFBZ0MsSUFBaEMsRUFBc0M7QUFDeEMsV0FBSyxRQUFMLEdBQWdCLEtBQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsTUFBdEIsRUFDZCxtQkFBbUIsS0FBSyxJQUFMLENBQVUsR0FBVixDQUFuQixHQUFvQyxHQUFwQyxDQURGLENBRHdDO0tBQTFDOzs7QUFOb0IsUUFZcEIsQ0FBSyxPQUFMLEdBQWUsSUFBSSxFQUFFLFlBQUYsQ0FDakIsS0FBSyxJQUFMLENBQVUsU0FBVixDQUFvQixDQUFDLEtBQUssQ0FBTCxDQUFELEVBQVUsS0FBSyxDQUFMLENBQVYsQ0FBcEIsRUFBd0MsT0FBeEMsQ0FEYSxFQUViLEtBQUssSUFBTCxDQUFVLFNBQVYsQ0FBb0IsQ0FBQyxLQUFLLENBQUwsQ0FBRCxFQUFVLEtBQUssQ0FBTCxDQUFWLENBQXBCLEVBQXdDLE9BQXhDLENBRmEsQ0FBZixDQVpvQjs7QUFpQnBCLFFBQUksT0FBTyxLQUFLLGVBQUwsRUFBUCxDQWpCZ0I7QUFrQnBCLFFBQUksVUFBVSxLQUFLLElBQUwsQ0FBVSxPQUFWLEVBQVYsQ0FsQmdCOztBQW9CcEIsUUFBSSxLQUFLLENBQUwsS0FBVyxRQUFRLENBQVIsSUFBYSxLQUFLLE9BQUwsQ0FBYSxjQUFiLEVBQTZCO0FBQ3ZELFVBQUksUUFBUSxLQUFLLEdBQUwsQ0FBUyxRQUFRLENBQVIsR0FBWSxLQUFLLENBQUwsRUFBUSxRQUFRLENBQVIsR0FBWSxLQUFLLENBQUwsQ0FBakQsQ0FEbUQ7QUFFdkQsV0FBSyxPQUFMLEdBQWUsS0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixLQUFuQixDQUFmLENBRnVEO0FBR3ZELFdBQUssTUFBTCxHQUFjLEtBQWQsQ0FIdUQ7S0FBekQ7O0FBTUEsU0FBSyxLQUFMLEdBQWUsSUFBZixDQTFCb0I7QUEyQnBCLFNBQUssT0FBTCxHQUFlLEtBQUssSUFBTCxDQUFVLE9BQVYsQ0FBa0IsS0FBSyxPQUFMLENBQWEsU0FBYixFQUFsQixFQUE0QyxPQUE1QyxDQUFmLENBM0JvQjtBQTRCcEIsU0FBSyxjQUFMLEdBQXNCLEVBQUUsS0FBRixDQUFRLEtBQUssS0FBTCxDQUFXLENBQVgsQ0FBUixFQUF1QixLQUFLLEtBQUwsQ0FBVyxDQUFYLENBQXZCLENBQXRCLENBNUJvQjtBQTZCcEIsU0FBSyxlQUFMLEdBQXVCLElBQUksRUFBRSxjQUFGLENBQ3pCLENBRHFCLEVBQ2xCLEtBQUssT0FBTCxDQUFhLENBQWIsRUFBZ0IsQ0FERSxFQUNDLEtBQUssT0FBTCxDQUFhLENBQWIsQ0FEeEIsQ0E3Qm9COztBQWdDcEIsU0FBSyxNQUFMLEdBQWMsRUFBRSxJQUFGLENBQU8sU0FBUCxDQUFpQixjQUFqQixDQUFnQyxHQUFoQyxDQUFkLENBaENvQjtBQWlDcEIsUUFBSSxFQUFFLE9BQUYsQ0FBVSxFQUFWLEVBQWM7O0FBQ2hCLFVBQUksUUFBUSxJQUFJLFVBQUosQ0FESTtBQUVoQixTQUFHO0FBQ0QsYUFBSyxNQUFMLENBQVksV0FBWixDQUF3QixLQUF4QixFQURDO0FBRUQsZ0JBQVEsSUFBSSxVQUFKLENBRlA7T0FBSCxRQUdRLEtBSFIsRUFGZ0I7S0FBbEIsTUFNTztBQUNMLFdBQUssTUFBTCxDQUFZLFNBQVosR0FBd0IsSUFBSSxTQUFKLENBRG5CO0tBTlA7QUFTQSxTQUFLLFNBQUwsQ0FBZSxXQUFmLENBQTJCLEtBQUssTUFBTCxDQUEzQixDQTFDb0I7O0FBNENwQixTQUFLLElBQUwsQ0FBVSxNQUFWLEVBNUNvQjtBQTZDcEIsU0FBSyxhQUFMLEdBN0NvQjtBQThDcEIsU0FBSyxNQUFMLEdBOUNvQjtHQUFkOzs7OztBQXFEUixlQUFhLHVCQUFXO0FBQ3RCLFdBQU8sS0FBSyxNQUFMLENBRGU7R0FBWDs7Ozs7QUFRYixhQUFXLHFCQUFXO0FBQ3BCLFdBQU8sS0FBSyxPQUFMLENBRGE7R0FBWDs7Ozs7QUFRWCxZQUFVLG9CQUFXO0FBQ25CLFdBQU8sS0FBSyxNQUFMLENBRFk7R0FBWDs7Ozs7OztBQVVWLGdCQUFjLHNCQUFTLEtBQVQsRUFBZ0I7QUFDNUIsV0FBTyxLQUFLLGFBQUwsQ0FBbUIsS0FBSyxJQUFMLENBQVUsT0FBVixDQUFrQixLQUFsQixFQUF5QixLQUFLLElBQUwsQ0FBVSxVQUFWLEVBQXpCLENBQW5CLENBQVAsQ0FENEI7R0FBaEI7Ozs7OztBQVNkLGtCQUFnQix3QkFBUyxFQUFULEVBQWE7QUFDM0IsV0FBTyxLQUFLLElBQUwsQ0FBVSxTQUFWLENBQW9CLEtBQUssV0FBTCxDQUFpQixFQUFqQixDQUFwQixFQUEwQyxLQUFLLElBQUwsQ0FBVSxVQUFWLEVBQTFDLENBQVAsQ0FEMkI7R0FBYjs7Ozs7O0FBU2hCLGNBQVksb0JBQVUsT0FBVixFQUFtQjtBQUM3QixTQUFLLE9BQUwsQ0FBYSxPQUFiLEdBQXVCLE9BQXZCLENBRDZCO0FBRTdCLFNBQUssY0FBTCxHQUY2QjtBQUc3QixXQUFPLElBQVAsQ0FINkI7R0FBbkI7Ozs7OztBQVdaLG1CQUFpQix5QkFBUyxNQUFULEVBQWlCO0FBQ2hDLFFBQUksS0FBSyxLQUFLLGVBQUwsQ0FBcUIsT0FBTyxHQUFQLENBQTFCLENBRDRCO0FBRWhDLFFBQUksS0FBSyxLQUFLLGVBQUwsQ0FBcUIsT0FBTyxHQUFQLENBQTFCLENBRjRCO0FBR2hDLFdBQU8sRUFBRSxZQUFGLENBQWUsRUFBZixFQUFtQixFQUFuQixDQUFQLENBSGdDO0dBQWpCOzs7Ozs7O0FBWWpCLGlCQUFlLHVCQUFTLE1BQVQsRUFBaUI7QUFDOUIsV0FBTyxJQUFJLEVBQUUsTUFBRixDQUNULEtBQUssZUFBTCxDQUFxQixPQUFPLFlBQVAsRUFBckIsQ0FESyxFQUVMLEtBQUssZUFBTCxDQUFxQixPQUFPLFlBQVAsRUFBckIsQ0FGSyxDQUFQLENBRDhCO0dBQWpCOzs7OztBQVdmLFFBQU0sZ0JBQVc7QUFDZixTQUFLLE9BQUwsQ0FBYSxJQUFiLENBQWtCLEtBQUssSUFBTCxFQUFXLFVBQVMsR0FBVCxFQUFjLEdBQWQsRUFBbUI7QUFDOUMsVUFBSSxDQUFDLEdBQUQsRUFBTTtBQUNSLGFBQUssTUFBTCxDQUFZLEdBQVosRUFEUTtPQUFWO0tBRDJCLENBSTNCLElBSjJCLENBSXRCLElBSnNCLENBQTdCLEVBRGU7R0FBWDs7Ozs7O0FBYU4sU0FBTyxlQUFTLEdBQVQsRUFBYztBQUNuQixhQUFTLFNBQVQsQ0FBbUIsS0FBbkIsQ0FBeUIsSUFBekIsQ0FBOEIsSUFBOUIsRUFBb0MsR0FBcEMsRUFEbUI7O0FBR25CLFFBQ0csRUFESCxDQUNNLFNBRE4sRUFDaUIsS0FBSyxhQUFMLEVBQW9CLElBRHJDLEVBRUcsRUFGSCxDQUVNLFdBRk4sRUFFbUIsS0FBSyxVQUFMLEVBQWlCLElBRnBDLEVBR0csRUFISCxDQUdNLFNBSE4sRUFHaUIsS0FBSyxVQUFMLEVBQWlCLElBSGxDLEVBSUcsRUFKSCxDQUlNLGtCQUpOLEVBSTBCLEtBQUssTUFBTCxFQUFhLElBSnZDLEVBSG1COztBQVNuQixRQUFJLENBQUMsS0FBSyxJQUFMLEVBQVc7QUFDZCxXQUFLLElBQUwsR0FEYztLQUFoQixNQUVPO0FBQ0wsV0FBSyxNQUFMLENBQVksS0FBSyxJQUFMLENBQVosQ0FESztLQUZQO0FBS0EsV0FBTyxJQUFQLENBZG1CO0dBQWQ7Ozs7OztBQXNCUCxZQUFVLGtCQUFTLEdBQVQsRUFBYztBQUN0QixhQUFTLFNBQVQsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBNUIsQ0FBaUMsSUFBakMsRUFBdUMsR0FBdkMsRUFEc0I7QUFFdEIsUUFDRyxHQURILENBQ08sU0FEUCxFQUNrQixLQUFLLGFBQUwsRUFBb0IsSUFEdEMsRUFFRyxHQUZILENBRU8sV0FGUCxFQUVvQixLQUFLLFVBQUwsRUFBaUIsSUFGckMsRUFHRyxHQUhILENBR08sU0FIUCxFQUdrQixLQUFLLFVBQUwsRUFBaUIsSUFIbkMsRUFJRyxHQUpILENBSU8sa0JBSlAsRUFJMkIsS0FBSyxNQUFMLEVBQWEsSUFKeEMsRUFGc0I7QUFPdEIsV0FBTyxJQUFQLENBUHNCO0dBQWQ7Ozs7Ozs7QUFnQlYsYUFBVyxtQkFBUyxRQUFULEVBQW1CLE9BQW5CLEVBQTRCO0FBQ3JDLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsZUFBUyxJQUFULENBQWMsT0FBZCxFQURnQjtLQUFsQixNQUVPO0FBQ0wsV0FBSyxJQUFMLENBQVUsTUFBVixFQUFrQixRQUFsQixFQUE0QixPQUE1QixFQURLO0tBRlA7QUFLQSxXQUFPLElBQVAsQ0FOcUM7R0FBNUI7Ozs7OztBQWNYLFdBQVMsbUJBQVc7QUFDbEIsUUFBSSxNQUFNLElBQUksS0FBSixFQUFOOzs7QUFEYyxPQUlsQixDQUFJLEtBQUosQ0FBVSxLQUFWLEdBQWtCLEtBQUssS0FBTCxDQUFXLENBQVgsR0FBZSxJQUFmLENBSkE7QUFLbEIsUUFBSSxLQUFKLENBQVUsTUFBVixHQUFtQixLQUFLLEtBQUwsQ0FBVyxDQUFYLEdBQWUsSUFBZixDQUxEO0FBTWxCLFFBQUksR0FBSixHQUFVLEtBQUssUUFBTCxFQUFWLENBTmtCOztBQVFsQixRQUFJLFNBQVMsS0FBSyxPQUFMLElBQWdCLEVBQUUsT0FBRixDQUFVLE1BQVYsQ0FBaUIsUUFBakIsRUFBMkIsa0JBQTNCLENBQWhCLENBUks7QUFTbEIsUUFBSSxNQUFNLE9BQU8sVUFBUCxDQUFrQixJQUFsQixDQUFOLENBVGM7O0FBV2xCLE1BQUUsUUFBRixDQUFXLEVBQVgsQ0FBYyxHQUFkLEVBQW1CLE1BQW5CLEVBQTJCLFlBQVk7QUFDckMsVUFBSSxjQUFjLEVBQUUsS0FBRixDQUFRLElBQUksV0FBSixFQUFpQixJQUFJLFlBQUosQ0FBdkM7O0FBRGlDLFVBR3JDLENBQUssTUFBTCxHQUhxQztLQUFaLEVBSXhCLElBSkgsRUFYa0I7O0FBaUJsQixRQUFJLENBQUMsS0FBSyxPQUFMLEVBQWM7QUFDakIsV0FBSyxPQUFMLEdBQWUsTUFBZixDQURpQjtBQUVqQixXQUFLLFVBQUwsQ0FBZ0IsWUFBaEIsQ0FBNkIsTUFBN0IsRUFBcUMsS0FBSyxVQUFMLENBQWdCLFVBQWhCLENBQXJDLENBRmlCO0tBQW5CO0FBSUEsUUFBSSxLQUFKLENBQVUsT0FBVixHQUFvQixDQUFwQixDQXJCa0I7O0FBdUJsQixRQUFJLEtBQUssT0FBTCxFQUFjO0FBQ2hCLFdBQUssT0FBTCxDQUFhLFVBQWIsQ0FBd0IsV0FBeEIsQ0FBb0MsS0FBSyxPQUFMLENBQXBDLENBRGdCO0FBRWhCLFdBQUssT0FBTCxHQUFlLElBQWYsQ0FGZ0I7S0FBbEI7O0FBS0EsTUFBRSxPQUFGLENBQVUsUUFBVixDQUFtQixHQUFuQixFQUF3QixpQkFBeEIsRUE1QmtCO0FBNkJsQixTQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsR0FBNUIsRUE3QmtCO0FBOEJsQixTQUFLLE9BQUwsR0FBZSxHQUFmLENBOUJrQjtBQStCbEIsV0FBTyxJQUFQLENBL0JrQjtHQUFYOzs7Ozs7QUF1Q1QsWUFBVSxvQkFBVzs7QUFFbkIsUUFBSSxTQUFTLEtBQUssY0FBTCxJQUNYLElBQUksSUFBSixDQUFTLFNBQVMsbUJBQW1CLEtBQUssUUFBTCxDQUE1QixDQUFULENBRFcsQ0FGTTtBQUluQixTQUFLLGNBQUwsR0FBc0IsTUFBdEI7OztBQUptQixXQU9aLCtCQUErQixNQUEvQixDQVBZO0dBQVg7Ozs7O0FBY1YsZ0JBQWMsd0JBQVc7QUFDdkIsU0FBSyxNQUFMLEdBRHVCO0FBRXZCLGFBQVMsU0FBVCxDQUFtQixZQUFuQixDQUFnQyxJQUFoQyxDQUFxQyxJQUFyQyxFQUZ1QjtHQUFYOzs7Ozs7O0FBV2QsaUJBQWUsdUJBQVMsRUFBVCxFQUFhO0FBQzFCLFdBQU8sS0FBSyxlQUFMLENBQXFCLFNBQXJCLENBQ0wsS0FBSyxlQUFMLENBQXFCLFdBQXJCLENBQWlDLEVBQWpDLEVBQXFDLFFBQXJDLENBQThDLEtBQUssTUFBTCxDQUR6QyxDQUFQOzs7O0FBRDBCLEdBQWI7Ozs7Ozs7QUFjZixlQUFhLHFCQUFTLEVBQVQsRUFBYTtBQUN4QixXQUFPLEtBQUssZUFBTCxDQUFxQixTQUFyQixDQUNMLEtBQUssZUFBTCxDQUFxQixXQUFyQixDQUFpQyxFQUFqQyxFQUFxQyxVQUFyQyxDQUFnRCxLQUFLLE1BQUwsQ0FEM0MsQ0FBUDs7OztBQUR3QixHQUFiOzs7OztBQWFiLGVBQWEsdUJBQVk7QUFDdkIsUUFBSSxLQUFLLE9BQUwsRUFBYztBQUNoQixXQUFLLE9BQUwsQ0FBYSxLQUFiLENBQW1CLE9BQW5CLEdBQStCLE9BQS9CLENBRGdCO0FBRWhCLFdBQUssU0FBTCxDQUFlLEtBQWYsQ0FBcUIsT0FBckIsR0FBK0IsTUFBL0IsQ0FGZ0I7S0FBbEI7R0FEVzs7Ozs7QUFXYixlQUFhLHVCQUFZO0FBQ3ZCLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsV0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixPQUFuQixHQUErQixNQUEvQixDQURnQjtBQUVoQixXQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLE9BQXJCLEdBQStCLE9BQS9CLENBRmdCO0tBQWxCO0dBRFc7Ozs7OztBQVliLGNBQVksc0JBQVc7QUFDckIsUUFBSSxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQXdCO0FBQzFCLFdBQUssV0FBTCxHQUQwQjtLQUE1QjtHQURVOzs7OztBQVVaLGNBQVksc0JBQVc7QUFDckIsUUFBSSxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQXdCO0FBQzFCLFdBQUssV0FBTCxHQUQwQjtLQUE1QjtHQURVOzs7OztBQVVaLGlCQUFlLHlCQUFXO0FBQ3hCLFFBQUksS0FBSyxPQUFMLENBQWEsU0FBYixFQUF3QjtBQUN6QixXQUFLLE9BQUwsR0FEeUI7QUFFekIsV0FBSyxXQUFMLEdBRnlCO0tBQTVCO0dBRGE7Ozs7O0FBV2Ysa0JBQWdCLDBCQUFXO0FBQ3pCLE1BQUUsT0FBRixDQUFVLFVBQVYsQ0FBcUIsS0FBSyxVQUFMLEVBQWlCLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FBdEMsQ0FEeUI7R0FBWDs7Ozs7OztBQVVoQixpQkFBZSx1QkFBUyxPQUFULEVBQWtCLElBQWxCLEVBQXdCO0FBQ3JDLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsVUFBSSxLQUFLLEtBQUssWUFBTCxFQUFMLENBRFk7QUFFaEIsVUFBSSxTQUFTLEtBQUssT0FBTCxDQUZHO0FBR2hCLFVBQUksTUFBTSxHQUFHLEdBQUgsQ0FITTtBQUloQixVQUFJLE1BQU0sR0FBRyxHQUFILENBSk07QUFLaEIsVUFBSSxRQUFRLElBQUksQ0FBSixHQUFRLElBQUksQ0FBSixDQUxKO0FBTWhCLFVBQUksU0FBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FOTDs7QUFRaEIsVUFBSSxNQUFNLFFBQVEsUUFBUixDQUFpQixHQUFqQixDQUFOLENBUlk7O0FBVWhCLGFBQU8sS0FBUCxHQUFlLEtBQWYsQ0FWZ0I7QUFXaEIsYUFBTyxNQUFQLEdBQWdCLE1BQWhCLENBWGdCOztBQWFoQixhQUFPLEtBQVAsQ0FBYSxLQUFiLEdBQXFCLFFBQVEsSUFBUixDQWJMO0FBY2hCLGFBQU8sS0FBUCxDQUFhLE1BQWIsR0FBc0IsU0FBUyxJQUFUOzs7O0FBZE4sVUFrQlosTUFBTSxPQUFPLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBTixDQWxCWTtBQW1CaEIsUUFBRSxJQUFGLENBQU8sZ0JBQVAsQ0FBd0IsWUFBVztBQUNqQyxZQUFJLFNBQUosQ0FBYyxDQUFkLEVBQWlCLENBQWpCLEVBQW9CLEtBQXBCLEVBQTJCLE1BQTNCLEVBRGlDO0FBRWpDLFlBQUksU0FBSixDQUFjLEtBQUssT0FBTCxFQUFjLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixFQUFPLEtBQUssQ0FBTCxFQUFRLEtBQUssQ0FBTCxDQUFsRDs7Ozs7O0FBRmlDLE9BQVgsRUFRckIsSUFSSDs7O0FBbkJnQixLQUFsQjtHQURhOzs7OztBQXNDZixVQUFRLGtCQUFZO0FBQ2xCLFFBQUksUUFBVSxLQUFLLE1BQUw7O0FBREksUUFHZCxRQUFVLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLElBQUwsQ0FBVSxPQUFWLEtBQXNCLENBQXRCLENBQVosR0FBdUMsS0FBSyxNQUFMLENBSG5DO0FBSWxCLFFBQUksVUFBVSxLQUFLLElBQUwsQ0FBVSxrQkFBVixDQUE2QixLQUFLLE9BQUwsQ0FBYSxZQUFiLEVBQTdCLENBQVYsQ0FKYztBQUtsQixRQUFJLE9BQVUsS0FBSyxlQUFMLEdBQXVCLFVBQXZCLENBQWtDLEtBQWxDLENBQVYsQ0FMYztBQU1sQixRQUFJLFFBQVUsS0FBSyxZQUFMLEdBQW9CLEdBQXBCLENBTkk7O0FBUWxCLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsV0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixLQUFuQixHQUEyQixLQUFLLENBQUwsR0FBUyxJQUFULENBRFg7QUFFaEIsV0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixNQUFuQixHQUE0QixLQUFLLENBQUwsR0FBUyxJQUFULENBRlo7QUFHaEIsUUFBRSxPQUFGLENBQVUsV0FBVixDQUFzQixLQUFLLE9BQUwsRUFBYyxLQUFwQyxFQUhnQjtLQUFsQjs7QUFNQSxRQUFJLEtBQUssT0FBTCxFQUFjO0FBQ2hCLFdBQUssYUFBTCxDQUFtQixPQUFuQixFQUE0QixJQUE1QixFQURnQjtBQUVoQixRQUFFLE9BQUYsQ0FBVSxXQUFWLENBQXNCLEtBQUssT0FBTCxFQUFjLEtBQXBDLEVBRmdCO0tBQWxCOzs7QUFka0IsUUFvQmxCLENBQUssTUFBTCxDQUFZLFlBQVosQ0FBeUIsV0FBekIsRUFDRSxFQUFFLE9BQUYsQ0FBVSxlQUFWLENBQ0UsUUFBUSxRQUFSLENBQWlCLEtBQUssY0FBTCxDQUFvQixVQUFwQixDQUErQixLQUEvQixDQUFqQixDQURGLEVBQzJELEtBRDNELENBREYsRUFwQmtCO0dBQVo7O0NBOWZPLENBQWI7OztBQTBoQkosRUFBRSxVQUFGLEdBQWUsVUFBZjtBQUNBLEVBQUUsVUFBRixHQUFlLFVBQVMsR0FBVCxFQUFjLE9BQWQsRUFBdUI7QUFDcEMsU0FBTyxJQUFJLFVBQUosQ0FBZSxHQUFmLEVBQW9CLE9BQXBCLENBQVAsQ0FEb0M7Q0FBdkI7O0FBSWYsT0FBTyxPQUFQLEdBQWlCLFVBQWpCOzs7Ozs7OztBQ3RpQkEsSUFBSSxJQUFJLFFBQVEsU0FBUixDQUFKOzs7QUFHSixJQUFJLHdCQUF3QixNQUF4QixFQUFnQztBQUNsQyxTQUFPLGNBQVAsQ0FBc0IsbUJBQW1CLFNBQW5CLEVBQThCLFdBQXBELEVBQWlFO0FBQy9ELFNBQUssZUFBVztBQUNkLGFBQU8sS0FBSyxvQkFBTCxDQUEwQixTQUExQixDQUFvQyxPQUFwQyxDQURPO0tBQVg7QUFHTCxTQUFLLGFBQVMsR0FBVCxFQUFjO0FBQ2pCLFdBQUssb0JBQUwsQ0FBMEIsU0FBMUIsQ0FBb0MsT0FBcEMsR0FBOEMsR0FBOUMsQ0FEaUI7S0FBZDtHQUpQLEVBRGtDO0NBQXBDOzs7Ozs7QUFnQkEsRUFBRSxPQUFGLENBQVUsTUFBVixHQUFtQixVQUFTLENBQVQsRUFBVztBQUM1QixTQUNFLFFBQU8sbURBQVAsS0FBZ0IsUUFBaEIsR0FDQSxhQUFhLElBQWIsR0FDQSxLQUFLLFFBQU8sNkNBQVAsS0FBYSxRQUFiLElBQ0wsT0FBTyxFQUFFLFFBQUYsS0FBZSxRQUF0QixJQUNBLE9BQU8sRUFBRSxRQUFGLEtBQWUsUUFBdEIsQ0FOMEI7Q0FBWDs7Ozs7O0FBZW5CLEVBQUUsT0FBRixDQUFVLFVBQVYsR0FBdUIsVUFBUyxHQUFULEVBQWM7QUFDbkMsTUFBSSxVQUFVLElBQUksWUFBSixDQUFpQixTQUFqQixDQUFWLENBRCtCO0FBRW5DLE1BQUksSUFBSixDQUZtQztBQUduQyxNQUFJLE9BQUosRUFBYTtBQUNYLFdBQU8sUUFBUSxLQUFSLENBQWMsR0FBZCxFQUFtQixHQUFuQixDQUF1QixVQUF2QixDQUFQLENBRFc7R0FBYixNQUVPO0FBQ0wsUUFBSSxRQUFRLElBQUksU0FBSixDQUFjLElBQWQsQ0FBUixDQURDO0FBRUwsYUFBUyxJQUFULENBQWMsV0FBZCxDQUEwQixLQUExQjs7QUFGSyxRQUlMLEdBQU8sd0JBQXdCLEtBQXhCLENBQVAsQ0FKSztBQUtMLGFBQVMsSUFBVCxDQUFjLFdBQWQsQ0FBMEIsS0FBMUIsRUFMSztBQU1MLFdBQU8sSUFBUCxDQU5LO0dBRlA7QUFVQSxTQUFPLENBQUMsS0FBSyxDQUFMLENBQUQsRUFBVSxLQUFLLENBQUwsQ0FBVixFQUFtQixLQUFLLENBQUwsSUFBVSxLQUFLLENBQUwsQ0FBVixFQUFtQixLQUFLLENBQUwsSUFBVSxLQUFLLENBQUwsQ0FBVixDQUE3QyxDQWJtQztDQUFkOzs7Ozs7O0FBc0J2QixTQUFTLHVCQUFULENBQWlDLEdBQWpDLEVBQXNDO0FBQ3BDLE1BQUksT0FBTyxDQUFDLFFBQUQsRUFBVyxRQUFYLEVBQXFCLENBQUMsUUFBRCxFQUFXLENBQUMsUUFBRCxDQUF2QyxDQURnQztBQUVwQyxNQUFJLFFBQVEsR0FBRyxLQUFILENBQVMsSUFBVCxDQUFjLElBQUksZ0JBQUosQ0FBcUIsR0FBckIsQ0FBZCxDQUFSLENBRmdDO0FBR3BDLE1BQUksTUFBTSxLQUFLLEdBQUw7TUFBVSxNQUFNLEtBQUssR0FBTCxDQUhVOztBQUtwQyxPQUFLLElBQUksSUFBSSxDQUFKLEVBQU8sTUFBTSxNQUFNLE1BQU4sRUFBYyxJQUFJLEdBQUosRUFBUyxHQUE3QyxFQUFrRDtBQUNoRCxRQUFJLE9BQU8sTUFBTSxDQUFOLENBQVAsQ0FENEM7QUFFaEQsUUFBSSxLQUFLLE9BQUwsRUFBYztBQUNoQixhQUFPLEtBQUssT0FBTCxFQUFQLENBRGdCOztBQUdoQixXQUFLLENBQUwsSUFBVSxJQUFJLEtBQUssQ0FBTCxFQUFRLEtBQUssQ0FBTCxDQUFaLENBQVYsQ0FIZ0I7QUFJaEIsV0FBSyxDQUFMLElBQVUsSUFBSSxLQUFLLENBQUwsRUFBUSxLQUFLLENBQUwsQ0FBWixDQUFWLENBSmdCOztBQU1oQixXQUFLLENBQUwsSUFBVSxJQUFJLEtBQUssQ0FBTCxHQUFTLEtBQUssS0FBTCxFQUFZLEtBQUssQ0FBTCxDQUF6QixDQUFWLENBTmdCO0FBT2hCLFdBQUssQ0FBTCxJQUFVLElBQUksS0FBSyxDQUFMLEdBQVMsS0FBSyxNQUFMLEVBQWEsS0FBSyxDQUFMLENBQTFCLENBQVYsQ0FQZ0I7S0FBbEI7R0FGRjtBQVlBLFNBQU8sSUFBUCxDQWpCb0M7Q0FBdEM7Ozs7OztBQXlCQSxFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsR0FBVCxFQUFjO0FBQ3hDLE1BQUksVUFBVSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBVixDQURvQztBQUV4QyxVQUFRLFNBQVIsR0FBb0IsR0FBcEIsQ0FGd0M7QUFHeEMsU0FBTyxRQUFRLGFBQVIsQ0FBc0IsS0FBdEIsQ0FBUCxDQUh3QztDQUFkOzs7Ozs7O0FBWTVCLEVBQUUsT0FBRixDQUFVLGVBQVYsR0FBNEIsVUFBUyxTQUFULEVBQW9CLEtBQXBCLEVBQTJCO0FBQ3JELFNBQU8sWUFDTCxDQUFDLEtBQUQsRUFBUSxDQUFSLEVBQVcsQ0FBWCxFQUFjLEtBQWQsRUFBcUIsVUFBVSxDQUFWLEVBQWEsVUFBVSxDQUFWLENBQWxDLENBQStDLElBQS9DLENBQW9ELEdBQXBELENBREssR0FDc0QsR0FEdEQsQ0FEOEM7Q0FBM0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9zdmdvdmVybGF5Jyk7XG4iLCI7KGZ1bmN0aW9uICgpIHtcblxuICB2YXIgb2JqZWN0ID0gdHlwZW9mIGV4cG9ydHMgIT0gJ3VuZGVmaW5lZCcgPyBleHBvcnRzIDogdGhpczsgLy8gIzg6IHdlYiB3b3JrZXJzXG4gIHZhciBjaGFycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XG5cbiAgZnVuY3Rpb24gSW52YWxpZENoYXJhY3RlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB9XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3I7XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG4gIC8vIGVuY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5OTE2Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9uaWduYWddXG4gIG9iamVjdC5idG9hIHx8IChcbiAgb2JqZWN0LmJ0b2EgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KTtcbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJcbiAgICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAgIC8vICAgY2hhbmdlIHRoZSBtYXBwaW5nIHRhYmxlIHRvIFwiPVwiXG4gICAgICAvLyAgIGNoZWNrIGlmIGQgaGFzIG5vIGZyYWN0aW9uYWwgZGlnaXRzXG4gICAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgICAgLy8gXCI4IC0gaWR4ICUgMSAqIDhcIiBnZW5lcmF0ZXMgdGhlIHNlcXVlbmNlIDIsIDQsIDYsIDhcbiAgICAgIG91dHB1dCArPSBtYXAuY2hhckF0KDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICAgICkge1xuICAgICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpZHggKz0gMy80KTtcbiAgICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIididG9hJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZW5jb2RlZCBjb250YWlucyBjaGFyYWN0ZXJzIG91dHNpZGUgb2YgdGhlIExhdGluMSByYW5nZS5cIik7XG4gICAgICB9XG4gICAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbiAgLy8gZGVjb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTAyMDM5Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9hdGtdXG4gIG9iamVjdC5hdG9iIHx8IChcbiAgb2JqZWN0LmF0b2IgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KS5yZXBsYWNlKC89KyQvLCAnJyk7XG4gICAgaWYgKHN0ci5sZW5ndGggJSA0ID09IDEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYXRvYicgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGRlY29kZWQgaXMgbm90IGNvcnJlY3RseSBlbmNvZGVkLlwiKTtcbiAgICB9XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyc1xuICAgICAgdmFyIGJjID0gMCwgYnMsIGJ1ZmZlciwgaWR4ID0gMCwgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBnZXQgbmV4dCBjaGFyYWN0ZXJcbiAgICAgIGJ1ZmZlciA9IHN0ci5jaGFyQXQoaWR4KyspO1xuICAgICAgLy8gY2hhcmFjdGVyIGZvdW5kIGluIHRhYmxlPyBpbml0aWFsaXplIGJpdCBzdG9yYWdlIGFuZCBhZGQgaXRzIGFzY2lpIHZhbHVlO1xuICAgICAgfmJ1ZmZlciAmJiAoYnMgPSBiYyAlIDQgPyBicyAqIDY0ICsgYnVmZmVyIDogYnVmZmVyLFxuICAgICAgICAvLyBhbmQgaWYgbm90IGZpcnN0IG9mIGVhY2ggNCBjaGFyYWN0ZXJzLFxuICAgICAgICAvLyBjb252ZXJ0IHRoZSBmaXJzdCA4IGJpdHMgdG8gb25lIGFzY2lpIGNoYXJhY3RlclxuICAgICAgICBiYysrICUgNCkgPyBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgyNTUgJiBicyA+PiAoLTIgKiBiYyAmIDYpKSA6IDBcbiAgICApIHtcbiAgICAgIC8vIHRyeSB0byBmaW5kIGNoYXJhY3RlciBpbiB0YWJsZSAoMC02Mywgbm90IGZvdW5kID0+IC0xKVxuICAgICAgYnVmZmVyID0gY2hhcnMuaW5kZXhPZihidWZmZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxufSgpKTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5taW4ueCwgdGhpcy5taW4ueSwgdGhpcy5tYXgueCwgdGhpcy5tYXgueV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5Cb3VuZHN9XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBtYXggPSB0aGlzLm1heDtcbiAgdmFyIG1pbiA9IHRoaXMubWluO1xuICB2YXIgZGVsdGFYID0gKChtYXgueCAtIG1pbi54KSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG1heC55IC0gbWluLnkpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuQm91bmRzKFtcbiAgICBbbWluLnggLSBkZWx0YVgsIG1pbi55IC0gZGVsdGFZXSxcbiAgICBbbWF4LnggKyBkZWx0YVgsIG1heC55ICsgZGVsdGFZXVxuICBdKTtcbn07XG5cblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMuZ2V0V2VzdCgpLCB0aGlzLmdldFNvdXRoKCksIHRoaXMuZ2V0RWFzdCgpLCB0aGlzLmdldE5vcnRoKCldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbmUgPSB0aGlzLl9ub3J0aEVhc3Q7XG4gIHZhciBzdyA9IHRoaXMuX3NvdXRoV2VzdDtcbiAgdmFyIGRlbHRhWCA9ICgobmUubG5nIC0gc3cubG5nKSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG5lLmxhdCAtIHN3LmxhdCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoW1xuICAgIFtzdy5sYXQgLSBkZWx0YVksIHN3LmxuZyAtIGRlbHRhWF0sXG4gICAgW25lLmxhdCArIGRlbHRhWSwgbmUubG5nICsgZGVsdGFYXVxuICBdKTtcbn07XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkNsYXNzLmV4dGVuZCh7XG5cbiAgaW5jbHVkZXM6IEwuTWl4aW4uRXZlbnRzLFxuXG4gIG9wdGlvbnM6IHtcbiAgICBvcGFjaXR5OiAxLFxuICAgIHBhZGRpbmc6IEwuUGF0aC5DTElQX1BBRERJTkdcbiAgfSxcblxuICAvKipcbiAgICogQGNsYXNzIFN2Z0xheWVyIC0gYmFzaWNhbGx5LCBqdXN0IHRoZSBTVkcgY29udGFpbmVyIHNpbWlhciB0byB0aGUgb25lXG4gICAqIHVzZWQgYnkgbGVhZmxldCBpbnRlcm5hbGx5IHRvIHJlbmRlciB2ZWN0b3IgbGF5ZXJzXG4gICAqXG4gICAqIEBleHRlbmRzIHtMLkNsYXNzfVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2NvbnRhaW5lciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhSb290ICA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLk1hcH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Cb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fbWFwID0gbWFwO1xuICAgIHRoaXMuX2luaXRQYXRoUm9vdCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGFkZFRvOiBmdW5jdGlvbihtYXApIHtcbiAgICBtYXAuYWRkTGF5ZXIodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBpZiAodGhpcy5fbWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcbiAgICAgIHRoaXMuX21hcC5vZmYoe1xuICAgICAgICAnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXG4gICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hcC5vZmYoJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgcmVtb3ZlRnJvbTogZnVuY3Rpb24obWFwKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0Zyb250OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJvb3QgPSB0aGlzLl9wYXRoUm9vdC5wYXJlbnROb2RlLFxuICAgICAgICBwYXRoID0gdGhpcy5fcGF0aFJvb3Q7XG5cbiAgICBpZiAocGF0aCAmJiByb290Lmxhc3RDaGlsZCAhPT0gcGF0aCkge1xuICAgICAgcm9vdC5hcHBlbmRDaGlsZChwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBicmluZ1RvQmFjazogZnVuY3Rpb24gKCkge1xuICAgIHZhciByb290ID0gdGhpcy5fcGF0aFJvb3QucGFyZW50Tm9kZTtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGhSb290O1xuICAgIHZhciBmaXJzdCA9IHJvb3QuZmlyc3RDaGlsZDtcblxuICAgIGlmIChwYXRoICYmIGZpcnN0ICE9PSBwYXRoKSB7XG4gICAgICByb290Lmluc2VydEJlZm9yZShwYXRoLCBmaXJzdCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBzdmcgcm9vdFxuICAgKi9cbiAgX2NyZWF0ZVJvb3Q6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGhSb290ID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnc3ZnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtaW1hZ2UtbGF5ZXInKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcGF0aFJvb3QpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEluaXQgdGhlIHJvb3QgZWxlbWVudFxuICAgKi9cbiAgX2luaXRQYXRoUm9vdDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5fcGF0aFJvb3QpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZVJvb3QoKTtcbiAgICAgIHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG5cbiAgICAgIGlmICh0aGlzLl9tYXAub3B0aW9ucy56b29tQW5pbWF0aW9uICYmIEwuQnJvd3Nlci5hbnkzZCkge1xuICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnKTtcblxuICAgICAgICB0aGlzLl9tYXAub24oe1xuICAgICAgICAgICd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVQYXRoWm9vbSxcbiAgICAgICAgICAnem9vbWVuZCc6IHRoaXMuX2VuZFBhdGhab29tXG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGhSb290LCAnbGVhZmxldC16b29tLWhpZGUnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbWFwLm9uKCdtb3ZlZW5kJywgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQsIHRoaXMpO1xuICAgICAgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogVG8gb3ZlcnJpZGUgaW4gdGhlIGNoaWxkIGNsYXNzZXNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBfZ2V0Vmlld3BvcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoVmlld3BvcnQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogVXBkYXRlIHJvb3QgcG9zaXRpb24gdG8gZ2V0IHRoZSB2aWV3cG9ydCBjb3ZlcmVkXG4gICAqL1xuICBfdXBkYXRlQ29udGVudFZpZXdwb3J0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHAgPSB0aGlzLm9wdGlvbnMucGFkZGluZztcbiAgICB2YXIgc2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG4gICAgdmFyIHBhbmVQb3MgPSBMLkRvbVV0aWwuZ2V0UG9zaXRpb24odGhpcy5fbWFwLl9tYXBQYW5lKTtcbiAgICB2YXIgbWluID0gcGFuZVBvcy5tdWx0aXBseUJ5KC0xKS5fc3VidHJhY3Qoc2l6ZS5tdWx0aXBseUJ5KHApLl9yb3VuZCgpKTtcbiAgICB2YXIgbWF4ID0gbWluLmFkZChzaXplLm11bHRpcGx5QnkoMSArIHAgKiAyKS5fcm91bmQoKSk7XG5cbiAgICB0aGlzLl9wYXRoVmlld3BvcnQgPSBuZXcgTC5Cb3VuZHMoW21pbi54LCBtaW4ueV0sIFttYXgueCwgbWF4LnldKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtab29tRXZlbnR9IGVcbiAgICovXG4gIF9hbmltYXRlUGF0aFpvb206IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIHNjYWxlID0gdGhpcy5fbWFwLmdldFpvb21TY2FsZShlLnpvb20pO1xuICAgIHZhciBvZmZzZXQgPSB0aGlzLl9tYXBcbiAgICAgIC5fZ2V0Q2VudGVyT2Zmc2V0KGUuY2VudGVyKVxuICAgICAgLl9tdWx0aXBseUJ5KC1zY2FsZSlcbiAgICAgIC5fYWRkKHRoaXMuX2dldFZpZXdwb3J0KCkubWluKTtcblxuICAgIHRoaXMuX3BhdGhSb290LnN0eWxlW0wuRG9tVXRpbC5UUkFOU0ZPUk1dID1cbiAgICAgIEwuRG9tVXRpbC5nZXRUcmFuc2xhdGVTdHJpbmcob2Zmc2V0KSArICcgc2NhbGUoJyArIHNjYWxlICsgJykgJztcblxuICAgIHRoaXMuX3BhdGhab29taW5nID0gdHJ1ZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBIZXJlIHdlIGNhbiBkbyBhZGRpdGlvbmFsIHBvc3QtYW5pbWF0aW9uIHRyYW5zZm9ybXNcbiAgICovXG4gIF9lbmRQYXRoWm9vbTogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3BhdGhab29taW5nID0gZmFsc2U7XG4gIH0sXG5cblxuICAvKipcbiAgICogQXBwbHkgdGhlIHZpZXdwb3J0IGNvcnJlY3Rpb25cbiAgICovXG4gIF91cGRhdGVTdmdWaWV3cG9ydDogZnVuY3Rpb24gKCkge1xuXG4gICAgaWYgKHRoaXMuX3BhdGhab29taW5nKSB7XG4gICAgICAvLyBEbyBub3QgdXBkYXRlIFNWR3Mgd2hpbGUgYSB6b29tIGFuaW1hdGlvbiBpcyBnb2luZyBvblxuICAgICAgLy8gb3RoZXJ3aXNlIHRoZSBhbmltYXRpb24gd2lsbCBicmVhay5cbiAgICAgIC8vIFdoZW4gdGhlIHpvb20gYW5pbWF0aW9uIGVuZHMgd2Ugd2lsbCBiZSB1cGRhdGVkIGFnYWluIGFueXdheVxuICAgICAgLy8gVGhpcyBmaXhlcyB0aGUgY2FzZSB3aGVyZSB5b3UgZG8gYSBtb21lbnR1bSBtb3ZlIGFuZFxuICAgICAgLy8gem9vbSB3aGlsZSB0aGUgbW92ZSBpcyBzdGlsbCBvbmdvaW5nLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX3VwZGF0ZUNvbnRlbnRWaWV3cG9ydCgpO1xuXG4gICAgdmFyIHZwICAgICA9IHRoaXMuX2dldFZpZXdwb3J0KCk7XG4gICAgdmFyIG1pbiAgICA9IHZwLm1pbjtcbiAgICB2YXIgbWF4ICAgID0gdnAubWF4O1xuICAgIHZhciB3aWR0aCAgPSBtYXgueCAtIG1pbi54O1xuICAgIHZhciBoZWlnaHQgPSBtYXgueSAtIG1pbi55O1xuICAgIHZhciByb290ICAgPSB0aGlzLl9wYXRoUm9vdDtcbiAgICB2YXIgcGFuZSAgID0gdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmU7XG5cbiAgICAvLyBIYWNrIHRvIG1ha2UgZmxpY2tlciBvbiBkcmFnIGVuZCBvbiBtb2JpbGUgd2Via2l0IGxlc3MgaXJyaXRhdGluZ1xuICAgIGlmIChMLkJyb3dzZXIubW9iaWxlV2Via2l0KSB7XG4gICAgICB0aGlzLl9jb250YWluZXIucmVtb3ZlQ2hpbGQocm9vdCk7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX3BhdGhSb290LCBtaW4pO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCd3aWR0aCcsIHdpZHRoKTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgaGVpZ2h0KTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgndmlld0JveCcsIFttaW4ueCwgbWluLnksIHdpZHRoLCBoZWlnaHRdLmpvaW4oJyAnKSk7XG5cbiAgICBpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHJvb3QpO1xuICAgIH1cbiAgfVxuXG59KTtcbiIsInZhciBMICAgICAgICA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBTdmdMYXllciA9IHJlcXVpcmUoJy4vc3ZnbGF5ZXInKTtcbnZhciBiNjQgICAgICA9IHJlcXVpcmUoJ0Jhc2U2NCcpO1xuXG5yZXF1aXJlKCcuL2JvdW5kcycpO1xucmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgU1ZHT3ZlcmxheSA9IFN2Z0xheWVyLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIHBhZGRpbmc6IDAuMjUsXG4gICAgb3BhY2l0eTogMSxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZSxcbiAgICBhZGp1c3RUb1NjcmVlbjogdHJ1ZVxuICAgIC8vIGxvYWQ6IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2spIHt9XG4gIH0sXG5cblxuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtTdmdMYXllcn1cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fc3ZnICAgID0gc3ZnO1xuXG4gICAgaWYgKCEoYm91bmRzIGluc3RhbmNlb2YgTC5MYXRMbmdCb3VuZHMpKSB7XG4gICAgICBvcHRpb25zID0gYm91bmRzO1xuICAgICAgYm91bmRzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5MYXRMbmdCb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fYm91bmRzID0gYm91bmRzO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXRpbyA9IDE7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3NpemUgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9vcmlnaW4gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5UcmFuc2Zvcm1hdGlvbn1cbiAgICAgKi9cbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9ICcnO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3Jhd0RhdGEgPSAnJztcblxuICAgIGlmICh0eXBlb2Ygc3ZnID09PSAnc3RyaW5nJyAmJiAhL1xcPHN2Zy9pZy50ZXN0KHN2ZykpIHtcbiAgICAgIHRoaXMuX3N2ZyA9IG51bGw7XG5cbiAgICAgIC8qKlxuICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAqL1xuICAgICAgdGhpcy5fdXJsID0gc3ZnO1xuXG4gICAgICBpZiAoIW9wdGlvbnMubG9hZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NWR092ZXJsYXkgcmVxdWlyZXMgZXh0ZXJuYWwgcmVxdWVzdCBpbXBsZW1lbnRhdGlvbi4gJytcbiAgICAgICAgICAnWW91IGhhdmUgdG8gcHJvdmlkZSBgbG9hZGAgZnVuY3Rpb24gd2l0aCB0aGUgb3B0aW9ucycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5faW1hZ2UgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2FudmFzfVxuICAgICAqL1xuICAgIHRoaXMuX2NhbnZhcyA9IG51bGw7XG5cbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgZ2V0T3JpZ2luYWxTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgcmV0dXJuIG5ldyBMLlBvaW50KFxuICAgICAgTWF0aC5hYnMoYmJveFswXSAtIGJib3hbMl0pLFxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTVkcgaXMgcmVhZHlcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzdmcgbWFya3VwXG4gICAqL1xuICBvbkxvYWQ6IGZ1bmN0aW9uKHN2Zykge1xuICAgIHRoaXMuX3Jhd0RhdGEgPSBzdmc7XG4gICAgc3ZnID0gTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lcihzdmcpO1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveCA9IEwuRG9tVXRpbC5nZXRTVkdCQm94KHN2Zyk7XG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpO1xuXG4gICAgaWYgKHN2Zy5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fcmF3RGF0YSA9IHRoaXMuX3Jhd0RhdGEucmVwbGFjZSgnPHN2ZycsXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCInICsgYmJveC5qb2luKCcgJykgKyAnXCInKTtcbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIGVkZ2VzIG9mIHRoZSBpbWFnZSwgaW4gY29vcmRpbmF0ZSBzcGFjZVxuICAgIHRoaXMuX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcyhcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMF0sIGJib3hbM11dLCBtaW5ab29tKSxcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMl0sIGJib3hbMV1dLCBtaW5ab29tKVxuICAgICk7XG5cbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHNpemUueSAhPT0gbWFwU2l6ZS55ICYmIHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbikge1xuICAgICAgdmFyIHJhdGlvID0gTWF0aC5taW4obWFwU2l6ZS54IC8gc2l6ZS54LCBtYXBTaXplLnkgLyBzaXplLnkpO1xuICAgICAgdGhpcy5fYm91bmRzID0gdGhpcy5fYm91bmRzLnNjYWxlKHJhdGlvKTtcbiAgICAgIHRoaXMuX3JhdGlvID0gcmF0aW87XG4gICAgfVxuXG4gICAgdGhpcy5fc2l6ZSAgID0gc2l6ZTtcbiAgICB0aGlzLl9vcmlnaW4gPSB0aGlzLl9tYXAucHJvamVjdCh0aGlzLl9ib3VuZHMuZ2V0Q2VudGVyKCksIG1pblpvb20pO1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KHRoaXMuX2Jib3hbMF0sIHRoaXMuX2Jib3hbMV0pO1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbmV3IEwuVHJhbnNmb3JtYXRpb24oXG4gICAgICAxLCB0aGlzLl9vcmlnaW4ueCwgMSwgdGhpcy5fb3JpZ2luLnkpO1xuXG4gICAgdGhpcy5fZ3JvdXAgPSBMLlBhdGgucHJvdG90eXBlLl9jcmVhdGVFbGVtZW50KCdnJyk7XG4gICAgaWYgKEwuQnJvd3Nlci5pZSkgeyAvLyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUVcbiAgICAgIHZhciBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgZG8ge1xuICAgICAgICB0aGlzLl9ncm91cC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgICB9IHdoaWxlKGNoaWxkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZ3JvdXAuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgICB9XG4gICAgdGhpcy5fcGF0aFJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fZ3JvdXApO1xuXG4gICAgdGhpcy5maXJlKCdsb2FkJyk7XG4gICAgdGhpcy5fb25NYXBab29tRW5kKCk7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICAgKi9cbiAgZ2V0RG9jdW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAgICovXG4gIGdldEJvdW5kczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2JvdW5kcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG4gICAqL1xuICBnZXRSYXRpbzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JhdGlvO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBtYXAgY29vcmQgdG8gc2NoZW1hdGljIHBvaW50XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBjb29yZFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgcHJvamVjdFBvaW50OiBmdW5jdGlvbihjb29yZCkge1xuICAgIHJldHVybiB0aGlzLl91bnNjYWxlUG9pbnQodGhpcy5fbWFwLnByb2plY3QoY29vcmQsIHRoaXMuX21hcC5nZXRNaW5ab29tKCkpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIHVucHJvamVjdFBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl9tYXAudW5wcm9qZWN0KHRoaXMuX3NjYWxlUG9pbnQocHQpLCB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3BhY2l0eVxuICAgKiBAcmV0dXJuIHtTVkdMYXllcn1cbiAgICovXG4gIHNldE9wYWNpdHk6IGZ1bmN0aW9uIChvcGFjaXR5KSB7XG4gICAgdGhpcy5vcHRpb25zLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgIHRoaXMuX3VwZGF0ZU9wYWNpdHkoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLkJvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICAgKi9cbiAgdW5wcm9qZWN0Qm91bmRzOiBmdW5jdGlvbihib3VuZHMpIHtcbiAgICB2YXIgc3cgPSB0aGlzLnBvaW50VG9NYXBDb29yZChib3VuZHMubWluKTtcbiAgICB2YXIgbmUgPSB0aGlzLnBvaW50VG9NYXBDb29yZChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLm1hcENvb3JkVG9Qb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5tYXBDb29yZFRvUG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgU3ZnTGF5ZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIG1hcFxuICAgICAgLm9uKCd6b29tZW5kJywgdGhpcy5fb25NYXBab29tRW5kLCB0aGlzKVxuICAgICAgLm9uKCdkcmFnc3RhcnQnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpXG4gICAgICAub24oJ3ZpZXJlc2V0IG1vdmVlbmQnLCB0aGlzLl9yZXNldCwgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBTdmdMYXllci5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICAgIG1hcFxuICAgICAgLm9mZignem9vbWVuZCcsIHRoaXMuX29uTWFwWm9vbUVuZCwgdGhpcylcbiAgICAgIC5vZmYoJ2RyYWdzdGFydCcsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpXG4gICAgICAub2ZmKCd2aWVyZXNldCBtb3ZlZW5kJywgdGhpcy5fcmVzZXQsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgd2hlblJlYWR5OiBmdW5jdGlvbihjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICh0aGlzLl9ib3VuZHMpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25jZSgnbG9hZCcsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIHRvSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAvLyB0aGlzIGRvZXNuJ3Qgd29yayBpbiBJRSwgZm9yY2Ugc2l6ZVxuICAgIC8vIGltZy5zdHlsZS5oZWlnaHQgPSBpbWcuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgaW1nLnN0eWxlLndpZHRoID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgdmFyIGNhbnZhcyA9IHRoaXMuX2NhbnZhcyB8fCBMLkRvbVV0aWwuY3JlYXRlKCdjYW52YXMnLCAnc2NoZW1hdGljLWNhbnZhcycpO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgIEwuRG9tRXZlbnQub24oaW1nLCAnbG9hZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBuYXR1cmFsU2l6ZSA9IEwucG9pbnQoaW1nLm9mZnNldFdpZHRoLCBpbWcub2Zmc2V0SGVpZ2h0KTtcbiAgICAgIC8vY29uc29sZS5sb2coJ25hdHVyYWwnLCBuYXR1cmFsU2l6ZSk7XG4gICAgICB0aGlzLl9yZXNldCgpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX2NhbnZhcyA9IGNhbnZhcztcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoY2FudmFzLCB0aGlzLl9jb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIGltZy5zdHlsZS5vcGFjaXR5ID0gMDtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3Jhc3Rlcik7XG4gICAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhpbWcsICdzY2hlbWF0aWMtaW1hZ2UnKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgICB0aGlzLl9yYXN0ZXIgPSBpbWc7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ29udmVydCBTVkcgZGF0YSB0byBiYXNlNjQgZm9yIHJhc3Rlcml6YXRpb25cbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcbiAgICovXG4gIHRvQmFzZTY0OiBmdW5jdGlvbigpIHtcbiAgICAvL2NvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcbiAgICAgIGI2NC5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yYXdEYXRhKSkpO1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSBiYXNlNjQ7XG4gICAgLy9jb25zb2xlLnRpbWVFbmQoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuICdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LCcgKyBiYXNlNjQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogV2UgbmVlZCB0byByZWRyYXcgb24gem9vbSBlbmRcbiAgICovXG4gIF9lbmRQYXRoWm9vbTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICBTdmdMYXllci5wcm90b3R5cGUuX2VuZFBhdGhab29tLmNhbGwodGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBGUk9NIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF91bnNjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5kaXZpZGVCeSh0aGlzLl9yYXRpbykpO1xuICAgIC8vIHNhbWUgYXMgYWJvdmUsIGJ1dCBub3QgdXNpbmcgdHJhbnNmb3JtIG1hdHJpeFxuICAgIC8vcmV0dXJuIHB0LnN1YnRyYWN0KHRoaXMuX29yaWdpbilcbiAgICAvLyAgLm11bHRpcGx5QnkoMS8gdGhpcy5fcmF0aW8pLmFkZCh0aGlzLl9vcmlnaW4pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgVE8gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3NjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5tdWx0aXBseUJ5KHRoaXMuX3JhdGlvKVxuICAgICk7XG4gICAgLy8gZXF1YWxzIHRvXG4gICAgLy8gcmV0dXJuIHB0LnN1YnRyYWN0KHRoaXMuX29yaWdpbilcbiAgICAvLyAgIC5tdWx0aXBseUJ5KHRoaXMuX3JhdGlvKS5hZGQodGhpcy5fb3JpZ2luKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUb2dnbGUgY2FudmFzIGluc3RlYWQgb2YgU1ZHIHdoZW4gZHJhZ2dpbmdcbiAgICovXG4gIF9zaG93UmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzLnN0eWxlLmRpc3BsYXkgICA9ICdibG9jayc7XG4gICAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX2NhbnZhcy5zdHlsZS5kaXNwbGF5ICAgPSAnbm9uZSc7XG4gICAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogSUUtb25seVxuICAgKiBSZXBsYWNlIFNWRyB3aXRoIGNhbnZhcyBiZWZvcmUgZHJhZ1xuICAgKi9cbiAgX29uUHJlRHJhZzogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmUtcmVuZGVyIGNhbnZhcyBvbiB6b29tZW5kXG4gICAqL1xuICBfb25NYXBab29tRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgIHRoaXMudG9JbWFnZSgpO1xuICAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0cyBjb25hdGluZXIgb3BhY2l0eVxuICAgKi9cbiAgX3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uKCkge1xuICAgIEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2NvbnRhaW5lciwgdGhpcy5vcHRpb25zLm9wYWNpdHkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBzaGlmZWQgY2FudmFzXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gc2l6ZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2l6ZSkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHZhciB2cCA9IHRoaXMuX2dldFZpZXdwb3J0KCk7XG4gICAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzO1xuICAgICAgdmFyIG1pbiA9IHZwLm1pbjtcbiAgICAgIHZhciBtYXggPSB2cC5tYXg7XG4gICAgICB2YXIgd2lkdGggPSBtYXgueCAtIG1pbi54O1xuICAgICAgdmFyIGhlaWdodCA9IG1heC55IC0gbWluLnk7XG5cbiAgICAgIHZhciBwb3MgPSB0b3BMZWZ0LnN1YnRyYWN0KG1pbik7XG5cbiAgICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgY2FudmFzLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHdpZHRoLCBoZWlnaHQsIHNpemUueCwgc2l6ZS55KTtcblxuICAgICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuXG4gICAgICAgIC8vIGN0eC5yZWN0KHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuICAgICAgICAvLyBjdHguc3Ryb2tlU3R5bGUgPSAncmVkJztcbiAgICAgICAgLy8gY3R4LmxpbmVXaWR0aCA9IDAuMTtcbiAgICAgICAgLy8gY3R4LnN0cm9rZSgpO1xuICAgICAgfSwgdGhpcyk7XG5cbiAgICAgIC8vdGhpcy5fcGF0aFJvb3Quc3R5bGUub3BhY2l0eSA9IDAuNTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IC0gY29tcGVuc2F0ZSB0aGUgcG9zaXRpb24gYW5kIHNjYWxlXG4gICAqL1xuICBfcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW1hZ2UgICA9IHRoaXMuX2dyb3VwO1xuICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXG4gICAgdmFyIHNjYWxlICAgPSBNYXRoLnBvdygyLCB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gMSkgKiB0aGlzLl9yYXRpbztcbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICB2YXIgc2l6ZSAgICA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG4gICAgdmFyIHZwTWluICAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbjtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS53aWR0aCA9IHNpemUueCArICdweCc7XG4gICAgICB0aGlzLl9yYXN0ZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZS55ICsgJ3B4JztcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9yYXN0ZXIsIHZwTWluKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2l6ZSk7XG4gICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB2cE1pbik7XG4gICAgfVxuXG4gICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgIHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSksIHNjYWxlKSk7XG4gIH1cblxufSk7XG5cbi8vIGV4cG9ydFxuTC5TVkdPdmVybGF5ID0gU1ZHT3ZlcmxheTtcbkwuc3ZnT3ZlcmxheSA9IGZ1bmN0aW9uKHN2Zywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFNWR092ZXJsYXkoc3ZnLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU1ZHT3ZlcmxheTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vLyA8dXNlPiB0YWdzIGFyZSBicm9rZW4gaW4gSUUgaW4gc28gbWFueSB3YXlzXG5pZiAoJ1NWR0VsZW1lbnRJbnN0YW5jZScgaW4gZ2xvYmFsKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50SW5zdGFuY2UucHJvdG90eXBlLCAnY2xhc3NOYW1lJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsID0gdmFsO1xuICAgIH1cbiAgfSk7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHsqfSAgb1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuTC5Eb21VdGlsLmlzTm9kZSA9IGZ1bmN0aW9uKG8pe1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBOb2RlID09PSAnb2JqZWN0JyA/XG4gICAgbyBpbnN0YW5jZW9mIE5vZGUgOlxuICAgIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG8ubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIG8ubm9kZU5hbWUgPT09ICdzdHJpbmcnXG4gICk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0JCb3ggPSBmdW5jdGlvbihzdmcpIHtcbiAgdmFyIHZpZXdCb3ggPSBzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94Jyk7XG4gIHZhciBiYm94O1xuICBpZiAodmlld0JveCkge1xuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbG9uZSA9IHN2Zy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG4gICAgLy8gYmJveCA9IGNsb25lLmdldEJCb3goKTtcbiAgICBiYm94ID0gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoY2xvbmUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY2xvbmUpO1xuICAgIHJldHVybiBiYm94O1xuICB9XG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbn07XG5cblxuLyoqXG4gKiBTaW1wbHkgYnJ1dGUgZm9yY2U6IHRha2VzIGFsbCBzdmcgbm9kZXMsIGNhbGN1bGF0ZXMgYm91bmRpbmcgYm94XG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5mdW5jdGlvbiBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhzdmcpIHtcbiAgdmFyIGJib3ggPSBbSW5maW5pdHksIEluZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eV07XG4gIHZhciBub2RlcyA9IFtdLnNsaWNlLmNhbGwoc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJyonKSk7XG4gIHZhciBtaW4gPSBNYXRoLm1pbiwgbWF4ID0gTWF0aC5tYXg7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IG5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcbiAgICBpZiAobm9kZS5nZXRCQm94KSB7XG4gICAgICBub2RlID0gbm9kZS5nZXRCQm94KCk7XG5cbiAgICAgIGJib3hbMF0gPSBtaW4obm9kZS54LCBiYm94WzBdKTtcbiAgICAgIGJib3hbMV0gPSBtaW4obm9kZS55LCBiYm94WzFdKTtcblxuICAgICAgYmJveFsyXSA9IG1heChub2RlLnggKyBub2RlLndpZHRoLCBiYm94WzJdKTtcbiAgICAgIGJib3hbM10gPSBtYXgobm9kZS55ICsgbm9kZS5oZWlnaHQsIGJib3hbM10pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmJveDtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyID0gZnVuY3Rpb24oc3RyKSB7XG4gIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHdyYXBwZXIuaW5uZXJIVE1MID0gc3RyO1xuICByZXR1cm4gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCdzdmcnKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBvaW50fSB0cmFuc2xhdGVcbiAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcgPSBmdW5jdGlvbih0cmFuc2xhdGUsIHNjYWxlKSB7XG4gIHJldHVybiAnbWF0cml4KCcgK1xuICAgIFtzY2FsZSwgMCwgMCwgc2NhbGUsIHRyYW5zbGF0ZS54LCB0cmFuc2xhdGUueV0uam9pbignLCcpICsgJyknO1xufTtcbiJdfQ==
