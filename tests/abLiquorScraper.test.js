const { isMezcal, extractBrand, extractSize, extractMaguey } = require('../abLiquorScraper');

describe('abLiquorScraper Utilities', () => {

    describe('isMezcal', () => {
        test('should return true for "Mezcal"', () => {
            expect(isMezcal('Mezcal Vago')).toBe(true);
        });

        test('should return true for known Mezcal brands', () => {
            expect(isMezcal('Rey Campero Espadin')).toBe(true);
            expect(isMezcal('Del Maguey Vida')).toBe(true);
        });

        test('should return true for known Agaves', () => {
            expect(isMezcal('Tobala')).toBe(true);
            expect(isMezcal('Tepeztate')).toBe(true);
        });

        test('should return false for Tequila', () => {
            expect(isMezcal('Tequila Ocho')).toBe(false);
            expect(isMezcal('Añejo Tequila')).toBe(false);
        });

        test('should return false for unrelated items', () => {
            expect(isMezcal('Vodka')).toBe(false);
            expect(isMezcal('Rum')).toBe(false);
        });
        
        test('should return true for "Mezcal" even if it says Tequila (unless starting with Tequila)', () => {
             // Logic in code: if includes mezcal -> true, UNLESS starts with Tequila
             expect(isMezcal('Mezcal aged in Tequila Barrels')).toBe(true);
             expect(isMezcal('Tequila aged in Mezcal Barrels')).toBe(false);
        });
    });

    describe('extractBrand', () => {
        test('should extract known brands', () => {
            expect(extractBrand('Mezcal Vago Espadin')).toBe('Mezcal Vago');
            expect(extractBrand('Del Maguey Vida')).toBe('Del Maguey');
            expect(extractBrand('Rey Campero Tepeztate')).toBe('Rey Campero');
            expect(extractBrand('5 Sentidos Sierra Negra')).toBe('5 Sentidos');
        });

        test('should fallback to first word if unknown', () => {
            expect(extractBrand('UnknownBrand Espadin')).toBe('UnknownBrand');
        });
        
        test('should extract brand even if lower case match', () => {
             expect(extractBrand('real minero largo')).toBe('Real Minero');
        });
    });

    describe('extractSize', () => {
        test('should extract ml', () => {
            expect(extractSize('Brand 750ml')).toBe('750ml');
            expect(extractSize('Brand 750 ML')).toBe('750ml');
        });

        test('should extract liters and convert to ml', () => {
            expect(extractSize('Brand 1L')).toBe('1000ml');
            expect(extractSize('Brand 1.75 L')).toBe('1750ml');
            expect(extractSize('Brand 1.75 Liters')).toBe('1750ml');
        });

        test('should fallback for 750', () => {
             expect(extractSize('Brand 750')).toBe('750ml');
        });
        
        test('should return empty string if no size found', () => {
            expect(extractSize('Brand No Size')).toBe('');
        });
    });

    describe('extractMaguey', () => {
        test('should remove "mezcal" and trim', () => {
            expect(extractMaguey('Mezcal Espadin')).toBe('Espadin');
            expect(extractMaguey('Tobala Mezcal')).toBe('Tobala');
        });
        
        test('should handle case insensitivity', () => {
            expect(extractMaguey('MEZCAL Tepeztate')).toBe('Tepeztate');
        });
    });

});
