import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: string;
}

const DEFAULT_TITLE = 'Stellar Playground | Soroban Smart Contract IDE';
const DEFAULT_DESCRIPTION = 'Build, test, and deploy Soroban smart contracts on Stellar directly in your browser. The fastest and most powerful development environment for Stellar smart contracts with real-time compilation, testing, and deployment.';
const DEFAULT_KEYWORDS = [
  // Primary keywords
  'Stellar',
  'Soroban',
  'Stellar Smart Contracts',
  'Soroban Smart Contracts',
  'Stellar Development',
  'Rust Smart Contracts',
  'Stellar Playground',
  'Soroban IDE',
  // Secondary keywords
  'Web3 Development',
  'Blockchain Development',
  'Smart Contract IDE',
  'Stellar Blockchain',
  'Stellar Testnet',
  'Stellar Protocol Development',
  // Long-tail keywords
  'Build Soroban Smart Contracts',
  'Deploy on Stellar',
  'Rust Contract Development',
  'Soroban Smart Contract Testing',
  'Stellar Development Environment',
  'Stellar Testnet Deployment',
  'Soroban Contract IDE',
  // Related terms
  'Stellar SDK',
  'Stellar Network',
  'Zero Setup Development',
  'Browser-based IDE'
];

const DEFAULT_IMAGE = 'https://stellar-playground.app/og-image.png';
const DEFAULT_URL = 'https://stellar-playground.app';

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
  url = DEFAULT_URL,
  type = 'website'
}: SEOProps) {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | Stellar Playground`;

  useEffect(() => {
    // Update meta tags
    document.title = fullTitle;
    
    // Basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords.join(', '));

    // OpenGraph meta tags
    updateMetaTag('og:title', fullTitle);
    updateMetaTag('og:description', description);
    updateMetaTag('og:image', image);
    updateMetaTag('og:url', url);
    updateMetaTag('og:type', type);
    updateMetaTag('og:site_name', 'Stellar Playground - Soroban Smart Contract IDE');

    // Twitter meta tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);
    updateMetaTag('twitter:site', '@StellarPlayground');

    // Additional meta tags for SEO
    updateMetaTag('application-name', 'Stellar Playground - Soroban Smart Contract IDE');
    updateMetaTag('apple-mobile-web-app-title', 'Stellar Playground');
    updateMetaTag('theme-color', '#000000');
    updateMetaTag('robots', 'index, follow, max-image-preview:large');
    updateMetaTag('googlebot', 'index, follow');
    updateMetaTag('author', 'Stellar Playground');
    updateMetaTag('language', 'English');

    // Mobile meta tags
    updateMetaTag('format-detection', 'telephone=no');
    updateMetaTag('apple-mobile-web-app-capable', 'yes');
    updateMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', url);

    // Add JSON-LD structured data
    addStructuredData({
      title: fullTitle,
      description,
      image,
      url
    });
  }, [fullTitle, description, keywords, image, url, type]);

  return null;
}

function updateMetaTag(name: string, content: string) {
  // Try to find existing meta tag
  let meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  
  // Create new meta tag if it doesn't exist
  if (!meta) {
    meta = document.createElement('meta');
    // Use property for og: and twitter: tags, name for others
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      meta.setAttribute('property', name);
    } else {
      meta.setAttribute('name', name);
    }
    document.head.appendChild(meta);
  }
  
  // Update content
  meta.setAttribute('content', content);
}

function addStructuredData({ 
  title, 
  description, 
  image, 
  url 
}: { 
  title: string; 
  description: string; 
  image: string; 
  url: string; 
}) {
  // Remove any existing structured data
  const existingScript = document.querySelector('#structured-data');
  if (existingScript) {
    existingScript.remove();
  }

  // Create structured data script
  const script = document.createElement('script');
  script.setAttribute('id', 'structured-data');
  script.setAttribute('type', 'application/ld+json');

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    description: description,
    image: image,
    url: url,
    applicationCategory: 'DevelopmentApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    author: {
      '@type': 'Organization',
      name: 'Stellar Playground',
      url: 'https://stellar-playground.app'
    },
    browserRequirements: 'Requires a modern web browser with JavaScript enabled',
    featureList: [
      'Real-time Rust compilation',
      'Soroban smart contract deployment',
      'Built-in testing environment',
      'Stellar blockchain integration',
      'Zero setup required',
      'Browser-based development'
    ],
    keywords: DEFAULT_KEYWORDS.join(', '),
    softwareVersion: '1.0.0'
  };

  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
}