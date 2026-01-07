// === SCRIPT.JS - Frontend Logic for Attendance System ===

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwrRXnt3K5xHkGp867nWigO3MWovrGlIg5g8GvYIzB1cONancKtWxJ5wRlOqTDPS03C/exec"; 

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const attendanceLog = document.getElementById('attendanceLog');
const presentCount = document.getElementById('presentCount');
const refreshBtn = document.getElementById('refreshBtn');
const successModal = document.getElementById('successModal');
const closeModal = document.getElementById('closeModal');
const successMessage = document.getElementById('successMessage');
const currentDateEl = document.getElementById('currentDate');
const genderModal = document.getElementById('genderModal');
const pendingMemberName = document.getElementById('pendingMemberName');
const genderButtons = document.querySelectorAll('.gender-btn');
const cancelGenderBtn = document.getElementById('cancelGender');

// Set today's date in the header
function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);
}

// ==================== COMMUNICATE WITH GOOGLE APPS SCRIPT ====================
async function callBackend(action, data = {}) {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('data', JSON.stringify(data));

    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error calling backend:', error);
        showError('Network error. Please check your connection and Web App URL.');
        return { error: error.message };
    }
}

// ==================== SEARCH FUNCTIONALITY ====================
let searchTimeout;
searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length === 0) {
        searchResults.innerHTML = '';
        return;
    }

    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 300);
});

async function performSearch(query) {
    if (query.length < 2) return;

    searchResults.innerHTML = `
        <div class="member-item" style="justify-content: center; color: #7f8c8d;">
            <i class="fas fa-spinner fa-spin"></i> Searching...
        </div>
    `;

    const result = await callBackend('search', { searchTerm: query });

    if (result.error) {
        searchResults.innerHTML = `<div class="member-item" style="color: #e74c3c;">Error: ${result.error}</div>`;
        return;
    }

    displaySearchResults(result, query);
}

