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
    padding: L.Path.CLIP_PADDING,
    zIndex: 1
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
   * @param {Number} opacity
   * @return {SVGLayer}
   */
  setOpacity: function setOpacity(opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },

  setZIndex: function setZIndex(zIndex) {
    this.options.zIndex = zIndex;
    this._updateZIndex();

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

      this._updateOpacity();
      this._updateZIndex();
    }
  },

  /**
   * Sets conatiner opacity
   */
  _updateOpacity: function _updateOpacity() {
    L.DomUtil.setOpacity(this._container, this.options.opacity);
  },

  /**
   * Sets container zIndex
   */
  _updateZIndex: function _updateZIndex() {
    if (this._container && this.options.zIndex !== undefined) {
      this._container.style.zIndex = this.options.zIndex;
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
    var scale = Math.pow(2, this._map.getZoom()) * this._ratio;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxrQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtCO0FBRXpDLE1BQUksTUFBTSxLQUFLLEdBQUwsQ0FGK0I7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UixHQUFvQixHQUFwQixDQUZ3QztBQUd4QyxTQUFPLFFBQVEsYUFBUixDQUFzQixLQUF0QixDQUFQLENBSHdDO0NBQWQ7Ozs7Ozs7QUFZNUIsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMkI7QUFDckQsU0FBTyxZQUNMLENBQUMsS0FBRCxFQUFRLENBQVIsRUFBVyxDQUFYLEVBQWMsS0FBZCxFQUFxQixVQUFVLENBQVYsRUFBYSxVQUFVLENBQVYsQ0FBbEMsQ0FBK0MsSUFBL0MsQ0FBb0QsR0FBcEQsQ0FESyxHQUNzRCxHQUR0RCxDQUQ4QztDQUEzQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3N2Z292ZXJsYXknKTtcbiIsIjsoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgZXhwb3J0cyAhPSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiB0aGlzOyAvLyAjODogd2ViIHdvcmtlcnNcbiAgdmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuICBmdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIH1cbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbiAgLy8gZW5jb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk5MTY2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL25pZ25hZ11cbiAgb2JqZWN0LmJ0b2EgfHwgKFxuICBvYmplY3QuYnRvYSA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnMsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICAgKSB7XG4gICAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzLzQpO1xuICAgICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2J0b2EnIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBlbmNvZGVkIGNvbnRhaW5zIGNoYXJhY3RlcnMgb3V0c2lkZSBvZiB0aGUgTGF0aW4xIHJhbmdlLlwiKTtcbiAgICAgIH1cbiAgICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgb2JqZWN0LmF0b2IgfHwgKFxuICBvYmplY3QuYXRvYiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpLnJlcGxhY2UoLz0rJC8sICcnKTtcbiAgICBpZiAoc3RyLmxlbmd0aCAlIDQgPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdChpZHgrKyk7XG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSAmIGJzID4+ICgtMiAqIGJjICYgNikpIDogMFxuICAgICkge1xuICAgICAgLy8gdHJ5IHRvIGZpbmQgY2hhcmFjdGVyIGluIHRhYmxlICgwLTYzLCBub3QgZm91bmQgPT4gLTEpXG4gICAgICBidWZmZXIgPSBjaGFycy5pbmRleE9mKGJ1ZmZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG59KCkpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG1heCA9IHRoaXMubWF4O1xuICB2YXIgbWluID0gdGhpcy5taW47XG4gIHZhciBkZWx0YVggPSAoKG1heC54IC0gbWluLngpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobWF4LnkgLSBtaW4ueSkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5Cb3VuZHMoW1xuICAgIFttaW4ueCAtIGRlbHRhWCwgbWluLnkgLSBkZWx0YVldLFxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXG4gIF0pO1xufTtcblxuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcbiAgdmFyIHN3ID0gdGhpcy5fc291dGhXZXN0O1xuICB2YXIgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcbiAgICBbbmUubGF0ICsgZGVsdGFZLCBuZS5sbmcgKyBkZWx0YVhdXG4gIF0pO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuQ2xhc3MuZXh0ZW5kKHtcblxuICBpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDEsXG4gICAgcGFkZGluZzogTC5QYXRoLkNMSVBfUEFERElORyxcbiAgICB6SW5kZXg6IDFcbiAgfSxcblxuICAvKipcbiAgICogQGNsYXNzIFN2Z0xheWVyIC0gYmFzaWNhbGx5LCBqdXN0IHRoZSBTVkcgY29udGFpbmVyIHNpbWlhciB0byB0aGUgb25lXG4gICAqIHVzZWQgYnkgbGVhZmxldCBpbnRlcm5hbGx5IHRvIHJlbmRlciB2ZWN0b3IgbGF5ZXJzXG4gICAqXG4gICAqIEBleHRlbmRzIHtMLkNsYXNzfVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2NvbnRhaW5lciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhSb290ICA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLk1hcH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Cb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fbWFwID0gbWFwO1xuICAgIHRoaXMuX2luaXRQYXRoUm9vdCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGFkZFRvOiBmdW5jdGlvbihtYXApIHtcbiAgICBtYXAuYWRkTGF5ZXIodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBpZiAodGhpcy5fbWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcbiAgICAgIHRoaXMuX21hcC5vZmYoe1xuICAgICAgICAnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXG4gICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hcC5vZmYoJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgcmVtb3ZlRnJvbTogZnVuY3Rpb24obWFwKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0Zyb250OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJvb3QgPSB0aGlzLl9wYXRoUm9vdC5wYXJlbnROb2RlLFxuICAgICAgICBwYXRoID0gdGhpcy5fcGF0aFJvb3Q7XG5cbiAgICBpZiAocGF0aCAmJiByb290Lmxhc3RDaGlsZCAhPT0gcGF0aCkge1xuICAgICAgcm9vdC5hcHBlbmRDaGlsZChwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBicmluZ1RvQmFjazogZnVuY3Rpb24gKCkge1xuICAgIHZhciByb290ID0gdGhpcy5fcGF0aFJvb3QucGFyZW50Tm9kZTtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGhSb290O1xuICAgIHZhciBmaXJzdCA9IHJvb3QuZmlyc3RDaGlsZDtcblxuICAgIGlmIChwYXRoICYmIGZpcnN0ICE9PSBwYXRoKSB7XG4gICAgICByb290Lmluc2VydEJlZm9yZShwYXRoLCBmaXJzdCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcGFjaXR5XG4gICAqIEByZXR1cm4ge1NWR0xheWVyfVxuICAgKi9cbiAgc2V0T3BhY2l0eTogZnVuY3Rpb24gKG9wYWNpdHkpIHtcbiAgICB0aGlzLm9wdGlvbnMub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgdGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgc2V0WkluZGV4OiBmdW5jdGlvbiAoekluZGV4KSB7XG4gICAgdGhpcy5vcHRpb25zLnpJbmRleCA9IHpJbmRleDtcbiAgICB0aGlzLl91cGRhdGVaSW5kZXgoKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBzdmcgcm9vdFxuICAgKi9cbiAgX2NyZWF0ZVJvb3Q6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGhSb290ID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnc3ZnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtaW1hZ2UtbGF5ZXInKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcGF0aFJvb3QpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEluaXQgdGhlIHJvb3QgZWxlbWVudFxuICAgKi9cbiAgX2luaXRQYXRoUm9vdDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5fcGF0aFJvb3QpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZVJvb3QoKTtcbiAgICAgIHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG5cbiAgICAgIGlmICh0aGlzLl9tYXAub3B0aW9ucy56b29tQW5pbWF0aW9uICYmIEwuQnJvd3Nlci5hbnkzZCkge1xuICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnKTtcblxuICAgICAgICB0aGlzLl9tYXAub24oe1xuICAgICAgICAgICd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVQYXRoWm9vbSxcbiAgICAgICAgICAnem9vbWVuZCc6IHRoaXMuX2VuZFBhdGhab29tXG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGhSb290LCAnbGVhZmxldC16b29tLWhpZGUnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbWFwLm9uKCdtb3ZlZW5kJywgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQsIHRoaXMpO1xuICAgICAgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQoKTtcblxuICAgICAgdGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xuICAgICAgdGhpcy5fdXBkYXRlWkluZGV4KCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNldHMgY29uYXRpbmVyIG9wYWNpdHlcbiAgICovXG4gIF91cGRhdGVPcGFjaXR5OiBmdW5jdGlvbigpIHtcbiAgICBMLkRvbVV0aWwuc2V0T3BhY2l0eSh0aGlzLl9jb250YWluZXIsIHRoaXMub3B0aW9ucy5vcGFjaXR5KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXRzIGNvbnRhaW5lciB6SW5kZXhcbiAgICovXG4gIF91cGRhdGVaSW5kZXg6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY29udGFpbmVyICYmIHRoaXMub3B0aW9ucy56SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnN0eWxlLnpJbmRleCA9IHRoaXMub3B0aW9ucy56SW5kZXg7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvIG92ZXJyaWRlIGluIHRoZSBjaGlsZCBjbGFzc2VzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgX2dldFZpZXdwb3J0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aFZpZXdwb3J0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSByb290IHBvc2l0aW9uIHRvIGdldCB0aGUgdmlld3BvcnQgY292ZXJlZFxuICAgKi9cbiAgX3VwZGF0ZUNvbnRlbnRWaWV3cG9ydDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBwID0gdGhpcy5vcHRpb25zLnBhZGRpbmc7XG4gICAgdmFyIHNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuICAgIHZhciBwYW5lUG9zID0gTC5Eb21VdGlsLmdldFBvc2l0aW9uKHRoaXMuX21hcC5fbWFwUGFuZSk7XG4gICAgdmFyIG1pbiA9IHBhbmVQb3MubXVsdGlwbHlCeSgtMSkuX3N1YnRyYWN0KHNpemUubXVsdGlwbHlCeShwKS5fcm91bmQoKSk7XG4gICAgdmFyIG1heCA9IG1pbi5hZGQoc2l6ZS5tdWx0aXBseUJ5KDEgKyBwICogMikuX3JvdW5kKCkpO1xuXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbmV3IEwuQm91bmRzKFttaW4ueCwgbWluLnldLCBbbWF4LngsIG1heC55XSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Wm9vbUV2ZW50fSBlXG4gICAqL1xuICBfYW5pbWF0ZVBhdGhab29tOiBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBzY2FsZSA9IHRoaXMuX21hcC5nZXRab29tU2NhbGUoZS56b29tKTtcbiAgICB2YXIgb2Zmc2V0ID0gdGhpcy5fbWFwXG4gICAgICAuX2dldENlbnRlck9mZnNldChlLmNlbnRlcilcbiAgICAgIC5fbXVsdGlwbHlCeSgtc2NhbGUpXG4gICAgICAuX2FkZCh0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbik7XG5cbiAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9XG4gICAgICBMLkRvbVV0aWwuZ2V0VHJhbnNsYXRlU3RyaW5nKG9mZnNldCkgKyAnIHNjYWxlKCcgKyBzY2FsZSArICcpICc7XG5cbiAgICB0aGlzLl9wYXRoWm9vbWluZyA9IHRydWU7XG4gIH0sXG5cblxuICAvKipcbiAgICogSGVyZSB3ZSBjYW4gZG8gYWRkaXRpb25hbCBwb3N0LWFuaW1hdGlvbiB0cmFuc2Zvcm1zXG4gICAqL1xuICBfZW5kUGF0aFpvb206IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wYXRoWm9vbWluZyA9IGZhbHNlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGx5IHRoZSB2aWV3cG9ydCBjb3JyZWN0aW9uXG4gICAqL1xuICBfdXBkYXRlU3ZnVmlld3BvcnQ6IGZ1bmN0aW9uICgpIHtcblxuICAgIGlmICh0aGlzLl9wYXRoWm9vbWluZykge1xuICAgICAgLy8gRG8gbm90IHVwZGF0ZSBTVkdzIHdoaWxlIGEgem9vbSBhbmltYXRpb24gaXMgZ29pbmcgb25cbiAgICAgIC8vIG90aGVyd2lzZSB0aGUgYW5pbWF0aW9uIHdpbGwgYnJlYWsuXG4gICAgICAvLyBXaGVuIHRoZSB6b29tIGFuaW1hdGlvbiBlbmRzIHdlIHdpbGwgYmUgdXBkYXRlZCBhZ2FpbiBhbnl3YXlcbiAgICAgIC8vIFRoaXMgZml4ZXMgdGhlIGNhc2Ugd2hlcmUgeW91IGRvIGEgbW9tZW50dW0gbW92ZSBhbmRcbiAgICAgIC8vIHpvb20gd2hpbGUgdGhlIG1vdmUgaXMgc3RpbGwgb25nb2luZy5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl91cGRhdGVDb250ZW50Vmlld3BvcnQoKTtcblxuICAgIHZhciB2cCAgICAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpO1xuICAgIHZhciBtaW4gICAgPSB2cC5taW47XG4gICAgdmFyIG1heCAgICA9IHZwLm1heDtcbiAgICB2YXIgd2lkdGggID0gbWF4LnggLSBtaW4ueDtcbiAgICB2YXIgaGVpZ2h0ID0gbWF4LnkgLSBtaW4ueTtcbiAgICB2YXIgcm9vdCAgID0gdGhpcy5fcGF0aFJvb3Q7XG4gICAgdmFyIHBhbmUgICA9IHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lO1xuXG4gICAgLy8gSGFjayB0byBtYWtlIGZsaWNrZXIgb24gZHJhZyBlbmQgb24gbW9iaWxlIHdlYmtpdCBsZXNzIGlycml0YXRpbmdcbiAgICBpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnJlbW92ZUNoaWxkKHJvb3QpO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9wYXRoUm9vdCwgbWluKTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCB3aWR0aCk7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIGhlaWdodCk7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBbbWluLngsIG1pbi55LCB3aWR0aCwgaGVpZ2h0XS5qb2luKCcgJykpO1xuXG4gICAgaWYgKEwuQnJvd3Nlci5tb2JpbGVXZWJraXQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChyb290KTtcbiAgICB9XG4gIH1cblxufSk7XG4iLCJ2YXIgTCAgICAgICAgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgU3ZnTGF5ZXIgPSByZXF1aXJlKCcuL3N2Z2xheWVyJyk7XG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcblxucmVxdWlyZSgnLi9ib3VuZHMnKTtcbnJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIFNWR092ZXJsYXkgPSBTdmdMYXllci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjI1LFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllLFxuICAgIGFkanVzdFRvU2NyZWVuOiB0cnVlXG4gICAgLy8gbG9hZDogZnVuY3Rpb24odXJsLCBjYWxsYmFjaykge31cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge1N2Z0xheWVyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9zdmcgICAgPSBzdmc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ0JvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX3JhdGlvID0gMTtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlRyYW5zZm9ybWF0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xuICAgICAgdGhpcy5fc3ZnID0gbnVsbDtcblxuICAgICAgLyoqXG4gICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XG5cbiAgICAgIGlmICghb3B0aW9ucy5sb2FkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9pbWFnZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzID0gbnVsbDtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBnZXRPcmlnaW5hbFNpemU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoXG4gICAgICBNYXRoLmFicyhiYm94WzBdIC0gYmJveFsyXSksXG4gICAgICBNYXRoLmFicyhiYm94WzFdIC0gYmJveFszXSlcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgdGhpcy5fcmF3RGF0YSA9IHN2ZztcbiAgICBzdmcgPSBMLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyKHN2Zyk7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94ID0gTC5Eb21VdGlsLmdldFNWR0JCb3goc3ZnKTtcbiAgICB2YXIgbWluWm9vbSA9IHRoaXMuX21hcC5nZXRNaW5ab29tKCk7XG5cbiAgICBpZiAoc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9yYXdEYXRhID0gdGhpcy5fcmF3RGF0YS5yZXBsYWNlKCc8c3ZnJyxcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIicgKyBiYm94LmpvaW4oJyAnKSArICdcIicpO1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgZWRnZXMgb2YgdGhlIGltYWdlLCBpbiBjb29yZGluYXRlIHNwYWNlXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFswXSwgYmJveFszXV0sIG1pblpvb20pLFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFsyXSwgYmJveFsxXV0sIG1pblpvb20pXG4gICAgKTtcblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICB2YXIgbWFwU2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG5cbiAgICBpZiAoc2l6ZS55ICE9PSBtYXBTaXplLnkgJiYgdGhpcy5vcHRpb25zLmFkanVzdFRvU2NyZWVuKSB7XG4gICAgICB2YXIgcmF0aW8gPSBNYXRoLm1pbihtYXBTaXplLnggLyBzaXplLngsIG1hcFNpemUueSAvIHNpemUueSk7XG4gICAgICB0aGlzLl9ib3VuZHMgPSB0aGlzLl9ib3VuZHMuc2NhbGUocmF0aW8pO1xuICAgICAgdGhpcy5fcmF0aW8gPSByYXRpbztcbiAgICB9XG5cbiAgICB0aGlzLl9zaXplICAgPSBzaXplO1xuICAgIHRoaXMuX29yaWdpbiA9IHRoaXMuX21hcC5wcm9qZWN0KHRoaXMuX2JvdW5kcy5nZXRDZW50ZXIoKSwgbWluWm9vbSk7XG4gICAgdGhpcy5fdmlld0JveE9mZnNldCA9IEwucG9pbnQodGhpcy5fYmJveFswXSwgdGhpcy5fYmJveFsxXSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBuZXcgTC5UcmFuc2Zvcm1hdGlvbihcbiAgICAgIDEsIHRoaXMuX29yaWdpbi54LCAxLCB0aGlzLl9vcmlnaW4ueSk7XG5cbiAgICB0aGlzLl9ncm91cCA9IEwuUGF0aC5wcm90b3R5cGUuX2NyZWF0ZUVsZW1lbnQoJ2cnKTtcbiAgICBpZiAoTC5Ccm93c2VyLmllKSB7IC8vIGlubmVySFRNTCBkb2Vzbid0IHdvcmsgZm9yIFNWRyBpbiBJRVxuICAgICAgdmFyIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgICBkbyB7XG4gICAgICAgIHRoaXMuX2dyb3VwLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICAgIH0gd2hpbGUoY2hpbGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ncm91cC5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoUm9vdC5hcHBlbmRDaGlsZCh0aGlzLl9ncm91cCk7XG5cbiAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcbiAgICB0aGlzLl9vbk1hcFpvb21FbmQoKTtcbiAgICB0aGlzLl9yZXNldCgpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gICAqL1xuICBnZXREb2N1bWVudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dyb3VwO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICAgKi9cbiAgZ2V0Qm91bmRzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fYm91bmRzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmF0aW87XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Vuc2NhbGVQb2ludCh0aGlzLl9tYXAucHJvamVjdChjb29yZCwgdGhpcy5fbWFwLmdldE1pblpvb20oKSkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC51bnByb2plY3QodGhpcy5fc2NhbGVQb2ludChwdCksIHRoaXMuX21hcC5nZXRNaW5ab29tKCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5taW4pO1xuICAgIHZhciBuZSA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5tYXgpO1xuICAgIHJldHVybiBMLmxhdExuZ0JvdW5kcyhzdywgbmUpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBsYXllckJvdW5kcyB0byBzY2hlbWF0aWMgYmJveFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgcHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgcmV0dXJuIG5ldyBMLkJvdW5kcyhcbiAgICAgIHRoaXMubWFwQ29vcmRUb1BvaW50KGJvdW5kcy5nZXRTb3V0aFdlc3QoKSksXG4gICAgICB0aGlzLm1hcENvb3JkVG9Qb2ludChib3VuZHMuZ2V0Tm9ydGhFYXN0KCkpXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxuICAgKi9cbiAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5vbkxvYWQoc3ZnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBTdmdMYXllci5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgbWFwXG4gICAgICAub24oJ3pvb21lbmQnLCB0aGlzLl9vbk1hcFpvb21FbmQsIHRoaXMpXG4gICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vbigndmllcmVzZXQgbW92ZWVuZCcsIHRoaXMuX3Jlc2V0LCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5fc3ZnKSB7XG4gICAgICB0aGlzLmxvYWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgbWFwXG4gICAgICAub2ZmKCd6b29tZW5kJywgdGhpcy5fb25NYXBab29tRW5kLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ3N0YXJ0JywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vZmYoJ3ZpZXJlc2V0IG1vdmVlbmQnLCB0aGlzLl9yZXNldCwgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAgeyo9fSAgICAgICBjb250ZXh0XG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICB3aGVuUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuX2JvdW5kcykge1xuICAgICAgY2FsbGJhY2suY2FsbChjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbmNlKCdsb2FkJywgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSYXN0ZXJpemVzIHRoZSBzY2hlbWF0aWNcbiAgICogQHJldHVybiB7U2NoZW1hdGljfVxuICAgKi9cbiAgdG9JbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggPSB0aGlzLl9zaXplLnggKyAncHgnO1xuICAgIGltZy5zdHlsZS5oZWlnaHQgPSB0aGlzLl9zaXplLnkgKyAncHgnO1xuICAgIGltZy5zcmMgPSB0aGlzLnRvQmFzZTY0KCk7XG5cbiAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzIHx8IEwuRG9tVXRpbC5jcmVhdGUoJ2NhbnZhcycsICdzY2hlbWF0aWMtY2FudmFzJyk7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5hdHVyYWxTaXplID0gTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgLy9jb25zb2xlLmxvZygnbmF0dXJhbCcsIG5hdHVyYWxTaXplKTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzID0gY2FudmFzO1xuICAgICAgdGhpcy5fY29udGFpbmVyLmluc2VydEJlZm9yZShjYW52YXMsIHRoaXMuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgaW1nLnN0eWxlLm9wYWNpdHkgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChpbWcpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vY29uc29sZS50aW1lKCdiYXNlNjQnKTtcbiAgICB2YXIgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Jhd0RhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvL2NvbnNvbGUudGltZUVuZCgnYmFzZTY0Jyk7XG5cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBXZSBuZWVkIHRvIHJlZHJhdyBvbiB6b29tIGVuZFxuICAgKi9cbiAgX2VuZFBhdGhab29tOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5fZW5kUGF0aFpvb20uY2FsbCh0aGlzKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IEZST00gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3Vuc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gICAgLy8gc2FtZSBhcyBhYm92ZSwgYnV0IG5vdCB1c2luZyB0cmFuc2Zvcm0gbWF0cml4XG4gICAgLy9yZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAubXVsdGlwbHlCeSgxLyB0aGlzLl9yYXRpbykuYWRkKHRoaXMuX29yaWdpbik7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXG4gICAgKTtcbiAgICAvLyBlcXVhbHMgdG9cbiAgICAvLyByZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAgLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pLmFkZCh0aGlzLl9vcmlnaW4pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xuICAgKi9cbiAgX3Nob3dSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9jYW52YXMuc3R5bGUuZGlzcGxheSAgID0gJ2Jsb2NrJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN3YXAgYmFjayB0byBTVkdcbiAgICovXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzLnN0eWxlLmRpc3BsYXkgICA9ICdub25lJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZS1yZW5kZXIgY2FudmFzIG9uIHpvb21lbmRcbiAgICovXG4gIF9vbk1hcFpvb21FbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICAgdGhpcy50b0ltYWdlKCk7XG4gICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZWRyYXcgc2hpZmVkIGNhbnZhc1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSB0b3BMZWZ0XG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHNpemVcbiAgICovXG4gIF9yZWRyYXdDYW52YXM6IGZ1bmN0aW9uKHRvcExlZnQsIHNpemUpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB2YXIgdnAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpO1xuICAgICAgdmFyIGNhbnZhcyA9IHRoaXMuX2NhbnZhcztcbiAgICAgIHZhciBtaW4gPSB2cC5taW47XG4gICAgICB2YXIgbWF4ID0gdnAubWF4O1xuICAgICAgdmFyIHdpZHRoID0gbWF4LnggLSBtaW4ueDtcbiAgICAgIHZhciBoZWlnaHQgPSBtYXgueSAtIG1pbi55O1xuXG4gICAgICB2YXIgcG9zID0gdG9wTGVmdC5zdWJ0cmFjdChtaW4pO1xuXG4gICAgICBjYW52YXMud2lkdGggPSB3aWR0aDtcbiAgICAgIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgIGNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuXG4gICAgICAvLyBjb25zb2xlLmxvZyh3aWR0aCwgaGVpZ2h0LCBzaXplLngsIHNpemUueSk7XG5cbiAgICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKVxuICAgICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fcmFzdGVyLCBwb3MueCwgcG9zLnksIHNpemUueCwgc2l6ZS55KTtcblxuICAgICAgICAvLyBjdHgucmVjdChwb3MueCwgcG9zLnksIHNpemUueCwgc2l6ZS55KTtcbiAgICAgICAgLy8gY3R4LnN0cm9rZVN0eWxlID0gJ3JlZCc7XG4gICAgICAgIC8vIGN0eC5saW5lV2lkdGggPSAwLjE7XG4gICAgICAgIC8vIGN0eC5zdHJva2UoKTtcbiAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAvL3RoaXMuX3BhdGhSb290LnN0eWxlLm9wYWNpdHkgPSAwLjU7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyAtIGNvbXBlbnNhdGUgdGhlIHBvc2l0aW9uIGFuZCBzY2FsZVxuICAgKi9cbiAgX3Jlc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGltYWdlICAgPSB0aGlzLl9ncm91cDtcbiAgICAvLyBzY2FsZSBpcyBzY2FsZSBmYWN0b3IsIHpvb20gaXMgem9vbSBsZXZlbFxuICAgIHZhciBzY2FsZSAgID0gTWF0aC5wb3coMiwgdGhpcy5fbWFwLmdldFpvb20oKSkgKiB0aGlzLl9yYXRpbztcbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICB2YXIgc2l6ZSAgICA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG4gICAgdmFyIHZwTWluICAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbjtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS53aWR0aCA9IHNpemUueCArICdweCc7XG4gICAgICB0aGlzLl9yYXN0ZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZS55ICsgJ3B4JztcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9yYXN0ZXIsIHZwTWluKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2l6ZSk7XG4gICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB2cE1pbik7XG4gICAgfVxuXG4gICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgIHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSksIHNjYWxlKSk7XG4gIH1cblxufSk7XG5cbi8vIGV4cG9ydFxuTC5TVkdPdmVybGF5ID0gU1ZHT3ZlcmxheTtcbkwuc3ZnT3ZlcmxheSA9IGZ1bmN0aW9uKHN2Zywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFNWR092ZXJsYXkoc3ZnLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU1ZHT3ZlcmxheTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vLyA8dXNlPiB0YWdzIGFyZSBicm9rZW4gaW4gSUUgaW4gc28gbWFueSB3YXlzXG5pZiAoJ1NWR0VsZW1lbnRJbnN0YW5jZScgaW4gZ2xvYmFsKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50SW5zdGFuY2UucHJvdG90eXBlLCAnY2xhc3NOYW1lJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsID0gdmFsO1xuICAgIH1cbiAgfSk7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHsqfSAgb1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuTC5Eb21VdGlsLmlzTm9kZSA9IGZ1bmN0aW9uKG8pe1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBOb2RlID09PSAnb2JqZWN0JyA/XG4gICAgbyBpbnN0YW5jZW9mIE5vZGUgOlxuICAgIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG8ubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIG8ubm9kZU5hbWUgPT09ICdzdHJpbmcnXG4gICk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0JCb3ggPSBmdW5jdGlvbihzdmcpIHtcbiAgdmFyIHZpZXdCb3ggPSBzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94Jyk7XG4gIHZhciBiYm94O1xuICBpZiAodmlld0JveCkge1xuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbG9uZSA9IHN2Zy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG4gICAgLy8gYmJveCA9IGNsb25lLmdldEJCb3goKTtcbiAgICBiYm94ID0gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoY2xvbmUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY2xvbmUpO1xuICAgIHJldHVybiBiYm94O1xuICB9XG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbn07XG5cblxuLyoqXG4gKiBTaW1wbHkgYnJ1dGUgZm9yY2U6IHRha2VzIGFsbCBzdmcgbm9kZXMsIGNhbGN1bGF0ZXMgYm91bmRpbmcgYm94XG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5mdW5jdGlvbiBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhzdmcpIHtcbiAgdmFyIGJib3ggPSBbSW5maW5pdHksIEluZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eV07XG4gIHZhciBub2RlcyA9IFtdLnNsaWNlLmNhbGwoc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJyonKSk7XG4gIHZhciBtaW4gPSBNYXRoLm1pbiwgbWF4ID0gTWF0aC5tYXg7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IG5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcbiAgICBpZiAobm9kZS5nZXRCQm94KSB7XG4gICAgICBub2RlID0gbm9kZS5nZXRCQm94KCk7XG5cbiAgICAgIGJib3hbMF0gPSBtaW4obm9kZS54LCBiYm94WzBdKTtcbiAgICAgIGJib3hbMV0gPSBtaW4obm9kZS55LCBiYm94WzFdKTtcblxuICAgICAgYmJveFsyXSA9IG1heChub2RlLnggKyBub2RlLndpZHRoLCBiYm94WzJdKTtcbiAgICAgIGJib3hbM10gPSBtYXgobm9kZS55ICsgbm9kZS5oZWlnaHQsIGJib3hbM10pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmJveDtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyID0gZnVuY3Rpb24oc3RyKSB7XG4gIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHdyYXBwZXIuaW5uZXJIVE1MID0gc3RyO1xuICByZXR1cm4gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCdzdmcnKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBvaW50fSB0cmFuc2xhdGVcbiAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcgPSBmdW5jdGlvbih0cmFuc2xhdGUsIHNjYWxlKSB7XG4gIHJldHVybiAnbWF0cml4KCcgK1xuICAgIFtzY2FsZSwgMCwgMCwgc2NhbGUsIHRyYW5zbGF0ZS54LCB0cmFuc2xhdGUueV0uam9pbignLCcpICsgJyknO1xufTtcbiJdfQ==
