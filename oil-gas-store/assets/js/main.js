// assets/js/main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { firebaseConfig } from './firebase-config.js';
import AnalyticsTracker from './analytics.js';
import SEOOptimizer from './seo.js';
import OfflineManager from './offline.js';
import { 
  LocalStorageManager, 
  showToast, 
  formatDate,
  debounce 
} from './utilities.js';

class NahjApp {
  constructor() {
    // Initialize Firebase
    this.app = initializeApp(firebaseConfig);
    
    // Initialize managers
    this.storage = new LocalStorageManager();
    this.analytics = new AnalyticsTracker(this.app);
    this.seo = new SEOOptimizer();
    this.offline = new OfflineManager();
    
    // App state
    this.state = {
      user: null,
      cart: [],
      favorites: [],
      recentlyViewed: []
    };
    
    this.init();
  }
  
  async init() {
    console.log('Initializing Nahj App...');
    
    // Load state from storage
    this.loadState();
    
    // Setup global event listeners
    this.setupEventListeners();
    
    // Setup SEO for current page
    this.setupSEO();
    
    // Start analytics tracking
    this.startAnalytics();
    
    // Check for updates
    this.checkForUpdates();
    
    console.log('Nahj App initialized successfully');
  }
  
  loadState() {
    this.state.cart = this.storage.get('cart', []);
    this.state.favorites = this.storage.get('favorites', []);
    this.state.recentlyViewed = this.storage.get('recentlyViewed', []);
  }
  
  saveState() {
    this.storage.set('cart', this.state.cart);
    this.storage.set('favorites', this.state.favorites);
    this.storage.set('recentlyViewed', this.state.recentlyViewed);
  }
  
