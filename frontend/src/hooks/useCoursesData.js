import { useState, useEffect } from 'react';

/**
 * Custom hook to load and process course data from the backend API
 * @returns {Object} - Object containing course data, loading state, error state, and departments
 */
export const useCoursesData = () => {
  const [coursesData, setCoursesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState(new Set());
  const [similarities, setSimilarities] = useState({});

  useEffect(() => {
    // Define the API endpoint URL
    const apiUrl = 'http://localhost:8001/api/graph-data';
    
    console.log('Fetching course data from API:', apiUrl);
    
    // Fetch data from the backend API
    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch courses data from API');
        }
        return response.json();
      })
      .then(data => {
        console.log('Received data from API:', {
          nodesCount: data.nodes.length,
          similaritiesCount: Object.keys(data.similarities).length,
          departmentsCount: data.departments.length
        });
        
        // Convert nodes to a format compatible with the existing code
        // This preserves backward compatibility with the existing implementation
        const formattedCourses = data.nodes.map(node => [
          node.name,          // course title (row[0])
          node.code,          // course code (row[1])
          "",                 // start date (row[2])
          "",                 // end date (row[3])
          "",                 // ... (other fields)
          "",                 // ... (other fields)
          "",                 // categories placeholder (row[6])
          node.faculty ? node.faculty.split(" ")[0] : "", // faculty first name (row[7])
          node.faculty ? node.faculty.split(" ").slice(1).join(" ") : "", // faculty last name (row[8])
          "",                 // ... (other fields)
          node.department,    // department (row[10])
          "",                 // delivery method (row[11])
          node.description    // description (row[12])
        ]);
        
        setCoursesData(formattedCourses);
        
        // Store the similarities data
        setSimilarities(data.similarities);
        
        // Set departments from the API response
        const deptSet = new Set(data.departments);
        setDepartments(deptSet);
        
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching course data:', error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  return { coursesData, loading, error, departments, similarities };
}; 