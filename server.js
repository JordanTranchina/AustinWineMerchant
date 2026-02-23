const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const { scrapeABLiquor } = require('./abLiquorScraper');
const { scrapeAustinWineMerchant } = require('./austinWineScraper');

app.get("/api/inventory", async (req, res) => {
  try {
    // Run both scrapers in parallel
    const [austinWineResults, abLiquorResults] = await Promise.all([
        scrapeAustinWineMerchant(),
        scrapeABLiquor()
    ]);

    // Combine results
    const combinedResults = [...austinWineResults, ...abLiquorResults];
    
    // Sort by price (optional but good for UX)
    // Prices are strings "$123.45", need to parse
    combinedResults.sort((a, b) => {
        const priceA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
        const priceB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
        return priceA - priceB;
    });

    res.json(combinedResults);
  } catch (error) {
    console.error("Scraping error:", error);
    // If one fails, try to return at least something? Or error out?
    // For now, fail if critical.
    res.status(500).json({ error: error.message });
  }
});


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = {
    app
};

