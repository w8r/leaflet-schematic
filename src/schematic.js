var L        = require('leaflet');
var b64      = require('Base64');
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
  initialize: function(svg, bounds, options) {

    /**
     * @type {String}
     */
    this._svg    = svg;

    /**
     * Initial svg width, cause we will have to get rid of that to maintain
     * the aspect ratio
     *
     * @type {String}
     */
    this._initialWidth  = '';


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
        throw new Error('SVGOverlay requires external request implementation. '+
          'You have to provide `load` function with the options');
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

    L.Rectangle.prototype.initialize.call(
      this, L.latLngBounds([0, 0], [0, 0]), options);
  },


  /**
   * @param  {L.Map} map
   */
  onAdd: function(map) {
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
      canvasRenderer._container.parentNode
        .insertBefore(canvasRenderer._container, this._renderer._container);
      this._canvasRenderer = canvasRenderer;

      map.dragging._draggable
        .on('predrag', this._onPreDrag, this)
        .on('dragend', this._onDragEnd, this);

      canvasRenderer._container.style.visibility = 'hidden';
    }
  },


  /**
   * @param  {L.Map} map
   */
  onRemove: function(map) {
    this._group.parentNode.removeChild(this._group);
    L.Rectangle.prototype.onRemove.call(this, map);
    if (this._canvasRenderer) {
      this._canvasRenderer.removeFrom(map);
      map.dragging._draggable
        .off('predrag', this._onPreDrag, this)
        .off('dragend', this._onDragEnd, this);
    }
    this._renderer.removeFrom(map);
  },


  /**
   * Loads svg via XHR
   */
  load: function() {
    this.options.load(this._url, function(err, svg) {
      if (!err) {
        this.onLoad(svg);
      }
    }.bind(this));
  },


  /**
   * @param  {String} svgString
   * @return {String}
   */
  _readSVGData: function(svgString) {
    var parser     = new DOMParser();
    var serializer = new XMLSerializer();

    var doc = parser.parseFromString(svgString, 'application/xml');
    var container = doc.documentElement;

    this._initialWidth  = container.getAttribute('width');
    this._initialHeight = container.getAttribute('height');

    this._bbox = L.DomUtil.getSVGBBox(container);

    // fix width cause otherwise rasterzation will break
    var width  = this._bbox[2] - this._bbox[0];
    var height = this._bbox[3] - this._bbox[1];
    if (parseFloat(this._initialWidth) !== width ||
      parseFloat(this._initialHeight)  !== height) {
      container.setAttribute('width',  width);
      container.setAttribute('height', height);
    }

    this._rawData       = svgString;
    this._processedData = serializer.serializeToString(doc);

    if (container.getAttribute('viewBox') === null) {
      container.setAttribute('viewBox', this._bbox.join(' '));
      this._processedData = this._processedData.replace('<svg',
        '<svg viewBox="' + this._bbox.join(' ') + '"');
    }

    return container;
  },


  /**
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function(svg) {
    if (!this._map) {
      return;
    }

    svg = this._readSVGData(svg);
    var bbox = this._bbox;
    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (this.options.adjustToScreen && size.y !== mapSize.y) {
      this._ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this.options._zoomOffset = (this._ratio < 1) ?
        this._ratio : (1 - this._ratio);
      // dismiss that offset
      this.options.zoomOffset = 0;
    }

    var minZoom = this._map.getMinZoom() - this.options.zoomOffset;
    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(
      this._map.unproject([bbox[0], bbox[3]], minZoom),
      this._map.unproject([bbox[2], bbox[1]], minZoom)
    ).scale(this._ratio);

    this._size   = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(
      1, this._origin.x, 1, this._origin.y);
    this._viewBoxOffset = L.point(this._bbox[0], this._bbox[1]);

    this._createContents(svg);
    this._renderer._container.insertBefore(
      this._group, this._renderer._container.firstChild);

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
  whenReady: function(callback, context) {
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
  getDocument: function() {
    return this._group;
  },


  /**
   * @return {L.SchematicRenderer}
   */
  getRenderer: function() {
    return this._renderer;
  },


  /**
   * @param  {SVGElement} svg
   */
  _createContents: function(svg) {
    L.SVG.copySVGContents(svg, this._group);
  },


  /**
   * @return {L.Point}
   */
  getOriginalSize: function() {
    var bbox = this._bbox;
    return new L.Point(
      Math.abs(bbox[0] - bbox[2]),
      Math.abs(bbox[1] - bbox[3])
    );
  },



  /**
   * Position our "rectangle"
   */
  _updatePath: function() {
    L.Rectangle.prototype._updatePath.call(this);

    if (this._group) {
      var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
      // scale is scale factor, zoom is zoom level
      var scale   = this._map.options.crs.scale(
        this._map.getZoom() - this.options.zoomOffset) * this._ratio;

      //topLeft = topLeft.subtract(this._viewBoxOffset.multiplyBy(scale));

      // compensate viewbox dismissal with a shift here
      this._group.setAttribute('transform',
         L.DomUtil.getMatrixString(
          topLeft.subtract(this._viewBoxOffset.multiplyBy(scale)), scale));

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
  _unscalePoint: function(pt) {
    return this._transformation.transform(
      this._transformation.untransform(pt).divideBy(this._ratio));
  },


  /**
   * Scales projected point TO viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _scalePoint: function(pt) {
    return this._transformation.transform(
      this._transformation.untransform(pt).multiplyBy(this._ratio)
    );
  },


  /**
   * @return {Number}
   */
  getRatio: function() {
    return this._ratio;
  },


  /**
   * Transform map coord to schematic point
   * @param  {L.LatLng} coord
   * @return {L.Point}
   */
  projectPoint: function(coord) {
    var map = this._map;
    return this._unscalePoint(map.project(
      coord, map.getMinZoom() + this.options.zoomOffset));
  },


  /**
   * @param  {L.Point} pt
   * @return {L.LatLng}
   */
  unprojectPoint: function(pt) {
    var map = this._map;
    return map.unproject(
      this._scalePoint(pt), map.getMinZoom() + this.options.zoomOffset);
  },


  /**
   * @param  {L.Bounds} bounds
   * @return {L.LatLngBounds}
   */
  unprojectBounds: function(bounds) {
    var sw = this.unprojectPoint(bounds.min);
    var ne = this.unprojectPoint(bounds.max);
    return L.latLngBounds(sw, ne);
  },


  /**
   * Transform layerBounds to schematic bbox
   * @param  {L.LatLngBounds} bounds
   * @return {L.Bounds}
   */
  projectBounds: function(bounds) {
    return new L.Bounds(
      this.projectPoint(bounds.getSouthWest()),
      this.projectPoint(bounds.getNorthEast())
    );
  },


  /**
   * @param  {Boolean=} string
   * @param  {Boolean=} overlaysOnly
   * @return {SVGElement|String}
   */
  exportSVG: function(string, overlaysOnly) {
    var node = this._renderer.exportSVG(overlaysOnly);
    return string ? node.outerHTML : node;
  },


   /**
   * Rasterizes the schematic
   * @return {Schematic}
   */
  toImage: function() {
    var img = new Image();

    // this doesn't work in IE, force size
    // img.style.height = img.style.width = '100%';
    img.style.width  = this._size.x + 'px';
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
    this._renderer._container.parentNode
      .insertBefore(img, this._renderer._container);
    this._raster = img;
    return this;
  },


  /**
   * Convert SVG data to base64 for rasterization
   * @return {String} base64 encoded SVG
   */
  toBase64: function() {
    // console.time('base64');
    var base64 = this._base64encoded ||
      b64.btoa(unescape(encodeURIComponent(this._processedData)));
    this._base64encoded = base64;
    // console.timeEnd('base64');

    return 'data:image/svg+xml;base64,' + base64;
  },


  /**
   * Redraw canvas on real changes: zoom, viewreset
   * @param  {L.Point} topLeft
   * @param  {Number}  scale
   */
  _redrawCanvas: function(topLeft, scale) {
    if (!this._raster) {
      return;
    }

    var size = this.getOriginalSize().multiplyBy(scale);
    var ctx = this._canvasRenderer._ctx;

    L.Util.requestAnimFrame(function() {
      ctx.drawImage(this._raster, topLeft.x, topLeft.y, size.x, size.y);
    }, this);
  },


  /**
   * Toggle canvas instead of SVG when dragging
   */
  _showRaster: function () {
    if (this._canvasRenderer) {
      this._canvasRenderer._container.style.visibility = 'visible';
      this._group.style.visibility = 'hidden';
    }
  },


  /**
   * Swap back to SVG
   */
  _hideRaster: function () {
    if (this._canvasRenderer) {
      this._canvasRenderer._container.style.visibility = 'hidden';
      this._group.style.visibility = 'visible';
    }
  },


  /**
   * IE-only
   * Replace SVG with canvas before drag
   */
  _onPreDrag: function() {
    if (this.options.useRaster) {
      this._showRaster();
    }
  },


  /**
   * Drag end: put SVG back in IE
   */
  _onDragEnd: function() {
    if (this.options.useRaster) {
      this._hideRaster();
    }
  }

});


// aliases
L.Schematic.prototype.project   = L.Schematic.prototype.projectPoint;
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
