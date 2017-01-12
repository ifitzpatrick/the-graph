(function (context) {
  "use strict";

  var defaultNodeSize = 72;
  var defaultNodeRadius = 8;

  // Dumb module setup
  var TheGraph = context.TheGraph = {
    // nodeSize and nodeRadius are deprecated, use TheGraph.config.(nodeSize/nodeRadius)
    nodeSize: defaultNodeSize,
    nodeRadius: defaultNodeRadius,
    nodeSide: 56,
    // Context menus
    contextPortSize: 36,
    // Zoom breakpoints
    zbpBig: 1.2,
    zbpNormal: 0.4,
    zbpSmall: 0.01,
    config: {
      nodeSize: defaultNodeSize,
      nodeWidth: defaultNodeSize,
      nodeRadius: defaultNodeRadius,
      groupRadius: 0,
      nodeHeight: defaultNodeSize,
      exportHeight: 50,
      exportWidth: 0,
      nodePaddingTop: 0,
      autoSizeNode: true,
      maxPortCount: 9,
      nodeHeightIncrement: 12,
      focusAnimationDuration: 300,
      // Port routes determined by component spec port type instead of edge type
      constantPortRoute: false,
      typeRoutes: {
        'any': 0,
        'bang': 0,
        'string': 1,
        'boolean': 2,
        'integer': 3,
        'number': 3,
        'object': 4,
        'array': 4,
      },
      groupOffsetX: defaultNodeSize/2,
      groupOffsetY: defaultNodeSize/2,
      groupPaddingX: defaultNodeSize*0.5,
      groupPaddingY: defaultNodeSize*0.5
    },
    factories: {}
  };

  // rAF shim
  window.requestAnimationFrame = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.msRequestAnimationFrame;

  // Mixins to use throughout project
  TheGraph.mixins = {};

  // Show fake tooltip
  // Class must have getTooltipTrigger (dom node) and shouldShowTooltip (boolean)
  TheGraph.mixins.Tooltip = {
    showTooltip: function (event) {
      if ( !this.shouldShowTooltip() ) { return; }

      var tooltipEvent = new CustomEvent('the-graph-tooltip', {
        detail: {
          tooltip: this.props.label,
          x: event.clientX || event.x,
          y: event.clientY || event.y
        }, 
        bubbles: true
      });
      ReactDOM.findDOMNode(this).dispatchEvent(tooltipEvent);
    },
    hideTooltip: function (event) {
      if ( !this.shouldShowTooltip() ) { return; }

      var tooltipEvent = new CustomEvent('the-graph-tooltip-hide', {
        bubbles: true
      });
      if (this.isMounted()) {
        ReactDOM.findDOMNode(this).dispatchEvent(tooltipEvent);
      }
    },
    componentDidMount: function () {
      if (navigator && navigator.userAgent.indexOf("Firefox") !== -1) {
        // HACK Ff does native tooltips on svg elements
        return;
      }
      var tooltipper = this.getTooltipTrigger();
      tooltipper.addEventListener("tap", this.showTooltip);
      tooltipper.addEventListener("mouseenter", this.showTooltip);
      tooltipper.addEventListener("mouseleave", this.hideTooltip);
    }
  };

  TheGraph.findMinMax = function (graph, nodes, inports, outports) {
    if (nodes === undefined && inports === undefined && outports == undefined) {
      nodes = graph.nodes.map(function (node) {
        return node.id;
      });
      // Only look at exports when calculating the whole graph
      inports = Object.keys(graph.inports);
      outports = Object.keys(graph.outports);
    }

    if (nodes.length < 1 && !inports && !outports) {
      return undefined;
    }
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    var allNodes = [];
    // Loop through nodes
    var len = nodes.length;
    for (var i=0; i<len; i++) {
      var key = nodes[i];
      var node = graph.getNode(key);
      if (!node || !node.metadata) {
        continue;
      }
      allNodes.push(node);
    }
    // Loop through exports
    var keys, exp;
    if (inports) {
      len = inports.length;
      for (i=0; i<len; i++) {
        exp = graph.inports[inports[i]];
        if (!exp.metadata) { continue; }
        allNodes.push(exp);
      }
    }
    if (outports) {
      len = outports.length;
      for (i=0; i<len; i++) {
        exp = graph.outports[outports[i]];
        if (!exp.metadata) { continue; }
        allNodes.push(exp);
      }
    }

    for (i=0, len=allNodes.length; i<len; i++) {
      var node = allNodes[i];
      if (node.metadata.x < minX) { minX = node.metadata.x; }
      if (node.metadata.y < minY) { minY = node.metadata.y; }
      var x = node.metadata.x + node.metadata.width;
      var y = node.metadata.y + node.metadata.height;
      if (x > maxX) { maxX = x; }
      if (y > maxY) { maxY = y; }
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY
    };
  };

  TheGraph.findFit = function (graph, width, height) {
    var limits = TheGraph.findMinMax(graph);
    if (!limits) {
      return {x:0, y:0, scale:1};
    }
    limits.minX -= TheGraph.config.nodeSize;
    limits.minY -= TheGraph.config.nodeSize;
    limits.maxX += TheGraph.config.nodeSize * 2;
    limits.maxY += TheGraph.config.nodeSize * 2;

    var gWidth = limits.maxX - limits.minX;
    var gHeight = limits.maxY - limits.minY;

    var scaleX = width / gWidth;
    var scaleY = height / gHeight;

    var scale, x, y;
    if (scaleX < scaleY) {
      scale = scaleX;
      x = 0 - limits.minX * scale;
      y = 0 - limits.minY * scale + (height-(gHeight*scale))/2;
    } else {
      scale = scaleY;
      x = 0 - limits.minX * scale + (width-(gWidth*scale))/2;
      y = 0 - limits.minY * scale;
    }

    return {
      x: x,
      y: y,
      scale: scale
    };
  };

  TheGraph.findAreaFit = function (point1, point2, width, height) {
    var limits = {
      minX: point1.x < point2.x ? point1.x : point2.x,
      minY: point1.y < point2.y ? point1.y : point2.y,
      maxX: point1.x > point2.x ? point1.x : point2.x,
      maxY: point1.y > point2.y ? point1.y : point2.y
    };

    limits.minX -= TheGraph.config.nodeSize;
    limits.minY -= TheGraph.config.nodeSize;
    limits.maxX += TheGraph.config.nodeSize * 2;
    limits.maxY += TheGraph.config.nodeSize * 2;

    var gWidth = limits.maxX - limits.minX;
    var gHeight = limits.maxY - limits.minY;

    var scaleX = width / gWidth;
    var scaleY = height / gHeight;

    var scale, x, y;
    if (scaleX < scaleY) {
      scale = scaleX;
      x = 0 - limits.minX * scale;
      y = 0 - limits.minY * scale + (height-(gHeight*scale))/2;
    } else {
      scale = scaleY;
      x = 0 - limits.minX * scale + (width-(gWidth*scale))/2;
      y = 0 - limits.minY * scale;
    }

    return {
      x: x,
      y: y,
      scale: scale
    };
  };

  TheGraph.findNodeFit = function (node, width, height) {
    var limits = {
      minX: node.metadata.x - TheGraph.config.nodeSize,
      minY: node.metadata.y - TheGraph.config.nodeSize,
      maxX: node.metadata.x + TheGraph.config.nodeSize * 2,
      maxY: node.metadata.y + TheGraph.config.nodeSize * 2
    };

    var gWidth = limits.maxX - limits.minX;
    var gHeight = limits.maxY - limits.minY;

    var scaleX = width / gWidth;
    var scaleY = height / gHeight;

    var scale, x, y;
    if (scaleX < scaleY) {
      scale = scaleX;
      x = 0 - limits.minX * scale;
      y = 0 - limits.minY * scale + (height-(gHeight*scale))/2;
    } else {
      scale = scaleY;
      x = 0 - limits.minX * scale + (width-(gWidth*scale))/2;
      y = 0 - limits.minY * scale;
    }

    return {
      x: x,
      y: y,
      scale: scale
    };
  };

  // SVG arc math
  var angleToX = function (percent, radius) {
    return radius * Math.cos(2*Math.PI * percent);
  };
  var angleToY = function (percent, radius) {
    return radius * Math.sin(2*Math.PI * percent);
  };
  var makeArcPath = function (startPercent, endPercent, radius) {
    return [ 
      "M", angleToX(startPercent, radius), angleToY(startPercent, radius),
      "A", radius, radius, 0, 0, 0, angleToX(endPercent, radius), angleToY(endPercent, radius)
    ].join(" ");
  };
  TheGraph.arcs = {
    n4: makeArcPath(7/8, 5/8, 36),
    s4: makeArcPath(3/8, 1/8, 36),
    e4: makeArcPath(1/8, -1/8, 36),
    w4: makeArcPath(5/8, 3/8, 36),
    inport: makeArcPath(-1/4, 1/4, 4),
    outport: makeArcPath(1/4, -1/4, 4),
    inportBig: makeArcPath(-1/4, 1/4, 6),
    outportBig: makeArcPath(1/4, -1/4, 6),
  };


  // Reusable React classes
  TheGraph.SVGImage = React.createFactory( React.createClass({
    displayName: "TheGraphSVGImage",
    render: function () {
        var html = '<image ';
        html = html +'xlink:href="'+ this.props.src + '"';
        html = html +'x="' + this.props.x + '"';
        html = html +'y="' + this.props.y + '"';
        html = html +'width="' + this.props.width + '"';
        html = html +'height="' + this.props.height + '"';
        html = html +'/>';

        return React.DOM.g({
            className: this.props.className,
            dangerouslySetInnerHTML:{__html: html}
        });
    }
  }));

  TheGraph.TextBG = React.createFactory( React.createClass({
    displayName: "TheGraphTextBG",
    render: function () {
      var text = this.props.text;
      if (!text) {
        text = "";
      }
      var height = this.props.height;
      var width = text.length * this.props.height * 2/3;
      var radius = this.props.height/2;

      var textAnchor = "start";
      var dominantBaseline = "central";
      var x = this.props.x;
      var y = this.props.y - height/2;

      if (this.props.halign === "center") {
        x -= width/2;
        textAnchor = "middle";
      }
      if (this.props.halign === "right") {
        x -= width;
        textAnchor = "end";
      }

      return React.DOM.g(
        {
          className: (this.props.className ? this.props.className : "text-bg"),
        },
        React.DOM.rect({
          className: "text-bg-rect",
          x: x,
          y: y,
          rx: radius,
          ry: radius,
          height: height * 1.1,
          width: width
        }),
        React.DOM.text({
          className: (this.props.textClassName ? this.props.textClassName : "text-bg-text"),
          x: this.props.x,
          y: this.props.y,
          children: text
        })
      );
    }
  }));

  TheGraph.isObject = function (value) {
    return !(
      Array.isArray(value) ||
      typeof value !== 'object'
    );
  };

  // The `merge` function provides simple property merging.
  TheGraph.merge = function (src, dest, overwrite) {
    // Do nothing if neither are true objects.
    if (!TheGraph.isObject(src) || !TheGraph.isObject(dest)) return dest;

    // Default overwriting of existing properties to false.
    overwrite = overwrite || false;

    for (var key in src) {
      // Only copy properties, not functions.
      if (typeof src[key] !== 'function' && (dest[key] === undefined || dest[key] === null || overwrite))
        dest[key] = src[key];
    }

    return dest;
  };

  TheGraph.mergeDeep = function (src, dest) {
    Object.keys(src).forEach(function (key) {
      var value = src[key];
      if (TheGraph.isObject(value)) {
        dest[key] = TheGraph.mergeDeep(value, dest[key] || {});
      } else {
        dest[key] = value;
      }
    });
    return dest;
  };

  TheGraph.factories.createGroup = function (options, content) {
    var args = [options];

    if (Array.isArray(content)) {
      args = args.concat(content);
    }

    return React.DOM.g.apply(React.DOM.g, args);
  };

  TheGraph.factories.createRect = function (options) {
    return React.DOM.rect(options);
  };

  TheGraph.factories.createText = function (options) {
    return React.DOM.text(options);
  };

  TheGraph.factories.createCircle = function (options) {
    return React.DOM.circle(options);
  };

  TheGraph.factories.createPath = function (options) {
    return React.DOM.path(options);
  };

  TheGraph.factories.createPolygon = function (options) {
    return React.DOM.polygon(options);
  };

  TheGraph.factories.createImg = function (options) {
    return TheGraph.SVGImage(options);
  };

  TheGraph.factories.createCanvas = function (options) {
    return React.DOM.canvas(options);
  };

  TheGraph.factories.createSvg = function (options, content) {

    var args = [options];

    if (Array.isArray(content)) {
      args = args.concat(content);
    }

    return React.DOM.svg.apply(React.DOM.svg, args);
  };

  TheGraph.getOffset = function (domNode) {
    var getElementOffset = function (element) {
      var offset = { top: 0, left: 0},
          parentOffset;
      if(!element){
        return offset;
      }
      offset.top += (element.offsetTop || 0);
      offset.left += (element.offsetLeft || 0);
      parentOffset = getElementOffset(element.offsetParent);
      offset.top += parentOffset.top;
      offset.left += parentOffset.left;
      return offset;
    };
    try{
      return getElementOffset( domNode );
    }catch(e){
      return getElementOffset();
    }
  };

})(this);
;/*
  this file is generated via `grunt build` 
*/

