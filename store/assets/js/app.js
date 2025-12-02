// app.js – handle data loading and UI interactions for the Nahj Oil & Gas store

// Fetch product data from JSON
async function fetchProducts() {
    try {
        const response = await fetch('assets/data/products.json');
        if (!response.ok) throw new Error('فشل تحميل بيانات المنتجات');
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

// LocalStorage helpers for RFQ cart
function getCart() {
    const cart = localStorage.getItem('rfqCart');
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem('rfqCart', JSON.stringify(cart));
}

function addToCart(productId) {
    const cart = getCart();
    cart.push(productId);
    saveCart(cart);
    alert('تمت إضافة المنتج إلى طلبك');
}

function removeFromCart(productId) {
    let cart = getCart();
    const index = cart.indexOf(productId);
    if (index !== -1) {
        cart.splice(index, 1);
        saveCart(cart);
    }
}

function clearCart() {
    localStorage.removeItem('rfqCart');
}

// Utility to parse query parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Render functions
async function renderIndexPage() {
    const products = await fetchProducts();
    const productsContainer = document.getElementById('productsContainer');
    const categoryFilters = document.getElementById('categoryFilters');
    const searchInput = document.getElementById('searchInput');

    let currentCategory = 'all';

    // Build unique category list
    const categories = Array.from(new Set(products.map((p) => p.category)));
    categories.sort();
    // Add 'all' category in Arabic
    const categoryButtons = [];
    categoryButtons.push({ key: 'all', label: 'الكل' });
    categories.forEach((cat) => categoryButtons.push({ key: cat, label: cat }));

    // Render category buttons
    categoryButtons.forEach(({ key, label }) => {
        const button = document.createElement('button');
        button.className = 'btn btn-outline-primary';
        button.dataset.category = key;
        button.textContent = label;
        if (key === currentCategory) button.classList.add('active');
        button.addEventListener('click', () => {
            currentCategory = key;
            // Update active state
            document.querySelectorAll('#categoryFilters .btn').forEach((btn) => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            filterAndDisplay();
        });
        categoryFilters.appendChild(button);
    });

    // Filter and render products
    function filterAndDisplay() {
        const searchTerm = searchInput.value.toLowerCase();
        productsContainer.innerHTML = '';
        products
            .filter((product) => {
                const matchesCategory = currentCategory === 'all' || product.category === currentCategory;
                const matchesSearch =
                    product.name.toLowerCase().includes(searchTerm) ||
                    product.partNumber.toLowerCase().includes(searchTerm);
                return matchesCategory && matchesSearch;
            })
            .forEach((product) => {
                const col = document.createElement('div');
                col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
                col.innerHTML = `
                    <div class="card product-card h-100 shadow-sm">
                        <img src="${product.image}" class="card-img-top" alt="${product.name}">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text small text-muted mb-2">كود المنتج: ${product.partNumber}</p>
                            <p class="card-text small text-muted mb-3">التصنيف: ${product.category}</p>
                            <div class="mt-auto">
                                <a href="product.html?id=${product.id}" class="btn btn-sm btn-outline-primary w-100 mb-2">تفاصيل</a>
                                <button class="btn btn-sm btn-primary w-100 add-to-cart-btn" data-id="${product.id}">أضف إلى الطلب</button>
                            </div>
                        </div>
                    </div>`;
                productsContainer.appendChild(col);
            });
        // Attach event listeners to add-to-cart buttons
        document.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const productId = btn.dataset.id;
                addToCart(productId);
            });
        });
    }

    // Initial render
    filterAndDisplay();

    // Search listener
    searchInput.addEventListener('input', filterAndDisplay);
}

