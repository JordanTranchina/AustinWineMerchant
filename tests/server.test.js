const request = require('supertest');
// Partial mock of abLiquorScraper to avoid actual network calls
jest.mock('../abLiquorScraper', () => ({
    scrapeABLiquor: jest.fn(),
    // We don't need to mock other exports if we don't use them here, but good practice
    isMezcal: jest.fn(),
    extractBrand: jest.fn(),
    extractSize: jest.fn(),
    extractMaguey: jest.fn()
}));

// We also need to mock axios for scrapeAustinWineMerchant which is in server.js
// But wait, server.js defines scrapeAustinWineMerchant internally.
// We can't easily mock it unless we exported it and allowed overriding, OR we mock axios.
const axios = require('axios');
jest.mock('axios');

const { app, normalizeSize } = require('../server');
const { scrapeABLiquor } = require('../abLiquorScraper'); // This is the mocked version

describe('Server Utilities', () => {
    describe('normalizeSize', () => {
        test('should normalize ml', () => {
            expect(normalizeSize('750ml')).toBe('750ml');
            expect(normalizeSize('750 ml')).toBe('750ml');
        });

        test('should normalize liters', () => {
            expect(normalizeSize('1L')).toBe('1000ml');
            expect(normalizeSize('1.75 L')).toBe('1750ml');
            expect(normalizeSize('1 liters')).toBe('1000ml');
        });

        test('should default numeric to ml', () => {
            expect(normalizeSize('750')).toBe('750ml');
        });
        
        test('should return original if no match', () => {
            expect(normalizeSize('Bottle')).toBe('Bottle');
        });
    });
});

describe('API Endpoints', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/inventory should return combined results', async () => {
        // Mock Austin Wine Merchant response via axios
        const mockHtml = `
            <html>
                <body>
                    <h1>Mezcal</h1>
                    <table>
                        <tr>
                            <td>Bottle</td>
                            <td>750ml</td>
                            <td>40%</td>
                            <td>Mezcal Vago Espadin</td>
                            <td>$50.00</td>
                        </tr>
                    </table>
                </body>
            </html>
        `;
        axios.get.mockResolvedValue({ data: mockHtml });

        // Mock AB Liquor response
        scrapeABLiquor.mockResolvedValue([{
            brand: 'Del Maguey',
            description: 'Del Maguey Vida',
            maguey: 'Espadin',
            price: '$40.00',
            size: '750ml',
            link: 'http://example.com',
            img: 'http://example.com/img.jpg',
            pack: 'Bottle',
            alcohol: '',
            source: 'AB Liquor'
        }]);

        const res = await request(app).get('/api/inventory');
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(2); // 1 from AWM, 1 from AB Liquor
        
        // Sorted by price (Cheaper first? Logic says: priceA - priceB)
        // AWM $50, AB $40 -> AB should be first
        expect(res.body[0].source).toBe('AB Liquor');
        expect(res.body[1].source).toBe('Austin Wine Merchant');
    });

    test('GET /api/inventory should handle errors gracefully', async () => {
         // If axios fails
         axios.get.mockRejectedValue(new Error('Network error'));
         
         const res = await request(app).get('/api/inventory');
         expect(res.statusCode).toBe(500);
         expect(res.body).toHaveProperty('error');
    });
});
