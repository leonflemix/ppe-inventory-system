// Filename: main.js
import { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    addDoc,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    runTransaction,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    Timestamp,
    serverTimestamp
} from './firebase.js';

// --- ADMIN CONFIGURATION ---
const adminEmails = ["leonflemixdartmouth@gmail.com"]; // For bootstrapping the first admin

// --- DOM Elements ---
const appContainer = document.getElementById('app');
const mainApp = document.getElementById('main-app');
const pageTitle = document.getElementById('page-title');
const dashboardView = document.getElementById('dashboard-view');
const purchasesView = document.getElementById('purchases-view');
const reportsView = document.getElementById('reports-view');
const employeesView = document.getElementById('employees-view');
const machinesView = document.getElementById('machines-view');
const suppliersView = document.getElementById('suppliers-view');
const usersView = document.getElementById('users-view');
const tableManagerView = document.getElementById('table-manager-view');
const toastContainer = document.getElementById('toast-container');
const sidebarToggle = document.getElementById('sidebar-toggle');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

// --- App State ---
let currentInventory = [];
let currentEmployees = [];
let currentMachines = [];
let currentSuppliers = [];
let allUsers = [];
let currentUsageLogs = [];
let currentPurchases = [];
let filteredPurchases = [];
let currentUserRole = 'user'; // Default role
let activeReport = { type: null, data: [], fullData: [] };
let sortState = { key: 'name', order: 'asc' };
let topUsedItemsChart, itemsByCategoryChart;


// --- MODAL & TOAST UTILITIES ---
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
let confirmCallback = null;

function showModal(modal) { modal.classList.remove('hidden'); }
function hideModal(modal) { modal.classList.add('hidden'); }

function showAlert(message, title = 'Error') {
    document.getElementById('alert-title').textContent = title;
    alertMessage.textContent = message;
    showModal(alertModal);
}

function showConfirm(message, onConfirm) {
    document.getElementById('confirm-title').textContent = 'Are you sure?';
    confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    showModal(confirmModal);
}

function showToast(message, type = 'success') {
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    
    const toast = document.createElement('div');
    toast.className = `toast flex items-center w-full max-w-xs p-4 mb-4 text-white ${bgColor} rounded-lg shadow`;
    toast.innerHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg">
            <i class="fas ${icon}"></i>
        </div>
        <div class="ml-3 text-sm font-normal">${message}</div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

alertOkBtn.addEventListener('click', () => hideModal(alertModal));
confirmCancelBtn.addEventListener('click', () => {
    confirmCallback = null;
    hideModal(confirmModal);
});
confirmOkBtn.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    confirmCallback = null;
    hideModal(confirmModal);
});


// --- Navigation & UI ---
document.getElementById('nav-dashboard').addEventListener('click', (e) => switchView(e, 'dashboard'));
document.getElementById('nav-purchases').addEventListener('click', (e) => switchView(e, 'purchases'));
document.getElementById('nav-reports').addEventListener('click', (e) => switchView(e, 'reports'));
document.getElementById('nav-employees').addEventListener('click', (e) => switchView(e, 'employees'));
document.getElementById('nav-machines').addEventListener('click', (e) => switchView(e, 'machines'));
document.getElementById('nav-suppliers').addEventListener('click', (e) => switchView(e, 'suppliers'));
document.getElementById('nav-users').addEventListener('click', (e) => switchView(e, 'users'));
document.getElementById('nav-table-manager').addEventListener('click', (e) => switchView(e, 'table-manager'));

sidebarToggle.addEventListener('click', () => {
    appContainer.classList.toggle('sidebar-collapsed');
});

reportsView.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.classList.contains('chart-toggle-btn')) {
        const chartBodyId = target.dataset.chart;
        const chartBody = document.getElementById(chartBodyId);
        const icon = target.querySelector('i');
        if (chartBody) {
            chartBody.classList.toggle('hidden');
            icon.classList.toggle('fa-chevron-down', chartBody.classList.contains('hidden'));
            icon.classList.toggle('fa-chevron-up', !chartBody.classList.contains('hidden'));
        }
        return;
    }

    if (currentUserRole !== 'user') {
        const logId = target.dataset.id;
        if (target.classList.contains('delete-log-btn')) {
            showConfirm('Are you sure you want to delete this usage record? This action cannot be undone and will NOT return stock to inventory.', async () => {
                await deleteDoc(doc(db, 'usageLog', logId));
                refreshActiveReport();
                showToast('Log entry deleted.', 'success');
            });
        } else if (target.classList.contains('edit-log-btn')) {
            getDoc(doc(db, 'usageLog', logId)).then(logDoc => {
                if (logDoc.exists()) {
                    const data = logDoc.data();
                    document.getElementById('edit-log-id').value = logId;
                    document.getElementById('edit-log-item-name').textContent = data.itemName;
                    document.getElementById('edit-log-employee-select').value = data.employeeId;
                    document.getElementById('edit-log-quantity').value = data.quantityUsed;
                    document.getElementById('edit-log-location').value = data.location;
                    showModal(document.getElementById('edit-log-modal'));
                }
            });
        }
    }
});


function switchView(event, viewName) {
    event.preventDefault();
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    const views = { dashboard: dashboardView, purchases: purchasesView, reports: reportsView, employees: employeesView, machines: machinesView, suppliers: suppliersView, users: usersView, 'table-manager': tableManagerView };
    Object.keys(views).forEach(key => {
        views[key].classList.toggle('hidden', key !== viewName);
    });
    pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-', ' ');
}

