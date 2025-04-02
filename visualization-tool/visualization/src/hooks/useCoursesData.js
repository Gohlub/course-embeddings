import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { extractDepartment } from '../utils/graphUtils';

/**
 * Custom hook to load and process course data
 * @returns {Object} - Object containing course data, loading state, error state, and departments
 */
export const useCoursesData = () => {
  const [coursesData, setCoursesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState(new Set());

  useEffect(() => {
    // Load and parse the CSV file
    fetch('/courses.csv')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch courses data');
        }
        return response.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          complete: (results) => {
            setCoursesData(results.data);
            // Extract unique departments
            const depts = new Set(
              results.data
                .slice(1) // Skip header row
                .map(row => row[1]) // Get course code column
                .filter(code => code) // Remove empty codes
                .map(extractDepartment)
                .filter(dept => dept) // Remove null values
            );
            setDepartments(depts);
            setLoading(false);
          },
          error: (error) => {
            setError(error.message);
            setLoading(false);
          }
        });
      })
      .catch(error => {
        setError(error.message);
        setLoading(false);
      });
  }, []);

  return { coursesData, loading, error, departments };
}; 