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
    L.SVG.prototype._initContainer();

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

},{}],5:[function(require,module,exports){
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
   * @param  {SVGElement} svg
   */
  _createContents: function _createContents(svg) {
    this._group = L.SVG.create('g');
    L.Util.stamp(this._group);
    L.DomUtil.addClass(this._group, 'svg-overlay');

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

},{"./bounds":3,"./schematic_renderer":4,"./utils":6,"Base64":2,"leaflet":undefined}],6:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9zY2hlbWF0aWNfcmVuZGVyZXIuanMiLCJzcmMvc3Znb3ZlcmxheS5qcyIsInNyYy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxPQUFQLEdBQWlCLFFBQVEsa0JBQVIsQ0FBakI7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3REEsSUFBSSxJQUFJLFFBQVEsU0FBUixDQUFKOzs7OztBQUtKLEVBQUUsTUFBRixDQUFTLFNBQVQsQ0FBbUIsTUFBbkIsR0FBNEIsWUFBVztBQUNyQyxTQUFPLENBQUMsS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLEtBQUssR0FBTCxDQUFTLENBQVQsRUFBWSxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksS0FBSyxHQUFMLENBQVMsQ0FBVCxDQUE1QyxDQURxQztDQUFYOzs7Ozs7QUFTNUIsRUFBRSxNQUFGLENBQVMsU0FBVCxDQUFtQixLQUFuQixHQUEyQixVQUFTLEtBQVQsRUFBZ0I7QUFDekMsTUFBSSxNQUFNLEtBQUssR0FBTCxDQUQr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O0dBRkY7QUFZQSxTQUFPLElBQVAsQ0FqQm9DO0NBQXRDOzs7Ozs7QUF5QkEsRUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFTLEdBQVQsRUFBYztBQUN4QyxNQUFJLFVBQVUsU0FBUyxhQUFULENBQXVCLEtBQXZCLENBQVYsQ0FEb0M7QUFFeEMsVUFBUSxTQUFSLEdBQW9CLEdBQXBCLENBRndDO0FBR3hDLFNBQU8sUUFBUSxhQUFSLENBQXNCLEtBQXRCLENBQVAsQ0FId0M7Q0FBZDs7Ozs7OztBQVk1QixFQUFFLE9BQUYsQ0FBVSxlQUFWLEdBQTRCLFVBQVMsU0FBVCxFQUFvQixLQUFwQixFQUEyQjtBQUNyRCxTQUFPLFlBQ0wsQ0FBQyxLQUFELEVBQVEsQ0FBUixFQUFXLENBQVgsRUFBYyxLQUFkLEVBQXFCLFVBQVUsQ0FBVixFQUFhLFVBQVUsQ0FBVixDQUFsQyxDQUErQyxJQUEvQyxDQUFvRCxHQUFwRCxDQURLLEdBQ3NELEdBRHRELENBRDhDO0NBQTNCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvc3Znb3ZlcmxheScpO1xuIiwiOyhmdW5jdGlvbiAoKSB7XG5cbiAgdmFyIG9iamVjdCA9IHR5cGVvZiBleHBvcnRzICE9ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IHRoaXM7IC8vICM4OiB3ZWIgd29ya2Vyc1xuICB2YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG4gIGZ1bmN0aW9uIEludmFsaWRDaGFyYWN0ZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgfVxuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlID0gbmV3IEVycm9yO1xuICBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuICAvLyBlbmNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS85OTkxNjZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vbmlnbmFnXVxuICBvYmplY3QuYnRvYSB8fCAoXG4gIG9iamVjdC5idG9hID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdChpZHggfCAwKSB8fCAobWFwID0gJz0nLCBpZHggJSAxKTtcbiAgICAgIC8vIFwiOCAtIGlkeCAlIDEgKiA4XCIgZ2VuZXJhdGVzIHRoZSBzZXF1ZW5jZSAyLCA0LCA2LCA4XG4gICAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgICApIHtcbiAgICAgIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaWR4ICs9IDMvNCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiAweEZGKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH0pO1xuXG4gIC8vIGRlY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzEwMjAzOTZdIGJ5IFtodHRwczovL2dpdGh1Yi5jb20vYXRrXVxuICBvYmplY3QuYXRvYiB8fCAoXG4gIG9iamVjdC5hdG9iID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhpbnB1dCkucmVwbGFjZSgvPSskLywgJycpO1xuICAgIGlmIChzdHIubGVuZ3RoICUgNCA9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yKFwiJ2F0b2InIGZhaWxlZDogVGhlIHN0cmluZyB0byBiZSBkZWNvZGVkIGlzIG5vdCBjb3JyZWN0bHkgZW5jb2RlZC5cIik7XG4gICAgfVxuICAgIGZvciAoXG4gICAgICAvLyBpbml0aWFsaXplIHJlc3VsdCBhbmQgY291bnRlcnNcbiAgICAgIHZhciBiYyA9IDAsIGJzLCBidWZmZXIsIGlkeCA9IDAsIG91dHB1dCA9ICcnO1xuICAgICAgLy8gZ2V0IG5leHQgY2hhcmFjdGVyXG4gICAgICBidWZmZXIgPSBzdHIuY2hhckF0KGlkeCsrKTtcbiAgICAgIC8vIGNoYXJhY3RlciBmb3VuZCBpbiB0YWJsZT8gaW5pdGlhbGl6ZSBiaXQgc3RvcmFnZSBhbmQgYWRkIGl0cyBhc2NpaSB2YWx1ZTtcbiAgICAgIH5idWZmZXIgJiYgKGJzID0gYmMgJSA0ID8gYnMgKiA2NCArIGJ1ZmZlciA6IGJ1ZmZlcixcbiAgICAgICAgLy8gYW5kIGlmIG5vdCBmaXJzdCBvZiBlYWNoIDQgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gY29udmVydCB0aGUgZmlyc3QgOCBiaXRzIHRvIG9uZSBhc2NpaSBjaGFyYWN0ZXJcbiAgICAgICAgYmMrKyAlIDQpID8gb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjU1ICYgYnMgPj4gKC0yICogYmMgJiA2KSkgOiAwXG4gICAgKSB7XG4gICAgICAvLyB0cnkgdG8gZmluZCBjaGFyYWN0ZXIgaW4gdGFibGUgKDAtNjMsIG5vdCBmb3VuZCA9PiAtMSlcbiAgICAgIGJ1ZmZlciA9IGNoYXJzLmluZGV4T2YoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfSk7XG5cbn0oKSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gW3RoaXMubWluLngsIHRoaXMubWluLnksIHRoaXMubWF4LngsIHRoaXMubWF4LnldO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge051bWJlcn0gdmFsdWVcbiAqIEByZXR1cm4ge0wuQm91bmRzfVxuICovXG5MLkJvdW5kcy5wcm90b3R5cGUuc2NhbGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICB2YXIgbWF4ID0gdGhpcy5tYXg7XG4gIHZhciBtaW4gPSB0aGlzLm1pbjtcbiAgdmFyIGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChtYXgueSAtIG1pbi55KSAvIDIpICogKHZhbHVlIC0gMSk7XG5cbiAgcmV0dXJuIG5ldyBMLkJvdW5kcyhbXG4gICAgW21pbi54IC0gZGVsdGFYLCBtaW4ueSAtIGRlbHRhWV0sXG4gICAgW21heC54ICsgZGVsdGFYLCBtYXgueSArIGRlbHRhWV1cbiAgXSk7XG59O1xuXG5cbi8qKlxuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbkwuTGF0TG5nQm91bmRzLnByb3RvdHlwZS50b0JCb3ggPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdmFyIG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICB2YXIgc3cgPSB0aGlzLl9zb3V0aFdlc3Q7XG4gIHZhciBkZWx0YVggPSAoKG5lLmxuZyAtIHN3LmxuZykgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICB2YXIgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwiLyoqXG4gKiBAY2xhc3MgTC5TY2hlbWF0aWNSZW5kZXJlclxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQGV4dGVuZHMge0wuU1ZHfVxuICovXG5MLlNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMgPSBMLlNWRy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjMsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYWRkaXRpb25hbCBjb250YWluZXJzIGZvciB0aGUgdmVjdG9yIGZlYXR1cmVzIHRvIGJlXG4gICAqIHRyYW5zZm9ybWVkIHRvIGxpdmUgaW4gdGhlIHNjaGVtYXRpYyBzcGFjZVxuICAgKi9cbiAgX2luaXRDb250YWluZXI6IGZ1bmN0aW9uKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5faW5pdENvbnRhaW5lcigpO1xuXG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RJbnZlcnRHcm91cCk7XG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RHcm91cCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fY29udGFpbmVyLCAnc2NoZW1hdGljcy1yZW5kZXJlcicpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBjYWxsIG9uIHJlc2l6ZSwgcmVkcmF3LCB6b29tIGNoYW5nZVxuICAgKi9cbiAgX3VwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgTC5TVkcucHJvdG90eXBlLl91cGRhdGUuY2FsbCh0aGlzKTtcblxuICAgIHZhciBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG5cbiAgICBpZiAobWFwICYmIHNjaGVtYXRpYy5fYm91bmRzICYmIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCkge1xuICAgICAgdmFyIHRvcExlZnQgPSBtYXAubGF0TG5nVG9MYXllclBvaW50KHNjaGVtYXRpYy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICAgIHZhciBzY2FsZSAgID0gc2NoZW1hdGljLl9yYXRpbyAqXG4gICAgICAgIG1hcC5vcHRpb25zLmNycy5zY2FsZShtYXAuZ2V0Wm9vbSgpIC0gc2NoZW1hdGljLm9wdGlvbnMuem9vbU9mZnNldCk7XG5cbiAgICAgIHRoaXMuX3RvcExlZnQgPSB0b3BMZWZ0O1xuICAgICAgdGhpcy5fc2NhbGUgICA9IHNjYWxlO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9yb290R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyh0b3BMZWZ0LCBzY2FsZSkpO1xuXG4gICAgICB0aGlzLl9yb290SW52ZXJ0R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQubXVsdGlwbHlCeSggLTEgLyBzY2FsZSksIDEgLyBzY2FsZSkpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiAxLiB3cmFwIG1hcmt1cCBpbiBhbm90aGVyIDxnPlxuICAgKiAyLiBjcmVhdGUgYSBjbGlwUGF0aCB3aXRoIHRoZSB2aWV3Qm94IHJlY3RcbiAgICogMy4gYXBwbHkgaXQgdG8gdGhlIDxnPiBhcm91bmQgYWxsIG1hcmt1cHNcbiAgICogNC4gcmVtb3ZlIGdyb3VwIGFyb3VuZCBzY2hlbWF0aWNcbiAgICogNS4gcmVtb3ZlIGlubmVyIGdyb3VwIGFyb3VuZCBtYXJrdXBzXG4gICAqIEByZXR1cm4ge1N0cmluZ30gW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcbiAgICB2YXIgc3ZnICAgICAgID0gdGhpcy5fY29udGFpbmVyLmNsb25lTm9kZSh0cnVlKTtcblxuICAgIHZhciBjbGlwUGF0aCAgPSBMLlNWRy5jcmVhdGUoJ2NsaXBQYXRoJyk7XG4gICAgdmFyIGNsaXBSZWN0ICA9IEwuU1ZHLmNyZWF0ZSgncmVjdCcpO1xuXG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd4Jywgc2NoZW1hdGljLl9iYm94WzBdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCBzY2hlbWF0aWMuX2Jib3hbMV0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBzY2hlbWF0aWMuX2Jib3hbMl0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0Jywgc2NoZW1hdGljLl9iYm94WzNdKTtcbiAgICBjbGlwUGF0aC5hcHBlbmRDaGlsZChjbGlwUmVjdCk7XG5cbiAgICB2YXIgY2xpcElkID0gJ3ZpZXdib3hDbGlwLScgKyBMLlV0aWwuc3RhbXAoc2NoZW1hdGljLl9ncm91cCk7XG4gICAgY2xpcFBhdGguc2V0QXR0cmlidXRlKCdpZCcsIGNsaXBJZCk7XG4gICAgdmFyIGRlZnMgPSBzdmcucXVlcnlTZWxlY3RvcignLnN2Zy1vdmVybGF5IGRlZnMnKTtcbiAgICBpZiAoIWRlZnMpIHtcbiAgICAgIGRlZnMgPSBMLlNWRy5jcmVhdGUoJ2RlZnMnKTtcbiAgICAgIHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKS5hcHBlbmRDaGlsZChkZWZzKTtcbiAgICB9XG4gICAgZGVmcy5hcHBlbmRDaGlsZChjbGlwUGF0aCk7XG5cbiAgICB2YXIgY2xpcEdyb3VwID0gc3ZnLmxhc3RDaGlsZDtcbiAgICBjbGlwR3JvdXAuc2V0QXR0cmlidXRlKCdjbGlwLXBhdGgnLCAndXJsKCMnICsgY2xpcElkICsgJyknKTtcbiAgICBjbGlwR3JvdXAuZmlyc3RDaGlsZC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICBjbGlwR3JvdXAuZ2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nKSk7XG4gICAgY2xpcEdyb3VwLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG4gICAgc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpLnJlbW92ZUF0dHJpYnV0ZSgndHJhbnNmb3JtJyk7XG5cbiAgICBzdmcuc3R5bGUudHJhbnNmb3JtID0gJyc7XG4gICAgc3ZnLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHNjaGVtYXRpYy5fYmJveC5qb2luKCcgJykpO1xuXG4gICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpdi5pbm5lckhUTUwgPSAoLyhcXDxzdmdcXHMrKFtePl0qKVxcPikvZ2kpLmV4ZWMoc2NoZW1hdGljLl9yYXdEYXRhKVswXSArICc8L3N2Zz4nO1xuICAgIGRpdi5maXJzdENoaWxkLmlubmVySFRNTCA9IHN2Zy5pbm5lckhUTUw7XG5cbiAgICByZXR1cm4gZGl2LmZpcnN0Q2hpbGQ7XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtPYmplY3R9XG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY1JlbmRlcmVyfVxuICovXG5MLnNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMuc2NoZW1hdGljUmVuZGVyZXIgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTC5TY2hlbWF0aWNSZW5kZXJlcihvcHRpb25zKTtcbn07XG5cbiIsInZhciBMICAgICAgICA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcbnZhciBiNjQgICAgICA9IHJlcXVpcmUoJ0Jhc2U2NCcpO1xudmFyIFJlbmRlcmVyID0gcmVxdWlyZSgnLi9zY2hlbWF0aWNfcmVuZGVyZXInKTtcblxucmVxdWlyZSgnLi9ib3VuZHMnKTtcbnJlcXVpcmUoJy4vdXRpbHMnKTtcblxuXG4vKipcbiAqIEBjbGFzcyBTY2hlbWF0aWNcbiAqIEBleHRlbmRzIHtMLlJlY3RhbmdsZX1cbiAqL1xuTC5TY2hlbWF0aWMgPSBtb2R1bGUuZXhwb3J0cyA9IEwuUmVjdGFuZ2xlLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIG9wYWNpdHk6IDAsXG4gICAgZmlsbE9wYWNpdHk6IDAsXG4gICAgd2VpZ2h0OiAxLFxuICAgIGFkanVzdFRvU2NyZWVuOiB0cnVlLFxuICAgIC8vIGhhcmRjb2RlIHpvb20gb2Zmc2V0IHRvIHNuYXAgdG8gc29tZSBsZXZlbFxuICAgIHpvb21PZmZzZXQ6IDAsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWVcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAgICogQHBhcmFtICB7TC5MYXRMbmdCb3VuZHN9IGJvdW5kc1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgICAgICAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fc3ZnICAgID0gc3ZnO1xuXG4gICAgaWYgKCEoYm91bmRzIGluc3RhbmNlb2YgTC5MYXRMbmdCb3VuZHMpKSB7XG4gICAgICBvcHRpb25zID0gYm91bmRzO1xuICAgICAgYm91bmRzID0gbnVsbDtcbiAgICB9XG5cbiAgICBvcHRpb25zLnJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKHtcbiAgICAgIHNjaGVtYXRpYzogdGhpc1xuICAgICAgLy8gcGFkZGluZzogb3B0aW9ucy5wYWRkaW5nIHx8IHRoaXMub3B0aW9ucy5wYWRkaW5nIHx8IDAuMjVcbiAgICB9KTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ0JvdW5kc31cbiAgICAgKi9cbiAgICB0aGlzLl9ib3VuZHMgPSBib3VuZHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMuX3JhdGlvID0gMTtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc2l6ZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX29yaWdpbiA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlRyYW5zZm9ybWF0aW9ufVxuICAgICAqL1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5fcmF3RGF0YSA9ICcnO1xuXG4gICAgaWYgKHR5cGVvZiBzdmcgPT09ICdzdHJpbmcnICYmICEvXFw8c3ZnL2lnLnRlc3Qoc3ZnKSkge1xuICAgICAgdGhpcy5fc3ZnID0gbnVsbDtcblxuICAgICAgLyoqXG4gICAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAgICovXG4gICAgICB0aGlzLl91cmwgPSBzdmc7XG5cbiAgICAgIGlmICghb3B0aW9ucy5sb2FkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU1ZHT3ZlcmxheSByZXF1aXJlcyBleHRlcm5hbCByZXF1ZXN0IGltcGxlbWVudGF0aW9uLiAnK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Q2FudmFzfVxuICAgICAqL1xuICAgIHRoaXMuX2NhbnZhcyA9IG51bGw7XG5cbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKFxuICAgICAgdGhpcywgTC5sYXRMbmdCb3VuZHMoWzAsMF0sIFswLDBdKSwgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG4gICAgaWYgKCF0aGlzLl9zdmcpIHtcbiAgICAgIHRoaXMubG9hZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uTG9hZCh0aGlzLl9zdmcpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB2YXIgY2FudmFzUmVuZGVyZXIgPSBuZXcgTC5DYW52YXMoe30pLmFkZFRvKG1hcCk7XG4gICAgICBjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcbiAgICAgICAgLmluc2VydEJlZm9yZShjYW52YXNSZW5kZXJlci5fY29udGFpbmVyLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyKTtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyID0gY2FudmFzUmVuZGVyZXI7XG5cbiAgICAgIG1hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlXG4gICAgICAgIC5vbigncHJlZHJhZycsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgICAgLm9uKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICovXG4gIG9uUmVtb3ZlOiBmdW5jdGlvbihtYXApIHtcbiAgICB0aGlzLl9ncm91cC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX2dyb3VwKTtcbiAgICBMLlJlY3RhbmdsZS5wcm90b3R5cGUub25SZW1vdmUuY2FsbCh0aGlzLCBtYXApO1xuICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcbiAgICAgICAgLm9mZigncHJlZHJhZycsIHRoaXMuX29uUHJlRHJhZywgdGhpcylcbiAgICAgICAgLm9mZignZHJhZ2VuZCcsIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG4gICAgfVxuICAgIHRoaXMuX3JlbmRlcmVyLnJlbW92ZUZyb20obWFwKTtcbiAgICBjb25zb2xlLmxvZyh0aGlzLl9yZW5kZXJlcik7XG4gIH0sXG5cblxuICAvKipcbiAgICogTG9hZHMgc3ZnIHZpYSBYSFJcbiAgICovXG4gIGxvYWQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgZnVuY3Rpb24oZXJyLCBzdmcpIHtcbiAgICAgIGlmICghZXJyKSB7XG4gICAgICAgIHRoaXMub25Mb2FkKHN2Zyk7XG4gICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTVkcgaXMgcmVhZHlcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzdmcgbWFya3VwXG4gICAqL1xuICBvbkxvYWQ6IGZ1bmN0aW9uKHN2Zykge1xuICAgIGlmICghdGhpcy5fbWFwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fcmF3RGF0YSA9IHN2ZztcbiAgICBzdmcgPSBMLkRvbVV0aWwuZ2V0U1ZHQ29udGFpbmVyKHN2Zyk7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94ID0gTC5Eb21VdGlsLmdldFNWR0JCb3goc3ZnKTtcbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCk7XG4gICAgdmFyIG1hcFNpemUgPSB0aGlzLl9tYXAuZ2V0U2l6ZSgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hZGp1c3RUb1NjcmVlbiAmJiBzaXplLnkgIT09IG1hcFNpemUueSkge1xuICAgICAgdGhpcy5fcmF0aW8gPSBNYXRoLm1pbihtYXBTaXplLnggLyBzaXplLngsIG1hcFNpemUueSAvIHNpemUueSk7XG4gICAgICB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCA9ICh0aGlzLl9yYXRpbyA8IDEpID9cbiAgICAgICAgdGhpcy5fcmF0aW8gOiAoMSAtIHRoaXMuX3JhdGlvKTtcbiAgICB9XG5cbiAgICBpZiAoc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9yYXdEYXRhID0gdGhpcy5fcmF3RGF0YS5yZXBsYWNlKCc8c3ZnJyxcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIicgKyBiYm94LmpvaW4oJyAnKSArICdcIicpO1xuICAgIH1cblxuICAgIHZhciBtaW5ab29tID0gdGhpcy5fbWFwLmdldE1pblpvb20oKSArIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0O1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgZWRnZXMgb2YgdGhlIGltYWdlLCBpbiBjb29yZGluYXRlIHNwYWNlXG4gICAgdGhpcy5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFswXSwgYmJveFszXV0sIG1pblpvb20pLFxuICAgICAgdGhpcy5fbWFwLnVucHJvamVjdChbYmJveFsyXSwgYmJveFsxXV0sIG1pblpvb20pXG4gICAgKTtcbiAgICB0aGlzLl9ib3VuZHMgPSB0aGlzLl9ib3VuZHMuc2NhbGUodGhpcy5fcmF0aW8pO1xuXG4gICAgdGhpcy5fc2l6ZSAgID0gc2l6ZTtcbiAgICB0aGlzLl9vcmlnaW4gPSB0aGlzLl9tYXAucHJvamVjdCh0aGlzLl9ib3VuZHMuZ2V0Q2VudGVyKCksIG1pblpvb20pO1xuICAgIHRoaXMuX3RyYW5zZm9ybWF0aW9uID0gbmV3IEwuVHJhbnNmb3JtYXRpb24oXG4gICAgICAxLCB0aGlzLl9vcmlnaW4ueCwgMSwgdGhpcy5fb3JpZ2luLnkpO1xuXG4gICAgdGhpcy5fY3JlYXRlQ29udGVudHMoc3ZnKTtcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLmluc2VydEJlZm9yZShcbiAgICAgIHRoaXMuX2dyb3VwLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuXG4gICAgdGhpcy5maXJlKCdsb2FkJyk7XG5cbiAgICB0aGlzLl9sYXRsbmdzID0gdGhpcy5fYm91bmRzVG9MYXRMbmdzKHRoaXMuX2JvdW5kcyk7XG4gICAgdGhpcy5fcmVzZXQoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICB0aGlzLnRvSW1hZ2UoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7U1ZHRWxlbWVudH0gc3ZnXG4gICAqL1xuICBfY3JlYXRlQ29udGVudHM6IGZ1bmN0aW9uKHN2Zykge1xuICAgIHRoaXMuX2dyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgTC5VdGlsLnN0YW1wKHRoaXMuX2dyb3VwKTtcbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fZ3JvdXAsICdzdmctb3ZlcmxheScpO1xuXG4gICAgaWYgKEwuQnJvd3Nlci5pZSkgeyAvLyBpbm5lckhUTUwgZG9lc24ndCB3b3JrIGZvciBTVkcgaW4gSUVcbiAgICAgIHZhciBjaGlsZCA9IHN2Zy5maXJzdENoaWxkO1xuICAgICAgZG8ge1xuICAgICAgICB0aGlzLl9ncm91cC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgICAgIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgICB9IHdoaWxlKGNoaWxkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZ3JvdXAuaW5uZXJIVE1MID0gc3ZnLmlubmVySFRNTDtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGJib3ggPSB0aGlzLl9iYm94O1xuICAgIHJldHVybiBuZXcgTC5Qb2ludChcbiAgICAgIE1hdGguYWJzKGJib3hbMF0gLSBiYm94WzJdKSxcbiAgICAgIE1hdGguYWJzKGJib3hbMV0gLSBiYm94WzNdKVxuICAgICk7XG4gIH0sXG5cblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiBvdXIgXCJyZWN0YW5nbGVcIlxuICAgKi9cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX2dyb3VwKSB7XG4gICAgICB2YXIgdG9wTGVmdCA9IHRoaXMuX21hcC5sYXRMbmdUb0xheWVyUG9pbnQodGhpcy5fYm91bmRzLmdldE5vcnRoV2VzdCgpKTtcbiAgICAgIC8vIHNjYWxlIGlzIHNjYWxlIGZhY3Rvciwgem9vbSBpcyB6b29tIGxldmVsXG4gICAgICB2YXIgc2NhbGUgICA9IHRoaXMuX21hcC5vcHRpb25zLmNycy5zY2FsZShcbiAgICAgICAgdGhpcy5fbWFwLmdldFpvb20oKSAtIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KSAqIHRoaXMuX3JhdGlvO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9ncm91cC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQsIHNjYWxlKSk7XG5cbiAgICAgIGlmICh0aGlzLl9jYW52YXNSZW5kZXJlcikge1xuICAgICAgICB0aGlzLl9yZWRyYXdDYW52YXModG9wTGVmdCwgc2NhbGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTY2FsZXMgcHJvamVjdGVkIHBvaW50IEZST00gdmlld3BvcnRpemVkIHNjaGVtYXRpYyByYXRpb1xuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgX3Vuc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludDogZnVuY3Rpb24ocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLm11bHRpcGx5QnkodGhpcy5fcmF0aW8pXG4gICAgKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtOdW1iZXJ9XG4gICAqL1xuICBnZXRSYXRpbzogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JhdGlvO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBtYXAgY29vcmQgdG8gc2NoZW1hdGljIHBvaW50XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBjb29yZFxuICAgKiBAcmV0dXJuIHtMLlBvaW50fVxuICAgKi9cbiAgcHJvamVjdFBvaW50OiBmdW5jdGlvbihjb29yZCkge1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG4gICAgcmV0dXJuIHRoaXMuX3Vuc2NhbGVQb2ludChtYXAucHJvamVjdChcbiAgICAgIGNvb3JkLCBtYXAuZ2V0TWluWm9vbSgpICsgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSBwdFxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIHVucHJvamVjdFBvaW50OiBmdW5jdGlvbihwdCkge1xuICAgIHZhciBtYXAgPSB0aGlzLl9tYXA7XG4gICAgcmV0dXJuIG1hcC51bnByb2plY3QoXG4gICAgICB0aGlzLl9zY2FsZVBvaW50KHB0KSwgbWFwLmdldE1pblpvb20oKSArIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gc3RyaW5nXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR8U3RyaW5nfVxuICAgKi9cbiAgZXhwb3J0U1ZHOiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuX3JlbmRlcmVyLmV4cG9ydFNWRygpO1xuICAgIHJldHVybiBzdHJpbmcgPyBub2RlLm91dGVySFRNTCA6IG5vZGU7XG4gIH0sXG5cblxuICAgLyoqXG4gICAqIFJhc3Rlcml6ZXMgdGhlIHNjaGVtYXRpY1xuICAgKiBAcmV0dXJuIHtTY2hlbWF0aWN9XG4gICAqL1xuICB0b0ltYWdlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW1nID0gbmV3IEltYWdlKCk7XG5cbiAgICAvLyB0aGlzIGRvZXNuJ3Qgd29yayBpbiBJRSwgZm9yY2Ugc2l6ZVxuICAgIC8vIGltZy5zdHlsZS5oZWlnaHQgPSBpbWcuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgaW1nLnN0eWxlLndpZHRoID0gdGhpcy5fc2l6ZS54ICsgJ3B4JztcbiAgICBpbWcuc3R5bGUuaGVpZ2h0ID0gdGhpcy5fc2l6ZS55ICsgJ3B4JztcbiAgICBpbWcuc3JjID0gdGhpcy50b0Jhc2U2NCgpO1xuXG4gICAgLy8gaGFjayB0byB0cmljayBJRSByZW5kZXJpbmcgZW5naW5lXG4gICAgTC5Eb21FdmVudC5vbihpbWcsICdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgTC5wb2ludChpbWcub2Zmc2V0V2lkdGgsIGltZy5vZmZzZXRIZWlnaHQpO1xuICAgICAgdGhpcy5fcmVzZXQoKTtcbiAgICB9LCB0aGlzKTtcblxuICAgIGltZy5zdHlsZS5vcGFjaXR5ID0gMDtcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3Jhc3Rlcik7XG4gICAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhpbWcsICdzY2hlbWF0aWMtaW1hZ2UnKTtcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcbiAgICAgIC5pbnNlcnRCZWZvcmUoaW1nLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyKTtcbiAgICB0aGlzLl9yYXN0ZXIgPSBpbWc7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ29udmVydCBTVkcgZGF0YSB0byBiYXNlNjQgZm9yIHJhc3Rlcml6YXRpb25cbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcbiAgICovXG4gIHRvQmFzZTY0OiBmdW5jdGlvbigpIHtcbiAgICAvLyBjb25zb2xlLnRpbWUoJ2Jhc2U2NCcpO1xuICAgIHZhciBiYXNlNjQgPSB0aGlzLl9iYXNlNjRlbmNvZGVkIHx8XG4gICAgICBiNjQuYnRvYSh1bmVzY2FwZShlbmNvZGVVUklDb21wb25lbnQodGhpcy5fcmF3RGF0YSkpKTtcbiAgICB0aGlzLl9iYXNlNjRlbmNvZGVkID0gYmFzZTY0O1xuICAgIC8vIGNvbnNvbGUudGltZUVuZCgnYmFzZTY0Jyk7XG5cbiAgICByZXR1cm4gJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsJyArIGJhc2U2NDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZWRyYXcgY2FudmFzIG9uIHJlYWwgY2hhbmdlczogem9vbSwgdmlld3Jlc2V0XG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHRvcExlZnRcbiAgICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAgICovXG4gIF9yZWRyYXdDYW52YXM6IGZ1bmN0aW9uKHRvcExlZnQsIHNjYWxlKSB7XG4gICAgaWYgKCF0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgc2l6ZSA9IHRoaXMuZ2V0T3JpZ2luYWxTaXplKCkubXVsdGlwbHlCeShzY2FsZSk7XG4gICAgdmFyIGN0eCA9IHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jdHg7XG5cbiAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fcmFzdGVyLCB0b3BMZWZ0LngsIHRvcExlZnQueSwgc2l6ZS54LCBzaXplLnkpO1xuICAgIH0sIHRoaXMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFRvZ2dsZSBjYW52YXMgaW5zdGVhZCBvZiBTVkcgd2hlbiBkcmFnZ2luZ1xuICAgKi9cbiAgX3Nob3dSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICAgIHRoaXMuX2dyb3VwLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU3dhcCBiYWNrIHRvIFNWR1xuICAgKi9cbiAgX2hpZGVSYXN0ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogSUUtb25seVxuICAgKiBSZXBsYWNlIFNWRyB3aXRoIGNhbnZhcyBiZWZvcmUgZHJhZ1xuICAgKi9cbiAgX29uUHJlRHJhZzogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX2hpZGVSYXN0ZXIoKTtcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLy8gYWxpYXNlc1xuTC5TY2hlbWF0aWMucHJvdG90eXBlLnByb2plY3QgICA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0UG9pbnQ7XG5MLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0ID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnVucHJvamVjdFBvaW50O1xuXG5cbi8qKlxuICogRmFjdG9yeVxuICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY31cbiAqL1xuTC5zY2hlbWF0aWMgPSBmdW5jdGlvbiAoc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpYyhzdmcsIGJvdW5kcywgb3B0aW9ucyk7XG59O1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbi8vIDx1c2U+IHRhZ3MgYXJlIGJyb2tlbiBpbiBJRSBpbiBzbyBtYW55IHdheXNcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiBnbG9iYWwpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnRJbnN0YW5jZS5wcm90b3R5cGUsICdjbGFzc05hbWUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcnJlc3BvbmRpbmdFbGVtZW50LmNsYXNzTmFtZS5iYXNlVmFsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgIHRoaXMuY29ycmVzcG9uZGluZ0VsZW1lbnQuY2xhc3NOYW1lLmJhc2VWYWwgPSB2YWw7XG4gICAgfVxuICB9KTtcbn1cblxuXG4vKipcbiAqIEBwYXJhbSAgeyp9ICBvXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5MLkRvbVV0aWwuaXNOb2RlID0gZnVuY3Rpb24obyl7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIE5vZGUgPT09ICdvYmplY3QnID9cbiAgICBvIGluc3RhbmNlb2YgTm9kZSA6XG4gICAgbyAmJiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiZcbiAgICB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiZcbiAgICB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQkJveCA9IGZ1bmN0aW9uKHN2Zykge1xuICB2YXIgdmlld0JveCA9IHN2Zy5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKTtcbiAgdmFyIGJib3g7XG4gIGlmICh2aWV3Qm94KSB7XG4gICAgYmJveCA9IHZpZXdCb3guc3BsaXQoJyAnKS5tYXAocGFyc2VGbG9hdCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNsb25lID0gc3ZnLmNsb25lTm9kZSh0cnVlKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNsb25lKTtcbiAgICAvLyBiYm94ID0gY2xvbmUuZ2V0QkJveCgpO1xuICAgIGJib3ggPSBjYWxjU1ZHVmlld0JveEZyb21Ob2RlcyhjbG9uZSk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChjbG9uZSk7XG4gICAgcmV0dXJuIGJib3g7XG4gIH1cbiAgcmV0dXJuIFtiYm94WzBdLCBiYm94WzFdLCBiYm94WzBdICsgYmJveFsyXSwgYmJveFsxXSArIGJib3hbM11dO1xufTtcblxuXG4vKipcbiAqIFNpbXBseSBicnV0ZSBmb3JjZTogdGFrZXMgYWxsIHN2ZyBub2RlcywgY2FsY3VsYXRlcyBib3VuZGluZyBib3hcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbmZ1bmN0aW9uIGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKHN2Zykge1xuICB2YXIgYmJveCA9IFtJbmZpbml0eSwgSW5maW5pdHksIC1JbmZpbml0eSwgLUluZmluaXR5XTtcbiAgdmFyIG5vZGVzID0gW10uc2xpY2UuY2FsbChzdmcucXVlcnlTZWxlY3RvckFsbCgnKicpKTtcbiAgdmFyIG1pbiA9IE1hdGgubWluLCBtYXggPSBNYXRoLm1heDtcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gbm9kZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xuICAgIGlmIChub2RlLmdldEJCb3gpIHtcbiAgICAgIG5vZGUgPSBub2RlLmdldEJCb3goKTtcblxuICAgICAgYmJveFswXSA9IG1pbihub2RlLngsIGJib3hbMF0pO1xuICAgICAgYmJveFsxXSA9IG1pbihub2RlLnksIGJib3hbMV0pO1xuXG4gICAgICBiYm94WzJdID0gbWF4KG5vZGUueCArIG5vZGUud2lkdGgsIGJib3hbMl0pO1xuICAgICAgYmJveFszXSA9IG1heChub2RlLnkgKyBub2RlLmhlaWdodCwgYmJveFszXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBiYm94O1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gKi9cbkwuRG9tVXRpbC5nZXRTVkdDb250YWluZXIgPSBmdW5jdGlvbihzdHIpIHtcbiAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgd3JhcHBlci5pbm5lckhUTUwgPSBzdHI7XG4gIHJldHVybiB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3N2ZycpO1xufTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUG9pbnR9IHRyYW5zbGF0ZVxuICogQHBhcmFtICB7TnVtYmVyfSAgc2NhbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZSwgc2NhbGUpIHtcbiAgcmV0dXJuICdtYXRyaXgoJyArXG4gICAgW3NjYWxlLCAwLCAwLCBzY2FsZSwgdHJhbnNsYXRlLngsIHRyYW5zbGF0ZS55XS5qb2luKCcsJykgKyAnKSc7XG59O1xuIl19
