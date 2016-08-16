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
    useRaster: L.Browser.ie || L.Browser.gecko || L.Browser.edge,
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
    useRaster: L.Browser.ie || L.Browser.gecko || L.Browser.edge
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
     * @type {Boolean}
     */
    this._rasterShown = false;

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
    if (this._canvasRenderer && !this._rasterShown) {
      this._canvasRenderer._container.style.visibility = 'visible';
      this._group.style.display = 'none';
      this._rasterShown = true;
    }
  },

  /**
   * Swap back to SVG
   */
  _hideRaster: function _hideRaster() {
    if (this._canvasRenderer && this._rasterShown) {
      this._canvasRenderer._container.style.visibility = 'hidden';
      this._group.style.display = 'block';
      this._rasterShown = false;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjXFxib3VuZHMuanMiLCJzcmNcXHJlbmRlcmVyLmpzIiwic3JjXFxzY2hlbWF0aWMuanMiLCJzcmNcXHV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxNQUFNLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDOzs7QUNBNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDOzs7OztBQUFDLEFBSzNCLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3pEOzs7Ozs7QUFBQyxBQU9GLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxVQUFTLEtBQUssRUFBRTtBQUN6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Q0YsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL3NjaGVtYXRpYycpO1xyXG4iLCI7KGZ1bmN0aW9uICgpIHtcblxuICB2YXIgb2JqZWN0ID0gdHlwZW9mIGV4cG9ydHMgIT0gJ3VuZGVmaW5lZCcgPyBleHBvcnRzIDogdGhpczsgLy8gIzg6IHdlYiB3b3JrZXJzXG4gIHZhciBjaGFycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XG5cbiAgZnVuY3Rpb24gSW52YWxpZENoYXJhY3RlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB9XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3I7XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG4gIC8vIGVuY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5OTE2Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9uaWduYWddXG4gIG9iamVjdC5idG9hIHx8IChcbiAgb2JqZWN0LmJ0b2EgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KTtcbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJcbiAgICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAgIC8vICAgY2hhbmdlIHRoZSBtYXBwaW5nIHRhYmxlIHRvIFwiPVwiXG4gICAgICAvLyAgIGNoZWNrIGlmIGQgaGFzIG5vIGZyYWN0aW9uYWwgZGlnaXRzXG4gICAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgICAgLy8gXCI4IC0gaWR4ICUgMSAqIDhcIiBnZW5lcmF0ZXMgdGhlIHNlcXVlbmNlIDIsIDQsIDYsIDhcbiAgICAgIG91dHB1dCArPSBtYXAuY2hhckF0KDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICAgICkge1xuICAgICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpZHggKz0gMy80KTtcbiAgICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIididG9hJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZW5jb2RlZCBjb250YWlucyBjaGFyYWN0ZXJzIG91dHNpZGUgb2YgdGhlIExhdGluMSByYW5nZS5cIik7XG4gICAgICB9XG4gICAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbiAgLy8gZGVjb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTAyMDM5Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9hdGtdXG4gIG9iamVjdC5hdG9iIHx8IChcbiAgb2JqZWN0LmF0b2IgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KS5yZXBsYWNlKC89KyQvLCAnJyk7XG4gICAgaWYgKHN0ci5sZW5ndGggJSA0ID09IDEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYXRvYicgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGRlY29kZWQgaXMgbm90IGNvcnJlY3RseSBlbmNvZGVkLlwiKTtcbiAgICB9XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyc1xuICAgICAgdmFyIGJjID0gMCwgYnMsIGJ1ZmZlciwgaWR4ID0gMCwgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBnZXQgbmV4dCBjaGFyYWN0ZXJcbiAgICAgIGJ1ZmZlciA9IHN0ci5jaGFyQXQoaWR4KyspO1xuICAgICAgLy8gY2hhcmFjdGVyIGZvdW5kIGluIHRhYmxlPyBpbml0aWFsaXplIGJpdCBzdG9yYWdlIGFuZCBhZGQgaXRzIGFzY2lpIHZhbHVlO1xuICAgICAgfmJ1ZmZlciAmJiAoYnMgPSBiYyAlIDQgPyBicyAqIDY0ICsgYnVmZmVyIDogYnVmZmVyLFxuICAgICAgICAvLyBhbmQgaWYgbm90IGZpcnN0IG9mIGVhY2ggNCBjaGFyYWN0ZXJzLFxuICAgICAgICAvLyBjb252ZXJ0IHRoZSBmaXJzdCA4IGJpdHMgdG8gb25lIGFzY2lpIGNoYXJhY3RlclxuICAgICAgICBiYysrICUgNCkgPyBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgyNTUgJiBicyA+PiAoLTIgKiBiYyAmIDYpKSA6IDBcbiAgICApIHtcbiAgICAgIC8vIHRyeSB0byBmaW5kIGNoYXJhY3RlciBpbiB0YWJsZSAoMC02Mywgbm90IGZvdW5kID0+IC0xKVxuICAgICAgYnVmZmVyID0gY2hhcnMuaW5kZXhPZihidWZmZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxufSgpKTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xyXG5cclxuLyoqXHJcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxyXG4gKi9cclxuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBbdGhpcy5taW4ueCwgdGhpcy5taW4ueSwgdGhpcy5tYXgueCwgdGhpcy5tYXgueV07XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcclxuICogQHJldHVybiB7TC5Cb3VuZHN9XHJcbiAqL1xyXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gIHZhciBtYXggPSB0aGlzLm1heDtcclxuICB2YXIgbWluID0gdGhpcy5taW47XHJcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xyXG4gIHZhciBkZWx0YVkgPSAoKG1heC55IC0gbWluLnkpIC8gMikgKiAodmFsdWUgLSAxKTtcclxuXHJcbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXHJcbiAgICBbbWluLnggLSBkZWx0YVgsIG1pbi55IC0gZGVsdGFZXSxcclxuICAgIFttYXgueCArIGRlbHRhWCwgbWF4LnkgKyBkZWx0YVldXHJcbiAgXSk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxyXG4gKi9cclxuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiBbdGhpcy5nZXRXZXN0KCksIHRoaXMuZ2V0U291dGgoKSwgdGhpcy5nZXRFYXN0KCksIHRoaXMuZ2V0Tm9ydGgoKV07XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcclxuICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XHJcbiAqL1xyXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gIHZhciBuZSA9IHRoaXMuX25vcnRoRWFzdDtcclxuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XHJcbiAgdmFyIGRlbHRhWCA9ICgobmUubG5nIC0gc3cubG5nKSAvIDIpICogKHZhbHVlIC0gMSk7XHJcbiAgdmFyIGRlbHRhWSA9ICgobmUubGF0IC0gc3cubGF0KSAvIDIpICogKHZhbHVlIC0gMSk7XHJcblxyXG4gIHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoW1xyXG4gICAgW3N3LmxhdCAtIGRlbHRhWSwgc3cubG5nIC0gZGVsdGFYXSxcclxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cclxuICBdKTtcclxufTtcclxuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XHJcblxyXG4vKipcclxuICogQGNsYXNzIEwuU2NoZW1hdGljUmVuZGVyZXJcclxuICogQHBhcmFtICB7T2JqZWN0fVxyXG4gKiBAZXh0ZW5kcyB7TC5TVkd9XHJcbiAqL1xyXG5MLlNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMgPSBMLlNWRy5leHRlbmQoe1xyXG5cclxuICBvcHRpb25zOiB7XHJcbiAgICBwYWRkaW5nOiAwLjMsXHJcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZSB8fCBMLkJyb3dzZXIuZ2Vja28gfHwgTC5Ccm93c2VyLmVkZ2UsXHJcbiAgICBpbnRlcmFjdGl2ZTogdHJ1ZVxyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYWRkaXRpb25hbCBjb250YWluZXJzIGZvciB0aGUgdmVjdG9yIGZlYXR1cmVzIHRvIGJlXHJcbiAgICogdHJhbnNmb3JtZWQgdG8gbGl2ZSBpbiB0aGUgc2NoZW1hdGljIHNwYWNlXHJcbiAgICovXHJcbiAgX2luaXRDb250YWluZXI6IGZ1bmN0aW9uKCkge1xyXG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0Q29udGFpbmVyLmNhbGwodGhpcyk7XHJcblxyXG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XHJcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fcm9vdEludmVydEdyb3VwKTtcclxuICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cC5hcHBlbmRDaGlsZCh0aGlzLl9yb290R3JvdXApO1xyXG5cclxuICAgIGlmIChMLkJyb3dzZXIuZ2Vja28pIHtcclxuICAgICAgdGhpcy5fY29udGFpbmVyLnNldEF0dHJpYnV0ZSgncG9pbnRlci1ldmVudHMnLCAndmlzaWJsZVBhaW50ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnc2NoZW1hdGljcy1yZW5kZXJlcicpO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIHN1cmUgbGF5ZXJzIGFyZSBub3QgY2xpcHBlZFxyXG4gICAqIEBwYXJhbSAge0wuTGF5ZXJ9XHJcbiAgICovXHJcbiAgX2luaXRQYXRoOiBmdW5jdGlvbihsYXllcikge1xyXG4gICAgbGF5ZXIub3B0aW9ucy5ub0NsaXAgPSB0cnVlO1xyXG4gICAgTC5TVkcucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMsIGxheWVyKTtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGNhbGwgb24gcmVzaXplLCByZWRyYXcsIHpvb20gY2hhbmdlXHJcbiAgICovXHJcbiAgX3VwZGF0ZTogZnVuY3Rpb24oKSB7XHJcbiAgICBMLlNWRy5wcm90b3R5cGUuX3VwZGF0ZS5jYWxsKHRoaXMpO1xyXG5cclxuICAgIHZhciBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xyXG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcclxuXHJcbiAgICBpZiAobWFwICYmIHNjaGVtYXRpYy5fYm91bmRzICYmIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCkge1xyXG4gICAgICB2YXIgdG9wTGVmdCA9IG1hcC5sYXRMbmdUb0xheWVyUG9pbnQoc2NoZW1hdGljLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xyXG4gICAgICB2YXIgc2NhbGUgICA9IHNjaGVtYXRpYy5fcmF0aW8gKlxyXG4gICAgICAgIG1hcC5vcHRpb25zLmNycy5zY2FsZShtYXAuZ2V0Wm9vbSgpIC0gc2NoZW1hdGljLm9wdGlvbnMuem9vbU9mZnNldCk7XHJcblxyXG4gICAgICB0aGlzLl90b3BMZWZ0ID0gdG9wTGVmdDtcclxuICAgICAgdGhpcy5fc2NhbGUgICA9IHNjYWxlO1xyXG5cclxuICAgICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxyXG4gICAgICB0aGlzLl9yb290R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxyXG4gICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQsIHNjYWxlKSk7XHJcblxyXG4gICAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxyXG4gICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdC5tdWx0aXBseUJ5KCAtMSAvIHNjYWxlKSwgMSAvIHNjYWxlKSk7XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIDEuIHdyYXAgbWFya3VwIGluIGFub3RoZXIgPGc+XHJcbiAgICogMi4gY3JlYXRlIGEgY2xpcFBhdGggd2l0aCB0aGUgdmlld0JveCByZWN0XHJcbiAgICogMy4gYXBwbHkgaXQgdG8gdGhlIDxnPiBhcm91bmQgYWxsIG1hcmt1cHNcclxuICAgKiA0LiByZW1vdmUgZ3JvdXAgYXJvdW5kIHNjaGVtYXRpY1xyXG4gICAqIDUuIHJlbW92ZSBpbm5lciBncm91cCBhcm91bmQgbWFya3Vwc1xyXG4gICAqXHJcbiAgICogQHBhcmFtIHtCb29sZWFuPX0gb25seU92ZXJsYXlzXHJcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cclxuICAgKi9cclxuICBleHBvcnRTVkc6IGZ1bmN0aW9uKG9ubHlPdmVybGF5cykge1xyXG4gICAgdmFyIHNjaGVtYXRpYyA9IHRoaXMub3B0aW9ucy5zY2hlbWF0aWM7XHJcblxyXG4gICAgLy8gZ28gdGhyb3VnaCBldmVyeSBsYXllciBhbmQgbWFrZSBzdXJlIHRoZXkncmUgbm90IGNsaXBwZWRcclxuICAgIHZhciBzdmcgICAgICAgPSB0aGlzLl9jb250YWluZXIuY2xvbmVOb2RlKHRydWUpO1xyXG5cclxuICAgIHZhciBjbGlwUGF0aCAgICA9IEwuU1ZHLmNyZWF0ZSgnY2xpcFBhdGgnKTtcclxuICAgIHZhciBjbGlwUmVjdCAgICA9IEwuU1ZHLmNyZWF0ZSgncmVjdCcpO1xyXG4gICAgdmFyIGNsaXBHcm91cCAgID0gc3ZnLmxhc3RDaGlsZDtcclxuICAgIHZhciBiYXNlQ29udGVudCA9IHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKTtcclxuICAgIHZhciBkZWZzICAgICAgICA9IGJhc2VDb250ZW50LnF1ZXJ5U2VsZWN0b3IoJ2RlZnMnKTtcclxuXHJcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3gnLCAgICAgIHNjaGVtYXRpYy5fYmJveFswXSk7XHJcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCAgICAgIHNjaGVtYXRpYy5fYmJveFsxXSk7XHJcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgIHNjaGVtYXRpYy5fYmJveFsyXSk7XHJcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIHNjaGVtYXRpYy5fYmJveFszXSk7XHJcbiAgICBjbGlwUGF0aC5hcHBlbmRDaGlsZChjbGlwUmVjdCk7XHJcblxyXG4gICAgdmFyIGNsaXBJZCA9ICd2aWV3Ym94Q2xpcC0nICsgTC5VdGlsLnN0YW1wKHNjaGVtYXRpYy5fZ3JvdXApO1xyXG4gICAgY2xpcFBhdGguc2V0QXR0cmlidXRlKCdpZCcsIGNsaXBJZCk7XHJcblxyXG4gICAgaWYgKCFkZWZzIHx8IG9ubHlPdmVybGF5cykge1xyXG4gICAgICBkZWZzID0gTC5TVkcuY3JlYXRlKCdkZWZzJyk7XHJcbiAgICAgIHN2Zy5hcHBlbmRDaGlsZChkZWZzKTtcclxuICAgIH1cclxuICAgIGRlZnMuYXBwZW5kQ2hpbGQoY2xpcFBhdGgpO1xyXG4gICAgY2xpcEdyb3VwLnNldEF0dHJpYnV0ZSgnY2xpcC1wYXRoJywgJ3VybCgjJyArIGNsaXBJZCArICcpJyk7XHJcblxyXG4gICAgY2xpcEdyb3VwLmZpcnN0Q2hpbGQuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxyXG4gICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRoaXMuX3RvcExlZnQubXVsdGlwbHlCeSggLTEgLyB0aGlzLl9zY2FsZSlcclxuICAgICAgICAuYWRkKHNjaGVtYXRpYy5fdmlld0JveE9mZnNldCksIDEgLyB0aGlzLl9zY2FsZSkpO1xyXG4gICAgY2xpcEdyb3VwLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XHJcbiAgICBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5JykucmVtb3ZlQXR0cmlidXRlKCd0cmFuc2Zvcm0nKTtcclxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhjbGlwR3JvdXAsICdjbGlwLWdyb3VwJyk7XHJcblxyXG4gICAgc3ZnLnN0eWxlLnRyYW5zZm9ybSA9ICcnO1xyXG4gICAgc3ZnLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHNjaGVtYXRpYy5fYmJveC5qb2luKCcgJykpO1xyXG5cclxuICAgIGlmIChvbmx5T3ZlcmxheXMpIHsgLy8gbGVhdmUgb25seSBtYXJrdXBzXHJcbiAgICAgIGJhc2VDb250ZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYmFzZUNvbnRlbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBkaXYgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCAnJyk7XHJcbiAgICAvLyBwdXQgY29udGFpbmVyIGFyb3VuZCB0aGUgY29udGVudHMgYXMgaXQgd2FzXHJcbiAgICBkaXYuaW5uZXJIVE1MID0gKC8oXFw8c3ZnXFxzKyhbXj5dKilcXD4pL2dpKVxyXG4gICAgICAuZXhlYyhzY2hlbWF0aWMuX3Jhd0RhdGEpWzBdICsgJzwvc3ZnPic7XHJcblxyXG4gICAgTC5TVkcuY29weVNWR0NvbnRlbnRzKHN2ZywgZGl2LmZpcnN0Q2hpbGQpO1xyXG5cclxuICAgIHJldHVybiBkaXYuZmlyc3RDaGlsZDtcclxuICB9XHJcblxyXG59KTtcclxuXHJcblxyXG4vKipcclxuICogQHBhcmFtICB7T2JqZWN0fVxyXG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY1JlbmRlcmVyfVxyXG4gKi9cclxuTC5zY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzLnNjaGVtYXRpY1JlbmRlcmVyID0gZnVuY3Rpb24ob3B0aW9ucykge1xyXG4gIHJldHVybiBuZXcgTC5TY2hlbWF0aWNSZW5kZXJlcihvcHRpb25zKTtcclxufTtcclxuIiwidmFyIEwgICAgICAgID0gcmVxdWlyZSgnbGVhZmxldCcpO1xyXG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcclxudmFyIFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlcicpO1xyXG5cclxucmVxdWlyZSgnLi9ib3VuZHMnKTtcclxucmVxdWlyZSgnLi91dGlscycpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBTY2hlbWF0aWMgbGF5ZXIgdG8gd29yayB3aXRoIFNWRyBzY2hlbWF0aWNzIG9yIGJsdWVwcmludHMgaW4gTGVhZmxldFxyXG4gKlxyXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cclxuICogQGxpY2Vuc2UgTUlUXHJcbiAqIEBwcmVzZXJ2ZVxyXG4gKiBAY2xhc3MgU2NoZW1hdGljXHJcbiAqIEBleHRlbmRzIHtMLlJlY3RhbmdsZX1cclxuICovXHJcbkwuU2NoZW1hdGljID0gbW9kdWxlLmV4cG9ydHMgPSBMLlJlY3RhbmdsZS5leHRlbmQoe1xyXG5cclxuICBvcHRpb25zOiB7XHJcbiAgICBvcGFjaXR5OiAwLFxyXG4gICAgZmlsbE9wYWNpdHk6IDAsXHJcbiAgICB3ZWlnaHQ6IDEsXHJcbiAgICBhZGp1c3RUb1NjcmVlbjogdHJ1ZSxcclxuXHJcbiAgICAvLyBoYXJkY29kZSB6b29tIG9mZnNldCB0byBzbmFwIHRvIHNvbWUgbGV2ZWxcclxuICAgIHpvb21PZmZzZXQ6IDAsXHJcbiAgICBpbnRlcmFjdGl2ZTogZmFsc2UsXHJcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZSB8fCBMLkJyb3dzZXIuZ2Vja28gfHwgTC5Ccm93c2VyLmVkZ2VcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogQGNvbnN0cnVjdG9yXHJcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcclxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXHJcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gICAgICAgIG9wdGlvbnNcclxuICAgKi9cclxuICBpbml0aWFsaXplOiBmdW5jdGlvbihzdmcsIGJvdW5kcywgb3B0aW9ucykge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAqL1xyXG4gICAgdGhpcy5fc3ZnICAgID0gc3ZnO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbCBzdmcgd2lkdGgsIGNhdXNlIHdlIHdpbGwgaGF2ZSB0byBnZXQgcmlkIG9mIHRoYXQgdG8gbWFpbnRhaW5cclxuICAgICAqIHRoZSBhc3BlY3QgcmF0aW9cclxuICAgICAqXHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLl9pbml0aWFsV2lkdGggID0gJyc7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbCBzdmcgaGVpZ2h0XHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLl9pbml0aWFsSGVpZ2h0ID0gJyc7XHJcblxyXG4gICAgaWYgKCEoYm91bmRzIGluc3RhbmNlb2YgTC5MYXRMbmdCb3VuZHMpKSB7XHJcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XHJcbiAgICAgIGJvdW5kcyA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgb3B0aW9ucy5yZW5kZXJlciA9IG5ldyBSZW5kZXJlcih7XHJcbiAgICAgIHNjaGVtYXRpYzogdGhpc1xyXG4gICAgICAvLyBwYWRkaW5nOiBvcHRpb25zLnBhZGRpbmcgfHwgdGhpcy5vcHRpb25zLnBhZGRpbmcgfHwgMC4yNVxyXG4gICAgfSk7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7TC5MYXRMbmdCb3VuZHN9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcclxuXHJcbiAgICAvKipcclxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX3JhdGlvID0gMTtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge0wuUG9pbnR9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XHJcblxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge1N0cmluZ31cclxuICAgICAqL1xyXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xyXG5cclxuXHJcbiAgICAvKipcclxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxyXG4gICAgICovXHJcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCgwLCAwKTtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5fcmVhZHkgPSBmYWxzZTtcclxuXHJcblxyXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xyXG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XHJcbiAgICAgICAqL1xyXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XHJcblxyXG4gICAgICBpZiAoIW9wdGlvbnMubG9hZCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xyXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7TC5DYW52YXN9XHJcbiAgICAgKi9cclxuICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyID0gbnVsbDtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cclxuICAgICAqL1xyXG4gICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcclxuXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgdGhpcy5fcmFzdGVyU2hvd24gPSBmYWxzZTtcclxuXHJcblxyXG5cclxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwoXHJcbiAgICAgIHRoaXMsIEwubGF0TG5nQm91bmRzKFswLCAwXSwgWzAsIDBdKSwgb3B0aW9ucyk7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcclxuICAgKi9cclxuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XHJcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xyXG5cclxuICAgIHRoaXMuX3JlYWR5ID0gZmFsc2U7XHJcblxyXG4gICAgaWYgKCF0aGlzLl9ncm91cCkge1xyXG4gICAgICB0aGlzLl9ncm91cCA9IEwuU1ZHLmNyZWF0ZSgnZycpO1xyXG4gICAgICBMLlV0aWwuc3RhbXAodGhpcy5fZ3JvdXApO1xyXG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fZ3JvdXAsICdzdmctb3ZlcmxheScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5fc3ZnKSB7XHJcbiAgICAgIHRoaXMubG9hZCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoTC5Ccm93c2VyLmdlY2tvKSB7XHJcbiAgICAgIHRoaXMuX3BhdGguc2V0QXR0cmlidXRlKCdwb2ludGVyLWV2ZW50cycsICdub25lJyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcclxuICAgICAgdmFyIGNhbnZhc1JlbmRlcmVyID0gbmV3IEwuQ2FudmFzKHt9KS5hZGRUbyhtYXApO1xyXG4gICAgICBjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcclxuICAgICAgICAuaW5zZXJ0QmVmb3JlKGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xyXG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IGNhbnZhc1JlbmRlcmVyO1xyXG5cclxuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcclxuICAgICAgICAub24oJ3ByZWRyYWcnLCB0aGlzLl9vblByZURyYWcsIHRoaXMpXHJcbiAgICAgICAgLm9uKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcclxuXHJcbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXHJcbiAgICovXHJcbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xyXG4gICAgdGhpcy5fZ3JvdXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9ncm91cCk7XHJcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xyXG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XHJcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcclxuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcclxuICAgICAgICAub2ZmKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxyXG4gICAgICAgIC5vZmYoJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fcmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxyXG4gICAqL1xyXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xyXG4gICAgICBpZiAoIWVycikge1xyXG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XHJcbiAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnU3RyaW5nXHJcbiAgICogQHJldHVybiB7U3RyaW5nfVxyXG4gICAqL1xyXG4gIF9yZWFkU1ZHRGF0YTogZnVuY3Rpb24oc3ZnU3RyaW5nKSB7XHJcbiAgICB2YXIgcGFyc2VyICAgICA9IG5ldyBET01QYXJzZXIoKTtcclxuICAgIHZhciBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcclxuXHJcbiAgICB2YXIgZG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyhzdmdTdHJpbmcsICdhcHBsaWNhdGlvbi94bWwnKTtcclxuICAgIHZhciBjb250YWluZXIgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xyXG5cclxuICAgIHRoaXMuX2luaXRpYWxXaWR0aCAgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKCd3aWR0aCcpO1xyXG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpO1xyXG5cclxuICAgIHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChjb250YWluZXIpO1xyXG5cclxuICAgIC8vIGZpeCB3aWR0aCBjYXVzZSBvdGhlcndpc2UgcmFzdGVyemF0aW9uIHdpbGwgYnJlYWtcclxuICAgIHZhciB3aWR0aCAgPSB0aGlzLl9iYm94WzJdIC0gdGhpcy5fYmJveFswXTtcclxuICAgIHZhciBoZWlnaHQgPSB0aGlzLl9iYm94WzNdIC0gdGhpcy5fYmJveFsxXTtcclxuICAgIGlmIChwYXJzZUZsb2F0KHRoaXMuX2luaXRpYWxXaWR0aCkgIT09IHdpZHRoIHx8XHJcbiAgICAgIHBhcnNlRmxvYXQodGhpcy5faW5pdGlhbEhlaWdodCkgICE9PSBoZWlnaHQpIHtcclxuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnd2lkdGgnLCAgd2lkdGgpO1xyXG4gICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCdoZWlnaHQnLCBoZWlnaHQpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX3Jhd0RhdGEgICAgICAgPSBzdmdTdHJpbmc7XHJcbiAgICB0aGlzLl9wcm9jZXNzZWREYXRhID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhkb2MpO1xyXG5cclxuICAgIGlmIChjb250YWluZXIuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcclxuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHRoaXMuX2Jib3guam9pbignICcpKTtcclxuICAgICAgdGhpcy5fcHJvY2Vzc2VkRGF0YSA9IHRoaXMuX3Byb2Nlc3NlZERhdGEucmVwbGFjZSgnPHN2ZycsXHJcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIicgKyB0aGlzLl9iYm94LmpvaW4oJyAnKSArICdcIicpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjb250YWluZXI7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIFNWRyBpcyByZWFkeVxyXG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxyXG4gICAqL1xyXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XHJcbiAgICBpZiAoIXRoaXMuX21hcCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgc3ZnID0gdGhpcy5fcmVhZFNWR0RhdGEoc3ZnKTtcclxuICAgIHZhciBiYm94ID0gdGhpcy5fYmJveDtcclxuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcclxuICAgIHZhciBtYXBTaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLmFkanVzdFRvU2NyZWVuICYmIHNpemUueSAhPT0gbWFwU2l6ZS55KSB7XHJcbiAgICAgIHRoaXMuX3JhdGlvID0gTWF0aC5taW4obWFwU2l6ZS54IC8gc2l6ZS54LCBtYXBTaXplLnkgLyBzaXplLnkpO1xyXG4gICAgICB0aGlzLm9wdGlvbnMuX3pvb21PZmZzZXQgPSAodGhpcy5fcmF0aW8gPCAxKSA/XHJcbiAgICAgICAgdGhpcy5fcmF0aW8gOiAoMSAtIHRoaXMuX3JhdGlvKTtcclxuICAgICAgLy8gZGlzbWlzcyB0aGF0IG9mZnNldFxyXG4gICAgICB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCA9IDA7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XHJcbiAgICAvLyBjYWxjdWxhdGUgdGhlIGVkZ2VzIG9mIHRoZSBpbWFnZSwgaW4gY29vcmRpbmF0ZSBzcGFjZVxyXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxyXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXHJcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMl0sIGJib3hbMV1dLCBtaW5ab29tKVxyXG4gICAgKS5zY2FsZSh0aGlzLl9yYXRpbyk7XHJcblxyXG4gICAgdGhpcy5fc2l6ZSAgID0gc2l6ZTtcclxuICAgIHRoaXMuX29yaWdpbiA9IHRoaXMuX21hcC5wcm9qZWN0KHRoaXMuX2JvdW5kcy5nZXRDZW50ZXIoKSwgbWluWm9vbSk7XHJcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxyXG4gICAgICAxLCB0aGlzLl9vcmlnaW4ueCwgMSwgdGhpcy5fb3JpZ2luLnkpO1xyXG4gICAgdGhpcy5fdmlld0JveE9mZnNldCA9IEwucG9pbnQodGhpcy5fYmJveFswXSwgdGhpcy5fYmJveFsxXSk7XHJcblxyXG4gICAgdGhpcy5fY3JlYXRlQ29udGVudHMoc3ZnKTtcclxuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIuaW5zZXJ0QmVmb3JlKFxyXG4gICAgICB0aGlzLl9ncm91cCwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcclxuXHJcbiAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcclxuICAgIHRoaXMuX3JlYWR5ID0gdHJ1ZTtcclxuXHJcbiAgICB0aGlzLl9sYXRsbmdzID0gdGhpcy5fYm91bmRzVG9MYXRMbmdzKHRoaXMuX2JvdW5kcyk7XHJcbiAgICB0aGlzLl9yZXNldCgpO1xyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XHJcbiAgICAgIHRoaXMudG9JbWFnZSgpO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcclxuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxyXG4gICAqIEByZXR1cm4ge092ZXJsYXl9XHJcbiAgICovXHJcbiAgd2hlblJlYWR5OiBmdW5jdGlvbihjYWxsYmFjaywgY29udGV4dCkge1xyXG4gICAgaWYgKHRoaXMuX3JlYWR5KSB7XHJcbiAgICAgIGNhbGxiYWNrLmNhbGwoY29udGV4dCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cclxuICAgKi9cclxuICBnZXREb2N1bWVudDogZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XHJcbiAgICovXHJcbiAgZ2V0UmVuZGVyZXI6IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX3JlbmRlcmVyO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcclxuICAgKi9cclxuICBfY3JlYXRlQ29udGVudHM6IGZ1bmN0aW9uKHN2Zykge1xyXG4gICAgTC5TVkcuY29weVNWR0NvbnRlbnRzKHN2ZywgdGhpcy5fZ3JvdXApO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxyXG4gICAqL1xyXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XHJcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoXHJcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcclxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXHJcbiAgICApO1xyXG4gIH0sXHJcblxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogUG9zaXRpb24gb3VyIFwicmVjdGFuZ2xlXCJcclxuICAgKi9cclxuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XHJcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcclxuXHJcbiAgICBpZiAodGhpcy5fZ3JvdXApIHtcclxuICAgICAgdmFyIHRvcExlZnQgPSB0aGlzLl9tYXAubGF0TG5nVG9MYXllclBvaW50KHRoaXMuX2JvdW5kcy5nZXROb3J0aFdlc3QoKSk7XHJcbiAgICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXHJcbiAgICAgIHZhciBzY2FsZSAgID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxyXG4gICAgICAgIHRoaXMuX21hcC5nZXRab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkgKiB0aGlzLl9yYXRpbztcclxuXHJcbiAgICAgIC8vdG9wTGVmdCA9IHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSk7XHJcblxyXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXHJcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcclxuICAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyhcclxuICAgICAgICAgIHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSksIHNjYWxlKSk7XHJcblxyXG4gICAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcclxuICAgICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2NhbGUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXHJcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcclxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxyXG4gICAqL1xyXG4gIF91bnNjYWxlUG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxyXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXHJcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcclxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxyXG4gICAqL1xyXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX3RyYW5zZm9ybWF0aW9uLnRyYW5zZm9ybShcclxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXHJcbiAgICApO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9XHJcbiAgICovXHJcbiAgZ2V0UmF0aW86IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuX3JhdGlvO1xyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBUcmFuc2Zvcm0gbWFwIGNvb3JkIHRvIHNjaGVtYXRpYyBwb2ludFxyXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBjb29yZFxyXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XHJcbiAgICovXHJcbiAgcHJvamVjdFBvaW50OiBmdW5jdGlvbihjb29yZCkge1xyXG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcclxuICAgIHJldHVybiB0aGlzLl91bnNjYWxlUG9pbnQobWFwLnByb2plY3QoXHJcbiAgICAgIGNvb3JkLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpKTtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcclxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cclxuICAgKi9cclxuICB1bnByb2plY3RQb2ludDogZnVuY3Rpb24ocHQpIHtcclxuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XHJcbiAgICByZXR1cm4gbWFwLnVucHJvamVjdChcclxuICAgICAgdGhpcy5fc2NhbGVQb2ludChwdCksIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCk7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcclxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cclxuICAgKi9cclxuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xyXG4gICAgdmFyIHN3ID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWluKTtcclxuICAgIHZhciBuZSA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1heCk7XHJcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogVHJhbnNmb3JtIGxheWVyQm91bmRzIHRvIHNjaGVtYXRpYyBiYm94XHJcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xyXG4gICAqIEByZXR1cm4ge0wuQm91bmRzfVxyXG4gICAqL1xyXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xyXG4gICAgcmV0dXJuIG5ldyBMLkJvdW5kcyhcclxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldFNvdXRoV2VzdCgpKSxcclxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxyXG4gICAgKTtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xyXG4gICAqIEBwYXJhbSAge0Jvb2xlYW49fSBvdmVybGF5c09ubHlcclxuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fFN0cmluZ31cclxuICAgKi9cclxuICBleHBvcnRTVkc6IGZ1bmN0aW9uKHN0cmluZywgb3ZlcmxheXNPbmx5KSB7XHJcbiAgICB2YXIgbm9kZSA9IHRoaXMuX3JlbmRlcmVyLmV4cG9ydFNWRyhvdmVybGF5c09ubHkpO1xyXG4gICAgcmV0dXJuIHN0cmluZyA/IG5vZGUub3V0ZXJIVE1MIDogbm9kZTtcclxuICB9LFxyXG5cclxuXHJcbiAgIC8qKlxyXG4gICAqIFJhc3Rlcml6ZXMgdGhlIHNjaGVtYXRpY1xyXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cclxuICAgKi9cclxuICB0b0ltYWdlOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcclxuXHJcbiAgICAvLyB0aGlzIGRvZXNuJ3Qgd29yayBpbiBJRSwgZm9yY2Ugc2l6ZVxyXG4gICAgLy8gaW1nLnN0eWxlLmhlaWdodCA9IGltZy5zdHlsZS53aWR0aCA9ICcxMDAlJztcclxuICAgIGltZy5zdHlsZS53aWR0aCAgPSB0aGlzLl9zaXplLnggKyAncHgnO1xyXG4gICAgaW1nLnN0eWxlLmhlaWdodCA9IHRoaXMuX3NpemUueSArICdweCc7XHJcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xyXG5cclxuICAgIC8vIGhhY2sgdG8gdHJpY2sgSUUgcmVuZGVyaW5nIGVuZ2luZVxyXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICBMLnBvaW50KGltZy5vZmZzZXRXaWR0aCwgaW1nLm9mZnNldEhlaWdodCk7XHJcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIGltZy5zdHlsZS5vcGFjaXR5ID0gMDtcclxuICAgIGltZy5zdHlsZS56SW5kZXggPSAtOTk5OTtcclxuICAgIGltZy5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xyXG5cclxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcclxuICAgICAgdGhpcy5fcmFzdGVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fcmFzdGVyKTtcclxuICAgICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoaW1nLCAnc2NoZW1hdGljLWltYWdlJyk7XHJcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcclxuICAgICAgLmluc2VydEJlZm9yZShpbWcsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xyXG4gICAgdGhpcy5fcmFzdGVyID0gaW1nO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgU1ZHIGRhdGEgdG8gYmFzZTY0IGZvciByYXN0ZXJpemF0aW9uXHJcbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcclxuICAgKi9cclxuICB0b0Jhc2U2NDogZnVuY3Rpb24oKSB7XHJcbiAgICAvLyBjb25zb2xlLnRpbWUoJ2Jhc2U2NCcpO1xyXG4gICAgdmFyIGJhc2U2NCA9IHRoaXMuX2Jhc2U2NGVuY29kZWQgfHxcclxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Byb2Nlc3NlZERhdGEpKSk7XHJcbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gYmFzZTY0O1xyXG4gICAgLy8gY29uc29sZS50aW1lRW5kKCdiYXNlNjQnKTtcclxuXHJcbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogUmVkcmF3IGNhbnZhcyBvbiByZWFsIGNoYW5nZXM6IHpvb20sIHZpZXdyZXNldFxyXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcclxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxyXG4gICAqL1xyXG4gIF9yZWRyYXdDYW52YXM6IGZ1bmN0aW9uKHRvcExlZnQsIHNjYWxlKSB7XHJcbiAgICBpZiAoIXRoaXMuX3Jhc3Rlcikge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNpemUgPSB0aGlzLmdldE9yaWdpbmFsU2l6ZSgpLm11bHRpcGx5Qnkoc2NhbGUpO1xyXG4gICAgdmFyIGN0eCA9IHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jdHg7XHJcblxyXG4gICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XHJcbiAgICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fcmFzdGVyLCB0b3BMZWZ0LngsIHRvcExlZnQueSwgc2l6ZS54LCBzaXplLnkpO1xyXG4gICAgfSwgdGhpcyk7XHJcbiAgfSxcclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xyXG4gICAqL1xyXG4gIF9zaG93UmFzdGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIgJiYgIXRoaXMuX3Jhc3RlclNob3duKSB7XHJcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcclxuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICAgICAgdGhpcy5fcmFzdGVyU2hvd24gPSB0cnVlO1xyXG5cclxuICAgIH1cclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogU3dhcCBiYWNrIHRvIFNWR1xyXG4gICAqL1xyXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIgJiYgdGhpcy5fcmFzdGVyU2hvd24pIHtcclxuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XHJcbiAgICAgIHRoaXMuX2dyb3VwLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xyXG4gICAgICB0aGlzLl9yYXN0ZXJTaG93biA9IGZhbHNlO1xyXG4gICAgfVxyXG4gIH0sXHJcblxyXG5cclxuICAvKipcclxuICAgKiBJRS1vbmx5XHJcbiAgICogUmVwbGFjZSBTVkcgd2l0aCBjYW52YXMgYmVmb3JlIGRyYWdcclxuICAgKi9cclxuICBfb25QcmVEcmFnOiBmdW5jdGlvbigpIHtcclxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XHJcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcclxuICAgIH1cclxuICB9LFxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxyXG4gICAqL1xyXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcclxuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbn0pO1xyXG5cclxuXHJcbi8vIGFsaWFzZXNcclxuTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3QgICA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0UG9pbnQ7XHJcbkwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3QgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0UG9pbnQ7XHJcblxyXG5cclxuLyoqXHJcbiAqIEZhY3RvcnlcclxuICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcclxuICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xyXG4gKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xyXG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY31cclxuICovXHJcbkwuc2NoZW1hdGljID0gZnVuY3Rpb24gKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XHJcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpYyhzdmcsIGJvdW5kcywgb3B0aW9ucyk7XHJcbn07XHJcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xyXG5cclxuTC5Ccm93c2VyLnBoYW50b21qcyA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdwaGFudG9tJyk7XHJcblxyXG4vLyA8dXNlPiB0YWdzIGFyZSBicm9rZW4gaW4gSUUgaW4gc28gbWFueSB3YXlzXHJcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiB3aW5kb3cpIHtcclxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcclxuICAgIGdldDogZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsO1xyXG4gICAgfSxcclxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XHJcbiAgICAgIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWwgPSB2YWw7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQHBhcmFtICB7Kn0gIG9cclxuICogQHJldHVybiB7Qm9vbGVhbn1cclxuICovXHJcbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcclxuICByZXR1cm4gKFxyXG4gICAgdHlwZW9mIE5vZGUgPT09ICdvYmplY3QnID9cclxuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcclxuICAgIG8gJiYgdHlwZW9mIG8gPT09ICdvYmplY3QnICYmXHJcbiAgICB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcclxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xyXG4gICk7XHJcbn07XHJcblxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xyXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cclxuICovXHJcbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XHJcbiAgdmFyIHZpZXdCb3ggPSBzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94Jyk7XHJcbiAgdmFyIGJib3g7XHJcbiAgaWYgKHZpZXdCb3gpIHtcclxuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xyXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XHJcbiAgICAvLyBiYm94ID0gY2xvbmUuZ2V0QkJveCgpO1xyXG4gICAgYmJveCA9IGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKGNsb25lKTtcclxuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY2xvbmUpO1xyXG4gICAgcmV0dXJuIGJib3g7XHJcbiAgfVxyXG4gIHJldHVybiBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogU2ltcGx5IGJydXRlIGZvcmNlOiB0YWtlcyBhbGwgc3ZnIG5vZGVzLCBjYWxjdWxhdGVzIGJvdW5kaW5nIGJveFxyXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcclxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XHJcbiAqL1xyXG5mdW5jdGlvbiBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhzdmcpIHtcclxuICB2YXIgYmJveCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcclxuICB2YXIgbm9kZXMgPSBbXS5zbGljZS5jYWxsKHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCcqJykpO1xyXG4gIHZhciBtaW4gPSBNYXRoLm1pbiwgbWF4ID0gTWF0aC5tYXg7XHJcblxyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcclxuICAgIGlmIChub2RlLmdldEJCb3gpIHtcclxuICAgICAgbm9kZSA9IG5vZGUuZ2V0QkJveCgpO1xyXG5cclxuICAgICAgYmJveFswXSA9IG1pbihub2RlLngsIGJib3hbMF0pO1xyXG4gICAgICBiYm94WzFdID0gbWluKG5vZGUueSwgYmJveFsxXSk7XHJcblxyXG4gICAgICBiYm94WzJdID0gbWF4KG5vZGUueCArIG5vZGUud2lkdGgsIGJib3hbMl0pO1xyXG4gICAgICBiYm94WzNdID0gbWF4KG5vZGUueSArIG5vZGUuaGVpZ2h0LCBiYm94WzNdKTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIGJib3g7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJcclxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cclxuICovXHJcbkwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIgPSBmdW5jdGlvbihzdHIpIHtcclxuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHdyYXBwZXIuaW5uZXJIVE1MID0gc3RyO1xyXG4gIHJldHVybiB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBAcGFyYW0gIHtMLlBvaW50fSB0cmFuc2xhdGVcclxuICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcclxuICogQHJldHVybiB7U3RyaW5nfVxyXG4gKi9cclxuTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZSwgc2NhbGUpIHtcclxuICByZXR1cm4gJ21hdHJpeCgnICtcclxuICAgIFtzY2FsZSwgMCwgMCwgc2NhbGUsIHRyYW5zbGF0ZS54LCB0cmFuc2xhdGUueV0uam9pbignLCcpICsgJyknO1xyXG59O1xyXG5cclxuXHJcbi8qKlxyXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSAgICAgICAgIHN2Z1xyXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fEVsZW1lbnR9IGNvbnRhaW5lclxyXG4gKi9cclxuTC5TVkcuY29weVNWR0NvbnRlbnRzID0gZnVuY3Rpb24oc3ZnLCBjb250YWluZXIpIHtcclxuICAvLyBTVkcgaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFIGFuZCBQaGFudG9tSlNcclxuICBpZiAoTC5Ccm93c2VyLmllIHx8IEwuQnJvd3Nlci5waGFudG9tanMpIHtcclxuICAgIHZhciBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xyXG4gICAgZG8ge1xyXG4gICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoY2hpbGQpO1xyXG4gICAgICBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xyXG4gICAgfSB3aGlsZShjaGlsZCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xyXG4gIH1cclxufTtcclxuIl19
