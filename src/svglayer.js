module.exports = L.Class.extend({

  includes: L.Mixin.Events,

  options: {
    opacity: 1,
    padding: 0 //L.Path.CLIP_PADDING
  },

  initialize: function(options) {
    L.Util.setOptions(this, options);
  },


  onAdd: function(map) {
    this._map = map;
    this._initPathRoot();
  },


  addTo: function(map) {
    map.addLayer(this);
    return this;
  },


  onRemove: function(map) {
    if (this._map.options.zoomAnimation && L.Browser.any3d) {
      this._map.off({
        'zoomanim': this._animatePathZoom,
        'zoomend': this._endPathZoom
      }, this);
    }

    this._map.off('moveend', this._updateSvgViewport, this);
    this._map.getPanes().overlayPane.removeChild(this._pathRoot);
    return this;
  },


  removeFrom: function(map) {
    map.removeLayer(this);
    return this;
  },


  bringToFront: function () {
    var root = this._pathRoot.parentNode,
        path = this._pathRoot;

    if (path && root.lastChild !== path) {
      root.appendChild(path);
    }
    return this;
  },


  bringToBack: function () {
    var root = this._pathRoot.parentNode;
    var path = this._pathRoot;
    var first = root.firstChild;

    if (path && first !== path) {
      root.insertBefore(path, first);
    }
    return this;
  },


  _createRoot: function() {
    this._pathRoot = L.Path.prototype._createElement('svg');
  },


  _initPathRoot: function () {
    if (!this._pathRoot) {
      this._createRoot();
      this._map.getPanes().overlayPane.appendChild(this._pathRoot);

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
    }
  },


  _getViewport: function() {
    return this._pathViewport;
  },


  _updateContentViewport: function () {
    var p = this.options.padding;
    var size = this._map.getSize();
    var panePos = L.DomUtil.getPosition(this._map._mapPane);
    var min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round());
    var max = min.add(size.multiplyBy(1 + p * 2)._round());

    this._pathViewport = new L.Bounds(min, max);
  },


  _animatePathZoom: function (e) {
    var scale = this._map.getZoomScale(e.zoom);
    var offset = this._map
      ._getCenterOffset(e.center)
      ._multiplyBy(-scale)
      ._add(this._getViewport().min);

    if (scale !== 1) {
      this._lastScale = scale;
      this._lastOffset = offset;
    }

    this._pathRoot.style[L.DomUtil.TRANSFORM] =
      L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

    this._pathZooming = true;
  },


  _endPathZoom: function () {
    this._pathZooming = false;
  },


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

    var vp = this._getViewport();
    var min = vp.min;
    var max = vp.max;
    var width = max.x - min.x;
    var height = max.y - min.y;
    var root = this._pathRoot;
    var pane = this._map.getPanes().overlayPane;

    // Hack to make flicker on drag end on mobile webkit less irritating
    if (L.Browser.mobileWebkit) {
      pane.removeChild(root);
    }

    L.DomUtil.setPosition(root, min);
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

    if (L.Browser.mobileWebkit) {
      pane.appendChild(root);
    }
  }

});
