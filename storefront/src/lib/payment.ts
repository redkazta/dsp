export const paymentConfig = {
  stripe: {
    publishableKey: import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    apiUrl: 'https://api.stripe.com/v1',
  },
  mercadopago: {
    publicKey: import.meta.env.PUBLIC_MERCADOPAGO_PUBLIC_KEY || '',
    apiUrl: 'https://api.mercadopago.com/v1',
  },
  conekta: {
    publicKey: import.meta.env.PUBLIC_CONEKTA_PUBLIC_KEY || '',
    apiUrl: 'https://api.conekta.io/v2',
  },
};

export const paymentUtils = {
  formatPrice: (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  },
  getPaymentProvider: (countryCode: string) => {
    switch (countryCode) {
      case 'MX': return 'mercadopago';
      case 'US':
      case 'CA':
      default: return 'stripe';
    }
  },
};
