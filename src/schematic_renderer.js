module.exports = L.SVG.extend({


  options: {
    padding: 0.3
  },


  _initContainer: function() {
    L.SVG.prototype._initContainer();

    this._rootInvertGroup = L.SVG.create('g');
    this._container.appendChild(this._rootInvertGroup);
    this._rootInvertGroup.appendChild(this._rootGroup);
  },


  _update: function() {
    L.SVG.prototype._update.call(this);
    var schematic = this.options.schematic;
    var map = this._map;

    if (map && schematic._bounds && this._rootInvertGroup) {
      var topLeft = map.latLngToLayerPoint(schematic._bounds.getNorthWest());
      var scale   = schematic._ratio *
        map.options.crs.scale(map.getZoom() - schematic.options.zoomOffset);

      this._topLeft = topLeft;
      this._scale   = scale;

      // compensate viewbox dismissal with a shift here
      this._rootGroup.setAttribute('transform',
         L.DomUtil.getMatrixString(topLeft, scale));

      this._rootInvertGroup.setAttribute('transform',
        L.DomUtil.getMatrixString(topLeft.multiplyBy( -1 / scale), 1 / scale));
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
  exportSVG: function() {
    var schematic = this.options.schematic;
    var svg       = this._container.cloneNode(true);

    var clipPath  = L.SVG.create('clipPath');
    var clipRect  = L.SVG.create('rect');

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

    return svg;
  }

});

