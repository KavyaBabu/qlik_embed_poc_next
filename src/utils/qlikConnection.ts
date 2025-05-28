import enigma from 'enigma.js';
import schema from 'enigma.js/schemas/12.612.0.json';
import { QLIK_CONFIG } from '../config/qlik';

class QlikConnectionManager {
  private static instance: QlikConnectionManager;
  private session: any = null;
  private app: any = null;
  private connectionPromise: Promise<{ app: any; session: any }> | null = null;

  private constructor() {}

  static getInstance(): QlikConnectionManager {
    if (!QlikConnectionManager.instance) {
      QlikConnectionManager.instance = new QlikConnectionManager();
    }
    return QlikConnectionManager.instance;
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();
    return this.connectionPromise;
  }

  private async createConnection() {
    try {
      const csrfRes = await fetch(`https://${QLIK_CONFIG.host}/api/v1/csrf-token`, {
        credentials: 'include',
        headers: {
          'qlik-web-integration-id': QLIK_CONFIG.webIntegrationId,
        },
      });

      if (!csrfRes.ok) {
        if (csrfRes.status === 401 || csrfRes.status === 403) {
          window.location.href = '/auth';
          throw new Error('Session expired');
        }
        throw new Error(`Failed to get CSRF token: ${csrfRes.status}`);
      }

      const csrfToken = csrfRes.headers.get('qlik-csrf-token');
      if (!csrfToken) {
        throw new Error('CSRF token missing');
      }

      const wsUrl = `wss://${QLIK_CONFIG.host}/app/${QLIK_CONFIG.appId}?qlik-web-integration-id=${QLIK_CONFIG.webIntegrationId}&qlik-csrf-token=${csrfToken}`;

      this.session = enigma.create({
        schema,
        url: wsUrl,
        createSocket: (url) => new WebSocket(url),
        suspendOnClose: true,
      });

      const global = await this.session.open();
      this.app = await global.openDoc(QLIK_CONFIG.appId);

      this.session.on('suspended', () => {
        console.warn('Session suspended');
        this.reconnect();
      });

      this.session.on('closed', () => {
        console.warn('Session closed');
        this.reset();
        window.location.href = '/auth';
      });

      return { app: this.app, session: this.session };
    } catch (error) {
      this.reset();
      throw error;
    }
  }

  private async reconnect() {
    try {
      await this.session?.resume();
    } catch (error) {
      console.error('Failed to resume session:', error);
      this.reset();
      window.location.href = '/auth';
    }
  }

  private reset() {
    this.session = null;
    this.app = null;
    this.connectionPromise = null;
  }
}

export const connectToQlik = async () => {
  return QlikConnectionManager.getInstance().connect();
};