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

},{}],5:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGlCQUFSLENBQWpCOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBUjs7Ozs7QUFLQSxFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLE1BQW5CLEdBQTRCLFlBQVc7QUFDckMsU0FBTyxDQUFDLEtBQUssR0FBTCxDQUFTLENBQVYsRUFBYSxLQUFLLEdBQUwsQ0FBUyxDQUF0QixFQUF5QixLQUFLLEdBQUwsQ0FBUyxDQUFsQyxFQUFxQyxLQUFLLEdBQUwsQ0FBUyxDQUE5QyxDQUFQO0FBQ0QsQ0FGRDs7Ozs7O0FBU0EsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBZjtBQUNBLE1BQUksTUFB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TUFBSSxVQUFVLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFkO0FBQ0EsVUFBUSxTQUFSLEdBQW9CLEdBQXBCO0FBQ0EsU0FBTyxRQUFRLGFBQVIsQ0FBc0IsS0FBdEIsQ0FBUDtBQUNELENBSkQ7Ozs7Ozs7QUFZQSxFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBL0IsRUFBa0MsVUFBVSxDQUE1QyxFQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRDdEO0FBRUQsQ0FIRDs7Ozs7O0FBVUEsRUFBRSxHQUFGLENBQU0sZUFBTixHQUF3QixVQUFTLEdBQVQsRUFBYyxTQUFkLEVBQXlCO0FBQy9DLE1BQUksRUFBRSxPQUFGLENBQVUsRUFBZCxFQUFrQjs7QUFDaEIsUUFBSSxRQUFRLElBQUksVUFBaEI7QUFDQSxPQUFHO0FBQ0QsZ0JBQVUsV0FBVixDQUFzQixLQUF0QjtBQUNBLGNBQVEsSUFBSSxVQUFaO0FBQ0QsS0FIRCxRQUdRLEtBSFI7QUFJRCxHQU5ELE1BTU87QUFDTCxjQUFVLFNBQVYsR0FBc0IsSUFBSSxTQUExQjtBQUNEO0FBQ0YsQ0FWRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3NjaGVtYXRpYycpO1xuIiwiOyhmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBleHBvcnRzICE9ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IHRoaXM7IC8vICM4OiB3ZWIgd29ya2Vyc1xuICB2YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG4gIGZ1bmN0aW9uIEludmFsaWRDaGFyYWN0ZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yO1xuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuICAvLyBlbmNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS85OTkxNjZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vbmlnbmFnXVxuICBvYmplY3QuYnRvYSB8fCAoXG4gIG9iamVjdC5idG9hID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgICApIHtcbiAgICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMvNCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG4gIC8vIGRlY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwMjAzOTZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vYXRrXVxuICBvYmplY3QuYXRvYiB8fCAoXG4gIG9iamVjdC5hdG9iID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCkucmVwbGFjZSgvPSskLywgJycpO1xuICAgIGlmIChzdHIubGVuZ3RoICUgNCA9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2F0b2InIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBkZWNvZGVkIGlzIG5vdCBjb3JyZWN0bHkgZW5jb2RlZC5cIik7XG4gICAgfVxuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlcnNcbiAgICAgIHZhciBiYyA9IDAsIGJzLCBidWZmZXIsIGlkeCA9IDAsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gZ2V0IG5leHQgY2hhcmFjdGVyXG4gICAgICBidWZmZXIgPSBzdHIuY2hhckF0KGlkeCsrKTtcbiAgICAgIC8vIGNoYXJhY3RlciBmb3VuZCBpbiB0YWJsZT8gaW5pdGlhbGl6ZSBiaXQgc3RvcmFnZSBhbmQgYWRkIGl0cyBhc2NpaSB2YWx1ZTtcbiAgICAgIH5idWZmZXIgJiYgKGJzID0gYmMgJSA0ID8gYnMgKiA2NCArIGJ1ZmZlciA6IGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGlmIG5vdCBmaXJzdCBvZiBlYWNoIDQgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gY29udmVydCB0aGUgZmlyc3QgOCBiaXRzIHRvIG9uZSBhc2NpaSBjaGFyYWN0ZXJcbiAgICAgICAgYmMrKyAlIDQpID8gb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjU1ICYgYnMgPj4gKC0yICogYmMgJiA2KSkgOiAwXG4gICAgKSB7XG4gICAgICAvLyB0cnkgdG8gZmluZCBjaGFyYWN0ZXIgaW4gdGFibGUgKDAtNjMsIG5vdCBmb3VuZCA9PiAtMSlcbiAgICAgIGJ1ZmZlciA9IGNoYXJzLmluZGV4T2YoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbn0oKSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMubWluLngsIHRoaXMubWluLnksIHRoaXMubWF4LngsIHRoaXMubWF4LnldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuQm91bmRzfVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbWF4ID0gdGhpcy5tYXg7XG4gIHZhciBtaW4gPSB0aGlzLm1pbjtcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChtYXgueSAtIG1pbi55KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXG4gICAgW21pbi54IC0gZGVsdGFYLCBtaW4ueSAtIGRlbHRhWV0sXG4gICAgW21heC54ICsgZGVsdGFYLCBtYXgueSArIGRlbHRhWV1cbiAgXSk7XG59O1xuXG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XG4gIHZhciBkZWx0YVggPSAoKG5lLmxuZyAtIHN3LmxuZykgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwiLyoqXG4gKiBAY2xhc3MgTC5TY2hlbWF0aWNSZW5kZXJlclxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQGV4dGVuZHMge0wuU1ZHfVxuICovXG5MLlNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMgPSBMLlNWRy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjMsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYWRkaXRpb25hbCBjb250YWluZXJzIGZvciB0aGUgdmVjdG9yIGZlYXR1cmVzIHRvIGJlXG4gICAqIHRyYW5zZm9ybWVkIHRvIGxpdmUgaW4gdGhlIHNjaGVtYXRpYyBzcGFjZVxuICAgKi9cbiAgX2luaXRDb250YWluZXI6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5faW5pdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RJbnZlcnRHcm91cCk7XG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RHcm91cCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnc2NoZW1hdGljcy1yZW5kZXJlcicpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIE1ha2Ugc3VyZSBsYXllcnMgYXJlIG5vdCBjbGlwcGVkXG4gICAqIEBwYXJhbSAge0wuTGF5ZXJ9XG4gICAqL1xuICBfaW5pdFBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgbGF5ZXIub3B0aW9ucy5ub0NsaXAgPSB0cnVlO1xuICAgIEwuU1ZHLnByb3RvdHlwZS5faW5pdFBhdGguY2FsbCh0aGlzLCBsYXllcik7XG4gIH0sXG5cblxuICAvKipcbiAgICogVXBkYXRlIGNhbGwgb24gcmVzaXplLCByZWRyYXcsIHpvb20gY2hhbmdlXG4gICAqL1xuICBfdXBkYXRlOiBmdW5jdGlvbigpIHtcbiAgICBMLlNWRy5wcm90b3R5cGUuX3VwZGF0ZS5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHNjaGVtYXRpYyA9IHRoaXMub3B0aW9ucy5zY2hlbWF0aWM7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcblxuICAgIGlmIChtYXAgJiYgc2NoZW1hdGljLl9ib3VuZHMgJiYgdGhpcy5fcm9vdEludmVydEdyb3VwKSB7XG4gICAgICB2YXIgdG9wTGVmdCA9IG1hcC5sYXRMbmdUb0xheWVyUG9pbnQoc2NoZW1hdGljLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgdmFyIHNjYWxlICAgPSBzY2hlbWF0aWMuX3JhdGlvICpcbiAgICAgICAgbWFwLm9wdGlvbnMuY3JzLnNjYWxlKG1hcC5nZXRab29tKCkgLSBzY2hlbWF0aWMub3B0aW9ucy56b29tT2Zmc2V0KTtcblxuICAgICAgdGhpcy5fdG9wTGVmdCA9IHRvcExlZnQ7XG4gICAgICB0aGlzLl9zY2FsZSAgID0gc2NhbGU7XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX3Jvb3RHcm91cC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQsIHNjYWxlKSk7XG5cbiAgICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdC5tdWx0aXBseUJ5KCAtMSAvIHNjYWxlKSwgMSAvIHNjYWxlKSk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIDEuIHdyYXAgbWFya3VwIGluIGFub3RoZXIgPGc+XG4gICAqIDIuIGNyZWF0ZSBhIGNsaXBQYXRoIHdpdGggdGhlIHZpZXdCb3ggcmVjdFxuICAgKiAzLiBhcHBseSBpdCB0byB0aGUgPGc+IGFyb3VuZCBhbGwgbWFya3Vwc1xuICAgKiA0LiByZW1vdmUgZ3JvdXAgYXJvdW5kIHNjaGVtYXRpY1xuICAgKiA1LiByZW1vdmUgaW5uZXIgZ3JvdXAgYXJvdW5kIG1hcmt1cHNcbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFuPX0gb25seU92ZXJsYXlzXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gICAqL1xuICBleHBvcnRTVkc6IGZ1bmN0aW9uKG9ubHlPdmVybGF5cykge1xuICAgIHZhciBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xuXG4gICAgLy8gZ28gdGhyb3VnaCBldmVyeSBsYXllciBhbmQgbWFrZSBzdXJlIHRoZXkncmUgbm90IGNsaXBwZWRcbiAgICB2YXIgc3ZnICAgICAgID0gdGhpcy5fY29udGFpbmVyLmNsb25lTm9kZSh0cnVlKTtcblxuICAgIHZhciBjbGlwUGF0aCAgICA9IEwuU1ZHLmNyZWF0ZSgnY2xpcFBhdGgnKTtcbiAgICB2YXIgY2xpcFJlY3QgICAgPSBMLlNWRy5jcmVhdGUoJ3JlY3QnKTtcbiAgICB2YXIgY2xpcEdyb3VwICAgPSBzdmcubGFzdENoaWxkO1xuICAgIHZhciBiYXNlQ29udGVudCA9IHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKTtcbiAgICB2YXIgZGVmcyAgICAgICAgPSBiYXNlQ29udGVudC5xdWVyeVNlbGVjdG9yKCdkZWZzJyk7XG5cbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3gnLCAgICAgIHNjaGVtYXRpYy5fYmJveFswXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd5JywgICAgICBzY2hlbWF0aWMuX2Jib3hbMV0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAgc2NoZW1hdGljLl9iYm94WzJdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIHNjaGVtYXRpYy5fYmJveFszXSk7XG4gICAgY2xpcFBhdGguYXBwZW5kQ2hpbGQoY2xpcFJlY3QpO1xuXG4gICAgdmFyIGNsaXBJZCA9ICd2aWV3Ym94Q2xpcC0nICsgTC5VdGlsLnN0YW1wKHNjaGVtYXRpYy5fZ3JvdXApO1xuICAgIGNsaXBQYXRoLnNldEF0dHJpYnV0ZSgnaWQnLCBjbGlwSWQpO1xuXG4gICAgaWYgKCFkZWZzIHx8IG9ubHlPdmVybGF5cykge1xuICAgICAgZGVmcyA9IEwuU1ZHLmNyZWF0ZSgnZGVmcycpO1xuICAgICAgc3ZnLmFwcGVuZENoaWxkKGRlZnMpO1xuICAgIH1cbiAgICBkZWZzLmFwcGVuZENoaWxkKGNsaXBQYXRoKTtcbiAgICBjbGlwR3JvdXAuc2V0QXR0cmlidXRlKCdjbGlwLXBhdGgnLCAndXJsKCMnICsgY2xpcElkICsgJyknKTtcblxuICAgIGNsaXBHcm91cC5maXJzdENoaWxkLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodGhpcy5fdG9wTGVmdC5tdWx0aXBseUJ5KCAtMSAvIHRoaXMuX3NjYWxlKVxuICAgICAgICAuYWRkKHNjaGVtYXRpYy5fdmlld0JveE9mZnNldCksIDEgLyB0aGlzLl9zY2FsZSkpO1xuICAgIGNsaXBHcm91cC5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuICAgIHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKS5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhjbGlwR3JvdXAsICdjbGlwLWdyb3VwJyk7XG5cbiAgICBzdmcuc3R5bGUudHJhbnNmb3JtID0gJyc7XG4gICAgc3ZnLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHNjaGVtYXRpYy5fYmJveC5qb2luKCcgJykpO1xuXG4gICAgaWYgKG9ubHlPdmVybGF5cykgeyAvLyBsZWF2ZSBvbmx5IG1hcmt1cHNcbiAgICAgIGJhc2VDb250ZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYmFzZUNvbnRlbnQpO1xuICAgIH1cblxuICAgIHZhciBkaXYgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnJyk7XG4gICAgLy8gcHV0IGNvbnRhaW5lciBhcm91bmQgdGhlIGNvbnRlbnRzIGFzIGl0IHdhc1xuICAgIGRpdi5pbm5lckhUTUwgPSAoLyhcXDxzdmdcXHMrKFtePl0qKVxcPikvZ2kpXG4gICAgICAuZXhlYyhzY2hlbWF0aWMuX3Jhd0RhdGEpWzBdICsgJzwvc3ZnPic7XG5cbiAgICBMLlNWRy5jb3B5U1ZHQ29udGVudHMoc3ZnLCBkaXYuZmlyc3RDaGlsZCk7XG5cbiAgICByZXR1cm4gZGl2LmZpcnN0Q2hpbGQ7XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtPYmplY3R9XG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY1JlbmRlcmVyfVxuICovXG5MLnNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMuc2NoZW1hdGljUmVuZGVyZXIgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTC5TY2hlbWF0aWNSZW5kZXJlcihvcHRpb25zKTtcbn07XG5cbiIsInZhciBMICAgICAgICA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBiNjQgICAgICA9IHJlcXVpcmUoJ0Jhc2U2NCcpO1xudmFyIFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlcicpO1xuXG5yZXF1aXJlKCcuL2JvdW5kcycpO1xucmVxdWlyZSgnLi91dGlscycpO1xuXG5cbi8qKlxuICogU2NoZW1hdGljIGxheWVyIHRvIHdvcmsgd2l0aCBTVkcgc2NoZW1hdGljcyBvciBibHVlcHJpbnRzIGluIExlYWZsZXRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKiBAY2xhc3MgU2NoZW1hdGljXG4gKiBAZXh0ZW5kcyB7TC5SZWN0YW5nbGV9XG4gKi9cbkwuU2NoZW1hdGljID0gbW9kdWxlLmV4cG9ydHMgPSBMLlJlY3RhbmdsZS5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBvcGFjaXR5OiAwLFxuICAgIGZpbGxPcGFjaXR5OiAwLFxuICAgIHdlaWdodDogMSxcbiAgICBhZGp1c3RUb1NjcmVlbjogdHJ1ZSxcblxuICAgIC8vIGhhcmRjb2RlIHpvb20gb2Zmc2V0IHRvIHNuYXAgdG8gc29tZSBsZXZlbFxuICAgIHpvb21PZmZzZXQ6IDAsXG4gICAgaW50ZXJhY3RpdmU6IGZhbHNlLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyAgICA9IHN2ZztcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWwgc3ZnIHdpZHRoLCBjYXVzZSB3ZSB3aWxsIGhhdmUgdG8gZ2V0IHJpZCBvZiB0aGF0IHRvIG1haW50YWluXG4gICAgICogdGhlIGFzcGVjdCByYXRpb1xuICAgICAqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsV2lkdGggID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWwgc3ZnIGhlaWdodFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9ICcnO1xuXG4gICAgaWYgKCEoYm91bmRzIGluc3RhbmNlb2YgTC5MYXRMbmdCb3VuZHMpKSB7XG4gICAgICBvcHRpb25zID0gYm91bmRzO1xuICAgICAgYm91bmRzID0gbnVsbDtcbiAgICB9XG5cbiAgICBvcHRpb25zLnJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKHtcbiAgICAgIHNjaGVtYXRpYzogdGhpc1xuICAgICAgLy8gcGFkZGluZzogb3B0aW9ucy5wYWRkaW5nIHx8IHRoaXMub3B0aW9ucy5wYWRkaW5nIHx8IDAuMjVcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ0JvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX3JhdGlvID0gMTtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlRyYW5zZm9ybWF0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCgwLCAwKTtcblxuXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xuICAgICAgdGhpcy5fc3ZnID0gbnVsbDtcblxuICAgICAgLyoqXG4gICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XG5cbiAgICAgIGlmICghb3B0aW9ucy5sb2FkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2FudmFzfVxuICAgICAqL1xuICAgIHRoaXMuX2NhbnZhcyA9IG51bGw7XG5cbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKFxuICAgICAgdGhpcywgTC5sYXRMbmdCb3VuZHMoWzAsIDBdLCBbMCwgMF0pLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIGlmICghdGhpcy5fZ3JvdXApIHtcbiAgICAgIHRoaXMuX2dyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgICBMLlV0aWwuc3RhbXAodGhpcy5fZ3JvdXApO1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2dyb3VwLCAnc3ZnLW92ZXJsYXknKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHZhciBjYW52YXNSZW5kZXJlciA9IG5ldyBMLkNhbnZhcyh7fSkuYWRkVG8obWFwKTtcbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgICAuaW5zZXJ0QmVmb3JlKGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBjYW52YXNSZW5kZXJlcjtcblxuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcbiAgICAgICAgLm9uKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgICBjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMuX2dyb3VwLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fZ3JvdXApO1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub2ZmKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5fcmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExvYWRzIHN2ZyB2aWEgWEhSXG4gICAqL1xuICBsb2FkOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9wdGlvbnMubG9hZCh0aGlzLl91cmwsIGZ1bmN0aW9uKGVyciwgc3ZnKSB7XG4gICAgICBpZiAoIWVycikge1xuICAgICAgICB0aGlzLm9uTG9hZChzdmcpO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzdmdTdHJpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cbiAgX3JlYWRTVkdEYXRhOiBmdW5jdGlvbihzdmdTdHJpbmcpIHtcbiAgICB2YXIgcGFyc2VyICAgICA9IG5ldyBET01QYXJzZXIoKTtcbiAgICB2YXIgc2VyaWFsaXplciA9IG5ldyBYTUxTZXJpYWxpemVyKCk7XG5cbiAgICB2YXIgZG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyhzdmdTdHJpbmcsICdhcHBsaWNhdGlvbi94bWwnKTtcbiAgICB2YXIgY29udGFpbmVyID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuICAgIHRoaXMuX2luaXRpYWxXaWR0aCAgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKCd3aWR0aCcpO1xuICAgIHRoaXMuX2luaXRpYWxIZWlnaHQgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdoZWlnaHQnKTtcblxuICAgIGNvbnRhaW5lci5yZW1vdmVBdHRyaWJ1dGUoJ3dpZHRoJyk7XG4gICAgY29udGFpbmVyLnJlbW92ZUF0dHJpYnV0ZSgnaGVpZ2h0Jyk7XG5cbiAgICB0aGlzLl9yYXdEYXRhICAgICAgID0gc3ZnU3RyaW5nO1xuICAgIHRoaXMuX3Byb2Nlc3NlZERhdGEgPSBzZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKGRvYyk7XG5cbiAgICB0aGlzLl9iYm94ID0gTC5Eb21VdGlsLmdldFNWR0JCb3goY29udGFpbmVyKTtcblxuICAgIGlmIChjb250YWluZXIuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcbiAgICAgIGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCB0aGlzLl9iYm94LmpvaW4oJyAnKSk7XG4gICAgICB0aGlzLl9wcm9jZXNzZWREYXRhID0gdGhpcy5fcHJvY2Vzc2VkRGF0YS5yZXBsYWNlKCc8c3ZnJyxcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIicgKyB0aGlzLl9iYm94LmpvaW4oJyAnKSArICdcIicpO1xuICAgIH1cblxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH0sXG5cblxuICAvKipcbiAgICogU1ZHIGlzIHJlYWR5XG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxuICAgKi9cbiAgb25Mb2FkOiBmdW5jdGlvbihzdmcpIHtcbiAgICBpZiAoIXRoaXMuX21hcCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN2ZyA9IHRoaXMuX3JlYWRTVkdEYXRhKHN2Zyk7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICB2YXIgbWFwU2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmFkanVzdFRvU2NyZWVuICYmIHNpemUueSAhPT0gbWFwU2l6ZS55KSB7XG4gICAgICB0aGlzLl9yYXRpbyA9IE1hdGgubWluKG1hcFNpemUueCAvIHNpemUueCwgbWFwU2l6ZS55IC8gc2l6ZS55KTtcbiAgICAgIHRoaXMub3B0aW9ucy5fem9vbU9mZnNldCA9ICh0aGlzLl9yYXRpbyA8IDEpID9cbiAgICAgICAgdGhpcy5fcmF0aW8gOiAoMSAtIHRoaXMuX3JhdGlvKTtcbiAgICAgIC8vIGRpc21pc3MgdGhhdCBvZmZzZXRcbiAgICAgIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0ID0gMDtcbiAgICB9XG5cbiAgICB2YXIgbWluWm9vbSA9IHRoaXMuX21hcC5nZXRNaW5ab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIGVkZ2VzIG9mIHRoZSBpbWFnZSwgaW4gY29vcmRpbmF0ZSBzcGFjZVxuICAgIHRoaXMuX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcyhcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMF0sIGJib3hbM11dLCBtaW5ab29tKSxcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMl0sIGJib3hbMV1dLCBtaW5ab29tKVxuICAgICkuc2NhbGUodGhpcy5fcmF0aW8pO1xuXG4gICAgdGhpcy5fc2l6ZSAgID0gc2l6ZTtcbiAgICB0aGlzLl9vcmlnaW4gPSB0aGlzLl9tYXAucHJvamVjdCh0aGlzLl9ib3VuZHMuZ2V0Q2VudGVyKCksIG1pblpvb20pO1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbmV3IEwuVHJhbnNmb3JtYXRpb24oXG4gICAgICAxLCB0aGlzLl9vcmlnaW4ueCwgMSwgdGhpcy5fb3JpZ2luLnkpO1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KHRoaXMuX2Jib3hbMF0sIHRoaXMuX2Jib3hbMV0pO1xuXG4gICAgdGhpcy5fY3JlYXRlQ29udGVudHMoc3ZnKTtcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLmluc2VydEJlZm9yZShcbiAgICAgIHRoaXMuX2dyb3VwLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuXG4gICAgdGhpcy5maXJlKCdsb2FkJyk7XG5cbiAgICB0aGlzLl9sYXRsbmdzID0gdGhpcy5fYm91bmRzVG9MYXRMbmdzKHRoaXMuX2JvdW5kcyk7XG4gICAgdGhpcy5fcmVzZXQoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLnRvSW1hZ2UoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqIEBwYXJhbSAgeyo9fSAgICAgICBjb250ZXh0XG4gICAqIEByZXR1cm4ge092ZXJsYXl9XG4gICAqL1xuICB3aGVuUmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuX2JvdW5kcykge1xuICAgICAgY2FsbGJhY2suY2FsbChjb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbmNlKCdsb2FkJywgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICAgKi9cbiAgZ2V0RG9jdW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9ncm91cDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlNjaGVtYXRpY1JlbmRlcmVyfVxuICAgKi9cbiAgZ2V0UmVuZGVyZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9yZW5kZXJlcjtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAgICovXG4gIF9jcmVhdGVDb250ZW50czogZnVuY3Rpb24oc3ZnKSB7XG4gICAgTC5TVkcuY29weVNWR0NvbnRlbnRzKHN2ZywgdGhpcy5fZ3JvdXApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBnZXRPcmlnaW5hbFNpemU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoXG4gICAgICBNYXRoLmFicyhiYm94WzBdIC0gYmJveFsyXSksXG4gICAgICBNYXRoLmFicyhiYm94WzFdIC0gYmJveFszXSlcbiAgICApO1xuICB9LFxuXG5cblxuICAvKipcbiAgICogUG9zaXRpb24gb3VyIFwicmVjdGFuZ2xlXCJcbiAgICovXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbigpIHtcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcblxuICAgIGlmICh0aGlzLl9ncm91cCkge1xuICAgICAgdmFyIHRvcExlZnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2JvdW5kcy5nZXROb3J0aFdlc3QoKSk7XG4gICAgICAvLyBzY2FsZSBpcyBzY2FsZSBmYWN0b3IsIHpvb20gaXMgem9vbSBsZXZlbFxuICAgICAgdmFyIHNjYWxlICAgPSB0aGlzLl9tYXAub3B0aW9ucy5jcnMuc2NhbGUoXG4gICAgICAgIHRoaXMuX21hcC5nZXRab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkgKiB0aGlzLl9yYXRpbztcblxuICAgICAgLy90b3BMZWZ0ID0gdG9wTGVmdC5zdWJ0cmFjdCh0aGlzLl92aWV3Qm94T2Zmc2V0Lm11bHRpcGx5Qnkoc2NhbGUpKTtcblxuICAgICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgICAgdGhpcy5fZ3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyhcbiAgICAgICAgICB0b3BMZWZ0LnN1YnRyYWN0KHRoaXMuX3ZpZXdCb3hPZmZzZXQubXVsdGlwbHlCeShzY2FsZSkpLCBzY2FsZSkpO1xuXG4gICAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgICAgdGhpcy5fcmVkcmF3Q2FudmFzKHRvcExlZnQsIHNjYWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBGUk9NIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF91bnNjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5kaXZpZGVCeSh0aGlzLl9yYXRpbykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgVE8gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3NjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcbiAgICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB0KS5tdWx0aXBseUJ5KHRoaXMuX3JhdGlvKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TnVtYmVyfVxuICAgKi9cbiAgZ2V0UmF0aW86IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9yYXRpbztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbWFwIGNvb3JkIHRvIHNjaGVtYXRpYyBwb2ludFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gY29vcmRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIHByb2plY3RQb2ludDogZnVuY3Rpb24oY29vcmQpIHtcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xuICAgIHJldHVybiB0aGlzLl91bnNjYWxlUG9pbnQobWFwLnByb2plY3QoXG4gICAgICBjb29yZCwgbWFwLmdldE1pblpvb20oKSArIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICB1bnByb2plY3RQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xuICAgIHJldHVybiBtYXAudW5wcm9qZWN0KFxuICAgICAgdGhpcy5fc2NhbGVQb2ludChwdCksIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5Cb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAgICovXG4gIHVucHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgdmFyIHN3ID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWluKTtcbiAgICB2YXIgbmUgPSB0aGlzLnVucHJvamVjdFBvaW50KGJvdW5kcy5tYXgpO1xuICAgIHJldHVybiBMLmxhdExuZ0JvdW5kcyhzdywgbmUpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBsYXllckJvdW5kcyB0byBzY2hlbWF0aWMgYmJveFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxuICAgKi9cbiAgcHJvamVjdEJvdW5kczogZnVuY3Rpb24oYm91bmRzKSB7XG4gICAgcmV0dXJuIG5ldyBMLkJvdW5kcyhcbiAgICAgIHRoaXMucHJvamVjdFBvaW50KGJvdW5kcy5nZXRTb3V0aFdlc3QoKSksXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0Tm9ydGhFYXN0KCkpXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gc3RyaW5nXG4gICAqIEBwYXJhbSAge0Jvb2xlYW49fSBvdmVybGF5c09ubHlcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudHxTdHJpbmd9XG4gICAqL1xuICBleHBvcnRTVkc6IGZ1bmN0aW9uKHN0cmluZywgb3ZlcmxheXNPbmx5KSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLl9yZW5kZXJlci5leHBvcnRTVkcob3ZlcmxheXNPbmx5KTtcbiAgICByZXR1cm4gc3RyaW5nID8gbm9kZS5vdXRlckhUTUwgOiBub2RlO1xuICB9LFxuXG5cbiAgIC8qKlxuICAgKiBSYXN0ZXJpemVzIHRoZSBzY2hlbWF0aWNcbiAgICogQHJldHVybiB7U2NoZW1hdGljfVxuICAgKi9cbiAgdG9JbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuXG4gICAgLy8gdGhpcyBkb2Vzbid0IHdvcmsgaW4gSUUsIGZvcmNlIHNpemVcbiAgICAvLyBpbWcuc3R5bGUuaGVpZ2h0ID0gaW1nLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGltZy5zdHlsZS53aWR0aCAgPSB0aGlzLl9zaXplLnggKyAncHgnO1xuICAgIGltZy5zdHlsZS5oZWlnaHQgPSB0aGlzLl9zaXplLnkgKyAncHgnO1xuICAgIGltZy5zcmMgPSB0aGlzLnRvQmFzZTY0KCk7XG5cbiAgICAvLyBoYWNrIHRvIHRyaWNrIElFIHJlbmRlcmluZyBlbmdpbmVcbiAgICBMLkRvbUV2ZW50Lm9uKGltZywgJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBMLnBvaW50KGltZy5vZmZzZXRXaWR0aCwgaW1nLm9mZnNldEhlaWdodCk7XG4gICAgICB0aGlzLl9yZXNldCgpO1xuICAgIH0sIHRoaXMpO1xuICAgIGltZy5zdHlsZS5vcGFjaXR5ID0gMDtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3Jhc3Rlcik7XG4gICAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhpbWcsICdzY2hlbWF0aWMtaW1hZ2UnKTtcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcbiAgICAgIC5pbnNlcnRCZWZvcmUoaW1nLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyKTtcbiAgICB0aGlzLl9yYXN0ZXIgPSBpbWc7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ29udmVydCBTVkcgZGF0YSB0byBiYXNlNjQgZm9yIHJhc3Rlcml6YXRpb25cbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcbiAgICovXG4gIHRvQmFzZTY0OiBmdW5jdGlvbigpIHtcbiAgICAvLyBjb25zb2xlLnRpbWUoJ2Jhc2U2NCcpO1xuICAgIHZhciBiYXNlNjQgPSB0aGlzLl9iYXNlNjRlbmNvZGVkIHx8XG4gICAgICBiNjQuYnRvYSh1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcHJvY2Vzc2VkRGF0YSkpKTtcbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gYmFzZTY0O1xuICAgIC8vIGNvbnNvbGUudGltZUVuZCgnYmFzZTY0Jyk7XG5cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZWRyYXcgY2FudmFzIG9uIHJlYWwgY2hhbmdlczogem9vbSwgdmlld3Jlc2V0XG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcbiAgICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAgICovXG4gIF9yZWRyYXdDYW52YXM6IGZ1bmN0aW9uKHRvcExlZnQsIHNjYWxlKSB7XG4gICAgaWYgKCF0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG4gICAgdmFyIGN0eCA9IHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jdHg7XG5cbiAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fcmFzdGVyLCB0b3BMZWZ0LngsIHRvcExlZnQueSwgc2l6ZS54LCBzaXplLnkpO1xuICAgIH0sIHRoaXMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xuICAgKi9cbiAgX3Nob3dSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICAgIHRoaXMuX2dyb3VwLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU3dhcCBiYWNrIHRvIFNWR1xuICAgKi9cbiAgX2hpZGVSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogSUUtb25seVxuICAgKiBSZXBsYWNlIFNWRyB3aXRoIGNhbnZhcyBiZWZvcmUgZHJhZ1xuICAgKi9cbiAgX29uUHJlRHJhZzogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLy8gYWxpYXNlc1xuTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3QgICA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0UG9pbnQ7XG5MLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0ID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnVucHJvamVjdFBvaW50O1xuXG5cbi8qKlxuICogRmFjdG9yeVxuICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY31cbiAqL1xuTC5zY2hlbWF0aWMgPSBmdW5jdGlvbiAoc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpYyhzdmcsIGJvdW5kcywgb3B0aW9ucyk7XG59O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8vIDx1c2U+IHRhZ3MgYXJlIGJyb2tlbiBpbiBJRSBpbiBzbyBtYW55IHdheXNcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiBnbG9iYWwpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnRJbnN0YW5jZS5wcm90b3R5cGUsICdjbGFzc05hbWUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWwgPSB2YWw7XG4gICAgfVxuICB9KTtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAgeyp9ICBvXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5MLkRvbVV0aWwuaXNOb2RlID0gZnVuY3Rpb24obyl7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIE5vZGUgPT09ICdvYmplY3QnID9cbiAgICBvIGluc3RhbmNlb2YgTm9kZSA6XG4gICAgbyAmJiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQkJveCA9IGZ1bmN0aW9uKHN2Zykge1xuICB2YXIgdmlld0JveCA9IHN2Zy5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKTtcbiAgdmFyIGJib3g7XG4gIGlmICh2aWV3Qm94KSB7XG4gICAgYmJveCA9IHZpZXdCb3guc3BsaXQoJyAnKS5tYXAocGFyc2VGbG9hdCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNsb25lID0gc3ZnLmNsb25lTm9kZSh0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAvLyBiYm94ID0gY2xvbmUuZ2V0QkJveCgpO1xuICAgIGJib3ggPSBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhjbG9uZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgcmV0dXJuIGJib3g7XG4gIH1cbiAgcmV0dXJuIFtiYm94WzBdLCBiYm94WzFdLCBiYm94WzBdICsgYmJveFsyXSwgYmJveFsxXSArIGJib3hbM11dO1xufTtcblxuXG4vKipcbiAqIFNpbXBseSBicnV0ZSBmb3JjZTogdGFrZXMgYWxsIHN2ZyBub2RlcywgY2FsY3VsYXRlcyBib3VuZGluZyBib3hcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbmZ1bmN0aW9uIGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKHN2Zykge1xuICB2YXIgYmJveCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcbiAgdmFyIG5vZGVzID0gW10uc2xpY2UuY2FsbChzdmcucXVlcnlTZWxlY3RvckFsbCgnKicpKTtcbiAgdmFyIG1pbiA9IE1hdGgubWluLCBtYXggPSBNYXRoLm1heDtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gbm9kZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xuICAgIGlmIChub2RlLmdldEJCb3gpIHtcbiAgICAgIG5vZGUgPSBub2RlLmdldEJCb3goKTtcblxuICAgICAgYmJveFswXSA9IG1pbihub2RlLngsIGJib3hbMF0pO1xuICAgICAgYmJveFsxXSA9IG1pbihub2RlLnksIGJib3hbMV0pO1xuXG4gICAgICBiYm94WzJdID0gbWF4KG5vZGUueCArIG5vZGUud2lkdGgsIGJib3hbMl0pO1xuICAgICAgYmJveFszXSA9IG1heChub2RlLnkgKyBub2RlLmhlaWdodCwgYmJveFszXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBiYm94O1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIgPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5pbm5lckhUTUwgPSBzdHI7XG4gIHJldHVybiB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUG9pbnR9IHRyYW5zbGF0ZVxuICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZSwgc2NhbGUpIHtcbiAgcmV0dXJuICdtYXRyaXgoJyArXG4gICAgW3NjYWxlLCAwLCAwLCBzY2FsZSwgdHJhbnNsYXRlLngsIHRyYW5zbGF0ZS55XS5qb2luKCcsJykgKyAnKSc7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gICAgICAgICBzdmdcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR8RWxlbWVudH0gY29udGFpbmVyXG4gKi9cbkwuU1ZHLmNvcHlTVkdDb250ZW50cyA9IGZ1bmN0aW9uKHN2ZywgY29udGFpbmVyKSB7XG4gIGlmIChMLkJyb3dzZXIuaWUpIHsgLy8gaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFXG4gICAgdmFyIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgZG8ge1xuICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgfSB3aGlsZShjaGlsZCk7XG4gIH0gZWxzZSB7XG4gICAgY29udGFpbmVyLmlubmVySFRNTCA9IHN2Zy5pbm5lckhUTUw7XG4gIH1cbn07XG4iXX0=
