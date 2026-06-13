/* ============================================
   LeaveTable — Main Leave Overview Table
   ============================================ */
const LeaveTable = (() => {
    let searchQuery = '';
    let sectionFilter = '';
    let currentEdit = null;
    let currentRemarkTeacherId = null;

    function init() {
        document.getElementById('table-search').addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            render();
        });

        document.getElementById('table-section-filter').addEventListener('change', (e) => {
            sectionFilter = e.target.value;
            render();
        });

        document.getElementById('btn-save-leave').addEventListener('click', saveLeave);
        document.getElementById('btn-delete-leave').addEventListener('click', deleteLeave);
        document.getElementById('btn-save-remarks').addEventListener('click', saveRemarks);
        document.getElementById('btn-print-table').addEventListener('click', printTable);
        document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
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
            teachers = teachers.filter(t => t.section === sectionFilter);
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
            { key: 'sick', label: 'ป่วย', cls: 'type-sick' },
            { key: 'personal', label: 'กิจ', cls: 'type-personal' }
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

        teachers.forEach(teacher => {
            const leaveData = DataManager.getTeacherLeaveForPeriod(teacher.id);
            const remark = DataManager.getRemark(teacher.id);
            let tTotals = {
                sick: { times: 0, days: 0 },
                personal: { times: 0, days: 0 }
            };

            html += `<tr class="teacher-row" data-teacher-id="${teacher.id}">`;
            html += `<td class="sticky-left col-order">${teacher.order}</td>`;
            html += `<td class="sticky-left col-name" title="${teacher.name}">
                        ${teacher.name}
                     </td>`;

            months.forEach(({ month, year }) => {
                const key = `${month}-${year}`;
                const data = leaveData[key] || {};

                leaveTypes.forEach(lt => {
                    const record = data[lt.key];
                    const hasData = record && (record.times > 0 || record.days > 0);
                    const cellValue = hasData ? `${record.times}/${record.days}` : '-';
                    const tooltip = record && record.notes ? record.notes : '';

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
            html += `<td class="remarks-cell" data-teacher="${teacher.id}" title="${remark ? escapeHtml(remark) : 'คลิกเพื่อเพิ่มหมายเหตุ'}">${remark || '<span class="remarks-placeholder">-</span>'}</td>`;

            html += '</tr>';

            for (const type of ['sick', 'personal']) {
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

    function fmtTotal(t) {
        return (t.times > 0 || t.days > 0) ? `${t.times}/${t.days}` : '-';
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        const record = DataManager.getLeaveRecord(teacherId, month, year, type);

        const typeLabels = { sick: 'ลาป่วย', personal: 'ลากิจส่วนตัว' };

        document.getElementById('leave-teacher-name').textContent = teacher ? teacher.name : '';
        document.getElementById('leave-month-label').textContent = `${DataManager.getThaiMonthFull(month)} ${year}`;
        document.getElementById('leave-type-label').textContent = typeLabels[type] || type;

        document.getElementById('leave-times').value = record ? record.times : 0;
        document.getElementById('leave-days').value = record ? record.days : 0;
        document.getElementById('leave-notes').value = record ? (record.notes || '') : '';

        document.getElementById('btn-delete-leave').style.display = record ? '' : 'none';

        currentEdit = { teacherId, month, year, type };
        App.showModal('leave-modal');
        setTimeout(() => document.getElementById('leave-times').focus(), 200);
    }

    function saveLeave() {
        if (!currentEdit) return;
        const times = parseInt(document.getElementById('leave-times').value) || 0;
        const days = parseFloat(document.getElementById('leave-days').value) || 0;
        const notes = document.getElementById('leave-notes').value.trim();
        DataManager.setLeaveRecord(currentEdit.teacherId, currentEdit.month, currentEdit.year, currentEdit.type, times, days, notes);
        App.hideModal('leave-modal');
        App.showToast('บันทึกข้อมูลการลาเรียบร้อย');
        render();
        currentEdit = null;
    }

    function deleteLeave() {
        if (!currentEdit) return;
        DataManager.deleteLeaveRecord(currentEdit.teacherId, currentEdit.month, currentEdit.year, currentEdit.type);
        App.hideModal('leave-modal');
        App.showToast('ลบข้อมูลการลาเรียบร้อย', 'info');
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
        if (sectionFilter) teachers = teachers.filter(t => t.section === sectionFilter);
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

            html += `<tr><td>${teacher.order}</td><td class="name">${teacher.name}</td>`;

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
            html += `<td class="remarks">${escapeHtml(DataManager.getRemark(teacher.id))}</td>`;
            html += '</tr>';

            for (const t of ['sick', 'personal']) {
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
            { key: 'personal', label: 'กิจ' }
        ];

        // BOM for Thai encoding in Excel
        let csv = '\uFEFF';

        // Header row 1
        let row1 = ['ลำดับ', 'ชื่อ-สกุล', 'กลุ่ม'];
        months.forEach(({ month, year }) => {
            row1.push(`${DataManager.getThaiMonth(month)} ${year} ป่วย`);
            row1.push(`${DataManager.getThaiMonth(month)} ${year} กิจ`);
        });
        row1.push('รวมป่วย', 'รวมกิจ', 'รวมครั้ง', 'รวมวัน', 'หมายเหตุ');
        csv += row1.join(',') + '\n';

        // Data rows
        teachers.forEach(teacher => {
            const leaveData = DataManager.getTeacherLeaveForPeriod(teacher.id);
            let tTotals = { sick: { times: 0, days: 0 }, personal: { times: 0, days: 0 } };
            let row = [teacher.order, `"${teacher.name}"`, `"${teacher.section}"`];

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

            const totalTimes = tTotals.sick.times + tTotals.personal.times;
            const totalDays = tTotals.sick.days + tTotals.personal.days;
            const fmtT = (t) => (t.times || t.days) ? t.times + '/' + t.days : '-';

            row.push(fmtT(tTotals.sick), fmtT(tTotals.personal));
            row.push(totalTimes || '-', totalDays || '-');
            row.push(`"${DataManager.getRemark(teacher.id)}"`);
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

    return { init, render };
})();
