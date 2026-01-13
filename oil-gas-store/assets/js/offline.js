// assets/js/offline.js
import { LocalStorageManager } from './utilities.js';

class OfflineManager {
  constructor() {
    this.storage = new LocalStorageManager('nahj_offline');
    this.isOnline = navigator.onLine;
    this.pendingActions = [];
    
    this.init();
  }
  
  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Check initial status
    this.updateOnlineStatus();
    
    // Load pending actions
    this.loadPendingActions();
    
    // Register service worker
    this.registerServiceWorker();
  }
  
  updateOnlineStatus() {
    this.isOnline = navigator.onLine;
    
    // Update UI
    const statusElement = document.getElementById('online-status');
    if (statusElement) {
      if (this.isOnline) {
        statusElement.innerHTML = '<i class="bi bi-wifi"></i> متصل';
        statusElement.className = 'badge bg-success';
      } else {
        statusElement.innerHTML = '<i class="bi bi-wifi-off"></i> غير متصل';
        statusElement.className = 'badge bg-danger';
      }
    }
  }
  
  handleOnline() {
    console.log('Connection restored');
    this.isOnline = true;
    this.updateOnlineStatus();
    
    // Process pending actions
    this.processPendingActions();
    
    // Show notification
    this.showNotification('اتصالك عاد للعمل', 'success');
  }
  
  handleOffline() {
    console.log('Connection lost');
    this.isOnline = false;
    this.updateOnlineStatus();
    
    // Show notification
    this.showNotification('أنت غير متصل بالإنترنت. سيتم حفظ عملك محلياً.', 'warning');
  }
  
  // ========== OFFLINE DATA STORAGE ==========
  async saveForOffline(collection, data) {
    const pendingAction = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      collection,
      data,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    
    this.pendingActions.push(pendingAction);
    await this.savePendingActions();
    
    return pendingAction.id;
  }
  
  async processPendingActions() {
    if (this.pendingActions.length === 0 || !this.isOnline) return;
    
    console.log(`Processing ${this.pendingActions.length} pending actions`);
    
    const successful = [];
    const failed = [];
    
    for (const action of this.pendingActions) {
      try {
        // Here you would send the data to your backend
        // For example:
        // await fetch('/api/sync', {
        //   method: 'POST',
        //   body: JSON.stringify(action)
        // });
        
        console.log('Synced action:', action.id);
        action.status = 'synced';
        action.syncedAt = new Date().toISOString();
        successful.push(action);
        
      } catch (error) {
        console.error('Failed to sync action:', action.id, error);
        action.status = 'failed';
        action.error = error.message;
        failed.push(action);
      }
    }
    
    // Update pending actions
    this.pendingActions = failed;
    await this.savePendingActions();
    
    // Notify user
    if (successful.length > 0) {
      this.showNotification(`تم مزامنة ${successful.length} من الإجراءات`, 'success');
    }
    
    return { successful, failed };
  }
  
  async savePendingActions() {
    return this.storage.set('pending_actions', this.pendingActions);
  }
  
  async loadPendingActions() {
    this.pendingActions = this.storage.get('pending_actions', []);
    console.log(`Loaded ${this.pendingActions.length} pending actions`);
  }
  
  // ========== CACHING ==========
  async cacheResources(resources) {
    if (!('caches' in window)) return;
    
    try {
      const cache = await caches.open('nahj-cache-v1');
      await cache.addAll(resources);
      console.log('Resources cached successfully');
    } catch (error) {
      console.error('Failed to cache resources:', error);
    }
  }
  
  async getCachedData(key) {
    if (!this.isOnline) {
      return this.storage.get(key);
    }
    return null;
  }
  
  async setCachedData(key, data) {
    return this.storage.set(key, data);
  }
  
  // ========== SERVICE WORKER ==========
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registered:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('New service worker found:', newWorker);
      });
      
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  }
  
  // ========== UI NOTIFICATIONS ==========
  showNotification(message, type = 'info') {
    // Use your existing notification system
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else {
      alert(message);
    }
  }
  
  // ========== OFFLINE FORM HANDLING ==========
  setupOfflineForm(formId, syncCallback) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      if (!this.isOnline) {
        e.preventDefault();
        
        // Save form data for offline
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        const actionId = await this.saveForOffline('forms', {
          formId,
          data,
          url: window.location.href
        });
        
        // Show success message
        this.showNotification('تم حفظ النموذج. سيتم إرساله عند عودة الاتصال.', 'success');
        
        // Clear form
        form.reset();
        
        // Store callback for when online
        if (syncCallback) {
          this.pendingActions.find(a => a.id === actionId).callback = syncCallback;
        }
        
        return false;
      }
      
      // If online, proceed normally
      return true;
    });
  }
}

export default OfflineManager;