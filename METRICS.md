# 📊 Performance Metrics

Kythia Core includes a built-in **Performance Metrics** system powered by [prom-client](https://github.com/siimon/prom-client). This allows you to monitor the health, performance, and usage of your bot in real-time using industry-standard tools like **Prometheus** and **Grafana**.

## Overview

The `MetricsManager` automatically collects the following metrics:

### 1. Command Execution
- **`kythia_commands_total`** (Counter)
  - Tracks the total number of slash commands executed.
  - **Labels:**
    - `command_name`: The name of the command.
    - `status`: `success` or `error`.

- **`kythia_command_duration_seconds`** (Histogram)
  - Tracks the execution time (latency) of slash commands.
  - **Labels:**
    - `command_name`: The name of the command.

### 2. Cache Performance
- **`kythia_cache_ops_total`** (Counter)
  - Tracks cache hits and misses for `KythiaModel`.
  - **Labels:**
    - `model`: The name of the model (e.g., `User`).
    - `type`: `hit` or `miss`.

### 3. System Metrics
Standard Node.js metrics are also collected by default, including:
- CPU usage
- Memory usage (Heap, RSS)
- Event loop lag
- Active handles

---

## 🚀 Accessing Metrics

The metrics are exposed in **Prometheus text format**. You can access them via the `MetricsManager` instance in the container.

### Internal Access

```typescript
// Accessing from a command or task
const { metrics } = container;

if (metrics) {
    const rawMetrics = await metrics.getMetrics();
    console.log(rawMetrics);
}
```

### Exposing to Web (Scraping)

To visualize these metrics in Grafana, you typically expose them on an HTTP endpoint that your Prometheus server scrapes.

Example using `fastify` or `express`:

```javascript
// In a separate HTTP server file
app.get('/metrics', async (req, res) => {
    const { metrics } = kythia.container;
    if (!metrics) return res.status(503).send('Metrics unavailable');
    
    res.header('Content-Type', metrics.getContentType());
    res.send(await metrics.getMetrics());
});
```

---

## 📈 Visualizing in Grafana

Once you have Prometheus scraping your bot, you can use these queries to build dashboards:

| Metric | Query Example | Description |
| :--- | :--- | :--- |
| **Command Rate** | `rate(kythia_commands_total[5m])` | Commands per second |
| **Error Rate** | `rate(kythia_commands_total{status="error"}[5m])` | Errors per second |
| **Cache Hit Ratio** | `sum(rate(kythia_cache_ops_total{type="hit"}[5m])) / sum(rate(kythia_cache_ops_total[5m]))` | % of DB queries avoided |
| **Avg Latency** | `rate(kythia_command_duration_seconds_sum[5m]) / rate(kythia_command_duration_seconds_count[5m])` | Average execution time |

---

## ⚙️ Configuration

Currently, metrics are enabled by default if `prom-client` is installed. They are stored in memory using `prom-client`'s global registry.

To disable metrics collection, you can currently only do so by removing the `MetricsManager` initialization in `Kythia.ts` (custom implementation required for toggle).
