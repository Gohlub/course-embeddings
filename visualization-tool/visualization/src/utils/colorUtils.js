import { DEPARTMENT_COLORS } from '../config/colors';

/**
 * Assigns colors to departments
 * @param {Array|Set} departments - Array or Set of department names
 * @returns {Object} - Object mapping department names to colors
 */
export const assignDepartmentColors = (departments) => {
  const departmentColors = {};
  const departmentList = Array.from(departments).sort(); // Sort for consistency
  
  departmentList.forEach((dept, i) => {
    departmentColors[dept] = DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length];
  });
  
  return departmentColors;
}; 