// مدیریت داده‌ها
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];
let categories = ['بدون دسته‌بندی', 'خانواده', 'دوستان', 'همکاران'];
let currentPage = 1;
const contactsPerPage = 50;
let selectedContacts = new Set();
let editingIndex = null;
let duplicateNameIndices = [];
let duplicatePhoneIndices = [];
let pendingContact = null;
let pendingNewContacts = [];

// نمایش پیام موقت
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// به‌روزرسانی گزینه‌های دسته‌بندی
function updateCategoryOptions() {
    const categorySelect = document.getElementById('categorySelect');
    const categoryFilter = document.getElementById('categoryFilter');
    const deleteCategorySelect = document.getElementById('deleteCategorySelect');
    const editCategorySelect = document.getElementById('editCategorySelect');
    categorySelect.innerHTML = '<option value="">انتخاب دسته‌بندی</option>';
    categoryFilter.innerHTML = '<option value="">همه دسته‌بندی‌ها</option>';
    deleteCategorySelect.innerHTML = '<option value="">انتخاب دسته‌بندی برای حذف</option>';
    editCategorySelect.innerHTML = '<option value="">انتخاب دسته‌بندی</option>';
    categories.forEach(category => {
        categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
        categoryFilter.innerHTML += `<option value="${category}">${category}</option>`;
        deleteCategorySelect.innerHTML += `<option value="${category}">${category}</option>`;
        editCategorySelect.innerHTML += `<option value="${category}">${category}</option>`;
    });
}

// رندر لیست مخاطبین
function renderContacts(filter = '', category = '') {
    const contactList = document.getElementById('contactList');
    contactList.innerHTML = '';
    const filteredContacts = contacts.filter(contact => 
        contact.name.includes(filter) && (category === '' || contact.category === category)
    );

    const start = (currentPage - 1) * contactsPerPage;
    const end = start + contactsPerPage;
    const paginatedContacts = filteredContacts.slice(start, end);

    paginatedContacts.forEach((contact, index) => {
        const globalIndex = start + index;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-3"><input type="checkbox" class="selectContact" data-index="${globalIndex}"></td>
            <td class="p-3">${contact.name}</td>
            <td class="p-3">${contact.phone}</td>
            <td class="p-3">${contact.email}</td>
            <td class="p-3">${contact.category}</td>
            <td class="p-3 flex justify-end gap-4">
                <button onclick="editContact(${globalIndex})" class="text-green-600 hover:underline">ویرایش</button>
                <button onclick="deleteContact(${globalIndex})" class="text-red-600 hover:underline">حذف</button>
                <button onclick="copyContact(${globalIndex})" class="text-blue-600 hover:underline">کپی</button>
            </td>
        `;
        contactList.appendChild(row);
    });

    // به‌روزرسانی صفحه‌بندی
    const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);
    const pagination = document.getElementById('pagination');
    pagination.classList.toggle('hidden', filteredContacts.length <= contactsPerPage);
    document.getElementById('pageInfo').textContent = `صفحه ${currentPage} از ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;

    // به‌روزرسانی چک‌باکس‌ها
    const checkboxes = document.querySelectorAll('.selectContact');
    checkboxes.forEach(checkbox => {
        const index = parseInt(checkbox.dataset.index);
        checkbox.checked = selectedContacts.has(index);
    });
}

// بررسی مخاطبین تکراری (نام یا شماره تلفن)
function findDuplicates(newContacts = []) {
    const allContacts = [...contacts, ...newContacts];
    const nameMap = {};
    const phoneMap = {};
    allContacts.forEach((contact, index) => {
        if (!nameMap[contact.name]) {
            nameMap[contact.name] = [];
        }
        nameMap[contact.name].push(index);
        if (!phoneMap[contact.phone]) {
            phoneMap[contact.phone] = [];
        }
        phoneMap[contact.phone].push(index);
    });
    const duplicates = [
        ...Object.entries(nameMap).filter(([_, indices]) => indices.length > 1).map(([name, indices]) => ({ type: 'name', value: name, indices })),
        ...Object.entries(phoneMap).filter(([_, indices]) => indices.length > 1).map(([phone, indices]) => ({ type: 'phone', value: phone, indices }))
    ];
    return duplicates;
}

// نمایش مودال مخاطبین تکراری
function showDuplicatesModal(duplicates, isImport = false) {
    const duplicatesList = document.getElementById('duplicatesList');
    duplicatesList.innerHTML = duplicates.map(({ type, value, indices }) => `
        <div class="border p-2 mb-2 rounded">
            <p class="font-semibold">${type === 'name' ? 'نام' : 'شماره تلفن'}: ${value}</p>
            ${indices.map(index => {
                const contact = index < contacts.length ? contacts[index] : pendingNewContacts[index - contacts.length];
                const isNew = index >= contacts.length;
                return `
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="keepContact" data-index="${index}" data-type="${type}" data-value="${value}" ${isNew ? '' : 'checked'}>
                        <div>
                            <p><strong>نام:</strong> ${contact.name}</p>
                            <p><strong>تلفن:</strong> ${contact.phone}</p>
                            <p><strong>ایمیل:</strong> ${contact.email || '-'}</p>
                            <p><strong>دسته‌بندی:</strong> ${contact.category}</p>
                            ${isNew ? '<p class="text-blue-600">(مخاطب جدید)</p>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `).join('');

    document.getElementById('deleteDuplicatesModal').classList.remove('hidden');

    // مدیریت چک‌باکس‌ها برای حداقل یک تیک
    const checkboxes = document.querySelectorAll('.keepContact');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const type = checkbox.dataset.type;
            const value = checkbox.dataset.value;
            const groupCheckboxes = document.querySelectorAll(`.keepContact[data-type="${type}"][data-value="${value}"]`);
            const checkedCount = Array.from(groupCheckboxes).filter(cb => cb.checked).length;
            if (checkedCount === 0) {
                checkbox.checked = true;
                alert('حداقل یک مخاطب از هر گروه باید حفظ شود.');
            }
        });
    });
}

