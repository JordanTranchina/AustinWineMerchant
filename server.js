const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

app.get("/api/inventory", async (req, res) => {
  try {
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
        // Strict check to avoid "Mezcal Cocktails" or similar if possible, 
        // but "Mezcal" is likely the section header.
        // Also ensure it's not a nav item which usually aren't H tags.
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
        return res.status(500).json({ error: "Could not find the Mezcal section header." });
    }

    // 2. Find the first table AFTER that header
    // We traverse next siblings until we find a table
    let $table = $mezcalHeader.nextAll('table').first();

    // If not found in siblings, it might be nested differently.
    // User's script used regex on the substring, implying the table follows in source order.
    // If Cheerio traversal fails (e.g. header is inside a div, table is outside), we might need the string approach but FIXED.
    
    if ($table.length === 0) {
         // Fallback to the string method if traversal fails, but be more careful
         const fullHtml = $.html();
         // Get the index of the header element in the full HTML
         // This is tricky with Cheerio. 
         // Let's rely on the user's regex approach since it was known to work for them?
         // But implementing it in Node:
         
         // Find header index based on the specific header we found
         const headerString = $.html($mezcalHeader); 
         const headerIndex = fullHtml.indexOf(headerString);
         
         if (headerIndex !== -1) {
             const contentAfterHeader = fullHtml.substring(headerIndex);
             const tableMatch = contentAfterHeader.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
             if (tableMatch) {
                  // Load just this table into cheerio
                  const $temp = cheerio.load(tableMatch[0]);
                  $table = $temp('table');
             }
         }
    }

    if ($table.length === 0) {
         return res.status(500).json({ error: "Found Mezcal header, but no table followed." });
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

      // Validation: Ensure it's a product row
      // Check if it has enough cells and isn't a header "Pack"
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
                // List of known magueys for formatting
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

                // Logic: Find all occurrences of known magueys and ensure commas between them
                // 1. Identify matches in the string
                if (maguey) {
                    let ranges = [];
                    const lowerMaguey = maguey.toLowerCase();
                    
                    KNOWN_MAGUEYS.forEach(known => {
                        const idx = lowerMaguey.indexOf(known.toLowerCase());
                        if (idx !== -1) {
                            // Check word boundaries roughly (start or space before, end or space after)
                            const before = idx === 0 || /\s/.test(maguey[idx-1]);
                            const after = (idx + known.length === maguey.length) || /\s/.test(maguey[idx + known.length]);
                            
                            if (before && after) {
                                ranges.push({ start: idx, end: idx + known.length, word: maguey.substring(idx, idx + known.length) });
                            }
                        }
                    });

                    // 2. Sort ranges by position
                    ranges.sort((a, b) => a.start - b.start);

                    // 3. Filter overlapping ranges (keep longest usually, or just first found?)
                    // If "Tobaxiche Amarillo" matches, "Tobaxiche" and "Amarillo" might also match independently.
                    // We want the longest match covering a region.
                    let cleanRanges = [];
                    if (ranges.length > 0) {
                        cleanRanges.push(ranges[0]);
                        for (let i = 1; i < ranges.length; i++) {
                            let curr = ranges[i];
                            let prev = cleanRanges[cleanRanges.length - 1];
                            
                            if (curr.start < prev.end) {
                                // Overlap. Keep the one that ends later (longer)
                                if (curr.end > prev.end) {
                                    cleanRanges.pop();
                                    cleanRanges.push(curr);
                                }
                                // Else curr is substring of prev, ignore
                            } else {
                                cleanRanges.push(curr);
                            }
                        }
                    }

                    // 4. Insert commas between adjacent ranges
                    // Iterate backwards to avoid messing up indices?
                    // Or construct new string.
                    if (cleanRanges.length > 1) {
                        let newMaguey = maguey;
                        // Go backwards
                        for (let i = cleanRanges.length - 1; i > 0; i--) {
                            let curr = cleanRanges[i];
                            let prev = cleanRanges[i-1];
                            
                            // Check text between prev.end and curr.start
                            const gap = maguey.substring(prev.end, curr.start);
                            
                            // If gap is just spaces, insert comma
                            if (/^\s+$/.test(gap)) {
                                newMaguey = newMaguey.substring(0, prev.end) + "," + gap + newMaguey.substring(curr.start);
                            }
                        }
                        maguey = newMaguey;
                    }
                }
                // --- MAGUEY FORMATTING END ---

                 results.push({
                    pack: cells[0],
                    size: cells[1],
                    alcohol: cells[2],
                    description: description, // Keep full description for fallback/search
                    brand: brand,
                    maguey: maguey || description, // Fallback to description if extraction failed? No, let's keep extracted.
                    price: cells[4]
                });
            }
    });

    res.json(results);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
