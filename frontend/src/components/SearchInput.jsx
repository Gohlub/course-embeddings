import React, { memo } from 'react';

/**
 * Component for the search input
 */
const SearchInput = memo(({ 
  searchQuery, 
  handleSearchInput, 
  handleSearchSelect,
  handleSearchBlur, 
  handleSearchKeyDown,
  graph 
}) => {
  // Create datalist options once
  const options = graph ? 
    graph.nodes().map(node => (
      <option key={node} value={graph.getNodeAttribute(node, "label")} />
    )) : [];

  return (
    <div className="search-container" style={{ margin: '10px auto', width: '90%', maxWidth: '600px' }}>
      <input
        type="text"
        id="search-input"
        list="suggestions"
        placeholder="Search for a course..."
        value={searchQuery}
        onChange={handleSearchInput}
        onBlur={handleSearchBlur}
        onKeyDown={handleSearchKeyDown}
        // Handle selection from datalist
        onInput={(e) => {
          // Check if this is a selection event
          const isSelectionEvent = e.nativeEvent.inputType === 'insertReplacementText';
          if (isSelectionEvent) {
            // Use setTimeout to ensure the input value is updated
            setTimeout(handleSearchSelect, 0);
          }
        }}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc'
        }}
      />
      <datalist id="suggestions">
        {options}
      </datalist>
    </div>
  );
});

export default SearchInput; 