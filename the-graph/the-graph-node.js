var wedidit = false;
(function (context) {
  "use strict";

  var TheGraph = context.TheGraph;

  // Initialize namespace for configuration and factory functions.
  TheGraph.config.node = {
    snap: TheGraph.config.nodeSize,
    container: {},
    background: {
      className: "node-bg"
    },
    border: {
      className: "node-border drag",
      rx: TheGraph.config.nodeRadius,
      ry: TheGraph.config.nodeRadius
    },
    innerRect: {
      className: "node-rect drag",
      x: 3,
      y: 3,
      rx: TheGraph.config.nodeRadius - 2,
      ry: TheGraph.config.nodeRadius - 2
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
    }
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
      this.props.onNodeSelection(this.props.nodeID, this.props.node, toggle);
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
        var deltaX = Math.round( event.ddx / scale );
        var deltaY = Math.round( event.ddy / scale );

        // Fires a change event on noflo graph, which triggers redraw
        if (resize) {
          var width = this.props.width;
          var height = this.props.height;

          var min = 72;

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
          this.props.graph.setNodeMetadata(this.props.nodeID, {
            x: this.props.node.metadata.x + deltaX,
            y: this.props.node.metadata.y + deltaY
          });
        }
      }.bind(this);
    },
    getOnTrackEnd: function (resize, onTrack) {
      var onTrackEnd = function (event) {
        // Don't fire on graph
        event.stopPropagation();

        var domNode = ReactDOM.findDOMNode(this);
        domNode.removeEventListener("track", onTrack);
        domNode.removeEventListener("trackend", onTrackEnd);

        // Snap to grid
        var snapToGrid = true;
        var snap = TheGraph.config.node.snap / 2;
        if (snapToGrid) {
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
      var x = event.x || event.clientX || 0;
      var y = event.y || event.clientY || 0;

      // App.showContext
      this.props.showContext({
        element: this,
        type: (this.props.export ? (this.props.isIn ? "graphInport" : "graphOutport") : "node"),
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
        nextProps.ports.dirty === true ||
        nextProps.classNames !== this.props.classNames
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
            labelWidth: config.labelWidth
          };
          views.push(TheGraph.factories.node.createNodePort(props));
          i++;
          if (info.expand && info.indexList) {
            info.indexList.map(function (connected, index) {
              var info = ports[key];
              var indexLabel = '[' + index + ']';
              var x = info.x;
              var y = height / (count+1) * (i+1);
              var props = {
                app: app,
                graph: graph,
                node: node,
                key: processKey + "." + config.type + "." + info.label + indexLabel,
                label: info.label + indexLabel,
                processKey: processKey,
                isIn: isIn,
                isExport: isExport,
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
                labelWidth: config.labelWidth
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

      var iconContent;
      if (this.props.iconsvg && this.props.iconsvg !== "") {
          var iconSVGOptions = TheGraph.merge(TheGraph.config.node.iconsvg, {
              src: this.props.iconsvg,
              x: TheGraph.config.nodeRadius - 4,
              y: TheGraph.config.nodeRadius - 4,
              width: this.props.width - 10,
              height: this.props.height - 10
          });
          iconContent = TheGraph.factories.node.createNodeIconSVG.call(this, iconSVGOptions);
      } else {
          var iconOptions = TheGraph.merge(TheGraph.config.node.icon, {
              x: this.props.width / 2,
              y: this.props.height / 2,
              children: icon });
          iconContent = TheGraph.factories.node.createNodeIconText.call(this, iconOptions);
      }

      var backgroundRectOptions = TheGraph.merge(TheGraph.config.node.background, { width: this.props.width, height: this.props.height + 25 });
      var backgroundRect = TheGraph.factories.node.createNodeBackgroundRect.call(this, backgroundRectOptions);

      var borderRectOptions = TheGraph.merge(TheGraph.config.node.border, { width: this.props.width, height: this.props.height });
      var borderRect = TheGraph.factories.node.createNodeBorderRect.call(this, borderRectOptions);

      var innerRectOptions = TheGraph.merge(TheGraph.config.node.innerRect, { width: this.props.width - 6, height: this.props.height - 6 });
      var innerRect = TheGraph.factories.node.createNodeInnerRect.call(this, innerRectOptions);

      var inportsOptions = TheGraph.merge(TheGraph.config.node.inports, { children: inportViews });
      var inportsGroup = TheGraph.factories.node.createNodeInportsGroup.call(this, inportsOptions);

      var outportsOptions = TheGraph.merge(TheGraph.config.node.outports, { children: outportViews });
      var outportsGroup = TheGraph.factories.node.createNodeOutportsGroup.call(this, outportsOptions);

      var labelTextOptions = TheGraph.merge(TheGraph.config.node.labelText, { x: this.props.width / 2, y: this.props.height + 15, children: label });
      var labelText = TheGraph.factories.node.createNodeLabelText.call(this, labelTextOptions);

      var labelRectX = this.props.width / 2;
      var labelRectY = this.props.height + 15;
      var labelRectOptions = buildLabelRectOptions(14, labelRectX, labelRectY, label.length, TheGraph.config.node.labelRect.className);
      labelRectOptions = TheGraph.merge(TheGraph.config.node.labelRect, labelRectOptions);
      var labelRect = TheGraph.factories.node.createNodeLabelRect.call(this, labelRectOptions);
      var labelGroup = TheGraph.factories.node.createNodeLabelGroup.call(this, TheGraph.config.node.labelBackground, [labelRect, labelText]);

      var sublabelTextOptions = TheGraph.merge(TheGraph.config.node.sublabelText, { x: this.props.width / 2, y: this.props.height + 30, children: sublabel });
      var sublabelText = TheGraph.factories.node.createNodeSublabelText.call(this, sublabelTextOptions);

      var sublabelRectX = this.props.width / 2;
      var sublabelRectY = this.props.height + 30;
      var sublabelRectOptions = buildLabelRectOptions(9, sublabelRectX, sublabelRectY, sublabel.length, TheGraph.config.node.sublabelRect.className);
      sublabelRectOptions = TheGraph.merge(TheGraph.config.node.sublabelRect, sublabelRectOptions);
      var sublabelRect = TheGraph.factories.node.createNodeSublabelRect.call(this, sublabelRectOptions);
      var sublabelGroup = TheGraph.factories.node.createNodeSublabelGroup.call(this, TheGraph.config.node.sublabelBackground, [sublabelRect, sublabelText]);

      var resizeWidth = 10;
      var resizeOffset = 3;
      var translate = function (x, y) {
        return 'translate(' + x + ', ' + y + ')';
      };
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

      var nodeContents = [
        backgroundRect,
        borderRect,
        innerRect,
        iconContent
      ];

      if (!this.props.export) {
        nodeContents.push(resizeRectGroup);
      }

      var nodeContents = nodeContents.concat([
        inportsGroup,
        outportsGroup,
        labelGroup,
        sublabelGroup
      ]);

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
      nodeOptions = TheGraph.merge(TheGraph.config.node.container, nodeOptions);

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
