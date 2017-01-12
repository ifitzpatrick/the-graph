module.exports.register = function (context) {

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


};
