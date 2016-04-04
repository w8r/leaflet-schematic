var L        = require('leaflet');
var SvgLayer = require('./svglayer');
var b64      = require('Base64');

require('./bounds');
require('./utils');



module.exports = L.SVG.extend({

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

    if (!(bounds instanceof L.LatLngBounds)) {
      options = bounds;
      bounds = null;
    }

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
        throw new Error('SVGOverlay requires external request implementation. '+
          'You have to provide `load` function with the options');
      }
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

    L.SVG.prototype.initialize.call(this, options);
  },

  onAdd: function(map) {
    L.SVG.prototype.onAdd.call(this, map);
    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }
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
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function(svg) {
    this._rawData = svg;
    svg = L.DomUtil.getSVGContainer(svg);
    var bbox = this._bbox = L.DomUtil.getSVGBBox(svg);
    var minZoom = this._map.getMinZoom();

    if (svg.getAttribute('viewBox') === null) {
      this._rawData = this._rawData.replace('<svg',
        '<svg viewBox="' + bbox.join(' ') + '"');
    }

    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(
      this._map.unproject([bbox[0], bbox[3]], minZoom),
      this._map.unproject([bbox[2], bbox[1]], minZoom)
    );

    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (size.y !== mapSize.y && this.options.adjustToScreen) {
      var ratio = 1; // Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this._bounds = this._bounds.scale(ratio);
      this._ratio = ratio;
    }

    this._size   = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._viewBoxOffset = L.point(this._bbox[0], this._bbox[1]);
    this._transformation = new L.Transformation(
      1, this._origin.x, 1, this._origin.y);

    this._group = L.SVG.create('g');
    L.DomUtil.addClass(this._group, 'svg-overlay');

    if (L.Browser.ie) { // innerHTML doesn't work for SVG in IE
      var child = svg.firstChild;
      do {
        this._group.appendChild(child);
        child = svg.firstChild;
      } while(child);
    } else {
      this._group.innerHTML = svg.innerHTML;
    }
    this._container.appendChild(this._group);

    this.fire('load');
    this._onMapZoomEnd();
    this._reset();
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
   * @return {L.LatLngBounds}
   */
  getBounds: function() {
    return this._bounds;
  },


  _onMapZoomEnd: function() {

  }


});
