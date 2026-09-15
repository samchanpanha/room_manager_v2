import pino from "pino";

/// Centralized structured logger.
///
/// When an OpenTelemetry OTLP logs endpoint is configured via
/// `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (or the signal-agnostic
/// `OTEL_EXPORTER_OTLP_ENDPOINT`), every record is shipped to Rootprint
/// (or any OTLP collector) through the `pino-opentelemetry-transport`
/// worker while still being echoed as JSON on stdout so
/// `docker compose logs rentmanager` stays greppable.
///
/// Without an endpoint (local dev, tests) we fall back to plain JSON on
/// stdout — no transport, no worker, no network calls.
const otlpConfigured = Boolean(
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
);

const level = process.env.LOG_LEVEL ?? "info";

const serviceName = process.env.OTEL_SERVICE_NAME;
const base = {
  ...(serviceName ? { service_name: serviceName } : {})
};

function buildLogger(): pino.Logger {
  if (!otlpConfigured) {
    return pino({ base, level });
  }
  return pino(
    { base, level },
    pino.multistream([
      { stream: pino.destination(1) },
      { stream: pino.transport({ target: "pino-opentelemetry-transport" }) }
    ])
  );
}

export const logger = buildLogger();