/* ============================================
   LateArrival - Late Arrival Tracking
   ============================================ */
const LateArrival = (() => {
    let sectionFilter = '';
    let searchQuery = '';
    let searchTimeout = null;

    function escapeHtml(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function populateSectionFilter() {
        const filterSelect = document.getElementById('late-section-filter');
        if (!filterSelect) return;
        if (document.activeElement === filterSelect) return;
        const sections = DataManager.getSections();
        let html = '<option value="">ทุกหมวดหมู่/กลุ่ม</option>';
        sections.forEach(s => {
            html += `<option value="${escapeHtml(s)}" ${sectionFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`;
        });
        filterSelect.innerHTML = html;
    }

    function matchesFilter(teacher) {
        if (!teacher) return false;
        if (sectionFilter) {
            if (sectionFilter === 'ครูอัตราจ้าง') {
                const isContract = (teacher.title || '').includes('ครูอัตราจ้าง') || teacher.section === 'ครูอัตราจ้าง';
                if (!isContract) return false;
            } else {
                if (teacher.section !== sectionFilter) return false;
            }
        }
        if (searchQuery) {
            if (!teacher.name.toLowerCase().includes(searchQuery)) return false;
        }
        return true;
    }

    function init() {
        const container = document.getElementById('late-arrival-container');
        if (!container) return;

        populateSectionFilter();
        renderForm();
        renderTable();

        const searchInput = document.getElementById('late-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim().toLowerCase();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    renderTable();
                    updateTeacherSelect();
                }, 300);
            });
        }

        const sectionSelect = document.getElementById('late-section-filter');
        if (sectionSelect) {
            sectionSelect.addEventListener('change', (e) => {
                sectionFilter = e.target.value;
                renderTable();
                updateTeacherSelect();
            });
        }

        const btnPrint = document.getElementById('btn-print-late-table');
        if (btnPrint) btnPrint.addEventListener('click', printLateTable);

        const btnExport = document.getElementById('btn-export-late-csv');
        if (btnExport) btnExport.addEventListener('click', exportLateCSV);

        const btnExportJson = document.getElementById('btn-export-late-json');
        if (btnExportJson) btnExportJson.addEventListener('click', exportLateJson);

        const btnImportJson = document.getElementById('btn-import-late-json');
        const fileImport = document.getElementById('import-late-file');
        if (btnImportJson && fileImport) {
            btnImportJson.addEventListener('click', () => fileImport.click());
            fileImport.addEventListener('change', importLateJson);
        }
        const btnClear = document.getElementById('btn-clear-late-data');
        if (btnClear) btnClear.addEventListener('click', clearLateData);

        const btnPrintLeave = document.getElementById('btn-print-leave-from-late');
        if (btnPrintLeave) {
            btnPrintLeave.addEventListener('click', () => {
                if (window.LeaveTable) {
                    if (typeof LeaveTable.setFilters === 'function') {
                        LeaveTable.setFilters(sectionFilter, searchQuery);
                    }
                    if (typeof LeaveTable.printTable === 'function') {
                        LeaveTable.printTable();
                    }
                }
            });
        }

        const btnExportLeaveCSV = document.getElementById('btn-export-leave-csv-from-late');
        if (btnExportLeaveCSV) {
            btnExportLeaveCSV.addEventListener('click', () => {
                if (window.LeaveTable) {
                    if (typeof LeaveTable.setFilters === 'function') {
                        LeaveTable.setFilters(sectionFilter, searchQuery);
                    }
                    if (typeof LeaveTable.exportCSV === 'function') {
                        LeaveTable.exportCSV();
                    }
                }
            });
        }
    }

    function updateTeacherSelect() {
        const select = document.getElementById('la-teacher-select');
        if (!select) return;
        const currentVal = select.value;
        let teachers = DataManager.getTeachers().sort((a, b) => a.order - b.order);
        if (sectionFilter || searchQuery) {
            teachers = teachers.filter(t => matchesFilter(t));
        }

        const grouped = {};
        teachers.forEach(t => {
            const sec = t.section || 'ทั่วไป';
            if (!grouped[sec]) grouped[sec] = [];
            grouped[sec].push(t);
        });

        let teacherOptions = '<option value="" disabled selected>-- เลือกครู --</option>';
        for (const sec in grouped) {
            teacherOptions += `<optgroup label="${escapeHtml(sec)}">`;
            grouped[sec].forEach(t => {
                teacherOptions += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
            });
            teacherOptions += `</optgroup>`;
        }
        select.innerHTML = teacherOptions;
        if (currentVal && teachers.some(t => t.id === currentVal)) {
            select.value = currentVal;
        }
    }

    function renderForm() {
        const container = document.getElementById('late-arrival-container');

        const formHtml = `
            <div class="form-card" style="max-width: 600px; margin: 0 auto 2rem auto; background: var(--bg-card); padding: 24px; border-radius: var(--radius); box-shadow: var(--shadow-md);">
                <div class="form-group" style="margin-bottom: 16px;">
                    <label for="la-teacher-select">เลือกครูที่มาสาย</label>
                    <select id="la-teacher-select" class="form-control">
                        <option value="" disabled selected>-- เลือกครู --</option>
                    </select>
                </div>
                <div class="form-row" style="margin-bottom: 16px;">
                    <div class="form-group">
                        <label for="la-date">วันที่</label>
                        <input type="text" id="la-date" class="form-control flatpickr-input" placeholder="เลือกวันที่">
                    </div>
                    <div class="form-group">
                        <label for="la-time">เวลาที่มาถึง (น.)</label>
                        <input type="time" id="la-time" class="form-control" value="08:16">
                    </div>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button class="btn-primary" id="btn-save-la" style="flex: 1; padding: 12px; font-size: 1rem; justify-content: center;">
                        <span class="material-icons-round">save</span> บันทึกข้อมูลมาสาย
                    </button>
                </div>
            </div>
            
            <div class="card" style="max-width: 800px; margin: 0 auto;">
                <div class="card-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text);">ประวัติการมาสาย</h3>
                </div>
                <div class="card-body" style="padding: 0;">
                    <div class="table-responsive" id="la-table-container"></div>
                </div>
            </div>
        `;

        container.innerHTML = formHtml;
        updateTeacherSelect();

        // Initialize date picker
        flatpickr("#la-date", {
            dateFormat: "d/m/Y",
            defaultDate: "today",
            locale: "th"
        });

        document.getElementById('btn-save-la').addEventListener('click', saveLateArrival);
    }

    function renderTable() {
        const tableContainer = document.getElementById('la-table-container');
        if (!tableContainer) return;

        const lateArrivals = DataManager.getLateArrivals().sort((a, b) => {
            const aDate = a.date.split('/').reverse().join('');
            const bDate = b.date.split('/').reverse().join('');
            if (aDate !== bDate) return bDate.localeCompare(aDate);
            return b.time.localeCompare(a.time);
        });
        const teachers = DataManager.getTeachers();

        const filteredRecords = lateArrivals.filter(record => {
            const teacher = teachers.find(t => t.id === record.teacherId);
            return matchesFilter(teacher);
        });

        if (filteredRecords.length === 0) {
            const msg = (sectionFilter || searchQuery) ? 'ไม่พบข้อมูลการมาสายที่ตรงกับเงื่อนไขการค้นหา' : 'ไม่มีข้อมูลการมาสาย';
            tableContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color: #64748b;">${msg}</div>`;
            return;
        }

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>วันที่</th>
                        <th>เวลา</th>
                        <th>ชื่อ-สกุล</th>
                        <th>จัดการ</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredRecords.forEach(record => {
            const teacher = teachers.find(t => t.id === record.teacherId);
            const teacherName = teacher ? teacher.name : 'ไม่พบข้อมูลครู';

            html += `
                <tr>
                    <td>${record.date}</td>
                    <td style="color: #ef4444; font-weight: bold;">${record.time} น.</td>
                    <td>${escapeHtml(teacherName)}</td>
                    <td>
                        <button class="btn-icon" style="color: #ef4444;" onclick="window.LateArrival.deleteRecord('${record.id}')" title="ลบ">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        tableContainer.innerHTML = html;
    }

    function saveLateArrival() {
        if (!DataManager.isAdmin() && !DataManager.isLateAdmin()) {
            if (window.App) App.showToast('ไม่มีสิทธิ์บันทึกข้อมูล กรุณาเข้าสู่ระบบ', 'warning');
            return;
        }
        const teacherId = document.getElementById('la-teacher-select').value;
        const date = document.getElementById('la-date').value;
        const time = document.getElementById('la-time').value;

        if (!teacherId) {
            if (window.App) App.showToast('กรุณาเลือกครู', 'error');
            return;
        }

        let finalDate = date;
        const parts = finalDate.split('/');
        if (parts.length === 3) {
            let y = parseInt(parts[2], 10);
            if (y < 2500) {
                y += 543;
                finalDate = `${parts[0]}/${parts[1]}/${y}`;
            }
        }

        const id = 'la_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        DataManager.addLateArrival({
            id: id,
            teacherId: teacherId,
            date: finalDate,
            time: time,
            reason: '',
            recordedBy: 'late_admin',
            timestamp: new Date().toISOString()
        });

        if (window.App) App.showToast('บันทึกข้อมูลมาสายเรียบร้อย', 'success');
        document.getElementById('la-teacher-select').value = '';
        renderTable();
    }

    function deleteRecord(id) {
        if (!DataManager.isAdmin() && !DataManager.isLateAdmin()) {
            if (window.App) App.showToast('ไม่มีสิทธิ์ลบข้อมูล', 'warning');
            return;
        }
        if (confirm('ต้องการลบข้อมูลมาสายนี้ใช่หรือไม่?')) {
            DataManager.deleteLateArrival(id);
            if (window.App) App.showToast('ลบข้อมูลเรียบร้อย', 'info');
            renderTable();
        }
    }

    function getFilteredLateRecords() {
        const months = DataManager.getPeriodMonths();
        const lateArrivals = DataManager.getLateArrivals();
        const recordsByTeacher = {};

        lateArrivals.forEach(r => {
            const parts = r.date.split('/');
            if (parts.length === 3) {
                const m = parseInt(parts[1], 10);
                let y = parseInt(parts[2], 10);
                if (y < 2500) y += 543; // รองรับปี ค.ศ. แปลงเป็น พ.ศ.
                if (months.some(pm => pm.month === m && pm.year === y)) {
                    if (!recordsByTeacher[r.teacherId]) {
                        recordsByTeacher[r.teacherId] = [];
                    }
                    recordsByTeacher[r.teacherId].push(r);
                }
            } else {
                if (!recordsByTeacher[r.teacherId]) {
                    recordsByTeacher[r.teacherId] = [];
                }
                recordsByTeacher[r.teacherId].push(r);
            }
        });

        const teachers = DataManager.getTeachers().sort((a, b) => a.order - b.order);
        const result = [];
        let maxLate = 0;

        teachers.forEach(t => {
            if (recordsByTeacher[t.id] && matchesFilter(t)) {
                const records = recordsByTeacher[t.id].sort((a, b) => {
                    const aDate = a.date.split('/').reverse().join('');
                    const bDate = b.date.split('/').reverse().join('');
                    if (aDate !== bDate) return aDate.localeCompare(bDate);
                    return b.time.localeCompare(a.time);
                });
                if (records.length > maxLate) maxLate = records.length;
                result.push({ teacher: t, records: records });
            }
        });

        maxLate = Math.max(1, Math.min(10, maxLate));

        return { data: result, maxLate };
    }

    function printLateTable() {
        const { data, maxLate } = getFilteredLateRecords();
        const months = DataManager.getPeriodMonths();
        const periodLabel = months.length > 0 ? DataManager.getThaiMonth(months[0].month) + ' ' + months[0].year + ' - ' + DataManager.getThaiMonth(months[months.length - 1].month) + ' ' + months[months.length - 1].year : '';
        const sectionLabel = sectionFilter ? ` (กลุ่ม: ${sectionFilter})` : '';

        let html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
        <title>รายงานการมาสาย</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Noto Sans Thai', sans-serif; font-size: 11px; padding: 20px; }
            h2 { text-align: center; margin-bottom: 4px; font-size: 16px; }
            .subtitle { text-align: center; margin-bottom: 16px; color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
            th { background: #f0f0f0; font-weight: 600; font-size: 10px; }
            td.name { text-align: left; white-space: nowrap; }
            @media print {
                @page { size: landscape; margin: 10mm; }
                body { padding: 0; }
                button { display: none; }
            }
        </style>
        </head><body>
        <h2>รายงานการมาสายของบุคลากร${escapeHtml(sectionLabel)}</h2>
        <div class="subtitle">รอบปีงบประมาณ: ${periodLabel}</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">ลำดับ</th>
                    <th style="width: 150px;">ชื่อ-สกุล</th>
                    <th style="width: 100px;">กลุ่มงาน</th>
                    <th>รวม (ครั้ง)</th>`;

        for (let i = 1; i <= maxLate; i++) {
            html += `<th>ครั้งที่ ${i}</th>`;
        }

        html += `</tr></thead><tbody>`;

        data.forEach(item => {
            html += `<tr>
                <td>${item.teacher.order}</td>
                <td class="name">${escapeHtml(item.teacher.name)}</td>
                <td>${escapeHtml(item.teacher.section || '')}</td>
                <td style="font-weight: bold;">${item.records.length}</td>`;

            for (let i = 0; i < maxLate; i++) {
                if (i < item.records.length) {
                    html += `<td>${item.records[i].date}<br><span style="color:#666;font-size:9px;">${item.records[i].time} น.</span></td>`;
                } else {
                    html += `<td></td>`;
                }
            }
            html += `</tr>`;
        });

        if (data.length === 0) {
            html += `<tr><td colspan="${4 + maxLate}" style="padding: 20px;">ไม่มีข้อมูลการมาสายในรอบปีงบประมาณนี้</td></tr>`;
        }

        html += `</tbody></table>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer; font-family: inherit;">พิมพ์รายงาน</button>
        </div>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
    }

    function exportLateCSV() {
        const { data, maxLate } = getFilteredLateRecords();

        let csv = '\uFEFF';
        let row1 = ['ลำดับ', 'ชื่อ-สกุล', 'กลุ่มงาน', 'รวม (ครั้ง)'];
        for (let i = 1; i <= maxLate; i++) {
            row1.push(`ครั้งที่ ${i} (วัน/เวลา)`);
        }
        csv += row1.join(',') + '\n';

        const escapeCSV = (unsafe) => {
            if (!unsafe) return '';
            return unsafe.toString().replace(/"/g, '""');
        };

        data.forEach(item => {
            let row = [
                item.teacher.order,
                `"${escapeCSV(item.teacher.name)}"`,
                `"${escapeCSV(item.teacher.section)}"`,
                item.records.length
            ];

            for (let i = 0; i < maxLate; i++) {
                if (i < item.records.length) {
                    row.push(`"${item.records[i].date} ${item.records[i].time} น."`);
                } else {
                    row.push('');
                }
            }
            csv += row.join(',') + '\n';
        });

        if (data.length === 0) {
            csv += 'ไม่มีข้อมูลการมาสายในรอบปีงบประมาณนี้\n';
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileSec = sectionFilter ? `-${sectionFilter}` : '';
        link.download = `late_arrival_report_${new Date().toISOString().split('T')[0]}${fileSec}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function exportLateJson() {
        if (!App.isAdmin()) return;
        const data = DataManager.getLateArrivals();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `late_arrival_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function importLateJson(e) {
        if (!App.isAdmin()) return;
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            App.confirm('ยืนยันการคืนค่าข้อมูล: ข้อมูลการมาสายปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้ทั้งหมด ต้องการดำเนินการต่อหรือไม่?', async () => {
                const success = DataManager.importLateData(ev.target.result);
                if (success) {
                    App.showToast('กำลังซิงค์ข้อมูลไปยังฐานข้อมูล...', 'info');
                    await DataManager.forceSyncToCloud();
                    App.showToast('คืนค่าข้อมูลมาสายสำเร็จ', 'success');
                    renderTable();
                } else {
                    App.showToast('ไฟล์ไม่ถูกต้อง', 'error');
                }
                e.target.value = '';
            });
        };
        reader.readAsText(file);
    }

    function clearLateData() {
        if (!App.isAdmin()) return;
        App.confirm('ยืนยันการล้างข้อมูล: คุณต้องการล้างข้อมูลการมาสาย "ทั้งหมด" เพื่อเริ่มปีงบประมาณใหม่ใช่หรือไม่?', async () => {
            DataManager.clearLateData();
            App.showToast('กำลังซิงค์การล้างข้อมูลไปยังฐานข้อมูล...', 'info');
            const success = await DataManager.forceSyncToCloud();

            if (success) {
                App.showToast('ล้างข้อมูลมาสายทั้งหมดสำเร็จแล้ว!', 'success');
                renderTable();
            } else {
                App.showToast('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล', 'error');
            }
        });
    }

    function resetFilters() {
        sectionFilter = '';
        searchQuery = '';
        const sel = document.getElementById('late-section-filter');
        if (sel) sel.value = '';
        const inp = document.getElementById('late-search');
        if (inp) inp.value = '';
    }

    return {
        init,
        render: () => {
            populateSectionFilter();
            renderForm();
            renderTable();
        },
        resetFilters,
        deleteRecord
    };
})();

window.LateArrival = LateArrival;
