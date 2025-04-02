import { useState, useRef, useCallback } from 'react';
import { fitViewportToNodes } from "@sigma/utils";

/**
 * Custom hook for search functionality
 * @param {Object} graph - The graph instance
 * @param {Object} sigmaInstance - Reference to the Sigma instance
 * @returns {Object} - Search state and handlers
 */
export const useSearch = (graph, sigmaInstance) => {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedNodeRef = useRef(null);
  const sigmaRef = useRef(sigmaInstance);
  
  // Update sigma reference
  if (sigmaInstance && sigmaRef.current !== sigmaInstance) {
    sigmaRef.current = sigmaInstance;
  }

  // Simple handler to update search query without any side effects
  const handleSearchInput = useCallback((e) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    
    // If the search is cleared, reset the view
    if (!newValue.trim() && selectedNodeRef.current) {
      selectedNodeRef.current = null;
      if (sigmaRef.current) {
        sigmaRef.current.getCamera().animatedReset({ duration: 500 });
        sigmaRef.current.refresh();
      }
    }
  }, []);

  // Handler for when a selection is made
  const handleSearchSelect = useCallback(() => {
    if (!graph || !sigmaRef.current) {
      console.log("Missing dependencies for search:", { 
        graph: !!graph, 
        sigmaRef: !!sigmaRef.current 
      });
      return;
    }

    // If search query is empty, reset the view
    if (!searchQuery.trim()) {
      console.log("Empty search query, resetting view");
      selectedNodeRef.current = null;
      
      // Reset the camera to show the full graph
      sigmaRef.current.getCamera().animatedReset({ duration: 500 });
      sigmaRef.current.refresh();
      return;
    }

    console.log("Searching for:", searchQuery);

    // Find matching node by exact label match
    const matchingNodes = [];
    graph.forEachNode((nodeId, attributes) => {
      if (attributes.label === searchQuery) {
        matchingNodes.push(nodeId);
      }
    });

    console.log("Found matching nodes:", matchingNodes);

    if (matchingNodes.length > 0) {
      const nodeId = matchingNodes[0];
      selectedNodeRef.current = nodeId;
      
      console.log("Selected node:", nodeId);
      
      // Get connected nodes to include in the viewport
      const nodesToFit = [nodeId];
      
      // Add connected nodes to the viewport
      graph.forEachNeighbor(nodeId, (neighborId) => {
        nodesToFit.push(neighborId);
      });
      
      // Use fitViewportToNodes with all relevant nodes
      fitViewportToNodes(
        sigmaRef.current,
        nodesToFit,  // Array with selected node and its neighbors
        { 
          duration: 500,  // Animation duration in milliseconds
          padding: 0.2    // Add some padding around the nodes
        }
      );
      
      // Refresh the rendering to highlight the selected node
      setTimeout(() => {
        if (sigmaRef.current) {
          sigmaRef.current.refresh();  // Removed skipIndexation to ensure edges are included
        }
      }, 50);
    } else {
      console.log("No matching nodes found for:", searchQuery);
    }
  }, [graph, searchQuery]);

  // Handle Enter key press
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearchSelect();
    }
  }, [handleSearchSelect]);

  // Handle blur event
  const handleSearchBlur = useCallback(() => {
    // We don't clear the search query on blur
  }, []);

  return {
    searchQuery,
    selectedNodeRef,
    handleSearchInput,
    handleSearchSelect,
    handleSearchBlur,
    handleSearchKeyDown
  };
}; 