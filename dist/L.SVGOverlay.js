(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).SVGOverlay = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = require('./src/schematic');

},{"./src/schematic":4}],2:[function(require,module,exports){
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
var b64 = require('Base64');
var Renderer = require('./schematic_renderer');

require('./bounds');
require('./utils');

/**
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
    console.log(this._renderer);
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
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function onLoad(svg) {
    if (!this._map) {
      return;
    }

    this._rawData = svg;
    svg = L.DomUtil.getSVGContainer(svg);
    var bbox = this._bbox = L.DomUtil.getSVGBBox(svg);
    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (this.options.adjustToScreen && size.y !== mapSize.y) {
      this._ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this.options.zoomOffset = this._ratio < 1 ? this._ratio : 1 - this._ratio;
    }

    if (svg.getAttribute('viewBox') === null) {
      this._rawData = this._rawData.replace('<svg', '<svg viewBox="' + bbox.join(' ') + '"');
    }

    var minZoom = this._map.getMinZoom() + this.options.zoomOffset;
    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(this._map.unproject([bbox[0], bbox[3]], minZoom), this._map.unproject([bbox[2], bbox[1]], minZoom));
    this._bounds = this._bounds.scale(this._ratio);

    this._size = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(1, this._origin.x, 1, this._origin.y);

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

      // compensate viewbox dismissal with a shift here
      this._group.setAttribute('transform', L.DomUtil.getMatrixString(topLeft, scale));

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
   * @return {SVGElement|String}
   */
  exportSVG: function exportSVG(string) {
    var node = this._renderer.exportSVG();
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
    var base64 = this._base64encoded || b64.btoa(unescape(encodeURIComponent(this._rawData)));
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

},{"./bounds":3,"./schematic_renderer":5,"./utils":6,"Base64":2,"leaflet":undefined}],5:[function(require,module,exports){
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
   * @return {String} [description]
   */
  exportSVG: function exportSVG() {
    var schematic = this.options.schematic;
    var svg = this._container.cloneNode(true);

    var clipPath = L.SVG.create('clipPath');
    var clipRect = L.SVG.create('rect');

    clipRect.setAttribute('x', schematic._bbox[0]);
    clipRect.setAttribute('y', schematic._bbox[1]);
    clipRect.setAttribute('width', schematic._bbox[2]);
    clipRect.setAttribute('height', schematic._bbox[3]);
    clipPath.appendChild(clipRect);

    var clipId = 'viewboxClip-' + L.Util.stamp(schematic._group);
    clipPath.setAttribute('id', clipId);
    var defs = svg.querySelector('.svg-overlay defs');
    if (!defs) {
      defs = L.SVG.create('defs');
      svg.querySelector('.svg-overlay').appendChild(defs);
    }
    defs.appendChild(clipPath);

    var clipGroup = svg.lastChild;
    clipGroup.setAttribute('clip-path', 'url(#' + clipId + ')');
    clipGroup.firstChild.setAttribute('transform', clipGroup.getAttribute('transform'));
    clipGroup.removeAttribute('transform');
    svg.querySelector('.svg-overlay').removeAttribute('transform');

    svg.style.transform = '';
    svg.setAttribute('viewBox', schematic._bbox.join(' '));

    var div = document.createElement('div');
    div.innerHTML = /(\<svg\s+([^>]*)\>)/gi.exec(schematic._rawData)[0] + '</svg>';
    div.firstChild.innerHTML = svg.innerHTML;

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

},{}],6:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvc2NoZW1hdGljX3JlbmRlcmVyLmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxpQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdEQSxJQUFJLElBQUksUUFBUSxTQUFSLENBQUo7Ozs7O0FBS0osRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixNQUFuQixHQUE0QixZQUFXO0FBQ3JDLFNBQU8sQ0FBQyxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULENBQTVDLENBRHFDO0NBQVg7Ozs7OztBQVM1QixFQUFFLE1BQUYsQ0FBUyxTQUFULENBQW1CLEtBQW5CLEdBQTJCLFVBQVMsS0FBVCxFQUFnQjtBQUN6QyxNQUFJLE1BQU0sS0FBSyxHQUFMLENBRCtC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LEdBQXBCLENBRndDO0FBR3hDLFNBQU8sUUFBUSxhQUFSLENBQXNCLEtBQXRCLENBQVAsQ0FId0M7Q0FBZDs7Ozs7OztBQVk1QixFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBVixFQUFhLFVBQVUsQ0FBVixDQUFsQyxDQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRHRELENBRDhDO0NBQTNCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvc2NoZW1hdGljJyk7XG4iLCI7KGZ1bmN0aW9uICgpIHtcblxuICB2YXIgb2JqZWN0ID0gdHlwZW9mIGV4cG9ydHMgIT0gJ3VuZGVmaW5lZCcgPyBleHBvcnRzIDogdGhpczsgLy8gIzg6IHdlYiB3b3JrZXJzXG4gIHZhciBjaGFycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XG5cbiAgZnVuY3Rpb24gSW52YWxpZENoYXJhY3RlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB9XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3I7XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG4gIC8vIGVuY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5OTE2Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9uaWduYWddXG4gIG9iamVjdC5idG9hIHx8IChcbiAgb2JqZWN0LmJ0b2EgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KTtcbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJcbiAgICAgIHZhciBibG9jaywgY2hhckNvZGUsIGlkeCA9IDAsIG1hcCA9IGNoYXJzLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGlmIHRoZSBuZXh0IHN0ciBpbmRleCBkb2VzIG5vdCBleGlzdDpcbiAgICAgIC8vICAgY2hhbmdlIHRoZSBtYXBwaW5nIHRhYmxlIHRvIFwiPVwiXG4gICAgICAvLyAgIGNoZWNrIGlmIGQgaGFzIG5vIGZyYWN0aW9uYWwgZGlnaXRzXG4gICAgICBzdHIuY2hhckF0KGlkeCB8IDApIHx8IChtYXAgPSAnPScsIGlkeCAlIDEpO1xuICAgICAgLy8gXCI4IC0gaWR4ICUgMSAqIDhcIiBnZW5lcmF0ZXMgdGhlIHNlcXVlbmNlIDIsIDQsIDYsIDhcbiAgICAgIG91dHB1dCArPSBtYXAuY2hhckF0KDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICAgICkge1xuICAgICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpZHggKz0gMy80KTtcbiAgICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvcihcIididG9hJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZW5jb2RlZCBjb250YWlucyBjaGFyYWN0ZXJzIG91dHNpZGUgb2YgdGhlIExhdGluMSByYW5nZS5cIik7XG4gICAgICB9XG4gICAgICBibG9jayA9IGJsb2NrIDw8IDggfCBjaGFyQ29kZTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbiAgLy8gZGVjb2RlclxuICAvLyBbaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTAyMDM5Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9hdGtdXG4gIG9iamVjdC5hdG9iIHx8IChcbiAgb2JqZWN0LmF0b2IgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KS5yZXBsYWNlKC89KyQvLCAnJyk7XG4gICAgaWYgKHN0ci5sZW5ndGggJSA0ID09IDEpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYXRvYicgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGRlY29kZWQgaXMgbm90IGNvcnJlY3RseSBlbmNvZGVkLlwiKTtcbiAgICB9XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyc1xuICAgICAgdmFyIGJjID0gMCwgYnMsIGJ1ZmZlciwgaWR4ID0gMCwgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBnZXQgbmV4dCBjaGFyYWN0ZXJcbiAgICAgIGJ1ZmZlciA9IHN0ci5jaGFyQXQoaWR4KyspO1xuICAgICAgLy8gY2hhcmFjdGVyIGZvdW5kIGluIHRhYmxlPyBpbml0aWFsaXplIGJpdCBzdG9yYWdlIGFuZCBhZGQgaXRzIGFzY2lpIHZhbHVlO1xuICAgICAgfmJ1ZmZlciAmJiAoYnMgPSBiYyAlIDQgPyBicyAqIDY0ICsgYnVmZmVyIDogYnVmZmVyLFxuICAgICAgICAvLyBhbmQgaWYgbm90IGZpcnN0IG9mIGVhY2ggNCBjaGFyYWN0ZXJzLFxuICAgICAgICAvLyBjb252ZXJ0IHRoZSBmaXJzdCA4IGJpdHMgdG8gb25lIGFzY2lpIGNoYXJhY3RlclxuICAgICAgICBiYysrICUgNCkgPyBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgyNTUgJiBicyA+PiAoLTIgKiBiYyAmIDYpKSA6IDBcbiAgICApIHtcbiAgICAgIC8vIHRyeSB0byBmaW5kIGNoYXJhY3RlciBpbiB0YWJsZSAoMC02Mywgbm90IGZvdW5kID0+IC0xKVxuICAgICAgYnVmZmVyID0gY2hhcnMuaW5kZXhPZihidWZmZXIpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9KTtcblxufSgpKTtcbiIsInZhciBMID0gcmVxdWlyZSgnbGVhZmxldCcpO1xuXG4vKipcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUudG9CQm94ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBbdGhpcy5taW4ueCwgdGhpcy5taW4ueSwgdGhpcy5tYXgueCwgdGhpcy5tYXgueV07XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TnVtYmVyfSB2YWx1ZVxuICogQHJldHVybiB7TC5Cb3VuZHN9XG4gKi9cbkwuQm91bmRzLnByb3RvdHlwZS5zY2FsZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHZhciBtYXggPSB0aGlzLm1heDtcbiAgdmFyIG1pbiA9IHRoaXMubWluO1xuICB2YXIgZGVsdGFYID0gKChtYXgueCAtIG1pbi54KSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG1heC55IC0gbWluLnkpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuQm91bmRzKFtcbiAgICBbbWluLnggLSBkZWx0YVgsIG1pbi55IC0gZGVsdGFZXSxcbiAgICBbbWF4LnggKyBkZWx0YVgsIG1heC55ICsgZGVsdGFZXVxuICBdKTtcbn07XG5cblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMuZ2V0V2VzdCgpLCB0aGlzLmdldFNvdXRoKCksIHRoaXMuZ2V0RWFzdCgpLCB0aGlzLmdldE5vcnRoKCldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICovXG5MLkxhdExuZ0JvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbmUgPSB0aGlzLl9ub3J0aEVhc3Q7XG4gIHZhciBzdyA9IHRoaXMuX3NvdXRoV2VzdDtcbiAgdmFyIGRlbHRhWCA9ICgobmUubG5nIC0gc3cubG5nKSAvIDIpICogKHZhbHVlIC0gMSk7XG4gIHZhciBkZWx0YVkgPSAoKG5lLmxhdCAtIHN3LmxhdCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuXG4gIHJldHVybiBuZXcgTC5MYXRMbmdCb3VuZHMoW1xuICAgIFtzdy5sYXQgLSBkZWx0YVksIHN3LmxuZyAtIGRlbHRhWF0sXG4gICAgW25lLmxhdCArIGRlbHRhWSwgbmUubG5nICsgZGVsdGFYXVxuICBdKTtcbn07XG4iLCJ2YXIgTCAgICAgICAgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgYjY0ICAgICAgPSByZXF1aXJlKCdCYXNlNjQnKTtcbnZhciBSZW5kZXJlciA9IHJlcXVpcmUoJy4vc2NoZW1hdGljX3JlbmRlcmVyJyk7XG5cbnJlcXVpcmUoJy4vYm91bmRzJyk7XG5yZXF1aXJlKCcuL3V0aWxzJyk7XG5cblxuLyoqXG4gKiBAY2xhc3MgU2NoZW1hdGljXG4gKiBAZXh0ZW5kcyB7TC5SZWN0YW5nbGV9XG4gKi9cbkwuU2NoZW1hdGljID0gbW9kdWxlLmV4cG9ydHMgPSBMLlJlY3RhbmdsZS5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBvcGFjaXR5OiAwLFxuICAgIGZpbGxPcGFjaXR5OiAwLFxuICAgIHdlaWdodDogMSxcbiAgICBhZGp1c3RUb1NjcmVlbjogdHJ1ZSxcbiAgICAvLyBoYXJkY29kZSB6b29tIG9mZnNldCB0byBzbmFwIHRvIHNvbWUgbGV2ZWxcbiAgICB6b29tT2Zmc2V0OiAwLFxuICAgIGludGVyYWN0aXZlOiBmYWxzZSxcbiAgICB1c2VSYXN0ZXI6IEwuQnJvd3Nlci5pZVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihzdmcsIGJvdW5kcywgb3B0aW9ucykge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9zdmcgICAgPSBzdmc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIG9wdGlvbnMucmVuZGVyZXIgPSBuZXcgUmVuZGVyZXIoe1xuICAgICAgc2NoZW1hdGljOiB0aGlzXG4gICAgICAvLyBwYWRkaW5nOiBvcHRpb25zLnBhZGRpbmcgfHwgdGhpcy5vcHRpb25zLnBhZGRpbmcgfHwgMC4yNVxuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcrXG4gICAgICAgICAgJ1lvdSBoYXZlIHRvIHByb3ZpZGUgYGxvYWRgIGZ1bmN0aW9uIHdpdGggdGhlIG9wdGlvbnMnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHRWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9ncm91cCA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNhbnZhc31cbiAgICAgKi9cbiAgICB0aGlzLl9jYW52YXNSZW5kZXJlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAqL1xuICAgIHRoaXMuX3Jhc3RlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzID0gbnVsbDtcblxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwoXG4gICAgICB0aGlzLCBMLmxhdExuZ0JvdW5kcyhbMCwwXSwgWzAsMF0pLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcblxuICAgIGlmICghdGhpcy5fZ3JvdXApIHtcbiAgICAgIHRoaXMuX2dyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgICBMLlV0aWwuc3RhbXAodGhpcy5fZ3JvdXApO1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2dyb3VwLCAnc3ZnLW92ZXJsYXknKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuX3N2Zykge1xuICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkKHRoaXMuX3N2Zyk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHZhciBjYW52YXNSZW5kZXJlciA9IG5ldyBMLkNhbnZhcyh7fSkuYWRkVG8obWFwKTtcbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgICAuaW5zZXJ0QmVmb3JlKGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBjYW52YXNSZW5kZXJlcjtcblxuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcbiAgICAgICAgLm9uKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgICBjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKi9cbiAgb25SZW1vdmU6IGZ1bmN0aW9uKG1hcCkge1xuICAgIHRoaXMuX2dyb3VwLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fZ3JvdXApO1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub2ZmKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5fcmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xuICAgIGNvbnNvbGUubG9nKHRoaXMuX3JlbmRlcmVyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMb2FkcyBzdmcgdmlhIFhIUlxuICAgKi9cbiAgbG9hZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vcHRpb25zLmxvYWQodGhpcy5fdXJsLCBmdW5jdGlvbihlcnIsIHN2Zykge1xuICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgdGhpcy5vbkxvYWQoc3ZnKTtcbiAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNWRyBpcyByZWFkeVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2ZyBtYXJrdXBcbiAgICovXG4gIG9uTG9hZDogZnVuY3Rpb24oc3ZnKSB7XG4gICAgaWYgKCF0aGlzLl9tYXApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLl9yYXdEYXRhID0gc3ZnO1xuICAgIHN2ZyA9IEwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIoc3ZnKTtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3ggPSBMLkRvbVV0aWwuZ2V0U1ZHQkJveChzdmcpO1xuICAgIHZhciBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICB2YXIgbWFwU2l6ZSA9IHRoaXMuX21hcC5nZXRTaXplKCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmFkanVzdFRvU2NyZWVuICYmIHNpemUueSAhPT0gbWFwU2l6ZS55KSB7XG4gICAgICB0aGlzLl9yYXRpbyA9IE1hdGgubWluKG1hcFNpemUueCAvIHNpemUueCwgbWFwU2l6ZS55IC8gc2l6ZS55KTtcbiAgICAgIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0ID0gKHRoaXMuX3JhdGlvIDwgMSkgP1xuICAgICAgICB0aGlzLl9yYXRpbyA6ICgxIC0gdGhpcy5fcmF0aW8pO1xuICAgIH1cblxuICAgIGlmIChzdmcuZ2V0QXR0cmlidXRlKCd2aWV3Qm94JykgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3Jhd0RhdGEgPSB0aGlzLl9yYXdEYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIGJib3guam9pbignICcpICsgJ1wiJyk7XG4gICAgfVxuXG4gICAgdmFyIG1pblpvb20gPSB0aGlzLl9tYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSBlZGdlcyBvZiB0aGUgaW1hZ2UsIGluIGNvb3JkaW5hdGUgc3BhY2VcbiAgICB0aGlzLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzBdLCBiYm94WzNdXSwgbWluWm9vbSksXG4gICAgICB0aGlzLl9tYXAudW5wcm9qZWN0KFtiYm94WzJdLCBiYm94WzFdXSwgbWluWm9vbSlcbiAgICApO1xuICAgIHRoaXMuX2JvdW5kcyA9IHRoaXMuX2JvdW5kcy5zY2FsZSh0aGlzLl9yYXRpbyk7XG5cbiAgICB0aGlzLl9zaXplICAgPSBzaXplO1xuICAgIHRoaXMuX29yaWdpbiA9IHRoaXMuX21hcC5wcm9qZWN0KHRoaXMuX2JvdW5kcy5nZXRDZW50ZXIoKSwgbWluWm9vbSk7XG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBuZXcgTC5UcmFuc2Zvcm1hdGlvbihcbiAgICAgIDEsIHRoaXMuX29yaWdpbi54LCAxLCB0aGlzLl9vcmlnaW4ueSk7XG5cbiAgICB0aGlzLl9jcmVhdGVDb250ZW50cyhzdmcpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIuaW5zZXJ0QmVmb3JlKFxuICAgICAgdGhpcy5fZ3JvdXAsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIuZmlyc3RDaGlsZCk7XG5cbiAgICB0aGlzLmZpcmUoJ2xvYWQnKTtcblxuICAgIHRoaXMuX2xhdGxuZ3MgPSB0aGlzLl9ib3VuZHNUb0xhdExuZ3ModGhpcy5fYm91bmRzKTtcbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMudG9JbWFnZSgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICogQHBhcmFtICB7Kj19ICAgICAgIGNvbnRleHRcbiAgICogQHJldHVybiB7T3ZlcmxheX1cbiAgICovXG4gIHdoZW5SZWFkeTogZnVuY3Rpb24oY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICBpZiAodGhpcy5fYm91bmRzKSB7XG4gICAgICBjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gICAqL1xuICBnZXREb2N1bWVudDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dyb3VwO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XG4gICAqL1xuICBnZXRSZW5kZXJlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlbmRlcmVyO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICAgKi9cbiAgX2NyZWF0ZUNvbnRlbnRzOiBmdW5jdGlvbihzdmcpIHtcbiAgICBpZiAoTC5Ccm93c2VyLmllKSB7IC8vIGlubmVySFRNTCBkb2Vzbid0IHdvcmsgZm9yIFNWRyBpbiBJRVxuICAgICAgdmFyIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgICBkbyB7XG4gICAgICAgIHRoaXMuX2dyb3VwLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgICAgY2hpbGQgPSBzdmcuZmlyc3RDaGlsZDtcbiAgICAgIH0gd2hpbGUoY2hpbGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ncm91cC5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgZ2V0T3JpZ2luYWxTaXplOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgYmJveCA9IHRoaXMuX2Jib3g7XG4gICAgcmV0dXJuIG5ldyBMLlBvaW50KFxuICAgICAgTWF0aC5hYnMoYmJveFswXSAtIGJib3hbMl0pLFxuICAgICAgTWF0aC5hYnMoYmJveFsxXSAtIGJib3hbM10pXG4gICAgKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG91ciBcInJlY3RhbmdsZVwiXG4gICAqL1xuICBfdXBkYXRlUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5SZWN0YW5nbGUucHJvdG90eXBlLl91cGRhdGVQYXRoLmNhbGwodGhpcyk7XG5cbiAgICBpZiAodGhpcy5fZ3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgLy8gc2NhbGUgaXMgc2NhbGUgZmFjdG9yLCB6b29tIGlzIHpvb20gbGV2ZWxcbiAgICAgIHZhciBzY2FsZSAgID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpICogdGhpcy5fcmF0aW87XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdCwgc2NhbGUpKTtcblxuICAgICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICAgIHRoaXMuX3JlZHJhd0NhbnZhcyh0b3BMZWZ0LCBzY2FsZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNjYWxlcyBwcm9qZWN0ZWQgcG9pbnQgRlJPTSB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfdW5zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkuZGl2aWRlQnkodGhpcy5fcmF0aW8pKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IFRPIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF9zY2FsZVBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcmF0aW87XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIG1hcCBjb29yZCB0byBzY2hlbWF0aWMgcG9pbnRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGNvb3JkXG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBwcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKGNvb3JkKSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KG1hcC5wcm9qZWN0KFxuICAgICAgY29vcmQsIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQ6IGZ1bmN0aW9uKHB0KSB7XG4gICAgdmFyIG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gbWFwLnVucHJvamVjdChcbiAgICAgIHRoaXMuX3NjYWxlUG9pbnQocHQpLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5MYXRMbmdCb3VuZHN9XG4gICAqL1xuICB1bnByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHZhciBzdyA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1pbik7XG4gICAgdmFyIG5lID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWF4KTtcbiAgICByZXR1cm4gTC5sYXRMbmdCb3VuZHMoc3csIG5lKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbGF5ZXJCb3VuZHMgdG8gc2NoZW1hdGljIGJib3hcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAgICovXG4gIHByb2plY3RCb3VuZHM6IGZ1bmN0aW9uKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xuICAgKiBAcmV0dXJuIHtTVkdFbGVtZW50fFN0cmluZ31cbiAgICovXG4gIGV4cG9ydFNWRzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLl9yZW5kZXJlci5leHBvcnRTVkcoKTtcbiAgICByZXR1cm4gc3RyaW5nID8gbm9kZS5vdXRlckhUTUwgOiBub2RlO1xuICB9LFxuXG5cbiAgIC8qKlxuICAgKiBSYXN0ZXJpemVzIHRoZSBzY2hlbWF0aWNcbiAgICogQHJldHVybiB7U2NoZW1hdGljfVxuICAgKi9cbiAgdG9JbWFnZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuXG4gICAgLy8gdGhpcyBkb2Vzbid0IHdvcmsgaW4gSUUsIGZvcmNlIHNpemVcbiAgICAvLyBpbWcuc3R5bGUuaGVpZ2h0ID0gaW1nLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGltZy5zdHlsZS53aWR0aCA9IHRoaXMuX3NpemUueCArICdweCc7XG4gICAgaW1nLnN0eWxlLmhlaWdodCA9IHRoaXMuX3NpemUueSArICdweCc7XG4gICAgaW1nLnNyYyA9IHRoaXMudG9CYXNlNjQoKTtcblxuICAgIC8vIGhhY2sgdG8gdHJpY2sgSUUgcmVuZGVyaW5nIGVuZ2luZVxuICAgIEwuRG9tRXZlbnQub24oaW1nLCAnbG9hZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIEwucG9pbnQoaW1nLm9mZnNldFdpZHRoLCBpbWcub2Zmc2V0SGVpZ2h0KTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICBpbWcuc3R5bGUub3BhY2l0eSA9IDA7XG5cbiAgICBpZiAodGhpcy5fcmFzdGVyKSB7XG4gICAgICB0aGlzLl9yYXN0ZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9yYXN0ZXIpO1xuICAgICAgdGhpcy5fcmFzdGVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3MoaW1nLCAnc2NoZW1hdGljLWltYWdlJyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5wYXJlbnROb2RlXG4gICAgICAuaW5zZXJ0QmVmb3JlKGltZywgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lcik7XG4gICAgdGhpcy5fcmFzdGVyID0gaW1nO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENvbnZlcnQgU1ZHIGRhdGEgdG8gYmFzZTY0IGZvciByYXN0ZXJpemF0aW9uXG4gICAqIEByZXR1cm4ge1N0cmluZ30gYmFzZTY0IGVuY29kZWQgU1ZHXG4gICAqL1xuICB0b0Jhc2U2NDogZnVuY3Rpb24oKSB7XG4gICAgLy8gY29uc29sZS50aW1lKCdiYXNlNjQnKTtcbiAgICB2YXIgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Jhd0RhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuICdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LCcgKyBiYXNlNjQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IGNhbnZhcyBvbiByZWFsIGNoYW5nZXM6IHpvb20sIHZpZXdyZXNldFxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSB0b3BMZWZ0XG4gICAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gICAqL1xuICBfcmVkcmF3Q2FudmFzOiBmdW5jdGlvbih0b3BMZWZ0LCBzY2FsZSkge1xuICAgIGlmICghdGhpcy5fcmFzdGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNpemUgPSB0aGlzLmdldE9yaWdpbmFsU2l6ZSgpLm11bHRpcGx5Qnkoc2NhbGUpO1xuICAgIHZhciBjdHggPSB0aGlzLl9jYW52YXNSZW5kZXJlci5fY3R4O1xuXG4gICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICBjdHguZHJhd0ltYWdlKHRoaXMuX3Jhc3RlciwgdG9wTGVmdC54LCB0b3BMZWZ0LnksIHNpemUueCwgc2l6ZS55KTtcbiAgICB9LCB0aGlzKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUb2dnbGUgY2FudmFzIGluc3RlYWQgb2YgU1ZHIHdoZW4gZHJhZ2dpbmdcbiAgICovXG4gIF9zaG93UmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgICB0aGlzLl9ncm91cC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN3YXAgYmFjayB0byBTVkdcbiAgICovXG4gIF9oaWRlUmFzdGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICAgIHRoaXMuX2dyb3VwLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIElFLW9ubHlcbiAgICogUmVwbGFjZSBTVkcgd2l0aCBjYW52YXMgYmVmb3JlIGRyYWdcbiAgICovXG4gIF9vblByZURyYWc6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9zaG93UmFzdGVyKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIERyYWcgZW5kOiBwdXQgU1ZHIGJhY2sgaW4gSUVcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLl9oaWRlUmFzdGVyKCk7XG4gICAgfVxuICB9XG5cbn0pO1xuXG5cbi8vIGFsaWFzZXNcbkwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0ICAgPSBMLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdFBvaW50O1xuTC5TY2hlbWF0aWMucHJvdG90eXBlLnVucHJvamVjdCA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS51bnByb2plY3RQb2ludDtcblxuXG4vKipcbiAqIEZhY3RvcnlcbiAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgICBzdmcgICAgIFNWRyBzdHJpbmcgb3IgVVJMXG4gKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICogQHJldHVybiB7TC5TY2hlbWF0aWN9XG4gKi9cbkwuc2NoZW1hdGljID0gZnVuY3Rpb24gKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTC5TY2hlbWF0aWMoc3ZnLCBib3VuZHMsIG9wdGlvbnMpO1xufTtcbiIsIi8qKlxuICogQGNsYXNzIEwuU2NoZW1hdGljUmVuZGVyZXJcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEBleHRlbmRzIHtMLlNWR31cbiAqL1xuTC5TY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzID0gTC5TVkcuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgcGFkZGluZzogMC4zLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllXG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIGFkZGl0aW9uYWwgY29udGFpbmVycyBmb3IgdGhlIHZlY3RvciBmZWF0dXJlcyB0byBiZVxuICAgKiB0cmFuc2Zvcm1lZCB0byBsaXZlIGluIHRoZSBzY2hlbWF0aWMgc3BhY2VcbiAgICovXG4gIF9pbml0Q29udGFpbmVyOiBmdW5jdGlvbigpIHtcbiAgICBMLlNWRy5wcm90b3R5cGUuX2luaXRDb250YWluZXIuY2FsbCh0aGlzKTtcblxuICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCA9IEwuU1ZHLmNyZWF0ZSgnZycpO1xuICAgIHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9yb290SW52ZXJ0R3JvdXApO1xuICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cC5hcHBlbmRDaGlsZCh0aGlzLl9yb290R3JvdXApO1xuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX2NvbnRhaW5lciwgJ3NjaGVtYXRpY3MtcmVuZGVyZXInKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBVcGRhdGUgY2FsbCBvbiByZXNpemUsIHJlZHJhdywgem9vbSBjaGFuZ2VcbiAgICovXG4gIF91cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5fdXBkYXRlLmNhbGwodGhpcyk7XG5cbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcbiAgICB2YXIgbWFwID0gdGhpcy5fbWFwO1xuXG4gICAgaWYgKG1hcCAmJiBzY2hlbWF0aWMuX2JvdW5kcyAmJiB0aGlzLl9yb290SW52ZXJ0R3JvdXApIHtcbiAgICAgIHZhciB0b3BMZWZ0ID0gbWFwLmxhdExuZ1RvTGF5ZXJQb2ludChzY2hlbWF0aWMuX2JvdW5kcy5nZXROb3J0aFdlc3QoKSk7XG4gICAgICB2YXIgc2NhbGUgICA9IHNjaGVtYXRpYy5fcmF0aW8gKlxuICAgICAgICBtYXAub3B0aW9ucy5jcnMuc2NhbGUobWFwLmdldFpvb20oKSAtIHNjaGVtYXRpYy5vcHRpb25zLnpvb21PZmZzZXQpO1xuXG4gICAgICB0aGlzLl90b3BMZWZ0ID0gdG9wTGVmdDtcbiAgICAgIHRoaXMuX3NjYWxlICAgPSBzY2FsZTtcblxuICAgICAgLy8gY29tcGVuc2F0ZSB2aWV3Ym94IGRpc21pc3NhbCB3aXRoIGEgc2hpZnQgaGVyZVxuICAgICAgdGhpcy5fcm9vdEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdCwgc2NhbGUpKTtcblxuICAgICAgdGhpcy5fcm9vdEludmVydEdyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0Lm11bHRpcGx5QnkoIC0xIC8gc2NhbGUpLCAxIC8gc2NhbGUpKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogMS4gd3JhcCBtYXJrdXAgaW4gYW5vdGhlciA8Zz5cbiAgICogMi4gY3JlYXRlIGEgY2xpcFBhdGggd2l0aCB0aGUgdmlld0JveCByZWN0XG4gICAqIDMuIGFwcGx5IGl0IHRvIHRoZSA8Zz4gYXJvdW5kIGFsbCBtYXJrdXBzXG4gICAqIDQuIHJlbW92ZSBncm91cCBhcm91bmQgc2NoZW1hdGljXG4gICAqIDUuIHJlbW92ZSBpbm5lciBncm91cCBhcm91bmQgbWFya3Vwc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IFtkZXNjcmlwdGlvbl1cbiAgICovXG4gIGV4cG9ydFNWRzogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNjaGVtYXRpYyA9IHRoaXMub3B0aW9ucy5zY2hlbWF0aWM7XG4gICAgdmFyIHN2ZyAgICAgICA9IHRoaXMuX2NvbnRhaW5lci5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICB2YXIgY2xpcFBhdGggID0gTC5TVkcuY3JlYXRlKCdjbGlwUGF0aCcpO1xuICAgIHZhciBjbGlwUmVjdCAgPSBMLlNWRy5jcmVhdGUoJ3JlY3QnKTtcblxuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgneCcsIHNjaGVtYXRpYy5fYmJveFswXSk7XG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd5Jywgc2NoZW1hdGljLl9iYm94WzFdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3dpZHRoJywgc2NoZW1hdGljLl9iYm94WzJdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIHNjaGVtYXRpYy5fYmJveFszXSk7XG4gICAgY2xpcFBhdGguYXBwZW5kQ2hpbGQoY2xpcFJlY3QpO1xuXG4gICAgdmFyIGNsaXBJZCA9ICd2aWV3Ym94Q2xpcC0nICsgTC5VdGlsLnN0YW1wKHNjaGVtYXRpYy5fZ3JvdXApO1xuICAgIGNsaXBQYXRoLnNldEF0dHJpYnV0ZSgnaWQnLCBjbGlwSWQpO1xuICAgIHZhciBkZWZzID0gc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheSBkZWZzJyk7XG4gICAgaWYgKCFkZWZzKSB7XG4gICAgICBkZWZzID0gTC5TVkcuY3JlYXRlKCdkZWZzJyk7XG4gICAgICBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5JykuYXBwZW5kQ2hpbGQoZGVmcyk7XG4gICAgfVxuICAgIGRlZnMuYXBwZW5kQ2hpbGQoY2xpcFBhdGgpO1xuXG4gICAgdmFyIGNsaXBHcm91cCA9IHN2Zy5sYXN0Q2hpbGQ7XG4gICAgY2xpcEdyb3VwLnNldEF0dHJpYnV0ZSgnY2xpcC1wYXRoJywgJ3VybCgjJyArIGNsaXBJZCArICcpJyk7XG4gICAgY2xpcEdyb3VwLmZpcnN0Q2hpbGQuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgY2xpcEdyb3VwLmdldEF0dHJpYnV0ZSgndHJhbnNmb3JtJykpO1xuICAgIGNsaXBHcm91cC5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuICAgIHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKS5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuXG4gICAgc3ZnLnN0eWxlLnRyYW5zZm9ybSA9ICcnO1xuICAgIHN2Zy5zZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnLCBzY2hlbWF0aWMuX2Jib3guam9pbignICcpKTtcblxuICAgIHZhciBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBkaXYuaW5uZXJIVE1MID0gKC8oXFw8c3ZnXFxzKyhbXj5dKilcXD4pL2dpKS5leGVjKHNjaGVtYXRpYy5fcmF3RGF0YSlbMF0gKyAnPC9zdmc+JztcbiAgICBkaXYuZmlyc3RDaGlsZC5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xuXG4gICAgcmV0dXJuIGRpdi5maXJzdENoaWxkO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAqL1xuTC5zY2hlbWF0aWNSZW5kZXJlciA9IG1vZHVsZS5leHBvcnRzLnNjaGVtYXRpY1JlbmRlcmVyID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICByZXR1cm4gbmV3IEwuU2NoZW1hdGljUmVuZGVyZXIob3B0aW9ucyk7XG59O1xuXG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLy8gPHVzZT4gdGFncyBhcmUgYnJva2VuIGluIElFIGluIHNvIG1hbnkgd2F5c1xuaWYgKCdTVkdFbGVtZW50SW5zdGFuY2UnIGluIGdsb2JhbCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU1ZHRWxlbWVudEluc3RhbmNlLnByb3RvdHlwZSwgJ2NsYXNzTmFtZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbihvKXtcbiAgcmV0dXJuIChcbiAgICB0eXBlb2YgTm9kZSA9PT0gJ29iamVjdCcgP1xuICAgIG8gaW5zdGFuY2VvZiBOb2RlIDpcbiAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJlxuICAgIHR5cGVvZiBvLm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICApO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdCQm94ID0gZnVuY3Rpb24oc3ZnKSB7XG4gIHZhciB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICB2YXIgYmJveDtcbiAgaWYgKHZpZXdCb3gpIHtcbiAgICBiYm94ID0gdmlld0JveC5zcGxpdCgnICcpLm1hcChwYXJzZUZsb2F0KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgIC8vIGJib3ggPSBjbG9uZS5nZXRCQm94KCk7XG4gICAgYmJveCA9IGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKGNsb25lKTtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGNsb25lKTtcbiAgICByZXR1cm4gYmJveDtcbiAgfVxuICByZXR1cm4gW2Jib3hbMF0sIGJib3hbMV0sIGJib3hbMF0gKyBiYm94WzJdLCBiYm94WzFdICsgYmJveFszXV07XG59O1xuXG5cbi8qKlxuICogU2ltcGx5IGJydXRlIGZvcmNlOiB0YWtlcyBhbGwgc3ZnIG5vZGVzLCBjYWxjdWxhdGVzIGJvdW5kaW5nIGJveFxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuZnVuY3Rpb24gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoc3ZnKSB7XG4gIHZhciBiYm94ID0gW0luZmluaXR5LCBJbmZpbml0eSwgLUluZmluaXR5LCAtSW5maW5pdHldO1xuICB2YXIgbm9kZXMgPSBbXS5zbGljZS5jYWxsKHN2Zy5xdWVyeVNlbGVjdG9yQWxsKCcqJykpO1xuICB2YXIgbWluID0gTWF0aC5taW4sIG1heCA9IE1hdGgubWF4O1xuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBub2RlID0gbm9kZXNbaV07XG4gICAgaWYgKG5vZGUuZ2V0QkJveCkge1xuICAgICAgbm9kZSA9IG5vZGUuZ2V0QkJveCgpO1xuXG4gICAgICBiYm94WzBdID0gbWluKG5vZGUueCwgYmJveFswXSk7XG4gICAgICBiYm94WzFdID0gbWluKG5vZGUueSwgYmJveFsxXSk7XG5cbiAgICAgIGJib3hbMl0gPSBtYXgobm9kZS54ICsgbm9kZS53aWR0aCwgYmJveFsyXSk7XG4gICAgICBiYm94WzNdID0gbWF4KG5vZGUueSArIG5vZGUuaGVpZ2h0LCBiYm94WzNdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJib3g7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IGZ1bmN0aW9uKHN0cikge1xuICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gZnVuY3Rpb24odHJhbnNsYXRlLCBzY2FsZSkge1xuICByZXR1cm4gJ21hdHJpeCgnICtcbiAgICBbc2NhbGUsIDAsIDAsIHNjYWxlLCB0cmFuc2xhdGUueCwgdHJhbnNsYXRlLnldLmpvaW4oJywnKSArICcpJztcbn07XG4iXX0=
