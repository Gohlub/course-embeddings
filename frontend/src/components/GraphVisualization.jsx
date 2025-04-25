import { useRef, useEffect } from 'react';
import Sigma from 'sigma';
import { SIGMA_SETTINGS } from '../config/colors';
import { getGraphBounds } from '../utils/graphUtils';
import { fitViewportToNodes } from "@sigma/utils";

/**
 * Component for rendering the graph visualization
 */
const GraphVisualization = ({ 
  graph, 
  departmentColors, 
  hoveredNodeRef, 
  hoveredNeighborsRef, 
  selectedNodeRef, 
  sigmaRef
}) => {
  const containerRef = useRef(null);
  
  // Debug props
  console.log('GraphVisualization props:', {
    graph: graph ? 'Graph instance exists' : 'No graph',
    graphNodes: graph ? graph.nodes().length : 0,
    departmentColors: Object.keys(departmentColors).length,
    sigmaRef: sigmaRef ? 'Ref exists' : 'No ref',
    selectedNode: selectedNodeRef?.current
  });
  
  // Initialize Sigma and set up event handlers
  useEffect(() => {
    console.log('GraphVisualization useEffect running');
    console.log('Container ref:', containerRef.current);
    console.log('Graph exists:', !!graph);
    
    if (!graph || !containerRef.current) {
      console.log('Missing graph or container, skipping Sigma initialization');
      return;
    }

    // Clean up previous instance
    if (sigmaRef.current) {
      console.log('Cleaning up previous Sigma instance');
      sigmaRef.current.kill();
    }

    console.log('Creating department cluster data');
    // Create department cluster data
    const departmentClusters = {};
    
    // Initialize clusters
    graph.forEachNode((nodeId, attributes) => {
      const dept = attributes.department;
      if (!departmentClusters[dept]) {
        departmentClusters[dept] = { 
          label: dept, 
          color: departmentColors[dept],
          positions: [] 
        };
      }
      // Store node positions for calculating cluster center
      departmentClusters[dept].positions.push({ 
        x: attributes.x, 
        y: attributes.y 
      });
    });

    // Calculate cluster centers (barycenter of all nodes in the cluster)
    for (const dept in departmentClusters) {
      const positions = departmentClusters[dept].positions;
      departmentClusters[dept].x = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length;
      departmentClusters[dept].y = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length;
    }

    console.log('Creating Sigma instance');
    try {
      // Create Sigma instance with settings
      sigmaRef.current = new Sigma(graph, containerRef.current, {
        ...SIGMA_SETTINGS,
        labelRenderer: (context, data, settings) => {
          const camera = sigmaRef.current.getCamera();
          const ratio = camera.ratio;
          
          // SIGNIFICANTLY DECREASE this value to require much more zooming
          // before course labels appear
          const courseLabelVisibilityThreshold = 0.08;  // Reduced from 0.2 to 0.08
          
          // Only show course name labels when zoomed in very close
          if (ratio > courseLabelVisibilityThreshold) {
            // Don't show any course labels when zoomed out beyond threshold
            return;
          }
          
          // Get the course name
          const label = graph.getNodeAttribute(data.key, 'label');
          
          // INCREASE this value to show fewer labels (only on larger nodes)
          const minNodeSizeForLabel = 2.5;  // Increased from 1.5 to 2.5
          
          if (data.size * ratio < minNodeSizeForLabel) {
            return;
          }

          return {
            ...data,
            label,
            size: settings.labelSize,
            color: settings.labelColor.color,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          };
        },
        nodeReducer: (node, data) => {
          const res = { ...data };
          const hoveredNode = hoveredNodeRef.current;
          const hoveredNeighbors = hoveredNeighborsRef.current;
          const selectedNode = selectedNodeRef.current;

          // Handle selected node
          if (selectedNode === node) {
            res.highlighted = true;
            res.size = data.size * 1.8;
            res.forceLabel = true;
            return res;
          }

          // Handle hover state
          if (hoveredNeighbors && !hoveredNeighbors.has(node) && hoveredNode !== node) {
            res.label = "";
            res.color = data.color + "33"; // Make it transparent
          }

          return res;
        },
        edgeReducer: (edge, data) => {
          const res = { ...data };
          const hoveredNode = hoveredNodeRef.current;
          const hoveredNeighbors = hoveredNeighborsRef.current;
          const selectedNode = selectedNodeRef.current;

          // Hide edges for selected node
          if (selectedNode) {
            const source = graph.source(edge);
            const target = graph.target(edge);
            if (source !== selectedNode && target !== selectedNode) {
              res.hidden = true;
            }
            return res;
          }

          // Hide edges for hover state
          if (
            hoveredNode &&
            !graph.extremities(edge).every(n => n === hoveredNode || (hoveredNeighbors && hoveredNeighbors.has(n)))
          ) {
            res.hidden = true;
          }

          return res;
        }
      });
      console.log('Sigma instance created successfully');
      
      // Log the initial camera position
      const initialCamera = sigmaRef.current.getCamera();
      console.log('Initial camera position:', {
        x: initialCamera.x,
        y: initialCamera.y,
        ratio: initialCamera.ratio
      });
      
      // Calculate graph bounds
      const nodeBounds = getGraphBounds(graph);
      console.log('Graph bounds:', nodeBounds);
      
      // Use Sigma's built-in fitViewportToNodes to show all nodes
      console.log('Using fitViewportToNodes to show all nodes');
      fitViewportToNodes(
        sigmaRef.current, 
        graph.nodes(), 
        { duration: 0 } // No animation for initial positioning
      );
      
      // Log the updated camera position
      const updatedCamera = sigmaRef.current.getCamera();
      console.log('Updated camera position after fitViewportToNodes:', {
        x: updatedCamera.x,
        y: updatedCamera.y,
        ratio: updatedCamera.ratio
      });
      
    } catch (error) {
      console.error('Error creating Sigma instance:', error);
    }

    // Add event listeners for hover
    if (sigmaRef.current) {
      sigmaRef.current.on("enterNode", ({ node }) => {
        hoveredNodeRef.current = node;
        hoveredNeighborsRef.current = new Set(graph.neighbors(node));
        // Just refresh the rendering without re-computing the layout
        sigmaRef.current.refresh({ skipIndexation: true });
      });
      
      sigmaRef.current.on("leaveNode", () => {
        hoveredNodeRef.current = null;
        hoveredNeighborsRef.current = null;
        // Just refresh the rendering without re-computing the layout
        sigmaRef.current.refresh({ skipIndexation: true });
      });
    }

    console.log('Creating clusters layer');
    // Create the clusters label layer
    const clustersLayer = document.createElement("div");
    clustersLayer.id = "clustersLayer";
    clustersLayer.style.position = "absolute";
    clustersLayer.style.top = "0";
    clustersLayer.style.left = "0";
    clustersLayer.style.pointerEvents = "none";
    clustersLayer.style.width = "100%";
    clustersLayer.style.height = "100%";
    clustersLayer.style.zIndex = "2";
    
    // Create label elements for each cluster
    let clusterLabelsDoms = "";
    for (const dept in departmentClusters) {
      const cluster = departmentClusters[dept];
      // Convert graph coordinates to viewport coordinates
      const viewportPos = sigmaRef.current.graphToViewport(cluster);
      clusterLabelsDoms += `
        <div 
          id="cluster-${dept}" 
          class="cluster-label" 
          style="
            position: absolute;
            top: ${viewportPos.y}px;
            left: ${viewportPos.x}px;
            color: ${cluster.color};
            background-color: rgba(255, 255, 255, 0.9);
            padding: 6px 10px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 18px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            text-shadow: 0px 0px 3px white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            border: 1px solid ${cluster.color}40;
          "
        >${dept}</div>
      `;
    }
    clustersLayer.innerHTML = clusterLabelsDoms;
    
    // Add the layer to the container
    const container = containerRef.current;
    container.appendChild(clustersLayer);
    
    // Update cluster label positions on camera changes
    if (sigmaRef.current) {
      sigmaRef.current.on("afterRender", () => {
        const camera = sigmaRef.current.getCamera();
        const ratio = camera.ratio;
        
        // Use the same threshold for cluster labels
        const labelVisibilityThreshold = 0.3;  // Make sure this matches the value above
        
        // Show cluster labels only when zoomed out
        const clustersLayer = document.getElementById("clustersLayer");
        if (clustersLayer) {
          clustersLayer.style.display = ratio > labelVisibilityThreshold ? "block" : "none";
        }
        
        // Update positions of cluster labels when they're visible
        if (ratio > labelVisibilityThreshold) {
          for (const dept in departmentClusters) {
            const cluster = departmentClusters[dept];
            const labelElement = document.getElementById(`cluster-${dept}`);
            if (labelElement) {
              const viewportPos = sigmaRef.current.graphToViewport(cluster);
              labelElement.style.top = `${viewportPos.y}px`;
              labelElement.style.left = `${viewportPos.x}px`;
            }
          }
        }
      });
    }

    console.log('Creating department buttons');
    // Create department buttons for zooming to clusters
    const departmentList = Object.keys(departmentColors);
    const buttonsContainer = document.createElement("div");
    buttonsContainer.id = "department-buttons";
    buttonsContainer.style.position = "absolute";
    buttonsContainer.style.right = "10px";
    buttonsContainer.style.bottom = "10px";
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexDirection = "column";
    buttonsContainer.style.gap = "5px";
    buttonsContainer.style.maxHeight = "60vh";
    buttonsContainer.style.overflowY = "auto";
    buttonsContainer.style.background = "rgba(255, 255, 255, 0.8)";
    buttonsContainer.style.padding = "10px";
    buttonsContainer.style.borderRadius = "5px";
    buttonsContainer.style.zIndex = "3";
    
    // Add a button to reset view
    const resetButton = document.createElement("button");
    resetButton.textContent = "Show All";
    resetButton.style.padding = "5px 10px";
    resetButton.style.marginBottom = "10px";
    resetButton.style.fontWeight = "bold";
    resetButton.style.cursor = "pointer";
    resetButton.style.borderRadius = "4px";
    resetButton.style.border = "1px solid #ccc";
    resetButton.addEventListener("click", () => {
      console.log(`Showing all ${graph.order} nodes`);
      
      // Use Sigma's built-in fitViewportToNodes
      fitViewportToNodes(
        sigmaRef.current,
        graph.nodes(),
        { duration: 500 } // 500ms animation
      );
    });
    buttonsContainer.appendChild(resetButton);
    
    // Add buttons for each department
    departmentList.forEach(dept => {
      const button = document.createElement("button");
      button.textContent = dept;
      button.style.padding = "5px 10px";
      button.style.marginBottom = "5px";
      button.style.cursor = "pointer";
      button.style.borderRadius = "4px";
      button.style.border = "1px solid #ccc";
      button.style.backgroundColor = departmentColors[dept] + "33";
      button.style.color = departmentColors[dept];
      button.style.fontWeight = "bold";
      
      button.addEventListener("click", () => {
        // Find all nodes in this department
        const deptNodes = [];
        graph.forEachNode((nodeId, attrs) => {
          if (attrs.department === dept) {
            deptNodes.push(nodeId);
          }
        });
        
        console.log(`Found ${deptNodes.length} nodes for department ${dept}`);
        
        if (deptNodes.length > 0) {
          // Use Sigma's built-in fitViewportToNodes
          fitViewportToNodes(
            sigmaRef.current,
            deptNodes,
            { duration: 500 } // 500ms animation
          );
        } else {
          console.error(`No nodes found for department ${dept}`);
        }
      });
      
      buttonsContainer.appendChild(button);
    });
    
    container.appendChild(buttonsContainer);

    console.log('Setup complete');
    
    // Clean up function
    return () => {
      console.log('Cleaning up GraphVisualization');
      if (sigmaRef.current) {
        sigmaRef.current.kill();
      }
      if (container.contains(clustersLayer)) {
        container.removeChild(clustersLayer);
      }
      if (container.contains(buttonsContainer)) {
        container.removeChild(buttonsContainer);
      }
    };
  }, [graph, departmentColors, hoveredNodeRef, hoveredNeighborsRef, selectedNodeRef, sigmaRef]);

  return (
    <div 
      ref={containerRef} 
      className="graph-container" 
      style={{ 
        height: '70vh', 
        width: '90%',
        position: 'relative',
        margin: '20px auto',
        border: '1px solid #444',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#c5d9c3',
        maxWidth: '1400px'
      }}
    />
  );
};

export default GraphVisualization; 