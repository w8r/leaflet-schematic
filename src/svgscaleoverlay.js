L.SVGScaleOverlay = L.Class.extend({
  options: {
    pane: 'overlayPane',
    nonBubblingEvents: [],  // Array of events that should not be bubbled to DOM parents (like the map)
    // how much to extend the clip area around the map view (relative to its size)
    // e.g. 0.1 would be 10% of map view in each direction; defaults to clip with the map view
    padding: 0
  },

  isLeafletVersion1: function () {
    return L.Layer ? true : false;
  },

  initialize: function (options) {
    L.setOptions(this, options);
    L.stamp(this);
  },


  // ----------------------------------------------------------------------------------
  getScaleDiff: function(zoom) {
    var zoomDiff = this._groundZoom - zoom;
    var scale = (zoomDiff < 0 ?
      Math.pow(2, Math.abs(zoomDiff)) :
      1 / (Math.pow(2, zoomDiff)));
    return scale;
  },


  initSvgContainer: function () {

    var xmlns = "http://www.w3.org/2000/svg";
    this._svg = document.createElementNS(xmlns, "svg");
    this._g = document.createElementNS(xmlns, "g");
    if (!this.isLeafletVersion1()) {
        L.DomUtil.addClass(this._g, 'leaflet-zoom-hide');
    }
    var size = this._map.getSize();
    this._svgSize = size;
    this._svg.setAttribute('width', size.x);
    this._svg.setAttribute('height', size.y);


    this._svg.appendChild(this._g);




    this._groundZoom = this._map.getZoom();

    this._shift = new L.Point(0, 0);
    this._lastZoom = this._map.getZoom();

    var bounds = this._map.getBounds();
    this._lastTopLeftlatLng = new L.LatLng(bounds.getNorth(), bounds.getWest()); ////this._initialTopLeft     = this._map.layerPointToLatLng(this._lastLeftLayerPoint);

  },


  resize: function (e) {
    var size = this._map.getSize();
    this._svgSize = size;
    this._svg.setAttribute('width', size.x);
    this._svg.setAttribute('height', size.y);
  },


  moveEnd: function (e) {
    var bounds = this._map.getBounds();
    var topLeftLatLng      = new L.LatLng(bounds.getNorth(), bounds.getWest());
    var topLeftLayerPoint  = this._map.latLngToLayerPoint(topLeftLatLng);
    var lastLeftLayerPoint = this._map.latLngToLayerPoint(this._lastTopLeftlatLng);

    var zoom = this._map.getZoom();
    var scaleDelta = this._map.getZoomScale(zoom, this._lastZoom);
    var scaleDiff = this.getScaleDiff(zoom);

    if (this._lastZoom != zoom) {
        if (typeof (this.onScaleChange) == 'function') {
            this.onScaleChange(scaleDiff);
        }
    }
    this._lastZoom = zoom;
    var delta = lastLeftLayerPoint.subtract(topLeftLayerPoint);

    this._lastTopLeftlatLng = topLeftLatLng;
    L.DomUtil.setPosition(this._svg, topLeftLayerPoint);


    this._shift._multiplyBy(scaleDelta)._add(delta);
    this._g.setAttribute("transform", "translate(" + this._shift.x + "," +
      this._shift.y + ") scale(" + scaleDiff + ")"); // --we use viewBox instead

  },


  animateSvgZoom: function (e) {
    var scale = this._map.getZoomScale(e.zoom, this._lastZoom),
    offset = this._map._latLngToNewLayerPoint(
      this._lastTopLeftlatLng, e.zoom, e.center);

    L.DomUtil.setTransform(this._svg, offset, scale);
  },


  getEvents: function () {
    var events = {
         resize: this.resize,
        moveend: this.moveEnd
    };
    if (this._zoomAnimated && this.isLeafletVersion1()) {
       // events.zoomanim = this.animateSvgZoom;
    }
    return events;
  },


  /* from Layer , extension  to get it worked on lf 1.0, this is not called on ,1. versions */
  _layerAdd: function (e) { this.onAdd(e.target); },

  /*end Layer */
  onAdd: function (map) {
    // -- from _layerAdd
    // check in case layer gets added and then removed before the map is ready
    if (!map.hasLayer(this)) { return; }

    this._map = map;
    this._zoomAnimated = map._zoomAnimated;

    // --onAdd leaflet 1.0
    if (!this._svg) {
      this.initSvgContainer();

      if (this._zoomAnimated) {
          //L.DomUtil.addClass(this._svg, 'leaflet-zoom-animated');
          L.DomUtil.addClass(this._svg, 'leaflet-zoom-hide');
      }
    }

    var pane = this._map.getPanes().overlayPane;
    pane.appendChild(this._svg);


    if (typeof (this.onInitData) == 'function') {
      this.onInitData();
    }


  //---------- from _layerAdd
    if (this.getAttribution && this._map.attributionControl) {
      this._map.attributionControl.addAttribution(this.getAttribution());
    }

    if (this.getEvents) {
      map.on(this.getEvents(), this);
    }

    map.fire('layeradd', { layer: this });
  },


  onRemove: function () {
    L.DomUtil.remove(this._svg);
  }

});



L.SvgScaleOverlay = function (options) {
  return new L.SVGScaleOverlay(options);
};
