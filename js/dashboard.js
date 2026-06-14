/* ============================================
   Dashboard — Summary Statistics & Charts
   (Only ลากิจ and ลาป่วย — no อื่นๆ)
   ============================================ */
const Dashboard = (() => {
    let monthlyChart = null;
    let sectionChart = null;
    let pieChart = null;
    let genderChart = null;
    let titleChart = null;
    let positionChart = null;

    function init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            Chart.defaults.set('plugins.datalabels', {
                color: '#ffffff',
                font: { family: "'Noto Sans Thai', sans-serif", weight: 'bold', size: 12 },
                anchor: 'start',
                align: 'top',
                offset: 4,
                formatter: function(value) { return value > 0 ? value : ''; }
            });
        }
    }

    function render() {
        renderCards();
        renderMonthlyChart();
        renderSectionChart();
        renderPieChart();
        renderGenderChart();
        renderTitleChart();
        renderPositionChart();
    }

    function renderCards() {
        const teachers = DataManager.getTeachers();
        const records = DataManager.getLeaveRecords();
        const months = DataManager.getPeriodMonths();

        const periodRecords = records.filter(r =>
            months.some(m => m.month === r.month && m.year === r.year)
        );

        const totalPersonal = periodRecords.filter(r => r.type === 'personal').reduce((s, r) => s + r.days, 0);
        const totalSick = periodRecords.filter(r => r.type === 'sick').reduce((s, r) => s + r.days, 0);
        const totalAll = totalPersonal + totalSick;

        const timesPersonal = periodRecords.filter(r => r.type === 'personal').reduce((s, r) => s + r.times, 0);
        const timesSick = periodRecords.filter(r => r.type === 'sick').reduce((s, r) => s + r.times, 0);
        const timesAll = timesPersonal + timesSick;

        const container = document.getElementById('dashboard-cards');
        container.innerHTML = `
            <div class="stat-card card-total">
                <div class="stat-icon"><span class="material-icons-round">people</span></div>
                <div class="stat-info">
                    <div class="stat-value">${teachers.length}</div>
                    <div class="stat-label">จำนวนครูทั้งหมด</div>
                </div>
            </div>
            <div class="stat-card card-all">
                <div class="stat-icon"><span class="material-icons-round">summarize</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesAll}<small style="font-size:0.55em;color:var(--text-secondary);"> ครั้ง</small> / ${totalAll}<small style="font-size:0.55em;color:var(--text-secondary);"> วัน</small></div>
                    <div class="stat-label">รวมทุกประเภท</div>
                </div>
            </div>
            <div class="stat-card card-sick">
                <div class="stat-icon"><span class="material-icons-round">local_hospital</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesSick}<small style="font-size:0.55em;color:var(--text-secondary);"> ครั้ง</small> / ${totalSick}<small style="font-size:0.55em;color:var(--text-secondary);"> วัน</small></div>
                    <div class="stat-label">ลาป่วย</div>
                </div>
            </div>
            <div class="stat-card card-personal">
                <div class="stat-icon"><span class="material-icons-round">event_note</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesPersonal}<small style="font-size:0.55em;color:var(--text-secondary);"> ครั้ง</small> / ${totalPersonal}<small style="font-size:0.55em;color:var(--text-secondary);"> วัน</small></div>
                    <div class="stat-label">ลากิจส่วนตัว</div>
                </div>
            </div>
        `;
    }

    function renderMonthlyChart() {
        const canvas = document.getElementById('chart-monthly');
        if (!canvas) return;

        const months = DataManager.getPeriodMonths();
        const records = DataManager.getLeaveRecords();

        const labels = months.map(m => `${DataManager.getThaiMonth(m.month)} ${m.year}`);

        const personalData = months.map(m =>
            records.filter(r => r.month === m.month && r.year === m.year && r.type === 'personal')
                .reduce((s, r) => s + r.days, 0)
        );
        const sickData = months.map(m =>
            records.filter(r => r.month === m.month && r.year === m.year && r.type === 'sick')
                .reduce((s, r) => s + r.days, 0)
        );

        if (monthlyChart) monthlyChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        monthlyChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'ลาป่วย (วัน)',
                        data: sickData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'ลากิจ (วัน)',
                        data: personalData,
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            font: { family: "'Noto Sans Thai', sans-serif", size: 13 },
                            padding: 16
                        }
                    },
                    tooltip: {
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" }
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        font: { family: "'Noto Sans Thai', sans-serif", size: 11, weight: 'bold' },
                        formatter: (val) => val > 0 ? val : ''
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: textColor, 
                            font: { family: "'Noto Sans Thai', sans-serif" },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { 
                            display: true,
                            drawOnChartArea: false,
                            drawTicks: true,
                            color: gridColor
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    function renderSectionChart() {
        const canvas = document.getElementById('chart-section');
        if (!canvas) return;

        const teachers = DataManager.getTeachers();
        const records = DataManager.getLeaveRecords();
        const months = DataManager.getPeriodMonths();

        const periodRecords = records.filter(r =>
            months.some(m => m.month === r.month && m.year === r.year)
        );

        // Group teachers by section
        const sections = [...new Set(teachers.map(t => t.section || 'ทั่วไป'))].sort();
        
        const personalData = [];
        const sickData = [];

        sections.forEach(sec => {
            const secTeacherIds = teachers.filter(t => (t.section || 'ทั่วไป') === sec).map(t => t.id);
            const secRecords = periodRecords.filter(r => secTeacherIds.includes(r.teacherId));
            
            personalData.push(secRecords.filter(r => r.type === 'personal').reduce((s, r) => s + r.days, 0));
            sickData.push(secRecords.filter(r => r.type === 'sick').reduce((s, r) => s + r.days, 0));
        });

        if (sectionChart) sectionChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        sectionChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sections,
                datasets: [
                    {
                        label: 'ลาป่วย (วัน)',
                        data: sickData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'ลากิจ (วัน)',
                        data: personalData,
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: 'rgba(245, 158, 11, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor,
                            font: { family: "'Noto Sans Thai', sans-serif", size: 13 },
                            padding: 16
                        }
                    },
                    tooltip: {
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" }
                    },
                    datalabels: {
                        display: true,
                        color: 'white',
                        font: { family: "'Noto Sans Thai', sans-serif", size: 11, weight: 'bold' },
                        formatter: (val) => val > 0 ? val : ''
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: textColor, 
                            font: { family: "'Noto Sans Thai', sans-serif" },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { 
                            display: true,
                            drawOnChartArea: false,
                            drawTicks: true,
                            color: gridColor
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    function renderPieChart() {
        const canvas = document.getElementById('chart-pie');
        if (!canvas) return;

        const records = DataManager.getLeaveRecords();
        const months = DataManager.getPeriodMonths();

        const periodRecords = records.filter(r =>
            months.some(m => m.month === r.month && m.year === r.year)
        );

        const totalPersonal = periodRecords.filter(r => r.type === 'personal').reduce((s, r) => s + r.days, 0);
        const totalSick = periodRecords.filter(r => r.type === 'sick').reduce((s, r) => s + r.days, 0);

        if (pieChart) pieChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const hasData = totalPersonal + totalSick > 0;

        pieChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['ลาป่วย', 'ลากิจ'],
                datasets: [{
                    data: hasData ? [totalSick, totalPersonal] : [1, 1],
                    backgroundColor: hasData
                        ? ['rgba(239, 68, 68, 0.85)', 'rgba(245, 158, 11, 0.85)']
                        : ['rgba(200,200,200,0.3)', 'rgba(200,200,200,0.3)'],
                    borderColor: hasData
                        ? ['rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)']
                        : ['rgba(200,200,200,0.5)', 'rgba(200,200,200,0.5)'],
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: "'Noto Sans Thai', sans-serif", size: 13 },
                            padding: 20
                        }
                    },
                    tooltip: {
                        enabled: hasData,
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" },
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${ctx.parsed} วัน`
                        }
                    },
                    datalabels: {
                        display: hasData
                    }
                }
            }
        });
    }

    function renderGenderChart() {
        const canvas = document.getElementById('chart-gender');
        if (!canvas) return;

        const teachers = DataManager.getTeachers();
        let maleCount = 0;
        let femaleCount = 0;
        let unspecCount = 0;

        teachers.forEach(t => {
            if (t.gender === 'ชาย') maleCount++;
            else if (t.gender === 'หญิง') femaleCount++;
            else unspecCount++;
        });

        if (genderChart) genderChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const hasData = teachers.length > 0;

        const labels = [];
        const data = [];
        const bgColors = [];
        const borderColors = [];

        if (maleCount > 0) { labels.push('ชาย'); data.push(maleCount); bgColors.push('rgba(59, 130, 246, 0.85)'); borderColors.push('rgba(59, 130, 246, 1)'); }
        if (femaleCount > 0) { labels.push('หญิง'); data.push(femaleCount); bgColors.push('rgba(236, 72, 153, 0.85)'); borderColors.push('rgba(236, 72, 153, 1)'); }
        if (unspecCount > 0) { labels.push('ไม่ระบุ'); data.push(unspecCount); bgColors.push('rgba(156, 163, 175, 0.85)'); borderColors.push('rgba(156, 163, 175, 1)'); }

        genderChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: hasData ? labels : ['ไม่มีข้อมูล'],
                datasets: [{
                    data: hasData ? data : [1],
                    backgroundColor: hasData ? bgColors : ['rgba(200,200,200,0.3)'],
                    borderColor: hasData ? borderColors : ['rgba(200,200,200,0.5)'],
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: "'Noto Sans Thai', sans-serif", size: 13 },
                            padding: 20
                        }
                    },
                    tooltip: {
                        enabled: hasData,
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" },
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${ctx.parsed} คน`
                        }
                    },
                    datalabels: {
                        display: hasData,
                        formatter: (val) => val + ' คน'
                    }
                }
            }
        });
    }

    function renderTitleChart() {
        const canvas = document.getElementById('chart-title');
        if (!canvas) return;

        const teachers = DataManager.getTeachers();
        
        // Define title order
        const titleOrder = ['ลูกจ้างฯ', 'ครูอัตราจ้าง', 'พนักงานฯ', 'ครูผู้ช่วย', 'คศ.1', 'คศ.2', 'คศ.3', 'คศ.4'];
        const titleCounts = { 'ลูกจ้างฯ': 0, 'ครูอัตราจ้าง': 0, 'พนักงานฯ': 0, 'ครูผู้ช่วย': 0, 'คศ.1': 0, 'คศ.2': 0, 'คศ.3': 0, 'คศ.4': 0, 'ไม่ระบุ': 0 };

        teachers.forEach(t => {
            const title = t.title || '';
            if (title === '') titleCounts['ไม่ระบุ']++;
            else if (titleCounts[title] !== undefined) titleCounts[title]++;
            else titleCounts['ไม่ระบุ']++;
        });

        if (titleChart) titleChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        const labels = [];
        const data = [];
        titleOrder.forEach(t => {
            labels.push(t);
            data.push(titleCounts[t]);
        });
        if (titleCounts['ไม่ระบุ'] > 0) {
            labels.push('ไม่ระบุ');
            data.push(titleCounts['ไม่ระบุ']);
        }

        titleChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'จำนวนบุคลากร (คน)',
                        data: data,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" },
                        callbacks: {
                            label: (ctx) => ` ${ctx.parsed.y} คน`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function renderPositionChart() {
        const canvas = document.getElementById('chart-position');
        if (!canvas) return;

        const teachers = DataManager.getTeachers();

        // Data structure
        const posOrder = ['ผู้บริหาร', 'ครู', 'ครูผู้ช่วย', 'พนักงานฯ', 'ครูอัตราจ้าง', 'ลูกจ้างฯ'];
        const counts = {};
        posOrder.forEach(p => { counts[p] = { 'ชาย': 0, 'หญิง': 0, 'ไม่ระบุ': 0 }; });

        teachers.forEach(t => {
            const section = t.section || '';
            const title = t.title || '';
            const gender = t.gender || 'ไม่ระบุ';
            
            let pos = '';
            if (section.includes('ผู้บริหาร') || section.includes('ผู้อำนวยการ')) {
                pos = 'ผู้บริหาร';
            } else if (title.includes('คศ')) {
                pos = 'ครู';
            } else if (title === 'ครูผู้ช่วย') {
                pos = 'ครูผู้ช่วย';
            } else if (title === 'พนักงานฯ') {
                pos = 'พนักงานฯ';
            } else if (title === 'ครูอัตราจ้าง') {
                pos = 'ครูอัตราจ้าง';
            } else if (title === 'ลูกจ้างฯ') {
                pos = 'ลูกจ้างฯ';
            }

            if (pos && counts[pos] && counts[pos][gender] !== undefined) {
                counts[pos][gender]++;
            }
        });

        if (positionChart) positionChart.destroy();

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#334155';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        const labels = posOrder;
        const maleData = posOrder.map(p => counts[p]['ชาย']);
        const femaleData = posOrder.map(p => counts[p]['หญิง']);

        positionChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ชาย',
                        data: maleData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 30
                    },
                    {
                        label: 'หญิง',
                        data: femaleData,
                        backgroundColor: 'rgba(236, 72, 153, 0.8)',
                        borderColor: 'rgba(236, 72, 153, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 30
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { family: "'Noto Sans Thai', sans-serif" } }
                    },
                    tooltip: {
                        titleFont: { family: "'Noto Sans Thai', sans-serif" },
                        bodyFont: { family: "'Noto Sans Thai', sans-serif" },
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} คน`
                        }
                    },
                    datalabels: {
                        display: true,
                        color: textColor,
                        formatter: (val) => val > 0 ? val : '',
                        anchor: 'end',
                        align: 'top',
                        offset: 0
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1, font: { family: "'Noto Sans Thai', sans-serif" } },
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    return { init, render };
})();
