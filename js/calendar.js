/* ============================================
   Calendar — Monthly Leave Calendar View
   ============================================ */
const Calendar = (() => {
    let currentMonth = new Date().getMonth() + 1; // 1-12
    let currentYear = new Date().getFullYear() + 543; // Buddhist Era

    function init() {
        document.getElementById('cal-prev').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 1) { currentMonth = 12; currentYear--; }
            render();
        });

        document.getElementById('cal-next').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 12) { currentMonth = 1; currentYear++; }
            render();
        });
    }

    function render() {
        document.getElementById('cal-month-label').textContent =
            `${DataManager.getThaiMonthFull(currentMonth)} ${currentYear}`;
        renderGrid();
    }

    function renderGrid() {
        const container = document.getElementById('calendar-grid');
        const detail = document.getElementById('calendar-detail');

        // CE year for Date calculations
        const ceYear = currentYear - 543;
        const firstDay = new Date(ceYear, currentMonth - 1, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(ceYear, currentMonth, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === ceYear && today.getMonth() + 1 === currentMonth;
        const todayDate = today.getDate();

        // Get leave records for this month
        const records = DataManager.getLeaveRecords().filter(r =>
            r.month === currentMonth && r.year === currentYear
        );

        const teachers = DataManager.getTeachers();

        // Build dateMap: date -> [{teacher, type, record}]
        const dateMap = {};
        records.forEach(r => {
            const teacher = teachers.find(t => t.id === r.teacherId);
            if (!teacher) return;
            const dates = extractDates(r.notes, daysInMonth);
            dates.forEach(d => {
                if (!dateMap[d]) dateMap[d] = [];
                dateMap[d].push({ teacher, type: r.type, record: r });
            });
        });

        // Day name headers
        const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
        let html = '<div class="cal-header-row">';
        dayNames.forEach((d, i) => {
            html += `<div class="cal-day-name ${i === 0 || i === 6 ? 'weekend' : ''}">${d}</div>`;
        });
        html += '</div><div class="cal-body">';

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-cell empty"></div>';
        }

        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = (firstDay + d - 1) % 7;
            const isWeekend = dow === 0 || dow === 6;
            const events = dateMap[d] || [];
            const hasEvents = events.length > 0;
            const isToday = isCurrentMonth && d === todayDate;

            html += `<div class="cal-cell ${isWeekend ? 'weekend' : ''} ${hasEvents ? 'has-events' : ''} ${isToday ? 'today' : ''}" data-date="${d}">`;
            html += `<span class="cal-date">${d}</span>`;

            if (hasEvents) {
                html += '<div class="cal-dots">';
                const types = [...new Set(events.map(e => e.type))];
                types.forEach(type => {
                    html += `<span class="cal-dot type-${type}"></span>`;
                });
                html += '</div>';
                html += `<span class="cal-count">${events.length}</span>`;
            }
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Default detail
        detail.innerHTML = `
            <div class="cal-detail-placeholder">
                <span class="material-icons-round">touch_app</span>
                <p>แตะวันที่เพื่อดูรายละเอียด</p>
            </div>`;

        // Click handlers
        container.querySelectorAll('.cal-cell:not(.empty)').forEach(cell => {
            cell.addEventListener('click', () => {
                container.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                showDetail(parseInt(cell.dataset.date), dateMap);
            });
        });
    }

    function showDetail(date, dateMap) {
        const detail = document.getElementById('calendar-detail');
        const events = dateMap[date] || [];

        const typeLabels = { personal: 'ลากิจ', sick: 'ลาป่วย', other: 'อื่นๆ' };
        const typeIcons = { personal: 'event_note', sick: 'local_hospital', other: 'more_horiz' };

        if (events.length === 0) {
            detail.innerHTML = `
                <div class="cal-detail-empty">
                    <span class="material-icons-round" style="font-size:36px;opacity:0.3;margin-bottom:8px;">event_available</span>
                    <p style="font-weight:600;">${date} ${DataManager.getThaiMonthFull(currentMonth)} ${currentYear}</p>
                    <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">ไม่มีคนลาวันนี้</p>
                </div>`;
            return;
        }

        let html = `
            <div class="cal-detail-header">
                <h4>${date} ${DataManager.getThaiMonthFull(currentMonth)} ${currentYear}</h4>
                <span class="badge">${events.length} คน</span>
            </div>
            <div class="cal-detail-list">`;

        events.forEach(e => {
            html += `
                <div class="cal-detail-item type-${e.type}">
                    <span class="material-icons-round">${typeIcons[e.type]}</span>
                    <div class="cal-detail-info">
                        <span class="cal-detail-name">${e.teacher.name}</span>
                        <span class="cal-detail-type">${typeLabels[e.type]}</span>
                    </div>
                </div>`;
        });

        html += '</div>';
        detail.innerHTML = html;
    }

    function extractDates(notes, maxDay) {
        if (!notes) return [];
        const dates = [];
        // Match: 10, 1-2, 10-12
        const regex = /(\d{1,2})\s*(?:-\s*(\d{1,2}))?/g;
        let match;
        while ((match = regex.exec(notes)) !== null) {
            const start = parseInt(match[1]);
            const end = match[2] ? parseInt(match[2]) : start;
            if (start >= 1 && start <= maxDay && end >= start && end <= maxDay) {
                for (let d = start; d <= end; d++) {
                    if (!dates.includes(d)) dates.push(d);
                }
            }
        }
        return dates;
    }

    return { init, render };
})();
