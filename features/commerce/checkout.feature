Feature: E-Commerce Checkout
Acceptance Criteria: 
  As a shopper on the NexaCore platform
  I want to add items to my cart and complete a purchase
  So that I can buy products with confidence

  Background:
    Given I am authenticated as a shopper
    And products are available in the catalogue

  Scenario: Adding a product to cart
    When I create a new cart
    And I add the first available product with quantity 1
    Then the response status should be 200
    And the cart should contain 1 item

  @known-bug
  Scenario: Promotion code cannot be applied twice to the same cart
    Given I have a cart with a product
    And I apply promotion code "SAVE10"
    When I apply promotion code "SAVE10" again
    Then the response status should be 409
    And the error should be "PROMOTION_ALREADY_APPLIED"

  @known-bug
  Scenario: Placing an order marks email as unsent before payment
    Given I have a cart with a product
    When I place an order
    Then the response status should be 201
    And emailQueued should be false before payment is taken

  Scenario: Payment is processed after order creation
    Given I have a pending order
    When I submit payment with method "card" for the order total
    Then the response status should be 200
    And the payment status should be "CAPTURED"
    And the order ID should be in the response

  Scenario: Product price has at most two decimal places
    When I retrieve the product catalogue
    Then every product price should have at most 2 decimal places

  Scenario: Out of stock product cannot be ordered
    Given a product with exactly 1 unit of inventory
    And two shoppers attempt to buy that product simultaneously
    Then exactly one order should succeed
    And the other should return status 409
    And the final inventory should be 0
