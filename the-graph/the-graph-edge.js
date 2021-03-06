module.exports.register = function (context) {

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
        domNode.addEventListener("hold", this.onHold);
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

};
