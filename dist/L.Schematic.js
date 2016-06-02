(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).Schematic = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = require('./src/schematic');

},{"./src/schematic":5}],2:[function(require,module,exports){
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

/**
 * @class L.SchematicRenderer
 * @param  {Object}
 * @extends {L.SVG}
 */
L.SchematicRenderer = module.exports = L.SVG.extend({

  options: {
    padding: 0.3,
    useRaster: L.Browser.ie
  },

  /**
   * Create additional containers for the vector features to be
   * transformed to live in the schematic space
   */
  _initContainer: function _initContainer() {
    L.SVG.prototype._initContainer.call(this);

    this._rootInvertGroup = L.SVG.create('g');
    this._container.appendChild(this._rootInvertGroup);
    this._rootInvertGroup.appendChild(this._rootGroup);

    L.DomUtil.addClass(this._container, 'schematics-renderer');
  },

  /**
   * Make sure layers are not clipped
   * @param  {L.Layer}
   */
  _initPath: function _initPath(layer) {
    layer.options.noClip = true;
    L.SVG.prototype._initPath.call(this, layer);
  },

  /**
   * Update call on resize, redraw, zoom change
   */
  _update: function _update() {
    L.SVG.prototype._update.call(this);

    var schematic = this.options.schematic;
    var map = this._map;

    if (map && schematic._bounds && this._rootInvertGroup) {
      var topLeft = map.latLngToLayerPoint(schematic._bounds.getNorthWest());
      var scale = schematic._ratio * map.options.crs.scale(map.getZoom() - schematic.options.zoomOffset);

      this._topLeft = topLeft;
      this._scale = scale;

      // compensate viewbox dismissal with a shift here
      this._rootGroup.setAttribute('transform', L.DomUtil.getMatrixString(topLeft, scale));

      this._rootInvertGroup.setAttribute('transform', L.DomUtil.getMatrixString(topLeft.multiplyBy(-1 / scale), 1 / scale));
    }
  },

  /**
   * 1. wrap markup in another <g>
   * 2. create a clipPath with the viewBox rect
   * 3. apply it to the <g> around all markups
   * 4. remove group around schematic
   * 5. remove inner group around markups
   *
   * @param {Boolean=} onlyOverlays
   * @return {SVGElement}
   */
  exportSVG: function exportSVG(onlyOverlays) {
    var schematic = this.options.schematic;

    // go through every layer and make sure they're not clipped
    var svg = this._container.cloneNode(true);

    var clipPath = L.SVG.create('clipPath');
    var clipRect = L.SVG.create('rect');
    var clipGroup = svg.lastChild;
    var baseContent = svg.querySelector('.svg-overlay');
    var defs = baseContent.querySelector('defs');

    clipRect.setAttribute('x', schematic._bbox[0]);
    clipRect.setAttribute('y', schematic._bbox[1]);
    clipRect.setAttribute('width', schematic._bbox[2]);
    clipRect.setAttribute('height', schematic._bbox[3]);
    clipPath.appendChild(clipRect);

    var clipId = 'viewboxClip-' + L.Util.stamp(schematic._group);
    clipPath.setAttribute('id', clipId);

    if (!defs || onlyOverlays) {
      defs = L.SVG.create('defs');
      svg.appendChild(defs);
    }
    defs.appendChild(clipPath);
    clipGroup.setAttribute('clip-path', 'url(#' + clipId + ')');

    clipGroup.firstChild.setAttribute('transform', L.DomUtil.getMatrixString(this._topLeft.multiplyBy(-1 / this._scale).add(schematic._viewBoxOffset), 1 / this._scale));
    clipGroup.removeAttribute('transform');
    svg.querySelector('.svg-overlay').removeAttribute('transform');
    L.DomUtil.addClass(clipGroup, 'clip-group');

    svg.style.transform = '';
    svg.setAttribute('viewBox', schematic._bbox.join(' '));

    if (onlyOverlays) {
      // leave only markups
      baseContent.parentNode.removeChild(baseContent);
    }

    var div = L.DomUtil.create('div', '');
    // put container around the contents as it was
    div.innerHTML = /(\<svg\s+([^>]*)\>)/gi.exec(schematic._rawData)[0] + '</svg>';

    L.SVG.copySVGContents(svg, div.firstChild);

    return div.firstChild;
  }

});

/**
 * @param  {Object}
 * @return {L.SchematicRenderer}
 */
L.schematicRenderer = module.exports.schematicRenderer = function (options) {
  return new L.SchematicRenderer(options);
};

},{"leaflet":undefined}],5:[function(require,module,exports){
'use strict';

var L = require('leaflet');
var b64 = require('Base64');
var Renderer = require('./renderer');

require('./bounds');
require('./utils');

/**
 * Schematic layer to work with SVG schematics or blueprints in Leaflet
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 * @class Schematic
 * @extends {L.Rectangle}
 */
L.Schematic = module.exports = L.Rectangle.extend({

  options: {
    opacity: 0,
    fillOpacity: 0,
    weight: 1,
    adjustToScreen: true,

    // hardcode zoom offset to snap to some level
    zoomOffset: 0,
    interactive: false,
    useRaster: L.Browser.ie
  },

  /**
   * @constructor
   * @param  {String}         svg     SVG string or URL
   * @param  {L.LatLngBounds} bounds
   * @param  {Object=}        options
   */
  initialize: function initialize(svg, bounds, options) {

    /**
     * @type {String}
     */
    this._svg = svg;

    /**
     * Initial svg width, cause we will have to get rid of that to maintain
     * the aspect ratio
     *
     * @type {String}
     */
    this._initialWidth = '';

    /**
     * Initial svg height
     * @type {String}
     */
    this._initialHeight = '';

    if (!(bounds instanceof L.LatLngBounds)) {
      options = bounds;
      bounds = null;
    }

    options.renderer = new Renderer({
      schematic: this
      // padding: options.padding || this.options.padding || 0.25
    });

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

    /**
     * @type {L.Point}
     */
    this._viewBoxOffset = L.point(0, 0);

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
     * @type {L.Canvas}
     */
    this._canvasRenderer = null;

    /**
     * @type {Element}
     */
    this._raster = null;

    /**
     * @type {Canvas}
     */
    this._canvas = null;

    L.Rectangle.prototype.initialize.call(this, L.latLngBounds([0, 0], [0, 0]), options);
  },

  /**
   * @param  {L.Map} map
   */
  onAdd: function onAdd(map) {
    L.Rectangle.prototype.onAdd.call(this, map);

    if (!this._group) {
      this._group = L.SVG.create('g');
      L.Util.stamp(this._group);
      L.DomUtil.addClass(this._group, 'svg-overlay');
    }

    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }

    if (this.options.useRaster) {
      var canvasRenderer = new L.Canvas({}).addTo(map);
      canvasRenderer._container.parentNode.insertBefore(canvasRenderer._container, this._renderer._container);
      this._canvasRenderer = canvasRenderer;

      map.dragging._draggable.on('predrag', this._onPreDrag, this).on('dragend', this._onDragEnd, this);

      canvasRenderer._container.style.visibility = 'hidden';
    }
  },

  /**
   * @param  {L.Map} map
   */
  onRemove: function onRemove(map) {
    this._group.parentNode.removeChild(this._group);
    L.Rectangle.prototype.onRemove.call(this, map);
    if (this._canvasRenderer) {
      this._canvasRenderer.removeFrom(map);
      map.dragging._draggable.off('predrag', this._onPreDrag, this).off('dragend', this._onDragEnd, this);
    }
    this._renderer.removeFrom(map);
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
   * @param  {String} svgString
   * @return {String}
   */
  _readSVGData: function _readSVGData(svgString) {
    var parser = new DOMParser();
    var serializer = new XMLSerializer();

    var doc = parser.parseFromString(svgString, 'application/xml');
    var container = doc.documentElement;

    this._initialWidth = container.getAttribute('width');
    this._initialHeight = container.getAttribute('height');

    container.removeAttribute('width');
    container.removeAttribute('height');

    this._rawData = svgString;
    this._processedData = serializer.serializeToString(doc);

    this._bbox = L.DomUtil.getSVGBBox(container);

    if (container.getAttribute('viewBox') === null) {
      container.setAttribute('viewBox', this._bbox.join(' '));
      this._processedData = this._processedData.replace('<svg', '<svg viewBox="' + this._bbox.join(' ') + '"');
    }

    return container;
  },

  /**
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function onLoad(svg) {
    if (!this._map) {
      return;
    }

    svg = this._readSVGData(svg);
    var bbox = this._bbox;
    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (this.options.adjustToScreen && size.y !== mapSize.y) {
      this._ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this.options._zoomOffset = this._ratio < 1 ? this._ratio : 1 - this._ratio;
      // dismiss that offset
      this.options.zoomOffset = 0;
    }

    var minZoom = this._map.getMinZoom() - this.options.zoomOffset;
    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(this._map.unproject([bbox[0], bbox[3]], minZoom), this._map.unproject([bbox[2], bbox[1]], minZoom)).scale(this._ratio);

    this._size = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(1, this._origin.x, 1, this._origin.y);
    this._viewBoxOffset = L.point(this._bbox[0], this._bbox[1]);

    this._createContents(svg);
    this._renderer._container.insertBefore(this._group, this._renderer._container.firstChild);

    this.fire('load');

    this._latlngs = this._boundsToLatLngs(this._bounds);
    this._reset();

    if (this.options.useRaster) {
      this.toImage();
    }
  },

  /**
   * @param  {Function} callback
   * @param  {*=}       context
   * @return {Overlay}
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
   * @return {SVGElement}
   */
  getDocument: function getDocument() {
    return this._group;
  },

  /**
   * @return {L.SchematicRenderer}
   */
  getRenderer: function getRenderer() {
    return this._renderer;
  },

  /**
   * @param  {SVGElement} svg
   */
  _createContents: function _createContents(svg) {
    L.SVG.copySVGContents(svg, this._group);
  },

  /**
   * @return {L.Point}
   */
  getOriginalSize: function getOriginalSize() {
    var bbox = this._bbox;
    return new L.Point(Math.abs(bbox[0] - bbox[2]), Math.abs(bbox[1] - bbox[3]));
  },

  /**
   * Position our "rectangle"
   */
  _updatePath: function _updatePath() {
    L.Rectangle.prototype._updatePath.call(this);

    if (this._group) {
      var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
      // scale is scale factor, zoom is zoom level
      var scale = this._map.options.crs.scale(this._map.getZoom() - this.options.zoomOffset) * this._ratio;

      //topLeft = topLeft.subtract(this._viewBoxOffset.multiplyBy(scale));

      // compensate viewbox dismissal with a shift here
      this._group.setAttribute('transform', L.DomUtil.getMatrixString(topLeft.subtract(this._viewBoxOffset.multiplyBy(scale)), scale));

      if (this._canvasRenderer) {
        this._redrawCanvas(topLeft, scale);
      }
    }
  },

  /**
   * Scales projected point FROM viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _unscalePoint: function _unscalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).divideBy(this._ratio));
  },

  /**
   * Scales projected point TO viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _scalePoint: function _scalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).multiplyBy(this._ratio));
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
    var map = this._map;
    return this._unscalePoint(map.project(coord, map.getMinZoom() + this.options.zoomOffset));
  },

  /**
   * @param  {L.Point} pt
   * @return {L.LatLng}
   */
  unprojectPoint: function unprojectPoint(pt) {
    var map = this._map;
    return map.unproject(this._scalePoint(pt), map.getMinZoom() + this.options.zoomOffset);
  },

  /**
   * @param  {L.Bounds} bounds
   * @return {L.LatLngBounds}
   */
  unprojectBounds: function unprojectBounds(bounds) {
    var sw = this.unprojectPoint(bounds.min);
    var ne = this.unprojectPoint(bounds.max);
    return L.latLngBounds(sw, ne);
  },

  /**
   * Transform layerBounds to schematic bbox
   * @param  {L.LatLngBounds} bounds
   * @return {L.Bounds}
   */
  projectBounds: function projectBounds(bounds) {
    return new L.Bounds(this.projectPoint(bounds.getSouthWest()), this.projectPoint(bounds.getNorthEast()));
  },

  /**
   * @param  {Boolean=} string
   * @param  {Boolean=} overlaysOnly
   * @return {SVGElement|String}
   */
  exportSVG: function exportSVG(string, overlaysOnly) {
    var node = this._renderer.exportSVG(overlaysOnly);
    return string ? node.outerHTML : node;
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

    // hack to trick IE rendering engine
    L.DomEvent.on(img, 'load', function () {
      L.point(img.offsetWidth, img.offsetHeight);
      this._reset();
    }, this);
    img.style.opacity = 0;

    if (this._raster) {
      this._raster.parentNode.removeChild(this._raster);
      this._raster = null;
    }

    L.DomUtil.addClass(img, 'schematic-image');
    this._renderer._container.parentNode.insertBefore(img, this._renderer._container);
    this._raster = img;
    return this;
  },

  /**
   * Convert SVG data to base64 for rasterization
   * @return {String} base64 encoded SVG
   */
  toBase64: function toBase64() {
    // console.time('base64');
    var base64 = this._base64encoded || b64.btoa(unescape(encodeURIComponent(this._processedData)));
    this._base64encoded = base64;
    // console.timeEnd('base64');

    return 'data:image/svg+xml;base64,' + base64;
  },

  /**
   * Redraw canvas on real changes: zoom, viewreset
   * @param  {L.Point} topLeft
   * @param  {Number}  scale
   */
  _redrawCanvas: function _redrawCanvas(topLeft, scale) {
    if (!this._raster) {
      return;
    }

    var size = this.getOriginalSize().multiplyBy(scale);
    var ctx = this._canvasRenderer._ctx;

    L.Util.requestAnimFrame(function () {
      ctx.drawImage(this._raster, topLeft.x, topLeft.y, size.x, size.y);
    }, this);
  },

  /**
   * Toggle canvas instead of SVG when dragging
   */
  _showRaster: function _showRaster() {
    if (this._canvasRenderer) {
      this._canvasRenderer._container.style.visibility = 'visible';
      this._group.style.visibility = 'hidden';
    }
  },

  /**
   * Swap back to SVG
   */
  _hideRaster: function _hideRaster() {
    if (this._canvasRenderer) {
      this._canvasRenderer._container.style.visibility = 'hidden';
      this._group.style.visibility = 'visible';
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
  }

});

// aliases
L.Schematic.prototype.project = L.Schematic.prototype.projectPoint;
L.Schematic.prototype.unproject = L.Schematic.prototype.unprojectPoint;

/**
 * Factory
 * @param  {String}         svg     SVG string or URL
 * @param  {L.LatLngBounds} bounds
 * @param  {Object=}        options
 * @return {L.Schematic}
 */
L.schematic = function (svg, bounds, options) {
  return new L.Schematic(svg, bounds, options);
};

},{"./bounds":3,"./renderer":4,"./utils":6,"Base64":2,"leaflet":undefined}],6:[function(require,module,exports){
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

/**
 * @param  {SVGElement}         svg
 * @param  {SVGElement|Element} container
 */
L.SVG.copySVGContents = function (svg, container) {
  if (L.Browser.ie) {
    // innerHTML doesn't work for SVG in IE
    var child = svg.firstChild;
    do {
      container.appendChild(child);
      child = svg.firstChild;
    } while (child);
  } else {
    container.innerHTML = svg.innerHTML;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"leaflet":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGlCQUFSLENBQWpCOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBUjs7Ozs7QUFLQSxFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLE1BQW5CLEdBQTRCLFlBQVc7QUFDckMsU0FBTyxDQUFDLEtBQUssR0FBTCxDQUFTLENBQVYsRUFBYSxLQUFLLEdBQUwsQ0FBUyxDQUF0QixFQUF5QixLQUFLLEdBQUwsQ0FBUyxDQUFsQyxFQUFxQyxLQUFLLEdBQUwsQ0FBUyxDQUE5QyxDQUFQO0FBQ0QsQ0FGRDs7Ozs7O0FBU0EsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBZjtBQUNBLE1BQUksTUFB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QUFWLEdBQTRCLFVBQVMsR0FBVCxFQUFjO0FBQ3hDLE1BQUksVUFBVSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZDtBQUNBLFVBQVEsU0FBUixHQUFvQixHQUFwQjtBQUNBLFNBQU8sUUFBUSxhQUFSLENBQXNCLEtBQXRCLENBQVA7QUFDRCxDQUpEOzs7Ozs7O0FBWUEsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLFNBQVQsRUFBb0IsS0FBcEIsRUFBMkI7QUFDckQsU0FBTyxZQUNMLENBQUMsS0FBRCxFQUFRLENBQVIsRUFBVyxDQUFYLEVBQWMsS0FBZCxFQUFxQixVQUFVLENBQS9CLEVBQWtDLFVBQVUsQ0FBNUMsRUFBK0MsSUFBL0MsQ0FBb0QsR0FBcEQsQ0FESyxHQUNzRCxHQUQ3RDtBQUVELENBSEQ7Ozs7OztBQVVBLEVBQUUsR0FBRixDQUFNLGVBQU4sR0FBd0IsVUFBUyxHQUFULEVBQWMsU0FBZCxFQUF5QjtBQUMvQyxNQUFJLEVBQUUsT0FBRixDQUFVLEVBQWQsRUFBa0I7O0FBQ2hCLFFBQUksUUFBUSxJQUFJLFVBQWhCO0FBQ0EsT0FBRztBQUNELGdCQUFVLFdBQVYsQ0FBc0IsS0FBdEI7QUFDQSxjQUFRLElBQUksVUFBWjtBQUNELEtBSEQsUUFHUSxLQUhSO0FBSUQsR0FORCxNQU1PO0FBQ0wsY0FBVSxTQUFWLEdBQXNCLElBQUksU0FBMUI7QUFDRDtBQUNGLENBVkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9zY2hlbWF0aWMnKTtcbiIsIjsoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgZXhwb3J0cyAhPSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiB0aGlzOyAvLyAjODogd2ViIHdvcmtlcnNcbiAgdmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuICBmdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIH1cbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbiAgLy8gZW5jb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk5MTY2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL25pZ25hZ11cbiAgb2JqZWN0LmJ0b2EgfHwgKFxuICBvYmplY3QuYnRvYSA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnMsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICAgKSB7XG4gICAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzLzQpO1xuICAgICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2J0b2EnIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBlbmNvZGVkIGNvbnRhaW5zIGNoYXJhY3RlcnMgb3V0c2lkZSBvZiB0aGUgTGF0aW4xIHJhbmdlLlwiKTtcbiAgICAgIH1cbiAgICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgb2JqZWN0LmF0b2IgfHwgKFxuICBvYmplY3QuYXRvYiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpLnJlcGxhY2UoLz0rJC8sICcnKTtcbiAgICBpZiAoc3RyLmxlbmd0aCAlIDQgPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdChpZHgrKyk7XG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSAmIGJzID4+ICgtMiAqIGJjICYgNikpIDogMFxuICAgICkge1xuICAgICAgLy8gdHJ5IHRvIGZpbmQgY2hhcmFjdGVyIGluIHRhYmxlICgwLTYzLCBub3QgZm91bmQgPT4gLTEpXG4gICAgICBidWZmZXIgPSBjaGFycy5pbmRleE9mKGJ1ZmZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG59KCkpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG1heCA9IHRoaXMubWF4O1xuICB2YXIgbWluID0gdGhpcy5taW47XG4gIHZhciBkZWx0YVggPSAoKG1heC54IC0gbWluLngpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobWF4LnkgLSBtaW4ueSkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5Cb3VuZHMoW1xuICAgIFttaW4ueCAtIGRlbHRhWCwgbWluLnkgLSBkZWx0YVldLFxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXG4gIF0pO1xufTtcblxuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcbiAgdmFyIHN3ID0gdGhpcy5fc291dGhXZXN0O1xuICB2YXIgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcbiAgICBbbmUubGF0ICsgZGVsdGFZLCBuZS5sbmcgKyBkZWx0YVhdXG4gIF0pO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vKipcbiAqIEBjbGFzcyBMLlNjaGVtYXRpY1JlbmRlcmVyXG4gKiBAcGFyYW0gIHtPYmplY3R9XG4gKiBAZXh0ZW5kcyB7TC5TVkd9XG4gKi9cbkwuU2NoZW1hdGljUmVuZGVyZXIgPSBtb2R1bGUuZXhwb3J0cyA9IEwuU1ZHLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIHBhZGRpbmc6IDAuMyxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhZGRpdGlvbmFsIGNvbnRhaW5lcnMgZm9yIHRoZSB2ZWN0b3IgZmVhdHVyZXMgdG8gYmVcbiAgICogdHJhbnNmb3JtZWQgdG8gbGl2ZSBpbiB0aGUgc2NoZW1hdGljIHNwYWNlXG4gICAqL1xuICBfaW5pdENvbnRhaW5lcjogZnVuY3Rpb24oKSB7XG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAgPSBMLlNWRy5jcmVhdGUoJ2cnKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcm9vdEludmVydEdyb3VwKTtcbiAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fcm9vdEdyb3VwKTtcblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9jb250YWluZXIsICdzY2hlbWF0aWNzLXJlbmRlcmVyJyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTWFrZSBzdXJlIGxheWVycyBhcmUgbm90IGNsaXBwZWRcbiAgICogQHBhcmFtICB7TC5MYXllcn1cbiAgICovXG4gIF9pbml0UGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBsYXllci5vcHRpb25zLm5vQ2xpcCA9IHRydWU7XG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMsIGxheWVyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBVcGRhdGUgY2FsbCBvbiByZXNpemUsIHJlZHJhdywgem9vbSBjaGFuZ2VcbiAgICovXG4gIF91cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5fdXBkYXRlLmNhbGwodGhpcyk7XG5cbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG4gICAgaWYgKG1hcCAmJiBzY2hlbWF0aWMuX2JvdW5kcyAmJiB0aGlzLl9yb290SW52ZXJ0R3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gbWFwLmxhdExuZ1RvTGF5ZXJQb2ludChzY2hlbWF0aWMuX2JvdW5kcy5nZXROb3J0aFdlc3QoKSk7XG4gICAgICB2YXIgc2NhbGUgICA9IHNjaGVtYXRpYy5fcmF0aW8gKlxuICAgICAgICBtYXAub3B0aW9ucy5jcnMuc2NhbGUobWFwLmdldFpvb20oKSAtIHNjaGVtYXRpYy5vcHRpb25zLnpvb21PZmZzZXQpO1xuXG4gICAgICB0aGlzLl90b3BMZWZ0ID0gdG9wTGVmdDtcbiAgICAgIHRoaXMuX3NjYWxlICAgPSBzY2FsZTtcblxuICAgICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgICAgdGhpcy5fcm9vdEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdCwgc2NhbGUpKTtcblxuICAgICAgdGhpcy5fcm9vdEludmVydEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0Lm11bHRpcGx5QnkoIC0xIC8gc2NhbGUpLCAxIC8gc2NhbGUpKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogMS4gd3JhcCBtYXJrdXAgaW4gYW5vdGhlciA8Zz5cbiAgICogMi4gY3JlYXRlIGEgY2xpcFBhdGggd2l0aCB0aGUgdmlld0JveCByZWN0XG4gICAqIDMuIGFwcGx5IGl0IHRvIHRoZSA8Zz4gYXJvdW5kIGFsbCBtYXJrdXBzXG4gICAqIDQuIHJlbW92ZSBncm91cCBhcm91bmQgc2NoZW1hdGljXG4gICAqIDUuIHJlbW92ZSBpbm5lciBncm91cCBhcm91bmQgbWFya3Vwc1xuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW49fSBvbmx5T3ZlcmxheXNcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGV4cG9ydFNWRzogZnVuY3Rpb24ob25seU92ZXJsYXlzKSB7XG4gICAgdmFyIHNjaGVtYXRpYyA9IHRoaXMub3B0aW9ucy5zY2hlbWF0aWM7XG5cbiAgICAvLyBnbyB0aHJvdWdoIGV2ZXJ5IGxheWVyIGFuZCBtYWtlIHN1cmUgdGhleSdyZSBub3QgY2xpcHBlZFxuICAgIHZhciBzdmcgICAgICAgPSB0aGlzLl9jb250YWluZXIuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgdmFyIGNsaXBQYXRoICAgID0gTC5TVkcuY3JlYXRlKCdjbGlwUGF0aCcpO1xuICAgIHZhciBjbGlwUmVjdCAgICA9IEwuU1ZHLmNyZWF0ZSgncmVjdCcpO1xuICAgIHZhciBjbGlwR3JvdXAgICA9IHN2Zy5sYXN0Q2hpbGQ7XG4gICAgdmFyIGJhc2VDb250ZW50ID0gc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpO1xuICAgIHZhciBkZWZzICAgICAgICA9IGJhc2VDb250ZW50LnF1ZXJ5U2VsZWN0b3IoJ2RlZnMnKTtcblxuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgneCcsICAgICAgc2NoZW1hdGljLl9iYm94WzBdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCAgICAgIHNjaGVtYXRpYy5fYmJveFsxXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd3aWR0aCcsICBzY2hlbWF0aWMuX2Jib3hbMl0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0Jywgc2NoZW1hdGljLl9iYm94WzNdKTtcbiAgICBjbGlwUGF0aC5hcHBlbmRDaGlsZChjbGlwUmVjdCk7XG5cbiAgICB2YXIgY2xpcElkID0gJ3ZpZXdib3hDbGlwLScgKyBMLlV0aWwuc3RhbXAoc2NoZW1hdGljLl9ncm91cCk7XG4gICAgY2xpcFBhdGguc2V0QXR0cmlidXRlKCdpZCcsIGNsaXBJZCk7XG5cbiAgICBpZiAoIWRlZnMgfHwgb25seU92ZXJsYXlzKSB7XG4gICAgICBkZWZzID0gTC5TVkcuY3JlYXRlKCdkZWZzJyk7XG4gICAgICBzdmcuYXBwZW5kQ2hpbGQoZGVmcyk7XG4gICAgfVxuICAgIGRlZnMuYXBwZW5kQ2hpbGQoY2xpcFBhdGgpO1xuICAgIGNsaXBHcm91cC5zZXRBdHRyaWJ1dGUoJ2NsaXAtcGF0aCcsICd1cmwoIycgKyBjbGlwSWQgKyAnKScpO1xuXG4gICAgY2xpcEdyb3VwLmZpcnN0Q2hpbGQuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0aGlzLl90b3BMZWZ0Lm11bHRpcGx5QnkoIC0xIC8gdGhpcy5fc2NhbGUpXG4gICAgICAgIC5hZGQoc2NoZW1hdGljLl92aWV3Qm94T2Zmc2V0KSwgMSAvIHRoaXMuX3NjYWxlKSk7XG4gICAgY2xpcEdyb3VwLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGNsaXBHcm91cCwgJ2NsaXAtZ3JvdXAnKTtcblxuICAgIHN2Zy5zdHlsZS50cmFuc2Zvcm0gPSAnJztcbiAgICBzdmcuc2V0QXR0cmlidXRlKCd2aWV3Qm94Jywgc2NoZW1hdGljLl9iYm94LmpvaW4oJyAnKSk7XG5cbiAgICBpZiAob25seU92ZXJsYXlzKSB7IC8vIGxlYXZlIG9ubHkgbWFya3Vwc1xuICAgICAgYmFzZUNvbnRlbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChiYXNlQ29udGVudCk7XG4gICAgfVxuXG4gICAgdmFyIGRpdiA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICcnKTtcbiAgICAvLyBwdXQgY29udGFpbmVyIGFyb3VuZCB0aGUgY29udGVudHMgYXMgaXQgd2FzXG4gICAgZGl2LmlubmVySFRNTCA9ICgvKFxcPHN2Z1xccysoW14+XSopXFw+KS9naSlcbiAgICAgIC5leGVjKHNjaGVtYXRpYy5fcmF3RGF0YSlbMF0gKyAnPC9zdmc+JztcblxuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIGRpdi5maXJzdENoaWxkKTtcblxuICAgIHJldHVybiBkaXYuZmlyc3RDaGlsZDtcbiAgfVxuXG59KTtcblxuXG4vKipcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XG4gKi9cbkwuc2NoZW1hdGljUmVuZGVyZXIgPSBtb2R1bGUuZXhwb3J0cy5zY2hlbWF0aWNSZW5kZXJlciA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpY1JlbmRlcmVyKG9wdGlvbnMpO1xufTtcblxuIiwidmFyIEwgICAgICAgID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIGI2NCAgICAgID0gcmVxdWlyZSgnQmFzZTY0Jyk7XG52YXIgUmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyJyk7XG5cbnJlcXVpcmUoJy4vYm91bmRzJyk7XG5yZXF1aXJlKCcuL3V0aWxzJyk7XG5cblxuLyoqXG4gKiBTY2hlbWF0aWMgbGF5ZXIgdG8gd29yayB3aXRoIFNWRyBzY2hlbWF0aWNzIG9yIGJsdWVwcmludHMgaW4gTGVhZmxldFxuICpcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQGxpY2Vuc2UgTUlUXG4gKiBAcHJlc2VydmVcbiAqIEBjbGFzcyBTY2hlbWF0aWNcbiAqIEBleHRlbmRzIHtMLlJlY3RhbmdsZX1cbiAqL1xuTC5TY2hlbWF0aWMgPSBtb2R1bGUuZXhwb3J0cyA9IEwuUmVjdGFuZ2xlLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDAsXG4gICAgZmlsbE9wYWNpdHk6IDAsXG4gICAgd2VpZ2h0OiAxLFxuICAgIGFkanVzdFRvU2NyZWVuOiB0cnVlLFxuXG4gICAgLy8gaGFyZGNvZGUgem9vbSBvZmZzZXQgdG8gc25hcCB0byBzb21lIGxldmVsXG4gICAgem9vbU9mZnNldDogMCxcbiAgICBpbnRlcmFjdGl2ZTogZmFsc2UsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fc3ZnICAgID0gc3ZnO1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbCBzdmcgd2lkdGgsIGNhdXNlIHdlIHdpbGwgaGF2ZSB0byBnZXQgcmlkIG9mIHRoYXQgdG8gbWFpbnRhaW5cbiAgICAgKiB0aGUgYXNwZWN0IHJhdGlvXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxXaWR0aCAgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbCBzdmcgaGVpZ2h0XG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsSGVpZ2h0ID0gJyc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIG9wdGlvbnMucmVuZGVyZXIgPSBuZXcgUmVuZGVyZXIoe1xuICAgICAgc2NoZW1hdGljOiB0aGlzXG4gICAgICAvLyBwYWRkaW5nOiBvcHRpb25zLnBhZGRpbmcgfHwgdGhpcy5vcHRpb25zLnBhZGRpbmcgfHwgMC4yNVxuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KDAsIDApO1xuXG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzID0gbnVsbDtcblxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwoXG4gICAgICB0aGlzLCBMLmxhdExuZ0JvdW5kcyhbMCwgMF0sIFswLCAwXSksIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgaWYgKCF0aGlzLl9ncm91cCkge1xuICAgICAgdGhpcy5fZ3JvdXAgPSBMLlNWRy5jcmVhdGUoJ2cnKTtcbiAgICAgIEwuVXRpbC5zdGFtcCh0aGlzLl9ncm91cCk7XG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fZ3JvdXAsICdzdmctb3ZlcmxheScpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fc3ZnKSB7XG4gICAgICB0aGlzLmxvYWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdmFyIGNhbnZhc1JlbmRlcmVyID0gbmV3IEwuQ2FudmFzKHt9KS5hZGRUbyhtYXApO1xuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5wYXJlbnROb2RlXG4gICAgICAgIC5pbnNlcnRCZWZvcmUoY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lciwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lcik7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IGNhbnZhc1JlbmRlcmVyO1xuXG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub24oJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fZ3JvdXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9ncm91cCk7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uUmVtb3ZlLmNhbGwodGhpcywgbWFwKTtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcbiAgICAgIG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlXG4gICAgICAgIC5vZmYoJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLl9yZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2Z1N0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBfcmVhZFNWR0RhdGE6IGZ1bmN0aW9uKHN2Z1N0cmluZykge1xuICAgIHZhciBwYXJzZXIgICAgID0gbmV3IERPTVBhcnNlcigpO1xuICAgIHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcblxuICAgIHZhciBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHN2Z1N0cmluZywgJ2FwcGxpY2F0aW9uL3htbCcpO1xuICAgIHZhciBjb250YWluZXIgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgdGhpcy5faW5pdGlhbFdpZHRoICA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3dpZHRoJyk7XG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpO1xuXG4gICAgY29udGFpbmVyLnJlbW92ZUF0dHJpYnV0ZSgnd2lkdGgnKTtcbiAgICBjb250YWluZXIucmVtb3ZlQXR0cmlidXRlKCdoZWlnaHQnKTtcblxuICAgIHRoaXMuX3Jhd0RhdGEgICAgICAgPSBzdmdTdHJpbmc7XG4gICAgdGhpcy5fcHJvY2Vzc2VkRGF0YSA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcoZG9jKTtcblxuICAgIHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChjb250YWluZXIpO1xuXG4gICAgaWYgKGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKSA9PT0gbnVsbCkge1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHRoaXMuX2Jib3guam9pbignICcpKTtcbiAgICAgIHRoaXMuX3Byb2Nlc3NlZERhdGEgPSB0aGlzLl9wcm9jZXNzZWREYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIHRoaXMuX2Jib3guam9pbignICcpICsgJ1wiJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTVkcgaXMgcmVhZHlcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzdmcgbWFya3VwXG4gICAqL1xuICBvbkxvYWQ6IGZ1bmN0aW9uKHN2Zykge1xuICAgIGlmICghdGhpcy5fbWFwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3ZnID0gdGhpcy5fcmVhZFNWR0RhdGEoc3ZnKTtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgdmFyIHNpemUgPSB0aGlzLmdldE9yaWdpbmFsU2l6ZSgpO1xuICAgIHZhciBtYXBTaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuYWRqdXN0VG9TY3JlZW4gJiYgc2l6ZS55ICE9PSBtYXBTaXplLnkpIHtcbiAgICAgIHRoaXMuX3JhdGlvID0gTWF0aC5taW4obWFwU2l6ZS54IC8gc2l6ZS54LCBtYXBTaXplLnkgLyBzaXplLnkpO1xuICAgICAgdGhpcy5vcHRpb25zLl96b29tT2Zmc2V0ID0gKHRoaXMuX3JhdGlvIDwgMSkgP1xuICAgICAgICB0aGlzLl9yYXRpbyA6ICgxIC0gdGhpcy5fcmF0aW8pO1xuICAgICAgLy8gZGlzbWlzcyB0aGF0IG9mZnNldFxuICAgICAgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQgPSAwO1xuICAgIH1cblxuICAgIHZhciBtaW5ab29tID0gdGhpcy5fbWFwLmdldE1pblpvb20oKSAtIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0O1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgZWRnZXMgb2YgdGhlIGltYWdlLCBpbiBjb29yZGluYXRlIHNwYWNlXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFswXSwgYmJveFszXV0sIG1pblpvb20pLFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFsyXSwgYmJveFsxXV0sIG1pblpvb20pXG4gICAgKS5zY2FsZSh0aGlzLl9yYXRpbyk7XG5cbiAgICB0aGlzLl9zaXplICAgPSBzaXplO1xuICAgIHRoaXMuX29yaWdpbiA9IHRoaXMuX21hcC5wcm9qZWN0KHRoaXMuX2JvdW5kcy5nZXRDZW50ZXIoKSwgbWluWm9vbSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBuZXcgTC5UcmFuc2Zvcm1hdGlvbihcbiAgICAgIDEsIHRoaXMuX29yaWdpbi54LCAxLCB0aGlzLl9vcmlnaW4ueSk7XG4gICAgdGhpcy5fdmlld0JveE9mZnNldCA9IEwucG9pbnQodGhpcy5fYmJveFswXSwgdGhpcy5fYmJveFsxXSk7XG5cbiAgICB0aGlzLl9jcmVhdGVDb250ZW50cyhzdmcpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIuaW5zZXJ0QmVmb3JlKFxuICAgICAgdGhpcy5fZ3JvdXAsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIuZmlyc3RDaGlsZCk7XG5cbiAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcblxuICAgIHRoaXMuX2xhdGxuZ3MgPSB0aGlzLl9ib3VuZHNUb0xhdExuZ3ModGhpcy5fYm91bmRzKTtcbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMudG9JbWFnZSgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7Kj19ICAgICAgIGNvbnRleHRcbiAgICogQHJldHVybiB7T3ZlcmxheX1cbiAgICovXG4gIHdoZW5SZWFkeTogZnVuY3Rpb24oY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5fYm91bmRzKSB7XG4gICAgICBjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gICAqL1xuICBnZXREb2N1bWVudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dyb3VwO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XG4gICAqL1xuICBnZXRSZW5kZXJlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlbmRlcmVyO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICAgKi9cbiAgX2NyZWF0ZUNvbnRlbnRzOiBmdW5jdGlvbihzdmcpIHtcbiAgICBMLlNWRy5jb3B5U1ZHQ29udGVudHMoc3ZnLCB0aGlzLl9ncm91cCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHJldHVybiBuZXcgTC5Qb2ludChcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcbiAgICAgIE1hdGguYWJzKGJib3hbMV0gLSBiYm94WzNdKVxuICAgICk7XG4gIH0sXG5cblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiBvdXIgXCJyZWN0YW5nbGVcIlxuICAgKi9cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX2dyb3VwKSB7XG4gICAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXG4gICAgICB2YXIgc2NhbGUgICA9IHRoaXMuX21hcC5vcHRpb25zLmNycy5zY2FsZShcbiAgICAgICAgdGhpcy5fbWFwLmdldFpvb20oKSAtIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KSAqIHRoaXMuX3JhdGlvO1xuXG4gICAgICAvL3RvcExlZnQgPSB0b3BMZWZ0LnN1YnRyYWN0KHRoaXMuX3ZpZXdCb3hPZmZzZXQubXVsdGlwbHlCeShzY2FsZSkpO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9ncm91cC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKFxuICAgICAgICAgIHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSksIHNjYWxlKSk7XG5cbiAgICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2NhbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IEZST00gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3Vuc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG4gICAqL1xuICBnZXRSYXRpbzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JhdGlvO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBtYXAgY29vcmQgdG8gc2NoZW1hdGljIHBvaW50XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBjb29yZFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgcHJvamVjdFBvaW50OiBmdW5jdGlvbihjb29yZCkge1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG4gICAgcmV0dXJuIHRoaXMuX3Vuc2NhbGVQb2ludChtYXAucHJvamVjdChcbiAgICAgIGNvb3JkLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIHVucHJvamVjdFBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG4gICAgcmV0dXJuIG1hcC51bnByb2plY3QoXG4gICAgICB0aGlzLl9zY2FsZVBvaW50KHB0KSwgbWFwLmdldE1pblpvb20oKSArIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLkJvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICAgKi9cbiAgdW5wcm9qZWN0Qm91bmRzOiBmdW5jdGlvbihib3VuZHMpIHtcbiAgICB2YXIgc3cgPSB0aGlzLnVucHJvamVjdFBvaW50KGJvdW5kcy5taW4pO1xuICAgIHZhciBuZSA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1heCk7XG4gICAgcmV0dXJuIEwubGF0TG5nQm91bmRzKHN3LCBuZSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIGxheWVyQm91bmRzIHRvIHNjaGVtYXRpYyBiYm94XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBwcm9qZWN0Qm91bmRzOiBmdW5jdGlvbihib3VuZHMpIHtcbiAgICByZXR1cm4gbmV3IEwuQm91bmRzKFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldFNvdXRoV2VzdCgpKSxcbiAgICAgIHRoaXMucHJvamVjdFBvaW50KGJvdW5kcy5nZXROb3J0aEVhc3QoKSlcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Jvb2xlYW49fSBzdHJpbmdcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IG92ZXJsYXlzT25seVxuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fFN0cmluZ31cbiAgICovXG4gIGV4cG9ydFNWRzogZnVuY3Rpb24oc3RyaW5nLCBvdmVybGF5c09ubHkpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuX3JlbmRlcmVyLmV4cG9ydFNWRyhvdmVybGF5c09ubHkpO1xuICAgIHJldHVybiBzdHJpbmcgPyBub2RlLm91dGVySFRNTCA6IG5vZGU7XG4gIH0sXG5cblxuICAgLyoqXG4gICAqIFJhc3Rlcml6ZXMgdGhlIHNjaGVtYXRpY1xuICAgKiBAcmV0dXJuIHtTY2hlbWF0aWN9XG4gICAqL1xuICB0b0ltYWdlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW1nID0gbmV3IEltYWdlKCk7XG5cbiAgICAvLyB0aGlzIGRvZXNuJ3Qgd29yayBpbiBJRSwgZm9yY2Ugc2l6ZVxuICAgIC8vIGltZy5zdHlsZS5oZWlnaHQgPSBpbWcuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgaW1nLnN0eWxlLndpZHRoICA9IHRoaXMuX3NpemUueCArICdweCc7XG4gICAgaW1nLnN0eWxlLmhlaWdodCA9IHRoaXMuX3NpemUueSArICdweCc7XG4gICAgaW1nLnNyYyA9IHRoaXMudG9CYXNlNjQoKTtcblxuICAgIC8vIGhhY2sgdG8gdHJpY2sgSUUgcmVuZGVyaW5nIGVuZ2luZVxuICAgIEwuRG9tRXZlbnQub24oaW1nLCAnbG9hZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIEwucG9pbnQoaW1nLm9mZnNldFdpZHRoLCBpbWcub2Zmc2V0SGVpZ2h0KTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSwgdGhpcyk7XG4gICAgaW1nLnN0eWxlLm9wYWNpdHkgPSAwO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgLmluc2VydEJlZm9yZShpbWcsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vIGNvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcbiAgICAgIGI2NC5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9wcm9jZXNzZWREYXRhKSkpO1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSBiYXNlNjQ7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCdiYXNlNjQnKTtcblxuICAgIHJldHVybiAnZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCwnICsgYmFzZTY0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBjYW52YXMgb24gcmVhbCBjaGFuZ2VzOiB6b29tLCB2aWV3cmVzZXRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gdG9wTGVmdFxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2NhbGUpIHtcbiAgICBpZiAoIXRoaXMuX3Jhc3Rlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKS5tdWx0aXBseUJ5KHNjYWxlKTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fY2FudmFzUmVuZGVyZXIuX2N0eDtcblxuICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHRvcExlZnQueCwgdG9wTGVmdC55LCBzaXplLngsIHNpemUueSk7XG4gICAgfSwgdGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVG9nZ2xlIGNhbnZhcyBpbnN0ZWFkIG9mIFNWRyB3aGVuIGRyYWdnaW5nXG4gICAqL1xuICBfc2hvd1Jhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICB0aGlzLl9ncm91cC5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vLyBhbGlhc2VzXG5MLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdCAgID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3RQb2ludDtcbkwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3QgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0UG9pbnQ7XG5cblxuLyoqXG4gKiBGYWN0b3J5XG4gKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljfVxuICovXG5MLnNjaGVtYXRpYyA9IGZ1bmN0aW9uIChzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljKHN2ZywgYm91bmRzLCBvcHRpb25zKTtcbn07XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLy8gPHVzZT4gdGFncyBhcmUgYnJva2VuIGluIElFIGluIHNvIG1hbnkgd2F5c1xuaWYgKCdTVkdFbGVtZW50SW5zdGFuY2UnIGluIGdsb2JhbCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgTm9kZSA9PT0gJ29iamVjdCcgP1xuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcbiAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICApO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XG4gIHZhciB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICB2YXIgYmJveDtcbiAgaWYgKHZpZXdCb3gpIHtcbiAgICBiYm94ID0gdmlld0JveC5zcGxpdCgnICcpLm1hcChwYXJzZUZsb2F0KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgIC8vIGJib3ggPSBjbG9uZS5nZXRCQm94KCk7XG4gICAgYmJveCA9IGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKGNsb25lKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNsb25lKTtcbiAgICByZXR1cm4gYmJveDtcbiAgfVxuICByZXR1cm4gW2Jib3hbMF0sIGJib3hbMV0sIGJib3hbMF0gKyBiYm94WzJdLCBiYm94WzFdICsgYmJveFszXV07XG59O1xuXG5cbi8qKlxuICogU2ltcGx5IGJydXRlIGZvcmNlOiB0YWtlcyBhbGwgc3ZnIG5vZGVzLCBjYWxjdWxhdGVzIGJvdW5kaW5nIGJveFxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuZnVuY3Rpb24gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoc3ZnKSB7XG4gIHZhciBiYm94ID0gW0luZmluaXR5LCBJbmZpbml0eSwgLUluZmluaXR5LCAtSW5maW5pdHldO1xuICB2YXIgbm9kZXMgPSBbXS5zbGljZS5jYWxsKHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCcqJykpO1xuICB2YXIgbWluID0gTWF0aC5taW4sIG1heCA9IE1hdGgubWF4O1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBub2RlID0gbm9kZXNbaV07XG4gICAgaWYgKG5vZGUuZ2V0QkJveCkge1xuICAgICAgbm9kZSA9IG5vZGUuZ2V0QkJveCgpO1xuXG4gICAgICBiYm94WzBdID0gbWluKG5vZGUueCwgYmJveFswXSk7XG4gICAgICBiYm94WzFdID0gbWluKG5vZGUueSwgYmJveFsxXSk7XG5cbiAgICAgIGJib3hbMl0gPSBtYXgobm9kZS54ICsgbm9kZS53aWR0aCwgYmJveFsyXSk7XG4gICAgICBiYm94WzNdID0gbWF4KG5vZGUueSArIG5vZGUuaGVpZ2h0LCBiYm94WzNdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJib3g7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gZnVuY3Rpb24odHJhbnNsYXRlLCBzY2FsZSkge1xuICByZXR1cm4gJ21hdHJpeCgnICtcbiAgICBbc2NhbGUsIDAsIDAsIHNjYWxlLCB0cmFuc2xhdGUueCwgdHJhbnNsYXRlLnldLmpvaW4oJywnKSArICcpJztcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSAgICAgICAgIHN2Z1xuICogQHBhcmFtICB7U1ZHRWxlbWVudHxFbGVtZW50fSBjb250YWluZXJcbiAqL1xuTC5TVkcuY29weVNWR0NvbnRlbnRzID0gZnVuY3Rpb24oc3ZnLCBjb250YWluZXIpIHtcbiAgaWYgKEwuQnJvd3Nlci5pZSkgeyAvLyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUVcbiAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICBkbyB7XG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICB9IHdoaWxlKGNoaWxkKTtcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgfVxufTtcbiJdfQ==
