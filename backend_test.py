#!/usr/bin/env python3
"""
Backend API Test Suite for OnwardTicket MVP - Tracking Increment
Tests new tracking endpoint and existing APIs for regressions
"""

import requests
import json
import time
import concurrent.futures
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://onward-booking.preview.emergentagent.com/api"
ADMIN_PASSWORD = "admin123"

# Test results tracking
test_results = []
test_counter = 0

def log_test(description, passed, details=""):
    """Log test result"""
    global test_counter
    test_counter += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"Test {test_counter}: {status} - {description}"
    if details:
        result += f"\n  Details: {details}"
    print(result)
    test_results.append({
        "test": test_counter,
        "description": description,
        "passed": passed,
        "details": details
    })

def print_summary():
    """Print test summary"""
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    print("\n" + "="*80)
    print(f"TEST SUMMARY: {passed}/{total} passed, {failed} failed")
    print("="*80)
    if failed > 0:
        print("\nFailed tests:")
        for r in test_results:
            if not r["passed"]:
                print(f"  - Test {r['test']}: {r['description']}")
                if r["details"]:
                    print(f"    {r['details']}")

# Global variables for test data
admin_token = None
disposable_bookings = []  # Track disposable test bookings for cleanup

try:
    print("="*80)
    print("ONWARDTICKET BACKEND API TEST SUITE - TRACKING INCREMENT")
    print("="*80)
    print(f"Base URL: {BASE_URL}\n")

    # ========================================================================
    # REGRESSION TESTS - Existing APIs
    # ========================================================================
    
    print("\n" + "="*80)
    print("REGRESSION TESTS - Existing APIs")
    print("="*80)

    # Test: Airport autocomplete
    print("\n--- Airport Autocomplete ---")
    try:
        response = requests.get(f"{BASE_URL}/airports?q=DXB", timeout=10)
        data = response.json()
        passed = (response.status_code == 200 and 
                 isinstance(data, list) and 
                 len(data) > 0 and
                 any('DXB' in str(airport.get('iata', '')) for airport in data))
        details = f"Status: {response.status_code}, Found {len(data)} airports"
        log_test("Airport autocomplete - DXB", passed, details)
    except Exception as e:
        log_test("Airport autocomplete - DXB", False, str(e))

    # Test: Admin authentication
    print("\n--- Admin Authentication ---")
    try:
        payload = {"password": ADMIN_PASSWORD}
        response = requests.post(f"{BASE_URL}/admin/login", json=payload, timeout=10)
        data = response.json()
        passed = (response.status_code == 200 and 'token' in data)
        if passed:
            admin_token = data['token']
            details = f"Status: {response.status_code}, Token received"
        else:
            details = f"Status: {response.status_code}, Response: {data}"
        log_test("Admin login with correct password", passed, details)
    except Exception as e:
        log_test("Admin login with correct password", False, str(e))

    # ========================================================================
    # TRACKING API TESTS - Primary Focus
    # ========================================================================
    
    print("\n" + "="*80)
    print("TRACKING API TESTS - Primary Focus")
    print("="*80)

    # Create disposable test bookings for tracking tests
    print("\n--- Creating Disposable Test Bookings ---")
    
    # Booking 1: For full lifecycle test (PENDING -> PAID -> COMPLETED)
    try:
        future_date = (datetime.now() + timedelta(days=20)).strftime('%Y-%m-%d')
        payload = {
            "tripType": "ONE_WAY",
            "originIata": "DXB",
            "destinationIata": "LHR",
            "departureDate": future_date,
            "adults": 1,
            "contact": {
                "email": "alice.williams@example.com",
                "phone": "+971501234567",
                "firstName": "Alice",
                "lastName": "Williams"
            },
            "passengers": [
                {
                    "firstName": "Alice",
                    "lastName": "Williams",
                    "dateOfBirth": "1988-05-12",
                    "passportNumber": "P9876543",
                    "nationality": "GB"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/bookings", json=payload, timeout=10)
        data = response.json()
        if response.status_code == 200:
            booking1 = {
                'id': data['id'],
                'reference': data['referenceCode'],
                'purpose': 'lifecycle_test'
            }
            disposable_bookings.append(booking1)
            print(f"✓ Created booking 1: {booking1['reference']} (lifecycle test)")
        else:
            print(f"✗ Failed to create booking 1: {response.status_code}")
    except Exception as e:
        print(f"✗ Error creating booking 1: {str(e)}")

    # Booking 2: For cancellation test
    try:
        future_date = (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d')
        payload = {
            "tripType": "ROUND_TRIP",
            "originIata": "JFK",
            "destinationIata": "LAX",
            "departureDate": future_date,
            "returnDate": (datetime.now() + timedelta(days=22)).strftime('%Y-%m-%d'),
            "adults": 1,
            "contact": {
                "email": "bob.martinez@example.com",
                "phone": "+12125551234",
                "firstName": "Bob",
                "lastName": "Martinez"
            },
            "passengers": [
                {
                    "firstName": "Bob",
                    "lastName": "Martinez",
                    "dateOfBirth": "1992-08-20",
                    "passportNumber": "US7654321",
                    "nationality": "US"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/bookings", json=payload, timeout=10)
        data = response.json()
        if response.status_code == 200:
            booking2 = {
                'id': data['id'],
                'reference': data['referenceCode'],
                'purpose': 'cancellation_test'
            }
            disposable_bookings.append(booking2)
            print(f"✓ Created booking 2: {booking2['reference']} (cancellation test)")
        else:
            print(f"✗ Failed to create booking 2: {response.status_code}")
    except Exception as e:
        print(f"✗ Error creating booking 2: {str(e)}")

    # Booking 3: For concurrent lookup test
    try:
        future_date = (datetime.now() + timedelta(days=10)).strftime('%Y-%m-%d')
        payload = {
            "tripType": "ONE_WAY",
            "originIata": "SIN",
            "destinationIata": "BKK",
            "departureDate": future_date,
            "adults": 1,
            "contact": {
                "email": "charlie.chen@example.com",
                "phone": "+6591234567",
                "firstName": "Charlie",
                "lastName": "Chen"
            },
            "passengers": [
                {
                    "firstName": "Charlie",
                    "lastName": "Chen",
                    "dateOfBirth": "1995-03-10",
                    "passportNumber": "SG9988776",
                    "nationality": "SG"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/bookings", json=payload, timeout=10)
        data = response.json()
        if response.status_code == 200:
            booking3 = {
                'id': data['id'],
                'reference': data['referenceCode'],
                'purpose': 'concurrent_test'
            }
            disposable_bookings.append(booking3)
            print(f"✓ Created booking 3: {booking3['reference']} (concurrent test)")
        else:
            print(f"✗ Failed to create booking 3: {response.status_code}")
    except Exception as e:
        print(f"✗ Error creating booking 3: {str(e)}")

    print(f"\nTotal disposable bookings created: {len(disposable_bookings)}")

    # Test: Tracking - PENDING status (initial state)
    print("\n--- Tracking API - Basic Functionality ---")
    if len(disposable_bookings) > 0:
        booking1 = disposable_bookings[0]
        try:
            response = requests.get(f"{BASE_URL}/tracking?reference={booking1['reference']}", timeout=10)
            data = response.json()
            
            # Check status code and basic structure
            passed = (response.status_code == 200 and
                     data.get('referenceCode') == booking1['reference'] and
                     data.get('paymentStatus') == 'PENDING' and
                     data.get('fulfillmentStatus') == 'UNFULFILLED')
            
            # Check Cache-Control header
            cache_control = response.headers.get('Cache-Control', '')
            has_no_store = 'no-store' in cache_control and 'private' in cache_control
            
            # Check ONLY allowlisted fields present
            allowed_fields = {'referenceCode', 'paymentStatus', 'fulfillmentStatus', 'updatedAt', 'fulfilledAt', 'mockPayment'}
            actual_fields = set(data.keys())
            only_allowed = actual_fields.issubset(allowed_fields)
            
            # Check NO sensitive fields
            sensitive_fields = ['contact', 'passengers', 'email', 'phone', 'firstName', 'lastName', 
                              'pnrCode', 'airlineName', 'eTicketNumber', 'adminNotes', 'id', 
                              'stripeSessionId', 'paymentIntentId', '_id', 'totalAmount', 
                              'originIata', 'destinationIata']
            no_sensitive = not any(field in data for field in sensitive_fields)
            
            passed = passed and has_no_store and only_allowed and no_sensitive
            
            details = f"Status: {response.status_code}, Payment: {data.get('paymentStatus')}, "
            details += f"Fulfillment: {data.get('fulfillmentStatus')}, "
            details += f"Cache-Control: {cache_control}, "
            details += f"Fields: {list(data.keys())}, "
            details += f"Only allowed: {only_allowed}, No sensitive: {no_sensitive}"
            
            log_test("Tracking - PENDING status with allowlisted fields only", passed, details)
        except Exception as e:
            log_test("Tracking - PENDING status with allowlisted fields only", False, str(e))
    else:
        log_test("Tracking - PENDING status with allowlisted fields only", False, "No test booking created")

    # Test: Tracking - Format validation (lowercase normalization)
    if len(disposable_bookings) > 0:
        booking1 = disposable_bookings[0]
        try:
            lowercase_ref = booking1['reference'].lower()
            response = requests.get(f"{BASE_URL}/tracking?reference={lowercase_ref}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('referenceCode') == booking1['reference'])
            details = f"Input: {lowercase_ref}, Output: {data.get('referenceCode')}, Normalized: {passed}"
            log_test("Tracking - Lowercase reference normalized to uppercase", passed, details)
        except Exception as e:
            log_test("Tracking - Lowercase reference normalized to uppercase", False, str(e))
    else:
        log_test("Tracking - Lowercase reference normalized to uppercase", False, "No test booking")

    # Test: Tracking - Format validation (whitespace trimming)
    if len(disposable_bookings) > 0:
        booking1 = disposable_bookings[0]
        try:
            padded_ref = f"  {booking1['reference']}  "
            response = requests.get(f"{BASE_URL}/tracking?reference={padded_ref}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('referenceCode') == booking1['reference'])
            details = f"Input: '{padded_ref}', Output: {data.get('referenceCode')}, Trimmed: {passed}"
            log_test("Tracking - Whitespace trimmed from reference", passed, details)
        except Exception as e:
            log_test("Tracking - Whitespace trimmed from reference", False, str(e))
    else:
        log_test("Tracking - Whitespace trimmed from reference", False, "No test booking")

    # Test: Tracking - Missing reference
    try:
        response = requests.get(f"{BASE_URL}/tracking", timeout=10)
        data = response.json()
        passed = response.status_code == 400
        cache_control = response.headers.get('Cache-Control', '')
        has_no_store = 'no-store' in cache_control
        passed = passed and has_no_store
        details = f"Status: {response.status_code}, Cache-Control: {cache_control}, Error: {data.get('error', 'N/A')}"
        log_test("Tracking - Missing reference returns 400 with no-store", passed, details)
    except Exception as e:
        log_test("Tracking - Missing reference returns 400 with no-store", False, str(e))

    # Test: Tracking - Malformed reference (wrong format)
    try:
        response = requests.get(f"{BASE_URL}/tracking?reference=INVALID123", timeout=10)
        data = response.json()
        passed = response.status_code == 400
        cache_control = response.headers.get('Cache-Control', '')
        has_no_store = 'no-store' in cache_control
        passed = passed and has_no_store
        details = f"Status: {response.status_code}, Cache-Control: {cache_control}, Error: {data.get('error', 'N/A')}"
        log_test("Tracking - Malformed reference returns 400 with no-store", passed, details)
    except Exception as e:
        log_test("Tracking - Malformed reference returns 400 with no-store", False, str(e))

    # Test: Tracking - Long reference
    try:
        long_ref = "DT-2026-ABCD" + "X" * 100
        response = requests.get(f"{BASE_URL}/tracking?reference={long_ref}", timeout=10)
        data = response.json()
        passed = response.status_code == 400
        details = f"Status: {response.status_code}, Error: {data.get('error', 'N/A')}"
        log_test("Tracking - Long reference returns 400", passed, details)
    except Exception as e:
        log_test("Tracking - Long reference returns 400", False, str(e))

    # Test: Tracking - SQL injection-like reference
    try:
        injection_ref = "DT-2026-'; DROP TABLE bookings; --"
        response = requests.get(f"{BASE_URL}/tracking?reference={injection_ref}", timeout=10)
        data = response.json()
        passed = response.status_code == 400
        details = f"Status: {response.status_code}, Error: {data.get('error', 'N/A')}"
        log_test("Tracking - SQL injection-like reference returns 400", passed, details)
    except Exception as e:
        log_test("Tracking - SQL injection-like reference returns 400", False, str(e))

    # Test: Tracking - Unknown but valid format reference (404)
    try:
        unknown_ref = "DT-2026-ZZZZ"
        response = requests.get(f"{BASE_URL}/tracking?reference={unknown_ref}", timeout=10)
        data = response.json()
        passed = response.status_code == 404
        cache_control = response.headers.get('Cache-Control', '')
        has_no_store = 'no-store' in cache_control
        passed = passed and has_no_store
        details = f"Status: {response.status_code}, Cache-Control: {cache_control}, Error: {data.get('error', 'N/A')}"
        log_test("Tracking - Unknown valid reference returns 404 with no-store", passed, details)
    except Exception as e:
        log_test("Tracking - Unknown valid reference returns 404 with no-store", False, str(e))

    # Test: Full lifecycle - PENDING -> PAID (mock) -> COMPLETED
    print("\n--- Tracking API - Full Lifecycle Test ---")
    if len(disposable_bookings) > 0:
        booking1 = disposable_bookings[0]
        
        # Step 1: Verify PENDING
        try:
            response = requests.get(f"{BASE_URL}/tracking?reference={booking1['reference']}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('paymentStatus') == 'PENDING' and
                     data.get('fulfillmentStatus') == 'UNFULFILLED')
            details = f"Payment: {data.get('paymentStatus')}, Fulfillment: {data.get('fulfillmentStatus')}"
            log_test("Lifecycle Step 1 - Initial PENDING/UNFULFILLED", passed, details)
        except Exception as e:
            log_test("Lifecycle Step 1 - Initial PENDING/UNFULFILLED", False, str(e))
        
        # Step 2: Mock checkout (PENDING -> PAID)
        try:
            payload = {"bookingId": booking1['id']}
            response = requests.post(f"{BASE_URL}/checkout", json=payload, timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and data.get('mock') == True)
            details = f"Status: {response.status_code}, Mock: {data.get('mock')}"
            log_test("Lifecycle Step 2 - Mock checkout succeeds", passed, details)
        except Exception as e:
            log_test("Lifecycle Step 2 - Mock checkout succeeds", False, str(e))
        
        # Step 3: Verify PAID immediately (no cache)
        try:
            response = requests.get(f"{BASE_URL}/tracking?reference={booking1['reference']}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('paymentStatus') == 'PAID' and
                     data.get('fulfillmentStatus') == 'UNFULFILLED' and
                     data.get('mockPayment') == True)
            details = f"Payment: {data.get('paymentStatus')}, Fulfillment: {data.get('fulfillmentStatus')}, Mock: {data.get('mockPayment')}"
            log_test("Lifecycle Step 3 - PAID/UNFULFILLED visible immediately", passed, details)
        except Exception as e:
            log_test("Lifecycle Step 3 - PAID/UNFULFILLED visible immediately", False, str(e))
        
        # Step 4: Admin fulfill (PAID -> COMPLETED)
        if admin_token:
            try:
                headers = {"x-admin-token": admin_token}
                payload = {
                    "pnrCode": "TEST123",
                    "airlineName": "Emirates",
                    "eTicketNumber": "176-9876543210",
                    "adminNotes": "Test fulfillment for tracking"
                }
                response = requests.post(f"{BASE_URL}/admin/bookings/{booking1['id']}/fulfill", 
                                        json=payload, headers=headers, timeout=10)
                data = response.json()
                passed = response.status_code == 200 and data.get('ok') == True
                details = f"Status: {response.status_code}, Response: {data}"
                log_test("Lifecycle Step 4 - Admin fulfill succeeds", passed, details)
            except Exception as e:
                log_test("Lifecycle Step 4 - Admin fulfill succeeds", False, str(e))
        else:
            log_test("Lifecycle Step 4 - Admin fulfill succeeds", False, "No admin token")
        
        # Step 5: Verify COMPLETED immediately and NO sensitive data
        try:
            response = requests.get(f"{BASE_URL}/tracking?reference={booking1['reference']}", timeout=10)
            data = response.json()
            
            # Check status
            status_ok = (response.status_code == 200 and
                        data.get('paymentStatus') == 'PAID' and
                        data.get('fulfillmentStatus') == 'COMPLETED' and
                        data.get('fulfilledAt') is not None)
            
            # Check NO sensitive fields leaked (PNR, airline, admin notes, etc.)
            sensitive_fields = ['pnrCode', 'airlineName', 'eTicketNumber', 'adminNotes', 
                              'contact', 'passengers', 'email', 'phone', 'firstName', 'lastName']
            no_sensitive = not any(field in data for field in sensitive_fields)
            
            passed = status_ok and no_sensitive
            
            details = f"Payment: {data.get('paymentStatus')}, Fulfillment: {data.get('fulfillmentStatus')}, "
            details += f"FulfilledAt: {data.get('fulfilledAt') is not None}, "
            details += f"Fields: {list(data.keys())}, No sensitive: {no_sensitive}"
            
            log_test("Lifecycle Step 5 - COMPLETED visible, NO PNR/airline/notes leaked", passed, details)
        except Exception as e:
            log_test("Lifecycle Step 5 - COMPLETED visible, NO PNR/airline/notes leaked", False, str(e))
    else:
        log_test("Lifecycle tests", False, "No test booking created")

    # Test: Cancellation flow
    print("\n--- Tracking API - Cancellation Test ---")
    if len(disposable_bookings) > 1 and admin_token:
        booking2 = disposable_bookings[1]
        
        # Step 1: Cancel booking
        try:
            headers = {"x-admin-token": admin_token}
            response = requests.post(f"{BASE_URL}/admin/bookings/{booking2['id']}/cancel", 
                                    headers=headers, timeout=10)
            data = response.json()
            passed = response.status_code == 200 and data.get('ok') == True
            details = f"Status: {response.status_code}, Response: {data}"
            log_test("Cancellation Step 1 - Admin cancel succeeds", passed, details)
        except Exception as e:
            log_test("Cancellation Step 1 - Admin cancel succeeds", False, str(e))
        
        # Step 2: Verify CANCELLED status visible immediately
        try:
            response = requests.get(f"{BASE_URL}/tracking?reference={booking2['reference']}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('paymentStatus') == 'CANCELLED')
            details = f"Payment: {data.get('paymentStatus')}, Fulfillment: {data.get('fulfillmentStatus')}"
            log_test("Cancellation Step 2 - CANCELLED status visible immediately", passed, details)
        except Exception as e:
            log_test("Cancellation Step 2 - CANCELLED status visible immediately", False, str(e))
    else:
        log_test("Cancellation tests", False, "No test booking or admin token")

    # Test: Concurrent lookups (isolated)
    print("\n--- Tracking API - Concurrent Lookups ---")
    if len(disposable_bookings) >= 3:
        try:
            def lookup_tracking(reference):
                response = requests.get(f"{BASE_URL}/tracking?reference={reference}", timeout=10)
                return response.json()
            
            # Perform 5 concurrent lookups of different bookings
            references = [b['reference'] for b in disposable_bookings[:3]] * 2  # 6 total lookups
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(lookup_tracking, ref) for ref in references]
                results = [f.result() for f in concurrent.futures.as_completed(futures)]
            
            # Verify all lookups succeeded and returned correct data
            passed = len(results) == len(references)
            for result in results:
                if 'referenceCode' not in result:
                    passed = False
                    break
            
            details = f"Performed {len(references)} concurrent lookups, All succeeded: {passed}"
            log_test("Concurrent lookups isolated and correct", passed, details)
        except Exception as e:
            log_test("Concurrent lookups isolated and correct", False, str(e))
    else:
        log_test("Concurrent lookups isolated and correct", False, "Not enough test bookings")

    # Test: Existing booking retrieval (regression)
    print("\n--- Regression - Existing Booking Retrieval ---")
    if len(disposable_bookings) > 0:
        booking1 = disposable_bookings[0]
        try:
            response = requests.get(f"{BASE_URL}/bookings/{booking1['reference']}", timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and
                     data.get('referenceCode') == booking1['reference'] and
                     '_id' not in data)
            details = f"Status: {response.status_code}, Ref: {data.get('referenceCode')}, No _id: {'_id' not in data}"
            log_test("GET /api/bookings/:ref still works (regression)", passed, details)
        except Exception as e:
            log_test("GET /api/bookings/:ref still works (regression)", False, str(e))
    else:
        log_test("GET /api/bookings/:ref still works (regression)", False, "No test booking")

    # Test: Admin bookings list (regression)
    if admin_token:
        try:
            headers = {"x-admin-token": admin_token}
            response = requests.get(f"{BASE_URL}/admin/bookings", headers=headers, timeout=10)
            data = response.json()
            passed = (response.status_code == 200 and isinstance(data, list))
            details = f"Status: {response.status_code}, Found {len(data)} bookings"
            log_test("GET /api/admin/bookings still works (regression)", passed, details)
        except Exception as e:
            log_test("GET /api/admin/bookings still works (regression)", False, str(e))
    else:
        log_test("GET /api/admin/bookings still works (regression)", False, "No admin token")

    # Test: Admin fulfill (regression - already tested in lifecycle but verify again)
    print("\n--- Regression - Admin Fulfill ---")
    if admin_token and len(disposable_bookings) > 2:
        booking3 = disposable_bookings[2]
        
        # First pay the booking
        try:
            payload = {"bookingId": booking3['id']}
            response = requests.post(f"{BASE_URL}/checkout", json=payload, timeout=10)
            if response.status_code == 200:
                # Then fulfill it
                headers = {"x-admin-token": admin_token}
                payload = {
                    "pnrCode": "REG456",
                    "airlineName": "Singapore Airlines",
                    "eTicketNumber": "618-1234567890",
                    "adminNotes": "Regression test fulfillment"
                }
                response = requests.post(f"{BASE_URL}/admin/bookings/{booking3['id']}/fulfill", 
                                        json=payload, headers=headers, timeout=10)
                data = response.json()
                passed = response.status_code == 200 and data.get('ok') == True
                
                # Verify fulfillment
                if passed:
                    response = requests.get(f"{BASE_URL}/admin/bookings/{booking3['id']}", headers=headers, timeout=10)
                    booking_data = response.json()
                    passed = (booking_data.get('fulfillmentStatus') == 'COMPLETED' and
                             booking_data.get('pnrCode') == 'REG456' and
                             booking_data.get('fulfilledAt') is not None)
                    details = f"Status: {booking_data.get('fulfillmentStatus')}, PNR: {booking_data.get('pnrCode')}"
                else:
                    details = f"Status: {response.status_code}, Response: {data}"
                
                log_test("Admin fulfill still works (regression)", passed, details)
            else:
                log_test("Admin fulfill still works (regression)", False, "Checkout failed")
        except Exception as e:
            log_test("Admin fulfill still works (regression)", False, str(e))
    else:
        log_test("Admin fulfill still works (regression)", False, "No admin token or test booking")

    # Print summary
    print_summary()
    
    # Print disposable bookings info
    print("\n" + "="*80)
    print("DISPOSABLE TEST BOOKINGS CREATED")
    print("="*80)
    for booking in disposable_bookings:
        print(f"  - {booking['reference']} (ID: {booking['id']}) - {booking['purpose']}")
    print(f"\nTotal: {len(disposable_bookings)} disposable bookings")
    print("Note: These are test bookings and can be cleaned up if needed.")

except Exception as e:
    print(f"\n❌ CRITICAL ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
