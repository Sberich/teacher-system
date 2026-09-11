/* ============================================
   LateArrival - Late Arrival Tracking
   ============================================ */
const LateArrival = (() => {

    function init() {
        const container = document.getElementById('late-arrival-container');
        if (!container) return;

        renderForm();
        renderTable();

        const btnPrint = document.getElementById('btn-print-late-table');
        if (btnPrint) btnPrint.addEventListener('click', printLateTable);

        const btnExport = document.getElementById('btn-export-late-csv');
        if (btnExport) btnExport.addEventListener('click', exportLateCSV);
    }

    function renderForm() {
        const container = document.getElementById('late-arrival-container');
        const teachers = DataManager.getTeachers().sort((a, b) => a.order - b.order);
        
        // Group by section for the dropdown
        const grouped = {};
        teachers.forEach(t => {
            const sec = t.section || 'ทั่วไป';
            if (!grouped[sec]) grouped[sec] = [];
            grouped[sec].push(t);
        });
        
        let teacherOptions = '';
        for (const sec in grouped) {
            teacherOptions += `<optgroup label="${sec}">`;
            grouped[sec].forEach(t => {
                teacherOptions += `<option value="${t.id}">${t.name}</option>`;
            });
            teacherOptions += `</optgroup>`;
        }

        const formHtml = `
            <div class="form-card" style="max-width: 600px; margin: 0 auto 2rem auto; background: var(--bg-card); padding: 24px; border-radius: var(--radius); box-shadow: var(--shadow-md);">
                <div class="form-group" style="margin-bottom: 16px;">
                    <label for="la-teacher-select">เลือกครูที่มาสาย</label>
                    <select id="la-teacher-select" class="form-control">
                        <option value="" disabled selected>-- เลือกครู --</option>
                        ${teacherOptions}
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
            // Sort by date desc, time desc
            const aDate = a.date.split('/').reverse().join('');
            const bDate = b.date.split('/').reverse().join('');
            if(aDate !== bDate) return bDate.localeCompare(aDate);
            return b.time.localeCompare(a.time);
        });
        const teachers = DataManager.getTeachers();

        if (lateArrivals.length === 0) {
            tableContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: #64748b;">ไม่มีข้อมูลการมาสาย</div>';
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

        lateArrivals.forEach(record => {
            const teacher = teachers.find(t => t.id === record.teacherId);
            const teacherName = teacher ? teacher.name : 'ไม่พบข้อมูลครู';
            
            html += `
                <tr>
                    <td>${record.date}</td>
                    <td style="color: #ef4444; font-weight: bold;">${record.time} น.</td>
                    <td>${teacherName}</td>
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
            if (window.showToast) window.showToast('กรุณาเลือกครู', 'error');
            return;
        }

        const id = 'la_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        DataManager.addLateArrival({
            id: id,
            teacherId: teacherId,
            date: date,
            time: time,
            reason: '',
            recordedBy: 'late_admin',
            timestamp: new Date().toISOString()
        });

        if (window.showToast) window.showToast('บันทึกข้อมูลมาสายเรียบร้อย', 'success');
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
            if (window.showToast) window.showToast('ลบข้อมูลเรียบร้อย', 'info');
            renderTable();
        }
    }

    function getFilteredLateRecords() {
        const months = DataManager.getPeriodMonths();
        const lateArrivals = DataManager.getLateArrivals();
        const recordsByTeacher = {};
        
        lateArrivals.forEach(r => {
            const parts = r.date.split('/');
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (months.some(pm => pm.month === m && pm.year === y)) {
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
            if (recordsByTeacher[t.id]) {
                const records = recordsByTeacher[t.id].sort((a, b) => {
                    const aDate = a.date.split('/').reverse().join('');
                    const bDate = b.date.split('/').reverse().join('');
                    if(aDate !== bDate) return aDate.localeCompare(bDate);
                    return a.time.localeCompare(b.time);
                });
                if (records.length > maxLate) maxLate = records.length;
                result.push({ teacher: t, records: records });
            }
        });

        // Cap max columns to 10 as per user request, but if none exceeds, use the max we have (at least 1)
        maxLate = Math.max(1, Math.min(10, maxLate));
        
        return { data: result, maxLate };
    }

    function printLateTable() {
        const { data, maxLate } = getFilteredLateRecords();
        const months = DataManager.getPeriodMonths();
        const periodLabel = months.length > 0 ? DataManager.getThaiMonth(months[0].month) + ' ' + months[0].year + ' - ' + DataManager.getThaiMonth(months[months.length-1].month) + ' ' + months[months.length-1].year : '';

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
        <h2>รายงานการมาสายของบุคลากร</h2>
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
                <td class="name">${item.teacher.name}</td>
                <td>${item.teacher.section || ''}</td>
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

        const escapeHtml = (unsafe) => {
            if (!unsafe) return '';
            return unsafe.toString().replace(/"/g, '""');
        };

        data.forEach(item => {
            let row = [
                item.teacher.order, 
                `"${escapeHtml(item.teacher.name)}"`, 
                `"${escapeHtml(item.teacher.section)}"`,
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
        link.download = `late_arrival_report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return {
        init,
        render: () => {
            renderForm();
            renderTable();
        },
        deleteRecord
    };
})();

window.LateArrival = LateArrival;
