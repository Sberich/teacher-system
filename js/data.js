/* ============================================
   DataManager — Cloud Sync (Google Sheets) + LocalStorage Cache
   ============================================ */
const DataManager = (() => {
    const KEYS = {
        teachers: 'tla_teachers',
        leaveRecords: 'tla_leaveRecords',
        settings: 'tla_settings',
        remarks: 'tla_remarks',
        cloudUrl: 'tla_cloudUrl' // Store Cloud URL separately
    };

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
        return localStorage.getItem(KEYS.cloudUrl) || 'https://script.google.com/macros/s/AKfycbwXpmqLY60vbYaif5iVvvUYVtNLLGJ5UHAOoFQljaNfuOCcmCxOH2svFfjID5Fyn1Y/exec';
    }

    function setCloudUrl(url) {
        if (url) {
            localStorage.setItem(KEYS.cloudUrl, url.trim());
        } else {
            localStorage.removeItem(KEYS.cloudUrl);
        }
    }

    // Pull data from Cloud into LocalStorage (On app start)
    async function pullFromCloud() {
        const url = getCloudUrl();
        if (!url) return false; // No URL set, work offline
        
        try {
            const response = await fetch(url + '?t=' + Date.now()); // cache buster
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            
            if (data.teachers && data.settings) {
                // Save directly to localStorage without triggering pushToCloud
                localStorage.setItem(KEYS.teachers, JSON.stringify(data.teachers));
                localStorage.setItem(KEYS.leaveRecords, JSON.stringify(data.leaveRecords || []));
                localStorage.setItem(KEYS.remarks, JSON.stringify(data.remarks || {}));
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
        const url = getCloudUrl();
        if (!url) return;

        isSyncing = true;
        const payload = {
            action: 'sync',
            payload: {
                teachers: load(KEYS.teachers, []),
                leaveRecords: load(KEYS.leaveRecords, []),
                remarks: load(KEYS.remarks, {}),
                settings: getSettings()
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Apps Script handles plain text post better for CORS
                }
            });
            const result = await response.json();
            if (result.status !== 'success') {
                console.error('Cloud push error:', result.message);
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
        const url = getCloudUrl();
        if (!url) return;

        if (window.App && App.showSyncIndicator) App.showSyncIndicator();

        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            pushToCloud();
        }, 1500); // wait 1.5s after last action before syncing
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

    function login(pin) {
        const settings = getSettings();
        const correctPin = settings.adminPin ? String(settings.adminPin) : '1234';
        
        if (String(pin) === correctPin) {
            sessionStorage.setItem('tla_is_admin', 'true');
            return true;
        }
        return false;
    }

    function logout() {
        sessionStorage.removeItem('tla_is_admin');
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
        return load(KEYS.leaveRecords, []);
    }

    function setLeaveRecord(teacherId, month, year, type, times, days, notes) {
        let records = load(KEYS.leaveRecords, []);
        const idx = records.findIndex(r =>
            r.teacherId === teacherId && r.month === month && r.year === year && r.type === type
        );

        if (times === 0 && days === 0) {
            if (idx >= 0) records.splice(idx, 1);
        } else if (idx >= 0) {
            records[idx] = { teacherId, month, year, type, times, days, notes };
        } else {
            records.push({ teacherId, month, year, type, times, days, notes });
        }

        save(KEYS.leaveRecords, records);
    }

    function getLeaveRecord(teacherId, month, year, type) {
        return getLeaveRecords().find(r =>
            r.teacherId === teacherId && r.month === month && r.year === year && r.type === type
        ) || null;
    }

    function getTeacherLeaveForPeriod(teacherId) {
        const months = getPeriodMonths();
        const records = getLeaveRecords().filter(r => r.teacherId === teacherId);
        const result = {};

        for (const { month, year } of months) {
            const key = `${month}-${year}`;
            result[key] = {
                sick: records.find(r => r.month === month && r.year === year && r.type === 'sick') || null,
                personal: records.find(r => r.month === month && r.year === year && r.type === 'personal') || null
            };
        }

        return result;
    }

    function deleteLeaveRecord(teacherId, month, year, type) {
        let records = load(KEYS.leaveRecords, []);
        records = records.filter(r =>
            !(r.teacherId === teacherId && r.month === month && r.year === year && r.type === type)
        );
        save(KEYS.leaveRecords, records);
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
            settings: getSettings(),
            exportDate: new Date().toISOString(),
            version: '1.2'
        }, null, 2);
    }

    function importData(jsonString) {
        const data = JSON.parse(jsonString);
        if (data.teachers) localStorage.setItem(KEYS.teachers, JSON.stringify(data.teachers));
        if (data.leaveRecords) localStorage.setItem(KEYS.leaveRecords, JSON.stringify(data.leaveRecords));
        if (data.remarks) localStorage.setItem(KEYS.remarks, JSON.stringify(data.remarks));
        if (data.settings) localStorage.setItem(KEYS.settings, JSON.stringify(data.settings));
        triggerCloudSync(); // Push imported data to cloud
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
        triggerCloudSync(); // sync empty state to cloud
    }

    function clearLeaveData() {
        localStorage.removeItem(KEYS.leaveRecords);
        triggerCloudSync(); // sync empty leave state to cloud
    }

    return {
        isAdmin, login, logout,
        getCloudUrl, setCloudUrl, pullFromCloud, forceSyncToCloud,
        getTeachers, getSections, addTeacher, addTeachersBulk, updateTeacher, deleteTeacher, getNextOrder,
        getLeaveRecords, setLeaveRecord, getLeaveRecord, getTeacherLeaveForPeriod, deleteLeaveRecord,
        getRemarks, getRemark, setRemark,
        getSettings, updateSettings, getPeriodMonths,
        getThaiMonth, getThaiMonthFull, THAI_MONTHS, THAI_MONTHS_FULL,
        exportData, importData,
        loadDemoData, hasData, clearAllData, clearLeaveData
    };
})();
