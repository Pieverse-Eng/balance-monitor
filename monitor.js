import axios from 'axios';
import dotenv from 'dotenv';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { LoggerProvider } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import api from '@opentelemetry/api';
const { metrics, logs } = api;

dotenv.config();

class BalanceMonitor {
  constructor() {
    this.apiUrl = 'https://facilitator.pieverse.io';
    this.previousBalances = {};
    this.meter = null;
    this.logger = null;
    this.balanceGauge = null;
  }

  async setupMetrics() {
    const exporter = new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/metrics',
      headers: this.parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    });

    const meterProvider = new MeterProvider({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'balance-monitor',
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      }),
    });

    const metricReader = new PeriodicExportingMetricReader({
      exporter: exporter,
      exportIntervalMillis: 10000,
    });

    meterProvider.addMetricReader(metricReader);
    
    // Set the global meter provider
    metrics.setGlobalMeterProvider(meterProvider);
    
    this.meter = metrics.getMeter('balance-monitor');
    this.setupInstruments();
    
    console.log('Metrics initialized');
  }

  async setupLogs() {
    const exporter = new OTLPLogExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/logs',
      headers: this.parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    });

    this.loggerProvider = new LoggerProvider({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'balance-monitor',
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      }),
    });

    this.loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporter));
    this.logger = this.loggerProvider.getLogger('balance-monitor');
    
    console.log('Logs initialized');
  }

  setupInstruments() {
    this.balanceGauge = this.meter.createObservableGauge('facilitator_balance', {
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

  logInfo(message, attributes = {}) {
    console.log(message);
    this.logger.emit({
      severity: 'INFO',
      body: message,
      attributes: attributes,
      timestamp: Date.now(),
    });
  }

  logError(message, error, attributes = {}) {
    console.error(message, error);
    this.logger.emit({
      severity: 'ERROR',
      body: message,
      attributes: {
        ...attributes,
        error: error.message,
        stack: error.stack,
      },
      timestamp: Date.now(),
    });
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
      

      
      this.logInfo('Starting balance check', {
        timestamp: new Date().toISOString(),
        networks: Object.keys(balances),
      });

      for (const [network, data] of Object.entries(balances)) {
        const currentBalance = parseFloat(data.balance);

        const previousBalance = this.previousBalances[network];
        if (previousBalance !== undefined && previousBalance !== currentBalance) {
          this.logInfo(`Balance changed for ${network}`, {
            network: network,
            previousBalance: previousBalance,
            currentBalance: currentBalance,
          });
          
          this.balanceChangeCount.add(1, {
            network: network,
          });
        }
        
        this.previousBalances[network] = currentBalance;
      }

      // Update observable gauge with latest values
      this.balanceGauge.addCallback((observableResult) => {
        for (const [network, data] of Object.entries(balances)) {
          observableResult.observe(parseFloat(data.balance), {
            network: network,
            address: data.address,
          });
        }
      });
      
      const duration = Date.now() - startTime;
      this.checkDuration.record(duration);
      
      this.logInfo(`Balance check completed`, {
        timestamp: new Date().toISOString(),
        duration: duration,
        networksChecked: Object.keys(balances).length,
      });
    } catch (error) {
      this.logError('Error in balance check', error, {
        timestamp: new Date().toISOString(),
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
await monitor.setupMetrics();
await monitor.setupLogs();

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