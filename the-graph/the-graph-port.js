(function (context) {
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
      className: "port-arc"
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
      ReactDOM.findDOMNode(this).addEventListener("tap", this.edgeStart);
      ReactDOM.findDOMNode(this).addEventListener("trackstart", this.edgeStart);
      // Make edge
      ReactDOM.findDOMNode(this).addEventListener("trackend", this.triggerDropOnTarget);
      ReactDOM.findDOMNode(this).addEventListener("the-graph-edge-drop", this.edgeStart);

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
    edgeStart: function (event) {
      // Don't start edge on export node port
      if (this.props.isExport) {
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
        nextProps.x !== this.props.x ||
        nextProps.y !== this.props.y ||
        nextProps.nodeWidth !== this.props.nodeWidth
      );
    },
    render: function() {
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
        r = 6;
        inArc = TheGraph.arcs.inportBig;
        outArc = TheGraph.arcs.outportBig;
      }

      var backgroundCircleOptions = TheGraph.merge(TheGraph.config.port.backgroundCircle, { r: r + 1 });
      var backgroundCircle = TheGraph.factories.port.createPortBackgroundCircle.call(this, backgroundCircleOptions);

      var arcOptions = TheGraph.merge(TheGraph.config.port.arc, { d: (this.props.isIn ? inArc : outArc) });
      var arc = TheGraph.factories.port.createPortArc.call(this, arcOptions);

      var innerCircleOptions = {
        className: "port-circle-small fill route"+this.props.route,
        r: r - 1.5
      };

      innerCircleOptions = TheGraph.merge(TheGraph.config.port.innerCircle, innerCircleOptions);
      var innerCircle = TheGraph.factories.port.createPortInnerCircle.call(this, innerCircleOptions);

      var portContents = [
        backgroundCircle,
        arc,
        innerCircle
      ];

      if (tail) {
        var labelGroupOptions = {
          transform: "translate(" + (this.props.isIn ? 5 : -4*maxChars + 5) + ", 0)",
        };

        var labelTextOptions = {
          style: style,
          children: label
        };
        var tailTextOptions = {
          style: {fill: "url(#greyfade)"} ,
          children: tail,
          x: (maxChars-3)*4,
          width: 12
        };

        labelTextOptions = TheGraph.merge(TheGraph.config.port.text, labelTextOptions);
        tailTextOptions = TheGraph.merge(TheGraph.config.port.tailText, tailTextOptions);
        var labelText = TheGraph.factories.port.createPortLabelText.call(this, labelTextOptions);
        var tailText = TheGraph.factories.port.createPortLabelText.call(this, tailTextOptions);
        var labelGroup = TheGraph.factories.createGroup.call(this, labelGroupOptions, [
          labelText, tailText
        ]);
        portContents.push(labelGroup);
      } else {
        var labelTextOptions = {
          x: (this.props.isIn ? 5 : -5),
          style: style,
          children: label
        };
        labelTextOptions = TheGraph.merge(TheGraph.config.port.text, labelTextOptions);
        var labelText = TheGraph.factories.port.createPortLabelText.call(this, labelTextOptions);
        portContents.push(labelText);
      }

      var containerOptions = TheGraph.merge(TheGraph.config.port.container, { title: this.props.label, transform: "translate("+this.props.x+","+this.props.y+")" });
      return TheGraph.factories.port.createPortGroup.call(this, containerOptions, portContents);

    }
  }));


})(this);
