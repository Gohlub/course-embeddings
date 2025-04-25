/**
 * Predefined colors for department visualization
 */
export const DEPARTMENT_COLORS = [
  '#e6194B', // Red
  '#3cb44b', // Green
  '#4363d8', // Blue
  '#f58231', // Orange
  '#911eb4', // Purple
  '#42d4f4', // Cyan
  '#f032e6', // Magenta
  '#bfef45', // Lime
  '#fabed4', // Pink
  '#469990', // Teal
  '#dcbeff', // Lavender
  '#9A6324', // Brown
  '#ffe119', // Yellow
  '#000075', // Navy
  '#808000', // Olive
  '#ffd8b1', // Apricot
  '#000000', // Black
  '#aaffc3', // Mint
  '#808080', // Gray
  '#ffffff', // White
  '#a9a9a9'  // Dark Gray
];

/**
 * Graph layout settings
 */
export const FORCE_ATLAS_SETTINGS = {
  iterations: 500, // More iterations for better settling
  settings: {
    scalingRatio: 300,    // Increased for more spread
    gravity: 5,         // Reduced gravity to allow spreading
    strongGravityMode: true, // Disabled to allow more natural spreading
    outboundAttractionDistribution: true,
    linLogMode: true,
    adjustSizes: true,
    barnesHutOptimize: true,
    slowDown: 0.05,        // Faster simulation
    preventOverlap: true,
    edgeWeightInfluence: 4, // Reduced to allow more natural spacing
    barnesHutTheta: 1
  }
};

/**
 * Noverlap settings to prevent node overlap
 */
export const NOVERLAP_SETTINGS = {
  margin: 500,     // Reduced from 1000 for more balanced spacing
  ratio: 1.5,      // Reduced from 2 for more natural spacing
  speed: 5,
  maxIterations: 300
};

/**
 * Sigma renderer settings
 */
export const SIGMA_SETTINGS = {
  labelSize: 12,
  labelColor: { color: '#228B22' },
  renderEdgeLabels: false,
  minCameraRatio: 0.1,
  maxCameraRatio: 10,
  defaultNodeType: 'circle',
  defaultEdgeType: 'line',
  labelDensity: 0.07,
  labelGridCellSize: 60,
  labelRenderedSizeThreshold: 6
}; 