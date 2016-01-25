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
      this._rawData = this._rawData.replace('<svg', '<svg viewBox="' + bbox.join(' ') + '" preserveAspectRatio="xMaxYMax" ');
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
    bbox = clone.getBBox();
    document.body.removeChild(clone);
    bbox = [bbox.x, bbox.y, parseInt(svg.getAttribute('width')) || svg.offsetWidth || bbox.width, parseInt(svg.getAttribute('height')) || svg.offsetHeight || bbox.height];
  }
  return [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
};

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxrQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtCO0FBRXpDLE1BQUksTUFBTSxLQUFLLEdBQUwsQ0FGK0I7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LFFBQVEsYUFBUixDQUFzQixLQUF0QixDQUFQLENBSHdDO0NBQWQ7Ozs7Ozs7QUFZNUIsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMkI7QUFDckQsU0FBTyxZQUNMLENBQUMsS0FBRCxFQUFRLENBQVIsRUFBVyxDQUFYLEVBQWMsS0FBZCxFQUFxQixVQUFVLENBQVYsRUFBYSxVQUFVLENBQVYsQ0FBbEMsQ0FBK0MsSUFBL0MsQ0FBb0QsR0FBcEQsQ0FESyxHQUNzRCxHQUR0RCxDQUQ4QztDQUEzQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3N2Z292ZXJsYXknKTtcbiIsIjsoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgZXhwb3J0cyAhPSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiB0aGlzOyAvLyAjODogd2ViIHdvcmtlcnNcbiAgdmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuICBmdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIH1cbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbiAgLy8gZW5jb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk5MTY2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL25pZ25hZ11cbiAgb2JqZWN0LmJ0b2EgfHwgKFxuICBvYmplY3QuYnRvYSA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnMsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICAgKSB7XG4gICAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzLzQpO1xuICAgICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2J0b2EnIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBlbmNvZGVkIGNvbnRhaW5zIGNoYXJhY3RlcnMgb3V0c2lkZSBvZiB0aGUgTGF0aW4xIHJhbmdlLlwiKTtcbiAgICAgIH1cbiAgICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgb2JqZWN0LmF0b2IgfHwgKFxuICBvYmplY3QuYXRvYiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpLnJlcGxhY2UoLz0rJC8sICcnKTtcbiAgICBpZiAoc3RyLmxlbmd0aCAlIDQgPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdChpZHgrKyk7XG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSAmIGJzID4+ICgtMiAqIGJjICYgNikpIDogMFxuICAgICkge1xuICAgICAgLy8gdHJ5IHRvIGZpbmQgY2hhcmFjdGVyIGluIHRhYmxlICgwLTYzLCBub3QgZm91bmQgPT4gLTEpXG4gICAgICBidWZmZXIgPSBjaGFycy5pbmRleE9mKGJ1ZmZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG59KCkpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG1heCA9IHRoaXMubWF4O1xuICB2YXIgbWluID0gdGhpcy5taW47XG4gIHZhciBkZWx0YVggPSAoKG1heC54IC0gbWluLngpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobWF4LnkgLSBtaW4ueSkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5Cb3VuZHMoW1xuICAgIFttaW4ueCAtIGRlbHRhWCwgbWluLnkgLSBkZWx0YVldLFxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXG4gIF0pO1xufTtcblxuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcbiAgdmFyIHN3ID0gdGhpcy5fc291dGhXZXN0O1xuICB2YXIgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcbiAgICBbbmUubGF0ICsgZGVsdGFZLCBuZS5sbmcgKyBkZWx0YVhdXG4gIF0pO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuQ2xhc3MuZXh0ZW5kKHtcblxuICBpbmNsdWRlczogTC5NaXhpbi5FdmVudHMsXG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDEsXG4gICAgcGFkZGluZzogTC5QYXRoLkNMSVBfUEFERElOR1xuICB9LFxuXG4gIC8qKlxuICAgKiBAY2xhc3MgU3ZnTGF5ZXIgLSBiYXNpY2FsbHksIGp1c3QgdGhlIFNWRyBjb250YWluZXIgc2ltaWFyIHRvIHRoZSBvbmVcbiAgICogdXNlZCBieSBsZWFmbGV0IGludGVybmFsbHkgdG8gcmVuZGVyIHZlY3RvciBsYXllcnNcbiAgICpcbiAgICogQGV4dGVuZHMge0wuQ2xhc3N9XG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fY29udGFpbmVyID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFJvb3QgID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTWFwfVxuICAgICAqL1xuICAgIHRoaXMuX21hcCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkJvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoVmlld3BvcnQgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoWm9vbWluZyA9IGZhbHNlO1xuXG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLl9tYXAgPSBtYXA7XG4gICAgdGhpcy5faW5pdFBhdGhSb290KCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYWRkVG86IGZ1bmN0aW9uKG1hcCkge1xuICAgIG1hcC5hZGRMYXllcih0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIGlmICh0aGlzLl9tYXAub3B0aW9ucy56b29tQW5pbWF0aW9uICYmIEwuQnJvd3Nlci5hbnkzZCkge1xuICAgICAgdGhpcy5fbWFwLm9mZih7XG4gICAgICAgICd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVQYXRoWm9vbSxcbiAgICAgICAgJ3pvb21lbmQnOiB0aGlzLl9lbmRQYXRoWm9vbVxuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbWFwLm9mZignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZVN2Z1ZpZXdwb3J0LCB0aGlzKTtcbiAgICB0aGlzLl9tYXAuZ2V0UGFuZXMoKS5vdmVybGF5UGFuZS5yZW1vdmVDaGlsZCh0aGlzLl9jb250YWluZXIpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICByZW1vdmVGcm9tOiBmdW5jdGlvbihtYXApIHtcbiAgICBtYXAucmVtb3ZlTGF5ZXIodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcm9vdCA9IHRoaXMuX3BhdGhSb290LnBhcmVudE5vZGUsXG4gICAgICAgIHBhdGggPSB0aGlzLl9wYXRoUm9vdDtcblxuICAgIGlmIChwYXRoICYmIHJvb3QubGFzdENoaWxkICE9PSBwYXRoKSB7XG4gICAgICByb290LmFwcGVuZENoaWxkKHBhdGgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGJyaW5nVG9CYWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJvb3QgPSB0aGlzLl9wYXRoUm9vdC5wYXJlbnROb2RlO1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aFJvb3Q7XG4gICAgdmFyIGZpcnN0ID0gcm9vdC5maXJzdENoaWxkO1xuXG4gICAgaWYgKHBhdGggJiYgZmlyc3QgIT09IHBhdGgpIHtcbiAgICAgIHJvb3QuaW5zZXJ0QmVmb3JlKHBhdGgsIGZpcnN0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIHN2ZyByb290XG4gICAqL1xuICBfY3JlYXRlUm9vdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aFJvb3QgPSBMLlBhdGgucHJvdG90eXBlLl9jcmVhdGVFbGVtZW50KCdzdmcnKTtcbiAgICB0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnbGVhZmxldC1pbWFnZS1sYXllcicpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9wYXRoUm9vdCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogSW5pdCB0aGUgcm9vdCBlbGVtZW50XG4gICAqL1xuICBfaW5pdFBhdGhSb290OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLl9wYXRoUm9vdCkge1xuICAgICAgdGhpcy5fY3JlYXRlUm9vdCgpO1xuICAgICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcblxuICAgICAgaWYgKHRoaXMuX21hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5Ccm93c2VyLmFueTNkKSB7XG4gICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoUm9vdCwgJ2xlYWZsZXQtem9vbS1hbmltYXRlZCcpO1xuXG4gICAgICAgIHRoaXMuX21hcC5vbih7XG4gICAgICAgICAgJ3pvb21hbmltJzogdGhpcy5fYW5pbWF0ZVBhdGhab29tLFxuICAgICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20taGlkZScpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9tYXAub24oJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgICB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUbyBvdmVycmlkZSBpbiB0aGUgY2hpbGQgY2xhc3Nlc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIF9nZXRWaWV3cG9ydDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BhdGhWaWV3cG9ydDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBVcGRhdGUgcm9vdCBwb3NpdGlvbiB0byBnZXQgdGhlIHZpZXdwb3J0IGNvdmVyZWRcbiAgICovXG4gIF91cGRhdGVDb250ZW50Vmlld3BvcnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcCA9IHRoaXMub3B0aW9ucy5wYWRkaW5nO1xuICAgIHZhciBzaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcbiAgICB2YXIgcGFuZVBvcyA9IEwuRG9tVXRpbC5nZXRQb3NpdGlvbih0aGlzLl9tYXAuX21hcFBhbmUpO1xuICAgIHZhciBtaW4gPSBwYW5lUG9zLm11bHRpcGx5QnkoLTEpLl9zdWJ0cmFjdChzaXplLm11bHRpcGx5QnkocCkuX3JvdW5kKCkpO1xuICAgIHZhciBtYXggPSBtaW4uYWRkKHNpemUubXVsdGlwbHlCeSgxICsgcCAqIDIpLl9yb3VuZCgpKTtcblxuICAgIHRoaXMuX3BhdGhWaWV3cG9ydCA9IG5ldyBMLkJvdW5kcyhbbWluLngsIG1pbi55XSwgW21heC54LCBtYXgueV0pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge1pvb21FdmVudH0gZVxuICAgKi9cbiAgX2FuaW1hdGVQYXRoWm9vbTogZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgc2NhbGUgPSB0aGlzLl9tYXAuZ2V0Wm9vbVNjYWxlKGUuem9vbSk7XG4gICAgdmFyIG9mZnNldCA9IHRoaXMuX21hcFxuICAgICAgLl9nZXRDZW50ZXJPZmZzZXQoZS5jZW50ZXIpXG4gICAgICAuX211bHRpcGx5QnkoLXNjYWxlKVxuICAgICAgLl9hZGQodGhpcy5fZ2V0Vmlld3BvcnQoKS5taW4pO1xuXG4gICAgdGhpcy5fcGF0aFJvb3Quc3R5bGVbTC5Eb21VdGlsLlRSQU5TRk9STV0gPVxuICAgICAgTC5Eb21VdGlsLmdldFRyYW5zbGF0ZVN0cmluZyhvZmZzZXQpICsgJyBzY2FsZSgnICsgc2NhbGUgKyAnKSAnO1xuXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSB0cnVlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEhlcmUgd2UgY2FuIGRvIGFkZGl0aW9uYWwgcG9zdC1hbmltYXRpb24gdHJhbnNmb3Jtc1xuICAgKi9cbiAgX2VuZFBhdGhab29tOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBcHBseSB0aGUgdmlld3BvcnQgY29ycmVjdGlvblxuICAgKi9cbiAgX3VwZGF0ZVN2Z1ZpZXdwb3J0OiBmdW5jdGlvbiAoKSB7XG5cbiAgICBpZiAodGhpcy5fcGF0aFpvb21pbmcpIHtcbiAgICAgIC8vIERvIG5vdCB1cGRhdGUgU1ZHcyB3aGlsZSBhIHpvb20gYW5pbWF0aW9uIGlzIGdvaW5nIG9uXG4gICAgICAvLyBvdGhlcndpc2UgdGhlIGFuaW1hdGlvbiB3aWxsIGJyZWFrLlxuICAgICAgLy8gV2hlbiB0aGUgem9vbSBhbmltYXRpb24gZW5kcyB3ZSB3aWxsIGJlIHVwZGF0ZWQgYWdhaW4gYW55d2F5XG4gICAgICAvLyBUaGlzIGZpeGVzIHRoZSBjYXNlIHdoZXJlIHlvdSBkbyBhIG1vbWVudHVtIG1vdmUgYW5kXG4gICAgICAvLyB6b29tIHdoaWxlIHRoZSBtb3ZlIGlzIHN0aWxsIG9uZ29pbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fdXBkYXRlQ29udGVudFZpZXdwb3J0KCk7XG5cbiAgICB2YXIgdnAgICAgID0gdGhpcy5fZ2V0Vmlld3BvcnQoKTtcbiAgICB2YXIgbWluICAgID0gdnAubWluO1xuICAgIHZhciBtYXggICAgPSB2cC5tYXg7XG4gICAgdmFyIHdpZHRoICA9IG1heC54IC0gbWluLng7XG4gICAgdmFyIGhlaWdodCA9IG1heC55IC0gbWluLnk7XG4gICAgdmFyIHJvb3QgICA9IHRoaXMuX3BhdGhSb290O1xuICAgIHZhciBwYW5lICAgPSB0aGlzLl9tYXAuZ2V0UGFuZXMoKS5vdmVybGF5UGFuZTtcblxuICAgIC8vIEhhY2sgdG8gbWFrZSBmbGlja2VyIG9uIGRyYWcgZW5kIG9uIG1vYmlsZSB3ZWJraXQgbGVzcyBpcnJpdGF0aW5nXG4gICAgaWYgKEwuQnJvd3Nlci5tb2JpbGVXZWJraXQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5yZW1vdmVDaGlsZChyb290KTtcbiAgICB9XG5cbiAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fcGF0aFJvb3QsIG1pbik7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgd2lkdGgpO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBoZWlnaHQpO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgW21pbi54LCBtaW4ueSwgd2lkdGgsIGhlaWdodF0uam9pbignICcpKTtcblxuICAgIGlmIChMLkJyb3dzZXIubW9iaWxlV2Via2l0KSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQocm9vdCk7XG4gICAgfVxuICB9XG5cbn0pO1xuIiwidmFyIEwgICAgICAgID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIFN2Z0xheWVyID0gcmVxdWlyZSgnLi9zdmdsYXllcicpO1xudmFyIGI2NCAgICAgID0gcmVxdWlyZSgnQmFzZTY0Jyk7XG5cbnJlcXVpcmUoJy4vYm91bmRzJyk7XG5yZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciBTVkdPdmVybGF5ID0gU3ZnTGF5ZXIuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgcGFkZGluZzogMC4yNSxcbiAgICBvcGFjaXR5OiAxLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllLFxuICAgIGFkanVzdFRvU2NyZWVuOiB0cnVlXG4gICAgLy8gbG9hZDogZnVuY3Rpb24odXJsLCBjYWxsYmFjaykge31cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge1N2Z0xheWVyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9zdmcgICAgPSBzdmc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ0JvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX3JhdGlvID0gMTtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlRyYW5zZm9ybWF0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xuICAgICAgdGhpcy5fc3ZnID0gbnVsbDtcblxuICAgICAgLyoqXG4gICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XG5cbiAgICAgIGlmICghb3B0aW9ucy5sb2FkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9pbWFnZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzID0gbnVsbDtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBnZXRPcmlnaW5hbFNpemU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoXG4gICAgICBNYXRoLmFicyhiYm94WzBdIC0gYmJveFsyXSksXG4gICAgICBNYXRoLmFicyhiYm94WzFdIC0gYmJveFszXSlcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgdGhpcy5fcmF3RGF0YSA9IHN2ZztcbiAgICBzdmcgPSBMLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyKHN2Zyk7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94ID0gTC5Eb21VdGlsLmdldFNWR0JCb3goc3ZnKTtcbiAgICB2YXIgbWluWm9vbSA9IHRoaXMuX21hcC5nZXRNaW5ab29tKCk7XG5cbiAgICBpZiAoc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9yYXdEYXRhID0gdGhpcy5fcmF3RGF0YS5yZXBsYWNlKCc8c3ZnJyxcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIicgKyBiYm94LmpvaW4oJyAnKSArXG4gICAgICAgICdcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwieE1heFlNYXhcIiAnKTtcbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgdGhlIGVkZ2VzIG9mIHRoZSBpbWFnZSwgaW4gY29vcmRpbmF0ZSBzcGFjZVxuICAgIHRoaXMuX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcyhcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMF0sIGJib3hbM11dLCBtaW5ab29tKSxcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMl0sIGJib3hbMV1dLCBtaW5ab29tKVxuICAgICk7XG5cbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHNpemUueSAhPT0gbWFwU2l6ZS55ICYmIHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbikge1xuICAgICAgdmFyIHJhdGlvID0gTWF0aC5taW4obWFwU2l6ZS54IC8gc2l6ZS54LCBtYXBTaXplLnkgLyBzaXplLnkpO1xuICAgICAgdGhpcy5fYm91bmRzID0gdGhpcy5fYm91bmRzLnNjYWxlKHJhdGlvKTtcbiAgICAgIHRoaXMuX3JhdGlvID0gcmF0aW87XG4gICAgfVxuXG4gICAgdGhpcy5fc2l6ZSAgID0gc2l6ZTtcbiAgICB0aGlzLl9vcmlnaW4gPSB0aGlzLl9tYXAucHJvamVjdCh0aGlzLl9ib3VuZHMuZ2V0Q2VudGVyKCksIG1pblpvb20pO1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KHRoaXMuX2Jib3hbMF0sIHRoaXMuX2Jib3hbMV0pO1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbmV3IEwuVHJhbnNmb3JtYXRpb24oXG4gICAgICAxLCB0aGlzLl9vcmlnaW4ueCwgMSwgdGhpcy5fb3JpZ2luLnkpO1xuXG4gICAgdGhpcy5fZ3JvdXAgPSBMLlBhdGgucHJvdG90eXBlLl9jcmVhdGVFbGVtZW50KCdnJyk7XG4gICAgaWYgKEwuQnJvd3Nlci5pZSkgeyAvLyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUVcbiAgICAgIHZhciBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgZG8ge1xuICAgICAgICB0aGlzLl9ncm91cC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgICB9IHdoaWxlKGNoaWxkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZ3JvdXAuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgICB9XG4gICAgdGhpcy5fcGF0aFJvb3QuYXBwZW5kQ2hpbGQodGhpcy5fZ3JvdXApO1xuXG4gICAgdGhpcy5maXJlKCdsb2FkJyk7XG4gICAgdGhpcy5fb25NYXBab29tRW5kKCk7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICAgKi9cbiAgZ2V0RG9jdW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAgICovXG4gIGdldEJvdW5kczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2JvdW5kcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG4gICAqL1xuICBnZXRSYXRpbzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JhdGlvO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBtYXAgY29vcmQgdG8gc2NoZW1hdGljIHBvaW50XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBjb29yZFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgcHJvamVjdFBvaW50OiBmdW5jdGlvbihjb29yZCkge1xuICAgIHJldHVybiB0aGlzLl91bnNjYWxlUG9pbnQodGhpcy5fbWFwLnByb2plY3QoY29vcmQsIHRoaXMuX21hcC5nZXRNaW5ab29tKCkpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIHVucHJvamVjdFBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl9tYXAudW5wcm9qZWN0KHRoaXMuX3NjYWxlUG9pbnQocHQpLCB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3BhY2l0eVxuICAgKiBAcmV0dXJuIHtTVkdMYXllcn1cbiAgICovXG4gIHNldE9wYWNpdHk6IGZ1bmN0aW9uIChvcGFjaXR5KSB7XG4gICAgdGhpcy5vcHRpb25zLm9wYWNpdHkgPSBvcGFjaXR5O1xuICAgIHRoaXMuX3VwZGF0ZU9wYWNpdHkoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLkJvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICAgKi9cbiAgdW5wcm9qZWN0Qm91bmRzOiBmdW5jdGlvbihib3VuZHMpIHtcbiAgICB2YXIgc3cgPSB0aGlzLnBvaW50VG9NYXBDb29yZChib3VuZHMubWluKTtcbiAgICB2YXIgbmUgPSB0aGlzLnBvaW50VG9NYXBDb29yZChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLm1hcENvb3JkVG9Qb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5tYXBDb29yZFRvUG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgU3ZnTGF5ZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIG1hcFxuICAgICAgLm9uKCd6b29tZW5kJywgdGhpcy5fb25NYXBab29tRW5kLCB0aGlzKVxuICAgICAgLm9uKCdkcmFnc3RhcnQnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpXG4gICAgICAub24oJ3ZpZXJlc2V0IG1vdmVlbmQnLCB0aGlzLl9yZXNldCwgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBTdmdMYXllci5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICAgIG1hcFxuICAgICAgLm9mZignem9vbWVuZCcsIHRoaXMuX29uTWFwWm9vbUVuZCwgdGhpcylcbiAgICAgIC5vZmYoJ2RyYWdzdGFydCcsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpXG4gICAgICAub2ZmKCd2aWVyZXNldCBtb3ZlZW5kJywgdGhpcy5fcmVzZXQsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgd2hlblJlYWR5OiBmdW5jdGlvbihjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICh0aGlzLl9ib3VuZHMpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25jZSgnbG9hZCcsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIHRvSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAvLyB0aGlzIGRvZXNuJ3Qgd29yayBpbiBJRSwgZm9yY2Ugc2l6ZVxuICAgIC8vIGltZy5zdHlsZS5oZWlnaHQgPSBpbWcuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgaW1nLnN0eWxlLndpZHRoID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgdmFyIGNhbnZhcyA9IHRoaXMuX2NhbnZhcyB8fCBMLkRvbVV0aWwuY3JlYXRlKCdjYW52YXMnLCAnc2NoZW1hdGljLWNhbnZhcycpO1xuICAgIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgIEwuRG9tRXZlbnQub24oaW1nLCAnbG9hZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBuYXR1cmFsU2l6ZSA9IEwucG9pbnQoaW1nLm9mZnNldFdpZHRoLCBpbWcub2Zmc2V0SGVpZ2h0KTtcbiAgICAgIC8vY29uc29sZS5sb2coJ25hdHVyYWwnLCBuYXR1cmFsU2l6ZSk7XG4gICAgICB0aGlzLl9yZXNldCgpO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgaWYgKCF0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX2NhbnZhcyA9IGNhbnZhcztcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoY2FudmFzLCB0aGlzLl9jb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIGltZy5zdHlsZS5vcGFjaXR5ID0gMDtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3Jhc3Rlcik7XG4gICAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhpbWcsICdzY2hlbWF0aWMtaW1hZ2UnKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQoaW1nKTtcbiAgICB0aGlzLl9yYXN0ZXIgPSBpbWc7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ29udmVydCBTVkcgZGF0YSB0byBiYXNlNjQgZm9yIHJhc3Rlcml6YXRpb25cbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcbiAgICovXG4gIHRvQmFzZTY0OiBmdW5jdGlvbigpIHtcbiAgICAvL2NvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcbiAgICAgIGI2NC5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9yYXdEYXRhKSkpO1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSBiYXNlNjQ7XG4gICAgLy9jb25zb2xlLnRpbWVFbmQoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuICdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LCcgKyBiYXNlNjQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogV2UgbmVlZCB0byByZWRyYXcgb24gem9vbSBlbmRcbiAgICovXG4gIF9lbmRQYXRoWm9vbTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICBTdmdMYXllci5wcm90b3R5cGUuX2VuZFBhdGhab29tLmNhbGwodGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBGUk9NIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF91bnNjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5kaXZpZGVCeSh0aGlzLl9yYXRpbykpO1xuICAgIC8vIHNhbWUgYXMgYWJvdmUsIGJ1dCBub3QgdXNpbmcgdHJhbnNmb3JtIG1hdHJpeFxuICAgIC8vcmV0dXJuIHB0LnN1YnRyYWN0KHRoaXMuX29yaWdpbilcbiAgICAvLyAgLm11bHRpcGx5QnkoMS8gdGhpcy5fcmF0aW8pLmFkZCh0aGlzLl9vcmlnaW4pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgVE8gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3NjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5tdWx0aXBseUJ5KHRoaXMuX3JhdGlvKVxuICAgICk7XG4gICAgLy8gZXF1YWxzIHRvXG4gICAgLy8gcmV0dXJuIHB0LnN1YnRyYWN0KHRoaXMuX29yaWdpbilcbiAgICAvLyAgIC5tdWx0aXBseUJ5KHRoaXMuX3JhdGlvKS5hZGQodGhpcy5fb3JpZ2luKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUb2dnbGUgY2FudmFzIGluc3RlYWQgb2YgU1ZHIHdoZW4gZHJhZ2dpbmdcbiAgICovXG4gIF9zaG93UmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzLnN0eWxlLmRpc3BsYXkgICA9ICdibG9jayc7XG4gICAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHRoaXMuX2NhbnZhcy5zdHlsZS5kaXNwbGF5ICAgPSAnbm9uZSc7XG4gICAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogSUUtb25seVxuICAgKiBSZXBsYWNlIFNWRyB3aXRoIGNhbnZhcyBiZWZvcmUgZHJhZ1xuICAgKi9cbiAgX29uUHJlRHJhZzogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmUtcmVuZGVyIGNhbnZhcyBvbiB6b29tZW5kXG4gICAqL1xuICBfb25NYXBab29tRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgIHRoaXMudG9JbWFnZSgpO1xuICAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0cyBjb25hdGluZXIgb3BhY2l0eVxuICAgKi9cbiAgX3VwZGF0ZU9wYWNpdHk6IGZ1bmN0aW9uKCkge1xuICAgIEwuRG9tVXRpbC5zZXRPcGFjaXR5KHRoaXMuX2NvbnRhaW5lciwgdGhpcy5vcHRpb25zLm9wYWNpdHkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBzaGlmZWQgY2FudmFzXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gc2l6ZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2l6ZSkge1xuICAgIGlmICh0aGlzLl9jYW52YXMpIHtcbiAgICAgIHZhciB2cCA9IHRoaXMuX2dldFZpZXdwb3J0KCk7XG4gICAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzO1xuICAgICAgdmFyIG1pbiA9IHZwLm1pbjtcbiAgICAgIHZhciBtYXggPSB2cC5tYXg7XG4gICAgICB2YXIgd2lkdGggPSBtYXgueCAtIG1pbi54O1xuICAgICAgdmFyIGhlaWdodCA9IG1heC55IC0gbWluLnk7XG5cbiAgICAgIHZhciBwb3MgPSB0b3BMZWZ0LnN1YnRyYWN0KG1pbik7XG5cbiAgICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgY2FudmFzLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHdpZHRoLCBoZWlnaHQsIHNpemUueCwgc2l6ZS55KTtcblxuICAgICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpXG4gICAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuXG4gICAgICAgIC8vIGN0eC5yZWN0KHBvcy54LCBwb3MueSwgc2l6ZS54LCBzaXplLnkpO1xuICAgICAgICAvLyBjdHguc3Ryb2tlU3R5bGUgPSAncmVkJztcbiAgICAgICAgLy8gY3R4LmxpbmVXaWR0aCA9IDAuMTtcbiAgICAgICAgLy8gY3R4LnN0cm9rZSgpO1xuICAgICAgfSwgdGhpcyk7XG5cbiAgICAgIC8vdGhpcy5fcGF0aFJvb3Quc3R5bGUub3BhY2l0eSA9IDAuNTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IC0gY29tcGVuc2F0ZSB0aGUgcG9zaXRpb24gYW5kIHNjYWxlXG4gICAqL1xuICBfcmVzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW1hZ2UgICA9IHRoaXMuX2dyb3VwO1xuICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXG4gICAgdmFyIHNjYWxlICAgPSBNYXRoLnBvdygyLCB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gMSkgKiB0aGlzLl9yYXRpbztcbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICB2YXIgc2l6ZSAgICA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG4gICAgdmFyIHZwTWluICAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbjtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS53aWR0aCA9IHNpemUueCArICdweCc7XG4gICAgICB0aGlzLl9yYXN0ZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZS55ICsgJ3B4JztcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9yYXN0ZXIsIHZwTWluKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2l6ZSk7XG4gICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB2cE1pbik7XG4gICAgfVxuXG4gICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgIHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSksIHNjYWxlKSk7XG4gIH1cblxufSk7XG5cbi8vIGV4cG9ydFxuTC5TVkdPdmVybGF5ID0gU1ZHT3ZlcmxheTtcbkwuc3ZnT3ZlcmxheSA9IGZ1bmN0aW9uKHN2Zywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IFNWR092ZXJsYXkoc3ZnLCBvcHRpb25zKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU1ZHT3ZlcmxheTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vLyA8dXNlPiB0YWdzIGFyZSBicm9rZW4gaW4gSUUgaW4gc28gbWFueSB3YXlzXG5pZiAoJ1NWR0VsZW1lbnRJbnN0YW5jZScgaW4gZ2xvYmFsKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50SW5zdGFuY2UucHJvdG90eXBlLCAnY2xhc3NOYW1lJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsID0gdmFsO1xuICAgIH1cbiAgfSk7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHsqfSAgb1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuTC5Eb21VdGlsLmlzTm9kZSA9IGZ1bmN0aW9uKG8pe1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBOb2RlID09PSAnb2JqZWN0JyA/XG4gICAgbyBpbnN0YW5jZW9mIE5vZGUgOlxuICAgIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG8ubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIG8ubm9kZU5hbWUgPT09ICdzdHJpbmcnXG4gICk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0JCb3ggPSBmdW5jdGlvbihzdmcpIHtcbiAgdmFyIHZpZXdCb3ggPSBzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94Jyk7XG4gIHZhciBiYm94O1xuICBpZiAodmlld0JveCkge1xuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbG9uZSA9IHN2Zy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG4gICAgYmJveCA9IGNsb25lLmdldEJCb3goKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNsb25lKTtcbiAgICBiYm94ID0gW2Jib3gueCwgYmJveC55LFxuICAgICAgcGFyc2VJbnQoc3ZnLmdldEF0dHJpYnV0ZSgnd2lkdGgnKSkgfHwgc3ZnLm9mZnNldFdpZHRoIHx8IGJib3gud2lkdGgsXG4gICAgICBwYXJzZUludChzdmcuZ2V0QXR0cmlidXRlKCdoZWlnaHQnKSkgfHwgc3ZnLm9mZnNldEhlaWdodCB8fCBiYm94LmhlaWdodF07XG4gIH1cbiAgcmV0dXJuIFtiYm94WzBdLCBiYm94WzFdLCBiYm94WzBdICsgYmJveFsyXSwgYmJveFsxXSArIGJib3hbM11dO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyID0gZnVuY3Rpb24oc3RyKSB7XG4gIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHdyYXBwZXIuaW5uZXJIVE1MID0gc3RyO1xuICByZXR1cm4gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCdzdmcnKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBvaW50fSB0cmFuc2xhdGVcbiAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcgPSBmdW5jdGlvbih0cmFuc2xhdGUsIHNjYWxlKSB7XG4gIHJldHVybiAnbWF0cml4KCcgK1xuICAgIFtzY2FsZSwgMCwgMCwgc2NhbGUsIHRyYW5zbGF0ZS54LCB0cmFuc2xhdGUueV0uam9pbignLCcpICsgJyknO1xufTtcbiJdfQ==
