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

    /**
     * @type {Boolean}
     */
    this._ready = false;

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

    this._ready = false;

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
    this._ready = true;

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
    if (this._ready) {
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

L.Browser.phantomjs = navigator.userAgent.toLowerCase().indexOf('phantom');

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
  // SVG innerHTML doesn't work for SVG in IE and PhantomJS
  if (L.Browser.ie || L.Browser.phantomjs) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztBQ0FBLE9BQU8sT0FBUCxHQUFpQixRQUFRLGlCQUFSLENBQWpCOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0RBLElBQUksSUFBSSxRQUFRLFNBQVIsQ0FBUjs7Ozs7QUFLQSxFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLE1BQW5CLEdBQTRCLFlBQVc7QUFDckMsU0FBTyxDQUFDLEtBQUssR0FBTCxDQUFTLENBQVYsRUFBYSxLQUFLLEdBQUwsQ0FBUyxDQUF0QixFQUF5QixLQUFLLEdBQUwsQ0FBUyxDQUFsQyxFQUFxQyxLQUFLLEdBQUwsQ0FBUyxDQUE5QyxDQUFQO0FBQ0QsQ0FGRDs7Ozs7O0FBU0EsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBZjtBQUNBLE1BQUksTUFB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QUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBL0IsRUFBa0MsVUFBVSxDQUE1QyxFQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRDdEO0FBRUQsQ0FIRDs7Ozs7O0FBVUEsRUFBRSxHQUFGLENBQU0sZUFBTixHQUF3QixVQUFTLEdBQVQsRUFBYyxTQUFkLEVBQXlCOztBQUUvQyxNQUFJLEVBQUUsT0FBRixDQUFVLEVBQVYsSUFBZ0IsRUFBRSxPQUFGLENBQVUsU0FBOUIsRUFBeUM7QUFDdkMsUUFBSSxRQUFRLElBQUksVUFBaEI7QUFDQSxPQUFHO0FBQ0QsZ0JBQVUsV0FBVixDQUFzQixLQUF0QjtBQUNBLGNBQVEsSUFBSSxVQUFaO0FBQ0QsS0FIRCxRQUdRLEtBSFI7QUFJRCxHQU5ELE1BTU87QUFDTCxjQUFVLFNBQVYsR0FBc0IsSUFBSSxTQUExQjtBQUNEO0FBQ0YsQ0FYRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3NjaGVtYXRpYycpO1xuIiwiOyhmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBleHBvcnRzICE9ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IHRoaXM7IC8vICM4OiB3ZWIgd29ya2Vyc1xuICB2YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG4gIGZ1bmN0aW9uIEludmFsaWRDaGFyYWN0ZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yO1xuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuICAvLyBlbmNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS85OTkxNjZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vbmlnbmFnXVxuICBvYmplY3QuYnRvYSB8fCAoXG4gIG9iamVjdC5idG9hID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgICApIHtcbiAgICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMvNCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG4gIC8vIGRlY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwMjAzOTZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vYXRrXVxuICBvYmplY3QuYXRvYiB8fCAoXG4gIG9iamVjdC5hdG9iID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCkucmVwbGFjZSgvPSskLywgJycpO1xuICAgIGlmIChzdHIubGVuZ3RoICUgNCA9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2F0b2InIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBkZWNvZGVkIGlzIG5vdCBjb3JyZWN0bHkgZW5jb2RlZC5cIik7XG4gICAgfVxuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlcnNcbiAgICAgIHZhciBiYyA9IDAsIGJzLCBidWZmZXIsIGlkeCA9IDAsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gZ2V0IG5leHQgY2hhcmFjdGVyXG4gICAgICBidWZmZXIgPSBzdHIuY2hhckF0KGlkeCsrKTtcbiAgICAgIC8vIGNoYXJhY3RlciBmb3VuZCBpbiB0YWJsZT8gaW5pdGlhbGl6ZSBiaXQgc3RvcmFnZSBhbmQgYWRkIGl0cyBhc2NpaSB2YWx1ZTtcbiAgICAgIH5idWZmZXIgJiYgKGJzID0gYmMgJSA0ID8gYnMgKiA2NCArIGJ1ZmZlciA6IGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGlmIG5vdCBmaXJzdCBvZiBlYWNoIDQgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gY29udmVydCB0aGUgZmlyc3QgOCBiaXRzIHRvIG9uZSBhc2NpaSBjaGFyYWN0ZXJcbiAgICAgICAgYmMrKyAlIDQpID8gb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjU1ICYgYnMgPj4gKC0yICogYmMgJiA2KSkgOiAwXG4gICAgKSB7XG4gICAgICAvLyB0cnkgdG8gZmluZCBjaGFyYWN0ZXIgaW4gdGFibGUgKDAtNjMsIG5vdCBmb3VuZCA9PiAtMSlcbiAgICAgIGJ1ZmZlciA9IGNoYXJzLmluZGV4T2YoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbn0oKSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMubWluLngsIHRoaXMubWluLnksIHRoaXMubWF4LngsIHRoaXMubWF4LnldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuQm91bmRzfVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbWF4ID0gdGhpcy5tYXg7XG4gIHZhciBtaW4gPSB0aGlzLm1pbjtcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChtYXgueSAtIG1pbi55KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXG4gICAgW21pbi54IC0gZGVsdGFYLCBtaW4ueSAtIGRlbHRhWV0sXG4gICAgW21heC54ICsgZGVsdGFYLCBtYXgueSArIGRlbHRhWV1cbiAgXSk7XG59O1xuXG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XG4gIHZhciBkZWx0YVggPSAoKG5lLmxuZyAtIHN3LmxuZykgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8qKlxuICogQGNsYXNzIEwuU2NoZW1hdGljUmVuZGVyZXJcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEBleHRlbmRzIHtMLlNWR31cbiAqL1xuTC5TY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzID0gTC5TVkcuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgcGFkZGluZzogMC4zLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllIHx8IEwuQnJvd3Nlci5nZWNrbyxcbiAgICBpbnRlcmFjdGl2ZTogdHJ1ZVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhZGRpdGlvbmFsIGNvbnRhaW5lcnMgZm9yIHRoZSB2ZWN0b3IgZmVhdHVyZXMgdG8gYmVcbiAgICogdHJhbnNmb3JtZWQgdG8gbGl2ZSBpbiB0aGUgc2NoZW1hdGljIHNwYWNlXG4gICAqL1xuICBfaW5pdENvbnRhaW5lcjogZnVuY3Rpb24oKSB7XG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0Q29udGFpbmVyLmNhbGwodGhpcyk7XG5cbiAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAgPSBMLlNWRy5jcmVhdGUoJ2cnKTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcm9vdEludmVydEdyb3VwKTtcbiAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fcm9vdEdyb3VwKTtcblxuICAgIGlmIChMLkJyb3dzZXIuZ2Vja28pIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ3BvaW50ZXItZXZlbnRzJywgJ3Zpc2libGVQYWludGVkJyk7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ3NjaGVtYXRpY3MtcmVuZGVyZXInKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBNYWtlIHN1cmUgbGF5ZXJzIGFyZSBub3QgY2xpcHBlZFxuICAgKiBAcGFyYW0gIHtMLkxheWVyfVxuICAgKi9cbiAgX2luaXRQYXRoOiBmdW5jdGlvbihsYXllcikge1xuICAgIGxheWVyLm9wdGlvbnMubm9DbGlwID0gdHJ1ZTtcbiAgICBMLlNWRy5wcm90b3R5cGUuX2luaXRQYXRoLmNhbGwodGhpcywgbGF5ZXIpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBjYWxsIG9uIHJlc2l6ZSwgcmVkcmF3LCB6b29tIGNoYW5nZVxuICAgKi9cbiAgX3VwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgTC5TVkcucHJvdG90eXBlLl91cGRhdGUuY2FsbCh0aGlzKTtcblxuICAgIHZhciBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG5cbiAgICBpZiAobWFwICYmIHNjaGVtYXRpYy5fYm91bmRzICYmIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCkge1xuICAgICAgdmFyIHRvcExlZnQgPSBtYXAubGF0TG5nVG9MYXllclBvaW50KHNjaGVtYXRpYy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICAgIHZhciBzY2FsZSAgID0gc2NoZW1hdGljLl9yYXRpbyAqXG4gICAgICAgIG1hcC5vcHRpb25zLmNycy5zY2FsZShtYXAuZ2V0Wm9vbSgpIC0gc2NoZW1hdGljLm9wdGlvbnMuem9vbU9mZnNldCk7XG5cbiAgICAgIHRoaXMuX3RvcExlZnQgPSB0b3BMZWZ0O1xuICAgICAgdGhpcy5fc2NhbGUgICA9IHNjYWxlO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9yb290R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0LCBzY2FsZSkpO1xuXG4gICAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQubXVsdGlwbHlCeSggLTEgLyBzY2FsZSksIDEgLyBzY2FsZSkpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiAxLiB3cmFwIG1hcmt1cCBpbiBhbm90aGVyIDxnPlxuICAgKiAyLiBjcmVhdGUgYSBjbGlwUGF0aCB3aXRoIHRoZSB2aWV3Qm94IHJlY3RcbiAgICogMy4gYXBwbHkgaXQgdG8gdGhlIDxnPiBhcm91bmQgYWxsIG1hcmt1cHNcbiAgICogNC4gcmVtb3ZlIGdyb3VwIGFyb3VuZCBzY2hlbWF0aWNcbiAgICogNS4gcmVtb3ZlIGlubmVyIGdyb3VwIGFyb3VuZCBtYXJrdXBzXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbj19IG9ubHlPdmVybGF5c1xuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihvbmx5T3ZlcmxheXMpIHtcbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcblxuICAgIC8vIGdvIHRocm91Z2ggZXZlcnkgbGF5ZXIgYW5kIG1ha2Ugc3VyZSB0aGV5J3JlIG5vdCBjbGlwcGVkXG4gICAgdmFyIHN2ZyAgICAgICA9IHRoaXMuX2NvbnRhaW5lci5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICB2YXIgY2xpcFBhdGggICAgPSBMLlNWRy5jcmVhdGUoJ2NsaXBQYXRoJyk7XG4gICAgdmFyIGNsaXBSZWN0ICAgID0gTC5TVkcuY3JlYXRlKCdyZWN0Jyk7XG4gICAgdmFyIGNsaXBHcm91cCAgID0gc3ZnLmxhc3RDaGlsZDtcbiAgICB2YXIgYmFzZUNvbnRlbnQgPSBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5Jyk7XG4gICAgdmFyIGRlZnMgICAgICAgID0gYmFzZUNvbnRlbnQucXVlcnlTZWxlY3RvcignZGVmcycpO1xuXG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd4JywgICAgICBzY2hlbWF0aWMuX2Jib3hbMF0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgneScsICAgICAgc2NoZW1hdGljLl9iYm94WzFdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgIHNjaGVtYXRpYy5fYmJveFsyXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBzY2hlbWF0aWMuX2Jib3hbM10pO1xuICAgIGNsaXBQYXRoLmFwcGVuZENoaWxkKGNsaXBSZWN0KTtcblxuICAgIHZhciBjbGlwSWQgPSAndmlld2JveENsaXAtJyArIEwuVXRpbC5zdGFtcChzY2hlbWF0aWMuX2dyb3VwKTtcbiAgICBjbGlwUGF0aC5zZXRBdHRyaWJ1dGUoJ2lkJywgY2xpcElkKTtcblxuICAgIGlmICghZGVmcyB8fCBvbmx5T3ZlcmxheXMpIHtcbiAgICAgIGRlZnMgPSBMLlNWRy5jcmVhdGUoJ2RlZnMnKTtcbiAgICAgIHN2Zy5hcHBlbmRDaGlsZChkZWZzKTtcbiAgICB9XG4gICAgZGVmcy5hcHBlbmRDaGlsZChjbGlwUGF0aCk7XG4gICAgY2xpcEdyb3VwLnNldEF0dHJpYnV0ZSgnY2xpcC1wYXRoJywgJ3VybCgjJyArIGNsaXBJZCArICcpJyk7XG5cbiAgICBjbGlwR3JvdXAuZmlyc3RDaGlsZC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRoaXMuX3RvcExlZnQubXVsdGlwbHlCeSggLTEgLyB0aGlzLl9zY2FsZSlcbiAgICAgICAgLmFkZChzY2hlbWF0aWMuX3ZpZXdCb3hPZmZzZXQpLCAxIC8gdGhpcy5fc2NhbGUpKTtcbiAgICBjbGlwR3JvdXAucmVtb3ZlQXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcbiAgICBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5JykucmVtb3ZlQXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoY2xpcEdyb3VwLCAnY2xpcC1ncm91cCcpO1xuXG4gICAgc3ZnLnN0eWxlLnRyYW5zZm9ybSA9ICcnO1xuICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBzY2hlbWF0aWMuX2Jib3guam9pbignICcpKTtcblxuICAgIGlmIChvbmx5T3ZlcmxheXMpIHsgLy8gbGVhdmUgb25seSBtYXJrdXBzXG4gICAgICBiYXNlQ29udGVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGJhc2VDb250ZW50KTtcbiAgICB9XG5cbiAgICB2YXIgZGl2ID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJycpO1xuICAgIC8vIHB1dCBjb250YWluZXIgYXJvdW5kIHRoZSBjb250ZW50cyBhcyBpdCB3YXNcbiAgICBkaXYuaW5uZXJIVE1MID0gKC8oXFw8c3ZnXFxzKyhbXj5dKilcXD4pL2dpKVxuICAgICAgLmV4ZWMoc2NoZW1hdGljLl9yYXdEYXRhKVswXSArICc8L3N2Zz4nO1xuXG4gICAgTC5TVkcuY29weVNWR0NvbnRlbnRzKHN2ZywgZGl2LmZpcnN0Q2hpbGQpO1xuXG4gICAgcmV0dXJuIGRpdi5maXJzdENoaWxkO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAqL1xuTC5zY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzLnNjaGVtYXRpY1JlbmRlcmVyID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljUmVuZGVyZXIob3B0aW9ucyk7XG59O1xuXG4iLCJ2YXIgTCAgICAgICAgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcbnZhciBSZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXInKTtcblxucmVxdWlyZSgnLi9ib3VuZHMnKTtcbnJlcXVpcmUoJy4vdXRpbHMnKTtcblxuXG4vKipcbiAqIFNjaGVtYXRpYyBsYXllciB0byB3b3JrIHdpdGggU1ZHIHNjaGVtYXRpY3Mgb3IgYmx1ZXByaW50cyBpbiBMZWFmbGV0XG4gKlxuICogQGF1dGhvciBBbGV4YW5kZXIgTWlsZXZza2kgPGluZm9AdzhyLm5hbWU+XG4gKiBAbGljZW5zZSBNSVRcbiAqIEBwcmVzZXJ2ZVxuICogQGNsYXNzIFNjaGVtYXRpY1xuICogQGV4dGVuZHMge0wuUmVjdGFuZ2xlfVxuICovXG5MLlNjaGVtYXRpYyA9IG1vZHVsZS5leHBvcnRzID0gTC5SZWN0YW5nbGUuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgb3BhY2l0eTogMCxcbiAgICBmaWxsT3BhY2l0eTogMCxcbiAgICB3ZWlnaHQ6IDEsXG4gICAgYWRqdXN0VG9TY3JlZW46IHRydWUsXG5cbiAgICAvLyBoYXJkY29kZSB6b29tIG9mZnNldCB0byBzbmFwIHRvIHNvbWUgbGV2ZWxcbiAgICB6b29tT2Zmc2V0OiAwLFxuICAgIGludGVyYWN0aXZlOiBmYWxzZSxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZSB8fCBMLkJyb3dzZXIuZ2Vja29cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fc3ZnICAgID0gc3ZnO1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbCBzdmcgd2lkdGgsIGNhdXNlIHdlIHdpbGwgaGF2ZSB0byBnZXQgcmlkIG9mIHRoYXQgdG8gbWFpbnRhaW5cbiAgICAgKiB0aGUgYXNwZWN0IHJhdGlvXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxXaWR0aCAgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbCBzdmcgaGVpZ2h0XG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsSGVpZ2h0ID0gJyc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIG9wdGlvbnMucmVuZGVyZXIgPSBuZXcgUmVuZGVyZXIoe1xuICAgICAgc2NoZW1hdGljOiB0aGlzXG4gICAgICAvLyBwYWRkaW5nOiBvcHRpb25zLnBhZGRpbmcgfHwgdGhpcy5vcHRpb25zLnBhZGRpbmcgfHwgMC4yNVxuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KDAsIDApO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9yZWFkeSA9IGZhbHNlO1xuXG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzID0gbnVsbDtcblxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwoXG4gICAgICB0aGlzLCBMLmxhdExuZ0JvdW5kcyhbMCwgMF0sIFswLCAwXSksIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuXG4gICAgdGhpcy5fcmVhZHkgPSBmYWxzZTtcblxuICAgIGlmICghdGhpcy5fZ3JvdXApIHtcbiAgICAgIHRoaXMuX2dyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgICBMLlV0aWwuc3RhbXAodGhpcy5fZ3JvdXApO1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2dyb3VwLCAnc3ZnLW92ZXJsYXknKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuXG4gICAgaWYgKEwuQnJvd3Nlci5nZWNrbykge1xuICAgICAgdGhpcy5fcGF0aC5zZXRBdHRyaWJ1dGUoJ3BvaW50ZXItZXZlbnRzJywgJ25vbmUnKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdmFyIGNhbnZhc1JlbmRlcmVyID0gbmV3IEwuQ2FudmFzKHt9KS5hZGRUbyhtYXApO1xuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5wYXJlbnROb2RlXG4gICAgICAgIC5pbnNlcnRCZWZvcmUoY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lciwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lcik7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IGNhbnZhc1JlbmRlcmVyO1xuXG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub24oJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vbignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgdGhpcy5fZ3JvdXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9ncm91cCk7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uUmVtb3ZlLmNhbGwodGhpcywgbWFwKTtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcbiAgICAgIG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlXG4gICAgICAgIC5vZmYoJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXG4gICAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLl9yZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2Z1N0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBfcmVhZFNWR0RhdGE6IGZ1bmN0aW9uKHN2Z1N0cmluZykge1xuICAgIHZhciBwYXJzZXIgICAgID0gbmV3IERPTVBhcnNlcigpO1xuICAgIHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcblxuICAgIHZhciBkb2MgPSBwYXJzZXIucGFyc2VGcm9tU3RyaW5nKHN2Z1N0cmluZywgJ2FwcGxpY2F0aW9uL3htbCcpO1xuICAgIHZhciBjb250YWluZXIgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgdGhpcy5faW5pdGlhbFdpZHRoICA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3dpZHRoJyk7XG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpO1xuXG4gICAgdGhpcy5fYmJveCA9IEwuRG9tVXRpbC5nZXRTVkdCQm94KGNvbnRhaW5lcik7XG5cbiAgICAvLyBmaXggd2lkdGggY2F1c2Ugb3RoZXJ3aXNlIHJhc3RlcnphdGlvbiB3aWxsIGJyZWFrXG4gICAgdmFyIHdpZHRoICA9IHRoaXMuX2Jib3hbMl0gLSB0aGlzLl9iYm94WzBdO1xuICAgIHZhciBoZWlnaHQgPSB0aGlzLl9iYm94WzNdIC0gdGhpcy5fYmJveFsxXTtcbiAgICBpZiAocGFyc2VGbG9hdCh0aGlzLl9pbml0aWFsV2lkdGgpICE9PSB3aWR0aCB8fFxuICAgICAgcGFyc2VGbG9hdCh0aGlzLl9pbml0aWFsSGVpZ2h0KSAgIT09IGhlaWdodCkge1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAgd2lkdGgpO1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnaGVpZ2h0JywgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdEYXRhICAgICAgID0gc3ZnU3RyaW5nO1xuICAgIHRoaXMuX3Byb2Nlc3NlZERhdGEgPSBzZXJpYWxpemVyLnNlcmlhbGl6ZVRvU3RyaW5nKGRvYyk7XG5cbiAgICBpZiAoY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCd2aWV3Qm94JywgdGhpcy5fYmJveC5qb2luKCcgJykpO1xuICAgICAgdGhpcy5fcHJvY2Vzc2VkRGF0YSA9IHRoaXMuX3Byb2Nlc3NlZERhdGEucmVwbGFjZSgnPHN2ZycsXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCInICsgdGhpcy5fYmJveC5qb2luKCcgJykgKyAnXCInKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgaWYgKCF0aGlzLl9tYXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzdmcgPSB0aGlzLl9yZWFkU1ZHRGF0YShzdmcpO1xuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbiAmJiBzaXplLnkgIT09IG1hcFNpemUueSkge1xuICAgICAgdGhpcy5fcmF0aW8gPSBNYXRoLm1pbihtYXBTaXplLnggLyBzaXplLngsIG1hcFNpemUueSAvIHNpemUueSk7XG4gICAgICB0aGlzLm9wdGlvbnMuX3pvb21PZmZzZXQgPSAodGhpcy5fcmF0aW8gPCAxKSA/XG4gICAgICAgIHRoaXMuX3JhdGlvIDogKDEgLSB0aGlzLl9yYXRpbyk7XG4gICAgICAvLyBkaXNtaXNzIHRoYXQgb2Zmc2V0XG4gICAgICB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCA9IDA7XG4gICAgfVxuXG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSBlZGdlcyBvZiB0aGUgaW1hZ2UsIGluIGNvb3JkaW5hdGUgc3BhY2VcbiAgICB0aGlzLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzJdLCBiYm94WzFdXSwgbWluWm9vbSlcbiAgICApLnNjYWxlKHRoaXMuX3JhdGlvKTtcblxuICAgIHRoaXMuX3NpemUgICA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCh0aGlzLl9iYm94WzBdLCB0aGlzLl9iYm94WzFdKTtcblxuICAgIHRoaXMuX2NyZWF0ZUNvbnRlbnRzKHN2Zyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoXG4gICAgICB0aGlzLl9ncm91cCwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuICAgIHRoaXMuX3JlYWR5ID0gdHJ1ZTtcblxuICAgIHRoaXMuX2xhdGxuZ3MgPSB0aGlzLl9ib3VuZHNUb0xhdExuZ3ModGhpcy5fYm91bmRzKTtcbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMudG9JbWFnZSgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7Kj19ICAgICAgIGNvbnRleHRcbiAgICogQHJldHVybiB7T3ZlcmxheX1cbiAgICovXG4gIHdoZW5SZWFkeTogZnVuY3Rpb24oY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5fcmVhZHkpIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25jZSgnbG9hZCcsIGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGdldERvY3VtZW50OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAgICovXG4gIGdldFJlbmRlcmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmVuZGVyZXI7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gICAqL1xuICBfY3JlYXRlQ29udGVudHM6IGZ1bmN0aW9uKHN2Zykge1xuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIHRoaXMuX2dyb3VwKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgZ2V0T3JpZ2luYWxTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgcmV0dXJuIG5ldyBMLlBvaW50KFxuICAgICAgTWF0aC5hYnMoYmJveFswXSAtIGJib3hbMl0pLFxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXG4gICAgKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG91ciBcInJlY3RhbmdsZVwiXG4gICAqL1xuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fZ3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgLy8gc2NhbGUgaXMgc2NhbGUgZmFjdG9yLCB6b29tIGlzIHpvb20gbGV2ZWxcbiAgICAgIHZhciBzY2FsZSAgID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpICogdGhpcy5fcmF0aW87XG5cbiAgICAgIC8vdG9wTGVmdCA9IHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSk7XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcoXG4gICAgICAgICAgdG9wTGVmdC5zdWJ0cmFjdCh0aGlzLl92aWV3Qm94T2Zmc2V0Lm11bHRpcGx5Qnkoc2NhbGUpKSwgc2NhbGUpKTtcblxuICAgICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICAgIHRoaXMuX3JlZHJhd0NhbnZhcyh0b3BMZWZ0LCBzY2FsZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfdW5zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IFRPIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmF0aW87XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KG1hcC5wcm9qZWN0KFxuICAgICAgY29vcmQsIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gbWFwLnVucHJvamVjdChcbiAgICAgIHRoaXMuX3NjYWxlUG9pbnQocHQpLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1pbik7XG4gICAgdmFyIG5lID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gb3ZlcmxheXNPbmx5XG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR8U3RyaW5nfVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihzdHJpbmcsIG92ZXJsYXlzT25seSkge1xuICAgIHZhciBub2RlID0gdGhpcy5fcmVuZGVyZXIuZXhwb3J0U1ZHKG92ZXJsYXlzT25seSk7XG4gICAgcmV0dXJuIHN0cmluZyA/IG5vZGUub3V0ZXJIVE1MIDogbm9kZTtcbiAgfSxcblxuXG4gICAvKipcbiAgICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIHRvSW1hZ2U6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblxuICAgIC8vIHRoaXMgZG9lc24ndCB3b3JrIGluIElFLCBmb3JjZSBzaXplXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICBpbWcuc3R5bGUud2lkdGggID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgLy8gaGFjayB0byB0cmljayBJRSByZW5kZXJpbmcgZW5naW5lXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9LCB0aGlzKTtcbiAgICBpbWcuc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgaW1nLnN0eWxlLnpJbmRleCA9IC05OTk5O1xuICAgIGltZy5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXG4gICAgaWYgKHRoaXMuX3Jhc3Rlcikge1xuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcbiAgICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG4gICAgfVxuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKGltZywgJ3NjaGVtYXRpYy1pbWFnZScpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgLmluc2VydEJlZm9yZShpbWcsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgIHRoaXMuX3Jhc3RlciA9IGltZztcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IFNWRyBkYXRhIHRvIGJhc2U2NCBmb3IgcmFzdGVyaXphdGlvblxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGJhc2U2NCBlbmNvZGVkIFNWR1xuICAgKi9cbiAgdG9CYXNlNjQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vIGNvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcbiAgICAgIGI2NC5idG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudCh0aGlzLl9wcm9jZXNzZWREYXRhKSkpO1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSBiYXNlNjQ7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCdiYXNlNjQnKTtcblxuICAgIHJldHVybiAnZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCwnICsgYmFzZTY0O1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlZHJhdyBjYW52YXMgb24gcmVhbCBjaGFuZ2VzOiB6b29tLCB2aWV3cmVzZXRcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gdG9wTGVmdFxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICAgKi9cbiAgX3JlZHJhd0NhbnZhczogZnVuY3Rpb24odG9wTGVmdCwgc2NhbGUpIHtcbiAgICBpZiAoIXRoaXMuX3Jhc3Rlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKS5tdWx0aXBseUJ5KHNjYWxlKTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fY2FudmFzUmVuZGVyZXIuX2N0eDtcblxuICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHRvcExlZnQueCwgdG9wTGVmdC55LCBzaXplLngsIHNpemUueSk7XG4gICAgfSwgdGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVG9nZ2xlIGNhbnZhcyBpbnN0ZWFkIG9mIFNWRyB3aGVuIGRyYWdnaW5nXG4gICAqL1xuICBfc2hvd1Jhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcjogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgICB0aGlzLl9ncm91cC5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBJRS1vbmx5XG4gICAqIFJlcGxhY2UgU1ZHIHdpdGggY2FudmFzIGJlZm9yZSBkcmFnXG4gICAqL1xuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5fc2hvd1Jhc3RlcigpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBEcmFnIGVuZDogcHV0IFNWRyBiYWNrIGluIElFXG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vLyBhbGlhc2VzXG5MLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdCAgID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3RQb2ludDtcbkwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3QgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0UG9pbnQ7XG5cblxuLyoqXG4gKiBGYWN0b3J5XG4gKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljfVxuICovXG5MLnNjaGVtYXRpYyA9IGZ1bmN0aW9uIChzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljKHN2ZywgYm91bmRzLCBvcHRpb25zKTtcbn07XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuTC5Ccm93c2VyLnBoYW50b21qcyA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdwaGFudG9tJyk7XG5cbi8vIDx1c2U+IHRhZ3MgYXJlIGJyb2tlbiBpbiBJRSBpbiBzbyBtYW55IHdheXNcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiB3aW5kb3cpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnRJbnN0YW5jZS5wcm90b3R5cGUsICdjbGFzc05hbWUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWwgPSB2YWw7XG4gICAgfVxuICB9KTtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAgeyp9ICBvXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5MLkRvbVV0aWwuaXNOb2RlID0gZnVuY3Rpb24obyl7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIE5vZGUgPT09ICdvYmplY3QnID9cbiAgICBvIGluc3RhbmNlb2YgTm9kZSA6XG4gICAgbyAmJiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQkJveCA9IGZ1bmN0aW9uKHN2Zykge1xuICB2YXIgdmlld0JveCA9IHN2Zy5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKTtcbiAgdmFyIGJib3g7XG4gIGlmICh2aWV3Qm94KSB7XG4gICAgYmJveCA9IHZpZXdCb3guc3BsaXQoJyAnKS5tYXAocGFyc2VGbG9hdCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNsb25lID0gc3ZnLmNsb25lTm9kZSh0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAvLyBiYm94ID0gY2xvbmUuZ2V0QkJveCgpO1xuICAgIGJib3ggPSBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhjbG9uZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgcmV0dXJuIGJib3g7XG4gIH1cbiAgcmV0dXJuIFtiYm94WzBdLCBiYm94WzFdLCBiYm94WzBdICsgYmJveFsyXSwgYmJveFsxXSArIGJib3hbM11dO1xufTtcblxuXG4vKipcbiAqIFNpbXBseSBicnV0ZSBmb3JjZTogdGFrZXMgYWxsIHN2ZyBub2RlcywgY2FsY3VsYXRlcyBib3VuZGluZyBib3hcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbmZ1bmN0aW9uIGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKHN2Zykge1xuICB2YXIgYmJveCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcbiAgdmFyIG5vZGVzID0gW10uc2xpY2UuY2FsbChzdmcucXVlcnlTZWxlY3RvckFsbCgnKicpKTtcbiAgdmFyIG1pbiA9IE1hdGgubWluLCBtYXggPSBNYXRoLm1heDtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gbm9kZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xuICAgIGlmIChub2RlLmdldEJCb3gpIHtcbiAgICAgIG5vZGUgPSBub2RlLmdldEJCb3goKTtcblxuICAgICAgYmJveFswXSA9IG1pbihub2RlLngsIGJib3hbMF0pO1xuICAgICAgYmJveFsxXSA9IG1pbihub2RlLnksIGJib3hbMV0pO1xuXG4gICAgICBiYm94WzJdID0gbWF4KG5vZGUueCArIG5vZGUud2lkdGgsIGJib3hbMl0pO1xuICAgICAgYmJveFszXSA9IG1heChub2RlLnkgKyBub2RlLmhlaWdodCwgYmJveFszXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBiYm94O1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIgPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5pbm5lckhUTUwgPSBzdHI7XG4gIHJldHVybiB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUG9pbnR9IHRyYW5zbGF0ZVxuICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZSwgc2NhbGUpIHtcbiAgcmV0dXJuICdtYXRyaXgoJyArXG4gICAgW3NjYWxlLCAwLCAwLCBzY2FsZSwgdHJhbnNsYXRlLngsIHRyYW5zbGF0ZS55XS5qb2luKCcsJykgKyAnKSc7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gICAgICAgICBzdmdcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR8RWxlbWVudH0gY29udGFpbmVyXG4gKi9cbkwuU1ZHLmNvcHlTVkdDb250ZW50cyA9IGZ1bmN0aW9uKHN2ZywgY29udGFpbmVyKSB7XG4gIC8vIFNWRyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUUgYW5kIFBoYW50b21KU1xuICBpZiAoTC5Ccm93c2VyLmllIHx8IEwuQnJvd3Nlci5waGFudG9tanMpIHtcbiAgICB2YXIgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICBkbyB7XG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICAgICAgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICB9IHdoaWxlKGNoaWxkKTtcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgfVxufTtcbiJdfQ==
