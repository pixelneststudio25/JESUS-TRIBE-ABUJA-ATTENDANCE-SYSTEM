// === SCRIPT.JS - Frontend Logic for Attendance System ===

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwpYvYtIuGqf7V7S9VK_yeKQ6iS0K7M0KXObKfxRuG9_TohJcyUsPng2Mbzu4RXDFrX/exec"; 

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

    // Accepts multiple email domains
    function isValidEmail(email) {
        if (email === '') return true; // Empty is okay
        const emailRegex = /^[^\s@]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
        return emailRegex.test(email);
    }

    // Store all member data
    const memberData = {
        Name: name,
        DateJoined: new Date().toISOString().split('T')[0]
    };

    // === STEP 1: SHOW GENDER DROPDOWN MODAL ===
    // This uses the dropdown modal you created earlier
    window.pendingNewMember = { name: name, data: memberData };
    pendingMemberName.textContent = name;
    genderModal.style.display = 'flex';
}

// ==================== CONTINUE AFTER GENDER SELECTION ====================
function continueAddMember(gender) {
    // Close the gender modal
    genderModal.style.display = 'none';
    
    const name = window.pendingNewMember.name;
    const memberData = window.pendingNewMember.data;
    memberData.Gender = gender;
    
        // === STEP 2: PHONE NUMBER  ===
    let phoneValid = false;
    while (!phoneValid) {
        let phone = prompt(`Add new member: "${name}"\n\nPhone Number (must start with 0, Optional):`, '');
        
        if (phone === null) {
            // User cancelled the entire process
            return;
        }
        
        phone = phone.trim();
        
        // EMPTY IS NOW OKAY - user can skip by clicking OK without typing
        if (!phone) {
            memberData.Phone = ''; // Store as empty string
            phoneValid = true;
            continue; // Move to next step
        }
        
        // If they DID enter something, validate it
        if (!isValidPhone(phone)) {
            alert('If providing a phone, it must start with 0.');
            continue; // Ask again
        }
        
        memberData.Phone = phone;
        phoneValid = true;
    }

    // === STEP 3: PARENT PHONE ===
    let parentPhoneValid = false;
    while (!parentPhoneValid) {
        let parentPhone = prompt('Parent/Guardian Phone Number (must start with 0):', '');
        
        if (parentPhone === null) {
            memberData.ParentPhone = '';
            parentPhoneValid = true;
            continue;
        }
        
        parentPhone = parentPhone.trim();
        if (!parentPhone) {
            memberData.ParentPhone = '';
            parentPhoneValid = true;
            continue;
        }
        
        if (!isValidPhone(parentPhone)) {
            alert('Parent phone must start with 0 and be exactly 11 digits.');
            continue;
        }
        
        memberData.ParentPhone = parentPhone;
        parentPhoneValid = true;
    }

    // === STEP 4: EMAIL ===
    let emailValid = false;
    while (!emailValid) {
        let email = prompt('Email:', '');
        
        if (email === null) {
            memberData.Email = '';
            emailValid = true;
            continue;
        }
        
        email = email.trim();
        if (!email) {
            memberData.Email = '';
            emailValid = true;
            continue;
        }
        
        if (!isValidEmail(email)) {
            const errorMsg = 'Invalid email. Please provide a valid email address ending with:\n' +
                           '- @gmail.com\n' +
                           '- @yahoo.com\n' +
                           '- @outlook.com\n\n' +
                           'Or leave it empty by clicking OK without typing anything.';
            alert(errorMsg);
            continue;
        }
        
        memberData.Email = email;
        emailValid = true;
    }

    // === STEP 5: ADDRESS ===
    let address = prompt('Address (optional):', '');
    if (address === null) {
        memberData.Address = '';
    } else {
        memberData.Address = address.trim();
    }

    // === FINAL: Send data to backend ===
    addNewMember(memberData);
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
loadTodaysOfferings();

searchInput.focus();

// ==================== OFFERING FUNCTIONALITY ====================

// DOM Elements for offering
const offeringAmount = document.getElementById('offeringAmount');
const recordOfferingBtn = document.getElementById('recordOffering');
const offeringMessage = document.getElementById('offeringMessage');
const offeringList = document.getElementById('offeringList');

// Record offering
recordOfferingBtn.addEventListener('click', async () => {
    const amount = offeringAmount.value.trim();
    
    if (!amount || parseFloat(amount) <= 0) {
        showOfferingMessage('Please enter a valid amount.', 'error');
        return;
    }
    
    // Show loading
    recordOfferingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';
    recordOfferingBtn.disabled = true;
    
    const result = await callBackend('recordOffering', { amount: amount });
    
    if (result.error) {
        showOfferingMessage('Error: ' + result.error, 'error');
    } else {
        showOfferingMessage(result.message, 'success');
        offeringAmount.value = '';
        loadTodaysOfferings(); // Refresh the list
    }
    
    // Reset button
    recordOfferingBtn.innerHTML = '<i class="fas fa-save"></i> Record Offering';
    recordOfferingBtn.disabled = false;
});

// Load today's offerings
async function loadTodaysOfferings() {
    const result = await callBackend('getTodaysOfferings');
    
    if (result.error) {
        offeringList.innerHTML = `<div class="offering-error">Error loading offerings: ${result.error}</div>`;
        return;
    }
    
    displayTodaysOfferings(result);
}

function displayTodaysOfferings(offerings) {
    if (offerings.length === 0) {
        offeringList.innerHTML = `
            <div class="no-offering">
                <i class="fas fa-hand-holding-usd"></i>
                <p>No offerings recorded for today.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    let total = 0;
    
    offerings.forEach(offering => {
        const amount = offering.Amount || offering.amount;
        const recordedBy = offering.RecordedBy || offering.recordedBy;
        const time = new Date(offering.Timestamp || offering.timestamp);
        const timeString = time.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        total += parseFloat(amount);
        
        html += `
            <div class="offering-item">
                <div>
                    <div>Recorded by: ${recordedBy}</div>
                    <div class="offering-time">${timeString}</div>
                </div>
                <div class="offering-amount">₦${parseFloat(amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}</div>
            </div>
        `;
    });
    
    // Add total at the bottom
    html += `
        <div class="offering-item" style="border-top: 2px solid #FF6600; margin-top: 10px;">
            <div style="font-weight: 600;">TOTAL OFFERING</div>
            <div class="offering-amount" style="font-size: 1.4rem;">
                ₦${total.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </div>
        </div>
    `;
    
    offeringList.innerHTML = html;
}

function showOfferingMessage(message, type) {
    offeringMessage.textContent = message;
    offeringMessage.className = 'offering-message';
    offeringMessage.classList.add(`offering-${type}`);
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            offeringMessage.textContent = '';
            offeringMessage.className = 'offering-message';
        }, 5000);
    }
}

// ==================== GENDER MODAL SETUP ====================
// Wait for the page to fully load before setting up event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const genderModal = document.getElementById('genderModal');
    const pendingMemberName = document.getElementById('pendingMemberName');
    const cancelGenderBtn = document.getElementById('cancelGender');
    
    if (!genderModal || !pendingMemberName || !cancelGenderBtn) {
        console.error('ERROR: Could not find gender modal elements!');
        return;
    }
    
    // Use event delegation for gender buttons (works even if buttons are added later)
    genderModal.addEventListener('click', function(event) {
        const clickedButton = event.target.closest('.gender-btn');
        if (clickedButton) {
            const selectedGender = clickedButton.getAttribute('data-gender');
            console.log('Gender selected:', selectedGender);
            continueAddMember(selectedGender);
        }
    });
    
    // Cancel button
    cancelGenderBtn.addEventListener('click', function() {
        genderModal.style.display = 'none';
        window.pendingNewMember = null;
    });
    
    // Close modal when clicking outside
    genderModal.addEventListener('click', function(event) {
        if (event.target === genderModal) {
            genderModal.style.display = 'none';
            window.pendingNewMember = null;
        }
    });
    
    console.log('Gender modal setup complete');
});









