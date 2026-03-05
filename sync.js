import { scrapeAustinWineMerchant } from './austinWineScraper.js';
import { scrapeABLiquor } from './abLiquorScraper.js';
import { supabase } from './db.js';

async function syncInventory() {
  console.log('Starting inventory sync...');
  const scrapeStartTime = new Date().toISOString();

  try {
    // Run both scrapers
    const [austinWineResults, abLiquorResults] = await Promise.all([
      scrapeAustinWineMerchant(),
      scrapeABLiquor()
    ]);

    const combinedResults = [...austinWineResults, ...abLiquorResults];
    console.log(`Scraping complete. Found ${combinedResults.length} bottles.`);

    if (combinedResults.length === 0) {
      console.warn("No bottles scraped. Aborting sync.");
      return;
    }

    // Deduplicate combinedResults by source, description, and size
    const uniqueResultsMap = new Map();
    for (const bottle of combinedResults) {
      const key = `${bottle.source}|${bottle.description}|${bottle.size || '750ml'}`;
      if (!uniqueResultsMap.has(key)) {
        uniqueResultsMap.set(key, bottle);
      }
    }
    const uniqueResults = Array.from(uniqueResultsMap.values());

    // Insert or update records in the database
    const { data, error } = await supabase
      .from('mezcal_bottles')
      .upsert(
        uniqueResults.map((bottle) => ({
          source: bottle.source,
          description: bottle.description,
          brand: bottle.brand || null,
          maguey: bottle.maguey || null,
          size: bottle.size || '750ml',
          price: bottle.price,
          link: bottle.link || null,
          img: bottle.img || null,
          alcohol: bottle.alcohol || null,
          last_seen_at: scrapeStartTime,
          is_in_stock: true,
        })),
        { onConflict: 'source, description, size' }
      );

    if (error) {
      console.error('Error inserting records:', error);
      throw error;
    }

    console.log(`Records correctly upserted into 'mezcal_bottles'.`);

    // Mark missing items as out of stock
    console.log("Marking stale items as out of stock...");
    const { error: cleanupError } = await supabase
      .from('mezcal_bottles')
      .update({ is_in_stock: false })
      .lt('last_seen_at', scrapeStartTime);

    if (cleanupError) {
      console.error('Error cleaning up old records:', cleanupError);
      throw cleanupError;
    }

    console.log('Database sync complete.');
  } catch (error) {
    console.error('Failed to sync inventory:', error);
    process.exit(1);
  }
}

syncInventory();