// نمایش مودال مخاطب تکراری (نام)
function showDuplicateNameModal(newContact) {
    const duplicates = contacts.filter(c => c.name === newContact.name);
    duplicateNameIndices = contacts.reduce((acc, c, i) => c.name === newContact.name ? [...acc, i] : acc, []);
    const duplicateList = document.getElementById('duplicateNameList');
    duplicateList.innerHTML = duplicates.map((contact) => `
        <div class="border p-2 mb-2 rounded">
            <p><strong>نام:</strong> ${contact.name}</p>
            <p><strong>تلفن:</strong> ${contact.phone}</p>
            <p><strong>ایمیل:</strong> ${contact.email || '-'}</p>
            <p><strong>دسته‌بندی:</strong> ${contact.category}</p>
        </div>
    `).join('');
    document.getElementById('duplicateNameModal').classList.remove('hidden');
    pendingContact = newContact;
}

// نمایش مودال مخاطب تکراری (تلفن)
function showDuplicatePhoneModal(newContact) {
    const duplicates = contacts.filter(c => c.phone === newContact.phone);
    duplicatePhoneIndices = contacts.reduce((acc, c, i) => c.phone === newContact.phone ? [...acc, i] : acc, []);
    const duplicateList = document.getElementById('duplicatePhoneList');
    duplicateList.innerHTML = duplicates.map((contact) => `
        <div class="border p-2 mb-2 rounded">
            <p><strong>نام:</strong> ${contact.name}</p>
            <p><strong>تلفن:</strong> ${contact.phone}</p>
            <p><strong>ایمیل:</strong> ${contact.email || '-'}</p>
            <p><strong>دسته‌بندی:</strong> ${contact.category}</p>
        </div>
    `).join('');
    document.getElementById('duplicatePhoneModal').classList.remove('hidden');
    pendingContact = newContact;
}

// افزودن مخاطب
document.getElementById('addContactBtn').addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const categorySelect = document.getElementById('categorySelect');
    const newCategoryInput = document.getElementById('newCategoryInput');
    let category = categorySelect.value;

    if (newCategoryInput.classList.contains('hidden') === false) {
        category = newCategoryInput.value.trim();
        if (category && !categories.includes(category)) {
            categories.push(category);
            localStorage.setItem('categories', JSON.stringify(categories));
            updateCategoryOptions();
        }
    }

    if (!category) {
        category = 'بدون دسته‌بندی';
    }

    if (name && phone) {
        const newContact = { name, phone, email, category };
        const isNameDuplicate = contacts.some(c => c.name === name);
        const isPhoneDuplicate = contacts.some(c => c.phone === phone);
        if (isNameDuplicate) {
            showDuplicateNameModal(newContact);
        } else if (isPhoneDuplicate) {
            showDuplicatePhoneModal(newContact);
        } else {
            contacts.unshift(newContact);
            localStorage.setItem('contacts', JSON.stringify(contacts));
            renderContacts();
            clearAddForm();
        }
    } else {
        alert('لطفاً نام و شماره تلفن را وارد کنید.');
    }
});

