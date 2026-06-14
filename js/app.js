/* ============================================
   App — Main Controller (Routing, Theme, Modal, Toast)
   ============================================ */
const App = (() => {
    let currentPage = 'table';

    async function init() {
        setupNavigation();
        setupTheme();
        setupModals();
        setupHamburger();
        setupAuth();
        setupDropdowns();
        setupAntiCopy();

        // Refresh Data Event
        const refreshBtn = document.getElementById('btn-refresh-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', handleManualRefresh);
        }

        // Check cloud sync on startup
        if (DataManager.getCloudUrl()) {
            const loader = document.getElementById('global-loader');
            if (loader) loader.style.display = 'flex';
            
            const success = await DataManager.pullFromCloud();
            
            if (loader) loader.style.display = 'none';
            
            if (success) {
                showToast('อัปเดตข้อมูลจากฐานข้อมูลแล้ว', 'info');
                updateLastUpdatedText();
            } else {
                showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ทำงานในโหมดออฟไลน์', 'warning');
            }
        } else if (!DataManager.hasData()) {
            // Load demo data only if no cloud URL and no local data
            // DataManager.loadDemoData(); 
            // We shouldn't load demo data automatically anymore to avoid confusion with empty fresh sheets.
        }

        // Initialize all modules
        LeaveTable.init();
        Dashboard.init();
        Calendar.init();
        TeacherManager.init();
        Settings.init();

        // Default page
        navigate('table');
        
        // Initial text update
        updateLastUpdatedText();

        // Global Visit Counter (as Version)
        fetch('https://api.counterapi.dev/v1/teacher_leave_app_v1/visits/up')
            .then(res => res.json())
            .then(data => {
                let count = data.count || 1;
                let v = Math.floor(count / 10000) + 1;
                let rem = (count % 10000).toString().padStart(4, '0');
                const vEl = document.getElementById('global-visit-count');
                if (vEl) vEl.textContent = `v${v}.${rem}`;
            })
            .catch(err => {
                const vEl = document.getElementById('global-visit-count');
                if (vEl) vEl.textContent = `v1.0001`;
            });
    }

    async function handleManualRefresh() {
        if (!DataManager.getCloudUrl()) {
            showToast('คุณยังไม่ได้ตั้งค่า Google Sheets URL', 'warning');
            return;
        }

        const icon = document.querySelector('#btn-refresh-data .material-icons-round');
        if (icon) icon.classList.add('spinning');
        
        const success = await DataManager.pullFromCloud();
        
        if (icon) icon.classList.remove('spinning');

        if (success) {
            showToast('อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว', 'success');
            updateLastUpdatedText();
            // Re-render current page
            if (currentPage === 'table') LeaveTable.render();
            if (currentPage === 'dashboard') Dashboard.render();
            if (currentPage === 'calendar') Calendar.render();
            if (currentPage === 'teachers') TeacherManager.render();
        } else {
            showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        }
    }

    // --- Navigation ---
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(item.dataset.page);
                // Close mobile menu
                document.getElementById('main-nav').classList.remove('open');
                document.getElementById('nav-overlay').classList.remove('open');
            });
        });
    }

    function navigate(pageName) {
        currentPage = pageName;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('active', page.id === `page-${pageName}`);
        });

        // Refresh active page content
        switch (pageName) {
            case 'table': LeaveTable.render(); break;
            case 'dashboard': Dashboard.render(); break;
            case 'calendar': Calendar.render(); break;
            case 'teachers': TeacherManager.render(); break;
            case 'settings': Settings.render(); break;
        }
    }

    // --- Theme ---
    function setupTheme() {
        const toggle = document.getElementById('theme-toggle');
        const saved = localStorage.getItem('tla_theme') || 'light';
        applyTheme(saved);

        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('tla_theme', next);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = document.querySelector('#theme-toggle .material-icons-round');
        if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }

    // --- Hamburger Menu ---
    function setupHamburger() {
        const btn = document.getElementById('hamburger-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('nav-overlay');

        btn.addEventListener('click', () => {
            nav.classList.toggle('open');
            overlay.classList.toggle('open');
        });

        overlay.addEventListener('click', () => {
            nav.classList.remove('open');
            overlay.classList.remove('open');
        });
    }

    // --- Auth ---
    function setupAuth() {
        const toggleBtn = document.getElementById('auth-toggle');
        const loginBtn = document.getElementById('btn-login-submit');
        const pinInput = document.getElementById('auth-pin');

        updateAuthUI();

        toggleBtn.addEventListener('click', () => {
            if (isAdmin()) {
                // Logout
                confirm('ต้องการออกจากโหมดผู้ดูแลระบบหรือไม่?', () => {
                    DataManager.logout();
                    updateAuthUI();
                    showToast('ออกจากโหมดผู้ดูแลระบบแล้ว', 'info');
                    navigate(currentPage); // Refresh page
                });
            } else {
                // Show login modal
                pinInput.value = '';
                showModal('auth-modal');
                setTimeout(() => pinInput.focus(), 200);
            }
        });

        loginBtn.addEventListener('click', () => {
            const pin = pinInput.value;
            if (DataManager.login(pin)) {
                hideModal('auth-modal');
                updateAuthUI();
                showToast('เข้าสู่ระบบผู้ดูแลเรียบร้อย');
                navigate(currentPage); // Refresh page
            } else {
                showToast('รหัสผ่านไม่ถูกต้อง', 'error');
                pinInput.value = '';
                pinInput.focus();
            }
        });

        // Enter key in pin input
        pinInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') loginBtn.click();
        });
    }

    function isAdmin() {
        return DataManager.isAdmin();
    }

    function updateAuthUI() {
        const admin = isAdmin();
        document.body.classList.toggle('is-admin', admin);
        const toggleBtn = document.getElementById('auth-toggle');
        toggleBtn.classList.toggle('is-admin', admin);
        toggleBtn.title = admin ? 'ออกจากระบบผู้ดูแล' : 'เข้าสู่ระบบผู้ดูแล';
        toggleBtn.querySelector('.material-icons-round').textContent = admin ? 'lock_open' : 'lock';
    }

    // --- Dropdowns ---
    function setupDropdowns() {
        document.addEventListener('click', (e) => {
            const isDropdownBtn = e.target.closest('.dropdown-toggle');
            
            // Close all dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (isDropdownBtn && isDropdownBtn.nextElementSibling === menu) return;
                menu.classList.remove('show');
            });

            // Toggle clicked dropdown
            if (isDropdownBtn) {
                const menu = isDropdownBtn.nextElementSibling;
                if (menu && menu.classList.contains('dropdown-menu')) {
                    menu.classList.toggle('show');
                }
            }
        });
    }

    // --- Modals ---
    function setupModals() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => hideModal(btn.dataset.close));
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) hideModal(modal.id);
            });
        });
    }

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        toast.innerHTML = `
            <span class="material-icons-round">${icons[type] || 'info'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3000);
    }

    // --- Confirm Dialog ---
    function confirm(message, callback) {
        document.getElementById('confirm-message').textContent = message;
        showModal('confirm-modal');

        const oldBtn = document.getElementById('btn-confirm-yes');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.addEventListener('click', () => {
            hideModal('confirm-modal');
            callback();
        });
    }

    // --- Sync Indicator ---
    function showSyncIndicator() {
        const ind = document.getElementById('sync-indicator');
        if (ind) ind.classList.add('show');
    }

    function hideSyncIndicator() {
        const ind = document.getElementById('sync-indicator');
        if (ind) ind.classList.remove('show');
    }

    function updateLastUpdatedText() {
        const el = document.getElementById('last-updated-text');
        if (el) {
            const settings = DataManager.getSettings();
            if (settings && settings.lastUpdatedTimestamp) {
                const dateObj = new Date(settings.lastUpdatedTimestamp);
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                el.textContent = 'ข้อมูล ณ วันที่ ' + dateObj.toLocaleDateString('th-TH', options) + ' น.';
            } else {
                el.textContent = 'ข้อมูล ณ วันที่ - (ยังไม่มีการบันทึกล่าสุด)';
            }
        }
    }

    // --- About Modal ---
    function openAbout() {
        document.getElementById('about-modal').classList.add('open');
    }
    
    function closeAbout() {
        document.getElementById('about-modal').classList.remove('open');
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        init();
        
        // Setup About Modal listeners
        const aboutModal = document.getElementById('about-modal');
        if (aboutModal) {
            aboutModal.addEventListener('click', function(e) {
                if (e.target === this) closeAbout();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeAbout();
            });
        }
    });

    function setupAntiCopy() {
        // Prevent right click
        document.addEventListener('contextmenu', function(e) {
            if (!isAdmin()) {
                e.preventDefault();
            }
        });

        // Prevent copy shortcut
        document.addEventListener('copy', function(e) {
            if (!isAdmin()) {
                e.preventDefault();
                showToast('ไม่อนุญาตให้คัดลอกข้อมูลในโหมดผู้ชม', 'warning');
            }
        });
    }

    return { navigate, showModal, hideModal, showToast, confirm, isAdmin, showSyncIndicator, hideSyncIndicator, updateLastUpdatedText };
})();

// Global functions for inline HTML event handlers
window.openAbout = App.openAbout = () => { document.getElementById('about-modal').classList.add('open'); };
window.closeAbout = App.closeAbout = () => { document.getElementById('about-modal').classList.remove('open'); };
