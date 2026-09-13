/* ============================================
   DataManager — Cloud Sync (Google Sheets) + LocalStorage Cache
   (v2: Session Token auth — matches Code-api.js v2)
   ============================================ */
const DataManager = (() => {
    const KEYS = {
        teachers: 'tla_teachers',
        leaveRecords: 'tla_leaveRecords',
        settings: 'tla_settings',
        remarks: 'tla_remarks',
        leaveRequests: 'tla_leaveRequests',
        lateArrivals: 'tla_lateArrivals',
        cloudUrl: 'tla_cloudUrl' // Store Cloud URL separately
    };

    // Session token is kept in sessionStorage only (never persisted to localStorage,
    // never sent anywhere except back to this same Apps Script backend).
    const SESSION_TOKEN_KEY = 'tla_session_token';

    const defaultSettings = {
        startMonth: 4,
        endMonth: 9,
        fiscalYear: 2569,
        adminPin: '1234'
    };

    // --- Utility ---
    function generateId() {
        return 't' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        if (key !== KEYS.cloudUrl) {
            triggerCloudSync(); // Trigger sync whenever data changes
        }
    }

    function load(key, defaultValue) {
        const raw = localStorage.getItem(key);
        if (!raw) return typeof defaultValue === 'function' ? defaultValue() : (defaultValue !== undefined ? defaultValue : []);
        try { return JSON.parse(raw); } catch { return typeof defaultValue === 'function' ? defaultValue() : (defaultValue !== undefined ? defaultValue : []); }
    }

    // --- Cloud Sync Mechanism ---
    let syncTimeout = null;
    let isSyncing = false;

    function getCloudUrl() {
        return localStorage.getItem(KEYS.cloudUrl) || window.API_URL || '';
    }

    function setCloudUrl(url) {
        if (url) {
            localStorage.setItem(KEYS.cloudUrl, url.trim());
        } else {
            localStorage.removeItem(KEYS.cloudUrl);
        }
    }

    // Pull data from Cloud into LocalStorage (On app start). Public endpoint — no token needed.
    async function pullFromCloud() {
        const url = getCloudUrl();
        if (!url) return false; // No URL set, work offline

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 วินาที Timeout
            
            const token = sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
            const fetchUrl = url + '?t=' + Date.now() + (token ? '&token=' + encodeURIComponent(token) : '');

            const response = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            if (data.teachers && data.settings) {
                // Save directly to localStorage without triggering pushToCloud
                localStorage.setItem(KEYS.teachers, JSON.stringify(data.teachers));
                localStorage.setItem(KEYS.leaveRecords, JSON.stringify(data.leaveRecords || []));
                localStorage.setItem(KEYS.remarks, JSON.stringify(data.remarks || {}));

                // Preserve local leave requests if cloud doesn't send them (for backward compatibility)
                if (data.leaveRequests !== undefined) {
                    localStorage.setItem(KEYS.leaveRequests, JSON.stringify(data.leaveRequests));
                }

                if (data.lateArrivals !== undefined) {
                    localStorage.setItem(KEYS.lateArrivals, JSON.stringify(data.lateArrivals));
                }

                // NOTE: data.settings no longer contains adminPin/lateAdminPin — the server
                // strips those before responding. Any previously-cached PIN in localStorage
                // gets overwritten here too, which is intentional: the PIN now only ever
                // lives on the server, checked via the 'login' action below.
                localStorage.setItem(KEYS.settings, JSON.stringify(data.settings));
                return true;
            }
        } catch (error) {
            console.error('Cloud pull failed:', error);
            return false;
        }
    }

    // Push all local data to Cloud
    async function pushToCloud() {
        if (!isAdmin() && !isLateAdmin()) { if (window.App && App.hideSyncIndicator) App.hideSyncIndicator(); return; }

        const url = getCloudUrl();
        if (!url) return;

        const token = getSessionToken();
        if (!token) {
            // Logged in locally but no session token on file — most commonly this happens
            // the very first time a Cloud URL is saved (login happened before a URL existed),
            // or after a deploy of this new token-based version while an old session was
            // still marked "logged in" from before. Either way, syncing needs a fresh login.
            if (window.App && App.hideSyncIndicator) App.hideSyncIndicator();
            if (window.App && App.showToast) {
                App.showToast('ยังไม่มีเซสชันสำหรับซิงค์ข้อมูล กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง', 'warning');
            }
            return;
        }

        isSyncing = true;
        const currentSettings = getSettings();
        currentSettings.lastUpdatedTimestamp = new Date().toISOString();
        localStorage.setItem(KEYS.settings, JSON.stringify(currentSettings));

        const payload = {
            action: 'sync',
            token: token,
            payload: {
                teachers: load(KEYS.teachers, []),
                leaveRecords: load(KEYS.leaveRecords, []),
                remarks: load(KEYS.remarks, {}),
                leaveRequests: load(KEYS.leaveRequests, []),
                lateArrivals: load(KEYS.lateArrivals, []),
                settings: currentSettings
            }
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 วินาที Timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Network error');
            const result = await response.json();
            if (result.status !== 'success') {
                console.error('Cloud push error:', result.message);

                const msg = result.message || '';
                const looksExpired = msg.indexOf('หมดอายุ') !== -1 || msg.toLowerCase().indexOf('unauthorized') !== -1;

                if (looksExpired) {
                    // Server rejected the token — clear the local session too so the UI
                    // immediately reflects "logged out" instead of silently failing to sync.
                    sessionStorage.removeItem('tla_is_admin');
                    sessionStorage.removeItem('tla_is_late_admin');
                    sessionStorage.removeItem(SESSION_TOKEN_KEY);
                    if (window.App && App.updateAuthUI) App.updateAuthUI();
                    if (window.App && App.showToast) App.showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อซิงค์ข้อมูล', 'warning');
                }
            }
        } catch (error) {
            console.error('Cloud push failed:', error);
        } finally {
            isSyncing = false;
            if (window.App && App.hideSyncIndicator) App.hideSyncIndicator();
        }
    }

    // Debounce push to avoid spamming the cloud API
    function triggerCloudSync() {
        // ให้ Super Admin ใช้ปุ่ม Force Sync เท่านั้น เพื่อจัดกลุ่มแจ้งเตือน
        // แต่ให้ Late Admin (แอดมินครูเวร) Auto-sync ทันที เพราะไม่มีการแจ้งเตือนอยู่แล้ว
        if (!isLateAdmin()) {
            return;
        }

        const url = getCloudUrl();
        if (!url) return;

        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            pushToCloud();
        }, 2000); 
    }

    // Force an immediate sync (for settings page button)
    async function forceSyncToCloud() {
        if (!getCloudUrl()) return false;
        if (window.App && App.showSyncIndicator) App.showSyncIndicator();
        await pushToCloud();
        return true;
    }

    // --- Auth (Session based) ---
    function isAdmin() {
        return sessionStorage.getItem('tla_is_admin') === 'true';
    }

    function isLateAdmin() {
        return sessionStorage.getItem('tla_is_late_admin') === 'true';
    }

    function getSessionToken() {
        return sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
    }

    // login() is now async: when a Cloud URL is configured, the PIN is checked
    // server-side and this device only ever receives a short-lived session token back —
    // the real PIN is never stored in or echoed back to the browser.
    async function login(pin) {
        const url = getCloudUrl();

        // Offline fallback — only meaningful before a Cloud URL has ever been configured.
        // Once connected to the cloud, pullFromCloud() overwrites local settings with the
        // server's PIN-stripped copy, so this branch naturally stops being able to see a
        // real custom PIN and instead falls back to the defaults below.
        if (!url) {
            const settings = getSettings();
            const correctPin = settings.adminPin ? String(settings.adminPin) : '1234';
            const latePin = settings.lateAdminPin ? String(settings.lateAdminPin) : '4321';

            if (String(pin) === correctPin) {
                sessionStorage.setItem('tla_is_admin', 'true');
                sessionStorage.removeItem('tla_is_late_admin');
                sessionStorage.removeItem(SESSION_TOKEN_KEY);
                return 'super_admin';
            } else if (String(pin) === latePin) {
                sessionStorage.setItem('tla_is_late_admin', 'true');
                sessionStorage.removeItem('tla_is_admin');
                sessionStorage.removeItem(SESSION_TOKEN_KEY);
                return 'late_admin';
            }
            return false;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'login', pin: pin }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Network error');
            const result = await response.json();

            if (result.status === 'success' && result.token) {
                sessionStorage.setItem(SESSION_TOKEN_KEY, result.token);
                if (result.role === 'super_admin') {
                    sessionStorage.setItem('tla_is_admin', 'true');
                    sessionStorage.removeItem('tla_is_late_admin');
                } else if (result.role === 'late_admin') {
                    sessionStorage.setItem('tla_is_late_admin', 'true');
                    sessionStorage.removeItem('tla_is_admin');
                }
                return result.role;
            }

            return false;
        } catch (error) {
            console.error('Login request failed:', error);
            return false;
        }
    }

    // Re-check the admin PIN without disturbing the current session (used for
    // "danger zone" style re-confirmation, e.g. before clearing all leave data).
    // Stays synchronous-callable-as-promise so callers just `await` it.
    async function verifyAdminPin(pin) {
        const url = getCloudUrl();

        if (!url) {
            const settings = getSettings();
            const correctPin = settings.adminPin ? String(settings.adminPin) : '1234';
            return String(pin) === correctPin;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'login', pin: pin }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) return false;
            const result = await response.json();
            return result.status === 'success' && result.role === 'super_admin';
        } catch (error) {
            console.error('PIN verification failed:', error);
            return false;
        }
    }

    // logout() stays a plain (non-async-awaited) function on purpose: it clears the
    // local session synchronously first, so the UI can update immediately even if the
    // device is offline. Revoking the token on the server is best-effort in the background.
    function logout() {
        const token = getSessionToken();
        const url = getCloudUrl();

        sessionStorage.removeItem('tla_is_admin');
        sessionStorage.removeItem('tla_is_late_admin');
        sessionStorage.removeItem(SESSION_TOKEN_KEY);

        if (url && token) {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'logout', token: token })
            }).catch(err => console.error('Logout revoke failed (ignored):', err));
        }
    }

    // --- Thai Month Names ---
    const THAI_MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const THAI_MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    function getThaiMonth(m) { return THAI_MONTHS[m] || ''; }
    function getThaiMonthFull(m) { return THAI_MONTHS_FULL[m] || ''; }

    // =====================
    //  TEACHERS CRUD
    // =====================
    function getTeachers() {
        let teachers = load(KEYS.teachers, []);
        let needsSave = false;

        // Fix zero or missing orders, and missing IDs
        teachers.forEach((t, i) => {
            if (!t.id || String(t.id).trim() === '') {
                t.id = generateId();
                needsSave = true;
            }
            if (!t.order || t.order <= 0) {
                t.order = i + 1;
                needsSave = true;
            }
        });

        teachers.sort((a, b) => a.order - b.order);

        if (needsSave) save(KEYS.teachers, teachers);
        return teachers;
    }

    function getSections() {
        const teachers = getTeachers();
        const sections = [...new Set(teachers.map(t => t.section || 'ทั่วไป'))];
        return sections.sort();
    }

    function addTeacher(name, section, order, gender = '', title = '') {
        const teachers = load(KEYS.teachers, []);
        shiftOrdersFrom(teachers, order);
        const teacher = { id: generateId(), name, section: section || 'ทั่วไป', order, gender, title };
        teachers.push(teacher);
        teachers.sort((a, b) => a.order - b.order);
        save(KEYS.teachers, teachers);
        return teacher;
    }

    function addTeachersBulk(items) {
        const teachers = load(KEYS.teachers, []);
        let nextOrder = teachers.length > 0 ? Math.max(...teachers.map(t => t.order)) + 1 : 1;
        const added = [];
        items.forEach(item => {
            const name = (item.name || '').trim();
            const section = (item.section || 'ทั่วไป').trim();
            if (!name) return;
            const teacher = {
                id: generateId(),
                name,
                section,
                order: nextOrder++,
                gender: item.gender || '',
                title: item.title || ''
            };
            teachers.push(teacher);
            added.push(teacher);
        });
        save(KEYS.teachers, teachers);
        return added;
    }

    function updateTeacher(id, name, section, newOrder, gender = '', title = '') {
        let teachers = load(KEYS.teachers, []);
        const teacher = teachers.find(t => t.id === id);
        if (!teacher) return null;

        teacher.name = name;
        teacher.section = section || 'ทั่วไป';
        teacher.gender = gender;
        teacher.title = title;

        if (newOrder !== undefined && newOrder !== teacher.order) {
            const others = teachers.filter(t => t.id !== id);
            shiftOrdersFrom(others, newOrder);
            teacher.order = newOrder;
            others.push(teacher);
            others.sort((a, b) => a.order - b.order);
            save(KEYS.teachers, others);
            return teacher;
        }

        save(KEYS.teachers, teachers);
        return teacher;
    }

    function deleteTeacher(id) {
        let teachers = load(KEYS.teachers, []);
        teachers = teachers.filter(t => t.id !== id);
        teachers.sort((a, b) => a.order - b.order);
        teachers.forEach((t, i) => t.order = i + 1);
        save(KEYS.teachers, teachers);

        let records = load(KEYS.leaveRecords, []);
        records = records.filter(r => r.teacherId !== id);
        save(KEYS.leaveRecords, records);

        const remarks = load(KEYS.remarks, {});
        delete remarks[id];
        save(KEYS.remarks, remarks);
    }

    function shiftOrdersFrom(teachers, fromOrder) {
        const toShift = teachers.filter(t => t.order >= fromOrder).sort((a, b) => a.order - b.order);
        let cur = fromOrder;
        for (const t of toShift) {
            if (t.order <= cur) {
                t.order = cur + 1;
                cur = t.order;
            } else {
                break;
            }
        }
    }

    function getNextOrder() {
        const teachers = load(KEYS.teachers, []);
        if (teachers.length === 0) return 1;
        return Math.max(...teachers.map(t => t.order)) + 1;
    }

    // =====================
    //  LEAVE RECORDS CRUD
    // =====================
    function getLeaveRecords() {
        let records = load(KEYS.leaveRecords, []);
        let needsSave = false;
        // Migration & Cleanup for corrupted or legacy records
        records = records.filter(r => {
            // Remove corrupted records from the bug
            if (typeof r.teacherId === 'object' || (typeof r.teacherId === 'string' && r.teacherId.includes('{'))) {
                needsSave = true;
                return false;
            }
            if (r.month === null || r.month === undefined) {
                needsSave = true;
                return false;
            }
            if (!r.id) {
                r.id = generateId();
                needsSave = true;
            }
            return true;
        });
        if (needsSave) save(KEYS.leaveRecords, records);
        return records;
    }

    function addLeaveEvent(teacherId, month, year, type, times, days, notes) {
        let records = getLeaveRecords();
        const id = generateId();
        records.push({ id, teacherId, month, year, type, times, days, notes });
        save(KEYS.leaveRecords, records);
        return id;
    }

    function updateLeaveEvent(id, times, days, notes) {
        let records = getLeaveRecords();
        const idx = records.findIndex(r => r.id === id);
        if (idx >= 0) {
            records[idx].times = times;
            records[idx].days = days;
            records[idx].notes = notes;
            save(KEYS.leaveRecords, records);
        }
    }

    function deleteLeaveEvent(id) {
        let records = getLeaveRecords();
        records = records.filter(r => r.id !== id);
        save(KEYS.leaveRecords, records);
    }

    // Get all events for a specific cell (for the modal)
    function getLeaveRecord(teacherId, month, year, type) {
        return getLeaveRecords().filter(r =>
            r.teacherId === teacherId && r.month === month && r.year === year && r.type === type
        );
    }

    function getTeacherLeaveForPeriod(teacherId) {
        const months = getPeriodMonths();
        const records = getLeaveRecords().filter(r => r.teacherId === teacherId);
        const result = {};

        for (const { month, year } of months) {
            const key = `${month}-${year}`;

            // Helper to aggregate records of a specific type
            const aggregate = (type) => {
                const typeRecords = records.filter(r => r.month === month && r.year === year && r.type === type);
                if (typeRecords.length === 0) return null;

                return typeRecords.reduce((acc, curr) => {
                    acc.times += curr.times;
                    acc.days += curr.days;
                    if (curr.notes) {
                        if (acc.notes) acc.notes += ', ' + curr.notes;
                        else acc.notes = curr.notes;
                    }
                    return acc;
                }, { times: 0, days: 0, notes: '' });
            };

            result[key] = {
                sick: aggregate('sick'),
                personal: aggregate('personal')
            };
        }

        return result;
    }

    // =====================
    //  REMARKS
    // =====================
    function getRemarks() {
        return load(KEYS.remarks, {});
    }

    function getRemark(teacherId) {
        return getRemarks()[teacherId] || '';
    }

    function setRemark(teacherId, text) {
        const remarks = getRemarks();
        if (text && text.trim()) {
            remarks[teacherId] = text.trim();
        } else {
            delete remarks[teacherId];
        }
        save(KEYS.remarks, remarks);
    }

    // =====================
    //  SETTINGS
    // =====================
    function getSettings() {
        return load(KEYS.settings, () => ({ ...defaultSettings }));
    }

    function updateSettings(newSettings) {
        const settings = { ...getSettings(), ...newSettings };
        save(KEYS.settings, settings);
        return settings;
    }

    function getPeriodMonths() {
        const { startMonth, endMonth, fiscalYear } = getSettings();
        const months = [];

        if (startMonth <= endMonth) {
            for (let m = startMonth; m <= endMonth; m++) {
                months.push({ month: m, year: fiscalYear });
            }
        } else {
            for (let m = startMonth; m <= 12; m++) {
                months.push({ month: m, year: fiscalYear });
            }
            for (let m = 1; m <= endMonth; m++) {
                months.push({ month: m, year: fiscalYear + 1 });
            }
        }

        return months.slice(0, 6);
    }

    // =====================
    //  EXPORT / IMPORT
    // =====================
    function exportData() {
        return JSON.stringify({
            teachers: load(KEYS.teachers, []),
            leaveRecords: load(KEYS.leaveRecords, []),
            remarks: load(KEYS.remarks, {}),
            leaveRequests: load(KEYS.leaveRequests, []),
            lateArrivals: load(KEYS.lateArrivals, []),
            settings: getSettings(),
            exportDate: new Date().toISOString(),
            version: '1.3'
        }, null, 2);
    }

    function importData(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.teachers) localStorage.setItem(KEYS.teachers, JSON.stringify(data.teachers));
        if (data.leaveRecords) localStorage.setItem(KEYS.leaveRecords, JSON.stringify(data.leaveRecords));
        if (data.remarks) localStorage.setItem(KEYS.remarks, JSON.stringify(data.remarks));
        if (data.leaveRequests) localStorage.setItem(KEYS.leaveRequests, JSON.stringify(data.leaveRequests));
        if (data.lateArrivals) localStorage.setItem(KEYS.lateArrivals, JSON.stringify(data.lateArrivals));
        if (data.settings) localStorage.setItem(KEYS.settings, JSON.stringify(data.settings));
        triggerCloudSync(); // Push imported data to cloud
    }

    // =====================
    //  LEAVE REQUESTS (HYBRID)
    // =====================
    function getLeaveRequests() {
        return load(KEYS.leaveRequests, []).filter(r => r.status !== 'deleted');
    }

    function addLeaveRequest(requestData) {
        const requests = getLeaveRequests();
        const newReq = {
            id: generateId(),
            ...requestData,
            status: 'pending', // pending, approved, rejected
            timestamp: new Date().toISOString()
        };
        requests.push(newReq);
        save(KEYS.leaveRequests, requests);

        // ส่งใบลาขึ้น Google Sheets ทันทีแม้จะไม่ใช่ Admin — เป็น public endpoint ไม่ต้องใช้ token
        const url = getCloudUrl();
        if (url) {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'submitRequest',
                    payload: newReq
                })
            }).catch(err => console.error("Cloud submit failed:", err));
        }

        return newReq;
    }

    function updateLeaveRequestStatus(reqId, newStatus) {
        const requests = load(KEYS.leaveRequests, []);
        const req = requests.find(r => r.id === reqId);
        if (req) {
            req.status = newStatus;
            save(KEYS.leaveRequests, requests);
            return true;
        }
        return false;
    }

    function deleteLeaveRequest(reqId) {
        let requests = load(KEYS.leaveRequests, []);
        const req = requests.find(r => r.id === reqId);
        if (req) {
            req.status = 'deleted';
            save(KEYS.leaveRequests, requests);
        }
    }

    function clearCompletedLeaveRequests() {
        let requests = load(KEYS.leaveRequests, []);
        requests.forEach(r => {
            if (r.status === 'approved' || r.status === 'rejected') {
                r.status = 'deleted';
            }
        });
        save(KEYS.leaveRequests, requests);
    }

    // =====================
    //  DEMO DATA
    // =====================
    function loadDemoData() {
        const demoTeachers = [
            { id: 't001', name: 'นายสมชาย ใจดี', section: 'สายชั้น ป.1-3', order: 1 },
            { id: 't002', name: 'นางสาวสมหญิง รักเรียน', section: 'สายชั้น ป.1-3', order: 2 },
            { id: 't003', name: 'นายวิชัย พัฒนา', section: 'สายชั้น ป.4-6', order: 3 },
            { id: 't004', name: 'นางมาลี สุขสันต์', section: 'สายชั้น ป.4-6', order: 4 },
            { id: 't005', name: 'นายประเสริฐ ดีเด่น', section: 'หมวดคณิตศาสตร์', order: 5 },
            { id: 't006', name: 'นางสาวนภา ท้องฟ้า', section: 'หมวดวิทยาศาสตร์', order: 6 },
            { id: 't007', name: 'นายอดุลย์ รักชาติ', section: 'หมวดภาษาต่างประเทศ', order: 7 },
            { id: 't008', name: 'นางพรทิพย์ งามตา', section: 'หมวดภาษาต่างประเทศ', order: 8 },
            { id: 't009', name: 'นายสุรชัย แกร่งกล้า', section: 'ทั่วไป', order: 9 },
            { id: 't010', name: 'นางสาวจิราภรณ์ ศรีสะอาด', section: 'ทั่วไป', order: 10 }
        ];

        localStorage.setItem(KEYS.teachers, JSON.stringify(demoTeachers));
        localStorage.setItem(KEYS.settings, JSON.stringify({ startMonth: 10, endMonth: 3, fiscalYear: 2568, adminPin: '1234' }));

        const demoRecords = [
            { teacherId: 't001', month: 10, year: 2568, type: 'personal', times: 1, days: 2, notes: 'ลาวันที่ 10-11 ต.ค.' },
            { teacherId: 't001', month: 11, year: 2568, type: 'sick', times: 1, days: 1, notes: 'ลาวันที่ 5 พ.ย.' },
            { teacherId: 't002', month: 10, year: 2568, type: 'sick', times: 2, days: 3, notes: 'ลาวันที่ 3-4, 15 ต.ค.' },
            { teacherId: 't002', month: 12, year: 2568, type: 'personal', times: 1, days: 1, notes: 'ลาวันที่ 20 ธ.ค.' },
            { teacherId: 't003', month: 11, year: 2568, type: 'personal', times: 1, days: 1, notes: 'ลาวันที่ 8 พ.ย.' },
            { teacherId: 't003', month: 1, year: 2569, type: 'sick', times: 1, days: 2, notes: 'ลาวันที่ 15-16 ม.ค.' }
        ];

        localStorage.setItem(KEYS.leaveRecords, JSON.stringify(demoRecords));

        const demoRemarks = {
            't004': 'ครูประจำชั้น ป.4/1',
            't009': 'ย้ายมาจาก รร.อื่น'
        };
        localStorage.setItem(KEYS.remarks, JSON.stringify(demoRemarks));

        triggerCloudSync(); // push demo data to cloud
    }

    function hasData() {
        return load(KEYS.teachers, []).length > 0;
    }

    function clearAllData() {
        localStorage.removeItem(KEYS.teachers);
        localStorage.removeItem(KEYS.leaveRecords);
        localStorage.removeItem(KEYS.settings);
        localStorage.removeItem(KEYS.remarks);
        localStorage.removeItem(KEYS.leaveRequests);
        triggerCloudSync(); // sync empty state to cloud
    }

    function clearLeaveData() {
        localStorage.removeItem(KEYS.leaveRecords);
        triggerCloudSync(); // sync empty leave state to cloud
    }


    // --- Late Arrivals ---
    function getLateArrivals() {
        return load(KEYS.lateArrivals, []);
    }

    function addLateArrival(record) {
        const list = getLateArrivals();
        list.push(record);
        save(KEYS.lateArrivals, list);
    }

    function deleteLateArrival(id) {
        let list = getLateArrivals();
        list = list.filter(r => r.id !== id);
        save(KEYS.lateArrivals, list);
    }

    return {
        isAdmin, isLateAdmin, login, logout, verifyAdminPin,
        getCloudUrl, setCloudUrl, pullFromCloud, forceSyncToCloud,
        getTeachers, getSections, addTeacher, addTeachersBulk, updateTeacher, deleteTeacher, resetLineUserId, getNextOrder,
        getLeaveRecords, addLeaveEvent, updateLeaveEvent, getLeaveRecord, getTeacherLeaveForPeriod, deleteLeaveEvent,
        getLeaveRequests, addLeaveRequest, updateLeaveRequestStatus, deleteLeaveRequest, clearCompletedLeaveRequests,
        getRemarks, getRemark, setRemark,
        getSettings, updateSettings, getPeriodMonths,
        getThaiMonth, getThaiMonthFull, THAI_MONTHS, THAI_MONTHS_FULL,
        exportData, importData,
        loadDemoData, hasData, clearAllData, clearLeaveData, getLateArrivals, addLateArrival, deleteLateArrival
    };
})();
