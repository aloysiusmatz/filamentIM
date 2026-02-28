#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FilamentVaultTester:
    def __init__(self, base_url="https://filament-vault-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.printer_id = None
        self.filament_id = None
        self.print_job_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_printer_crud(self):
        """Test complete printer CRUD operations"""
        print(f"\n{'='*50}")
        print("TESTING PRINTER CRUD OPERATIONS")
        print(f"{'='*50}")
        
        # Test GET printers (empty initially)
        success, printers = self.run_test(
            "GET Printers (Empty)",
            "GET", 
            "printers",
            200
        )
        if not success:
            return False
        
        # Test POST printer
        printer_data = {
            "name": "Test Ender 3 V2",
            "model": "Creality Ender 3 V2",
            "build_volume": "220x220x250",
            "notes": "Test printer for automated testing"
        }
        
        success, new_printer = self.run_test(
            "POST Printer (Create)",
            "POST",
            "printers", 
            200,
            data=printer_data
        )
        if not success:
            return False
        
        self.printer_id = new_printer.get('id')
        if not self.printer_id:
            print("❌ No printer ID returned from creation")
            return False
        print(f"   Created printer ID: {self.printer_id}")
        
        # Test GET printers (should have 1 now)
        success, printers = self.run_test(
            "GET Printers (After Create)",
            "GET",
            "printers",
            200  
        )
        if not success or len(printers) == 0:
            print("❌ Printer not found after creation")
            return False
        
        # Test PUT printer (update)
        update_data = {
            "name": "Updated Test Ender 3 V2",
            "notes": "Updated notes for testing"
        }
        
        success, updated_printer = self.run_test(
            "PUT Printer (Update)",
            "PUT",
            f"printers/{self.printer_id}",
            200,
            data=update_data
        )
        if not success:
            return False
        
        if updated_printer.get('name') != update_data['name']:
            print("❌ Printer name was not updated correctly")
            return False
        
        print("✅ All printer CRUD operations passed")
        return True

    def test_print_job_operations(self):
        """Test print job creation and editing"""
        print(f"\n{'='*50}")
        print("TESTING PRINT JOB OPERATIONS")
        print(f"{'='*50}")
        
        # First create a test filament
        filament_data = {
            "brand": "Test Brand",
            "filament_type": "PLA", 
            "color": "Red",
            "color_hex": "#FF0000",
            "weight_total": 1000.0,
            "weight_remaining": 1000.0,
            "cost": 25.0
        }
        
        success, new_filament = self.run_test(
            "POST Filament (For Print Job Test)",
            "POST",
            "filaments",
            200,
            data=filament_data
        )
        if not success:
            return False
        
        self.filament_id = new_filament.get('id')
        if not self.filament_id:
            print("❌ No filament ID returned")
            return False
        
        # Create print job with printer
        print_job_data = {
            "filament_id": self.filament_id,
            "project_name": "Test Benchy",
            "weight_used": 15.5,
            "duration_minutes": 120,
            "status": "in_progress",
            "printer_id": self.printer_id,
            "notes": "Test print job"
        }
        
        success, new_job = self.run_test(
            "POST Print Job (Create)",
            "POST",
            "print-jobs",
            200,
            data=print_job_data
        )
        if not success:
            return False
        
        self.print_job_id = new_job.get('id')
        if not self.print_job_id:
            print("❌ No print job ID returned")
            return False
        
        # Test editing print job (key feature!)
        job_update_data = {
            "status": "success",
            "duration_minutes": 135,
            "notes": "Print completed successfully"
        }
        
        success, updated_job = self.run_test(
            "PUT Print Job (Edit Status)",
            "PUT", 
            f"print-jobs/{self.print_job_id}",
            200,
            data=job_update_data
        )
        if not success:
            return False
        
        if updated_job.get('status') != 'success':
            print("❌ Print job status was not updated correctly")
            return False
        
        print("✅ All print job operations passed")
        return True

    def test_custom_options(self):
        """Test custom brands and types functionality"""
        print(f"\n{'='*50}")
        print("TESTING CUSTOM BRANDS/TYPES PERSISTENCE")  
        print(f"{'='*50}")
        
        # Test adding custom brand
        custom_brand_data = {"name": "My Custom Brand"}
        success, brand_response = self.run_test(
            "POST Custom Brand",
            "POST",
            "reference/custom-brands",
            200,
            data=custom_brand_data
        )
        if not success:
            return False
        
        # Test adding custom type
        custom_type_data = {"name": "My Custom PLA+"}  
        success, type_response = self.run_test(
            "POST Custom Type",
            "POST",
            "reference/custom-types",
            200,
            data=custom_type_data
        )
        if not success:
            return False
        
        # Test user options endpoint includes custom options
        success, user_options = self.run_test(
            "GET User Options (Custom Included)",
            "GET",
            "reference/user-options",
            200
        )
        if not success:
            return False
        
        brands = user_options.get('brands', [])
        types = user_options.get('types', [])
        
        if 'My Custom Brand' not in brands:
            print("❌ Custom brand not found in user options")
            return False
        
        if 'My Custom PLA+' not in types:
            print("❌ Custom type not found in user options")  
            return False
        
        print("✅ Custom options persistence working correctly")
        return True

    def test_existing_features(self):
        """Test that existing features still work"""
        print(f"\n{'='*50}")
        print("TESTING EXISTING FEATURES")
        print(f"{'='*50}")
        
        # Test dashboard stats
        success, stats = self.run_test(
            "GET Dashboard Stats",
            "GET", 
            "dashboard/stats",
            200
        )
        if not success:
            return False
        
        # Test alerts
        success, alerts = self.run_test(
            "GET Alerts",
            "GET",
            "alerts", 
            200
        )
        if not success:
            return False
        
        # Test filaments list  
        success, filaments = self.run_test(
            "GET Filaments",
            "GET",
            "filaments",
            200
        )
        if not success:
            return False
        
        # Test print jobs list
        success, jobs = self.run_test(
            "GET Print Jobs",
            "GET", 
            "print-jobs",
            200
        )
        if not success:
            return False
        
        print("✅ All existing features working")
        return True

    def cleanup(self):
        """Clean up test data"""
        print(f"\n{'='*50}")
        print("CLEANING UP TEST DATA")
        print(f"{'='*50}")
        
        # Delete test print job
        if self.print_job_id:
            self.run_test(
                "DELETE Print Job", 
                "DELETE",
                f"print-jobs/{self.print_job_id}",
                200
            )
        
        # Delete test filament
        if self.filament_id:
            self.run_test(
                "DELETE Filament",
                "DELETE", 
                f"filaments/{self.filament_id}",
                200
            )
        
        # Delete test printer
        if self.printer_id:
            self.run_test(
                "DELETE Printer",
                "DELETE",
                f"printers/{self.printer_id}",
                200  
            )

def main():
    """Main test execution"""
    print("🚀 Starting Filament Vault Backend API Tests")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    tester = FilamentVaultTester()
    
    # Login with test user
    if not tester.test_login("test@test.com", "test123"):
        print("❌ Login failed, cannot continue tests")
        return 1
    
    # Test new features
    tests_results = [
        tester.test_printer_crud(),
        tester.test_print_job_operations(), 
        tester.test_custom_options(),
        tester.test_existing_features()
    ]
    
    # Cleanup
    tester.cleanup()
    
    # Print final results
    print(f"\n{'='*60}")
    print("FINAL TEST RESULTS")
    print(f"{'='*60}")
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if all(tests_results):
        print("✅ ALL MAJOR FEATURE TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - See details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())