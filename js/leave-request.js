/* ============================================
   Leave Request (Hybrid Form) Manager
   ============================================ */
const LeaveRequest = (() => {
    let datePickerStart = null;
    let datePickerEnd = null;

    async function init() {
        bindEvents();
        
        // Wait briefly for DataManager to have settings
        setTimeout(initLIFF, 100);
    }

    async function initLIFF() {
        if (!window.liff) return; // LIFF SDK not loaded
        
        const settings = DataManager.getSettings();
        if (!settings || !settings.liffId) return; // No LIFF ID configured

        try {
            await liff.init({ liffId: settings.liffId });
            
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                const lineUserId = profile.userId;
                
                // Match teacher
                const checkTeacher = () => {
                    const teachers = DataManager.getTeachers();
                    if (teachers.length > 0) {
                        const teacher = teachers.find(t => t.lineUserId === lineUserId);
                        const select = document.getElementById('lr-teacher');
                        
                        if (teacher && select) {
                            // Lock dropdown to this teacher
                            select.value = teacher.id;
                            select.setAttribute('disabled', 'true');
                            select.style.backgroundColor = '#f1f5f9';
                            
                            // Add verified badge if not already there
                            if (!document.getElementById('liff-verified-badge')) {
                                const hint = document.createElement('div');
                                hint.id = 'liff-verified-badge';
                                hint.style.fontSize = '0.85rem';
                                hint.style.color = '#10b981'; // Success green
                                hint.style.marginTop = '6px';
                                hint.innerHTML = '<span class="material-icons-round" style="font-size:14px;vertical-align:middle;">verified_user</span> ยืนยันตัวตนผ่าน LINE แล้ว';
                                select.parentNode.appendChild(hint);
                                
                                // Auto-fill contact if available
                                const contactInput = document.getElementById('lr-contact');
                                if (contactInput && !contactInput.value && teacher.lineUserId) {
                                    // Optional: could fill phone number if we stored it, but we only have lineUserId
                                }
                            }
                        } else if (!App.isAdmin()) {
                            // Not an admin, and not linked
                            if (!document.getElementById('liff-verified-badge')) {
                                const hint = document.createElement('div');
                                hint.id = 'liff-verified-badge';
                                hint.style.fontSize = '0.85rem';
                                hint.style.color = '#ef4444'; // Danger red
                                hint.style.marginTop = '6px';
                                hint.innerHTML = '<span class="material-icons-round" style="font-size:14px;vertical-align:middle;">error_outline</span> LINE ของคุณยังไม่ผูกกับข้อมูลครูในระบบ';
                                if(select) select.parentNode.appendChild(hint);
                            }
                        }
                    } else {
                        setTimeout(checkTeacher, 500); // Wait for teachers data to load
                    }
                };
                checkTeacher();
            } else if (liff.isInClient()) {
                // Should not happen normally, but required for first-time consent
                liff.login();
            } else {
                // If not logged in (e.g. on PC browser), just leave the dropdown open for manual selection.
                // No forced login.
            }
        } catch (err) {
            console.error('LIFF Init Error:', err);
        }
    }

    function bindEvents() {
        // Date pickers
        datePickerStart = flatpickr("#lr-start-date", {
            locale: "th",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "custom",
            formatDate: (date, format) => {
                if (format === "Y-m-d") {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
                const y = date.getFullYear() + 543;
                const m = DataManager.THAI_MONTHS[date.getMonth() + 1];
                const d = date.getDate();
                return `${d} ${m} ${y}`;
            },
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
            altFormat: "custom",
            formatDate: (date, format) => {
                if (format === "Y-m-d") {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
                const y = date.getFullYear() + 543;
                const m = DataManager.THAI_MONTHS[date.getMonth() + 1];
                const d = date.getDate();
                return `${d} ${m} ${y}`;
            },
        });

        const btnSubmit = document.getElementById('btn-submit-leave-request');
        if (btnSubmit) {
            btnSubmit.addEventListener('click', submitRequest);
        }

        const btnExt = document.getElementById('btn-liff-open-external');
        if (btnExt) {
            btnExt.addEventListener('click', () => {
                if (window.liff && liff.openWindow) {
                    const rId = btnExt.getAttribute('data-reqid');
                    let targetUrl = window.location.origin + window.location.pathname;
                    if (rId) {
                        targetUrl += '?print=' + encodeURIComponent(rId) + '&cb=' + Date.now();
                    } else {
                        targetUrl = window.location.href; // fallback
                    }
                    App.showToast('กำลังเปิดเบราว์เซอร์...', 'info');
                    liff.openWindow({ url: targetUrl, external: true });
                }
            });
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
            let html = '<option value="">-- เลือกชื่อผู้ลา --</option>';
            const teachers = DataManager.getTeachers().sort((a, b) => a.order - b.order);
            
            // Group by section
            const grouped = {};
            teachers.forEach(t => {
                const sec = t.section || 'ทั่วไป';
                if (!grouped[sec]) grouped[sec] = [];
                grouped[sec].push(t);
            });
            
            for (const sec in grouped) {
                html += `<optgroup label="${sec}">`;
                grouped[sec].forEach(t => {
                    html += `<option value="${t.id}">${t.name}</option>`;
                });
                html += `</optgroup>`;
            }
            select.innerHTML = html;
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
            const startStr = startDate.getDate() + ' ' + DataManager.THAI_MONTHS[startDate.getMonth() + 1] + ' ' + (startDate.getFullYear() + 543).toString().slice(2);
            const endStr = endDate.getDate() + ' ' + DataManager.THAI_MONTHS[endDate.getMonth() + 1] + ' ' + (endDate.getFullYear() + 543).toString().slice(2);
            
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

    async function submitRequest() {
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
            App.showToast('ช่วงเวลาที่เลือกตรงกับวันหยุดสุดสัปดาห์ทั้งหมด', 'warning');
            return;
        }

        const reqData = {
            teacherId, type, reason, startDate, endDate, contact, days
        };

        const btnSubmit = document.getElementById('btn-submit-leave-request');
        if (btnSubmit) {
            btnSubmit.disabled = true;
        }

        // FIRE AND FORGET - Do not await to prevent UI hanging
        let newReq = DataManager.addLeaveRequest(reqData);

        App.showToast('ยื่นคำขอลาสำเร็จ', 'success');

        if (btnSubmit) {
            btnSubmit.disabled = false;
        }

        // Open Print view automatically (Original Behavior)
        printForm(newReq.id);

        document.getElementById('lr-reason').value = '';
        render();
    }

    function printForm(reqId, isRetry = false) {
        const requests = DataManager.getLeaveRequests();
        let req = requests.find(r => r.id === reqId);
        
        // If not found OR if reason is blanked out (meaning we need the secret link data), fetch it!
        if (!req || !req.reason || req.reason.trim() === '') {
            if (!isRetry) {
                App.showToast('กำลังเบิกข้อมูลใบลาลับ...', 'info');
                
                const cloudUrl = DataManager.getCloudUrl();
                if (cloudUrl) {
                    const fetchUrl = `${cloudUrl}?action=get_single&id=${encodeURIComponent(reqId)}`;
                    fetch(fetchUrl)
                        .then(r => r.json())
                        .then(res => {
                            if (res.status === 'success' && res.data) {
                                // Add to local requests temporarily just for printing
                                const idx = requests.findIndex(r => r.id === reqId);
                                if (idx > -1) requests[idx] = res.data;
                                else requests.push(res.data);
                                printForm(reqId, true);
                            } else {
                                App.showToast('ไม่พบข้อมูลใบลา (ID: ' + reqId + ')', 'error');
                            }
                        })
                        .catch(() => {
                            App.showToast('เชื่อมต่อฐานข้อมูลล้มเหลว', 'error');
                        });
                    return;
                }
            } else {
                if (!req) {
                    App.showToast('ไม่พบข้อมูลใบลา (ID: ' + reqId + ')', 'error');
                    return;
                }
            }
        }

        const teachers = DataManager.getTeachers();
        const t = teachers.find(t => t.id === req.teacherId);
        if (!t) {
            App.showToast('ไม่พบข้อมูลผู้ลาในฐานข้อมูล', 'error');
            return;
        }

        const settings = DataManager.getSettings();

        // Populate print form
        document.getElementById('print-date').textContent = new Date().getDate();
        document.getElementById('print-month').textContent = DataManager.THAI_MONTHS_FULL[new Date().getMonth() + 1];
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
        document.getElementById('print-start-m').textContent = DataManager.THAI_MONTHS_FULL[sD.getMonth() + 1];
        document.getElementById('print-start-y').textContent = sD.getFullYear() + 543;
        
        document.getElementById('print-end-d').textContent = eD.getDate();
        document.getElementById('print-end-m').textContent = DataManager.THAI_MONTHS_FULL[eD.getMonth() + 1];
        document.getElementById('print-end-y').textContent = eD.getFullYear() + 543;
        document.getElementById('print-days').textContent = req.days;
        
        document.getElementById('print-contact').textContent = req.contact;
        document.getElementById('print-sign-name').textContent = t.name;

        // Calculate past leave
        const records = DataManager.getLeaveRecords();
        const periodMonths = DataManager.getPeriodMonths();
        let pastSick = 0, pastSickCount = 0;
        let pastPers = 0, pastPersCount = 0;
        let pastMat = 0, pastMatCount = 0;
        let lastLeave = null;

        records.forEach(r => {
            if (r.teacherId === req.teacherId) {
                // Determine if record is in current fiscal year
                const isInPeriod = periodMonths.some(pm => pm.month === r.month && pm.year === r.year);
                
                if (isInPeriod) {
                    if (r.type === 'sick' || r.type === 'ป่วย') { pastSick += r.days; pastSickCount += r.times || 1; }
                    if (r.type === 'personal' || r.type === 'ลากิจส่วนตัว') { pastPers += r.days; pastPersCount += r.times || 1; }
                    if (r.type === 'maternity' || r.type === 'ลาคลอดบุตร') { pastMat += r.days; pastMatCount += r.times || 1; }
                }

                // Find last leave (overall history is fine for determining last leave taken)
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

        // Adjust past stats if this request is already approved (already in records)
        let isApproved = req.status === 'approved';
        let dPastSick = isApproved && req.type === 'ป่วย' ? pastSick - req.days : pastSick;
        let dPastSickC = isApproved && req.type === 'ป่วย' ? pastSickCount - 1 : pastSickCount;
        let dPastPers = isApproved && req.type === 'กิจส่วนตัว' ? pastPers - req.days : pastPers;
        let dPastPersC = isApproved && req.type === 'กิจส่วนตัว' ? pastPersCount - 1 : pastPersCount;
        let dPastMat = isApproved && req.type === 'คลอดบุตร' ? pastMat - req.days : pastMat;
        let dPastMatC = isApproved && req.type === 'คลอดบุตร' ? pastMatCount - 1 : pastMatCount;

        // Stats Table (Format: Count/Days)
        document.getElementById('print-stat-sick-past').textContent = dPastSick > 0 ? `${dPastSickC}/${dPastSick}` : '-';
        document.getElementById('print-stat-pers-past').textContent = dPastPers > 0 ? `${dPastPersC}/${dPastPers}` : '-';
        document.getElementById('print-stat-mat-past').textContent = dPastMat > 0 ? `${dPastMatC}/${dPastMat}` : '-';

        document.getElementById('print-stat-sick-now').textContent = req.type === 'ป่วย' ? `1/${req.days}` : '-';
        document.getElementById('print-stat-pers-now').textContent = req.type === 'กิจส่วนตัว' ? `1/${req.days}` : '-';
        document.getElementById('print-stat-mat-now').textContent = req.type === 'คลอดบุตร' ? `1/${req.days}` : '-';

        document.getElementById('print-stat-sick-total').textContent = req.type === 'ป่วย' ? `${dPastSickC + 1}/${dPastSick + req.days}` : (dPastSick > 0 ? `${dPastSickC}/${dPastSick}` : '-');
        document.getElementById('print-stat-pers-total').textContent = req.type === 'กิจส่วนตัว' ? `${dPastPersC + 1}/${dPastPers + req.days}` : (dPastPers > 0 ? `${dPastPersC}/${dPastPers}` : '-');
        document.getElementById('print-stat-mat-total').textContent = req.type === 'คลอดบุตร' ? `${dPastMatC + 1}/${dPastMat + req.days}` : (dPastMat > 0 ? `${dPastMatC}/${dPastMat}` : '-');

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
