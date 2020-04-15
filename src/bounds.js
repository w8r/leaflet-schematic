const L = require('leaflet');

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
  const { max, min } = this;
  const deltaX = ((max.x - min.x) / 2) * (value - 1);
  const deltaY = ((max.y - min.y) / 2) * (value - 1);

  return new L.Bounds([
    [min.x - deltaX, min.y - deltaY],
    [max.x + deltaX, max.y + deltaY]
  ]);
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
  const ne = this._northEast;
  const sw = this._southWest;
  const deltaX = ((ne.lng - sw.lng) / 2) * (value - 1);
  const deltaY = ((ne.lat - sw.lat) / 2) * (value - 1);

  return new L.LatLngBounds([
    [sw.lat - deltaY, sw.lng - deltaX],
    [ne.lat + deltaY, ne.lng + deltaX]
  ]);
};
