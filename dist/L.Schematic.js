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
    useRaster: L.Browser.ie || L.Browser.gecko,
    interactive: true
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

    if (L.Browser.gecko) {
      this._container.setAttribute('pointer-events', 'visiblePainted');
    }

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
    useRaster: L.Browser.ie || L.Browser.gecko
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

    if (L.Browser.gecko) {
      this._path.setAttribute('pointer-events', 'none');
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

    this._bbox = L.DomUtil.getSVGBBox(container);

    // fix width cause otherwise rasterzation will break
    var width = this._bbox[2] - this._bbox[0];
    var height = this._bbox[3] - this._bbox[1];
    if (parseFloat(this._initialWidth) !== width || parseFloat(this._initialHeight) !== height) {
      container.setAttribute('width', width);
      container.setAttribute('height', height);
    }

    this._rawData = svgString;
    this._processedData = serializer.serializeToString(doc);

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
    img.style.zIndex = -9999;
    img.style.pointerEvents = 'none';

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
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var L = require('leaflet');

// <use> tags are broken in IE in so many ways
if ('SVGElementInstance' in window) {
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

},{"leaflet":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGlCQUFSLENBQWpCOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBUjs7Ozs7QUFLQSxFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLE1BQW5CLEdBQTRCLFlBQVc7QUFDckMsU0FBTyxDQUFDLEtBQUssR0FBTCxDQUFTLENBQVYsRUFBYSxLQUFLLEdBQUwsQ0FBUyxDQUF0QixFQUF5QixLQUFLLEdBQUwsQ0FBUyxDQUFsQyxFQUFxQyxLQUFLLEdBQUwsQ0FBUyxDQUE5QyxDQUFQO0FBQ0QsQ0FGRDs7Ozs7O0FBU0EsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBZjtBQUNBLE1BQUksTUFB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cEQsQ0FESyxHQUNzRCxHQUQ3RDtBQUVELENBSEQ7Ozs7OztBQVVBLEVBQUUsR0FBRixDQUFNLGVBQU4sR0FBd0IsVUFBUyxHQUFULEVBQWMsU0FBZCxFQUF5QjtBQUMvQyxNQUFJLEVBQUUsT0FBRixDQUFVLEVBQWQsRUFBa0I7O0FBQ2hCLFFBQUksUUFBUSxJQUFJLFVBQWhCO0FBQ0EsT0FBRztBQUNELGdCQUFVLFdBQVYsQ0FBc0IsS0FBdEI7QUFDQSxjQUFRLElBQUksVUFBWjtBQUNELEtBSEQsUUFHUSxLQUhSO0FBSUQsR0FORCxNQU1PO0FBQ0wsY0FBVSxTQUFWLEdBQXNCLElBQUksU0FBMUI7QUFDRDtBQUNGLENBVkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9zY2hlbWF0aWMnKTtcbiIsIjsoZnVuY3Rpb24gKCkge1xuXG4gIHZhciBvYmplY3QgPSB0eXBlb2YgZXhwb3J0cyAhPSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiB0aGlzOyAvLyAjODogd2ViIHdvcmtlcnNcbiAgdmFyIGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky89JztcblxuICBmdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gIH1cbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbiAgSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ludmFsaWRDaGFyYWN0ZXJFcnJvcic7XG5cbiAgLy8gZW5jb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vOTk5MTY2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL25pZ25hZ11cbiAgb2JqZWN0LmJ0b2EgfHwgKFxuICBvYmplY3QuYnRvYSA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpO1xuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlclxuICAgICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnMsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgICAgLy8gICBjaGFuZ2UgdGhlIG1hcHBpbmcgdGFibGUgdG8gXCI9XCJcbiAgICAgIC8vICAgY2hlY2sgaWYgZCBoYXMgbm8gZnJhY3Rpb25hbCBkaWdpdHNcbiAgICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQoNjMgJiBibG9jayA+PiA4IC0gaWR4ICUgMSAqIDgpXG4gICAgKSB7XG4gICAgICBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGlkeCArPSAzLzQpO1xuICAgICAgaWYgKGNoYXJDb2RlID4gMHhGRikge1xuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2J0b2EnIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBlbmNvZGVkIGNvbnRhaW5zIGNoYXJhY3RlcnMgb3V0c2lkZSBvZiB0aGUgTGF0aW4xIHJhbmdlLlwiKTtcbiAgICAgIH1cbiAgICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgb2JqZWN0LmF0b2IgfHwgKFxuICBvYmplY3QuYXRvYiA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoaW5wdXQpLnJlcGxhY2UoLz0rJC8sICcnKTtcbiAgICBpZiAoc3RyLmxlbmd0aCAlIDQgPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdChpZHgrKyk7XG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI1NSAmIGJzID4+ICgtMiAqIGJjICYgNikpIDogMFxuICAgICkge1xuICAgICAgLy8gdHJ5IHRvIGZpbmQgY2hhcmFjdGVyIGluIHRhYmxlICgwLTYzLCBub3QgZm91bmQgPT4gLTEpXG4gICAgICBidWZmZXIgPSBjaGFycy5pbmRleE9mKGJ1ZmZlcik7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG59KCkpO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG1heCA9IHRoaXMubWF4O1xuICB2YXIgbWluID0gdGhpcy5taW47XG4gIHZhciBkZWx0YVggPSAoKG1heC54IC0gbWluLngpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobWF4LnkgLSBtaW4ueSkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5Cb3VuZHMoW1xuICAgIFttaW4ueCAtIGRlbHRhWCwgbWluLnkgLSBkZWx0YVldLFxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXG4gIF0pO1xufTtcblxuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcbiAgdmFyIHN3ID0gdGhpcy5fc291dGhXZXN0O1xuICB2YXIgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkxhdExuZ0JvdW5kcyhbXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcbiAgICBbbmUubGF0ICsgZGVsdGFZLCBuZS5sbmcgKyBkZWx0YVhdXG4gIF0pO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vKipcbiAqIEBjbGFzcyBMLlNjaGVtYXRpY1JlbmRlcmVyXG4gKiBAcGFyYW0gIHtPYmplY3R9XG4gKiBAZXh0ZW5kcyB7TC5TVkd9XG4gKi9cbkwuU2NoZW1hdGljUmVuZGVyZXIgPSBtb2R1bGUuZXhwb3J0cyA9IEwuU1ZHLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIHBhZGRpbmc6IDAuMyxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZSB8fCBMLkJyb3dzZXIuZ2Vja28sXG4gICAgaW50ZXJhY3RpdmU6IHRydWVcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYWRkaXRpb25hbCBjb250YWluZXJzIGZvciB0aGUgdmVjdG9yIGZlYXR1cmVzIHRvIGJlXG4gICAqIHRyYW5zZm9ybWVkIHRvIGxpdmUgaW4gdGhlIHNjaGVtYXRpYyBzcGFjZVxuICAgKi9cbiAgX2luaXRDb250YWluZXI6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5faW5pdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RJbnZlcnRHcm91cCk7XG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RHcm91cCk7XG5cbiAgICBpZiAoTC5Ccm93c2VyLmdlY2tvKSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuc2V0QXR0cmlidXRlKCdwb2ludGVyLWV2ZW50cycsICd2aXNpYmxlUGFpbnRlZCcpO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9jb250YWluZXIsICdzY2hlbWF0aWNzLXJlbmRlcmVyJyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTWFrZSBzdXJlIGxheWVycyBhcmUgbm90IGNsaXBwZWRcbiAgICogQHBhcmFtICB7TC5MYXllcn1cbiAgICovXG4gIF9pbml0UGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBsYXllci5vcHRpb25zLm5vQ2xpcCA9IHRydWU7XG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMsIGxheWVyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBVcGRhdGUgY2FsbCBvbiByZXNpemUsIHJlZHJhdywgem9vbSBjaGFuZ2VcbiAgICovXG4gIF91cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5fdXBkYXRlLmNhbGwodGhpcyk7XG5cbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG4gICAgaWYgKG1hcCAmJiBzY2hlbWF0aWMuX2JvdW5kcyAmJiB0aGlzLl9yb290SW52ZXJ0R3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gbWFwLmxhdExuZ1RvTGF5ZXJQb2ludChzY2hlbWF0aWMuX2JvdW5kcy5nZXROb3J0aFdlc3QoKSk7XG4gICAgICB2YXIgc2NhbGUgICA9IHNjaGVtYXRpYy5fcmF0aW8gKlxuICAgICAgICBtYXAub3B0aW9ucy5jcnMuc2NhbGUobWFwLmdldFpvb20oKSAtIHNjaGVtYXRpYy5vcHRpb25zLnpvb21PZmZzZXQpO1xuXG4gICAgICB0aGlzLl90b3BMZWZ0ID0gdG9wTGVmdDtcbiAgICAgIHRoaXMuX3NjYWxlICAgPSBzY2FsZTtcblxuICAgICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgICAgdGhpcy5fcm9vdEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdCwgc2NhbGUpKTtcblxuICAgICAgdGhpcy5fcm9vdEludmVydEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0Lm11bHRpcGx5QnkoIC0xIC8gc2NhbGUpLCAxIC8gc2NhbGUpKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogMS4gd3JhcCBtYXJrdXAgaW4gYW5vdGhlciA8Zz5cbiAgICogMi4gY3JlYXRlIGEgY2xpcFBhdGggd2l0aCB0aGUgdmlld0JveCByZWN0XG4gICAqIDMuIGFwcGx5IGl0IHRvIHRoZSA8Zz4gYXJvdW5kIGFsbCBtYXJrdXBzXG4gICAqIDQuIHJlbW92ZSBncm91cCBhcm91bmQgc2NoZW1hdGljXG4gICAqIDUuIHJlbW92ZSBpbm5lciBncm91cCBhcm91bmQgbWFya3Vwc1xuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW49fSBvbmx5T3ZlcmxheXNcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGV4cG9ydFNWRzogZnVuY3Rpb24ob25seU92ZXJsYXlzKSB7XG4gICAgdmFyIHNjaGVtYXRpYyA9IHRoaXMub3B0aW9ucy5zY2hlbWF0aWM7XG5cbiAgICAvLyBnbyB0aHJvdWdoIGV2ZXJ5IGxheWVyIGFuZCBtYWtlIHN1cmUgdGhleSdyZSBub3QgY2xpcHBlZFxuICAgIHZhciBzdmcgICAgICAgPSB0aGlzLl9jb250YWluZXIuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgdmFyIGNsaXBQYXRoICAgID0gTC5TVkcuY3JlYXRlKCdjbGlwUGF0aCcpO1xuICAgIHZhciBjbGlwUmVjdCAgICA9IEwuU1ZHLmNyZWF0ZSgncmVjdCcpO1xuICAgIHZhciBjbGlwR3JvdXAgICA9IHN2Zy5sYXN0Q2hpbGQ7XG4gICAgdmFyIGJhc2VDb250ZW50ID0gc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpO1xuICAgIHZhciBkZWZzICAgICAgICA9IGJhc2VDb250ZW50LnF1ZXJ5U2VsZWN0b3IoJ2RlZnMnKTtcblxuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgneCcsICAgICAgc2NoZW1hdGljLl9iYm94WzBdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCAgICAgIHNjaGVtYXRpYy5fYmJveFsxXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd3aWR0aCcsICBzY2hlbWF0aWMuX2Jib3hbMl0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0Jywgc2NoZW1hdGljLl9iYm94WzNdKTtcbiAgICBjbGlwUGF0aC5hcHBlbmRDaGlsZChjbGlwUmVjdCk7XG5cbiAgICB2YXIgY2xpcElkID0gJ3ZpZXdib3hDbGlwLScgKyBMLlV0aWwuc3RhbXAoc2NoZW1hdGljLl9ncm91cCk7XG4gICAgY2xpcFBhdGguc2V0QXR0cmlidXRlKCdpZCcsIGNsaXBJZCk7XG5cbiAgICBpZiAoIWRlZnMgfHwgb25seU92ZXJsYXlzKSB7XG4gICAgICBkZWZzID0gTC5TVkcuY3JlYXRlKCdkZWZzJyk7XG4gICAgICBzdmcuYXBwZW5kQ2hpbGQoZGVmcyk7XG4gICAgfVxuICAgIGRlZnMuYXBwZW5kQ2hpbGQoY2xpcFBhdGgpO1xuICAgIGNsaXBHcm91cC5zZXRBdHRyaWJ1dGUoJ2NsaXAtcGF0aCcsICd1cmwoIycgKyBjbGlwSWQgKyAnKScpO1xuXG4gICAgY2xpcEdyb3VwLmZpcnN0Q2hpbGQuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0aGlzLl90b3BMZWZ0Lm11bHRpcGx5QnkoIC0xIC8gdGhpcy5fc2NhbGUpXG4gICAgICAgIC5hZGQoc2NoZW1hdGljLl92aWV3Qm94T2Zmc2V0KSwgMSAvIHRoaXMuX3NjYWxlKSk7XG4gICAgY2xpcEdyb3VwLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGNsaXBHcm91cCwgJ2NsaXAtZ3JvdXAnKTtcblxuICAgIHN2Zy5zdHlsZS50cmFuc2Zvcm0gPSAnJztcbiAgICBzdmcuc2V0QXR0cmlidXRlKCd2aWV3Qm94Jywgc2NoZW1hdGljLl9iYm94LmpvaW4oJyAnKSk7XG5cbiAgICBpZiAob25seU92ZXJsYXlzKSB7IC8vIGxlYXZlIG9ubHkgbWFya3Vwc1xuICAgICAgYmFzZUNvbnRlbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChiYXNlQ29udGVudCk7XG4gICAgfVxuXG4gICAgdmFyIGRpdiA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICcnKTtcbiAgICAvLyBwdXQgY29udGFpbmVyIGFyb3VuZCB0aGUgY29udGVudHMgYXMgaXQgd2FzXG4gICAgZGl2LmlubmVySFRNTCA9ICgvKFxcPHN2Z1xccysoW14+XSopXFw+KS9naSlcbiAgICAgIC5leGVjKHNjaGVtYXRpYy5fcmF3RGF0YSlbMF0gKyAnPC9zdmc+JztcblxuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIGRpdi5maXJzdENoaWxkKTtcblxuICAgIHJldHVybiBkaXYuZmlyc3RDaGlsZDtcbiAgfVxuXG59KTtcblxuXG4vKipcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XG4gKi9cbkwuc2NoZW1hdGljUmVuZGVyZXIgPSBtb2R1bGUuZXhwb3J0cy5zY2hlbWF0aWNSZW5kZXJlciA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpY1JlbmRlcmVyKG9wdGlvbnMpO1xufTtcblxuIiwidmFyIEwgICAgICAgID0gcmVxdWlyZSgnbGVhZmxldCcpO1xudmFyIGI2NCAgICAgID0gcmVxdWlyZSgnQmFzZTY0Jyk7XG52YXIgUmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyJyk7XG5cbnJlcXVpcmUoJy4vYm91bmRzJyk7XG5yZXF1aXJlKCcuL3V0aWxzJyk7XG5cblxuLyoqXG4gKiBTY2hlbWF0aWMgbGF5ZXIgdG8gd29yayB3aXRoIFNWRyBzY2hlbWF0aWNzIG9yIGJsdWVwcmludHMgaW4gTGVhZmxldFxuICpcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQGxpY2Vuc2UgTUlUXG4gKiBAcHJlc2VydmVcbiAqIEBjbGFzcyBTY2hlbWF0aWNcbiAqIEBleHRlbmRzIHtMLlJlY3RhbmdsZX1cbiAqL1xuTC5TY2hlbWF0aWMgPSBtb2R1bGUuZXhwb3J0cyA9IEwuUmVjdGFuZ2xlLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDAsXG4gICAgZmlsbE9wYWNpdHk6IDAsXG4gICAgd2VpZ2h0OiAxLFxuICAgIGFkanVzdFRvU2NyZWVuOiB0cnVlLFxuXG4gICAgLy8gaGFyZGNvZGUgem9vbSBvZmZzZXQgdG8gc25hcCB0byBzb21lIGxldmVsXG4gICAgem9vbU9mZnNldDogMCxcbiAgICBpbnRlcmFjdGl2ZTogZmFsc2UsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWUgfHwgTC5Ccm93c2VyLmdlY2tvXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyAgICA9IHN2ZztcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWwgc3ZnIHdpZHRoLCBjYXVzZSB3ZSB3aWxsIGhhdmUgdG8gZ2V0IHJpZCBvZiB0aGF0IHRvIG1haW50YWluXG4gICAgICogdGhlIGFzcGVjdCByYXRpb1xuICAgICAqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsV2lkdGggID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWwgc3ZnIGhlaWdodFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9ICcnO1xuXG4gICAgaWYgKCEoYm91bmRzIGluc3RhbmNlb2YgTC5MYXRMbmdCb3VuZHMpKSB7XG4gICAgICBvcHRpb25zID0gYm91bmRzO1xuICAgICAgYm91bmRzID0gbnVsbDtcbiAgICB9XG5cbiAgICBvcHRpb25zLnJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKHtcbiAgICAgIHNjaGVtYXRpYzogdGhpc1xuICAgICAgLy8gcGFkZGluZzogb3B0aW9ucy5wYWRkaW5nIHx8IHRoaXMub3B0aW9ucy5wYWRkaW5nIHx8IDAuMjVcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ0JvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX3JhdGlvID0gMTtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlRyYW5zZm9ybWF0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCgwLCAwKTtcblxuXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xuICAgICAgdGhpcy5fc3ZnID0gbnVsbDtcblxuICAgICAgLyoqXG4gICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XG5cbiAgICAgIGlmICghb3B0aW9ucy5sb2FkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2FudmFzfVxuICAgICAqL1xuICAgIHRoaXMuX2NhbnZhcyA9IG51bGw7XG5cbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKFxuICAgICAgdGhpcywgTC5sYXRMbmdCb3VuZHMoWzAsIDBdLCBbMCwgMF0pLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIGlmICghdGhpcy5fZ3JvdXApIHtcbiAgICAgIHRoaXMuX2dyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgICBMLlV0aWwuc3RhbXAodGhpcy5fZ3JvdXApO1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2dyb3VwLCAnc3ZnLW92ZXJsYXknKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuXG4gICAgaWYgKEwuQnJvd3Nlci5nZWNrbykge1xuICAgICAgdGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdmFyIGNhbnZhc1JlbmRlcmVyID0gbmV3IEwuQ2FudmFzKHt9KS5hZGRUbyhtYXApO1xuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5wYXJlbnROb2RlXG4gICAgICAgIC5pbnNlcnRCZWZvcmUoY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lciwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lcik7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IGNhbnZhc1JlbmRlcmVyO1xuXG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub24oJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fZ3JvdXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9ncm91cCk7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uUmVtb3ZlLmNhbGwodGhpcywgbWFwKTtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcbiAgICAgIG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlXG4gICAgICAgIC5vZmYoJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLl9yZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2Z1N0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBfcmVhZFNWR0RhdGE6IGZ1bmN0aW9uKHN2Z1N0cmluZykge1xuICAgIHZhciBwYXJzZXIgICAgID0gbmV3IERPTVBhcnNlcigpO1xuICAgIHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcblxuICAgIHZhciBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHN2Z1N0cmluZywgJ2FwcGxpY2F0aW9uL3htbCcpO1xuICAgIHZhciBjb250YWluZXIgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgdGhpcy5faW5pdGlhbFdpZHRoICA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3dpZHRoJyk7XG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpO1xuXG4gICAgdGhpcy5fYmJveCA9IEwuRG9tVXRpbC5nZXRTVkdCQm94KGNvbnRhaW5lcik7XG5cbiAgICAvLyBmaXggd2lkdGggY2F1c2Ugb3RoZXJ3aXNlIHJhc3RlcnphdGlvbiB3aWxsIGJyZWFrXG4gICAgdmFyIHdpZHRoICA9IHRoaXMuX2Jib3hbMl0gLSB0aGlzLl9iYm94WzBdO1xuICAgIHZhciBoZWlnaHQgPSB0aGlzLl9iYm94WzNdIC0gdGhpcy5fYmJveFsxXTtcbiAgICBpZiAocGFyc2VGbG9hdCh0aGlzLl9pbml0aWFsV2lkdGgpICE9PSB3aWR0aCB8fFxuICAgICAgcGFyc2VGbG9hdCh0aGlzLl9pbml0aWFsSGVpZ2h0KSAgIT09IGhlaWdodCkge1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAgd2lkdGgpO1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdEYXRhICAgICAgID0gc3ZnU3RyaW5nO1xuICAgIHRoaXMuX3Byb2Nlc3NlZERhdGEgPSBzZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKGRvYyk7XG5cbiAgICBpZiAoY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgdGhpcy5fYmJveC5qb2luKCcgJykpO1xuICAgICAgdGhpcy5fcHJvY2Vzc2VkRGF0YSA9IHRoaXMuX3Byb2Nlc3NlZERhdGEucmVwbGFjZSgnPHN2ZycsXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCInICsgdGhpcy5fYmJveC5qb2luKCcgJykgKyAnXCInKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgaWYgKCF0aGlzLl9tYXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdmcgPSB0aGlzLl9yZWFkU1ZHRGF0YShzdmcpO1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbiAmJiBzaXplLnkgIT09IG1hcFNpemUueSkge1xuICAgICAgdGhpcy5fcmF0aW8gPSBNYXRoLm1pbihtYXBTaXplLnggLyBzaXplLngsIG1hcFNpemUueSAvIHNpemUueSk7XG4gICAgICB0aGlzLm9wdGlvbnMuX3pvb21PZmZzZXQgPSAodGhpcy5fcmF0aW8gPCAxKSA/XG4gICAgICAgIHRoaXMuX3JhdGlvIDogKDEgLSB0aGlzLl9yYXRpbyk7XG4gICAgICAvLyBkaXNtaXNzIHRoYXQgb2Zmc2V0XG4gICAgICB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCA9IDA7XG4gICAgfVxuXG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSBlZGdlcyBvZiB0aGUgaW1hZ2UsIGluIGNvb3JkaW5hdGUgc3BhY2VcbiAgICB0aGlzLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzJdLCBiYm94WzFdXSwgbWluWm9vbSlcbiAgICApLnNjYWxlKHRoaXMuX3JhdGlvKTtcblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCh0aGlzLl9iYm94WzBdLCB0aGlzLl9iYm94WzFdKTtcblxuICAgIHRoaXMuX2NyZWF0ZUNvbnRlbnRzKHN2Zyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoXG4gICAgICB0aGlzLl9ncm91cCwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuXG4gICAgdGhpcy5fbGF0bG5ncyA9IHRoaXMuX2JvdW5kc1RvTGF0TG5ncyh0aGlzLl9ib3VuZHMpO1xuICAgIHRoaXMuX3Jlc2V0KCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy50b0ltYWdlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxuICAgKiBAcmV0dXJuIHtPdmVybGF5fVxuICAgKi9cbiAgd2hlblJlYWR5OiBmdW5jdGlvbihjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICh0aGlzLl9ib3VuZHMpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25jZSgnbG9hZCcsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAgICovXG4gIGdldFJlbmRlcmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVuZGVyZXI7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gICAqL1xuICBfY3JlYXRlQ29udGVudHM6IGZ1bmN0aW9uKHN2Zykge1xuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIHRoaXMuX2dyb3VwKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgZ2V0T3JpZ2luYWxTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgcmV0dXJuIG5ldyBMLlBvaW50KFxuICAgICAgTWF0aC5hYnMoYmJveFswXSAtIGJib3hbMl0pLFxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXG4gICAgKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG91ciBcInJlY3RhbmdsZVwiXG4gICAqL1xuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fZ3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgLy8gc2NhbGUgaXMgc2NhbGUgZmFjdG9yLCB6b29tIGlzIHpvb20gbGV2ZWxcbiAgICAgIHZhciBzY2FsZSAgID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpICogdGhpcy5fcmF0aW87XG5cbiAgICAgIC8vdG9wTGVmdCA9IHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSk7XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgICAgdG9wTGVmdC5zdWJ0cmFjdCh0aGlzLl92aWV3Qm94T2Zmc2V0Lm11bHRpcGx5Qnkoc2NhbGUpKSwgc2NhbGUpKTtcblxuICAgICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICAgIHRoaXMuX3JlZHJhd0NhbnZhcyh0b3BMZWZ0LCBzY2FsZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfdW5zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IFRPIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmF0aW87XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KG1hcC5wcm9qZWN0KFxuICAgICAgY29vcmQsIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gbWFwLnVucHJvamVjdChcbiAgICAgIHRoaXMuX3NjYWxlUG9pbnQocHQpLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1pbik7XG4gICAgdmFyIG5lID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gb3ZlcmxheXNPbmx5XG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR8U3RyaW5nfVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihzdHJpbmcsIG92ZXJsYXlzT25seSkge1xuICAgIHZhciBub2RlID0gdGhpcy5fcmVuZGVyZXIuZXhwb3J0U1ZHKG92ZXJsYXlzT25seSk7XG4gICAgcmV0dXJuIHN0cmluZyA/IG5vZGUub3V0ZXJIVE1MIDogbm9kZTtcbiAgfSxcblxuXG4gICAvKipcbiAgICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIHRvSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblxuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgLy8gaGFjayB0byB0cmljayBJRSByZW5kZXJpbmcgZW5naW5lXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9LCB0aGlzKTtcbiAgICBpbWcuc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgaW1nLnN0eWxlLnpJbmRleCA9IC05OTk5O1xuICAgIGltZy5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgLmluc2VydEJlZm9yZShpbWcsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vIGNvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcbiAgICAgIGI2NC5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9wcm9jZXNzZWREYXRhKSkpO1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSBiYXNlNjQ7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCdiYXNlNjQnKTtcblxuICAgIHJldHVybiAnZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCwnICsgYmFzZTY0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBjYW52YXMgb24gcmVhbCBjaGFuZ2VzOiB6b29tLCB2aWV3cmVzZXRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gdG9wTGVmdFxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2NhbGUpIHtcbiAgICBpZiAoIXRoaXMuX3Jhc3Rlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKS5tdWx0aXBseUJ5KHNjYWxlKTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fY2FudmFzUmVuZGVyZXIuX2N0eDtcblxuICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHRvcExlZnQueCwgdG9wTGVmdC55LCBzaXplLngsIHNpemUueSk7XG4gICAgfSwgdGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVG9nZ2xlIGNhbnZhcyBpbnN0ZWFkIG9mIFNWRyB3aGVuIGRyYWdnaW5nXG4gICAqL1xuICBfc2hvd1Jhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICB0aGlzLl9ncm91cC5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vLyBhbGlhc2VzXG5MLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdCAgID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3RQb2ludDtcbkwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3QgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0UG9pbnQ7XG5cblxuLyoqXG4gKiBGYWN0b3J5XG4gKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljfVxuICovXG5MLnNjaGVtYXRpYyA9IGZ1bmN0aW9uIChzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljKHN2ZywgYm91bmRzLCBvcHRpb25zKTtcbn07XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLy8gPHVzZT4gdGFncyBhcmUgYnJva2VuIGluIElFIGluIHNvIG1hbnkgd2F5c1xuaWYgKCdTVkdFbGVtZW50SW5zdGFuY2UnIGluIHdpbmRvdykge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgTm9kZSA9PT0gJ29iamVjdCcgP1xuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcbiAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICApO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XG4gIHZhciB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICB2YXIgYmJveDtcbiAgaWYgKHZpZXdCb3gpIHtcbiAgICBiYm94ID0gdmlld0JveC5zcGxpdCgnICcpLm1hcChwYXJzZUZsb2F0KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgIC8vIGJib3ggPSBjbG9uZS5nZXRCQm94KCk7XG4gICAgYmJveCA9IGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKGNsb25lKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNsb25lKTtcbiAgICByZXR1cm4gYmJveDtcbiAgfVxuICByZXR1cm4gW2Jib3hbMF0sIGJib3hbMV0sIGJib3hbMF0gKyBiYm94WzJdLCBiYm94WzFdICsgYmJveFszXV07XG59O1xuXG5cbi8qKlxuICogU2ltcGx5IGJydXRlIGZvcmNlOiB0YWtlcyBhbGwgc3ZnIG5vZGVzLCBjYWxjdWxhdGVzIGJvdW5kaW5nIGJveFxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuZnVuY3Rpb24gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoc3ZnKSB7XG4gIHZhciBiYm94ID0gW0luZmluaXR5LCBJbmZpbml0eSwgLUluZmluaXR5LCAtSW5maW5pdHldO1xuICB2YXIgbm9kZXMgPSBbXS5zbGljZS5jYWxsKHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCcqJykpO1xuICB2YXIgbWluID0gTWF0aC5taW4sIG1heCA9IE1hdGgubWF4O1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBub2RlID0gbm9kZXNbaV07XG4gICAgaWYgKG5vZGUuZ2V0QkJveCkge1xuICAgICAgbm9kZSA9IG5vZGUuZ2V0QkJveCgpO1xuXG4gICAgICBiYm94WzBdID0gbWluKG5vZGUueCwgYmJveFswXSk7XG4gICAgICBiYm94WzFdID0gbWluKG5vZGUueSwgYmJveFsxXSk7XG5cbiAgICAgIGJib3hbMl0gPSBtYXgobm9kZS54ICsgbm9kZS53aWR0aCwgYmJveFsyXSk7XG4gICAgICBiYm94WzNdID0gbWF4KG5vZGUueSArIG5vZGUuaGVpZ2h0LCBiYm94WzNdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJib3g7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gZnVuY3Rpb24odHJhbnNsYXRlLCBzY2FsZSkge1xuICByZXR1cm4gJ21hdHJpeCgnICtcbiAgICBbc2NhbGUsIDAsIDAsIHNjYWxlLCB0cmFuc2xhdGUueCwgdHJhbnNsYXRlLnldLmpvaW4oJywnKSArICcpJztcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSAgICAgICAgIHN2Z1xuICogQHBhcmFtICB7U1ZHRWxlbWVudHxFbGVtZW50fSBjb250YWluZXJcbiAqL1xuTC5TVkcuY29weVNWR0NvbnRlbnRzID0gZnVuY3Rpb24oc3ZnLCBjb250YWluZXIpIHtcbiAgaWYgKEwuQnJvd3Nlci5pZSkgeyAvLyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUVcbiAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICBkbyB7XG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICB9IHdoaWxlKGNoaWxkKTtcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgfVxufTtcbiJdfQ==
