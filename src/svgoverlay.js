var SvgLayer = require('./svglayer');
var xhr      = require('xhr');
var b64      = require('Base64');

require('./bounds');
require('./utils');



module.exports = SvgLayer.extend({

  options: {
    useRaster: L.Browser.ie
  },


  /**
   * @constructor
   * @extends {SvgLayer}
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
    this._schematicData = '';

    if (typeof svg === 'string' && !/\<svg/ig.test(svg)) {
      this._svg = null;

      /**
       * @type {String}
       */
      this._url = svg;
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
  getOriginalSize: function() {
    var bbox = this._bbox;
    return new L.Point(
      Math.abs(bbox[0] - bbox[2]),
      Math.abs(bbox[1] - bbox[3])
    );
  },


  /**
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function(svg) {
    this._schematicData = svg;
    svg = L.DomUtil.getSVGContainer(svg);
    var bbox = this._bbox = L.DomUtil.getSVGBBox(svg);
    var minZoom = this._map.getMinZoom();

    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(
      this._map.unproject([bbox[0], bbox[3]], minZoom),
      this._map.unproject([bbox[2], bbox[1]], minZoom)
    );

    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (size.y !== mapSize.y) {
      var ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this._bounds = this._bounds.scale(ratio);
      this._ratio = ratio;
    }

    this._size   = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(
      1, this._origin.x, 1, this._origin.y);

    this._group = L.Path.prototype._createElement('g');
    if (L.Browser.ie) {
      var child = svg.firstChild;
      do {
        this._group.appendChild(child);
        child = svg.firstChild;
      } while(child);
    } else {
      this._group.innerHTML = svg.innerHTML;
    }
    this._pathRoot.appendChild(this._group);

    this.fire('load');
    this._onMapZoomEnd();
    this._reset();
  },


  /**
   * @return {L.LatLngBounds}
   */
  getBounds: function() {
    return this._bounds;
  },


  /**
   * Transform map coord to schematic point
   * @param  {L.LatLng} coord
   * @return {L.Point}
   */
  projectPoint: function(coord) {
    return this._unscalePoint(this._map.project(coord, this._map.getMinZoom()));
  },


  /**
   * @param  {L.Point} pt
   * @return {L.LatLng}
   */
  unprojectPoint: function(pt) {
    return this._map.unproject(this._scalePoint(pt), this._map.getMinZoom());
  },


  /**
   * @param  {L.Bounds} bounds
   * @return {L.LatLngBounds}
   */
  unprojectBounds: function(bounds) {
    var sw = this.pointToMapCoord(bounds.min);
    var ne = this.pointToMapCoord(bounds.max);
    return L.latLngBounds(sw, ne);
  },


  /**
   * Transform layerBounds to schematic bbox
   * @param  {L.LatLngBounds} bounds
   * @return {L.Bounds}
   */
  projectBounds: function(bounds) {
    return new L.Bounds(
      this.mapCoordToPoint(bounds.getSouthWest()),
      this.mapCoordToPoint(bounds.getNorthEast())
    );
  },


  /**
   * Loads svg via XHR
   */
  load: function() {
    xhr({
      uri: this._url,
      headers: {
        "Content-Type": "image/svg+xml"
      }
    }, function (err, resp, svg) {
      this.onLoad(svg);
    }.bind(this))
  },


  /**
   * @param  {L.Map} map
   * @return {SvgOverlay}
   */
  onAdd: function(map) {
    SvgLayer.prototype.onAdd.call(this, map);

    map
      .on('zoomend', this._onMapZoomEnd, this)
      .on('dragstart', this._onPreDrag, this)
      .on('dragend', this._onDragEnd, this)
      .on('viereset moveend', this._reset, this);

    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }
    return this;
  },


  /**
   * @param  {L.Map} map
   * @return {SvgOverlay}
   */
  onRemove: function(map) {
    SvgLayer.prototype.onRemove.call(this, map);
    map
      .off('zoomend', this._onMapZoomEnd, this)
      .off('dragstart', this._onPreDrag, this)
      .off('dragend', this._onDragEnd, this)
      .off('viereset moveend', this._reset, this);
    return this;
  },


  /**
   * @param  {Function} callback
   * @param  {*=}       context
   * @return {SvgOverlay}
   */
  whenReady: function(callback, context) {
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
  toImage: function() {
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
      //canvas.width = naturalSize.x;
      //canvas.height = naturalSize.y;
      //ctx.drawImage(img, 0, 0, naturalSize.x, naturalSize.y);
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
  toBase64: function() {
    console.time('base64');
    var base64 = this._base64encoded ||
      b64.btoa(unescape(encodeURIComponent(this._schematicData)));
    this._base64encoded = base64;
    console.timeEnd('base64');

    return 'data:image/svg+xml;base64,' + base64;
  },


  /**
   * We need to redraw on zoom end
   */
  _endPathZoom: function() {
    this._reset();
    SvgLayer.prototype._endPathZoom.call(this);
  },


  /**
   * Scales projected point FROM viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _unscalePoint: function(pt) {
    return this._transformation.transform(
      this._transformation.untransform(pt).divideBy(this._ratio));
    // same as above, but not using transform matrix
    //return pt.subtract(this._origin)
    //  .multiplyBy(1/ this._ratio).add(this._origin);
  },


  /**
   * Scales projected point TO viewportized schematic ratio
   * @param  {L.Point} pt [description]
   * @return {L.Point}    [description]
   */
  _scalePoint: function(pt) {
    return this._transformation.transform(
      this._transformation.untransform(pt).multiplyBy(this._ratio)
    );
    // equals to
    // return pt.subtract(this._origin)
    //   .multiplyBy(this._ratio).add(this._origin);
  },


  /**
   * Toggle canvas instead of SVG when dragging
   */
  _showRaster: function () {
    if (this._canvas) {
      this._canvas.style.display   = 'block';
      this._pathRoot.style.display = 'none';
    }
  },


  /**
   * Swap back to SVG
   */
  _hideRaster: function () {
    if (this._canvas) {
      this._canvas.style.display   = 'none';
      this._pathRoot.style.display = 'block';
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
  },


  /**
   * Re-render canvas on zoomend
   */
  _onMapZoomEnd: function() {
    if (this.options.useRaster) {
       this.toImage();
       this._hideRaster();
    }
  },


  _redrawCanvas: function(topLeft, size) {
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

      var ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(this._raster, pos.x, pos.y, size.x, size.y);
      //ctx.rect(pos.x, pos.y, size.x, size.y);
      //ctx.strokeStyle = 'red';
      //ctx.stroke();
    }
  },


  /**
   * Redraw - compensate the position and scale
   */
  _reset: function () {
    var image   = this._group;
    var scale   = Math.pow(2, this._map.getZoom() - 1) * this._ratio;
    var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    var size    = this.getOriginalSize().multiplyBy(scale);

    if (this._raster) {
      this._raster.style.width = size.x + 'px';
      this._raster.style.height = size.y + 'px';
    }

    if (this._canvas) {
      this._redrawCanvas(topLeft, size);
      L.DomUtil.setPosition(this._canvas, this._getViewport().min);
    }

    this._group.setAttribute('transform',
      L.DomUtil.getMatrixString(topLeft, scale));
  }

});
