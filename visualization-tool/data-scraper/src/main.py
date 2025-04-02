import requests
from bs4 import BeautifulSoup
import csv
import re

def main():
    print("Welcome to the Course Visualization Tool!")
    
    url = "https://curriculum.bennington.edu/spring2024/category/all-courses/"
    response = requests.get(url)
    
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all course entries based on the actual HTML structure
        headers = soup.find_all('header', class_='entry-header')
        
        if not headers:
            print("No course headers found. The page structure might have changed.")
            return
            
        print(f"Found {len(headers)} courses")
        
        # Create a CSV file to store the data
        with open('courses.csv', 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['Title', 'Course Code', 'URL', 'Faculty', 'Schedule', 'Delivery Method', 'Categories']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for header in headers:
                # Initialize course data dictionary
                course_data = {field: '' for field in fieldnames}
                
                # Extract course title and link from h1 with class entry-title
                title_element = header.find('h1', class_='entry-title')
                if title_element:
                    link_element = title_element.find('a')
                    if link_element:
                        full_title = link_element.text.strip()
                        course_url = link_element.get('href')
                        
                        # Extract course code using regex - typically in format (XXX1234.01)
                        course_code_match = re.search(r'\(([A-Z]{2,4}\d{4}\.\d{2}[^)]*)\)', full_title)
                        if course_code_match:
                            course_code = course_code_match.group(1).strip()
                            # Remove the course code and parentheses from the title
                            title = re.sub(r'\s*\([A-Z]{2,4}\d{4}\.\d{2}[^)]*\)\s*', '', full_title).strip()
                        else:
                            course_code = ""
                            title = full_title
                        
                        # Remove notes like "(cancelled X/X/XXXX)" or "(day/time updated as of X/X/XXXX)"
                        title = re.sub(r'\s*\((cancelled|day\/time updated|time updated as of|new course code|method)[^)]*\)\s*', '', title).strip()
                        
                        course_data['Title'] = title
                        course_data['Course Code'] = course_code
                        course_data['URL'] = course_url
                        print(f"Course: {title}")
                        print(f"  Code: {course_code}")
                        print(f"  URL: {course_url}")
                
                # Find the faculty div that follows this header
                faculty_element = header.find_next('div', class_='faculty')
                if faculty_element:
                    # Get the raw HTML content to better parse the structure
                    faculty_html = str(faculty_element)
                    
                    # Extract faculty name - it's usually before the first <br> tag
                    faculty_parts = faculty_html.split('<br/>')
                    if len(faculty_parts) > 0:
                        # Extract faculty from the first part (before first <br>)
                        faculty_soup = BeautifulSoup(faculty_parts[0], 'html.parser')
                        faculty = faculty_soup.get_text().strip()
                        course_data['Faculty'] = faculty
                        print(f"  Faculty: {faculty}")
                    
                    # Extract schedule - it's usually after the first <br> tag
                    schedule = None
                    if len(faculty_parts) > 1:
                        schedule_part = faculty_parts[1]
                        # Look for time pattern (e.g., "M/Th 10:00AM - 11:50AM")
                        schedule_match = re.search(r'[MTWFS][a-z]*(/[MTWFS][a-z]*)?\s+\d+:\d+[AP]M\s*-\s*\d+:\d+[AP]M', schedule_part)
                        if schedule_match:
                            # Extract the full schedule including term info
                            schedule_soup = BeautifulSoup(schedule_part, 'html.parser')
                            schedule = schedule_soup.get_text().strip()
                            course_data['Schedule'] = schedule
                            print(f"  Schedule: {schedule}")
                    
                    # Extract delivery method - it's usually after "Delivery Method:" text
                    delivery = None
                    delivery_match = re.search(r'Delivery Method:\s*([^<]+)', faculty_html)
                    if delivery_match:
                        delivery = f"Delivery Method: {delivery_match.group(1).strip()}"
                        course_data['Delivery Method'] = delivery
                        print(f"  {delivery}")
                
                # Find the entry-meta that follows this header
                meta_element = header.find_next('footer', class_='entry-meta')
                if meta_element:
                    categories = meta_element.find_all('a', rel='tag')
                    if categories:
                        category_names = [cat.text.strip() for cat in categories]
                        course_data['Categories'] = '; '.join(category_names)
                        print(f"  Categories: {', '.join(category_names)}")
                
                # Write the course data to CSV
                writer.writerow(course_data)
                print("---")
            
        print(f"\nTotal number of courses: {len(headers)}")
        print(f"Data has been saved to courses.csv")
    else:
        print(f"Failed to retrieve the page. Status code: {response.status_code}")

if __name__ == "__main__":
    main() 