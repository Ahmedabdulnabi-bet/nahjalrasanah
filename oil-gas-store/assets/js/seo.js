// assets/js/seo.js
class SEOOptimizer {
  constructor() {
    this.canonicalUrl = window.location.origin + window.location.pathname;
  }
  
  // ========== META TAGS MANAGEMENT ==========
  updateMetaTags(pageData) {
    // Update title
    if (pageData.title) {
      document.title = `${pageData.title} | Nahj Al-Rasanah`;
    }
    
    // Update meta description
    this.setMetaTag('description', pageData.description || 
      'Nahj Al-Rasanah - Oil & Gas Equipment & Spare Parts Supplier in Iraq');
    
    // Update Open Graph tags
    this.setMetaTag('og:title', pageData.title || document.title);
    this.setMetaTag('og:description', pageData.description);
    this.setMetaTag('og:url', this.canonicalUrl);
    this.setMetaTag('og:type', 'website');
    this.setMetaTag('og:image', pageData.image || 
      window.location.origin + '/assets/images/og-default.jpg');
    
    // Update Twitter Card
    this.setMetaTag('twitter:card', 'summary_large_image');
    this.setMetaTag('twitter:title', pageData.title || document.title);
    this.setMetaTag('twitter:description', pageData.description);
    this.setMetaTag('twitter:image', pageData.image || 
      window.location.origin + '/assets/images/twitter-default.jpg');
    
    // Canonical URL
    this.setCanonicalUrl();
    
    // JSON-LD Structured Data
    this.generateStructuredData(pageData);
  }
  
  setMetaTag(name, content) {
    if (!content) return;
    
    let tag = document.querySelector(`meta[name="${name}"]`) || 
              document.querySelector(`meta[property="${name}"]`);
    
    if (!tag) {
      tag = document.createElement('meta');
      if (name.startsWith('og:')) {
        tag.setAttribute('property', name);
      } else {
        tag.setAttribute('name', name);
      }
      document.head.appendChild(tag);
    }
    
    tag.setAttribute('content', content);
  }
  
  setCanonicalUrl() {
    let canonical = document.querySelector('link[rel="canonical"]');
    
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    
    canonical.href = this.canonicalUrl;
  }
  
  // ========== STRUCTURED DATA ==========
  generateStructuredData(pageData) {
    let structuredData;
    
    switch(pageData.type) {
      case 'product':
        structuredData = this.generateProductSchema(pageData);
        break;
      case 'organization':
        structuredData = this.generateOrganizationSchema();
        break;
      default:
        structuredData = this.generateWebsiteSchema();
    }
    
    this.addJsonLd(structuredData);
  }
  
  generateProductSchema(product) {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "description": product.shortDescription,
      "image": product.image,
      "sku": product.partNumber,
      "brand": {
        "@type": "Brand",
        "name": product.brand || "Nahj Al-Rasanah"
      },
      "offers": {
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "priceCurrency": "IQD",
        "seller": {
          "@type": "Organization",
          "name": "Nahj Al-Rasanah",
          "url": "https://www.nahjalrasanah.com"
        }
      }
    };
  }
  
  generateOrganizationSchema() {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Nahj Al-Rasanah",
      "url": "https://www.nahjalrasanah.com",
      "logo": "https://www.nahjalrasanah.com/assets/images/logo-store.png",
      "description": "Oil & Gas Equipment & Spare Parts Supplier in Iraq",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Badra District",
        "addressLocality": "Wasit Governorate",
        "addressCountry": "IQ"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+964-784-349-9555",
        "contactType": "sales",
        "email": "sales@nahjalrasanah.com",
        "areaServed": "IQ"
      }
    };
  }
  
  generateWebsiteSchema() {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Nahj Al-Rasanah Oil & Gas Store",
      "url": "https://www.nahjalrasanah.com/oil-gas-store/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://www.nahjalrasanah.com/oil-gas-store/index.html?search={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    };
  }
  
  addJsonLd(data) {
    // Remove existing JSON-LD
    const existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();
    
    // Add new JSON-LD
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
  }
  
  // ========== SEO FRIENDLY URLS ==========
  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
  
  updateHistoryState(title, url) {
    if (history.pushState) {
      const newUrl = url || window.location.pathname + window.location.search;
      history.pushState({}, title, newUrl);
      document.title = title;
    }
  }
  
  // ========== PERFORMANCE OPTIMIZATION ==========
  lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }
  
  preloadCriticalAssets() {
    // Preload critical CSS
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = '/assets/css/styles.css';
    link.as = 'style';
    document.head.appendChild(link);
    
    // Preload fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css';
    fontLink.as = 'style';
    document.head.appendChild(fontLink);
  }
  
  // ========== SITEMAP GENERATION (CLIENT-SIDE) ==========
  generateSitemap(pages) {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `
  <url>
    <loc>${window.location.origin}${page.url}</loc>
    <lastmod>${page.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq || 'weekly'}</changefreq>
    <priority>${page.priority || '0.8'}</priority>
  </url>`).join('')}
</urlset>`;
    
    return sitemap;
  }
}

export default SEOOptimizer;