  setupEventListeners() {
    // Global search
    const searchForm = document.getElementById('global-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => this.handleGlobalSearch(e));
    }
    
    // Cart updates
    document.addEventListener('cartUpdated', (e) => {
      this.updateCartUI(e.detail.cart);
    });
    
    // User authentication
    document.addEventListener('authStateChanged', (e) => {
      this.handleAuthChange(e.detail.user);
    });
    
    // Print functionality
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        this.printPage();
      }
    });
    
    // Back to top button
    window.addEventListener('scroll', debounce(() => {
      this.toggleBackToTop();
    }, 100));
  }
  
  setupSEO() {
    const pageData = this.getPageData();
    this.seo.updateMetaTags(pageData);
    this.seo.lazyLoadImages();
    this.seo.preloadCriticalAssets();
  }
  
  getPageData() {
    const page = document.body.getAttribute('data-page');
    
    const pageConfigs = {
      'home': {
        title: 'Oil & Gas Equipment Supplier in Iraq',
        description: 'Nahj Al-Rasanah - Premium Oil & Gas Equipment, Valves, Instrumentation, and Spare Parts Supplier in Iraq',
        type: 'website'
      },
      'product': {
        title: document.querySelector('h1')?.textContent || 'Product Details',
        description: document.querySelector('.product-description')?.textContent || '',
        type: 'product'
      },
      'rfq': {
        title: 'Request for Quotation',
        description: 'Submit your RFQ for Oil & Gas equipment',
        type: 'website'
      }
    };
    
    return pageConfigs[page] || pageConfigs.home;
  }
  
  startAnalytics() {
    // Track page view
    const pageName = document.body.getAttribute('data-page') || 'unknown';
    this.analytics.trackPageView(pageName);
    
    // Track clicks
    this.analytics.trackClicks();
    
    // Track scroll depth
    this.analytics.trackScrollDepth();
    
    // Track errors
    window.addEventListener('error', (e) => {
      this.analytics.trackError(e.error, {
        url: window.location.href
      });
    });
    
    // Track performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'largest-contentful-paint') {
            this.analytics.trackEvent('performance_lcp', {
              value: entry.startTime,
              url: window.location.href
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }
  
  async handleGlobalSearch(e) {
    e.preventDefault();
    
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;
    
    // Track search
    await this.analytics.trackSearch(searchTerm);
    
    // Redirect to search results
    window.location.href = `/search.html?q=${encodeURIComponent(searchTerm)}`;
  }
  
  updateCartUI(cart) {
    // Update cart count
    const cartCount = cart.reduce((total, item) => total + item.qty, 0);
    
    document.querySelectorAll('.cart-count').forEach(element => {
      if (cartCount > 0) {
        element.textContent = cartCount;
        element.classList.remove('d-none');
      } else {
        element.classList.add('d-none');
      }
    });
    
    // Update cart total
    const cartTotal = cart.reduce((total, item) => total + (item.price * item.qty), 0);
    document.querySelectorAll('.cart-total').forEach(element => {
      element.textContent = this.formatCurrency(cartTotal);
    });
  }
  
  async handleAuthChange(user) {
    this.state.user = user;
    
    if (user) {
      // User logged in
      showToast(`مرحباً ${user.email}`, 'success');
      
      // Sync offline data
      await this.offline.processPendingActions();
      
      // Track login
      await this.analytics.trackEvent('user_login', {
        userId: user.uid,
        email: user.email
      });
      
    } else {
      // User logged out
      showToast('تم تسجيل الخروج', 'info');
    }
  }
  
  printPage() {
    window.print();
  }
  
  toggleBackToTop() {
    const backToTop = document.getElementById('back-to-top');
    if (!backToTop) return;
    
    if (window.scrollY > 300) {
      backToTop.classList.remove('d-none');
    } else {
      backToTop.classList.add('d-none');
    }
  }
  
  formatCurrency(amount) {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0
    }).format(amount);
  }
  
  async checkForUpdates() {
    // Check for app updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            this.showUpdateNotification();
          }
        });
      });
    }
    
    // Check for content updates (daily)
    const lastCheck = this.storage.get('last_update_check', 0);
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (Date.now() - lastCheck > oneDay) {
      await this.checkContentUpdates();
      this.storage.set('last_update_check', Date.now());
    }
  }
  
  showUpdateNotification() {
    if (confirm('توجد نسخة جديدة من الموقع. هل تريد تحديث الصفحة؟')) {
      window.location.reload();
    }
  }
  
  async checkContentUpdates() {
    try {
      const response = await fetch('/api/check-updates');
      const data = await response.json();
      
      if (data.hasUpdates) {
        showToast('توجد تحديثات جديدة متاحة', 'info');
      }
    } catch (error) {
      console.error('Failed to check updates:', error);
    }
  }
  
  // ========== PUBLIC API ==========
  
  // Cart methods
  addToCart(product, quantity = 1) {
    const existing = this.state.cart.find(item => item.id === product.id);
    
    if (existing) {
      existing.qty += quantity;
    } else {
      this.state.cart.push({
        ...product,
        qty: quantity,
        addedAt: new Date().toISOString()
      });
    }
    
    this.saveState();
    this.updateCartUI(this.state.cart);
    
    // Trigger event
    document.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { cart: this.state.cart }
    }));
    
    // Track analytics
    this.analytics.trackRfqAction('add', product.id, quantity);
    
    return this.state.cart;
  }
  
  removeFromCart(productId) {
    this.state.cart = this.state.cart.filter(item => item.id !== productId);
    this.saveState();
    this.updateCartUI(this.state.cart);
    
    document.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { cart: this.state.cart }
    }));
    
    this.analytics.trackRfqAction('remove', productId);
  }
  
  clearCart() {
    this.state.cart = [];
    this.saveState();
    this.updateCartUI(this.state.cart);
    
    document.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { cart: this.state.cart }
    }));
    
    this.analytics.trackRfqAction('clear');
  }
  
  // Favorites methods
  toggleFavorite(product) {
    const index = this.state.favorites.findIndex(fav => fav.id === product.id);
    
    if (index >= 0) {
      this.state.favorites.splice(index, 1);
      showToast('تمت إزالة المنتج من المفضلة', 'info');
    } else {
      this.state.favorites.push({
        ...product,
        favoritedAt: new Date().toISOString()
      });
      showToast('تمت إضافة المنتج إلى المفضلة', 'success');
    }
    
    this.saveState();
    return this.state.favorites;
  }
  
  // Recently viewed
  addToRecentlyViewed(product) {
    // Remove if already exists
    this.state.recentlyViewed = this.state.recentlyViewed.filter(
      item => item.id !== product.id
    );
    
    // Add to beginning
    this.state.recentlyViewed.unshift({
      ...product,
      viewedAt: new Date().toISOString()
    });
    
    // Keep only last 10 items
    this.state.recentlyViewed = this.state.recentlyViewed.slice(0, 10);
    
    this.saveState();
  }
}

// Initialize app
window.nahjApp = new NahjApp();

// Export for modules
export default window.nahjApp;