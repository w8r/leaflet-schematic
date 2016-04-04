var L = require('leaflet');

module.exports = L.Layer.extend({

  options: {
    opacity: 1,
    padding: L.Path.CLIP_PADDING,
    zIndex: 1,
    usePathContainer: false
  },

  /**
   * @class SvgLayer - basically, just the SVG container simiar to the one
   * used by leaflet internally to render vector layers
   *
   * @extends {L.Class}
   * @constructor
   * @param  {Object=} options
   */
  initialize: function(options) {
    /**
     * @type {Element}
     */
    this._container = null;


    /**
     * @type {SVGElement}
     */
    this._pathRoot  = null;


    /**
     * @type {L.Map}
     */
    this._map = null;


    /**
     * @type {L.Bounds}
     */
    this._pathViewport = null;


    /**
     * @type {Boolean}
     */
    this._pathZooming = false;

    L.Util.setOptions(this, options);
  },


  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  onAdd: function(map) {
    this._map = map;
    this._initPathRoot();
    return this;
  },


  /**
   * @param {L.Map} map
   * @return {SvgLayer}
   */
  addTo: function(map) {
    map.addLayer(this);
    return this;
  },


  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  onRemove: function(map) {
    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      this._map.off({
        'zoomanim': this._animatePathZoom,
        'zoomend': this._endPathZoom
      }, this);
    }

    this._map.off('moveend', this._updateSvgViewport, this);
    this._map.getPanes().overlayPane.removeChild(this._container);

    return this;
  },


  /**
   * @param  {L.Map} map
   * @return {SvgLayer}
   */
  removeFrom: function(map) {
    map.removeLayer(this);
    return this;
  },


  /**
   * @return {SvgLayer}
   */
  bringToFront: function () {
    var root = this._container.parentNode;
    var container = this._container;

    if (container && root.lastChild !== container) {
      root.appendChild(container);
    }

    return this;
  },


  /**
   * @return {SvgLayer}
   */
  bringToBack: function () {
    var root = this._container.parentNode;
    var container = this._container;
    var first = root.firstChild;

    if (container && first !== container) {
      root.insertBefore(container, first);
    }
    return this;
  },


  /**
   * @param {Number} opacity
   * @return {SVGLayer}
   */
  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    this._updateOpacity();
    return this;
  },


  /**
   * @param {Number} zIndex
   * @return {SVGLayet}
   */
  setZIndex: function (zIndex) {
    this.options.zIndex = zIndex;
    this._updateZIndex();

    return this;
  },


  /**
   * Create svg root
   */
  _createRoot: function() {
    this._container = L.DomUtil.create('div', 'leaflet-schematic-layer');
    if (this.options.usePathContainer) {
      this._pathRoot = this._map.getRenderer(this)._container;
    } else {
      this._pathRoot = L.SVG.create('svg');
      this._container.appendChild(this._pathRoot);
    }
  },


  /**
   * Init the root element
   */
  _initPathRoot: function () {
    if (!this._pathRoot) {
      var pane = this._map.getPanes().overlayPane;
      this._createRoot();
      pane.insertBefore(this._container, pane.firstChild);

      if (this._map.options.zoomAnimation && L.Browser.any3d) {
        L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

        this._map.on({
          'zoomanim': this._animatePathZoom,
          'zoomend': this._endPathZoom
        }, this);
      } else {
        L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
      }

      this._map.on('moveend', this._updateSvgViewport, this);
      this._updateSvgViewport();

      this._updateOpacity();
      this._updateZIndex();
    }
  },


  /**
   * Sets conatiner opacity
   */
  _updateOpacity: function() {
    L.DomUtil.setOpacity(this._container, this.options.opacity);
  },


  /**
   * Sets container zIndex
   */
  _updateZIndex: function () {
    if (this._container && this.options.zIndex !== undefined) {
      this._container.style.zIndex = this.options.zIndex;
    }
  },


  /**
   * To override in the child classes
   * @return {L.Bounds}
   */
  _getViewport: function() {
    return this._pathViewport;
  },


  /**
   * Update root position to get the viewport covered
   */
  _updateContentViewport: function () {
    var p = this.options.padding;
    var size = this._map.getSize();
    var panePos = L.DomUtil.getPosition(this._map._mapPane);
    var min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round());
    var max = min.add(size.multiplyBy(1 + p * 2)._round());

    this._pathViewport = new L.Bounds([min.x, min.y], [max.x, max.y]);
  },


  /**
   * @param  {ZoomEvent} e
   */
  _animatePathZoom: function (e) {
    if (!this.options.usePathContainer) {
      var scale = this._map.getZoomScale(e.zoom);
      var offset = this._map
        ._getCenterOffset(e.center)
        ._multiplyBy(-scale)
        ._add(this._getViewport().min);

      this._pathRoot.style[L.DomUtil.TRANSFORM] =
        L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';
    }

    this._pathZooming = true;
  },


  /**
   * Here we can do additional post-animation transforms
   */
  _endPathZoom: function () {
    this._pathZooming = false;
  },


  /**
   * Apply the viewport correction
   */
  _updateSvgViewport: function () {

    if (this._pathZooming) {
      // Do not update SVGs while a zoom animation is going on
      // otherwise the animation will break.
      // When the zoom animation ends we will be updated again anyway
      // This fixes the case where you do a momentum move and
      // zoom while the move is still ongoing.
      return;
    }

    this._updateContentViewport();

    var vp     = this._getViewport();
    var min    = vp.min;
    var max    = vp.max;
    var width  = max.x - min.x;
    var height = max.y - min.y;
    var root   = this._pathRoot;
    var pane   = this._map.getPanes().overlayPane;

    // Hack to make flicker on drag end on mobile webkit less irritating
    if (L.Browser.mobileWebkit) {
      this._container.removeChild(root);
    }

    if (!this.options.usePathContainer) {
      L.DomUtil.setPosition(this._pathRoot, min);
      root.setAttribute('width', width);
      root.setAttribute('height', height);
      root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));
    }

    if (L.Browser.mobileWebkit && !this.options.usePathContainer) {
      this._container.appendChild(root);
    }
  }

});