// --- PERMISSIONS ---
function applyUIPermissions() {
    const isUser = currentUserRole === 'user';
    const isManager = currentUserRole === 'manager';
    const isAdmin = currentUserRole === 'admin';

    // Sidebar Links
    document.getElementById('nav-purchases').classList.toggle('hidden', isUser);
    document.getElementById('nav-reports').classList.toggle('hidden', isUser);
    document.getElementById('nav-employees').classList.toggle('hidden', isUser);
    document.getElementById('nav-machines').classList.toggle('hidden', isUser);
    document.getElementById('nav-suppliers').classList.toggle('hidden', isUser);
    document.getElementById('nav-users').classList.toggle('hidden', !isAdmin);
    document.getElementById('nav-table-manager').classList.toggle('hidden', !isAdmin);

    // Buttons and Actions
    document.getElementById('add-item-btn').classList.toggle('hidden', isUser);
    
    renderInventoryTable(); 
}


// --- AUTHENTICATION & ROLE MANAGEMENT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role;
        } else {
            const role = adminEmails.includes(user.email) ? 'admin' : 'user';
            await setDoc(userDocRef, { email: user.email, role: role });
            currentUserRole = role;
        }

        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-role-display').textContent = `Role: ${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)}`;
        
        document.getElementById('auth-container').classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        applyUIPermissions();

        listenForInventoryUpdates();
        listenForEmployeeUpdates();
        listenForMachineUpdates();
        listenForSupplierUpdates();
        listenForUsageLogUpdates();
        listenForPurchaseUpdates();
        if (currentUserRole === 'admin') {
            listenForUsersUpdates();
        }
    } else {
        currentUserRole = 'user';
        mainApp.classList.add('hidden');
        document.getElementById('auth-container').classList.remove('hidden');
    }
});

// --- Login/Signup Form Logic ---
loginBtn.addEventListener('click', () => signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(err => showAlert(err.message, "Login Failed")));

signupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            const role = adminEmails.includes(user.email) ? 'admin' : 'user';
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: role
            });
        })
        .catch(err => showAlert(err.message, "Signup Failed"));
});


authForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!loginBtn.classList.contains('hidden')) loginBtn.click();
        else signupBtn.click();
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('toggle-auth').addEventListener('click', e => {
    e.preventDefault();
    loginBtn.classList.toggle('hidden');
    signupBtn.classList.toggle('hidden');
    document.getElementById('auth-title').textContent = loginBtn.classList.contains('hidden') ? 'Sign Up' : 'Login';
    e.target.textContent = loginBtn.classList.contains('hidden') ? 'Have an account? Login' : 'Need an account? Sign Up';
});

// --- DATABASE COLLECTIONS ---
const inventoryCollection = collection(db, 'inventory');
const usageLogCollection = collection(db, 'usageLog');
const employeesCollection = collection(db, 'employees');
const machinesCollection = collection(db, 'machines');
const suppliersCollection = collection(db, 'suppliers');
const purchasesCollection = collection(db, 'purchases');
const usersCollection = collection(db, 'users');

// --- REAL-TIME LISTENERS ---
function listenForInventoryUpdates() { onSnapshot(inventoryCollection, (snapshot) => { currentInventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderInventoryTable(); updateDashboardCards(currentInventory); updateDashboardCharts(); populateItemReportDropdown(); }); }
function listenForEmployeeUpdates() { onSnapshot(employeesCollection, (snapshot) => { currentEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderEmployeesTable(); populateEmployeeDropdowns(); }); }
function listenForMachineUpdates() { onSnapshot(machinesCollection, (snapshot) => { currentMachines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderMachinesTable(); populateMachineDropdowns(); }); }
function listenForSupplierUpdates() { onSnapshot(suppliersCollection, (snapshot) => { currentSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderSuppliersTable(); populateSupplierDropdowns(); }); }
function listenForPurchaseUpdates() { onSnapshot(purchasesCollection, (snapshot) => { currentPurchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderPurchasesTable(); }); }
function listenForUsersUpdates() { onSnapshot(usersCollection, (snapshot) => { allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })); renderUsersTable(); }); }
function listenForUsageLogUpdates() {
    onSnapshot(usageLogCollection, (snapshot) => {
        currentUsageLogs = snapshot.docs.map(doc => doc.data());
        updateDashboardCharts();
    });
}


// --- USER MANAGEMENT (ADMIN ONLY) ---
document.getElementById('add-user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;

    showConfirm("Creating a new user through this panel will log you out temporarily. You will need to log back in with your admin account to continue. Proceed?", async () => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await setDoc(doc(db, 'users', user.uid), { email, role });

            showAlert('User created successfully. You have been logged out. Please log back in.', 'Action Required');
            e.target.reset();
        } catch (error) {
            showAlert(error.message, 'Failed to Create User');
        }
    });
});


function renderUsersTable() {
    const tableBody = document.getElementById('users-table-body');
    if (currentUserRole !== 'admin' || !allUsers) return;

    tableBody.innerHTML = allUsers.map(user => {
        const isCurrentUser = auth.currentUser && auth.currentUser.uid === user.uid;
        return `<tr class="bg-white border-b hover:bg-gray-50">
            <td class="px-6 py-4">${user.email}</td>
            <td class="px-6 py-4">
                <select data-uid="${user.uid}" class="role-select p-2 border rounded-lg bg-gray-50" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                </select>
                ${isCurrentUser ? '<span class="ml-2 text-xs text-gray-500">(Cannot change your own role)</span>' : ''}
            </td>
        </tr>`;
    }).join('');
}
document.getElementById('users-table-body').addEventListener('change', async (e) => {
    if (e.target.classList.contains('role-select')) {
        const uid = e.target.dataset.uid;
        const newRole = e.target.value;
        await updateDoc(doc(db, 'users', uid), { role: newRole });
        showToast('User role updated successfully!');
    }
});