async function renderProductPage() {
    const productId = getQueryParam('id');
    if (!productId) return;
    const products = await fetchProducts();
    const product = products.find((p) => String(p.id) === String(productId));
    const container = document.getElementById('productDetailContainer');
    if (!product) {
        container.innerHTML = '<p class="text-danger">لم يتم العثور على المنتج.</p>';
        return;
    }
    // Build images carousel if multiple images
    let imagesHtml = '';
    if (Array.isArray(product.images) && product.images.length > 1) {
        const carouselId = 'productCarousel';
        const indicators = product.images
            .map((img, index) => `<button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${index}" class="${index === 0 ? 'active' : ''}" aria-current="${index === 0 ? 'true' : 'false'}" aria-label="Slide ${index + 1}"></button>`)
            .join('');
        const slides = product.images
            .map((img, index) => `
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                    <img src="${img}" class="d-block w-100" alt="${product.name}">
                </div>`)
            .join('');
        imagesHtml = `
            <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
                <div class="carousel-indicators">
                    ${indicators}
                </div>
                <div class="carousel-inner">
                    ${slides}
                </div>
                <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Previous</span>
                </button>
                <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                    <span class="visually-hidden">Next</span>
                </button>
            </div>`;
    } else {
        // Single image
        imagesHtml = `<img src="${product.image || (product.images && product.images[0])}" class="img-fluid rounded mb-4" alt="${product.name}">`;
    }
    // Build specs list
    let specsHtml = '';
    if (product.specs && product.specs.length > 0) {
        specsHtml = '<ul class="list-group list-group-flush mb-3">';
        product.specs.forEach((spec) => {
            specsHtml += `<li class="list-group-item">${spec}</li>`;
        });
        specsHtml += '</ul>';
    }
    // Build datasheet link
    let datasheetHtml = '';
    if (product.datasheet) {
        datasheetHtml = `<p><strong>ملف الداتا شيت:</strong> <a href="${product.datasheet}" target="_blank">تحميل</a></p>`;
    }
    // Build video
    let videoHtml = '';
    if (product.video) {
        // Use HTML5 video tag
        videoHtml = `
            <div class="mb-3">
                <video controls class="w-100">
                    <source src="${product.video}" type="video/mp4">
                    متصفحك لا يدعم تشغيل الفيديو.
                </video>
            </div>`;
    }

    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                ${imagesHtml}
            </div>
            <div class="col-md-6">
                <h2>${product.name}</h2>
                <p class="text-muted">كود المنتج: ${product.partNumber}</p>
                <p class="text-muted">التصنيف: ${product.category}</p>
                <p>${product.description || ''}</p>
                ${specsHtml}
                ${datasheetHtml}
                ${videoHtml}
                <button class="btn btn-primary mb-3" id="addToCartBtn">أضف إلى الطلب</button>
                <div>
                    <a href="rfq.html" class="btn btn-outline-secondary">عرض طلبك</a>
                </div>
            </div>
        </div>`;
    // Add event listener for add to cart
    document.getElementById('addToCartBtn').addEventListener('click', () => {
        addToCart(product.id);
    });
}

async function renderRfqPage() {
    const products = await fetchProducts();
    const rfqProductsContainer = document.getElementById('rfqProducts');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const sendRfqBtn = document.getElementById('sendRfqBtn');

    function updateRfqList() {
        const cart = getCart();
        rfqProductsContainer.innerHTML = '';
        if (cart.length === 0) {
            rfqProductsContainer.innerHTML = '<p class="text-muted">لا توجد منتجات في طلبك حالياً.</p>';
            return;
        }
        // Build list of product items with quantities
        // Create an object of id -> quantity
        const counts = {};
        cart.forEach((id) => {
            counts[id] = (counts[id] || 0) + 1;
        });
        Object.keys(counts).forEach((id) => {
            const product = products.find((p) => String(p.id) === String(id));
            if (!product) return;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'rfq-item d-flex justify-content-between align-items-center';
            itemDiv.innerHTML = `
                <div>
                    <strong>${product.name}</strong><br>
                    <small>كود: ${product.partNumber}</small><br>
                    <small>الكمية: ${counts[id]}</small>
                </div>
                <button class="btn btn-sm btn-outline-danger remove-item-btn" data-id="${product.id}">حذف</button>
            `;
            rfqProductsContainer.appendChild(itemDiv);
        });
        // Attach removal events
        document.querySelectorAll('.remove-item-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                removeFromCart(id);
                updateRfqList();
            });
        });
    }

    updateRfqList();

    clearCartBtn.addEventListener('click', () => {
        clearCart();
        updateRfqList();
    });

    sendRfqBtn.addEventListener('click', () => {
        // Gather user info
        const name = document.getElementById('clientName').value.trim();
        const company = document.getElementById('clientCompany').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const message = document.getElementById('clientMessage').value.trim();
        if (!name || !company || !email || !phone) {
            alert('يرجى ملء جميع الحقول المطلوبة.');
            return;
        }
        const cart = getCart();
        if (cart.length === 0) {
            alert('لا توجد منتجات في طلبك.');
            return;
        }
        // Build summary of items
        const counts = {};
        cart.forEach((id) => {
            counts[id] = (counts[id] || 0) + 1;
        });
        const itemsLines = [];
        Object.keys(counts).forEach((id) => {
            const product = products.find((p) => String(p.id) === String(id));
            if (product) {
                itemsLines.push(`${product.name} (كود ${product.partNumber}) – كمية: ${counts[id]}`);
            }
        });
        let body = '';
        body += `الاسم: ${name}\n`;
        body += `الشركة: ${company}\n`;
        body += `البريد الإلكتروني: ${email}\n`;
        body += `رقم الهاتف: ${phone}\n\n`;
        body += 'قائمة المنتجات:\n';
        body += itemsLines.join('\n');
        if (message) {
            body += `\n\nملاحظات إضافية:\n${message}`;
        }
        // Encode body for mailto
        const mailtoBody = encodeURIComponent(body);
        const mailtoLink = `mailto:rfq@nahjalrasanah.com?subject=طلب عرض سعر&body=${mailtoBody}`;
        // Use window.location to open mail client
        window.location.href = mailtoLink;
    });
}

// Determine which page to render
document.addEventListener('DOMContentLoaded', () => {
    const isIndex = document.getElementById('productsContainer');
    const isProduct = document.getElementById('productDetailContainer');
    const isRfq = document.getElementById('rfqProducts');
    if (isIndex) {
        renderIndexPage();
    } else if (isProduct) {
        renderProductPage();
    } else if (isRfq) {
        renderRfqPage();
    }
});