(function (context) {
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
    getInitialState: function() {
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
        offsetY: this.props.offsetY
      };
    },
    componentDidMount: function () {
      // To change port colors
      this.props.graph.on("addEdge", this.didAddEdge);
      this.props.graph.on("removeEdge", this.didRemoveEdge);
      this.props.graph.on("changeEdge", this.resetPortRoute);
      this.props.graph.on("removeInitial", this.resetPortRoute);

      // Listen to noflo graph object's events
      this.props.graph.on("changeNode", this.didChangeNode);
      this.props.graph.on("changeInport", this.markDirty);
      this.props.graph.on("changeOutport", this.markDirty);
      this.props.graph.on("endTransaction", this.markDirty);

      ReactDOM.findDOMNode(this).addEventListener("the-graph-cancel-preview-edge", this.cancelPreviewEdge);
      ReactDOM.findDOMNode(this).addEventListener("the-graph-node-remove", this.removeNode);

      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      appDomNode.addEventListener("mousedown", this.startMarqueeSelect);
      window.addEventListener("mouseup", this.stopMarqueeSelect);
      appDomNode.addEventListener("mousemove", this.moveMarqueeSelect);
    },
    startMarqueeSelect: function (event) {
      if (event.button !== 1) {
        return;
      }

      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var scale = this.props.scale;

      this.props.onNodeSelection();

      this.setState({
        marqueeSelect: true,
        marqueeSelectStartX: (event.x - appX)/scale,
        marqueeSelectStartY: (event.y - appY)/scale,
        marqueeSelectCurrentX: (event.x - appX)/scale,
        marqueeSelectCurrentY: (event.y - appY)/scale
      });
      this.markDirty();
    },
    moveMarqueeSelect: function (event) {
      if (!this.state.marqueeSelect) {
        return;
      }
      this.setState(this.calculateMarqueeSelect(event));
      this.markDirty();
    },
    calculateMarqueeSelect: function (event) {
      var appX = this.props.app.state.x;
      var appY = this.props.app.state.y;
      var scale = this.props.scale;

      var startX = this.state.marqueeSelectStartX;
      var startY = this.state.marqueeSelectStartY;
      var currentX = (event.x - appX)/scale;
      var currentY = (event.y - appY)/scale;
      var lowX, lowY, highX, highY;
      if (startX <= currentX) {
        lowX = startX;
        highX = currentX;
      } else {
        lowX = currentX;
        highX = startX;
      }

      lowX -= TheGraph.config.nodeWidth / 2;
      highX += TheGraph.config.nodeWidth / 2;

      if (startY <= currentY) {
        lowY = startY;
        highY = currentY;
      } else {
        lowY = currentY;
        highY = startY;
      }

      lowY -= TheGraph.config.nodeWidth / 2;
      highY += TheGraph.config.nodeWidth * 0.75;

      var filter = function (node) {
        return (
          (node.metadata.x >= lowX &&
           node.metadata.x <= highX) ||
          (node.metadata.x + node.metadata.width >= lowX &&
           node.metadata.x + node.metadata.width <= highX)
        ) && (
          (node.metadata.y >= lowY &&
           node.metadata.y <= highY) ||
          (node.metadata.y + node.metadata.height >= lowY &&
           node.metadata.y + node.metadata.height <= highY)
        )
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

      this.props.onNodeGroupSelection(nodes, inports, outports);

      return {
        marqueeSelectCurrentX: currentX,
        marqueeSelectCurrentY: currentY
      };
    },
    stopMarqueeSelect: function (event) {
      if (event.button !== 1) {
        return;
      }

      this.calculateMarqueeSelect(event);

      this.setState({
        marqueeSelect: false,
        marqueeSelectStartX: null,
        marqueeSelectStartY: null,
        marqueeSelectCurrentX: null,
        marqueeSelectCurrentY: null
      });
      this.markDirty();
    },
    didChangeNode: function (event) {
      delete this.portInfo[event.id];
      this.markDirty(event);
    },
    didAddEdge: function (edge) {
      this.arrayPortInfo = null;
      this.portInfo = {};
      this.resetPortRoute(edge);
    },
    didRemoveEdge: function (edge) {
      this.arrayPortInfo = null;
      this.portInfo = {};
      this.resetPortRoute(edge);
    },
    edgePreview: null,
    edgeStart: function (event) {
      // Forwarded from App.edgeStart()

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
      var typeRoutes = {
        all: 0,
        bang: 0,
        object: 1,
        buffer: 2,
        array: 3,
        string: 4,
        "function": 5,
        number: 6,
        "int": 7,
        color: 8,
        date: 9
      };

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
      appDomNode.addEventListener("mousemove", this.renderPreviewEdge);
      appDomNode.addEventListener("track", this.renderPreviewEdge);
      // TODO tap to add new node here
      appDomNode.addEventListener("tap", this.cancelPreviewEdge);
      var edgePreviewEvent = new CustomEvent('edge-preview', {detail: edge});
      appDomNode.dispatchEvent(edgePreviewEvent);

      this.setState({edgePreview: edge});
    },
    cancelPreviewEdge: function (event) {
      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      appDomNode.removeEventListener("mousemove", this.renderPreviewEdge);
      appDomNode.removeEventListener("track", this.renderPreviewEdge);
      appDomNode.removeEventListener("tap", this.cancelPreviewEdge);

      var edgePreviewEvent = new CustomEvent('edge-preview', {detail: null});
      appDomNode.dispatchEvent(edgePreviewEvent);
      if (this.state.edgePreview) {
        this.setState({edgePreview: null});
        this.markDirty();
      }
    },
    renderPreviewEdge: function (event) {
      var x = event.x || event.clientX || 0;
      var y = event.y || event.clientY || 0;
      x -= this.props.app.state.offsetX || 0;
      y -= this.props.app.state.offsetY || 0;
      var scale = this.props.app.state.scale;
      this.setState({
        edgePreviewX: (x - this.props.app.state.x) / scale,
        edgePreviewY: (y - this.props.app.state.y) / scale
      });
      this.markDirty();
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
    moveGroup: function (nodes, dx, dy) {
      var graph = this.state.graph;

      // Move each group member
      var len = nodes.length;
      for (var i=0; i<len; i++) {
        var node = graph.getNode(nodes[i]);
        if (!node) { continue; }
        if (dx !== undefined) {
          // Move by delta
          graph.setNodeMetadata(node.id, {
            x: node.metadata.x + dx,
            y: node.metadata.y + dy
          });
        } else {
          // Snap to grid
          var snap = TheGraph.config.nodeHeight / 2;
          graph.setNodeMetadata(node.id, {
            x: Math.round(node.metadata.x/snap) * snap,
            y: Math.round(node.metadata.y/snap) * snap
          });
        }
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
      var node = graph.getNode(processName);
      var ports = this.portInfo[processName];
      var expanded = node.metadata.expandedPorts || {
        inports: {},
        outports: {}
      };

      if (!ports) {
        var inports = {};
        var outports = {};
        if (componentName && this.props.library) {
          // Copy ports from library object
          var component = this.getComponentInfo(componentName);
          if (!component) {
            return {
              inports: inports,
              outports: outports
            };
          }

          var i, port, len;
          for (i=0, len=component.outports.length; i<len; i++) {
            port = component.outports[i];
            if (!port.name) { continue; }
            outports[port.name] = {
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
              y: node.metadata.height / (len+1) * (i+1)
            };
          }
          for (i=0, len=component.inports.length; i<len; i++) {
            port = component.inports[i];
            if (!port.name) { continue; }
            inports[port.name] = {
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
              y: node.metadata.height / (len+1) * (i+1)
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
      var nodeHeight = node.metadata.height;
      var ports = this.getPorts(graph, processName, component);

      if (ports.height === nodeHeight) {
        return;
      }

      ports.dirty = true;
      ports.height = nodeHeight;

      var i, len;
      i = 0;
      len = ports.outportCount;

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
        var portHeight = nodeHeight / (len+1) * (i+1)
        i++;
        return portHeight;
      };

      Object.keys(ports.outports).forEach(function (key) {
        var port = ports.outports[key];
        port.y = nextY();
        if (port.expand) {
          port.indexY = map(port.indexList, nextY);
        }
      });

      i = 0;
      len = ports.inportCount;
      Object.keys(ports.inports).forEach(function (key) {
        var port = ports.inports[key];
        port.y = nextY();
        if (port.expand) {
          port.indexY = map(port.indexList, nextY);
        }
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
      // Trigger nodes with changed ports to rerender
      if (event.from && event.from.node) {
        var fromNode = this.portInfo[event.from.node];
        if (fromNode) {
          fromNode.dirty = true;
          var outport = fromNode.outports[event.from.port];
          if (outport) {
            outport.route = null;
          }
        }
      }
      if (event.to && event.to.node) {
        var toNode = this.portInfo[event.to.node];
        if (toNode) {
          toNode.dirty = true;
          var inport = toNode.inports[event.to.port];
          if (inport) {
            inport.route = null;
          }
        }
      }
    },
    graphOutports: {},
    getGraphOutport: function (key) {
      var exp = this.graphOutports[key];
      if (!exp) {
        exp = {inports:{},outports:{}};
        exp.inports[key] = {
          label: key,
          type: "all",
          route: 5,
          x: 0,
          y: TheGraph.config.nodeHeight / 2
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
          route: 2,
          x: TheGraph.config.nodeWidth,
          y: TheGraph.config.nodeHeight / 2
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
    markDirty: function (event) {
      if (event && event.libraryDirty) {
        this.libraryDirty = true;
      }
      window.requestAnimationFrame(this.triggerRender);
    },
    triggerRender: function (time) {
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
    render: function() {
      this.dirty = false;
      var rendered = this.rendered;

      var self = this;
      var graph = this.state.graph;
      var library = this.props.library;
      var selectedIds = [];
      var selectedInports = [];
      var selectedOutports = [];

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
          if (portCount > TheGraph.config.maxPortCount) {
            var diff = portCount - TheGraph.config.maxPortCount;
            node.metadata.height = TheGraph.config.nodeHeight + (diff * TheGraph.config.nodeHeightIncrement);
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

        var nodeOptions = {
          key: key,
          nodeID: key,
          x: node.metadata.x,
          y: node.metadata.y,
          label: node.metadata.label,
          sublabel: node.metadata.sublabel || node.component,
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
          classNames: classNames
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
          classNames: classNames
        };

        edgeOptions.length = length(edgeOptions);
        edgeOptions.opacity = opacity(edgeOptions.length);

        if (!rendered) {
          //console.log(length, (1 - ((length - 100) / 900)), edgeOptions.opacity)
        }

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
          classNames: classNames
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
        if (!metadata.width) { metadata.width = TheGraph.config.nodeWidth; }
        if (!metadata.height) { metadata.height = TheGraph.config.nodeHeight; }
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
          ports: self.getGraphInport(key),
          isIn: true,
          icon: (metadata.icon ? metadata.icon : "sign-in"),
          showContext: self.props.showContext,
          classNames: classNames,
          onNodeSelection: self.props.onExportSelection,
          selected: selected
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
          route: (metadata.route ? metadata.route : 2),
          isIn: true,
          label: "export in " + label.toUpperCase() + " -> " + portKey.toUpperCase() + " " + privateNode.metadata.label,
          sX: expNode.x + TheGraph.config.nodeWidth,
          sY: expNode.y + TheGraph.config.nodeHeight / 2,
          tX: privateNode.metadata.x + privatePort.x,
          tY: privateNode.metadata.y + privatePort.y,
          showContext: self.props.showContext,
          nodeSelected: self.state.selectedNodes[privateNode.id] === true,
          classNames: classNames,
          selected: selected
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
        if (!metadata.width) { metadata.width = TheGraph.config.nodeWidth; }
        if (!metadata.height) { metadata.height = TheGraph.config.nodeHeight; }
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
          ports: self.getGraphOutport(key),
          isIn: false,
          icon: (metadata.icon ? metadata.icon : "sign-out"),
          showContext: self.props.showContext,
          classNames: classNames,
          onNodeSelection: self.props.onExportSelection,
          selected: selected
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
          route: (metadata.route ? metadata.route : 4),
          isIn: false,
          label: privateNode.metadata.label + " " + portKey.toUpperCase() + " -> " + label.toUpperCase() + " export out",
          sX: privateNode.metadata.x + privatePort.x,
          sY: privateNode.metadata.y + privatePort.y,
          tX: expNode.x,
          tY: expNode.y + TheGraph.config.nodeHeight / 2,
          showContext: self.props.showContext,
          nodeSelected: self.state.selectedNodes[privateNode.id] === true,
          classNames: classNames,
          selected: selected
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
          edgePreview: edgePreview
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

        var selectionGroupOptions = {
          graph: graph,
          app: self.props.app,
          minX: minX,
          minY: minY,
          maxX: maxX,
          maxY: maxY,
          scale: scale,
          color: 1
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
            showContext: self.props.showContext
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
            route: edgePreview.metadata.route
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
            route: edgePreview.metadata.route
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
      return TheGraph.factories.graph.createGraphContainerGroup.call(this, containerOptions, containerContents);

    },
    componentDidUpdate: function () {
      var appDomNode = ReactDOM.findDOMNode(this.props.app);
      var event = new CustomEvent('rendersuccess', {detail: this.props.graph});
      appDomNode.dispatchEvent(event);
    }
  }));

})(this);
