
// <use> tags are broken in IE in so many ways
if ('SVGElementInstance' in global) {
  Object.defineProperty(SVGElementInstance.prototype, 'className', {
    get: function() {
      return this.correspondingElement.className.baseVal;
    },
    set: function(val) {
      this.correspondingElement.className.baseVal = val;
    }
  });
}


/**
 * @param  {*}  o
 * @return {Boolean}
 */
L.DomUtil.isNode = function(o){
  return (
    typeof Node === 'object' ?
    o instanceof Node :
    o && typeof o === 'object' &&
    typeof o.nodeType === 'number' &&
    typeof o.nodeName === 'string'
  );
};


/**
 * @param  {SVGElement} svg
 * @return {Array.<Number>}
 */
L.DomUtil.getSVGBBox = function(svg) {
  var viewBox = svg.getAttribute('viewBox');
  var bbox;
  if (viewBox) {
    bbox = viewBox.split(' ').map(parseFloat);
  } else {
    var clone = svg.cloneNode(true);
    document.body.appendChild(clone);
    bbox = clone.getBBox();
    document.body.removeChild(clone);
    bbox = [bbox.x, bbox.y,
      parseInt(svg.getAttribute('width')) || svg.offsetWidth || bbox.width,
      parseInt(svg.getAttribute('height')) || svg.offsetHeight || bbox.height];
  }
  return [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
};


/**
 * @param  {String} str
 * @return {SVGElement}
 */
L.DomUtil.getSVGContainer = function(str) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = str;
  return wrapper.querySelector('svg');
};


/**
 * @param  {L.Point} translate
 * @param  {Number}  scale
 * @return {String}
 */
L.DomUtil.getMatrixString = function(translate, scale) {
  return 'matrix(' +
    [scale, 0, 0, scale, translate.x, translate.y].join(',') + ')';
};
