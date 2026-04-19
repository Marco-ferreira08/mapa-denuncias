// =========================================
// Advanced Render Engine for Charts via Canvas API
// (Substitui o gráfico de barras puramente HTML/CSS)
// =========================================

class CanvasChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.data = [];
        this.labels = [];
        this.colors = [];
        
        // Ajuste de DPI para telas retina (macOS / Mobile)
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = 200 * dpr; // Altura fixa lógica
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `200px`;
        
        this.logicalWidth = rect.width;
        this.logicalHeight = 200;

        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Animation state
        this.animationProgress = 0;
        this.animating = false;
    }

    handleResize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = 200 * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `200px`;
        
        this.logicalWidth = rect.width;
        this.logicalHeight = 200;
        
        if (!this.animating) this.draw(1);
    }

    render(dataPoints, labels, colors) {
        this.data = dataPoints;
        this.labels = labels;
        this.colors = colors;
        
        this.startAnimation();
    }

    startAnimation() {
        this.animationProgress = 0;
        this.animating = true;
        const duration = 800;
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            // cubic ease out
            const progress = Math.min(elapsed / duration, 1);
            this.animationProgress = 1 - Math.pow(1 - progress, 3);
            
            this.draw(this.animationProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.animating = false;
            }
        };
        requestAnimationFrame(animate);
    }

    draw(progress) {
        if (!this.ctx) return;
        
        const { ctx, logicalWidth: w, logicalHeight: h } = this;
        
        // Clear canvas
        ctx.clearRect(0, 0, w, h);
        
        if (this.data.length === 0) return;

        const maxVal = Math.max(...this.data, 1);
        const padding = { top: 20, bottom: 30, left: 10, right: 10 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        
        const barWidth = Math.min((chartW / this.data.length) * 0.6, 60);
        const spacing = (chartW - (barWidth * this.data.length)) / (this.data.length + 1);

        // Draw background grid lines
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH * (i / 4));
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
        }
        ctx.stroke();

        // Draw bars
        this.data.forEach((val, i) => {
            const x = padding.left + spacing + (i * (barWidth + spacing));
            const barH = (val / maxVal) * chartH * progress;
            const y = padding.top + chartH - barH;

            // Bar fill com gradient
            const grad = ctx.createLinearGradient(x, y, x, y + barH);
            const color = this.colors[i] || '#3b82f6';
            
            // converte HEX/Text em gradiente manual, apenas usando a opacidade
            ctx.fillStyle = color;
            
            // Draw chamfered/rounded rect
            const radius = 6;
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, y + barH);
            ctx.lineTo(x, y + barH);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.fill();

            // Draw Value on Top
            if (progress > 0.5 && val > 0) {
                ctx.fillStyle = '#64748b';
                ctx.font = '600 12px Inter, sans-serif';
                ctx.textAlign = 'center';
                const currentVal = Math.round(val * progress);
                ctx.fillText(currentVal, x + barWidth / 2, y - 8);
            }

            // Draw Label on Bottom
            ctx.fillStyle = '#0f172a';
            ctx.font = '500 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            // Pega o emoji e o texto
            ctx.fillText(this.labels[i], x + barWidth / 2, h - 8);
        });
    }
}

// Expondo a classe de forma global
window.CanvasChart = CanvasChart;
