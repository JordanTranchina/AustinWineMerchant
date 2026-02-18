document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");
  const minPriceInput = document.getElementById("minPriceInput");
  const maxPriceInput = document.getElementById("maxPriceInput");
  const statsDiv = document.getElementById("stats");
  const loadingDiv = document.getElementById("loading");
  const inventoryTable = document.getElementById("inventoryTable");

  const refreshBtn = document.getElementById("refreshBtn");

  let inventory = []; // Current state
  let originalInventory = []; // immutable copy for reset

  // Sort State: { column: string | null, direction: 'asc' | 'desc' | null }
  let sortState = { column: null, direction: null };

  // Initial Fetch
  fetchInventory();

  refreshBtn.addEventListener("click", () => {
    fetchInventory();
  });

  function fetchInventory() {
    // Show loading state on button or table?
    refreshBtn.classList.add("spinning");
    refreshBtn.disabled = true;
    statsDiv.textContent = "Updating...";

    fetch("/api/inventory")
      .then((response) => response.json())
      .then((data) => {
        const processed = data.map((item) => ({
          ...item,
          priceValue: parseFloat(item.price.replace(/[^0-9.]/g, "")) || 0,
        }));

        originalInventory = [...processed]; // Save original order
        inventory = [...processed];

        // If we were sorted, re-apply sort? Or reset?
        // Let's reset sort on refresh to show fresh data order normally.
        sortState = { column: null, direction: null };
        document.querySelectorAll(".sort-icon").forEach((icon) => (icon.textContent = "⇅"));

        renderTable(inventory);
        loadingDiv.style.display = "none";
        inventoryTable.style.display = "table";
        updateStats(inventory.length);

        // Re-apply filter if exists
        if (searchInput.value || minPriceInput.value || maxPriceInput.value) {
          applyFiltersAndSort();
        }
      })
      .catch((error) => {
        console.error("Error fetching inventory:", error);

        // Only show big error error if table is empty
        if (inventory.length === 0) {
          loadingDiv.innerHTML = `<p style="color: #ff6b6b">Error loading inventory. Please try again later.</p>`;
        } else {
          alert("Failed to refresh inventory. Please try again.");
        }
      })
      .finally(() => {
        refreshBtn.classList.remove("spinning");
        refreshBtn.disabled = false;
      });
  }

  // Render Table
  function renderTable(data) {
    tableBody.innerHTML = "";

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px;">No spirits found matching your search.</td></tr>`;
      return;
    }

    data.forEach((item) => {
      const row = document.createElement("tr");

      // Highlight search terms if needed, but for now simple text
      row.innerHTML = `
                <td class="col-brand">${item.brand}</td>
                <td class="col-maguey">${item.maguey}</td>
                <td class="col-desc">
                    <a href="https://www.google.com/search?q=${encodeURIComponent(item.brand + ' ' + item.description)}" target="_blank" class="desc-link">
                        ${item.description}
                    </a>
                </td>
                <td class="col-size">${item.size}</td>
                <td class="col-alcohol">${item.alcohol}</td>
                <td class="col-store">${item.source || 'Austin Wine Merchant'}</td>
                <td class="col-price">${item.price}</td>
            `;
      tableBody.appendChild(row);
    });
  }

  // Update Stats
  function updateStats(count) {
    statsDiv.textContent = `${count} Bottles Discovered`;
  }

  const storeFilter = document.getElementById("storeFilter");

  // Search / Filter Listeners
  searchInput.addEventListener("input", applyFiltersAndSort);
  minPriceInput.addEventListener("input", applyFiltersAndSort);
  maxPriceInput.addEventListener("input", applyFiltersAndSort);
  storeFilter.addEventListener("change", applyFiltersAndSort);

  // Sort
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const column = th.dataset.sort;

      // Cycle state: None -> Asc -> Desc -> None
      if (sortState.column === column) {
        if (sortState.direction === "asc") sortState.direction = "desc";
        else if (sortState.direction === "desc") {
          sortState.direction = null;
          sortState.column = null;
        }
      } else {
        sortState.column = column;
        sortState.direction = "asc";
      }

      updateSortIcons();
      applyFiltersAndSort();
    });
  });

  function updateSortIcons() {
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      const icon = th.querySelector(".sort-icon");
      const col = th.dataset.sort;

      if (sortState.column === col) {
        icon.textContent = sortState.direction === "asc" ? "↑" : "↓";
        th.style.color = "#fff"; // Highlight active column
        th.style.background = "rgba(212, 175, 55, 0.1)";
      } else {
        icon.textContent = "⇅";
        th.style.color = "";
        th.style.background = "";
      }
    });
  }

  function normalizeText(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function applyFiltersAndSort() {
    // Split by spaces to allow multiple terms
    const rawTerms = searchInput.value
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const positiveTerms = [];
    const negativeTerms = [];

    rawTerms.forEach((term) => {
      if (term.startsWith("-") && term.length > 1) {
        negativeTerms.push(normalizeText(term.substring(1)));
      } else {
        positiveTerms.push(normalizeText(term));
      }
    });

    const minPrice = parseFloat(minPriceInput.value) || 0;
    const maxPrice = parseFloat(maxPriceInput.value) || Infinity;
    const selectedStore = storeFilter.value;

    // 1. Filter original list
    let result = originalInventory.filter((item) => {
      const itemText = normalizeText(item.brand + " " + item.maguey + " " + item.description + " " + item.price + " " + item.alcohol);

      // Must match ALL positive terms (AND logic for inclusions)
      const matchesAllPositive = positiveTerms.every((term) => itemText.includes(term));

      // Must NOT match ANY negative terms (OR logic for exclusions)
      const matchesNoNegative = negativeTerms.every((term) => !itemText.includes(term));

      const matchesPrice = item.priceValue >= minPrice && item.priceValue <= maxPrice;
      
      let matchesStore = true;
      if (selectedStore !== "all") {
          // Logic: item.source should match. If item.source is undefined, assume "Austin Wine Merchant" (legacy)?
          // New scraping adds source.
          const itemSource = item.source || "Austin Wine Merchant";
          matchesStore = itemSource === selectedStore;
      }

      return matchesAllPositive && matchesNoNegative && matchesPrice && matchesStore;
    });

    // 2. Sort filtered list if needed
    if (sortState.column && sortState.direction) {
      result.sort((a, b) => {
        let valA, valB;
        const column = sortState.column;

        if (column === "price") {
          valA = a.priceValue;
          valB = b.priceValue;
        } else {
          valA = a[column]?.toLowerCase() || "";
          valB = b[column]?.toLowerCase() || "";
        }

        if (valA < valB) return sortState.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortState.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    inventory = result; // Update current view state
    renderTable(result);
    updateStats(result.length);
  }
});
