var SvgLayer = require('./svglayer');
var xhr = require('xhr');

require('./bounds');
require('./utils');



module.exports = SvgLayer.extend({

  options: {
    // padding: 0.25
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

    if (typeof svg === 'string' && !/\<svg/ig.test(svg)) {
      this._svg = null;
      this._url = svg;
    }

    /**
     * @type {SVGElement}
     */
    this._group = null;

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
    console.log('loaded', svg.length);
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
    this._reset();
  },


  /**
   * @return {L.LatLngBounds}
   */
  getBounds: function() {
    return this._bounds;
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
    return this;
  },


  /**
   * We need to redraw on zoom end
   */
  _endPathZoom: function() {
    this._reset();
    SvgLayer.prototype._endPathZoom.call(this);
  },


  /**
   * Redraw - compensate the position and scale
   */
  _reset: function () {
    var image   = this._group;
    var scale   = Math.pow(2, this._map.getZoom() - 1) * this._ratio;
    var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
    var size    = this.getOriginalSize().multiplyBy(scale);

    this._group.setAttribute('transform',
      L.DomUtil.getMatrixString(topLeft, scale));
  }

});