function displaySearchResults(members, originalQuery) {
    if (members.length === 0) {
        // No members found - show "Add New" option
        searchResults.innerHTML = `
            <div class="add-member-item" onclick="promptAddNewMember('${originalQuery}')">
                <i class="fas fa-user-plus"></i>
                Add "${originalQuery}" as a new member
            </div>
        `;
        return;
    }

    // Display found members
    let html = '';
    members.forEach(member => {
        // CORRECTED: Use the exact property names from your backend
        const memberName = member.NAME || '';
        const memberPhone = member['PHONE NUMBER'] || '';
        const memberGender = member.GENDER || '';
        const memberEmail = member['EMAIL '] || ''; 
        
        // Create display elements only if data exists
        const phoneDisplay = memberPhone ? `<div class="member-phone"><i class="fas fa-phone"></i> ${memberPhone}</div>` : '';
        const emailDisplay = memberEmail ? `<div class="member-email"><i class="fas fa-envelope"></i> ${memberEmail}</div>` : '';
        const genderDisplay = memberGender ? `<div class="member-gender"><i class="fas fa-user"></i> ${memberGender}</div>` : '';

        // Escape single quotes in the name for the onclick attribute
        const escapedName = memberName.replace(/'/g, "\\'");
        
        html += `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-name">${memberName}</div>
                    ${phoneDisplay}
                    ${genderDisplay}
                    ${emailDisplay}
                </div>
                <button class="btn-attend" onclick="markMemberAttendance('${escapedName}', '${memberPhone}')">
                    <i class="fas fa-check-circle"></i> Present
                </button>
            </div>
        `;
    });
    searchResults.innerHTML = html;
}
// ==================== ADD NEW MEMBER ====================
function promptAddNewMember(name) {
    // Helper function to validate phone (must start with 0 and be 11 digits)
    function isValidPhone(phone) {
        return /^0\d{10}$/.test(phone); // Starts with 0, then exactly 10 more digits
    }

    // UPDATED: Accepts multiple email domains
    function isValidEmail(email) {
        if (email === '') return true; // Empty is okay
        const emailRegex = /^[^\s@]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
        return emailRegex.test(email);
    }

    // Store all member data as we collect it
    const memberData = {
        Name: name,
        DateJoined: new Date().toISOString().split('T')[0]
    };

    // === STEP 1: PHONE NUMBER ===
    let phoneValid = false;
    while (!phoneValid) {
        let phone = prompt(`Add new member: "${name}"\n\nPhone Number (must start with 0 and be 11 digits, e.g., 08012345678):`, '');
        
        if (phone === null) {
            // User cancelled the entire process
            return;
        }
        
        phone = phone.trim();
        if (!phone) {
            alert('Phone number is required to add a new member.');
            continue; // Ask again
        }
        
        if (!isValidPhone(phone)) {
            alert('Phone must start with 0 and be exactly 11 digits (e.g., 08012345678).');
            continue; // Ask again
        }
        
        memberData.Phone = phone;
        phoneValid = true;
    }

    // === STEP 2: PARENT PHONE ===
    let parentPhoneValid = false;
    while (!parentPhoneValid) {
        let parentPhone = prompt('Parent/Guardian Phone Number (must start with 0 and be 11 digits, optional):', '');
        
        if (parentPhone === null) {
            // User cancelled - treat as empty and continue
            memberData.ParentPhone = '';
            parentPhoneValid = true;
            continue;
        }
        
        parentPhone = parentPhone.trim();
        if (!parentPhone) {
            // Empty is okay for optional field
            memberData.ParentPhone = '';
            parentPhoneValid = true;
            continue;
        }
        
        if (!isValidPhone(parentPhone)) {
            alert('Parent phone must start with 0 and be exactly 11 digits.');
            continue; // Ask again
        }
        
        memberData.ParentPhone = parentPhone;
        parentPhoneValid = true;
    }

    // === STEP 3: GENDER ===
    let genderValid = false;
    while (!genderValid) {
        let gender = prompt(`Select Gender for ${name}:\n\n1. Male\n2. Female\n\nEnter 1 or 2:`, '');
        
        if (gender === null) {
            // User cancelled the entire process
            return;
        }
        
        if (gender === '1') {
            memberData.Gender = 'Male';
            genderValid = true;
        } else if (gender === '2') {
            memberData.Gender = 'Female';
            genderValid = true;
        } else {
            alert('Invalid choice. Please enter 1 for Male or 2 for Female.');
        }
    }

    // === STEP 4: EMAIL (with better error handling) ===
    let emailValid = false;
    while (!emailValid) {
        let email = prompt('Email (must be @gmail.com, @yahoo.com, or @outlook.com, optional):', '');
        
        if (email === null) {
            // User wants to skip email - that's okay
            memberData.Email = '';
            emailValid = true;
            continue;
        }
        
        email = email.trim();
        if (!email) {
            // Empty is okay
            memberData.Email = '';
            emailValid = true;
            continue;
        }
        
        if (!isValidEmail(email)) {
            // IMPROVED: Show clear error message with acceptable domains
            const errorMsg = 'Invalid email. Please provide a valid email address ending with:\n' +
                           '- @gmail.com\n' +
                           '- @yahoo.com\n' +
                           '- @outlook.com\n\n' +
                           'Or leave it empty by clicking OK without typing anything.';
            alert(errorMsg);
            continue; // Ask again without aborting entire process
        }
        
        memberData.Email = email;
        emailValid = true;
    }

    // === STEP 5: ADDRESS ===
    let address = prompt('Address (optional):', '');
    if (address === null) {
        // User wants to skip address - that's okay
        memberData.Address = '';
    } else {
        memberData.Address = address.trim();
    }

    // === FINAL: Send data to backend ===
    addNewMember(memberData);
}
// ==================== MARK ATTENDANCE ====================
async function markMemberAttendance(name, phone) {
    const result = await callBackend('markAttendance', {
        memberName: name,
        memberPhone: phone
    });

    if (result.error) {
        alert(`Error: ${result.error}`);
        return;
    }

    showSuccessModal(`${name} has been checked in for today's service.`);
    
    searchInput.value = '';
    searchResults.innerHTML = '';
    loadTodaysAttendance();
}

// ==================== TODAY'S ATTENDANCE LOG ====================
async function loadTodaysAttendance() {
    const result = await callBackend('getTodaysAttendance');

    if (result.error) {
        attendanceLog.innerHTML = `<div style="color: #e74c3c; text-align: center; padding: 20px;">Error loading attendance: ${result.error}</div>`;
        presentCount.textContent = '0';
        return;
    }

    displayTodaysAttendance(result);
}

function displayTodaysAttendance(records) {
    if (records.length === 0) {
        attendanceLog.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <p>No attendance marked yet for today.</p>
            </div>
        `;
        presentCount.textContent = '0';
        return;
    }

    let html = '';
    records.forEach(record => {
        // SIMPLER FIX: Extract just the time part if the full timestamp is problematic
        let timeString = '--:--';
        const timestampStr = record.Timestamp || '';
        
        // Try to extract HH:MM:SS pattern from the timestamp string
        const timeMatch = timestampStr.match(/(\d{1,2}:\d{2}:\d{2})/);
        if (timeMatch) {
            const [hours, minutes] = timeMatch[1].split(':');
            // Convert to 12-hour format
            const hour = parseInt(hours) % 12 || 12;
            const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
            timeString = `${hour}:${minutes} ${ampm}`;
        }

        html += `
            <div class="attendance-item">
                <div class="attendance-name">${record.MemberName}</div>
                <div class="attendance-time">
                    <i class="far fa-clock"></i> ${timeString}
                </div>
            </div>
        `;
    });

    attendanceLog.innerHTML = html;
    presentCount.textContent = records.length.toString();
}

// ==================== MODAL CONTROLS ====================
function showSuccessModal(message) {
    successMessage.textContent = message;
    successModal.style.display = 'flex';
}

function showError(message) {
    alert(`Error: ${message}`);
}

// ==================== INITIALIZE ====================
closeModal.addEventListener('click', () => {
    successModal.style.display = 'none';
});

refreshBtn.addEventListener('click', loadTodaysAttendance);

window.addEventListener('click', (event) => {
    if (event.target === successModal) {
        successModal.style.display = 'none';
    }
});

setCurrentDate();
loadTodaysAttendance();

searchInput.focus();





