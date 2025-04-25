import { useRef, useEffect } from 'react';
import Graph from 'graphology';
import { random } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import { extractDepartment } from '../utils/graphUtils';
import { FORCE_ATLAS_SETTINGS, NOVERLAP_SETTINGS } from '../config/colors';

/**
 * Custom hook to set up and manage the graph
 * @param {Array} coursesData - The course data to visualize
 * @param {Set} departments - Set of unique departments
 * @param {Array} departmentColors - Array of colors for departments
 * @param {Function} setGraphReady - Callback to signal when graph is ready
 * @param {Object} similarities - Pairwise similarities between courses
 * @returns {Object} - The graph instance
 */
export const useGraphSetup = (coursesData, departments, departmentColors, setGraphReady, similarities = {}) => {
  const graphRef = useRef(null);

  console.log('useGraphSetup called with:', {
    coursesDataLength: coursesData.length,
    departmentsSize: departments.size,
    departmentColorsKeys: Object.keys(departmentColors).length,
    similaritiesAvailable: Object.keys(similarities).length > 0
  });

  useEffect(() => {
    console.log('useGraphSetup useEffect running with:', {
      coursesDataLength: coursesData.length,
      departmentsSize: departments.size,
      departmentColorsKeys: Object.keys(departmentColors).length,
      similaritiesAvailable: Object.keys(similarities).length > 0
    });

    if (!coursesData.length || !departments.size) {
      console.log('Skipping graph setup due to missing data');
      if (setGraphReady) setGraphReady(false);
      return;
    }

    console.log('Creating new graph');
    const graph = new Graph();
    
    // Process courses with fixed department colors
    let nodesAdded = 0;
    coursesData.forEach((row, index) => {
      if (row.length >= 7) {
        const courseTitle = row[0];
        const courseCode = row[1];
        const categoryText = row[6] || '';
        
        if (courseTitle && courseCode) {
          const nodeId = `course-${index}`;
          const categories = categoryText ? categoryText.split(';').map(cat => cat.trim()).filter(cat => cat) : [];
          const department = extractDepartment(courseCode);
          
          if (department) {
            // Add node to graph with consistent department color
            graph.addNode(nodeId, {
              label: courseTitle,
              code: courseCode,
              department: department,
              departmentLabel: department,
              size: 8,
              color: departmentColors[department] || '#8395a7',
              x: Math.random(),
              y: Math.random(),
              categories: categories,
              type: 'circle'
            });
            nodesAdded++;
          }
        }
      }
    });
    console.log(`Added ${nodesAdded} nodes to the graph`);
    
    // Edge creation based on similarities if available
    const nodes = graph.nodes();
    console.log(`Graph has ${nodes.length} nodes`);
    let edgesAdded = 0;
    
    if (Object.keys(similarities).length > 0) {
      console.log('Creating edges based on similarity data');
      
      // Set similarity threshold - don't create edges for very low similarities
      const similarityThreshold = 0.3; // Adjust this value as needed
      
      // Find min and max similarities for normalization
      let minSimilarity = 1.0;
      let maxSimilarity = 0.0;
      
      Object.values(similarities).forEach(sim => {
        if (sim > maxSimilarity) maxSimilarity = sim;
        if (sim < minSimilarity) minSimilarity = sim;
      });
      
      console.log(`Similarity range: ${minSimilarity} to ${maxSimilarity}`);
      
      // Function to normalize similarity to weight (higher similarity = higher weight)
      const normalizeWeight = (similarity) => {
        if (maxSimilarity === minSimilarity) return 1;
        // Scale to 1-20 range, with higher similarities getting higher weights
        return 1 + (similarity - minSimilarity) / (maxSimilarity - minSimilarity) * 19;
      };
      
      // Create edges based on similarities
      for (const key in similarities) {
        const similarity = similarities[key];
        
        // Only create edges for similarities above threshold
        if (similarity >= similarityThreshold) {
          const [nodeId1, nodeId2] = key.split(',');
          
          // Only add edge if both nodes exist
          if (graph.hasNode(nodeId1) && graph.hasNode(nodeId2)) {
            // Get departments for coloring
            const dept1 = graph.getNodeAttribute(nodeId1, 'department');
            const dept2 = graph.getNodeAttribute(nodeId2, 'department');
            
            // Calculate edge weight from similarity
            const weight = normalizeWeight(similarity);
            
            // Edge color depends on whether nodes are in same department
            const edgeColor = dept1 === dept2 
              ? departmentColors[dept1] + 'AA'  // Same department, semi-transparent
              : '#555555' + Math.floor(similarity * 255).toString(16).padStart(2, '0'); // Cross-department, transparency based on similarity
              
            // Add the edge
            graph.addEdge(nodeId1, nodeId2, {
              size: 0.3,
              weight: weight,
              color: edgeColor,
              similarity: similarity // Store the original similarity for reference
            });
            
            edgesAdded++;
          }
        }
      }
    } else {
      console.log('No similarity data available, creating edges based on categories');
      // Original edge creation code as fallback
      for (let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        const dept1 = graph.getNodeAttribute(node1, 'department');
        const categories1 = graph.getNodeAttribute(node1, 'categories');
        
        for (let j = i + 1; j < nodes.length; j++) {
          const node2 = nodes[j];
          const dept2 = graph.getNodeAttribute(node2, 'department');
          const categories2 = graph.getNodeAttribute(node2, 'categories');
          
          if (dept1 && dept2) {
            const sharedCategories = categories1.filter(cat => categories2.includes(cat));
            
            if (dept1 === dept2) {
              // Weaker intra-department edges to allow more internal spread
              graph.addEdge(node1, node2, {
                size: 0.3,
                weight: 10,  // Reduced from 10 to allow more spread in small clusters
                color: departmentColors[dept1] + '33'
              });
              edgesAdded++;
            } else if (sharedCategories.length > 0) {
              // Even weaker inter-department edges
              graph.addEdge(node1, node2, {
                size: 0.3,              // Keep a reasonable size
                weight: 0.1,
                color: '#33333333'      // Pale dark color with transparency
              });
              edgesAdded++;
            }
          }
        }
      }
    }
    
    console.log(`Added ${edgesAdded} edges to the graph`);
    
    // Apply layout algorithms
    console.log('Applying layout algorithms');
    random.assign(graph);
    
    // Customize ForceAtlas2 settings based on similarity data
    const forceAtlasConfig = { ...FORCE_ATLAS_SETTINGS };
    
    // If we have similarity data, adjust ForceAtlas2 settings to emphasize similarity-based positioning
    if (Object.keys(similarities).length > 0) {
      forceAtlasConfig.edgeWeightInfluence = 2.0; // Increase influence of edge weights (based on similarity)
      forceAtlasConfig.gravity = 0.1; // Reduce gravity to allow similar nodes to pull together
      forceAtlasConfig.scalingRatio = 2.0; // Adjust scaling
    }
    
    forceAtlas2.assign(graph, forceAtlasConfig);
    noverlap.assign(graph, NOVERLAP_SETTINGS);
    console.log('Layout algorithms applied');

    console.log('Graph setup complete, nodes:', graph.nodes().length, 'edges:', graph.edges().length);
    
    // Set the graph reference AFTER all processing is done
    graphRef.current = graph;
    
    // Signal that the graph is ready
    if (setGraphReady) setGraphReady(true);

  }, [coursesData, departments, departmentColors, similarities, setGraphReady]);

  return graphRef;
}; 