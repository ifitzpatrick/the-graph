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
    toggleExpand: function (event) {
      event.stopPropagation()
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
        nextProps.classNames !== this.props.classNames
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
