/**
 * API Client for WildForgeLabs Storefront
 * Llamadas a la API de .NET (hosteada en Render)
 */

export const API_URL =
  import.meta.env.PUBLIC_API_URL || 'https://dsp-gl11.onrender.com/api/v1';

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
    this.token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  }

  setToken(token: string) {
    this.token = token;
    if (typeof localStorage !== 'undefined') localStorage.setItem('auth_token', token);
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...this.getHeaders(), ...options?.headers },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  // Carrito
  async addToCart(cartId: string, variantId: string, quantity: number) {
    return this.post('/cart/add', { cartId, variantId, quantity });
  }

  async getCart(cartId: string) {
    return this.get(`/cart/${cartId}`);
  }

  async checkout(orderData: unknown) {
    return this.post('/orders', orderData);
  }

  // Productos
  async getProducts(params: Record<string, string>) {
    const queryString = new URLSearchParams(params).toString();
    return this.get(`/products?${queryString}`);
  }

  async getProductById(id: string) {
    return this.get(`/products/${id}`);
  }

  // Pagos
  async createPayment(orderId: string, provider: string, amount: number) {
    return this.post('/payments/process', { orderId, provider, amount });
  }
}

export const apiClient = new ApiClient();