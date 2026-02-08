// assets/js/utilities.js

// ========== FORMATTING FUNCTIONS ==========
export function formatCurrency(amount, currency = 'IQD') {
  if (currency === 'IQD') {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

export function formatDate(date, format = 'full') {
  const d = date?.toDate ? date.toDate() : new Date(date);
  
  const options = {
    full: {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    time: {
      hour: '2-digit',
      minute: '2-digit'
    }
  };
  
  return d.toLocaleDateString('ar-SA', options[format] || options.full);
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ========== VALIDATION FUNCTIONS ==========
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isValidPhone(phone) {
  const re = /^[\+]?[964]?[0-9]{10,11}$/;
  return re.test(phone.replace(/\s+/g, ''));
}

export function validateForm(formData, rules) {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const value = formData[field];
    const rule = rules[field];
    
    if (rule.required && !value) {
      errors[field] = rule.requiredMessage || 'هذا الحقل مطلوب';
    } else if (rule.email && !isValidEmail(value)) {
      errors[field] = 'البريد الإلكتروني غير صالح';
    } else if (rule.phone && !isValidPhone(value)) {
      errors[field] = 'رقم الهاتف غير صالح';
    } else if (rule.minLength && value.length < rule.minLength) {
      errors[field] = `الحد الأدنى ${rule.minLength} حرف`;
    }
  });
  
  return errors;
}

// ========== STORAGE FUNCTIONS ==========
export class LocalStorageManager {
  constructor(namespace = 'nahj') {
    this.namespace = namespace;
  }
  
  set(key, value) {
    try {
      const data = JSON.stringify(value);
      localStorage.setItem(`${this.namespace}_${key}`, data);
      return true;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return false;
    }
  }
  
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(`${this.namespace}_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('LocalStorage error:', error);
      return defaultValue;
    }
  }
  
  remove(key) {
    localStorage.removeItem(`${this.namespace}_${key}`);
  }
  
  clear() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`${this.namespace}_`)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// ========== UI HELPER FUNCTIONS ==========
export function showToast(message, type = 'success', duration = 3000) {
  // Remove existing toasts
  const existing = document.querySelector('.toast-container');
  if (existing) existing.remove();
  
  // Create toast container
  const container = document.createElement('div');
  container.className = 'toast-container';
  
  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast show align-items-center text-bg-${type}`;
  toast.role = 'alert';
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  
  container.appendChild(toast);
  document.body.appendChild(container);
  
  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      const bsToast = new bootstrap.Toast(toast);
      bsToast.hide();
      setTimeout(() => container.remove(), 500);
    }
  }, duration);
  
  return toast;
}

export function createLoadingSkeleton(type = 'card', count = 1) {
  const skeletons = {
    card: `
      <div class="card skeleton" style="height: 200px;">
        <div class="card-body">
          <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 10px;"></div>
          <div class="skeleton" style="height: 15px; width: 90%; margin-bottom: 8px;"></div>
          <div class="skeleton" style="height: 15px; width: 80%;"></div>
        </div>
      </div>
    `,
    table: `
      <tr>
        <td><div class="skeleton" style="height: 20px; width: 80%;"></div></td>
        <td><div class="skeleton" style="height: 20px; width: 60%;"></div></td>
        <td><div class="skeleton" style="height: 20px; width: 40%;"></div></td>
        <td><div class="skeleton" style="height: 20px; width: 30%;"></div></td>
      </tr>
    `,
    list: `
      <div class="list-group-item">
        <div class="d-flex w-100 justify-content-between">
          <div class="skeleton" style="height: 20px; width: 70%;"></div>
          <div class="skeleton" style="height: 20px; width: 20%;"></div>
        </div>
        <div class="skeleton mt-2" style="height: 15px; width: 90%;"></div>
      </div>
    `
  };
  
  return Array(count).fill(skeletons[type] || skeletons.card).join('');
}

// ========== API HELPER FUNCTIONS ==========
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }
  
  throw lastError;
}

// ========== PERFORMANCE FUNCTIONS ==========
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ========== SECURITY FUNCTIONS ==========
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  const reg = /[&<>"'/]/ig;
  return input.replace(reg, match => map[match]);
}

export function generateCSRFToken() {
  return 'csrf_' + Math.random().toString(36).substr(2) + 
         Date.now().toString(36);
}