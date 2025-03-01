'use client'

import React from 'react';
import Script from 'next/script';

export const ProductStructuredData = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "KeepKey Hardware Wallet",
    "image": [
      "https://keepkey.com/images/logos/keepkey-logo-square.png"
    ],
    "description": "A secure cryptocurrency hardware wallet for storing and managing digital assets with advanced security features.",
    "brand": {
      "@type": "Brand",
      "name": "KeepKey"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "category": "Cryptocurrency Hardware Wallet"
  };

  return (
    <Script 
      id="product-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};

export const OrganizationStructuredData = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "KeepKey",
    "url": "https://keepkey.com",
    "logo": "https://keepkey.com/images/logos/keepkey-logo-square.png",
    "sameAs": [
      "https://twitter.com/keepkey",
      "https://www.facebook.com/keepkey",
      "https://www.linkedin.com/company/keepkey"
    ],
    "description": "KeepKey is a cryptocurrency hardware wallet company dedicated to providing secure storage solutions for digital assets.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://keepkey.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Script 
      id="org-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
};

export const SoftwareApplicationStructuredData = () => {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "KeepKey Vault",
    "operatingSystem": "Web, Windows, macOS, Linux",
    "applicationCategory": "FinanceApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1024"
    }
  };

  return (
    <Script 
      id="app-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}; 