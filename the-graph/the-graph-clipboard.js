/**
 * Created by mpricope on 05.09.14.
 */

(function (context) {
  "use strict";
  var TheGraph = context.TheGraph;

  TheGraph.Clipboard = {};
  var clipboardContent = {};

  var cloneObject = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  var makeNewId = function (label) {
    var num = 60466176; // 36^5
    num = Math.floor(Math.random() * num);
    var id = label + '_' + num.toString(36);
    return id;
  };

  TheGraph.Clipboard.copy = function (graph, keys) {
    //Duplicate all the nodes before putting them in clipboard
    //this will make this work also with cut/Paste and once we
    //decide if/how we will implement cross-document copy&paste will work there too
    clipboardContent = {nodes:[], edges:[], iips:[]};
    var map = {};
    var i, len;
    for (i = 0, len = keys.length; i < len; i++) {
      var node = graph.getNode(keys[i]);
      var newNode = cloneObject(node);
      newNode.id = makeNewId(node.component);
      clipboardContent.nodes.push(newNode);
      map[node.id] = newNode.id;
    }
    for (i = 0, len = graph.edges.length; i < len; i++) {
      var edge = graph.edges[i];
      var fromNode = edge.from.node;
      var toNode = edge.to.node;
      if (map.hasOwnProperty(fromNode) && map.hasOwnProperty(toNode)) {
        var newEdge = cloneObject(edge);
        newEdge.from.node = map[fromNode];
        newEdge.to.node = map[toNode];
        clipboardContent.edges.push(newEdge);
      }
    }
    for (i = 0, len = graph.initializers.length; i < len; i++) {
      var iip = graph.initializers[i];
      var toNode = iip.to.node;
      if (map.hasOwnProperty(toNode)) {
        var newIip = cloneObject(iip);
        newIip.to.node = map[toNode];
        clipboardContent.iips.push(newIip);
      }
    }
    if (window.localStorage) {
      window.localStorage.setItem(
        'clipboard', JSON.stringify(clipboardContent));
    }
  };

  TheGraph.Clipboard.paste = function (graph) {
    var map = {};
    var pasted = {nodes:[], edges:[]};
    var i, len;

    var content;
    if (window.localStorage) {
      content = JSON.parse(window.localStorage.getItem('clipboard'));
    }

    if (!content) {
      content = clipboardContent;
    }

    for (i = 0, len = content.nodes.length; i < len; i++) {
      var node = content.nodes[i];
      var meta = cloneObject(node.metadata);
      meta.x += 36;
      meta.y += 36;
      var newNode = graph.addNode(makeNewId(node.component), node.component, meta);
      map[node.id] = newNode.id;
      pasted.nodes.push(newNode);
    }
    for (i = 0, len = content.edges.length; i < len; i++) {
      var edge = content.edges[i];
      var newEdgeMeta = cloneObject(edge.metadata);
      var newEdge;
      if (edge.from.hasOwnProperty('index') || edge.to.hasOwnProperty('index')) {
        // One or both ports are addressable
        var fromIndex = edge.from.index || null;
        var toIndex = edge.to.index || null;
        newEdge = graph.addEdgeIndex(map[edge.from.node], edge.from.port, fromIndex, map[edge.to.node], edge.to.port, toIndex, newEdgeMeta);
      } else {
        newEdge = graph.addEdge(map[edge.from.node], edge.from.port, map[edge.to.node], edge.to.port, newEdgeMeta);
      }
      pasted.edges.push(newEdge);
    }
    for (i = 0, len = content.iips.length; i < len; i++) {
      var iip = content.iips[i];
      var iipMeta = cloneObject(iip.metadata);
      if (iip.to.index !== null && iip.to.index !== undefined) {
        var toIndex = edge.to.index;
        graph.addInitialIndex(
          iip.from.data, map[iip.to.node], iip.to.port, index, iipMeta);
      } else {
        graph.addInitial(
          iip.from.data, map[iip.to.node], iip.to.port, iipMeta);
      }
    }
    return pasted;
  };

})(this);
