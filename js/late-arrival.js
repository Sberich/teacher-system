/* ============================================
   LateArrival - Late Arrival Tracking
   ============================================ */
const LateArrival = (() => {

    function init() {
        const container = document.getElementById('late-arrival-container');
        if (!container) return;

        renderForm();
        renderTable();
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
