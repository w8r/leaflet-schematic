(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

L.EditControl = L.Control.extend({

  options: {
    position: 'topleft',
    callback: null,
    renderer: null,
    kind: '',
    html: ''
  },

  onAdd: function onAdd(map) {
    var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar'),
        link = L.DomUtil.create('a', '', container);
    var editTools = map.editTools;

    link.href = '#';
    link.title = 'Create a new ' + this.options.kind;
    link.innerHTML = this.options.html;
    L.DomEvent.on(link, 'click', L.DomEvent.stop).on(link, 'click', function () {
      console.log(editTools);
      window.LAYER = editTools[this.options.callback].call(editTools, null, {
        renderer: this.options.renderer
      });
    }, this);

    return container;
  }

});

L.NewLineControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startPolyline',
    kind: 'line',
    html: '\\/\\'
  }
});

L.NewPolygonControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startPolygon',
    kind: 'polygon',
    html: '▰'
  }
});

L.NewMarkerControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startMarker',
    kind: 'marker',
    html: '🖈'
  }

});

L.NewRectangleControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startRectangle',
    kind: 'rectangle',
    html: '⬛'
  }
});

L.NewCircleControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    callback: 'startCircle',
    kind: 'circle',
    html: '⬤'
  }
});

module.exports = {
  Marker: L.NewMarkerControl,
  Line: L.NewLineControl,
  Polygon: L.NewPolygonControl,
  Rectangle: L.NewRectangleControl,
  Circle: L.NewCircleControl
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var SvgOverlay = require('../../src/schematic');
var xhr = require('xhr');
var saveAs = require('browser-filesaver').saveAs;
var Draw = require('./editable');

//global.SvgLayer = require('../../src/svglayer');

// create the slippy map
var map = window.map = L.map('image-map', {
  minZoom: 0,
  maxZoom: 20,
  center: [0, 0],
  zoom: 1,
  editable: true,
  crs: L.Util.extend({}, L.CRS.Simple, {
    infinite: false
  }),
  inertia: !L.Browser.ie
});

var controls = global.controls = [new Draw.Line(), new Draw.Polygon(), new Draw.Rectangle()];
controls.forEach(map.addControl, map);

L.SVG.prototype.options.padding = 0.5;

var svg = global.svg = null;

map.on('click', function (evt) {
  console.log('map', evt.originalEvent.target, evt.latlng, evt, map.hasLayer(svg) ? svg.projectPoint(evt.latlng) : evt);
});

var select = document.querySelector('#select-schematic');
function onSelect() {
  if (svg) {
    map.removeLayer(svg);
    map.off('mousemove', trackPosition, map);
  }

  svg = global.svg = new SvgOverlay(this.value, {
    usePathContainer: true,
    //opacity: 1,
    weight: 0.25,
    //useRaster: true,
    load: function load(url, callback) {

      if ('pending' === url) {
        alert('Test network pending, no data will be shown. Switch to another svg');
        return;
      }

      xhr({
        uri: url,
        headers: {
          'Content-Type': 'image/svg+xml'
        }
      }, function (err, resp, svg) {
        if (200 !== resp.statusCode) {
          err = resp.statusCode;
          alert('Network error', err);
        }
        callback(err, svg);
      });
    }
  }).once('load', function () {

    // use schematic renderer
    controls.forEach(function (control) {
      control.options.renderer = svg._renderer;
    });

    map.fitBounds(svg.getBounds(), { animate: false });
    map.on('mousemove', trackPosition, map);
  }).addTo(map);
}

L.DomEvent.on(select, 'change', onSelect);

onSelect.call(select);

L.DomEvent.on(document.querySelector('#dl'), 'click', function () {
  saveAs(new Blob([svg.exportSVG(true)]), 'schematic.svg');
});

function trackPosition(evt) {
  if (evt.originalEvent.shiftKey) {
    console.log(evt.latlng, svg.projectPoint(evt.latlng).toString(), svg.unprojectPoint(svg.projectPoint(evt.latlng)), evt.originalEvent.target);
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../src/schematic":12,"./editable":1,"browser-filesaver":4,"xhr":8}],3:[function(require,module,exports){
(function(f) {

  'use strict';

  /* istanbul ignore else */
  if (typeof exports === 'object' && exports != null &&
      typeof exports.nodeType !== 'number') {
    module.exports = f ();
  } else if (typeof define === 'function' && define.amd != null) {
    define ([], f);
  } else {
    var base64 = f ();
    var global = typeof self !== 'undefined' ? self : $.global;
    if (typeof global.btoa !== 'function') global.btoa = base64.btoa;
    if (typeof global.atob !== 'function') global.atob = base64.atob;
  }

} (function() {

  'use strict';

  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error ();
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  function btoa(input) {
    var str = String (input);
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next str index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      str.charAt (idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt (63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = str.charCodeAt (idx += 3 / 4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError ("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  }

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  function atob(input) {
    var str = (String (input)).replace (/[=]+$/, ''); // #31: ExtendScript bad parse of /=
    if (str.length % 4 === 1) {
      throw new InvalidCharacterError ("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = str.charAt (idx++); // eslint-disable-line no-cond-assign
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode (255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf (buffer);
    }
    return output;
  }

  return {btoa: btoa, atob: atob};

}));

},{}],4:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.1.20160328
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /Version\/[\d\.]+.*Safari/.test(navigator.userAgent)
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			/* // Take note W3C:
			var
			  uri = typeof file === "string" ? file : file.toURL()
			, revoker = function(evt) {
				// idealy DownloadFinishedEvent.data would be the URL requested
				if (evt.data === uri) {
					if (typeof file === "string") { // file is an object URL
						get_URL().revokeObjectURL(file);
					} else { // file is a File
						file.remove();
					}
				}
			}
			;
			view.addEventListener("downloadfinished", revoker);
			*/
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob(["\ufeff", blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if (target_view && is_safari && typeof FileReader !== "undefined") {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var base64Data = reader.result;
							target_view.location.href = "data:attachment/file" + base64Data.slice(base64Data.search(/[,;]/));
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab === undefined && is_safari) {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name, no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name || "download");
		};
	}

	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define([], function() {
    return saveAs;
  });
}

},{}],5:[function(require,module,exports){
(function (global){
var win;

if (typeof window !== "undefined") {
    win = window;
} else if (typeof global !== "undefined") {
    win = global;
} else if (typeof self !== "undefined"){
    win = self;
} else {
    win = {};
}

module.exports = win;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],7:[function(require,module,exports){
var trim = function(string) {
  return string.replace(/^\s+|\s+$/g, '');
}
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  var headersArr = trim(headers).split('\n')

  for (var i = 0; i < headersArr.length; i++) {
    var row = headersArr[i]
    var index = row.indexOf(':')
    , key = trim(row.slice(0, index)).toLowerCase()
    , value = trim(row.slice(index + 1))

    if (typeof(result[key]) === 'undefined') {
      result[key] = value
    } else if (isArray(result[key])) {
      result[key].push(value)
    } else {
      result[key] = [ result[key], value ]
    }
  }

  return result
}

},{}],8:[function(require,module,exports){
"use strict";
var window = require("global/window")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
// Allow use of default import syntax in TypeScript
module.exports.default = createXHR;
createXHR.XMLHttpRequest = window.XMLHttpRequest || noop
createXHR.XDomainRequest = "withCredentials" in (new createXHR.XMLHttpRequest()) ? createXHR.XMLHttpRequest : window.XDomainRequest

forEachArray(["get", "put", "post", "patch", "head", "delete"], function(method) {
    createXHR[method === "delete" ? "del" : method] = function(uri, options, callback) {
        options = initParams(uri, options, callback)
        options.method = method.toUpperCase()
        return _createXHR(options)
    }
})

function forEachArray(array, iterator) {
    for (var i = 0; i < array.length; i++) {
        iterator(array[i])
    }
}

function isEmpty(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)) return false
    }
    return true
}

function initParams(uri, options, callback) {
    var params = uri

    if (isFunction(options)) {
        callback = options
        if (typeof uri === "string") {
            params = {uri:uri}
        }
    } else {
        params = xtend(options, {uri: uri})
    }

    params.callback = callback
    return params
}

function createXHR(uri, options, callback) {
    options = initParams(uri, options, callback)
    return _createXHR(options)
}

function _createXHR(options) {
    if(typeof options.callback === "undefined"){
        throw new Error("callback argument missing")
    }

    var called = false
    var callback = function cbOnce(err, response, body){
        if(!called){
            called = true
            options.callback(err, response, body)
        }
    }

    function readystatechange() {
        if (xhr.readyState === 4) {
            setTimeout(loadFunc, 0)
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else {
            body = xhr.responseText || getXml(xhr)
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }

    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error") )
        }
        evt.statusCode = 0
        return callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        if (aborted) return
        var status
        clearTimeout(timeoutTimer)
        if(options.useXDR && xhr.status===undefined) {
            //IE8 CORS GET successful response doesn't have a status field, but body is fine
            status = 200
        } else {
            status = (xhr.status === 1223 ? 204 : xhr.status)
        }
        var response = failureResponse
        var err = null

        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        return callback(err, response, response.body)
    }

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new createXHR.XDomainRequest()
        }else{
            xhr = new createXHR.XMLHttpRequest()
        }
    }

    var key
    var aborted
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer
    var failureResponse = {
        body: undefined,
        headers: {},
        statusCode: 0,
        method: method,
        url: uri,
        rawRequest: xhr
    }

    if ("json" in options && options.json !== false) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json === true ? body : options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.onabort = function(){
        aborted = true;
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            if (aborted) return
            aborted = true//IE9 may still call readystatechange
            xhr.abort("timeout")
            var e = new Error("XMLHttpRequest timeout")
            e.code = "ETIMEDOUT"
            errorFunc(e)
        }, options.timeout )
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers && !isEmpty(options.headers)) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }

    if ("beforeSend" in options &&
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    // Microsoft Edge browser sends "undefined" when send is called with undefined value.
    // XMLHttpRequest spec says to pass null as body to indicate no body
    // See https://github.com/naugtur/xhr/issues/100.
    xhr.send(body || null)

    return xhr


}

function getXml(xhr) {
    // xhr.responseXML will throw Exception "InvalidStateError" or "DOMException"
    // See https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseXML.
    try {
        if (xhr.responseType === "document") {
            return xhr.responseXML
        }
        var firefoxBugTakenEffect = xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror"
        if (xhr.responseType === "" && !firefoxBugTakenEffect) {
            return xhr.responseXML
        }
    } catch (e) {}

    return null
}

function noop() {}

},{"global/window":5,"is-function":6,"parse-headers":7,"xtend":9}],9:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],10:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

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
  var max = this.max,
      min = this.min;

  var deltaX = (max.x - min.x) / 2 * (value - 1);
  var deltaY = (max.y - min.y) / 2 * (value - 1);

  return new L.Bounds([[min.x - deltaX, min.y - deltaY], [max.x + deltaX, max.y + deltaY]]);
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
  var ne = this._northEast;
  var sw = this._southWest;
  var deltaX = (ne.lng - sw.lng) / 2 * (value - 1);
  var deltaY = (ne.lat - sw.lat) / 2 * (value - 1);

  return new L.LatLngBounds([[sw.lat - deltaY, sw.lng - deltaX], [ne.lat + deltaY, ne.lng + deltaX]]);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],11:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

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
  _initContainer: function _initContainer() {
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
  _initPath: function _initPath(layer) {
    layer.options.noClip = true;
    L.SVG.prototype._initPath.call(this, layer);
  },


  /**
   * Update call on resize, redraw, zoom change
   */
  _update: function _update() {
    L.SVG.prototype._update.call(this);

    var schematic = this.options.schematic;
    var map = this._map;

    if (map && schematic._bounds && this._rootInvertGroup) {
      var topLeft = map.latLngToLayerPoint(schematic._bounds.getNorthWest());
      var scale = schematic._ratio * map.options.crs.scale(map.getZoom() - schematic.options.zoomOffset);

      this._topLeft = topLeft;
      this._scale = scale;

      // compensate viewbox dismissal with a shift here
      this._rootGroup.setAttribute('transform', L.DomUtil.getMatrixString(topLeft, scale));

      this._rootInvertGroup.setAttribute('transform', L.DomUtil.getMatrixString(topLeft.multiplyBy(-1 / scale), 1 / scale));
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
  exportSVG: function exportSVG(onlyOverlays) {
    var schematic = this.options.schematic;

    // go through every layer and make sure they're not clipped
    var svg = this._container.cloneNode(true);

    var clipPath = L.SVG.create('clipPath');
    var clipRect = L.SVG.create('rect');
    var clipGroup = svg.lastChild;
    var baseContent = svg.querySelector('.svg-overlay');
    var defs = baseContent.querySelector('defs');

    clipRect.setAttribute('x', schematic._bbox[0]);
    clipRect.setAttribute('y', schematic._bbox[1]);
    clipRect.setAttribute('width', schematic._bbox[2]);
    clipRect.setAttribute('height', schematic._bbox[3]);
    clipPath.appendChild(clipRect);

    var clipId = 'viewboxClip-' + L.Util.stamp(schematic._group);
    clipPath.setAttribute('id', clipId);

    if (!defs || onlyOverlays) {
      defs = L.SVG.create('defs');
      svg.appendChild(defs);
    }
    defs.appendChild(clipPath);
    clipGroup.setAttribute('clip-path', 'url(#' + clipId + ')');

    clipGroup.firstChild.setAttribute('transform', L.DomUtil.getMatrixString(this._topLeft.multiplyBy(-1 / this._scale).add(schematic._viewBoxOffset), 1 / this._scale));
    clipGroup.removeAttribute('transform');
    svg.querySelector('.svg-overlay').removeAttribute('transform');
    L.DomUtil.addClass(clipGroup, 'clip-group');

    svg.style.transform = '';
    svg.setAttribute('viewBox', schematic._bbox.join(' '));

    if (onlyOverlays) {
      // leave only markups
      baseContent.parentNode.removeChild(baseContent);
    }

    var div = L.DomUtil.create('div', '');
    // put container around the contents as it was
    div.innerHTML = /(\<svg\s+([^>]*)\>)/gi.exec(schematic._rawData)[0] + '</svg>';

    L.SVG.copySVGContents(svg, div.firstChild);

    return div.firstChild;
  }
});

/**
 * @param  {Object}
 * @return {L.SchematicRenderer}
 */
L.schematicRenderer = module.exports.schematicRenderer = function (options) {
  return new L.SchematicRenderer(options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],12:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;
var b64 = require('Base64');
var Renderer = require('./renderer');

require('./bounds');
require('./utils');

/**
 * Schematic layer to work with SVG schematics or blueprints in Leaflet
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 * @class Schematic
 * @extends {L.Rectangle}
 */
L.Schematic = module.exports = L.Rectangle.extend({

  options: {
    opacity: 0,
    fillOpacity: 0,
    weight: 1,
    adjustToScreen: true,

    // hardcode zoom offset to snap to some level
    zoomOffset: 0,
    interactive: false,
    useRaster: L.Browser.ie || L.Browser.gecko || L.Browser.edge
  },

  /**
   * @constructor
   * @param  {String}         svg     SVG string or URL
   * @param  {L.LatLngBounds} bounds
   * @param  {Object=}        options
   */
  initialize: function initialize(svg, bounds, options) {

    /**
     * @type {String}
     */
    this._svg = svg;

    /**
     * Initial svg width, cause we will have to get rid of that to maintain
     * the aspect ratio
     *
     * @type {String}
     */
    this._initialWidth = '';

    /**
     * Initial svg height
     * @type {String}
     */
    this._initialHeight = '';

    if (!(bounds instanceof L.LatLngBounds)) {
      options = bounds;
      bounds = null;
    }

    options.renderer = new Renderer({
      schematic: this
      // padding: options.padding || this.options.padding || 0.25
    });

    /**
     * @type {L.LatLngBounds}
     */
    this._bounds = bounds;

    /**
     * @type {Number}
     */
    this._ratio = 1;

    /**
     * @type {L.Point}
     */
    this._size = null;

    /**
     * @type {L.Point}
     */
    this._origin = null;

    /**
     * @type {L.Transformation}
     */
    this._transformation = null;

    /**
     * @type {String}
     */
    this._base64encoded = '';

    /**
     * @type {String}
     */
    this._rawData = '';

    /**
     * @type {L.Point}
     */
    this._viewBoxOffset = L.point(0, 0);

    /**
     * @type {Boolean}
     */
    this._ready = false;

    if (typeof svg === 'string' && !/\<svg/ig.test(svg)) {
      this._svg = null;

      /**
       * @type {String}
       */
      this._url = svg;

      if (!options.load) {
        throw new Error('SVGOverlay requires external request implementation. ' + 'You have to provide `load` function with the options');
      }
    }

    /**
     * @type {SVGElement}
     */
    this._group = null;

    /**
     * @type {L.Canvas}
     */
    this._canvasRenderer = null;

    /**
     * @type {Element}
     */
    this._raster = null;

    /**
     * @type {Boolean}
     */
    this._rasterShown = false;

    L.Rectangle.prototype.initialize.call(this, L.latLngBounds([0, 0], [0, 0]), options);
  },


  /**
   * @param  {L.Map} map
   */
  onAdd: function onAdd(map) {
    L.Rectangle.prototype.onAdd.call(this, map);

    this._ready = false;

    if (!this._group) {
      this._group = L.SVG.create('g');
      L.Util.stamp(this._group);
      L.DomUtil.addClass(this._group, 'svg-overlay');
    }

    if (!this._svg) {
      this.load();
    } else {
      this.onLoad(this._svg);
    }

    if (L.Browser.gecko) {
      this._path.setAttribute('pointer-events', 'none');
    }

    if (this.options.useRaster) {
      var canvasRenderer = new L.Canvas({}).addTo(map);
      canvasRenderer._container.parentNode.insertBefore(canvasRenderer._container, this._renderer._container);
      this._canvasRenderer = canvasRenderer;

      map.dragging._draggable.on('predrag', this._onPreDrag, this).on('dragend', this._onDragEnd, this);

      //canvasRenderer._container.style.visibility = 'hidden';
      canvasRenderer._container.style.display = 'none';
    }
  },


  /**
   * @param  {L.Map} map
   */
  onRemove: function onRemove(map) {
    if (null !== this._group.parentNode) {
      this._group.parentNode.removeChild(this._group);
    }
    L.Rectangle.prototype.onRemove.call(this, map);
    if (this._canvasRenderer) {
      this._canvasRenderer.removeFrom(map);
      map.dragging._draggable.off('predrag', this._onPreDrag, this).off('dragend', this._onDragEnd, this);
    }
    this._renderer.removeFrom(map);
  },


  /**
   * Loads svg via XHR
   */
  load: function load() {
    this.options.load(this._url, L.Util.bind(function (err, svg) {
      if (err) {
        this.onError(err);
      } else {
        this.onLoad(svg);
      }
    }, this));
  },


  /**
   * @param  {String} svgString
   * @return {String}
   */
  _readSVGData: function _readSVGData(svgString) {
    var parser = new DOMParser();
    var serializer = new XMLSerializer();

    var doc = parser.parseFromString(svgString, 'application/xml');
    var container = doc.documentElement;

    if (container.querySelector('parsererror') !== null) {
      return this.onError(new Error('SVG parse error'));
    }

    this._initialWidth = container.getAttribute('width');
    this._initialHeight = container.getAttribute('height');

    this._bbox = L.DomUtil.getSVGBBox(container);

    // fix width cause otherwise rasterzation will break
    var width = this._bbox[2] - this._bbox[0];
    var height = this._bbox[3] - this._bbox[1];

    if (this._initialWidth !== null && parseFloat(this._initialWidth) !== width || this._initialHeight !== null && parseFloat(this._initialHeight) !== height) {
      container.setAttribute('width', width);
      container.setAttribute('height', height);
    }

    this._rawData = svgString;
    this._processedData = serializer.serializeToString(doc);

    if (container.getAttribute('viewBox') === null) {
      container.setAttribute('viewBox', this._bbox.join(' '));
      this._processedData = this._processedData.replace('<svg', '<svg viewBox="' + this._bbox.join(' ') + '"');
    }

    return container;
  },


  /**
   * @param  {Error} err
   * @return {Schematic}
   */
  onError: function onError(err) {
    if (this.options.onError) {
      this.options.onError.call(this, { error: err });
    }
    return this.fire('error', { error: err });
  },


  /**
   * SVG is ready
   * @param  {String} svg markup
   */
  onLoad: function onLoad(svg) {
    if (!this._map) {
      return;
    }

    svg = this._readSVGData(svg);
    var bbox = this._bbox;
    var size = this.getOriginalSize();
    var mapSize = this._map.getSize();

    if (this.options.adjustToScreen && size.y !== mapSize.y) {
      this._ratio = Math.min(mapSize.x / size.x, mapSize.y / size.y);
      this.options._zoomOffset = this._ratio < 1 ? this._ratio : 1 - this._ratio;
      // dismiss that offset
      this.options.zoomOffset = 0;
      if (this._ratio === 0) {
        this._ratio = 1;
      } // disallow 0 in any case
    }

    var minZoom = this._map.getMinZoom() - this.options.zoomOffset;
    // calculate the edges of the image, in coordinate space
    this._bounds = new L.LatLngBounds(this._map.unproject([bbox[0], bbox[3]], minZoom), this._map.unproject([bbox[2], bbox[1]], minZoom)).scale(this._ratio);

    this._size = size;
    this._origin = this._map.project(this._bounds.getCenter(), minZoom);
    this._transformation = new L.Transformation(1, this._origin.x, 1, this._origin.y);
    this._viewBoxOffset = L.point(this._bbox[0], this._bbox[1]);

    this._createContents(svg);
    this._renderer._container.insertBefore(this._group, this._renderer._container.firstChild);

    this.fire('load');
    this._ready = true;

    this._latlngs = this._boundsToLatLngs(this._bounds);
    this._reset();

    if (this.options.useRaster) {
      L.Util.requestAnimFrame(this.toImage, this);
    }
  },


  /**
   * @param  {Function} callback
   * @param  {*=}       context
   * @return {Overlay}
   */
  whenReady: function whenReady(callback, context) {
    if (this._ready) {
      callback.call(context);
    } else {
      this.once('load', callback, context);
    }
    return this;
  },


  /**
   * @return {SVGElement}
   */
  getDocument: function getDocument() {
    return this._group;
  },


  /**
   * @return {L.SchematicRenderer}
   */
  getRenderer: function getRenderer() {
    return this._renderer;
  },


  /**
   * @param  {SVGElement} svg
   */
  _createContents: function _createContents(svg) {
    L.SVG.copySVGContents(svg, this._group);
  },


  /**
   * @return {L.Point}
   */
  getOriginalSize: function getOriginalSize() {
    var bbox = this._bbox;
    return new L.Point(Math.abs(bbox[0] - bbox[2]), Math.abs(bbox[1] - bbox[3]));
  },


  /**
   * Position our "rectangle"
   */
  _updatePath: function _updatePath() {
    L.Rectangle.prototype._updatePath.call(this);

    if (this._group) {
      var topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
      // scale is scale factor, zoom is zoom level
      var scale = this._map.options.crs.scale(this._map.getZoom() - this.options.zoomOffset) * this._ratio;

      //topLeft = topLeft.subtract(this._viewBoxOffset.multiplyBy(scale));

      // compensate viewbox dismissal with a shift here
      this._group.setAttribute('transform', L.DomUtil.getMatrixString(topLeft.subtract(this._viewBoxOffset.multiplyBy(scale)), scale));

      if (this._canvasRenderer) {
        this._redrawCanvas(topLeft, scale);
      }
    }
  },


  /**
   * Scales projected point FROM viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _unscalePoint: function _unscalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).divideBy(this._ratio));
  },


  /**
   * Scales projected point TO viewportized schematic ratio
   * @param  {L.Point} pt
   * @return {L.Point}
   */
  _scalePoint: function _scalePoint(pt) {
    return this._transformation.transform(this._transformation.untransform(pt).multiplyBy(this._ratio));
  },


  /**
   * @return {Number}
   */
  getRatio: function getRatio() {
    return this._ratio;
  },


  /**
   * Transform map coord to schematic point
   * @param  {L.LatLng} coord
   * @return {L.Point}
   */
  projectPoint: function projectPoint(coord) {
    var map = this._map;
    return this._unscalePoint(map.project(coord, map.getMinZoom() + this.options.zoomOffset));
  },


  /**
   * @param  {L.Point} pt
   * @return {L.LatLng}
   */
  unprojectPoint: function unprojectPoint(pt) {
    var map = this._map;
    return map.unproject(this._scalePoint(pt), map.getMinZoom() + this.options.zoomOffset);
  },


  /**
   * @param  {L.Bounds} bounds
   * @return {L.LatLngBounds}
   */
  unprojectBounds: function unprojectBounds(bounds) {
    var sw = this.unprojectPoint(bounds.min);
    var ne = this.unprojectPoint(bounds.max);
    return L.latLngBounds(sw, ne);
  },


  /**
   * Transform layerBounds to schematic bbox
   * @param  {L.LatLngBounds} bounds
   * @return {L.Bounds}
   */
  projectBounds: function projectBounds(bounds) {
    return new L.Bounds(this.projectPoint(bounds.getSouthWest()), this.projectPoint(bounds.getNorthEast()));
  },


  /**
   * @param  {Boolean=} string
   * @param  {Boolean=} overlaysOnly
   * @return {SVGElement|String}
   */
  exportSVG: function exportSVG(string, overlaysOnly) {
    var node = this._renderer.exportSVG(overlaysOnly);
    if (string) {
      // outerHTML not supported in IE on SVGElement
      var wrapper = L.DomUtil.create('div');
      wrapper.appendChild(node);
      return wrapper.innerHTML;
    }
    return node;
  },


  /**
  * Rasterizes the schematic
  * @return {Schematic}
  */
  toImage: function toImage() {
    var _this = this;

    var img = new Image();

    // this doesn't work in IE, force size
    // img.style.height = img.style.width = '100%';
    img.style.width = this._size.x + 'px';
    img.style.height = this._size.y + 'px';
    img.src = this.toBase64();

    // hack to trick IE rendering engine
    L.DomEvent.on(img, 'load', function () {
      L.point(img.offsetWidth, img.offsetHeight);
      _this._reset();
    });
    img.style.opacity = 0;
    img.style.zIndex = -9999;
    img.style.pointerEvents = 'none';

    if (this._raster) {
      this._raster.parentNode.removeChild(this._raster);
      this._raster = null;
    }

    L.DomUtil.addClass(img, 'schematic-image');
    this._renderer._container.parentNode.insertBefore(img, this._renderer._container);
    this._raster = img;
    return this;
  },


  /**
   * Convert SVG data to base64 for rasterization
   * @return {String} base64 encoded SVG
   */
  toBase64: function toBase64() {
    // console.time('base64');
    var base64 = this._base64encoded || b64.btoa(unescape(encodeURIComponent(this._processedData)));
    this._base64encoded = base64;
    // console.timeEnd('base64');

    return 'data:image/svg+xml;base64,' + base64;
  },


  /**
   * Redraw canvas on real changes: zoom, viewreset
   * @param  {L.Point} topLeft
   * @param  {Number}  scale
   */
  _redrawCanvas: function _redrawCanvas(topLeft, scale) {
    if (!this._raster) {
      return;
    }

    var size = this.getOriginalSize().multiplyBy(scale);
    var ctx = this._canvasRenderer._ctx;

    L.Util.requestAnimFrame(function () {
      ctx.drawImage(this._raster, topLeft.x, topLeft.y, size.x, size.y);
    }, this);
  },


  /**
   * Toggle canvas instead of SVG when dragging
   */
  _showRaster: function _showRaster() {
    if (this._canvasRenderer && !this._rasterShown) {
      // console.time('show');
      // `display` rule somehow appears to be faster in IE, FF
      // this._canvasRenderer._container.style.visibility = 'visible';
      this._canvasRenderer._container.style.display = 'block';
      this._group.style.display = 'none';
      this._rasterShown = true;
      // console.timeEnd('show');
    }
  },


  /**
   * Swap back to SVG
   */
  _hideRaster: function _hideRaster() {
    if (this._canvasRenderer && this._rasterShown) {
      // console.time('hide');
      // `display` rule somehow appears to be faster in IE, FF
      // this._canvasRenderer._container.style.visibility = 'hidden';
      this._canvasRenderer._container.style.display = 'none';
      this._group.style.display = 'block';
      this._rasterShown = false;
      // console.timeEnd('hide');
    }
  },


  /**
   * IE-only
   * Replace SVG with canvas before drag
   */
  _onPreDrag: function _onPreDrag() {
    if (this.options.useRaster) {
      this._showRaster();
    }
  },


  /**
   * Drag end: put SVG back in IE
   */
  _onDragEnd: function _onDragEnd() {
    if (this.options.useRaster) {
      this._hideRaster();
    }
  }
});

// aliases
L.Schematic.prototype.project = L.Schematic.prototype.projectPoint;
L.Schematic.prototype.unproject = L.Schematic.prototype.unprojectPoint;

/**
 * Factory
 * @param  {String}         svg     SVG string or URL
 * @param  {L.LatLngBounds} bounds
 * @param  {Object=}        options
 * @return {L.Schematic}
 */
L.schematic = function (svg, bounds, options) {
  return new L.Schematic(svg, bounds, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./bounds":10,"./renderer":11,"./utils":13,"Base64":3}],13:[function(require,module,exports){
(function (global){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

L.Browser.phantomjs = navigator.userAgent.toLowerCase().indexOf('phantom');

// <use> tags are broken in IE in so many ways
if ('SVGElementInstance' in window) {
  Object.defineProperty(SVGElementInstance.prototype, 'className', {
    get: function get() {
      return this.correspondingElement.className.baseVal;
    },
    set: function set(val) {
      this.correspondingElement.className.baseVal = val;
    }
  });
}

/**
 * @param  {*}  o
 * @return {Boolean}
 */
L.DomUtil.isNode = function (o) {
  return (typeof Node === "undefined" ? "undefined" : _typeof(Node)) === 'object' ? o instanceof Node : o && (typeof o === "undefined" ? "undefined" : _typeof(o)) === 'object' && typeof o.nodeType === 'number' && typeof o.nodeName === 'string';
};

/**
 * @param  {SVGElement} svg
 * @return {Array.<Number>}
 */
L.DomUtil.getSVGBBox = function (svg) {
  var svgBBox = void 0;
  var width = parseInt(svg.getAttribute('width'), 10);
  var height = parseInt(svg.getAttribute('height'), 10);
  var viewBox = svg.getAttribute('viewBox');
  var bbox = void 0;

  if (viewBox) {
    bbox = viewBox.split(' ').map(parseFloat);
    svgBBox = [bbox[0], bbox[1], bbox[0] + bbox[2], bbox[1] + bbox[3]];
  } else if (width && height) {
    svgBBox = [0, 0, width, height];
  } else {
    //Calculate rendered size
    var clone = svg.cloneNode(true);
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
  var bbox = [Infinity, Infinity, -Infinity, -Infinity];
  var nodes = [].slice.call(svg.querySelectorAll('*'));
  var _Math$max = Math.max,
      min = _Math$max.min,
      max = _Math$max.max;


  for (var i = 0, len = nodes.length; i < len; i++) {
    var node = nodes[i];
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
L.DomUtil.getSVGContainer = function (str) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = str;
  return wrapper.querySelector('svg');
};

/**
 * @param  {L.Point} translate
 * @param  {Number}  scale
 * @return {String}
 */
L.DomUtil.getMatrixString = function (translate, scale) {
  return 'matrix(' + [scale, 0, 0, scale, translate.x, translate.y].join(',') + ')';
};

/**
 * @param  {SVGElement}         svg
 * @param  {SVGElement|Element} container
 */
L.SVG.copySVGContents = function (svg, container) {
  // SVG innerHTML doesn't work for SVG in IE and PhantomJS
  if (L.Browser.ie || L.Browser.phantomjs) {
    var child = svg.firstChild;
    do {
      container.appendChild(child);
      child = svg.firstChild;
    } while (child);
  } else {
    container.innerHTML = svg.innerHTML;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2pzL2VkaXRhYmxlLmpzIiwiZGVtby9qcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9CYXNlNjQvYmFzZTY0LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItZmlsZXNhdmVyL0ZpbGVTYXZlci5qcyIsIm5vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwibm9kZV9tb2R1bGVzL2lzLWZ1bmN0aW9uL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BhcnNlLWhlYWRlcnMvcGFyc2UtaGVhZGVycy5qcyIsIm5vZGVfbW9kdWxlcy94aHIvaW5kZXguanMiLCJub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwic3JjL2JvdW5kcy5qcyIsInNyYy9yZW5kZXJlci5qcyIsInNyYy9zY2hlbWF0aWMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUNBQSxJQUFJLElBQUssT0FBTyxNQUFQLEtBQWtCLFdBQWxCLEdBQWdDLE9BQU8sR0FBUCxDQUFoQyxHQUE4QyxPQUFPLE1BQVAsS0FBa0IsV0FBbEIsR0FBZ0MsT0FBTyxHQUFQLENBQWhDLEdBQThDLElBQXJHOztBQUVBLEVBQUUsV0FBRixHQUFnQixFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCOztBQUUvQixXQUFTO0FBQ1AsY0FBVSxTQURIO0FBRVAsY0FBVSxJQUZIO0FBR1AsY0FBVSxJQUhIO0FBSVAsVUFBTSxFQUpDO0FBS1AsVUFBTTtBQUxDLEdBRnNCOztBQVUvQixTQUFPLGVBQVUsR0FBVixFQUFlO0FBQ3BCLFFBQUksWUFBWSxFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCLEtBQWpCLEVBQXdCLDZCQUF4QixDQUFoQjtBQUFBLFFBQ0UsT0FBTyxFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCLEdBQWpCLEVBQXNCLEVBQXRCLEVBQTBCLFNBQTFCLENBRFQ7QUFFQSxRQUFJ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RixFQUlFLElBQUksYUFBSixDQUFrQixNQUpwQjtBQU1EO0FBQ0Y7Ozs7O0FDckdEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25CQSxJQUFNLElBQUssT0FBTyxNQUFQLEtBQWtCLFdBQWxCLEdBQWdDLE9BQU8sR0FBUCxDQUFoQyxHQUE4QyxPQUFPLE1BQVAsS0FB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RUFBRSxPQUFGLENBQVUsZUFBVixHQUE0QixVQUFDLFNBQUQsRUFBWSxLQUFaLEVBQXNCO0FBQ2hELFNBQU8sWUFDTCxDQUFDLEtBQUQsRUFBUSxDQUFSLEVBQVcsQ0FBWCxFQUFjLEtBQWQsRUFBcUIsVUFBVSxDQUEvQixFQUFrQyxVQUFVLENBQTVDLEVBQStDLElBQS9DLENBQW9ELEdBQXBELENBREssR0FDc0QsR0FEN0Q7QUFFRCxDQUhEOztBQU1BOzs7O0FBSUEsRUFBRSxHQUFGLENBQU0sZUFBTixHQUF3QixVQUFDLEdBQUQsRUFBTSxTQUFOLEVBQW9CO0FBQzFDO0FBQ0EsTUFBSSxFQUFFLE9BQUYsQ0FBVSxFQUFWLElBQWdCLEVBQUUsT0FBRixDQUFVLFNBQTlCLEVBQXlDO0FBQ3ZDLFFBQUksUUFBUSxJQUFJLFVBQWhCO0FBQ0EsT0FBRztBQUNELGdCQUFVLFdBQVYsQ0FBc0IsS0FBdEI7QUFDQSxjQUFRLElBQUksVUFBWjtBQUNELEtBSEQsUUFHUyxLQUhUO0FBSUQsR0FORCxNQU1PO0FBQ0wsY0FBVSxTQUFWLEdBQXNCLElBQUksU0FBMUI7QUFDRDtBQUNGLENBWEQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgTCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydMJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydMJ10gOiBudWxsKTtcblxuTC5FZGl0Q29udHJvbCA9IEwuQ29udHJvbC5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwb3NpdGlvbjogJ3RvcGxlZnQnLFxuICAgIGNhbGxiYWNrOiBudWxsLFxuICAgIHJlbmRlcmVyOiBudWxsLFxuICAgIGtpbmQ6ICcnLFxuICAgIGh0bWw6ICcnXG4gIH0sXG5cbiAgb25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcbiAgICB2YXIgY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgJ2xlYWZsZXQtY29udHJvbCBsZWFmbGV0LWJhcicpLFxuICAgICAgbGluayA9IEwuRG9tVXRpbC5jcmVhdGUoJ2EnLCAnJywgY29udGFpbmVyKTtcbiAgICB2YXIgZWRpdFRvb2xzID0gbWFwLmVkaXRUb29scztcblxuICAgIGxpbmsuaHJlZiA9ICcjJztcbiAgICBsaW5rLnRpdGxlID0gJ0NyZWF0ZSBhIG5ldyAnICsgdGhpcy5vcHRpb25zLmtpbmQ7XG4gICAgbGluay5pbm5lckhUTUwgPSB0aGlzLm9wdGlvbnMuaHRtbDtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAub24obGluaywgJ2NsaWNrJywgTC5Eb21FdmVudC5zdG9wKVxuICAgICAgLm9uKGxpbmssICdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coZWRpdFRvb2xzKTtcbiAgICAgICAgd2luZG93LkxBWUVSID0gZWRpdFRvb2xzW3RoaXMub3B0aW9ucy5jYWxsYmFja10uY2FsbChlZGl0VG9vbHMsIG51bGwsIHtcbiAgICAgICAgICByZW5kZXJlcjogdGhpcy5vcHRpb25zLnJlbmRlcmVyXG4gICAgICAgIH0pO1xuICAgICAgfSwgdGhpcyk7XG5cbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9XG5cbn0pO1xuXG5cbkwuTmV3TGluZUNvbnRyb2wgPSBMLkVkaXRDb250cm9sLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBwb3NpdGlvbjogJ3RvcGxlZnQnLFxuICAgIGNhbGxiYWNrOiAnc3RhcnRQb2x5bGluZScsXG4gICAga2luZDogJ2xpbmUnLFxuICAgIGh0bWw6ICdcXFxcL1xcXFwnXG4gIH1cbn0pO1xuXG5cbkwuTmV3UG9seWdvbkNvbnRyb2wgPSBMLkVkaXRDb250cm9sLmV4dGVuZCh7XG4gIG9wdGlvbnM6IHtcbiAgICBwb3NpdGlvbjogJ3RvcGxlZnQnLFxuICAgIGNhbGxiYWNrOiAnc3RhcnRQb2x5Z29uJyxcbiAgICBraW5kOiAncG9seWdvbicsXG4gICAgaHRtbDogJ+KWsCdcbiAgfVxufSk7XG5cbkwuTmV3TWFya2VyQ29udHJvbCA9IEwuRWRpdENvbnRyb2wuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIHBvc2l0aW9uOiAndG9wbGVmdCcsXG4gICAgY2FsbGJhY2s6ICdzdGFydE1hcmtlcicsXG4gICAga2luZDogJ21hcmtlcicsXG4gICAgaHRtbDogJ/CflognXG4gIH1cblxufSk7XG5cbkwuTmV3UmVjdGFuZ2xlQ29udHJvbCA9IEwuRWRpdENvbnRyb2wuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIHBvc2l0aW9uOiAndG9wbGVmdCcsXG4gICAgY2FsbGJhY2s6ICdzdGFydFJlY3RhbmdsZScsXG4gICAga2luZDogJ3JlY3RhbmdsZScsXG4gICAgaHRtbDogJ+KsmydcbiAgfVxufSk7XG5cbkwuTmV3Q2lyY2xlQ29udHJvbCA9IEwuRWRpdENvbnRyb2wuZXh0ZW5kKHtcbiAgb3B0aW9uczoge1xuICAgIHBvc2l0aW9uOiAndG9wbGVmdCcsXG4gICAgY2FsbGJhY2s6ICdzdGFydENpcmNsZScsXG4gICAga2luZDogJ2NpcmNsZScsXG4gICAgaHRtbDogJ+KspCdcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBNYXJrZXI6IEwuTmV3TWFya2VyQ29udHJvbCxcbiAgTGluZTogTC5OZXdMaW5lQ29udHJvbCxcbiAgUG9seWdvbjogTC5OZXdQb2x5Z29uQ29udHJvbCxcbiAgUmVjdGFuZ2xlOiBMLk5ld1JlY3RhbmdsZUNvbnRyb2wsXG4gIENpcmNsZTogTC5OZXdDaXJjbGVDb250cm9sXG59O1xuIiwidmFyIFN2Z092ZXJsYXkgPSByZXF1aXJlKCcuLi8uLi9zcmMvc2NoZW1hdGljJyk7XG52YXIgeGhyID0gcmVxdWlyZSgneGhyJyk7XG52YXIgc2F2ZUFzID0gcmVxdWlyZSgnYnJvd3Nlci1maWxlc2F2ZXInKS5zYXZlQXM7XG52YXIgRHJhdyA9IHJlcXVpcmUoJy4vZWRpdGFibGUnKTtcblxuLy9nbG9iYWwuU3ZnTGF5ZXIgPSByZXF1aXJlKCcuLi8uLi9zcmMvc3ZnbGF5ZXInKTtcblxuLy8gY3JlYXRlIHRoZSBzbGlwcHkgbWFwXG52YXIgbWFwID0gd2luZG93Lm1hcCA9IEwubWFwKCdpbWFnZS1tYXAnLCB7XG4gIG1pblpvb206IDAsXG4gIG1heFpvb206IDIwLFxuICBjZW50ZXI6IFswLCAwXSxcbiAgem9vbTogMSxcbiAgZWRpdGFibGU6IHRydWUsXG4gIGNyczogTC5VdGlsLmV4dGVuZCh7fSwgTC5DUlMuU2ltcGxlLCB7XG4gICAgaW5maW5pdGU6IGZhbHNlXG4gIH0pLFxuICBpbmVydGlhOiAhTC5Ccm93c2VyLmllXG59KTtcblxudmFyIGNvbnRyb2xzID0gZ2xvYmFsLmNvbnRyb2xzID0gW1xuICBuZXcgRHJhdy5MaW5lKCksXG4gIG5ldyBEcmF3LlBvbHlnb24oKSxcbiAgbmV3IERyYXcuUmVjdGFuZ2xlKClcbl07XG5jb250cm9scy5mb3JFYWNoKG1hcC5hZGRDb250cm9sLCBtYXApO1xuXG5MLlNWRy5wcm90b3R5cGUub3B0aW9ucy5wYWRkaW5nID0gMC41O1xuXG52YXIgc3ZnID0gZ2xvYmFsLnN2ZyA9IG51bGw7XG5cbm1hcC5vbignY2xpY2snLCBmdW5jdGlvbiAoZXZ0KSB7XG4gIGNvbnNvbGUubG9nKCdtYXAnLCBldnQub3JpZ2luYWxFdmVudC50YXJnZXQsXG4gICAgZXZ0LmxhdGxuZywgZXZ0LCBtYXAuaGFzTGF5ZXIoc3ZnKSA/IHN2Zy5wcm9qZWN0UG9pbnQoZXZ0LmxhdGxuZykgOiBldnQpO1xufSk7XG5cbnZhciBzZWxlY3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc2VsZWN0LXNjaGVtYXRpYycpO1xuZnVuY3Rpb24gb25TZWxlY3QoKSB7XG4gIGlmIChzdmcpIHtcbiAgICBtYXAucmVtb3ZlTGF5ZXIoc3ZnKTtcbiAgICBtYXAub2ZmKCdtb3VzZW1vdmUnLCB0cmFja1Bvc2l0aW9uLCBtYXApO1xuICB9XG5cbiAgc3ZnID0gZ2xvYmFsLnN2ZyA9IG5ldyBTdmdPdmVybGF5KHRoaXMudmFsdWUsIHtcbiAgICB1c2VQYXRoQ29udGFpbmVyOiB0cnVlLFxuICAgIC8vb3BhY2l0eTogMSxcbiAgICB3ZWlnaHQ6IDAuMjUsXG4gICAgLy91c2VSYXN0ZXI6IHRydWUsXG4gICAgbG9hZDogZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcblxuICAgICAgaWYgKCdwZW5kaW5nJyA9PT0gdXJsKSB7XG4gICAgICAgIGFsZXJ0KCdUZXN0IG5ldHdvcmsgcGVuZGluZywgbm8gZGF0YSB3aWxsIGJlIHNob3duLiBTd2l0Y2ggdG8gYW5vdGhlciBzdmcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB4aHIoe1xuICAgICAgICB1cmk6IHVybCxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnaW1hZ2Uvc3ZnK3htbCdcbiAgICAgICAgfVxuICAgICAgfSwgZnVuY3Rpb24gKGVyciwgcmVzcCwgc3ZnKSB7XG4gICAgICAgIGlmICgyMDAgIT09IHJlc3Auc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGVyciA9IHJlc3Auc3RhdHVzQ29kZTtcbiAgICAgICAgICBhbGVydCgnTmV0d29yayBlcnJvcicsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2soZXJyLCBzdmcpO1xuICAgICAgfSk7XG4gICAgfVxuICB9KVxuICAgIC5vbmNlKCdsb2FkJywgZnVuY3Rpb24gKCkge1xuXG4gICAgICAvLyB1c2Ugc2NoZW1hdGljIHJlbmRlcmVyXG4gICAgICBjb250cm9scy5mb3JFYWNoKGZ1bmN0aW9uIChjb250cm9sKSB7XG4gICAgICAgIGNvbnRyb2wub3B0aW9ucy5yZW5kZXJlciA9IHN2Zy5fcmVuZGVyZXI7XG4gICAgICB9KTtcblxuICAgICAgbWFwLmZpdEJvdW5kcyhzdmcuZ2V0Qm91bmRzKCksIHsgYW5pbWF0ZTogZmFsc2UgfSk7XG4gICAgICBtYXAub24oJ21vdXNlbW92ZScsIHRyYWNrUG9zaXRpb24sIG1hcCk7XG5cbiAgICB9KS5hZGRUbyhtYXApO1xufVxuXG5MLkRvbUV2ZW50Lm9uKHNlbGVjdCwgJ2NoYW5nZScsIG9uU2VsZWN0KTtcblxub25TZWxlY3QuY2FsbChzZWxlY3QpO1xuXG5cbkwuRG9tRXZlbnQub24oZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2RsJyksICdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgc2F2ZUFzKG5ldyBCbG9iKFtzdmcuZXhwb3J0U1ZHKHRydWUpXSksICdzY2hlbWF0aWMuc3ZnJyk7XG59KTtcblxuXG5mdW5jdGlvbiB0cmFja1Bvc2l0aW9uKGV2dCkge1xuICBpZiAoZXZ0Lm9yaWdpbmFsRXZlbnQuc2hpZnRLZXkpIHtcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgIGV2dC5sYXRsbmcsXG4gICAgICBzdmcucHJvamVjdFBvaW50KGV2dC5sYXRsbmcpLnRvU3RyaW5nKCksXG4gICAgICBzdmcudW5wcm9qZWN0UG9pbnQoc3ZnLnByb2plY3RQb2ludChldnQubGF0bG5nKSksXG4gICAgICBldnQub3JpZ2luYWxFdmVudC50YXJnZXRcbiAgICApO1xuICB9XG59XG4iLCIoZnVuY3Rpb24oZikge1xuXG4gICd1c2Ugc3RyaWN0JztcblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIGV4cG9ydHMgIT0gbnVsbCAmJlxuICAgICAgdHlwZW9mIGV4cG9ydHMubm9kZVR5cGUgIT09ICdudW1iZXInKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmICgpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCAhPSBudWxsKSB7XG4gICAgZGVmaW5lIChbXSwgZik7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJhc2U2NCA9IGYgKCk7XG4gICAgdmFyIGdsb2JhbCA9IHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiAkLmdsb2JhbDtcbiAgICBpZiAodHlwZW9mIGdsb2JhbC5idG9hICE9PSAnZnVuY3Rpb24nKSBnbG9iYWwuYnRvYSA9IGJhc2U2NC5idG9hO1xuICAgIGlmICh0eXBlb2YgZ2xvYmFsLmF0b2IgIT09ICdmdW5jdGlvbicpIGdsb2JhbC5hdG9iID0gYmFzZTY0LmF0b2I7XG4gIH1cblxufSAoZnVuY3Rpb24oKSB7XG5cbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciBjaGFycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XG5cbiAgZnVuY3Rpb24gSW52YWxpZENoYXJhY3RlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICB9XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUgPSBuZXcgRXJyb3IgKCk7XG4gIEludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUubmFtZSA9ICdJbnZhbGlkQ2hhcmFjdGVyRXJyb3InO1xuXG4gIC8vIGVuY29kZXJcbiAgLy8gW2h0dHBzOi8vZ2lzdC5naXRodWIuY29tLzk5OTE2Nl0gYnkgW2h0dHBzOi8vZ2l0aHViLmNvbS9uaWduYWddXG4gIGZ1bmN0aW9uIGJ0b2EoaW5wdXQpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nIChpbnB1dCk7XG4gICAgZm9yIChcbiAgICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgICB2YXIgYmxvY2ssIGNoYXJDb2RlLCBpZHggPSAwLCBtYXAgPSBjaGFycywgb3V0cHV0ID0gJyc7XG4gICAgICAvLyBpZiB0aGUgbmV4dCBzdHIgaW5kZXggZG9lcyBub3QgZXhpc3Q6XG4gICAgICAvLyAgIGNoYW5nZSB0aGUgbWFwcGluZyB0YWJsZSB0byBcIj1cIlxuICAgICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgICAgc3RyLmNoYXJBdCAoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgICAvLyBcIjggLSBpZHggJSAxICogOFwiIGdlbmVyYXRlcyB0aGUgc2VxdWVuY2UgMiwgNCwgNiwgOFxuICAgICAgb3V0cHV0ICs9IG1hcC5jaGFyQXQgKDYzICYgYmxvY2sgPj4gOCAtIGlkeCAlIDEgKiA4KVxuICAgICkge1xuICAgICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdCAoaWR4ICs9IDMgLyA0KTtcbiAgICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRDaGFyYWN0ZXJFcnJvciAoXCInYnRvYScgZmFpbGVkOiBUaGUgc3RyaW5nIHRvIGJlIGVuY29kZWQgY29udGFpbnMgY2hhcmFjdGVycyBvdXRzaWRlIG9mIHRoZSBMYXRpbjEgcmFuZ2UuXCIpO1xuICAgICAgfVxuICAgICAgYmxvY2sgPSBibG9jayA8PCA4IHwgY2hhckNvZGU7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cblxuICAvLyBkZWNvZGVyXG4gIC8vIFtodHRwczovL2dpc3QuZ2l0aHViLmNvbS8xMDIwMzk2XSBieSBbaHR0cHM6Ly9naXRodWIuY29tL2F0a11cbiAgZnVuY3Rpb24gYXRvYihpbnB1dCkge1xuICAgIHZhciBzdHIgPSAoU3RyaW5nIChpbnB1dCkpLnJlcGxhY2UgKC9bPV0rJC8sICcnKTsgLy8gIzMxOiBFeHRlbmRTY3JpcHQgYmFkIHBhcnNlIG9mIC89XG4gICAgaWYgKHN0ci5sZW5ndGggJSA0ID09PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZENoYXJhY3RlckVycm9yIChcIidhdG9iJyBmYWlsZWQ6IFRoZSBzdHJpbmcgdG8gYmUgZGVjb2RlZCBpcyBub3QgY29ycmVjdGx5IGVuY29kZWQuXCIpO1xuICAgIH1cbiAgICBmb3IgKFxuICAgICAgLy8gaW5pdGlhbGl6ZSByZXN1bHQgYW5kIGNvdW50ZXJzXG4gICAgICB2YXIgYmMgPSAwLCBicywgYnVmZmVyLCBpZHggPSAwLCBvdXRwdXQgPSAnJztcbiAgICAgIC8vIGdldCBuZXh0IGNoYXJhY3RlclxuICAgICAgYnVmZmVyID0gc3RyLmNoYXJBdCAoaWR4KyspOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWNvbmQtYXNzaWduXG4gICAgICAvLyBjaGFyYWN0ZXIgZm91bmQgaW4gdGFibGU/IGluaXRpYWxpemUgYml0IHN0b3JhZ2UgYW5kIGFkZCBpdHMgYXNjaWkgdmFsdWU7XG4gICAgICB+YnVmZmVyICYmIChicyA9IGJjICUgNCA/IGJzICogNjQgKyBidWZmZXIgOiBidWZmZXIsXG4gICAgICAgIC8vIGFuZCBpZiBub3QgZmlyc3Qgb2YgZWFjaCA0IGNoYXJhY3RlcnMsXG4gICAgICAgIC8vIGNvbnZlcnQgdGhlIGZpcnN0IDggYml0cyB0byBvbmUgYXNjaWkgY2hhcmFjdGVyXG4gICAgICAgIGJjKysgJSA0KSA/IG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlICgyNTUgJiBicyA+PiAoLTIgKiBiYyAmIDYpKSA6IDBcbiAgICApIHtcbiAgICAgIC8vIHRyeSB0byBmaW5kIGNoYXJhY3RlciBpbiB0YWJsZSAoMC02Mywgbm90IGZvdW5kID0+IC0xKVxuICAgICAgYnVmZmVyID0gY2hhcnMuaW5kZXhPZiAoYnVmZmVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuXG4gIHJldHVybiB7YnRvYTogYnRvYSwgYXRvYjogYXRvYn07XG5cbn0pKTtcbiIsIi8qIEZpbGVTYXZlci5qc1xuICogQSBzYXZlQXMoKSBGaWxlU2F2ZXIgaW1wbGVtZW50YXRpb24uXG4gKiAxLjEuMjAxNjAzMjhcbiAqXG4gKiBCeSBFbGkgR3JleSwgaHR0cDovL2VsaWdyZXkuY29tXG4gKiBMaWNlbnNlOiBNSVRcbiAqICAgU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGlncmV5L0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9MSUNFTlNFLm1kXG4gKi9cblxuLypnbG9iYWwgc2VsZiAqL1xuLypqc2xpbnQgYml0d2lzZTogdHJ1ZSwgaW5kZW50OiA0LCBsYXhicmVhazogdHJ1ZSwgbGF4Y29tbWE6IHRydWUsIHNtYXJ0dGFiczogdHJ1ZSwgcGx1c3BsdXM6IHRydWUgKi9cblxuLyohIEBzb3VyY2UgaHR0cDovL3B1cmwuZWxpZ3JleS5jb20vZ2l0aHViL0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9GaWxlU2F2ZXIuanMgKi9cblxudmFyIHNhdmVBcyA9IHNhdmVBcyB8fCAoZnVuY3Rpb24odmlldykge1xuXHRcInVzZSBzdHJpY3RcIjtcblx0Ly8gSUUgPDEwIGlzIGV4cGxpY2l0bHkgdW5zdXBwb3J0ZWRcblx0aWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgL01TSUUgWzEtOV1cXC4vLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0dmFyXG5cdFx0ICBkb2MgPSB2aWV3LmRvY3VtZW50XG5cdFx0ICAvLyBvbmx5IGdldCBVUkwgd2hlbiBuZWNlc3NhcnkgaW4gY2FzZSBCbG9iLmpzIGhhc24ndCBvdmVycmlkZGVuIGl0IHlldFxuXHRcdCwgZ2V0X1VSTCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHZpZXcuVVJMIHx8IHZpZXcud2Via2l0VVJMIHx8IHZpZXc7XG5cdFx0fVxuXHRcdCwgc2F2ZV9saW5rID0gZG9jLmNyZWF0ZUVsZW1lbnROUyhcImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGh0bWxcIiwgXCJhXCIpXG5cdFx0LCBjYW5fdXNlX3NhdmVfbGluayA9IFwiZG93bmxvYWRcIiBpbiBzYXZlX2xpbmtcblx0XHQsIGNsaWNrID0gZnVuY3Rpb24obm9kZSkge1xuXHRcdFx0dmFyIGV2ZW50ID0gbmV3IE1vdXNlRXZlbnQoXCJjbGlja1wiKTtcblx0XHRcdG5vZGUuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cdFx0fVxuXHRcdCwgaXNfc2FmYXJpID0gL1ZlcnNpb25cXC9bXFxkXFwuXSsuKlNhZmFyaS8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KVxuXHRcdCwgd2Via2l0X3JlcV9mcyA9IHZpZXcud2Via2l0UmVxdWVzdEZpbGVTeXN0ZW1cblx0XHQsIHJlcV9mcyA9IHZpZXcucmVxdWVzdEZpbGVTeXN0ZW0gfHwgd2Via2l0X3JlcV9mcyB8fCB2aWV3Lm1velJlcXVlc3RGaWxlU3lzdGVtXG5cdFx0LCB0aHJvd19vdXRzaWRlID0gZnVuY3Rpb24oZXgpIHtcblx0XHRcdCh2aWV3LnNldEltbWVkaWF0ZSB8fCB2aWV3LnNldFRpbWVvdXQpKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR0aHJvdyBleDtcblx0XHRcdH0sIDApO1xuXHRcdH1cblx0XHQsIGZvcmNlX3NhdmVhYmxlX3R5cGUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiXG5cdFx0LCBmc19taW5fc2l6ZSA9IDBcblx0XHQvLyB0aGUgQmxvYiBBUEkgaXMgZnVuZGFtZW50YWxseSBicm9rZW4gYXMgdGhlcmUgaXMgbm8gXCJkb3dubG9hZGZpbmlzaGVkXCIgZXZlbnQgdG8gc3Vic2NyaWJlIHRvXG5cdFx0LCBhcmJpdHJhcnlfcmV2b2tlX3RpbWVvdXQgPSAxMDAwICogNDAgLy8gaW4gbXNcblx0XHQsIHJldm9rZSA9IGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdHZhciByZXZva2VyID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIikgeyAvLyBmaWxlIGlzIGFuIG9iamVjdCBVUkxcblx0XHRcdFx0XHRnZXRfVVJMKCkucmV2b2tlT2JqZWN0VVJMKGZpbGUpO1xuXHRcdFx0XHR9IGVsc2UgeyAvLyBmaWxlIGlzIGEgRmlsZVxuXHRcdFx0XHRcdGZpbGUucmVtb3ZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHQvKiAvLyBUYWtlIG5vdGUgVzNDOlxuXHRcdFx0dmFyXG5cdFx0XHQgIHVyaSA9IHR5cGVvZiBmaWxlID09PSBcInN0cmluZ1wiID8gZmlsZSA6IGZpbGUudG9VUkwoKVxuXHRcdFx0LCByZXZva2VyID0gZnVuY3Rpb24oZXZ0KSB7XG5cdFx0XHRcdC8vIGlkZWFseSBEb3dubG9hZEZpbmlzaGVkRXZlbnQuZGF0YSB3b3VsZCBiZSB0aGUgVVJMIHJlcXVlc3RlZFxuXHRcdFx0XHRpZiAoZXZ0LmRhdGEgPT09IHVyaSkge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgZmlsZSA9PT0gXCJzdHJpbmdcIikgeyAvLyBmaWxlIGlzIGFuIG9iamVjdCBVUkxcblx0XHRcdFx0XHRcdGdldF9VUkwoKS5yZXZva2VPYmplY3RVUkwoZmlsZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHsgLy8gZmlsZSBpcyBhIEZpbGVcblx0XHRcdFx0XHRcdGZpbGUucmVtb3ZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQ7XG5cdFx0XHR2aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJkb3dubG9hZGZpbmlzaGVkXCIsIHJldm9rZXIpO1xuXHRcdFx0Ki9cblx0XHRcdHNldFRpbWVvdXQocmV2b2tlciwgYXJiaXRyYXJ5X3Jldm9rZV90aW1lb3V0KTtcblx0XHR9XG5cdFx0LCBkaXNwYXRjaCA9IGZ1bmN0aW9uKGZpbGVzYXZlciwgZXZlbnRfdHlwZXMsIGV2ZW50KSB7XG5cdFx0XHRldmVudF90eXBlcyA9IFtdLmNvbmNhdChldmVudF90eXBlcyk7XG5cdFx0XHR2YXIgaSA9IGV2ZW50X3R5cGVzLmxlbmd0aDtcblx0XHRcdHdoaWxlIChpLS0pIHtcblx0XHRcdFx0dmFyIGxpc3RlbmVyID0gZmlsZXNhdmVyW1wib25cIiArIGV2ZW50X3R5cGVzW2ldXTtcblx0XHRcdFx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGxpc3RlbmVyLmNhbGwoZmlsZXNhdmVyLCBldmVudCB8fCBmaWxlc2F2ZXIpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRcdFx0XHR0aHJvd19vdXRzaWRlKGV4KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0LCBhdXRvX2JvbSA9IGZ1bmN0aW9uKGJsb2IpIHtcblx0XHRcdC8vIHByZXBlbmQgQk9NIGZvciBVVEYtOCBYTUwgYW5kIHRleHQvKiB0eXBlcyAoaW5jbHVkaW5nIEhUTUwpXG5cdFx0XHRpZiAoL15cXHMqKD86dGV4dFxcL1xcUyp8YXBwbGljYXRpb25cXC94bWx8XFxTKlxcL1xcUypcXCt4bWwpXFxzKjsuKmNoYXJzZXRcXHMqPVxccyp1dGYtOC9pLnRlc3QoYmxvYi50eXBlKSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEJsb2IoW1wiXFx1ZmVmZlwiLCBibG9iXSwge3R5cGU6IGJsb2IudHlwZX0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGJsb2I7XG5cdFx0fVxuXHRcdCwgRmlsZVNhdmVyID0gZnVuY3Rpb24oYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcblx0XHRcdGlmICghbm9fYXV0b19ib20pIHtcblx0XHRcdFx0YmxvYiA9IGF1dG9fYm9tKGJsb2IpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gRmlyc3QgdHJ5IGEuZG93bmxvYWQsIHRoZW4gd2ViIGZpbGVzeXN0ZW0sIHRoZW4gb2JqZWN0IFVSTHNcblx0XHRcdHZhclxuXHRcdFx0XHQgIGZpbGVzYXZlciA9IHRoaXNcblx0XHRcdFx0LCB0eXBlID0gYmxvYi50eXBlXG5cdFx0XHRcdCwgYmxvYl9jaGFuZ2VkID0gZmFsc2Vcblx0XHRcdFx0LCBvYmplY3RfdXJsXG5cdFx0XHRcdCwgdGFyZ2V0X3ZpZXdcblx0XHRcdFx0LCBkaXNwYXRjaF9hbGwgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRkaXNwYXRjaChmaWxlc2F2ZXIsIFwid3JpdGVzdGFydCBwcm9ncmVzcyB3cml0ZSB3cml0ZWVuZFwiLnNwbGl0KFwiIFwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gb24gYW55IGZpbGVzeXMgZXJyb3JzIHJldmVydCB0byBzYXZpbmcgd2l0aCBvYmplY3QgVVJMc1xuXHRcdFx0XHQsIGZzX2Vycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYgKHRhcmdldF92aWV3ICYmIGlzX3NhZmFyaSAmJiB0eXBlb2YgRmlsZVJlYWRlciAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdFx0XHRcdFx0Ly8gU2FmYXJpIGRvZXNuJ3QgYWxsb3cgZG93bmxvYWRpbmcgb2YgYmxvYiB1cmxzXG5cdFx0XHRcdFx0XHR2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblx0XHRcdFx0XHRcdHJlYWRlci5vbmxvYWRlbmQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0dmFyIGJhc2U2NERhdGEgPSByZWFkZXIucmVzdWx0O1xuXHRcdFx0XHRcdFx0XHR0YXJnZXRfdmlldy5sb2NhdGlvbi5ocmVmID0gXCJkYXRhOmF0dGFjaG1lbnQvZmlsZVwiICsgYmFzZTY0RGF0YS5zbGljZShiYXNlNjREYXRhLnNlYXJjaCgvWyw7XS8pKTtcblx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRcdFx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0cmVhZGVyLnJlYWRBc0RhdGFVUkwoYmxvYik7XG5cdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5JTklUO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBkb24ndCBjcmVhdGUgbW9yZSBvYmplY3QgVVJMcyB0aGFuIG5lZWRlZFxuXHRcdFx0XHRcdGlmIChibG9iX2NoYW5nZWQgfHwgIW9iamVjdF91cmwpIHtcblx0XHRcdFx0XHRcdG9iamVjdF91cmwgPSBnZXRfVVJMKCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGFyZ2V0X3ZpZXcpIHtcblx0XHRcdFx0XHRcdHRhcmdldF92aWV3LmxvY2F0aW9uLmhyZWYgPSBvYmplY3RfdXJsO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2YXIgbmV3X3RhYiA9IHZpZXcub3BlbihvYmplY3RfdXJsLCBcIl9ibGFua1wiKTtcblx0XHRcdFx0XHRcdGlmIChuZXdfdGFiID09PSB1bmRlZmluZWQgJiYgaXNfc2FmYXJpKSB7XG5cdFx0XHRcdFx0XHRcdC8vQXBwbGUgZG8gbm90IGFsbG93IHdpbmRvdy5vcGVuLCBzZWUgaHR0cDovL2JpdC5seS8xa1pmZlJJXG5cdFx0XHRcdFx0XHRcdHZpZXcubG9jYXRpb24uaHJlZiA9IG9iamVjdF91cmxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuRE9ORTtcblx0XHRcdFx0XHRkaXNwYXRjaF9hbGwoKTtcblx0XHRcdFx0XHRyZXZva2Uob2JqZWN0X3VybCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0LCBhYm9ydGFibGUgPSBmdW5jdGlvbihmdW5jKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0aWYgKGZpbGVzYXZlci5yZWFkeVN0YXRlICE9PSBmaWxlc2F2ZXIuRE9ORSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0LCBjcmVhdGVfaWZfbm90X2ZvdW5kID0ge2NyZWF0ZTogdHJ1ZSwgZXhjbHVzaXZlOiBmYWxzZX1cblx0XHRcdFx0LCBzbGljZVxuXHRcdFx0O1xuXHRcdFx0ZmlsZXNhdmVyLnJlYWR5U3RhdGUgPSBmaWxlc2F2ZXIuSU5JVDtcblx0XHRcdGlmICghbmFtZSkge1xuXHRcdFx0XHRuYW1lID0gXCJkb3dubG9hZFwiO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNhbl91c2Vfc2F2ZV9saW5rKSB7XG5cdFx0XHRcdG9iamVjdF91cmwgPSBnZXRfVVJMKCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXHRcdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHNhdmVfbGluay5ocmVmID0gb2JqZWN0X3VybDtcblx0XHRcdFx0XHRzYXZlX2xpbmsuZG93bmxvYWQgPSBuYW1lO1xuXHRcdFx0XHRcdGNsaWNrKHNhdmVfbGluayk7XG5cdFx0XHRcdFx0ZGlzcGF0Y2hfYWxsKCk7XG5cdFx0XHRcdFx0cmV2b2tlKG9iamVjdF91cmwpO1xuXHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBPYmplY3QgYW5kIHdlYiBmaWxlc3lzdGVtIFVSTHMgaGF2ZSBhIHByb2JsZW0gc2F2aW5nIGluIEdvb2dsZSBDaHJvbWUgd2hlblxuXHRcdFx0Ly8gdmlld2VkIGluIGEgdGFiLCBzbyBJIGZvcmNlIHNhdmUgd2l0aCBhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cblx0XHRcdC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTkxMTU4XG5cdFx0XHQvLyBVcGRhdGU6IEdvb2dsZSBlcnJhbnRseSBjbG9zZWQgOTExNTgsIEkgc3VibWl0dGVkIGl0IGFnYWluOlxuXHRcdFx0Ly8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTM4OTY0MlxuXHRcdFx0aWYgKHZpZXcuY2hyb21lICYmIHR5cGUgJiYgdHlwZSAhPT0gZm9yY2Vfc2F2ZWFibGVfdHlwZSkge1xuXHRcdFx0XHRzbGljZSA9IGJsb2Iuc2xpY2UgfHwgYmxvYi53ZWJraXRTbGljZTtcblx0XHRcdFx0YmxvYiA9IHNsaWNlLmNhbGwoYmxvYiwgMCwgYmxvYi5zaXplLCBmb3JjZV9zYXZlYWJsZV90eXBlKTtcblx0XHRcdFx0YmxvYl9jaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdC8vIFNpbmNlIEkgY2FuJ3QgYmUgc3VyZSB0aGF0IHRoZSBndWVzc2VkIG1lZGlhIHR5cGUgd2lsbCB0cmlnZ2VyIGEgZG93bmxvYWRcblx0XHRcdC8vIGluIFdlYktpdCwgSSBhcHBlbmQgLmRvd25sb2FkIHRvIHRoZSBmaWxlbmFtZS5cblx0XHRcdC8vIGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD02NTQ0MFxuXHRcdFx0aWYgKHdlYmtpdF9yZXFfZnMgJiYgbmFtZSAhPT0gXCJkb3dubG9hZFwiKSB7XG5cdFx0XHRcdG5hbWUgKz0gXCIuZG93bmxvYWRcIjtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlID09PSBmb3JjZV9zYXZlYWJsZV90eXBlIHx8IHdlYmtpdF9yZXFfZnMpIHtcblx0XHRcdFx0dGFyZ2V0X3ZpZXcgPSB2aWV3O1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZXFfZnMpIHtcblx0XHRcdFx0ZnNfZXJyb3IoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZnNfbWluX3NpemUgKz0gYmxvYi5zaXplO1xuXHRcdFx0cmVxX2ZzKHZpZXcuVEVNUE9SQVJZLCBmc19taW5fc2l6ZSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZzKSB7XG5cdFx0XHRcdGZzLnJvb3QuZ2V0RGlyZWN0b3J5KFwic2F2ZWRcIiwgY3JlYXRlX2lmX25vdF9mb3VuZCwgYWJvcnRhYmxlKGZ1bmN0aW9uKGRpcikge1xuXHRcdFx0XHRcdHZhciBzYXZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRkaXIuZ2V0RmlsZShuYW1lLCBjcmVhdGVfaWZfbm90X2ZvdW5kLCBhYm9ydGFibGUoZnVuY3Rpb24oZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRmaWxlLmNyZWF0ZVdyaXRlcihhYm9ydGFibGUoZnVuY3Rpb24od3JpdGVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLm9ud3JpdGVlbmQgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGFyZ2V0X3ZpZXcubG9jYXRpb24uaHJlZiA9IGZpbGUudG9VUkwoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNwYXRjaChmaWxlc2F2ZXIsIFwid3JpdGVlbmRcIiwgZXZlbnQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV2b2tlKGZpbGUpO1xuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBlcnJvciA9IHdyaXRlci5lcnJvcjtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChlcnJvci5jb2RlICE9PSBlcnJvci5BQk9SVF9FUlIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZnNfZXJyb3IoKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRcdFwid3JpdGVzdGFydCBwcm9ncmVzcyB3cml0ZSBhYm9ydFwiLnNwbGl0KFwiIFwiKS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR3cml0ZXJbXCJvblwiICsgZXZlbnRdID0gZmlsZXNhdmVyW1wib25cIiArIGV2ZW50XTtcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHR3cml0ZXIud3JpdGUoYmxvYik7XG5cdFx0XHRcdFx0XHRcdFx0ZmlsZXNhdmVyLmFib3J0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR3cml0ZXIuYWJvcnQoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5XUklUSU5HO1xuXHRcdFx0XHRcdFx0XHR9KSwgZnNfZXJyb3IpO1xuXHRcdFx0XHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGRpci5nZXRGaWxlKG5hbWUsIHtjcmVhdGU6IGZhbHNlfSwgYWJvcnRhYmxlKGZ1bmN0aW9uKGZpbGUpIHtcblx0XHRcdFx0XHRcdC8vIGRlbGV0ZSBmaWxlIGlmIGl0IGFscmVhZHkgZXhpc3RzXG5cdFx0XHRcdFx0XHRmaWxlLnJlbW92ZSgpO1xuXHRcdFx0XHRcdFx0c2F2ZSgpO1xuXHRcdFx0XHRcdH0pLCBhYm9ydGFibGUoZnVuY3Rpb24oZXgpIHtcblx0XHRcdFx0XHRcdGlmIChleC5jb2RlID09PSBleC5OT1RfRk9VTkRfRVJSKSB7XG5cdFx0XHRcdFx0XHRcdHNhdmUoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGZzX2Vycm9yKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KSwgZnNfZXJyb3IpO1xuXHRcdFx0fSksIGZzX2Vycm9yKTtcblx0XHR9XG5cdFx0LCBGU19wcm90byA9IEZpbGVTYXZlci5wcm90b3R5cGVcblx0XHQsIHNhdmVBcyA9IGZ1bmN0aW9uKGJsb2IsIG5hbWUsIG5vX2F1dG9fYm9tKSB7XG5cdFx0XHRyZXR1cm4gbmV3IEZpbGVTYXZlcihibG9iLCBuYW1lLCBub19hdXRvX2JvbSk7XG5cdFx0fVxuXHQ7XG5cdC8vIElFIDEwKyAobmF0aXZlIHNhdmVBcylcblx0aWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09IFwidW5kZWZpbmVkXCIgJiYgbmF2aWdhdG9yLm1zU2F2ZU9yT3BlbkJsb2IpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24oYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcblx0XHRcdGlmICghbm9fYXV0b19ib20pIHtcblx0XHRcdFx0YmxvYiA9IGF1dG9fYm9tKGJsb2IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKGJsb2IsIG5hbWUgfHwgXCJkb3dubG9hZFwiKTtcblx0XHR9O1xuXHR9XG5cblx0RlNfcHJvdG8uYWJvcnQgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgZmlsZXNhdmVyID0gdGhpcztcblx0XHRmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuXHRcdGRpc3BhdGNoKGZpbGVzYXZlciwgXCJhYm9ydFwiKTtcblx0fTtcblx0RlNfcHJvdG8ucmVhZHlTdGF0ZSA9IEZTX3Byb3RvLklOSVQgPSAwO1xuXHRGU19wcm90by5XUklUSU5HID0gMTtcblx0RlNfcHJvdG8uRE9ORSA9IDI7XG5cblx0RlNfcHJvdG8uZXJyb3IgPVxuXHRGU19wcm90by5vbndyaXRlc3RhcnQgPVxuXHRGU19wcm90by5vbnByb2dyZXNzID1cblx0RlNfcHJvdG8ub253cml0ZSA9XG5cdEZTX3Byb3RvLm9uYWJvcnQgPVxuXHRGU19wcm90by5vbmVycm9yID1cblx0RlNfcHJvdG8ub253cml0ZWVuZCA9XG5cdFx0bnVsbDtcblxuXHRyZXR1cm4gc2F2ZUFzO1xufShcblx0ICAgdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgJiYgc2VsZlxuXHR8fCB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvd1xuXHR8fCB0aGlzLmNvbnRlbnRcbikpO1xuLy8gYHNlbGZgIGlzIHVuZGVmaW5lZCBpbiBGaXJlZm94IGZvciBBbmRyb2lkIGNvbnRlbnQgc2NyaXB0IGNvbnRleHRcbi8vIHdoaWxlIGB0aGlzYCBpcyBuc0lDb250ZW50RnJhbWVNZXNzYWdlTWFuYWdlclxuLy8gd2l0aCBhbiBhdHRyaWJ1dGUgYGNvbnRlbnRgIHRoYXQgY29ycmVzcG9uZHMgdG8gdGhlIHdpbmRvd1xuXG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cykge1xuICBtb2R1bGUuZXhwb3J0cy5zYXZlQXMgPSBzYXZlQXM7XG59IGVsc2UgaWYgKCh0eXBlb2YgZGVmaW5lICE9PSBcInVuZGVmaW5lZFwiICYmIGRlZmluZSAhPT0gbnVsbCkgJiYgKGRlZmluZS5hbWQgIT09IG51bGwpKSB7XG4gIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHNhdmVBcztcbiAgfSk7XG59XG4iLCJ2YXIgd2luO1xuXG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbiA9IHdpbmRvdztcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbiA9IGdsb2JhbDtcbn0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpe1xuICAgIHdpbiA9IHNlbGY7XG59IGVsc2Uge1xuICAgIHdpbiA9IHt9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdpbjtcbiIsIm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvblxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKGZuKSB7XG4gIHZhciBzdHJpbmcgPSB0b1N0cmluZy5jYWxsKGZuKVxuICByZXR1cm4gc3RyaW5nID09PSAnW29iamVjdCBGdW5jdGlvbl0nIHx8XG4gICAgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiBzdHJpbmcgIT09ICdbb2JqZWN0IFJlZ0V4cF0nKSB8fFxuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAvLyBJRTggYW5kIGJlbG93XG4gICAgIChmbiA9PT0gd2luZG93LnNldFRpbWVvdXQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuYWxlcnQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuY29uZmlybSB8fFxuICAgICAgZm4gPT09IHdpbmRvdy5wcm9tcHQpKVxufTtcbiIsInZhciB0cmltID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gIHJldHVybiBzdHJpbmcucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xufVxuICAsIGlzQXJyYXkgPSBmdW5jdGlvbihhcmcpIHtcbiAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJnKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgICB9XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGhlYWRlcnMpIHtcbiAgaWYgKCFoZWFkZXJzKVxuICAgIHJldHVybiB7fVxuXG4gIHZhciByZXN1bHQgPSB7fVxuXG4gIHZhciBoZWFkZXJzQXJyID0gdHJpbShoZWFkZXJzKS5zcGxpdCgnXFxuJylcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGhlYWRlcnNBcnIubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcm93ID0gaGVhZGVyc0FycltpXVxuICAgIHZhciBpbmRleCA9IHJvdy5pbmRleE9mKCc6JylcbiAgICAsIGtleSA9IHRyaW0ocm93LnNsaWNlKDAsIGluZGV4KSkudG9Mb3dlckNhc2UoKVxuICAgICwgdmFsdWUgPSB0cmltKHJvdy5zbGljZShpbmRleCArIDEpKVxuXG4gICAgaWYgKHR5cGVvZihyZXN1bHRba2V5XSkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbHVlXG4gICAgfSBlbHNlIGlmIChpc0FycmF5KHJlc3VsdFtrZXldKSkge1xuICAgICAgcmVzdWx0W2tleV0ucHVzaCh2YWx1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2tleV0gPSBbIHJlc3VsdFtrZXldLCB2YWx1ZSBdXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgd2luZG93ID0gcmVxdWlyZShcImdsb2JhbC93aW5kb3dcIilcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZShcImlzLWZ1bmN0aW9uXCIpXG52YXIgcGFyc2VIZWFkZXJzID0gcmVxdWlyZShcInBhcnNlLWhlYWRlcnNcIilcbnZhciB4dGVuZCA9IHJlcXVpcmUoXCJ4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVhIUlxuLy8gQWxsb3cgdXNlIG9mIGRlZmF1bHQgaW1wb3J0IHN5bnRheCBpbiBUeXBlU2NyaXB0XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlWEhSO1xuY3JlYXRlWEhSLlhNTEh0dHBSZXF1ZXN0ID0gd2luZG93LlhNTEh0dHBSZXF1ZXN0IHx8IG5vb3BcbmNyZWF0ZVhIUi5YRG9tYWluUmVxdWVzdCA9IFwid2l0aENyZWRlbnRpYWxzXCIgaW4gKG5ldyBjcmVhdGVYSFIuWE1MSHR0cFJlcXVlc3QoKSkgPyBjcmVhdGVYSFIuWE1MSHR0cFJlcXVlc3QgOiB3aW5kb3cuWERvbWFpblJlcXVlc3RcblxuZm9yRWFjaEFycmF5KFtcImdldFwiLCBcInB1dFwiLCBcInBvc3RcIiwgXCJwYXRjaFwiLCBcImhlYWRcIiwgXCJkZWxldGVcIl0sIGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgIGNyZWF0ZVhIUlttZXRob2QgPT09IFwiZGVsZXRlXCIgPyBcImRlbFwiIDogbWV0aG9kXSA9IGZ1bmN0aW9uKHVyaSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRQYXJhbXModXJpLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgICAgICAgb3B0aW9ucy5tZXRob2QgPSBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgICAgICByZXR1cm4gX2NyZWF0ZVhIUihvcHRpb25zKVxuICAgIH1cbn0pXG5cbmZ1bmN0aW9uIGZvckVhY2hBcnJheShhcnJheSwgaXRlcmF0b3IpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdG9yKGFycmF5W2ldKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNFbXB0eShvYmope1xuICAgIGZvcih2YXIgaSBpbiBvYmope1xuICAgICAgICBpZihvYmouaGFzT3duUHJvcGVydHkoaSkpIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZVxufVxuXG5mdW5jdGlvbiBpbml0UGFyYW1zKHVyaSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgcGFyYW1zID0gdXJpXG5cbiAgICBpZiAoaXNGdW5jdGlvbihvcHRpb25zKSkge1xuICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnNcbiAgICAgICAgaWYgKHR5cGVvZiB1cmkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHBhcmFtcyA9IHt1cmk6dXJpfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcGFyYW1zID0geHRlbmQob3B0aW9ucywge3VyaTogdXJpfSlcbiAgICB9XG5cbiAgICBwYXJhbXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuICAgIHJldHVybiBwYXJhbXNcbn1cblxuZnVuY3Rpb24gY3JlYXRlWEhSKHVyaSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBvcHRpb25zID0gaW5pdFBhcmFtcyh1cmksIG9wdGlvbnMsIGNhbGxiYWNrKVxuICAgIHJldHVybiBfY3JlYXRlWEhSKG9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIF9jcmVhdGVYSFIob3B0aW9ucykge1xuICAgIGlmKHR5cGVvZiBvcHRpb25zLmNhbGxiYWNrID09PSBcInVuZGVmaW5lZFwiKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FsbGJhY2sgYXJndW1lbnQgbWlzc2luZ1wiKVxuICAgIH1cblxuICAgIHZhciBjYWxsZWQgPSBmYWxzZVxuICAgIHZhciBjYWxsYmFjayA9IGZ1bmN0aW9uIGNiT25jZShlcnIsIHJlc3BvbnNlLCBib2R5KXtcbiAgICAgICAgaWYoIWNhbGxlZCl7XG4gICAgICAgICAgICBjYWxsZWQgPSB0cnVlXG4gICAgICAgICAgICBvcHRpb25zLmNhbGxiYWNrKGVyciwgcmVzcG9uc2UsIGJvZHkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZWFkeXN0YXRlY2hhbmdlKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQobG9hZEZ1bmMsIDApXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCb2R5KCkge1xuICAgICAgICAvLyBDaHJvbWUgd2l0aCByZXF1ZXN0VHlwZT1ibG9iIHRocm93cyBlcnJvcnMgYXJyb3VuZCB3aGVuIGV2ZW4gdGVzdGluZyBhY2Nlc3MgdG8gcmVzcG9uc2VUZXh0XG4gICAgICAgIHZhciBib2R5ID0gdW5kZWZpbmVkXG5cbiAgICAgICAgaWYgKHhoci5yZXNwb25zZSkge1xuICAgICAgICAgICAgYm9keSA9IHhoci5yZXNwb25zZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm9keSA9IHhoci5yZXNwb25zZVRleHQgfHwgZ2V0WG1sKHhocilcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0pzb24pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm9keVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVycm9yRnVuYyhldnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRUaW1lcilcbiAgICAgICAgaWYoIShldnQgaW5zdGFuY2VvZiBFcnJvcikpe1xuICAgICAgICAgICAgZXZ0ID0gbmV3IEVycm9yKFwiXCIgKyAoZXZ0IHx8IFwiVW5rbm93biBYTUxIdHRwUmVxdWVzdCBFcnJvclwiKSApXG4gICAgICAgIH1cbiAgICAgICAgZXZ0LnN0YXR1c0NvZGUgPSAwXG4gICAgICAgIHJldHVybiBjYWxsYmFjayhldnQsIGZhaWx1cmVSZXNwb25zZSlcbiAgICB9XG5cbiAgICAvLyB3aWxsIGxvYWQgdGhlIGRhdGEgJiBwcm9jZXNzIHRoZSByZXNwb25zZSBpbiBhIHNwZWNpYWwgcmVzcG9uc2Ugb2JqZWN0XG4gICAgZnVuY3Rpb24gbG9hZEZ1bmMoKSB7XG4gICAgICAgIGlmIChhYm9ydGVkKSByZXR1cm5cbiAgICAgICAgdmFyIHN0YXR1c1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dFRpbWVyKVxuICAgICAgICBpZihvcHRpb25zLnVzZVhEUiAmJiB4aHIuc3RhdHVzPT09dW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvL0lFOCBDT1JTIEdFVCBzdWNjZXNzZnVsIHJlc3BvbnNlIGRvZXNuJ3QgaGF2ZSBhIHN0YXR1cyBmaWVsZCwgYnV0IGJvZHkgaXMgZmluZVxuICAgICAgICAgICAgc3RhdHVzID0gMjAwXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0dXMgPSAoeGhyLnN0YXR1cyA9PT0gMTIyMyA/IDIwNCA6IHhoci5zdGF0dXMpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3BvbnNlID0gZmFpbHVyZVJlc3BvbnNlXG4gICAgICAgIHZhciBlcnIgPSBudWxsXG5cbiAgICAgICAgaWYgKHN0YXR1cyAhPT0gMCl7XG4gICAgICAgICAgICByZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICBib2R5OiBnZXRCb2R5KCksXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogc3RhdHVzLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHt9LFxuICAgICAgICAgICAgICAgIHVybDogdXJpLFxuICAgICAgICAgICAgICAgIHJhd1JlcXVlc3Q6IHhoclxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycyl7IC8vcmVtZW1iZXIgeGhyIGNhbiBpbiBmYWN0IGJlIFhEUiBmb3IgQ09SUyBpbiBJRVxuICAgICAgICAgICAgICAgIHJlc3BvbnNlLmhlYWRlcnMgPSBwYXJzZUhlYWRlcnMoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKFwiSW50ZXJuYWwgWE1MSHR0cFJlcXVlc3QgRXJyb3JcIilcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyLCByZXNwb25zZSwgcmVzcG9uc2UuYm9keSlcbiAgICB9XG5cbiAgICB2YXIgeGhyID0gb3B0aW9ucy54aHIgfHwgbnVsbFxuXG4gICAgaWYgKCF4aHIpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuY29ycyB8fCBvcHRpb25zLnVzZVhEUikge1xuICAgICAgICAgICAgeGhyID0gbmV3IGNyZWF0ZVhIUi5YRG9tYWluUmVxdWVzdCgpXG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgeGhyID0gbmV3IGNyZWF0ZVhIUi5YTUxIdHRwUmVxdWVzdCgpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIga2V5XG4gICAgdmFyIGFib3J0ZWRcbiAgICB2YXIgdXJpID0geGhyLnVybCA9IG9wdGlvbnMudXJpIHx8IG9wdGlvbnMudXJsXG4gICAgdmFyIG1ldGhvZCA9IHhoci5tZXRob2QgPSBvcHRpb25zLm1ldGhvZCB8fCBcIkdFVFwiXG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHkgfHwgb3B0aW9ucy5kYXRhXG4gICAgdmFyIGhlYWRlcnMgPSB4aHIuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fVxuICAgIHZhciBzeW5jID0gISFvcHRpb25zLnN5bmNcbiAgICB2YXIgaXNKc29uID0gZmFsc2VcbiAgICB2YXIgdGltZW91dFRpbWVyXG4gICAgdmFyIGZhaWx1cmVSZXNwb25zZSA9IHtcbiAgICAgICAgYm9keTogdW5kZWZpbmVkLFxuICAgICAgICBoZWFkZXJzOiB7fSxcbiAgICAgICAgc3RhdHVzQ29kZTogMCxcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIHVybDogdXJpLFxuICAgICAgICByYXdSZXF1ZXN0OiB4aHJcbiAgICB9XG5cbiAgICBpZiAoXCJqc29uXCIgaW4gb3B0aW9ucyAmJiBvcHRpb25zLmpzb24gIT09IGZhbHNlKSB7XG4gICAgICAgIGlzSnNvbiA9IHRydWVcbiAgICAgICAgaGVhZGVyc1tcImFjY2VwdFwiXSB8fCBoZWFkZXJzW1wiQWNjZXB0XCJdIHx8IChoZWFkZXJzW1wiQWNjZXB0XCJdID0gXCJhcHBsaWNhdGlvbi9qc29uXCIpIC8vRG9uJ3Qgb3ZlcnJpZGUgZXhpc3RpbmcgYWNjZXB0IGhlYWRlciBkZWNsYXJlZCBieSB1c2VyXG4gICAgICAgIGlmIChtZXRob2QgIT09IFwiR0VUXCIgJiYgbWV0aG9kICE9PSBcIkhFQURcIikge1xuICAgICAgICAgICAgaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCBoZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdIHx8IChoZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdID0gXCJhcHBsaWNhdGlvbi9qc29uXCIpIC8vRG9uJ3Qgb3ZlcnJpZGUgZXhpc3RpbmcgYWNjZXB0IGhlYWRlciBkZWNsYXJlZCBieSB1c2VyXG4gICAgICAgICAgICBib2R5ID0gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5qc29uID09PSB0cnVlID8gYm9keSA6IG9wdGlvbnMuanNvbilcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSByZWFkeXN0YXRlY2hhbmdlXG4gICAgeGhyLm9ubG9hZCA9IGxvYWRGdW5jXG4gICAgeGhyLm9uZXJyb3IgPSBlcnJvckZ1bmNcbiAgICAvLyBJRTkgbXVzdCBoYXZlIG9ucHJvZ3Jlc3MgYmUgc2V0IHRvIGEgdW5pcXVlIGZ1bmN0aW9uLlxuICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJRSBtdXN0IGRpZVxuICAgIH1cbiAgICB4aHIub25hYm9ydCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIGFib3J0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICB4aHIub250aW1lb3V0ID0gZXJyb3JGdW5jXG4gICAgeGhyLm9wZW4obWV0aG9kLCB1cmksICFzeW5jLCBvcHRpb25zLnVzZXJuYW1lLCBvcHRpb25zLnBhc3N3b3JkKVxuICAgIC8vaGFzIHRvIGJlIGFmdGVyIG9wZW5cbiAgICBpZighc3luYykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gISFvcHRpb25zLndpdGhDcmVkZW50aWFsc1xuICAgIH1cbiAgICAvLyBDYW5ub3Qgc2V0IHRpbWVvdXQgd2l0aCBzeW5jIHJlcXVlc3RcbiAgICAvLyBub3Qgc2V0dGluZyB0aW1lb3V0IG9uIHRoZSB4aHIgb2JqZWN0LCBiZWNhdXNlIG9mIG9sZCB3ZWJraXRzIGV0Yy4gbm90IGhhbmRsaW5nIHRoYXQgY29ycmVjdGx5XG4gICAgLy8gYm90aCBucG0ncyByZXF1ZXN0IGFuZCBqcXVlcnkgMS54IHVzZSB0aGlzIGtpbmQgb2YgdGltZW91dCwgc28gdGhpcyBpcyBiZWluZyBjb25zaXN0ZW50XG4gICAgaWYgKCFzeW5jICYmIG9wdGlvbnMudGltZW91dCA+IDAgKSB7XG4gICAgICAgIHRpbWVvdXRUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGlmIChhYm9ydGVkKSByZXR1cm5cbiAgICAgICAgICAgIGFib3J0ZWQgPSB0cnVlLy9JRTkgbWF5IHN0aWxsIGNhbGwgcmVhZHlzdGF0ZWNoYW5nZVxuICAgICAgICAgICAgeGhyLmFib3J0KFwidGltZW91dFwiKVxuICAgICAgICAgICAgdmFyIGUgPSBuZXcgRXJyb3IoXCJYTUxIdHRwUmVxdWVzdCB0aW1lb3V0XCIpXG4gICAgICAgICAgICBlLmNvZGUgPSBcIkVUSU1FRE9VVFwiXG4gICAgICAgICAgICBlcnJvckZ1bmMoZSlcbiAgICAgICAgfSwgb3B0aW9ucy50aW1lb3V0IClcbiAgICB9XG5cbiAgICBpZiAoeGhyLnNldFJlcXVlc3RIZWFkZXIpIHtcbiAgICAgICAgZm9yKGtleSBpbiBoZWFkZXJzKXtcbiAgICAgICAgICAgIGlmKGhlYWRlcnMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCBoZWFkZXJzW2tleV0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGVhZGVycyAmJiAhaXNFbXB0eShvcHRpb25zLmhlYWRlcnMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkhlYWRlcnMgY2Fubm90IGJlIHNldCBvbiBhbiBYRG9tYWluUmVxdWVzdCBvYmplY3RcIilcbiAgICB9XG5cbiAgICBpZiAoXCJyZXNwb25zZVR5cGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZVxuICAgIH1cblxuICAgIGlmIChcImJlZm9yZVNlbmRcIiBpbiBvcHRpb25zICYmXG4gICAgICAgIHR5cGVvZiBvcHRpb25zLmJlZm9yZVNlbmQgPT09IFwiZnVuY3Rpb25cIlxuICAgICkge1xuICAgICAgICBvcHRpb25zLmJlZm9yZVNlbmQoeGhyKVxuICAgIH1cblxuICAgIC8vIE1pY3Jvc29mdCBFZGdlIGJyb3dzZXIgc2VuZHMgXCJ1bmRlZmluZWRcIiB3aGVuIHNlbmQgaXMgY2FsbGVkIHdpdGggdW5kZWZpbmVkIHZhbHVlLlxuICAgIC8vIFhNTEh0dHBSZXF1ZXN0IHNwZWMgc2F5cyB0byBwYXNzIG51bGwgYXMgYm9keSB0byBpbmRpY2F0ZSBubyBib2R5XG4gICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9uYXVndHVyL3hoci9pc3N1ZXMvMTAwLlxuICAgIHhoci5zZW5kKGJvZHkgfHwgbnVsbClcblxuICAgIHJldHVybiB4aHJcblxuXG59XG5cbmZ1bmN0aW9uIGdldFhtbCh4aHIpIHtcbiAgICAvLyB4aHIucmVzcG9uc2VYTUwgd2lsbCB0aHJvdyBFeGNlcHRpb24gXCJJbnZhbGlkU3RhdGVFcnJvclwiIG9yIFwiRE9NRXhjZXB0aW9uXCJcbiAgICAvLyBTZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1hNTEh0dHBSZXF1ZXN0L3Jlc3BvbnNlWE1MLlxuICAgIHRyeSB7XG4gICAgICAgIGlmICh4aHIucmVzcG9uc2VUeXBlID09PSBcImRvY3VtZW50XCIpIHtcbiAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VYTUxcbiAgICAgICAgfVxuICAgICAgICB2YXIgZmlyZWZveEJ1Z1Rha2VuRWZmZWN0ID0geGhyLnJlc3BvbnNlWE1MICYmIHhoci5yZXNwb25zZVhNTC5kb2N1bWVudEVsZW1lbnQubm9kZU5hbWUgPT09IFwicGFyc2VyZXJyb3JcIlxuICAgICAgICBpZiAoeGhyLnJlc3BvbnNlVHlwZSA9PT0gXCJcIiAmJiAhZmlyZWZveEJ1Z1Rha2VuRWZmZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlWE1MXG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7fVxuXG4gICAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5mdW5jdGlvbiBleHRlbmQoKSB7XG4gICAgdmFyIHRhcmdldCA9IHt9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldXG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldFxufVxuIiwiY29uc3QgTCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydMJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydMJ10gOiBudWxsKTtcblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIFt0aGlzLm1pbi54LCB0aGlzLm1pbi55LCB0aGlzLm1heC54LCB0aGlzLm1heC55XTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkJvdW5kc31cbiAqL1xuTC5Cb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGNvbnN0IHsgbWF4LCBtaW4gfSA9IHRoaXM7XG4gIGNvbnN0IGRlbHRhWCA9ICgobWF4LnggLSBtaW4ueCkgLyAyKSAqICh2YWx1ZSAtIDEpO1xuICBjb25zdCBkZWx0YVkgPSAoKG1heC55IC0gbWluLnkpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuQm91bmRzKFtcbiAgICBbbWluLnggLSBkZWx0YVgsIG1pbi55IC0gZGVsdGFZXSxcbiAgICBbbWF4LnggKyBkZWx0YVgsIG1heC55ICsgZGVsdGFZXVxuICBdKTtcbn07XG5cblxuLyoqXG4gKiBAcmV0dXJuIHtBcnJheS48TnVtYmVyPn1cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnRvQkJveCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIFt0aGlzLmdldFdlc3QoKSwgdGhpcy5nZXRTb3V0aCgpLCB0aGlzLmdldEVhc3QoKSwgdGhpcy5nZXROb3J0aCgpXTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IHZhbHVlXG4gKiBAcmV0dXJuIHtMLkxhdExuZ0JvdW5kc31cbiAqL1xuTC5MYXRMbmdCb3VuZHMucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIGNvbnN0IG5lID0gdGhpcy5fbm9ydGhFYXN0O1xuICBjb25zdCBzdyA9IHRoaXMuX3NvdXRoV2VzdDtcbiAgY29uc3QgZGVsdGFYID0gKChuZS5sbmcgLSBzdy5sbmcpIC8gMikgKiAodmFsdWUgLSAxKTtcbiAgY29uc3QgZGVsdGFZID0gKChuZS5sYXQgLSBzdy5sYXQpIC8gMikgKiAodmFsdWUgLSAxKTtcblxuICByZXR1cm4gbmV3IEwuTGF0TG5nQm91bmRzKFtcbiAgICBbc3cubGF0IC0gZGVsdGFZLCBzdy5sbmcgLSBkZWx0YVhdLFxuICAgIFtuZS5sYXQgKyBkZWx0YVksIG5lLmxuZyArIGRlbHRhWF1cbiAgXSk7XG59O1xuIiwiY29uc3QgTCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydMJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydMJ10gOiBudWxsKTtcblxuLyoqXG4gKiBAY2xhc3MgTC5TY2hlbWF0aWNSZW5kZXJlclxuICogQHBhcmFtICB7T2JqZWN0fVxuICogQGV4dGVuZHMge0wuU1ZHfVxuICovXG5MLlNjaGVtYXRpY1JlbmRlcmVyID0gbW9kdWxlLmV4cG9ydHMgPSBMLlNWRy5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwYWRkaW5nOiAwLjMsXG4gICAgdXNlUmFzdGVyOiBMLkJyb3dzZXIuaWUgfHwgTC5Ccm93c2VyLmdlY2tvIHx8IEwuQnJvd3Nlci5lZGdlLFxuICAgIGludGVyYWN0aXZlOiB0cnVlXG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIGFkZGl0aW9uYWwgY29udGFpbmVycyBmb3IgdGhlIHZlY3RvciBmZWF0dXJlcyB0byBiZVxuICAgKiB0cmFuc2Zvcm1lZCB0byBsaXZlIGluIHRoZSBzY2hlbWF0aWMgc3BhY2VcbiAgICovXG4gIF9pbml0Q29udGFpbmVyKCkge1xuICAgIEwuU1ZHLnByb3RvdHlwZS5faW5pdENvbnRhaW5lci5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwID0gTC5TVkcuY3JlYXRlKCdnJyk7XG4gICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RJbnZlcnRHcm91cCk7XG4gICAgdGhpcy5fcm9vdEludmVydEdyb3VwLmFwcGVuZENoaWxkKHRoaXMuX3Jvb3RHcm91cCk7XG5cbiAgICBpZiAoTC5Ccm93c2VyLmdlY2tvKSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuc2V0QXR0cmlidXRlKCdwb2ludGVyLWV2ZW50cycsICd2aXNpYmxlUGFpbnRlZCcpO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9jb250YWluZXIsICdzY2hlbWF0aWNzLXJlbmRlcmVyJyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogTWFrZSBzdXJlIGxheWVycyBhcmUgbm90IGNsaXBwZWRcbiAgICogQHBhcmFtICB7TC5MYXllcn1cbiAgICovXG4gIF9pbml0UGF0aChsYXllcikge1xuICAgIGxheWVyLm9wdGlvbnMubm9DbGlwID0gdHJ1ZTtcbiAgICBMLlNWRy5wcm90b3R5cGUuX2luaXRQYXRoLmNhbGwodGhpcywgbGF5ZXIpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBjYWxsIG9uIHJlc2l6ZSwgcmVkcmF3LCB6b29tIGNoYW5nZVxuICAgKi9cbiAgX3VwZGF0ZSgpIHtcbiAgICBMLlNWRy5wcm90b3R5cGUuX3VwZGF0ZS5jYWxsKHRoaXMpO1xuXG4gICAgY29uc3Qgc2NoZW1hdGljID0gdGhpcy5vcHRpb25zLnNjaGVtYXRpYztcbiAgICBjb25zdCBtYXAgPSB0aGlzLl9tYXA7XG5cbiAgICBpZiAobWFwICYmIHNjaGVtYXRpYy5fYm91bmRzICYmIHRoaXMuX3Jvb3RJbnZlcnRHcm91cCkge1xuICAgICAgY29uc3QgdG9wTGVmdCA9IG1hcC5sYXRMbmdUb0xheWVyUG9pbnQoc2NoZW1hdGljLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgY29uc3Qgc2NhbGUgPSBzY2hlbWF0aWMuX3JhdGlvICpcbiAgICAgICAgbWFwLm9wdGlvbnMuY3JzLnNjYWxlKG1hcC5nZXRab29tKCkgLSBzY2hlbWF0aWMub3B0aW9ucy56b29tT2Zmc2V0KTtcblxuICAgICAgdGhpcy5fdG9wTGVmdCA9IHRvcExlZnQ7XG4gICAgICB0aGlzLl9zY2FsZSA9IHNjYWxlO1xuXG4gICAgICAvLyBjb21wZW5zYXRlIHZpZXdib3ggZGlzbWlzc2FsIHdpdGggYSBzaGlmdCBoZXJlXG4gICAgICB0aGlzLl9yb290R3JvdXAuc2V0QXR0cmlidXRlKCd0cmFuc2Zvcm0nLFxuICAgICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRvcExlZnQsIHNjYWxlKSk7XG5cbiAgICAgIHRoaXMuX3Jvb3RJbnZlcnRHcm91cC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICAgIEwuRG9tVXRpbC5nZXRNYXRyaXhTdHJpbmcodG9wTGVmdC5tdWx0aXBseUJ5KC0xIC8gc2NhbGUpLCAxIC8gc2NhbGUpKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogMS4gd3JhcCBtYXJrdXAgaW4gYW5vdGhlciA8Zz5cbiAgICogMi4gY3JlYXRlIGEgY2xpcFBhdGggd2l0aCB0aGUgdmlld0JveCByZWN0XG4gICAqIDMuIGFwcGx5IGl0IHRvIHRoZSA8Zz4gYXJvdW5kIGFsbCBtYXJrdXBzXG4gICAqIDQuIHJlbW92ZSBncm91cCBhcm91bmQgc2NoZW1hdGljXG4gICAqIDUuIHJlbW92ZSBpbm5lciBncm91cCBhcm91bmQgbWFya3Vwc1xuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW49fSBvbmx5T3ZlcmxheXNcbiAgICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAgICovXG4gIGV4cG9ydFNWRyhvbmx5T3ZlcmxheXMpIHtcbiAgICBjb25zdCBzY2hlbWF0aWMgPSB0aGlzLm9wdGlvbnMuc2NoZW1hdGljO1xuXG4gICAgLy8gZ28gdGhyb3VnaCBldmVyeSBsYXllciBhbmQgbWFrZSBzdXJlIHRoZXkncmUgbm90IGNsaXBwZWRcbiAgICBjb25zdCBzdmcgPSB0aGlzLl9jb250YWluZXIuY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgY29uc3QgY2xpcFBhdGggPSBMLlNWRy5jcmVhdGUoJ2NsaXBQYXRoJyk7XG4gICAgY29uc3QgY2xpcFJlY3QgPSBMLlNWRy5jcmVhdGUoJ3JlY3QnKTtcbiAgICBjb25zdCBjbGlwR3JvdXAgPSBzdmcubGFzdENoaWxkO1xuICAgIGNvbnN0IGJhc2VDb250ZW50ID0gc3ZnLnF1ZXJ5U2VsZWN0b3IoJy5zdmctb3ZlcmxheScpO1xuICAgIGxldCBkZWZzID0gYmFzZUNvbnRlbnQucXVlcnlTZWxlY3RvcignZGVmcycpO1xuXG4gICAgY2xpcFJlY3Quc2V0QXR0cmlidXRlKCd4Jywgc2NoZW1hdGljLl9iYm94WzBdKTtcbiAgICBjbGlwUmVjdC5zZXRBdHRyaWJ1dGUoJ3knLCBzY2hlbWF0aWMuX2Jib3hbMV0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnd2lkdGgnLCBzY2hlbWF0aWMuX2Jib3hbMl0pO1xuICAgIGNsaXBSZWN0LnNldEF0dHJpYnV0ZSgnaGVpZ2h0Jywgc2NoZW1hdGljLl9iYm94WzNdKTtcbiAgICBjbGlwUGF0aC5hcHBlbmRDaGlsZChjbGlwUmVjdCk7XG5cbiAgICBjb25zdCBjbGlwSWQgPSAndmlld2JveENsaXAtJyArIEwuVXRpbC5zdGFtcChzY2hlbWF0aWMuX2dyb3VwKTtcbiAgICBjbGlwUGF0aC5zZXRBdHRyaWJ1dGUoJ2lkJywgY2xpcElkKTtcblxuICAgIGlmICghZGVmcyB8fCBvbmx5T3ZlcmxheXMpIHtcbiAgICAgIGRlZnMgPSBMLlNWRy5jcmVhdGUoJ2RlZnMnKTtcbiAgICAgIHN2Zy5hcHBlbmRDaGlsZChkZWZzKTtcbiAgICB9XG4gICAgZGVmcy5hcHBlbmRDaGlsZChjbGlwUGF0aCk7XG4gICAgY2xpcEdyb3VwLnNldEF0dHJpYnV0ZSgnY2xpcC1wYXRoJywgJ3VybCgjJyArIGNsaXBJZCArICcpJyk7XG5cbiAgICBjbGlwR3JvdXAuZmlyc3RDaGlsZC5zZXRBdHRyaWJ1dGUoJ3RyYW5zZm9ybScsXG4gICAgICBMLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nKHRoaXMuX3RvcExlZnQubXVsdGlwbHlCeSgtMSAvIHRoaXMuX3NjYWxlKVxuICAgICAgICAuYWRkKHNjaGVtYXRpYy5fdmlld0JveE9mZnNldCksIDEgLyB0aGlzLl9zY2FsZSkpO1xuICAgIGNsaXBHcm91cC5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuICAgIHN2Zy5xdWVyeVNlbGVjdG9yKCcuc3ZnLW92ZXJsYXknKS5yZW1vdmVBdHRyaWJ1dGUoJ3RyYW5zZm9ybScpO1xuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhjbGlwR3JvdXAsICdjbGlwLWdyb3VwJyk7XG5cbiAgICBzdmcuc3R5bGUudHJhbnNmb3JtID0gJyc7XG4gICAgc3ZnLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHNjaGVtYXRpYy5fYmJveC5qb2luKCcgJykpO1xuXG4gICAgaWYgKG9ubHlPdmVybGF5cykgeyAvLyBsZWF2ZSBvbmx5IG1hcmt1cHNcbiAgICAgIGJhc2VDb250ZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYmFzZUNvbnRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpdiA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsICcnKTtcbiAgICAvLyBwdXQgY29udGFpbmVyIGFyb3VuZCB0aGUgY29udGVudHMgYXMgaXQgd2FzXG4gICAgZGl2LmlubmVySFRNTCA9ICgvKFxcPHN2Z1xccysoW14+XSopXFw+KS9naSlcbiAgICAgIC5leGVjKHNjaGVtYXRpYy5fcmF3RGF0YSlbMF0gKyAnPC9zdmc+JztcblxuICAgIEwuU1ZHLmNvcHlTVkdDb250ZW50cyhzdmcsIGRpdi5maXJzdENoaWxkKTtcblxuICAgIHJldHVybiBkaXYuZmlyc3RDaGlsZDtcbiAgfVxuXG59KTtcblxuXG4vKipcbiAqIEBwYXJhbSAge09iamVjdH1cbiAqIEByZXR1cm4ge0wuU2NoZW1hdGljUmVuZGVyZXJ9XG4gKi9cbkwuc2NoZW1hdGljUmVuZGVyZXIgPSBtb2R1bGUuZXhwb3J0cy5zY2hlbWF0aWNSZW5kZXJlciA9XG4gIChvcHRpb25zKSA9PiBuZXcgTC5TY2hlbWF0aWNSZW5kZXJlcihvcHRpb25zKTtcbiIsImNvbnN0IEwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snTCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnTCddIDogbnVsbCk7XG5jb25zdCBiNjQgPSByZXF1aXJlKCdCYXNlNjQnKTtcbmNvbnN0IFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlcicpO1xuXG5yZXF1aXJlKCcuL2JvdW5kcycpO1xucmVxdWlyZSgnLi91dGlscycpO1xuXG5cbi8qKlxuICogU2NoZW1hdGljIGxheWVyIHRvIHdvcmsgd2l0aCBTVkcgc2NoZW1hdGljcyBvciBibHVlcHJpbnRzIGluIExlYWZsZXRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKiBAY2xhc3MgU2NoZW1hdGljXG4gKiBAZXh0ZW5kcyB7TC5SZWN0YW5nbGV9XG4gKi9cbkwuU2NoZW1hdGljID0gbW9kdWxlLmV4cG9ydHMgPSBMLlJlY3RhbmdsZS5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBvcGFjaXR5OiAwLFxuICAgIGZpbGxPcGFjaXR5OiAwLFxuICAgIHdlaWdodDogMSxcbiAgICBhZGp1c3RUb1NjcmVlbjogdHJ1ZSxcblxuICAgIC8vIGhhcmRjb2RlIHpvb20gb2Zmc2V0IHRvIHNuYXAgdG8gc29tZSBsZXZlbFxuICAgIHpvb21PZmZzZXQ6IDAsXG4gICAgaW50ZXJhY3RpdmU6IGZhbHNlLFxuICAgIHVzZVJhc3RlcjogTC5Ccm93c2VyLmllIHx8IEwuQnJvd3Nlci5nZWNrbyB8fCBMLkJyb3dzZXIuZWRnZVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgICAgc3ZnICAgICBTVkcgc3RyaW5nIG9yIFVSTFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ0JvdW5kc30gYm91bmRzXG4gICAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplKHN2ZywgYm91bmRzLCBvcHRpb25zKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3N2ZyA9IHN2ZztcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWwgc3ZnIHdpZHRoLCBjYXVzZSB3ZSB3aWxsIGhhdmUgdG8gZ2V0IHJpZCBvZiB0aGF0IHRvIG1haW50YWluXG4gICAgICogdGhlIGFzcGVjdCByYXRpb1xuICAgICAqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsV2lkdGggPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbCBzdmcgaGVpZ2h0XG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9pbml0aWFsSGVpZ2h0ID0gJyc7XG5cbiAgICBpZiAoIShib3VuZHMgaW5zdGFuY2VvZiBMLkxhdExuZ0JvdW5kcykpIHtcbiAgICAgIG9wdGlvbnMgPSBib3VuZHM7XG4gICAgICBib3VuZHMgPSBudWxsO1xuICAgIH1cblxuICAgIG9wdGlvbnMucmVuZGVyZXIgPSBuZXcgUmVuZGVyZXIoe1xuICAgICAgc2NoZW1hdGljOiB0aGlzXG4gICAgICAvLyBwYWRkaW5nOiBvcHRpb25zLnBhZGRpbmcgfHwgdGhpcy5vcHRpb25zLnBhZGRpbmcgfHwgMC4yNVxuICAgIH0pO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nQm91bmRzfVxuICAgICAqL1xuICAgIHRoaXMuX2JvdW5kcyA9IGJvdW5kcztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAgICovXG4gICAgdGhpcy5fcmF0aW8gPSAxO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zaXplID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fb3JpZ2luID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuVHJhbnNmb3JtYXRpb259XG4gICAgICovXG4gICAgdGhpcy5fdHJhbnNmb3JtYXRpb24gPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX2Jhc2U2NGVuY29kZWQgPSAnJztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl9yYXdEYXRhID0gJyc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3ZpZXdCb3hPZmZzZXQgPSBMLnBvaW50KDAsIDApO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9yZWFkeSA9IGZhbHNlO1xuXG5cbiAgICBpZiAodHlwZW9mIHN2ZyA9PT0gJ3N0cmluZycgJiYgIS9cXDxzdmcvaWcudGVzdChzdmcpKSB7XG4gICAgICB0aGlzLl9zdmcgPSBudWxsO1xuXG4gICAgICAvKipcbiAgICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuX3VybCA9IHN2ZztcblxuICAgICAgaWYgKCFvcHRpb25zLmxvYWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTVkdPdmVybGF5IHJlcXVpcmVzIGV4dGVybmFsIHJlcXVlc3QgaW1wbGVtZW50YXRpb24uICcgK1xuICAgICAgICAgICdZb3UgaGF2ZSB0byBwcm92aWRlIGBsb2FkYCBmdW5jdGlvbiB3aXRoIHRoZSBvcHRpb25zJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NWR0VsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DYW52YXN9XG4gICAgICovXG4gICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9yYXN0ZXJTaG93biA9IGZhbHNlO1xuXG5cblxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwoXG4gICAgICB0aGlzLCBMLmxhdExuZ0JvdW5kcyhbMCwgMF0sIFswLCAwXSksIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICovXG4gIG9uQWRkKG1hcCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG5cbiAgICB0aGlzLl9yZWFkeSA9IGZhbHNlO1xuXG4gICAgaWYgKCF0aGlzLl9ncm91cCkge1xuICAgICAgdGhpcy5fZ3JvdXAgPSBMLlNWRy5jcmVhdGUoJ2cnKTtcbiAgICAgIEwuVXRpbC5zdGFtcCh0aGlzLl9ncm91cCk7XG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fZ3JvdXAsICdzdmctb3ZlcmxheScpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5fc3ZnKSB7XG4gICAgICB0aGlzLmxvYWQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkxvYWQodGhpcy5fc3ZnKTtcbiAgICB9XG5cbiAgICBpZiAoTC5Ccm93c2VyLmdlY2tvKSB7XG4gICAgICB0aGlzLl9wYXRoLnNldEF0dHJpYnV0ZSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlUmFzdGVyKSB7XG4gICAgICBjb25zdCBjYW52YXNSZW5kZXJlciA9IG5ldyBMLkNhbnZhcyh7fSkuYWRkVG8obWFwKTtcbiAgICAgIGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIucGFyZW50Tm9kZVxuICAgICAgICAuaW5zZXJ0QmVmb3JlKGNhbnZhc1JlbmRlcmVyLl9jb250YWluZXIsIHRoaXMuX3JlbmRlcmVyLl9jb250YWluZXIpO1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIgPSBjYW52YXNSZW5kZXJlcjtcblxuICAgICAgbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGVcbiAgICAgICAgLm9uKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgICAvL2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqL1xuICBvblJlbW92ZShtYXApIHtcbiAgICBpZiAobnVsbCAhPT0gdGhpcy5fZ3JvdXAucGFyZW50Tm9kZSkge1xuICAgICAgdGhpcy5fZ3JvdXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLl9ncm91cCk7XG4gICAgfVxuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gICAgaWYgKHRoaXMuX2NhbnZhc1JlbmRlcmVyKSB7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5yZW1vdmVGcm9tKG1hcCk7XG4gICAgICBtYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZVxuICAgICAgICAub2ZmKCdwcmVkcmFnJywgdGhpcy5fb25QcmVEcmFnLCB0aGlzKVxuICAgICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcbiAgICB9XG4gICAgdGhpcy5fcmVuZGVyZXIucmVtb3ZlRnJvbShtYXApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExvYWRzIHN2ZyB2aWEgWEhSXG4gICAqL1xuICBsb2FkKCkge1xuICAgIHRoaXMub3B0aW9ucy5sb2FkKHRoaXMuX3VybCwgTC5VdGlsLmJpbmQoZnVuY3Rpb24gKGVyciwgc3ZnKSB7XG4gICAgICBpZiAoZXJyKSB7IHRoaXMub25FcnJvcihlcnIpOyB9XG4gICAgICBlbHNlIHsgdGhpcy5vbkxvYWQoc3ZnKTsgfVxuICAgIH0sIHRoaXMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN2Z1N0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBfcmVhZFNWR0RhdGEoc3ZnU3RyaW5nKSB7XG4gICAgY29uc3QgcGFyc2VyID0gbmV3IERPTVBhcnNlcigpO1xuICAgIGNvbnN0IHNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuXG4gICAgY29uc3QgZG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyhzdmdTdHJpbmcsICdhcHBsaWNhdGlvbi94bWwnKTtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgaWYgKGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdwYXJzZXJlcnJvcicpICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5vbkVycm9yKG5ldyBFcnJvcignU1ZHIHBhcnNlIGVycm9yJykpO1xuICAgIH1cblxuICAgIHRoaXMuX2luaXRpYWxXaWR0aCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3dpZHRoJyk7XG4gICAgdGhpcy5faW5pdGlhbEhlaWdodCA9IGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2hlaWdodCcpO1xuXG4gICAgdGhpcy5fYmJveCA9IEwuRG9tVXRpbC5nZXRTVkdCQm94KGNvbnRhaW5lcik7XG5cbiAgICAvLyBmaXggd2lkdGggY2F1c2Ugb3RoZXJ3aXNlIHJhc3RlcnphdGlvbiB3aWxsIGJyZWFrXG4gICAgY29uc3Qgd2lkdGggPSB0aGlzLl9iYm94WzJdIC0gdGhpcy5fYmJveFswXTtcbiAgICBjb25zdCBoZWlnaHQgPSB0aGlzLl9iYm94WzNdIC0gdGhpcy5fYmJveFsxXTtcblxuICAgIGlmICgodGhpcy5faW5pdGlhbFdpZHRoICE9PSBudWxsICYmIHBhcnNlRmxvYXQodGhpcy5faW5pdGlhbFdpZHRoKSAhPT0gd2lkdGgpIHx8XG4gICAgICAodGhpcy5faW5pdGlhbEhlaWdodCAhPT0gbnVsbCAmJiBwYXJzZUZsb2F0KHRoaXMuX2luaXRpYWxIZWlnaHQpICE9PSBoZWlnaHQpKSB7XG4gICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKCd3aWR0aCcsIHdpZHRoKTtcbiAgICAgIGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2hlaWdodCcsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmF3RGF0YSA9IHN2Z1N0cmluZztcbiAgICB0aGlzLl9wcm9jZXNzZWREYXRhID0gc2VyaWFsaXplci5zZXJpYWxpemVUb1N0cmluZyhkb2MpO1xuXG4gICAgaWYgKGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ3ZpZXdCb3gnKSA9PT0gbnVsbCkge1xuICAgICAgY29udGFpbmVyLnNldEF0dHJpYnV0ZSgndmlld0JveCcsIHRoaXMuX2Jib3guam9pbignICcpKTtcbiAgICAgIHRoaXMuX3Byb2Nlc3NlZERhdGEgPSB0aGlzLl9wcm9jZXNzZWREYXRhLnJlcGxhY2UoJzxzdmcnLFxuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiJyArIHRoaXMuX2Jib3guam9pbignICcpICsgJ1wiJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtFcnJvcn0gZXJyXG4gICAqIEByZXR1cm4ge1NjaGVtYXRpY31cbiAgICovXG4gIG9uRXJyb3IoZXJyKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkVycm9yKSB7XG4gICAgICB0aGlzLm9wdGlvbnMub25FcnJvci5jYWxsKHRoaXMsIHsgZXJyb3I6IGVyciB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZmlyZSgnZXJyb3InLCB7IGVycm9yOiBlcnIgfSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU1ZHIGlzIHJlYWR5XG4gICAqIEBwYXJhbSAge1N0cmluZ30gc3ZnIG1hcmt1cFxuICAgKi9cbiAgb25Mb2FkKHN2Zykge1xuICAgIGlmICghdGhpcy5fbWFwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3ZnID0gdGhpcy5fcmVhZFNWR0RhdGEoc3ZnKTtcbiAgICBjb25zdCBiYm94ID0gdGhpcy5fYmJveDtcbiAgICBjb25zdCBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKTtcbiAgICBjb25zdCBtYXBTaXplID0gdGhpcy5fbWFwLmdldFNpemUoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuYWRqdXN0VG9TY3JlZW4gJiYgc2l6ZS55ICE9PSBtYXBTaXplLnkpIHtcbiAgICAgIHRoaXMuX3JhdGlvID0gTWF0aC5taW4obWFwU2l6ZS54IC8gc2l6ZS54LCBtYXBTaXplLnkgLyBzaXplLnkpO1xuICAgICAgdGhpcy5vcHRpb25zLl96b29tT2Zmc2V0ID0gKHRoaXMuX3JhdGlvIDwgMSkgP1xuICAgICAgICB0aGlzLl9yYXRpbyA6ICgxIC0gdGhpcy5fcmF0aW8pO1xuICAgICAgLy8gZGlzbWlzcyB0aGF0IG9mZnNldFxuICAgICAgdGhpcy5vcHRpb25zLnpvb21PZmZzZXQgPSAwO1xuICAgICAgaWYgKHRoaXMuX3JhdGlvID09PSAwKSB7IHRoaXMuX3JhdGlvID0gMTsgfSAvLyBkaXNhbGxvdyAwIGluIGFueSBjYXNlXG4gICAgfVxuXG4gICAgY29uc3QgbWluWm9vbSA9IHRoaXMuX21hcC5nZXRNaW5ab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIGVkZ2VzIG9mIHRoZSBpbWFnZSwgaW4gY29vcmRpbmF0ZSBzcGFjZVxuICAgIHRoaXMuX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcyhcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMF0sIGJib3hbM11dLCBtaW5ab29tKSxcbiAgICAgIHRoaXMuX21hcC51bnByb2plY3QoW2Jib3hbMl0sIGJib3hbMV1dLCBtaW5ab29tKVxuICAgICkuc2NhbGUodGhpcy5fcmF0aW8pO1xuXG4gICAgdGhpcy5fc2l6ZSA9IHNpemU7XG4gICAgdGhpcy5fb3JpZ2luID0gdGhpcy5fbWFwLnByb2plY3QodGhpcy5fYm91bmRzLmdldENlbnRlcigpLCBtaW5ab29tKTtcbiAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbiA9IG5ldyBMLlRyYW5zZm9ybWF0aW9uKFxuICAgICAgMSwgdGhpcy5fb3JpZ2luLngsIDEsIHRoaXMuX29yaWdpbi55KTtcbiAgICB0aGlzLl92aWV3Qm94T2Zmc2V0ID0gTC5wb2ludCh0aGlzLl9iYm94WzBdLCB0aGlzLl9iYm94WzFdKTtcblxuICAgIHRoaXMuX2NyZWF0ZUNvbnRlbnRzKHN2Zyk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5pbnNlcnRCZWZvcmUoXG4gICAgICB0aGlzLl9ncm91cCwgdGhpcy5fcmVuZGVyZXIuX2NvbnRhaW5lci5maXJzdENoaWxkKTtcblxuICAgIHRoaXMuZmlyZSgnbG9hZCcpO1xuICAgIHRoaXMuX3JlYWR5ID0gdHJ1ZTtcblxuICAgIHRoaXMuX2xhdGxuZ3MgPSB0aGlzLl9ib3VuZHNUb0xhdExuZ3ModGhpcy5fYm91bmRzKTtcbiAgICB0aGlzLl9yZXNldCgpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKHRoaXMudG9JbWFnZSwgdGhpcyk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0gIHsqPX0gICAgICAgY29udGV4dFxuICAgKiBAcmV0dXJuIHtPdmVybGF5fVxuICAgKi9cbiAgd2hlblJlYWR5KGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgaWYgKHRoaXMuX3JlYWR5KSB7XG4gICAgICBjYWxsYmFjay5jYWxsKGNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR9XG4gICAqL1xuICBnZXREb2N1bWVudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZ3JvdXA7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5TY2hlbWF0aWNSZW5kZXJlcn1cbiAgICovXG4gIGdldFJlbmRlcmVyKCkge1xuICAgIHJldHVybiB0aGlzLl9yZW5kZXJlcjtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAgICovXG4gIF9jcmVhdGVDb250ZW50cyhzdmcpIHtcbiAgICBMLlNWRy5jb3B5U1ZHQ29udGVudHMoc3ZnLCB0aGlzLl9ncm91cCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIGdldE9yaWdpbmFsU2l6ZSgpIHtcbiAgICBjb25zdCBiYm94ID0gdGhpcy5fYmJveDtcbiAgICByZXR1cm4gbmV3IEwuUG9pbnQoXG4gICAgICBNYXRoLmFicyhiYm94WzBdIC0gYmJveFsyXSksXG4gICAgICBNYXRoLmFicyhiYm94WzFdIC0gYmJveFszXSlcbiAgICApO1xuICB9LFxuXG5cblxuICAvKipcbiAgICogUG9zaXRpb24gb3VyIFwicmVjdGFuZ2xlXCJcbiAgICovXG4gIF91cGRhdGVQYXRoKCkge1xuICAgIEwuUmVjdGFuZ2xlLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX2dyb3VwKSB7XG4gICAgICBjb25zdCB0b3BMZWZ0ID0gdGhpcy5fbWFwLmxhdExuZ1RvTGF5ZXJQb2ludCh0aGlzLl9ib3VuZHMuZ2V0Tm9ydGhXZXN0KCkpO1xuICAgICAgLy8gc2NhbGUgaXMgc2NhbGUgZmFjdG9yLCB6b29tIGlzIHpvb20gbGV2ZWxcbiAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5fbWFwLm9wdGlvbnMuY3JzLnNjYWxlKFxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQpICogdGhpcy5fcmF0aW87XG5cbiAgICAgIC8vdG9wTGVmdCA9IHRvcExlZnQuc3VidHJhY3QodGhpcy5fdmlld0JveE9mZnNldC5tdWx0aXBseUJ5KHNjYWxlKSk7XG5cbiAgICAgIC8vIGNvbXBlbnNhdGUgdmlld2JveCBkaXNtaXNzYWwgd2l0aCBhIHNoaWZ0IGhlcmVcbiAgICAgIHRoaXMuX2dyb3VwLnNldEF0dHJpYnV0ZSgndHJhbnNmb3JtJyxcbiAgICAgICAgTC5Eb21VdGlsLmdldE1hdHJpeFN0cmluZyhcbiAgICAgICAgICB0b3BMZWZ0LnN1YnRyYWN0KHRoaXMuX3ZpZXdCb3hPZmZzZXQubXVsdGlwbHlCeShzY2FsZSkpLCBzY2FsZSkpO1xuXG4gICAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIpIHtcbiAgICAgICAgdGhpcy5fcmVkcmF3Q2FudmFzKHRvcExlZnQsIHNjYWxlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBGUk9NIHZpZXdwb3J0aXplZCBzY2hlbWF0aWMgcmF0aW9cbiAgICogQHBhcmFtICB7TC5Qb2ludH0gcHRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIF91bnNjYWxlUG9pbnQocHQpIHtcbiAgICByZXR1cm4gdGhpcy5fdHJhbnNmb3JtYXRpb24udHJhbnNmb3JtKFxuICAgICAgdGhpcy5fdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHQpLmRpdmlkZUJ5KHRoaXMuX3JhdGlvKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2NhbGVzIHByb2plY3RlZCBwb2ludCBUTyB2aWV3cG9ydGl6ZWQgc2NoZW1hdGljIHJhdGlvXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuUG9pbnR9XG4gICAqL1xuICBfc2NhbGVQb2ludChwdCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm1hdGlvbi50cmFuc2Zvcm0oXG4gICAgICB0aGlzLl90cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShwdCkubXVsdGlwbHlCeSh0aGlzLl9yYXRpbylcbiAgICApO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge051bWJlcn1cbiAgICovXG4gIGdldFJhdGlvKCkge1xuICAgIHJldHVybiB0aGlzLl9yYXRpbztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gbWFwIGNvb3JkIHRvIHNjaGVtYXRpYyBwb2ludFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gY29vcmRcbiAgICogQHJldHVybiB7TC5Qb2ludH1cbiAgICovXG4gIHByb2plY3RQb2ludChjb29yZCkge1xuICAgIGNvbnN0IG1hcCA9IHRoaXMuX21hcDtcbiAgICByZXR1cm4gdGhpcy5fdW5zY2FsZVBvaW50KG1hcC5wcm9qZWN0KFxuICAgICAgY29vcmQsIG1hcC5nZXRNaW5ab29tKCkgKyB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCkpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUG9pbnR9IHB0XG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgdW5wcm9qZWN0UG9pbnQocHQpIHtcbiAgICBjb25zdCBtYXAgPSB0aGlzLl9tYXA7XG4gICAgcmV0dXJuIG1hcC51bnByb2plY3QoXG4gICAgICB0aGlzLl9zY2FsZVBvaW50KHB0KSwgbWFwLmdldE1pblpvb20oKSArIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLkJvdW5kc30gYm91bmRzXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nQm91bmRzfVxuICAgKi9cbiAgdW5wcm9qZWN0Qm91bmRzKGJvdW5kcykge1xuICAgIGNvbnN0IHN3ID0gdGhpcy51bnByb2plY3RQb2ludChib3VuZHMubWluKTtcbiAgICBjb25zdCBuZSA9IHRoaXMudW5wcm9qZWN0UG9pbnQoYm91bmRzLm1heCk7XG4gICAgcmV0dXJuIEwubGF0TG5nQm91bmRzKHN3LCBuZSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVHJhbnNmb3JtIGxheWVyQm91bmRzIHRvIHNjaGVtYXRpYyBiYm94XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAgICogQHJldHVybiB7TC5Cb3VuZHN9XG4gICAqL1xuICBwcm9qZWN0Qm91bmRzKGJvdW5kcykge1xuICAgIHJldHVybiBuZXcgTC5Cb3VuZHMoXG4gICAgICB0aGlzLnByb2plY3RQb2ludChib3VuZHMuZ2V0U291dGhXZXN0KCkpLFxuICAgICAgdGhpcy5wcm9qZWN0UG9pbnQoYm91bmRzLmdldE5vcnRoRWFzdCgpKVxuICAgICk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7Qm9vbGVhbj19IHN0cmluZ1xuICAgKiBAcGFyYW0gIHtCb29sZWFuPX0gb3ZlcmxheXNPbmx5XG4gICAqIEByZXR1cm4ge1NWR0VsZW1lbnR8U3RyaW5nfVxuICAgKi9cbiAgZXhwb3J0U1ZHKHN0cmluZywgb3ZlcmxheXNPbmx5KSB7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuX3JlbmRlcmVyLmV4cG9ydFNWRyhvdmVybGF5c09ubHkpO1xuICAgIGlmIChzdHJpbmcpIHtcbiAgICAgIC8vIG91dGVySFRNTCBub3Qgc3VwcG9ydGVkIGluIElFIG9uIFNWR0VsZW1lbnRcbiAgICAgIGNvbnN0IHdyYXBwZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnKTtcbiAgICAgIHdyYXBwZXIuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICByZXR1cm4gd3JhcHBlci5pbm5lckhUTUw7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9LFxuXG5cbiAgLyoqXG4gICogUmFzdGVyaXplcyB0aGUgc2NoZW1hdGljXG4gICogQHJldHVybiB7U2NoZW1hdGljfVxuICAqL1xuICB0b0ltYWdlKCkge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpO1xuXG4gICAgLy8gdGhpcyBkb2Vzbid0IHdvcmsgaW4gSUUsIGZvcmNlIHNpemVcbiAgICAvLyBpbWcuc3R5bGUuaGVpZ2h0ID0gaW1nLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIGltZy5zdHlsZS53aWR0aCA9IHRoaXMuX3NpemUueCArICdweCc7XG4gICAgaW1nLnN0eWxlLmhlaWdodCA9IHRoaXMuX3NpemUueSArICdweCc7XG4gICAgaW1nLnNyYyA9IHRoaXMudG9CYXNlNjQoKTtcblxuICAgIC8vIGhhY2sgdG8gdHJpY2sgSUUgcmVuZGVyaW5nIGVuZ2luZVxuICAgIEwuRG9tRXZlbnQub24oaW1nLCAnbG9hZCcsICgpID0+IHtcbiAgICAgIEwucG9pbnQoaW1nLm9mZnNldFdpZHRoLCBpbWcub2Zmc2V0SGVpZ2h0KTtcbiAgICAgIHRoaXMuX3Jlc2V0KCk7XG4gICAgfSk7XG4gICAgaW1nLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgIGltZy5zdHlsZS56SW5kZXggPSAtOTk5OTtcbiAgICBpbWcuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcblxuICAgIGlmICh0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Jhc3Rlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3Jhc3Rlcik7XG4gICAgICB0aGlzLl9yYXN0ZXIgPSBudWxsO1xuICAgIH1cblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyhpbWcsICdzY2hlbWF0aWMtaW1hZ2UnKTtcbiAgICB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyLnBhcmVudE5vZGVcbiAgICAgIC5pbnNlcnRCZWZvcmUoaW1nLCB0aGlzLl9yZW5kZXJlci5fY29udGFpbmVyKTtcbiAgICB0aGlzLl9yYXN0ZXIgPSBpbWc7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ29udmVydCBTVkcgZGF0YSB0byBiYXNlNjQgZm9yIHJhc3Rlcml6YXRpb25cbiAgICogQHJldHVybiB7U3RyaW5nfSBiYXNlNjQgZW5jb2RlZCBTVkdcbiAgICovXG4gIHRvQmFzZTY0KCkge1xuICAgIC8vIGNvbnNvbGUudGltZSgnYmFzZTY0Jyk7XG4gICAgY29uc3QgYmFzZTY0ID0gdGhpcy5fYmFzZTY0ZW5jb2RlZCB8fFxuICAgICAgYjY0LmJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHRoaXMuX3Byb2Nlc3NlZERhdGEpKSk7XG4gICAgdGhpcy5fYmFzZTY0ZW5jb2RlZCA9IGJhc2U2NDtcbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ2Jhc2U2NCcpO1xuXG4gICAgcmV0dXJuICdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LCcgKyBiYXNlNjQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogUmVkcmF3IGNhbnZhcyBvbiByZWFsIGNoYW5nZXM6IHpvb20sIHZpZXdyZXNldFxuICAgKiBAcGFyYW0gIHtMLlBvaW50fSB0b3BMZWZ0XG4gICAqIEBwYXJhbSAge051bWJlcn0gIHNjYWxlXG4gICAqL1xuICBfcmVkcmF3Q2FudmFzKHRvcExlZnQsIHNjYWxlKSB7XG4gICAgaWYgKCF0aGlzLl9yYXN0ZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzaXplID0gdGhpcy5nZXRPcmlnaW5hbFNpemUoKS5tdWx0aXBseUJ5KHNjYWxlKTtcbiAgICBjb25zdCBjdHggPSB0aGlzLl9jYW52YXNSZW5kZXJlci5fY3R4O1xuXG4gICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24gKCkge1xuICAgICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9yYXN0ZXIsIHRvcExlZnQueCwgdG9wTGVmdC55LCBzaXplLngsIHNpemUueSk7XG4gICAgfSwgdGhpcyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogVG9nZ2xlIGNhbnZhcyBpbnN0ZWFkIG9mIFNWRyB3aGVuIGRyYWdnaW5nXG4gICAqL1xuICBfc2hvd1Jhc3RlcigpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIgJiYgIXRoaXMuX3Jhc3RlclNob3duKSB7XG4gICAgICAvLyBjb25zb2xlLnRpbWUoJ3Nob3cnKTtcbiAgICAgIC8vIGBkaXNwbGF5YCBydWxlIHNvbWVob3cgYXBwZWFycyB0byBiZSBmYXN0ZXIgaW4gSUUsIEZGXG4gICAgICAvLyB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgICB0aGlzLl9jYW52YXNSZW5kZXJlci5fY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHRoaXMuX3Jhc3RlclNob3duID0gdHJ1ZTtcbiAgICAgIC8vIGNvbnNvbGUudGltZUVuZCgnc2hvdycpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTd2FwIGJhY2sgdG8gU1ZHXG4gICAqL1xuICBfaGlkZVJhc3RlcigpIHtcbiAgICBpZiAodGhpcy5fY2FudmFzUmVuZGVyZXIgJiYgdGhpcy5fcmFzdGVyU2hvd24pIHtcbiAgICAgIC8vIGNvbnNvbGUudGltZSgnaGlkZScpO1xuICAgICAgLy8gYGRpc3BsYXlgIHJ1bGUgc29tZWhvdyBhcHBlYXJzIHRvIGJlIGZhc3RlciBpbiBJRSwgRkZcbiAgICAgIC8vIHRoaXMuX2NhbnZhc1JlbmRlcmVyLl9jb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgdGhpcy5fY2FudmFzUmVuZGVyZXIuX2NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgdGhpcy5fZ3JvdXAuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICB0aGlzLl9yYXN0ZXJTaG93biA9IGZhbHNlO1xuICAgICAgLy8gY29uc29sZS50aW1lRW5kKCdoaWRlJyk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIElFLW9ubHlcbiAgICogUmVwbGFjZSBTVkcgd2l0aCBjYW52YXMgYmVmb3JlIGRyYWdcbiAgICovXG4gIF9vblByZURyYWcoKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy51c2VSYXN0ZXIpIHtcbiAgICAgIHRoaXMuX3Nob3dSYXN0ZXIoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogRHJhZyBlbmQ6IHB1dCBTVkcgYmFjayBpbiBJRVxuICAgKi9cbiAgX29uRHJhZ0VuZCgpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZVJhc3Rlcikge1xuICAgICAgdGhpcy5faGlkZVJhc3RlcigpO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vLyBhbGlhc2VzXG5MLlNjaGVtYXRpYy5wcm90b3R5cGUucHJvamVjdCA9IEwuU2NoZW1hdGljLnByb3RvdHlwZS5wcm9qZWN0UG9pbnQ7XG5MLlNjaGVtYXRpYy5wcm90b3R5cGUudW5wcm9qZWN0ID0gTC5TY2hlbWF0aWMucHJvdG90eXBlLnVucHJvamVjdFBvaW50O1xuXG5cbi8qKlxuICogRmFjdG9yeVxuICogQHBhcmFtICB7U3RyaW5nfSAgICAgICAgIHN2ZyAgICAgU1ZHIHN0cmluZyBvciBVUkxcbiAqIEBwYXJhbSAge0wuTGF0TG5nQm91bmRzfSBib3VuZHNcbiAqIEBwYXJhbSAge09iamVjdD19ICAgICAgICBvcHRpb25zXG4gKiBAcmV0dXJuIHtMLlNjaGVtYXRpY31cbiAqL1xuTC5zY2hlbWF0aWMgPSBmdW5jdGlvbiAoc3ZnLCBib3VuZHMsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMLlNjaGVtYXRpYyhzdmcsIGJvdW5kcywgb3B0aW9ucyk7XG59O1xuIiwiY29uc3QgTCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydMJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydMJ10gOiBudWxsKTtcblxuTC5Ccm93c2VyLnBoYW50b21qcyA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdwaGFudG9tJyk7XG5cbi8vIDx1c2U+IHRhZ3MgYXJlIGJyb2tlbiBpbiBJRSBpbiBzbyBtYW55IHdheXNcbmlmICgnU1ZHRWxlbWVudEluc3RhbmNlJyBpbiB3aW5kb3cpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNWR0VsZW1lbnRJbnN0YW5jZS5wcm90b3R5cGUsICdjbGFzc05hbWUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgdGhpcy5jb3JyZXNwb25kaW5nRWxlbWVudC5jbGFzc05hbWUuYmFzZVZhbCA9IHZhbDtcbiAgICB9XG4gIH0pO1xufVxuXG5cbi8qKlxuICogQHBhcmFtICB7Kn0gIG9cbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbkwuRG9tVXRpbC5pc05vZGUgPSBmdW5jdGlvbiAobykge1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBOb2RlID09PSAnb2JqZWN0JyA/XG4gICAgICBvIGluc3RhbmNlb2YgTm9kZSA6XG4gICAgICBvICYmIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJlxuICAgICAgdHlwZW9mIG8ubm9kZVR5cGUgPT09ICdudW1iZXInICYmXG4gICAgICB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZydcbiAgKTtcbn07XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTVkdFbGVtZW50fSBzdmdcbiAqIEByZXR1cm4ge0FycmF5LjxOdW1iZXI+fVxuICovXG5MLkRvbVV0aWwuZ2V0U1ZHQkJveCA9IChzdmcpID0+IHtcbiAgbGV0IHN2Z0JCb3g7XG4gIGNvbnN0IHdpZHRoID0gcGFyc2VJbnQoc3ZnLmdldEF0dHJpYnV0ZSgnd2lkdGgnKSwgMTApO1xuICBjb25zdCBoZWlnaHQgPSBwYXJzZUludChzdmcuZ2V0QXR0cmlidXRlKCdoZWlnaHQnKSwgMTApO1xuICBjb25zdCB2aWV3Qm94ID0gc3ZnLmdldEF0dHJpYnV0ZSgndmlld0JveCcpO1xuICBsZXQgYmJveDtcblxuICBpZiAodmlld0JveCkge1xuICAgIGJib3ggPSB2aWV3Qm94LnNwbGl0KCcgJykubWFwKHBhcnNlRmxvYXQpO1xuICAgIHN2Z0JCb3ggPSBbYmJveFswXSwgYmJveFsxXSwgYmJveFswXSArIGJib3hbMl0sIGJib3hbMV0gKyBiYm94WzNdXTtcbiAgfSBlbHNlIGlmICh3aWR0aCAmJiBoZWlnaHQpIHtcbiAgICBzdmdCQm94ID0gWzAsIDAsIHdpZHRoLCBoZWlnaHRdO1xuICB9IGVsc2UgeyAvL0NhbGN1bGF0ZSByZW5kZXJlZCBzaXplXG4gICAgY29uc3QgY2xvbmUgPSBzdmcuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNsb25lLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBjbG9uZS5zdHlsZS50b3AgPSAwO1xuICAgIGNsb25lLnN0eWxlLmxlZnQgPSAwO1xuICAgIGNsb25lLnN0eWxlLnpJbmRleCA9IC0xO1xuICAgIGNsb25lLnN0eWxlLm9wYWNpdHkgPSAwO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjbG9uZSk7XG5cbiAgICBpZiAoY2xvbmUuY2xpZW50V2lkdGggJiYgY2xvbmUuY2xpZW50SGVpZ2h0KSB7XG4gICAgICBzdmdCQm94ID0gWzAsIDAsIGNsb25lLmNsaWVudFdpZHRoLCBjbG9uZS5jbGllbnRIZWlnaHRdO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdmdCQm94ID0gY2FsY1NWR1ZpZXdCb3hGcm9tTm9kZXMoY2xvbmUpO1xuICAgIH1cblxuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoY2xvbmUpO1xuICB9XG4gIHJldHVybiBzdmdCQm94O1xufTtcblxuXG4vKipcbiAqIFNpbXBseSBicnV0ZSBmb3JjZTogdGFrZXMgYWxsIHN2ZyBub2RlcywgY2FsY3VsYXRlcyBib3VuZGluZyBib3hcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR9IHN2Z1xuICogQHJldHVybiB7QXJyYXkuPE51bWJlcj59XG4gKi9cbmZ1bmN0aW9uIGNhbGNTVkdWaWV3Qm94RnJvbU5vZGVzKHN2Zykge1xuICBjb25zdCBiYm94ID0gW0luZmluaXR5LCBJbmZpbml0eSwgLUluZmluaXR5LCAtSW5maW5pdHldO1xuICBjb25zdCBub2RlcyA9IFtdLnNsaWNlLmNhbGwoc3ZnLnF1ZXJ5U2VsZWN0b3JBbGwoJyonKSk7XG4gIGNvbnN0IHsgbWluLCBtYXggfSA9IE1hdGgubWF4O1xuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBub2Rlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBub2RlID0gbm9kZXNbaV07XG4gICAgaWYgKG5vZGUuZ2V0QkJveCkge1xuICAgICAgbm9kZSA9IG5vZGUuZ2V0QkJveCgpO1xuXG4gICAgICBiYm94WzBdID0gbWluKG5vZGUueCwgYmJveFswXSk7XG4gICAgICBiYm94WzFdID0gbWluKG5vZGUueSwgYmJveFsxXSk7XG5cbiAgICAgIGJib3hbMl0gPSBtYXgobm9kZS54ICsgbm9kZS53aWR0aCwgYmJveFsyXSk7XG4gICAgICBiYm94WzNdID0gbWF4KG5vZGUueSArIG5vZGUuaGVpZ2h0LCBiYm94WzNdKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGJib3g7XG59XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U1ZHRWxlbWVudH1cbiAqL1xuTC5Eb21VdGlsLmdldFNWR0NvbnRhaW5lciA9IChzdHIpID0+IHtcbiAgY29uc3Qgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB3cmFwcGVyLmlubmVySFRNTCA9IHN0cjtcbiAgcmV0dXJuIHdyYXBwZXIucXVlcnlTZWxlY3Rvcignc3ZnJyk7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5Qb2ludH0gdHJhbnNsYXRlXG4gKiBAcGFyYW0gIHtOdW1iZXJ9ICBzY2FsZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5MLkRvbVV0aWwuZ2V0TWF0cml4U3RyaW5nID0gKHRyYW5zbGF0ZSwgc2NhbGUpID0+IHtcbiAgcmV0dXJuICdtYXRyaXgoJyArXG4gICAgW3NjYWxlLCAwLCAwLCBzY2FsZSwgdHJhbnNsYXRlLngsIHRyYW5zbGF0ZS55XS5qb2luKCcsJykgKyAnKSc7XG59O1xuXG5cbi8qKlxuICogQHBhcmFtICB7U1ZHRWxlbWVudH0gICAgICAgICBzdmdcbiAqIEBwYXJhbSAge1NWR0VsZW1lbnR8RWxlbWVudH0gY29udGFpbmVyXG4gKi9cbkwuU1ZHLmNvcHlTVkdDb250ZW50cyA9IChzdmcsIGNvbnRhaW5lcikgPT4ge1xuICAvLyBTVkcgaW5uZXJIVE1MIGRvZXNuJ3Qgd29yayBmb3IgU1ZHIGluIElFIGFuZCBQaGFudG9tSlNcbiAgaWYgKEwuQnJvd3Nlci5pZSB8fCBMLkJyb3dzZXIucGhhbnRvbWpzKSB7XG4gICAgbGV0IGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgZG8ge1xuICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgICAgIGNoaWxkID0gc3ZnLmZpcnN0Q2hpbGQ7XG4gICAgfSB3aGlsZSAoY2hpbGQpO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBzdmcuaW5uZXJIVE1MO1xuICB9XG59O1xuIl19
