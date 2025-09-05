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
let activeReport = { type: null, data: [] };
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
    const buttonTarget = e.target.closest('button');
    if (!buttonTarget) return;

    if (buttonTarget.classList.contains('chart-toggle-btn')) {
        const chartBodyId = buttonTarget.dataset.chart;
        const chartBody = document.getElementById(chartBodyId);
        const icon = buttonTarget.querySelector('i');
        if (chartBody) {
            chartBody.classList.toggle('hidden');
            icon.classList.toggle('fa-chevron-down', chartBody.classList.contains('hidden'));
            icon.classList.toggle('fa-chevron-up', !chartBody.classList.contains('hidden'));
        }
        return;
    }

    if (currentUserRole !== 'user') {
        const logId = buttonTarget.dataset.id;
        if (buttonTarget.classList.contains('delete-log-btn')) {
            showConfirm('Are you sure you want to delete this usage record? This action cannot be undone and will NOT return stock to inventory.', async () => {
                await deleteDoc(doc(db, 'usageLog', logId));
                refreshActiveReport();
                showToast('Log entry deleted.', 'success');
            });
        } else if (buttonTarget.classList.contains('edit-log-btn')) {
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
    document.querySelectorAll('.edit-item-btn, .delete-item-btn, .restock-item-btn').forEach(btn => btn.classList.toggle('hidden', isUser));
    
    // Refresh inventory table to show/hide buttons
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
            // This is a new user, create their document
            const role = adminEmails.includes(user.email) ? 'admin' : 'user';
            await setDoc(userDocRef, { email: user.email, role: role });
            currentUserRole = role;
        }

        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-role-display').textContent = `Role: ${currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1)}`;
        
        applyUIPermissions();
        
        document.getElementById('auth-container').classList.add('hidden');
        mainApp.classList.remove('hidden');
        
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

// Signup logic now includes creating a user role document
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


// --- Login/Signup Form Logic ---
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

loginBtn.addEventListener('click', () => signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value).catch(err => showAlert(err.message, "Login Failed")));

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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const q = query(usageLogCollection, where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo)));
    onSnapshot(q, (snapshot) => { currentUsageLogs = snapshot.docs.map(doc => doc.data()); updateDashboardCharts(); });
}


