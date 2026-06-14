/* ============================================
   Leave Request (Hybrid Form) Manager
   ============================================ */
const LeaveRequest = (() => {
    let datePickerStart = null;
    let datePickerEnd = null;

    function init() {
        bindEvents();
    }

    function bindEvents() {
        // Date pickers
        datePickerStart = flatpickr("#lr-start-date", {
            locale: "th",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "j F Y",
            onChange: function(selectedDates, dateStr, instance) {
                if(datePickerEnd) {
                    datePickerEnd.set('minDate', dateStr);
                }
            }
        });

        datePickerEnd = flatpickr("#lr-end-date", {
            locale: "th",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "j F Y",
        });

        const btnSubmit = document.getElementById('btn-submit-leave-request');
        if (btnSubmit) {
            btnSubmit.addEventListener('click', submitRequest);
        }

        const btnClear = document.getElementById('btn-clear-requests');
        if (btnClear) {
            btnClear.addEventListener('click', clearRequests);
        }
    }

    function render() {
        // Render Leave Request Form
        const select = document.getElementById('lr-teacher');
        if (select) {
            select.innerHTML = '<option value="">-- เลือกชื่อผู้ลา --</option>';
            const teachers = DataManager.getTeachers();
            teachers.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                select.appendChild(opt);
            });
        }

        // Clear form
        if (document.getElementById('lr-reason')) document.getElementById('lr-reason').value = '';
        if (document.getElementById('lr-contact')) document.getElementById('lr-contact').value = '';
        if (datePickerStart) datePickerStart.clear();
        if (datePickerEnd) datePickerEnd.clear();

        // Render Manage Requests Table (Admin)
        renderManageTable();
    }

    function renderManageTable() {
        const tbody = document.getElementById('manage-requests-tbody');
        if (!tbody) return;

        const requests = DataManager.getLeaveRequests();
        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">ไม่มีรายการคำขอลา</td></tr>';
            return;
        }

        const teachers = DataManager.getTeachers();

        // Sort descending by timestamp
        requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach((req, index) => {
            const tr = document.createElement('tr');
            const t = teachers.find(t => t.id === req.teacherId);
            const teacherName = t ? t.name : 'ไม่ทราบชื่อ';

            let statusBadge = '';
            if (req.status === 'pending') statusBadge = '<span style="background:#fef08a;color:#854d0e;padding:4px 8px;border-radius:12px;font-size:0.8rem;font-weight:600;">รอตรวจสอบ</span>';
            else if (req.status === 'approved') statusBadge = '<span style="background:#bbf7d0;color:#166534;padding:4px 8px;border-radius:12px;font-size:0.8rem;font-weight:600;">อนุมัติแล้ว</span>';
            else if (req.status === 'rejected') statusBadge = '<span style="background:#fecaca;color:#991b1b;padding:4px 8px;border-radius:12px;font-size:0.8rem;font-weight:600;">ยกเลิกแล้ว</span>';

            const startDate = new Date(req.startDate);
            const endDate = new Date(req.endDate);
            const startStr = startDate.getDate() + ' ' + DataManager.THAI_MONTHS[startDate.getMonth() - 1 + 1] + ' ' + (startDate.getFullYear() + 543).toString().slice(2);
            const endStr = endDate.getDate() + ' ' + DataManager.THAI_MONTHS[endDate.getMonth() - 1 + 1] + ' ' + (endDate.getFullYear() + 543).toString().slice(2);
            
            const dateStr = startDate.getTime() === endDate.getTime() ? startStr : startStr + ' - ' + endStr;

            tr.innerHTML = `
                <td style="text-align:center;">${index + 1}</td>
                <td>${teacherName}</td>
                <td>${req.type}</td>
                <td>${dateStr}</td>
                <td>${statusBadge}</td>
                <td style="text-align:right;">
                    <button class="btn-icon" title="พิมพ์ใบลา" onclick="LeaveRequest.printForm('${req.id}')" style="color:var(--primary);"><span class="material-icons-round">print</span></button>
                    ${req.status === 'pending' ? `
                    <button class="btn-icon admin-only" title="อนุมัติ (บันทึกลงสถิติ)" onclick="LeaveRequest.approveRequest('${req.id}')" style="color:#10b981;"><span class="material-icons-round">check_circle</span></button>
                    <button class="btn-icon admin-only" title="ยกเลิก/ลบทิ้ง" onclick="LeaveRequest.rejectRequest('${req.id}')" style="color:#f59e0b;"><span class="material-icons-round">cancel</span></button>
                    ` : `
                    <button class="btn-icon admin-only" title="ลบรายการนี้" onclick="LeaveRequest.deleteRequest('${req.id}')" style="color:#ef4444;"><span class="material-icons-round">delete</span></button>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function submitRequest() {
        const teacherId = document.getElementById('lr-teacher').value;
        const type = document.getElementById('lr-type').value;
        const reason = document.getElementById('lr-reason').value;
        const startDate = document.getElementById('lr-start-date').value;
        const endDate = document.getElementById('lr-end-date').value;
        const contact = document.getElementById('lr-contact').value;

        if (!teacherId || !reason || !startDate || !endDate || !contact) {
            App.showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
            return;
        }

        const sDate = new Date(startDate);
        const eDate = new Date(endDate);
        if (eDate < sDate) {
            App.showToast('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น', 'warning');
            return;
        }

        // Calculate business days (simple: difference + 1, skipping weekends)
        let days = 0;
        let curDate = new Date(startDate);
        while (curDate <= eDate) {
            const day = curDate.getDay();
            if (day !== 0 && day !== 6) days++; // Skip Sunday(0) and Saturday(6)
            curDate.setDate(curDate.getDate() + 1);
        }

        if (days === 0) {
            App.showToast('ช่วงเวลาที่เลือกตรงกับวันหยุดเสาร์-อาทิตย์ทั้งหมด', 'warning');
            return;
        }

        const reqData = {
            teacherId, type, reason, startDate, endDate, contact, days
        };

        const newReq = DataManager.addLeaveRequest(reqData);
        App.showToast('บันทึกคำขอลาเรียบร้อยแล้ว', 'success');

        // Open Print view automatically
        printForm(newReq.id);

        render();
    }

    function printForm(reqId) {
        const requests = DataManager.getLeaveRequests();
        const req = requests.find(r => r.id === reqId);
        if (!req) return;

        const teachers = DataManager.getTeachers();
        const t = teachers.find(t => t.id === req.teacherId);
        if (!t) return;

        const settings = DataManager.getSettings();

        // Populate print form
        document.getElementById('print-date').textContent = new Date().getDate();
        document.getElementById('print-month').textContent = DataManager.THAI_MONTHS_FULL[new Date().getMonth()];
        document.getElementById('print-year').textContent = new Date().getFullYear() + 543;

        document.getElementById('print-subject').textContent = `ขอลา${req.type === 'ป่วย' ? 'ป่วย' : req.type === 'กิจส่วนตัว' ? 'ลากิจส่วนตัว' : 'คลอดบุตร'}`;
        document.getElementById('print-name').textContent = t.name;
        document.getElementById('print-position').textContent = t.title || '...................';
        
        // Populate settings (School Name, Director Name, etc.)
        if (settings.schoolName) {
            document.getElementById('print-location').textContent = `โรงเรียน${settings.schoolName}`;
            document.getElementById('print-director').textContent = `ผู้อำนวยการโรงเรียน${settings.schoolName}`;
            document.getElementById('print-director-pos').textContent = `ผู้อำนวยการโรงเรียน${settings.schoolName}`;
        }
        if (settings.directorName) {
            document.getElementById('print-director-name').textContent = settings.directorName;
        }
        if (settings.hrName) {
            document.getElementById('print-hr-name').textContent = settings.hrName;
        }
        if (settings.deputyName) {
            document.getElementById('print-deputy-name').textContent = settings.deputyName;
        }
        
        // Reset checkboxes
        document.getElementById('print-cb-sick').textContent = '☐';
        document.getElementById('print-cb-personal').textContent = '☐';
        document.getElementById('print-cb-maternity').textContent = '☐';
        if (req.type === 'ป่วย') document.getElementById('print-cb-sick').textContent = '☑';
        if (req.type === 'กิจส่วนตัว') document.getElementById('print-cb-personal').textContent = '☑';
        if (req.type === 'คลอดบุตร') document.getElementById('print-cb-maternity').textContent = '☑';

        document.getElementById('print-reason').textContent = req.reason;

        const sD = new Date(req.startDate);
        const eD = new Date(req.endDate);
        document.getElementById('print-start-d').textContent = sD.getDate();
        document.getElementById('print-start-m').textContent = DataManager.THAI_MONTHS_FULL[sD.getMonth()];
        document.getElementById('print-start-y').textContent = sD.getFullYear() + 543;
        
        document.getElementById('print-end-d').textContent = eD.getDate();
        document.getElementById('print-end-m').textContent = DataManager.THAI_MONTHS_FULL[eD.getMonth()];
        document.getElementById('print-end-y').textContent = eD.getFullYear() + 543;
        document.getElementById('print-days').textContent = req.days;
        
        document.getElementById('print-contact').textContent = req.contact;
        document.getElementById('print-sign-name').textContent = t.name;

        // Calculate past leave
        const records = DataManager.getLeaveRecords();
        let pastSick = 0, pastSickCount = 0;
        let pastPers = 0, pastPersCount = 0;
        let pastMat = 0, pastMatCount = 0;
        let lastLeave = null;

        records.forEach(r => {
            if (r.teacherId === req.teacherId) {
                // Determine logic for fiscal year, for now just sum all or within settings
                // In a real scenario we check if r.year/month is in the current fiscal year
                if (r.type === 'sick' || r.type === 'ป่วย') { pastSick += r.days; pastSickCount++; }
                if (r.type === 'personal' || r.type === 'กิจส่วนตัว') { pastPers += r.days; pastPersCount++; }
                if (r.type === 'maternity' || r.type === 'คลอดบุตร') { pastMat += r.days; pastMatCount++; }

                // Find last leave
                if (!lastLeave || r.year > lastLeave.year || (r.year === lastLeave.year && r.month > lastLeave.month)) {
                    lastLeave = r;
                }
            }
        });

        // Last leave details
        document.getElementById('print-last-cb-sick').textContent = '☐';
        document.getElementById('print-last-cb-personal').textContent = '☐';
        document.getElementById('print-last-cb-maternity').textContent = '☐';
        document.getElementById('print-last-start').textContent = '.......................................';
        document.getElementById('print-last-days').textContent = '........';

        if (lastLeave) {
            if (lastLeave.type === 'sick' || lastLeave.type === 'ป่วย') document.getElementById('print-last-cb-sick').textContent = '☑';
            if (lastLeave.type === 'personal' || lastLeave.type === 'กิจส่วนตัว') document.getElementById('print-last-cb-personal').textContent = '☑';
            if (lastLeave.type === 'maternity' || lastLeave.type === 'คลอดบุตร') document.getElementById('print-last-cb-maternity').textContent = '☑';
            
            document.getElementById('print-last-start').textContent = lastLeave.notes || '(ดูในสถิติ)';
            document.getElementById('print-last-days').textContent = lastLeave.days;
        }

        // Stats Table
        // Stats Table (Format: Count/Days)
        document.getElementById('print-stat-sick-past').textContent = pastSick > 0 ? `${pastSickCount}/${pastSick}` : '-';
        document.getElementById('print-stat-pers-past').textContent = pastPers > 0 ? `${pastPersCount}/${pastPers}` : '-';
        document.getElementById('print-stat-mat-past').textContent = pastMat > 0 ? `${pastMatCount}/${pastMat}` : '-';

        document.getElementById('print-stat-sick-now').textContent = req.type === 'ป่วย' ? `1/${req.days}` : '-';
        document.getElementById('print-stat-pers-now').textContent = req.type === 'กิจส่วนตัว' ? `1/${req.days}` : '-';
        document.getElementById('print-stat-mat-now').textContent = req.type === 'คลอดบุตร' ? `1/${req.days}` : '-';

        document.getElementById('print-stat-sick-total').textContent = req.type === 'ป่วย' ? `${pastSickCount + 1}/${pastSick + req.days}` : (pastSick > 0 ? `${pastSickCount}/${pastSick}` : '-');
        document.getElementById('print-stat-pers-total').textContent = req.type === 'กิจส่วนตัว' ? `${pastPersCount + 1}/${pastPers + req.days}` : (pastPers > 0 ? `${pastPersCount}/${pastPers}` : '-');
        document.getElementById('print-stat-mat-total').textContent = req.type === 'คลอดบุตร' ? `${pastMatCount + 1}/${pastMat + req.days}` : (pastMat > 0 ? `${pastMatCount}/${pastMat}` : '-');

        // Trigger Print Window immediately (prevent mobile popup blockers)
        window.print();
    }

    function approveRequest(reqId) {
        if(!DataManager.isAdmin()) return;
        
        if(confirm('ต้องการอนุมัติและบันทึกสถิติการลานี้ใช่หรือไม่?')) {
            const requests = DataManager.getLeaveRequests();
            const req = requests.find(r => r.id === reqId);
            if (!req) return;

            // Convert to leave event
            const startDate = new Date(req.startDate);
            const endDate = new Date(req.endDate);
            let eType = req.type === 'ป่วย' ? 'sick' : req.type === 'กิจส่วนตัว' ? 'personal' : 'maternity';
            
            let noteStr = '';
            const sDay = startDate.getDate();
            const sMonth = DataManager.getThaiMonth(startDate.getMonth() + 1);
            
            if (req.startDate === req.endDate) {
                noteStr = `${sDay} ${sMonth}`;
            } else {
                const eDay = endDate.getDate();
                const eMonth = DataManager.getThaiMonth(endDate.getMonth() + 1);
                if (startDate.getMonth() === endDate.getMonth()) {
                    noteStr = `${sDay}-${eDay} ${sMonth}`;
                } else {
                    noteStr = `${sDay} ${sMonth} - ${eDay} ${eMonth}`;
                }
            }

            const eventData = {
                teacherId: req.teacherId,
                month: startDate.getMonth() + 1,
                year: startDate.getFullYear() + 543,
                type: eType,
                times: 1,
                days: req.days,
                notes: noteStr
            };

            DataManager.addLeaveEvent(
                eventData.teacherId, 
                eventData.month, 
                eventData.year, 
                eventData.type, 
                eventData.times, 
                eventData.days, 
                eventData.notes
            );
            DataManager.updateLeaveRequestStatus(reqId, 'approved');
            
            App.showToast('อนุมัติและบันทึกสถิติเรียบร้อย', 'success');
            renderManageTable();
        }
    }

    function rejectRequest(reqId) {
        if(!DataManager.isAdmin()) return;
        
        if(confirm('ต้องการยกเลิกคำขอลานี้ใช่หรือไม่?')) {
            DataManager.updateLeaveRequestStatus(reqId, 'rejected');
            App.showToast('ยกเลิกคำขอลาแล้ว', 'info');
            renderManageTable();
        }
    }

    function clearRequests() {
        if(!DataManager.isAdmin()) return;

        if(confirm('ต้องการล้างรายการที่อนุมัติ/ยกเลิกแล้วออกจากตารางใช่หรือไม่?')) {
            DataManager.clearCompletedLeaveRequests();
            renderManageTable();
        }
    }

    function deleteRequest(reqId) {
        if(!DataManager.isAdmin()) return;

        if(confirm('ต้องการลบรายการคำขอลานี้ออกจากระบบใช่หรือไม่?')) {
            DataManager.deleteLeaveRequest(reqId);
            App.showToast('ลบรายการคำขอลาแล้ว', 'info');
            renderManageTable();
        }
    }

    return {
        init, render, printForm, approveRequest, rejectRequest, deleteRequest
    };
})();
