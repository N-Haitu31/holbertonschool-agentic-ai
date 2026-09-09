const { calculateTotal } = require('../src/cart_calculator');

describe('calculateTotal', () => {
    test('should_return_zero_when_items_are_not_an_array', () => {
        // Arrange
        const items = null;

        // Act
        const result = calculateTotal(items);

        // Assert
        expect(result).toBe(0);
    });

    test('should_return_zero_when_items_array_is_empty', () => {
        // Arrange
        const items = [];

        // Act
        const result = calculateTotal(items);

        // Assert
        expect(result).toBe(0);
    });

    test('should_use_default_tax_rate_when_tax_rate_is_omitted', () => {
        // Arrange
        const items = [{ price: 10, quantity: 1 }];

        // Act
        const result = calculateTotal(items);

        // Assert
        expect(result).toBe(12);
    });

    test('should_use_default_discount_when_discount_is_omitted', () => {
        // Arrange
        const items = [{ price: 10, quantity: 1 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(10);
    });

    test('should_calculate_subtotal_for_multiple_items', () => {
        // Arrange
        const items = [
            { price: 10, quantity: 2 },
            { price: 5.5, quantity: 3 },
        ];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(36.5);
    });

    test('should_default_quantity_to_one_when_quantity_is_missing', () => {
        // Arrange
        const items = [{ price: 10 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(10);
    });

    test('should_treat_zero_quantity_as_one_when_quantity_is_zero', () => {
        // Arrange
        const items = [{ price: 10, quantity: 0 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(10);
    });

    test('should_treat_missing_price_as_zero_when_price_is_missing', () => {
        // Arrange
        const items = [{ quantity: 2 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(0);
    });

    test('should_clamp_negative_price_to_zero_when_price_is_negative', () => {
        // Arrange
        const items = [{ price: -10, quantity: 2 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(0);
    });

    test('should_clamp_negative_quantity_to_zero_when_quantity_is_negative', () => {
        // Arrange
        const items = [{ price: 10, quantity: -2 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(0);
    });

    test('should_apply_fixed_discount_before_tax_when_discount_is_positive', () => {
        // Arrange
        const items = [{ price: 100, quantity: 1 }];

        // Act
        const result = calculateTotal(items, 0.2, 25);

        // Assert
        expect(result).toBe(90);
    });

    test('should_floor_subtotal_at_zero_when_discount_exceeds_subtotal', () => {
        // Arrange
        const items = [{ price: 10, quantity: 1 }];

        // Act
        const result = calculateTotal(items, 0.2, 25);

        // Assert
        expect(result).toBe(0);
    });

    test('should_apply_tax_to_discounted_subtotal_when_tax_rate_is_positive', () => {
        // Arrange
        const items = [{ price: 50, quantity: 2 }];

        // Act
        const result = calculateTotal(items, 0.2, 10);

        // Assert
        expect(result).toBe(108);
    });

    test('should_return_subtotal_without_tax_when_tax_rate_is_zero', () => {
        // Arrange
        const items = [{ price: 19.99, quantity: 1 }];

        // Act
        const result = calculateTotal(items, 0);

        // Assert
        expect(result).toBe(19.99);
    });

    test('should_round_total_to_two_decimal_places_when_result_has_more_than_two_decimals', () => {
        // Arrange
        const items = [{ price: 10, quantity: 1 }];

        // Act
        const result = calculateTotal(items, 0.155);

        // Assert
        expect(result).toBe(11.55);
    });

    test('should_return_zero_when_item_price_and_quantity_are_both_missing', () => {
        // Arrange
        const items = [{}];

        // Act
        const result = calculateTotal(items, 0.2);

        // Assert
        expect(result).toBe(0);
    });
});