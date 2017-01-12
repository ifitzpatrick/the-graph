module.exports.register = function (context) {

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
};
