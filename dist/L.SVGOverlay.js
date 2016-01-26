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
    var root = this._container.parentNode;
    var container = this._container;

    if (container && root.lastChild !== container) {
      root.appendChild(container);
    }
    return this;
  },

  /**
   * @return {SvgLayer}
   */
  bringToBack: function bringToBack() {
    var root = this._container.parentNode;
    var container = this._container;
    var first = root.firstChild;

    if (container && first !== container) {
      root.insertBefore(container, first);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxrQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtCO0FBRXpDLE1BQUksTUFBTSxLQUFLLEdBQUwsQ0FGK0I7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O0FBRXhDLFVBQVEsU0FBUixHQUFvQixHQUFwQixDQUZ3QztBQUd4QyxTQUFPLFFBQVEsYUFBUixDQUFzQixLQUF0QixDQUFQLENBSHdDO0NBQWQ7Ozs7Ozs7QUFZNUIsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMkI7QUFDckQsU0FBTyxZQUNMLENBQUMsS0FBRCxFQUFRLENBQVIsRUFBVyxDQUFYLEVBQWMsS0FBZCxFQUFxQixVQUFVLENBQVYsRUFBYSxVQUFVLENBQVYsQ0FBbEMsQ0FBK0MsSUFBL0MsQ0FBb0QsR0FBcEQsQ0FESyxHQUNzRCxHQUR0RCxDQUQ4QztDQUEzQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3N2Z292ZXJsYXknKTtcbiIsIjsoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgZXhwb3J0cyAhPSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiB0aGlzOyAvLyAjODogd2ViIHdvcmtlcnNcbiAgdmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuICBmdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIH1cbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbiAgLy8gZW5jb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk5MTY2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL25pZ25hZ11cbiAgb2JqZWN0LmJ0b2EgfHwgKFxuICBvYmplY3QuYnRvYSA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnMsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICAgKSB7XG4gICAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzLzQpO1xuICAgICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2J0b2EnIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBlbmNvZGVkIGNvbnRhaW5zIGNoYXJhY3RlcnMgb3V0c2lkZSBvZiB0aGUgTGF0aW4xIHJhbmdlLlwiKTtcbiAgICAgIH1cbiAgICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgb2JqZWN0LmF0b2IgfHwgKFxuICBvYmplY3QuYXRvYiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpLnJlcGxhY2UoLz0rJC8sICcnKTtcbiAgICBpZiAoc3RyLmxlbmd0aCAlIDQgPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdChpZHgrKyk7XG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSAmIGJzID4+ICgtMiAqIGJjICYgNikpIDogMFxuICAgICkge1xuICAgICAgLy8gdHJ5IHRvIGZpbmQgY2hhcmFjdGVyIGluIHRhYmxlICgwLTYzLCBub3QgZm91bmQgPT4gLTEpXG4gICAgICBidWZmZXIgPSBjaGFycy5pbmRleE9mKGJ1ZmZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG59KCkpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG1heCA9IHRoaXMubWF4O1xuICB2YXIgbWluID0gdGhpcy5taW47XG4gIHZhciBkZWx0YVggPSAoKG1heC54IC0gbWluLngpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobWF4LnkgLSBtaW4ueSkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5Cb3VuZHMoW1xuICAgIFttaW4ueCAtIGRlbHRhWCwgbWluLnkgLSBkZWx0YVldLFxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXG4gIF0pO1xufTtcblxuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcbiAgdmFyIHN3ID0gdGhpcy5fc291dGhXZXN0O1xuICB2YXIgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcbiAgICBbbmUubGF0ICsgZGVsdGFZLCBuZS5sbmcgKyBkZWx0YVhdXG4gIF0pO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuQ2xhc3MuZXh0ZW5kKHtcblxuICBpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDEsXG4gICAgcGFkZGluZzogTC5QYXRoLkNMSVBfUEFERElORyxcbiAgICB6SW5kZXg6IDFcbiAgfSxcblxuICAvKipcbiAgICogQGNsYXNzIFN2Z0xheWVyIC0gYmFzaWNhbGx5LCBqdXN0IHRoZSBTVkcgY29udGFpbmVyIHNpbWlhciB0byB0aGUgb25lXG4gICAqIHVzZWQgYnkgbGVhZmxldCBpbnRlcm5hbGx5IHRvIHJlbmRlciB2ZWN0b3IgbGF5ZXJzXG4gICAqXG4gICAqIEBleHRlbmRzIHtMLkNsYXNzfVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2NvbnRhaW5lciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhSb290ICA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLk1hcH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Cb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fbWFwID0gbWFwO1xuICAgIHRoaXMuX2luaXRQYXRoUm9vdCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGFkZFRvOiBmdW5jdGlvbihtYXApIHtcbiAgICBtYXAuYWRkTGF5ZXIodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBpZiAodGhpcy5fbWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcbiAgICAgIHRoaXMuX21hcC5vZmYoe1xuICAgICAgICAnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXG4gICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hcC5vZmYoJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgcmVtb3ZlRnJvbTogZnVuY3Rpb24obWFwKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0Zyb250OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJvb3QgPSB0aGlzLl9jb250YWluZXIucGFyZW50Tm9kZTtcbiAgICB2YXIgY29udGFpbmVyID0gdGhpcy5fY29udGFpbmVyO1xuXG4gICAgaWYgKGNvbnRhaW5lciAmJiByb290Lmxhc3RDaGlsZCAhPT0gY29udGFpbmVyKSB7XG4gICAgICByb290LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0JhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcm9vdCA9IHRoaXMuX2NvbnRhaW5lci5wYXJlbnROb2RlO1xuICAgIHZhciBjb250YWluZXIgPSB0aGlzLl9jb250YWluZXI7XG4gICAgdmFyIGZpcnN0ID0gcm9vdC5maXJzdENoaWxkO1xuXG4gICAgaWYgKGNvbnRhaW5lciAmJiBmaXJzdCAhPT0gY29udGFpbmVyKSB7XG4gICAgICByb290Lmluc2VydEJlZm9yZShjb250YWluZXIsIGZpcnN0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wYWNpdHlcbiAgICogQHJldHVybiB7U1ZHTGF5ZXJ9XG4gICAqL1xuICBzZXRPcGFjaXR5OiBmdW5jdGlvbiAob3BhY2l0eSkge1xuICAgIHRoaXMub3B0aW9ucy5vcGFjaXR5ID0gb3BhY2l0eTtcbiAgICB0aGlzLl91cGRhdGVPcGFjaXR5KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICBzZXRaSW5kZXg6IGZ1bmN0aW9uICh6SW5kZXgpIHtcbiAgICB0aGlzLm9wdGlvbnMuekluZGV4ID0gekluZGV4O1xuICAgIHRoaXMuX3VwZGF0ZVpJbmRleCgpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIHN2ZyByb290XG4gICAqL1xuICBfY3JlYXRlUm9vdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aFJvb3QgPSBMLlBhdGgucHJvdG90eXBlLl9jcmVhdGVFbGVtZW50KCdzdmcnKTtcbiAgICB0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbGVhZmxldC1pbWFnZS1sYXllcicpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9wYXRoUm9vdCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogSW5pdCB0aGUgcm9vdCBlbGVtZW50XG4gICAqL1xuICBfaW5pdFBhdGhSb290OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9wYXRoUm9vdCkge1xuICAgICAgdGhpcy5fY3JlYXRlUm9vdCgpO1xuICAgICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcblxuICAgICAgaWYgKHRoaXMuX21hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5Ccm93c2VyLmFueTNkKSB7XG4gICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoUm9vdCwgJ2xlYWZsZXQtem9vbS1hbmltYXRlZCcpO1xuXG4gICAgICAgIHRoaXMuX21hcC5vbih7XG4gICAgICAgICAgJ3pvb21hbmltJzogdGhpcy5fYW5pbWF0ZVBhdGhab29tLFxuICAgICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20taGlkZScpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9tYXAub24oJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgICB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCgpO1xuXG4gICAgICB0aGlzLl91cGRhdGVPcGFjaXR5KCk7XG4gICAgICB0aGlzLl91cGRhdGVaSW5kZXgoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0cyBjb25hdGluZXIgb3BhY2l0eVxuICAgKi9cbiAgX3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uKCkge1xuICAgIEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2NvbnRhaW5lciwgdGhpcy5vcHRpb25zLm9wYWNpdHkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNldHMgY29udGFpbmVyIHpJbmRleFxuICAgKi9cbiAgX3VwZGF0ZVpJbmRleDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jb250YWluZXIgJiYgdGhpcy5vcHRpb25zLnpJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuc3R5bGUuekluZGV4ID0gdGhpcy5vcHRpb25zLnpJbmRleDtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogVG8gb3ZlcnJpZGUgaW4gdGhlIGNoaWxkIGNsYXNzZXNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBfZ2V0Vmlld3BvcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoVmlld3BvcnQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogVXBkYXRlIHJvb3QgcG9zaXRpb24gdG8gZ2V0IHRoZSB2aWV3cG9ydCBjb3ZlcmVkXG4gICAqL1xuICBfdXBkYXRlQ29udGVudFZpZXdwb3J0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHAgPSB0aGlzLm9wdGlvbnMucGFkZGluZztcbiAgICB2YXIgc2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG4gICAgdmFyIHBhbmVQb3MgPSBMLkRvbVV0aWwuZ2V0UG9zaXRpb24odGhpcy5fbWFwLl9tYXBQYW5lKTtcbiAgICB2YXIgbWluID0gcGFuZVBvcy5tdWx0aXBseUJ5KC0xKS5fc3VidHJhY3Qoc2l6ZS5tdWx0aXBseUJ5KHApLl9yb3VuZCgpKTtcbiAgICB2YXIgbWF4ID0gbWluLmFkZChzaXplLm11bHRpcGx5QnkoMSArIHAgKiAyKS5fcm91bmQoKSk7XG5cbiAgICB0aGlzLl9wYXRoVmlld3BvcnQgPSBuZXcgTC5Cb3VuZHMoW21pbi54LCBtaW4ueV0sIFttYXgueCwgbWF4LnldKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtab29tRXZlbnR9IGVcbiAgICovXG4gIF9hbmltYXRlUGF0aFpvb206IGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIHNjYWxlID0gdGhpcy5fbWFwLmdldFpvb21TY2FsZShlLnpvb20pO1xuICAgIHZhciBvZmZzZXQgPSB0aGlzLl9tYXBcbiAgICAgIC5fZ2V0Q2VudGVyT2Zmc2V0KGUuY2VudGVyKVxuICAgICAgLl9tdWx0aXBseUJ5KC1zY2FsZSlcbiAgICAgIC5fYWRkKHRoaXMuX2dldFZpZXdwb3J0KCkubWluKTtcblxuICAgIHRoaXMuX3BhdGhSb290LnN0eWxlW0wuRG9tVXRpbC5UUkFOU0ZPUk1dID1cbiAgICAgIEwuRG9tVXRpbC5nZXRUcmFuc2xhdGVTdHJpbmcob2Zmc2V0KSArICcgc2NhbGUoJyArIHNjYWxlICsgJykgJztcblxuICAgIHRoaXMuX3BhdGhab29taW5nID0gdHJ1ZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBIZXJlIHdlIGNhbiBkbyBhZGRpdGlvbmFsIHBvc3QtYW5pbWF0aW9uIHRyYW5zZm9ybXNcbiAgICovXG4gIF9lbmRQYXRoWm9vbTogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuX3BhdGhab29taW5nID0gZmFsc2U7XG4gIH0sXG5cblxuICAvKipcbiAgICogQXBwbHkgdGhlIHZpZXdwb3J0IGNvcnJlY3Rpb25cbiAgICovXG4gIF91cGRhdGVTdmdWaWV3cG9ydDogZnVuY3Rpb24gKCkge1xuXG4gICAgaWYgKHRoaXMuX3BhdGhab29taW5nKSB7XG4gICAgICAvLyBEbyBub3QgdXBkYXRlIFNWR3Mgd2hpbGUgYSB6b29tIGFuaW1hdGlvbiBpcyBnb2luZyBvblxuICAgICAgLy8gb3RoZXJ3aXNlIHRoZSBhbmltYXRpb24gd2lsbCBicmVhay5cbiAgICAgIC8vIFdoZW4gdGhlIHpvb20gYW5pbWF0aW9uIGVuZHMgd2Ugd2lsbCBiZSB1cGRhdGVkIGFnYWluIGFueXdheVxuICAgICAgLy8gVGhpcyBmaXhlcyB0aGUgY2FzZSB3aGVyZSB5b3UgZG8gYSBtb21lbnR1bSBtb3ZlIGFuZFxuICAgICAgLy8gem9vbSB3aGlsZSB0aGUgbW92ZSBpcyBzdGlsbCBvbmdvaW5nLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX3VwZGF0ZUNvbnRlbnRWaWV3cG9ydCgpO1xuXG4gICAgdmFyIHZwICAgICA9IHRoaXMuX2dldFZpZXdwb3J0KCk7XG4gICAgdmFyIG1pbiAgICA9IHZwLm1pbjtcbiAgICB2YXIgbWF4ICAgID0gdnAubWF4O1xuICAgIHZhciB3aWR0aCAgPSBtYXgueCAtIG1pbi54O1xuICAgIHZhciBoZWlnaHQgPSBtYXgueSAtIG1pbi55O1xuICAgIHZhciByb290ICAgPSB0aGlzLl9wYXRoUm9vdDtcbiAgICB2YXIgcGFuZSAgID0gdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmU7XG5cbiAgICAvLyBIYWNrIHRvIG1ha2UgZmxpY2tlciBvbiBkcmFnIGVuZCBvbiBtb2JpbGUgd2Via2l0IGxlc3MgaXJyaXRhdGluZ1xuICAgIGlmIChMLkJyb3dzZXIubW9iaWxlV2Via2l0KSB7XG4gICAgICB0aGlzLl9jb250YWluZXIucmVtb3ZlQ2hpbGQocm9vdCk7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX3BhdGhSb290LCBtaW4pO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCd3aWR0aCcsIHdpZHRoKTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgaGVpZ2h0KTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgndmlld0JveCcsIFttaW4ueCwgbWluLnksIHdpZHRoLCBoZWlnaHRdLmpvaW4oJyAnKSk7XG5cbiAgICBpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHJvb3QpO1xuICAgIH1cbiAgfVxuXG59KTtcbiIsInZhciBMICAgICAgICA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBTdmdMYXllciA9IHJlcXVpcmUoJy4vc3ZnbGF5ZXInKTtcbnZhciBiNjQgICAgICA9IHJlcXVpcmUoJ0Jhc2U2NCcpO1xuXG5yZXF1aXJlKCcuL2JvdW5kcycpO1xucmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgU1ZHT3ZlcmxheSA9IFN2Z0xheWVyLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIHBhZGRpbmc6IDAuMjUsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWUsXG4gICAgYWRqdXN0VG9TY3JlZW46IHRydWVcbiAgICAvLyBsb2FkOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7fVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7U3ZnTGF5ZXJ9XG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyAgICA9IHN2ZztcblxuICAgIGlmICghKGJvdW5kcyBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSkge1xuICAgICAgb3B0aW9ucyA9IGJvdW5kcztcbiAgICAgIGJvdW5kcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXMgPSBudWxsO1xuXG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHJldHVybiBuZXcgTC5Qb2ludChcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcbiAgICAgIE1hdGguYWJzKGJib3hbMV0gLSBiYm94WzNdKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU1ZHIGlzIHJlYWR5XG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxuICAgKi9cbiAgb25Mb2FkOiBmdW5jdGlvbihzdmcpIHtcbiAgICB0aGlzLl9yYXdEYXRhID0gc3ZnO1xuICAgIHN2ZyA9IEwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIoc3ZnKTtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChzdmcpO1xuICAgIHZhciBtaW5ab29tID0gdGhpcy5fbWFwLmdldE1pblpvb20oKTtcblxuICAgIGlmIChzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3Jhd0RhdGEgPSB0aGlzLl9yYXdEYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIGJib3guam9pbignICcpICsgJ1wiJyk7XG4gICAgfVxuXG4gICAgLy8gY2FsY3VsYXRlIHRoZSBlZGdlcyBvZiB0aGUgaW1hZ2UsIGluIGNvb3JkaW5hdGUgc3BhY2VcbiAgICB0aGlzLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzJdLCBiYm94WzFdXSwgbWluWm9vbSlcbiAgICApO1xuXG4gICAgdmFyIHNpemUgPSB0aGlzLmdldE9yaWdpbmFsU2l6ZSgpO1xuICAgIHZhciBtYXBTaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcblxuICAgIGlmIChzaXplLnkgIT09IG1hcFNpemUueSAmJiB0aGlzLm9wdGlvbnMuYWRqdXN0VG9TY3JlZW4pIHtcbiAgICAgIHZhciByYXRpbyA9IE1hdGgubWluKG1hcFNpemUueCAvIHNpemUueCwgbWFwU2l6ZS55IC8gc2l6ZS55KTtcbiAgICAgIHRoaXMuX2JvdW5kcyA9IHRoaXMuX2JvdW5kcy5zY2FsZShyYXRpbyk7XG4gICAgICB0aGlzLl9yYXRpbyA9IHJhdGlvO1xuICAgIH1cblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCh0aGlzLl9iYm94WzBdLCB0aGlzLl9iYm94WzFdKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcblxuICAgIHRoaXMuX2dyb3VwID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnZycpO1xuICAgIGlmIChMLkJyb3dzZXIuaWUpIHsgLy8gaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFXG4gICAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICAgIGRvIHtcbiAgICAgICAgdGhpcy5fZ3JvdXAuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgfSB3aGlsZShjaGlsZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2dyb3VwLmlubmVySFRNTCA9IHN2Zy5pbm5lckhUTUw7XG4gICAgfVxuICAgIHRoaXMuX3BhdGhSb290LmFwcGVuZENoaWxkKHRoaXMuX2dyb3VwKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuICAgIHRoaXMuX29uTWFwWm9vbUVuZCgpO1xuICAgIHRoaXMuX3Jlc2V0KCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICBnZXRCb3VuZHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ib3VuZHM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TnVtYmVyfVxuICAgKi9cbiAgZ2V0UmF0aW86IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9yYXRpbztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbWFwIGNvb3JkIHRvIHNjaGVtYXRpYyBwb2ludFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gY29vcmRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIHByb2plY3RQb2ludDogZnVuY3Rpb24oY29vcmQpIHtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KHRoaXMuX21hcC5wcm9qZWN0KGNvb3JkLCB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICB1bnByb2plY3RQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFwLnVucHJvamVjdCh0aGlzLl9zY2FsZVBvaW50KHB0KSwgdGhpcy5fbWFwLmdldE1pblpvb20oKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5Cb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAgICovXG4gIHVucHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgdmFyIHN3ID0gdGhpcy5wb2ludFRvTWFwQ29vcmQoYm91bmRzLm1pbik7XG4gICAgdmFyIG5lID0gdGhpcy5wb2ludFRvTWFwQ29vcmQoYm91bmRzLm1heCk7XG4gICAgcmV0dXJuIEwubGF0TG5nQm91bmRzKHN3LCBuZSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIGxheWVyQm91bmRzIHRvIHNjaGVtYXRpYyBiYm94XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBwcm9qZWN0Qm91bmRzOiBmdW5jdGlvbihib3VuZHMpIHtcbiAgICByZXR1cm4gbmV3IEwuQm91bmRzKFxuICAgICAgdGhpcy5tYXBDb29yZFRvUG9pbnQoYm91bmRzLmdldFNvdXRoV2VzdCgpKSxcbiAgICAgIHRoaXMubWFwQ29vcmRUb1BvaW50KGJvdW5kcy5nZXROb3J0aEVhc3QoKSlcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExvYWRzIHN2ZyB2aWEgWEhSXG4gICAqL1xuICBsb2FkOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wdGlvbnMubG9hZCh0aGlzLl91cmwsIGZ1bmN0aW9uKGVyciwgc3ZnKSB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLm9uTG9hZChzdmcpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG5cbiAgICBtYXBcbiAgICAgIC5vbignem9vbWVuZCcsIHRoaXMuX29uTWFwWm9vbUVuZCwgdGhpcylcbiAgICAgIC5vbignZHJhZ3N0YXJ0JywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgLm9uKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKVxuICAgICAgLm9uKCd2aWVyZXNldCBtb3ZlZW5kJywgdGhpcy5fcmVzZXQsIHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9zdmcpIHtcbiAgICAgIHRoaXMubG9hZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uTG9hZCh0aGlzLl9zdmcpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgU3ZnTGF5ZXIucHJvdG90eXBlLm9uUmVtb3ZlLmNhbGwodGhpcywgbWFwKTtcbiAgICBtYXBcbiAgICAgIC5vZmYoJ3pvb21lbmQnLCB0aGlzLl9vbk1hcFpvb21FbmQsIHRoaXMpXG4gICAgICAub2ZmKCdkcmFnc3RhcnQnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKVxuICAgICAgLm9mZigndmllcmVzZXQgbW92ZWVuZCcsIHRoaXMuX3Jlc2V0LCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7Kj19ICAgICAgIGNvbnRleHRcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIHdoZW5SZWFkeTogZnVuY3Rpb24oY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5fYm91bmRzKSB7XG4gICAgICBjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJhc3Rlcml6ZXMgdGhlIHNjaGVtYXRpY1xuICAgKiBAcmV0dXJuIHtTY2hlbWF0aWN9XG4gICAqL1xuICB0b0ltYWdlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgLy8gdGhpcyBkb2Vzbid0IHdvcmsgaW4gSUUsIGZvcmNlIHNpemVcbiAgICAvLyBpbWcuc3R5bGUuaGVpZ2h0ID0gaW1nLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGltZy5zdHlsZS53aWR0aCA9IHRoaXMuX3NpemUueCArICdweCc7XG4gICAgaW1nLnN0eWxlLmhlaWdodCA9IHRoaXMuX3NpemUueSArICdweCc7XG4gICAgaW1nLnNyYyA9IHRoaXMudG9CYXNlNjQoKTtcblxuICAgIHZhciBjYW52YXMgPSB0aGlzLl9jYW52YXMgfHwgTC5Eb21VdGlsLmNyZWF0ZSgnY2FudmFzJywgJ3NjaGVtYXRpYy1jYW52YXMnKTtcbiAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICBMLkRvbUV2ZW50Lm9uKGltZywgJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbmF0dXJhbFNpemUgPSBMLnBvaW50KGltZy5vZmZzZXRXaWR0aCwgaW1nLm9mZnNldEhlaWdodCk7XG4gICAgICAvL2NvbnNvbGUubG9nKCduYXR1cmFsJywgbmF0dXJhbFNpemUpO1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9jYW52YXMgPSBjYW52YXM7XG4gICAgICB0aGlzLl9jb250YWluZXIuaW5zZXJ0QmVmb3JlKGNhbnZhcywgdGhpcy5fY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuICAgIH1cbiAgICBpbWcuc3R5bGUub3BhY2l0eSA9IDA7XG5cbiAgICBpZiAodGhpcy5fcmFzdGVyKSB7XG4gICAgICB0aGlzLl9yYXN0ZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9yYXN0ZXIpO1xuICAgICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoaW1nLCAnc2NoZW1hdGljLWltYWdlJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKGltZyk7XG4gICAgdGhpcy5fcmFzdGVyID0gaW1nO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENvbnZlcnQgU1ZHIGRhdGEgdG8gYmFzZTY0IGZvciByYXN0ZXJpemF0aW9uXG4gICAqIEByZXR1cm4ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgU1ZHXG4gICAqL1xuICB0b0Jhc2U2NDogZnVuY3Rpb24oKSB7XG4gICAgLy9jb25zb2xlLnRpbWUoJ2Jhc2U2NCcpO1xuICAgIHZhciBiYXNlNjQgPSB0aGlzLl9iYXNlNjRlbmNvZGVkIHx8XG4gICAgICBiNjQuYnRvYSh1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmF3RGF0YSkpKTtcbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gYmFzZTY0O1xuICAgIC8vY29uc29sZS50aW1lRW5kKCdiYXNlNjQnKTtcblxuICAgIHJldHVybiAnZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCwnICsgYmFzZTY0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFdlIG5lZWQgdG8gcmVkcmF3IG9uIHpvb20gZW5kXG4gICAqL1xuICBfZW5kUGF0aFpvb206IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgU3ZnTGF5ZXIucHJvdG90eXBlLl9lbmRQYXRoWm9vbS5jYWxsKHRoaXMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfdW5zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcbiAgICAvLyBzYW1lIGFzIGFib3ZlLCBidXQgbm90IHVzaW5nIHRyYW5zZm9ybSBtYXRyaXhcbiAgICAvL3JldHVybiBwdC5zdWJ0cmFjdCh0aGlzLl9vcmlnaW4pXG4gICAgLy8gIC5tdWx0aXBseUJ5KDEvIHRoaXMuX3JhdGlvKS5hZGQodGhpcy5fb3JpZ2luKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IFRPIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICAgIC8vIGVxdWFscyB0b1xuICAgIC8vIHJldHVybiBwdC5zdWJ0cmFjdCh0aGlzLl9vcmlnaW4pXG4gICAgLy8gICAubXVsdGlwbHlCeSh0aGlzLl9yYXRpbykuYWRkKHRoaXMuX29yaWdpbik7XG4gIH0sXG5cblxuICAvKipcbiAgICogVG9nZ2xlIGNhbnZhcyBpbnN0ZWFkIG9mIFNWRyB3aGVuIGRyYWdnaW5nXG4gICAqL1xuICBfc2hvd1Jhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX2NhbnZhcy5zdHlsZS5kaXNwbGF5ICAgPSAnYmxvY2snO1xuICAgICAgdGhpcy5fcGF0aFJvb3Quc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU3dhcCBiYWNrIHRvIFNWR1xuICAgKi9cbiAgX2hpZGVSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9jYW52YXMuc3R5bGUuZGlzcGxheSAgID0gJ25vbmUnO1xuICAgICAgdGhpcy5fcGF0aFJvb3Quc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIElFLW9ubHlcbiAgICogUmVwbGFjZSBTVkcgd2l0aCBjYW52YXMgYmVmb3JlIGRyYWdcbiAgICovXG4gIF9vblByZURyYWc6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9zaG93UmFzdGVyKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIERyYWcgZW5kOiBwdXQgU1ZHIGJhY2sgaW4gSUVcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9oaWRlUmFzdGVyKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlLXJlbmRlciBjYW52YXMgb24gem9vbWVuZFxuICAgKi9cbiAgX29uTWFwWm9vbUVuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgICB0aGlzLnRvSW1hZ2UoKTtcbiAgICAgICB0aGlzLl9oaWRlUmFzdGVyKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBzaGlmZWQgY2FudmFzXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gc2l6ZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2l6ZSkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHZhciB2cCA9IHRoaXMuX2dldFZpZXdwb3J0KCk7XG4gICAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzO1xuICAgICAgdmFyIG1pbiA9IHZwLm1pbjtcbiAgICAgIHZhciBtYXggPSB2cC5tYXg7XG4gICAgICB2YXIgd2lkdGggPSBtYXgueCAtIG1pbi54O1xuICAgICAgdmFyIGhlaWdodCA9IG1heC55IC0gbWluLnk7XG5cbiAgICAgIHZhciBwb3MgPSB0b3BMZWZ0LnN1YnRyYWN0KG1pbik7XG5cbiAgICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgY2FudmFzLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHdpZHRoLCBoZWlnaHQsIHNpemUueCwgc2l6ZS55KTtcblxuICAgICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuXG4gICAgICAgIC8vIGN0eC5yZWN0KHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuICAgICAgICAvLyBjdHguc3Ryb2tlU3R5bGUgPSAncmVkJztcbiAgICAgICAgLy8gY3R4LmxpbmVXaWR0aCA9IDAuMTtcbiAgICAgICAgLy8gY3R4LnN0cm9rZSgpO1xuICAgICAgfSwgdGhpcyk7XG5cbiAgICAgIC8vdGhpcy5fcGF0aFJvb3Quc3R5bGUub3BhY2l0eSA9IDAuNTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IC0gY29tcGVuc2F0ZSB0aGUgcG9zaXRpb24gYW5kIHNjYWxlXG4gICAqL1xuICBfcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW1hZ2UgICA9IHRoaXMuX2dyb3VwO1xuICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXG4gICAgdmFyIHNjYWxlICAgPSBNYXRoLnBvdygyLCB0aGlzLl9tYXAuZ2V0Wm9vbSgpKSAqIHRoaXMuX3JhdGlvO1xuICAgIHZhciB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgIHZhciBzaXplICAgID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKS5tdWx0aXBseUJ5KHNjYWxlKTtcbiAgICB2YXIgdnBNaW4gICA9IHRoaXMuX2dldFZpZXdwb3J0KCkubWluO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnN0eWxlLndpZHRoID0gc2l6ZS54ICsgJ3B4JztcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS5oZWlnaHQgPSBzaXplLnkgKyAncHgnO1xuICAgICAgTC5Eb21VdGlsLnNldFBvc2l0aW9uKHRoaXMuX3Jhc3RlciwgdnBNaW4pO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX3JlZHJhd0NhbnZhcyh0b3BMZWZ0LCBzaXplKTtcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9jYW52YXMsIHZwTWluKTtcbiAgICB9XG5cbiAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgdGhpcy5fZ3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyhcbiAgICAgICAgdG9wTGVmdC5zdWJ0cmFjdCh0aGlzLl92aWV3Qm94T2Zmc2V0Lm11bHRpcGx5Qnkoc2NhbGUpKSwgc2NhbGUpKTtcbiAgfVxuXG59KTtcblxuLy8gZXhwb3J0XG5MLlNWR092ZXJsYXkgPSBTVkdPdmVybGF5O1xuTC5zdmdPdmVybGF5ID0gZnVuY3Rpb24oc3ZnLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgU1ZHT3ZlcmxheShzdmcsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTVkdPdmVybGF5O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8vIDx1c2U+IHRhZ3MgYXJlIGJyb2tlbiBpbiBJRSBpbiBzbyBtYW55IHdheXNcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiBnbG9iYWwpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnRJbnN0YW5jZS5wcm90b3R5cGUsICdjbGFzc05hbWUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWwgPSB2YWw7XG4gICAgfVxuICB9KTtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAgeyp9ICBvXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5MLkRvbVV0aWwuaXNOb2RlID0gZnVuY3Rpb24obyl7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIE5vZGUgPT09ICdvYmplY3QnID9cbiAgICBvIGluc3RhbmNlb2YgTm9kZSA6XG4gICAgbyAmJiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQkJveCA9IGZ1bmN0aW9uKHN2Zykge1xuICB2YXIgdmlld0JveCA9IHN2Zy5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKTtcbiAgdmFyIGJib3g7XG4gIGlmICh2aWV3Qm94KSB7XG4gICAgYmJveCA9IHZpZXdCb3guc3BsaXQoJyAnKS5tYXAocGFyc2VGbG9hdCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNsb25lID0gc3ZnLmNsb25lTm9kZSh0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAvLyBiYm94ID0gY2xvbmUuZ2V0QkJveCgpO1xuICAgIGJib3ggPSBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhjbG9uZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgcmV0dXJuIGJib3g7XG4gIH1cbiAgcmV0dXJuIFtiYm94WzBdLCBiYm94WzFdLCBiYm94WzBdICsgYmJveFsyXSwgYmJveFsxXSArIGJib3hbM11dO1xufTtcblxuXG4vKipcbiAqIFNpbXBseSBicnV0ZSBmb3JjZTogdGFrZXMgYWxsIHN2ZyBub2RlcywgY2FsY3VsYXRlcyBib3VuZGluZyBib3hcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbmZ1bmN0aW9uIGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKHN2Zykge1xuICB2YXIgYmJveCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcbiAgdmFyIG5vZGVzID0gW10uc2xpY2UuY2FsbChzdmcucXVlcnlTZWxlY3RvckFsbCgnKicpKTtcbiAgdmFyIG1pbiA9IE1hdGgubWluLCBtYXggPSBNYXRoLm1heDtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gbm9kZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xuICAgIGlmIChub2RlLmdldEJCb3gpIHtcbiAgICAgIG5vZGUgPSBub2RlLmdldEJCb3goKTtcblxuICAgICAgYmJveFswXSA9IG1pbihub2RlLngsIGJib3hbMF0pO1xuICAgICAgYmJveFsxXSA9IG1pbihub2RlLnksIGJib3hbMV0pO1xuXG4gICAgICBiYm94WzJdID0gbWF4KG5vZGUueCArIG5vZGUud2lkdGgsIGJib3hbMl0pO1xuICAgICAgYmJveFszXSA9IG1heChub2RlLnkgKyBub2RlLmhlaWdodCwgYmJveFszXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBiYm94O1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIgPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5pbm5lckhUTUwgPSBzdHI7XG4gIHJldHVybiB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUG9pbnR9IHRyYW5zbGF0ZVxuICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZSwgc2NhbGUpIHtcbiAgcmV0dXJuICdtYXRyaXgoJyArXG4gICAgW3NjYWxlLCAwLCAwLCBzY2FsZSwgdHJhbnNsYXRlLngsIHRyYW5zbGF0ZS55XS5qb2luKCcsJykgKyAnKSc7XG59O1xuIl19
