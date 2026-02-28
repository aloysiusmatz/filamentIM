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
        """Test complete printer CRUD operations including power_kwh field"""
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
        
        # Test POST printer with power_kwh field
        printer_data = {
            "name": "Test Ender 3 V2",
            "model": "Creality Ender 3 V2",
            "build_volume": "220x220x250",
            "power_kwh": 0.25,  # Test explicit power value
            "notes": "Test printer for automated testing"
        }
        
        success, new_printer = self.run_test(
            "POST Printer (Create with power_kwh)",
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
        
        # Check power_kwh field was set correctly
        if new_printer.get('power_kwh') != 0.25:
            print(f"❌ Power kWh not set correctly. Expected 0.25, got {new_printer.get('power_kwh')}")
            return False
        print(f"   Power consumption set correctly: {new_printer.get('power_kwh')} kW")
        
        # Test POST printer without power_kwh (should default to 0.2)
        printer_data_default = {
            "name": "Default Power Printer",
            "model": "Test Model"
        }
        
        success, default_printer = self.run_test(
            "POST Printer (Default power_kwh)",
            "POST",
            "printers", 
            200,
            data=printer_data_default
        )
        if not success:
            return False
        
        if default_printer.get('power_kwh') != 0.2:
            print(f"❌ Default power kWh incorrect. Expected 0.2, got {default_printer.get('power_kwh')}")
            return False
        print(f"   Default power consumption correct: {default_printer.get('power_kwh')} kW")
        
        # Clean up default printer
        self.run_test(
            "DELETE Default Printer",
            "DELETE",
            f"printers/{default_printer.get('id')}",
            200
        )
        
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
        
        # Test PUT printer (update power_kwh)
        update_data = {
            "name": "Updated Test Ender 3 V2",
            "power_kwh": 0.3,
            "notes": "Updated notes for testing"
        }
        
        success, updated_printer = self.run_test(
            "PUT Printer (Update with power_kwh)",
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
        
        if updated_printer.get('power_kwh') != 0.3:
            print(f"❌ Power kWh was not updated correctly. Expected 0.3, got {updated_printer.get('power_kwh')}")
            return False
        
        print("✅ All printer CRUD operations with power_kwh passed")
        return True

    def test_print_job_operations(self):
        """Test print job creation, cost estimation, and weight restoration on delete"""
        print(f"\n{'='*50}")
        print("TESTING PRINT JOB OPERATIONS WITH COST ESTIMATION")
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
        
        print(f"   Initial filament weight: {new_filament['weight_remaining']}g")
        
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
            "POST Print Job (Create with Cost Estimation)",
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
        
        # Check if cost estimation fields are present
        cost_fields = ["estimated_cost", "est_filament_cost", "est_electricity_cost"]
        for field in cost_fields:
            if field not in new_job:
                print(f"❌ Missing cost field {field} in print job")
                return False
            print(f"   {field}: {new_job[field]}")
        
        # Verify filament weight was reduced
        success, updated_filament = self.run_test(
            "GET Filament (After Print Job)",
            "GET",
            f"filaments",  # Get all filaments, find ours
            200
        )
        if not success:
            return False
        
        # Find our specific filament
        our_filament = None
        for f in updated_filament:
            if f['id'] == self.filament_id:
                our_filament = f
                break
        
        if not our_filament:
            print("❌ Could not find our test filament")
            return False
        
        expected_weight = 1000.0 - 15.5  # Original - used
        if our_filament['weight_remaining'] != expected_weight:
            print(f"❌ Filament weight not reduced correctly. Expected {expected_weight}, got {our_filament['weight_remaining']}")
            return False
        
        print(f"   Filament weight after print: {our_filament['weight_remaining']}g")
        
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
        
        # Test DELETE print job - should restore filament weight
        weight_before_delete = our_filament['weight_remaining']
        
        success, delete_response = self.run_test(
            "DELETE Print Job (Should Restore Weight)",
            "DELETE",
            f"print-jobs/{self.print_job_id}",
            200
        )
        if not success:
            return False
        
        # Check if weight_restored is in response
        if 'weight_restored' not in delete_response:
            print("❌ weight_restored field missing from delete response")
            return False
        
        if delete_response['weight_restored'] != 15.5:
            print(f"❌ Incorrect weight_restored value. Expected 15.5, got {delete_response['weight_restored']}")
            return False
        
        print(f"   Weight restored on delete: {delete_response['weight_restored']}g")
        
        # Verify filament weight was actually restored
        success, restored_filaments = self.run_test(
            "GET Filament (After Delete - Weight Restored)",
            "GET",
            f"filaments",
            200
        )
        if not success:
            return False
        
        # Find our filament again
        restored_filament = None
        for f in restored_filaments:
            if f['id'] == self.filament_id:
                restored_filament = f
                break
        
        if not restored_filament:
            print("❌ Could not find filament after delete")
            return False
        
        expected_restored_weight = min(1000.0, weight_before_delete + 15.5)  # Should be back to 1000
        if restored_filament['weight_remaining'] != expected_restored_weight:
            print(f"❌ Filament weight not restored correctly. Expected {expected_restored_weight}, got {restored_filament['weight_remaining']}")
            return False
        
        print(f"   Filament weight after delete: {restored_filament['weight_remaining']}g")
        
        # Clear the print job ID since we deleted it
        self.print_job_id = None
        
        print("✅ All print job operations with cost estimation and weight restoration passed")
        return True

    def test_user_preferences(self):
        """Test user preferences functionality"""
        print(f"\n{'='*50}")
        print("TESTING USER PREFERENCES")
        print(f"{'='*50}")
        
        # Test GET preferences (should return defaults if none set)
        success, prefs = self.run_test(
            "GET User Preferences (Initial)",
            "GET",
            "user/preferences",
            200
        )
        if not success:
            return False
        
        # Check default values
        expected_defaults = {
            "country": "US",
            "currency": "USD", 
            "currency_symbol": "$",
            "electricity_rate": 0.12
        }
        
        for key, expected_value in expected_defaults.items():
            if prefs.get(key) != expected_value:
                print(f"❌ Default {key} incorrect. Expected {expected_value}, got {prefs.get(key)}")
                return False
        print("   Default preferences correct")
        
        # Test PUT preferences (update)
        update_prefs = {
            "country": "DE",
            "currency": "EUR",
            "currency_symbol": "€", 
            "electricity_rate": 0.35
        }
        
        success, updated_prefs = self.run_test(
            "PUT User Preferences (Update)",
            "PUT",
            "user/preferences",
            200,
            data=update_prefs
        )
        if not success:
            return False
        
        # Verify preferences were updated
        for key, expected_value in update_prefs.items():
            if updated_prefs.get(key) != expected_value:
                print(f"❌ Updated {key} incorrect. Expected {expected_value}, got {updated_prefs.get(key)}")
                return False
        print("   Preferences updated correctly")
        
        # Test GET preferences again to verify persistence
        success, persisted_prefs = self.run_test(
            "GET User Preferences (After Update)",
            "GET", 
            "user/preferences",
            200
        )
        if not success:
            return False
        
        for key, expected_value in update_prefs.items():
            if persisted_prefs.get(key) != expected_value:
                print(f"❌ Persisted {key} incorrect. Expected {expected_value}, got {persisted_prefs.get(key)}")
                return False
        
        print("✅ User preferences functionality working correctly")
        return True
    
    def test_calculator(self):
        """Test cost calculator functionality"""
        print(f"\n{'='*50}")
        print("TESTING COST CALCULATOR")
        print(f"{'='*50}")
        
        # Test calculator estimate
        calc_data = {
            "weight_grams": 50.0,
            "filament_cost_per_kg": 25.0,
            "printer_power_kw": 0.2,
            "duration_minutes": 120.0,
            "electricity_rate": 0.12
        }
        
        success, calc_result = self.run_test(
            "POST Calculator Estimate",
            "POST",
            "calculator/estimate",
            200,
            data=calc_data
        )
        if not success:
            return False
        
        # Verify calculation fields exist
        required_fields = ["filament_cost", "electricity_cost", "total_cost", "cost_per_gram"]
        for field in required_fields:
            if field not in calc_result:
                print(f"❌ Missing field {field} in calculator result")
                return False
        
        # Verify calculation correctness
        expected_filament_cost = 50.0 * (25.0 / 1000)  # 50g * $25/kg
        expected_electricity_cost = 0.2 * (120.0 / 60) * 0.12  # 0.2kW * 2h * $0.12/kWh
        expected_total = expected_filament_cost + expected_electricity_cost
        
        tolerance = 0.01  # Allow small floating point differences
        
        if abs(calc_result["filament_cost"] - expected_filament_cost) > tolerance:
            print(f"❌ Filament cost calculation incorrect. Expected {expected_filament_cost}, got {calc_result['filament_cost']}")
            return False
        
        if abs(calc_result["electricity_cost"] - expected_electricity_cost) > tolerance:
            print(f"❌ Electricity cost calculation incorrect. Expected {expected_electricity_cost}, got {calc_result['electricity_cost']}")
            return False
        
        if abs(calc_result["total_cost"] - expected_total) > tolerance:
            print(f"❌ Total cost calculation incorrect. Expected {expected_total}, got {calc_result['total_cost']}")
            return False
        
        print(f"   Filament cost: ${calc_result['filament_cost']:.4f}")
        print(f"   Electricity cost: ${calc_result['electricity_cost']:.4f}")  
        print(f"   Total cost: ${calc_result['total_cost']:.4f}")
        
        print("✅ Cost calculator working correctly")
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