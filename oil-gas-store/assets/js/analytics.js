// assets/js/analytics.js
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

class AnalyticsTracker {
  constructor(app) {
    this.db = getFirestore(app);
    this.sessionId = this.generateSessionId();
    this.pageStartTime = Date.now();
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  async trackPageView(pageName, additionalData = {}) {
    try {
      const pageData = {
        sessionId: this.sessionId,
        page: pageName,
        url: window.location.href,
        referrer: document.referrer || 'direct',
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        userAgent: navigator.userAgent,
        timeOnPage: Date.now() - this.pageStartTime,
        timestamp: serverTimestamp(),
        ...additionalData
      };
      
      await addDoc(collection(this.db, 'analytics_pageviews'), pageData);
      console.log('Page view tracked:', pageName);
      
      // Update page start time for next tracking
      this.pageStartTime = Date.now();
      
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }
  
  async trackEvent(eventName, eventData = {}) {
    try {
      const event = {
        sessionId: this.sessionId,
        event: eventName,
        page: window.location.pathname,
        timestamp: serverTimestamp(),
        ...eventData
      };
      
      await addDoc(collection(this.db, 'analytics_events'), event);
      console.log('Event tracked:', eventName);
      
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }
  
  async trackProductView(productId, productName) {
    await this.trackEvent('product_view', {
      productId,
      productName,
      category: 'products'
    });
    
    // Increment view count in product document
    try {
      const productRef = doc(this.db, 'products', productId);
      await updateDoc(productRef, {
        viewCount: increment(1),
        lastViewed: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating product view count:', error);
    }
  }
  
  async trackRfqAction(action, productId = null, quantity = 1) {
    await this.trackEvent('rfq_action', {
      action, // 'add', 'remove', 'clear', 'submit'
      productId,
      quantity,
      cartCount: this.getCartCount()
    });
  }
  
  getCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem('nahj_rfq_cart_v2') || '[]');
      return cart.reduce((total, item) => total + item.qty, 0);
    } catch {
      return 0;
    }
  }
  
  async trackConversion(conversionType, value = 0, metadata = {}) {
    await this.trackEvent('conversion', {
      type: conversionType, // 'rfq_submission', 'contact_form', 'product_inquiry'
      value,
      ...metadata
    });
  }
  
  async trackSearch(searchTerm, resultsCount = 0) {
    await this.trackEvent('search', {
      term: searchTerm,
      resultsCount,
      page: window.location.pathname
    });
  }
  
  async trackError(error, context = {}) {
    await this.trackEvent('error', {
      error: error.message || error.toString(),
      stack: error.stack,
      context: JSON.stringify(context),
      url: window.location.href
    });
  }
  
  // Heatmap-like tracking (simplified)
  trackClicks() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const elementInfo = {
        tag: target.tagName.toLowerCase(),
        id: target.id,
        className: target.className,
        text: target.textContent?.substring(0, 50),
        x: e.clientX,
        y: e.clientY
      };
      
      this.trackEvent('click', elementInfo).catch(console.error);
    });
  }
  
  trackScrollDepth() {
    let scrollTracked = false;
    
    window.addEventListener('scroll', () => {
      const scrollPercentage = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      
      if (scrollPercentage > 25 && !scrollTracked) {
        this.trackEvent('scroll_25').catch(console.error);
        scrollTracked = true;
      }
      
      if (scrollPercentage > 50) {
        this.trackEvent('scroll_50').catch(console.error);
      }
      
      if (scrollPercentage > 75) {
        this.trackEvent('scroll_75').catch(console.error);
      }
    });
  }
}

export default AnalyticsTracker;