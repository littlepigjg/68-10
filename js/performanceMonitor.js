class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = false;
        this.maxDataPoints = options.maxDataPoints || 300;
        this.sampleInterval = options.sampleInterval || 1000;
        
        this.fps = 0;
        this.fpsHistory = [];
        this._frameCount = 0;
        this._lastFpsTime = 0;
        this._rafId = null;
        
        this.memory = { used: 0, total: 0, limit: 0 };
        this.memoryHistory = [];
        
        this.workerLatency = { avg: 0, min: Infinity, max: 0 };
        this.workerLatencyHistory = [];
        this._pendingWorkerRequests = new Map();
        this._workerRequestId = 0;
        this._workerRequestCount = 0;
        this._workerLatencySum = 0;
        
        this.renderTime = { avg: 0, min: Infinity, max: 0, last: 0 };
        this.renderTimeHistory = [];
        this._renderCount = 0;
        this._renderTimeSum = 0;
        
        this.eventCounts = new Map();
        this.eventHistory = [];
        
        this.listeners = new Set();
        this._sampleTimer = null;
        this._startTime = 0;
    }

    start() {
        if (this.enabled) return;
        this.enabled = true;
        this._startTime = performance.now();
        this._lastFpsTime = performance.now();
        this._startFpsCounter();
        this._startSampling();
    }

    stop() {
        if (!this.enabled) return;
        this.enabled = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._sampleTimer) {
            clearInterval(this._sampleTimer);
            this._sampleTimer = null;
        }
    }

    reset() {
        this.fps = 0;
        this.fpsHistory = [];
        this._frameCount = 0;
        this._lastFpsTime = performance.now();
        
        this.memory = { used: 0, total: 0, limit: 0 };
        this.memoryHistory = [];
        
        this.workerLatency = { avg: 0, min: Infinity, max: 0 };
        this.workerLatencyHistory = [];
        this._pendingWorkerRequests.clear();
        this._workerRequestCount = 0;
        this._workerLatencySum = 0;
        
        this.renderTime = { avg: 0, min: Infinity, max: 0, last: 0 };
        this.renderTimeHistory = [];
        this._renderCount = 0;
        this._renderTimeSum = 0;
        
        this.eventCounts.clear();
        this.eventHistory = [];
        
        this._startTime = performance.now();
    }

    _startFpsCounter() {
        const loop = () => {
            if (!this.enabled) return;
            this._frameCount++;
            const now = performance.now();
            const elapsed = now - this._lastFpsTime;
            
            if (elapsed >= this.sampleInterval) {
                this.fps = Math.round((this._frameCount / elapsed) * 1000);
                this._frameCount = 0;
                this._lastFpsTime = now;
            }
            
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    _startSampling() {
        this._sampleTimer = setInterval(() => {
            if (!this.enabled) return;
            this._sampleMemory();
            this._recordHistory();
            this._notifyListeners();
        }, this.sampleInterval);
    }

    _sampleMemory() {
        if (performance.memory) {
            this.memory = {
                used: performance.memory.usedJSHeapSize / (1024 * 1024),
                total: performance.memory.totalJSHeapSize / (1024 * 1024),
                limit: performance.memory.jsHeapSizeLimit / (1024 * 1024)
            };
        }
    }

    _recordHistory() {
        const timestamp = Date.now();
        
        this.fpsHistory.push({ timestamp, value: this.fps });
        if (this.fpsHistory.length > this.maxDataPoints) {
            this.fpsHistory.shift();
        }
        
        this.memoryHistory.push({ timestamp, value: this.memory.used });
        if (this.memoryHistory.length > this.maxDataPoints) {
            this.memoryHistory.shift();
        }
        
        this.workerLatencyHistory.push({ timestamp, value: this.workerLatency.avg });
        if (this.workerLatencyHistory.length > this.maxDataPoints) {
            this.workerLatencyHistory.shift();
        }
        
        this.renderTimeHistory.push({ timestamp, value: this.renderTime.last });
        if (this.renderTimeHistory.length > this.maxDataPoints) {
            this.renderTimeHistory.shift();
        }
    }

    trackWorkerRequest(type) {
        const id = ++this._workerRequestId;
        this._pendingWorkerRequests.set(id, {
            type,
            startTime: performance.now()
        });
        return id;
    }

    trackWorkerResponse(id) {
        const request = this._pendingWorkerRequests.get(id);
        if (!request) return;
        
        this._pendingWorkerRequests.delete(id);
        const latency = performance.now() - request.startTime;
        
        if (latency < this.workerLatency.min) this.workerLatency.min = latency;
        if (latency > this.workerLatency.max) this.workerLatency.max = latency;
        
        this._workerRequestCount++;
        this._workerLatencySum += latency;
        this.workerLatency.avg = this._workerLatencySum / this._workerRequestCount;
        
        this._incrementEvent('workerRequests');
    }

    trackRender(durationMs) {
        this.renderTime.last = durationMs;
        this._renderCount++;
        this._renderTimeSum += durationMs;
        this.renderTime.avg = this._renderTimeSum / this._renderCount;
        
        if (durationMs < this.renderTime.min) this.renderTime.min = durationMs;
        if (durationMs > this.renderTime.max) this.renderTime.max = durationMs;
        
        this._incrementEvent('renderCount');
    }

    _incrementEvent(name) {
        const count = this.eventCounts.get(name) || 0;
        this.eventCounts.set(name, count + 1);
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notifyListeners() {
        const data = this.getSnapshot();
        for (const listener of this.listeners) {
            try {
                listener(data);
            } catch (e) {
                console.error('Performance monitor listener error:', e);
            }
        }
    }

    getSnapshot() {
        return {
            fps: this.fps,
            fpsHistory: [...this.fpsHistory],
            memory: { ...this.memory },
            memoryHistory: [...this.memoryHistory],
            workerLatency: { ...this.workerLatency },
            workerLatencyHistory: [...this.workerLatencyHistory],
            renderTime: { ...this.renderTime },
            renderTimeHistory: [...this.renderTimeHistory],
            eventCounts: new Map(this.eventCounts),
            uptime: performance.now() - this._startTime,
            timestamp: Date.now()
        };
    }

    getReport() {
        const snapshot = this.getSnapshot();
        
        const fpsValues = this.fpsHistory.map(d => d.value).filter(v => v > 0);
        const memValues = this.memoryHistory.map(d => d.value);
        const renderValues = this.renderTimeHistory.map(d => d.value).filter(v => v > 0);
        const latencyValues = this.workerLatencyHistory.map(d => d.value).filter(v => v > 0);
        
        const stats = (arr) => {
            if (arr.length === 0) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
            const sorted = [...arr].sort((a, b) => a - b);
            return {
                avg: arr.reduce((a, b) => a + b, 0) / arr.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)]
            };
        };
        
        return {
            version: '1.0',
            generatedAt: new Date().toISOString(),
            uptimeMs: snapshot.uptime,
            metrics: {
                fps: stats(fpsValues),
                memoryMB: stats(memValues),
                renderTimeMs: stats(renderValues),
                workerLatencyMs: stats(latencyValues)
            },
            rawData: {
                fpsHistory: this.fpsHistory,
                memoryHistory: this.memoryHistory,
                renderTimeHistory: this.renderTimeHistory,
                workerLatencyHistory: this.workerLatencyHistory
            },
            eventCounts: Object.fromEntries(this.eventCounts),
            systemInfo: {
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                deviceMemory: navigator.deviceMemory || 'unknown',
                screenResolution: `${screen.width}x${screen.height}`,
                windowSize: `${window.innerWidth}x${window.innerHeight}`
            }
        };
    }

    exportReport() {
        const report = this.getReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

if (typeof window !== 'undefined') {
    window.PerformanceMonitor = PerformanceMonitor;
}