// --- CHARTING LOGIC ---
function updateDashboardCharts() { if (!currentUsageLogs || !currentInventory) return; const itemUsage = currentUsageLogs.reduce((acc, log) => { acc[log.itemName] = (acc[log.itemName] || 0) + log.quantityUsed; return acc; }, {}); const sortedItems = Object.entries(itemUsage).sort(([, a], [, b]) => b - a).slice(0, 5); renderBarChart('top-used-items-chart', sortedItems.map(item => item[0]), sortedItems.map(item => item[1])); const categoryCounts = currentInventory.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; }, {}); renderPieChart('items-by-category-chart', Object.keys(categoryCounts), Object.values(categoryCounts)); }
function renderBarChart(canvasId, labels, data) { if (topUsedItemsChart) topUsedItemsChart.destroy(); const ctx = document.getElementById(canvasId).getContext('2d'); topUsedItemsChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Quantity Used', data, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } }); }
function renderPieChart(canvasId, labels, data) { if (itemsByCategoryChart) itemsByCategoryChart.destroy(); const ctx = document.getElementById(canvasId).getContext('2d'); itemsByCategoryChart = new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] }, options: { responsive: true, maintainAspectRatio: false } }); }

// --- Generic Search & Sort ---
function applySearch(data, searchTerm, key = 'name') { if (!searchTerm) return data; return data.filter(item => item[key] && item[key].toLowerCase().includes(searchTerm.toLowerCase())); }
function applySort(data, sortKey, sortOrder) { return [...data].sort((a, b) => { let valA = a[sortKey]; let valB = b[sortKey]; if (valA && valA.toDate) valA = valA.toDate(); if (valB && valB.toDate) valB = valB.toDate(); if (typeof valA === 'string') valA = valA.toLowerCase(); if (typeof valB === 'string') valB = valB.toLowerCase(); if (valA < valB) return sortOrder === 'asc' ? -1 : 1; if (valA > valB) return sortOrder === 'asc' ? 1 : -1; return 0; }); }
function setupTableSorting(tableElement, renderFunction) { const thead = tableElement.querySelector('thead'); if (!thead) return; thead.addEventListener('click', e => { const header = e.target.closest('.sortable'); if (!header) return; const key = header.dataset.sort; const currentOrder = header.classList.contains('asc') ? 'desc' : 'asc'; thead.querySelectorAll('.sortable').forEach(th => th.classList.remove('asc', 'desc')); header.classList.add(currentOrder); sortState = { key, order: currentOrder }; renderFunction(); }); }
setupTableSorting(document.querySelector('#inventory-table-body').closest('table'), renderInventoryTable);
setupTableSorting(document.querySelector('#employees-table-body').closest('table'), renderEmployeesTable);
setupTableSorting(document.querySelector('#machines-table-body').closest('table'), renderMachinesTable);
setupTableSorting(document.querySelector('#suppliers-table-body').closest('table'), renderSuppliersTable);
setupTableSorting(document.querySelector('#purchases-table-body').closest('table'), renderPurchasesTable);

// --- All Management Sections ---
document.getElementById('employee-search').addEventListener('input', () => renderEmployeesTable());
document.getElementById('add-employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('employee-name-input');
    const name = input.value.trim();
    if (!name) {
        showAlert("Employee name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentEmployees.some(emp => emp.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        showAlert(`An employee with the name "${name}" already exists.`, "Duplicate Entry");
        return;
    }
    await addDoc(employeesCollection, { name });
    input.value = '';
    showToast('Employee added successfully!');
});
function renderEmployeesTable() { if (!currentEmployees) return; const searchTerm = document.getElementById('employee-search').value; const filtered = applySearch(currentEmployees, searchTerm); const sorted = applySort(filtered, sortState.key, sortState.order); const tableBody = document.getElementById('employees-table-body'); tableBody.innerHTML = sorted.length === 0 ? '<tr><td colspan="2" class="text-center p-8 text-gray-500">No employees found.</td></tr>' : sorted.map(emp => `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">${emp.name}</td><td class="px-6 py-4 text-center space-x-2"><button class="edit-employee-btn text-blue-600 hover:text-blue-900" data-id="${emp.id}" data-name="${emp.name}"><i class="fas fa-edit"></i> Edit</button><button class="delete-employee-btn text-red-600 hover:text-red-900" data-id="${emp.id}"><i class="fas fa-trash"></i> Delete</button></td></tr>`).join(''); }
document.getElementById('employees-table-body').addEventListener('click', (e) => { const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (target.classList.contains('delete-employee-btn')) { showConfirm('Are you sure you want to delete this employee?', async () => { await deleteDoc(doc(db, 'employees', id)); showToast('Employee deleted.', 'success'); }); } else if (target.classList.contains('edit-employee-btn')) { document.getElementById('edit-employee-id').value = id; document.getElementById('edit-employee-name-input').value = target.dataset.name; showModal(document.getElementById('edit-employee-modal')); } });
document.getElementById('edit-employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-employee-id').value;
    const newName = document.getElementById('edit-employee-name-input').value.trim();
    if (!newName) {
        showAlert("Employee name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentEmployees.some(emp => emp.id !== id && emp.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) {
        showAlert(`An employee with the name "${newName}" already exists.`, "Duplicate Entry");
        return;
    }
    await updateDoc(doc(db, 'employees', id), { name: newName });
    hideModal(document.getElementById('edit-employee-modal'));
    showToast('Employee updated!');
});
document.getElementById('cancel-edit-employee-btn').addEventListener('click', () => hideModal(document.getElementById('edit-employee-modal')));

