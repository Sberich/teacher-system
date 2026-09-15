class CrystalDropdown {
    constructor(selectElement) {
        this.select = selectElement;
        this.wrapper = null;
        this.display = null;
        this.list = null;
        this.isOpen = false;
        this.init();
    }

    init() {
        this.select.style.display = 'none';
        
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'crystal-dropdown-wrapper';
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        this.wrapper.appendChild(this.select);

        this.display = document.createElement('div');
        this.display.className = 'crystal-dropdown-display';
        this.display.innerHTML = '<span class="crystal-text"></span><span class="material-icons-round crystal-arrow">expand_more</span>';
        this.wrapper.appendChild(this.display);

        this.list = document.createElement('div');
        this.list.className = 'crystal-dropdown-list';
        this.wrapper.appendChild(this.list);

        this.renderOptions();
        this.updateDisplay();

        this.display.addEventListener('click', (e) => {
            if (this.select.disabled) return;
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', () => {
            if (this.isOpen) this.close();
        });

        this.select.addEventListener('change', () => this.updateDisplay());
        
        const observer = new MutationObserver(() => {
            this.renderOptions();
            this.updateDisplay();
            if (this.select.disabled) {
                this.wrapper.classList.add('disabled');
            } else {
                this.wrapper.classList.remove('disabled');
            }
        });
        observer.observe(this.select, { attributes: true, childList: true, subtree: true });
    }

    renderOptions() {
        this.list.innerHTML = '';
        Array.from(this.select.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                const groupTitle = document.createElement('div');
                groupTitle.className = 'crystal-optgroup';
                groupTitle.innerText = child.label;
                this.list.appendChild(groupTitle);
                Array.from(child.children).forEach(option => this.createOptionElement(option));
            } else if (child.tagName === 'OPTION') {
                this.createOptionElement(child);
            }
        });
    }

    createOptionElement(option) {
        if (option.value === '') return;
        const item = document.createElement('div');
        item.className = 'crystal-option';
        item.innerText = option.innerText;
        if (option.selected) item.classList.add('selected');
        
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.select.value = option.value;
            this.select.dispatchEvent(new Event('change', { bubbles: true }));
            this.close();
        });
        this.list.appendChild(item);
    }

    updateDisplay() {
        const selected = this.select.options[this.select.selectedIndex];
        const textSpan = this.display.querySelector('.crystal-text');
        textSpan.innerText = selected ? selected.innerText : 'กรุณาเลือก';
        if (!selected || selected.value === '') {
            textSpan.classList.add('placeholder');
        } else {
            textSpan.classList.remove('placeholder');
        }

        const items = this.list.querySelectorAll('.crystal-option');
        items.forEach(item => item.classList.remove('selected'));
        if (selected && selected.value !== '') {
            const selectedItem = Array.from(items).find(i => i.innerText === selected.innerText);
            if (selectedItem) selectedItem.classList.add('selected');
        }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        document.querySelectorAll('.crystal-dropdown-wrapper.open').forEach(w => {
            w.classList.remove('open');
            w.querySelector('.crystal-dropdown-list').style.display = 'none';
        });
        this.isOpen = true;
        this.wrapper.classList.add('open');
        this.list.style.display = 'block';
    }

    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
        this.list.style.display = 'none';
    }
}

window.initCrystalDropdowns = function() {
    const selects = document.querySelectorAll('#lr-teacher, #lr-type');
    selects.forEach(select => {
        if (!select.dataset.crystalized) {
            new CrystalDropdown(select);
            select.dataset.crystalized = 'true';
        }
    });
};
