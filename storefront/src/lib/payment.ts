// Configuración de clientes de pago
export const paymentConfig = {
  stripe: {
    publishableKey: import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
    apiUrl: 'https://api.stripe.com/v1'
  },
  mercadopago: {
    publicKey: import.meta.env.PUBLIC_MERCADOPAGO_PUBLIC_KEY || 'TEST-...',
    apiUrl: 'https://api.mercadopago.com/v1'
  },
  conekta: {
    publicKey: import.meta.env.PUBLIC_CONEKTA_PUBLIC_KEY || 'TEST-...',
    apiUrl: 'https://api.conekta.io/v2'
  }
};

// Utilidades para pagos
export const paymentUtils = {
  formatPrice: (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  },

  getPaymentProvider: (countryCode: string) => {
    switch (countryCode) {
      case 'MX':
        return 'mercadopago';
      case 'US':
        return 'stripe';
      case 'CA':
        return 'stripe';
      default:
        return 'stripe';
    }
  }
};