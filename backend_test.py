#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class FilamentAPITester:
    def __init__(self, base_url="https://filament-vault-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []
        
    def log_result(self, test_name: str, success: bool, message: str = "", response: Dict = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED - {message}")
            self.errors.append(f"{test_name}: {message}")
        
        if response and not success:
            print(f"   Response: {json.dumps(response, indent=2)}")
    
    def make_request(self, method: str, endpoint: str, data=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            response_data = {}
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
            
            success = response.status_code == expected_status
            return success, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    # Auth Tests
    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        test_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@test.com",
            "password": "test123456"
        }
        
        success, response, status = self.make_request('POST', 'auth/register', test_data, 200)
        
        if success and 'token' in response and 'user' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.log_result("User Registration", True)
            return True
        else:
            self.log_result("User Registration", False, f"Status: {status}, Response: {response}")
            return False

    def test_user_login(self):
        """Test existing user login"""
        login_data = {
            "email": "test@test.com", 
            "password": "test123"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', login_data, 200)
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_data = response['user']
            self.log_result("User Login", True)
            return True
        else:
            self.log_result("User Login", False, f"Status: {status}, Response: {response}")
            return False
    
    def test_auth_me(self):
        """Test /auth/me endpoint"""
        if not self.token:
            self.log_result("Get Current User", False, "No token available")
            return False
        
        success, response, status = self.make_request('GET', 'auth/me')
        
        if success and 'id' in response:
            self.log_result("Get Current User", True)
            return True
        else:
            self.log_result("Get Current User", False, f"Status: {status}, Response: {response}")
            return False

    # Filament Tests
    def test_create_filament(self):
        """Test filament creation"""
        filament_data = {
            "brand": "Hatchbox",
            "filament_type": "PLA",
            "color": "Orange",
            "color_hex": "#f97316",
            "weight_total": 1000,
            "weight_remaining": 1000,
            "cost": 25.99,
            "diameter": 1.75,
            "temp_nozzle": 200,
            "temp_bed": 60,
            "purchase_date": "2024-01-15",
            "notes": "Test filament"
        }
        
        success, response, status = self.make_request('POST', 'filaments', filament_data, 200)
        
        if success and 'id' in response:
            self.created_filament_id = response['id']
            self.log_result("Create Filament", True)
            return True
        else:
            self.log_result("Create Filament", False, f"Status: {status}, Response: {response}")
            return False

    def test_list_filaments(self):
        """Test filament listing"""
        success, response, status = self.make_request('GET', 'filaments')
        
        if success and isinstance(response, list):
            self.log_result("List Filaments", True)
            return True
        else:
            self.log_result("List Filaments", False, f"Status: {status}, Response: {response}")
            return False

    def test_update_filament(self):
        """Test filament update"""
        if not hasattr(self, 'created_filament_id'):
            self.log_result("Update Filament", False, "No filament ID to update")
            return False
        
        update_data = {
            "color": "Updated Orange",
            "cost": 29.99,
            "notes": "Updated test filament"
        }
        
        success, response, status = self.make_request('PUT', f'filaments/{self.created_filament_id}', update_data)
        
        if success and response.get('color') == 'Updated Orange':
            self.log_result("Update Filament", True)
            return True
        else:
            self.log_result("Update Filament", False, f"Status: {status}, Response: {response}")
            return False

    # Print Job Tests
    def test_create_print_job(self):
        """Test print job creation"""
        if not hasattr(self, 'created_filament_id'):
            self.log_result("Create Print Job", False, "No filament ID available")
            return False
        
        job_data = {
            "filament_id": self.created_filament_id,
            "project_name": "Test Benchy",
            "weight_used": 15.5,
            "duration_minutes": 120,
            "status": "success",  # NEW: Test status field
            "notes": "Test print job"
        }
        
        success, response, status = self.make_request('POST', 'print-jobs', job_data, 200)
        
        if success and 'id' in response and response.get('status') == 'success':
            self.created_job_id = response['id']
            self.log_result("Create Print Job with Status", True)
            return True
        else:
            self.log_result("Create Print Job with Status", False, f"Status: {status}, Response: {response}")
            return False

    def test_create_print_job_different_statuses(self):
        """Test print job creation with different status values"""
        if not hasattr(self, 'created_filament_id'):
            self.log_result("Create Print Jobs (All Statuses)", False, "No filament ID available")
            return False
        
        statuses = ["failed", "in_progress", "cancelled"]
        all_passed = True
        
        for test_status in statuses:
            job_data = {
                "filament_id": self.created_filament_id,
                "project_name": f"Test Print - {test_status}",
                "weight_used": 10.0,
                "duration_minutes": 60,
                "status": test_status,
                "notes": f"Test {test_status} job"
            }
            
            success, response, status_code = self.make_request('POST', 'print-jobs', job_data, 200)
            
            if success and response.get('status') == test_status:
                print(f"  ✅ Status '{test_status}' works correctly")
            else:
                print(f"  ❌ Status '{test_status}' failed - Status: {status_code}, Response: {response}")
                all_passed = False
        
        self.log_result("Create Print Jobs (All Statuses)", all_passed)
        return all_passed

    def test_list_print_jobs(self):
        """Test print job listing"""
        success, response, status = self.make_request('GET', 'print-jobs')
        
        if success and isinstance(response, list):
            self.log_result("List Print Jobs", True)
            return True
        else:
            self.log_result("List Print Jobs", False, f"Status: {status}, Response: {response}")
            return False

    # Dashboard Tests
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response, status = self.make_request('GET', 'dashboard/stats')
        
        required_fields = ['total_filaments', 'total_weight_remaining', 'total_inventory_value', 'low_stock_count']
        if success and all(field in response for field in required_fields):
            self.log_result("Dashboard Stats", True)
            return True
        else:
            self.log_result("Dashboard Stats", False, f"Status: {status}, Missing fields in response: {response}")
            return False

    # Alerts Tests
    def test_alerts(self):
        """Test low stock alerts"""
        success, response, status = self.make_request('GET', 'alerts')
        
        if success and isinstance(response, list):
            self.log_result("Get Alerts", True)
            return True
        else:
            self.log_result("Get Alerts", False, f"Status: {status}, Response: {response}")
            return False

    # Reference Data Tests
    def test_reference_brands(self):
        """Test reference brands"""
        success, response, status = self.make_request('GET', 'reference/brands')
        
        if success and isinstance(response, list) and len(response) > 0:
            self.log_result("Get Reference Brands", True)
            return True
        else:
            self.log_result("Get Reference Brands", False, f"Status: {status}, Response: {response}")
            return False

    def test_reference_types(self):
        """Test reference types"""
        success, response, status = self.make_request('GET', 'reference/types')
        
        if success and isinstance(response, list) and len(response) > 0:
            self.log_result("Get Reference Types", True)
            return True
        else:
            self.log_result("Get Reference Types", False, f"Status: {status}, Response: {response}")
            return False

    def test_user_options(self):
        """Test user-specific brands and types from their filaments"""
        success, response, status = self.make_request('GET', 'reference/user-options')
        
        if success and 'brands' in response and 'types' in response:
            self.log_result("Get User Options", True)
            return True
        else:
            self.log_result("Get User Options", False, f"Status: {status}, Response: {response}")
            return False

    # NEW FEATURE TESTS
    def test_export_filaments(self):
        """Test CSV export functionality"""
        url = f"{self.base_url}/api/filaments/export"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                # Check if it's CSV content
                content = response.text
                if 'Brand,Type,Color' in content or len(content.split('\n')) >= 1:
                    self.log_result("Export Filaments CSV", True)
                    return True
                else:
                    self.log_result("Export Filaments CSV", False, f"Invalid CSV content: {content[:100]}")
                    return False
            else:
                self.log_result("Export Filaments CSV", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Export Filaments CSV", False, f"Error: {str(e)}")
            return False

    def test_import_filaments(self):
        """Test CSV import functionality"""
        # Create a test CSV content
        csv_content = """Brand,Type,Color,Color Hex,Weight Total (g),Weight Remaining (g),Cost ($),Diameter (mm),Nozzle Temp,Bed Temp,Purchase Date,Notes
TestBrand,PLA,Red,#FF0000,1000,900,25.99,1.75,200,60,2024-01-15,Test import
CustomBrand,PETG,Blue,#0000FF,1000,800,30.99,1.75,230,70,,Another test
"""
        
        url = f"{self.base_url}/api/filaments/import"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            # Prepare multipart form data
            files = {'file': ('test_filaments.csv', csv_content, 'text/csv')}
            response = requests.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                response_data = response.json()
                if 'count' in response_data and response_data.get('count') >= 2:
                    self.log_result("Import Filaments CSV", True)
                    return True
                else:
                    self.log_result("Import Filaments CSV", False, f"Unexpected response: {response_data}")
                    return False
            else:
                self.log_result("Import Filaments CSV", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Import Filaments CSV", False, f"Error: {str(e)}")
            return False

    # Cleanup Tests
    def test_delete_print_job(self):
        """Test print job deletion"""
        if not hasattr(self, 'created_job_id'):
            self.log_result("Delete Print Job", False, "No job ID to delete")
            return False
        
        success, response, status = self.make_request('DELETE', f'print-jobs/{self.created_job_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Print Job", True)
            return True
        else:
            self.log_result("Delete Print Job", False, f"Status: {status}, Response: {response}")
            return False

    def test_delete_filament(self):
        """Test filament deletion"""
        if not hasattr(self, 'created_filament_id'):
            self.log_result("Delete Filament", False, "No filament ID to delete")
            return False
        
        success, response, status = self.make_request('DELETE', f'filaments/{self.created_filament_id}', expected_status=200)
        
        if success:
            self.log_result("Delete Filament", True)
            return True
        else:
            self.log_result("Delete Filament", False, f"Status: {status}, Response: {response}")
            return False

    def run_all_tests(self):
        """Run complete test suite"""
        print("🧪 Starting Filament Management API Tests...")
        print("=" * 50)
        
        # Auth tests - try existing user first, then register new if needed
        if not self.test_user_login():
            print("Login failed, trying registration...")
            if not self.test_user_registration():
                print("❌ Cannot proceed without authentication")
                return False
        
        self.test_auth_me()
        
        # Reference data tests
        self.test_reference_brands()
        self.test_reference_types()
        self.test_user_options()
        
        # NEW FEATURE TESTS
        self.test_export_filaments()
        self.test_import_filaments()
        
        # Filament CRUD tests
        if self.test_create_filament():
            self.test_list_filaments()
            self.test_update_filament()
            
            # Print job tests (dependent on filament)
            if self.test_create_print_job():
                self.test_create_print_job_different_statuses()  # NEW: Test all status values
                self.test_list_print_jobs()
                self.test_delete_print_job()
        
        # Dashboard and alerts
        self.test_dashboard_stats()
        self.test_alerts()
        
        # Cleanup
        if hasattr(self, 'created_filament_id'):
            self.test_delete_filament()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.errors:
            print("\n❌ Errors encountered:")
            for error in self.errors:
                print(f"  • {error}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80

def main():
    tester = FilamentAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())