document.getElementById('machine-search').addEventListener('input', () => renderMachinesTable());
document.getElementById('add-machine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('machine-name-input');
    const name = input.value.trim();
    if (!name) {
        showAlert("Machine name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentMachines.some(m => m.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        showAlert(`A machine with the name "${name}" already exists.`, "Duplicate Entry");
        return;
    }
    await addDoc(machinesCollection, { name });
    input.value = '';
    showToast('Machine added successfully!');
});
function renderMachinesTable() { if (!currentMachines) return; const searchTerm = document.getElementById('machine-search').value; const filtered = applySearch(currentMachines, searchTerm); const sorted = applySort(filtered, sortState.key, sortState.order); const tableBody = document.getElementById('machines-table-body'); tableBody.innerHTML = sorted.length === 0 ? '<tr><td colspan="2" class="text-center p-8 text-gray-500">No machines found.</td></tr>' : sorted.map(m => `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">${m.name}</td><td class="px-6 py-4 text-center space-x-2"><button class="edit-machine-btn text-blue-600 hover:text-blue-900" data-id="${m.id}" data-name="${m.name}"><i class="fas fa-edit"></i> Edit</button><button class="delete-machine-btn text-red-600 hover:text-red-900" data-id="${m.id}"><i class="fas fa-trash"></i> Delete</button></td></tr>`).join(''); }
document.getElementById('machines-table-body').addEventListener('click', (e) => { const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (target.classList.contains('delete-machine-btn')) { showConfirm('Are you sure you want to delete this machine?', async () => { await deleteDoc(doc(db, 'machines', id)); showToast('Machine deleted.', 'success'); }); } else if (target.classList.contains('edit-machine-btn')) { document.getElementById('edit-machine-id').value = id; document.getElementById('edit-machine-name-input').value = target.dataset.name; showModal(document.getElementById('edit-machine-modal')); } });
document.getElementById('edit-machine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-machine-id').value;
    const newName = document.getElementById('edit-machine-name-input').value.trim();
    if (!newName) {
        showAlert("Machine name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentMachines.some(m => m.id !== id && m.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) {
        showAlert(`A machine with the name "${newName}" already exists.`, "Duplicate Entry");
        return;
    }
    await updateDoc(doc(db, 'machines', id), { name: newName });
    hideModal(document.getElementById('edit-machine-modal'));
    showToast('Machine updated!');
});
document.getElementById('cancel-edit-machine-btn').addEventListener('click', () => hideModal(document.getElementById('edit-machine-modal')));

document.getElementById('supplier-search').addEventListener('input', () => renderSuppliersTable());
document.getElementById('add-supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('supplier-name-input');
    const name = input.value.trim();
    if (!name) {
        showAlert("Supplier name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentSuppliers.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
        showAlert(`A supplier with the name "${name}" already exists.`, "Duplicate Entry");
        return;
    }
    await addDoc(suppliersCollection, { name });
    input.value = '';
    showToast('Supplier added successfully!');
});
function renderSuppliersTable() { if (!currentSuppliers) return; const searchTerm = document.getElementById('supplier-search').value; const filtered = applySearch(currentSuppliers, searchTerm); const sorted = applySort(filtered, sortState.key, sortState.order); const tableBody = document.getElementById('suppliers-table-body'); tableBody.innerHTML = sorted.length === 0 ? '<tr><td colspan="2" class="text-center p-8 text-gray-500">No suppliers found.</td></tr>' : sorted.map(s => `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4 font-medium text-gray-900">${s.name}</td><td class="px-6 py-4 text-center space-x-2"><button class="edit-supplier-btn text-blue-600 hover:text-blue-900" data-id="${s.id}" data-name="${s.name}"><i class="fas fa-edit"></i> Edit</button><button class="delete-supplier-btn text-red-600 hover:text-red-900" data-id="${s.id}"><i class="fas fa-trash"></i> Delete</button></td></tr>`).join(''); }
document.getElementById('suppliers-table-body').addEventListener('click', (e) => { const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (target.classList.contains('delete-supplier-btn')) { showConfirm('Are you sure you want to delete this supplier?', async () => { await deleteDoc(doc(db, 'suppliers', id)); showToast('Supplier deleted.', 'success'); }); } else if (target.classList.contains('edit-supplier-btn')) { document.getElementById('edit-supplier-id').value = id; document.getElementById('edit-supplier-name-input').value = target.dataset.name; showModal(document.getElementById('edit-supplier-modal')); } });
document.getElementById('edit-supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-supplier-id').value;
    const newName = document.getElementById('edit-supplier-name-input').value.trim();
    if (!newName) {
        showAlert("Supplier name cannot be empty.", "Validation Error");
        return;
    }
    const isDuplicate = currentSuppliers.some(s => s.id !== id && s.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) {
        showAlert(`A supplier with the name "${newName}" already exists.`, "Duplicate Entry");
        return;
    }
    await updateDoc(doc(db, 'suppliers', id), { name: newName });
    hideModal(document.getElementById('edit-supplier-modal'));
    showToast('Supplier updated!');
});
document.getElementById('cancel-edit-supplier-btn').addEventListener('click', () => hideModal(document.getElementById('edit-supplier-modal')));

