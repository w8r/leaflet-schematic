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

    this._pathViewport = new L.Bounds(min, max);
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
    useRaster: L.Browser.ie
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
      //console.log('missing', bbox);
      this._rawData = this._rawData.replace('<svg', '<svg viewBox="' + bbox.join(' ') + '" preserveAspectRatio="xMaxYMax" ');
    }

    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(this._map.unproject([bbox[0], bbox[3]], minZoom), this._map.unproject([bbox[2], bbox[1]], minZoom));

    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (size.y !== mapSize.y) {
      var ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this._bounds = this._bounds.scale(ratio);
      this._ratio = ratio;
    }

    this._size = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
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
    var scale = Math.pow(2, this._map.getZoom() - 1) * this._ratio;
    var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    var size = this.getOriginalSize().multiplyBy(scale);

    if (this._raster) {
      //console.log(size, scale);
      this._raster.style.width = size.x + 'px';
      this._raster.style.height = size.y + 'px';
      L.DomUtil.setPosition(this._raster, this._getViewport().min);
    }

    if (this._canvas) {
      this._redrawCanvas(topLeft, size);
      L.DomUtil.setPosition(this._canvas, this._getViewport().min);
    }

    this._group.setAttribute('transform', L.DomUtil.getMatrixString(topLeft, scale));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxNQUFNLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDOzs7QUNBN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDOzs7OztBQUFDLEFBSzNCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3pEOzs7Ozs7QUFBQyxBQU9GLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxVQUFTLEtBQUssRUFBRTtBQUN6QyxN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RyxHQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUM7QUFDcEIsUUFBSSxLQUFLLEdBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNCLFFBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMzQixRQUFJLElBQUksR0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQzVCLFFBQUksSUFBSSxHQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsV0FBVzs7O0FBQUMsQUFHOUMsUUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtBQUMxQixVQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNuQzs7QUFFRCxLQUFDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzNDLFFBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2xDLFFBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BDLFFBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFFdEUsUUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtBQUMxQixVQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNuQztHQUNGOztDQUVGLENBQUMsQ0FBQzs7Ozs7QUM3UEgsSUFBSSxDQUFDLEdBQVUsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ2xDLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNyQyxJQUFJLEdBQUcsR0FB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QUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0dBQzVFO0FBQ0QsU0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDakU7Ozs7OztBQUFDLEFBT0YsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxlQUFlLEdBQUcsVUFBUyxHQUFHLEVBQUU7QUFDeEMsTUFBSSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM1QyxTQUFPLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQztBQUN4QixTQUFPLE9BQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDckM7Ozs7Ozs7QUFBQyxBQVFGLENBQUMsQ0FBQyxPQUFPLENBQUMsZUFBZSxHQUFHLFVBQVMsU0FBUyxFQUFFLEtBQUssRUFBRTtBQUNyRCxTQUFPLFNBQVMsR0FDZCxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0NBQ2xFLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9zdmdvdmVybGF5Jyk7XG4iLCI7KGZ1bmN0aW9uICgpIHtcblxuICB2YXIgb2JqZWN0ID0gdHlwZW9mIGV4cG9ydHMgIT0gJ3VuZGVmaW5lZCcgPyBleHBvcnRzIDogdGhpczsgLy8gIzg6IHdlYiB3b3JrZXJzXG4gIHZhciBjaGFycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XG5cbiAgZnVuY3Rpb24gSW52YWxpZENoYXJhY3RlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB9XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3I7XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG4gIC8vIGVuY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5OTE2Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9uaWduYWddXG4gIG9iamVjdC5idG9hIHx8IChcbiAgb2JqZWN0LmJ0b2EgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KTtcbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJcbiAgICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAgIC8vICAgY2hhbmdlIHRoZSBtYXBwaW5nIHRhYmxlIHRvIFwiPVwiXG4gICAgICAvLyAgIGNoZWNrIGlmIGQgaGFzIG5vIGZyYWN0aW9uYWwgZGlnaXRzXG4gICAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgICAgLy8gXCI4IC0gaWR4ICUgMSAqIDhcIiBnZW5lcmF0ZXMgdGhlIHNlcXVlbmNlIDIsIDQsIDYsIDhcbiAgICAgIG91dHB1dCArPSBtYXAuY2hhckF0KDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICAgICkge1xuICAgICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpZHggKz0gMy80KTtcbiAgICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIididG9hJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZW5jb2RlZCBjb250YWlucyBjaGFyYWN0ZXJzIG91dHNpZGUgb2YgdGhlIExhdGluMSByYW5nZS5cIik7XG4gICAgICB9XG4gICAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbiAgLy8gZGVjb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTAyMDM5Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9hdGtdXG4gIG9iamVjdC5hdG9iIHx8IChcbiAgb2JqZWN0LmF0b2IgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KS5yZXBsYWNlKC89KyQvLCAnJyk7XG4gICAgaWYgKHN0ci5sZW5ndGggJSA0ID09IDEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYXRvYicgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGRlY29kZWQgaXMgbm90IGNvcnJlY3RseSBlbmNvZGVkLlwiKTtcbiAgICB9XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyc1xuICAgICAgdmFyIGJjID0gMCwgYnMsIGJ1ZmZlciwgaWR4ID0gMCwgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBnZXQgbmV4dCBjaGFyYWN0ZXJcbiAgICAgIGJ1ZmZlciA9IHN0ci5jaGFyQXQoaWR4KyspO1xuICAgICAgLy8gY2hhcmFjdGVyIGZvdW5kIGluIHRhYmxlPyBpbml0aWFsaXplIGJpdCBzdG9yYWdlIGFuZCBhZGQgaXRzIGFzY2lpIHZhbHVlO1xuICAgICAgfmJ1ZmZlciAmJiAoYnMgPSBiYyAlIDQgPyBicyAqIDY0ICsgYnVmZmVyIDogYnVmZmVyLFxuICAgICAgICAvLyBhbmQgaWYgbm90IGZpcnN0IG9mIGVhY2ggNCBjaGFyYWN0ZXJzLFxuICAgICAgICAvLyBjb252ZXJ0IHRoZSBmaXJzdCA4IGJpdHMgdG8gb25lIGFzY2lpIGNoYXJhY3RlclxuICAgICAgICBiYysrICUgNCkgPyBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgyNTUgJiBicyA+PiAoLTIgKiBiYyAmIDYpKSA6IDBcbiAgICApIHtcbiAgICAgIC8vIHRyeSB0byBmaW5kIGNoYXJhY3RlciBpbiB0YWJsZSAoMC02Mywgbm90IGZvdW5kID0+IC0xKVxuICAgICAgYnVmZmVyID0gY2hhcnMuaW5kZXhPZihidWZmZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxufSgpKTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5taW4ueCwgdGhpcy5taW4ueSwgdGhpcy5tYXgueCwgdGhpcy5tYXgueV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5Cb3VuZHN9XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBtYXggPSB0aGlzLm1heDtcbiAgdmFyIG1pbiA9IHRoaXMubWluO1xuICB2YXIgZGVsdGFYID0gKChtYXgueCAtIG1pbi54KSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG1heC55IC0gbWluLnkpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuQm91bmRzKFtcbiAgICBbbWluLnggLSBkZWx0YVgsIG1pbi55IC0gZGVsdGFZXSxcbiAgICBbbWF4LnggKyBkZWx0YVgsIG1heC55ICsgZGVsdGFZXVxuICBdKTtcbn07XG5cblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMuZ2V0V2VzdCgpLCB0aGlzLmdldFNvdXRoKCksIHRoaXMuZ2V0RWFzdCgpLCB0aGlzLmdldE5vcnRoKCldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbmUgPSB0aGlzLl9ub3J0aEVhc3Q7XG4gIHZhciBzdyA9IHRoaXMuX3NvdXRoV2VzdDtcbiAgdmFyIGRlbHRhWCA9ICgobmUubG5nIC0gc3cubG5nKSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG5lLmxhdCAtIHN3LmxhdCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoW1xuICAgIFtzdy5sYXQgLSBkZWx0YVksIHN3LmxuZyAtIGRlbHRhWF0sXG4gICAgW25lLmxhdCArIGRlbHRhWSwgbmUubG5nICsgZGVsdGFYXVxuICBdKTtcbn07XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkNsYXNzLmV4dGVuZCh7XG5cbiAgaW5jbHVkZXM6IEwuTWl4aW4uRXZlbnRzLFxuXG4gIG9wdGlvbnM6IHtcbiAgICBvcGFjaXR5OiAxLFxuICAgIHBhZGRpbmc6IEwuUGF0aC5DTElQX1BBRERJTkdcbiAgfSxcblxuICAvKipcbiAgICogQGNsYXNzIFN2Z0xheWVyIC0gYmFzaWNhbGx5LCBqdXN0IHRoZSBTVkcgY29udGFpbmVyIHNpbWlhciB0byB0aGUgb25lXG4gICAqIHVzZWQgYnkgbGVhZmxldCBpbnRlcm5hbGx5IHRvIHJlbmRlciB2ZWN0b3IgbGF5ZXJzXG4gICAqXG4gICAqIEBleHRlbmRzIHtMLkNsYXNzfVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2NvbnRhaW5lciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhSb290ICA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLk1hcH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Cb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcblxuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fbWFwID0gbWFwO1xuICAgIHRoaXMuX2luaXRQYXRoUm9vdCgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGFkZFRvOiBmdW5jdGlvbihtYXApIHtcbiAgICBtYXAuYWRkTGF5ZXIodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICBpZiAodGhpcy5fbWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcbiAgICAgIHRoaXMuX21hcC5vZmYoe1xuICAgICAgICAnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXG4gICAgICAgICd6b29tZW5kJzogdGhpcy5fZW5kUGF0aFpvb21cbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hcC5vZmYoJ21vdmVlbmQnLCB0aGlzLl91cGRhdGVTdmdWaWV3cG9ydCwgdGhpcyk7XG4gICAgdGhpcy5fbWFwLmdldFBhbmVzKCkub3ZlcmxheVBhbmUucmVtb3ZlQ2hpbGQodGhpcy5fY29udGFpbmVyKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgcmVtb3ZlRnJvbTogZnVuY3Rpb24obWFwKSB7XG4gICAgbWFwLnJlbW92ZUxheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0Zyb250OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJvb3QgPSB0aGlzLl9wYXRoUm9vdC5wYXJlbnROb2RlLFxuICAgICAgICBwYXRoID0gdGhpcy5fcGF0aFJvb3Q7XG5cbiAgICBpZiAocGF0aCAmJiByb290Lmxhc3RDaGlsZCAhPT0gcGF0aCkge1xuICAgICAgcm9vdC5hcHBlbmRDaGlsZChwYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBicmluZ1RvQmFjazogZnVuY3Rpb24gKCkge1xuICAgIHZhciByb290ID0gdGhpcy5fcGF0aFJvb3QucGFyZW50Tm9kZTtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGhSb290O1xuICAgIHZhciBmaXJzdCA9IHJvb3QuZmlyc3RDaGlsZDtcblxuICAgIGlmIChwYXRoICYmIGZpcnN0ICE9PSBwYXRoKSB7XG4gICAgICByb290Lmluc2VydEJlZm9yZShwYXRoLCBmaXJzdCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBzdmcgcm9vdFxuICAgKi9cbiAgX2NyZWF0ZVJvb3Q6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGhSb290ID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnc3ZnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtaW1hZ2UtbGF5ZXInKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcGF0aFJvb3QpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEluaXQgdGhlIHJvb3QgZWxlbWVudFxuICAgKi9cbiAgX2luaXRQYXRoUm9vdDogZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5fcGF0aFJvb3QpIHtcbiAgICAgIHRoaXMuX2NyZWF0ZVJvb3QoKTtcbiAgICAgIHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lLmFwcGVuZENoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG5cbiAgICAgIGlmICh0aGlzLl9tYXAub3B0aW9ucy56b29tQW5pbWF0aW9uICYmIEwuQnJvd3Nlci5hbnkzZCkge1xuICAgICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aFJvb3QsICdsZWFmbGV0LXpvb20tYW5pbWF0ZWQnKTtcblxuICAgICAgICB0aGlzLl9tYXAub24oe1xuICAgICAgICAgICd6b29tYW5pbSc6IHRoaXMuX2FuaW1hdGVQYXRoWm9vbSxcbiAgICAgICAgICAnem9vbWVuZCc6IHRoaXMuX2VuZFBhdGhab29tXG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGhSb290LCAnbGVhZmxldC16b29tLWhpZGUnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbWFwLm9uKCdtb3ZlZW5kJywgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQsIHRoaXMpO1xuICAgICAgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogVG8gb3ZlcnJpZGUgaW4gdGhlIGNoaWxkIGNsYXNzZXNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBfZ2V0Vmlld3BvcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoVmlld3BvcnQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogVXBkYXRlIHJvb3QgcG9zaXRpb24gdG8gZ2V0IHRoZSB2aWV3cG9ydCBjb3ZlcmVkXG4gICAqL1xuICBfdXBkYXRlQ29udGVudFZpZXdwb3J0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHAgPSB0aGlzLm9wdGlvbnMucGFkZGluZztcbiAgICB2YXIgc2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG4gICAgdmFyIHBhbmVQb3MgPSBMLkRvbVV0aWwuZ2V0UG9zaXRpb24odGhpcy5fbWFwLl9tYXBQYW5lKTtcbiAgICB2YXIgbWluID0gcGFuZVBvcy5tdWx0aXBseUJ5KC0xKS5fc3VidHJhY3Qoc2l6ZS5tdWx0aXBseUJ5KHApLl9yb3VuZCgpKTtcbiAgICB2YXIgbWF4ID0gbWluLmFkZChzaXplLm11bHRpcGx5QnkoMSArIHAgKiAyKS5fcm91bmQoKSk7XG5cbiAgICB0aGlzLl9wYXRoVmlld3BvcnQgPSBuZXcgTC5Cb3VuZHMobWluLCBtYXgpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge1pvb21FdmVudH0gZVxuICAgKi9cbiAgX2FuaW1hdGVQYXRoWm9vbTogZnVuY3Rpb24gKGUpIHtcbiAgICB2YXIgc2NhbGUgPSB0aGlzLl9tYXAuZ2V0Wm9vbVNjYWxlKGUuem9vbSk7XG4gICAgdmFyIG9mZnNldCA9IHRoaXMuX21hcFxuICAgICAgLl9nZXRDZW50ZXJPZmZzZXQoZS5jZW50ZXIpXG4gICAgICAuX211bHRpcGx5QnkoLXNjYWxlKVxuICAgICAgLl9hZGQodGhpcy5fZ2V0Vmlld3BvcnQoKS5taW4pO1xuXG4gICAgdGhpcy5fcGF0aFJvb3Quc3R5bGVbTC5Eb21VdGlsLlRSQU5TRk9STV0gPVxuICAgICAgTC5Eb21VdGlsLmdldFRyYW5zbGF0ZVN0cmluZyhvZmZzZXQpICsgJyBzY2FsZSgnICsgc2NhbGUgKyAnKSAnO1xuXG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSB0cnVlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEhlcmUgd2UgY2FuIGRvIGFkZGl0aW9uYWwgcG9zdC1hbmltYXRpb24gdHJhbnNmb3Jtc1xuICAgKi9cbiAgX2VuZFBhdGhab29tOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fcGF0aFpvb21pbmcgPSBmYWxzZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBcHBseSB0aGUgdmlld3BvcnQgY29ycmVjdGlvblxuICAgKi9cbiAgX3VwZGF0ZVN2Z1ZpZXdwb3J0OiBmdW5jdGlvbiAoKSB7XG5cbiAgICBpZiAodGhpcy5fcGF0aFpvb21pbmcpIHtcbiAgICAgIC8vIERvIG5vdCB1cGRhdGUgU1ZHcyB3aGlsZSBhIHpvb20gYW5pbWF0aW9uIGlzIGdvaW5nIG9uXG4gICAgICAvLyBvdGhlcndpc2UgdGhlIGFuaW1hdGlvbiB3aWxsIGJyZWFrLlxuICAgICAgLy8gV2hlbiB0aGUgem9vbSBhbmltYXRpb24gZW5kcyB3ZSB3aWxsIGJlIHVwZGF0ZWQgYWdhaW4gYW55d2F5XG4gICAgICAvLyBUaGlzIGZpeGVzIHRoZSBjYXNlIHdoZXJlIHlvdSBkbyBhIG1vbWVudHVtIG1vdmUgYW5kXG4gICAgICAvLyB6b29tIHdoaWxlIHRoZSBtb3ZlIGlzIHN0aWxsIG9uZ29pbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fdXBkYXRlQ29udGVudFZpZXdwb3J0KCk7XG5cbiAgICB2YXIgdnAgICAgID0gdGhpcy5fZ2V0Vmlld3BvcnQoKTtcbiAgICB2YXIgbWluICAgID0gdnAubWluO1xuICAgIHZhciBtYXggICAgPSB2cC5tYXg7XG4gICAgdmFyIHdpZHRoICA9IG1heC54IC0gbWluLng7XG4gICAgdmFyIGhlaWdodCA9IG1heC55IC0gbWluLnk7XG4gICAgdmFyIHJvb3QgICA9IHRoaXMuX3BhdGhSb290O1xuICAgIHZhciBwYW5lICAgPSB0aGlzLl9tYXAuZ2V0UGFuZXMoKS5vdmVybGF5UGFuZTtcblxuICAgIC8vIEhhY2sgdG8gbWFrZSBmbGlja2VyIG9uIGRyYWcgZW5kIG9uIG1vYmlsZSB3ZWJraXQgbGVzcyBpcnJpdGF0aW5nXG4gICAgaWYgKEwuQnJvd3Nlci5tb2JpbGVXZWJraXQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5yZW1vdmVDaGlsZChyb290KTtcbiAgICB9XG5cbiAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fcGF0aFJvb3QsIG1pbik7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgd2lkdGgpO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBoZWlnaHQpO1xuICAgIHJvb3Quc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgW21pbi54LCBtaW4ueSwgd2lkdGgsIGhlaWdodF0uam9pbignICcpKTtcblxuICAgIGlmIChMLkJyb3dzZXIubW9iaWxlV2Via2l0KSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQocm9vdCk7XG4gICAgfVxuICB9XG5cbn0pO1xuIiwidmFyIEwgICAgICAgID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIFN2Z0xheWVyID0gcmVxdWlyZSgnLi9zdmdsYXllcicpO1xudmFyIGI2NCAgICAgID0gcmVxdWlyZSgnQmFzZTY0Jyk7XG5cbnJlcXVpcmUoJy4vYm91bmRzJyk7XG5yZXF1aXJlKCcuL3V0aWxzJyk7XG5cblxuXG4gdmFyIFNWR092ZXJsYXkgPSBTdmdMYXllci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjI1LFxuICAgIG9wYWNpdHk6IDEsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgICAvLyBsb2FkOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7fVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7U3ZnTGF5ZXJ9XG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyAgICA9IHN2ZztcblxuICAgIGlmICghKGJvdW5kcyBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSkge1xuICAgICAgb3B0aW9ucyA9IGJvdW5kcztcbiAgICAgIGJvdW5kcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXMgPSBudWxsO1xuXG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHJldHVybiBuZXcgTC5Qb2ludChcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcbiAgICAgIE1hdGguYWJzKGJib3hbMV0gLSBiYm94WzNdKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU1ZHIGlzIHJlYWR5XG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxuICAgKi9cbiAgb25Mb2FkOiBmdW5jdGlvbihzdmcpIHtcbiAgICB0aGlzLl9yYXdEYXRhID0gc3ZnO1xuICAgIHN2ZyA9IEwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIoc3ZnKTtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChzdmcpO1xuICAgIHZhciBtaW5ab29tID0gdGhpcy5fbWFwLmdldE1pblpvb20oKTtcblxuICAgIGlmIChzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ21pc3NpbmcnLCBiYm94KTtcbiAgICAgIHRoaXMuX3Jhd0RhdGEgPSB0aGlzLl9yYXdEYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIGJib3guam9pbignICcpICtcbiAgICAgICAgJ1wiIHByZXNlcnZlQXNwZWN0UmF0aW89XCJ4TWF4WU1heFwiICcpO1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgZWRnZXMgb2YgdGhlIGltYWdlLCBpbiBjb29yZGluYXRlIHNwYWNlXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFswXSwgYmJveFszXV0sIG1pblpvb20pLFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFsyXSwgYmJveFsxXV0sIG1pblpvb20pXG4gICAgKTtcblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICB2YXIgbWFwU2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG5cbiAgICBpZiAoc2l6ZS55ICE9PSBtYXBTaXplLnkpIHtcbiAgICAgIHZhciByYXRpbyA9IE1hdGgubWluKG1hcFNpemUueCAvIHNpemUueCwgbWFwU2l6ZS55IC8gc2l6ZS55KTtcbiAgICAgIHRoaXMuX2JvdW5kcyA9IHRoaXMuX2JvdW5kcy5zY2FsZShyYXRpbyk7XG4gICAgICB0aGlzLl9yYXRpbyA9IHJhdGlvO1xuICAgIH1cblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcblxuICAgIHRoaXMuX2dyb3VwID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnZycpO1xuICAgIGlmIChMLkJyb3dzZXIuaWUpIHsgLy8gaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFXG4gICAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICAgIGRvIHtcbiAgICAgICAgdGhpcy5fZ3JvdXAuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgfSB3aGlsZShjaGlsZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2dyb3VwLmlubmVySFRNTCA9IHN2Zy5pbm5lckhUTUw7XG4gICAgfVxuICAgIHRoaXMuX3BhdGhSb290LmFwcGVuZENoaWxkKHRoaXMuX2dyb3VwKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuICAgIHRoaXMuX29uTWFwWm9vbUVuZCgpO1xuICAgIHRoaXMuX3Jlc2V0KCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICBnZXRCb3VuZHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ib3VuZHM7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Vuc2NhbGVQb2ludCh0aGlzLl9tYXAucHJvamVjdChjb29yZCwgdGhpcy5fbWFwLmdldE1pblpvb20oKSkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC51bnByb2plY3QodGhpcy5fc2NhbGVQb2ludChwdCksIHRoaXMuX21hcC5nZXRNaW5ab29tKCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcGFjaXR5XG4gICAqIEByZXR1cm4ge1NWR0xheWVyfVxuICAgKi9cbiAgc2V0T3BhY2l0eTogZnVuY3Rpb24gKG9wYWNpdHkpIHtcbiAgICB0aGlzLm9wdGlvbnMub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgdGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5taW4pO1xuICAgIHZhciBuZSA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5tYXgpO1xuICAgIHJldHVybiBMLmxhdExuZ0JvdW5kcyhzdywgbmUpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBsYXllckJvdW5kcyB0byBzY2hlbWF0aWMgYmJveFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgcHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgcmV0dXJuIG5ldyBMLkJvdW5kcyhcbiAgICAgIHRoaXMubWFwQ29vcmRUb1BvaW50KGJvdW5kcy5nZXRTb3V0aFdlc3QoKSksXG4gICAgICB0aGlzLm1hcENvb3JkVG9Qb2ludChib3VuZHMuZ2V0Tm9ydGhFYXN0KCkpXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxuICAgKi9cbiAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5vbkxvYWQoc3ZnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBTdmdMYXllci5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgbWFwXG4gICAgICAub24oJ3pvb21lbmQnLCB0aGlzLl9vbk1hcFpvb21FbmQsIHRoaXMpXG4gICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vbigndmllcmVzZXQgbW92ZWVuZCcsIHRoaXMuX3Jlc2V0LCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5fc3ZnKSB7XG4gICAgICB0aGlzLmxvYWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgbWFwXG4gICAgICAub2ZmKCd6b29tZW5kJywgdGhpcy5fb25NYXBab29tRW5kLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ3N0YXJ0JywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vZmYoJ3ZpZXJlc2V0IG1vdmVlbmQnLCB0aGlzLl9yZXNldCwgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAgeyo9fSAgICAgICBjb250ZXh0XG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICB3aGVuUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuX2JvdW5kcykge1xuICAgICAgY2FsbGJhY2suY2FsbChjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbmNlKCdsb2FkJywgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSYXN0ZXJpemVzIHRoZSBzY2hlbWF0aWNcbiAgICogQHJldHVybiB7U2NoZW1hdGljfVxuICAgKi9cbiAgdG9JbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggPSB0aGlzLl9zaXplLnggKyAncHgnO1xuICAgIGltZy5zdHlsZS5oZWlnaHQgPSB0aGlzLl9zaXplLnkgKyAncHgnO1xuICAgIGltZy5zcmMgPSB0aGlzLnRvQmFzZTY0KCk7XG5cbiAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzIHx8IEwuRG9tVXRpbC5jcmVhdGUoJ2NhbnZhcycsICdzY2hlbWF0aWMtY2FudmFzJyk7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5hdHVyYWxTaXplID0gTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgLy9jb25zb2xlLmxvZygnbmF0dXJhbCcsIG5hdHVyYWxTaXplKTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzID0gY2FudmFzO1xuICAgICAgdGhpcy5fY29udGFpbmVyLmluc2VydEJlZm9yZShjYW52YXMsIHRoaXMuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgaW1nLnN0eWxlLm9wYWNpdHkgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChpbWcpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vY29uc29sZS50aW1lKCdiYXNlNjQnKTtcbiAgICB2YXIgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Jhd0RhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvL2NvbnNvbGUudGltZUVuZCgnYmFzZTY0Jyk7XG5cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBXZSBuZWVkIHRvIHJlZHJhdyBvbiB6b29tIGVuZFxuICAgKi9cbiAgX2VuZFBhdGhab29tOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5fZW5kUGF0aFpvb20uY2FsbCh0aGlzKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IEZST00gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3Vuc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gICAgLy8gc2FtZSBhcyBhYm92ZSwgYnV0IG5vdCB1c2luZyB0cmFuc2Zvcm0gbWF0cml4XG4gICAgLy9yZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAubXVsdGlwbHlCeSgxLyB0aGlzLl9yYXRpbykuYWRkKHRoaXMuX29yaWdpbik7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXG4gICAgKTtcbiAgICAvLyBlcXVhbHMgdG9cbiAgICAvLyByZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAgLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pLmFkZCh0aGlzLl9vcmlnaW4pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xuICAgKi9cbiAgX3Nob3dSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9jYW52YXMuc3R5bGUuZGlzcGxheSAgID0gJ2Jsb2NrJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN3YXAgYmFjayB0byBTVkdcbiAgICovXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzLnN0eWxlLmRpc3BsYXkgICA9ICdub25lJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZS1yZW5kZXIgY2FudmFzIG9uIHpvb21lbmRcbiAgICovXG4gIF9vbk1hcFpvb21FbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICAgdGhpcy50b0ltYWdlKCk7XG4gICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXRzIGNvbmF0aW5lciBvcGFjaXR5XG4gICAqL1xuICBfdXBkYXRlT3BhY2l0eTogZnVuY3Rpb24oKSB7XG4gICAgTC5Eb21VdGlsLnNldE9wYWNpdHkodGhpcy5fY29udGFpbmVyLCB0aGlzLm9wdGlvbnMub3BhY2l0eSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IHNoaWZlZCBjYW52YXNcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gdG9wTGVmdFxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBzaXplXG4gICAqL1xuICBfcmVkcmF3Q2FudmFzOiBmdW5jdGlvbih0b3BMZWZ0LCBzaXplKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdmFyIHZwID0gdGhpcy5fZ2V0Vmlld3BvcnQoKTtcbiAgICAgIHZhciBjYW52YXMgPSB0aGlzLl9jYW52YXM7XG4gICAgICB2YXIgbWluID0gdnAubWluO1xuICAgICAgdmFyIG1heCA9IHZwLm1heDtcbiAgICAgIHZhciB3aWR0aCA9IG1heC54IC0gbWluLng7XG4gICAgICB2YXIgaGVpZ2h0ID0gbWF4LnkgLSBtaW4ueTtcblxuICAgICAgdmFyIHBvcyA9IHRvcExlZnQuc3VidHJhY3QobWluKTtcblxuICAgICAgY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICBjYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICBjYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgLy8gY29uc29sZS5sb2cod2lkdGgsIGhlaWdodCwgc2l6ZS54LCBzaXplLnkpO1xuXG4gICAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICBjdHguZHJhd0ltYWdlKHRoaXMuX3Jhc3RlciwgcG9zLngsIHBvcy55LCBzaXplLngsIHNpemUueSk7XG5cbiAgICAgICAgLy8gY3R4LnJlY3QocG9zLngsIHBvcy55LCBzaXplLngsIHNpemUueSk7XG4gICAgICAgIC8vIGN0eC5zdHJva2VTdHlsZSA9ICdyZWQnO1xuICAgICAgICAvLyBjdHgubGluZVdpZHRoID0gMC4xO1xuICAgICAgICAvLyBjdHguc3Ryb2tlKCk7XG4gICAgICB9LCB0aGlzKTtcblxuICAgICAgLy90aGlzLl9wYXRoUm9vdC5zdHlsZS5vcGFjaXR5ID0gMC41O1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZWRyYXcgLSBjb21wZW5zYXRlIHRoZSBwb3NpdGlvbiBhbmQgc2NhbGVcbiAgICovXG4gIF9yZXNldDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBpbWFnZSAgID0gdGhpcy5fZ3JvdXA7XG4gICAgdmFyIHNjYWxlICAgPSBNYXRoLnBvdygyLCB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gMSkgKiB0aGlzLl9yYXRpbztcbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICB2YXIgc2l6ZSAgICA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG5cbiAgICBpZiAodGhpcy5fcmFzdGVyKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKHNpemUsIHNjYWxlKTtcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS53aWR0aCA9IHNpemUueCArICdweCc7XG4gICAgICB0aGlzLl9yYXN0ZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZS55ICsgJ3B4JztcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9yYXN0ZXIsIHRoaXMuX2dldFZpZXdwb3J0KCkubWluKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2l6ZSk7XG4gICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbik7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0LCBzY2FsZSkpO1xuICB9XG5cbn0pO1xuXG4vLyBleHBvcnRcbkwuU1ZHT3ZlcmxheSA9IFNWR092ZXJsYXk7XG5MLnN2Z092ZXJsYXkgPSBmdW5jdGlvbihzdmcsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTVkdPdmVybGF5KHN2Zywgb3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNWR092ZXJsYXk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLy8gPHVzZT4gdGFncyBhcmUgYnJva2VuIGluIElFIGluIHNvIG1hbnkgd2F5c1xuaWYgKCdTVkdFbGVtZW50SW5zdGFuY2UnIGluIGdsb2JhbCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgTm9kZSA9PT0gJ29iamVjdCcgP1xuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcbiAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICApO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XG4gIHZhciB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICB2YXIgYmJveDtcbiAgaWYgKHZpZXdCb3gpIHtcbiAgICBiYm94ID0gdmlld0JveC5zcGxpdCgnICcpLm1hcChwYXJzZUZsb2F0KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgIGJib3ggPSBjbG9uZS5nZXRCQm94KCk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgYmJveCA9IFtiYm94LngsIGJib3gueSxcbiAgICAgIHBhcnNlSW50KHN2Zy5nZXRBdHRyaWJ1dGUoJ3dpZHRoJykpIHx8IHN2Zy5vZmZzZXRXaWR0aCB8fCBiYm94LndpZHRoLFxuICAgICAgcGFyc2VJbnQoc3ZnLmdldEF0dHJpYnV0ZSgnaGVpZ2h0JykpIHx8IHN2Zy5vZmZzZXRIZWlnaHQgfHwgYmJveC5oZWlnaHRdO1xuICB9XG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gZnVuY3Rpb24odHJhbnNsYXRlLCBzY2FsZSkge1xuICByZXR1cm4gJ21hdHJpeCgnICtcbiAgICBbc2NhbGUsIDAsIDAsIHNjYWxlLCB0cmFuc2xhdGUueCwgdHJhbnNsYXRlLnldLmpvaW4oJywnKSArICcpJztcbn07XG4iXX0=
