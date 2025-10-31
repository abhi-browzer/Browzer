/**
 * Simplified API wrapper for easy usage across the project
 * 
 * Usage:
 * import { api } from '@/main/api/api';
 * 
 * const response = await api.get('/endpoint');
 * const response = await api.post('/endpoint', { data });
 */

import { ApiClient, ApiResponse } from './ApiClient';
import { AxiosRequestConfig } from 'axios';

/**
 * Global API client instance
 * This will be initialized by ConnectionManager
 */
let apiClientInstance: ApiClient | null = null;

/**
 * Initialize the global API client
 * Called by ConnectionManager during initialization
 */
export function initializeApi(client: ApiClient): void {
  apiClientInstance = client;
}

/**
 * Get the API client instance
 */
function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Ensure ConnectionManager is initialized first.');
  }
  return apiClientInstance;
}

/**
 * Simplified API interface
 * All methods automatically use the configured base URL, auth headers, etc.
 */
export const api = {
  /**
   * GET request
   * @example api.get('/users')
   * @example api.get('/users', { params: { page: 1 } })
   */
  get: <T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return getApiClient().get<T>(endpoint, config);
  },

  /**
   * POST request
   * @example api.post('/users', { name: 'John' })
   * @example api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
   */
  post: <T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return getApiClient().post<T>(endpoint, data, config);
  },

  /**
   * PUT request
   * @example api.put('/users/1', { name: 'Jane' })
   */
  put: <T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return getApiClient().put<T>(endpoint, data, config);
  },

  /**
   * PATCH request
   * @example api.patch('/users/1', { name: 'Jane' })
   */
  patch: <T = any>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return getApiClient().patch<T>(endpoint, data, config);
  },

  /**
   * DELETE request
   * @example api.delete('/users/1')
   */
  delete: <T = any>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return getApiClient().delete<T>(endpoint, config);
  },

  /**
   * Get the underlying API client for advanced usage
   */
  getClient: (): ApiClient => {
    return getApiClient();
  },

  /**
   * Check if API is connected (has session token)
   */
  isConnected: (): boolean => {
    return getApiClient().isConnected();
  },

  /**
   * Get session token
   */
  getSessionToken: (): string | null => {
    return getApiClient().getSessionToken();
  },

  /**
   * Set session token
   */
  setSessionToken: (token: string | null): void => {
    getApiClient().setSessionToken(token);
  },
};

/**
 * Connection-specific API endpoints
 */
export const connectionApi = {
  establish: () => {
    return getApiClient().connect();
  },

  healthCheck: () => {
    return getApiClient().healthCheck();
  },

  disconnect: () => {
    return getApiClient().disconnect();
  },
};
