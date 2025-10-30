/**
 * Connection Manager - Orchestrates API and WebSocket connections
 * 
 * Responsibilities:
 * - Initialize and maintain connection to backend
 * - Monitor connection health
 * - Handle reconnection logic
 * - Provide unified interface for backend communication
 */

import { ApiClient, ApiConfig } from './ApiClient';
import { WebSocketClient, WebSocketConfig } from './WebSocketClient';
import { initializeApi } from './api';
import { EventEmitter } from 'events';

export interface ConnectionManagerConfig {
  apiBaseURL: string;
  apiKey: string;
  healthCheckInterval?: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export class ConnectionManager extends EventEmitter {
  private apiClient: ApiClient;
  private wsClient: WebSocketClient | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private healthCheckInterval: number;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: ConnectionManagerConfig) {
    super();
    
    const apiConfig: ApiConfig = {
      baseURL: config.apiBaseURL,
      apiKey: config.apiKey,
      timeout: 30000,
      retryAttempts: 3,
    };

    this.apiClient = new ApiClient(apiConfig);
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 minute
    
    // Initialize global api instance
    initializeApi(this.apiClient);
  }

  /**
   * Initialize connection to backend
   */
  async initialize(): Promise<boolean> {
    if (this.status === ConnectionStatus.CONNECTING || this.status === ConnectionStatus.CONNECTED) {
      console.log('[ConnectionManager] Already connected or connecting');
      return true;
    }

    this.status = ConnectionStatus.CONNECTING;
    this.emit('status', this.status);

    try {
      // Step 1: Establish API connection
      console.log('[ConnectionManager] Establishing API connection...');
      const response = await this.apiClient.connect();

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to establish connection');
      }

      const { session_token, websocket_url, server_version } = response.data;
      console.log(`[ConnectionManager] Connected to server v${server_version}`);

      // Step 2: Initialize WebSocket connection
      if (websocket_url) {
        console.log('[ConnectionManager] Initializing WebSocket...');
        await this.initializeWebSocket(websocket_url, session_token);
      }

      this.status = ConnectionStatus.CONNECTED;
      this.emit('status', this.status);
      this.emit('connected');

      // Start health monitoring
      this.startHealthCheck();

      return true;

    } catch (error: any) {
      console.error('[ConnectionManager] Connection failed:', error);
      this.status = ConnectionStatus.ERROR;
      this.emit('status', this.status);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeWebSocket(url: string, token: string): Promise<void> {
    const wsConfig: WebSocketConfig = {
      url,
      token,
      electronId: this.apiClient.getElectronId(),
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
    };

    this.wsClient = new WebSocketClient(wsConfig);

    // Forward WebSocket events
    this.wsClient.on('connected', () => {
      console.log('[ConnectionManager] WebSocket connected');
      this.emit('websocket:connected');
    });

    this.wsClient.on('disconnected', () => {
      console.log('[ConnectionManager] WebSocket disconnected');
      this.emit('websocket:disconnected');
    });

    this.wsClient.on('error', (error) => {
      console.error('[ConnectionManager] WebSocket error:', error);
      this.emit('websocket:error', error);
    });

    // Connect
    await this.wsClient.connect();
  }

  /**
   * Disconnect from backend
   */
  async disconnect(): Promise<void> {
    console.log('[ConnectionManager] Disconnecting...');

    // Stop health check
    this.stopHealthCheck();

    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }

    // Disconnect API
    await this.apiClient.disconnect();

    this.status = ConnectionStatus.DISCONNECTED;
    this.emit('status', this.status);
    this.emit('disconnected');
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const response = await this.apiClient.healthCheck();
        
        if (!response.success) {
          console.warn('[ConnectionManager] Health check failed:', response.error);
          this.emit('health:unhealthy', response.error);
        } else {
          this.emit('health:healthy', response.data);
        }
      } catch (error) {
        console.error('[ConnectionManager] Health check error:', error);
        this.emit('health:error', error);
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Get API client
   */
  getApiClient(): ApiClient {
    return this.apiClient;
  }

  /**
   * Get WebSocket client
   */
  getWebSocketClient(): WebSocketClient | null {
    return this.wsClient;
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === ConnectionStatus.CONNECTED;
  }

  /**
   * Subscribe to WebSocket channel
   */
  subscribe(channel: string): void {
    if (this.wsClient) {
      this.wsClient.subscribe(channel);
    }
  }

  /**
   * Unsubscribe from WebSocket channel
   */
  unsubscribe(channel: string): void {
    if (this.wsClient) {
      this.wsClient.unsubscribe(channel);
    }
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(message: any): void {
    if (this.wsClient) {
      this.wsClient.send(message);
    }
  }
}
