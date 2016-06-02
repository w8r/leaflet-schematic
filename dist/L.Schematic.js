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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGlCQUFSLENBQWpCOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBUjs7Ozs7QUFLQSxFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLE1BQW5CLEdBQTRCLFlBQVc7QUFDckMsU0FBTyxDQUFDLEtBQUssR0FBTCxDQUFTLENBQVYsRUFBYSxLQUFLLEdBQUwsQ0FBUyxDQUF0QixFQUF5QixLQUFLLEdBQUwsQ0FBUyxDQUFsQyxFQUFxQyxLQUFLLEdBQUwsQ0FBUyxDQUE5QyxDQUFQO0FBQ0QsQ0FGRDs7Ozs7O0FBU0EsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBZjtBQUNBLE1BQUksTUFB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QVYsR0FBNEIsVUFBUyxHQUFULEVBQWM7QUFDeEMsTUFBSSxVQUFVLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFkO0FBQ0EsVUFBUSxTQUFSLEdBQW9CLEdBQXBCO0FBQ0EsU0FBTyxRQUFRLGFBQVIsQ0FBc0IsS0FBdEIsQ0FBUDtBQUNELENBSkQ7Ozs7Ozs7QUFZQSxFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBL0IsRUFBa0MsVUFBVSxDQUE1QyxFQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRDdEO0FBRUQsQ0FIRDs7Ozs7O0FBVUEsRUFBRSxHQUFGLENBQU0sZUFBTixHQUF3QixVQUFTLEdBQVQsRUFBYyxTQUFkLEVBQXlCO0FBQy9DLE1BQUksRUFBRSxPQUFGLENBQVUsRUFBZCxFQUFrQjs7QUFDaEIsUUFBSSxRQUFRLElBQUksVUFBaEI7QUFDQSxPQUFHO0FBQ0QsZ0JBQVUsV0FBVixDQUFzQixLQUF0QjtBQUNBLGNBQVEsSUFBSSxVQUFaO0FBQ0QsS0FIRCxRQUdRLEtBSFI7QUFJRCxHQU5ELE1BTU87QUFDTCxjQUFVLFNBQVYsR0FBc0IsSUFBSSxTQUExQjtBQUNEO0FBQ0YsQ0FWRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3NjaGVtYXRpYycpO1xuIiwiOyhmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBleHBvcnRzICE9ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IHRoaXM7IC8vICM4OiB3ZWIgd29ya2Vyc1xuICB2YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG4gIGZ1bmN0aW9uIEludmFsaWRDaGFyYWN0ZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yO1xuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuICAvLyBlbmNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS85OTkxNjZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vbmlnbmFnXVxuICBvYmplY3QuYnRvYSB8fCAoXG4gIG9iamVjdC5idG9hID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgICApIHtcbiAgICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMvNCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG4gIC8vIGRlY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwMjAzOTZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vYXRrXVxuICBvYmplY3QuYXRvYiB8fCAoXG4gIG9iamVjdC5hdG9iID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCkucmVwbGFjZSgvPSskLywgJycpO1xuICAgIGlmIChzdHIubGVuZ3RoICUgNCA9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2F0b2InIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBkZWNvZGVkIGlzIG5vdCBjb3JyZWN0bHkgZW5jb2RlZC5cIik7XG4gICAgfVxuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlcnNcbiAgICAgIHZhciBiYyA9IDAsIGJzLCBidWZmZXIsIGlkeCA9IDAsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gZ2V0IG5leHQgY2hhcmFjdGVyXG4gICAgICBidWZmZXIgPSBzdHIuY2hhckF0KGlkeCsrKTtcbiAgICAgIC8vIGNoYXJhY3RlciBmb3VuZCBpbiB0YWJsZT8gaW5pdGlhbGl6ZSBiaXQgc3RvcmFnZSBhbmQgYWRkIGl0cyBhc2NpaSB2YWx1ZTtcbiAgICAgIH5idWZmZXIgJiYgKGJzID0gYmMgJSA0ID8gYnMgKiA2NCArIGJ1ZmZlciA6IGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGlmIG5vdCBmaXJzdCBvZiBlYWNoIDQgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gY29udmVydCB0aGUgZmlyc3QgOCBiaXRzIHRvIG9uZSBhc2NpaSBjaGFyYWN0ZXJcbiAgICAgICAgYmMrKyAlIDQpID8gb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjU1ICYgYnMgPj4gKC0yICogYmMgJiA2KSkgOiAwXG4gICAgKSB7XG4gICAgICAvLyB0cnkgdG8gZmluZCBjaGFyYWN0ZXIgaW4gdGFibGUgKDAtNjMsIG5vdCBmb3VuZCA9PiAtMSlcbiAgICAgIGJ1ZmZlciA9IGNoYXJzLmluZGV4T2YoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbn0oKSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMubWluLngsIHRoaXMubWluLnksIHRoaXMubWF4LngsIHRoaXMubWF4LnldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuQm91bmRzfVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbWF4ID0gdGhpcy5tYXg7XG4gIHZhciBtaW4gPSB0aGlzLm1pbjtcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChtYXgueSAtIG1pbi55KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXG4gICAgW21pbi54IC0gZGVsdGFYLCBtaW4ueSAtIGRlbHRhWV0sXG4gICAgW21heC54ICsgZGVsdGFYLCBtYXgueSArIGRlbHRhWV1cbiAgXSk7XG59O1xuXG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XG4gIHZhciBkZWx0YVggPSAoKG5lLmxuZyAtIHN3LmxuZykgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQGNsYXNzIEwuU2NoZW1hdGljUmVuZGVyZXJcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEBleHRlbmRzIHtMLlNWR31cbiAqL1xuTC5TY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzID0gTC5TVkcuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgcGFkZGluZzogMC4zLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllXG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIGFkZGl0aW9uYWwgY29udGFpbmVycyBmb3IgdGhlIHZlY3RvciBmZWF0dXJlcyB0byBiZVxuICAgKiB0cmFuc2Zvcm1lZCB0byBsaXZlIGluIHRoZSBzY2hlbWF0aWMgc3BhY2VcbiAgICovXG4gIF9pbml0Q29udGFpbmVyOiBmdW5jdGlvbigpIHtcbiAgICBMLlNWRy5wcm90b3R5cGUuX2luaXRDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCA9IEwuU1ZHLmNyZWF0ZSgnZycpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9yb290SW52ZXJ0R3JvdXApO1xuICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cC5hcHBlbmRDaGlsZCh0aGlzLl9yb290R3JvdXApO1xuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ3NjaGVtYXRpY3MtcmVuZGVyZXInKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBNYWtlIHN1cmUgbGF5ZXJzIGFyZSBub3QgY2xpcHBlZFxuICAgKiBAcGFyYW0gIHtMLkxheWVyfVxuICAgKi9cbiAgX2luaXRQYXRoOiBmdW5jdGlvbihsYXllcikge1xuICAgIGxheWVyLm9wdGlvbnMubm9DbGlwID0gdHJ1ZTtcbiAgICBMLlNWRy5wcm90b3R5cGUuX2luaXRQYXRoLmNhbGwodGhpcywgbGF5ZXIpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBjYWxsIG9uIHJlc2l6ZSwgcmVkcmF3LCB6b29tIGNoYW5nZVxuICAgKi9cbiAgX3VwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgTC5TVkcucHJvdG90eXBlLl91cGRhdGUuY2FsbCh0aGlzKTtcblxuICAgIHZhciBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG5cbiAgICBpZiAobWFwICYmIHNjaGVtYXRpYy5fYm91bmRzICYmIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCkge1xuICAgICAgdmFyIHRvcExlZnQgPSBtYXAubGF0TG5nVG9MYXllclBvaW50KHNjaGVtYXRpYy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICAgIHZhciBzY2FsZSAgID0gc2NoZW1hdGljLl9yYXRpbyAqXG4gICAgICAgIG1hcC5vcHRpb25zLmNycy5zY2FsZShtYXAuZ2V0Wm9vbSgpIC0gc2NoZW1hdGljLm9wdGlvbnMuem9vbU9mZnNldCk7XG5cbiAgICAgIHRoaXMuX3RvcExlZnQgPSB0b3BMZWZ0O1xuICAgICAgdGhpcy5fc2NhbGUgICA9IHNjYWxlO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9yb290R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0LCBzY2FsZSkpO1xuXG4gICAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQubXVsdGlwbHlCeSggLTEgLyBzY2FsZSksIDEgLyBzY2FsZSkpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiAxLiB3cmFwIG1hcmt1cCBpbiBhbm90aGVyIDxnPlxuICAgKiAyLiBjcmVhdGUgYSBjbGlwUGF0aCB3aXRoIHRoZSB2aWV3Qm94IHJlY3RcbiAgICogMy4gYXBwbHkgaXQgdG8gdGhlIDxnPiBhcm91bmQgYWxsIG1hcmt1cHNcbiAgICogNC4gcmVtb3ZlIGdyb3VwIGFyb3VuZCBzY2hlbWF0aWNcbiAgICogNS4gcmVtb3ZlIGlubmVyIGdyb3VwIGFyb3VuZCBtYXJrdXBzXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbj19IG9ubHlPdmVybGF5c1xuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihvbmx5T3ZlcmxheXMpIHtcbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcblxuICAgIC8vIGdvIHRocm91Z2ggZXZlcnkgbGF5ZXIgYW5kIG1ha2Ugc3VyZSB0aGV5J3JlIG5vdCBjbGlwcGVkXG4gICAgdmFyIHN2ZyAgICAgICA9IHRoaXMuX2NvbnRhaW5lci5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICB2YXIgY2xpcFBhdGggICAgPSBMLlNWRy5jcmVhdGUoJ2NsaXBQYXRoJyk7XG4gICAgdmFyIGNsaXBSZWN0ICAgID0gTC5TVkcuY3JlYXRlKCdyZWN0Jyk7XG4gICAgdmFyIGNsaXBHcm91cCAgID0gc3ZnLmxhc3RDaGlsZDtcbiAgICB2YXIgYmFzZUNvbnRlbnQgPSBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5Jyk7XG4gICAgdmFyIGRlZnMgICAgICAgID0gYmFzZUNvbnRlbnQucXVlcnlTZWxlY3RvcignZGVmcycpO1xuXG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd4JywgICAgICBzY2hlbWF0aWMuX2Jib3hbMF0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgneScsICAgICAgc2NoZW1hdGljLl9iYm94WzFdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgIHNjaGVtYXRpYy5fYmJveFsyXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBzY2hlbWF0aWMuX2Jib3hbM10pO1xuICAgIGNsaXBQYXRoLmFwcGVuZENoaWxkKGNsaXBSZWN0KTtcblxuICAgIHZhciBjbGlwSWQgPSAndmlld2JveENsaXAtJyArIEwuVXRpbC5zdGFtcChzY2hlbWF0aWMuX2dyb3VwKTtcbiAgICBjbGlwUGF0aC5zZXRBdHRyaWJ1dGUoJ2lkJywgY2xpcElkKTtcblxuICAgIGlmICghZGVmcyB8fCBvbmx5T3ZlcmxheXMpIHtcbiAgICAgIGRlZnMgPSBMLlNWRy5jcmVhdGUoJ2RlZnMnKTtcbiAgICAgIHN2Zy5hcHBlbmRDaGlsZChkZWZzKTtcbiAgICB9XG4gICAgZGVmcy5hcHBlbmRDaGlsZChjbGlwUGF0aCk7XG4gICAgY2xpcEdyb3VwLnNldEF0dHJpYnV0ZSgnY2xpcC1wYXRoJywgJ3VybCgjJyArIGNsaXBJZCArICcpJyk7XG5cbiAgICBjbGlwR3JvdXAuZmlyc3RDaGlsZC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRoaXMuX3RvcExlZnQubXVsdGlwbHlCeSggLTEgLyB0aGlzLl9zY2FsZSlcbiAgICAgICAgLmFkZChzY2hlbWF0aWMuX3ZpZXdCb3hPZmZzZXQpLCAxIC8gdGhpcy5fc2NhbGUpKTtcbiAgICBjbGlwR3JvdXAucmVtb3ZlQXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcbiAgICBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5JykucmVtb3ZlQXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoY2xpcEdyb3VwLCAnY2xpcC1ncm91cCcpO1xuXG4gICAgc3ZnLnN0eWxlLnRyYW5zZm9ybSA9ICcnO1xuICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBzY2hlbWF0aWMuX2Jib3guam9pbignICcpKTtcblxuICAgIGlmIChvbmx5T3ZlcmxheXMpIHsgLy8gbGVhdmUgb25seSBtYXJrdXBzXG4gICAgICBiYXNlQ29udGVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGJhc2VDb250ZW50KTtcbiAgICB9XG5cbiAgICB2YXIgZGl2ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJycpO1xuICAgIC8vIHB1dCBjb250YWluZXIgYXJvdW5kIHRoZSBjb250ZW50cyBhcyBpdCB3YXNcbiAgICBkaXYuaW5uZXJIVE1MID0gKC8oXFw8c3ZnXFxzKyhbXj5dKilcXD4pL2dpKVxuICAgICAgLmV4ZWMoc2NoZW1hdGljLl9yYXdEYXRhKVswXSArICc8L3N2Zz4nO1xuXG4gICAgTC5TVkcuY29weVNWR0NvbnRlbnRzKHN2ZywgZGl2LmZpcnN0Q2hpbGQpO1xuXG4gICAgcmV0dXJuIGRpdi5maXJzdENoaWxkO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAqL1xuTC5zY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzLnNjaGVtYXRpY1JlbmRlcmVyID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljUmVuZGVyZXIob3B0aW9ucyk7XG59O1xuXG4iLCJ2YXIgTCAgICAgICAgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcbnZhciBSZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXInKTtcblxucmVxdWlyZSgnLi9ib3VuZHMnKTtcbnJlcXVpcmUoJy4vdXRpbHMnKTtcblxuXG4vKipcbiAqIFNjaGVtYXRpYyBsYXllciB0byB3b3JrIHdpdGggU1ZHIHNjaGVtYXRpY3Mgb3IgYmx1ZXByaW50cyBpbiBMZWFmbGV0XG4gKlxuICogQGF1dGhvciBBbGV4YW5kZXIgTWlsZXZza2kgPGluZm9AdzhyLm5hbWU+XG4gKiBAbGljZW5zZSBNSVRcbiAqIEBwcmVzZXJ2ZVxuICogQGNsYXNzIFNjaGVtYXRpY1xuICogQGV4dGVuZHMge0wuUmVjdGFuZ2xlfVxuICovXG5MLlNjaGVtYXRpYyA9IG1vZHVsZS5leHBvcnRzID0gTC5SZWN0YW5nbGUuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgb3BhY2l0eTogMCxcbiAgICBmaWxsT3BhY2l0eTogMCxcbiAgICB3ZWlnaHQ6IDEsXG4gICAgYWRqdXN0VG9TY3JlZW46IHRydWUsXG5cbiAgICAvLyBoYXJkY29kZSB6b29tIG9mZnNldCB0byBzbmFwIHRvIHNvbWUgbGV2ZWxcbiAgICB6b29tT2Zmc2V0OiAwLFxuICAgIGludGVyYWN0aXZlOiBmYWxzZSxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9zdmcgICAgPSBzdmc7XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsIHN2ZyB3aWR0aCwgY2F1c2Ugd2Ugd2lsbCBoYXZlIHRvIGdldCByaWQgb2YgdGhhdCB0byBtYWludGFpblxuICAgICAqIHRoZSBhc3BlY3QgcmF0aW9cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5faW5pdGlhbFdpZHRoICA9ICcnO1xuXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsIHN2ZyBoZWlnaHRcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxIZWlnaHQgPSAnJztcblxuICAgIGlmICghKGJvdW5kcyBpbnN0YW5jZW9mIEwuTGF0TG5nQm91bmRzKSkge1xuICAgICAgb3B0aW9ucyA9IGJvdW5kcztcbiAgICAgIGJvdW5kcyA9IG51bGw7XG4gICAgfVxuXG4gICAgb3B0aW9ucy5yZW5kZXJlciA9IG5ldyBSZW5kZXJlcih7XG4gICAgICBzY2hlbWF0aWM6IHRoaXNcbiAgICAgIC8vIHBhZGRpbmc6IG9wdGlvbnMucGFkZGluZyB8fCB0aGlzLm9wdGlvbnMucGFkZGluZyB8fCAwLjI1XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5MYXRMbmdCb3VuZHN9XG4gICAgICovXG4gICAgdGhpcy5fYm91bmRzID0gYm91bmRzO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge051bWJlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXRpbyA9IDE7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3NpemUgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9vcmlnaW4gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5UcmFuc2Zvcm1hdGlvbn1cbiAgICAgKi9cbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9ICcnO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3Jhd0RhdGEgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fdmlld0JveE9mZnNldCA9IEwucG9pbnQoMCwgMCk7XG5cblxuICAgIGlmICh0eXBlb2Ygc3ZnID09PSAnc3RyaW5nJyAmJiAhL1xcPHN2Zy9pZy50ZXN0KHN2ZykpIHtcbiAgICAgIHRoaXMuX3N2ZyA9IG51bGw7XG5cbiAgICAgIC8qKlxuICAgICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgICAqL1xuICAgICAgdGhpcy5fdXJsID0gc3ZnO1xuXG4gICAgICBpZiAoIW9wdGlvbnMubG9hZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NWR092ZXJsYXkgcmVxdWlyZXMgZXh0ZXJuYWwgcmVxdWVzdCBpbXBsZW1lbnRhdGlvbi4gJytcbiAgICAgICAgICAnWW91IGhhdmUgdG8gcHJvdmlkZSBgbG9hZGAgZnVuY3Rpb24gd2l0aCB0aGUgb3B0aW9ucycpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuQ2FudmFzfVxuICAgICAqL1xuICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXMgPSBudWxsO1xuXG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbChcbiAgICAgIHRoaXMsIEwubGF0TG5nQm91bmRzKFswLCAwXSwgWzAsIDBdKSwgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG5cbiAgICBpZiAoIXRoaXMuX2dyb3VwKSB7XG4gICAgICB0aGlzLl9ncm91cCA9IEwuU1ZHLmNyZWF0ZSgnZycpO1xuICAgICAgTC5VdGlsLnN0YW1wKHRoaXMuX2dyb3VwKTtcbiAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9ncm91cCwgJ3N2Zy1vdmVybGF5Jyk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9zdmcpIHtcbiAgICAgIHRoaXMubG9hZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uTG9hZCh0aGlzLl9zdmcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB2YXIgY2FudmFzUmVuZGVyZXIgPSBuZXcgTC5DYW52YXMoe30pLmFkZFRvKG1hcCk7XG4gICAgICBjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcbiAgICAgICAgLmluc2VydEJlZm9yZShjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyKTtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyID0gY2FudmFzUmVuZGVyZXI7XG5cbiAgICAgIG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlXG4gICAgICAgIC5vbigncHJlZHJhZycsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgICAgLm9uKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLl9ncm91cC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX2dyb3VwKTtcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcbiAgICAgICAgLm9mZigncHJlZHJhZycsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgICAgLm9mZignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG4gICAgfVxuICAgIHRoaXMuX3JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxuICAgKi9cbiAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5vbkxvYWQoc3ZnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnU3RyaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIF9yZWFkU1ZHRGF0YTogZnVuY3Rpb24oc3ZnU3RyaW5nKSB7XG4gICAgdmFyIHBhcnNlciAgICAgPSBuZXcgRE9NUGFyc2VyKCk7XG4gICAgdmFyIHNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuXG4gICAgdmFyIGRvYyA9IHBhcnNlci5wYXJzZUZyb21TdHJpbmcoc3ZnU3RyaW5nLCAnYXBwbGljYXRpb24veG1sJyk7XG4gICAgdmFyIGNvbnRhaW5lciA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICB0aGlzLl9pbml0aWFsV2lkdGggID0gY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnd2lkdGgnKTtcbiAgICB0aGlzLl9pbml0aWFsSGVpZ2h0ID0gY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnaGVpZ2h0Jyk7XG5cbiAgICBjb250YWluZXIucmVtb3ZlQXR0cmlidXRlKCd3aWR0aCcpO1xuICAgIGNvbnRhaW5lci5yZW1vdmVBdHRyaWJ1dGUoJ2hlaWdodCcpO1xuXG4gICAgdGhpcy5fcmF3RGF0YSAgICAgICA9IHN2Z1N0cmluZztcbiAgICB0aGlzLl9wcm9jZXNzZWREYXRhID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhkb2MpO1xuXG4gICAgdGhpcy5fYmJveCA9IEwuRG9tVXRpbC5nZXRTVkdCQm94KGNvbnRhaW5lcik7XG5cbiAgICBpZiAoY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgdGhpcy5fYmJveC5qb2luKCcgJykpO1xuICAgICAgdGhpcy5fcHJvY2Vzc2VkRGF0YSA9IHRoaXMuX3Byb2Nlc3NlZERhdGEucmVwbGFjZSgnPHN2ZycsXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCInICsgdGhpcy5fYmJveC5qb2luKCcgJykgKyAnXCInKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgaWYgKCF0aGlzLl9tYXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdmcgPSB0aGlzLl9yZWFkU1ZHRGF0YShzdmcpO1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbiAmJiBzaXplLnkgIT09IG1hcFNpemUueSkge1xuICAgICAgdGhpcy5fcmF0aW8gPSBNYXRoLm1pbihtYXBTaXplLnggLyBzaXplLngsIG1hcFNpemUueSAvIHNpemUueSk7XG4gICAgICB0aGlzLm9wdGlvbnMuX3pvb21PZmZzZXQgPSAodGhpcy5fcmF0aW8gPCAxKSA/XG4gICAgICAgIHRoaXMuX3JhdGlvIDogKDEgLSB0aGlzLl9yYXRpbyk7XG4gICAgICAvLyBkaXNtaXNzIHRoYXQgb2Zmc2V0XG4gICAgICB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCA9IDA7XG4gICAgfVxuXG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSBlZGdlcyBvZiB0aGUgaW1hZ2UsIGluIGNvb3JkaW5hdGUgc3BhY2VcbiAgICB0aGlzLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzJdLCBiYm94WzFdXSwgbWluWm9vbSlcbiAgICApLnNjYWxlKHRoaXMuX3JhdGlvKTtcblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCh0aGlzLl9iYm94WzBdLCB0aGlzLl9iYm94WzFdKTtcblxuICAgIHRoaXMuX2NyZWF0ZUNvbnRlbnRzKHN2Zyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoXG4gICAgICB0aGlzLl9ncm91cCwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuXG4gICAgdGhpcy5fbGF0bG5ncyA9IHRoaXMuX2JvdW5kc1RvTGF0TG5ncyh0aGlzLl9ib3VuZHMpO1xuICAgIHRoaXMuX3Jlc2V0KCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy50b0ltYWdlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxuICAgKiBAcmV0dXJuIHtPdmVybGF5fVxuICAgKi9cbiAgd2hlblJlYWR5OiBmdW5jdGlvbihjYWxsYmFjaywgY29udGV4dCkge1xuICAgIGlmICh0aGlzLl9ib3VuZHMpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25jZSgnbG9hZCcsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAgICovXG4gIGdldFJlbmRlcmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVuZGVyZXI7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gICAqL1xuICBfY3JlYXRlQ29udGVudHM6IGZ1bmN0aW9uKHN2Zykge1xuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIHRoaXMuX2dyb3VwKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgZ2V0T3JpZ2luYWxTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgcmV0dXJuIG5ldyBMLlBvaW50KFxuICAgICAgTWF0aC5hYnMoYmJveFswXSAtIGJib3hbMl0pLFxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXG4gICAgKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG91ciBcInJlY3RhbmdsZVwiXG4gICAqL1xuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fZ3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgLy8gc2NhbGUgaXMgc2NhbGUgZmFjdG9yLCB6b29tIGlzIHpvb20gbGV2ZWxcbiAgICAgIHZhciBzY2FsZSAgID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpICogdGhpcy5fcmF0aW87XG5cbiAgICAgIC8vdG9wTGVmdCA9IHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSk7XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgICAgdG9wTGVmdC5zdWJ0cmFjdCh0aGlzLl92aWV3Qm94T2Zmc2V0Lm11bHRpcGx5Qnkoc2NhbGUpKSwgc2NhbGUpKTtcblxuICAgICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICAgIHRoaXMuX3JlZHJhd0NhbnZhcyh0b3BMZWZ0LCBzY2FsZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfdW5zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IFRPIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmF0aW87XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KG1hcC5wcm9qZWN0KFxuICAgICAgY29vcmQsIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gbWFwLnVucHJvamVjdChcbiAgICAgIHRoaXMuX3NjYWxlUG9pbnQocHQpLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1pbik7XG4gICAgdmFyIG5lID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gb3ZlcmxheXNPbmx5XG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR8U3RyaW5nfVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihzdHJpbmcsIG92ZXJsYXlzT25seSkge1xuICAgIHZhciBub2RlID0gdGhpcy5fcmVuZGVyZXIuZXhwb3J0U1ZHKG92ZXJsYXlzT25seSk7XG4gICAgcmV0dXJuIHN0cmluZyA/IG5vZGUub3V0ZXJIVE1MIDogbm9kZTtcbiAgfSxcblxuXG4gICAvKipcbiAgICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIHRvSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblxuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgLy8gaGFjayB0byB0cmljayBJRSByZW5kZXJpbmcgZW5naW5lXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9LCB0aGlzKTtcbiAgICBpbWcuc3R5bGUub3BhY2l0eSA9IDA7XG5cbiAgICBpZiAodGhpcy5fcmFzdGVyKSB7XG4gICAgICB0aGlzLl9yYXN0ZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9yYXN0ZXIpO1xuICAgICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoaW1nLCAnc2NoZW1hdGljLWltYWdlJyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5wYXJlbnROb2RlXG4gICAgICAuaW5zZXJ0QmVmb3JlKGltZywgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lcik7XG4gICAgdGhpcy5fcmFzdGVyID0gaW1nO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENvbnZlcnQgU1ZHIGRhdGEgdG8gYmFzZTY0IGZvciByYXN0ZXJpemF0aW9uXG4gICAqIEByZXR1cm4ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgU1ZHXG4gICAqL1xuICB0b0Jhc2U2NDogZnVuY3Rpb24oKSB7XG4gICAgLy8gY29uc29sZS50aW1lKCdiYXNlNjQnKTtcbiAgICB2YXIgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Byb2Nlc3NlZERhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuICdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LCcgKyBiYXNlNjQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IGNhbnZhcyBvbiByZWFsIGNoYW5nZXM6IHpvb20sIHZpZXdyZXNldFxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSB0b3BMZWZ0XG4gICAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gICAqL1xuICBfcmVkcmF3Q2FudmFzOiBmdW5jdGlvbih0b3BMZWZ0LCBzY2FsZSkge1xuICAgIGlmICghdGhpcy5fcmFzdGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNpemUgPSB0aGlzLmdldE9yaWdpbmFsU2l6ZSgpLm11bHRpcGx5Qnkoc2NhbGUpO1xuICAgIHZhciBjdHggPSB0aGlzLl9jYW52YXNSZW5kZXJlci5fY3R4O1xuXG4gICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICBjdHguZHJhd0ltYWdlKHRoaXMuX3Jhc3RlciwgdG9wTGVmdC54LCB0b3BMZWZ0LnksIHNpemUueCwgc2l6ZS55KTtcbiAgICB9LCB0aGlzKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUb2dnbGUgY2FudmFzIGluc3RlYWQgb2YgU1ZHIHdoZW4gZHJhZ2dpbmdcbiAgICovXG4gIF9zaG93UmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgICB0aGlzLl9ncm91cC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN3YXAgYmFjayB0byBTVkdcbiAgICovXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICAgIHRoaXMuX2dyb3VwLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIElFLW9ubHlcbiAgICogUmVwbGFjZSBTVkcgd2l0aCBjYW52YXMgYmVmb3JlIGRyYWdcbiAgICovXG4gIF9vblByZURyYWc6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9zaG93UmFzdGVyKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIERyYWcgZW5kOiBwdXQgU1ZHIGJhY2sgaW4gSUVcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9oaWRlUmFzdGVyKCk7XG4gICAgfVxuICB9XG5cbn0pO1xuXG5cbi8vIGFsaWFzZXNcbkwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0ICAgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdFBvaW50O1xuTC5TY2hlbWF0aWMucHJvdG90eXBlLnVucHJvamVjdCA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3RQb2ludDtcblxuXG4vKipcbiAqIEZhY3RvcnlcbiAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICogQHJldHVybiB7TC5TY2hlbWF0aWN9XG4gKi9cbkwuc2NoZW1hdGljID0gZnVuY3Rpb24gKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTC5TY2hlbWF0aWMoc3ZnLCBib3VuZHMsIG9wdGlvbnMpO1xufTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vLyA8dXNlPiB0YWdzIGFyZSBicm9rZW4gaW4gSUUgaW4gc28gbWFueSB3YXlzXG5pZiAoJ1NWR0VsZW1lbnRJbnN0YW5jZScgaW4gd2luZG93KSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTVkdFbGVtZW50SW5zdGFuY2UucHJvdG90eXBlLCAnY2xhc3NOYW1lJywge1xuICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsID0gdmFsO1xuICAgIH1cbiAgfSk7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHsqfSAgb1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuTC5Eb21VdGlsLmlzTm9kZSA9IGZ1bmN0aW9uKG8pe1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBOb2RlID09PSAnb2JqZWN0JyA/XG4gICAgbyBpbnN0YW5jZW9mIE5vZGUgOlxuICAgIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG8ubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIG8ubm9kZU5hbWUgPT09ICdzdHJpbmcnXG4gICk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0JCb3ggPSBmdW5jdGlvbihzdmcpIHtcbiAgdmFyIHZpZXdCb3ggPSBzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94Jyk7XG4gIHZhciBiYm94O1xuICBpZiAodmlld0JveCkge1xuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xuICB9IGVsc2Uge1xuICAgIHZhciBjbG9uZSA9IHN2Zy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG4gICAgLy8gYmJveCA9IGNsb25lLmdldEJCb3goKTtcbiAgICBiYm94ID0gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoY2xvbmUpO1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY2xvbmUpO1xuICAgIHJldHVybiBiYm94O1xuICB9XG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbn07XG5cblxuLyoqXG4gKiBTaW1wbHkgYnJ1dGUgZm9yY2U6IHRha2VzIGFsbCBzdmcgbm9kZXMsIGNhbGN1bGF0ZXMgYm91bmRpbmcgYm94XG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5mdW5jdGlvbiBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhzdmcpIHtcbiAgdmFyIGJib3ggPSBbSW5maW5pdHksIEluZmluaXR5LCAtSW5maW5pdHksIC1JbmZpbml0eV07XG4gIHZhciBub2RlcyA9IFtdLnNsaWNlLmNhbGwoc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJyonKSk7XG4gIHZhciBtaW4gPSBNYXRoLm1pbiwgbWF4ID0gTWF0aC5tYXg7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IG5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcbiAgICBpZiAobm9kZS5nZXRCQm94KSB7XG4gICAgICBub2RlID0gbm9kZS5nZXRCQm94KCk7XG5cbiAgICAgIGJib3hbMF0gPSBtaW4obm9kZS54LCBiYm94WzBdKTtcbiAgICAgIGJib3hbMV0gPSBtaW4obm9kZS55LCBiYm94WzFdKTtcblxuICAgICAgYmJveFsyXSA9IG1heChub2RlLnggKyBub2RlLndpZHRoLCBiYm94WzJdKTtcbiAgICAgIGJib3hbM10gPSBtYXgobm9kZS55ICsgbm9kZS5oZWlnaHQsIGJib3hbM10pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmJveDtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyID0gZnVuY3Rpb24oc3RyKSB7XG4gIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHdyYXBwZXIuaW5uZXJIVE1MID0gc3RyO1xuICByZXR1cm4gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCdzdmcnKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBvaW50fSB0cmFuc2xhdGVcbiAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcgPSBmdW5jdGlvbih0cmFuc2xhdGUsIHNjYWxlKSB7XG4gIHJldHVybiAnbWF0cml4KCcgK1xuICAgIFtzY2FsZSwgMCwgMCwgc2NhbGUsIHRyYW5zbGF0ZS54LCB0cmFuc2xhdGUueV0uam9pbignLCcpICsgJyknO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9ICAgICAgICAgc3ZnXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fEVsZW1lbnR9IGNvbnRhaW5lclxuICovXG5MLlNWRy5jb3B5U1ZHQ29udGVudHMgPSBmdW5jdGlvbihzdmcsIGNvbnRhaW5lcikge1xuICBpZiAoTC5Ccm93c2VyLmllKSB7IC8vIGlubmVySFRNTCBkb2Vzbid0IHdvcmsgZm9yIFNWRyBpbiBJRVxuICAgIHZhciBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgIGRvIHtcbiAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgIH0gd2hpbGUoY2hpbGQpO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xuICB9XG59O1xuIl19
