import tape from 'tape';
import L    from 'leaflet';
import bounds from '../src/bounds';

tape('Bounds helpers', (t) => {

  t.test('L.Bounds', (t) => {

    t.test(' .toBBox', (t) => {
      t.equals(typeof L.Bounds.prototype.toBBox, 'function', 'method present');
      t.end();
    });

    t.test(' .scale', (t) => {
      const b = new L.Bounds([[0, 0], [1, 1]]);
      const scaled = b.scale(2);
      t.deepEquals(scaled.toBBox(), [-0.5, -0.5, 1.5, 1.5], 'scaled');
      t.end();
    });

    t.end();
  });

  t.test('L.LatLngBounds', (t) => {

    t.test(' .toBBox', (t) => {
      t.equals(typeof L.LatLngBounds.prototype.toBBox, 'function', 'method present');
      t.end();
    });

    t.test(' .scale', (t) => {
      const b = new L.LatLngBounds([[0, 0], [1, 1]]);
      const scaled = b.scale(2);
      t.deepEquals(scaled.toBBox(), [-0.5, -0.5, 1.5, 1.5], 'scaled');
      t.end();
    });

    t.end();
  });

  t.end();
});
