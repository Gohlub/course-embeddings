import Graph from 'graphology';

/**
 * Extracts department code from a course code
 * @param {string} courseCode - The course code to extract from
 * @returns {string|null} - The extracted department code or null
 */
export const extractDepartment = (courseCode) => {
  if (!courseCode) return null;
  // Match all letters at the start of the course code
  const match = courseCode.match(/^[A-Za-z]+/);
  return match ? match[0] : null;
};

/**
 * Fits the viewport to show specific nodes
 * @param {Object} renderer - The Sigma renderer
 * @param {Array} nodeIds - Array of node IDs to fit in the viewport
 * @param {Object} options - Options for the animation
 * @param {Object} graph - The graph instance
 */
export const fitViewportToNodes = (renderer, nodeIds, options = { animate: true }, graph) => {
  if (!renderer || !nodeIds || !nodeIds.length) {
    console.error("Missing required parameters for fitViewportToNodes");
    return;
  }

  console.log("Fitting viewport to nodes:", nodeIds.length, "nodes");

  try {
    // Collect node positions
    const nodePositions = [];
    for (const nodeId of nodeIds) {
      if (graph.hasNode(nodeId)) {
        const attrs = graph.getNodeAttributes(nodeId);
        nodePositions.push({ x: attrs.x, y: attrs.y });
      }
    }
    
    if (nodePositions.length === 0) {
      console.error("No valid node positions found");
      return;
    }
    
    // Calculate bounds directly from positions
    const minX = Math.min(...nodePositions.map(pos => pos.x));
    const maxX = Math.max(...nodePositions.map(pos => pos.x));
    const minY = Math.min(...nodePositions.map(pos => pos.y));
    const maxY = Math.max(...nodePositions.map(pos => pos.y));
    
    const width = maxX - minX || 1; // Avoid division by zero
    const height = maxY - minY || 1; // Avoid division by zero
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const bounds = {
      minX, maxX, minY, maxY,
      width, height,
      centerX, centerY
    };
    
    console.log("Node bounds:", bounds);
    
    // Calculate the container dimensions
    const container = renderer.getContainer();
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    // Calculate the ratio needed to fit the nodes
    let ratio;
    const padding = options.padding || 0.1;
    const paddedWidth = width * (1 + padding);
    const paddedHeight = height * (1 + padding);
    
    if (paddedWidth / paddedHeight > containerWidth / containerHeight) {
      // Width is the limiting factor
      ratio = containerWidth / paddedWidth;
    } else {
      // Height is the limiting factor
      ratio = containerHeight / paddedHeight;
    }
    
    // For single nodes or very small groups, use a fixed zoom level
    if (nodeIds.length === 1) {
      ratio = 0.1; // Zoom in more for single nodes
    } else if (nodeIds.length <= 5) {
      ratio = Math.min(ratio, 0.2); // Slightly less zoom for small groups, but don't zoom out too far
    }
    
    console.log("Calculated camera position:", {
      x: centerX,
      y: centerY,
      ratio: ratio,
      container: { width: containerWidth, height: containerHeight }
    });
    
    // Animate camera to fit the nodes
    renderer.getCamera().animate(
      { 
        x: centerX, 
        y: centerY, 
        ratio: ratio 
      }, 
      { 
        duration: options.animate ? 500 : 0 
      }
    );
  } catch (error) {
    console.error("Error in fitViewportToNodes:", error);
  }
};

/**
 * Calculates the bounding box of all nodes in the graph
 * @param {Object} graph - The graph instance
 * @returns {Object} - The bounding box with min/max coordinates and dimensions
 */
export const getGraphBounds = (graph) => {
  const nodePositions = [];
  graph.forEachNode((nodeId, attrs) => {
    nodePositions.push({ x: attrs.x, y: attrs.y });
  });
  
  if (nodePositions.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  
  const minX = Math.min(...nodePositions.map(pos => pos.x));
  const maxX = Math.max(...nodePositions.map(pos => pos.x));
  const minY = Math.min(...nodePositions.map(pos => pos.y));
  const maxY = Math.max(...nodePositions.map(pos => pos.y));
  
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX,
    centerY
  };
}; 