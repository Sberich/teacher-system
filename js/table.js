/* ============================================
   LeaveTable — Main Leave Overview Table
   ============================================ */
const LeaveTable = (() => {
    let deletedRecordsStack = [];
    let searchTimeout;
    let searchQuery = '';
    let sectionFilter = '';
    let currentEdit = null;
    let currentRemarkTeacherId = null;

    function init() {
        document.getElementById('table-search').addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                render();
            }, 300);
        });

        document.getElementById('table-section-filter').addEventListener('change', (e) => {
            sectionFilter = e.target.value;
            render();
        });

        document.getElementById('btn-save-leave').addEventListener('click', saveLeave);
        document.getElementById('btn-save-remarks').addEventListener('click', saveRemarks);
        document.getElementById('btn-print-table').addEventListener('click', printTable);
        document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

        // Event delegation for edit/delete buttons in history list
        document.getElementById('leave-history-list').addEventListener('click', (e) => {
            const btnDelete = e.target.closest('.btn-delete-event');
            const btnEdit = e.target.closest('.btn-edit-event');
            const btnUndo = e.target.closest('.btn-undo-event');

            if (btnDelete) {
                // Delete without confirm, so it's faster. They can Undo.
                const id = btnDelete.dataset.id;
                const times = parseFloat(btnDelete.dataset.times) || 0;
                const days = parseFloat(btnDelete.dataset.days) || 0;
                const notes = btnDelete.dataset.notes || '';

                deletedRecordsStack.push({
                    teacherId: currentEdit.teacherId,
                    month: currentEdit.month,
                    year: currentEdit.year,
                    type: currentEdit.type,
                    times, days, notes
                });

                DataManager.deleteLeaveEvent(id);
                App.showToast('ลบรายการแล้ว (สามารถกดย้อนกลับได้)', 'info');

                const mockCell = {
                    dataset: {
                        teacher: currentEdit.teacherId,
                        month: currentEdit.month,
                        year: currentEdit.year,
                        type: currentEdit.type
                    }
                };
                openLeaveModal(mockCell);
                render(); // update background table
            } else if (btnUndo) {
                const rec = deletedRecordsStack.pop();
                if (rec) {
                    DataManager.addLeaveEvent(rec.teacherId, rec.month, rec.year, rec.type, rec.times, rec.days, rec.notes);
                    App.showToast('กู้คืนรายการเรียบร้อย', 'success');
                    const mockCell = {
                        dataset: {
                            teacher: currentEdit.teacherId,
                            month: currentEdit.month,
                            year: currentEdit.year,
                            type: currentEdit.type
                        }
                    };
                    openLeaveModal(mockCell);
                    render();
                }
            } else if (btnEdit) {
                const id = btnEdit.dataset.id;
                const times = btnEdit.dataset.times;
                const days = btnEdit.dataset.days;
                const notes = btnEdit.dataset.notes;

                document.getElementById('leave-edit-id').value = id;
                document.getElementById('leave-times').value = times;
                document.getElementById('leave-days').value = days;
                document.getElementById('leave-notes').value = notes;

                // Update UI to edit mode
                document.getElementById('leave-form-title').style.color = 'var(--warning)';
                document.getElementById('leave-form-icon').textContent = 'edit';
                document.getElementById('leave-form-text').textContent = 'แก้ไขรายการลา';
                document.getElementById('btn-cancel-edit').style.display = 'inline-block';
                document.getElementById('btn-save-icon').textContent = 'save';
                document.getElementById('btn-save-text').textContent = 'บันทึกการแก้ไข';
            }
        });

        document.getElementById('btn-cancel-edit').addEventListener('click', () => {
            resetLeaveForm();
        });

        initDatePicker();

        const tableContainer = document.getElementById('leave-table-container');
        if (tableContainer) {
            tableContainer.addEventListener('mouseover', handleTooltipMouseOver);
            tableContainer.addEventListener('mousemove', handleTooltipMouseMove);
            tableContainer.addEventListener('mouseout', handleTooltipMouseOut);
        }
        window.addEventListener('scroll', hideCustomTooltip, { passive: true });
    }

    let noteDatePicker = null;

    function initDatePicker() {
        const pickerInput = document.getElementById('leave-notes-picker');
        const btnPick = document.getElementById('btn-pick-dates');
        const notesArea = document.getElementById('leave-notes');

        if (!pickerInput || !btnPick || typeof flatpickr === 'undefined') return;

        noteDatePicker = flatpickr(pickerInput, {
            mode: "multiple",
            locale: "th",
            dateFormat: "Y-m-d",
            positionElement: btnPick,
            onClose: function (selectedDates, dateStr, instance) {
                if (selectedDates.length === 0) return;

                // Sort dates
                selectedDates.sort((a, b) => a - b);

                // Format nicely using Thai locale (e.g. 10 มิ.ย.)
                const formattedDates = selectedDates.map(date => {
                    const d = date.getDate();
                    const m = DataManager.getThaiMonth(date.getMonth() + 1);
                    return `${d} ${m}`;
                }).join(', ');

                // Append to textarea
                const currentVal = notesArea.value.trim();
                if (currentVal) {
                    notesArea.value = currentVal + ', ' + formattedDates;
                } else {
                    notesArea.value = formattedDates;
                }

                // Clear flatpickr so it's empty next time
                instance.clear();
            }
        });

        btnPick.addEventListener('click', () => {
            if (noteDatePicker) {
                if (currentEdit) {
                    // Try to jump to the month we are editing
                    const year = currentEdit.year - 543;
                    const month = currentEdit.month - 1;
                    const d = new Date(year, month, 1);
                    noteDatePicker.jumpToDate(d);
                }
                noteDatePicker.open();
            }
        });
    }

    function render() {
        const container = document.getElementById('leave-table-container');
        const sectionSelect = document.getElementById('table-section-filter');
        const months = DataManager.getPeriodMonths();
        let teachers = DataManager.getTeachers();

        // Populate section dropdown if not focused (prevent cursor jump)
        if (document.activeElement !== sectionSelect) {
            const sections = DataManager.getSections();
            let selectHtml = '<option value="">ทุกหมวดหมู่/กลุ่ม</option>';
            sections.forEach(s => {
                selectHtml += `<option value="${escapeHtml(s)}" ${sectionFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`;
            });
            sectionSelect.innerHTML = selectHtml;
        }

        // Apply filters
        if (sectionFilter) {
            if (sectionFilter === 'ครูอัตราจ้าง') {
                teachers = teachers.filter(t => (t.title || '').includes('ครูอัตราจ้าง') || t.section === 'ครูอัตราจ้าง');
            } else {
                teachers = teachers.filter(t => t.section === sectionFilter);
            }
        }
        if (searchQuery) {
            teachers = teachers.filter(t => t.name.toLowerCase().includes(searchQuery));
        }

        if (months.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="material-icons-round">settings</span><p>กรุณาตั้งค่ารอบปีงบประมาณก่อน</p></div>';
            return;
        }

        if (teachers.length === 0 && !searchQuery && !sectionFilter) {
            container.innerHTML = '<div class="empty-state"><span class="material-icons-round">people</span><p>ยังไม่มีรายชื่อครู กรุณาเพิ่มรายชื่อก่อน</p></div>';
            return;
        }

        if (teachers.length === 0 && (searchQuery || sectionFilter)) {
            container.innerHTML = '<div class="empty-state"><span class="material-icons-round">search_off</span><p>ไม่พบครูที่ค้นหาในกลุ่มที่เลือก</p></div>';
            return;
        }

        // Leave types: Sick then Personal (as requested)
        const leaveTypes = [
            { key: 'sick', label: 'ลาป่วย', cls: 'type-sick' },
            { key: 'personal', label: 'ลากิจ', cls: 'type-personal' }
        ];

        let html = '<table class="leave-table" id="leave-table">';

        // --- HEADER ROW 1: Month groups + Summary + Remarks ---
        html += '<thead><tr class="header-months">';
        html += '<th class="sticky-left col-order" rowspan="2">ลำดับ</th>';
        html += '<th class="sticky-left col-name" rowspan="2">ชื่อ-สกุล</th>';

        months.forEach(({ month, year }) => {
            html += `<th colspan="2" class="month-header">${DataManager.getThaiMonth(month)} ${year}</th>`;
        });

        html += '<th colspan="4" class="summary-header">รวมทั้งหมด</th>';
        html += '<th class="remarks-header" rowspan="2">หมายเหตุ</th>';
        html += '</tr>';

        // --- HEADER ROW 2: Leave types per month + Summary sub-headers ---
        html += '<tr class="header-types">';
        months.forEach(() => {
            leaveTypes.forEach(lt => {
                html += `<th class="type-col ${lt.cls}">${lt.label}</th>`;
            });
        });

        // Summary sub-headers: ป่วย | กิจ | รวมครั้ง | รวมวัน
        html += '<th class="type-col type-sick sum-col">ป่วย</th>';
        html += '<th class="type-col type-personal sum-col">กิจ</th>';
        html += '<th class="type-col type-times sum-col">รวมครั้ง</th>';
        html += '<th class="type-col type-days sum-col">รวมวัน</th>';
        html += '</tr></thead>';

        // --- BODY ---
        html += '<tbody>';

        let schoolTotals = {
            sick: { times: 0, days: 0 },
            personal: { times: 0, days: 0 }
        };

        const monthSchoolTotals = {};
        months.forEach(({ month, year }) => {
            const key = `${month}-${year}`;
            monthSchoolTotals[key] = {
                sick: { times: 0, days: 0 },
                personal: { times: 0, days: 0 }
            };
        });

        const allLeaveRecords = DataManager.getLeaveRecords();
        const allLeaveRequests = DataManager.getLeaveRequests();

        teachers.forEach(teacher => {
            const leaveData = DataManager.getTeacherLeaveForPeriod(teacher.id);
            const remark = getCombinedRemark(teacher.id);
            let tTotals = {
                sick: { times: 0, days: 0 },
                personal: { times: 0, days: 0 }
            };

            const lastLeaveTooltip = getLastLeaveTooltip(teacher.id, allLeaveRecords, allLeaveRequests);

            html += `<tr class="teacher-row" data-teacher-id="${teacher.id}">`;
            html += `<td class="sticky-left col-order">${teacher.order}</td>`;
            html += `<td class="sticky-left col-name" data-tooltip="${escapeHtml(lastLeaveTooltip)}">
                        ${escapeHtml(teacher.name)}
                     </td>`;

            months.forEach(({ month, year }) => {
                const key = `${month}-${year}`;
                const data = leaveData[key] || {};

                leaveTypes.forEach(lt => {
                    const record = data[lt.key];
                    const hasData = record && (record.times > 0 || record.days > 0);
                    const cellValue = hasData ? `${record.times}/${record.days}` : '-';

                    // Show tooltip only for Admins
                    let tooltip = '';
                    if (App.isAdmin() && record && record.notes) {
                        tooltip = record.notes;
                    }

                    if (hasData) {
                        tTotals[lt.key].times += record.times;
                        tTotals[lt.key].days += record.days;
                        monthSchoolTotals[key][lt.key].times += record.times;
                        monthSchoolTotals[key][lt.key].days += record.days;
                    }

                    html += `<td class="leave-cell ${lt.cls} ${hasData ? 'has-data' : ''}"
                        data-teacher="${teacher.id}"
                        data-month="${month}"
                        data-year="${year}"
                        data-type="${lt.key}"
                        ${tooltip ? `title="${escapeHtml(tooltip)}"` : ''}>
                        ${cellValue}
                    </td>`;
                });
            });

            // Summary columns
            const totalTimes = tTotals.sick.times + tTotals.personal.times;
            const totalDays = tTotals.sick.days + tTotals.personal.days;

            html += `<td class="summary-cell type-sick">${fmtTotal(tTotals.sick)}</td>`;
            html += `<td class="summary-cell type-personal">${fmtTotal(tTotals.personal)}</td>`;
            html += `<td class="summary-cell type-times">${totalTimes || '-'}</td>`;
            html += `<td class="summary-cell type-days">${totalDays || '-'}</td>`;

            // Remarks column
            html += `<td class="remarks-cell" data-teacher="${teacher.id}" title="${remark ? escapeHtml(remark) : 'คลิกเพื่อเพิ่มหมายเหตุ'}">${remark ? escapeHtml(remark) : '<span class="remarks-placeholder">-</span>'}</td>`;

            html += '</tr>';

            for (const type of ['sick', 'personal']) {
                if (!schoolTotals[type]) continue;
                schoolTotals[type].times += tTotals[type].times;
                schoolTotals[type].days += tTotals[type].days;
            }
        });

        html += '</tbody>';

        // --- FOOTER: School summary ---
        html += '<tfoot><tr class="summary-row">';
        html += '<td class="sticky-left col-order"></td>';
        html += `<td class="sticky-left col-name" style="font-size:0.8rem;">รวม (${teachers.length} คน)</td>`;

        months.forEach(({ month, year }) => {
            const key = `${month}-${year}`;
            const mt = monthSchoolTotals[key];
            leaveTypes.forEach(lt => {
                const t = mt[lt.key];
                const val = (t.times > 0 || t.days > 0) ? `${t.times}/${t.days}` : '-';
                html += `<td class="type-col ${lt.cls}">${val}</td>`;
            });
        });

        const grandTimes = schoolTotals.sick.times + schoolTotals.personal.times;
        const grandDays = schoolTotals.sick.days + schoolTotals.personal.days;

        html += `<td class="summary-cell type-sick">${fmtTotal(schoolTotals.sick)}</td>`;
        html += `<td class="summary-cell type-personal">${fmtTotal(schoolTotals.personal)}</td>`;
        html += `<td class="summary-cell type-times">${grandTimes || '-'}</td>`;
        html += `<td class="summary-cell type-days">${grandDays || '-'}</td>`;
        html += '<td class="remarks-cell"></td>';
        html += '</tr></tfoot>';

        html += '</table>';
        container.innerHTML = html;

        // Click handlers
        container.querySelectorAll('.leave-cell').forEach(cell => {
            cell.addEventListener('click', () => openLeaveModal(cell));
        });

        container.querySelectorAll('.remarks-cell[data-teacher]').forEach(cell => {
            cell.addEventListener('click', () => openRemarksModal(cell.dataset.teacher));
        });
    }

    function fmtTotal(total) {
        return (total.times > 0 || total.days > 0) ? `${total.times}/${total.days}` : '-';
    }

    // Helper function to combine remark with late arrivals
    function getCombinedRemark(teacherId) {
        const remark = DataManager.getRemark(teacherId) || '';
        const periodMonths = DataManager.getPeriodMonths();
        const lateArrivals = DataManager.getLateArrivals().filter(r => {
            if (r.teacherId !== teacherId) return false;
            const parts = (r.date || '').split('/');
            if (parts.length === 3) {
                const m = parseInt(parts[1], 10);
                let y = parseInt(parts[2], 10);
                if (y < 2500) y += 543; // รองรับปี ค.ศ. แปลงเป็น พ.ศ. อัตโนมัติ
                return periodMonths.some(p => p.month === m && p.year === y);
            }
            return true; // Fallback if date is malformed
        });
        const lateCount = lateArrivals.length;
        if (lateCount > 0) {
            const lateText = `มาสาย ${lateCount} ครั้ง`;
            if (remark) {
                return `${remark} (${lateText})`;
            }
            return lateText;
        }
        return remark;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Helper functions to get teacher's latest leave tooltip
    function extractDaysFromNotes(notes) {
        if (!notes) return [];
        const matches = notes.match(/\b([1-9]|[12]\d|3[01])\b/g);
        return matches ? matches.map(Number) : [];
    }

    function normalizeLeaveType(type) {
        const t = (type || '').toLowerCase();
        if (t === 'sick' || t === 'ป่วย') return 'ลาป่วย';
        if (t === 'personal' || t === 'กิจส่วนตัว' || t === 'ลากิจ') return 'ลากิจ';
        if (t === 'maternity' || t === 'คลอดบุตร') return 'ลาคลอดบุตร';
        if (!type) return 'ลา';
        return type.startsWith('ลา') ? type : 'ลา' + type;
    }

    function getLastLeaveTooltip(teacherId, allRecords, allRequests) {
        const candidates = [];

        (allRecords || []).forEach((r, idx) => {
            if (r.teacherId !== teacherId) return;
            if (!(r.days > 0 || r.times > 0)) return;

            const beYear = r.year < 2500 ? r.year + 543 : r.year;
            const month = r.month || 1;
            const daysInNote = extractDaysFromNotes(r.notes);
            const day = daysInNote.length > 0 ? Math.max(...daysInNote) : 1;
            const score = beYear * 10000 + month * 100 + day;

            candidates.push({
                score,
                idx,
                type: normalizeLeaveType(r.type),
                days: r.days || 1,
                month,
                year: beYear,
                notes: (r.notes || '').trim()
            });
        });

        (allRequests || []).forEach((req, idx) => {
            if (req.teacherId !== teacherId || req.status !== 'approved') return;
            if (!req.startDate) return;

            const d = new Date(req.startDate);
            if (isNaN(d.getTime())) return;

            const y = d.getFullYear() < 2500 ? d.getFullYear() + 543 : d.getFullYear();
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const score = y * 10000 + m * 100 + day;

            let noteStr = '';
            const sMonth = DataManager.getThaiMonth(m) || '';
            if (req.endDate && req.startDate !== req.endDate) {
                const eD = new Date(req.endDate);
                const eDay = eD.getDate();
                const eMonth = DataManager.getThaiMonth(eD.getMonth() + 1) || '';
                if (m === eD.getMonth() + 1) {
                    noteStr = `${day}-${eDay} ${sMonth}`;
                } else {
                    noteStr = `${day} ${sMonth} - ${eDay} ${eMonth}`;
                }
            } else {
                noteStr = `${day} ${sMonth}`;
            }

            candidates.push({
                score,
                idx: 100000 + idx,
                type: normalizeLeaveType(req.type),
                days: req.days || 1,
                month: m,
                year: y,
                notes: noteStr
            });
        });

        if (candidates.length === 0) {
            return 'ยังไม่มีประวัติการลา';
        }

        candidates.sort((a, b) => b.score - a.score || b.idx - a.idx);
        const best = candidates[0];

        const shortYear = String(best.year).slice(-2);
        const mName = DataManager.getThaiMonth(best.month) || '';

        let datePart = '';
        let cleanNotes = best.notes.replace(/^วันที่\s*/, '');

        if (cleanNotes && /\d/.test(cleanNotes)) {
            if (cleanNotes.includes(shortYear) || cleanNotes.includes(String(best.year))) {
                datePart = `วันที่ ${cleanNotes}`;
            } else {
                datePart = `วันที่ ${cleanNotes} ${shortYear}`;
            }
        } else if (cleanNotes) {
            datePart = `เดือน ${mName} ${shortYear} (${cleanNotes})`;
        } else {
            datePart = `เดือน ${mName} ${shortYear}`;
        }

        const daysPart = `จำนวน ${best.days} วัน`;

        return `ลาครั้งล่าสุด : ${best.type} ${datePart} ${daysPart}`;
    }

    // --- Leave Modal ---
    function openLeaveModal(cell) {
        if (!App.isAdmin()) {
            App.showToast('กรุณาเข้าสู่ระบบผู้ดูแลเพื่อแก้ไขข้อมูล', 'warning');
            return;
        }

        const teacherId = cell.dataset.teacher;
        const month = parseInt(cell.dataset.month);
        const year = parseInt(cell.dataset.year);
        const type = cell.dataset.type;

        const teacher = DataManager.getTeachers().find(t => t.id === teacherId);
        const records = DataManager.getLeaveRecord(teacherId, month, year, type);

        const typeLabels = { sick: 'ลาป่วย', personal: 'ลากิจส่วนตัว' };

        document.getElementById('leave-teacher-name').textContent = teacher ? teacher.name : '';
        document.getElementById('leave-month-label').textContent = `${DataManager.getThaiMonthFull(month)} ${year}`;
        document.getElementById('leave-type-label').textContent = typeLabels[type] || type;

        const historyList = document.getElementById('leave-history-list');

        // Clear stack if opening a different cell
        if (!currentEdit || currentEdit.teacherId !== teacherId || currentEdit.month !== month || currentEdit.type !== type) {
            deletedRecordsStack = [];
        }

        let html = '';
        // Show Undo banner if something was deleted
        if (deletedRecordsStack.length > 0) {
            html += `
                <div style="background: rgba(239, 68, 68, 0.1); padding: 8px; border-bottom: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--danger);">ลบรายการล่าสุดแล้ว</span>
                    <button type="button" class="btn-undo-event" style="background: white; border: 1px solid var(--danger); color: var(--danger); border-radius: 4px; padding: 2px 8px; cursor: pointer; transition: all 0.2s;">ย้อนกลับ (Undo)</button>
                </div>
            `;
        }

        // Render history
        if (records.length > 0) {
            records.forEach((r, idx) => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
                        <div>
                            <span style="font-weight: bold; color: var(--primary);">ครั้งที่ ${idx + 1}:</span> 
                            ${r.times} ครั้ง / ${r.days} วัน 
                            <span style="color: var(--text-secondary); margin-left: 5px;">${r.notes ? `(${r.notes})` : ''}</span>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button type="button" class="btn-icon-sm btn-edit-event" data-id="${r.id}" data-times="${r.times}" data-days="${r.days}" data-notes="${escapeHtml(r.notes || '')}" style="color: var(--primary); border: none; background: transparent; cursor: pointer;" title="แก้ไขรายการนี้">
                                <span class="material-icons-round" style="font-size: 16px;">edit</span>
                            </button>
                            <button type="button" class="btn-icon-sm btn-delete-event" data-id="${r.id}" data-times="${r.times}" data-days="${r.days}" data-notes="${escapeHtml(r.notes || '')}" style="color: var(--danger); border: none; background: transparent; cursor: pointer;" title="ลบรายการนี้">
                                <span class="material-icons-round" style="font-size: 16px;">delete</span>
                            </button>
                        </div>
                    </div>
                `;
            });
            historyList.innerHTML = html;
        } else {
            if (html === '') {
                historyList.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">ยังไม่มีประวัติการลาในเดือนนี้</div>';
            } else {
                historyList.innerHTML = html + '<div style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">ลบรายการทั้งหมดแล้ว</div>';
            }
        }

        resetLeaveForm();

        currentEdit = { teacherId, month, year, type };
        App.showModal('leave-modal');
        setTimeout(() => document.getElementById('leave-times').focus(), 200);

        if (noteDatePicker) {
            const ceYear = year > 2500 ? year - 543 : year;
            noteDatePicker.jumpToDate(new Date(ceYear, month - 1, 1));
        }
    }

    function resetLeaveForm() {
        document.getElementById('leave-edit-id').value = '';
        document.getElementById('leave-times').value = 0;
        document.getElementById('leave-days').value = 0;
        document.getElementById('leave-notes').value = '';

        document.getElementById('leave-form-title').style.color = 'var(--primary)';
        document.getElementById('leave-form-icon').textContent = 'add_circle';
        document.getElementById('leave-form-text').textContent = 'เพิ่มรายการลาใหม่';
        document.getElementById('btn-cancel-edit').style.display = 'none';
        document.getElementById('btn-save-icon').textContent = 'add';
        document.getElementById('btn-save-text').textContent = 'เพิ่มรายการ';
    }

    function saveLeave() {
        if (!currentEdit) return;

        const editId = document.getElementById('leave-edit-id').value;
        const inputTimes = parseInt(document.getElementById('leave-times').value) || 0;
        const inputDays = parseFloat(document.getElementById('leave-days').value) || 0;
        const inputNotes = document.getElementById('leave-notes').value.trim();

        if (inputTimes === 0 && inputDays === 0 || inputTimes < 0 || inputDays < 0) {
            App.showToast('กรุณาระบุจำนวนครั้ง หรือ วันที่ลา', 'warning');
            return;
        }

        if (editId) {
            DataManager.updateLeaveEvent(editId, inputTimes, inputDays, inputNotes);
            App.showToast('อัปเดตข้อมูลการลาเรียบร้อย');
        } else {
            DataManager.addLeaveEvent(currentEdit.teacherId, currentEdit.month, currentEdit.year, currentEdit.type, inputTimes, inputDays, inputNotes);
            App.showToast('บันทึกข้อมูลการลาเรียบร้อย');
        }

        App.hideModal('leave-modal');
        render();
        currentEdit = null;
    }

    // --- Remarks Modal ---
    function openRemarksModal(teacherId) {
        if (!App.isAdmin()) {
            App.showToast('กรุณาเข้าสู่ระบบผู้ดูแลเพื่อแก้ไขหมายเหตุ', 'warning');
            return;
        }

        const teacher = DataManager.getTeachers().find(t => t.id === teacherId);
        if (!teacher) return;
        currentRemarkTeacherId = teacherId;
        document.getElementById('remarks-teacher-name').textContent = teacher.name;
        document.getElementById('remarks-text').value = DataManager.getRemark(teacherId);
        App.showModal('remarks-modal');
        setTimeout(() => document.getElementById('remarks-text').focus(), 200);
    }

    function saveRemarks() {
        if (!currentRemarkTeacherId) return;
        const text = document.getElementById('remarks-text').value;
        DataManager.setRemark(currentRemarkTeacherId, text);
        App.hideModal('remarks-modal');
        App.showToast('บันทึกหมายเหตุเรียบร้อย');
        render();
        currentRemarkTeacherId = null;
    }

    // --- Filtered Teachers helper ---
    function getFilteredTeachers() {
        let teachers = DataManager.getTeachers();
        if (sectionFilter) {
            if (sectionFilter === 'ครูอัตราจ้าง') {
                teachers = teachers.filter(t => (t.title || '').includes('ครูอัตราจ้าง') || t.section === 'ครูอัตราจ้าง');
            } else {
                teachers = teachers.filter(t => t.section === sectionFilter);
            }
        }
        if (searchQuery) teachers = teachers.filter(t => t.name.toLowerCase().includes(searchQuery));
        return teachers;
    }

    // --- Print Table ---
    function printTable() {
        const months = DataManager.getPeriodMonths();
        const teachers = getFilteredTeachers();
        const settings = DataManager.getSettings();

        const leaveTypes = [
            { key: 'sick', label: 'ป่วย' },
            { key: 'personal', label: 'กิจ' }
        ];

        const periodLabel = months.map(m => DataManager.getThaiMonth(m.month) + ' ' + m.year).join(' - ');
        const sectionLabel = sectionFilter ? ` (กลุ่ม: ${sectionFilter})` : '';

        let html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
        <title>ตารางบันทึกวันลา</title>
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
            td.remarks { text-align: left; min-width: 80px; font-size: 10px; word-break: break-word; }
            .month-header { background: #1e40af; color: white; }
            .summary-header { background: #10b981; color: white; }
            .footer-row td { font-weight: 700; background: #f0f0f0; border-top: 2px solid #333; }
            @media print {
                @page { size: landscape; margin: 10mm; }
                body { padding: 0; }
            }
        </style></head><body>
        <h2>ตารางบันทึกวันลาข้าราชการครู${sectionLabel}</h2>
        <p class="subtitle">รอบ ${periodLabel}</p>
        <table>`;

        // Header row 1
        html += '<thead><tr>';
        html += '<th rowspan="2">ลำดับ</th><th rowspan="2">ชื่อ-สกุล</th>';
        months.forEach(({ month, year }) => {
            html += `<th colspan="2" class="month-header">${DataManager.getThaiMonth(month)} ${year}</th>`;
        });
        html += '<th colspan="4" class="summary-header">รวมทั้งหมด</th>';
        html += '<th rowspan="2">หมายเหตุ</th>';
        html += '</tr>';

        // Header row 2
        html += '<tr>';
        months.forEach(() => {
            leaveTypes.forEach(lt => html += `<th>${lt.label}</th>`);
        });
        html += '<th>ป่วย</th><th>กิจ</th><th>รวมครั้ง</th><th>รวมวัน</th>';
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        let schoolTotals = { sick: { times: 0, days: 0 }, personal: { times: 0, days: 0 } };

        teachers.forEach(teacher => {
            const leaveData = DataManager.getTeacherLeaveForPeriod(teacher.id);
            let tTotals = { sick: { times: 0, days: 0 }, personal: { times: 0, days: 0 } };

            html += `<tr><td>${teacher.order}</td><td class="name">${escapeHtml(teacher.name)}</td>`;

            months.forEach(({ month, year }) => {
                const key = `${month}-${year}`;
                const data = leaveData[key] || {};
                leaveTypes.forEach(lt => {
                    const r = data[lt.key];
                    const hasData = r && (r.times > 0 || r.days > 0);
                    html += `<td>${hasData ? r.times + '/' + r.days : '-'}</td>`;
                    if (hasData) {
                        tTotals[lt.key].times += r.times;
                        tTotals[lt.key].days += r.days;
                    }
                });
            });

            const totalTimes = tTotals.sick.times + tTotals.personal.times;
            const totalDays = tTotals.sick.days + tTotals.personal.days;
            const fmtT = (t) => (t.times || t.days) ? t.times + '/' + t.days : '-';

            html += `<td>${fmtT(tTotals.sick)}</td><td>${fmtT(tTotals.personal)}</td>`;
            html += `<td>${totalTimes || '-'}</td><td>${totalDays || '-'}</td>`;
            html += `<td class="remarks">${escapeHtml(getCombinedRemark(teacher.id))}</td>`;
            html += '</tr>';

            for (const t of ['sick', 'personal']) {
                if (!schoolTotals[t]) continue;
                schoolTotals[t].times += tTotals[t].times;
                schoolTotals[t].days += tTotals[t].days;
            }
        });

        // Footer
        const gt = schoolTotals.sick.times + schoolTotals.personal.times;
        const gd = schoolTotals.sick.days + schoolTotals.personal.days;
        const fmtT = (t) => (t.times || t.days) ? t.times + '/' + t.days : '-';

        html += `<tr class="footer-row"><td></td><td class="name">รวม (${teachers.length} คน)</td>`;
        const teacherIds = teachers.map(t => t.id);
        months.forEach(({ month, year }) => {
            const key = `${month}-${year}`;
            const records = DataManager.getLeaveRecords().filter(r => teacherIds.includes(r.teacherId));
            leaveTypes.forEach(lt => {
                const filtered = records.filter(r => r.month === month && r.year === year && r.type === lt.key);
                const times = filtered.reduce((s, r) => s + r.times, 0);
                const days = filtered.reduce((s, r) => s + r.days, 0);
                html += `<td>${(times || days) ? times + '/' + days : '-'}</td>`;
            });
        });
        html += `<td>${fmtT(schoolTotals.sick)}</td><td>${fmtT(schoolTotals.personal)}</td>`;
        html += `<td>${gt || '-'}</td><td>${gd || '-'}</td><td></td>`;
        html += '</tr></tbody></table></body></html>';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);

        // Close dropdown
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    }

    // --- Export CSV ---
    function exportCSV() {
        const months = DataManager.getPeriodMonths();
        const teachers = getFilteredTeachers();
        const leaveTypes = [
            { key: 'sick', label: 'ป่วย' },
            { key: 'personal', label: 'กิจส่วนตัว' }
        ];

        // BOM for Thai encoding in Excel
        let csv = '\uFEFF';

        // Header row 1
        let row1 = ['ลำดับ', 'ชื่อ-สกุล', 'กลุ่มสาระฯ'];
        months.forEach(({ month, year }) => {
            row1.push(`${DataManager.getThaiMonth(month)} ${year} ป่วย`);
            row1.push(`${DataManager.getThaiMonth(month)} ${year} ลากิจ`);
        });
        row1.push('รวม ป่วย', 'รวม กิจ', 'รวมทั้งหมด', 'รวม วัน', 'หมายเหตุ');
        csv += row1.join(',') + '\n';

        const escapeCSV = (str) => {
            if (!str) return '';
            return str.toString().replace(/"/g, '""');
        };
        // Data rows
        teachers.forEach(teacher => {
            const leaveData = DataManager.getTeacherLeaveForPeriod(teacher.id);
            let tTotals = { sick: { times: 0, days: 0 }, personal: { times: 0, days: 0 } };
            let row = [teacher.order, `"${escapeCSV(teacher.name)}"`, `"${escapeCSV(teacher.section)}"`];

            months.forEach(({ month, year }) => {
                const key = `${month}-${year}`;
                const data = leaveData[key] || {};
                leaveTypes.forEach(lt => {
                    const r = data[lt.key];
                    const hasData = r && (r.times > 0 || r.days > 0);
                    row.push(hasData ? `${r.times}/${r.days}` : '-');
                    if (hasData) {
                        tTotals[lt.key].times += r.times;
                        tTotals[lt.key].days += r.days;
                    }
                });
            });

            const fmtT = (t) => (t.times > 0 || t.days > 0) ? `${t.times}/${t.days}` : '-';
            const totalTimes = tTotals.sick.times + tTotals.personal.times;
            const totalDays = tTotals.sick.days + tTotals.personal.days;

            row.push(fmtT(tTotals.sick), fmtT(tTotals.personal));
            row.push(totalTimes || '-', totalDays || '-');
            row.push(`"${escapeCSV(getCombinedRemark(teacher.id))}"`);
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const settings = DataManager.getSettings();
        const fileSec = sectionFilter ? `-${sectionFilter}` : '';
        a.download = `ตารางวันลา-${settings.fiscalYear}${fileSec}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        App.showToast('ส่งออก CSV เรียบร้อย เปิดด้วย Excel ได้');

        // Close dropdown
        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    }

    function resetFilters() {
        searchQuery = '';
        sectionFilter = '';
    }

    // --- Custom Floating Tooltip Logic ---
    function createTooltipElement() {
        let el = document.getElementById('table-custom-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'table-custom-tooltip';
            el.className = 'table-custom-tooltip';
            document.body.appendChild(el);
        }
        return el;
    }

    function handleTooltipMouseOver(e) {
        const colName = e.target.closest('.col-name[data-tooltip]');
        if (!colName) return;
        const text = colName.getAttribute('data-tooltip');
        if (!text) return;
        showCustomTooltip(text, e);
    }

    function handleTooltipMouseMove(e) {
        const colName = e.target.closest('.col-name[data-tooltip]');
        if (!colName) {
            hideCustomTooltip();
            return;
        }
        positionCustomTooltip(e);
    }

    function handleTooltipMouseOut(e) {
        const related = e.relatedTarget;
        const colName = e.target.closest('.col-name[data-tooltip]');
        if (colName && (!related || !colName.contains(related))) {
            hideCustomTooltip();
        }
    }

    function showCustomTooltip(text, e) {
        const tooltip = createTooltipElement();
        if (text === 'ยังไม่มีประวัติการลา') {
            tooltip.innerHTML = '<span style="color:#10b981;display:flex;align-items:center;"><span class="material-icons-round" style="font-size:16px;">check_circle</span></span><span style="color:#94a3b8;font-weight:500;">ยังไม่มีประวัติการลา</span>';
        } else {
            let styledText = escapeHtml(text);
            styledText = styledText.replace('ลาครั้งล่าสุด :', '<span style="color:#94a3b8;font-weight:400;">ลาครั้งล่าสุด :</span>');
            styledText = styledText.replace('ลากิจ', '<span style="color:#fbbf24;font-weight:600;">ลากิจ</span>');
            styledText = styledText.replace('ลาป่วย', '<span style="color:#f87171;font-weight:600;">ลาป่วย</span>');
            styledText = styledText.replace('ลาคลอดบุตร', '<span style="color:#f472b6;font-weight:600;">ลาคลอดบุตร</span>');

            tooltip.innerHTML = '<span style="color:#60a5fa;display:flex;align-items:center;"><span class="material-icons-round" style="font-size:16px;">history</span></span><span style="color:#f8fafc;font-weight:500;">' + styledText + '</span>';
        }
        tooltip.classList.add('visible');
        positionCustomTooltip(e);
    }

    function positionCustomTooltip(e) {
        const tooltip = document.getElementById('table-custom-tooltip');
        if (!tooltip || !tooltip.classList.contains('visible')) return;

        const pad = 12;
        const width = tooltip.offsetWidth || 230;
        const height = tooltip.offsetHeight || 36;

        let left = e.clientX + 14;
        let top = e.clientY - height - 8;

        if (left + width > window.innerWidth - pad) {
            left = e.clientX - width - 14;
        }
        if (left < pad) left = pad;

        if (top < pad) {
            top = e.clientY + 18;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideCustomTooltip() {
        const tooltip = document.getElementById('table-custom-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    return { init, render, resetFilters };
})();
