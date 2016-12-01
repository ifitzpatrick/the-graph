(function (context) {
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
    getInitialState: function() {
      // Autofit
      var fit = TheGraph.findFit(this.props.graph, this.props.width, this.props.height);

      return {
        x: fit.x,
        y: fit.y,
        scale: fit.scale,
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

      this.animate(fit, duration, 'out-quint', function() {});
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
      var noop = function(){};
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
    render: function() {
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
