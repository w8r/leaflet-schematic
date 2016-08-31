import tape  from 'tape';
import L     from 'leaflet';
import utils from '../src/utils';

tape('SVG utils', (t) => {

  t.test(' - L.DomUtil.isNode', (t) => {
    t.ok(L.DomUtil.isNode(document.body), 'document');
    t.ok(L.DomUtil.isNode(L.DomUtil.create('div', 'test')), 'div');
    t.ok(L.DomUtil.isNode(document.createTextNode('text')), 'textNode');
    t.notOk(L.DomUtil.isNode('string'), 'not string');
    t.notOk(L.DomUtil.isNode({a: true}), 'not object');

    t.end();
  });

  t.test(' - L.DomUtil.getMatrixString', (t) => {
    t.equal(L.DomUtil.getMatrixString(L.point(1, 2), 3), 'matrix(3,0,0,3,1,2)', 'matrix str');

    t.end();
  });

  t.test(' - L.SVG.copySVGContents', (t) => {
    let svg = L.SVG.create('svg');
    svg.appendChild(L.SVG.create('path'));
    let copy = L.SVG.create('svg');

    L.SVG.copySVGContents(svg, copy);

    t.ok(copy.querySelector('path'), 'copied');

    t.end();
  });

  t.end();
});
