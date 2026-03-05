const { normalizeSize } = require('../utils');

describe('Utilities', () => {
    describe('normalizeSize', () => {
        test('should normalize ml', () => {
            expect(normalizeSize('750ml')).toBe('750ml');
            expect(normalizeSize('750 ml')).toBe('750ml');
        });

        test('should normalize liters', () => {
            expect(normalizeSize('1L')).toBe('1000ml');
            expect(normalizeSize('1.75 L')).toBe('1750ml');
        });

        test('should default numeric to ml', () => {
            expect(normalizeSize('750')).toBe('750ml');
        });
        
        test('should return original if no match', () => {
            expect(normalizeSize('Bottle')).toBe('Bottle');
        });
    });
});
