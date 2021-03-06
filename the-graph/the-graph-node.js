module.exports.register = function (context) {

  var TheGraph = context.TheGraph;

  // Initialize namespace for configuration and factory functions.
  TheGraph.config.node = {
    snap: TheGraph.config.nodeSize,
    container: {},
    background: {
      className: "node-bg"
    },
    backgroundOptions: {
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
  function patchGestures() {
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
  }


  // Node view
  TheGraph.Node = React.createFactory( React.createClass({
    displayName: "TheGraphNode",
    mixins: [
      TheGraph.mixins.Tooltip
    ],
    componentDidMount: function () {
      patchGestures();
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
        ReactDOM.findDOMNode(this).addEventListener("hold", this.onHold);
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
        var snap = this.props.snap || config.snap / 2;
        var snapToGrid = snap !== 1;
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
    onHold: function (event) {
      if (event.pointerType !== 'mouse') {
        this.showContext(event);
      }
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

      var backgroundRectOptions = TheGraph.merge(nodeConfig.background, { width: this.props.width, height: this.props.height + nodeConfig.backgroundOptions.heightPadding});
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
        nodeContents.push(sublabelGroup);
      }

      var nodeOptions = {
        className: "node drag"+
          (this.props.selected ? " selected" : "")+
          (this.props.error ? " error" : "")+
          (this.props.subgraph ? " subgraph" : "")+
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

};
