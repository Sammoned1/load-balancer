class InfuxDbMetrics {
  constructor(opts = {}) {
    this.url = opts.url || process.env.INFLUX_URL || 'http://localhost:8086';
    this.token = opts.token || process.env.INFLUX_TOKEN || 'my-super-secret-auth-token';
    this.org = opts.org || process.env.INFLUX_ORG || 'myorg';
    this.bucket = opts.bucket || process.env.INFLUX_BUCKET || 'threads';
  }

  log(message) {
    if (process.send) {
      process.send({ type: 'LOG', message });
    } else {
      process.stderr.write(`${message}\n`);
    }
  }

  async writeLine(line) {
    try {
      const res = await fetch(
        `${this.url}/api/v2/write?org=${encodeURIComponent(this.org)}&bucket=${encodeURIComponent(this.bucket)}&precision=ns`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.token}`,
            'Content-Type': 'text/plain',
          },
          body: line,
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.log(`[InfluxDB] Write failed: HTTP ${res.status} ${text}`.slice(0, 500));
      }
    } catch (error) {
      this.log(`[InfluxDB] Connection error: ${error?.message || String(error)}`.slice(0, 500));
    }
  }

  /**
   * Пер-запросная метрика (время отклика).
   * Пишется только когда запрос успешно обработан VU (есть корректный JSON ответ).
   */
  sendMetric(responseTime, redirected, testCase, runId) {
    const ts = `${Date.now()}000000`;
    const safeRunId = runId ? String(runId).replace(/[,= ]/g, '_') : 'unknown';
    const line = `loadtest,run_id=${safeRunId},test_case=${testCase},redirected=${redirected} response_time=${responseTime} ${ts}`;
    // fire-and-forget: не блокируем VU
    void this.writeLine(line);
  }

  /**
   * Итоговая агрегированная метрика по одному испытанию.
   * measurement: loadtest_summary
   * fields:
   * - latency: p95_ms, avg_ms, median_ms
   * - throughput: throughput_rps
   * - hybrid: client_share, redirected_ok_count
   * - counts: sent_count, completed_count, ok_count, error_count (+ breakdown)
   * - time: wall_clock_s, load_phase_s, tail_s
   */
  async sendSummary(summary) {
    const ts = `${Date.now()}000000`;

    const safeRunId = String(summary.runId).replace(/[,= ]/g, '_');
    const testCase = summary.testCase;
    const targetRps = summary.targetRps;
    const durationS = summary.durationS;
    const vusCount = Number.isFinite(summary.vusCount) ? summary.vusCount : 0;

    const p95 = Number.isFinite(summary.p95Ms) ? summary.p95Ms : 0;
    const avg = Number.isFinite(summary.avgMs) ? summary.avgMs : 0;
    const median = Number.isFinite(summary.medianMs) ? summary.medianMs : 0;
    const throughput = Number.isFinite(summary.throughputRps) ? summary.throughputRps : 0;
    const clientShare = Number.isFinite(summary.clientShare) ? summary.clientShare : 0;

    const sentCount = Number.isFinite(summary.sentCount) ? summary.sentCount : 0;
    const completedCount = Number.isFinite(summary.completedCount) ? summary.completedCount : 0;
    const okCount = Number.isFinite(summary.okCount) ? summary.okCount : 0;
    const errorCount = Number.isFinite(summary.errorCount) ? summary.errorCount : 0;
    const timeoutCount = Number.isFinite(summary.timeoutCount) ? summary.timeoutCount : 0;
    const networkErrorCount = Number.isFinite(summary.networkErrorCount) ? summary.networkErrorCount : 0;
    const parseErrorCount = Number.isFinite(summary.parseErrorCount) ? summary.parseErrorCount : 0;
    const httpErrorCount = Number.isFinite(summary.httpErrorCount) ? summary.httpErrorCount : 0;
    const redirectedOkCount = Number.isFinite(summary.redirectedOkCount) ? summary.redirectedOkCount : 0;

    const wallClockS = Number.isFinite(summary.wallClockS) ? summary.wallClockS : 0;
    const loadPhaseS = Number.isFinite(summary.loadPhaseS) ? summary.loadPhaseS : 0;
    const tailS = Number.isFinite(summary.tailS) ? summary.tailS : 0;

    const line =
      `loadtest_summary,run_id=${safeRunId},test_case=${testCase},target_rps=${targetRps},duration_s=${durationS}` +
      ` p95_ms=${p95},avg_ms=${avg},median_ms=${median},throughput_rps=${throughput},client_share=${clientShare}` +
      `,redirected_ok_count=${redirectedOkCount}` +
      `,vus_count=${vusCount}` +
      `,sent_count=${sentCount},completed_count=${completedCount},ok_count=${okCount},error_count=${errorCount}` +
      `,timeout_count=${timeoutCount},network_error_count=${networkErrorCount},parse_error_count=${parseErrorCount},http_error_count=${httpErrorCount}` +
      `,wall_clock_s=${wallClockS},load_phase_s=${loadPhaseS},tail_s=${tailS}` +
      ` ${ts}`;

    await this.writeLine(line);
  }
}

module.exports = InfuxDbMetrics;