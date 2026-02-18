const KNOWN_BRANDS = [
  "5 Sentidos", "El Jolgorio", "Real Minero", "Rey Campero", "Del Maguey", 
  "Alipus", "Bozal", "Lalocura", "Mal Bien", "Siete Misterios", 
  "Mezcal Vago", "Mezcalosfera", "Agave de Cortes", "La Venenosa", "Derrumbes",
  "Leyenda", "La Medida", "Madre", "Banhez", "Yola", "Wahaka", "Vago"
];

function extractBrand(title) {
    if (!title) return "Unknown";
    const lowerTitle = title.toLowerCase();
    
    const sortedBrands = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
    
    for (const brand of sortedBrands) {
        if (lowerTitle.includes(brand.toLowerCase())) {
            return brand;
        }
    }
    
    return title.split(' ')[0];
}

const titles = [
    "Del Maguey VIDA Clasico 750ML",
    "Del Maguey Mezcal Chichicapa",
    "Ron Del Barrilito Three Star Rum 750ml",
    "Origen Raiz del Espiritu Maguey / Cenizo Silvestre Joven Mezcal"
];

titles.forEach(t => {
    console.log(`Title: "${t}" -> Brand: "${extractBrand(t)}"`);
});
