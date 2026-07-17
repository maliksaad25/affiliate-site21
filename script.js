/* ============================================================
   script.js — All the interactive logic for TechNest
   This file does 3 main things:
     1. Fetches products from posts.json
     2. Builds and shows the product cards
     3. Handles filtering and "Load More"
   ============================================================ */

/* --- SETTINGS ---
   Change PRODUCTS_PER_PAGE to show more/fewer cards at a time.
*/
const PRODUCTS_PER_PAGE = 6;

/* --- STATE VARIABLES ---
   These variables keep track of what's happening on the page.
*/
let allProducts   = [];    // Every product loaded from posts.json
let filtered      = [];    // Products after a filter is applied
let currentPage   = 1;     // Which "page" of results we're on
let activeFilter  = 'All'; // Which filter button is selected
let searchTerm    = '';    // Current search text, lowercased (empty = no search)
let searchDisplay = '';    // Same search text, original casing — only used for the "No products found" message

/* --- DOM REFERENCES ---
   These link our JavaScript to specific HTML elements.
   document.getElementById('someId') finds an element by its id="" attribute.
*/
const grid        = document.getElementById('product-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const countEl     = document.getElementById('product-count');
/* ============================================================
   STEP 1: FETCH PRODUCTS FROM posts.json
   This runs automatically when the page loads.
   "async/await" means we wait for the file to load before continuing.
   ============================================================ */
async function loadProducts() {
  // Show a loading spinner while we fetch the data
  showLoading();

  try {
    // fetch() reads posts.json — like opening a file
    const response = await fetch('./posts.json');

    // If the file wasn't found, throw an error
    if (!response.ok) throw new Error('Could not load posts.json');

    // Convert the file contents into a JavaScript array
    allProducts = await response.json();

    // Pre-compute a lowercased "title + description" string for every
    // product, once, right after loading. Live search then just checks
    // this one string instead of re-processing the description HTML on
    // every keystroke — keeps typing instant even with hundreds/thousands
    // of products.
    buildSearchIndex();

    // Build the Categories dropdown in the top nav, and the matching
    // one in the hero search bar
    buildCategoryDropdown();
    buildHeroCategorySelect();

    // If the user came from another page's Categories dropdown
    // (e.g. About/Contact/Privacy), the URL will look like
    // index.html?category=Smart+Home — apply that filter.
    // Otherwise, show all products (no filter applied yet).
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get('category');
    const categoryExists = urlCategory && allProducts.some(p => p.category === urlCategory);

    // Likewise, if the user searched from the header on another page,
    // the URL will look like index.html?search=headphones — restore that
    // search term into both search boxes and apply it.
    const urlSearch = params.get('search');
    if (urlSearch) {
      searchDisplay = urlSearch;
      searchTerm = urlSearch.trim().toLowerCase();
      const navInput  = document.getElementById('nav-search-input');
      const heroInput = document.getElementById('hero-search-input');
      if (navInput)  navInput.value  = urlSearch;
      if (heroInput) heroInput.value = urlSearch;
    }

    applyFilter(categoryExists ? urlCategory : 'All');

  } catch (error) {
    // If something went wrong, show an error message
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <p>Could not load products. Make sure posts.json is in the same folder as index.html.</p>
        <p style="margin-top:8px;font-size:0.8rem;">Error: ${error.message}</p>
      </div>`;
    loadMoreBtn.classList.add('hidden');
  }
}

/* ============================================================
   STEP 2: BUILD THE CATEGORIES DROPDOWN AUTOMATICALLY
   This reads the "category" field from each product in posts.json
   and creates one item in the dropdown menu for each unique category.
   It also makes the "Categories" button open and close the menu.
   ============================================================ */
function buildCategoryDropdown() {
  // Find the button, the wrapper, and the empty menu box in index.html
  const toggle   = document.getElementById('categories-nav-toggle');
  const dropdown = document.getElementById('categories-nav-dropdown');
  const menu     = document.getElementById('categories-nav-menu');
  if (!toggle || !dropdown || !menu) return; // Safety check — stop if not found

  // Extract all category values and remove duplicates using Set
  const categories = ['All', ...new Set(allProducts.map(p => p.category))];

  // Build the HTML for each item inside the dropdown menu
  menu.innerHTML = categories.map(cat => `
    <button
      class="nav-dropdown-item ${cat === 'All' ? 'active' : ''}"
      data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  // Clicking the "Categories" button opens or closes the menu
  toggle.addEventListener('click', (e) => {
    e.stopPropagation(); // Stops the click from immediately closing the menu again
    const isOpen = dropdown.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Clicking a category inside the menu applies the filter
  menu.querySelectorAll('.nav-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category; // reads the data-category attribute

      if (grid) {
        // We're on the Home page — filter right here on the page
        applyFilter(category);

        // Close the menu after picking a category
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');

        // Scroll down so the user immediately sees the filtered products
        document.getElementById('product-grid').scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      } else {
        // We're on About/Contact/Privacy — there's no grid here, so send
        // the user to the Home page already filtered to this category.
        window.location.href = `index.html?category=${encodeURIComponent(category)}`;
      }
    });
  });

  // Close the menu if the user clicks anywhere else on the page
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ============================================================
   BUILD THE HERO CATEGORIES DROPDOWN (native <select>)
   Same category list as the header's Categories menu, just filled
   into the <select> that sits in the hero search bar on the Home page.
   ============================================================ */
function buildHeroCategorySelect() {
  const select = document.getElementById('hero-category-select');
  if (!select) return; // Only exists on the Home page

  const categories = ['All', ...new Set(allProducts.map(p => p.category))];

  select.innerHTML = categories.map(cat =>
    `<option value="${cat}">${cat === 'All' ? 'All Categories' : cat}</option>`
  ).join('');
}
/* ============================================================
   STEP 3: APPLY A FILTER
   Called when user clicks a category in the dropdown, or on first load.
   ============================================================ */
function applyFilter(category) {
  activeFilter = category;
  currentPage  = 1; // Reset to first page whenever filter changes

  // Update which dropdown item looks "active" (highlighted) in the
  // header Categories menu
  const menu = document.getElementById('categories-nav-menu');
  if (menu) {
    menu.querySelectorAll('.nav-dropdown-item').forEach(item => {
      item.classList.toggle('active', item.dataset.category === category);
    });
  }

  // Keep the hero Categories dropdown showing the same selection
  const heroSelect = document.getElementById('hero-category-select');
  if (heroSelect && heroSelect.value !== category) heroSelect.value = category;

  // Recompute the visible product list (category + any active search term)
  filtered = computeFiltered();

  // Render (draw) the cards on screen
  renderProducts(true); // true = clear the grid first
}

/* ============================================================
   COMBINE CATEGORY FILTER + SEARCH TERM
   Both the Categories dropdown and the Search box narrow down the
   same underlying list, so a product must match BOTH the selected
   category (or "All") AND the current search text (or no search)
   to be shown. This keeps the two features working together instead
   of one silently overriding the other.
   ============================================================ */
function computeFiltered() {
  return allProducts.filter(p => {
    const matchesCategory = activeFilter === 'All' || p.category === activeFilter;
    const matchesSearch   = !searchTerm || (p._searchIndex && p._searchIndex.includes(searchTerm));
    return matchesCategory && matchesSearch;
  });
}

/* ============================================================
   BUILD SEARCH INDEX
   Runs once, right after posts.json loads. Strips HTML tags out of
   each description and combines it with the title into one lowercased
   string per product (p._searchIndex), so every keystroke in the
   search box is a single, cheap .includes() check per product instead
   of re-parsing HTML each time.
   ============================================================ */
function buildSearchIndex() {
  allProducts.forEach(p => {
    const plainDescription = (p.description || '').replace(/<[^>]*>/g, ' ');
    p._searchIndex = (p.title + ' ' + plainDescription).toLowerCase();
  });
}

/* ============================================================
   HANDLE SEARCH INPUT
   Called every time the user types in EITHER search box — the
   header one or the new hero one (only relevant on pages that
   have the product grid). Keeps both boxes showing the same text.
   ============================================================ */
function handleSearch(value) {
  searchDisplay = value;
  searchTerm    = value.trim().toLowerCase();
  currentPage   = 1;

  // Keep both search boxes (header dropdown + hero bar) in sync
  const navInput  = document.getElementById('nav-search-input');
  const heroInput = document.getElementById('hero-search-input');
  if (navInput  && navInput.value  !== value) navInput.value  = value;
  if (heroInput && heroInput.value !== value) heroInput.value = value;

  filtered      = computeFiltered();
  renderProducts(true);
}

/* ============================================================
   ESCAPE HTML
   Small safety helper so the search term the user typed can be
   shown back inside the "No products found" message without any
   risk of it being interpreted as HTML.
   ============================================================ */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   SEARCH DROPDOWN (header)
   Opens/closes the search panel using the exact same pattern as the
   Categories dropdown above, and wires up live search + Enter-to-jump
   behaviour. This runs on every page (the search box is in the shared
   header), even pages with no product grid.
   ============================================================ */
function setupSearchDropdown() {
  const toggle   = document.getElementById('search-nav-toggle');
  const dropdown = document.getElementById('search-nav-dropdown');
  const input    = document.getElementById('nav-search-input');
  if (!toggle || !dropdown || !input) return; // Safety check

  // Open/close the panel
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) input.focus();
  });

  // Close the panel if the user clicks anywhere else on the page
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Live search: update results as the user types, with a short debounce
  // (120ms) so fast typing doesn't re-filter on every single keystroke —
  // keeps things smooth even with a large product catalog.
  let debounceTimer;
  input.addEventListener('input', () => {
    if (!grid) return; // No product grid on this page — nothing to filter live
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => handleSearch(input.value), 120);
  });

  // Pressing Enter on a page with no product grid (About/Contact/Privacy/
  // product page) jumps to the Home page with the search already applied.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (grid) return; // Already filtering live on this page — nothing more to do
    const value = input.value.trim();
    if (value) {
      window.location.href = `index.html?search=${encodeURIComponent(value)}`;
    }
  });
}