// --- INVENTORY, USAGE, & RESTOCKING LOGIC ---
document.getElementById('inventory-search').addEventListener('input', () => renderInventoryTable());
function renderInventoryTable() { if (!currentInventory) return; const searchTerm = document.getElementById('inventory-search').value; const withTotal = currentInventory.map(item => ({...item, totalStock: item.location1 + item.location2})); const filtered = applySearch(withTotal, searchTerm); const sorted = applySort(filtered, sortState.key, sortState.order); const tableBody = document.getElementById('inventory-table-body'); const isUser = currentUserRole === 'user'; const isManagerOrAdmin = currentUserRole === 'manager' || currentUserRole === 'admin'; tableBody.innerHTML = sorted.length === 0 ? '<tr><td colspan="7" class="text-center p-8 text-gray-500">No items in inventory.</td></tr>' : sorted.map(item => { let statusClass = 'bg-green-100 text-green-800'; let statusText = 'In Stock'; if (item.totalStock <= 0) { statusClass = 'bg-red-100 text-red-800'; statusText = 'Out of Stock'; } else if (item.totalStock <= item.lowStockThreshold) { statusClass = 'bg-yellow-100 text-yellow-800'; statusText = 'Low Stock'; } const managerButtons = isManagerOrAdmin ? `<button class="restock-item-btn text-purple-600 hover:text-purple-900" data-id="${item.id}" data-name="${item.name}"><i class="fas fa-plus-circle"></i> Restock</button><button class="delete-item-btn text-red-600 hover:text-red-900" data-id="${item.id}"><i class="fas fa-trash"></i> Delete</button>` : ''; return `<tr class="bg-white border-b hover:bg-gray-50"><th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${item.name}</th><td class="px-6 py-4">${item.category}</td><td class="px-6 py-4">${item.location1}</td><td class="px-6 py-4">${item.location2}</td><td class="px-6 py-4 font-bold">${item.totalStock}</td><td class="px-6 py-4"><span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full ${statusClass}">${statusText}</span></td><td class="px-6 py-4 text-center space-x-2"><button class="use-item-btn text-green-600 hover:text-green-900" data-id="${item.id}" data-name="${item.name}"><i class="fas fa-clipboard-check"></i> Use</button>${managerButtons}</td></tr>`; }).join(''); }
function updateDashboardCards(inventory) { if (!inventory) return; document.getElementById('total-items').textContent = inventory.length; document.getElementById('items-in-stock').textContent = inventory.reduce((sum, item) => sum + item.location1 + item.location2, 0); document.getElementById('low-stock-items').textContent = inventory.filter(item => (item.location1 + item.location2) > 0 && (item.location1 + item.location2) <= item.lowStockThreshold).length; document.getElementById('out-of-stock-items').textContent = inventory.filter(item => (item.location1 + item.location2) <= 0).length; }
document.getElementById('inventory-table-body').addEventListener('click', (e) => { const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (target.classList.contains('delete-item-btn') && currentUserRole !== 'user') { showConfirm('Are you sure you want to delete this item? This will remove it from inventory completely.', async () => { await deleteDoc(doc(db, 'inventory', id)); showToast('Item deleted.', 'success'); }); } else if (target.classList.contains('use-item-btn')) { document.getElementById('use-item-id').value = id; document.getElementById('use-item-name').textContent = target.dataset.name; document.getElementById('use-item-form').reset(); showModal(document.getElementById('use-item-modal')); } else if (target.classList.contains('restock-item-btn') && currentUserRole !== 'user') { document.getElementById('restock-item-id').value = id; document.getElementById('restock-item-name').textContent = target.dataset.name; document.getElementById('restock-form').reset(); showModal(document.getElementById('restock-modal')); } });
document.getElementById('use-item-form').addEventListener('submit', async (e) => { e.preventDefault(); const itemId = document.getElementById('use-item-id').value; const employeeId = document.getElementById('use-employee-select').value; const employeeName = document.getElementById('use-employee-select').options[document.getElementById('use-employee-select').selectedIndex].text; const machineId = document.getElementById('use-machine-select').value; const machineName = document.getElementById('use-machine-select').options[document.getElementById('use-machine-select').selectedIndex].text; const quantity = parseInt(document.getElementById('use-quantity').value); const location = document.getElementById('use-location').value; const notes = document.getElementById('use-notes').value.trim(); if (!itemId || !quantity || !location || !employeeId || !machineId) { showAlert('Please fill all required fields.', 'Missing Information'); return; } try { await runTransaction(db, async (transaction) => { const itemRef = doc(db, 'inventory', itemId); const itemDoc = await transaction.get(itemRef); if (!itemDoc.exists()) throw "Item does not exist!"; const currentStock = itemDoc.data()[location]; if (currentStock < quantity) throw `Not enough stock. Available: ${currentStock}`; transaction.update(itemRef, { [location]: currentStock - quantity }); await addDoc(usageLogCollection, { loggedBy: auth.currentUser.email, employeeId, employeeName, machineId, machineName, itemId, itemName: itemDoc.data().name, quantityUsed: quantity, location, notes, timestamp: serverTimestamp() }); }); hideModal(document.getElementById('use-item-modal')); showToast('Usage recorded successfully!'); } catch (error) { showAlert("Transaction failed: " + error); } });
document.getElementById('restock-form').addEventListener('submit', async (e) => { e.preventDefault(); const itemId = document.getElementById('restock-item-id').value; const itemName = document.getElementById('restock-item-name').textContent; const quantity = parseInt(document.getElementById('restock-quantity').value); const totalCost = parseFloat(document.getElementById('restock-cost').value) || 0; const supplierSelect = document.getElementById('restock-supplier'); const supplierId = supplierSelect.value; const supplierName = supplierSelect.options[supplierSelect.selectedIndex].text; const location = document.getElementById('restock-location').value; if (!itemId || !quantity || !location || !supplierId) { showAlert('Please fill all required fields.', 'Missing Information'); return; } try { await runTransaction(db, async (transaction) => { const itemRef = doc(db, 'inventory', itemId); const itemDoc = await transaction.get(itemRef); if (!itemDoc.exists()) throw "Item does not exist!"; const currentStock = itemDoc.data()[location]; transaction.update(itemRef, { [location]: currentStock + quantity }); await addDoc(purchasesCollection, { loggedBy: auth.currentUser.email, itemId, itemName, quantity, totalCost, supplier: supplierName, supplierId, restockLocation: location, purchaseDate: serverTimestamp() }); }); hideModal(document.getElementById('restock-modal')); showToast('Item restocked successfully!'); } catch (error) { showAlert("Restock transaction failed: " + error); } });

