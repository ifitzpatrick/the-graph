
// NOTE: caller should wrap in a graph transaction, to group all changes made to @graph
function applyAutolayout(graph, keilerGraph, props, autolayoutCenter) {
  // Update original graph nodes with the new coordinates from KIELER graph
  var children = keilerGraph.children.slice();

  if (autolayoutCenter) {
    var minX = Infinity, minY = Infinity;
    children.forEach(function (node) {
      if (node.children) {
        node.children.forEach(function (childNode) {
          if (node.x + childNode.x < minX) minX = node.x + childNode.x;
          if (node.y + childNode.y < minY) minY = node.y + childNode.y;
        });
      } else {
        if (node.x < minX) minX = node.x;
        if (node.y < minY) minY = node.y;
      }
    });
    var center = {
      x: autolayoutCenter.x - minX,
      y: autolayoutCenter.y - minY,
    };
  } else {
    var center = {x: 0, y: 0};
  }

  var i, len;
  for (i=0, len = children.length; i<len; i++) {
    var klayNode = children[i];
    var fbpNode = graph.getNode(klayNode.id);

    // Encode nodes inside groups
    if (klayNode.children) {
      var klayChildren = klayNode.children;
      var idx;
      for (idx in klayChildren) {
        var klayChild = klayChildren[idx];
        if (klayChild.id) {
          graph.setNodeMetadata(klayChild.id, {
            x: Math.round((klayNode.x + klayChild.x + center.x)/this.snap)*this.snap,
            y: Math.round((klayNode.y + klayChild.y + center.y)/this.snap)*this.snap
          });
        }
      }
    }

    // Encode nodes outside groups
    if (fbpNode) {
      graph.setNodeMetadata(klayNode.id, {
        x: Math.round((klayNode.x + center.x)/this.snap)*this.snap,
        y: Math.round((klayNode.y + center.y)/this.snap)*this.snap
      });
    } else {
      // Find inport or outport
      var idSplit = klayNode.id.split(":::");
      var expDirection = idSplit[0];
      var expKey = idSplit[1];
      if (expDirection==="inport" && graph.inports[expKey]) {
        graph.setInportMetadata(expKey, {
          x: Math.round((klayNode.x + center.x)/this.snap)*this.snap,
          y: Math.round((klayNode.y + center.y)/this.snap)*this.snap
        });
      } else if (expDirection==="outport" && graph.outports[expKey]) {
        graph.setOutportMetadata(expKey, {
          x: Math.round((klayNode.x + center.x)/this.snap)*this.snap,
          y: Math.round((klayNode.y + center.y)/this.snap)*this.snap
        });
      }
    }
  }
}

module.exports = {
  applyToGraph: applyAutolayout,
};
