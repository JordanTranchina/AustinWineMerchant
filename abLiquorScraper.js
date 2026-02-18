const puppeteer = require('puppeteer');

const AB_LIQUOR_URL = "https://abliquor2.com/order/ab-liquor-2-1809-w-anderson-ln-unit-1";

// Known keywords to identify Mezcal
const MEZCAL_KEYWORDS = [
  "Mezcal", "Espadin", "Tobala", "Cupreata", "Jabali", "Jabalí", "Tepeztate", "Tepextate",
  "Arroqueño", "Arroqueno", "Madrecuixe", "Madrecuishe", "Barril", "Mexicano", 
  "Karwinskii", "Marmorata", "Cuishe", "Sierra Negra", "Coyote", "Ensamble",
  "5 Sentidos", "Aguerrido", "Chacolo", "Creador", "Derrumbes", "El Jolgorio", 
  "Lalocura", "Mal Bien", "Mezcalosfera", "Neta", "Real Minero", "Rey Campero", "Vago",
  "Bozal", "Del Maguey", "Alipus", "Banhez", "Yola", "Siete Misterios", "Leyenda"
];

const TEQUILA_KEYWORDS = [
  "Tequila", "Blanco", "Reposado", "Anejo", "Añejo", "Cristalino", "Extra Anejo"
];

function isMezcal(name) {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  
  // High confidence Mezcal indicators
  if (lowerName.includes("mezcal")) {
     // Check for "Tequila" to avoid "Mezcal barrel finish Tequila" etc, unless it's a known ensemble or brand that might use both words?
     // Actually, if it says "Mezcal", it's likely Mezcal, BUT watch out for "Tequila aged in Mezcal barrels".
     // For now, if it says Mezcal, we take it, unless it explicitly starts with "Tequila".
     if (lowerName.includes("tequila")) {
         // Special case: "Mezcal vs Tequila" book? Or "Tequila aged in Mezcal barrels"
         // If it starts with Tequila, likely Tequila.
         if (lowerName.startsWith("tequila")) return false;
     }
     return true; 
  }

  // Check against known Mezcal brands/agaves
  const hasMezcalKeyword = MEZCAL_KEYWORDS.some(keyword => lowerName.includes(keyword.toLowerCase()));
  
  // Check if it looks like Tequila
  const hasTequilaKeyword = TEQUILA_KEYWORDS.some(keyword => lowerName.includes(keyword.toLowerCase()));

  // Heuristic: It's Mezcal if it has a keyword AND doesn't strongly look like Tequila
  // (unless the keyword is very strong like "Espadin" which doesn't exist in Tequila)
  if (hasMezcalKeyword && !lowerName.includes("tequila") && !lowerName.includes("rum") && !lowerName.includes("ron ")) {
      return true;
  }
  
  return false;
}

// Known multi-word brands to fix fragmentation
const KNOWN_BRANDS = [
  "5 Sentidos", "El Jolgorio", "Real Minero", "Rey Campero", "Del Maguey", 
  "Alipus", "Bozal", "Lalocura", "Mal Bien", "Siete Misterios", 
  "Mezcal Vago", "Mezcalosfera", "Agave de Cortes", "La Venenosa", "Derrumbes",
  "Leyenda", "La Medida", "Madre", "Banhez", "Yola", "Wahaka", "Vago", "Origen Raiz"
];

function extractBrand(title) {
    if (!title) return "Unknown";
    const lowerTitle = title.toLowerCase();
    
    // Check known brands first (longest match logic implicitly handling by order if sorted, 
    // but here we just check presence. Ideally specific brands should come before generic words)
    // Actually, "Mezcal Vago" should be checked before "Vago" if both exist? 
    // Yes.
    
    // Let's sort KNOWN_BRANDS by length descending to match longest first
    const sortedBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
    
    for (const brand of sortedBrands) {
        if (lowerTitle.includes(brand.toLowerCase())) {
            return brand;
        }
    }
    
    // Fallback: First word
    return title.split(' ')[0];
}

function extractSize(title) {
    if (!title) return "";
    
    // Regex for size with units
    // Matches: 750ml, 750 ML, 1 L, 1.75L, 1.75 liters
    const match = title.match(/(\d+(?:\.\d+)?)\s*(ml|l|liters|litres)/i);
    
    if (match) {
        let qty = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        
        if (unit.startsWith('l')) {
            qty = qty * 1000;
        }
        
        return `${qty}ml`;
    }
    
    // Fallback: Look for "750" specifically as it's common
    if (title.includes("750") && !title.includes("750ml")) {
         return "750ml";
    }
    
    return "";
}

// Helper to extract clean Maguey from title
function extractMaguey(name) {
    if (!name) return "";
    return name.replace(/mezcal/gi, '').trim(); 
}