// پاک کردن فرم افزودن
function clearAddForm() {
    document.getElementById('nameInput').value = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('emailInput').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('newCategoryInput').value = '';
    document.getElementById('newCategoryInput').classList.add('hidden');
    document.getElementById('categorySelect').classList.remove('hidden');
    document.getElementById('toggleNewCategory').textContent = '+ جدید';
}

// مدیریت مودال مخاطب تکراری (نام)
document.getElementById('cancelDuplicateNameBtn').addEventListener('click', () => {
    document.getElementById('duplicateNameModal').classList.add('hidden');
    pendingContact = null;
    duplicateNameIndices = [];
});

document.getElementById('addDuplicateNameBtn').addEventListener('click', () => {
    const isPhoneDuplicate = contacts.some(c => c.phone === pendingContact.phone);
    if (isPhoneDuplicate) {
        document.getElementById('duplicateNameModal').classList.add('hidden');
        showDuplicatePhoneModal(pendingContact);
    } else {
        contacts.unshift(pendingContact);
        localStorage.setItem('contacts', JSON.stringify(contacts));
        renderContacts();
        document.getElementById('duplicateNameModal').classList.add('hidden');
        clearAddForm();
        pendingContact = null;
        duplicateNameIndices = [];
    }
});

document.getElementById('editDuplicateNameBtn').addEventListener('click', () => {
    if (duplicateNameIndices.length === 1) {
        document.getElementById('duplicateNameModal').classList.add('hidden');
        editContact(duplicateNameIndices[0]);
        clearAddForm();
        pendingContact = null;
        duplicateNameIndices = [];
    } else {
        alert('لطفاً ابتدا مخاطبین تکراری را مدیریت کنید.');
    }
});

// مدیریت مودال مخاطب تکراری (تلفن)
document.getElementById('cancelDuplicatePhoneBtn').addEventListener('click', () => {
    document.getElementById('duplicatePhoneModal').classList.add('hidden');
    pendingContact = null;
    duplicatePhoneIndices = [];
});

document.getElementById('addDuplicatePhoneBtn').addEventListener('click', () => {
    contacts.unshift(pendingContact);
    localStorage.setItem('contacts', JSON.stringify(contacts));
    renderContacts();
    document.getElementById('duplicatePhoneModal').classList.add('hidden');
    clearAddForm();
    pendingContact = null;
    duplicatePhoneIndices = [];
});

document.getElementById('editDuplicatePhoneBtn').addEventListener('click', () => {
    if (duplicatePhoneIndices.length === 1) {
        document.getElementById('duplicatePhoneModal').classList.add('hidden');
        editContact(duplicatePhoneIndices[0]);
        clearAddForm();
        pendingContact = null;
        duplicatePhoneIndices = [];
    } else {
        alert('لطفاً ابتدا مخاطبین تکراری را مدیریت کنید.');
    }
});

// حذف مخاطب
function deleteContact(index) {
    contacts.splice(index, 1);
    selectedContacts.delete(index);
    localStorage.setItem('contacts', JSON.stringify(contacts));
    renderContacts();
}

// کپی مخاطب
function copyContact(index) {
    const contact = contacts[index];
    const text = `نام: ${contact.name}\nتلفن: ${contact.phone}\nایمیل: ${contact.email}\nدسته‌بندی: ${contact.category}`;
    navigator.clipboard.writeText(text).then(() => {
        showToast('مخاطب کپی شد');
    });
}

// ویرایش مخاطب
function editContact(index) {
    editingIndex = index;
    const contact = contacts[index];
    document.getElementById('editNameInput').value = contact.name;
    document.getElementById('editPhoneInput').value = contact.phone;
    document.getElementById('editEmailInput').value = contact.email;
    document.getElementById('editCategorySelect').value = contact.category;
    document.getElementById('editModal').classList.remove('hidden');
}

