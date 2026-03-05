import request from 'supertest';
import { jest } from '@jest/globals';

// Set up ESM mocks before importing the actual code
jest.unstable_mockModule('../db.js', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue({
            data: [
                {
                    brand: "Del Maguey",
                    description: "Del Maguey Vida",
                    price: "$40.00",
                    source: "AB Liquor",
                    is_in_stock: true
                },
                {
                    brand: "Mezcal Vago",
                    description: "Mezcal Vago Espadin",
                    price: "$50.00",
                    source: "Austin Wine Merchant",
                    is_in_stock: true
                }
            ],
            error: null
        })
    }
}));

describe('Server Utilities & API', () => {
    let app;
    let dbMock;

    beforeAll(async () => {
        // Dynamically import the app and the mocked db module
        const serverModule = await import('../server.js');
        app = serverModule.default;
        dbMock = await import('../db.js');
    });

    describe('API Endpoints', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('GET /api/inventory should return sorted results from Supabase', async () => {
            const res = await request(app).get('/api/inventory');
            
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
            // It should sort by price: $40 then $50
            expect(res.body[0].source).toBe('AB Liquor');
            expect(res.body[1].source).toBe('Austin Wine Merchant');
        });

        test('GET /api/inventory should handle database errors', async () => {
             // Override the mock for this specific test
             dbMock.supabase.eq.mockReturnValueOnce({
                 data: null,
                 error: new Error('Database failure')
             });
             
             const res = await request(app).get('/api/inventory');
             expect(res.statusCode).toBe(500);
             expect(res.body).toHaveProperty('error', 'Database failure');
        });
    });
});
