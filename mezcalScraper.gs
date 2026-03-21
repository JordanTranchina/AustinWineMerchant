/**
 * Precision scraper for Mezcal inventory.
 */
function scrapeMezcalInventory() {
  const url = "https://www.theaustinwinemerchant.com/spirits.html";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  try {
    // Adding a User-Agent makes the request look like it's coming from a browser
    const options = {
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    const response = UrlFetchApp.fetch(url, options);
    const html = response.getContentText();
    // 1. Identify where the "Mezcal" section actually starts.
    // We look for the Mezcal header text to avoid grabbing Vodka.
    const mezcalStartIndex = html.search(/<h[1-6][^>]*>Mezcal<\/h[1-6]>/i);
    // If header search fails, try searching for the anchor name
    const searchPoint = (mezcalStartIndex > -1) ? mezcalStartIndex : html.indexOf('name="Mezcal"');
    if (searchPoint === -1) {
      throw new Error("Could not find the Mezcal section. The site might have updated its layout.");
    }
    // 2. Cut the HTML to start FROM the Mezcal section
    const mezcalSectionHtml = html.substring(searchPoint);
    // 3. Find the first table AFTER that point
    const tableMatch = mezcalSectionHtml.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      throw new Error("Found the Mezcal header, but no inventory table followed it.");
    }
    const tableContent = tableMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let results = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      let rowHtml = rowMatch[1];
      let cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        let cellData = cellMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(cellData);
      }
      // Validation: Ensure it's a product row and not a header/spacer
      if (cells.length >= 4 && cells[0].toLowerCase() !== "pack" && cells[3] !== "") {
        results.push(cells);
      }
    }
    // Update the Sheet
    sheet.clear();
    const headers = [["Pack", "Size (ml)", "Alcohol %", "Description", "Bottle Price"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers).setFontWeight("bold");
    if (results.length > 0) {
      sheet.getRange(2, 1, results.length, results[0].length).setValues(results);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, 5);
      showMessage("Success! Pulled " + results.length + " Mezcal items.");
    } else {
      showMessage("Found the table, but it was empty. The items might be out of stock.");
    }
  } catch (e) {
    Logger.log(e.toString());
    showMessage("Error: " + e.message);
  }
}

/**
 * Shows an alert when a UI is available (manual run), otherwise logs the message.
 * getUi() throws when called from a time-based trigger, so we catch that here.
 */
function showMessage(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Inventory Tools')
    .addItem('Update Mezcal List', 'scrapeMezcalInventory')
    .addToUi();
}
