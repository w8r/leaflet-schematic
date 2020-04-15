const L = require('leaflet');

L.Browser.phantomjs = navigator.userAgent.toLowerCase().indexOf('phantom');

// <use> tags are broken in IE in so many ways
if ('SVGElementInstance' in window) {
  Object.defineProperty(SVGElementInstance.prototype, 'className', {
    get: function () {
      return this.correspondingElement.className.baseVal;
    },
    set: function (val) {
      this.correspondingElement.className.baseVal = val;
    }
  });
}


/**
 * @param  {*}  o
 * @return {Boolean}
 */
L.DomUtil.isNode = function (o) {
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
L.DomUtil.getSVGBBox = (svg) => {
  let svgBBox;
  const width = parseInt(svg.getAttribute('width'), 10);
  const height = parseInt(svg.getAttribute('height'), 10);
  const viewBox = svg.getAttribute('viewBox');
  let bbox;

  if (viewBox) {
    bbox = viewBox.split(' ').map(parseFloat);
    svgBBox = [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
  } else if (width && height) {
    svgBBox = [0, 0, width, height];
  } else { //Calculate rendered size
    const clone = svg.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = 0;
    clone.style.left = 0;
    clone.style.zIndex = -1;
    clone.style.opacity = 0;

    document.body.appendChild(clone);

    if (clone.clientWidth && clone.clientHeight) {
      svgBBox = [0, 0, clone.clientWidth, clone.clientHeight];
    } else {
      svgBBox = calcSVGViewBoxFromNodes(clone);
    }

    document.body.removeChild(clone);
  }
  return svgBBox;
};


/**
 * Simply brute force: takes all svg nodes, calculates bounding box
 * @param  {SVGElement} svg
 * @return {Array.<Number>}
 */
function calcSVGViewBoxFromNodes(svg) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const nodes = [].slice.call(svg.querySelectorAll('*'));
  const { min, max } = Math.max;

  for (let i = 0, len = nodes.length; i < len; i++) {
    let node = nodes[i];
    if (node.getBBox) {
      node = node.getBBox();

      bbox[0] = min(node.x, bbox[0]);
      bbox[1] = min(node.y, bbox[1]);

      bbox[2] = max(node.x + node.width, bbox[2]);
      bbox[3] = max(node.y + node.height, bbox[3]);
    }
  }
  return bbox;
}


/**
 * @param  {String} str
 * @return {SVGElement}
 */
L.DomUtil.getSVGContainer = (str) => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = str;
  return wrapper.querySelector('svg');
};


/**
 * @param  {L.Point} translate
 * @param  {Number}  scale
 * @return {String}
 */
L.DomUtil.getMatrixString = (translate, scale) => {
  return 'matrix(' +
    [scale, 0, 0, scale, translate.x, translate.y].join(',') + ')';
};


/**
 * @param  {SVGElement}         svg
 * @param  {SVGElement|Element} container
 */
L.SVG.copySVGContents = (svg, container) => {
  // SVG innerHTML doesn't work for SVG in IE and PhantomJS
  if (L.Browser.ie || L.Browser.phantomjs) {
    let child = svg.firstChild;
    do {
      container.appendChild(child);
      child = svg.firstChild;
    } while (child);
  } else {
    container.innerHTML = svg.innerHTML;
  }
};
