class PerformanceChart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            lineColor: options.lineColor || '#667eea',
            fillColor: options.fillColor || 'rgba(102, 126, 234, 0.1)',
            gridColor: options.gridColor || 'rgba(200, 200, 200, 0.3)',
            textColor: options.textColor || '#666',
            warningColor: options.warningColor || '#f59e0b',
            dangerColor: options.dangerColor || '#ef4444',
            warningThreshold: options.warningThreshold || null,
            dangerThreshold: options.dangerThreshold || null,
            showGrid: options.showGrid !== false,
            showLabels: options.showLabels !== false,
            smoothing: options.smoothing !== false,
            unit: options.unit || '',
            maxValue: options.maxValue || null,
            minValue: options.minValue || null,
            ...options
        };
        
        this.data = [];
        this._resizeObserver = null;
        this._setupResize();
    }

    _setupResize() {
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._resize());
            this._resizeObserver.observe(this.canvas);
        }
        this._resize();
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        if (rect.width === 0 || rect.height === 0) return;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
        
        this.render();
    }

    setData(data) {
        this.data = data || [];
        this.render();
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.render();
    }

    _getValueRange() {
        let min = this.options.minValue;
        let max = this.options.maxValue;
        
        if (min === null || max === null) {
            const values = this.data.map(d => d.value);
            if (values.length === 0) {
                min = min !== null ? min : 0;
                max = max !== null ? max : 100;
            } else {
                const dataMin = Math.min(...values);
                const dataMax = Math.max(...values);
                
                if (min === null) min = Math.min(0, dataMin * 0.9);
                if (max === null) {
                    max = dataMax * 1.1;
                    if (max === min) max = min + 1;
                }
            }
        }
        
        return { min, max };
    }

    _getLineColor(value) {
        const { dangerThreshold, warningThreshold, lineColor, warningColor, dangerColor } = this.options;
        
        if (dangerThreshold !== null && value >= dangerThreshold) return dangerColor;
        if (warningThreshold !== null && value >= warningThreshold) return warningColor;
        return lineColor;
    }

    render() {
        if (!this.width || !this.height) return;
        
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        const padding = { top: 10, right: 10, bottom: this.options.showLabels ? 20 : 5, left: this.options.showLabels ? 35 : 5 };
        const chartWidth = this.width - padding.left - padding.right;
        const chartHeight = this.height - padding.top - padding.bottom;
        
        const { min, max } = this._getValueRange();
        
        if (this.options.showGrid) {
            this._drawGrid(ctx, padding, chartWidth, chartHeight, min, max);
        }
        
        if (this.data.length > 0) {
            this._drawLine(ctx, padding, chartWidth, chartHeight, min, max);
        }
        
        if (this.options.showLabels) {
            this._drawLabels(ctx, padding, chartWidth, chartHeight, min, max);
        }
    }

    _drawGrid(ctx, padding, chartWidth, chartHeight, min, max) {
        ctx.strokeStyle = this.options.gridColor;
        ctx.lineWidth = 1;
        
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
    }

    _drawLine(ctx, padding, chartWidth, chartHeight, min, max) {
        const { smoothing, fillColor } = this.options;
        const data = this.data;
        const valueRange = max - min;
        
        const getX = (i) => {
            if (data.length === 1) return padding.left + chartWidth / 2;
            return padding.left + (i / (data.length - 1)) * chartWidth;
        };
        
        const getY = (value) => {
            return padding.top + chartHeight - ((value - min) / valueRange) * chartHeight;
        };
        
        const lastValue = data[data.length - 1]?.value ?? 0;
        const lineColor = this._getLineColor(lastValue);
        
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        ctx.moveTo(getX(0), padding.top + chartHeight);
        
        if (smoothing && data.length > 2) {
            ctx.lineTo(getX(0), getY(data[0].value));
            for (let i = 0; i < data.length - 1; i++) {
                const x1 = getX(i);
                const y1 = getY(data[i].value);
                const x2 = getX(i + 1);
                const y2 = getY(data[i + 1].value);
                const xc = (x1 + x2) / 2;
                ctx.quadraticCurveTo(x1, y1, xc, (y1 + y2) / 2);
            }
            ctx.lineTo(getX(data.length - 1), getY(data[data.length - 1].value));
        } else {
            for (let i = 0; i < data.length; i++) {
                ctx.lineTo(getX(i), getY(data[i].value));
            }
        }
        
        ctx.lineTo(getX(data.length - 1), padding.top + chartHeight);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        if (smoothing && data.length > 2) {
            ctx.moveTo(getX(0), getY(data[0].value));
            for (let i = 0; i < data.length - 1; i++) {
                const x1 = getX(i);
                const y1 = getY(data[i].value);
                const x2 = getX(i + 1);
                const y2 = getY(data[i + 1].value);
                const xc = (x1 + x2) / 2;
                ctx.quadraticCurveTo(x1, y1, xc, (y1 + y2) / 2);
            }
            ctx.lineTo(getX(data.length - 1), getY(data[data.length - 1].value));
        } else {
            for (let i = 0; i < data.length; i++) {
                ctx.lineTo(getX(i), getY(data[i].value));
            }
        }
        
        ctx.stroke();
        
        if (data.length > 0) {
            const lastX = getX(data.length - 1);
            const lastY = getY(data[data.length - 1].value);
            
            ctx.fillStyle = lineColor;
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawLabels(ctx, padding, chartWidth, chartHeight, min, max) {
        ctx.fillStyle = this.options.textColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            const value = max - ((max - min) / gridLines) * i;
            const label = this._formatValue(value);
            ctx.fillText(label, padding.left - 5, y);
        }
    }

    _formatValue(value) {
        const { unit } = this.options;
        
        if (value >= 1024 * 1024) {
            return (value / (1024 * 1024)).toFixed(1) + unit;
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'k' + unit;
        }
        if (value < 10) {
            return value.toFixed(1) + unit;
        }
        return Math.round(value) + unit;
    }

    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.PerformanceChart = PerformanceChart;
}
