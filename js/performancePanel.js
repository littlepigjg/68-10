class PerformancePanel {
    constructor(monitor, options = {}) {
        this.monitor = monitor;
        this.options = {
            position: options.position || 'bottom-right',
            collapsed: options.collapsed || false,
            ...options
        };
        
        this.isVisible = false;
        this.isCollapsed = this.options.collapsed;
        this.charts = {};
        this._unsubscribe = null;
        this._container = null;
        
        this._throttleTimer = null;
        this._pendingUpdateInterval = 500;
        
        this._init();
    }

    _init() {
        this._createContainer();
        this._bindToggleButton = this._createToggleButton();
    }

    _createContainer() {
        const container = document.createElement('div');
        container.className = `perf-panel perf-panel-${this.options.position}`;
        container.style.display = 'none';
        container.innerHTML = this._getPanelHTML();
        document.body.appendChild(container);
        this._container = container;
        
        this._initCharts();
        this._bindEvents();
    }

    _getPanelHTML() {
        return `
            <div class="perf-panel-header">
                <span class="perf-panel-title">📊 性能监控</span>
                <div class="perf-panel-header-actions">
                    <button class="perf-btn perf-btn-icon" data-action="export" title="导出报告">💾</button>
                    <button class="perf-btn perf-btn-icon" data-action="collapse" title="收起/展开">➖</button>
                    <button class="perf-btn perf-btn-icon" data-action="close" title="关闭">✕</button>
                </div>
            </div>
            <div class="perf-panel-content">
                <div class="perf-metrics-grid">
                    <div class="perf-metric-card">
                        <div class="perf-metric-label">FPS</div>
                        <div class="perf-metric-value" data-metric="fps">--</div>
                        <div class="perf-metric-trend" data-trend="fps"></div>
                        <canvas class="perf-chart-canvas" data-chart="fps"></canvas>
                    </div>
                    <div class="perf-metric-card">
                        <div class="perf-metric-label">内存 (MB)</div>
                        <div class="perf-metric-value" data-metric="memory">--</div>
                        <div class="perf-metric-trend" data-trend="memory"></div>
                        <canvas class="perf-chart-canvas" data-chart="memory"></canvas>
                    </div>
                    <div class="perf-metric-card">
                        <div class="perf-metric-label">Worker延迟 (ms)</div>
                        <div class="perf-metric-value" data-metric="workerLatency">--</div>
                        <div class="perf-metric-trend" data-trend="workerLatency"></div>
                        <canvas class="perf-chart-canvas" data-chart="workerLatency"></canvas>
                    </div>
                    <div class="perf-metric-card">
                        <div class="perf-metric-label">渲染耗时 (ms)</div>
                        <div class="perf-metric-value" data-metric="renderTime">--</div>
                        <div class="perf-metric-trend" data-trend="renderTime"></div>
                        <canvas class="perf-chart-canvas" data-chart="renderTime"></canvas>
                    </div>
                </div>
                
                <div class="perf-section">
                    <div class="perf-section-title">⚡ 优化建议</div>
                    <div class="perf-suggestions" data-suggestions></div>
                </div>
                
                <div class="perf-section">
                    <div class="perf-section-title">📈 详细统计</div>
                    <div class="perf-stats-grid">
                        <div class="perf-stat-item">
                            <span class="perf-stat-label">运行时间</span>
                            <span class="perf-stat-value" data-stat="uptime">--</span>
                        </div>
                        <div class="perf-stat-item">
                            <span class="perf-stat-label">渲染次数</span>
                            <span class="perf-stat-value" data-stat="renderCount">0</span>
                        </div>
                        <div class="perf-stat-item">
                            <span class="perf-stat-label">平均渲染</span>
                            <span class="perf-stat-value" data-stat="avgRender">--</span>
                        </div>
                        <div class="perf-stat-item">
                            <span class="perf-stat-label">Worker请求</span>
                            <span class="perf-stat-value" data-stat="workerRequests">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _createToggleButton() {
        const btn = document.createElement('button');
        btn.className = `perf-toggle perf-toggle-${this.options.position}`;
        btn.innerHTML = '📊';
        btn.title = '性能监控面板';
        btn.style.display = 'none';
        document.body.appendChild(btn);
        
        btn.addEventListener('click', () => this.toggle());
        
        return btn;
    }

    _initCharts() {
        const container = this._container;
        
        const fpsCanvas = container.querySelector('[data-chart="fps"]');
        this.charts.fps = new PerformanceChart(fpsCanvas, {
            lineColor: '#22c55e',
            fillColor: 'rgba(34, 197, 94, 0.1)',
            warningThreshold: 30,
            dangerThreshold: 15,
            minValue: 0,
            maxValue: 60,
            unit: 'fps'
        });
        
        const memoryCanvas = container.querySelector('[data-chart="memory"]');
        this.charts.memory = new PerformanceChart(memoryCanvas, {
            lineColor: '#3b82f6',
            fillColor: 'rgba(59, 130, 246, 0.1)',
            warningThreshold: 500,
            dangerThreshold: 800,
            unit: 'MB'
        });
        
        const latencyCanvas = container.querySelector('[data-chart="workerLatency"]');
        this.charts.workerLatency = new PerformanceChart(latencyCanvas, {
            lineColor: '#f59e0b',
            fillColor: 'rgba(245, 158, 11, 0.1)',
            warningThreshold: 500,
            dangerThreshold: 1000,
            unit: 'ms'
        });
        
        const renderCanvas = container.querySelector('[data-chart="renderTime"]');
        this.charts.renderTime = new PerformanceChart(renderCanvas, {
            lineColor: '#8b5cf6',
            fillColor: 'rgba(139, 92, 246, 0.1)',
            warningThreshold: 200,
            dangerThreshold: 500,
            unit: 'ms'
        });
    }

    _bindEvents() {
        const container = this._container;
        
        container.querySelectorAll('.perf-btn-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                switch (action) {
                    case 'close':
                        this.hide();
                        break;
                    case 'collapse':
                        this.toggleCollapse();
                        break;
                    case 'export':
                        this.monitor.exportReport();
                        break;
                }
            });
        });
    }

    show() {
        this.isVisible = true;
        this._container.style.display = 'block';
        this._bindToggleButton.style.display = 'none';
        this.monitor.start();
        this._unsubscribe = this.monitor.subscribe(() => this._scheduleUpdate());
        this._updateAll(this.monitor.getSnapshot());
    }

    hide() {
        this.isVisible = false;
        this._container.style.display = 'none';
        this._bindToggleButton.style.display = 'block';
        this.monitor.stop();
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this._container.classList.toggle('perf-collapsed', this.isCollapsed);
    }

    showToggleButton() {
        this._bindToggleButton.style.display = 'block';
    }

    hideToggleButton() {
        this._bindToggleButton.style.display = 'none';
    }

    _scheduleUpdate() {
        if (this._throttleTimer) return;
        this._throttleTimer = setTimeout(() => {
            this._throttleTimer = null;
            this._updateAll(this.monitor.getSnapshot());
        }, this._pendingUpdateInterval);
    }

    _updateAll(snapshot) {
        if (!this.isVisible || this.isCollapsed) return;
        
        this._updateMetrics(snapshot);
        this._updateCharts(snapshot);
        this._updateStats(snapshot);
        this._updateSuggestions(snapshot);
    }

    _updateMetrics(snapshot) {
        const container = this._container;
        
        const fpsEl = container.querySelector('[data-metric="fps"]');
        fpsEl.textContent = snapshot.fps;
        fpsEl.className = 'perf-metric-value';
        if (snapshot.fps < 15) fpsEl.classList.add('perf-danger');
        else if (snapshot.fps < 30) fpsEl.classList.add('perf-warning');
        else fpsEl.classList.add('perf-good');
        
        const memEl = container.querySelector('[data-metric="memory"]');
        memEl.textContent = snapshot.memory.used.toFixed(1);
        memEl.className = 'perf-metric-value';
        if (snapshot.memory.used > 800) memEl.classList.add('perf-danger');
        else if (snapshot.memory.used > 500) memEl.classList.add('perf-warning');
        
        const latEl = container.querySelector('[data-metric="workerLatency"]');
        latEl.textContent = snapshot.workerLatency.avg.toFixed(0);
        latEl.className = 'perf-metric-value';
        if (snapshot.workerLatency.avg > 1000) latEl.classList.add('perf-danger');
        else if (snapshot.workerLatency.avg > 500) latEl.classList.add('perf-warning');
        
        const renderEl = container.querySelector('[data-metric="renderTime"]');
        renderEl.textContent = snapshot.renderTime.last.toFixed(0);
        renderEl.className = 'perf-metric-value';
        if (snapshot.renderTime.last > 500) renderEl.classList.add('perf-danger');
        else if (snapshot.renderTime.last > 200) renderEl.classList.add('perf-warning');
    }

    _updateCharts(snapshot) {
        this.charts.fps.setData(snapshot.fpsHistory);
        this.charts.memory.setData(snapshot.memoryHistory);
        this.charts.workerLatency.setData(snapshot.workerLatencyHistory);
        this.charts.renderTime.setData(snapshot.renderTimeHistory);
    }

    _updateStats(snapshot) {
        const container = this._container;
        
        const uptime = snapshot.uptime;
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        const seconds = Math.floor((uptime % 60000) / 1000);
        const uptimeStr = hours > 0 
            ? `${hours}h ${minutes}m ${seconds}s`
            : `${minutes}m ${seconds}s`;
        container.querySelector('[data-stat="uptime"]').textContent = uptimeStr;
        
        container.querySelector('[data-stat="renderCount"]').textContent = 
            snapshot.eventCounts.get('renderCount') || 0;
        
        container.querySelector('[data-stat="avgRender"]').textContent = 
            snapshot.renderTime.avg > 0 
                ? snapshot.renderTime.avg.toFixed(1) + 'ms'
                : '--';
        
        container.querySelector('[data-stat="workerRequests"]').textContent = 
            snapshot.eventCounts.get('workerRequests') || 0;
    }

    _updateSuggestions(snapshot) {
        const suggestions = this._analyzePerformance(snapshot);
        const container = this._container.querySelector('[data-suggestions]');
        
        if (suggestions.length === 0) {
            container.innerHTML = '<div class="perf-suggestion perf-good"><span class="perf-suggestion-icon">✅</span><span>性能表现良好，继续保持！</span></div>';
            return;
        }
        
        container.innerHTML = suggestions.map(s => `
            <div class="perf-suggestion perf-${s.severity}">
                <span class="perf-suggestion-icon">${s.icon}</span>
                <div class="perf-suggestion-content">
                    <div class="perf-suggestion-title">${s.title}</div>
                    <div class="perf-suggestion-desc">${s.description}</div>
                </div>
            </div>
        `).join('');
    }

    _analyzePerformance(snapshot) {
        const suggestions = [];
        
        const fpsHistory = snapshot.fpsHistory.filter(d => d.value > 0);
        if (fpsHistory.length >= 10) {
            const lowFpsCount = fpsHistory.filter(d => d.value < 30).length;
            const lowFpsRatio = lowFpsCount / fpsHistory.length;
            
            if (lowFpsRatio > 0.5) {
                suggestions.push({
                    severity: 'danger',
                    icon: '🚨',
                    title: '帧率严重不足',
                    description: 'FPS持续低于30，建议减少渲染复杂度或使用Web Worker'
                });
            } else if (lowFpsRatio > 0.2) {
                suggestions.push({
                    severity: 'warning',
                    icon: '⚠️',
                    title: '帧率波动较大',
                    description: '部分时段FPS低于30，建议优化渲染逻辑或减少重绘区域'
                });
            }
        }
        
        if (snapshot.memory.used > 800) {
            suggestions.push({
                severity: 'danger',
                icon: '🧠',
                title: '内存占用过高',
                description: '内存使用超过800MB，建议检查是否有内存泄漏或及时释放大对象'
            });
        } else if (snapshot.memory.used > 500) {
            suggestions.push({
                severity: 'warning',
                icon: '💾',
                title: '内存占用偏高',
                description: '内存使用超过500MB，建议优化缓存策略'
            });
        }
        
        if (snapshot.workerLatency.avg > 1000) {
            suggestions.push({
                severity: 'danger',
                icon: '🐢',
                title: 'Worker响应缓慢',
                description: 'Worker平均响应超过1秒，建议减少单次任务拆分或优化算法'
            });
        } else if (snapshot.workerLatency.avg > 500) {
            suggestions.push({
                severity: 'warning',
                icon: '⏱️',
                title: 'Worker延迟偏高',
                description: 'Worker响应超过500ms，可考虑结果缓存或增量计算'
            });
        }
        
        if (snapshot.renderTime.avg > 500) {
            suggestions.push({
                severity: 'danger',
                icon: '🎨',
                title: '渲染耗时过长',
                description: '平均渲染超过500ms，建议优化绘制逻辑或减少绘制元素'
            });
        } else if (snapshot.renderTime.avg > 200) {
            suggestions.push({
                severity: 'warning',
                icon: '🖌️',
                title: '渲染性能一般',
                description: '平均渲染超过200ms，可考虑离屏渲染或分层渲染优化'
            });
        }
        
        const memHistory = snapshot.memoryHistory;
        if (memHistory.length >= 30) {
            const firstHalf = memHistory.slice(0, Math.floor(memHistory.length / 2));
            const secondHalf = memHistory.slice(Math.floor(memHistory.length / 2));
            const firstAvg = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length;
            
            if (secondAvg > firstAvg * 1.5 && secondAvg - firstAvg > 100) {
                suggestions.push({
                    severity: 'warning',
                    icon: '📈',
                    title: '内存持续增长',
                    description: '检测到内存持续上升趋势，可能存在内存泄漏'
                });
            }
        }
        
        return suggestions;
    }

    destroy() {
        this.hide();
        Object.values(this.charts).forEach(chart => chart.destroy());
        if (this._container?.remove());
        if (this._bindToggleButton?.remove());
        if (this._throttleTimer) clearTimeout(this._throttleTimer);
    }
}

if (typeof window !== 'undefined') {
    window.PerformancePanel = PerformancePanel;
}
