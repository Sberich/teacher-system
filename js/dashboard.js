/* ============================================
   Dashboard â€” Summary Statistics & Charts
   (Only à¸¥à¸²à¸à¸´à¸ˆ and à¸¥à¸²à¸›à¹ˆà¸§à¸¢ â€” no à¸­à¸·à¹ˆà¸™à¹†)
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
                    <div class="stat-label">à¸ˆà¸³à¸™à¸§à¸™à¸„à¸£à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</div>
                </div>
            </div>
            <div class="stat-card card-all">
                <div class="stat-icon"><span class="material-icons-round">summarize</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesAll}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸„à¸£à¸±à¹‰à¸‡</small> / ${totalAll}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸§à¸±à¸™</small></div>
                    <div class="stat-label">à¸£à¸§à¸¡à¸—à¸¸à¸à¸›à¸£à¸°à¹€à¸ à¸—</div>
                </div>
            </div>
            <div class="stat-card card-sick">
                <div class="stat-icon"><span class="material-icons-round">local_hospital</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesSick}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸„à¸£à¸±à¹‰à¸‡</small> / ${totalSick}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸§à¸±à¸™</small></div>
                    <div class="stat-label">à¸¥à¸²à¸›à¹ˆà¸§à¸¢</div>
                </div>
            </div>
            <div class="stat-card card-personal">
                <div class="stat-icon"><span class="material-icons-round">event_note</span></div>
                <div class="stat-info">
                    <div class="stat-value">${timesPersonal}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸„à¸£à¸±à¹‰à¸‡</small> / ${totalPersonal}<small style="font-size:0.55em;color:var(--text-secondary);"> à¸§à¸±à¸™</small></div>
                    <div class="stat-label">à¸¥à¸²à¸à¸´à¸ˆà¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§</div>
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
                        label: 'à¸¥à¸²à¸›à¹ˆà¸§à¸¢ (à¸§à¸±à¸™)',
                        data: sickData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'à¸¥à¸²à¸à¸´à¸ˆ (à¸§à¸±à¸™)',
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
        const sections = [...new Set(teachers.map(t => t.section || 'à¸—à¸±à¹ˆà¸§à¹„à¸›'))].sort();
        
        const personalData = [];
        const sickData = [];

        sections.forEach(sec => {
            const secTeacherIds = teachers.filter(t => (t.section || 'à¸—à¸±à¹ˆà¸§à¹„à¸›') === sec).map(t => t.id);
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
                        label: 'à¸¥à¸²à¸›à¹ˆà¸§à¸¢ (à¸§à¸±à¸™)',
                        data: sickData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'à¸¥à¸²à¸à¸´à¸ˆ (à¸§à¸±à¸™)',
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
                        grace: '15%',
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
                labels: ['à¸¥à¸²à¸›à¹ˆà¸§à¸¢', 'à¸¥à¸²à¸à¸´à¸ˆ'],
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
                            label: (ctx) => `${ctx.label}: ${ctx.parsed} à¸§à¸±à¸™`
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
            if (t.gender === 'à¸Šà¸²à¸¢') maleCount++;
            else if (t.gender === 'à¸«à¸à¸´à¸‡') femaleCount++;
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

        if (maleCount > 0) { labels.push('à¸Šà¸²à¸¢'); data.push(maleCount); bgColors.push('rgba(59, 130, 246, 0.85)'); borderColors.push('rgba(59, 130, 246, 1)'); }
        if (femaleCount > 0) { labels.push('à¸«à¸à¸´à¸‡'); data.push(femaleCount); bgColors.push('rgba(236, 72, 153, 0.85)'); borderColors.push('rgba(236, 72, 153, 1)'); }
        if (unspecCount > 0) { labels.push('à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸'); data.push(unspecCount); bgColors.push('rgba(156, 163, 175, 0.85)'); borderColors.push('rgba(156, 163, 175, 1)'); }

        genderChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: hasData ? labels : ['à¹„à¸¡à¹ˆà¸¡à¸µà¸‚à¹‰à¸­à¸¡à¸¹à¸¥'],
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
                            label: (ctx) => `${ctx.label}: ${ctx.parsed} à¸„à¸™`
                        }
                    },
                    datalabels: {
                        display: hasData,
                        formatter: (val) => val + ' à¸„à¸™'
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
        const titleOrder = ['à¸¥à¸¹à¸à¸ˆà¹‰à¸²à¸‡à¸¯', 'à¸„à¸£à¸¹à¸­à¸±à¸•à¸£à¸²à¸ˆà¹‰à¸²à¸‡', 'à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸¯', 'à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸Šà¹ˆà¸§à¸¢', 'à¸„à¸¨.1', 'à¸„à¸¨.2', 'à¸„à¸¨.3', 'à¸„à¸¨.4'];
        const titleCounts = { 'à¸¥à¸¹à¸à¸ˆà¹‰à¸²à¸‡à¸¯': 0, 'à¸„à¸£à¸¹à¸­à¸±à¸•à¸£à¸²à¸ˆà¹‰à¸²à¸‡': 0, 'à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸¯': 0, 'à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸Šà¹ˆà¸§à¸¢': 0, 'à¸„à¸¨.1': 0, 'à¸„à¸¨.2': 0, 'à¸„à¸¨.3': 0, 'à¸„à¸¨.4': 0, 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸': 0 };

        teachers.forEach(t => {
            const title = t.title || '';
            if (title === '') titleCounts['à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸']++;
            else if (titleCounts[title] !== undefined) titleCounts[title]++;
            else titleCounts['à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸']++;
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
        if (titleCounts['à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸'] > 0) {
            labels.push('à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸');
            data.push(titleCounts['à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸']);
        }

        titleChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'à¸ˆà¸³à¸™à¸§à¸™à¸šà¸¸à¸„à¸¥à¸²à¸à¸£ (à¸„à¸™)',
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
                            label: (ctx) => ` ${ctx.parsed.y} à¸„à¸™`
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
                        grace: '15%',
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
        const posOrder = ['à¸œà¸¹à¹‰à¸šà¸£à¸´à¸«à¸²à¸£', 'à¸„à¸£à¸¹', 'à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸Šà¹ˆà¸§à¸¢', 'à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸¯', 'à¸„à¸£à¸¹à¸­à¸±à¸•à¸£à¸²à¸ˆà¹‰à¸²à¸‡', 'à¸¥à¸¹à¸à¸ˆà¹‰à¸²à¸‡à¸¯'];
        const counts = {};
        posOrder.forEach(p => { counts[p] = { 'à¸Šà¸²à¸¢': 0, 'à¸«à¸à¸´à¸‡': 0, 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸': 0 }; });

        teachers.forEach(t => {
            const section = t.section || '';
            const title = t.title || '';
            const gender = t.gender || 'à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸';
            
            let pos = '';
            if (section.includes('à¸œà¸¹à¹‰à¸šà¸£à¸´à¸«à¸²à¸£') || section.includes('à¸œà¸¹à¹‰à¸­à¸³à¸™à¸§à¸¢à¸à¸²à¸£')) {
                pos = 'à¸œà¸¹à¹‰à¸šà¸£à¸´à¸«à¸²à¸£';
            } else if (title.includes('à¸„à¸¨')) {
                pos = 'à¸„à¸£à¸¹';
            } else if (title === 'à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸Šà¹ˆà¸§à¸¢') {
                pos = 'à¸„à¸£à¸¹à¸œà¸¹à¹‰à¸Šà¹ˆà¸§à¸¢';
            } else if (title === 'à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸¯') {
                pos = 'à¸žà¸™à¸±à¸à¸‡à¸²à¸™à¸¯';
            } else if (title === 'à¸„à¸£à¸¹à¸­à¸±à¸•à¸£à¸²à¸ˆà¹‰à¸²à¸‡') {
                pos = 'à¸„à¸£à¸¹à¸­à¸±à¸•à¸£à¸²à¸ˆà¹‰à¸²à¸‡';
            } else if (title === 'à¸¥à¸¹à¸à¸ˆà¹‰à¸²à¸‡à¸¯') {
                pos = 'à¸¥à¸¹à¸à¸ˆà¹‰à¸²à¸‡à¸¯';
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
        const maleData = posOrder.map(p => counts[p]['à¸Šà¸²à¸¢']);
        const femaleData = posOrder.map(p => counts[p]['à¸«à¸à¸´à¸‡']);

        positionChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'à¸Šà¸²à¸¢',
                        data: maleData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 30
                    },
                    {
                        label: 'à¸«à¸à¸´à¸‡',
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
                            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} à¸„à¸™`
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
                        grace: '15%',
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