document.getElementById('saveEditBtn').addEventListener('click', () => {
    const name = document.getElementById('editNameInput').value.trim();
    const phone = document.getElementById('editPhoneInput').value.trim();
    const email = document.getElementById('editEmailInput').value.trim();
    const categorySelect = document.getElementById('editCategorySelect');
    const newCategoryInput = document.getElementById('editNewCategoryInput');
    let category = categorySelect.value;

    if (newCategoryInput.classList.contains('hidden') === false) {
        category = newCategoryInput.value.trim();
        if (category && !categories.includes(category)) {
            categories.push(category);
            localStorage.setItem('categories', JSON.stringify(categories));
            updateCategoryOptions();
        }
    }

    if (!category) {
        category = 'بدون دسته‌بندی';
    }

    if (name && phone) {
        contacts[editingIndex] = { name, phone, email, category };
        localStorage.setItem('contacts', JSON.stringify(contacts));
        renderContacts();
        document.getElementById('editModal').classList.add('hidden');
        newCategoryInput.value = '';
        newCategoryInput.classList.add('hidden');
        categorySelect.classList.remove('hidden');
        document.getElementById('toggleEditNewCategory').textContent = '+ جدید';
        editingIndex = null;
    } else {
        alert('لطفاً نام و شماره تلفن را وارد کنید.');
    }
});

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
    document.getElementById('editNewCategoryInput').value = '';
    document.getElementById('editNewCategoryInput').classList.add('hidden');
    document.getElementById('editCategorySelect').classList.remove('hidden');
    document.getElementById('toggleEditNewCategory').textContent = '+ جدید';
    editingIndex = null;
});

document.getElementById('toggleEditNewCategory').addEventListener('click', () => {
    const categorySelect = document.getElementById('editCategorySelect');
    const newCategoryInput = document.getElementById('editNewCategoryInput');
    if (newCategoryInput.classList.contains('hidden')) {
        newCategoryInput.classList.remove('hidden');
        categorySelect.classList.add('hidden');
        document.getElementById('toggleEditNewCategory').textContent = 'لغو';
    } else {
        newCategoryInput.classList.add('hidden');
        categorySelect.classList.remove('hidden');
        document.getElementById('toggleEditNewCategory').textContent = '+ جدید';
        newCategoryInput.value = '';
    }
});

// حذف دسته‌بندی
document.getElementById('deleteCategoryBtn').addEventListener('click', () => {
    const deleteCategorySelect = document.getElementById('deleteCategorySelect');
    const categoryToDelete = deleteCategorySelect.value;
    if (categoryToDelete && !['بدون دسته‌بندی', 'خانواده', 'دوستان', 'همکاران'].includes(categoryToDelete)) {
        if (contacts.some(contact => contact.category === categoryToDelete)) {
            alert('نمی‌توانید دسته‌بندی را حذف کنید زیرا مخاطبینی در این دسته‌بندی وجود دارند.');
            return;
        }
        categories = categories.filter(category => category !== categoryToDelete);
        localStorage.setItem('categories', JSON.stringify(categories));
        updateCategoryOptions();
        renderContacts();
    } else if (categoryToDelete) {
        alert('دسته‌بندی‌های پیش‌فرض (بدون دسته‌بندی، خانواده، دوستان، همکاران) قابل حذف نیستند.');
    } else {
        alert('لطفاً یک دسته‌بندی انتخاب کنید.');
    }
});

// حذف همه مخاطبین
document.getElementById('deleteAllContactsBtn').addEventListener('click', () => {
    if (selectedContacts.size > 0) {
        if (confirm('آیا مطمئن هستید که می‌خواهید مخاطبین انتخاب‌شده را حذف کنید؟')) {
            contacts = contacts.filter((_, index) => !selectedContacts.has(index));
            selectedContacts.clear();
            localStorage.setItem('contacts', JSON.stringify(contacts));
            renderContacts();
        }
    } else if (confirm('آیا مطمئن هستید که می‌خواهید همه مخاطبین را حذف کنید؟')) {
        contacts = [];
        selectedContacts.clear();
        localStorage.setItem('contacts', JSON.stringify(contacts));
        renderContacts();
    }
});

