/* ============================================
   TeacherManager — Teacher List CRUD + Import
   ============================================ */
const TeacherManager = (() => {
    let editingId = null;

    function init() {
        document.getElementById('btn-add-teacher').addEventListener('click', () => openModal());
        document.getElementById('btn-save-teacher').addEventListener('click', saveTeacher);
        document.getElementById('btn-import-teachers').addEventListener('click', () => openImportModal());
        document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

        // File input for import
        document.getElementById('import-teachers-file').addEventListener('change', handleImportFile);

        // Text area live preview
        document.getElementById('import-teachers-text').addEventListener('input', updateImportPreview);

        // Sort option
        const sortSelect = document.getElementById('teacher-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', render);
        }
    }

    function render() {
        const container = document.getElementById('teacher-list');
        let teachers = DataManager.getTeachers();

        const sortSelect = document.getElementById('teacher-sort');
        const sortBy = sortSelect ? sortSelect.value : 'order';

        if (sortBy === 'title') {
            const titleWeight = { 'คศ.4': 7, 'คศ.3': 6, 'คศ.2': 5, 'คศ.1': 4, 'ครูผู้ช่วย': 3, 'พนักงานฯ': 2, 'ครูอัตราจ้าง': 1, 'ลูกจ้างฯ': 0 };
            teachers.sort((a, b) => {
                const wA = titleWeight[a.title] !== undefined ? titleWeight[a.title] : -1;
                const wB = titleWeight[b.title] !== undefined ? titleWeight[b.title] : -1;
                if (wA !== wB) return wB - wA; // Descending
                return a.order - b.order; // Fallback to order
            });
        } else if (sortBy === 'section') {
            teachers.sort((a, b) => {
                const sA = a.section || '';
                const sB = b.section || '';
                if (sA < sB) return -1;
                if (sA > sB) return 1;
                return a.order - b.order; // Fallback to order
            });
        } else {
            // default is 'order'
            teachers.sort((a, b) => a.order - b.order);
        }

        if (teachers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-round">person_add</span>
                    <p>ยังไม่มีรายชื่อครู</p>
                    <p class="admin-only" style="font-size:0.85rem;color:var(--text-muted);margin-top:8px;">กดปุ่ม "เพิ่มครู" หรือ "นำเข้ารายชื่อ" เพื่อเริ่มต้น</p>
                </div>`;
            return;
        }

        let html = `
            <table class="teacher-table">
                <thead>
                    <tr>
                        <th style="width:50px;text-align:center;">ลำดับ</th>
                        <th>ชื่อ-นามสกุล</th>
                        <th>กลุ่ม/หมวด</th>
                        <th style="width:70px;text-align:center;">เพศ</th>
                        <th>วิทยฐานะ</th>
                        <th class="admin-only" style="width:90px;text-align:center;">จัดการ</th>
                    </tr>
                </thead>
                <tbody>`;

        teachers.forEach(t => {
            html += `
                <tr data-id="${t.id}">
                    <td class="order-cell">${t.order}</td>
                    <td class="name-cell">
                        ${t.name}
                    </td>
                    <td>
                        <span class="section-badge" style="margin-left:0;">${escapeHtml(t.section)}</span>
                    </td>
                    <td style="text-align:center;">${escapeHtml(t.gender || '-')}</td>
                    <td>${escapeHtml(t.title || '-')}</td>
                    <td class="actions-cell admin-only">
                        <button class="btn-icon-sm btn-edit" title="แก้ไข" data-id="${t.id}">
                            <span class="material-icons-round">edit</span>
                        </button>
                        <button class="btn-icon-sm btn-delete" title="ลบ" data-id="${t.id}">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </td>
                </tr>`;
        });

        html += '</tbody></table>';
        html += `<div class="teacher-count">ทั้งหมด ${teachers.length} คน</div>`;

        container.innerHTML = html;

        // Event handlers
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const teacher = DataManager.getTeachers().find(t => t.id === btn.dataset.id);
                if (teacher) openModal(teacher);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const teacher = DataManager.getTeachers().find(t => t.id === btn.dataset.id);
                if (teacher) {
                    App.confirm(
                        `ต้องการลบ "${teacher.name}" หรือไม่?\nข้อมูลการลาของครูคนนี้จะถูกลบด้วย`,
                        () => {
                            DataManager.deleteTeacher(teacher.id);
                            App.showToast(`ลบ "${teacher.name}" เรียบร้อย`, 'info');
                            render();
                            LeaveTable.render();
                        }
                    );
                }
            });
        });
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function populateSectionSuggestions() {
        const datalist = document.getElementById('section-suggestions');
        if (!datalist) return;
        const sections = DataManager.getSections();
        let html = '';
        sections.forEach(s => {
            html += `<option value="${escapeHtml(s)}"></option>`;
        });
        datalist.innerHTML = html;
    }

    // --- Add/Edit Modal ---
    function openModal(teacher = null) {
        if (!App.isAdmin()) return;
        
        editingId = teacher ? teacher.id : null;
        document.getElementById('teacher-modal-title').textContent = teacher ? 'แก้ไขข้อมูลครู' : 'เพิ่มครูใหม่';
        document.getElementById('teacher-name').value = teacher ? teacher.name : '';
        document.getElementById('teacher-section').value = teacher ? (teacher.section || '') : '';
        document.getElementById('teacher-gender').value = teacher ? (teacher.gender || '') : '';
        document.getElementById('teacher-title').value = teacher ? (teacher.title || '') : '';
        document.getElementById('teacher-order').value = teacher ? teacher.order : DataManager.getNextOrder();
        
        populateSectionSuggestions();
        
        App.showModal('teacher-modal');
        setTimeout(() => document.getElementById('teacher-name').focus(), 200);
    }

    function saveTeacher() {
        const name = document.getElementById('teacher-name').value.trim();
        const section = document.getElementById('teacher-section').value.trim();
        const gender = document.getElementById('teacher-gender').value;
        const title = document.getElementById('teacher-title').value;
        const order = parseInt(document.getElementById('teacher-order').value) || 1;

        if (!name) {
            App.showToast('กรุณากรอกชื่อ-นามสกุล', 'warning');
            return;
        }
        if (order < 1) {
            App.showToast('ลำดับต้องมากกว่า 0', 'warning');
            return;
        }

        if (editingId) {
            DataManager.updateTeacher(editingId, name, section, order, gender, title);
            App.showToast('แก้ไขข้อมูลครูเรียบร้อย');
        } else {
            DataManager.addTeacher(name, section, order, gender, title);
            App.showToast(`เพิ่ม "${name}" เรียบร้อย`);
        }

        App.hideModal('teacher-modal');
        render();
        LeaveTable.render(); // update table filter too
        editingId = null;
    }

    // --- Import Modal ---
    function openImportModal() {
        if (!App.isAdmin()) return;
        document.getElementById('import-teachers-file').value = '';
        document.getElementById('import-teachers-text').value = '';
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-preview-list').innerHTML = '';
        App.showModal('import-modal');
    }

    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('import-teachers-text').value = ev.target.result;
            updateImportPreview();
        };
        reader.readAsText(file);
    }

    function updateImportPreview() {
        const text = document.getElementById('import-teachers-text').value;
        const items = parseNames(text);
        const previewDiv = document.getElementById('import-preview');
        const listDiv = document.getElementById('import-preview-list');

        if (items.length === 0) {
            previewDiv.style.display = 'none';
            return;
        }

        previewDiv.style.display = 'block';
        let html = `<div style="margin-bottom:8px;font-weight:600;color:var(--primary);">พบ ${items.length} รายชื่อ:</div>`;
        html += '<div class="import-name-list">';
        items.forEach((item, i) => {
            html += `<div class="import-name-item">${i + 1}. ${escapeHtml(item.name)} <span class="section-badge">${escapeHtml(item.section)}</span></div>`;
        });
        html += '</div>';
        listDiv.innerHTML = html;
    }

    function parseNames(text) {
        if (!text) return [];
        const lines = text.split(/[\n\r]+/).map(s => s.trim()).filter(s => s.length > 0 && !/^\d+$/.test(s));
        
        return lines.map(line => {
            // Check if there is a comma
            if (line.includes(',')) {
                const parts = line.split(',');
                const name = parts[0].trim();
                const section = parts.slice(1).join(',').trim();
                return { name, section: section || 'ทั่วไป' };
            }
            // Tab separated?
            if (line.includes('\t')) {
                const parts = line.split('\t');
                const name = parts[0].trim();
                const section = parts.slice(1).join('\t').trim();
                return { name, section: section || 'ทั่วไป' };
            }
            return { name: line, section: 'ทั่วไป' };
        }).filter(item => item.name.length > 0);
    }

    function confirmImport() {
        const text = document.getElementById('import-teachers-text').value;
        const items = parseNames(text);

        if (items.length === 0) {
            App.showToast('ไม่พบรายชื่อที่จะนำเข้า', 'warning');
            return;
        }

        App.confirm(
            `ต้องการนำเข้ารายชื่อ ${items.length} คน หรือไม่?\nรายชื่อจะถูกเพิ่มต่อจากลำดับปัจจุบัน`,
            () => {
                const added = DataManager.addTeachersBulk(items);
                App.hideModal('import-modal');
                App.showToast(`นำเข้า ${added.length} รายชื่อเรียบร้อย`);
                render();
                LeaveTable.render();
            }
        );
    }

    return { init, render };
})();
