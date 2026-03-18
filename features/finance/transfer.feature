Feature: Bank Transfer
  As a NexaCore account holder
  I want to transfer money between accounts
  So that I can manage my funds securely and maintain a complete audit trail

  Background:
    Given I am authenticated as a banker

  Scenario: Successful transfer creates an audit trail
    Given my account has a balance of 10000 cents
    And a destination account exists
    When I transfer $20.00 with reference "Rent payment"
    Then the response status should be 201
    And the response should contain a transferId
    And the response should contain an auditId
    And the transfer status should be "PENDING"

  Scenario: Transfer with insufficient funds returns a structured error
    Given my account has a balance of 1000 cents
    When I attempt to transfer $20.00
    Then the response status should be 422
    And the error should be "INSUFFICIENT_FUNDS"
    And the response should include the available balance
    And the response should not contain any account numbers

  Scenario: Expired token is rejected
    Given I have an expired authentication token
    When I attempt to transfer $10.00
    Then the response status should be 401

  @known-bug
  Scenario: Monthly summary exposes float arithmetic drift
    Given my account has received two transactions totalling 30 cents
    When I request the monthly summary
    Then the total should be exactly "0.30"

  Scenario: Audit record must exist after a successful transfer
    Given my account has a balance of 10000 cents
    And a destination account exists
    When I transfer $5.00 with reference "Test payment"
    Then the response status should be 201
    And after a short delay the audit record should exist in the database
