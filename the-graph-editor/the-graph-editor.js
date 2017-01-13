
// Returns a new datastructure to prevent accidental sharing between diffent editor instances
function getDefaultMenus(editor) {

  var pasteAction = function (graph, itemKey, item) {
    if (this.disabled) {
      dispatchDisabledEvent('paste');
      return;
    }
    var pasted = TheGraph.Clipboard.paste(graph, this.$.graph.appView);
    this.selectedNodes = pasted.nodes;
    this.selectedEdges = [];
  }.bind(editor);
  var pasteMenu = {
    icon: "paste",
    iconLabel: "paste",
    action: pasteAction
  };
  // Default context menu defs

  var nodeActions = {
    delete: function (graph, itemKey, item) {
      if (this.disabled) {
        dispatchDisabledEvent('node-delete');
        return;
      }
      graph.removeNode(itemKey);
      // Remove selection
      var newSelection = [];
      for (var i=0, len=this.selectedNodes.length; i<len; i++){
        var selected = this.selectedNodes[i];
        if (selected !== item) {
          newSelection.push(selected);
        }
      }
      this.selectedNodes = newSelection;
    }.bind(editor),
    copy: function (graph, itemKey, item) {
      TheGraph.Clipboard.copy(graph, [itemKey]);
    }
  }, edgeActions = {
    delete: function (graph, itemKey, item) {
      if (this.disabled) {
        dispatchDisabledEvent('edge-delete');
        return;
      }
      graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port);
      // Remove selection
      var newSelection = [];
      for (var i=0, len=this.selectedEdges.length; i<len; i++){
        var selected = this.selectedEdges[i];
        if (selected !== item) {
          newSelection.push(selected);
        }
      }
      this.selectedEdges = newSelection;
    }.bind(editor)
  };

  var cancelPreview = function () {
    var event = new CustomEvent('the-graph-cancel-preview-edge', {});
    var node = ReactDOM.findDOMNode(this.$.graph.graphView);
    if (node) {
      node.dispatchEvent(event);
    }
  }.bind(editor);

  var menus = {
    main: {
      icon: "sitemap",
      e4: pasteMenu
    },
    edge: {
      actions: edgeActions,
      icon: "long-arrow-right",
      s4: {
        icon: "trash-o",
        iconLabel: "delete",
        action: edgeActions.delete
      }
    },
    node: {
      actions: nodeActions,
      s4: {
        icon: "trash-o",
        iconLabel: "delete",
        action: nodeActions.delete
      },
      w4: {
        icon: "copy",
        iconLabel: "copy",
        action:  nodeActions.copy
      }
    },
    nodeInport: {
      w4: {
        icon: "sign-in",
        iconLabel: "export",
        action: function (graph, itemKey, item) {
          if (this.disabled) {
            dispatchDisabledEvent('inport-add');
            return;
          }
          var pub = item.port;
          if (pub === 'start') {
            pub = 'start1';
          }
          if (pub === 'graph') {
            pub = 'graph1';
          }
          var count = 0;
          // Make sure public is unique
          while (graph.inports[pub]) {
            count++;
            pub = item.port + count;
          }
          var priNode = graph.getNode(item.process);
          var x = item.x || priNode.metadata.x-144;
          var y = item.y || priNode.metadata.y;
          var metadata = {x: x, y: y};
          graph.addInport(pub, item.process, item.port, metadata);
          cancelPreview();
        }.bind(editor)
      }
    },
    nodeOutport: {
      e4: {
        icon: "sign-out",
        iconLabel: "export",
        action: function (graph, itemKey, item) {
          if (this.disabled) {
            dispatchDisabledEvent('outport-add');
            return;
          }
          var pub = item.port;
          var count = 0;
          // Make sure public is unique
          while (graph.outports[pub]) {
            count++;
            pub = item.port + count;
          }
          var priNode = graph.getNode(item.process);
          var x = item.x || priNode.metadata.x+144;
          var y = item.y || priNode.metadata.y;
          var metadata = {x: x, y: y};
          graph.addOutport(pub, item.process, item.port, metadata);
          cancelPreview();
        }.bind(editor)
      }
    },
    graphInport: {
      icon: "sign-in",
      iconColor: 2,
      n4: {
        label: "inport"
      },
      s4: {
        icon: "trash-o",
        iconLabel: "delete",
        action: function (graph, itemKey, item) {
          if (this.disabled) {
            dispatchDisabledEvent('inport-delete');
            return;
          }
          graph.removeInport(itemKey);
        }.bind(editor)
      }
    },
    graphOutport: {
      icon: "sign-out",
      iconColor: 5,
      n4: {
        label: "outport"
      },
      s4: {
        icon: "trash-o",
        iconLabel: "delete",
        action: function (graph, itemKey, item) {
          if (this.disabled) {
            dispatchDisabledEvent('outport-delete');
            return;
          }
          graph.removeOutport(itemKey);
        }.bind(editor)
      }
    },
    group: {
      icon: "th",
      s4: {
        icon: "trash-o",
        iconLabel: "ungroup",
        action: function (graph, itemKey, item) {
          if (this.disabled) {
            dispatchDisabledEvent('group-delete');
            return;
          }
          graph.removeGroup(itemKey);
        }.bind(editor)
      },
      // TODO copy group?
      e4: pasteMenu
    },
    selection: {
      icon: "th",
      w4: {
        icon: "copy",
        iconLabel: "copy",
        action: function (graph, itemKey, item) {
          TheGraph.Clipboard.copy(graph, item.nodes);
        }
      },
      e4: pasteMenu
    },
    subgraph: {
      actions: nodeActions,
      s4: {
        icon: "trash-o",
        iconLabel: "delete",
        action: nodeActions.delete
      },
      w4: {
        icon: "copy",
        iconLabel: "copy",
        action:  nodeActions.copy
      }
    }
  };
  return menus;
}

module.exports = {
  getDefaultMenus: getDefaultMenus
};
