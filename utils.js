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

module.exports = {
    normalizeSize
};
