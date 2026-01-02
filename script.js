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
    // Store the name for use in the modal
    window.pendingNewMember = { name: name };
    
    // Set the name in the modal
    pendingMemberName.textContent = name;
    
    // Show the gender modal
    genderModal.style.display = 'flex';
}

// ==================== GENDER MODAL LOGIC ====================
// This function continues the process after gender is selected
function continueAddMember(gender) {
    // Close the gender modal
    genderModal.style.display = 'none';
    
    // Now continue with the rest of the prompts
    const name = window.pendingNewMember.name;
    
    // Helper function to validate phone (numbers only)
    function isValidPhone(phone) {
        return /^\d+$/.test(phone);
    }

    // Helper function to validate email (must be @gmail.com)
    function isValidEmail(email) {
        return email === '' || /^[^\s@]+@gmail\.com$/i.test(email);
    }

    let phone = prompt(`Add new member: "${name}"\n\nPlease enter their phone number (digits only):`, '');
    if (phone === null) return; // User cancelled

    phone = phone.trim();
    if (!phone) {
        alert('Phone number is required to add a new member.');
        return;
    }
    if (!isValidPhone(phone)) {
        alert('Invalid phone number. Please use digits only (0-9).');
        return;
    }

    // Parent phone (updated version with better cancel handling)
    let parentPhone = prompt('Parent/Guardian Phone Number:', '');
    if (parentPhone === null) {
        parentPhone = ''; // User cancelled optional field -> empty
    } else {
        parentPhone = parentPhone.trim();
        if (parentPhone && !isValidPhone(parentPhone)) {
            alert('Invalid parent phone number. Please use digits only (0-9).');
            return;
        }
    }

    let email = prompt('Email:', '');
    if (email !== null) {
        email = email.trim();
        if (email && !isValidEmail(email)) {
            alert('Invalid email. Please provide a valid @gmail.com address or leave it empty.');
            return;
        }
    } else {
        return;
    }

    let address = prompt('Address (optional):', '');

    // Call the function that sends data to Google Sheets
    addNewMember({
        Name: name,
        Phone: phone,
        ParentPhone: parentPhone || '',
        Gender: gender, // This now comes from the modal choice
        Email: email || '',
        Address: address || '',
        DateJoined: new Date().toISOString().split('T')[0]
    });
}

// Event listeners for gender buttons
genderButtons.forEach(button => {
    button.addEventListener('click', function() {
        const selectedGender = this.getAttribute('data-gender');
        continueAddMember(selectedGender);
    });
});

// Cancel button in gender modal
cancelGenderBtn.addEventListener('click', function() {
    genderModal.style.display = 'none';
    window.pendingNewMember = null; // Clear the pending data
});

async function addNewMember(memberData) {
    const result = await callBackend('addMember', memberData);

    if (result.error) {
        alert(`Error adding member: ${result.error}`);
        return;
    }

    showSuccessModal(`Added ${memberData.Name} to the community!`);
    markMemberAttendance(memberData.Name, memberData.Phone);
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