(function (context) {
"use strict";

context.TheGraph.FONT_AWESOME = {
  "500px": "",
  "adjust": "",
  "adn": "",
  "align-center": "",
  "align-justify": "",
  "align-left": "",
  "align-right": "",
  "amazon": "",
  "ambulance": "",
  "american-sign-language-interpreting": "",
  "anchor": "",
  "android": "",
  "angellist": "",
  "angle-double-down": "",
  "angle-double-left": "",
  "angle-double-right": "",
  "angle-double-up": "",
  "angle-down": "",
  "angle-left": "",
  "angle-right": "",
  "angle-up": "",
  "apple": "",
  "archive": "",
  "area-chart": "",
  "arrow-circle-down": "",
  "arrow-circle-left": "",
  "arrow-circle-o-down": "",
  "arrow-circle-o-left": "",
  "arrow-circle-o-right": "",
  "arrow-circle-o-up": "",
  "arrow-circle-right": "",
  "arrow-circle-up": "",
  "arrow-down": "",
  "arrow-left": "",
  "arrow-right": "",
  "arrow-up": "",
  "arrows": "",
  "arrows-alt": "",
  "arrows-h": "",
  "arrows-v": "",
  "asl-interpreting": "",
  "assistive-listening-systems": "",
  "asterisk": "",
  "at": "",
  "audio-description": "",
  "automobile": "",
  "backward": "",
  "balance-scale": "",
  "ban": "",
  "bank": "",
  "bar-chart": "",
  "bar-chart-o": "",
  "barcode": "",
  "bars": "",
  "battery-0": "",
  "battery-1": "",
  "battery-2": "",
  "battery-3": "",
  "battery-4": "",
  "battery-empty": "",
  "battery-full": "",
  "battery-half": "",
  "battery-quarter": "",
  "battery-three-quarters": "",
  "bed": "",
  "beer": "",
  "behance": "",
  "behance-square": "",
  "bell": "",
  "bell-o": "",
  "bell-slash": "",
  "bell-slash-o": "",
  "bicycle": "",
  "binoculars": "",
  "birthday-cake": "",
  "bitbucket": "",
  "bitbucket-square": "",
  "bitcoin": "",
  "black-tie": "",
  "blind": "",
  "bluetooth": "",
  "bluetooth-b": "",
  "bold": "",
  "bolt": "",
  "bomb": "",
  "book": "",
  "bookmark": "",
  "bookmark-o": "",
  "braille": "",
  "briefcase": "",
  "btc": "",
  "bug": "",
  "building": "",
  "building-o": "",
  "bullhorn": "",
  "bullseye": "",
  "bus": "",
  "buysellads": "",
  "cab": "",
  "calculator": "",
  "calendar": "",
  "calendar-check-o": "",
  "calendar-minus-o": "",
  "calendar-o": "",
  "calendar-plus-o": "",
  "calendar-times-o": "",
  "camera": "",
  "camera-retro": "",
  "car": "",
  "caret-down": "",
  "caret-left": "",
  "caret-right": "",
  "caret-square-o-down": "",
  "caret-square-o-left": "",
  "caret-square-o-right": "",
  "caret-square-o-up": "",
  "caret-up": "",
  "cart-arrow-down": "",
  "cart-plus": "",
  "cc": "",
  "cc-amex": "",
  "cc-diners-club": "",
  "cc-discover": "",
  "cc-jcb": "",
  "cc-mastercard": "",
  "cc-paypal": "",
  "cc-stripe": "",
  "cc-visa": "",
  "certificate": "",
  "chain": "",
  "chain-broken": "",
  "check": "",
  "check-circle": "",
  "check-circle-o": "",
  "check-square": "",
  "check-square-o": "",
  "chevron-circle-down": "",
  "chevron-circle-left": "",
  "chevron-circle-right": "",
  "chevron-circle-up": "",
  "chevron-down": "",
  "chevron-left": "",
  "chevron-right": "",
  "chevron-up": "",
  "child": "",
  "chrome": "",
  "circle": "",
  "circle-o": "",
  "circle-o-notch": "",
  "circle-thin": "",
  "clipboard": "",
  "clock-o": "",
  "clone": "",
  "close": "",
  "cloud": "",
  "cloud-download": "",
  "cloud-upload": "",
  "cny": "",
  "code": "",
  "code-fork": "",
  "codepen": "",
  "codiepie": "",
  "coffee": "",
  "cog": "",
  "cogs": "",
  "columns": "",
  "comment": "",
  "comment-o": "",
  "commenting": "",
  "commenting-o": "",
  "comments": "",
  "comments-o": "",
  "compass": "",
  "compress": "",
  "connectdevelop": "",
  "contao": "",
  "copy": "",
  "copyright": "",
  "creative-commons": "",
  "credit-card": "",
  "credit-card-alt": "",
  "crop": "",
  "crosshairs": "",
  "css3": "",
  "cube": "",
  "cubes": "",
  "cut": "",
  "cutlery": "",
  "dashboard": "",
  "dashcube": "",
  "database": "",
  "deaf": "",
  "deafness": "",
  "dedent": "",
  "delicious": "",
  "desktop": "",
  "deviantart": "",
  "diamond": "",
  "digg": "",
  "dollar": "",
  "dot-circle-o": "",
  "download": "",
  "dribbble": "",
  "dropbox": "",
  "drupal": "",
  "edge": "",
  "edit": "",
  "eject": "",
  "ellipsis-h": "",
  "ellipsis-v": "",
  "empire": "",
  "envelope": "",
  "envelope-o": "",
  "envelope-square": "",
  "envira": "",
  "eraser": "",
  "eur": "",
  "euro": "",
  "exchange": "",
  "exclamation": "",
  "exclamation-circle": "",
  "exclamation-triangle": "",
  "expand": "",
  "expeditedssl": "",
  "external-link": "",
  "external-link-square": "",
  "eye": "",
  "eye-slash": "",
  "eyedropper": "",
  "fa": "",
  "facebook": "",
  "facebook-f": "",
  "facebook-official": "",
  "facebook-square": "",
  "fast-backward": "",
  "fast-forward": "",
  "fax": "",
  "feed": "",
  "female": "",
  "fighter-jet": "",
  "file": "",
  "file-archive-o": "",
  "file-audio-o": "",
  "file-code-o": "",
  "file-excel-o": "",
  "file-image-o": "",
  "file-movie-o": "",
  "file-o": "",
  "file-pdf-o": "",
  "file-photo-o": "",
  "file-picture-o": "",
  "file-powerpoint-o": "",
  "file-sound-o": "",
  "file-text": "",
  "file-text-o": "",
  "file-video-o": "",
  "file-word-o": "",
  "file-zip-o": "",
  "files-o": "",
  "film": "",
  "filter": "",
  "fire": "",
  "fire-extinguisher": "",
  "firefox": "",
  "first-order": "",
  "flag": "",
  "flag-checkered": "",
  "flag-o": "",
  "flash": "",
  "flask": "",
  "flickr": "",
  "floppy-o": "",
  "folder": "",
  "folder-o": "",
  "folder-open": "",
  "folder-open-o": "",
  "font": "",
  "font-awesome": "",
  "fonticons": "",
  "fort-awesome": "",
  "forumbee": "",
  "forward": "",
  "foursquare": "",
  "frown-o": "",
  "futbol-o": "",
  "gamepad": "",
  "gavel": "",
  "gbp": "",
  "ge": "",
  "gear": "",
  "gears": "",
  "genderless": "",
  "get-pocket": "",
  "gg": "",
  "gg-circle": "",
  "gift": "",
  "git": "",
  "git-square": "",
  "github": "",
  "github-alt": "",
  "github-square": "",
  "gitlab": "",
  "gittip": "",
  "glass": "",
  "glide": "",
  "glide-g": "",
  "globe": "",
  "google": "",
  "google-plus": "",
  "google-plus-circle": "",
  "google-plus-official": "",
  "google-plus-square": "",
  "google-wallet": "",
  "graduation-cap": "",
  "gratipay": "",
  "group": "",
  "h-square": "",
  "hacker-news": "",
  "hand-grab-o": "",
  "hand-lizard-o": "",
  "hand-o-down": "",
  "hand-o-left": "",
  "hand-o-right": "",
  "hand-o-up": "",
  "hand-paper-o": "",
  "hand-peace-o": "",
  "hand-pointer-o": "",
  "hand-rock-o": "",
  "hand-scissors-o": "",
  "hand-spock-o": "",
  "hand-stop-o": "",
  "hard-of-hearing": "",
  "hashtag": "",
  "hdd-o": "",
  "header": "",
  "headphones": "",
  "heart": "",
  "heart-o": "",
  "heartbeat": "",
  "history": "",
  "home": "",
  "hospital-o": "",
  "hotel": "",
  "hourglass": "",
  "hourglass-1": "",
  "hourglass-2": "",
  "hourglass-3": "",
  "hourglass-end": "",
  "hourglass-half": "",
  "hourglass-o": "",
  "hourglass-start": "",
  "houzz": "",
  "html5": "",
  "i-cursor": "",
  "ils": "",
  "image": "",
  "inbox": "",
  "indent": "",
  "industry": "",
  "info": "",
  "info-circle": "",
  "inr": "",
  "instagram": "",
  "institution": "",
  "internet-explorer": "",
  "intersex": "",
  "ioxhost": "",
  "italic": "",
  "joomla": "",
  "jpy": "",
  "jsfiddle": "",
  "key": "",
  "keyboard-o": "",
  "krw": "",
  "language": "",
  "laptop": "",
  "lastfm": "",
  "lastfm-square": "",
  "leaf": "",
  "leanpub": "",
  "legal": "",
  "lemon-o": "",
  "level-down": "",
  "level-up": "",
  "life-bouy": "",
  "life-buoy": "",
  "life-ring": "",
  "life-saver": "",
  "lightbulb-o": "",
  "line-chart": "",
  "link": "",
  "linkedin": "",
  "linkedin-square": "",
  "linux": "",
  "list": "",
  "list-alt": "",
  "list-ol": "",
  "list-ul": "",
  "location-arrow": "",
  "lock": "",
  "long-arrow-down": "",
  "long-arrow-left": "",
  "long-arrow-right": "",
  "long-arrow-up": "",
  "low-vision": "",
  "magic": "",
  "magnet": "",
  "mail-forward": "",
  "mail-reply": "",
  "mail-reply-all": "",
  "male": "",
  "map": "",
  "map-marker": "",
  "map-o": "",
  "map-pin": "",
  "map-signs": "",
  "mars": "",
  "mars-double": "",
  "mars-stroke": "",
  "mars-stroke-h": "",
  "mars-stroke-v": "",
  "maxcdn": "",
  "meanpath": "",
  "medium": "",
  "medkit": "",
  "meh-o": "",
  "mercury": "",
  "microphone": "",
  "microphone-slash": "",
  "minus": "",
  "minus-circle": "",
  "minus-square": "",
  "minus-square-o": "",
  "mixcloud": "",
  "mobile": "",
  "mobile-phone": "",
  "modx": "",
  "money": "",
  "moon-o": "",
  "mortar-board": "",
  "motorcycle": "",
  "mouse-pointer": "",
  "music": "",
  "navicon": "",
  "neuter": "",
  "newspaper-o": "",
  "object-group": "",
  "object-ungroup": "",
  "odnoklassniki": "",
  "odnoklassniki-square": "",
  "opencart": "",
  "openid": "",
  "opera": "",
  "optin-monster": "",
  "outdent": "",
  "pagelines": "",
  "paint-brush": "",
  "paper-plane": "",
  "paper-plane-o": "",
  "paperclip": "",
  "paragraph": "",
  "paste": "",
  "pause": "",
  "pause-circle": "",
  "pause-circle-o": "",
  "paw": "",
  "paypal": "",
  "pencil": "",
  "pencil-square": "",
  "pencil-square-o": "",
  "percent": "",
  "phone": "",
  "phone-square": "",
  "photo": "",
  "picture-o": "",
  "pie-chart": "",
  "pied-piper": "",
  "pied-piper-alt": "",
  "pied-piper-pp": "",
  "pinterest": "",
  "pinterest-p": "",
  "pinterest-square": "",
  "plane": "",
  "play": "",
  "play-circle": "",
  "play-circle-o": "",
  "plug": "",
  "plus": "",
  "plus-circle": "",
  "plus-square": "",
  "plus-square-o": "",
  "power-off": "",
  "print": "",
  "product-hunt": "",
  "puzzle-piece": "",
  "qq": "",
  "qrcode": "",
  "question": "",
  "question-circle": "",
  "question-circle-o": "",
  "quote-left": "",
  "quote-right": "",
  "ra": "",
  "random": "",
  "rebel": "",
  "recycle": "",
  "reddit": "",
  "reddit-alien": "",
  "reddit-square": "",
  "refresh": "",
  "registered": "",
  "remove": "",
  "renren": "",
  "reorder": "",
  "repeat": "",
  "reply": "",
  "reply-all": "",
  "resistance": "",
  "retweet": "",
  "rmb": "",
  "road": "",
  "rocket": "",
  "rotate-left": "",
  "rotate-right": "",
  "rouble": "",
  "rss": "",
  "rss-square": "",
  "rub": "",
  "ruble": "",
  "rupee": "",
  "safari": "",
  "save": "",
  "scissors": "",
  "scribd": "",
  "search": "",
  "search-minus": "",
  "search-plus": "",
  "sellsy": "",
  "send": "",
  "send-o": "",
  "server": "",
  "share": "",
  "share-alt": "",
  "share-alt-square": "",
  "share-square": "",
  "share-square-o": "",
  "shekel": "",
  "sheqel": "",
  "shield": "",
  "ship": "",
  "shirtsinbulk": "",
  "shopping-bag": "",
  "shopping-basket": "",
  "shopping-cart": "",
  "sign-in": "",
  "sign-language": "",
  "sign-out": "",
  "signal": "",
  "signing": "",
  "simplybuilt": "",
  "sitemap": "",
  "skyatlas": "",
  "skype": "",
  "slack": "",
  "sliders": "",
  "slideshare": "",
  "smile-o": "",
  "snapchat": "",
  "snapchat-ghost": "",
  "snapchat-square": "",
  "soccer-ball-o": "",
  "sort": "",
  "sort-alpha-asc": "",
  "sort-alpha-desc": "",
  "sort-amount-asc": "",
  "sort-amount-desc": "",
  "sort-asc": "",
  "sort-desc": "",
  "sort-down": "",
  "sort-numeric-asc": "",
  "sort-numeric-desc": "",
  "sort-up": "",
  "soundcloud": "",
  "space-shuttle": "",
  "spinner": "",
  "spoon": "",
  "spotify": "",
  "square": "",
  "square-o": "",
  "stack-exchange": "",
  "stack-overflow": "",
  "star": "",
  "star-half": "",
  "star-half-empty": "",
  "star-half-full": "",
  "star-half-o": "",
  "star-o": "",
  "steam": "",
  "steam-square": "",
  "step-backward": "",
  "step-forward": "",
  "stethoscope": "",
  "sticky-note": "",
  "sticky-note-o": "",
  "stop": "",
  "stop-circle": "",
  "stop-circle-o": "",
  "street-view": "",
  "strikethrough": "",
  "stumbleupon": "",
  "stumbleupon-circle": "",
  "subscript": "",
  "subway": "",
  "suitcase": "",
  "sun-o": "",
  "superscript": "",
  "support": "",
  "table": "",
  "tablet": "",
  "tachometer": "",
  "tag": "",
  "tags": "",
  "tasks": "",
  "taxi": "",
  "television": "",
  "tencent-weibo": "",
  "terminal": "",
  "text-height": "",
  "text-width": "",
  "th": "",
  "th-large": "",
  "th-list": "",
  "themeisle": "",
  "thumb-tack": "",
  "thumbs-down": "",
  "thumbs-o-down": "",
  "thumbs-o-up": "",
  "thumbs-up": "",
  "ticket": "",
  "times": "",
  "times-circle": "",
  "times-circle-o": "",
  "tint": "",
  "toggle-down": "",
  "toggle-left": "",
  "toggle-off": "",
  "toggle-on": "",
  "toggle-right": "",
  "toggle-up": "",
  "trademark": "",
  "train": "",
  "transgender": "",
  "transgender-alt": "",
  "trash": "",
  "trash-o": "",
  "tree": "",
  "trello": "",
  "tripadvisor": "",
  "trophy": "",
  "truck": "",
  "try": "",
  "tty": "",
  "tumblr": "",
  "tumblr-square": "",
  "turkish-lira": "",
  "tv": "",
  "twitch": "",
  "twitter": "",
  "twitter-square": "",
  "umbrella": "",
  "underline": "",
  "undo": "",
  "universal-access": "",
  "university": "",
  "unlink": "",
  "unlock": "",
  "unlock-alt": "",
  "unsorted": "",
  "upload": "",
  "usb": "",
  "usd": "",
  "user": "",
  "user-md": "",
  "user-plus": "",
  "user-secret": "",
  "user-times": "",
  "users": "",
  "venus": "",
  "venus-double": "",
  "venus-mars": "",
  "viacoin": "",
  "viadeo": "",
  "viadeo-square": "",
  "video-camera": "",
  "vimeo": "",
  "vimeo-square": "",
  "vine": "",
  "vk": "",
  "volume-control-phone": "",
  "volume-down": "",
  "volume-off": "",
  "volume-up": "",
  "warning": "",
  "wechat": "",
  "weibo": "",
  "weixin": "",
  "whatsapp": "",
  "wheelchair": "",
  "wheelchair-alt": "",
  "wifi": "",
  "wikipedia-w": "",
  "windows": "",
  "won": "",
  "wordpress": "",
  "wpbeginner": "",
  "wpforms": "",
  "wrench": "",
  "xing": "",
  "xing-square": "",
  "y-combinator": "",
  "y-combinator-square": "",
  "yahoo": "",
  "yc": "",
  "yc-square": "",
  "yelp": "",
  "yen": "",
  "yoast": "",
  "youtube": "",
  "youtube-play": "",
  "youtube-square": ""
};

})(this);;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.app = {
    container: {
      className: "the-graph-app",
      name: "app"
    },
    canvas: {
      ref: "canvas",
      className: "app-canvas"
    },
    svg: {
      className: "app-svg"
    },
    svgGroup: {
      className: "view"
    },
    graph: {
      ref: "graph"
    },
    tooltip: {
      ref: "tooltip"
    },
    modal: {
      className: "context"
    }
  };

  TheGraph.factories.app = {
    createAppContainer: createAppContainer,
    createAppCanvas: TheGraph.factories.createCanvas,
    createAppSvg: TheGraph.factories.createSvg,
    createAppSvgGroup: TheGraph.factories.createGroup,
    createAppGraph: createAppGraph,
    createAppTooltip: createAppTooltip,
    createAppModalGroup: TheGraph.factories.createGroup,
    createAppModalBackground: createAppModalBackground
  };

  // No need to promote DIV creation to TheGraph.js.
  function createAppContainer(options, content) {
    var args = [options];

    if (Array.isArray(content)) {
      args = args.concat(content);
    }

    return React.DOM.div.apply(React.DOM.div, args);
  }

  function createAppGraph(options) {
    return TheGraph.Graph(options);
  }

  function createAppTooltip(options) {
    return TheGraph.Tooltip(options);
  }

  function createAppModalBackground(options) {
    return TheGraph.ModalBG(options);
  }

  TheGraph.App = React.createFactory( React.createClass({
    displayName: "TheGraphApp",
    mixins: [React.Animate],
    getInitialState: function () {
      if (this.props.autoFit) {
        // Autofit
        var fit = TheGraph.findFit(this.props.graph, this.props.width, this.props.height);
        var x = fit.x;
        var y = fit.y;
        var scale = fit.scale;
      } else {
        var x = this.props.x;
        var y = this.props.y;
        var scale = this.props.scale;
      }

      return {
        x: x,
        y: y,
        scale: scale,
        width: this.props.width,
        height: this.props.height,
        minZoom: this.props.minZoom,
        maxZoom: this.props.maxZoom,
        tooltip: "",
        tooltipX: 0,
        tooltipY: 0,
        tooltipVisible: false,
        contextElement: null,
        contextType: null,
        offsetY: this.props.offsetY,
        offsetX: this.props.offsetX
      };
    },
    getDefaultProps: function () {
      return {
        snap: TheGraph.config.nodeSize / 2,
        grid: TheGraph.config.nodeSize
      };
    },
    zoomFactor: 0,
    zoomX: 0,
    zoomY: 0,
    getBoundingRect: function () {
      return ReactDOM.findDOMNode(this).getBoundingClientRect();
    },
    getMousePos: function (event) {
      if (!event) {
        event = this.mousePos || {
          x: 0,
          y: 0
        }
      }

      var boundingRect = this.getBoundingRect();
      return {
        x: (event.x || event.clientX) - boundingRect.left,
        y: (event.y || event.clientY) - boundingRect.top
      };
    },
    onWheel: function (event) {
      // Don't bounce
      event.preventDefault();

      if (!this.zoomFactor) { // WAT
        this.zoomFactor = 0;
      }

      // Safari is wheelDeltaY
      this.zoomFactor += event.deltaY ? event.deltaY : 0-event.wheelDeltaY;

      var boundingRect = this.getBoundingRect();
      this.zoomX = event.clientX - boundingRect.left;
      this.zoomY = event.clientY - boundingRect.top;
      requestAnimationFrame(this.scheduleWheelZoom);
    },
    scheduleWheelZoom: function () {
      if (isNaN(this.zoomFactor)) { return; }

      // Speed limit
      var zoomFactor = this.zoomFactor/-500;
      zoomFactor = Math.min(0.5, Math.max(-0.5, zoomFactor));
      var scale = this.state.scale + (this.state.scale * zoomFactor);
      this.zoomFactor = 0;

      if (scale < this.state.minZoom) {
        scale = this.state.minZoom;
      }
      else if (scale > this.state.maxZoom) {
        scale = this.state.maxZoom;
      }
      if (scale === this.state.scale) { return; }

      // Zoom and pan transform-origin equivalent
      var scaleD = scale / this.state.scale;
      var currentX = this.state.x;
      var currentY = this.state.y;
      var oX = this.zoomX;
      var oY = this.zoomY;
      var x = scaleD * (currentX - oX) + oX;
      var y = scaleD * (currentY - oY) + oY;

      this.setState({
        scale: scale,
        x: x,
        y: y,
        tooltipVisible: false
      });
    },
    lastScale: 1,
    lastX: 0,
    lastY: 0,
    pinching: false,
    onTransformStart: function (event) {
      // Don't drag nodes
      event.srcEvent.stopPropagation();
      event.srcEvent.stopImmediatePropagation();

      // Hammer.js
      this.lastScale = 1;
      this.lastX = event.center.x;
      this.lastY = event.center.y;
      this.pinching = true;
    },
    onTransform: function (event) {
      // Don't drag nodes
      event.srcEvent.stopPropagation();
      event.srcEvent.stopImmediatePropagation();

      // Hammer.js
      var currentScale = this.state.scale;
      var currentX = this.state.x;
      var currentY = this.state.y;

      var scaleEvent = event.scale;
      var scaleDelta = 1 + (scaleEvent - this.lastScale);
      this.lastScale = scaleEvent;
      var scale = scaleDelta * currentScale;
      scale = Math.max(scale, this.props.minZoom);

      // Zoom and pan transform-origin equivalent
      var oX = event.center.x;
      var oY = event.center.y;
      var deltaX = oX - this.lastX;
      var deltaY = oY - this.lastY;
      var x = scaleDelta * (currentX - oX) + oX + deltaX;
      var y = scaleDelta * (currentY - oY) + oY + deltaY;

      this.lastX = oX;
      this.lastY = oY;

      this.setState({
        scale: scale,
        x: x,
        y: y,
        tooltipVisible: false
      });
    },
    onTransformEnd: function (event) {
      // Don't drag nodes
      event.srcEvent.stopPropagation();
      event.srcEvent.stopImmediatePropagation();

      // Hammer.js
      this.pinching = false;
    },
    onPanStart: function (event) {
      if (!this.getEvent('panFilter')(event) || this.onPan) {
        return;
      }

      if (event.preventTap) {
        event.preventTap();
      }

      var domNode = ReactDOM.findDOMNode(this);
      domNode.addEventListener(
        this.getEvent('panEvent'), this.getOnPan(event));

      window.addEventListener(
        this.getEvent('panEndEvent'), this.onPanEnd);
    },
    onPan: null,
    getOnPan: function (event) {
      var startX = this.state.x;
      var startY = this.state.y;
      var startClientX = event.clientX;
      var startClientY = event.clientY;

      this.onPan = function (event) {
        if ( this.pinching ) { return; }
        this.setState({
          x: startX + event.clientX - startClientX,
          y: startY + event.clientY - startClientY
        });
      }.bind(this);
      return this.onPan;
    },
    onPanEnd: function (event) {
      if (!this.getEvent('panFilter')(event)) {
        return;
      }
      // Don't click app (unselect)
      event.stopPropagation();

      var domNode = ReactDOM.findDOMNode(this);
      domNode.removeEventListener(this.getEvent('panEvent'), this.onPan);
      delete this.onPan;

      window.removeEventListener(
        this.getEvent('panEndEvent'), this.onPanEnd);
    },
    onPanScale: function () {
      // Pass pan/scale out to the-graph
      if (this.props.onPanScale) {
        this.props.onPanScale(this.state.x, this.state.y, this.state.scale);
      }
    },
    autoPan: false,
    autoPanOffset: 20,
    autoPanDirection: null,
    autoPanCallback: null,
    startAutoPan: function (direction, callback) {
      var isRunning = this.autoPan;
      this.autoPan = true;
      this.autoPanDirection = direction;
      this.autoPanCallback = callback;

      var autoPanFn = function () {
        if (!this.autoPan) {
          return;
        }

        var offset = this.autoPanOffset;
        var scale = 1;
        this.autoPanCallback(this.autoPanOffset/scale, this.autoPanDirection, function () {
          var x = this.state.x + offset/scale * this.autoPanDirection.x * -1;
          var y = this.state.y + offset/scale * this.autoPanDirection.y * -1;
          this.setState({
            x: x,
            y: y
          }, function () {
            this.autoPanFrame = window.requestAnimationFrame(autoPanFn);
          }.bind(this));
        }.bind(this));
      }.bind(this);

      if (!isRunning) {
        autoPanFn();
      }
    },
    resetAutoPan: function () {
      // Clears animation frame loop so startAutoPan can be called more than once
      window.cancelAnimationFrame(this.autoPanFrame);
      this.autoPanFrame = null;
    },
    stopAutoPan: function () {
      this.autoPan = false;
      this.autoPanDirection = null;
      this.autoPanCallback = null;

      this.resetAutoPan();
    },
    showContext: function (options) {
      this.setState({
        contextMenu: options,
        tooltipVisible: false
      });
    },
    hideContext: function (event) {
      this.setState({
        contextMenu: null
      });
    },
    changeTooltip: function (event) {
      var tooltip = event.detail.tooltip;

      var mousePos = this.getMousePos(event.detail);

      // Don't go over right edge
      var x = mousePos.x + 10;
      var width = tooltip.length*6;
      if (x + width > this.state.width) {
        x = mousePos.x - width - 10;
      }

      this.setState({
        tooltip: tooltip,
        tooltipVisible: true,
        tooltipX: x,
        tooltipY: mousePos.y + 20
      });
    },
    hideTooltip: function (event) {
      this.setState({
        tooltip: "",
        tooltipVisible: false
      });
    },
    getFit: function () {
      return TheGraph.findFit(this.props.graph, this.state.width, this.state.height);
    },
    triggerFit: function (event) {
      var fit = this.getFit();
      this.setState({
        x: fit.x,
        y: fit.y,
        scale: fit.scale
      });
    },
    triggerFitAnimated: function () {
      var duration = TheGraph.config.focusAnimationDuration;
      var fit = this.getFit();

      this.animate(fit, duration, 'out-quint', function () {});
    },
    focusNode: function (node) {
      var duration = TheGraph.config.focusAnimationDuration;
      var fit = TheGraph.findNodeFit(node, this.state.width, this.state.height);

      this.animate({
        x: fit.x,
        y: fit.y,
        scale: fit.scale,
      }, duration, 'in-quint');
    },
    focusSelection: function () {
      var duration = TheGraph.config.focusAnimationDuration;
      var point1 = {
        x: Infinity,
        y: Infinity
      };
      var point2 = {
        x: -Infinity,
        y: -Infinity
      };
      var graphState = this.refs.graph.state;
      var graph = this.props.graph;

      Object.keys(graphState.selectedNodes).map(function (node) {
        return graph.getNode(node);
      }).concat(
        Object.keys(graphState.selectedInports),
        Object.keys(graphState.selectedOutports)
      ).forEach(function (node) {
        if (node.metadata.x < point1.x) {
          point1.x = node.metadata.x;
        }
        if (node.metadata.y < point1.y) {
          point1.y = node.metadata.y;
        }

        var nodeX = node.metadata.x + node.metadata.width;
        if (nodeX > point2.x) {
          point2.x = nodeX;
        }
        var nodeY = node.metadata.y + node.metadata.height;
        if (nodeY > point2.y) {
          point2.y = nodeY;
        }
      });

      var fit = TheGraph.findAreaFit(
        point1, point2, this.state.width, this.state.height);

      this.animate({
        x: fit.x,
        y: fit.y,
        scale: fit.scale,
      }, duration, 'in-quint');
    },
    edgeStart: function (event) {
      // Listened from PortMenu.edgeStart() and Port.edgeStart()
      event.detail.mousePos = this.mousePos;
      this.refs.graph.edgeStart(event);
      this.hideContext();
    },
    defaultEventConfig: {
      panStartEvent: 'trackstart',
      panFilter: function () {return true;},
      panEvent: 'track',
      panEndEvent: 'trackend'
    },
    getEvent: function (key) {
      return this.props.eventConfig[key] || this.defaultEventConfig[key];
    },
    componentDidMount: function () {
      var domNode = ReactDOM.findDOMNode(this);

      // Set up PolymerGestures for app and all children
      var noop = function () {};
      PolymerGestures.addEventListener(domNode, "up", noop);
      PolymerGestures.addEventListener(domNode, "down", noop);
      PolymerGestures.addEventListener(domNode, "tap", noop);
      PolymerGestures.addEventListener(domNode, "trackstart", noop);
      PolymerGestures.addEventListener(domNode, "track", noop);
      PolymerGestures.addEventListener(domNode, "trackend", noop);
      PolymerGestures.addEventListener(domNode, "hold", noop);

      // Unselect edges and nodes
      if (this.props.onNodeSelection) {
        domNode.addEventListener("tap", this.unselectAll);
      }

      // Don't let Hammer.js collide with polymer-gestures
      var hammertime;
      if (Hammer) {
        hammertime = new Hammer(domNode, {});
        hammertime.get('pinch').set({ enable: true });
      }

      // Pointer gesture event for pan
      domNode.addEventListener(this.getEvent('panStartEvent'), this.onPanStart);

      var isTouchDevice = 'ontouchstart' in document.documentElement;
      if( isTouchDevice && hammertime ){
        hammertime.on("pinchstart", this.onTransformStart);
        hammertime.on("pinch", this.onTransform);
        hammertime.on("pinchend", this.onTransformEnd);
      }

      // Wheel to zoom
      if (domNode.onwheel!==undefined) {
        // Chrome and Firefox
        domNode.addEventListener("wheel", this.onWheel);
      } else if (domNode.onmousewheel!==undefined) {
        // Safari
        domNode.addEventListener("mousewheel", this.onWheel);
      }

      // Tooltip listener
      domNode.addEventListener("the-graph-tooltip", this.changeTooltip);
      domNode.addEventListener("the-graph-tooltip-hide", this.hideTooltip);

      // Edge preview
      domNode.addEventListener("the-graph-edge-start", this.edgeStart);

      domNode.addEventListener("contextmenu",this.onShowContext);
      domNode.addEventListener("edge-preview", function (event) {
        this.setState({edgePreview: event.detail});
      }.bind(this));

      // Start zoom from middle if zoom before mouse move
      this.mouseX = Math.floor( this.state.width/2 );
      this.mouseY = Math.floor( this.state.height/2 );

      // HACK metaKey global for taps https://github.com/Polymer/PointerGestures/issues/29
      document.addEventListener('keydown', this.keyDown);
      document.addEventListener('keyup', this.keyUp);

      // Canvas background
      this.bgCanvas = unwrap(ReactDOM.findDOMNode(this.refs.canvas));
      this.bgContext = unwrap(this.bgCanvas.getContext('2d'));
      this.componentDidUpdate();

      window.addEventListener('mousemove', this.mouseMove);

      // Rerender graph once to fix edges
      setTimeout(function () {
        this.renderGraph();
      }.bind(this), 500);
    },
    mouseMove: function (event) {
      var boundingRect = this.getBoundingRect();
      this.mousePos = {
        x: event.clientX,
        y: event.clientY
      };
    },
    componentWillUnmount: function () {
      window.removeEventListener('mousemove', this.mouseMove);
    },
    onShowContext: function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      //var x = (event.x || event.clientX || 0) - this.props.app.state.x;
      //var y = (event.y || event.clientY || 0) - this.props.app.state.y;
      var boundingRect = this.getBoundingRect();
      var x = (event.x || event.clientX || 0) - boundingRect.left;
      var y = (event.y || event.clientY || 0) - boundingRect.top;

      if (this.state.edgePreview) {
        var isIn = this.state.edgePreview.isIn;
        var port = this.state.edgePreview[isIn ? 'to' : 'from'];
        var graphState = this.refs.graph.state;
        var portX = graphState.edgePreviewX;
        var portY = graphState.edgePreviewY;
        var port = TheGraph.merge({x: portX, y: portY}, port);
        this.showContext({
          element: this,
          type: isIn ? 'nodeInport' : 'nodeOutport',
          x: x,
          y: y,
          graph: this.props.graph,
          itemKey: port.port,
          item: port
        });
      } else {
        // App.showContext
        this.showContext({
          element: this,
          type: "main",
          x: x,
          y: y,
          graph: this.props.graph,
          itemKey: 'graph',
          item: this.props.graph
        });
      }
    },
    deleteSelection: function () {
      var graph = this.refs.graph.state.graph,
          selectedNodes = this.refs.graph.state.selectedNodes,
          selectedEdges = this.refs.graph.state.selectedEdges,
          menus = this.props.menus,
          menuOption = null,
          menuAction = null,
          nodeKey = null,
          node = null,
          edge = null;

      for (nodeKey in selectedNodes) {
        if (selectedNodes.hasOwnProperty(nodeKey)) {
          node = graph.getNode(nodeKey);
          menus.node.actions.delete(graph, nodeKey, node);
        }
      }
      selectedEdges.map(function (edge) {
        menus.edge.actions.delete(graph, null, edge);
      });
    },
    keyDown: function (event) {
      // HACK metaKey global for taps https://github.com/Polymer/PointerGestures/issues/29
      if (event.metaKey || event.ctrlKey) {
        TheGraph.metaKeyPressed = true;
      }

      var key = event.keyCode,
          hotKeys = {
            // Delete
            46: this.deleteSelection,
            // f for fit
            70: function () {
              this.triggerFitAnimated();
            }.bind(this),
            // s for selected
            83: function () {
              var graph = this.refs.graph.state.graph,
                  selectedNodes = this.refs.graph.state.selectedNodes,
                  nodeKey = null,
                  node = null;

              for (nodeKey in selectedNodes) {
                if (selectedNodes.hasOwnProperty(nodeKey)) {
                  node = graph.getNode(nodeKey);
                  this.focusNode(node);
                  break;
                }
              }
            }.bind(this)
          };

      if (this.props.hotKeys && this.props.hotKeys[key]) {
        this.props.hotKeys[key].bind(this)(event);
      } else if (hotKeys[key]) {
        hotKeys[key]();
      }
    },
    keyUp: function (event) {
      // Escape
      if (event.keyCode===27) {
        if (!this.refs.graph) {
          return;
        }
        this.refs.graph.cancelPreviewEdge();
      }
      // HACK metaKey global for taps https://github.com/Polymer/PointerGestures/issues/29
      if (TheGraph.metaKeyPressed) {
        TheGraph.metaKeyPressed = false;
      }
    },
    unselectAll: function (event) {
      // No arguments = clear selection
      this.props.onNodeSelection();
      this.props.onExportSelection();
      this.props.onEdgeSelection();
    },
    renderGraph: function () {
      this.refs.graph.markDirty();
    },
    componentDidUpdate: function (prevProps, prevState) {
      this.renderCanvas(this.bgContext);
      if (!prevState || prevState.x!==this.state.x || prevState.y!==this.state.y || prevState.scale!==this.state.scale) {
        this.onPanScale();
      }
    },
    renderCanvas: function (c) {
      // Comment this line to go plaid
      c.clearRect(0, 0, this.state.width, this.state.height);

      // Background grid pattern
      var scale = this.state.scale;
      var g = this.props.grid * scale;

      var dx = this.state.x % g;
      var dy = this.state.y % g;
      var cols = Math.floor(this.state.width / g) + 1;
      var row = Math.floor(this.state.height / g) + 1;
      // Origin row/col index
      var oc = Math.floor(this.state.x / g) + (this.state.x<0 ? 1 : 0);
      var or = Math.floor(this.state.y / g) + (this.state.y<0 ? 1 : 0);

      while (row--) {
        var col = cols;
        while (col--) {
          var x = Math.round(col*g+dx);
          var y = Math.round(row*g+dy);
          if ((oc-col)%3===0 && (or-row)%3===0) {
            // 3x grid
            c.fillStyle = "white";
            c.fillRect(x, y, 1, 1);
          } else if (scale > 0.5) {
            // 1x grid
            c.fillStyle = "grey";
            c.fillRect(x, y, 1, 1);
          }
        }
      }
    },
    getContext: function (menu, options, hide) {
        return TheGraph.Menu({
            menu: menu,
            options: options,
            triggerHideContext: hide,
            label: "Hello",
            graph: this.props.graph,
            node: this,
            ports: [],
            process: [],
            processKey: null,
            x: options.x,
            y: options.y,
            nodeWidth: this.state.width,
            nodeHeight: this.state.height,
            deltaX: 0,
            deltaY: 0,
            highlightPort: false
        });
    },
    render: function () {
      // console.timeEnd("App.render");
      // console.time("App.render");

      // pan and zoom
      var sc = this.state.scale;
      var x = this.state.x;
      var y = this.state.y;
      var transform = "matrix("+sc+",0,0,"+sc+","+x+","+y+")";

      var scaleClass = sc > TheGraph.zbpBig ? "big" : ( sc > TheGraph.zbpNormal ? "normal" : "small");

      var contextMenu, contextModal;
      if ( this.state.contextMenu ) {
        var options = this.state.contextMenu;
        var menu = this.props.getMenuDef(options);
        if (menu) {
          contextMenu = options.element.getContext(menu, options, this.hideContext);
        }
      }
      if (contextMenu) {

        var modalBGOptions ={
          width: this.state.width,
          height: this.state.height,
          triggerHideContext: this.hideContext,
          children: contextMenu
        };

        contextModal = [
          TheGraph.factories.app.createAppModalBackground(modalBGOptions)
        ];
        this.menuShown = true;
      } else {
        this.menuShown = false;
      }

      var graphElementOptions = {
        graph: this.props.graph,
        scale: this.state.scale,
        grid: this.props.grid,
        snap: this.props.snap,
        app: this,
        library: this.props.library,
        onNodeSelection: this.props.onNodeSelection,
        onExportSelection: this.props.onExportSelection,
        onNodeGroupSelection: this.props.onNodeGroupSelection,
        onEdgeSelection: this.props.onEdgeSelection,
        showContext: this.showContext,
        eventConfig: this.props.eventConfig,
        disabled: this.props.disabled
      };
      graphElementOptions = TheGraph.merge(TheGraph.config.app.graph, graphElementOptions);
      var graphElement = TheGraph.factories.app.createAppGraph.call(this, graphElementOptions);

      var svgGroupOptions = TheGraph.merge(TheGraph.config.app.svgGroup, { transform: transform });
      var svgGroup = TheGraph.factories.app.createAppSvgGroup.call(this, svgGroupOptions, [graphElement]);

      var tooltipOptions = {
        x: this.state.tooltipX,
        y: this.state.tooltipY,
        visible: this.state.tooltipVisible,
        label: this.state.tooltip
      };

      tooltipOptions = TheGraph.merge(TheGraph.config.app.tooltip, tooltipOptions);
      var tooltip = TheGraph.factories.app.createAppTooltip.call(this, tooltipOptions);

      var modalGroupOptions = TheGraph.merge(TheGraph.config.app.modal, { children: contextModal });
      var modalGroup = TheGraph.factories.app.createAppModalGroup.call(this, modalGroupOptions);

      var svgContents = [
        svgGroup,
        tooltip,
        modalGroup
      ];

      var svgOptions = TheGraph.merge(TheGraph.config.app.svg, { width: this.state.width, height: this.state.height });
      var svg = TheGraph.factories.app.createAppSvg.call(this, svgOptions, svgContents);

      var canvasOptions = TheGraph.merge(TheGraph.config.app.canvas, { width: this.state.width, height: this.state.height });
      var canvas = TheGraph.factories.app.createAppCanvas.call(this, canvasOptions);

      var appContents = [
        canvas,
        svg
      ];
      var containerOptions = TheGraph.merge(TheGraph.config.app.container, { style: { width: this.state.width, height: this.state.height } });
      containerOptions.className += " " + scaleClass;
      return TheGraph.factories.app.createAppContainer.call(this, containerOptions, appContents);
    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.graph = {
    container: {},
    groupsGroup: {
      className: "groups"
    },
    edgesGroup: {
      className: "edges"
    },
    iipsGroup: {
      className: "iips"
    },
    nodesGroup: {
      className: "nodes"
    },
    inportsGroup: {
      className: "ex-inports"
    },
    outportsGroup: {
      className: "ex-outports"
    },
    node: {},
    iip: {},
    inportEdge: {},
    inportNode: {},
    outportEdge: {},
    outportNode: {},
    nodeGroup: {},
    selectionGroup: {
      key: "selectiongroup",
      isSelectionGroup: true,
      label: "",
      description: ""
    },
    edgePreview: {
      key: "edge-preview",
      label: ""
    }
  };

  TheGraph.factories.graph = {
    createGraphContainerGroup: TheGraph.factories.createGroup,
    createGraphGroupsGroup: TheGraph.factories.createGroup,
    createGraphEdgesGroup: TheGraph.factories.createGroup,
    createGraphIIPGroup: TheGraph.factories.createGroup,
    createGraphNodesGroup: TheGraph.factories.createGroup,
    createGraphInportsGroup: TheGraph.factories.createGroup,
    createGraphOutportsGroup: TheGraph.factories.createGroup,
    createGraphNode: createGraphNode,
    createGraphEdge: createGraphEdge,
    createGraphIIP: createGraphIIP,
    createGraphGroup: createGraphGroup,
    createGraphEdgePreview: createGraphEdgePreview
  };

  function createGraphNode(options) {
    return TheGraph.Node(options);
  }

  function createGraphEdge(options) {
    return TheGraph.Edge(options);
  }

  function createGraphIIP(options) {
    return TheGraph.IIP(options);
  }

  function createGraphGroup(options) {
    return TheGraph.Group(options);
  }

  function createGraphEdgePreview(options) {
    return TheGraph.Edge(options);
  }


  // Graph view

  TheGraph.Graph = React.createFactory( React.createClass({
    displayName: "TheGraphGraph",
    mixins: [TheGraph.mixins.FakeMouse],
    getInitialState: function () {
      return {
        graph: this.props.graph,
        displaySelectionGroup: true,
        edgePreview: null,
        edgePreviewX: 0,
        edgePreviewY: 0,
        forceSelection: false,
        selectedNodes: {},
        errorNodes: [],
        selectedInports: {},
        selectedOutports: {},
        selectedEdges: [],
        animatedEdges: [],
        objectClassNames: {},
        offsetX: this.props.offsetX,
        offsetY: this.props.offsetY,
        disabled: this.props.disabled
      };
    },
    componentDidMount: function () {
      window.bench.mark('Mounted graph editor react component');
      // To change port colors
      this.props.graph.on("addEdge", this.onAddEdge);
      this.props.graph.on("removeEdge", this.onRemoveEdge);
      this.props.graph.on("changeEdge", this.resetPortRoute);
      this.props.graph.on("removeInitial", this.resetPortRoute);

      // Listen to noflo graph object's events
      this.props.graph.on("changeNode", this.onChangeNode);
      this.props.graph.on("changeInport", this.markDirty);
      this.props.graph.on("changeOutport", this.markDirty);
      this.props.graph.on("renameInport", this.renameInport);
      this.props.graph.on("renameOutport", this.renameOutport);
      this.props.graph.on("endTransaction", this.markDirty);

      ReactDOM.findDOMNode(this).addEventListener("the-graph-cancel-preview-edge", this.cancelPreviewEdge);
      ReactDOM.findDOMNode(this).addEventListener("the-graph-node-remove", this.removeNode);

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      appDomNode.addEventListener(
        this.getEvent('marqueeSelectStartEvent'), this.startMarqueeSelect);
    },
    defaultEventConfig: {
      marqueeSelectStartEvent: 'mousedown',
      marqueeSelectEndEvent: 'mouseup',
      marqueeSelectEvent: 'mousemove',
      marqueeSelectFilter: function (event) {return event.button === 1}
    },
    getEvent: function (key) {
      return this.props.eventConfig[key] || this.defaultEventConfig[key];
    },
    startMarqueeSelect: function (event) {
      if (!this.getEvent('marqueeSelectFilter')(event)) {
        return;
      }

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      window.addEventListener(
        this.getEvent('marqueeSelectEndEvent'), this.stopMarqueeSelect);

      appDomNode.addEventListener(
        this.getEvent('marqueeSelectEvent'), this.moveMarqueeSelect);

      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var scale = this.props.scale;

      this.props.onNodeSelection();

      var mousePos = this.props.app.getMousePos();
      var startX = (mousePos.x - appX)/scale;
      var startY = (mousePos.y - appY)/scale;
      this.setState({
        marqueeSelect: true,
        marqueeSelectStartX: startX,
        marqueeSelectStartY: startY,
        marqueeSelectCurrentX: startX,
        marqueeSelectCurrentY: startY
      });
      this.markDirty();

      this._marqueeSelectCallback = null;
    },
    _marqueeSelectCallback: null,
    _marqueeSelectEvent: null,
    moveMarqueeSelect: function (event) {
      this._marqueeSelectEvent = event;

      if (this._marqueeSelectCallback) {
        return;
      }

      this._marqueeSelectCallback = function () {
        if (!this.state.marqueeSelect) {
          return;
        }
        var result = this.calculateMarqueeSelect(event);
        result.state.selectedNodes = result.nodes.reduce(function (map, node) {
          map[node.id] = true;
          return map;
        }, {});
        result.state.selectedInports = result.inports.reduce(function (map, node) {
          map[node.exportKey] = true;
          return map;
        }, {});
        result.state.selectedOutports = result.outports.reduce(function (map, node) {
          map[node.exportKey] = true;
          return map;
        }, {});

        this.setState(result.state, function () {
          var app = this.props.app;
          var rect = app.getBoundingRect();
          var direction = {x: 0, y: 0};

          if (event.clientX > rect.right) {
            direction.x = 1;
          } else if (event.clientX < rect.left) {
            direction.x = -1;
          }

          if (event.clientY > rect.bottom) {
            direction.y = 1;
          } else if (event.clientY < rect.top) {
            direction.y = -1;
          }

          app.startAutoPan(direction, function (offset, direction, autoPanFn) {
            var scale = this.props.app.state.scale;
            var x = this.state.marqueeSelectCurrentX + (offset/scale * direction.x);
            var y = this.state.marqueeSelectCurrentY + (offset/scale * direction.y);

            this.state.marqueeSelectCurrentX = x;
            this.state.marqueeSelectCurrentY = y;
            this.markDirty();
            autoPanFn();
          }.bind(this));
        }.bind(this));

        this.markDirty();

        this._marqueeSelectCallback = null;
      }.bind(this);

      window.requestAnimationFrame(this._marqueeSelectCallback);
    },
    calculateMarqueeSelect: function (event) {
      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var scale = this.props.scale;

      var startX = this.state.marqueeSelectStartX;
      var startY = this.state.marqueeSelectStartY;
      var boundingRect = this.props.app.getBoundingRect();
      var currentX = (event.clientX - boundingRect.left - appX)/scale;
      var currentY = (event.clientY - boundingRect.top - appY)/scale;
      var lowX, lowY, highX, highY;
      if (startX <= currentX) {
        lowX = startX;
        highX = currentX;
      } else {
        lowX = currentX;
        highX = startX;
      }

      if (startY <= currentY) {
        lowY = startY;
        highY = currentY;
      } else {
        lowY = currentY;
        highY = startY;
      }

      var filter = function (node) {
        return (
          (node.metadata.x >= lowX &&
           node.metadata.x <= highX) ||
          (node.metadata.x + node.metadata.width >= lowX &&
           node.metadata.x + node.metadata.width <= highX) ||
          (lowX >= node.metadata.x &&
           lowX <= node.metadata.x + node.metadata.width) ||
          (highX >= node.metadata.x &&
           highX <= node.metadata.x + node.metadata.width)
        ) && (
          (node.metadata.y >= lowY &&
           node.metadata.y <= highY) ||
          (node.metadata.y + node.metadata.height >= lowY &&
           node.metadata.y + node.metadata.height <= highY) ||
          (lowY >= node.metadata.y &&
           lowY <= node.metadata.y + node.metadata.height) ||
          (highY >= node.metadata.y &&
           highY <= node.metadata.y + node.metadata.height)
        );
      };

      var nodes = this.state.graph.nodes.filter(filter);

      var graphInports = this.state.graph.inports;
      var inports = Object.keys(graphInports).map(function (key) {
        return {
          exportKey: key,
          export: graphInports[key]
        }
      }).filter(function (exportItem) {
        return filter(exportItem.export);
      });

      var graphOutports = this.state.graph.outports;
      var outports = Object.keys(graphOutports).map(function (key) {
        return {
          exportKey: key,
          export: graphOutports[key]
        }
      }).filter(function (exportItem) {
        return filter(exportItem.export);
      });


      return {
        state: {
          marqueeSelectCurrentX: currentX,
          marqueeSelectCurrentY: currentY
        },
        nodes: nodes,
        inports: inports,
        outports: outports
      };
    },
    stopMarqueeSelect: function (event) {
      this.props.app.stopAutoPan();

      if (!this.getEvent('marqueeSelectFilter')(event)) {
        return;
      }
      if (event.preventTap) {
        event.preventTap();
      }
      event.preventDefault();
      event.stopPropagation();

      var result = this.calculateMarqueeSelect(event);
      this.props.onNodeGroupSelection(
        result.nodes, result.inports, result.outports);

      this.setState({
        marqueeSelect: false,
        marqueeSelectStartX: null,
        marqueeSelectStartY: null,
        marqueeSelectCurrentX: null,
        marqueeSelectCurrentY: null
      });
      this.markDirty();

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      window.removeEventListener(
        this.getEvent('marqueeSelectEndEvent'), this.stopMarqueeSelect);
      appDomNode.removeEventListener(
        this.getEvent('marqueeSelectEvent'), this.moveMarqueeSelect);
    },
    onAddEdge: function (edge) {
      this.arrayPortInfo = null;
      this.portInfo = {};
      this.resetPortRoute(edge);
    },
    onRemoveEdge: function (edge) {
      this.arrayPortInfo = null;
      this.portInfo = {};
      this.resetPortRoute(edge);
    },
    edgePreview: null,
    edgeStart: function (event) {
      // Forwarded from App.edgeStart()

      if (this.state.disabled) {
        ReactDOM.findDOMNode(this).dispatchEvent(new CustomEvent('disabled-notification', {
          detail: {
            action: 'edge-start'
          },
          bubbles: true
        }));
        if (this.state.edgePreview) {
          this.cancelPreviewEdge();
        }
        return;
      }

      // Port that triggered this
      var port = event.detail.port;

      // Complete edge if this is the second tap and ports are compatible
      if (this.state.edgePreview && this.state.edgePreview.isIn !== event.detail.isIn) {
        // TODO also check compatible types
        var halfEdge = this.state.edgePreview;
        if (event.detail.isIn) {
          halfEdge.to = port;
        } else {
          halfEdge.from = port;
        }
        this.addEdge(halfEdge);
        this.cancelPreviewEdge();
        return;
      }

      var edge;
      var typeRoutes = TheGraph.config.typeRoutes;

      if (event.detail.isIn) {
        edge = { to: port };
      } else {
        edge = { from: port };
      }
      edge.isIn = event.detail.isIn;
      edge.type = event.detail.port.type;
      edge.metadata = {
        route: event.detail.route || typeRoutes[edge.type]
      };

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      document.addEventListener("mousemove", this.renderPreviewEdge);
      window.addEventListener("track", this.renderPreviewEdge);
      window.addEventListener("mouseup", this.dropPreviewEdge);

      // TODO tap to add new node here
      appDomNode.addEventListener("tap", this.cancelPreviewEdge);
      var edgePreviewEvent = new CustomEvent('edge-preview', {detail: edge});
      appDomNode.dispatchEvent(edgePreviewEvent);
      this.setState({edgePreview: edge}, this.markDirty);
      this.renderPreviewEdge(event.detail.mousePos);
    },
    dropPreviewEdge: function (event) {
      var eventType = 'the-graph-edge-drop';
      var dropEvent = new CustomEvent(eventType, {
        detail: null,
        bubbles: true
      });
      event.target.dispatchEvent(dropEvent);

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      var listener = function () {
        this.cancelPreviewEdge();
        appDomNode.removeEventListener(eventType, listener);
      }.bind(this);
      appDomNode.addEventListener(eventType, listener);
    },
    cancelPreviewEdge: function (event) {
      this.props.app.stopAutoPan();

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      document.removeEventListener("mousemove", this.renderPreviewEdge);
      window.removeEventListener("track", this.renderPreviewEdge);
      window.removeEventListener("mouseup", this.dropPreviewEdge);
      appDomNode.removeEventListener("tap", this.cancelPreviewEdge);

      var edgePreviewEvent = new CustomEvent('edge-preview', {detail: null});
      appDomNode.dispatchEvent(edgePreviewEvent);
      if (this.state.edgePreview) {
        this.setState({edgePreview: null});
        this.markDirty();
      }
    },
    triggerMoveEdge: null,
    renderPreviewEdge: function (event) {
      var boundingRect = this.props.app.getBoundingRect();
      var x = (event.clientX || event.x || 0) - boundingRect.left;
      var y = (event.clientY || event.y || 0) - boundingRect.top;
      x -= this.props.app.state.offsetX || 0;
      y -= this.props.app.state.offsetY || 0;
      var scale = this.props.app.state.scale;

      this.state.edgePreviewX = (x - this.props.app.state.x) / scale;
      this.state.edgePreviewY = (y - this.props.app.state.y) / scale;

      var app = this.props.app;
      var rect = app.getBoundingRect();
      var direction = {x: 0, y: 0};

      if (event.clientX > rect.right) {
        direction.x = 1;
      } else if (event.clientX < rect.left) {
        direction.x = -1;
      }

      if (event.clientY > rect.bottom) {
        direction.y = 1;
      } else if (event.clientY < rect.top) {
        direction.y = -1;
      }

      app.startAutoPan(direction, function (offset, direction, autoPanFn) {
        this.setState({
          edgePreviewX: this.state.edgePreviewX + (offset/scale * direction.x),
          edgePreviewY: this.state.edgePreviewY + (offset/scale * direction.y)
        }, autoPanFn);
      }.bind(this));

      if (!this.triggerMoveEdge) {
        this.triggerMoveEdge = function () {
          if (this.refs.edgePreview) {
            ReactDOM.findDOMNode(this.refs.edgePreview).dispatchEvent(
              new CustomEvent('render-edge-preview', {detail: {
                x: this.state.edgePreviewX,
                y: this.state.edgePreviewY
              }})
            );
          }

          delete this.triggerMoveEdge;
        }.bind(this);
        window.requestAnimationFrame(this.triggerMoveEdge);
      }
    },
    addEdge: function (edge) {
      var graph = this.state.graph,
          fromIndex,
          toIndex;


      if (edge.from.addressable) {
        fromIndex = this.getArrayPortInfo(
          graph, edge.from.process, false, edge.from.port).length;
      }

      if (typeof edge.from.index === 'number') {
        fromIndex = edge.from.index;
      }

      if (edge.to.addressable) {
        toIndex = this.getArrayPortInfo(
          graph, edge.to.process, true, edge.to.port).length;
      }

      if (typeof edge.to.index === 'number') {
        toIndex = edge.to.index;
      }

      graph.addEdgeIndex(
        edge.from.process, edge.from.port, fromIndex,
        edge.to.process, edge.to.port, toIndex,
        edge.metadata
      );
    },
    renameInport: function (oldName, newName) {
      this.renameExport(
        oldName,
        newName,
        this.props.graph.inports,
        this.state.selectedInports,
        true
      );
    },
    renameOutport: function (oldName, newName) {
      this.renameExport(
        oldName,
        newName,
        this.props.graph.outports,
        this.state.selectedOutports,
        false
      );
    },
    renameExport: function (oldName, newName, graphPorts, selected, isIn) {
      var callback = this.props.onExportSelection;
      if (selected[oldName]) {
        var port = graphPorts[newName];
        callback(oldName, port, isIn, true);
        callback(newName, port, isIn, true);
      }
    },
    moveGroup: function (nodes, inports, outports, dx, dy, skipAutoPan) {
      var group = this._moveGroup(nodes, inports, outports, dx, dy);
      var app = this.props.app;
      var x = app.state.x;
      var y = app.state.y;
      var scale = app.state.scale;
      var limits  = TheGraph.findMinMax(this.props.graph, nodes, inports, outports);
      var direction = {x: 0, y: 0};

      if (-1*limits.minX*scale > x) {
        direction.x = -1;
      } else if ( -1* limits.maxX * scale < x - app.state.width) {
        direction.x = 1;
      }

      if (-1*limits.minY*scale > y) {
        direction.y = -1;
      } else if ( -1* limits.maxY * scale < y - app.state.height) {
        direction.y = 1;
      }

      if (skipAutoPan) {
        return;
      }

      this.props.app.startAutoPan(direction, function (offset, direction, autoPanFn) {
        this._moveGroup(
          nodes, inports, outports,
          (offset/scale * direction.x),
          (offset/scale * direction.y)
        );
        autoPanFn();
      }.bind(this));
    },
    _moveGroup: function (nodes, inports, outports, dx, dy) {
      var graph = this.state.graph;

      var updateNode = function (id, metadata, method) {
        if (dx !== undefined) {
          // Move by delta
          graph[method](id, {
            x: metadata.x + dx,
            y: metadata.y + dy
          });
        } else {
          // Snap to grid
          var snap = this.props.snap;
          graph[method](id, {
            x: Math.round(metadata.x/snap) * snap,
            y: Math.round(metadata.y/snap) * snap
          });
        }
      }.bind(this);

      // Move each group member
      var len = nodes.length;
      for (var i=0; i<len; i++) {
        var node = graph.getNode(nodes[i]);
        if (!node) { continue; }
        updateNode(node.id, node.metadata, 'setNodeMetadata');
      }

      if (outports) {
        len = outports.length;
        for (i = 0; i < len; i++) {
          var key = outports[i];
          var port = this.props.graph.outports[key];
          if (!port) { continue; }
          updateNode(key, port.metadata, 'setOutportMetadata');
        }
      }

      if (inports) {
        len = inports.length;
        for (i = 0; i < len; i++) {
          var key = inports[i];
          var port = this.props.graph.inports[key];
          if (!port) { continue; }
          updateNode(key, port.metadata, 'setInportMetadata');
        }
      }
    },
    triggerMoveNode: null,
    onChangeNode: function (node, before) {
      delete this.portInfo[node.id];

      if (!this.triggerMoveNode) {
        this.triggerMoveNode = function () {
          this.markDirty(node);
          delete this.triggerMoveNode;
        }.bind(this);
        window.setTimeout(this.triggerMoveNode, 0);
      }
    },
    getComponentInfo: function (componentName) {
      return this.props.library[componentName];
    },
    arrayPortInfo: null,
    getArrayPortInfo: function (graph, processName, isIn, port) {
      if (!this.arrayPortInfo) {
        var portInfo = {
        };

        graph.edges.forEach(function (edge) {
          ['from', 'to'].forEach(function (portType) {
            var portEnd = edge[portType];
            var node = portEnd.node;
            var port = portEnd.port;

            if (!portInfo[node]) {
              portInfo[node] = {
                from: {},
                to: {}
              }
            }

            if (!portInfo[node][portType][port]) {
              portInfo[node][portType][port] = [];
            }

            if (portEnd.hasOwnProperty('index')) {
              portInfo[node][portType][port][portEnd.index] = true;
            }
          });
        });

        this.arrayPortInfo = portInfo;
      }

      var isInKey = isIn ? 'to' : 'from';
      if (
        this.arrayPortInfo[processName] &&
        this.arrayPortInfo[processName][isInKey][port]
      ) {
        return this.arrayPortInfo[processName][isInKey][port] || [];
      } else {
        return [];
      }
    },
    portInfo: {},
    getPorts: function (graph, processName, componentName) {

      var typeRoutes = TheGraph.config.typeRoutes;

      var node = graph.getNode(processName);
      var ports = this.portInfo[processName];

      var expanded = node.metadata.expandedPorts || {
        inports: {},
        outports: {}
      };
      var maxInportLength = 0;
      var maxOutportLength = 0;

      if (!ports) {
        var inports = {};
        var outports = {};

        // get the port connections
        var connections = {
            inports: {},
            outports: {}
        };
        // get edge & iip connections
        graph.edges.concat(graph.initializers).forEach(function (conn) {
          var total;

          if (conn.from && conn.from.node === processName) {
              total = connections.outports[conn.from.port];
              // if there already is a connection for the port then add 1
              connections.outports[conn.from.port] = total ? total + 1 : 1;
          }
          else if (conn.to.node === processName) {
              total = connections.inports[conn.to.port];
              // if there already is a connection for the port then add 1
              connections.inports[conn.to.port] = total ? total + 1 : 1;
          }
        });

        // get exported ports
        Object.keys(graph.inports).forEach(function (key) {
          var value = graph.inports[key];
          var total;

          if (value.process === processName) {
              total = connections.inports[value.port];
              // if there already is a connection for the port then add 1
              connections.inports[value.port] = total ? total + 1 : 1;
          }
        });
        // get exported ports
        Object.keys(graph.outports).forEach(function (key) {
            var value = graph.outports[key];
            var total;

            if (value.process === processName) {
                total = connections.outports[value.port];
                // if there already is a connection for the port then add 1
                connections.outports[value.port] = total ? total + 1 : 1;
            }
        });

        if (componentName && this.props.library) {
          // Copy ports from library object
          var component = this.getComponentInfo(componentName);
          if (!component) {
            return {
              inports: inports,
              outports: outports
            };
          }

          var i, port, len,
            top = TheGraph.config.nodePaddingTop,
            height = node.metadata.height - top;

          for (i=0, len=component.outports.length; i<len; i++) {
            port = component.outports[i];
            if (!port.name) { continue; }

            if (port.name.length > maxOutportLength) {
              maxOutportLength = port.name.length;
            }

            outports[port.name] = {
              isConnected: connections.outports[port.name] > 0,
              route: TheGraph.config.constantPortRoute ? typeRoutes[port.type] : undefined,
              label: port.name,
              type: port.type,
              addressable: port.addressable,
              indexList: port.addressable ? this.getArrayPortInfo(
                graph,
                processName,
                false,
                port.name
              ) : null,
              expand: expanded.outports[port.name],
              x: node.metadata.width,
              y: (height / (len+1) * (i+1)) + top
            };
          }
          for (i=0, len=component.inports.length; i<len; i++) {
            port = component.inports[i];
            if (!port.name) { continue; }

            if (port.name.length > maxInportLength) {
              maxInportLength = port.name.length;
            }

            inports[port.name] = {
              isConnected: connections.inports[port.name] > 0,
              route: TheGraph.config.constantPortRoute ? typeRoutes[port.type] : undefined,
              label: port.name,
              type: port.type,
              addressable: port.addressable,
              indexList: port.addressable ? this.getArrayPortInfo(
                graph,
                processName,
                true,
                port.name
              ) : null,
              expand: expanded.inports[port.name],
              x: 0,
              y: (height / (len+1) * (i+1)) + top
            };
          }
        }
        var inportCount = Object.keys(inports).reduce(function (count, key) {
          var port = inports[key];
          var indexList = port.indexList || [];
          var expand = port.expand;
          return count + 1 + (expand ? indexList.length : 0);
        }, 0);
        var outportCount = Object.keys(outports).reduce(function (count, key) {
          var port = outports[key];
          var indexList = port.indexList || [];
          var expand = port.expand;
          return count + 1 + (expand ? indexList.length : 0);
        }, 0);
        ports = {
          inports: inports,
          outports: outports,
          dirty: true,
          count: Math.max(inportCount, outportCount),
          maxOutportLength: maxOutportLength,
          maxInportLength: maxInportLength,
          inportCount: inportCount,
          outportCount: outportCount,
          height: null,//node.metadata.height
        };
        this.portInfo[processName] = ports;
      }
      return ports;
    },
    updatePortPositions: function (graph, processName, component) {
      var node = graph.getNode(processName);
      var top = TheGraph.config.nodePaddingTop;
      var nodeHeight = node.metadata.height - top;
      var nodeWidth = node.metadata.width;
      var ports = this.getPorts(graph, processName, component);

      if (ports.height === nodeHeight) {
        return;
      }

      ports.dirty = true;
      ports.height = nodeHeight;

      var i, len;
      i = 0;
      var maxLen = Math.max(ports.inportCount, ports.outportCount);

      var map = function (indexList, callback) {
        var i, len, newList = [], item;
        for (i = 0, len = indexList.length; i < len; i++) {
          item = indexList[i];
          indexList[i] = !!item;
          newList.push(callback(item));
        }
        return newList;
      };
      var nextY = function () {
        var portHeight = (nodeHeight / (maxLen+1) * (i+1)) + top;
        i++;
        return portHeight;
      };

      Object.keys(ports.outports).forEach(function (key) {
        var port = ports.outports[key];
        port.y = nextY();
        if (port.expand) {
          port.indexY = map(port.indexList, nextY);
        }
        port.x = nodeWidth;
      });

      i = 0;
      Object.keys(ports.inports).forEach(function (key) {
        var port = ports.inports[key];
        port.y = nextY();
        if (port.expand) {
          port.indexY = map(port.indexList, nextY);
        }
        port.x = 0;
      });
    },
    getNodeOutport: function (graph, processName, portName, route, componentName) {
      var ports = this.getPorts(graph, processName, componentName);
      if ( !ports.outports[portName] ) {
        ports.outports[portName] = {
          label: portName,
          x: TheGraph.config.nodeWidth,
          y: TheGraph.config.nodeHeight / 2
        };
        this.dirty = true;
      }
      var port = ports.outports[portName];
      // Port will have top edge's color
      if (route !== undefined) {
        port.route = route;
      }
      return port;
    },
    getNodeInport: function (graph, processName, portName, route, componentName) {
      var ports = this.getPorts(graph, processName, componentName);
      if ( !ports.inports[portName] ) {
        ports.inports[portName] = {
          label: portName,
          x: 0,
          y: TheGraph.config.nodeHeight / 2
        };
        this.dirty = true;
      }
      var port = ports.inports[portName];
      // Port will have top edge's color
      if (route !== undefined) {
        port.route = route;
      }
      return port;
    },
    resetPortRoute: function (event) {
      if (TheGraph.config.constantPortRoute) {
        return;
      }

      // Trigger nodes with changed ports to rerender
      if (event.from && event.from.node) {
        var fromNode = this.portInfo[event.from.node];
        if (fromNode) {
          fromNode.dirty = true;
          var outport = fromNode.outports[event.from.port];
          if (outport) {
            delete outport.route;
          }
        }
      }
      if (event.to && event.to.node) {
        var toNode = this.portInfo[event.to.node];
        if (toNode) {
          toNode.dirty = true;
          var inport = toNode.inports[event.to.port];
          if (inport) {
            delete inport.route;
          }
        }
      }
    },
    getGraphExportRoute: function (port, isIn) {
      var ports = this.getPorts(this.props.graph, port.process, this.props.graph.getNode(port.process).component);
      var route = ports[isIn ? 'inports' : 'outports'][port.port].route;
      return route;
    },
    graphOutports: {},
    getGraphOutport: function (key) {
      var exp = this.graphOutports[key];
      if (!exp) {
        exp = {inports:{},outports:{}};
        exp.inports[key] = {
          label: key,
          type: "all",
          route: this.getGraphExportRoute(this.props.graph.outports[key], false),
          x: 0,
          y: TheGraph.config.exportHeight / 2
        };
        this.graphOutports[key] = exp;
      }
      return exp;
    },
    graphInports: {},
    getGraphInport: function (key) {
      var exp = this.graphInports[key];
      if (!exp) {
        exp = {inports:{},outports:{}};
        exp.outports[key] = {
          label: key,
          type: "all",
          route: this.getGraphExportRoute(this.props.graph.inports[key], true),
          x: TheGraph.config.exportWidth,
          y: TheGraph.config.exportHeight / 2
        };
        this.graphInports[key] = exp;
      }
      return exp;
    },
    setSelectedNodes: function (nodes) {
      this.setState({
        selectedNodes: nodes
      });
      this.markDirty();
    },
    setErrorNodes: function (errors) {
      this.setState({
        errorNodes: errors
      });
      this.markDirty();
    },
    setSelectedInports: function (ports) {
      this.setState({
        selectedInports: ports
      });
      this.markDirty();
    },
    setSelectedOutports: function (ports) {
      this.setState({
        selectedOutports: ports
      });
      this.markDirty();
    },
    setSelectedEdges: function (edges) {
      this.setState({
        selectedEdges: edges
      });
      this.markDirty();
    },
    setAnimatedEdges: function (edges) {
      this.setState({
        animatedEdges: edges
      });
      this.markDirty();
    },
    setObjectClassNames: function (objectClassNames) {
      this.setState({
        objectClassNames: objectClassNames
      });
      this.markDirty();
    },
    updatedIcons: {},
    updateIcon: function (nodeId, icon) {
      this.updatedIcons[nodeId] = icon;
      this.markDirty();
    },
    dirty: false,
    libraryDirty: false,
    pendingDirty: false,
    markDirty: function (event) {
      if (event && event.libraryDirty) {
        this.libraryDirty = true;
      }
      if (!this.pendingDirty) {
        window.requestAnimationFrame(this.triggerRender);
        this.pendingDirty = true;
      }
    },
    triggerRender: function (time) {
      this.pendingDirty = false;
      if (!this.isMounted()) {
        return;
      }
      if (this.dirty) {
        return;
      }
      this.dirty = true;
      this.forceUpdate();
    },
    shouldComponentUpdate: function () {
      // If ports change or nodes move, then edges need to rerender, so we do the whole graph
      return this.dirty;
    },
    render: function () {
      this.dirty = false;
      var rendered = this.rendered;

      var self = this;
      var graph = this.state.graph;
      var library = this.props.library;
      var selectedIds = [];
      var selectedInports = [];
      var selectedOutports = [];
      var disabled = this.state.disabled;

      // Reset ports if library has changed
      if (this.libraryDirty) {
        this.libraryDirty = false;
        this.arrayPortInfo = null;
        this.portInfo = {};
      }

      // Highlight compatible ports
      var highlightPort = null;
      if (this.state.edgePreview && this.state.edgePreview.type) {
        highlightPort = {
          type: this.state.edgePreview.type,
          isIn: !this.state.edgePreview.isIn
        };
      }

      // Nodes
      var nodes = graph.nodes.map(function (node) {
        var componentInfo = self.getComponentInfo(node.component);
        var key = node.id;
        if (!node.metadata) {
          node.metadata = {};
        }
        if (node.metadata.x === undefined) {
          node.metadata.x = 0;
        }
        if (node.metadata.y === undefined) {
          node.metadata.y = 0;
        }
        if (node.metadata.width === undefined) {
          node.metadata.width = TheGraph.config.nodeWidth;
        }
        if (node.metadata.height === undefined) {
          node.metadata.height = TheGraph.config.nodeHeight;
        }

        var ports = self.getPorts(graph, key, node.component);
        if (TheGraph.config.autoSizeNode && componentInfo) {
          // Adjust node height based on number of ports.
          var portCount = ports.count;
          node.metadata.height = TheGraph.config.nodeHeight + (portCount * TheGraph.config.nodeHeightIncrement) + TheGraph.config.nodePaddingTop;

          var inLength = ports.maxInportLength * 4;
          inLength = inLength <  30 ? 30 : inLength;

          var outLength = ports.maxOutportLength * 4;
          outLength = outLength <  30 ? 30 : outLength;

          var nodeWidth = inLength + outLength + 12;

          if (nodeWidth > node.metadata.width) {
            node.metadata.width = nodeWidth;
          }
        }
        self.updatePortPositions(graph, key, node.component);

        if (!node.metadata.label || node.metadata.label === "") {
          node.metadata.label = key;
        }
        var icon = "cog";
        var iconsvg = "";
        if (self.updatedIcons[key]) {
          icon = self.updatedIcons[key];
        } else if (componentInfo && componentInfo.icon) {
          icon = componentInfo.icon;
        } else if (componentInfo && componentInfo.iconsvg) {
          iconsvg = componentInfo.iconsvg;
        }
        var selected = (self.state.selectedNodes[key] === true);
        if (selected) {
          selectedIds.push(key);
        }

        var nodeClassNames = self.state.objectClassNames.nodes || {};
        var classNames = Object.keys(nodeClassNames).filter(function (className) {
          return nodeClassNames[className](node);
        }).join(" ");

        var portClassNames = self.state.objectClassNames.ports || null;

        var nodeOptions = {
          key: key,
          nodeID: key,
          x: node.metadata.x,
          y: node.metadata.y,
          label: node.metadata.label,
          sublabel: node.metadata.sublabel || node.component,
          snap: self.props.snap,
          width: node.metadata.width,
          height: node.metadata.height,
          app: self.props.app,
          graphView: self,
          graph: graph,
          node: node,
          icon: icon,
          iconsvg: iconsvg,
          ports: ports,
          onNodeSelection: self.props.onNodeSelection,
          selected: selected,
          error: (self.state.errorNodes[key] === true),
          showContext: self.props.showContext,
          highlightPort: highlightPort,
          classNames: classNames,
          subgraph: componentInfo ? componentInfo.subgraph : false,
          disabled: disabled,
          portClassNames: portClassNames
        };

        nodeOptions = TheGraph.merge(TheGraph.config.graph.node, nodeOptions);
        return TheGraph.factories.graph.createGraphNode.call(this, nodeOptions);
      });

      var length = function (edgeOptions) {
        return Math.sqrt(
          Math.pow((edgeOptions.tX - edgeOptions.sX), 2) +
          Math.pow((edgeOptions.tY - edgeOptions.sY), 2)
        );
      };

      var opacity = function (len) {
        var max = 1200,
            min = 100,
            oMin = 0.3;
        return len <= min ? 1 : len >= max ? oMin :
          ((1 - ((len - min) / (max-min))) * (1 - oMin) + oMin);
      };

      // Edges
      var edges = graph.edges.map(function (edge) {
        var source = graph.getNode(edge.from.node);
        var target = graph.getNode(edge.to.node);
        if (!source || !target) {
          return;
        }

        var route = 0;
        if (edge.metadata && edge.metadata.route) {
          route = edge.metadata.route;
        }

        // Initial ports from edges, and give port top/last edge color
        var sourcePort = self.getNodeOutport(graph, edge.from.node, edge.from.port, route, source.component);
        var targetPort = self.getNodeInport(graph, edge.to.node, edge.to.port, route, target.component);

        var exists = function (value) {
          return value !== undefined && value !== null;
        };
        var label = source.metadata.label + '() ' +
          edge.from.port.toUpperCase() +
          (exists(edge.from.index) ? '['+edge.from.index+']' : '') + ' -> ' +
          edge.to.port.toUpperCase() +
          (exists(edge.to.index) ? '['+edge.to.index+']' : '') + ' ' +
          target.metadata.label + '()';
        var key = edge.from.node + '() ' +
          edge.from.port.toUpperCase() +
          (exists(edge.from.index) ? '['+edge.from.index+']' : '') + ' -> ' +
          edge.to.port.toUpperCase() +
          (exists(edge.to.index) ? '['+edge.to.index+']' : '') + ' ' +
          edge.to.node + '()';

        var sourceY = sourcePort.expand && sourcePort.indexY ?
          sourcePort.indexY[edge.from.index] || sourcePort.y : sourcePort.y;

        var targetY = targetPort.expand && targetPort.indexY ?
          targetPort.indexY[edge.to.index] || targetPort.y : targetPort.y;

        var edgeClassNames = self.state.objectClassNames.edges || {};
        var classNames = Object.keys(edgeClassNames).filter(function (className) {
          return edgeClassNames[className](edge);
        }).join(" ");

        var edgeOptions = {
          key: key,
          edgeID: key,
          graph: graph,
          edge: edge,
          app: self.props.app,
          sX: source.metadata.x + source.metadata.width,
          sY: source.metadata.y + sourceY,
          tX: target.metadata.x,
          tY: target.metadata.y + targetY,
          label: label,
          route: route,
          onEdgeSelection: self.props.onEdgeSelection,
          selected: (self.state.selectedEdges.indexOf(edge) !== -1),
          animated: (self.state.animatedEdges.indexOf(edge) !== -1),
          showContext: self.props.showContext,
          nodeSelected: (self.state.selectedNodes[edge.from.node] === true) ||
            (self.state.selectedNodes[edge.to.node] === true),
          classNames: classNames,
          disabled: disabled
        };

        edgeOptions.length = length(edgeOptions);
        edgeOptions.opacity = opacity(edgeOptions.length);

        edgeOptions = TheGraph.merge(TheGraph.config.graph.edge, edgeOptions);
        return TheGraph.factories.graph.createGraphEdge.call(this, edgeOptions);
      }).sort(function (edgeA, edgeB) {
        return (edgeA.props.selected && !edgeB.props.selected) ? 1 :
          (edgeA.props.nodeSelected && !edgeB.props.nodeSelected) ? 1 :
          (edgeA.props.length >= edgeB.props.length) ? -1 : 1;
      });

      // IIPs
      var iips = graph.initializers.map(function (iip) {
        var target = graph.getNode(iip.to.node);
        if (!target) { return; }

        var targetPort = self.getNodeInport(graph, iip.to.node, iip.to.port, 0, target.component);
        var tX = target.metadata.x;
        var tY = target.metadata.y + targetPort.y;

        var data = iip.from.data;
        var type = typeof data;
        var label = data === true || data === false || type === "number" || type === "string" ? data : type;

        var iipClassNames = self.state.objectClassNames.iips || {};
        var classNames = Object.keys(iipClassNames).filter(function (className) {
          return iipClassNames[className](iip);
        }).join(" ");

        var iipOptions = {
          graph: graph,
          label: label,
          x: tX,
          y: tY,
          classNames: classNames,
          disabled: disabled
        };

        iipOptions = TheGraph.merge(TheGraph.config.graph.iip, iipOptions);
        return TheGraph.factories.graph.createGraphIIP.call(this, iipOptions);

      });


      // Inport exports
      var inports = Object.keys(graph.inports).map(function (key) {
        var inport = graph.inports[key];
        // Export info
        var label = key;
        var nodeKey = inport.process;
        var portKey = inport.port;
        if (!inport.metadata) {
          inport.metadata = {x:0, y:0};
        }
        var metadata = inport.metadata;
        if (!metadata.x) { metadata.x = 0; }
        if (!metadata.y) { metadata.y = 0; }
        if (!metadata.width) { metadata.width = TheGraph.config.exportWidth; }
        if (!metadata.height) { metadata.height = TheGraph.config.exportHeight; }
        // Private port info
        var portInfo = self.portInfo[nodeKey];
        if (!portInfo) {
          console.warn("Node "+nodeKey+" not found for graph inport "+label);
          return;
        }
        var privatePort = portInfo.inports[portKey];
        if (!privatePort) {
          console.warn("Port "+nodeKey+"."+portKey+" not found for graph inport "+label);
          return;
        }
        // Private node
        var privateNode = graph.getNode(nodeKey);
        if (!privateNode) {
          console.warn("Node "+nodeKey+" not found for graph inport "+label);
          return;
        }

        var inportClassNames = self.state.objectClassNames.inports || {};
        var classNames = Object.keys(inportClassNames).filter(function (className) {
          return inportClassNames[className](inport);
        }).join(" ");

        var selected = (self.state.selectedInports[key] === true);
        if (selected) {
          selectedInports.push(key);
        }

        var route = self.getGraphExportRoute(inport, true);
        // Node view
        var expNode = {
          key: "inport.node."+key,
          export: inport,
          exportKey: key,
          x: metadata.x,
          y: metadata.y,
          width: metadata.width,
          height: metadata.height,
          label: label,
          app: self.props.app,
          graphView: self,
          graph: graph,
          node: {},
          route: route,
          ports: self.getGraphInport(key),
          isIn: true,
          icon: (metadata.icon ? metadata.icon : "sign-in"),
          showContext: self.props.showContext,
          classNames: classNames,
          onNodeSelection: self.props.onExportSelection,
          selected: selected,
          disabled: disabled
        };
        expNode = TheGraph.merge(TheGraph.config.graph.inportNode, expNode);
        // Edge view
        var expEdge = {
          key: "inport.edge."+key,
          export: inport,
          exportKey: key,
          graph: graph,
          app: self.props.app,
          edge: {},
          route: route,
          isIn: true,
          label: "export in " + label.toUpperCase() + " -> " + portKey.toUpperCase() + " " + privateNode.metadata.label,
          sX: expNode.x + TheGraph.config.exportWidth,
          sY: expNode.y + TheGraph.config.exportHeight / 2,
          tX: privateNode.metadata.x + privatePort.x,
          tY: privateNode.metadata.y + privatePort.y,
          showContext: self.props.showContext,
          nodeSelected: self.state.selectedNodes[privateNode.id] === true,
          classNames: classNames,
          selected: selected,
          disabled: disabled
        };

        expEdge.length = length(expEdge);
        expEdge.opacity = opacity(expEdge.length);

        expEdge = TheGraph.merge(TheGraph.config.graph.inportEdge, expEdge);
        edges.unshift(TheGraph.factories.graph.createGraphEdge.call(this, expEdge));
        return TheGraph.factories.graph.createGraphNode.call(this, expNode);
      });


      // Outport exports
      var outports = Object.keys(graph.outports).map(function (key) {
        var outport = graph.outports[key];
        // Export info
        var label = key;
        var nodeKey = outport.process;
        var portKey = outport.port;
        if (!outport.metadata) { 
          outport.metadata = {x:0, y:0}; 
        }
        var metadata = outport.metadata;
        if (!metadata.x) { metadata.x = 0; }
        if (!metadata.y) { metadata.y = 0; }
        if (!metadata.width) { metadata.width = TheGraph.config.exportWidth; }
        if (!metadata.height) { metadata.height = TheGraph.config.exportHeight; }
        // Private port info
        var portInfo = self.portInfo[nodeKey];
        if (!portInfo) {
          console.warn("Node "+nodeKey+" not found for graph outport "+label);
          return;
        }
        var privatePort = portInfo.outports[portKey];
        if (!privatePort) {
          console.warn("Port "+nodeKey+"."+portKey+" not found for graph outport "+label);
          return;
        }
        // Private node
        var privateNode = graph.getNode(nodeKey);
        if (!privateNode) {
          console.warn("Node "+nodeKey+" not found for graph outport "+label);
          return;
        }

        var outportClassNames = self.state.objectClassNames.outports || {};
        var classNames = Object.keys(outportClassNames).filter(function (className) {
          return outportClassNames[className](outport);
        }).join(" ");

        var selected = (self.state.selectedOutports[key] === true);
        if (selected) {
          selectedOutports.push(key);
        }

        var route = self.getGraphExportRoute(outport, false);

        // Node view
        var expNode = {
          key: "outport.node."+key,
          export: outport,
          exportKey: key,
          x: metadata.x,
          y: metadata.y,
          width: metadata.width,
          height: metadata.height,
          label: label,
          app: self.props.app,
          graphView: self,
          graph: graph,
          node: {},
          route: route,
          ports: self.getGraphOutport(key),
          isIn: false,
          icon: (metadata.icon ? metadata.icon : "sign-out"),
          showContext: self.props.showContext,
          classNames: classNames,
          onNodeSelection: self.props.onExportSelection,
          selected: selected,
          disabled: disabled
        };
        expNode = TheGraph.merge(TheGraph.config.graph.outportNode, expNode);
        // Edge view
        var expEdge = {
          key: "outport.edge."+key,
          export: outport,
          exportKey: key,
          graph: graph,
          app: self.props.app,
          edge: {},
          route: route,
          isIn: false,
          label: privateNode.metadata.label + " " + portKey.toUpperCase() + " -> " + label.toUpperCase() + " export out",
          sX: privateNode.metadata.x + privatePort.x,
          sY: privateNode.metadata.y + privatePort.y,
          tX: expNode.x,
          tY: expNode.y + TheGraph.config.exportHeight / 2,
          showContext: self.props.showContext,
          nodeSelected: self.state.selectedNodes[privateNode.id] === true,
          classNames: classNames,
          selected: selected,
          disabled: disabled
        };

        expEdge.length = length(expEdge);
        expEdge.opacity = opacity(expEdge.length);

        expEdge = TheGraph.merge(TheGraph.config.graph.outportEdge, expEdge);
        edges.unshift(TheGraph.factories.graph.createGraphEdge.call(this, expEdge));
        return TheGraph.factories.graph.createGraphNode.call(this, expNode);
      });

      // Groups
      var edgePreview = this.state.edgePreview;
      var groups = graph.groups.map(function (group) {
        if (group.nodes.length < 1) {
          return;
        }
        var limits = TheGraph.findMinMax(graph, group.nodes);
        if (!limits) {
          return;
        }
        var groupOptions = {
          key: "group."+group.name,
          graph: graph,
          item: group,
          app: self.props.app,
          minX: limits.minX,
          minY: limits.minY,
          maxX: limits.maxX,
          maxY: limits.maxY,
          scale: self.props.scale,
          label: group.name,
          nodes: group.nodes,
          description: group.metadata.description,
          color: group.metadata.color,
          triggerMoveGroup: self.moveGroup,
          showContext: self.props.showContext,
          edgePreview: edgePreview,
          disabled: disabled
        };
        groupOptions = TheGraph.merge(TheGraph.config.graph.nodeGroup, groupOptions);
        return TheGraph.factories.graph.createGraphGroup.call(this, groupOptions);
      });

      if (this.state.marqueeSelect) {
        if (this.state.marqueeSelectStartX < this.state.marqueeSelectCurrentX) {
          var minX = this.state.marqueeSelectStartX;
          var maxX = this.state.marqueeSelectCurrentX;
        } else {
          var minX = this.state.marqueeSelectCurrentX;
          var maxX = this.state.marqueeSelectStartX;
        }

        if (this.state.marqueeSelectStartY < this.state.marqueeSelectCurrentY) {
          var minY = this.state.marqueeSelectStartY;
          var maxY = this.state.marqueeSelectCurrentY;
        } else {
          var minY = this.state.marqueeSelectCurrentY;
          var maxY = this.state.marqueeSelectStartY;
        }

        var scale = self.props.scale;

        //minX *= scale;
        //minY *= scale;
        //maxX *= scale;
        //maxY *= scale;

        var pseudoGroup = {
          name: "selection",
          nodes: selectedIds,
          inports: selectedInports,
          outports: selectedOutports,
          metadata: {color:1}
        };
        var selectionGroupOptions = {
          graph: graph,
          app: self.props.app,
          item: pseudoGroup,
          minX: minX,
          minY: minY,
          maxX: maxX,
          maxY: maxY,
          scale: scale,
          color: 1,
          triggerMoveGroup: self.moveGroup,
          showContext: self.props.showContext,
          isMarqueeSelect: true
        };
        selectionGroupOptions = TheGraph.merge(TheGraph.config.graph.selectionGroup, selectionGroupOptions);
        var selectionGroup = TheGraph.factories.graph.createGraphGroup.call(this, selectionGroupOptions);
        groups.push(selectionGroup);
      }
      // Selection pseudo-group
      else if (
        this.state.displaySelectionGroup &&
        (
          selectedIds.length +
          selectedInports.length +
          selectedOutports.length
        ) >= 2
      ) {
        var limits = TheGraph.findMinMax(
          graph, selectedIds, selectedInports, selectedOutports);
        if (limits) {
          var pseudoGroup = {
            name: "selection",
            nodes: selectedIds,
            inports: selectedInports,
            outports: selectedOutports,
            metadata: {color:1}
          };
          var selectionGroupOptions = {
            graph: graph,
            app: self.props.app,
            item: pseudoGroup,
            minX: limits.minX,
            minY: limits.minY,
            maxX: limits.maxX,
            maxY: limits.maxY,
            scale: self.props.scale,
            color: pseudoGroup.metadata.color,
            triggerMoveGroup: self.moveGroup,
            showContext: self.props.showContext,
            disabled: disabled
          };
          selectionGroupOptions = TheGraph.merge(TheGraph.config.graph.selectionGroup, selectionGroupOptions);
          var selectionGroup = TheGraph.factories.graph.createGraphGroup.call(this, selectionGroupOptions);
          groups.push(selectionGroup);
        }
      }


      // Edge preview
      if (edgePreview) {
        var edgePreviewOptions;
        if (edgePreview.from) {
          var source = graph.getNode(edgePreview.from.process);
          var sourcePort = this.getNodeOutport(graph, edgePreview.from.process, edgePreview.from.port);

          var sourceY = sourcePort.expand && sourcePort.indexY ?
            sourcePort.indexY[edgePreview.from.index] || sourcePort.y : sourcePort.y;

          edgePreviewOptions = {
            sX: source.metadata.x + source.metadata.width,
            sY: source.metadata.y + sourceY,
            tX: this.state.edgePreviewX,
            tY: this.state.edgePreviewY,
            route: edgePreview.metadata.route,
            ref: 'edgePreview',
            previewPort: 'in'
          };
        } else {
          var target = graph.getNode(edgePreview.to.process);
          var targetPort = this.getNodeInport(graph, edgePreview.to.process, edgePreview.to.port);

          var targetY = targetPort.expand && targetPort.indexY ?
            targetPort.indexY[edgePreview.to.index] || targetPort.y : targetPort.y;

          edgePreviewOptions = {
            sX: this.state.edgePreviewX,
            sY: this.state.edgePreviewY,
            tX: target.metadata.x,
            tY: target.metadata.y + targetY,
            route: edgePreview.metadata.route,
            ref: 'edgePreview',
            previewPort: 'out'
          };
        }
        edgePreviewOptions = TheGraph.merge(TheGraph.config.graph.edgePreview, edgePreviewOptions);
        var edgePreviewView = TheGraph.factories.graph.createGraphEdgePreview.call(this, edgePreviewOptions);
        edges.push(edgePreviewView);
      }

      var groupsOptions = TheGraph.merge(TheGraph.config.graph.groupsGroup, { children: groups });
      var groupsGroup = TheGraph.factories.graph.createGraphGroupsGroup.call(this, groupsOptions);

      var edgesOptions = TheGraph.merge(TheGraph.config.graph.edgesGroup, { children: edges });
      var edgesGroup = TheGraph.factories.graph.createGraphEdgesGroup.call(this, edgesOptions);

      var iipsOptions = TheGraph.merge(TheGraph.config.graph.iipsGroup, { children: iips });
      var iipsGroup = TheGraph.factories.graph.createGraphIIPGroup.call(this, iipsOptions);

      var nodesOptions = TheGraph.merge(TheGraph.config.graph.nodesGroup, { children: nodes });
      var nodesGroup = TheGraph.factories.graph.createGraphNodesGroup.call(this, nodesOptions);

      var inportsOptions = TheGraph.merge(TheGraph.config.graph.inportsGroup, { children: inports });
      var inportsGroup = TheGraph.factories.graph.createGraphInportsGroup.call(this, inportsOptions);

      var outportsOptions = TheGraph.merge(TheGraph.config.graph.outportsGroup, { children: outports });
      var outportsGroup = TheGraph.factories.graph.createGraphGroupsGroup.call(this, outportsOptions);

      var containerContents = [
        groupsGroup,
        edgesGroup,
        iipsGroup,
        nodesGroup,
        inportsGroup,
        outportsGroup
      ];

      var selectedClass = (this.state.forceSelection || (
        selectedIds.length +
        selectedInports.length +
        selectedOutports.length
      ) > 0) ? ' selection' : '';

      var containerOptions = TheGraph.merge(TheGraph.config.graph.container, { className: 'graph' + selectedClass });
      this.rendered = true;
      window.bench.mark('Rendering graph editor react component');
      return TheGraph.factories.graph.createGraphContainerGroup.call(this, containerOptions, containerContents);

    },
    componentDidUpdate: function () {
      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      var event = new CustomEvent('rendersuccess', {detail: this.props.graph});
      window.bench.mark('Updated graph editor react component');
      appDomNode.dispatchEvent(event);
    }
  }));

})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  // Initialize namespace for configuration and factory functions.
  TheGraph.config.node = {
    snap: TheGraph.config.nodeSize,
    container: {},
    background: {
      className: "node-bg",
      heightPadding: 25
    },
    border: {
      className: "node-border drag",
    },
    innerRect: {
      className: "node-rect drag",
      x: 3,
      y: 3,
    },
    icon: {
      ref: "icon",
      className: "icon node-icon drag"
    },
    iconsvg: {
      className: "icon node-icon drag"
    },
    inports: {
      className: "inports"
    },
    outports: {
      className: "outports"
    },
    labelBackground: {
      className: "node-label-bg"
    },
    showLabelRect: true,
    labelRect: {
      className: "text-bg-rect"
    },
    labelText: {
      className: "node-label"
    },
    sublabelBackground: {
      className: "node-sublabel-bg"
    },
    sublabelRect: {
      className: "text-bg-rect"
    },
    sublabelText: {
      className: "node-sublabel"
    },
    showSublabelGroup: true
  };

  var getDefaultConfig = function () {
    // Props configured by TheGraph.config
    return {
      snap: TheGraph.config.nodeSize,
      border: {
        rx: TheGraph.config.nodeRadius,
        ry: TheGraph.config.nodeRadius
      },
      innerRect: {
        rx: TheGraph.config.nodeRadius - 2,
        ry: TheGraph.config.nodeRadius - 2
      }
    }
  };

  var getNodeConfig = function () {
    var res = TheGraph.mergeDeep(TheGraph.config.node, getDefaultConfig());
    //debugger;
    return res;
  };

  // These factories use generic factories from the core, but
  // each is called separately allowing developers to intercept
  // individual elements of the node creation.
  TheGraph.factories.node = {
    createNodeGroup: TheGraph.factories.createGroup,
    createNodeBackgroundRect: TheGraph.factories.createRect,
    createNodeBorderRect: TheGraph.factories.createRect,
    createNodeInnerRect: TheGraph.factories.createRect,
    createNodeResizeRect: TheGraph.factories.createRect,
    createNodeResizeGroup: TheGraph.factories.createGroup,
    createNodeIconText: TheGraph.factories.createText,
    createNodeIconSVG: TheGraph.factories.createImg,
    createNodeInportsGroup: TheGraph.factories.createGroup,
    createNodeOutportsGroup: TheGraph.factories.createGroup,
    createNodeLabelGroup: TheGraph.factories.createGroup,
    createNodeLabelRect: TheGraph.factories.createRect,
    createNodeLabelText: TheGraph.factories.createText,
    createNodeSublabelGroup: TheGraph.factories.createGroup,
    createNodeSublabelRect: TheGraph.factories.createRect,
    createNodeSublabelText: TheGraph.factories.createText,
    createNodePort: createNodePort
  };

  function createNodePort(options) {
    return TheGraph.Port(options);
  }

  // PolymerGestures monkeypatch
  PolymerGestures.dispatcher.gestures.forEach( function (gesture) {
    // hold
    if (gesture.HOLD_DELAY) {
      gesture.HOLD_DELAY = 500;
    }
    // track
    if (gesture.WIGGLE_THRESHOLD) {
      gesture.WIGGLE_THRESHOLD = 8;
    }
  });

  // Node view
  TheGraph.Node = React.createFactory( React.createClass({
    displayName: "TheGraphNode",
    mixins: [
      TheGraph.mixins.Tooltip
    ],
    componentDidMount: function () {
      var domNode = ReactDOM.findDOMNode(this);

      domNode.addEventListener("dblclick", function () {
        var detail;
        var event;
        if (this.props.export && this.props.isIn) {
          detail = {
            export: this.props.export,
            exportKey: this.props.exportKey
          };
          event = 'dblclick-inport';
        } else if (this.props.export) {
          detail = {
            export: this.props.export,
            exportKey: this.props.exportKey
          };
          event = 'dblclick-outport';
        } else {
          detail = this.props.node;
          event = 'dblclick-node';
        }
        domNode.dispatchEvent(new CustomEvent(event, {
          detail: detail,
          bubbles: true
        }));
      }.bind(this));

      // Dragging
      domNode.addEventListener("trackstart", this.onTrackStart);

      // Tap to select
      if (this.props.onNodeSelection) {
        domNode.addEventListener("tap", this.onNodeSelection);
      }

      domNode.addEventListener("the-graph-expand-port", this.expandPort);

      // Context menu
      if (this.props.showContext) {
        ReactDOM.findDOMNode(this).addEventListener("contextmenu", this.showContext);
        ReactDOM.findDOMNode(this).addEventListener("hold", this.showContext);
      }

    },
    onNodeSelection: function (event) {
      // Don't tap app (unselect)
      event.stopPropagation();

      var toggle = (TheGraph.metaKeyPressed || event.pointerType==="touch");
      if (this.props.export) {
        this.props.onNodeSelection(
          this.props.exportKey, this.props.export, this.props.isIn, toggle);
      } else {
        this.props.onNodeSelection(this.props.nodeID, this.props.node, toggle);
      }
    },
    onTrackStart: function (event) {
      // Don't drag graph
      event.stopPropagation();

      // Don't change selection
      event.preventTap();

      // Don't drag under menu
      if (this.props.app.menuShown) { return; }

      // Don't drag while pinching
      if (this.props.app.pinching) { return; }

      var domNode = ReactDOM.findDOMNode(this);

      var resize = event.target.parentNode.classList.contains('resize');
      var onTrack = this.getOnTrack(resize);
      var onTrackEnd = this.getOnTrackEnd(resize, onTrack);
      domNode.addEventListener("track", onTrack);
      domNode.addEventListener("trackend", onTrackEnd);

      // Moving a node should only be a single transaction
      if (resize) {
        this.props.graph.startTransaction('resizenode');
      } else if (this.props.export) {
        this.props.graph.startTransaction('moveexport');
      } else {
        this.props.graph.startTransaction('movenode');
      }
    },
    getOnTrack: function (resize) {
      var originalX = this.props.x;
      var originalY = this.props.y;
      var originalWidth = this.props.width;
      var originalHeight = this.props.height;
      return function (event) {
        // Don't fire on graph
        event.stopPropagation();

        var scale = this.props.app.state.scale;
        var deltaX = event.ddx / scale;
        var deltaY = event.ddy / scale;

        // Fires a change event on noflo graph, which triggers redraw
        if (resize) {
          var width = this.props.width;
          var height = this.props.height;

          var min = TheGraph.config.nodeSize;

          var x = this.props.x,
              y = this.props.y;

          var resizeDX = event.dx / scale,
              resizeDY = event.dy / scale;

          var resizers = {
            top: function () {
              if (event.dy > originalHeight - min && height === min) {
                return {};
              }
              var props = {};
              var newHeight = originalHeight - resizeDY;
              if (newHeight >= min) {
                props.height = newHeight;
                props.y = originalY + resizeDY;
              } else {
                props.height = min;
                props.y = originalY + (originalHeight - min);
              }
              return props;
            },
            left: function () {
              if (event.dx > originalWidth - min && width === min) {
                return {};
              }
              var props = {};
              var newWidth = originalWidth - resizeDX;
              if (newWidth >= min) {
                props.width = newWidth;
                props.x = originalX + resizeDX;
              } else {
                props.width = min;
                props.x = originalX;
              }
              return props;
            },
            bottom: function () {
              if (event.dy < 0 && height === min) {
                return {};
              }
              var newHeight = originalHeight + resizeDY;
              return {
                height: newHeight < min ? min : newHeight
              };
            },
            right: function () {
              if (event.dx < 0 && width === min) {
                return {};
              }
              var newWidth = originalWidth + resizeDX;
              return {
                width: newWidth < min ? min : newWidth,
              };
            },
            bottomright: function () {
              return TheGraph.merge(this.bottom(), this.right());
            },
            topleft: function () {
              return TheGraph.merge(this.top(), this.left());
            },
            bottomleft: function () {
              return TheGraph.merge(this.bottom(), this.left());
            },
            topright: function () {
              return TheGraph.merge(this.top(), this.right());
            }
          };
          var resizeType = event.target.classList[0];
          var resizer = resizers[resizeType]();
          if (this.props.export) {
            return;
          } else {
            this.props.graph.setNodeMetadata(this.props.nodeID, resizer);
          }
        } else if (this.props.export) {
          var newPos = {
            x: this.props.export.metadata.x + deltaX,
            y: this.props.export.metadata.y + deltaY
          };
          if (this.props.isIn) {
            this.props.graph.setInportMetadata(this.props.exportKey, newPos);
          } else {
            this.props.graph.setOutportMetadata(this.props.exportKey, newPos);
          }
        } else {
          var app = this.props.app;
          var rect = app.getBoundingRect();
          var nodeRect = ReactDOM
            .findDOMNode(this)
            .querySelector('.node-rect')
            .getBoundingClientRect();

          var direction = {x: 0, y: 0};

          if (nodeRect.right > rect.width + rect.left) {
            direction.x = 1;
          } else if (nodeRect.left < rect.left) {
            direction.x = -1;
          }

          if (nodeRect.bottom > rect.height + rect.top) {
            direction.y = 1;
          } else if (nodeRect.top < rect.top) {
            direction.y = -1;
          }

          if (direction.x || direction.y) {
            // Order of events:
            // 1. Adjust node for mouse move
            // 2. Adjust node for pan
            // 3. Actually pan the screen
            // 4. Repeat 2-3
            this.props.graph.once('changeNode', app.startAutoPan.bind(
              app,
              direction,
              function (offset, direction, autoPanFn) {
                var node = this.props.graph.getNode(this.props.nodeID);
                var x = node.metadata.x + (offset/scale * direction.x);
                var y = node.metadata.y + (offset/scale * direction.y);

                this.props.graph.once('changeNode', autoPanFn);
                this.props.graph.setNodeMetadata(this.props.nodeID, {
                  x: x,
                  y: y
                });
              }.bind(this)
            ));
          } else {
            app.stopAutoPan();
          }

          this.props.graph.setNodeMetadata(this.props.nodeID, {
            x: this.props.node.metadata.x + deltaX,
            y: this.props.node.metadata.y + deltaY
          });
        }
      }.bind(this);
    },
    getOnTrackEnd: function (resize, onTrack) {
      var onTrackEnd = function (event) {
        var config = getNodeConfig();
        // Don't fire on graph
        event.stopPropagation();
        this.props.app.stopAutoPan();

        var domNode = ReactDOM.findDOMNode(this);
        domNode.removeEventListener("track", onTrack);
        domNode.removeEventListener("trackend", onTrackEnd);

        // Snap to grid
        var snapToGrid = true;
        var snap = this.props.snap || config.snap / 2;
        if (snapToGrid && !resize) {
          var x, y;
          if (this.props.export) {
            var newPos = {
              x: Math.round(this.props.export.metadata.x/snap) * snap,
              y: Math.round(this.props.export.metadata.y/snap) * snap
            };
            if (this.props.isIn) {
              this.props.graph.setInportMetadata(this.props.exportKey, newPos);
            } else {
              this.props.graph.setOutportMetadata(this.props.exportKey, newPos);
            }
          } else {
            this.props.graph.setNodeMetadata(this.props.nodeID, {
              x: Math.round(this.props.node.metadata.x/snap) * snap,
              y: Math.round(this.props.node.metadata.y/snap) * snap
            });
          }
        }

        // Moving a node should only be a single transaction
        if (resize) {
          this.props.graph.endTransaction('resizenode');
        } else if (this.props.export) {
          this.props.graph.endTransaction('moveexport');
        } else {
          this.props.graph.endTransaction('movenode');
        }
      }.bind(this);
      return onTrackEnd;
    },
    expandPort: function (event) {
      var expandedPorts = this.props.node.metadata.expandedPorts;
      if (!expandedPorts) {
        expandedPorts = {
          inports: {},
          outports: {}
        };
      }
      expandedPorts[event.detail.isIn ? 'inports' : 'outports'][event.detail.port] =
        event.detail.expand;

      this.props.graph.setNodeMetadata(this.props.nodeID, {
        expandedPorts: expandedPorts
      });
    },
    showContext: function (event) {
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var boundingRect = this.props.app.getBoundingRect();

      var x = (event.x || event.clientX || 0) - boundingRect.left;
      var y = (event.y || event.clientY || 0) - boundingRect.top;

      // App.showContext
      this.props.showContext({
        element: this,
        type: (this.props.export ? (this.props.isIn ? "graphInport" : "graphOutport") :
               this.props.subgraph ? "subgraph" : "node"),
        x: x,
        y: y,
        graph: this.props.graph,
        itemKey: (this.props.export ? this.props.exportKey : this.props.nodeID),
        item: (this.props.export ? this.props.export : this.props.node)
      });
    },
    getContext: function (menu, options, hide) {
      // If this node is an export
      if (this.props.export) {
        return TheGraph.Menu({
          menu: menu,
          options: options,
          triggerHideContext: hide,
          label: this.props.exportKey
        });
      }

      // Absolute position of node
      var x = options.x;
      var y = options.y;
      var scale = this.props.app.state.scale;
      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var nodeX = (this.props.x + this.props.width / 2) * scale + appX;
      var nodeY = (this.props.y + this.props.height / 2) * scale + appY;
      var deltaX = nodeX - x;
      var deltaY = nodeY - y;
      var ports = this.props.ports;
      var processKey = this.props.nodeID;
      var highlightPort = this.props.highlightPort;

      // If there is a preview edge started, only show connectable ports
      if (this.props.graphView.state.edgePreview) {
        if (this.props.graphView.state.edgePreview.isIn) {
          // Show outputs
          return TheGraph.NodeMenuPorts({
            ports: ports.outports,
            triggerHideContext: hide,
            isIn: false,
            scale: scale,
            processKey: processKey,
            deltaX: deltaX,
            deltaY: deltaY,
            translateX: x,
            translateY: y,
            nodeWidth: this.props.width,
            nodeHeight: this.props.height,
            highlightPort: highlightPort
          });
        } else {
          // Show inputs
          return TheGraph.NodeMenuPorts({
            ports: ports.inports,
            triggerHideContext: hide,
            isIn: true,
            scale: scale,
            processKey: processKey,
            deltaX: deltaX,
            deltaY: deltaY,
            translateX: x,
            translateY: y,
            nodeWidth: this.props.width,
            nodeHeight: this.props.height,
            highlightPort: highlightPort
          });
        }
      }

      // Default, show whole node menu
      return TheGraph.NodeMenu({
        menu: menu,
        options: options,
        triggerHideContext: hide,
        label: this.props.label,
        graph: this.props.graph,
        graphView: this.props.graphView,
        node: this,
        icon: this.props.icon,
        ports: ports,
        process: this.props.node,
        processKey: processKey,
        x: x,
        y: y,
        nodeWidth: this.props.width,
        nodeHeight: this.props.height,
        deltaX: deltaX,
        deltaY: deltaY,
        highlightPort: highlightPort
      });
    },
    getTooltipTrigger: function () {
      return ReactDOM.findDOMNode(this);
    },
    shouldShowTooltip: function () {
      return (this.props.app.state.scale < TheGraph.zbpNormal);
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      // Only rerender if changed
      return (
        nextProps.x !== this.props.x ||
        nextProps.y !== this.props.y ||
        nextProps.width !== this.props.width ||
        nextProps.height !== this.props.height ||
        nextProps.icon !== this.props.icon ||
        nextProps.label !== this.props.label ||
        nextProps.sublabel !== this.props.sublabel ||
        nextProps.ports !== this.props.ports ||
        nextProps.selected !== this.props.selected ||
        nextProps.error !== this.props.error ||
        nextProps.highlightPort !== this.props.highlightPort ||
        nextProps.ports.dirty ||
        nextProps.classNames !== this.props.classNames ||
        nextProps.portClassNames !== this.props.portClassNames ||
        nextProps.route !== this.props.route
      );
    },
    render: function() {
      if (this.props.ports.dirty) {
        // This tag is set when an edge or iip changes port colors
        this.props.ports.dirty = false;
      }

      var label = this.props.label;
      var sublabel = this.props.sublabel;
      if (!sublabel || sublabel === label) {
        sublabel = "";
      }
      var x = this.props.x;
      var y = this.props.y;
      var width = this.props.width;
      var height = this.props.height;
      var portClassNames = this.props.portClassNames;

      // Ports
      var keys, count;
      var processKey = this.props.nodeID;
      var app = this.props.app;
      var graph = this.props.graph;
      var node = this.props.node;
      var isExport = (this.props.export !== undefined);
      var showContext = this.props.showContext;
      var highlightPort = this.props.highlightPort;
      var ports = this.props.ports;
      var inports = this.props.ports.inports;
      var outports = this.props.ports.outports;
      var maxInports = Object.keys(inports).reduce(function (max, key) {
        var len = inports[key].label.length + (inports[key].addressable ? 1 : 0);
        return max >= len ? max : len;
      }, 0);
      var maxOutports = Object.keys(outports).reduce(function (max, key) {
        var len = outports[key].label.length + (outports[key].addressable ? 1 : 0);
        return max >= len ? max : len;
      }, 0);
      var minLabelWidth = 12/(width - 12);
      var maxLabelWidth = 1 - minLabelWidth;
      var inportLabelWidth = maxInports / (maxInports + maxOutports);
      var outportLabelWidth = maxOutports / (maxInports + maxOutports);
      if (inportLabelWidth < minLabelWidth) {
        inportLabelWidth = minLabelWidth;
      } else if (inportLabelWidth > maxLabelWidth) {
        inportLabelWidth = maxLabelWidth;
      }
      if (outportLabelWidth < minLabelWidth) {
        outportLabelWidth = minLabelWidth;
      } else if (outportLabelWidth > maxLabelWidth) {
        outportLabelWidth = maxLabelWidth;
      }

      var portViews = [{
        ports: inports,
        count: ports.inportCount,
        type: 'in',
        labelWidth: inportLabelWidth
      }, {
        ports: outports,
        count: ports.outportCount,
        type: 'out',
        labelWidth: outportLabelWidth
      }].map(function (config) {
        var ports = config.ports;
        var keys = Object.keys(ports);
        var count = config.count || 0;
        var views = [];
        var i = 0;
        var isIn = config.type === 'in';
        keys.forEach(function(key){
          var info = ports[key];
          var props = {
            app: app,
            graph: graph,
            node: node,
            key: processKey + "." + config.type + "." + info.label,
            label: info.label,
            processKey: processKey,
            isIn: isIn,
            isExport: isExport,
            isConnected: info.isConnected,
            nodeX: x,
            nodeY: y,
            nodeWidth: width,
            nodeHeight: height,
            x: info.x,
            y: info.y,
            expand: info.expand,
            port: {
              process: processKey,
              port: info.label,
              type: info.type,
              addressable: info.addressable
            },
            highlightPort: highlightPort,
            route: info.route,
            showContext: showContext,
            labelWidth: config.labelWidth,
            classNames: Object.keys(portClassNames || {}).filter(function (className) {
              return portClassNames[className](node, info, isIn);
            }).join(' ')
          };
          views.push(TheGraph.factories.node.createNodePort(props));
          i++;
          if (info.expand && info.indexList) {
            info.indexList.map(function (connected, index) {
              var info = ports[key];
              var indexLabel = '[' + index + ']';
              var x = info.x;
              var y = info.indexY[index];
              var props = {
                app: app,
                graph: graph,
                node: node,
                key: processKey + "." + config.type + "." + info.label + indexLabel,
                label: info.label + indexLabel,
                processKey: processKey,
                isIn: isIn,
                isExport: isExport,
                isConnected: info.isConnected,
                nodeX: x,
                nodeY: y,
                nodeWidth: width,
                nodeHeight: height,
                x: x,
                y: y,
                port: {
                  process: processKey,
                  port: info.label,
                  type: info.type,
                  index: index
                },
                highlightPort: highlightPort,
                route: info.route,
                showContext: showContext,
                labelWidth: config.labelWidth,
                classNames: Object.keys(portClassNames || {}).filter(function (className) {
                  return portClassNames[className](node, info, isIn);
                }).join(' ')
              };
              views.push(TheGraph.factories.node.createNodePort(props));
              i++;
            });
          }
        });
        return views;
      });
      var inportViews = portViews[0];
      var outportViews = portViews[1];

      // Node Icon
      var icon = TheGraph.FONT_AWESOME[ this.props.icon ];
      if (!icon) {
        icon = TheGraph.FONT_AWESOME.cog;
      }

      var nodeConfig = getNodeConfig();
      var iconContent;
      if (this.props.iconsvg && this.props.iconsvg !== "") {
          var iconSVGOptions = TheGraph.merge(nodeConfig.iconsvg, {
              src: this.props.iconsvg,
              x: TheGraph.config.nodeRadius - 4,
              y: TheGraph.config.nodeRadius - 4,
              width: this.props.width - 10,
              height: this.props.height - 10
          });
          iconContent = TheGraph.factories.node.createNodeIconSVG.call(this, iconSVGOptions);
      } else {
          var iconOptions = TheGraph.merge(nodeConfig.icon, {
              x: this.props.width / 2,
              y: this.props.height / 2,
              children: icon });
          iconOptions.className += (this.props.export && this.props.route !== undefined) ? " fill route" + this.props.route : "";
          iconContent = TheGraph.factories.node.createNodeIconText.call(this, iconOptions);
      }

      var backgroundRectOptions = TheGraph.merge(nodeConfig.background, { width: this.props.width, height: this.props.height + nodeConfig.background.heightPadding});
      var backgroundRect = TheGraph.factories.node.createNodeBackgroundRect.call(this, backgroundRectOptions);

      var borderRectOptions = TheGraph.merge(nodeConfig.border, { width: this.props.width, height: this.props.height });
      var borderRect = TheGraph.factories.node.createNodeBorderRect.call(this, borderRectOptions);

      // NOTE: The y (and height adjustment) is shifted down a few pixels to
      // make room for the labelText.
      var innerRectOptions = TheGraph.merge(nodeConfig.innerRect, { width: this.props.width, height: this.props.height });
      var innerRect = TheGraph.factories.node.createNodeInnerRect.call(this, innerRectOptions);

      var inportsOptions = TheGraph.merge(nodeConfig.inports, { children: inportViews });
      var inportsGroup = TheGraph.factories.node.createNodeInportsGroup.call(this, inportsOptions);

      var outportsOptions = TheGraph.merge(nodeConfig.outports, { children: outportViews });
      var outportsGroup = TheGraph.factories.node.createNodeOutportsGroup.call(this, outportsOptions);

      var labelTextOptions = TheGraph.merge(nodeConfig.labelText, {
        x: this.props.width / 2,
        y: (nodeConfig.labelText.y !== undefined) ? nodeConfig.labelText.y : this.props.height + 15,
        children: label
      });
      var labelText = TheGraph.factories.node.createNodeLabelText.call(this, labelTextOptions);

      if (nodeConfig.showLabelRect) {
        var labelRectX = this.props.width / 2;
        var labelRectY = this.props.height + 15;
        var labelRectOptions = buildLabelRectOptions(14, labelRectX, labelRectY, label.length, TheGraph.config.node.labelRect.className);
        labelRectOptions = TheGraph.merge(TheGraph.config.node.labelRect, labelRectOptions);
        var labelRect = TheGraph.factories.node.createNodeLabelRect.call(this, labelRectOptions);
        var labelGroupContents = [labelRect, labelText];
      } else {
        var labelGroupContents = [labelText];
      }

      var labelGroup = TheGraph.factories.node.createNodeLabelGroup.call(this, nodeConfig.labelBackground, [labelText]);

      var sublabelGroup;
      if (nodeConfig.showSublabelGroup) {
         var sublabelTextOptions = TheGraph.merge(TheGraph.config.node.sublabelText, { x: this.props.width / 2, y: this.props.height + 30, children: sublabel });
         var sublabelText = TheGraph.factories.node.createNodeSublabelText.call(this, sublabelTextOptions);

         var sublabelRectX = this.props.width / 2;
         var sublabelRectY = this.props.height + 30;
         var sublabelRectOptions = buildLabelRectOptions(9, sublabelRectX, sublabelRectY, sublabel.length, TheGraph.config.node.sublabelRect.className);
         sublabelRectOptions = TheGraph.merge(TheGraph.config.node.sublabelRect, sublabelRectOptions);
         var sublabelRect = TheGraph.factories.node.createNodeSublabelRect.call(this, sublabelRectOptions);

         sublabelGroup = TheGraph.factories.node.createNodeSublabelGroup.call(this, TheGraph.config.node.sublabelBackground, [sublabelRect, sublabelText]);
      }

      var translate = function (x, y) {
        return 'translate(' + x + ', ' + y + ')';
      };

      if (this.props.resize) {
        var resizeWidth = 10;
        var resizeOffset = 3;
        var resizeCornerConfig = {
          width: resizeWidth,
          height: resizeWidth
        };
        var horizontalConfig = {
          width: this.props.width - resizeWidth*2 + resizeOffset*2,
          height: resizeWidth
        };
        var verticalConfig = {
          width: resizeWidth,
          height: this.props.height - resizeWidth*2 + resizeOffset*2
        };
        var cornerConfigs = [
          {
            className: 'topleft',
            transform: translate(-1 * resizeOffset, -1 * resizeOffset)
          },
          {
            className: 'topright',
            transform: translate(
              this.props.width - resizeWidth + resizeOffset,
              -1 * resizeOffset
            )
          },
          {
            className: 'bottomleft',
            transform: translate(
              -1 * resizeOffset,
              this.props.height - resizeWidth + resizeOffset
            )
          },
          {
            className: 'bottomright',
            transform: translate(
              this.props.width - resizeWidth + resizeOffset,
              this.props.height - resizeWidth + resizeOffset
            )
          }
        ];
        var horizontalEdgeConfigs = [
          {
            className: 'top',
            transform: translate(resizeWidth - resizeOffset, -1*resizeOffset)
          },
          {
            className: 'bottom',
            transform: translate(
              resizeWidth - resizeOffset,
              this.props.height - resizeWidth + resizeOffset
            )
          },
        ];
        var verticalEdgeConfigs = [
          {
            className: 'left',
            transform: translate(-1*resizeOffset, resizeWidth - resizeOffset)
          },
          {
            className: 'right',
            transform: translate(
              this.props.width - resizeWidth + resizeOffset,
              resizeWidth - resizeOffset
            )
          },
        ];

        var resizeRectGroup = TheGraph.factories.node.createNodeResizeGroup.call(
          this,
          {className: 'resize'},
          cornerConfigs.map(function (config) {
            return TheGraph.factories.node.createNodeResizeRect.call(
              this,
              TheGraph.merge(resizeCornerConfig, config)
            );
          }.bind(this)).concat(verticalEdgeConfigs.map(function (config) {
            return TheGraph.factories.node.createNodeResizeRect.call(
              this,
              TheGraph.merge(verticalConfig, config)
            );
          }.bind(this))).concat(horizontalEdgeConfigs.map(function (config) {
            return TheGraph.factories.node.createNodeResizeRect.call(
              this,
              TheGraph.merge(horizontalConfig, config)
            );
          }.bind(this)))
        );
      };

      var nodeContents = [
        backgroundRect,
        borderRect,
        innerRect,
        iconContent
      ];

      if (!this.props.export && this.props.resize) {
        nodeContents.push(resizeRectGroup);
      }

      var nodeContents = nodeContents.concat([
        inportsGroup,
        outportsGroup,
        labelGroup
      ]);

      if (sublabelGroup) {
        nodeContent.push(sublabelGroup);
      }

      var nodeOptions = {
        className: "node drag"+
          (this.props.selected ? " selected" : "")+
          (this.props.error ? " error" : "")+
          (this.props.classNames ? " " + this.props.classNames : ""),
        name: this.props.nodeID,
        key: this.props.nodeID,
        title: label,
        transform: translate(x, y)
      };
      nodeOptions = TheGraph.merge(nodeConfig.container, nodeOptions);

      return TheGraph.factories.node.createNodeGroup.call(this, nodeOptions, nodeContents);
    }
  }));

  function buildLabelRectOptions(height, x, y, len, className) {

    var width = len * height * 2/3;
    var radius = height / 2;
    x -= width / 2;
    y -= height / 2;

    var result = {
      className: className,
      height: height * 1.1,
      width: width,
      rx: radius,
      ry: radius,
      x: x,
      y: y
    };

    return result;
  }

})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.nodeMenu = {
    container: {
      className: "context-node"
    },
    inports: {},
    outports: {},
    menu: {
      x: 0,
      y: 0
    }
  };

  TheGraph.factories.nodeMenu = {
    createNodeMenuGroup: TheGraph.factories.createGroup,
    createNodeMenuInports: createNodeMenuPorts,
    createNodeMenuOutports: createNodeMenuPorts,
    createNodeMenuMenu: createNodeMenuMenu
  };

  function createNodeMenuPorts(options) {
    return TheGraph.NodeMenuPorts(options);
  }

  function createNodeMenuMenu(options) {
    return TheGraph.Menu(options);
  }

  TheGraph.NodeMenu = React.createFactory( React.createClass({
    displayName: "TheGraphNodeMenu",
    radius: 72,
    stopPropagation: function (event) {
      // Don't drag graph
      event.stopPropagation();
    },
    componentDidMount: function () {
      // Prevent context menu
      ReactDOM.findDOMNode(this).addEventListener("contextmenu", function (event) {
        event.stopPropagation();
        event.preventDefault();
      }, false);
    },
    render: function() {
      var scale = this.props.node.props.app.state.scale;
      var ports = this.props.ports;
      var deltaX = this.props.deltaX;
      var deltaY = this.props.deltaY;

      var inportsOptions = {
        ports: ports.inports,
        isIn: true,
        scale: scale,
        processKey: this.props.processKey,
        deltaX: deltaX,
        deltaY: deltaY,
        nodeWidth: this.props.nodeWidth,
        nodeHeight: this.props.nodeHeight,
        highlightPort: this.props.highlightPort
      };

      inportsOptions = TheGraph.merge(TheGraph.config.nodeMenu.inports, inportsOptions);
      var inports = TheGraph.factories.nodeMenu.createNodeMenuInports.call(this, inportsOptions);

      var outportsOptions = {
        ports: ports.outports,
        isIn: false,
        scale: scale,
        processKey: this.props.processKey,
        deltaX: deltaX,
        deltaY: deltaY,
        nodeWidth: this.props.nodeWidth,
        nodeHeight: this.props.nodeHeight,
        highlightPort: this.props.highlightPort
      };

      outportsOptions = TheGraph.merge(TheGraph.config.nodeMenu.outports, outportsOptions);
      var outports = TheGraph.factories.nodeMenu.createNodeMenuOutports.call(this, outportsOptions);

      var menuOptions = {
        menu: this.props.menu,
        options: this.props.options,
        triggerHideContext: this.props.triggerHideContext,
        icon: this.props.icon,
        label: this.props.label
      };

      menuOptions = TheGraph.merge(TheGraph.config.nodeMenu.menu, menuOptions);
      var menu = TheGraph.factories.nodeMenu.createNodeMenuMenu.call(this, menuOptions);

      var children = [
        inports, outports, menu
      ];

      var containerOptions = {
        transform: "translate("+this.props.x+","+this.props.y+")",
        children: children
      };
      containerOptions = TheGraph.merge(TheGraph.config.nodeMenu.container, containerOptions);
      return TheGraph.factories.nodeMenu.createNodeMenuGroup.call(this, containerOptions);

    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.nodeMenuPort = {
    container: {},
    backgroundRect: {
      rx: TheGraph.config.nodeRadius,
      ry: TheGraph.config.nodeRadius,
      height: TheGraph.contextPortSize - 1
    },
    circle: {
      r: 10
    },
    text: {}
  };

  TheGraph.factories.nodeMenuPort = {
    createNodeMenuPortGroup: TheGraph.factories.createGroup,
    createNodeMenuBackgroundRect: TheGraph.factories.createRect,
    createNodeMenuPortCircle: TheGraph.factories.createCircle,
    createNodeMenuPortText: TheGraph.factories.createText
  };


  TheGraph.NodeMenuPort = React.createFactory( React.createClass({
    displayName: "TheGraphNodeMenuPort",
    componentDidMount: function () {
      ReactDOM.findDOMNode(this).addEventListener("tap", this.edgeStart);
    },
    getInitialState: function () {
      return {expand: false}
    },
    edgeStart: function (event) {
      // Don't tap graph
      event.stopPropagation();

      if (event.target === this.refs.expand) {
        var expand = !this.state.expand;
        var expandAddressablePort = new CustomEvent('the-graph-expand-menu-port', {
          detail: expand ? this.props.port : null,
          bubbles: true
        });
        this.setState({expand: expand});
        ReactDOM.findDOMNode(this).dispatchEvent(expandAddressablePort);
        return;
      }

      var port = {
        process: this.props.processKey,
        port: this.props.port.label,
        type: this.props.port.type,
        index: this.props.port.index,
        addressable: this.props.port.addressable
      };

      var edgeStartEvent = new CustomEvent('the-graph-edge-start', { 
        detail: {
          isIn: this.props.isIn,
          port: port,
          route: this.props.route
        },
        bubbles: true
      });
      ReactDOM.findDOMNode(this).dispatchEvent(edgeStartEvent);
    },
    render: function() {
      var labelLen = this.props.label.length;
      var bgWidth = this.props.width;
      // Highlight compatible port
      var highlightPort = this.props.highlightPort;
      var highlight = (highlightPort && highlightPort.isIn === this.props.isIn && highlightPort.type === this.props.port.type);

      var className = "context-port-bg"+(highlight ? " highlight" : "");

      if (this.props.lastIndex) {
        className += " last-index";
      }

      var rectOptions = {
        className: className,
        x: this.props.x + (this.props.isIn ? -bgWidth : 0),
        y: this.props.y - TheGraph.contextPortSize/2,
        width: bgWidth
      };

      rectOptions = TheGraph.merge(TheGraph.config.nodeMenuPort.backgroundRect, rectOptions);
      var rect = TheGraph.factories.nodeMenuPort.createNodeMenuBackgroundRect.call(this, rectOptions);

      var circleOptions = {
        className: "context-port-hole stroke route"+this.props.route,
        cx: this.props.x,
        cy: this.props.y,
      };
      circleOptions = TheGraph.merge(TheGraph.config.nodeMenuPort.circle, circleOptions);
      var circle = TheGraph.factories.nodeMenuPort.createNodeMenuPortCircle.call(this, circleOptions);

      var textOptions = {
        className: "context-port-label fill route"+this.props.route,
        x: this.props.x + (this.props.isIn ? -20 : 20),
        y: this.props.y,
        children: this.props.label.replace(/(.*)\/(.*)(_.*)\.(.*)/, '$2.$4')
      };

      textOptions = TheGraph.merge(TheGraph.config.nodeMenuPort.text, textOptions);
      var text = TheGraph.factories.nodeMenuPort.createNodeMenuPortText.call(this, textOptions);

      var containerContents = [rect, circle, text];

      if (this.props.port.addressable) {
        var expandTextOptions = {
          className: "context-port-label fill menu-expand route"+this.props.route,
          x: this.props.x + (this.props.isIn ? -1*bgWidth + 20 : bgWidth - 20),
          y: this.props.y,
          children: this.state.expand ? '-' : '+',
          ref: 'expand'
        };
        var expandText = TheGraph.factories.nodeMenuPort.createNodeMenuPortText.call(this, expandTextOptions);
        containerContents.push(expandText);
      }

      var containerOptions = TheGraph.merge(TheGraph.config.nodeMenuPort.container, { className: "context-port click context-port-"+(this.props.isIn ? "in" : "out") });
      return TheGraph.factories.nodeMenuPort.createNodeMenuPortGroup.call(this, containerOptions, containerContents);

    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.nodeMenuPorts = {
    container: {},
    linesGroup: {
      className: "context-ports-lines"
    },
    portsGroup: {
      className: "context-ports-ports"
    },
    portPath: {
      className: "context-port-path"
    },
    nodeMenuPort: {}
  };

  TheGraph.factories.menuPorts = {
    createNodeMenuPortsGroup: TheGraph.factories.createGroup,
    createNodeMenuPortsLinesGroup: TheGraph.factories.createGroup,
    createNodeMenuPortsPortsGroup: TheGraph.factories.createGroup,
    createNodeMenuPortsPortPath: TheGraph.factories.createPath,
    createNodeMenuPortsNodeMenuPort: createNodeMenuPort
  };

  function createNodeMenuPort(options) {
    return TheGraph.NodeMenuPort(options);
  }

  TheGraph.NodeMenuPorts = React.createFactory( React.createClass({
    displayName: "TheGraphNodeMenuPorts",
    componentDidMount: function () {
      ReactDOM.findDOMNode(this).addEventListener("the-graph-expand-menu-port", this.expandPort);
    },
    expandPort: function (event) {
      this.setState({expand: event.detail});
    },
    getInitialState: function () {
      return {expand: null}
    },
    render: function() {
      var portViews = [];
      var lines = [];
      var lineAnchors = [];

      var scale = this.props.scale;
      var ports = this.props.ports;
      var deltaX = this.props.deltaX;
      var deltaY = this.props.deltaY;

      var keys = Object.keys(this.props.ports);
      var h = keys.length * TheGraph.contextPortSize;
      var len = keys.length;
      for (var i=0; i<len; i++) {
        var key = keys[i];
        var port = ports[key];

        var x = (this.props.isIn ? -100 : 100);
        var y = 0 - h/2 + i*TheGraph.contextPortSize + TheGraph.contextPortSize/2;
        var ox = (port.x - this.props.nodeWidth/2) * scale + deltaX;
        var oy = (port.y - this.props.nodeHeight/2) * scale + deltaY;

        // Make path from graph port to menu port
        var lineOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.portPath, { d: [ "M", ox, oy, "L", x, y ].join(" ") });
        var line = TheGraph.factories.menuPorts.createNodeMenuPortsPortPath.call(this, lineOptions);

        var label = key + (port.addressable ? '[]' : '');
        var labelLen = label.length;
        var width = (labelLen>12 ? labelLen*8+40 : 120);
        var portViewOptions = {
          label: label,
          width: width,
          port: port,
          processKey: this.props.processKey,
          isIn: this.props.isIn,
          x: x,
          y: y,
          route: port.route,
          highlightPort: this.props.highlightPort
        };
        portViewOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.nodeMenuPort, portViewOptions);
        var portView = TheGraph.factories.menuPorts.createNodeMenuPortsNodeMenuPort.call(this, portViewOptions);

        lines.push(line);
        portViews.push(portView);

        if (this.state.expand === port) {
          var anchorX = x + (this.props.isIn ? -1 : 1)*width;
          var radius = 2;
          var lineAnchorOptions = {
            className: "fill route"+port.route,
            cx: anchorX,
            cy: y,
            r: radius
          };
          var lineAnchor = TheGraph.factories.createCircle.call(this, lineAnchorOptions);
          lineAnchors.push(lineAnchor);

          for (var j = 0, indexLen = port.indexList.length; j < indexLen; j++) {
            var indexPort = {
              addressable: false,
              index: j,
              lastIndex: j === indexLen
            };
            var indexPort = TheGraph.merge(port, indexPort);
            var indexPortViewOptions = TheGraph.merge(portViewOptions, {
              port: indexPort,
              x: x + (this.props.isIn ? -150 : 150),
              y: y + TheGraph.contextPortSize*j,
              label: key + '[' + j + ']'
            });
            var indexPortView = TheGraph.factories.menuPorts.createNodeMenuPortsNodeMenuPort.call(
              this, indexPortViewOptions);
            portViews.push(indexPortView);

            var indexLineOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.portPath, {
              d: [
                "M", anchorX, y,
                "L", indexPortViewOptions.x, indexPortViewOptions.y
              ].join(" ") });

            var indexLine = TheGraph.factories.menuPorts.createNodeMenuPortsPortPath.call(this, indexLineOptions);
            lines.push(indexLine);
          }
        }
      }

      var transform = "";
      if (this.props.translateX !== undefined) {
        transform = "translate("+this.props.translateX+","+this.props.translateY+")";
      }

      var lineAnchorsGroup = TheGraph.factories.createGroup.call(this, {children: lineAnchors});

      var linesGroupOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.linesGroup, { children: lines });
      var linesGroup = TheGraph.factories.menuPorts.createNodeMenuPortsLinesGroup.call(this, linesGroupOptions);

      var portsGroupOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.portsGroup, { children: portViews });
      var portsGroup = TheGraph.factories.menuPorts.createNodeMenuPortsGroup.call(this, portsGroupOptions);

      var containerContents = [linesGroup, portsGroup, lineAnchorsGroup];
      var containerOptions = {
        className: "context-ports context-ports-"+(this.props.isIn ? "in" : "out"),
        transform: transform
      };
      containerOptions = TheGraph.merge(TheGraph.config.nodeMenuPorts.container, containerOptions);
      return TheGraph.factories.menuPorts.createNodeMenuPortsGroup.call(this, containerOptions, containerContents);
    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  // Initialize configuration for the Port view.
  TheGraph.config.port = {
    container: {
      className: "port arrow"
    },
    backgroundCircle: {
      className: "port-circle-bg"
    },
    arc: {
      className: "port-arc",
      ref: "portArc",
      bigArcRadius: 6
    },
    innerCircle: {
      ref: "circleSmall"
    },
    text: {
      ref: "label",
      className: "port-label drag"
    },
    tailText: {
      ref: "label",
      className: "port-label drag tail"
    },
    expandText: {
      ref: "expand",
      className: "port-label drag expand"
    }
  };

  TheGraph.factories.port = {
    createPortGroup: TheGraph.factories.createGroup,
    createPortBackgroundCircle: TheGraph.factories.createCircle,
    createPortArc: TheGraph.factories.createPath,
    createPortInnerCircle: TheGraph.factories.createCircle,
    createPortLabelText: TheGraph.factories.createText
  };

  // Port view

  TheGraph.Port = React.createFactory( React.createClass({
    displayName: "TheGraphPort",
    mixins: [
      TheGraph.mixins.Tooltip
    ],
    componentDidMount: function () {
      // Preview edge start
      this.refs.circleSmall.addEventListener("tap", this.edgeStart);
      this.refs.circleSmall.addEventListener("trackstart", this.edgeStart);
      this.refs.portArc.addEventListener("tap", this.edgeStart);
      this.refs.portArc.addEventListener("trackstart", this.edgeStart);

      // Make edge
      this.refs.circleSmall.addEventListener("trackend", this.triggerDropOnTarget);
      this.refs.portArc.addEventListener("trackend", this.triggerDropOnTarget);
      ReactDOM.findDOMNode(this).addEventListener("the-graph-edge-drop", this.edgeStart);

      if (this.refs.expand) {
        this.refs.expand.addEventListener("tap", this.toggleExpand);
      }

      // Show context menu
      if (this.props.showContext) {
        ReactDOM.findDOMNode(this).addEventListener("contextmenu", this.showContext);
        ReactDOM.findDOMNode(this).addEventListener("hold", this.showContext);
      }
    },
    getTooltipTrigger: function () {
      return ReactDOM.findDOMNode(this);
    },
    shouldShowTooltip: function () {
      return (
        this.props.app.state.scale < TheGraph.zbpBig ||
        this.props.label.length > 8
      );
    },
    showContext: function (event) {
      // Don't show port menu on export node port
      if (this.props.isExport) {
        return;
      }
      // Click on label, pass context menu to node
      if (event && (event.target === ReactDOM.findDOMNode(this.refs.label))) {
        return;
      }
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var x = event.x || event.clientX || 0;
      var y = event.y || event.clientY || 0;

      // App.showContext
      this.props.showContext({
        element: this,
        type: (this.props.isIn ? "nodeInport" : "nodeOutport"),
        x: x,
        y: y,
        graph: this.props.graph,
        itemKey: this.props.label,
        item: this.props.port
      });
    },
    getContext: function (menu, options, hide) {
      return TheGraph.Menu({
        menu: menu,
        options: options,
        label: this.props.label,
        triggerHideContext: hide
      });
    },
    toggleExpand: function (event) {
      event.stopPropagation();
      var expandEvent = new CustomEvent('the-graph-expand-port', {
        detail: {
          isIn: this.props.isIn,
          port: this.props.port.port,
          expand: !this.props.expand
        },
        bubbles: true
      });
      event.target.dispatchEvent(expandEvent);
    },
    edgeStart: function (event) {
      // Don't start edge on export node port
      if (this.props.isExport) {
        return;
      }
      if (event && (event.target === ReactDOM.findDOMNode(this.refs.expand))) {
        this.toggleExpand(event);
        return;
      }
      // Click on label, pass context menu to node
      if (event && (event.target === ReactDOM.findDOMNode(this.refs.label))) {
        return;
      }
      // Don't tap graph
      event.stopPropagation();

      var edgeStartEvent = new CustomEvent('the-graph-edge-start', {
        detail: {
          isIn: this.props.isIn,
          port: this.props.port,
          // process: this.props.processKey,
          route: this.props.route
        },
        bubbles: true
      });
      ReactDOM.findDOMNode(this).dispatchEvent(edgeStartEvent);
    },
    triggerDropOnTarget: function (event) {
      // If dropped on a child element will bubble up to port
      if (!event.relatedTarget) { return; }
      var dropEvent = new CustomEvent('the-graph-edge-drop', {
        detail: null,
        bubbles: true
      });
      event.relatedTarget.dispatchEvent(dropEvent);
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      return (
        nextProps.label !== this.props.label ||
        nextProps.expand !== this.props.expand ||
        nextProps.port.addressable !== this.props.port.addressable ||
        nextProps.x !== this.props.x ||
        nextProps.y !== this.props.y ||
        nextProps.nodeWidth !== this.props.nodeWidth ||
        nextProps.classNames !== this.props.classNames ||
        nextProps.route !== this.props.route ||
        nextProps.highlightPort !== this.props.highlightPort ||
        nextProps.isConnected !== this.props.isConnected
      );
    },
    render: function () {
      var style;
      var maxChars = Math.floor(
        this.props.labelWidth * ((this.props.nodeWidth - 12) / 4)
      );
      var label = this.props.label;
      var tail = null;
      if (label.length > maxChars) {
        tail = label.substring(maxChars - 3, maxChars);
        var oldLabel = label;
        label = label.substring(0, maxChars - 3);
      }
      var r = 4;
      // Highlight matching ports
      var highlightPort = this.props.highlightPort;
      var inArc = TheGraph.arcs.inport;
      var outArc = TheGraph.arcs.outport;
      if (highlightPort && highlightPort.isIn === this.props.isIn && (highlightPort.type === this.props.port.type || this.props.port.type === 'any')) {
        r = TheGraph.config.port.arc.bigArcRadius;
        inArc = TheGraph.arcs.inportBig;
        outArc = TheGraph.arcs.outportBig;
      }

      var backgroundCircleOptions = TheGraph.merge(TheGraph.config.port.backgroundCircle, { r: r + 1 });
      var backgroundCircle = TheGraph.factories.port.createPortBackgroundCircle.call(this, backgroundCircleOptions);

      var arcOptions = TheGraph.merge(TheGraph.config.port.arc, { d: (this.props.isIn ? inArc : outArc) });
      var arc = TheGraph.factories.port.createPortArc.call(this, arcOptions);

      var innerCircleOptions = {
        className: "port-circle-small stroke route"+this.props.route + (this.props.isConnected ? ' fill' : ' empty-fill'),
        r: r - 1.5
      };

      innerCircleOptions = TheGraph.merge(TheGraph.config.port.innerCircle, innerCircleOptions);
      var innerCircle = TheGraph.factories.port.createPortInnerCircle.call(this, innerCircleOptions);

      var labelGroup,
          labelGroupContents,
          labelGroupOptions,
          labelTextOptions,
          tailTextOptions,
          labelText,
          tailText;

      if (tail) {
        labelGroupOptions = {
          transform: "translate(" + (this.props.isIn ? 5 : -4*maxChars + 5) + ", 0)",
        };

        labelTextOptions = {
          style: style,
          children: label
        };
        tailTextOptions = {
          style: {fill: "url(#greyfade)"} ,
          children: tail,
          x: (maxChars-3)*4,
          width: 12
        };

        labelTextOptions = TheGraph.merge(TheGraph.config.port.text, labelTextOptions);
        tailTextOptions = TheGraph.merge(TheGraph.config.port.tailText, tailTextOptions);
        labelText = TheGraph.factories.port.createPortLabelText.call(this, labelTextOptions);
        tailText = TheGraph.factories.port.createPortLabelText.call(this, tailTextOptions);
        labelGroupContents = [
          labelText, tailText
        ];
      } else {
        var labelOffset = this.props.port.addressable ? 10 : 5;
        labelGroupOptions = {
          transform: "translate(" + (this.props.isIn ? 1 : -1)*labelOffset + ", 0)",
        };
        labelTextOptions = {
          style: style,
          children: label
        };
        labelTextOptions = TheGraph.merge(TheGraph.config.port.text, labelTextOptions);
        labelText = TheGraph.factories.port.createPortLabelText.call(this, labelTextOptions);
        labelGroupContents = [
          labelText
        ];
      }
      if (this.props.port.addressable) {
        var expandLabel = String.fromCharCode(this.props.expand ? '0x229f' : '0x229e');
        var expandTextOptions = {
          children: expandLabel,
          x: this.props.isIn ? -5 : 5
        };
        expandTextOptions = TheGraph.merge(TheGraph.config.port.expandText, expandTextOptions);
        var expandText = TheGraph.factories.createText.call(this, expandTextOptions);
        labelGroupContents.push(expandText);
      }
      labelGroup = TheGraph.factories.createGroup.call(this, labelGroupOptions, labelGroupContents);

      var portContents = [
        backgroundCircle,
        arc,
        innerCircle,
        labelGroup
      ];

      var containerOptions = TheGraph.merge(TheGraph.config.port.container, {
        title: this.props.label,
        transform: "translate("+this.props.x+","+this.props.y+")",
        className: TheGraph.config.port.container.className + (
          this.props.classNames ? ' ' + this.props.classNames : '')
      });
      return TheGraph.factories.port.createPortGroup.call(this, containerOptions, portContents);

    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.edge = {
    container: {
      className: "edge"
    },
    backgroundPath: {
      className: "edge-bg"
    },
    foregroundPath: {
      ref: "route",
      className: "edge-fg stroke route"
    },
    touchPath: {
      className: "edge-touch",
      ref: "touch"
    }
  };

  var getDefaultConfig = function () {
    // Props configured by TheGraph.config
    return {
      curve: TheGraph.config.nodeSize,
    };
  };

  var getEdgeConfig = function () {
    return TheGraph.mergeDeep(TheGraph.config.edge, getDefaultConfig());
  };

  TheGraph.factories.edge = {
    createEdgeGroup: TheGraph.factories.createGroup,
    createEdgeBackgroundPath: TheGraph.factories.createPath,
    createEdgeForegroundPath: TheGraph.factories.createPath,
    createEdgeTouchPath: TheGraph.factories.createPath,
    createEdgePathArray: createEdgePathArray,
    createArrow: TheGraph.factories.createPolygon
  };

  function createEdgePathArray(sourceX, sourceY, c1X, c1Y, c2X, c2Y, targetX, targetY) {
      return [
        "M",
        sourceX, sourceY,
        "C",
        c1X, c1Y,
        c2X, c2Y,
        targetX, targetY
      ];
  }

  // Point along cubic bezier curve
  // See http://en.wikipedia.org/wiki/File:Bezier_3_big.gif
  var findPointOnCubicBezier = function (p, sx, sy, c1x, c1y, c2x, c2y, ex, ey) {
    // p is percentage from 0 to 1
    var op = 1 - p;
    // 3 green points between 4 points that define curve
    var g1x = sx * p + c1x * op;
    var g1y = sy * p + c1y * op;
    var g2x = c1x * p + c2x * op;
    var g2y = c1y * p + c2y * op;
    var g3x = c2x * p + ex * op;
    var g3y = c2y * p + ey * op;
    // 2 blue points between green points
    var b1x = g1x * p + g2x * op;
    var b1y = g1y * p + g2y * op;
    var b2x = g2x * p + g3x * op;
    var b2y = g2y * p + g3y * op;
    // Point on the curve between blue points
    var x = b1x * p + b2x * op;
    var y = b1y * p + b2y * op;
    return [x, y];    
  };


  // Edge view

  TheGraph.Edge = React.createFactory( React.createClass({
    displayName: "TheGraphEdge",
    mixins: [
      TheGraph.mixins.Tooltip
    ],
    componentWillMount: function () {
    },
    componentDidMount: function () {
      var domNode = ReactDOM.findDOMNode(this);

      domNode.addEventListener("dblclick", function () {
        var event;
        var detail;

        if (this.props.export && this.props.isIn) {
          event = 'dblclick-inport';
          detail = {
            export: this.props.export,
            exportKey: this.props.exportKey
          };
        } else if (this.props.export) {
          event = 'dblclick-outport';
          detail = {
            export: this.props.export,
            exportKey: this.props.exportKey
          };
        } else {
          event = 'dblclick-edge';
          detail = this.props.edge;
        }

        domNode.dispatchEvent(new CustomEvent(event, {
          detail: detail,
          bubbles: true
        }));
      }.bind(this));

      // Dragging
      domNode.addEventListener("trackstart", this.onTrackStart);
      domNode.addEventListener("trackend", this.onTrackEnd);

      if (this.props.onEdgeSelection) {
        // Needs to be click (not tap) to get event.shiftKey
        domNode.addEventListener("tap", this.onEdgeSelection);
      }

      // Context menu
      if (this.props.showContext) {
        domNode.addEventListener("contextmenu", this.showContext);
        domNode.addEventListener("hold", this.showContext);
      }

      if (this.props.previewPort) {
        domNode.addEventListener('render-edge-preview', function (event) {
          if (this.props.previewPort === 'out') {
            this.setState({
              sX: event.detail.x,
              sY: event.detail.y
            });
          } else {
            this.setState({
              tX: event.detail.x,
              tY: event.detail.y
            });
          }
        }.bind(this));
      }
    },
    onTrackStart: function (event) {
      event.stopPropagation();

      var distance = function (x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      };

      var sourceX = this.props.sX;
      var sourceY = this.props.sY;
      var targetX = this.props.tX;
      var targetY = this.props.tY;
      var scale = this.props.app.state.scale;
      var mousePos = this.props.app.getMousePos();
      var clientX = (mousePos.x - this.props.app.state.x) / scale;
      var clientY = (mousePos.y - this.props.app.state.y) / scale;

      var graph = this.props.graph;
      var edge = this.props.edge;
      var edgePort;
      var isIn;
      if (distance(clientX, clientY, sourceX, sourceY) <= 36) {
        edgePort = edge.to;
        isIn = true;
      } else if (distance(clientX, clientY, targetX, targetY) <= 36) {
        edgePort = edge.from;
        isIn = false;
      } else {
        return;
      }

      var node = graph.getNode(edgePort.node);
      var library = this.props.app.props.library;
      var component = library[node.component];
      var componentPort = component[isIn ? 'inports' : 'outports'].filter(
        function (p) {return p.name == edgePort.port;}
      )[0];

      var port = {
        process: edgePort.node,
        port: edgePort.port,
        type: componentPort.type
      };

      if (edgePort.index !== undefined && edgePort.index !== null) {
        port.index = edgePort.index;
      } else {
        port.addressable = componentPort.addressable;
      }

      this.props.app.props.menus.edge.actions.delete(
        this.props.graph, null, this.props.edge);

      var edgeStartEvent = new CustomEvent('the-graph-edge-start', {
        detail: {
          isIn: isIn,
          port: port,
          route: this.props.route
        },
        bubbles: true
      });
      ReactDOM.findDOMNode(this).dispatchEvent(edgeStartEvent);
    },
    onTrackEnd: function (event) {
      // If dropped on a child element will bubble up to port
      if (!event.relatedTarget) { return; }
      var dropEvent = new CustomEvent('the-graph-edge-drop', {
        detail: null,
        bubbles: true
      });
      event.relatedTarget.dispatchEvent(dropEvent);
    },
    onEdgeSelection: function (event) {
      // Don't click app
      event.stopPropagation();

      var toggle = (TheGraph.metaKeyPressed || event.pointerType==="touch");
      this.props.onEdgeSelection(this.props.edgeID, this.props.edge, toggle);
    },
    showContext: function (event) {
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var mousePos = this.props.app.getMousePos();
      var x = mousePos.x;
      var y = mousePos.y;

      // App.showContext
      this.props.showContext({
        element: this,
        type: (this.props.export ? (this.props.isIn ? "graphInport" : "graphOutport") : "edge"),
        x: x,
        y: y,
        graph: this.props.graph,
        itemKey: (this.props.export ? this.props.exportKey : null),
        item: (this.props.export ? this.props.export : this.props.edge)
      });

    },
    getContext: function (menu, options, hide) {
      return TheGraph.Menu({
        menu: menu,
        options: options,
        triggerHideContext: hide,
        label: this.props.label,
        iconColor: this.props.route
      });
    },
    getInitialState: function () {
      return {
        sX: this.props.sX,
        sY: this.props.sY,
        tX: this.props.tX,
        tY: this.props.tY
      };
    },
    componentWillReceiveProps: function (newProps) {
      this.setState({
        sX: newProps.sX,
        sY: newProps.sY,
        tX: newProps.tX,
        tY: newProps.tY
      });
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      // Only rerender if changed
      return (
        nextState.sX !== this.state.sX ||
        nextState.sY !== this.state.sY ||
        nextState.tX !== this.state.tX ||
        nextState.tY !== this.state.tY ||
        nextProps.selected !== this.props.selected ||
        nextProps.animated !== this.props.animated ||
        nextProps.route !== this.props.route ||
        nextProps.nodeSelected !== this.props.nodeSelected ||
        nextProps.classNames !== this.props.classNames
      );
    },
    getTooltipTrigger: function () {
      return ReactDOM.findDOMNode(this.refs.touch);
    },
    shouldShowTooltip: function () {
      return true;
    },
    render: function () {
      var config = getEdgeConfig();
      var curve = config.curve;

      var sourceX = this.state.sX;
      var sourceY = this.state.sY;
      var targetX = this.state.tX;
      var targetY = this.state.tY;

      // Organic / curved edge
      var c1X, c1Y, c2X, c2Y;
      if (targetX-5 < sourceX) {
        var curveFactor = (sourceX - targetX) * curve / 200;
        if (Math.abs(targetY-sourceY) < TheGraph.config.nodeSize/2) {
          // Loopback
          c1X = sourceX + curveFactor;
          c1Y = sourceY - curveFactor;
          c2X = targetX - curveFactor;
          c2Y = targetY - curveFactor;
        } else {
          // Stick out some
          c1X = sourceX + curveFactor;
          c1Y = sourceY + (targetY > sourceY ? curveFactor : -curveFactor);
          c2X = targetX - curveFactor;
          c2Y = targetY + (targetY > sourceY ? -curveFactor : curveFactor);
        }
      } else {
        // Controls halfway between
        c1X = sourceX + (targetX - sourceX)/2;
        c1Y = sourceY;
        c2X = c1X;
        c2Y = targetY;
      }

      // Make SVG path

      var path = TheGraph.factories.edge.createEdgePathArray(sourceX, sourceY, c1X, c1Y, c2X, c2Y, targetX, targetY);
      path = path.join(" ");

      var backgroundPathOptions = TheGraph.merge(config.backgroundPath, { d: path });
      var backgroundPath = TheGraph.factories.edge.createEdgeBackgroundPath(backgroundPathOptions);

      var foregroundPathClassName = config.foregroundPath.className + this.props.route;
      var foregroundPathOptions = TheGraph.merge(config.foregroundPath, { d: path, className: foregroundPathClassName });
      var foregroundPath = TheGraph.factories.edge.createEdgeForegroundPath(foregroundPathOptions);

      var touchPathOptions = TheGraph.merge(config.touchPath, { d: path });
      var touchPath = TheGraph.factories.edge.createEdgeTouchPath(touchPathOptions);

      var containerOptions = {
        className: "edge"+
          (this.props.selected ? " selected" : "")+
          (this.props.animated ? " animated" : "")+
          (this.props.nodeSelected ? " node-selected" : "")+
          (this.props.classNames ? " " + this.props.classNames : ""),
        title: this.props.label,
        style: (this.props.selected || this.props.nodeSelected) ? {} :
          {opacity: this.props.opacity || 1}
      };

      containerOptions = TheGraph.merge(config.container, containerOptions);

      var epsilon = 0.01;
      var center = findPointOnCubicBezier(0.5, sourceX, sourceY, c1X, c1Y, c2X, c2Y, targetX, targetY);

      // estimate slope and intercept of tangent line
      var getShiftedPoint = function (epsilon) {
        return findPointOnCubicBezier(
          0.5 + epsilon, sourceX, sourceY, c1X, c1Y, c2X, c2Y, targetX, targetY);
      };
      var plus = getShiftedPoint(epsilon);
      var minus = getShiftedPoint(-epsilon);
      var m = 1 * (plus[1] - minus[1]) / (plus[0] - minus[0]);
      var b = center[1] - (m * center[0]);

      // find point on line y = mx + b that is `offset` away from x,y
      var findLinePoint = function (x, y, m, b, offset, flip) {
        var x1 = x + offset/Math.sqrt(1 + m*m);
        var y1;
        if (Math.abs(m) === Infinity) {
          y1 = y + (flip || 1) *offset;
        } else {
          y1 = (m * x1) + b;
        }
        return [x1, y1];
      };

      var arrowLength = 3;
      // Which direction should arrow point
      if (plus[0] > minus[0]) {
        arrowLength *= -1;
      }

      // find points of perpendicular line length l centered at x,y
      var perpendicular = function (x, y, oldM, l) {
        var m = -1/oldM;
        var b = y - m*x;
        var point1 = findLinePoint(x, y, m, b, l/2);
        var point2 = findLinePoint(x, y, m, b, l/-2);
        return [point1, point2];
      };

      var getArrowPoints = function (edgeCenter, m, b, length, flip) {
        // Get the arrow points for an edge.
        var arrowCenter = findLinePoint(
          edgeCenter[0],
          edgeCenter[1],
          m,
          b,
          -1*length/2
        );
        var x = arrowCenter[0];
        var y = arrowCenter[1];

        var perp = perpendicular(x, y, m, length * 0.9);
        var perpPoint1 = perp[0];
        var perpPoint2 = perp[1];
        var tipPoint = findLinePoint(x, y, m, b, length, flip);
        var cavePoint = findLinePoint(x, y, m, b, (length/5), flip);

        return [perpPoint1, cavePoint, perpPoint2, tipPoint];
      };

      // For m === 0, figure out if arrow should be straight up or down
      var flip = plus[1] > minus[1] ? -1 : 1;
      var points = getArrowPoints(center, m, b, arrowLength, flip);

      var pointsArray = points.map(
        function (point) {return point.join(',');}).join(' ');
      var arrowBg = TheGraph.factories.edge.createArrow({
        points: pointsArray,
        className: 'arrow-bg'
      });

      var arrow = TheGraph.factories.edge.createArrow({
        points: pointsArray,
        className: 'arrow fill stroke route' + this.props.route
      });

      return TheGraph.factories.edge.createEdgeGroup(containerOptions,
         [backgroundPath, arrowBg, foregroundPath, touchPath, arrow]);
    }
  }));

})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.iip = {
    container: {
      className: "iip"
    },
    path: {
      className: "iip-path"
    },
    text: {
      className: "iip-info",
      height: 5,
      halign: "right",
      offset: 10
    }
  };

  TheGraph.factories.iip = {
    createIIPContainer: TheGraph.factories.createGroup,
    createIIPPath: TheGraph.factories.createPath,
    createIIPText: createIIPText
  };

  function createIIPText(options) {
    return TheGraph.TextBG(options);
  }

  // Const
  var CURVE = 50;


  // Edge view

  TheGraph.IIP = React.createFactory( React.createClass({
    displayName: "TheGraphIIP",
    shouldComponentUpdate: function (nextProps, nextState) {
      // Only rerender if changed

      return (
        nextProps.x !== this.props.x ||
        nextProps.y !== this.props.y ||
        nextProps.label !== this.props.label ||
        nextProps.classNames !== this.props.classNames
      );
    },
    render: function () {
      var x = this.props.x;
      var y = this.props.y;

      var path = [
        "M", x, y,
        "L", x-10, y
      ].join(" ");

      // Make a string
      var label = this.props.label+"";
      // TODO make this smarter with ZUI
      if (label.length > 12) {
        label = label.slice(0, 9) + "...";
      }

      var pathOptions = TheGraph.merge(TheGraph.config.iip.path, {d: path});
      var iipPath = TheGraph.factories.iip.createIIPPath.call(this, pathOptions);

      var textOptions = TheGraph.merge(TheGraph.config.iip.text, {x: x - TheGraph.config.iip.text.offset, y: y, text: label});
      var text = TheGraph.factories.iip.createIIPText.call(this, textOptions);

      var containerContents = [iipPath, text];

      var containerOptions = TheGraph.merge(TheGraph.config.iip.container, {
        title: this.props.label,
        classNames: this.props.classNames || ""
      });
      return TheGraph.factories.iip.createIIPContainer.call(this, containerOptions, containerContents);
    }
  }));

})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.group = {
    container: {
      className: "group"
    },
    boxRect: {
      ref: "box",
    },
    labelText: {
      ref: "label",
      className: "group-label drag"
    },
    descriptionText: {
      className: "group-description"
    }
  };

  var getDefaultConfig = function () {
    // Props configured by TheGraph.config
    return {
      boxRect: {
        rx: TheGraph.config.groupRadius,
        ry: TheGraph.config.groupRadius
      }
    };
  };

  var getGroupConfig = function () {
    return TheGraph.mergeDeep(TheGraph.config.group, getDefaultConfig());
  };

  TheGraph.factories.group = {
    createGroupGroup: TheGraph.factories.createGroup,
    createGroupBoxRect: TheGraph.factories.createRect,
    createGroupLabelText: TheGraph.factories.createText,
    createGroupDescriptionText: TheGraph.factories.createText
  };

  // Group view

  TheGraph.Group = React.createFactory( React.createClass({
    displayName: "TheGraphGroup",
    componentDidMount: function () {
      // Move group
      if (this.props.isSelectionGroup) {
        // Drag selection by bg
        ReactDOM.findDOMNode(this.refs.box).addEventListener("trackstart", this.onTrackStart);
      } else {
        ReactDOM.findDOMNode(this.refs.label).addEventListener("trackstart", this.onTrackStart);
      }

      var domNode = ReactDOM.findDOMNode(this);

      // Don't pan under menu
      domNode.addEventListener("trackstart", this.dontPan);

      // Context menu
      if (this.props.showContext) {
        domNode.addEventListener("contextmenu", this.showContext);
        domNode.addEventListener("hold", this.showContext);
      }
    },
    showContext: function (event) {
      if (this.props.edgePreview) {
        return;
      }
      // Don't show native context menu
      event.preventDefault();

      // Don't tap graph on hold event
      event.stopPropagation();
      if (event.preventTap) { event.preventTap(); }

      // Get mouse position
      var mousePos = this.props.app.getMousePos(event);
      var x = mousePos.x;
      var y = mousePos.y;

      // App.showContext
      this.props.showContext({
        element: this,
        type: (this.props.isSelectionGroup ? "selection" : "group"),
        x: x,
        y: y,
        graph: this.props.graph,
        itemKey: this.props.label,
        item: this.props.item
      });
    },
    getContext: function (menu, options, hide) {
      return TheGraph.Menu({
        menu: menu,
        options: options,
        label: this.props.label,
        triggerHideContext: hide
      });
    },
    dontPan: function (event) {
      // Don't drag under menu
      if (this.props.app.menuShown) {
        event.stopPropagation();
      }
    },
    onTrackStart: function (event) {
      // Don't drag graph
      event.stopPropagation();

      if (this.props.isSelectionGroup) {
        var box = ReactDOM.findDOMNode(this.refs.box);
        box.addEventListener("track", this.onTrack);
        box.addEventListener("trackend", this.onTrackEnd);
      } else {
        var label = ReactDOM.findDOMNode(this.refs.label);
        label.addEventListener("track", this.onTrack);
        label.addEventListener("trackend", this.onTrackEnd);
      }

      this.props.graph.startTransaction('movegroup');
    },
    onTrack: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      var deltaX = Math.round( event.ddx / this.props.scale );
      var deltaY = Math.round( event.ddy / this.props.scale );

      this.props.triggerMoveGroup(
        this.props.item.nodes,
        this.props.item.inports,
        this.props.item.outports,
        deltaX,
        deltaY
      );
    },
    onTrackEnd: function (event) {
      // Don't fire on graph
      event.stopPropagation();

      // Don't tap graph (deselect)
      event.preventTap();

      // Snap to grid
      this.props.triggerMoveGroup(
        this.props.item.nodes,
        this.props.item.inports,
        this.props.item.outports,
        null,
        null,
        true
      );

      if (this.props.isSelectionGroup) {
        var box = ReactDOM.findDOMNode(this.refs.box);
        box.removeEventListener("track", this.onTrack);
        box.removeEventListener("trackend", this.onTrackEnd);
      } else {
        var label = ReactDOM.findDOMNode(this.refs.label);
        label.removeEventListener("track", this.onTrack);
        label.removeEventListener("trackend", this.onTrackEnd);
      }

      this.props.graph.endTransaction('movegroup');
      this.props.app.stopAutoPan();
    },
    shouldComponentUpdate: function (nextProps, nextState) {
      return (
        nextProps.minX !== this.props.minX ||
        nextProps.minY !== this.props.minY ||
        nextProps.maxX !== this.props.maxX ||
        nextProps.maxY !== this.props.maxY ||
        nextProps.scale !== this.props.scale ||
        nextProps.label !== this.props.label ||
        nextProps.nodes !== this.props.nodes ||
        nextProps.description !== this.props.description ||
        nextProps.color !== this.props.color ||
        nextProps.edgePreview !== this.props.edgePreview ||
        nextProps.disabled !== this.props.disabled
      );
    },
    render: function() {
      var groupConfig = getGroupConfig();
      if (!this.props.isMarqueeSelect) {
        var x = this.props.minX - TheGraph.config.groupOffsetX;
        var y = this.props.minY - TheGraph.config.groupOffsetY;
        var rx = TheGraph.config.nodeRadius;
        var ry = TheGraph.config.nodeRadius;
        var width = this.props.maxX - x + TheGraph.config.groupPaddingX;
        var height = this.props.maxY - y + TheGraph.config.groupPaddingY;
      } else {
        var x = this.props.minX;
        var y = this.props.minY;
        var rx = 0;
        var ry = 0;
        var width = this.props.maxX - x;
        var height = this.props.maxY - y;
      }
      var color = (this.props.color ? this.props.color : 0);
      var selection = (this.props.isSelectionGroup ? ' selection drag' : '');
      var marquee = (this.props.isMarqueeSelect ? ' marquee': '');
      var boxRectOptions = {
        x: x,
        y: y,
        rx: rx,
        ry: ry,
        width: width,
        height: height,
        className: "group-box color" + color + selection + marquee
      };
      boxRectOptions = TheGraph.merge(groupConfig.boxRect, boxRectOptions);
      var boxRect =  TheGraph.factories.group.createGroupBoxRect.call(this, boxRectOptions);

      var labelTextOptions = {
        x: x + TheGraph.config.nodeRadius,
        y: y + 9,
        children: this.props.label
      };
      labelTextOptions = TheGraph.merge(groupConfig.labelText, labelTextOptions);
      var labelText = TheGraph.factories.group.createGroupLabelText.call(this, labelTextOptions);

      var descriptionTextOptions = {
        x: x + TheGraph.config.nodeRadius,
        y: y + 24,
        children: this.props.description
      };
      descriptionTextOptions = TheGraph.merge(TheGraph.config.group.descriptionText, descriptionTextOptions);
      var descriptionText = TheGraph.factories.group.createGroupDescriptionText.call(this, descriptionTextOptions);

      var groupContents = [
        boxRect,
        labelText,
        descriptionText
      ];

      var containerOptions = TheGraph.merge(TheGraph.config.group.container, {});
      return TheGraph.factories.group.createGroupGroup.call(this, containerOptions, groupContents);

    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.tooltip = {
    container: {},
    rect: {
      className: "tooltip-bg",
      x: 0,
      y: -7,
      rx: 3,
      ry: 3,
      height: 16
    },
    text: {
      className: "tooltip-label",
      ref: "label"
    }
  };

  TheGraph.factories.tooltip = {
    createTooltipGroup: TheGraph.factories.createGroup,
    createTooltipRect: TheGraph.factories.createRect,
    createTooltipText: TheGraph.factories.createText
  };

  // Port view

  TheGraph.Tooltip = React.createFactory( React.createClass({
    displayName: "TheGraphTooltip",
    render: function() {

      var rectOptions = TheGraph.merge(TheGraph.config.tooltip.rect, {width: this.props.label.length * 6});
      var rect = TheGraph.factories.tooltip.createTooltipRect.call(this, rectOptions);

      var textOptions = TheGraph.merge(TheGraph.config.tooltip.text, { children: this.props.label });
      var text = TheGraph.factories.tooltip.createTooltipText.call(this, textOptions);

      var containerContents = [rect, text];

      var containerOptions = {
        className: "tooltip" + (this.props.visible ? "" : " hidden"),
        transform: "translate("+this.props.x+","+this.props.y+")",
      };
      containerOptions = TheGraph.merge(TheGraph.config.tooltip.container, containerOptions);
      return TheGraph.factories.tooltip.createTooltipGroup.call(this, containerOptions, containerContents);

    }
  }));


})(this);
;(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  TheGraph.config.menu = {
    radius: 72,
    positions: {
      n4IconX: 0,
      n4IconY: -52,
      n4LabelX: 0,
      n4LabelY: -35,
      s4IconX: 0,
      s4IconY: 52,
      s4LabelX: 0,
      s4LabelY: 35,
      e4IconX: 45,
      e4IconY: -5,
      e4LabelX: 45,
      e4LabelY: 15,
      w4IconX: -45,
      w4IconY: -5,
      w4LabelX: -45,
      w4LabelY: 15
    },
    container: {
      className: "context-menu"
    },
    arcPath: {
      className: "context-arc context-node-info-bg"
    },
    sliceIconText: {
      className: "icon context-icon context-node-info-icon"
    },
    sliceLabelText: {
      className: "context-arc-label"
    },
    sliceIconLabelText: {
      className: "context-arc-icon-label"
    },
    circleXPath: {
      className: "context-circle-x",
      d: "M -51 -51 L 51 51 M -51 51 L 51 -51"
    },
    outlineCircle: {
      className: "context-circle"
    },
    labelText: {
      className: "context-node-label"
    },
    iconRect: {
      className: "context-node-rect",
      x: -24,
      y: -24,
      width: 48,
      height: 48,
      rx: TheGraph.config.nodeRadius,
      ry: TheGraph.config.nodeRadius
    }
  };

  TheGraph.factories.menu = {
    createMenuGroup: TheGraph.factories.createGroup,
    createMenuSlice: createMenuSlice,
    createMenuSliceArcPath: TheGraph.factories.createPath,
    createMenuSliceText: TheGraph.factories.createText,
    createMenuSliceIconText: TheGraph.factories.createText,
    createMenuSliceLabelText: TheGraph.factories.createText,
    createMenuSliceIconLabelText: TheGraph.factories.createText,
    createMenuCircleXPath: TheGraph.factories.createPath,
    createMenuOutlineCircle: TheGraph.factories.createCircle,
    createMenuLabelText: TheGraph.factories.createText,
    createMenuMiddleIconRect: TheGraph.factories.createRect,
    createMenuMiddleIconText: TheGraph.factories.createText
  };

  function createMenuSlice(options) {
    /*jshint validthis:true */
    var direction = options.direction;
    var arcPathOptions = TheGraph.merge(TheGraph.config.menu.arcPath, { d: TheGraph.arcs[direction] });
    var children = [
      TheGraph.factories.menu.createMenuSliceArcPath(arcPathOptions)
    ];

    if (this.props.menu[direction]) {
      var slice = this.props.menu[direction];
      if (slice.icon) {
        var sliceIconTextOptions = {
          x: TheGraph.config.menu.positions[direction+"IconX"],
          y: TheGraph.config.menu.positions[direction+"IconY"],
          children: TheGraph.FONT_AWESOME[ slice.icon ]
        };
        sliceIconTextOptions = TheGraph.merge(TheGraph.config.menu.sliceIconText, sliceIconTextOptions);
        children.push(TheGraph.factories.menu.createMenuSliceIconText.call(this, sliceIconTextOptions));
      }
      if (slice.label) {
        var sliceLabelTextOptions = {
          x: TheGraph.config.menu.positions[direction+"IconX"],
          y: TheGraph.config.menu.positions[direction+"IconY"],
          children: slice.label
        };
        sliceLabelTextOptions = TheGraph.merge(TheGraph.config.menu.sliceLabelText, sliceLabelTextOptions);
        children.push(TheGraph.factories.menu.createMenuSliceLabelText.call(this, sliceLabelTextOptions));
      }
      if (slice.iconLabel) {
        var sliceIconLabelTextOptions = {
          x: TheGraph.config.menu.positions[direction+"LabelX"],
          y: TheGraph.config.menu.positions[direction+"LabelY"],
          children: slice.iconLabel
        };
        sliceIconLabelTextOptions = TheGraph.merge(TheGraph.config.menu.sliceIconLabelText, sliceIconLabelTextOptions);
        children.push(TheGraph.factories.menu.createMenuSliceIconLabelText.call(this, sliceIconLabelTextOptions));
      }
    }

    var containerOptions = {
      ref: direction,
      className: "context-slice context-node-info" + (this.state[direction+"tappable"] ? " click" : ""),
      children: children
    };
    containerOptions = TheGraph.merge(TheGraph.config.menu.container, containerOptions);
    return TheGraph.factories.menu.createMenuGroup.call(this, containerOptions);
  }

  TheGraph.Menu = React.createFactory( React.createClass({
    displayName: "TheGraphMenu",
    radius: TheGraph.config.menu.radius,
    getInitialState: function() {
      // Use these in CSS for cursor and hover, and to attach listeners
      return {
        n4tappable: (this.props.menu.n4 && this.props.menu.n4.action),
        s4tappable: (this.props.menu.s4 && this.props.menu.s4.action),
        e4tappable: (this.props.menu.e4 && this.props.menu.e4.action),
        w4tappable: (this.props.menu.w4 && this.props.menu.w4.action),
      };
    },
    onTapN4: function () {
      var options = this.props.options;
      this.props.menu.n4.action(options.graph, options.itemKey, options.item);
      this.props.triggerHideContext();
    },
    onTapS4: function () {
      var options = this.props.options;
      this.props.menu.s4.action(options.graph, options.itemKey, options.item);
      this.props.triggerHideContext();
    },
    onTapE4: function () {
      var options = this.props.options;
      this.props.menu.e4.action(options.graph, options.itemKey, options.item);
      this.props.triggerHideContext();
    },
    onTapW4: function () {
      var options = this.props.options;
      this.props.menu.w4.action(options.graph, options.itemKey, options.item);
      this.props.triggerHideContext();
    },
    componentDidMount: function () {
      if (this.state.n4tappable) {
        this.refs.n4.addEventListener("up", this.onTapN4);
      }
      if (this.state.s4tappable) {
        this.refs.s4.addEventListener("up", this.onTapS4);
      }
      if (this.state.e4tappable) {
        this.refs.e4.addEventListener("up", this.onTapE4);
      }
      if (this.state.w4tappable) {
        this.refs.w4.addEventListener("up", this.onTapW4);
      }

      // Prevent context menu
      ReactDOM.findDOMNode(this).addEventListener("contextmenu", function (event) {
        if (event) {
          event.stopPropagation();
          event.preventDefault();
        }
      }, false);
      ReactDOM.findDOMNode(this).addEventListener("trackstart", function (event) {
        event.stopPropagation();
      });
    },
    getPosition: function () {
      return {
        x: this.props.x !== undefined ? this.props.x : this.props.options.x || 0,
        y: this.props.y !== undefined ? this.props.y : this.props.options.y || 0
      };
    },
    render: function() {
      var menu = this.props.menu;
      var options = this.props.options;
      var position = this.getPosition();

      var circleXOptions = TheGraph.merge(TheGraph.config.menu.circleXPath, {});
      var outlineCircleOptions = TheGraph.merge(TheGraph.config.menu.outlineCircle, {r: this.radius });

      var children = [
        // Directional slices
        TheGraph.factories.menu.createMenuSlice.call(this, { direction: "n4" }),
        TheGraph.factories.menu.createMenuSlice.call(this, { direction: "s4" }),
        TheGraph.factories.menu.createMenuSlice.call(this, { direction: "e4" }),
        TheGraph.factories.menu.createMenuSlice.call(this, { direction: "w4" }),
        // Outline and X
        TheGraph.factories.menu.createMenuCircleXPath.call(this, circleXOptions),
        TheGraph.factories.menu.createMenuOutlineCircle.call(this, outlineCircleOptions)
      ];
      // Menu label
      if (this.props.label || menu.icon) {

        var labelTextOptions = {
          x: 0,
          y: 0 - this.radius - 15,
          children: (this.props.label ? this.props.label : menu.label)
        };

        labelTextOptions = TheGraph.merge(TheGraph.config.menu.labelText, labelTextOptions);
        children.push(TheGraph.factories.menu.createMenuLabelText.call(this, labelTextOptions));
      }
      // Middle icon
      if (this.props.icon || menu.icon) {
        var iconColor = (this.props.iconColor!==undefined ? this.props.iconColor : menu.iconColor);
        var iconStyle = "";
        if (iconColor) {
          iconStyle = " fill route"+iconColor;
        }

        var middleIconRectOptions = TheGraph.merge(TheGraph.config.menu.iconRect, {});
        var middleIcon = TheGraph.factories.menu.createMenuMiddleIconRect.call(this, middleIconRectOptions);

        var middleIconTextOptions = {
          className: "icon context-node-icon"+iconStyle,
          children: TheGraph.FONT_AWESOME[ (this.props.icon ? this.props.icon : menu.icon) ]
        };
        middleIconTextOptions = TheGraph.merge(TheGraph.config.menu.iconText, middleIconTextOptions);
        var iconText = TheGraph.factories.menu.createMenuMiddleIconText.call(this, middleIconTextOptions);

        children.push(middleIcon, iconText);
      }

      var containerOptions = {
        transform: "translate("+position.x+","+position.y+")",
        children: children
      };

      containerOptions = TheGraph.merge(TheGraph.config.menu.container, containerOptions);
      return TheGraph.factories.menu.createMenuGroup.call(this, containerOptions);

    }
  }));

  TheGraph.config.modalBG = {
    container: {},
    rect: {
      ref: "rect",
      className: "context-modal-bg"
    }
  };

  TheGraph.factories.modalBG = {
    createModalBackgroundGroup: TheGraph.factories.createGroup,
    createModalBackgroundRect: TheGraph.factories.createRect
  };


  TheGraph.ModalBG = React.createFactory( React.createClass({
    displayName: "TheGraphModalBG",
    componentDidMount: function () {
      var domNode = ReactDOM.findDOMNode(this);
      var rectNode = this.refs.rect; 

      // Right-click on another item will show its menu
      domNode.addEventListener("down", function (event) {
        // Only if outside of menu
        if (event && event.target===rectNode) {
          this.hideModal();
        }
      }.bind(this));
    },
    hideModal: function (event) {
      this.props.triggerHideContext();
    },
    render: function () {


      var rectOptions = {
        width: this.props.width,
        height: this.props.height
      };

      rectOptions = TheGraph.merge(TheGraph.config.modalBG.rect, rectOptions);
      var rect = TheGraph.factories.modalBG.createModalBackgroundRect.call(this, rectOptions);

      var containerContents = [rect, this.props.children];
      var containerOptions = TheGraph.merge(TheGraph.config.modalBG.container, {});
      return TheGraph.factories.modalBG.createModalBackgroundGroup.call(this, containerOptions, containerContents);
    }
  }));


})(this);
;/**
 * Created by mpricope on 05.09.14.
 */

(function (context) {
  "use strict";
  var TheGraph = context.TheGraph;

  TheGraph.Clipboard = {};
  var clipboardContent = {};

  var cloneObject = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  var makeNewId = function (label) {
    var num = 60466176; // 36^5
    num = Math.floor(Math.random() * num);
    var id = label + '_' + num.toString(36);
    return id;
  };

  TheGraph.Clipboard.copy = function (graph, keys) {
    //Duplicate all the nodes before putting them in clipboard
    //this will make this work also with cut/Paste and once we
    //decide if/how we will implement cross-document copy&paste will work there too
    clipboardContent = {nodes:[], edges:[], iips:[]};
    var map = {};
    var i, len;
    for (i = 0, len = keys.length; i < len; i++) {
      var node = graph.getNode(keys[i]);
      var newNode = cloneObject(node);
      newNode.id = makeNewId(node.component);
      clipboardContent.nodes.push(newNode);
      map[node.id] = newNode.id;
    }
    for (i = 0, len = graph.edges.length; i < len; i++) {
      var edge = graph.edges[i];
      var fromNode = edge.from.node;
      var toNode = edge.to.node;
      if (map.hasOwnProperty(fromNode) && map.hasOwnProperty(toNode)) {
        var newEdge = cloneObject(edge);
        newEdge.from.node = map[fromNode];
        newEdge.to.node = map[toNode];
        clipboardContent.edges.push(newEdge);
      }
    }
    for (i = 0, len = graph.initializers.length; i < len; i++) {
      var iip = graph.initializers[i];
      var toNode = iip.to.node;
      if (map.hasOwnProperty(toNode)) {
        var newIip = cloneObject(iip);
        newIip.to.node = map[toNode];
        clipboardContent.iips.push(newIip);
      }
    }
    if (window.localStorage) {
      window.localStorage.setItem(
        'clipboard', JSON.stringify(clipboardContent));
    }
  };

  TheGraph.Clipboard.paste = function (graph, app) {
    var map = {};
    var pasted = {nodes:[], edges:[]};
    var i, len;

    var content;
    if (window.localStorage) {
      content = JSON.parse(window.localStorage.getItem('clipboard'));
    }

    if (!content) {
      content = clipboardContent;
    }

    var nodes = content.nodes || [];
    for (i = 0, len = nodes.length; i < len; i++) {
      var node = nodes[i];
      var meta = cloneObject(node.metadata);
      if (app.mousePos) {
        meta.x = ((app.mousePos.x - app.state.x) / app.state.scale) - 36;
        meta.y = ((app.mousePos.y - app.state.y) / app.state.scale) - 36;
      } else {
        meta.x += 36;
        meta.y += 36;
      }
      var newNode = graph.addNode(makeNewId(node.component), node.component, meta);
      map[node.id] = newNode.id;
      pasted.nodes.push(newNode);
    }

    var edges = content.edges || [];
    for (i = 0, len = edges.length; i < len; i++) {
      var edge = edges[i];
      var newEdgeMeta = cloneObject(edge.metadata);
      var newEdge;
      if (edge.from.hasOwnProperty('index') || edge.to.hasOwnProperty('index')) {
        // One or both ports are addressable
        var fromIndex = edge.from.index || null;
        var toIndex = edge.to.index || null;
        newEdge = graph.addEdgeIndex(map[edge.from.node], edge.from.port, fromIndex, map[edge.to.node], edge.to.port, toIndex, newEdgeMeta);
      } else {
        newEdge = graph.addEdge(map[edge.from.node], edge.from.port, map[edge.to.node], edge.to.port, newEdgeMeta);
      }
      pasted.edges.push(newEdge);
    }

    var iips = content.iips || [];
    for (i = 0, len = iips.length; i < len; i++) {
      var iip = iips[i];
      var iipMeta = cloneObject(iip.metadata);
      if (iip.to.index !== null && iip.to.index !== undefined) {
        var toIndex = edge.to.index;
        graph.addInitialIndex(
          iip.from.data, map[iip.to.node], iip.to.port, index, iipMeta);
      } else {
        graph.addInitial(
          iip.from.data, map[iip.to.node], iip.to.port, iipMeta);
      }
    }
    return pasted;
  };

})(this);
