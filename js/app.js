/* ============================================
   App — Main Controller (Routing, Theme, Modal, Toast)
   (v2: login is now async — server issues a session token)
   ============================================ */
const App = (() => {
    let currentPage = 'table';

    async function init() {
        // LIFF External Open Button
        const btnLiffExternal = document.getElementById('btn-liff-open-external');
        if (btnLiffExternal) {
            btnLiffExternal.addEventListener('click', () => {
                if (typeof liff !== 'undefined' && liff.openWindow) {
                    liff.openWindow({ url: location.href, external: true });
                }
            });
        }

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

        // Force Save Event (Admin Only)
        const forceSaveBtn = document.getElementById('btn-force-save');
        if (forceSaveBtn) {
            forceSaveBtn.addEventListener('click', async () => {
                if (!DataManager.getCloudUrl()) {
                    showToast('ยังไม่ได้ตั้งค่าการเชื่อมต่อคลาวด์', 'warning');
                    return;
                }
                const icon = forceSaveBtn.querySelector('.material-icons-round');
                if (icon) icon.classList.add('spinning');

                const success = await DataManager.forceSyncToCloud();

                if (icon) icon.classList.remove('spinning');
                if (success) {
                    showToast('บังคับบันทึกข้อมูลขึ้นคลาวด์สำเร็จ!', 'success');
                } else {
                    showToast('บันทึกข้อมูลไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่อ', 'error');
                }
            });
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
                updateGlobalVisitCount();
            } else {
                showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ทำงานในโหมดออฟไลน์', 'warning');
            }
        } else if (!DataManager.hasData()) {
            // Load demo data only if no cloud URL and no local data
            // DataManager.loadDemoData(); 
            // We shouldn't load demo data automatically anymore to avoid confusion with empty fresh sheets.
        }

        setupDynamicLogo();
        // Initialize all modules
        LeaveTable.init();
        Dashboard.init();
        Calendar.init();
        TeacherManager.init();
        Settings.init();
        LeaveRequest.init();
        if (window.LateArrival) LateArrival.init();

        // Default page based on URL hash or query string
        const urlParams = new URLSearchParams(window.location.search);
        const urlPage = urlParams.get('page') || window.location.hash.substring(1);
        
        if (urlPage && document.querySelector(`.nav-item[data-page="${urlPage}"]`)) {
            navigate(urlPage);
        } else {
            navigate('leave-request');
        }

        // Handle auto-print from LINE LIFF redirect
        const printId = urlParams.get('print');
        if (printId && window.LeaveRequest) {
            // Android Chrome blocks window.print() if called without direct user interaction
            // So we must show a button for the user to click
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0'; overlay.style.left = '0';
            overlay.style.width = '100%'; overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.padding = '20px';
            overlay.style.textAlign = 'center';
            
            const icon = document.createElement('span');
            icon.className = 'material-icons-round';
            icon.style.fontSize = '64px';
            icon.style.color = '#10b981';
            icon.style.marginBottom = '20px';
            icon.textContent = 'task_alt';

            const title = document.createElement('h2');
            title.style.color = '#fff';
            title.style.marginBottom = '10px';
            title.textContent = 'ข้อมูลใบลาพร้อมพิมพ์แล้ว';

            const subtitle = document.createElement('p');
            subtitle.style.color = '#cbd5e1';
            subtitle.style.marginBottom = '30px';
            subtitle.textContent = 'กรุณากดปุ่มด้านล่างเพื่อเปิดหน้าต่างบันทึก PDF';

            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.style.padding = '16px 32px';
            btn.style.fontSize = '1.2rem';
            btn.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.5)';
            btn.innerHTML = '<span class="material-icons-round" style="margin-right: 8px;">print</span> กดที่นี่เพื่อบันทึก PDF';
            
            overlay.appendChild(icon);
            overlay.appendChild(title);
            overlay.appendChild(subtitle);
            overlay.appendChild(btn);
            document.body.appendChild(overlay);

            btn.onclick = () => {
                overlay.style.display = 'none';
                LeaveRequest.printForm(printId);
                // Clean up URL so it doesn't loop on refresh
                window.history.replaceState(null, '', window.location.pathname);
            };
        }

        // Initial text update
        updateLastUpdatedText();
        updateGlobalVisitCount();

    }

    function updateGlobalVisitCount() {
        let count = parseInt(localStorage.getItem('tla_visit_count')) || 10001;
        let v = Math.floor(count / 10000);
        let rem = (count % 10000).toString().padStart(4, '0');
        const vEl = document.getElementById('global-visit-count');
        if (vEl) vEl.textContent = `v${v}.${rem}`;
    }

    async function handleManualRefresh(e) {
        if (e) e.preventDefault();
        
        if (!DataManager.getCloudUrl()) {
            showToast('กรุณาตั้งค่า Google Sheets URL', 'warning');
            return;
        }

        const icon = e.currentTarget.querySelector('.material-icons-round');
        if (icon) icon.classList.add('spinning');

        // Add a tiny delay to ensure Cloud has finished processing before we pull
        await new Promise(resolve => setTimeout(resolve, 500));

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
            if (currentPage === 'late-arrival' && window.LateArrival) LateArrival.render();
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

    const PROTECTED_PAGES = {
        'late-arrival': () => isAdmin() || isLateAdmin(),
        'teachers': () => isAdmin(),
        'settings': () => isAdmin(),
        'manage-requests': () => isAdmin()
    };

    function navigate(pageName) {
        if (PROTECTED_PAGES[pageName] && !PROTECTED_PAGES[pageName]()) {
            showToast('ไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาเข้าสู่ระบบ', 'warning');
            pageName = 'table';
        }

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
            case 'leave-request': LeaveRequest.render(); break;
            case 'manage-requests': LeaveRequest.render(); break;
            case 'late-arrival': if (window.LateArrival) LateArrival.render(); break;
        }
    }

    // --- Theme ---
    function setupTheme() {
        const toggle = document.getElementById('theme-toggle');
        const saved = localStorage.getItem('tla_theme') || 'dark';
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

        const closeBtn = document.getElementById('mobile-nav-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                nav.classList.remove('open');
                overlay.classList.remove('open');
            });
        }

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
        const loginBtnDefaultHtml = loginBtn.innerHTML;

        updateAuthUI();

        toggleBtn.addEventListener('click', () => {
            if (isAdmin() || isLateAdmin()) {
                // Logout
                confirm('ต้องการออกจากระบบหรือไม่?', () => {
                    // logout() clears the local session synchronously before it awaits
                    // anything, so the UI is safe to refresh right away.
                    DataManager.logout();
                    updateAuthUI();

                    // Reset filters so regular users see everyone
                    const tableFilter = document.getElementById('table-section-filter');
                    if (tableFilter) tableFilter.value = '';
                    const tableSearch = document.getElementById('table-search');
                    if (tableSearch) tableSearch.value = '';

                    if (window.LeaveTable) {
                        if (typeof LeaveTable.resetFilters === 'function') LeaveTable.resetFilters();
                        LeaveTable.render();
                    }

                    navigate('table');
                    showToast('ออกจากระบบแล้ว', 'info');
                });
            } else {
                // Show login modal
                pinInput.value = '';
                showModal('auth-modal');
                setTimeout(() => pinInput.focus(), 200);
            }
        });

        loginBtn.addEventListener('click', async () => {
            const pin = pinInput.value.trim();
            if (!pin) {
                showToast('กรุณากรอกรหัสผ่าน', 'warning');
                return;
            }

            // login() now talks to the server (when a Cloud URL is configured), so give
            // the user a bit of loading feedback instead of the modal appearing to hang.
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="material-icons-round spinning">sync</span> กำลังตรวจสอบ...';

            let role = false;
            try {
                role = await DataManager.login(pin);
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = loginBtnDefaultHtml;
            }

            if (role) {
                hideModal('auth-modal');
                updateAuthUI();
                if (role === 'late_admin') {
                    showToast('เข้าสู่ระบบครูเวร (บันทึกมาสาย)');
                    navigate('late-arrival');
                } else {
                    showToast('เข้าสู่ระบบผู้ดูแลเรียบร้อย');
                    navigate(currentPage); // Refresh page
                }
            } else {
                showToast('รหัสผ่านไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
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

    function isLateAdmin() {
        return typeof DataManager.isLateAdmin === 'function' ? DataManager.isLateAdmin() : false;
    }

    function updateAuthUI() {
        const admin = isAdmin();
        const lateAdmin = isLateAdmin();
        document.body.classList.toggle('is-admin', admin);
        document.body.classList.toggle('is-late-admin', lateAdmin);

        const toggleBtn = document.getElementById('auth-toggle');
        const isLoggedIn = admin || lateAdmin;
        toggleBtn.classList.toggle('is-admin', isLoggedIn);
        toggleBtn.title = isLoggedIn ? 'ออกจากระบบ' : 'เข้าสู่ระบบ';
        toggleBtn.querySelector('.material-icons-round').textContent = isLoggedIn ? 'lock_open' : 'lock';
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

    ﻿    function setupDynamicLogo() {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const now = new Date();
        const mStr = months[now.getMonth()];
        const dStr = now.getDate().toString();
        document.querySelectorAll('.logo-month-text').forEach(el => el.textContent = mStr);
        document.querySelectorAll('.logo-day-text').forEach(el => el.textContent = dStr);
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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (!isAdmin()) {
                e.preventDefault();
            }
        });

        // Prevent copy shortcut
        document.addEventListener('copy', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (!isAdmin()) {
                e.preventDefault();
                showToast('ไม่อนุญาตให้คัดลอกข้อมูลในโหมดผู้ชม', 'warning');
            }
        });
    }

    return {
        navigate, showModal, hideModal, showToast, confirm, isAdmin,
        showSyncIndicator, hideSyncIndicator, updateLastUpdatedText,
        updateAuthUI // exposed so DataManager can refresh the header when a session expires mid-sync
    };
})();

// Global functions for inline HTML event handlers
window.openAbout = App.openAbout = () => { document.getElementById('about-modal').classList.add('open'); };
window.closeAbout = App.closeAbout = () => { document.getElementById('about-modal').classList.remove('open'); };