/* ============================================================
   HERO SEARCH BAR (Home page only)
   Wires up the big search input + Categories dropdown that sit
   directly below the hero heading. Both just feed into the same
   handleSearch() / applyFilter() functions the header controls use,
   so results stay in sync no matter which box the visitor types in.
   ============================================================ */
function setupHeroSearch() {
  const heroInput  = document.getElementById('hero-search-input');
  const heroSelect = document.getElementById('hero-category-select');

  // Live search, same short debounce as the header search box
  if (heroInput) {
    let debounceTimer;
    heroInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSearch(heroInput.value), 120);
    });
  }

  // Picking a category applies it exactly like the header dropdown does
  if (heroSelect) {
    heroSelect.addEventListener('change', () => {
      applyFilter(heroSelect.value);
    });
  }
}

/* ============================================================
   STEP 4: RENDER PRODUCTS (Draw cards on screen)
   clearGrid = true means we wipe existing cards first (used when filtering)
   clearGrid = false means we ADD to existing cards (used by Load More)
   ============================================================ */
function renderProducts(clearGrid = false) {
  if (clearGrid) grid.innerHTML = '';

  // Figure out which products to show on this "page"
  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const end   = start + PRODUCTS_PER_PAGE;
  const pageItems = filtered.slice(start, end);

  // Update the "X products found" counter
  countEl.innerHTML = `<span>${filtered.length}</span> product${filtered.length !== 1 ? 's' : ''} found`;

  // If there are no products to show, display empty state
  if (filtered.length === 0) {
    const message = searchTerm
      ? `No products found for "${escapeHTML(searchDisplay.trim())}".`
      : 'No products found in this category.';
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <p>${message}</p>
      </div>`;
    loadMoreBtn.classList.add('hidden');
    return;
  }

  // For each product in this page, create a card and add it to the grid
  pageItems.forEach((product, index) => {
    const card = createCard(product, index);
    grid.appendChild(card);
  });

  // Show or hide the "Load More" button
  const totalShown = end;
  if (totalShown >= filtered.length) {
    loadMoreBtn.classList.add('hidden');    // All products shown — hide button
  } else {
    loadMoreBtn.classList.remove('hidden'); // More to show — show button
  }
}

/* ============================================================
   STEP 5: CREATE A SINGLE PRODUCT CARD
   This builds the HTML for one product and returns it.
   ============================================================ */
function createCard(product, index) {
  // Create a <div> element for the card
  const card = document.createElement('div');
  card.className = 'card';

  // Add a small delay per card for a staggered animation effect
  card.style.animationDelay = `${index * 60}ms`;

  // Calculate discount % if both prices exist
  let discountHTML = '';
  if (product.original_price && product.price) {
    const orig = parseFloat(product.original_price.replace(/[^0-9.]/g, ''));
    const curr = parseFloat(product.price.replace(/[^0-9.]/g, ''));
    if (orig > curr) {
      const pct = Math.round((1 - curr / orig) * 100);
      discountHTML = `<span class="discount-badge">-${pct}%</span>`;
    }
  }

  // Label badge (e.g. "Best Seller", "Hot Deal")
  const labelHTML = product.badge
    ? `<span class="label-badge">${product.badge}</span>`
    : '';

  // Strikethrough original price
  const origPriceHTML = product.original_price
    ? `<span class="original-price">${product.original_price}</span>`
    : '';

  // Short description preview — max 100 characters, then "..."
  // Full description lives on the product details page
  const shortDesc = product.description.length > 100
    ? product.description.slice(0, 100).trimEnd() + '…'
    : product.description;

  // The link to the product details page
  // Passes the product id in the URL e.g. product.html?id=1
  const detailURL = `product.html?id=${product.id}`;

  // Fill in the card's HTML using the product data
  // CHANGES FROM BEFORE:
  //   - Image is now wrapped in a link → clicks open product.html
  //   - Title is now a link → clicks open product.html
  //   - Description shows short preview only
  //   - "Read More" link replaces the old "Buy Now" button on the card
  //   - Buy Now button has moved to product.html
  card.innerHTML = `
    <div class="card-image">
      <a href="${detailURL}">
        <img
          src="${product.image}"
          alt="${product.title}"
          loading="lazy"
          onerror="this.src='https://placehold.co/400x250/1e1e24/6ee7b7?text=No+Image'">
      </a>
      <span class="card-category">${product.category}</span>
      ${discountHTML}
      ${labelHTML}
    </div>
    <div class="card-body">
      <a href="${detailURL}" class="card-title-link">
        <h3 class="card-title">${product.title}</h3>
      </a>
      <p class="card-desc">${shortDesc}</p>
      <div class="card-footer">
        <div class="price-group">
          <span class="card-price">${product.price}</span>
          ${origPriceHTML}
        </div>
        <a href="${detailURL}" class="read-more-btn">See Deal →</a>
      </div>
    </div>
  `;

  return card;
}

/* ============================================================
   STEP 6: LOAD MORE BUTTON
   When clicked, shows the next "page" of products.

   FIX: The old scrollIntoView() was causing an upward page jump
   because the layout shifted when new cards were added.

   New approach:
   1. Save the exact scroll position BEFORE adding cards
   2. Add the new cards
   3. Wait for the browser to paint them (double requestAnimationFrame)
   4. Silently restore the saved scroll position
   Result: page stays exactly where the user was — no jump.
   ============================================================ */
// Only Home page has this button, so check it exists first
// (About/Contact/Privacy don't have a product grid or Load More button)
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {

    // Step 1 — Lock scroll position before anything changes
    const scrollYBefore = window.scrollY;

    // Step 2 — Load the next page of products
    currentPage++;
    renderProducts(false); // false = add cards, don't clear existing ones

    // Step 3 — After browser paints new cards, silently restore position
    // Double requestAnimationFrame ensures the DOM has fully updated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollYBefore, behavior: 'instant' });
      });
    });

  });
}

/* ============================================================
   HELPER: SHOW LOADING SPINNER
   Called while posts.json is being fetched.
   ============================================================ */
function showLoading() {
  if (!grid) return; // Safety check — no grid on About/Contact/Privacy pages
  grid.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading products…</p>
    </div>`;
  loadMoreBtn.classList.add('hidden');
}

/* ============================================================
   START EVERYTHING
   This is the entry point — runs when the page first loads.

   The product grid (with cards, filtering, Load More) only exists
   on the Home page (#product-grid is only in index.html).
   About/Contact/Privacy don't have that grid, but they DO have the
   Categories dropdown in the header — so on those pages we still
   fetch posts.json just to build the dropdown, without touching
   any grid-related code.
   ============================================================ */
// Search box lives in the shared header, so it's wired up on every page —
// including ones with no product grid (About/Contact/Privacy/product page),
// where it just jumps to the Home page with the search applied.
setupSearchDropdown();

// The hero search bar only exists on the Home page (elements are null
// everywhere else, and setupHeroSearch() safely no-ops in that case).
setupHeroSearch();

if (grid) {
  loadProducts();
} else {
  buildCategoryDropdownOnly();
}

async function buildCategoryDropdownOnly() {
  try {
    const response = await fetch('./posts.json');
    if (!response.ok) throw new Error('Could not load posts.json');
    allProducts = await response.json();
    buildCategoryDropdown();
  } catch (error) {
    // If this fails, the Categories dropdown just won't have items —
    // it won't break the rest of the page.
    console.error('Could not build Categories dropdown:', error);
  }
}
  
