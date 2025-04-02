import { useRef, useEffect, useState, useMemo } from 'react'
import './App.css'
import { useCoursesData } from './hooks/useCoursesData'
import { useGraphSetup } from './hooks/useGraphSetup'
import { useSearch } from './hooks/useSearch'
import { assignDepartmentColors } from './utils/colorUtils'
import GraphVisualization from './components/GraphVisualization'
import SearchInput from './components/SearchInput'

function App() {
  // Load course data
  const { coursesData, loading, error, departments } = useCoursesData();
  
  // Debug data loading
  console.log('coursesData length:', coursesData.length);
  console.log('departments:', departments);
  console.log('loading:', loading);
  console.log('error:', error);
  
  // Create department colors
  const departmentColors = useMemo(() => {
    return departments.size > 0 ? assignDepartmentColors(departments) : {};
  }, [departments]);
  console.log('departmentColors:', departmentColors);
  
  // Set up refs for hover/selection to avoid re-renders
  const hoveredNodeRef = useRef(null);
  const hoveredNeighborsRef = useRef(null);
  const sigmaRef = useRef(null);
  
  // Add state to track when graph is ready
  const [graphReady, setGraphReady] = useState(false);
  
  // Set up graph
  const graphRef = useGraphSetup(coursesData, departments, departmentColors, setGraphReady);
  console.log('graph nodes:', graphRef.current ? graphRef.current.nodes().length : 0);
  console.log('graph ready:', graphReady);
  
  // Set up search functionality
  const { 
    searchQuery, 
    selectedNodeRef, 
    handleSearchInput, 
    handleSearchSelect,
    handleSearchBlur,
    handleSearchKeyDown
  } = useSearch(graphRef.current, sigmaRef.current);

  // Debug UI rendering
  useEffect(() => {
    console.log('App rendered, sigma instance:', sigmaRef.current);
    console.log('Graph reference:', graphRef.current ? 'Graph exists' : 'No graph');
    if (graphRef.current) {
      console.log('Graph nodes:', graphRef.current.nodes().length);
    }
  }, [graphRef.current, sigmaRef.current, graphReady]);

  if (loading) return <div className="loading">Loading courses data...</div>
  if (error) return <div className="error">Error: {error}</div>

  return (
    <div className="app-container">
      <h1>Bennington College Courses Visualization</h1>
      <p>Courses are connected when their departments share categories</p>
      
      <SearchInput 
        searchQuery={searchQuery}
        handleSearchInput={handleSearchInput}
        handleSearchSelect={handleSearchSelect}
        handleSearchBlur={handleSearchBlur}
        handleSearchKeyDown={handleSearchKeyDown}
        graph={graphRef.current}
      />
      
      {graphReady && graphRef.current ? (
        <GraphVisualization 
          graph={graphRef.current}
          departmentColors={departmentColors}
          hoveredNodeRef={hoveredNodeRef}
          hoveredNeighborsRef={hoveredNeighborsRef}
          selectedNodeRef={selectedNodeRef}
          sigmaRef={sigmaRef}
        />
      ) : (
        <div className="loading">Preparing graph visualization...</div>
      )}
    </div>
  )
}

export default App
