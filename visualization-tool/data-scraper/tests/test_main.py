"""
Tests for the main module.
"""
import unittest
from src.main import main

class TestMain(unittest.TestCase):
    """Test cases for the main module."""
    
    def test_main_runs(self):
        """Test that the main function runs without errors."""
        # This is a simple test that just ensures the main function runs
        # without raising any exceptions
        try:
            main()
            success = True
        except Exception as e:
            success = False
            self.fail(f"main() raised {type(e).__name__} unexpectedly: {e}")
        
        self.assertTrue(success)

if __name__ == "__main__":
    unittest.main() 