const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const { scrapeABLiquor } = require('./abLiquorScraper');

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

// Extracted the original logic into a function
async function scrapeAustinWineMerchant() {
    const url = "https://www.theaustinwinemerchant.com/spirits.html";
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // 1. Identify where the "Mezcal" section starts
    let $mezcalHeader = null;
        
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
        const text = $(el).text().trim();
        if (text === 'Mezcal' || text === 'MEZCAL') { 
            $mezcalHeader = $(el);
            return false; 
        }
    });

    // Fallback: look for anchor name
    if (!$mezcalHeader) {
        const $anchor = $('a[name="Mezcal"]');
        if ($anchor.length > 0) {
            $mezcalHeader = $anchor;
        }
    }

    if (!$mezcalHeader) {
        console.error("Austin Wine Merchant: Could not find Mezcal section header.");
        return [];
    }

    // 2. Find the first table AFTER that header
    let $table = $mezcalHeader.nextAll('table').first();
    
    if ($table.length === 0) {
         const fullHtml = $.html();
         const headerString = $.html($mezcalHeader); 
         const headerIndex = fullHtml.indexOf(headerString);
         
         if (headerIndex !== -1) {
             const contentAfterHeader = fullHtml.substring(headerIndex);
             const tableMatch = contentAfterHeader.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
             if (tableMatch) {
                  const $temp = cheerio.load(tableMatch[0]);
                  $table = $temp('table');
             }
         }
    }

    if ($table.length === 0) {
         console.error("Austin Wine Merchant: Found header but no table.");
         return [];
    }

    const results = [];

    $table.find("tr").each((i, row) => {
      const cells = [];
      $(row)
        .find("td")
        .each((j, cell) => {
          let cellData = $(cell).text().replace(/\s+/g, " ").trim();
          cells.push(cellData);
        });

      if (cells.length >= 4 && cells[0].toLowerCase() !== "pack" && cells[3] !== "") {
                const description = cells[3];
                let brand = "";
                let maguey = "";

                // Heuristic: Split by "Mezcal"
                const splitParts = description.split(/ mezcal /i);
                
                if (splitParts.length > 1) {
                    brand = splitParts[0].trim();
                    maguey = splitParts.slice(1).join(" Mezcal ").trim(); 
                } else {
                    if (description.toLowerCase().startsWith('mezcal ')) {
                         brand = "Mezcal Vago"; 
                         maguey = description.replace(/mezcal vago/i, '').trim();
                    } else {
                        brand = description; 
                        maguey = "";
                    }
                }
                
                if (!brand && description.toLowerCase().startsWith('mezcal')) {
                    brand = "Mezcal"; 
                    maguey = description.substring(6).trim();
                }

                // --- MAGUEY FORMATTING START ---
                const KNOWN_MAGUEYS = [
                    "Alto", "Amarillo", "Amole", "Ancho", "Arroqueño", "Azul", "Azul Telcruz", 
                    "Barril", "Barril Chino", "Becuela", "Bicuishe", "Blanco", "Brocha", "Bruto", 
                    "Candelillo", "Castilla", "Cenizo", "Chacaleño", "Chancuellar", "Chato", 
                    "Chico Aguillar", "Chino", "Chuparrosa", "Cimarrón", "Ciriaco", "Cirial", 
                    "Coyota", "Coyote", "Criollo", "Cuerno", "Cuishe", "Cuishito", "De Horno", 
                    "Espadilla", "Espadillon", "Espadin", "Espadín", "Espadincillo", "Funkiana", 
                    "Henequén", "I'gok", "Ixtero Amarillo", "Ixtero Verde", "Jabali", "Jabalí",
                    "Lamparillo", "Largo", "Lineño", "Lumbre", "Macho", "Madrecuishe", "Mai", 
                    "Marteño", "Masparillo", "Mexicanito", "Mexicano", "Mexicano Verde", 
                    "Pacifica", "Papalome", "Papalometl", "Papalote", "Pelón Verde", 
                    "Penca Ancha", "Pichomel", "Pizorra", "Presa Grande", "Pulquero", "Rayo", 
                    "Sacatoro", "Sahuayensis", "Sanmartin", "Sierra Negra", "Sierrudo", 
                    "Tepemete", "Tepeztate", "Tepextate", "Tobala", "Tobalá", 
                    "Tobaxiche", "Tobaxiche Amarillo", "Tobaziche", "Tripon", "Verde", "Warash"
                ];

                if (maguey) {
                    let ranges = [];
                    const lowerMaguey = maguey.toLowerCase();
                    
                    KNOWN_MAGUEYS.forEach(known => {
                        const idx = lowerMaguey.indexOf(known.toLowerCase());
                        if (idx !== -1) {
                            const before = idx === 0 || /\s/.test(maguey[idx-1]);
                            const after = (idx + known.length === maguey.length) || /\s/.test(maguey[idx + known.length]);
                            
                            if (before && after) {
                                ranges.push({ start: idx, end: idx + known.length, word: maguey.substring(idx, idx + known.length) });
                            }
                        }
                    });

                    ranges.sort((a, b) => a.start - b.start);

                    let cleanRanges = [];
                    if (ranges.length > 0) {
                        cleanRanges.push(ranges[0]);
                        for (let i = 1; i < ranges.length; i++) {
                            let curr = ranges[i];
                            let prev = cleanRanges[cleanRanges.length - 1];
                            
                            if (curr.start < prev.end) {
                                if (curr.end > prev.end) {
                                    cleanRanges.pop();
                                    cleanRanges.push(curr);
                                }
                            } else {
                                cleanRanges.push(curr);
                            }
                        }
                    }

                    if (cleanRanges.length > 1) {
                        let newMaguey = maguey;
                        for (let i = cleanRanges.length - 1; i > 0; i--) {
                            let curr = cleanRanges[i];
                            let prev = cleanRanges[i-1];
                            const gap = maguey.substring(prev.end, curr.start);
                            if (/^\s+$/.test(gap)) {
                                newMaguey = newMaguey.substring(0, prev.end) + "," + gap + newMaguey.substring(curr.start);
                            }
                        }
                        maguey = newMaguey;
                    }
                }
                // --- MAGUEY FORMATTING END ---

                // --- MAGUEY FORMATTING END ---

                 results.push({
                    pack: cells[0],
                    size: normalizeSize(cells[1]),
                    alcohol: cells[2],
                    description: description,
                    brand: brand,
                    maguey: maguey || description,
                    price: cells[4],
                    source: "Austin Wine Merchant" // Added source
                });
            }
    });
    return results;
}

function normalizeSize(size) {
    if (!size) return "";
    
    // Clean up
    size = size.trim();
    
    // Check if it's already in ML or L
    const match = size.match(/(\d+(?:\.\d+)?)\s*(ml|l|liters|litres)/i);
    
    if (match) {
        let qty = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        
        if (unit.startsWith('l')) {
            qty = qty * 1000;
        }
        
        return `${qty}ml`;
    }
    
    // If it's just a number like "750", append ml
    if (/^\d+$/.test(size)) {
        return `${size}ml`;
    }
    
    return size;
}


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}



module.exports = {
    app,
    normalizeSize,
    scrapeAustinWineMerchant
};
