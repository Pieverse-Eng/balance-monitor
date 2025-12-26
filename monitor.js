import axios from 'axios';
import dotenv from 'dotenv';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';

dotenv.config();

class BalanceMonitor {
  constructor() {
    this.apiUrl = 'https://facilitator.pieverse.io';
    this.previousBalances = {};
    this.meter = null;
    this.balanceGauge = null;
  }

  async setupOpenTelemetry() {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'balance-monitor',
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
        headers: this.parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      }),
    });

    await sdk.start();
    console.log('OpenTelemetry initialized (traces only)');
  }

  parseHeaders(headersString) {
    if (!headersString) return {};
    const headers = {};
    headersString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        headers[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return headers;
  }

  setupMetrics() {
    // Metrics temporarily disabled - using traces only
    console.log('Metrics setup skipped');
  }

  async getCurrentBalances() {
    try {
      const response = await axios.get(this.apiUrl);
      return response.data.facilitators;
    } catch (error) {
      console.error('Error fetching balances:', error.message);
      throw error;
    }
  }

  async checkAndRecord() {
    const startTime = Date.now();
    
    try {
      const balances = await this.getCurrentBalances();
      
      for (const [network, data] of Object.entries(balances)) {
        const currentBalance = parseFloat(data.balance);
        const previousBalance = this.previousBalances[network];

        // Observable gauge handles updates differently

        if (previousBalance !== undefined && previousBalance !== currentBalance) {
          console.log(`Balance changed for ${network}: ${previousBalance} -> ${currentBalance}`);
          
          // Balance change detected
        }
        
        this.previousBalances[network] = currentBalance;
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`Balance check completed at ${new Date().toISOString()}, took ${duration}ms`);
    } catch (error) {
      console.error('Error in balance check:', error.message);
    }
  }

  async startMonitoring(intervalMinutes = 5) {
    console.log(`Starting balance monitoring (checking every ${intervalMinutes} minutes)`);
    
    await this.checkAndRecord();
    
    setInterval(() => {
      this.checkAndRecord();
    }, intervalMinutes * 60 * 1000);
  }
}

const monitor = new BalanceMonitor();
await monitor.setupOpenTelemetry();

const isCronMode = process.argv.includes('--once');

if (isCronMode) {
  console.log('Running in cron mode - checking once...');
  await monitor.checkAndRecord();
  console.log('Cron check completed');
  process.exit(0);
} else {
  monitor.startMonitoring(5);
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});