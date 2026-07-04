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

/* --- DOM REFERENCES ---
   These link our JavaScript to specific HTML elements.
   document.getElementById('someId') finds an element by its id="" attribute.
*/
const grid        = document.getElementById('product-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const countEl     = document.getElementById('product-count');
const filterGroup = document.getElementById('filter-group');

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

    // Build the filter buttons from the categories in posts.json
    buildFilters();

    // Show all products (no filter applied yet)
    applyFilter('All');

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
   STEP 2: BUILD FILTER BUTTONS AUTOMATICALLY
   This reads the "category" field from each product in posts.json
   and creates a button for each unique category.
   ============================================================ */
function buildFilters() {
  // Extract all category values and remove duplicates using Set
  const categories = ['All', ...new Set(allProducts.map(p => p.category))];

  // Build the HTML for each filter button
  filterGroup.innerHTML = categories.map(cat => `
    <button
      class="filter-btn ${cat === 'All' ? 'active' : ''}"
      data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  // Add a click event to each button
  filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyFilter(btn.dataset.category); // dataset.category reads the data-category attribute
    });
  });
}

/* ============================================================
   STEP 3: APPLY A FILTER
   Called when user clicks a filter button, or on first load.
   ============================================================ */
function applyFilter(category) {
  activeFilter = category;
  currentPage  = 1; // Reset to first page whenever filter changes

  // Update which button looks "active" (highlighted)
  filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  // Filter the product list:
  // If "All" is selected, keep everything.
  // Otherwise, keep only products matching the selected category.
  filtered = (category === 'All')
    ? allProducts
    : allProducts.filter(p => p.category === category);

  // Render (draw) the cards on screen
  renderProducts(true); // true = clear the grid first
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
    grid.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🔍</div>
        <p>No products found in this category.</p>
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
        <a href="${detailURL}" class="read-more-btn">See Details →</a>
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

/* ============================================================
   HELPER: SHOW LOADING SPINNER
   Called while posts.json is being fetched.
   ============================================================ */
function showLoading() {
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
   ============================================================ */
loadProducts();
