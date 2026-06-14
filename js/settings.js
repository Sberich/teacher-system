/* ============================================
   Settings — Fiscal Year Period & Data Management
   ============================================ */
const Settings = (() => {
    function init() {
        // Rendered on navigate
    }

    function render() {
        const container = document.getElementById('settings-container');
        const settings = DataManager.getSettings();
        const months = DataManager.getPeriodMonths();

        // Build month <option> lists
        const startOpts = buildMonthOptions(settings.startMonth);
        const endOpts = buildMonthOptions(settings.endMonth);

        // Period preview
        const preview = months.map(m => `${DataManager.getThaiMonth(m.month)} ${m.year}`).join('  →  ');

        container.innerHTML = `
            <div class="settings-card">
                <h3><span class="material-icons-round">cloud_sync</span> การเชื่อมต่อฐานข้อมูล (Google Sheets)</h3>
                <div class="settings-form">
                    <div class="form-group admin-only">
                        <label for="setting-cloud-url">Google Apps Script Web App URL</label>
                        <input type="text" id="setting-cloud-url" value="${DataManager.getCloudUrl()}" placeholder="https://script.google.com/macros/s/.../exec">
                        <small class="form-hint">วาง URL ที่ได้จากขั้นตอนการ Deploy Apps Script เพื่อเชื่อมต่อระบบเข้ากับ Cloud</small>
                    </div>
                    
                    <div class="export-import-btns admin-only" style="margin-top: 12px;">
                        <button class="btn-primary" id="btn-force-sync" style="background:var(--primary);">
                            <span class="material-icons-round">backup</span>
                            ส่งข้อมูลทั้งหมดขึ้น Cloud ทันที
                        </button>
                    </div>
                </div>
            </div>

            <div class="settings-card">
                <h3><span class="material-icons-round">domain</span> ข้อมูลโรงเรียนและผู้บริหาร</h3>
                <div class="settings-form">
                    <div class="form-group admin-only">
                        <label for="setting-school-name">ชื่อโรงเรียน</label>
                        <input type="text" id="setting-school-name" value="${settings.schoolName || ''}" placeholder="เช่น โรงเรียนตัวอย่างวิทยา">
                    </div>
                    <div class="form-group admin-only" style="margin-top: 12px;">
                        <label for="setting-director-name">ชื่อผู้อำนวยการ</label>
                        <input type="text" id="setting-director-name" value="${settings.directorName || ''}" placeholder="เช่น นายสมมติ ใจดี">
                    </div>
                    <div class="form-group admin-only" style="margin-top: 12px;">
                        <label for="setting-deputy-name">ชื่อรองผู้อำนวยการ</label>
                        <input type="text" id="setting-deputy-name" value="${settings.deputyName || ''}" placeholder="เช่น นางสาวรองบริหาร ใจสู้">
                    </div>
                    <div class="form-group admin-only" style="margin-top: 12px;">
                        <label for="setting-hr-name">ชื่อหัวหน้ากลุ่มบริหารงานบุคคล</label>
                        <input type="text" id="setting-hr-name" value="${settings.hrName || ''}" placeholder="เช่น นายบุคคล รักงาน">
                    </div>
                </div>
            </div>

            <div class="settings-card">
                <h3><span class="material-icons-round">date_range</span> รอบปีงบประมาณ</h3>
                <div class="settings-form">
                    <div class="form-row" style="grid-template-columns: 1fr 1fr 1fr;">
                        <div class="form-group">
                            <label for="setting-start-month">เดือนเริ่มต้น</label>
                            <select id="setting-start-month">${startOpts}</select>
                        </div>
                        <div class="form-group">
                            <label for="setting-end-month">เดือนสิ้นสุด</label>
                            <select id="setting-end-month">${endOpts}</select>
                        </div>
                        <div class="form-group">
                            <label for="setting-year">ปี พ.ศ. (เริ่มต้น)</label>
                            <input type="number" id="setting-year" value="${settings.fiscalYear}" min="2500" max="2600">
                        </div>
                    </div>

                    <div class="settings-preview">
                        <span class="material-icons-round">info</span>
                        <div>
                            <div style="font-weight:600;margin-bottom:4px;">รอบปัจจุบัน (${months.length} เดือน)</div>
                            <div>${preview}</div>
                        </div>
                    </div>

                    <div class="form-group admin-only" style="margin-top:12px;">
                        <label for="setting-admin-pin">รหัสผ่านผู้ดูแลระบบ (PIN 4 ตัว)</label>
                        <input type="text" id="setting-admin-pin" value="${settings.adminPin}" maxlength="10" inputmode="numeric">
                        <small class="form-hint">ใช้สำหรับปลดล็อกสิทธิ์แก้ไขข้อมูล</small>
                    </div>

                    <div id="month-count-warning" style="display:none;color:#ef4444;font-size:0.85rem;font-weight:500;">
                        ⚠️ รอบปีงบประมาณต้องไม่เกิน 6 เดือน
                    </div>

                    <button class="btn-primary" id="btn-save-settings">
                        <span class="material-icons-round">save</span>
                        บันทึกการตั้งค่า
                    </button>
                </div>
            </div>

            <div class="settings-card">
                <h3><span class="material-icons-round">import_export</span> สำรอง / นำเข้าข้อมูล</h3>
                <div class="settings-form">
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:4px;">
                        ข้อมูลเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ควรสำรองข้อมูลเป็นประจำ
                    </p>
                    <div class="export-import-btns">
                        <button class="btn-secondary" id="btn-export">
                            <span class="material-icons-round">download</span>
                            Export JSON
                        </button>
                        <button class="btn-secondary" id="btn-import">
                            <span class="material-icons-round">upload</span>
                            Import JSON
                        </button>
                        <input type="file" id="import-file" accept=".json" style="display:none;">
                    </div>
                </div>
            </div>

            <div class="settings-card danger-zone admin-only">
                <h3><span class="material-icons-round">warning</span> โซนอันตราย</h3>
                <div class="settings-form">
                    <div class="export-import-btns">
                        <button class="btn-danger" id="btn-clear-data">
                            <span class="material-icons-round">cleaning_services</span>
                            ล้างข้อมูลวันลาทั้งหมด
                        </button>
                    </div>
                </div>
            </div>
        `;

        // --- Event listeners ---
        document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
        const forceSyncBtn = document.getElementById('btn-force-sync');
        if (forceSyncBtn) {
            forceSyncBtn.addEventListener('click', forceSync);
        }
        document.getElementById('btn-export').addEventListener('click', exportData);
        document.getElementById('btn-import').addEventListener('click', () =>
            document.getElementById('import-file').click()
        );
        document.getElementById('import-file').addEventListener('change', importData);
        document.getElementById('btn-clear-data').addEventListener('click', clearData);

        // Live validation for month count
        const startSel = document.getElementById('setting-start-month');
        const endSel = document.getElementById('setting-end-month');
        const yearInput = document.getElementById('setting-year');

        [startSel, endSel, yearInput].forEach(el => {
            el.addEventListener('change', validateMonthCount);
        });
    }

    function buildMonthOptions(selected) {
        return Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return `<option value="${m}" ${m === selected ? 'selected' : ''}>${DataManager.getThaiMonthFull(m)}</option>`;
        }).join('');
    }

    function calcMonthCount(start, end) {
        if (start <= end) return end - start + 1;
        return (12 - start + 1) + end;
    }

    function validateMonthCount() {
        const start = parseInt(document.getElementById('setting-start-month').value);
        const end = parseInt(document.getElementById('setting-end-month').value);
        const count = calcMonthCount(start, end);
        const warning = document.getElementById('month-count-warning');
        const btn = document.getElementById('btn-save-settings');

        if (count > 6) {
            warning.style.display = 'block';
            btn.disabled = true;
            btn.style.opacity = '0.5';
        } else {
            warning.style.display = 'none';
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }

    function saveSettings() {
        const startMonth = parseInt(document.getElementById('setting-start-month').value);
        const endMonth = parseInt(document.getElementById('setting-end-month').value);
        const fiscalYear = parseInt(document.getElementById('setting-year').value);
        const adminPinEl = document.getElementById('setting-admin-pin');
        const adminPin = adminPinEl ? adminPinEl.value.trim() : DataManager.getSettings().adminPin;
        const schoolName = document.getElementById('setting-school-name').value.trim();
        const directorName = document.getElementById('setting-director-name').value.trim();
        const deputyName = document.getElementById('setting-deputy-name').value.trim();
        const hrName = document.getElementById('setting-hr-name').value.trim();
        const cloudUrlEl = document.getElementById('setting-cloud-url');
        const cloudUrl = cloudUrlEl ? cloudUrlEl.value.trim() : DataManager.getCloudUrl();

        const count = calcMonthCount(startMonth, endMonth);
        if (count > 6) {
            App.showToast('รอบปีงบประมาณต้องไม่เกิน 6 เดือน', 'error');
            return;
        }

        if (!fiscalYear || fiscalYear < 2500 || fiscalYear > 2600) {
            App.showToast('กรุณากรอกปี พ.ศ. ที่ถูกต้อง', 'error');
            return;
        }

        if (!adminPin) {
            App.showToast('กรุณาตั้งรหัสผ่านผู้ดูแลระบบ', 'error');
            return;
        }

        DataManager.setCloudUrl(cloudUrl);
        DataManager.updateSettings({ startMonth, endMonth, fiscalYear, adminPin, schoolName, directorName, deputyName, hrName });
        App.showToast('บันทึกการตั้งค่าเรียบร้อย');
        render(); // Refresh preview
    }

    async function forceSync() {
        const url = DataManager.getCloudUrl();
        if (!url) {
            App.showToast('กรุณาใส่ Web App URL และบันทึกการตั้งค่าก่อน', 'warning');
            return;
        }

        App.confirm('คุณต้องการนำข้อมูลในเครื่องนี้ ไปทับข้อมูลบน Cloud ทั้งหมดหรือไม่?', async () => {
            const btn = document.getElementById('btn-force-sync');
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons-round spinning">sync</span> กำลังซิงค์...';
            
            await DataManager.forceSyncToCloud();
            
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">backup</span> ส่งข้อมูลทั้งหมดขึ้น Cloud ทันที';
            App.showToast('ซิงค์ข้อมูลขึ้น Cloud เรียบร้อย', 'success');
        });
    }

    function exportData() {
        const json = DataManager.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const settings = DataManager.getSettings();
        a.download = `leave-data-${settings.fiscalYear}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        App.showToast('ส่งออกข้อมูลเรียบร้อย');
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!data.teachers && !data.leaveRecords && !data.settings) {
                    throw new Error('Invalid format');
                }
                App.confirm(
                    'ต้องการนำเข้าข้อมูลหรือไม่?\nข้อมูลปัจจุบันจะถูกแทนที่',
                    () => {
                        DataManager.importData(ev.target.result);
                        App.showToast('นำเข้าข้อมูลเรียบร้อย');
                        render();
                    }
                );
            } catch (err) {
                App.showToast('ไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ JSON ที่ส่งออกจากระบบ', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    }

    function clearData() {
        const pin = prompt('การล้างข้อมูลวันลาเป็นเรื่องสำคัญ!\nกรุณากรอกรหัสผ่านผู้ดูแลระบบ (PIN) เพื่อยืนยัน:');
        if (pin === null) return;
        
        const settings = DataManager.getSettings();
        const correctPin = settings.adminPin ? String(settings.adminPin) : '1234';
        
        if (String(pin) !== correctPin) {
            App.showToast('รหัสผ่านไม่ถูกต้อง ล้มเลิกการล้างข้อมูล', 'error');
            return;
        }

        App.confirm(
            'ยืนยันอีกครั้ง: คุณแน่ใจหรือไม่ว่าจะล้างข้อมูลวันลาทั้งหมด?\n(ข้อมูลวันลาของทุกคนจะหายไป แต่รายชื่อครูและการตั้งค่าจะยังอยู่)\nการกระทำนี้ไม่สามารถย้อนกลับได้',
            () => {
                DataManager.clearLeaveData();
                App.showToast('ล้างข้อมูลวันลาเรียบร้อย', 'info');
                render();
            }
        );
    }

    function loadDemo() {
        App.confirm(
            'ต้องการโหลดข้อมูลจำลองหรือไม่?\nข้อมูลปัจจุบันจะถูกแทนที่',
            () => {
                DataManager.loadDemoData();
                App.showToast('โหลดข้อมูลจำลองเรียบร้อย');
                render();
            }
        );
    }

    return { init, render };
})();
