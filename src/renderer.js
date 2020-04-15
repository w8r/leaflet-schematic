const L = require('leaflet');

/**
 * @class L.SchematicRenderer
 * @param  {Object}
 * @extends {L.SVG}
 */
L.SchematicRenderer = module.exports = L.SVG.extend({

  options: {
    padding: 0.3,
    useRaster: L.Browser.ie || L.Browser.gecko || L.Browser.edge,
    interactive: true
  },


  /**
   * Create additional containers for the vector features to be
   * transformed to live in the schematic space
   */
  _initContainer() {
    L.SVG.prototype._initContainer.call(this);

    this._rootInvertGroup = L.SVG.create('g');
    this._container.appendChild(this._rootInvertGroup);
    this._rootInvertGroup.appendChild(this._rootGroup);

    if (L.Browser.gecko) {
      this._container.setAttribute('pointer-events', 'visiblePainted');
    }

    L.DomUtil.addClass(this._container, 'schematics-renderer');
  },


  /**
   * Make sure layers are not clipped
   * @param  {L.Layer}
   */
  _initPath(layer) {
    layer.options.noClip = true;
    L.SVG.prototype._initPath.call(this, layer);
  },


  /**
   * Update call on resize, redraw, zoom change
   */
  _update() {
    L.SVG.prototype._update.call(this);

    const schematic = this.options.schematic;
    const map = this._map;

    if (map && schematic._bounds && this._rootInvertGroup) {
      const topLeft = map.latLngToLayerPoint(schematic._bounds.getNorthWest());
      const scale = schematic._ratio *
        map.options.crs.scale(map.getZoom() - schematic.options.zoomOffset);

      this._topLeft = topLeft;
      this._scale = scale;

      // compensate viewbox dismissal with a shift here
      this._rootGroup.setAttribute('transform',
        L.DomUtil.getMatrixString(topLeft, scale));

      this._rootInvertGroup.setAttribute('transform',
        L.DomUtil.getMatrixString(topLeft.multiplyBy(-1 / scale), 1 / scale));
    }
  },


  /**
   * 1. wrap markup in another <g>
   * 2. create a clipPath with the viewBox rect
   * 3. apply it to the <g> around all markups
   * 4. remove group around schematic
   * 5. remove inner group around markups
   *
   * @param {Boolean=} onlyOverlays
   * @return {SVGElement}
   */
  exportSVG(onlyOverlays) {
    const schematic = this.options.schematic;

    // go through every layer and make sure they're not clipped
    const svg = this._container.cloneNode(true);

    const clipPath = L.SVG.create('clipPath');
    const clipRect = L.SVG.create('rect');
    const clipGroup = svg.lastChild;
    const baseContent = svg.querySelector('.svg-overlay');
    let defs = baseContent.querySelector('defs');

    clipRect.setAttribute('x', schematic._bbox[0]);
    clipRect.setAttribute('y', schematic._bbox[1]);
    clipRect.setAttribute('width', schematic._bbox[2]);
    clipRect.setAttribute('height', schematic._bbox[3]);
    clipPath.appendChild(clipRect);

    const clipId = 'viewboxClip-' + L.Util.stamp(schematic._group);
    clipPath.setAttribute('id', clipId);

    if (!defs || onlyOverlays) {
      defs = L.SVG.create('defs');
      svg.appendChild(defs);
    }
    defs.appendChild(clipPath);
    clipGroup.setAttribute('clip-path', 'url(#' + clipId + ')');

    clipGroup.firstChild.setAttribute('transform',
      L.DomUtil.getMatrixString(this._topLeft.multiplyBy(-1 / this._scale)
        .add(schematic._viewBoxOffset), 1 / this._scale));
    clipGroup.removeAttribute('transform');
    svg.querySelector('.svg-overlay').removeAttribute('transform');
    L.DomUtil.addClass(clipGroup, 'clip-group');

    svg.style.transform = '';
    svg.setAttribute('viewBox', schematic._bbox.join(' '));

    if (onlyOverlays) { // leave only markups
      baseContent.parentNode.removeChild(baseContent);
    }

    const div = L.DomUtil.create('div', '');
    // put container around the contents as it was
    div.innerHTML = (/(\<svg\s+([^>]*)\>)/gi)
      .exec(schematic._rawData)[0] + '</svg>';

    L.SVG.copySVGContents(svg, div.firstChild);

    return div.firstChild;
  }

});


/**
 * @param  {Object}
 * @return {L.SchematicRenderer}
 */
L.schematicRenderer = module.exports.schematicRenderer =
  (options) => new L.SchematicRenderer(options);
