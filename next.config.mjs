/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: [
      '@launchdarkly/ai-node',
      '@launchdarkly/ai-server',
      '@launchdarkly/ai-otel',
      '@launchdarkly/node-server-sdk',
      '@anthropic-ai/sdk',
      '@opentelemetry/api',
      '@opentelemetry/sdk-trace-node',
      '@opentelemetry/sdk-trace-base',
      '@opentelemetry/exporter-trace-otlp-http',
      '@opentelemetry/otlp-exporter-base',
      '@opentelemetry/resources',
      '@opentelemetry/context-async-hooks',
      '@opentelemetry/core',
      '@opentelemetry/semantic-conventions',
    ],
  },
}

export default nextConfig