// --- USER MANAGEMENT (ADMIN ONLY) ---
function renderUsersTable() {
    const tableBody = document.getElementById('users-table-body');
    if (currentUserRole !== 'admin') return;

    tableBody.innerHTML = allUsers.map(user => {
        const isCurrentUser = auth.currentUser.uid === user.uid;
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
function updateDashboardCharts() { /* ... existing code ... */ }
function renderBarChart(canvasId, labels, data) { /* ... existing code ... */ }
function renderPieChart(canvasId, labels, data) { /* ... existing code ... */ }

// --- Generic Search & Sort ---
function applySearch(data, searchTerm, key = 'name') { /* ... existing code ... */ }
function applySort(data, sortKey, sortOrder) { /* ... existing code ... */ }
function setupTableSorting(tableElement, renderFunction) { /* ... existing code ... */ }
setupTableSorting(document.querySelector('#inventory-table-body').closest('table'), renderInventoryTable);
setupTableSorting(document.querySelector('#employees-table-body').closest('table'), renderEmployeesTable);
setupTableSorting(document.querySelector('#machines-table-body').closest('table'), renderMachinesTable);
setupTableSorting(document.querySelector('#suppliers-table-body').closest('table'), renderSuppliersTable);
setupTableSorting(document.querySelector('#purchases-table-body').closest('table'), renderPurchasesTable);

// --- EMPLOYEE, MACHINE, SUPPLIER MANAGEMENT ---
// All these sections remain largely the same, but the UI is now hidden/shown by applyUIPermissions()
document.getElementById('employee-search').addEventListener('input', () => renderEmployeesTable());
document.getElementById('add-employee-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
function renderEmployeesTable() { /* ... existing code ... */ }
document.getElementById('employees-table-body').addEventListener('click', (e) => { /* ... existing code ... */ });
document.getElementById('edit-employee-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
document.getElementById('cancel-edit-employee-btn').addEventListener('click', () => hideModal(document.getElementById('edit-employee-modal')));
// ... similar event listeners for machines and suppliers ...
document.getElementById('machine-search').addEventListener('input', () => renderMachinesTable());
document.getElementById('add-machine-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
function renderMachinesTable() { /* ... existing code ... */ }
document.getElementById('machines-table-body').addEventListener('click', (e) => { /* ... existing code ... */ });
document.getElementById('edit-machine-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
document.getElementById('cancel-edit-machine-btn').addEventListener('click', () => hideModal(document.getElementById('edit-machine-modal')));
document.getElementById('supplier-search').addEventListener('input', () => renderSuppliersTable());
document.getElementById('add-supplier-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
function renderSuppliersTable() { /* ... existing code ... */ }
document.getElementById('suppliers-table-body').addEventListener('click', (e) => { /* ... existing code ... */ });
document.getElementById('edit-supplier-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
document.getElementById('cancel-edit-supplier-btn').addEventListener('click', () => hideModal(document.getElementById('edit-supplier-modal')));

// --- INVENTORY, USAGE, & RESTOCKING LOGIC ---
document.getElementById('inventory-search').addEventListener('input', () => renderInventoryTable());
function renderInventoryTable() {
    const searchTerm = document.getElementById('inventory-search').value;
    const withTotal = currentInventory.map(item => ({...item, totalStock: item.location1 + item.location2}));
    const filtered = applySearch(withTotal, searchTerm);
    const sorted = applySort(filtered, sortState.key, sortState.order);
    
    const tableBody = document.getElementById('inventory-table-body');
    const isUser = currentUserRole === 'user';
    const isManagerOrAdmin = currentUserRole === 'manager' || currentUserRole === 'admin';

    tableBody.innerHTML = sorted.length === 0 ? '<tr><td colspan="7" class="text-center p-8 text-gray-500">No items in inventory.</td></tr>' : sorted.map(item => {
        let statusClass = 'bg-green-100 text-green-800'; let statusText = 'In Stock';
        if (item.totalStock <= 0) { statusClass = 'bg-red-100 text-red-800'; statusText = 'Out of Stock'; } 
        else if (item.totalStock <= item.lowStockThreshold) { statusClass = 'bg-yellow-100 text-yellow-800'; statusText = 'Low Stock'; }
        
        const adminButtons = isManagerOrAdmin 
            ? `<button class="restock-item-btn text-purple-600 hover:text-purple-900" data-id="${item.id}" data-name="${item.name}"><i class="fas fa-plus-circle"></i> Restock</button>
               <button class="edit-item-btn text-blue-600 hover:text-blue-900" data-id="${item.id}"><i class="fas fa-edit"></i> Edit</button>
               <button class="delete-item-btn text-red-600 hover:text-red-900" data-id="${item.id}"><i class="fas fa-trash"></i> Delete</button>` 
            : '';

        return `<tr class="bg-white border-b hover:bg-gray-50">
            <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${item.name}</th>
            <td class="px-6 py-4">${item.category}</td><td class="px-6 py-4">${item.location1}</td>
            <td class="px-6 py-4">${item.location2}</td><td class="px-6 py-4 font-bold">${item.totalStock}</td>
            <td class="px-6 py-4"><span class="px-2 py-1 font-semibold leading-tight text-xs rounded-full ${statusClass}">${statusText}</span></td>
            <td class="px-6 py-4 text-center space-x-2">
                <button class="use-item-btn text-green-600 hover:text-green-900" data-id="${item.id}" data-name="${item.name}"><i class="fas fa-clipboard-check"></i> Use</button>
                ${adminButtons}
            </td>
        </tr>`;
    }).join('');
}
function updateDashboardCards(inventory) { /* ... existing code ... */ }
document.getElementById('inventory-table-body').addEventListener('click', (e) => { /* ... existing code ... */ });
document.getElementById('use-item-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
document.getElementById('restock-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });

// --- PURCHASES VIEW ---
const purchaseFilters = document.getElementById('purchases-filter-container');
purchaseFilters.addEventListener('input', () => renderPurchasesTable());
function renderPurchasesTable() { /* ... existing code ... */ }

// --- REPORTING & CSV EXPORT ---
function populateItemReportDropdown() { /* ... existing code ... */ }
function populateEmployeeDropdowns() { /* ... existing code ... */ }
function populateMachineDropdowns() { /* ... existing code ... */ }
function populateSupplierDropdowns() { /* ... existing code ... */ }
function exportToCsv(filename, data) { /* ... existing code ... */ }
document.getElementById('export-item-report-btn').addEventListener('click', () => exportToCsv(`item-report.csv`, activeReport.data));
document.getElementById('export-employee-report-btn').addEventListener('click', () => exportToCsv(`employee-report.csv`, activeReport.data));
document.getElementById('export-machine-report-btn').addEventListener('click', () => exportToCsv(`machine-report.csv`, activeReport.data));
document.getElementById('export-purchases-btn').addEventListener('click', () => { /* ... existing code ... */ });
document.getElementById('report-item-select').addEventListener('change', fetchAndRenderItemReport);
document.getElementById('report-employee-select').addEventListener('change', fetchAndRenderEmployeeReport);
document.getElementById('report-machine-select').addEventListener('change', fetchAndRenderMachineReport);
async function fetchAndRenderItemReport() { /* ... existing code ... */ }
async function fetchAndRenderEmployeeReport() { /* ... existing code ... */ }
async function fetchAndRenderMachineReport() { /* ... existing code ... */ }
function renderReportTable(tableBody, docs, reportType) { /* ... existing code ... */ }
document.getElementById('edit-log-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });
function refreshActiveReport() { /* ... existing code ... */ }

// --- TABLE MANAGER ---
document.getElementById('collection-selector').addEventListener('click', (e) => { /* ... existing code ... */ });
async function displayCollection(collectionName) { /* ... existing code ... */ }
function renderGenericTable(collectionName, docs) { /* ... existing code ... */ }
document.getElementById('generic-table-container').addEventListener('click', async e => { /* ... existing code ... */ });
document.getElementById('generic-edit-form').addEventListener('submit', async e => { /* ... existing code ... */ });

// --- UTILITY & MODAL CANCEL BUTTONS ---
document.getElementById('cancel-item-btn').addEventListener('click', () => hideModal(document.getElementById('item-modal')));
document.getElementById('cancel-use-item-btn').addEventListener('click', () => hideModal(document.getElementById('use-item-modal')));
document.getElementById('cancel-edit-log-btn').addEventListener('click', () => hideModal(document.getElementById('edit-log-modal')));
document.getElementById('cancel-generic-edit-btn').addEventListener('click', () => hideModal(document.getElementById('generic-edit-modal')));
document.getElementById('cancel-restock-btn').addEventListener('click', () => hideModal(document.getElementById('restock-modal')));
document.getElementById('add-item-btn').addEventListener('click', () => { /* ... existing code ... */ });
document.getElementById('item-form').addEventListener('submit', async (e) => { /* ... existing code ... */ });

