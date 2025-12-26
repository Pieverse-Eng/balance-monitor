import axios from 'axios';
import dotenv from 'dotenv';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';

dotenv.config();

class BalanceMonitor {
  constructor() {
    this.apiUrl = 'https://facilitator.pieverse.io';
    this.previousBalances = {};
    this.meter = null;
    this.balanceGauge = null;
  }

  async setupOpenTelemetry() {
    const resource = Resource.default().merge(
      new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'balance-monitor',
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      })
    );

    const exporter = new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: exporter,
      exportIntervalMillis: 60000,
    });

    const meterProvider = new MeterProvider({
      resource: resource,
    });

    meterProvider.addMetricReader(metricReader);
    this.meter = meterProvider.getMeter('balance-monitor');

    this.setupMetrics();

    const sdk = new NodeSDK({
      resource: resource,
      metricReader: metricReader,
    });

    await sdk.start();
    console.log('OpenTelemetry initialized');
  }

  setupMetrics() {
    this.balanceGauge = this.meter.createGauge('facilitator_balance', {
      description: 'Current balance of Pieverse facilitator',
      unit: 'eth',
    });

    this.checkDuration = this.meter.createHistogram('balance_check_duration', {
      description: 'Duration of balance check',
      unit: 'ms',
    });

    this.balanceChangeCount = this.meter.createCounter('balance_change_count', {
      description: 'Number of balance changes detected',
    });

    this.checkErrors = this.meter.createCounter('balance_check_errors', {
      description: 'Number of errors during balance checks',
    });
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

        this.balanceGauge.record(currentBalance, {
          network: network,
          address: data.address,
        });

        if (previousBalance !== undefined && previousBalance !== currentBalance) {
          console.log(`Balance changed for ${network}: ${previousBalance} -> ${currentBalance}`);
          
          this.balanceChangeCount.add(1, {
            network: network,
          });
        }
        
        this.previousBalances[network] = currentBalance;
      }
      
      const duration = Date.now() - startTime;
      this.checkDuration.record(duration);
      
      console.log(`Balance check completed at ${new Date().toISOString()}, took ${duration}ms`);
    } catch (error) {
      console.error('Error in balance check:', error.message);
      this.checkErrors.add(1, {
        error: error.message,
      });
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
monitor.startMonitoring(5);

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});