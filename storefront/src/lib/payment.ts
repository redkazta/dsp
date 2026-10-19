// Configuración de clientes de pago (pendiente de conectar).
// Las variables se declaran en `src/env.d.ts`; hoy no hay pasarela activa.
export const paymentConfig = {
  stripe: {
    publishableKey: '',
    apiUrl: 'https://api.stripe.com/v1',
  },
  mercadopago: {
    publicKey: '',
    apiUrl: 'https://api.mercadopago.com/v1',
  },
  conekta: {
    publicKey: '',
    apiUrl: 'https://api.conekta.io/v2',
  },
};

// Utilidades para pagos
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
      case 'MX':
        return 'mercadopago';
      case 'US':
      case 'CA':
      default:
        return 'stripe';
    }
  },
};
