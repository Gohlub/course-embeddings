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
 * @returns {Object} - The graph instance
 */
export const useGraphSetup = (coursesData, departments, departmentColors, setGraphReady) => {
  const graphRef = useRef(null);

  console.log('useGraphSetup called with:', {
    coursesDataLength: coursesData.length,
    departmentsSize: departments.size,
    departmentColorsKeys: Object.keys(departmentColors).length
  });

  useEffect(() => {
    console.log('useGraphSetup useEffect running with:', {
      coursesDataLength: coursesData.length,
      departmentsSize: departments.size,
      departmentColorsKeys: Object.keys(departmentColors).length
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
    
    // Edge creation with fixed department colors
    const nodes = graph.nodes();
    console.log(`Graph has ${nodes.length} nodes`);
    
    let edgesAdded = 0;
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
    console.log(`Added ${edgesAdded} edges to the graph`);
    
    // Apply layout algorithms
    console.log('Applying layout algorithms');
    random.assign(graph);
    forceAtlas2.assign(graph, FORCE_ATLAS_SETTINGS);
    noverlap.assign(graph, NOVERLAP_SETTINGS);
    console.log('Layout algorithms applied');

    console.log('Graph setup complete, nodes:', graph.nodes().length, 'edges:', graph.edges().length);
    
    // Set the graph reference AFTER all processing is done
    graphRef.current = graph;
    
    // Signal that the graph is ready
    if (setGraphReady) setGraphReady(true);

  }, [coursesData, departments, departmentColors, setGraphReady]);

  return graphRef;
}; 