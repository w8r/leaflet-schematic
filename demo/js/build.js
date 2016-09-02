(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).Schematic = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;
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
    useRaster: true,
    load: function load(url, callback) {
      xhr({
        uri: url,
        headers: {
          "Content-Type": "image/svg+xml"
        }
      }, function (err, resp, svg) {
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
},{"../../src/schematic":14,"./editable":1,"browser-filesaver":4,"xhr":10}],3:[function(require,module,exports){
;(function () {

  var object = typeof exports != 'undefined' ? exports : self; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    var str = String(input);
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next str index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      str.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = str.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    var str = String(input).replace(/=+$/, '');
    if (str.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = str.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());

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
var isFunction = require('is-function')

module.exports = forEach

var toString = Object.prototype.toString
var hasOwnProperty = Object.prototype.hasOwnProperty

function forEach(list, iterator, context) {
    if (!isFunction(iterator)) {
        throw new TypeError('iterator must be a function')
    }

    if (arguments.length < 3) {
        context = this
    }
    
    if (toString.call(list) === '[object Array]')
        forEachArray(list, iterator, context)
    else if (typeof list === 'string')
        forEachString(list, iterator, context)
    else
        forEachObject(list, iterator, context)
}

function forEachArray(array, iterator, context) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            iterator.call(context, array[i], i, array)
        }
    }
}

function forEachString(string, iterator, context) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        iterator.call(context, string.charAt(i), i, string)
    }
}

function forEachObject(object, iterator, context) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            iterator.call(context, object[k], k, object)
        }
    }
}

},{"is-function":7}],6:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
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
  )

  return result
}
},{"for-each":5,"trim":9}],9:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],10:[function(require,module,exports){
"use strict";
var window = require("global/window")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
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
            loadFunc()
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

    var failureResponse = {
                body: undefined,
                headers: {},
                statusCode: 0,
                method: method,
                url: uri,
                rawRequest: xhr
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
    var body = options.body || options.data || null
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer

    if ("json" in options) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
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
            aborted=true//IE9 may still call readystatechange
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

    xhr.send(body)

    return xhr


}

function getXml(xhr) {
    if (xhr.responseType === "document") {
        return xhr.responseXML
    }
    var firefoxBugTakenEffect = xhr.status === 204 && xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror"
    if (xhr.responseType === "" && !firefoxBugTakenEffect) {
        return xhr.responseXML
    }

    return null
}

function noop() {}

},{"global/window":6,"is-function":7,"parse-headers":8,"xtend":11}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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
  var max = this.max;
  var min = this.min;
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
},{}],13:[function(require,module,exports){
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
},{}],14:[function(require,module,exports){
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

      canvasRenderer._container.style.visibility = 'hidden';
    }
  },

  /**
   * @param  {L.Map} map
   */
  onRemove: function onRemove(map) {
    this._group.parentNode.removeChild(this._group);
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

    if (parseFloat(this._initialWidth) !== width || parseFloat(this._initialHeight) !== height) {
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
      this.toImage();
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
    return string ? node.outerHTML : node;
  },

  /**
  * Rasterizes the schematic
  * @return {Schematic}
  */
  toImage: function toImage() {
    var img = new Image();

    // this doesn't work in IE, force size
    // img.style.height = img.style.width = '100%';
    img.style.width = this._size.x + 'px';
    img.style.height = this._size.y + 'px';
    img.src = this.toBase64();

    // hack to trick IE rendering engine
    L.DomEvent.on(img, 'load', function () {
      L.point(img.offsetWidth, img.offsetHeight);
      this._reset();
    }, this);
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
      this._canvasRenderer._container.style.visibility = 'visible';
      this._group.style.display = 'none';
      this._rasterShown = true;
    }
  },

  /**
   * Swap back to SVG
   */
  _hideRaster: function _hideRaster() {
    if (this._canvasRenderer && this._rasterShown) {
      this._canvasRenderer._container.style.visibility = 'hidden';
      this._group.style.display = 'block';
      this._rasterShown = false;
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
},{"./bounds":12,"./renderer":13,"./utils":15,"Base64":3}],15:[function(require,module,exports){
(function (global){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

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
  var svgBBox;
  var width = parseInt(svg.getAttribute('width'), 10);
  var height = parseInt(svg.getAttribute('height'), 10);
  var viewBox = svg.getAttribute('viewBox');
  var bbox;

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
  var min = Math.min,
      max = Math.max;

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
},{}]},{},[2])(2)
});