const Timer = {
    timeLeft: 1200,
    timerId: null,
    isRunning: false,
    isEditing: false,
    display: document.getElementById('timer-display'),
    endTimeEl: document.getElementById('end-time-display'),
    toggleBtn: document.getElementById('toggle-btn'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    container: document.getElementById('app-container'),

    init() {
        this.display.addEventListener('focus', () => { this.isEditing = true; this.stop(); });
        this.display.addEventListener('blur', () => { this.isEditing = false; this.parseInput(); });
        this.display.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.display.blur(); } });

        const saved = localStorage.getItem('timer_presets');
        if (saved) {
            try {
                const vals = JSON.parse(saved);
                const btns = document.querySelectorAll('.preset-btn');
                if (vals.length === btns.length) {
                    btns.forEach((b, i) => {
                        b.dataset.time = vals[i];
                        b.querySelector('.preset-val').textContent = vals[i];
                    });
                }
            } catch (e) { }
        }
        this.updateDisplay();
    },

    parseInput() {
        const txt = this.display.textContent.trim(); let s = 0;
        if (txt.includes(':')) { const p = txt.split(':'); s = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0); } else s = (parseInt(txt) || 0) * 60;
        if (s > 0) { this.timeLeft = s; this.container.classList.remove('finished'); this.updateDisplay(); this.start(); } else this.updateDisplay();
    },

    savePreset(el) {
        let val = parseFloat(el.textContent);
        if (!isNaN(val) && val > 0) {
            val = Math.floor(val * 10) / 10;
            el.textContent = val;
            el.parentElement.dataset.time = val;
            const vals = [];
            document.querySelectorAll('.preset-btn').forEach(b => vals.push(parseFloat(b.dataset.time)));
            localStorage.setItem('timer_presets', JSON.stringify(vals));
        } else {
            el.textContent = el.parentElement.dataset.time;
        }
        window.getSelection().removeAllRanges();
    },

    set(m, btn) {
        if (btn) {
            const latest = parseFloat(btn.dataset.time);
            if (!isNaN(latest)) m = latest;
        }
        this.stop();
        this.container.classList.remove('finished');
        this.timeLeft = m * 60;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        this.updateDisplay(); this.start();
    },

    toggle() { if (this.isRunning) this.stop(); else this.start(); },

    start() {
        AudioMgr.init();
        Background.startPersistence();
        if (this.timeLeft <= 0) return;
        clearInterval(this.timerId);
        this.isRunning = true;
        this.container.classList.add('running');
        this.playIcon.style.display = 'none'; this.pauseIcon.style.display = 'block';
        this.toggleBtn.style.backgroundColor = 'var(--accent)'; this.toggleBtn.style.color = '#fff';
        this.timerId = setInterval(() => { if (!this.isEditing) { this.timeLeft--; this.updateDisplay(); if (this.timeLeft <= 0) this.complete(); } }, 1000);
        this.updateEndTime();
    },

    stop() {
        this.isRunning = false; clearInterval(this.timerId); this.container.classList.remove('running');
        this.playIcon.style.display = 'block'; this.pauseIcon.style.display = 'none';
        this.toggleBtn.style.backgroundColor = 'var(--text-primary)'; this.toggleBtn.style.color = 'var(--bg)';
        this.updateDisplay();
        Background.stopPersistence();
    },

    complete() {
        this.stop();
        this.container.classList.add('finished');
        Background.sendNotification("Timer Finished", "Your countdown has ended.");
        AudioMgr.startSound();
        setTimeout(() => { AudioMgr.stopSound(); Background.stopPersistence(); }, 3000);
    },

    updateDisplay() {
        if (this.isEditing) return;
        const m = Math.floor(Math.abs(this.timeLeft) / 60); const s = Math.abs(this.timeLeft) % 60;
        const str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        this.display.textContent = str;
        document.title = this.isRunning ? str + " • Timer" : "Timer";
        this.updateEndTime();
    },

    updateEndTime() {
        if (this.timeLeft <= 0) { this.endTimeEl.textContent = this.isRunning ? "Time's up" : ""; return; }
        const end = new Date(Date.now() + this.timeLeft * 1000);
        this.endTimeEl.textContent = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};