// بررسی و حذف مخاطبین تکراری (تنظیمات)
document.getElementById('deleteDuplicatesBtn').addEventListener('click', () => {
    const duplicates = findDuplicates();
    if (duplicates.length === 0) {
        alert('مخاطب تکراری یافت نشد.');
        return;
    }

    showDuplicatesModal(duplicates);
    document.getElementById('applyDuplicatesBtn').onclick = () => {
        applyDuplicateSelections(false);
    };
});

// اعمال انتخاب‌های مودال تکراری‌ها
function applyDuplicateSelections(isImport) {
    const keepIndices = new Set();
    document.querySelectorAll('.keepContact:checked').forEach(checkbox => {
        keepIndices.add(parseInt(checkbox.dataset.index));
    });

    const allContacts = isImport ? [...contacts, ...pendingNewContacts] : contacts;
    const nameMap = {};
    const phoneMap = {};
    allContacts.forEach((contact, index) => {
        if (!nameMap[contact.name]) {
            nameMap[contact.name] = [];
        }
        nameMap[contact.name].push(index);
        if (!phoneMap[contact.phone]) {
            phoneMap[contact.phone] = [];
        }
        phoneMap[contact.phone].push(index);
    });

    const finalContacts = [];
    allContacts.forEach((contact, index) => {
        const isNameDuplicate = nameMap[contact.name].length > 1;
        const isPhoneDuplicate = phoneMap[contact.phone].length > 1;
        if ((!isNameDuplicate && !isPhoneDuplicate) || keepIndices.has(index)) {
            finalContacts.push(contact);
        }
    });

    contacts = finalContacts;
    localStorage.setItem('contacts', JSON.stringify(contacts));
    document.getElementById('deleteDuplicatesModal').classList.add('hidden');
    renderContacts();
    showToast(isImport ? 'مخاطبین وارد شدند' : 'مخاطبین تکراری حذف شدند', 3000);
    if (isImport) {
        document.getElementById('importFileInput').value = '';
        pendingNewContacts = [];
    }
}

// وارد کردن فایل CSV
document.getElementById('importFileBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('لطفاً یک فایل انتخاب کنید.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '')));
        if (rows[0][0].startsWith('\uFEFF')) {
            rows[0][0] = rows[0][0].substring(1);
        }
        const headers = rows[0];
        const expectedHeaders = ['نام و نام خانوادگی', 'شماره تلفن', 'ایمیل', 'دسته‌بندی'];
        if (!headers.every((header, i) => header === expectedHeaders[i])) {
            alert('فرمت فایل نادرست است. فایل باید شامل ستون‌های "نام و نام خانوادگی", "شماره تلفن", "ایمیل", "دسته‌بندی" باشد.');
            return;
        }
        pendingNewContacts = rows.slice(1).map(row => ({
            name: row[0] || '',
            phone: row[1] || '',
            email: row[2] || '',
            category: row[3] || 'بدون دسته‌بندی'
        })).filter(contact => contact.name && contact.phone);
        pendingNewContacts.forEach(contact => {
            if (!categories.includes(contact.category)) {
                categories.push(contact.category);
            }
        });

        const duplicates = findDuplicates(pendingNewContacts);
        if (duplicates.length > 0) {
            showDuplicatesModal(duplicates, true);
            document.getElementById('applyDuplicatesBtn').onclick = () => {
                localStorage.setItem('categories', JSON.stringify(categories));
                updateCategoryOptions();
                applyDuplicateSelections(true);
            };
        } else {
            contacts = [...pendingNewContacts, ...contacts];
            localStorage.setItem('contacts', JSON.stringify(contacts));
            localStorage.setItem('categories', JSON.stringify(categories));
            updateCategoryOptions();
            renderContacts();
            showToast('مخاطبین وارد شدند');
            fileInput.value = '';
            pendingNewContacts = [];
        }
    };
    reader.readAsText(file);
});

