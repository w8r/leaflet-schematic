var xhr = require('xhr');
var b64 = require('Base64');
var L = require('leaflet');

xhr({
  uri: 'data/6.svg',
  headers: {
    "Content-Type": "image/svg+xml"
  }
}, function (err, resp, svgString) {
  var d = document.querySelector('#image-map');
  d.parentNode.removeChild(d);

  var wrapper = L.DomUtil.create('div');
  wrapper.innerHTML = svgString;
  var svg = global.svg = wrapper.querySelector('svg');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svgString = wrapper.innerHTML;
  //svg.style.border = '1px solid green';
  document.body.appendChild(svg);

  var winSize = L.point(document.body.clientWidth, document.body.clientHeight);
  var encoded = b64.btoa(unescape(encodeURIComponent(svgString)));

  var viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
  var tl = L.point(viewBox.slice(0,2));
  var size = L.point(viewBox.slice(2, 4));
  svg.style.width = size.x + 'px';
  svg.style.height = size.y + 'px';

  console.log(viewBox, tl, size, size.x / size.y);



  var img = global.img = new Image();
  img.src = 'data:image/svg+xml;base64,' + encoded;
  img.style.border = '1px solid red';
  img.style.position = 'absolute';
  img.style.top = img.style.left = 0;
  img.style.width = size.x + 'px';
  img.style.height = size.y + 'px';
  L.DomUtil.setOpacity(img, 0.1);

  L.DomEvent.on(img, 'load', function() {
    var imageSize = L.point(img.offsetWidth, img.offsetHeight);
    console.log(imageSize, imageSize.x / imageSize.y);
  });


  document.body.appendChild(img);

  var canvas = global.canvas = L.DomUtil.create('canvas', 'canvas');
  //canvas.style.border   = '1px solid blue';
  canvas.style.position = 'absolute';
  canvas.style.top = canvas.style.left = 0;

  canvas.width = winSize.x * 2;
  canvas.height = winSize.y * 2;
  canvas.style.width = winSize.x;
  canvas.style.height = winSize.y;

  L.DomUtil.setOpacity(canvas, 1);

  document.body.appendChild(canvas);

  canvas.getContext('2d').drawImage(img, 0, 0, size.x * 2, size.y * 2);
});