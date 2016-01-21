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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zdmdsYXllci5qcyIsInNyYy9zdmdvdmVybGF5LmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxrQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtCO0FBRXpDLE1BQUksTUFBTSxLQUFLLEdBQUwsQ0FGK0I7QUFHekMsTUFBSSxTQUFTLENBQUUsSUFBSSxDQUFKLEdBQVEsSUFBSSxDQUFKLENBQVQsR0FBa0IsQ0FBbEIsSUFBd0IsUUFBUSxDQUFSLENBQXpCLENBSDRCO0FBSXpDLE1BQUksU0FBUyxDQUFFLElBQUksQ0FBSixHQUFRLElBQUksQ0FBSixDQUFULEdBQWtCLENBQWxCLElBQXdCLFFBQVEsQ0FBUixDQUF6QixDQUo0Qjs7QUFNekMsU0FBTyxJQUFJLEVBQUUsTUFBRixDQUFTLENBQ2xCLENBQUMsSUFBSSxDQUFKLEdBQVEsTUFBUixFQUFnQixJQUFJLENBQUosR0FBUSxNQUFSLENBREMsRUFFbEIsQ0FBQyxJQUFJLENBQUosR0FBUSxNQUFSLEVBQWdCLElBQUksQ0FBSixHQUFRLE1BQVIsQ0FGQyxDQUFiLENBQVAsQ0FOeUM7Q0FBaEI7Ozs7O0FBZ0IzQixFQUFFLFlBQUYsQ0FBZSxTQUFmLENBQXlCLE1BQXpCLEdBQWtDLFlBQVc7QUFDM0MsU0FBTyxDQUFDLEtBQUssT0FBTCxFQUFELEVBQWlCLEtBQUssUUFBTCxFQUFqQixFQUFrQyxLQUFLLE9BQUwsRUFBbEMsRUFBa0QsS0FBSyxRQUFMLEVBQWxELENBQVAsQ0FEMkM7Q0FBWDs7Ozs7O0FBU2xDLEVBQUUsWUFBRixDQUFlLFNBQWYsQ0FBeUIsS0FBekIsR0FBaUMsVUFBUyxLQUFULEVBQWdCO0FBQy9DLE1BQUksS0FBSyxLQUFLLFVBQUwsQ0FEc0M7QUFFL0MsTUFBSSxLQUFLLEtBQUssVUFBTCxDQUZzQztBQUcvQyxNQUFJLFNBQVMsQ0FBRSxHQUFHLEdBQUgsR0FBUyxHQUFHLEdBQUgsQ0FBVixHQUFvQixDQUFwQixJQUEwQixRQUFRLENBQVIsQ0FBM0IsQ0FIa0M7QUFJL0MsTUFBSSxTQUFTLENBQUUsR0FBRyxHQUFILEdBQVMsR0FBRyxHQUFILENBQVYsR0FBb0IsQ0FBcEIsSUFBMEIsUUFBUSxDQUFSLENBQTNCLENBSmtDOztBQU0vQyxTQUFPLElBQUksRUFBRSxZQUFGLENBQWUsQ0FDeEIsQ0FBQyxHQUFHLEdBQUgsR0FBUyxNQUFULEVBQWlCLEdBQUcsR0FBSCxHQUFTLE1BQVQsQ0FETSxFQUV4QixDQUFDLEdBQUcsR0FBSCxHQUFTLE1BQVQsRUFBaUIsR0FBRyxHQUFILEdBQVMsTUFBVCxDQUZNLENBQW5CLENBQVAsQ0FOK0M7Q0FBaEI7Ozs7O0FDdkNqQyxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7O0FBRUosT0FBTyxPQUFQLEdBQWlCLEVBQUUsS0FBRixDQUFRLE1BQVIsQ0FBZTs7QUFFOUIsWUFBVSxFQUFFLEtBQUYsQ0FBUSxNQUFSOztBQUVWLFdBQVM7QUFDUCxhQUFTLENBQVQ7QUFDQSxhQUFTLEVBQUUsSUFBRixDQUFPLFlBQVA7R0FGWDs7Ozs7Ozs7OztBQWFBLGNBQVksb0JBQVMsT0FBVCxFQUFrQjs7OztBQUk1QixTQUFLLFVBQUwsR0FBa0IsSUFBbEI7Ozs7O0FBSjRCLFFBVTVCLENBQUssU0FBTCxHQUFrQixJQUFsQjs7Ozs7QUFWNEIsUUFnQjVCLENBQUssSUFBTCxHQUFZLElBQVo7Ozs7O0FBaEI0QixRQXNCNUIsQ0FBSyxhQUFMLEdBQXFCLElBQXJCOzs7OztBQXRCNEIsUUE0QjVCLENBQUssWUFBTCxHQUFvQixLQUFwQixDQTVCNEI7O0FBOEI1QixNQUFFLElBQUYsQ0FBTyxVQUFQLENBQWtCLElBQWxCLEVBQXdCLE9BQXhCLEVBOUI0QjtHQUFsQjs7Ozs7O0FBc0NaLFNBQU8sZUFBUyxHQUFULEVBQWM7QUFDbkIsU0FBSyxJQUFMLEdBQVksR0FBWixDQURtQjtBQUVuQixTQUFLLGFBQUwsR0FGbUI7QUFHbkIsV0FBTyxJQUFQLENBSG1CO0dBQWQ7Ozs7OztBQVdQLFNBQU8sZUFBUyxHQUFULEVBQWM7QUFDbkIsUUFBSSxRQUFKLENBQWEsSUFBYixFQURtQjtBQUVuQixXQUFPLElBQVAsQ0FGbUI7R0FBZDs7Ozs7O0FBVVAsWUFBVSxrQkFBUyxHQUFULEVBQWM7QUFDdEIsUUFBSSxLQUFLLElBQUwsQ0FBVSxPQUFWLENBQWtCLGFBQWxCLElBQW1DLEVBQUUsT0FBRixDQUFVLEtBQVYsRUFBaUI7QUFDdEQsV0FBSyxJQUFMLENBQVUsR0FBVixDQUFjO0FBQ1osb0JBQVksS0FBSyxnQkFBTDtBQUNaLG1CQUFXLEtBQUssWUFBTDtPQUZiLEVBR0csSUFISCxFQURzRDtLQUF4RDs7QUFPQSxTQUFLLElBQUwsQ0FBVSxHQUFWLENBQWMsU0FBZCxFQUF5QixLQUFLLGtCQUFMLEVBQXlCLElBQWxELEVBUnNCO0FBU3RCLFNBQUssSUFBTCxDQUFVLFFBQVYsR0FBcUIsV0FBckIsQ0FBaUMsV0FBakMsQ0FBNkMsS0FBSyxVQUFMLENBQTdDLENBVHNCO0FBVXRCLFdBQU8sSUFBUCxDQVZzQjtHQUFkOzs7Ozs7QUFrQlYsY0FBWSxvQkFBUyxHQUFULEVBQWM7QUFDeEIsUUFBSSxXQUFKLENBQWdCLElBQWhCLEVBRHdCO0FBRXhCLFdBQU8sSUFBUCxDQUZ3QjtHQUFkOzs7OztBQVNaLGdCQUFjLHdCQUFZO0FBQ3hCLFFBQUksT0FBTyxLQUFLLFNBQUwsQ0FBZSxVQUFmO1FBQ1AsT0FBTyxLQUFLLFNBQUwsQ0FGYTs7QUFJeEIsUUFBSSxRQUFRLEtBQUssU0FBTCxLQUFtQixJQUFuQixFQUF5QjtBQUNuQyxXQUFLLFdBQUwsQ0FBaUIsSUFBakIsRUFEbUM7S0FBckM7QUFHQSxXQUFPLElBQVAsQ0FQd0I7R0FBWjs7Ozs7QUFjZCxlQUFhLHVCQUFZO0FBQ3ZCLFFBQUksT0FBTyxLQUFLLFNBQUwsQ0FBZSxVQUFmLENBRFk7QUFFdkIsUUFBSSxPQUFPLEtBQUssU0FBTCxDQUZZO0FBR3ZCLFFBQUksUUFBUSxLQUFLLFVBQUwsQ0FIVzs7QUFLdkIsUUFBSSxRQUFRLFVBQVUsSUFBVixFQUFnQjtBQUMxQixXQUFLLFlBQUwsQ0FBa0IsSUFBbEIsRUFBd0IsS0FBeEIsRUFEMEI7S0FBNUI7QUFHQSxXQUFPLElBQVAsQ0FSdUI7R0FBWjs7Ozs7QUFlYixlQUFhLHVCQUFXO0FBQ3RCLFNBQUssU0FBTCxHQUFpQixFQUFFLElBQUYsQ0FBTyxTQUFQLENBQWlCLGNBQWpCLENBQWdDLEtBQWhDLENBQWpCLENBRHNCO0FBRXRCLFNBQUssVUFBTCxHQUFrQixFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCLEtBQWpCLEVBQXdCLHFCQUF4QixDQUFsQixDQUZzQjtBQUd0QixTQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsS0FBSyxTQUFMLENBQTVCLENBSHNCO0dBQVg7Ozs7O0FBVWIsaUJBQWUseUJBQVk7QUFDekIsUUFBSSxDQUFDLEtBQUssU0FBTCxFQUFnQjtBQUNuQixXQUFLLFdBQUwsR0FEbUI7QUFFbkIsV0FBSyxJQUFMLENBQVUsUUFBVixHQUFxQixXQUFyQixDQUFpQyxXQUFqQyxDQUE2QyxLQUFLLFVBQUwsQ0FBN0MsQ0FGbUI7O0FBSW5CLFVBQUksS0FBSyxJQUFMLENBQVUsT0FBVixDQUFrQixhQUFsQixJQUFtQyxFQUFFLE9BQUYsQ0FBVSxLQUFWLEVBQWlCO0FBQ3RELFVBQUUsT0FBRixDQUFVLFFBQVYsQ0FBbUIsS0FBSyxTQUFMLEVBQWdCLHVCQUFuQyxFQURzRDs7QUFHdEQsYUFBSyxJQUFMLENBQVUsRUFBVixDQUFhO0FBQ1gsc0JBQVksS0FBSyxnQkFBTDtBQUNaLHFCQUFXLEtBQUssWUFBTDtTQUZiLEVBR0csSUFISCxFQUhzRDtPQUF4RCxNQU9PO0FBQ0wsVUFBRSxPQUFGLENBQVUsUUFBVixDQUFtQixLQUFLLFNBQUwsRUFBZ0IsbUJBQW5DLEVBREs7T0FQUDs7QUFXQSxXQUFLLElBQUwsQ0FBVSxFQUFWLENBQWEsU0FBYixFQUF3QixLQUFLLGtCQUFMLEVBQXlCLElBQWpELEVBZm1CO0FBZ0JuQixXQUFLLGtCQUFMLEdBaEJtQjtLQUFyQjtHQURhOzs7Ozs7QUEwQmYsZ0JBQWMsd0JBQVc7QUFDdkIsV0FBTyxLQUFLLGFBQUwsQ0FEZ0I7R0FBWDs7Ozs7QUFRZCwwQkFBd0Isa0NBQVk7QUFDbEMsUUFBSSxJQUFJLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FEMEI7QUFFbEMsUUFBSSxPQUFPLEtBQUssSUFBTCxDQUFVLE9BQVYsRUFBUCxDQUY4QjtBQUdsQyxRQUFJLFVBQVUsRUFBRSxPQUFGLENBQVUsV0FBVixDQUFzQixLQUFLLElBQUwsQ0FBVSxRQUFWLENBQWhDLENBSDhCO0FBSWxDLFFBQUksTUFBTSxRQUFRLFVBQVIsQ0FBbUIsQ0FBQyxDQUFELENBQW5CLENBQXVCLFNBQXZCLENBQWlDLEtBQUssVUFBTCxDQUFnQixDQUFoQixFQUFtQixNQUFuQixFQUFqQyxDQUFOLENBSjhCO0FBS2xDLFFBQUksTUFBTSxJQUFJLEdBQUosQ0FBUSxLQUFLLFVBQUwsQ0FBZ0IsSUFBSSxJQUFJLENBQUosQ0FBcEIsQ0FBMkIsTUFBM0IsRUFBUixDQUFOLENBTDhCOztBQU9sQyxTQUFLLGFBQUwsR0FBcUIsSUFBSSxFQUFFLE1BQUYsQ0FBUyxDQUFDLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixDQUFyQixFQUE2QixDQUFDLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixDQUFyQyxDQUFyQixDQVBrQztHQUFaOzs7OztBQWN4QixvQkFBa0IsMEJBQVUsQ0FBVixFQUFhO0FBQzdCLFFBQUksUUFBUSxLQUFLLElBQUwsQ0FBVSxZQUFWLENBQXVCLEVBQUUsSUFBRixDQUEvQixDQUR5QjtBQUU3QixRQUFJLFNBQVMsS0FBSyxJQUFMLENBQ1YsZ0JBRFUsQ0FDTyxFQUFFLE1BQUYsQ0FEUCxDQUVWLFdBRlUsQ0FFRSxDQUFDLEtBQUQsQ0FGRixDQUdWLElBSFUsQ0FHTCxLQUFLLFlBQUwsR0FBb0IsR0FBcEIsQ0FISixDQUZ5Qjs7QUFPN0IsU0FBSyxTQUFMLENBQWUsS0FBZixDQUFxQixFQUFFLE9BQUYsQ0FBVSxTQUFWLENBQXJCLEdBQ0UsRUFBRSxPQUFGLENBQVUsa0JBQVYsQ0FBNkIsTUFBN0IsSUFBdUMsU0FBdkMsR0FBbUQsS0FBbkQsR0FBMkQsSUFBM0QsQ0FSMkI7O0FBVTdCLFNBQUssWUFBTCxHQUFvQixJQUFwQixDQVY2QjtHQUFiOzs7OztBQWlCbEIsZ0JBQWMsd0JBQVk7QUFDeEIsU0FBSyxZQUFMLEdBQW9CLEtBQXBCLENBRHdCO0dBQVo7Ozs7O0FBUWQsc0JBQW9CLDhCQUFZOztBQUU5QixRQUFJLEtBQUssWUFBTCxFQUFtQjs7Ozs7O0FBTXJCLGFBTnFCO0tBQXZCOztBQVNBLFNBQUssc0JBQUwsR0FYOEI7O0FBYTlCLFFBQUksS0FBUyxLQUFLLFlBQUwsRUFBVCxDQWIwQjtBQWM5QixRQUFJLE1BQVMsR0FBRyxHQUFILENBZGlCO0FBZTlCLFFBQUksTUFBUyxHQUFHLEdBQUgsQ0FmaUI7QUFnQjlCLFFBQUksUUFBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FoQlM7QUFpQjlCLFFBQUksU0FBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FqQlM7QUFrQjlCLFFBQUksT0FBUyxLQUFLLFNBQUwsQ0FsQmlCO0FBbUI5QixRQUFJLE9BQVMsS0FBSyxJQUFMLENBQVUsUUFBVixHQUFxQixXQUFyQjs7O0FBbkJpQixRQXNCMUIsRUFBRSxPQUFGLENBQVUsWUFBVixFQUF3QjtBQUMxQixXQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsSUFBNUIsRUFEMEI7S0FBNUI7O0FBSUEsTUFBRSxPQUFGLENBQVUsV0FBVixDQUFzQixLQUFLLFNBQUwsRUFBZ0IsR0FBdEMsRUExQjhCO0FBMkI5QixTQUFLLFlBQUwsQ0FBa0IsT0FBbEIsRUFBMkIsS0FBM0IsRUEzQjhCO0FBNEI5QixTQUFLLFlBQUwsQ0FBa0IsUUFBbEIsRUFBNEIsTUFBNUIsRUE1QjhCO0FBNkI5QixTQUFLLFlBQUwsQ0FBa0IsU0FBbEIsRUFBNkIsQ0FBQyxJQUFJLENBQUosRUFBTyxJQUFJLENBQUosRUFBTyxLQUFmLEVBQXNCLE1BQXRCLEVBQThCLElBQTlCLENBQW1DLEdBQW5DLENBQTdCLEVBN0I4Qjs7QUErQjlCLFFBQUksRUFBRSxPQUFGLENBQVUsWUFBVixFQUF3QjtBQUMxQixXQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsSUFBNUIsRUFEMEI7S0FBNUI7R0EvQmtCOztDQXZOTCxDQUFqQjs7Ozs7QUNGQSxJQUFJLElBQVcsUUFBUSxTQUFSLENBQVg7QUFDSixJQUFJLFdBQVcsUUFBUSxZQUFSLENBQVg7QUFDSixJQUFJLE1BQVcsUUFBUSxRQUFSLENBQVg7O0FBRUosUUFBUSxVQUFSO0FBQ0EsUUFBUSxTQUFSOztBQUVBLElBQUksYUFBYSxTQUFTLE1BQVQsQ0FBZ0I7O0FBRS9CLFdBQVM7QUFDUCxhQUFTLElBQVQ7QUFDQSxhQUFTLENBQVQ7QUFDQSxlQUFXLEVBQUUsT0FBRixDQUFVLEVBQVY7O0FBSEosR0FBVDs7Ozs7Ozs7O0FBZUEsY0FBWSxvQkFBUyxHQUFULEVBQWMsTUFBZCxFQUFzQixPQUF0QixFQUErQjs7Ozs7QUFLekMsU0FBSyxJQUFMLEdBQWUsR0FBZixDQUx5Qzs7QUFPekMsUUFBSSxFQUFFLGtCQUFrQixFQUFFLFlBQUYsQ0FBcEIsRUFBcUM7QUFDdkMsZ0JBQVUsTUFBVixDQUR1QztBQUV2QyxlQUFTLElBQVQsQ0FGdUM7S0FBekM7Ozs7O0FBUHlDLFFBZXpDLENBQUssT0FBTCxHQUFlLE1BQWY7Ozs7O0FBZnlDLFFBb0J6QyxDQUFLLE1BQUwsR0FBYyxDQUFkOzs7OztBQXBCeUMsUUEwQnpDLENBQUssS0FBTCxHQUFhLElBQWI7Ozs7O0FBMUJ5QyxRQWdDekMsQ0FBSyxPQUFMLEdBQWUsSUFBZjs7Ozs7QUFoQ3lDLFFBc0N6QyxDQUFLLGVBQUwsR0FBdUIsSUFBdkI7Ozs7O0FBdEN5QyxRQTRDekMsQ0FBSyxjQUFMLEdBQXNCLEVBQXRCOzs7OztBQTVDeUMsUUFrRHpDLENBQUssUUFBTCxHQUFnQixFQUFoQixDQWxEeUM7O0FBb0R6QyxRQUFJLE9BQU8sR0FBUCxLQUFlLFFBQWYsSUFBMkIsQ0FBQyxVQUFVLElBQVYsQ0FBZSxHQUFmLENBQUQsRUFBc0I7QUFDbkQsV0FBSyxJQUFMLEdBQVksSUFBWjs7Ozs7QUFEbUQsVUFNbkQsQ0FBSyxJQUFMLEdBQVksR0FBWixDQU5tRDs7QUFRbkQsVUFBSSxDQUFDLFFBQVEsSUFBUixFQUFjO0FBQ2pCLGNBQU0sSUFBSSxLQUFKLENBQVUsMERBQ2Qsc0RBRGMsQ0FBaEIsQ0FEaUI7T0FBbkI7S0FSRjs7Ozs7QUFwRHlDLFFBcUV6QyxDQUFLLE1BQUwsR0FBYyxJQUFkOzs7OztBQXJFeUMsUUEyRXpDLENBQUssTUFBTCxHQUFjLElBQWQ7Ozs7O0FBM0V5QyxRQWlGekMsQ0FBSyxPQUFMLEdBQWUsSUFBZixDQWpGeUM7O0FBbUZ6QyxNQUFFLElBQUYsQ0FBTyxVQUFQLENBQWtCLElBQWxCLEVBQXdCLE9BQXhCLEVBbkZ5QztHQUEvQjs7Ozs7QUEwRlosbUJBQWlCLDJCQUFXO0FBQzFCLFFBQUksT0FBTyxLQUFLLEtBQUwsQ0FEZTtBQUUxQixXQUFPLElBQUksRUFBRSxLQUFGLENBQ1QsS0FBSyxHQUFMLENBQVMsS0FBSyxDQUFMLElBQVUsS0FBSyxDQUFMLENBQVYsQ0FESixFQUVMLEtBQUssR0FBTCxDQUFTLEtBQUssQ0FBTCxJQUFVLEtBQUssQ0FBTCxDQUFWLENBRkosQ0FBUCxDQUYwQjtHQUFYOzs7Ozs7QUFhakIsVUFBUSxnQkFBUyxHQUFULEVBQWM7QUFDcEIsU0FBSyxRQUFMLEdBQWdCLEdBQWhCLENBRG9CO0FBRXBCLFVBQU0sRUFBRSxPQUFGLENBQVUsZUFBVixDQUEwQixHQUExQixDQUFOLENBRm9CO0FBR3BCLFFBQUksT0FBTyxLQUFLLEtBQUwsR0FBYSxFQUFFLE9BQUYsQ0FBVSxVQUFWLENBQXFCLEdBQXJCLENBQWIsQ0FIUztBQUlwQixRQUFJLFVBQVUsS0FBSyxJQUFMLENBQVUsVUFBVixFQUFWLENBSmdCOztBQU1wQixRQUFJLElBQUksWUFBSixDQUFpQixTQUFqQixNQUFnQyxJQUFoQyxFQUFzQzs7QUFFeEMsV0FBSyxRQUFMLEdBQWdCLEtBQUssUUFBTCxDQUFjLE9BQWQsQ0FBc0IsTUFBdEIsRUFDZCxtQkFBbUIsS0FBSyxJQUFMLENBQVUsR0FBVixDQUFuQixHQUNBLG1DQURBLENBREYsQ0FGd0M7S0FBMUM7OztBQU5vQixRQWNwQixDQUFLLE9BQUwsR0FBZSxJQUFJLEVBQUUsWUFBRixDQUNqQixLQUFLLElBQUwsQ0FBVSxTQUFWLENBQW9CLENBQUMsS0FBSyxDQUFMLENBQUQsRUFBVSxLQUFLLENBQUwsQ0FBVixDQUFwQixFQUF3QyxPQUF4QyxDQURhLEVBRWIsS0FBSyxJQUFMLENBQVUsU0FBVixDQUFvQixDQUFDLEtBQUssQ0FBTCxDQUFELEVBQVUsS0FBSyxDQUFMLENBQVYsQ0FBcEIsRUFBd0MsT0FBeEMsQ0FGYSxDQUFmLENBZG9COztBQW1CcEIsUUFBSSxPQUFPLEtBQUssZUFBTCxFQUFQLENBbkJnQjtBQW9CcEIsUUFBSSxVQUFVLEtBQUssSUFBTCxDQUFVLE9BQVYsRUFBVixDQXBCZ0I7O0FBc0JwQixRQUFJLEtBQUssQ0FBTCxLQUFXLFFBQVEsQ0FBUixFQUFXO0FBQ3hCLFVBQUksUUFBUSxLQUFLLEdBQUwsQ0FBUyxRQUFRLENBQVIsR0FBWSxLQUFLLENBQUwsRUFBUSxRQUFRLENBQVIsR0FBWSxLQUFLLENBQUwsQ0FBakQsQ0FEb0I7QUFFeEIsV0FBSyxPQUFMLEdBQWUsS0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixLQUFuQixDQUFmLENBRndCO0FBR3hCLFdBQUssTUFBTCxHQUFjLEtBQWQsQ0FId0I7S0FBMUI7O0FBTUEsU0FBSyxLQUFMLEdBQWUsSUFBZixDQTVCb0I7QUE2QnBCLFNBQUssT0FBTCxHQUFlLEtBQUssSUFBTCxDQUFVLE9BQVYsQ0FBa0IsS0FBSyxPQUFMLENBQWEsU0FBYixFQUFsQixFQUE0QyxPQUE1QyxDQUFmLENBN0JvQjtBQThCcEIsU0FBSyxlQUFMLEdBQXVCLElBQUksRUFBRSxjQUFGLENBQ3pCLENBRHFCLEVBQ2xCLEtBQUssT0FBTCxDQUFhLENBQWIsRUFBZ0IsQ0FERSxFQUNDLEtBQUssT0FBTCxDQUFhLENBQWIsQ0FEeEIsQ0E5Qm9COztBQWlDcEIsU0FBSyxNQUFMLEdBQWMsRUFBRSxJQUFGLENBQU8sU0FBUCxDQUFpQixjQUFqQixDQUFnQyxHQUFoQyxDQUFkLENBakNvQjtBQWtDcEIsUUFBSSxFQUFFLE9BQUYsQ0FBVSxFQUFWLEVBQWM7O0FBQ2hCLFVBQUksUUFBUSxJQUFJLFVBQUosQ0FESTtBQUVoQixTQUFHO0FBQ0QsYUFBSyxNQUFMLENBQVksV0FBWixDQUF3QixLQUF4QixFQURDO0FBRUQsZ0JBQVEsSUFBSSxVQUFKLENBRlA7T0FBSCxRQUdRLEtBSFIsRUFGZ0I7S0FBbEIsTUFNTztBQUNMLFdBQUssTUFBTCxDQUFZLFNBQVosR0FBd0IsSUFBSSxTQUFKLENBRG5CO0tBTlA7QUFTQSxTQUFLLFNBQUwsQ0FBZSxXQUFmLENBQTJCLEtBQUssTUFBTCxDQUEzQixDQTNDb0I7O0FBNkNwQixTQUFLLElBQUwsQ0FBVSxNQUFWLEVBN0NvQjtBQThDcEIsU0FBSyxhQUFMLEdBOUNvQjtBQStDcEIsU0FBSyxNQUFMLEdBL0NvQjtHQUFkOzs7OztBQXNEUixlQUFhLHVCQUFXO0FBQ3RCLFdBQU8sS0FBSyxNQUFMLENBRGU7R0FBWDs7Ozs7QUFRYixhQUFXLHFCQUFXO0FBQ3BCLFdBQU8sS0FBSyxPQUFMLENBRGE7R0FBWDs7Ozs7OztBQVVYLGdCQUFjLHNCQUFTLEtBQVQsRUFBZ0I7QUFDNUIsV0FBTyxLQUFLLGFBQUwsQ0FBbUIsS0FBSyxJQUFMLENBQVUsT0FBVixDQUFrQixLQUFsQixFQUF5QixLQUFLLElBQUwsQ0FBVSxVQUFWLEVBQXpCLENBQW5CLENBQVAsQ0FENEI7R0FBaEI7Ozs7OztBQVNkLGtCQUFnQix3QkFBUyxFQUFULEVBQWE7QUFDM0IsV0FBTyxLQUFLLElBQUwsQ0FBVSxTQUFWLENBQW9CLEtBQUssV0FBTCxDQUFpQixFQUFqQixDQUFwQixFQUEwQyxLQUFLLElBQUwsQ0FBVSxVQUFWLEVBQTFDLENBQVAsQ0FEMkI7R0FBYjs7Ozs7O0FBU2hCLGNBQVksb0JBQVUsT0FBVixFQUFtQjtBQUM3QixTQUFLLE9BQUwsQ0FBYSxPQUFiLEdBQXVCLE9BQXZCLENBRDZCO0FBRTdCLFNBQUssY0FBTCxHQUY2QjtBQUc3QixXQUFPLElBQVAsQ0FINkI7R0FBbkI7Ozs7OztBQVdaLG1CQUFpQix5QkFBUyxNQUFULEVBQWlCO0FBQ2hDLFFBQUksS0FBSyxLQUFLLGVBQUwsQ0FBcUIsT0FBTyxHQUFQLENBQTFCLENBRDRCO0FBRWhDLFFBQUksS0FBSyxLQUFLLGVBQUwsQ0FBcUIsT0FBTyxHQUFQLENBQTFCLENBRjRCO0FBR2hDLFdBQU8sRUFBRSxZQUFGLENBQWUsRUFBZixFQUFtQixFQUFuQixDQUFQLENBSGdDO0dBQWpCOzs7Ozs7O0FBWWpCLGlCQUFlLHVCQUFTLE1BQVQsRUFBaUI7QUFDOUIsV0FBTyxJQUFJLEVBQUUsTUFBRixDQUNULEtBQUssZUFBTCxDQUFxQixPQUFPLFlBQVAsRUFBckIsQ0FESyxFQUVMLEtBQUssZUFBTCxDQUFxQixPQUFPLFlBQVAsRUFBckIsQ0FGSyxDQUFQLENBRDhCO0dBQWpCOzs7OztBQVdmLFFBQU0sZ0JBQVc7QUFDZixTQUFLLE9BQUwsQ0FBYSxJQUFiLENBQWtCLEtBQUssSUFBTCxFQUFXLFVBQVMsR0FBVCxFQUFjLEdBQWQsRUFBbUI7QUFDOUMsVUFBSSxDQUFDLEdBQUQsRUFBTTtBQUNSLGFBQUssTUFBTCxDQUFZLEdBQVosRUFEUTtPQUFWO0tBRDJCLENBSTNCLElBSjJCLENBSXRCLElBSnNCLENBQTdCLEVBRGU7R0FBWDs7Ozs7O0FBYU4sU0FBTyxlQUFTLEdBQVQsRUFBYztBQUNuQixhQUFTLFNBQVQsQ0FBbUIsS0FBbkIsQ0FBeUIsSUFBekIsQ0FBOEIsSUFBOUIsRUFBb0MsR0FBcEMsRUFEbUI7O0FBR25CLFFBQ0csRUFESCxDQUNNLFNBRE4sRUFDaUIsS0FBSyxhQUFMLEVBQW9CLElBRHJDLEVBRUcsRUFGSCxDQUVNLFdBRk4sRUFFbUIsS0FBSyxVQUFMLEVBQWlCLElBRnBDLEVBR0csRUFISCxDQUdNLFNBSE4sRUFHaUIsS0FBSyxVQUFMLEVBQWlCLElBSGxDLEVBSUcsRUFKSCxDQUlNLGtCQUpOLEVBSTBCLEtBQUssTUFBTCxFQUFhLElBSnZDLEVBSG1COztBQVNuQixRQUFJLENBQUMsS0FBSyxJQUFMLEVBQVc7QUFDZCxXQUFLLElBQUwsR0FEYztLQUFoQixNQUVPO0FBQ0wsV0FBSyxNQUFMLENBQVksS0FBSyxJQUFMLENBQVosQ0FESztLQUZQO0FBS0EsV0FBTyxJQUFQLENBZG1CO0dBQWQ7Ozs7OztBQXNCUCxZQUFVLGtCQUFTLEdBQVQsRUFBYztBQUN0QixhQUFTLFNBQVQsQ0FBbUIsUUFBbkIsQ0FBNEIsSUFBNUIsQ0FBaUMsSUFBakMsRUFBdUMsR0FBdkMsRUFEc0I7QUFFdEIsUUFDRyxHQURILENBQ08sU0FEUCxFQUNrQixLQUFLLGFBQUwsRUFBb0IsSUFEdEMsRUFFRyxHQUZILENBRU8sV0FGUCxFQUVvQixLQUFLLFVBQUwsRUFBaUIsSUFGckMsRUFHRyxHQUhILENBR08sU0FIUCxFQUdrQixLQUFLLFVBQUwsRUFBaUIsSUFIbkMsRUFJRyxHQUpILENBSU8sa0JBSlAsRUFJMkIsS0FBSyxNQUFMLEVBQWEsSUFKeEMsRUFGc0I7QUFPdEIsV0FBTyxJQUFQLENBUHNCO0dBQWQ7Ozs7Ozs7QUFnQlYsYUFBVyxtQkFBUyxRQUFULEVBQW1CLE9BQW5CLEVBQTRCO0FBQ3JDLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsZUFBUyxJQUFULENBQWMsT0FBZCxFQURnQjtLQUFsQixNQUVPO0FBQ0wsV0FBSyxJQUFMLENBQVUsTUFBVixFQUFrQixRQUFsQixFQUE0QixPQUE1QixFQURLO0tBRlA7QUFLQSxXQUFPLElBQVAsQ0FOcUM7R0FBNUI7Ozs7OztBQWNYLFdBQVMsbUJBQVc7QUFDbEIsUUFBSSxNQUFNLElBQUksS0FBSixFQUFOOzs7QUFEYyxPQUlsQixDQUFJLEtBQUosQ0FBVSxLQUFWLEdBQWtCLEtBQUssS0FBTCxDQUFXLENBQVgsR0FBZSxJQUFmLENBSkE7QUFLbEIsUUFBSSxLQUFKLENBQVUsTUFBVixHQUFtQixLQUFLLEtBQUwsQ0FBVyxDQUFYLEdBQWUsSUFBZixDQUxEO0FBTWxCLFFBQUksR0FBSixHQUFVLEtBQUssUUFBTCxFQUFWLENBTmtCOztBQVFsQixRQUFJLFNBQVMsS0FBSyxPQUFMLElBQWdCLEVBQUUsT0FBRixDQUFVLE1BQVYsQ0FBaUIsUUFBakIsRUFBMkIsa0JBQTNCLENBQWhCLENBUks7QUFTbEIsUUFBSSxNQUFNLE9BQU8sVUFBUCxDQUFrQixJQUFsQixDQUFOLENBVGM7O0FBV2xCLE1BQUUsUUFBRixDQUFXLEVBQVgsQ0FBYyxHQUFkLEVBQW1CLE1BQW5CLEVBQTJCLFlBQVk7QUFDckMsVUFBSSxjQUFjLEVBQUUsS0FBRixDQUFRLElBQUksV0FBSixFQUFpQixJQUFJLFlBQUosQ0FBdkM7O0FBRGlDLFVBR3JDLENBQUssTUFBTCxHQUhxQztLQUFaLEVBSXhCLElBSkgsRUFYa0I7O0FBaUJsQixRQUFJLENBQUMsS0FBSyxPQUFMLEVBQWM7QUFDakIsV0FBSyxPQUFMLEdBQWUsTUFBZixDQURpQjtBQUVqQixXQUFLLFVBQUwsQ0FBZ0IsWUFBaEIsQ0FBNkIsTUFBN0IsRUFBcUMsS0FBSyxVQUFMLENBQWdCLFVBQWhCLENBQXJDLENBRmlCO0tBQW5CO0FBSUEsUUFBSSxLQUFKLENBQVUsT0FBVixHQUFvQixDQUFwQixDQXJCa0I7O0FBdUJsQixRQUFJLEtBQUssT0FBTCxFQUFjO0FBQ2hCLFdBQUssT0FBTCxDQUFhLFVBQWIsQ0FBd0IsV0FBeEIsQ0FBb0MsS0FBSyxPQUFMLENBQXBDLENBRGdCO0FBRWhCLFdBQUssT0FBTCxHQUFlLElBQWYsQ0FGZ0I7S0FBbEI7O0FBS0EsTUFBRSxPQUFGLENBQVUsUUFBVixDQUFtQixHQUFuQixFQUF3QixpQkFBeEIsRUE1QmtCO0FBNkJsQixTQUFLLFVBQUwsQ0FBZ0IsV0FBaEIsQ0FBNEIsR0FBNUIsRUE3QmtCO0FBOEJsQixTQUFLLE9BQUwsR0FBZSxHQUFmLENBOUJrQjtBQStCbEIsV0FBTyxJQUFQLENBL0JrQjtHQUFYOzs7Ozs7QUF1Q1QsWUFBVSxvQkFBVzs7QUFFbkIsUUFBSSxTQUFTLEtBQUssY0FBTCxJQUNYLElBQUksSUFBSixDQUFTLFNBQVMsbUJBQW1CLEtBQUssUUFBTCxDQUE1QixDQUFULENBRFcsQ0FGTTtBQUluQixTQUFLLGNBQUwsR0FBc0IsTUFBdEI7OztBQUptQixXQU9aLCtCQUErQixNQUEvQixDQVBZO0dBQVg7Ozs7O0FBY1YsZ0JBQWMsd0JBQVc7QUFDdkIsU0FBSyxNQUFMLEdBRHVCO0FBRXZCLGFBQVMsU0FBVCxDQUFtQixZQUFuQixDQUFnQyxJQUFoQyxDQUFxQyxJQUFyQyxFQUZ1QjtHQUFYOzs7Ozs7O0FBV2QsaUJBQWUsdUJBQVMsRUFBVCxFQUFhO0FBQzFCLFdBQU8sS0FBSyxlQUFMLENBQXFCLFNBQXJCLENBQ0wsS0FBSyxlQUFMLENBQXFCLFdBQXJCLENBQWlDLEVBQWpDLEVBQXFDLFFBQXJDLENBQThDLEtBQUssTUFBTCxDQUR6QyxDQUFQOzs7O0FBRDBCLEdBQWI7Ozs7Ozs7QUFjZixlQUFhLHFCQUFTLEVBQVQsRUFBYTtBQUN4QixXQUFPLEtBQUssZUFBTCxDQUFxQixTQUFyQixDQUNMLEtBQUssZUFBTCxDQUFxQixXQUFyQixDQUFpQyxFQUFqQyxFQUFxQyxVQUFyQyxDQUFnRCxLQUFLLE1BQUwsQ0FEM0MsQ0FBUDs7OztBQUR3QixHQUFiOzs7OztBQWFiLGVBQWEsdUJBQVk7QUFDdkIsUUFBSSxLQUFLLE9BQUwsRUFBYztBQUNoQixXQUFLLE9BQUwsQ0FBYSxLQUFiLENBQW1CLE9BQW5CLEdBQStCLE9BQS9CLENBRGdCO0FBRWhCLFdBQUssU0FBTCxDQUFlLEtBQWYsQ0FBcUIsT0FBckIsR0FBK0IsTUFBL0IsQ0FGZ0I7S0FBbEI7R0FEVzs7Ozs7QUFXYixlQUFhLHVCQUFZO0FBQ3ZCLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsV0FBSyxPQUFMLENBQWEsS0FBYixDQUFtQixPQUFuQixHQUErQixNQUEvQixDQURnQjtBQUVoQixXQUFLLFNBQUwsQ0FBZSxLQUFmLENBQXFCLE9BQXJCLEdBQStCLE9BQS9CLENBRmdCO0tBQWxCO0dBRFc7Ozs7OztBQVliLGNBQVksc0JBQVc7QUFDckIsUUFBSSxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQXdCO0FBQzFCLFdBQUssV0FBTCxHQUQwQjtLQUE1QjtHQURVOzs7OztBQVVaLGNBQVksc0JBQVc7QUFDckIsUUFBSSxLQUFLLE9BQUwsQ0FBYSxTQUFiLEVBQXdCO0FBQzFCLFdBQUssV0FBTCxHQUQwQjtLQUE1QjtHQURVOzs7OztBQVVaLGlCQUFlLHlCQUFXO0FBQ3hCLFFBQUksS0FBSyxPQUFMLENBQWEsU0FBYixFQUF3QjtBQUN6QixXQUFLLE9BQUwsR0FEeUI7QUFFekIsV0FBSyxXQUFMLEdBRnlCO0tBQTVCO0dBRGE7Ozs7O0FBV2Ysa0JBQWdCLDBCQUFXO0FBQ3pCLE1BQUUsT0FBRixDQUFVLFVBQVYsQ0FBcUIsS0FBSyxVQUFMLEVBQWlCLEtBQUssT0FBTCxDQUFhLE9BQWIsQ0FBdEMsQ0FEeUI7R0FBWDs7Ozs7OztBQVVoQixpQkFBZSx1QkFBUyxPQUFULEVBQWtCLElBQWxCLEVBQXdCO0FBQ3JDLFFBQUksS0FBSyxPQUFMLEVBQWM7QUFDaEIsVUFBSSxLQUFLLEtBQUssWUFBTCxFQUFMLENBRFk7QUFFaEIsVUFBSSxTQUFTLEtBQUssT0FBTCxDQUZHO0FBR2hCLFVBQUksTUFBTSxHQUFHLEdBQUgsQ0FITTtBQUloQixVQUFJLE1BQU0sR0FBRyxHQUFILENBSk07QUFLaEIsVUFBSSxRQUFRLElBQUksQ0FBSixHQUFRLElBQUksQ0FBSixDQUxKO0FBTWhCLFVBQUksU0FBUyxJQUFJLENBQUosR0FBUSxJQUFJLENBQUosQ0FOTDs7QUFRaEIsVUFBSSxNQUFNLFFBQVEsUUFBUixDQUFpQixHQUFqQixDQUFOLENBUlk7O0FBVWhCLGFBQU8sS0FBUCxHQUFlLEtBQWYsQ0FWZ0I7QUFXaEIsYUFBTyxNQUFQLEdBQWdCLE1BQWhCLENBWGdCOztBQWFoQixhQUFPLEtBQVAsQ0FBYSxLQUFiLEdBQXFCLFFBQVEsSUFBUixDQWJMO0FBY2hCLGFBQU8sS0FBUCxDQUFhLE1BQWIsR0FBc0IsU0FBUyxJQUFUOzs7O0FBZE4sVUFrQlosTUFBTSxPQUFPLFVBQVAsQ0FBa0IsSUFBbEIsQ0FBTixDQWxCWTtBQW1CaEIsUUFBRSxJQUFGLENBQU8sZ0JBQVAsQ0FBd0IsWUFBVztBQUNqQyxZQUFJLFNBQUosQ0FBYyxDQUFkLEVBQWlCLENBQWpCLEVBQW9CLEtBQXBCLEVBQTJCLE1BQTNCLEVBRGlDO0FBRWpDLFlBQUksU0FBSixDQUFjLEtBQUssT0FBTCxFQUFjLElBQUksQ0FBSixFQUFPLElBQUksQ0FBSixFQUFPLEtBQUssQ0FBTCxFQUFRLEtBQUssQ0FBTCxDQUFsRDs7Ozs7O0FBRmlDLE9BQVgsRUFRckIsSUFSSDs7O0FBbkJnQixLQUFsQjtHQURhOzs7OztBQXNDZixVQUFRLGtCQUFZO0FBQ2xCLFFBQUksUUFBVSxLQUFLLE1BQUwsQ0FESTtBQUVsQixRQUFJLFFBQVUsS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssSUFBTCxDQUFVLE9BQVYsS0FBc0IsQ0FBdEIsQ0FBWixHQUF1QyxLQUFLLE1BQUwsQ0FGbkM7QUFHbEIsUUFBSSxVQUFVLEtBQUssSUFBTCxDQUFVLGtCQUFWLENBQTZCLEtBQUssT0FBTCxDQUFhLFlBQWIsRUFBN0IsQ0FBVixDQUhjO0FBSWxCLFFBQUksT0FBVSxLQUFLLGVBQUwsR0FBdUIsVUFBdkIsQ0FBa0MsS0FBbEMsQ0FBVixDQUpjOztBQU1sQixRQUFJLEtBQUssT0FBTCxFQUFjOztBQUVoQixXQUFLLE9BQUwsQ0FBYSxLQUFiLENBQW1CLEtBQW5CLEdBQTJCLEtBQUssQ0FBTCxHQUFTLElBQVQsQ0FGWDtBQUdoQixXQUFLLE9BQUwsQ0FBYSxLQUFiLENBQW1CLE1BQW5CLEdBQTRCLEtBQUssQ0FBTCxHQUFTLElBQVQsQ0FIWjtBQUloQixRQUFFLE9BQUYsQ0FBVSxXQUFWLENBQXNCLEtBQUssT0FBTCxFQUFjLEtBQUssWUFBTCxHQUFvQixHQUFwQixDQUFwQyxDQUpnQjtLQUFsQjs7QUFPQSxRQUFJLEtBQUssT0FBTCxFQUFjO0FBQ2hCLFdBQUssYUFBTCxDQUFtQixPQUFuQixFQUE0QixJQUE1QixFQURnQjtBQUVoQixRQUFFLE9BQUYsQ0FBVSxXQUFWLENBQXNCLEtBQUssT0FBTCxFQUFjLEtBQUssWUFBTCxHQUFvQixHQUFwQixDQUFwQyxDQUZnQjtLQUFsQjs7QUFLQSxTQUFLLE1BQUwsQ0FBWSxZQUFaLENBQXlCLFdBQXpCLEVBQ0UsRUFBRSxPQUFGLENBQVUsZUFBVixDQUEwQixPQUExQixFQUFtQyxLQUFuQyxDQURGLEVBbEJrQjtHQUFaOztDQXRmTyxDQUFiOzs7QUErZ0JKLEVBQUUsVUFBRixHQUFlLFVBQWY7QUFDQSxFQUFFLFVBQUYsR0FBZSxVQUFTLEdBQVQsRUFBYyxPQUFkLEVBQXVCO0FBQ3BDLFNBQU8sSUFBSSxVQUFKLENBQWUsR0FBZixFQUFvQixPQUFwQixDQUFQLENBRG9DO0NBQXZCOztBQUlmLE9BQU8sT0FBUCxHQUFpQixVQUFqQjs7Ozs7Ozs7QUMzaEJBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBSjs7O0FBR0osSUFBSSx3QkFBd0IsTUFBeEIsRUFBZ0M7QUFDbEMsU0FBTyxjQUFQLENBQXNCLG1CQUFtQixTQUFuQixFQUE4QixXQUFwRCxFQUFpRTtBQUMvRCxTQUFLLGVBQVc7QUFDZCxhQUFPLEtBQUssb0JBQUwsQ0FBMEIsU0FBMUIsQ0FBb0MsT0FBcEMsQ0FETztLQUFYO0FBR0wsU0FBSyxhQUFTLEdBQVQsRUFBYztBQUNqQixXQUFLLG9CQUFMLENBQTBCLFNBQTFCLENBQW9DLE9BQXBDLEdBQThDLEdBQTlDLENBRGlCO0tBQWQ7R0FKUCxFQURrQztDQUFwQzs7Ozs7O0FBZ0JBLEVBQUUsT0FBRixDQUFVLE1BQVYsR0FBbUIsVUFBUyxDQUFULEVBQVc7QUFDNUIsU0FDRSxRQUFPLG1EQUFQLEtBQWdCLFFBQWhCLEdBQ0EsYUFBYSxJQUFiLEdBQ0EsS0FBSyxRQUFPLDZDQUFQLEtBQWEsUUFBYixJQUNMLE9BQU8sRUFBRSxRQUFGLEtBQWUsUUFBdEIsSUFDQSxPQUFPLEVBQUUsUUFBRixLQUFlLFFBQXRCLENBTjBCO0NBQVg7Ozs7OztBQWVuQixFQUFFLE9BQUYsQ0FBVSxVQUFWLEdBQXVCLFVBQVMsR0FBVCxFQUFjO0FBQ25DLE1BQUksVUFBVSxJQUFJLFlBQUosQ0FBaUIsU0FBakIsQ0FBVixDQUQrQjtBQUVuQyxNQUFJLElBQUosQ0FGbUM7QUFHbkMsTUFBSSxPQUFKLEVBQWE7QUFDWCxXQUFPLFFBQVEsS0FBUixDQUFjLEdBQWQsRUFBbUIsR0FBbkIsQ0FBdUIsVUFBdkIsQ0FBUCxDQURXO0dBQWIsTUFFTztBQUNMLFFBQUksUUFBUSxJQUFJLFNBQUosQ0FBYyxJQUFkLENBQVIsQ0FEQztBQUVMLGFBQVMsSUFBVCxDQUFjLFdBQWQsQ0FBMEIsS0FBMUIsRUFGSztBQUdMLFdBQU8sTUFBTSxPQUFOLEVBQVAsQ0FISztBQUlMLGFBQVMsSUFBVCxDQUFjLFdBQWQsQ0FBMEIsS0FBMUIsRUFKSztBQUtMLFdBQU8sQ0FBQyxLQUFLLENBQUwsRUFBUSxLQUFLLENBQUwsRUFDZCxTQUFTLElBQUksWUFBSixDQUFpQixPQUFqQixDQUFULEtBQXVDLElBQUksV0FBSixJQUFtQixLQUFLLEtBQUwsRUFDMUQsU0FBUyxJQUFJLFlBQUosQ0FBaUIsUUFBakIsQ0FBVCxLQUF3QyxJQUFJLFlBQUosSUFBb0IsS0FBSyxNQUFMLENBRjlELENBTEs7R0FGUDtBQVdBLFNBQU8sQ0FBQyxLQUFLLENBQUwsQ0FBRCxFQUFVLEtBQUssQ0FBTCxDQUFWLEVBQW1CLEtBQUssQ0FBTCxJQUFVLEtBQUssQ0FBTCxDQUFWLEVBQW1CLEtBQUssQ0FBTCxJQUFVLEtBQUssQ0FBTCxDQUFWLENBQTdDLENBZG1DO0NBQWQ7Ozs7OztBQXNCdkIsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLEdBQVQsRUFBYztBQUN4QyxNQUFJLFVBQVUsU0FBUyxhQUFULENBQXVCLEtBQXZCLENBQVYsQ0FEb0M7QUFFeEMsVUFBUSxTQUFSLEdBQW9CLEdBQXBCLENBRndDO0FBR3hDLFNBQU8sUUFBUSxhQUFSLENBQXNCLEtBQXRCLENBQVAsQ0FId0M7Q0FBZDs7Ozs7OztBQVk1QixFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBVixFQUFhLFVBQVUsQ0FBVixDQUFsQyxDQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRHRELENBRDhDO0NBQTNCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvc3Znb3ZlcmxheScpO1xuIiwiOyhmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBleHBvcnRzICE9ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IHRoaXM7IC8vICM4OiB3ZWIgd29ya2Vyc1xuICB2YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG4gIGZ1bmN0aW9uIEludmFsaWRDaGFyYWN0ZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yO1xuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuICAvLyBlbmNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS85OTkxNjZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vbmlnbmFnXVxuICBvYmplY3QuYnRvYSB8fCAoXG4gIG9iamVjdC5idG9hID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgICApIHtcbiAgICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMvNCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG4gIC8vIGRlY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwMjAzOTZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vYXRrXVxuICBvYmplY3QuYXRvYiB8fCAoXG4gIG9iamVjdC5hdG9iID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCkucmVwbGFjZSgvPSskLywgJycpO1xuICAgIGlmIChzdHIubGVuZ3RoICUgNCA9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2F0b2InIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBkZWNvZGVkIGlzIG5vdCBjb3JyZWN0bHkgZW5jb2RlZC5cIik7XG4gICAgfVxuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlcnNcbiAgICAgIHZhciBiYyA9IDAsIGJzLCBidWZmZXIsIGlkeCA9IDAsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gZ2V0IG5leHQgY2hhcmFjdGVyXG4gICAgICBidWZmZXIgPSBzdHIuY2hhckF0KGlkeCsrKTtcbiAgICAgIC8vIGNoYXJhY3RlciBmb3VuZCBpbiB0YWJsZT8gaW5pdGlhbGl6ZSBiaXQgc3RvcmFnZSBhbmQgYWRkIGl0cyBhc2NpaSB2YWx1ZTtcbiAgICAgIH5idWZmZXIgJiYgKGJzID0gYmMgJSA0ID8gYnMgKiA2NCArIGJ1ZmZlciA6IGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGlmIG5vdCBmaXJzdCBvZiBlYWNoIDQgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gY29udmVydCB0aGUgZmlyc3QgOCBiaXRzIHRvIG9uZSBhc2NpaSBjaGFyYWN0ZXJcbiAgICAgICAgYmMrKyAlIDQpID8gb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjU1ICYgYnMgPj4gKC0yICogYmMgJiA2KSkgOiAwXG4gICAgKSB7XG4gICAgICAvLyB0cnkgdG8gZmluZCBjaGFyYWN0ZXIgaW4gdGFibGUgKDAtNjMsIG5vdCBmb3VuZCA9PiAtMSlcbiAgICAgIGJ1ZmZlciA9IGNoYXJzLmluZGV4T2YoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbn0oKSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMubWluLngsIHRoaXMubWluLnksIHRoaXMubWF4LngsIHRoaXMubWF4LnldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuQm91bmRzfVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbWF4ID0gdGhpcy5tYXg7XG4gIHZhciBtaW4gPSB0aGlzLm1pbjtcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChtYXgueSAtIG1pbi55KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXG4gICAgW21pbi54IC0gZGVsdGFYLCBtaW4ueSAtIGRlbHRhWV0sXG4gICAgW21heC54ICsgZGVsdGFYLCBtYXgueSArIGRlbHRhWV1cbiAgXSk7XG59O1xuXG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XG4gIHZhciBkZWx0YVggPSAoKG5lLmxuZyAtIHN3LmxuZykgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5DbGFzcy5leHRlbmQoe1xuXG4gIGluY2x1ZGVzOiBMLk1peGluLkV2ZW50cyxcblxuICBvcHRpb25zOiB7XG4gICAgb3BhY2l0eTogMSxcbiAgICBwYWRkaW5nOiBMLlBhdGguQ0xJUF9QQURESU5HXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBTdmdMYXllciAtIGJhc2ljYWxseSwganVzdCB0aGUgU1ZHIGNvbnRhaW5lciBzaW1pYXIgdG8gdGhlIG9uZVxuICAgKiB1c2VkIGJ5IGxlYWZsZXQgaW50ZXJuYWxseSB0byByZW5kZXIgdmVjdG9yIGxheWVyc1xuICAgKlxuICAgKiBAZXh0ZW5kcyB7TC5DbGFzc31cbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdD19IG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9jb250YWluZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoUm9vdCAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5NYXB9XG4gICAgICovXG4gICAgdGhpcy5fbWFwID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhWaWV3cG9ydCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGhab29taW5nID0gZmFsc2U7XG5cbiAgICBMLlV0aWwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMuX21hcCA9IG1hcDtcbiAgICB0aGlzLl9pbml0UGF0aFJvb3QoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBhZGRUbzogZnVuY3Rpb24obWFwKSB7XG4gICAgbWFwLmFkZExheWVyKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U3ZnTGF5ZXJ9XG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgaWYgKHRoaXMuX21hcC5vcHRpb25zLnpvb21BbmltYXRpb24gJiYgTC5Ccm93c2VyLmFueTNkKSB7XG4gICAgICB0aGlzLl9tYXAub2ZmKHtcbiAgICAgICAgJ3pvb21hbmltJzogdGhpcy5fYW5pbWF0ZVBhdGhab29tLFxuICAgICAgICAnem9vbWVuZCc6IHRoaXMuX2VuZFBhdGhab29tXG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXAub2ZmKCdtb3ZlZW5kJywgdGhpcy5fdXBkYXRlU3ZnVmlld3BvcnQsIHRoaXMpO1xuICAgIHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lLnJlbW92ZUNoaWxkKHRoaXMuX2NvbnRhaW5lcik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIHJlbW92ZUZyb206IGZ1bmN0aW9uKG1hcCkge1xuICAgIG1hcC5yZW1vdmVMYXllcih0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTdmdMYXllcn1cbiAgICovXG4gIGJyaW5nVG9Gcm9udDogZnVuY3Rpb24gKCkge1xuICAgIHZhciByb290ID0gdGhpcy5fcGF0aFJvb3QucGFyZW50Tm9kZSxcbiAgICAgICAgcGF0aCA9IHRoaXMuX3BhdGhSb290O1xuXG4gICAgaWYgKHBhdGggJiYgcm9vdC5sYXN0Q2hpbGQgIT09IHBhdGgpIHtcbiAgICAgIHJvb3QuYXBwZW5kQ2hpbGQocGF0aCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N2Z0xheWVyfVxuICAgKi9cbiAgYnJpbmdUb0JhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcm9vdCA9IHRoaXMuX3BhdGhSb290LnBhcmVudE5vZGU7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoUm9vdDtcbiAgICB2YXIgZmlyc3QgPSByb290LmZpcnN0Q2hpbGQ7XG5cbiAgICBpZiAocGF0aCAmJiBmaXJzdCAhPT0gcGF0aCkge1xuICAgICAgcm9vdC5pbnNlcnRCZWZvcmUocGF0aCwgZmlyc3QpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgc3ZnIHJvb3RcbiAgICovXG4gIF9jcmVhdGVSb290OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoUm9vdCA9IEwuUGF0aC5wcm90b3R5cGUuX2NyZWF0ZUVsZW1lbnQoJ3N2ZycpO1xuICAgIHRoaXMuX2NvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICdsZWFmbGV0LWltYWdlLWxheWVyJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3BhdGhSb290KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJbml0IHRoZSByb290IGVsZW1lbnRcbiAgICovXG4gIF9pbml0UGF0aFJvb3Q6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuX3BhdGhSb290KSB7XG4gICAgICB0aGlzLl9jcmVhdGVSb290KCk7XG4gICAgICB0aGlzLl9tYXAuZ2V0UGFuZXMoKS5vdmVybGF5UGFuZS5hcHBlbmRDaGlsZCh0aGlzLl9jb250YWluZXIpO1xuXG4gICAgICBpZiAodGhpcy5fbWFwLm9wdGlvbnMuem9vbUFuaW1hdGlvbiAmJiBMLkJyb3dzZXIuYW55M2QpIHtcbiAgICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGhSb290LCAnbGVhZmxldC16b29tLWFuaW1hdGVkJyk7XG5cbiAgICAgICAgdGhpcy5fbWFwLm9uKHtcbiAgICAgICAgICAnem9vbWFuaW0nOiB0aGlzLl9hbmltYXRlUGF0aFpvb20sXG4gICAgICAgICAgJ3pvb21lbmQnOiB0aGlzLl9lbmRQYXRoWm9vbVxuICAgICAgICB9LCB0aGlzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoUm9vdCwgJ2xlYWZsZXQtem9vbS1oaWRlJyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX21hcC5vbignbW92ZWVuZCcsIHRoaXMuX3VwZGF0ZVN2Z1ZpZXdwb3J0LCB0aGlzKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVN2Z1ZpZXdwb3J0KCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvIG92ZXJyaWRlIGluIHRoZSBjaGlsZCBjbGFzc2VzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgX2dldFZpZXdwb3J0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aFZpZXdwb3J0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSByb290IHBvc2l0aW9uIHRvIGdldCB0aGUgdmlld3BvcnQgY292ZXJlZFxuICAgKi9cbiAgX3VwZGF0ZUNvbnRlbnRWaWV3cG9ydDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBwID0gdGhpcy5vcHRpb25zLnBhZGRpbmc7XG4gICAgdmFyIHNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuICAgIHZhciBwYW5lUG9zID0gTC5Eb21VdGlsLmdldFBvc2l0aW9uKHRoaXMuX21hcC5fbWFwUGFuZSk7XG4gICAgdmFyIG1pbiA9IHBhbmVQb3MubXVsdGlwbHlCeSgtMSkuX3N1YnRyYWN0KHNpemUubXVsdGlwbHlCeShwKS5fcm91bmQoKSk7XG4gICAgdmFyIG1heCA9IG1pbi5hZGQoc2l6ZS5tdWx0aXBseUJ5KDEgKyBwICogMikuX3JvdW5kKCkpO1xuXG4gICAgdGhpcy5fcGF0aFZpZXdwb3J0ID0gbmV3IEwuQm91bmRzKFttaW4ueCwgbWluLnldLCBbbWF4LngsIG1heC55XSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Wm9vbUV2ZW50fSBlXG4gICAqL1xuICBfYW5pbWF0ZVBhdGhab29tOiBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBzY2FsZSA9IHRoaXMuX21hcC5nZXRab29tU2NhbGUoZS56b29tKTtcbiAgICB2YXIgb2Zmc2V0ID0gdGhpcy5fbWFwXG4gICAgICAuX2dldENlbnRlck9mZnNldChlLmNlbnRlcilcbiAgICAgIC5fbXVsdGlwbHlCeSgtc2NhbGUpXG4gICAgICAuX2FkZCh0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbik7XG5cbiAgICB0aGlzLl9wYXRoUm9vdC5zdHlsZVtMLkRvbVV0aWwuVFJBTlNGT1JNXSA9XG4gICAgICBMLkRvbVV0aWwuZ2V0VHJhbnNsYXRlU3RyaW5nKG9mZnNldCkgKyAnIHNjYWxlKCcgKyBzY2FsZSArICcpICc7XG5cbiAgICB0aGlzLl9wYXRoWm9vbWluZyA9IHRydWU7XG4gIH0sXG5cblxuICAvKipcbiAgICogSGVyZSB3ZSBjYW4gZG8gYWRkaXRpb25hbCBwb3N0LWFuaW1hdGlvbiB0cmFuc2Zvcm1zXG4gICAqL1xuICBfZW5kUGF0aFpvb206IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLl9wYXRoWm9vbWluZyA9IGZhbHNlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGx5IHRoZSB2aWV3cG9ydCBjb3JyZWN0aW9uXG4gICAqL1xuICBfdXBkYXRlU3ZnVmlld3BvcnQ6IGZ1bmN0aW9uICgpIHtcblxuICAgIGlmICh0aGlzLl9wYXRoWm9vbWluZykge1xuICAgICAgLy8gRG8gbm90IHVwZGF0ZSBTVkdzIHdoaWxlIGEgem9vbSBhbmltYXRpb24gaXMgZ29pbmcgb25cbiAgICAgIC8vIG90aGVyd2lzZSB0aGUgYW5pbWF0aW9uIHdpbGwgYnJlYWsuXG4gICAgICAvLyBXaGVuIHRoZSB6b29tIGFuaW1hdGlvbiBlbmRzIHdlIHdpbGwgYmUgdXBkYXRlZCBhZ2FpbiBhbnl3YXlcbiAgICAgIC8vIFRoaXMgZml4ZXMgdGhlIGNhc2Ugd2hlcmUgeW91IGRvIGEgbW9tZW50dW0gbW92ZSBhbmRcbiAgICAgIC8vIHpvb20gd2hpbGUgdGhlIG1vdmUgaXMgc3RpbGwgb25nb2luZy5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl91cGRhdGVDb250ZW50Vmlld3BvcnQoKTtcblxuICAgIHZhciB2cCAgICAgPSB0aGlzLl9nZXRWaWV3cG9ydCgpO1xuICAgIHZhciBtaW4gICAgPSB2cC5taW47XG4gICAgdmFyIG1heCAgICA9IHZwLm1heDtcbiAgICB2YXIgd2lkdGggID0gbWF4LnggLSBtaW4ueDtcbiAgICB2YXIgaGVpZ2h0ID0gbWF4LnkgLSBtaW4ueTtcbiAgICB2YXIgcm9vdCAgID0gdGhpcy5fcGF0aFJvb3Q7XG4gICAgdmFyIHBhbmUgICA9IHRoaXMuX21hcC5nZXRQYW5lcygpLm92ZXJsYXlQYW5lO1xuXG4gICAgLy8gSGFjayB0byBtYWtlIGZsaWNrZXIgb24gZHJhZyBlbmQgb24gbW9iaWxlIHdlYmtpdCBsZXNzIGlycml0YXRpbmdcbiAgICBpZiAoTC5Ccm93c2VyLm1vYmlsZVdlYmtpdCkge1xuICAgICAgdGhpcy5fY29udGFpbmVyLnJlbW92ZUNoaWxkKHJvb3QpO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9wYXRoUm9vdCwgbWluKTtcbiAgICByb290LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCB3aWR0aCk7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIGhlaWdodCk7XG4gICAgcm9vdC5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBbbWluLngsIG1pbi55LCB3aWR0aCwgaGVpZ2h0XS5qb2luKCcgJykpO1xuXG4gICAgaWYgKEwuQnJvd3Nlci5tb2JpbGVXZWJraXQpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChyb290KTtcbiAgICB9XG4gIH1cblxufSk7XG4iLCJ2YXIgTCAgICAgICAgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgU3ZnTGF5ZXIgPSByZXF1aXJlKCcuL3N2Z2xheWVyJyk7XG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcblxucmVxdWlyZSgnLi9ib3VuZHMnKTtcbnJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIFNWR092ZXJsYXkgPSBTdmdMYXllci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjI1LFxuICAgIG9wYWNpdHk6IDEsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgICAvLyBsb2FkOiBmdW5jdGlvbih1cmwsIGNhbGxiYWNrKSB7fVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7U3ZnTGF5ZXJ9XG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyAgICA9IHN2ZztcblxuICAgIGlmICghKGJvdW5kcyBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSkge1xuICAgICAgb3B0aW9ucyA9IGJvdW5kcztcbiAgICAgIGJvdW5kcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXMgPSBudWxsO1xuXG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHJldHVybiBuZXcgTC5Qb2ludChcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcbiAgICAgIE1hdGguYWJzKGJib3hbMV0gLSBiYm94WzNdKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU1ZHIGlzIHJlYWR5XG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxuICAgKi9cbiAgb25Mb2FkOiBmdW5jdGlvbihzdmcpIHtcbiAgICB0aGlzLl9yYXdEYXRhID0gc3ZnO1xuICAgIHN2ZyA9IEwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIoc3ZnKTtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChzdmcpO1xuICAgIHZhciBtaW5ab29tID0gdGhpcy5fbWFwLmdldE1pblpvb20oKTtcblxuICAgIGlmIChzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ21pc3NpbmcnLCBiYm94KTtcbiAgICAgIHRoaXMuX3Jhd0RhdGEgPSB0aGlzLl9yYXdEYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIGJib3guam9pbignICcpICtcbiAgICAgICAgJ1wiIHByZXNlcnZlQXNwZWN0UmF0aW89XCJ4TWF4WU1heFwiICcpO1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgZWRnZXMgb2YgdGhlIGltYWdlLCBpbiBjb29yZGluYXRlIHNwYWNlXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFswXSwgYmJveFszXV0sIG1pblpvb20pLFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFsyXSwgYmJveFsxXV0sIG1pblpvb20pXG4gICAgKTtcblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICB2YXIgbWFwU2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG5cbiAgICBpZiAoc2l6ZS55ICE9PSBtYXBTaXplLnkpIHtcbiAgICAgIHZhciByYXRpbyA9IE1hdGgubWluKG1hcFNpemUueCAvIHNpemUueCwgbWFwU2l6ZS55IC8gc2l6ZS55KTtcbiAgICAgIHRoaXMuX2JvdW5kcyA9IHRoaXMuX2JvdW5kcy5zY2FsZShyYXRpbyk7XG4gICAgICB0aGlzLl9yYXRpbyA9IHJhdGlvO1xuICAgIH1cblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcblxuICAgIHRoaXMuX2dyb3VwID0gTC5QYXRoLnByb3RvdHlwZS5fY3JlYXRlRWxlbWVudCgnZycpO1xuICAgIGlmIChMLkJyb3dzZXIuaWUpIHsgLy8gaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFXG4gICAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICAgIGRvIHtcbiAgICAgICAgdGhpcy5fZ3JvdXAuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgICBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgfSB3aGlsZShjaGlsZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2dyb3VwLmlubmVySFRNTCA9IHN2Zy5pbm5lckhUTUw7XG4gICAgfVxuICAgIHRoaXMuX3BhdGhSb290LmFwcGVuZENoaWxkKHRoaXMuX2dyb3VwKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuICAgIHRoaXMuX29uTWFwWm9vbUVuZCgpO1xuICAgIHRoaXMuX3Jlc2V0KCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICBnZXRCb3VuZHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ib3VuZHM7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Vuc2NhbGVQb2ludCh0aGlzLl9tYXAucHJvamVjdChjb29yZCwgdGhpcy5fbWFwLmdldE1pblpvb20oKSkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcC51bnByb2plY3QodGhpcy5fc2NhbGVQb2ludChwdCksIHRoaXMuX21hcC5nZXRNaW5ab29tKCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcGFjaXR5XG4gICAqIEByZXR1cm4ge1NWR0xheWVyfVxuICAgKi9cbiAgc2V0T3BhY2l0eTogZnVuY3Rpb24gKG9wYWNpdHkpIHtcbiAgICB0aGlzLm9wdGlvbnMub3BhY2l0eSA9IG9wYWNpdHk7XG4gICAgdGhpcy5fdXBkYXRlT3BhY2l0eSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5taW4pO1xuICAgIHZhciBuZSA9IHRoaXMucG9pbnRUb01hcENvb3JkKGJvdW5kcy5tYXgpO1xuICAgIHJldHVybiBMLmxhdExuZ0JvdW5kcyhzdywgbmUpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBsYXllckJvdW5kcyB0byBzY2hlbWF0aWMgYmJveFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgcHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgcmV0dXJuIG5ldyBMLkJvdW5kcyhcbiAgICAgIHRoaXMubWFwQ29vcmRUb1BvaW50KGJvdW5kcy5nZXRTb3V0aFdlc3QoKSksXG4gICAgICB0aGlzLm1hcENvb3JkVG9Qb2ludChib3VuZHMuZ2V0Tm9ydGhFYXN0KCkpXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxuICAgKi9cbiAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5vbkxvYWQoc3ZnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7U1ZHT3ZlcmxheX1cbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBTdmdMYXllci5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgbWFwXG4gICAgICAub24oJ3pvb21lbmQnLCB0aGlzLl9vbk1hcFpvb21FbmQsIHRoaXMpXG4gICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vbigndmllcmVzZXQgbW92ZWVuZCcsIHRoaXMuX3Jlc2V0LCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5fc3ZnKSB7XG4gICAgICB0aGlzLmxvYWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtTVkdPdmVybGF5fVxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgbWFwXG4gICAgICAub2ZmKCd6b29tZW5kJywgdGhpcy5fb25NYXBab29tRW5kLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ3N0YXJ0JywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgLm9mZignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcylcbiAgICAgIC5vZmYoJ3ZpZXJlc2V0IG1vdmVlbmQnLCB0aGlzLl9yZXNldCwgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAgeyo9fSAgICAgICBjb250ZXh0XG4gICAqIEByZXR1cm4ge1NWR092ZXJsYXl9XG4gICAqL1xuICB3aGVuUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuX2JvdW5kcykge1xuICAgICAgY2FsbGJhY2suY2FsbChjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbmNlKCdsb2FkJywgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSYXN0ZXJpemVzIHRoZSBzY2hlbWF0aWNcbiAgICogQHJldHVybiB7U2NoZW1hdGljfVxuICAgKi9cbiAgdG9JbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggPSB0aGlzLl9zaXplLnggKyAncHgnO1xuICAgIGltZy5zdHlsZS5oZWlnaHQgPSB0aGlzLl9zaXplLnkgKyAncHgnO1xuICAgIGltZy5zcmMgPSB0aGlzLnRvQmFzZTY0KCk7XG5cbiAgICB2YXIgY2FudmFzID0gdGhpcy5fY2FudmFzIHx8IEwuRG9tVXRpbC5jcmVhdGUoJ2NhbnZhcycsICdzY2hlbWF0aWMtY2FudmFzJyk7XG4gICAgdmFyIGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5hdHVyYWxTaXplID0gTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgLy9jb25zb2xlLmxvZygnbmF0dXJhbCcsIG5hdHVyYWxTaXplKTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICBpZiAoIXRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzID0gY2FudmFzO1xuICAgICAgdGhpcy5fY29udGFpbmVyLmluc2VydEJlZm9yZShjYW52YXMsIHRoaXMuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgaW1nLnN0eWxlLm9wYWNpdHkgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZChpbWcpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vY29uc29sZS50aW1lKCdiYXNlNjQnKTtcbiAgICB2YXIgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Jhd0RhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvL2NvbnNvbGUudGltZUVuZCgnYmFzZTY0Jyk7XG5cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBXZSBuZWVkIHRvIHJlZHJhdyBvbiB6b29tIGVuZFxuICAgKi9cbiAgX2VuZFBhdGhab29tOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9yZXNldCgpO1xuICAgIFN2Z0xheWVyLnByb3RvdHlwZS5fZW5kUGF0aFpvb20uY2FsbCh0aGlzKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IEZST00gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3Vuc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gICAgLy8gc2FtZSBhcyBhYm92ZSwgYnV0IG5vdCB1c2luZyB0cmFuc2Zvcm0gbWF0cml4XG4gICAgLy9yZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAubXVsdGlwbHlCeSgxLyB0aGlzLl9yYXRpbykuYWRkKHRoaXMuX29yaWdpbik7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXG4gICAgKTtcbiAgICAvLyBlcXVhbHMgdG9cbiAgICAvLyByZXR1cm4gcHQuc3VidHJhY3QodGhpcy5fb3JpZ2luKVxuICAgIC8vICAgLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pLmFkZCh0aGlzLl9vcmlnaW4pO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xuICAgKi9cbiAgX3Nob3dSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9jYW52YXMuc3R5bGUuZGlzcGxheSAgID0gJ2Jsb2NrJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN3YXAgYmFjayB0byBTVkdcbiAgICovXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdGhpcy5fY2FudmFzLnN0eWxlLmRpc3BsYXkgICA9ICdub25lJztcbiAgICAgIHRoaXMuX3BhdGhSb290LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZS1yZW5kZXIgY2FudmFzIG9uIHpvb21lbmRcbiAgICovXG4gIF9vbk1hcFpvb21FbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICAgdGhpcy50b0ltYWdlKCk7XG4gICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXRzIGNvbmF0aW5lciBvcGFjaXR5XG4gICAqL1xuICBfdXBkYXRlT3BhY2l0eTogZnVuY3Rpb24oKSB7XG4gICAgTC5Eb21VdGlsLnNldE9wYWNpdHkodGhpcy5fY29udGFpbmVyLCB0aGlzLm9wdGlvbnMub3BhY2l0eSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IHNoaWZlZCBjYW52YXNcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gdG9wTGVmdFxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBzaXplXG4gICAqL1xuICBfcmVkcmF3Q2FudmFzOiBmdW5jdGlvbih0b3BMZWZ0LCBzaXplKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykge1xuICAgICAgdmFyIHZwID0gdGhpcy5fZ2V0Vmlld3BvcnQoKTtcbiAgICAgIHZhciBjYW52YXMgPSB0aGlzLl9jYW52YXM7XG4gICAgICB2YXIgbWluID0gdnAubWluO1xuICAgICAgdmFyIG1heCA9IHZwLm1heDtcbiAgICAgIHZhciB3aWR0aCA9IG1heC54IC0gbWluLng7XG4gICAgICB2YXIgaGVpZ2h0ID0gbWF4LnkgLSBtaW4ueTtcblxuICAgICAgdmFyIHBvcyA9IHRvcExlZnQuc3VidHJhY3QobWluKTtcblxuICAgICAgY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICBjYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXG4gICAgICBjYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gICAgICBjYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgLy8gY29uc29sZS5sb2cod2lkdGgsIGhlaWdodCwgc2l6ZS54LCBzaXplLnkpO1xuXG4gICAgICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJylcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICBjdHguZHJhd0ltYWdlKHRoaXMuX3Jhc3RlciwgcG9zLngsIHBvcy55LCBzaXplLngsIHNpemUueSk7XG5cbiAgICAgICAgLy8gY3R4LnJlY3QocG9zLngsIHBvcy55LCBzaXplLngsIHNpemUueSk7XG4gICAgICAgIC8vIGN0eC5zdHJva2VTdHlsZSA9ICdyZWQnO1xuICAgICAgICAvLyBjdHgubGluZVdpZHRoID0gMC4xO1xuICAgICAgICAvLyBjdHguc3Ryb2tlKCk7XG4gICAgICB9LCB0aGlzKTtcblxuICAgICAgLy90aGlzLl9wYXRoUm9vdC5zdHlsZS5vcGFjaXR5ID0gMC41O1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZWRyYXcgLSBjb21wZW5zYXRlIHRoZSBwb3NpdGlvbiBhbmQgc2NhbGVcbiAgICovXG4gIF9yZXNldDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBpbWFnZSAgID0gdGhpcy5fZ3JvdXA7XG4gICAgdmFyIHNjYWxlICAgPSBNYXRoLnBvdygyLCB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gMSkgKiB0aGlzLl9yYXRpbztcbiAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICB2YXIgc2l6ZSAgICA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG5cbiAgICBpZiAodGhpcy5fcmFzdGVyKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKHNpemUsIHNjYWxlKTtcbiAgICAgIHRoaXMuX3Jhc3Rlci5zdHlsZS53aWR0aCA9IHNpemUueCArICdweCc7XG4gICAgICB0aGlzLl9yYXN0ZXIuc3R5bGUuaGVpZ2h0ID0gc2l6ZS55ICsgJ3B4JztcbiAgICAgIEwuRG9tVXRpbC5zZXRQb3NpdGlvbih0aGlzLl9yYXN0ZXIsIHRoaXMuX2dldFZpZXdwb3J0KCkubWluKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FudmFzKSB7XG4gICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2l6ZSk7XG4gICAgICBMLkRvbVV0aWwuc2V0UG9zaXRpb24odGhpcy5fY2FudmFzLCB0aGlzLl9nZXRWaWV3cG9ydCgpLm1pbik7XG4gICAgfVxuXG4gICAgdGhpcy5fZ3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0LCBzY2FsZSkpO1xuICB9XG5cbn0pO1xuXG4vLyBleHBvcnRcbkwuU1ZHT3ZlcmxheSA9IFNWR092ZXJsYXk7XG5MLnN2Z092ZXJsYXkgPSBmdW5jdGlvbihzdmcsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBTVkdPdmVybGF5KHN2Zywgb3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNWR092ZXJsYXk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLy8gPHVzZT4gdGFncyBhcmUgYnJva2VuIGluIElFIGluIHNvIG1hbnkgd2F5c1xuaWYgKCdTVkdFbGVtZW50SW5zdGFuY2UnIGluIGdsb2JhbCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgTm9kZSA9PT0gJ29iamVjdCcgP1xuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcbiAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICApO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XG4gIHZhciB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICB2YXIgYmJveDtcbiAgaWYgKHZpZXdCb3gpIHtcbiAgICBiYm94ID0gdmlld0JveC5zcGxpdCgnICcpLm1hcChwYXJzZUZsb2F0KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgIGJib3ggPSBjbG9uZS5nZXRCQm94KCk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgYmJveCA9IFtiYm94LngsIGJib3gueSxcbiAgICAgIHBhcnNlSW50KHN2Zy5nZXRBdHRyaWJ1dGUoJ3dpZHRoJykpIHx8IHN2Zy5vZmZzZXRXaWR0aCB8fCBiYm94LndpZHRoLFxuICAgICAgcGFyc2VJbnQoc3ZnLmdldEF0dHJpYnV0ZSgnaGVpZ2h0JykpIHx8IHN2Zy5vZmZzZXRIZWlnaHQgfHwgYmJveC5oZWlnaHRdO1xuICB9XG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gZnVuY3Rpb24odHJhbnNsYXRlLCBzY2FsZSkge1xuICByZXR1cm4gJ21hdHJpeCgnICtcbiAgICBbc2NhbGUsIDAsIDAsIHNjYWxlLCB0cmFuc2xhdGUueCwgdHJhbnNsYXRlLnldLmpvaW4oJywnKSArICcpJztcbn07XG4iXX0=