// --- PURCHASES VIEW ---
document.getElementById('purchases-filter-container').addEventListener('input', () => renderPurchasesTable());
function renderPurchasesTable() { if (!currentPurchases) return; const searchTerm = document.getElementById('purchase-search').value; const supplierId = document.getElementById('supplier-filter').value; let filtered = applySearch(currentPurchases, searchTerm, 'itemName'); if (supplierId) { filtered = filtered.filter(p => p.supplierId === supplierId); } filteredPurchases = filtered; document.getElementById('export-purchases-btn').disabled = filteredPurchases.length === 0; const sorted = applySort(filteredPurchases, sortState.key, sortState.order); const tableBody = document.getElementById('purchases-table-body'); if (sorted.length === 0) { tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-500">No purchase records found.</td></tr>`; return; } tableBody.innerHTML = sorted.map(p => { const date = p.purchaseDate ? p.purchaseDate.toDate().toLocaleString() : 'N/A'; const cost = p.totalCost ? `$${p.totalCost.toFixed(2)}` : 'N/A'; return `<tr class="bg-white border-b hover:bg-gray-50"><td class="px-6 py-4">${date}</td><td class="px-6 py-4 font-medium text-gray-900">${p.itemName}</td><td class="px-6 py-4">${p.quantity}</td><td class="px-6 py-4">${cost}</td><td class="px-6 py-4">${p.supplier || 'N/A'}</td><td class="px-6 py-4">${p.restockLocation === 'location1' ? 'Upper Office' : 'Lower Office'}</td><td class="px-6 py-4">${p.loggedBy}</td></tr>`; }).join(''); }

// --- REPORTING & CSV EXPORT ---
function populateItemReportDropdown() { const select = document.getElementById('report-item-select'); select.innerHTML = '<option value="">-- Select an Item --</option>'; if(currentInventory) currentInventory.forEach(item => select.innerHTML += `<option value="${item.id}">${item.name}</option>`); }
function populateEmployeeDropdowns() { const selects = [document.getElementById('use-employee-select'), document.getElementById('report-employee-select'), document.getElementById('edit-log-employee-select')]; selects.forEach(select => { const currentVal = select.value; select.innerHTML = `<option value="">-- Select Employee --</option>`; if(currentEmployees) currentEmployees.forEach(emp => select.innerHTML += `<option value="${emp.id}">${emp.name}</option>`); select.value = currentVal; }); }
function populateMachineDropdowns() { const selects = [document.getElementById('use-machine-select'), document.getElementById('report-machine-select')]; selects.forEach(select => { const currentVal = select.value; select.innerHTML = `<option value="">-- Select Machine --</option>`; if(currentMachines) currentMachines.forEach(m => select.innerHTML += `<option value="${m.id}">${m.name}</option>`); select.value = currentVal; }); }
function populateSupplierDropdowns() { const selects = [document.getElementById('restock-supplier'), document.getElementById('supplier-filter')]; selects.forEach(select => { const currentVal = select.value; const firstOption = select.id === 'supplier-filter' ? '<option value="">All Suppliers</option>' : '<option value="">-- Select Supplier --</option>'; select.innerHTML = firstOption; if(currentSuppliers) currentSuppliers.forEach(s => select.innerHTML += `<option value="${s.id}">${s.name}</option>`); select.value = currentVal; }); }
function exportToCsv(filename, data) { if (data.length === 0) { showAlert('No data available to export.', 'Export Failed'); return; } const headers = Object.keys(data[0]); const csvRows = [ headers.join(','), ...data.map(row => headers.map(header => JSON.stringify(row[header], (key, value) => value === null ? '' : value)).join(',')) ]; const csvString = csvRows.join('\r\n'); const blob = new Blob([csvString], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.setAttribute('hidden', ''); a.setAttribute('href', url); a.setAttribute('download', filename); document.body.appendChild(a); a.click(); document.body.removeChild(a); }
document.getElementById('export-item-report-btn').addEventListener('click', () => exportToCsv(`item-report.csv`, activeReport.data));
document.getElementById('export-employee-report-btn').addEventListener('click', () => exportToCsv(`employee-report.csv`, activeReport.data));
document.getElementById('export-machine-report-btn').addEventListener('click', () => exportToCsv(`machine-report.csv`, activeReport.data));
document.getElementById('export-purchases-btn').addEventListener('click', () => { const dataToExport = filteredPurchases.map(p => ({ purchaseDate: p.purchaseDate ? p.purchaseDate.toDate().toLocaleString() : 'N/A', itemName: p.itemName, quantity: p.quantity, totalCost: p.totalCost || 'N/A', supplier: p.supplier || 'N/A', restockedTo: p.restockLocation === 'location1' ? 'Upper Office' : 'Lower Office', loggedBy: p.loggedBy })); exportToCsv('purchases-report.csv', dataToExport); });

document.getElementById('report-search').addEventListener('input', () => {
    // Re-render the currently active report with the search term
    if (activeReport.type === 'item') {
        renderReportTable(document.getElementById('item-report-table-body'), activeReport.fullData, 'item');
    } else if (activeReport.type === 'employee') {
        renderReportTable(document.getElementById('employee-report-table-body'), activeReport.fullData, 'employee');
    } else if (activeReport.type === 'machine') {
        renderReportTable(document.getElementById('machine-report-table-body'), activeReport.fullData, 'machine');
    }
});

document.getElementById('report-item-select').addEventListener('change', fetchAndRenderItemReport);
document.getElementById('report-employee-select').addEventListener('change', fetchAndRenderEmployeeReport);
document.getElementById('report-machine-select').addEventListener('change', fetchAndRenderMachineReport);
async function fetchAndRenderItemReport() { activeReport.type = 'item'; const itemId = document.getElementById('report-item-select').value; const btn = document.getElementById('export-item-report-btn'); const tableBody = document.getElementById('item-report-table-body'); if (!itemId) { tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-gray-500">Select an item to view its usage history.</td></tr>`; btn.disabled = true; activeReport.data = []; activeReport.fullData = []; return; } const q = query(usageLogCollection, where("itemId", "==", itemId)); const snapshot = await getDocs(q); activeReport.fullData = snapshot.docs; renderReportTable(tableBody, snapshot.docs, 'item'); }
async function fetchAndRenderEmployeeReport() { activeReport.type = 'employee'; const employeeId = document.getElementById('report-employee-select').value; const btn = document.getElementById('export-employee-report-btn'); const tableBody = document.getElementById('employee-report-table-body'); if (!employeeId) { tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-500">Select an employee to see their PPE history.</td></tr>'; btn.disabled = true; activeReport.data = []; activeReport.fullData = []; return; } const q = query(usageLogCollection, where("employeeId", "==", employeeId)); const snapshot = await getDocs(q); activeReport.fullData = snapshot.docs; renderReportTable(tableBody, snapshot.docs, 'employee'); }
async function fetchAndRenderMachineReport() { activeReport.type = 'machine'; const machineId = document.getElementById('report-machine-select').value; const btn = document.getElementById('export-machine-report-btn'); const tableBody = document.getElementById('machine-report-table-body'); if (!machineId) { tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-8 text-gray-500">Select a machine to see its PPE history.</td></tr>'; btn.disabled = true; activeReport.data = []; activeReport.fullData = []; return; } const q = query(usageLogCollection, where("machineId", "==", machineId)); const snapshot = await getDocs(q); activeReport.fullData = snapshot.docs; renderReportTable(tableBody, snapshot.docs, 'machine'); }
function renderReportTable(tableBody, docs, reportType) {
    const showActions = currentUserRole !== 'user';
    const colCount = showActions ? 7 : 6;
    let headers = `
        <th class="px-6 py-3">Date</th>
        <th class="px-6 py-3">${reportType === 'item' ? 'Employee' : 'PPE Item'}</th>
        <th class="px-6 py-3">${reportType === 'machine' ? 'Employee' : (reportType === 'employee' ? 'Machine' : 'Machine')}</th>
        <th class="px-6 py-3">Quantity</th>
        <th class="px-6 py-3">Location</th>
        <th class="px-6 py-3">Logged By</th>
        ${showActions ? '<th class="px-6 py-3">Actions</th>' : ''}
    `;
    tableBody.parentElement.querySelector('thead tr').innerHTML = headers;
    
    // Apply search filter
    const searchTerm = document.getElementById('report-search').value.toLowerCase();
    let filteredDocs = docs;
    if (searchTerm) {
        filteredDocs = docs.filter(doc => {
            const data = doc.data();
            const searchFields = [];
            if (reportType === 'item') {
                searchFields.push(data.employeeName, data.machineName);
            } else if (reportType === 'employee') {
                searchFields.push(data.itemName, data.machineName);
            } else if (reportType === 'machine') {
                searchFields.push(data.itemName, data.employeeName);
            }
            return searchFields.some(field => field && field.toLowerCase().includes(searchTerm));
        });
    }

    if (filteredDocs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center p-8 text-gray-500">No records found.</td></tr>`;
        activeReport.data = []; // Clear export data
        document.getElementById(`export-${reportType}-report-btn`).disabled = true;
        return;
    }

    // Prepare data for CSV export
    activeReport.data = filteredDocs.map(d => {
        const data = d.data();
        let exportData = { date: data.timestamp.toDate().toLocaleString() };
        if (reportType === 'item') { Object.assign(exportData, { employee: data.employeeName, machine: data.machineName }); }
        else if (reportType === 'employee') { Object.assign(exportData, { item: data.itemName, machine: data.machineName }); }
        else if (reportType === 'machine') { Object.assign(exportData, { item: data.itemName, employee: data.employeeName }); }
        Object.assign(exportData, { quantity: data.quantityUsed, location: data.location === 'location1' ? 'Upper Office' : 'Lower Office', loggedBy: data.loggedBy });
        return exportData;
    });
    document.getElementById(`export-${reportType}-report-btn`).disabled = false;


    filteredDocs.sort((a, b) => b.data().timestamp.toDate() - a.data().timestamp.toDate());
    tableBody.innerHTML = filteredDocs.map(doc => {
        const data = doc.data();
        const date = data.timestamp.toDate().toLocaleString();
        const actions = showActions ? `<td class="px-6 py-4 text-center space-x-2"><button class="edit-log-btn text-blue-600" data-id="${doc.id}"><i class="fas fa-edit"></i></button><button class="delete-log-btn text-red-600" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td>` : '';
        let mainCol1, mainCol2;
        if (reportType === 'item') { mainCol1 = data.employeeName; mainCol2 = data.machineName; }
        else if (reportType === 'employee') { mainCol1 = data.itemName; mainCol2 = data.machineName; }
        else if (reportType === 'machine') { mainCol1 = data.itemName; mainCol2 = data.employeeName; }
        const locationDisplay = data.location === 'location1' ? 'Upper Office' : 'Lower Office';
        return `<tr class="bg-white border-b">
            <td class="px-6 py-4">${date}</td>
            <td class="px-6 py-4">${mainCol1}</td>
            <td class="px-6 py-4">${mainCol2 || 'N/A'}</td>
            <td class="px-6 py-4">${data.quantityUsed}</td>
            <td class="px-6 py-4">${locationDisplay}</td>
            <td class="px-6 py-4">${data.loggedBy}</td>
            ${actions || ''}
        </tr>`;
    }).join('');
}
document.getElementById('edit-log-form').addEventListener('submit', async (e) => { e.preventDefault(); const logId = document.getElementById('edit-log-id').value; const employeeSelect = document.getElementById('edit-log-employee-select'); const updatedData = { employeeId: employeeSelect.value, employeeName: employeeSelect.options[employeeSelect.selectedIndex].text, quantityUsed: parseInt(document.getElementById('edit-log-quantity').value), location: document.getElementById('edit-log-location').value }; await updateDoc(doc(db, 'usageLog', logId), updatedData); hideModal(document.getElementById('edit-log-modal')); refreshActiveReport(); showToast('Log entry updated!'); });
function refreshActiveReport() { if (activeReport.type === 'item') fetchAndRenderItemReport(); else if (activeReport.type === 'employee') fetchAndRenderEmployeeReport(); else if (activeReport.type === 'machine') fetchAndRenderMachineReport(); }

// --- TABLE MANAGER ---
document.getElementById('collection-selector').addEventListener('click', (e) => { if (e.target.classList.contains('collection-btn')) { displayCollection(e.target.dataset.collection); } });
async function displayCollection(collectionName) { document.getElementById('generic-table-title').textContent = `Viewing: ${collectionName}`; const container = document.getElementById('generic-table-container'); container.innerHTML = '<p class="text-center p-8">Loading data...</p>'; const querySnapshot = await getDocs(collection(db, collectionName)); const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderGenericTable(collectionName, docs); }
function renderGenericTable(collectionName, docs) { const container = document.getElementById('generic-table-container'); if (docs.length === 0) { container.innerHTML = '<p class="text-center p-8">No records found.</p>'; return; } const headers = Object.keys(docs[0]).filter(key => key !== 'id'); const tableHTML = `<table class="w-full text-sm text-left text-gray-500"><thead class="text-xs text-gray-700 uppercase bg-gray-50"><tr>${headers.map(h => `<th class="px-6 py-3">${h}</th>`).join('')}<th class="px-6 py-3">Actions</th></tr></thead><tbody>
        ${docs.map(doc => `<tr class="bg-white border-b">${headers.map(h => `<td class="px-6 py-4">${(typeof doc[h] === 'object' && doc[h] !== null) ? JSON.stringify(doc[h].toDate ? doc[h].toDate().toLocaleString() : doc[h]) : doc[h]}</td>`).join('')}<td class="px-6 py-4 text-center space-x-2">
        <button class="generic-edit-btn text-blue-600" data-id="${doc.id}" data-collection="${collectionName}"><i class="fas fa-edit"></i></button><button class="generic-delete-btn text-red-600" data-id="${doc.id}" data-collection="${collectionName}"><i class="fas fa-trash"></i></button></td></tr>`).join('')}
        </tbody></table>`; container.innerHTML = tableHTML; }
document.getElementById('generic-table-container').addEventListener('click', async e => { const target = e.target.closest('button'); if (!target) return; const { id, collection: collectionName } = target.dataset; if (target.classList.contains('generic-edit-btn')) { const docSnap = await getDoc(doc(db, collectionName, id)); if (docSnap.exists()) { const data = docSnap.data(); const form = document.getElementById('generic-edit-form'); form.innerHTML = ''; form.dataset.id = id; form.dataset.collection = collectionName; document.getElementById('generic-modal-title').textContent = `Edit Record in ${collectionName}`; Object.keys(data).forEach(key => { const value = data[key]; let inputHTML = `<label class="block text-sm font-medium text-gray-700">${key}</label>`; if (typeof value === 'object' && value && value.toDate) { inputHTML += `<input type="text" name="${key}" value="${value.toDate().toISOString()}" class="w-full p-2 border rounded-lg bg-gray-200" readonly>`; } else { inputHTML += `<input type="text" name="${key}" value="${value}" class="w-full p-2 border rounded-lg">`; } form.innerHTML += `<div>${inputHTML}</div>`; }); showModal(document.getElementById('generic-edit-modal')); } } else if (target.classList.contains('generic-delete-btn')) { showConfirm(`Are you sure you want to delete this record from ${collectionName}? This cannot be undone.`, async () => { await deleteDoc(doc(db, collectionName, id)); displayCollection(collectionName); showToast('Record deleted.', 'success'); }); } });
document.getElementById('generic-edit-form').addEventListener('submit', async e => { e.preventDefault(); const { id, collection: collectionName } = e.target.dataset; const formData = new FormData(e.target); const updatedData = {}; for (let [key, value] of formData.entries()) { updatedData[key] = isNaN(value) || value.trim() === '' || key.toLowerCase().includes('id') || key.toLowerCase().includes('name') ? value : Number(value); } await updateDoc(doc(db, collectionName, id), updatedData); hideModal(document.getElementById('generic-edit-modal')); displayCollection(collectionName); showToast('Record updated!'); });

// --- UTILITY & MODAL CANCEL BUTTONS ---
document.getElementById('cancel-item-btn').addEventListener('click', () => hideModal(document.getElementById('item-modal')));
document.getElementById('cancel-use-item-btn').addEventListener('click', () => hideModal(document.getElementById('use-item-modal')));
document.getElementById('cancel-edit-log-btn').addEventListener('click', () => hideModal(document.getElementById('edit-log-modal')));
document.getElementById('cancel-generic-edit-btn').addEventListener('click', () => hideModal(document.getElementById('generic-edit-modal')));
document.getElementById('cancel-restock-btn').addEventListener('click', () => hideModal(document.getElementById('restock-modal')));
document.getElementById('add-item-btn').addEventListener('click', () => { document.getElementById('modal-title').textContent = 'Add New PPE Item'; document.getElementById('item-form').reset(); document.getElementById('item-id').value = ''; showModal(document.getElementById('item-modal')); });
document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemData = {
        name: document.getElementById('item-name').value,
        category: document.getElementById('item-category').value,
        location1: parseInt(document.getElementById('item-location1').value),
        location2: parseInt(document.getElementById('item-location2').value),
        lowStockThreshold: parseInt(document.getElementById('item-low-stock').value)
    };

    await addDoc(inventoryCollection, itemData);
    showToast('Item added successfully!');
    hideModal(document.getElementById('item-modal'));
});

