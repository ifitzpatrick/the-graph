module.exports.register = function (context) {

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


};