// دانلود فایل CSV
function exportCsv() {
    let exportContacts = contacts;
    if (selectedContacts.size > 0) {
        exportContacts = Array.from(selectedContacts).map(index => contacts[index]);
    }
    const csvContent = [
        '\uFEFF"نام و نام خانوادگی","شماره تلفن","ایمیل","دسته‌بندی"',
        ...exportContacts.map(contact => `"${contact.name.replace(/"/g, '""')}","'${contact.phone.replace(/"/g, '""')}","${contact.email.replace(/"/g, '""') || ''}","${contact.category.replace(/"/g, '""')}"`)
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts.csv';
    link.click();
    URL.revokeObjectURL(url);
}

document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

// جستجو
document.getElementById('searchInput').addEventListener('input', (e) => {
    currentPage = 1;
    const category = document.getElementById('categoryFilter').value;
    renderContacts(e.target.value, category);
});

// فیلتر بر اساس دسته‌بندی
document.getElementById('categoryFilter').addEventListener('change', (e) => {
    currentPage = 1;
    const search = document.getElementById('searchInput').value;
    renderContacts(search, e.target.value);
});

// تغییر بین انتخاب دسته‌بندی و افزودن دسته‌بندی جدید (فرم افزودن)
document.getElementById('toggleNewCategory').addEventListener('click', () => {
    const categorySelect = document.getElementById('categorySelect');
    const newCategoryInput = document.getElementById('newCategoryInput');
    if (newCategoryInput.classList.contains('hidden')) {
        newCategoryInput.classList.remove('hidden');
        categorySelect.classList.add('hidden');
        document.getElementById('toggleNewCategory').textContent = 'لغو';
    } else {
        newCategoryInput.classList.add('hidden');
        categorySelect.classList.remove('hidden');
        document.getElementById('toggleNewCategory').textContent = '+ جدید';
        newCategoryInput.value = '';
    }
});

// نمایش/مخفی کردن تنظیمات
document.getElementById('toggleSettings').addEventListener('click', () => {
    const settingsPanel = document.getElementById('settingsPanel');
    settingsPanel.classList.toggle('hidden');
    document.getElementById('toggleSettings').textContent = settingsPanel.classList.contains('hidden') ? 'تنظیمات' : 'بستن تنظیمات';
});

// صفحه‌بندی
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        const search = document.getElementById('searchInput').value;
        const category = document.getElementById('categoryFilter').value;
        renderContacts(search, category);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const search = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    const filteredContacts = contacts.filter(contact => 
        contact.name.includes(search) && (category === '' || contact.category === category)
    );
    if (currentPage < Math.ceil(filteredContacts.length / contactsPerPage)) {
        currentPage++;
        renderContacts(search, category);
    }
});

// انتخاب همه مخاطبین
document.getElementById('selectAll').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.selectContact');
    checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
        const index = parseInt(checkbox.dataset.index);
        if (e.target.checked) {
            selectedContacts.add(index);
        } else {
            selectedContacts.delete(index);
        }
    });
});

// انتخاب تکی مخاطب
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('selectContact')) {
        const index = parseInt(e.target.dataset.index);
        if (e.target.checked) {
            selectedContacts.add(index);
        } else {
            selectedContacts.delete(index);
        }
    }
});

// محدودیت ورودی شماره تلفن
function restrictPhoneInput(input) {
    const value = input.value;
    const plusCount = (value.match(/\+/g) || []).length;
    if (plusCount > 1 || (plusCount === 1 && value[0] !== '+')) {
        input.value = value.replace(/\+/g, '').replace(/^/, value[0] === '+' ? '+' : '');
    }
    input.value = input.value.replace(/[^0-9+]/g, '').slice(0, 13);
}

document.getElementById('phoneInput').addEventListener('input', (e) => {
    restrictPhoneInput(e.target);
});

document.getElementById('editPhoneInput').addEventListener('input', (e) => {
    restrictPhoneInput(e.target);
});

// محدودیت ورودی ایمیل
function restrictEmailInput(input) {
    input.value = input.value.replace(/[^a-zA-Z0-9@._-]/g, '');
}

document.getElementById('emailInput').addEventListener('input', (e) => {
    restrictEmailInput(e.target);
});

document.getElementById('editEmailInput').addEventListener('input', (e) => {
    restrictEmailInput(e.target);
});

// لغو مودال حذف تکراری‌ها
document.getElementById('cancelDeleteDuplicatesBtn').addEventListener('click', () => {
    document.getElementById('deleteDuplicatesModal').classList.add('hidden');
    pendingNewContacts = [];
    document.getElementById('importFileInput').value = '';
});

// بارگذاری دسته‌بندی‌ها از LocalStorage
if (localStorage.getItem('categories')) {
    categories = JSON.parse(localStorage.getItem('categories'));
}
updateCategoryOptions();

// رندر اولیه
renderContacts();