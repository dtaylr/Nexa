Feature: Appointment Management
  As a patient on the NexaCore health portal
  I want to book and cancel appointments
  So that I can manage my healthcare schedule

  Background:
    Given I am authenticated as a patient
    And my patient record exists in the system

  Scenario: Booking a new appointment
    When I book an appointment with "dr-chen-001" for next week
    Then the response status should be 201
    And the appointment status should be "scheduled"
    And the appointment should be retrievable by patient ID

  Scenario: Cancelling an existing appointment
    Given I have a scheduled appointment
    When I cancel that appointment
    Then the response status should be 200
    And the appointment status should be "cancelled"

  Scenario: Medication dosage is returned as a number not a string
    Given my patient record has an active medication with dosage "10mg"
    When I retrieve my medications
    Then the response status should be 200
    And the dosage value should be of type number

  Scenario: Patient records are not accessible to other patients (IDOR)
    Given another patient record exists with sequential ID
    When I attempt to access that patient's records using their ID
    Then the response status should be 403

  Scenario: Error responses do not contain patient PII
    When I request a patient record with an invalid ID "INVALID"
    Then the response status should be 400
    And the response body should not contain the invalid ID
    And the response body should not match any PII patterns

  Scenario: Concurrent appointments for the same slot are rejected
    When two booking requests are submitted simultaneously for the same slot
    Then only one booking should succeed
    And the other should be rejected