async function scrapeABLiquor() {
  console.log("Starting AB Liquor scraper...");
  let browser;
  try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // standard args for running on some environments
      });
      
      const page = await browser.newPage();
      
      // Set User Agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      // Log page console messages
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      
      // Set viewport to a reasonable size to ensure elements are visible
      await page.setViewport({ width: 1280, height: 800 });

      await page.goto(AB_LIQUOR_URL, { waitUntil: 'networkidle2', timeout: 60000 });

      // Try multiple strategies to find the category
      console.log("Looking for category button...");
      
      const categoryLabel = "Tequila Mezcal & Sotol";
      let categoryBtn;

      try {
          // precise selector
          categoryBtn = await page.waitForSelector(`div[aria-label="${categoryLabel}"]`, { timeout: 5000 });
      } catch (e) {
          console.log("Precise selector failed, trying text search...");
          // Fallback: iterate divs
          const divs = await page.$('div'); // this is just a dummy to ensure page is loaded? no.
          // Evaluate in browser context to find by text
          const found = await page.evaluate((label) => {
              const elements = Array.from(document.querySelectorAll('div, span, button'));
              const el = elements.find(e => e.innerText && e.innerText.trim() === label);
              if (el) {
                  el.click();
                  return true;
              }
              return false;
          }, categoryLabel);
          
          if (found) {
              console.log("Clicked category via text search.");
              // Skip the click below since we did it in evaluate
              categoryBtn = "clicked"; 
          }
      }

      if (!categoryBtn) {
          throw new Error("Category button not found");
      }
      
      if (categoryBtn !== "clicked") {
          await categoryBtn.click();
          console.log("Clicked category selector.");
      }

      
      // Initial wait for scroll
      await new Promise(r => setTimeout(r, 2000));

      // Infinite scroll loop
      let previousHeight = 0;
      let noChangeCount = 0;
      const maxNoChange = 3; // Stop after 3 checks with no height increase

      console.log("Starting infinite scroll...");
      
      // 10 iterations max just in case
      for(let i=0; i<30; i++) {
        const currentHeight = await page.evaluate('document.body.scrollHeight');
        if (currentHeight === previousHeight) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
            previousHeight = currentHeight;
        }
        
        if (noChangeCount >= maxNoChange) {
            console.log("No more content loading (height stable). Stopping scroll.");
            break;
        }
        
        // Scroll to bottom
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        
        // Wait for more items to load
        await new Promise(r => setTimeout(r, 1500));
        
        // Log progress (optional)
        const itemCount = await page.evaluate(() => document.querySelectorAll('a[href*="/item-"]').length);
        console.log(`Scroll ${i+1}: Items found so far: ${itemCount}`);
      }

      // Scrape items
      // Using the 'a[href*="/item-"]' selector which seems reliable from inspection
      const products = await page.evaluate(() => {
          const itemLinks = Array.from(document.querySelectorAll('a[href*="/item-"]'));
          
          return itemLinks.map(link => {
              const container = link; 
              // Title is usually in an h3 (checked in browser)
              const titleEl = container.querySelector('h3');
              // Normalize whitespace (replace nbsp with space)
              const title = titleEl ? titleEl.innerText.replace(/\s+/g, ' ').trim() : "";
              
              // Price is in a span, usually starts with $
              // Need to be careful with "Sold Out" or other spans
              const spans = Array.from(container.querySelectorAll('span'));
              const priceEl = spans.find(s => s.innerText.includes('$'));
              const price = priceEl ? priceEl.innerText.trim() : "";
              
              const imgEl = container.querySelector('img');
              const image = imgEl ? imgEl.src : "";
              
              return {
                  title,
                  price,
                  link: link.href,
                  img: image
              };
          });
      });
      
      console.log(`Scraped ${products.length} total items. Filtering for Mezcal...`);

      // Client-side filtering
      const mezcals = [];
      
      for (const p of products) {
          if (isMezcal(p.title)) {
              // Extract size
              let size = extractSize(p.title);

              mezcals.push({
                  brand: extractBrand(p.title),
                  description: p.title,
                  maguey: extractMaguey(p.title),
                  price: p.price,
                  size: size,
                  link: p.link,
                  img: p.img,
                  pack: "Bottle", // default
                  alcohol: "", // hard to get from title usually
                  source: "AB Liquor" 
              });
          }
      }

      console.log(`Found ${mezcals.length} Mezcal items.`);
      return mezcals;

  } catch (error) {
    console.error("Error scraping AB Liquor:", error);
    try {
        if (browser) {
            const page = await browser.pages().then(p => p[0]);
            if (page) {
                await page.screenshot({ path: 'ab_liquor_error.png' });
                console.log("Error screenshot saved to ab_liquor_error.png");
                const html = await page.content();
                const fs = require('fs');
                fs.writeFileSync('ab_liquor_dump.html', html);
                console.log("HTML dump saved to ab_liquor_dump.html");
            }
        }
    } catch (sError) {
        console.error("Failed to take screenshot:", sError);
    }
    return [];
  } finally {
    if (browser) await browser.close();
  }
}


module.exports = { 
    scrapeABLiquor,
    isMezcal,
    extractBrand,
    extractSize,
    extractMaguey
};

// For testing directly:
if (require.main === module) {
    // Mock the browser environment check if needed or just run
    (async () => {
        const items = await scrapeABLiquor();
        console.log("Final items:", items.slice(0, 5)); // Print first 5
        console.log("Total items:", items.length);
    })();
}

