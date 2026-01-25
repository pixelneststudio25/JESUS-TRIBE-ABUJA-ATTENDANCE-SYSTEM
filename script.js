// === SCRIPT.JS - Frontend Logic for Attendance System ===

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz6TCFJrICjrsNau536OnDop38gav3XvYD_ZVkstF7OxoajM3cPoLzg3Tq1ByaXeHy6/exec"; 

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

// Validation functions (need to be accessible globally)
function isValidPhone(phone) {
    if (!phone) return true; // Empty is okay
    return /^0\d{10}$/.test(phone); // Starts with 0, then exactly 10 more digits
}

function isValidEmail(email) {
    if (email === '') return true; // Empty is okay
    const emailRegex = /^[^\s@]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
    return emailRegex.test(email);
}

// Date of Birth validation function
function isValidDOB(dob) {
    if (!dob) return true; // Empty is okay
    
    // Check format YYYY/MM/DD
    const regex = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!regex.test(dob)) return false;
    
    // Parse the date
    const parts = dob.split('/');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    
    // Check if date is valid
    if (date.getFullYear() !== year || 
        date.getMonth() !== month || 
        date.getDate() !== day) {
        return false;
    }
    
    // Check if date is in the future
    const today = new Date();
    if (date > today) return false;
    
    // Check if age is reasonable (not older than 150 years)
    const age = today.getFullYear() - year;
    if (age > 150) return false;
    
    return true;
}

// Set today's date in the header
function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);
}

// ==================== COMMUNICATE WITH GOOGLE APPS SCRIPT ====================
async function callBackend(action, data = {}) {
    try {
        // Create URL-encoded form data
        const params = new URLSearchParams();
        params.append('action', action);
        params.append('data', JSON.stringify(data));

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse JSON:', text);
            throw new Error('Invalid response from server');
        }
        
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
    console.log('Search Results:', result); // Debug log

    if (result.error) {
        searchResults.innerHTML = `<div class="member-item" style="color: #e74c3c;">Error: ${result.error}</div>`;
        return;
    }

    displaySearchResults(result, query);
}

// Helper function to get member property safely
function getMemberProperty(member, possibleKeys) {
    for (let key of possibleKeys) {
        if (member[key] !== undefined && member[key] !== null && member[key] !== '') {
            return member[key];
        }
    }
    return '';
}

function displaySearchResults(members, originalQuery) {
    console.log('Members data received:', members);
    
    // Debug: Check the structure of the first member if it exists
    if (members && members.length > 0) {
        console.log('First member object:', members[0]);
        console.log('All keys in first member:', Object.keys(members[0]));
        
        // Log each key-value pair
        for (let key in members[0]) {
            console.log(`Key: "${key}" = "${members[0][key]}"`);
        }
    }

    if (!members || members.length === 0) {
        console.log('No members found in search results');
        const escapedName = originalQuery.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        searchResults.innerHTML = `
            <div class="add-member-item" onclick="promptAddNewMember('${escapedName}')">
                <i class="fas fa-user-plus"></i>
                Add "${originalQuery}" as a new member
            </div>
        `;
        return;
    }

    // Display found members
    let html = '';
    let foundMembers = 0;
    
    members.forEach((member, index) => {
        console.log(`\n=== Processing member ${index} ===`);
        console.log('Full member object:', member);
        
        // DIRECT APPROACH: Check for MemberName specifically
        let memberName = '';
        if (member.MemberName !== undefined && member.MemberName !== null && member.MemberName !== '') {
            memberName = String(member.MemberName);
            console.log(`Found MemberName directly: "${memberName}"`);
        } else {
            // Fallback to other possible keys
            memberName = extractMemberName(member);
        }
        
        const memberPhone = member['Phone Number'] || member.Phone || member.phone || member.PHONE || '';
        const memberGender = member.Gender || member.gender || member.GENDER || '';
        const memberEmail = member.Email || member.email || member.EMAIL || member['EMAIL '] || '';
        const memberDOB = member['Date of Birth'] || member.DOB || member.dob || member['DATE OF BIRTH'] || '';

        console.log(`Extracted values - Name: "${memberName}", Phone: "${memberPhone}"`);

        // Only display if we found a name
        if (!memberName || memberName.trim() === '') {
            console.log(`Skipping member ${index} - no name found`);
            return; // Skip this member
        }
        
        foundMembers++;

        // Create display elements only if data exists
        const phoneDisplay = memberPhone ? `<div class="member-phone"><i class="fas fa-phone"></i> ${memberPhone}</div>` : '';
        const emailDisplay = memberEmail ? `<div class="member-email"><i class="fas fa-envelope"></i> ${memberEmail}</div>` : '';
        const genderDisplay = memberGender ? `<div class="member-gender"><i class="fas fa-user"></i> ${memberGender}</div>` : '';
        const dobDisplay = memberDOB ? `<div class="member-dob"><i class="fas fa-birthday-cake"></i> ${memberDOB}</div>` : '';

        // Escape special characters for the onclick attribute
        const escapedName = memberName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const escapedPhone = (memberPhone || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        html += `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-name">${memberName}</div>
                    ${phoneDisplay}
                    ${genderDisplay}
                    ${emailDisplay}
                    ${dobDisplay}
                </div>
                <button class="btn-attend" onclick="markMemberAttendance('${escapedName}', '${escapedPhone}')">
                    <i class="fas fa-check-circle"></i> Present
                </button>
            </div>
        `;
    });
    
    console.log(`\n=== Summary ===`);
    console.log(`Total members returned: ${members.length}`);
    console.log(`Members displayed: ${foundMembers}`);
    
    searchResults.innerHTML = html;

    if (html === '' || foundMembers === 0) {
        console.log('No valid members to display, showing "Add New" option');
        searchResults.innerHTML = `
            <div class="add-member-item" onclick="promptAddNewMember('${originalQuery.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                <i class="fas fa-user-plus"></i>
                Add "${originalQuery}" as a new member
            </div>
        `;
    } else {
        console.log('Successfully displayed members');
    }
}

// ==================== MARK ATTENDANCE FUNCTION ====================
async function markMemberAttendance(memberName, memberPhone) {
    // Get selected service
    const serviceSelect = document.getElementById('serviceSelect');
    const service = serviceSelect ? serviceSelect.value : 'First Service';
    
    const result = await callBackend('markAttendance', {
        memberName: memberName,
        memberPhone: memberPhone,
        service: service
    });

    if (result.error) {
        if (result.error.includes('already been marked present')) {
            // Show warning for duplicate, not error
            showSuccessModal(`Note: ${result.error}`);
        } else {
            showError(result.error);
        }
    } else {
        showSuccessModal(`Attendance marked for ${memberName} (${service})`);
        // Refresh attendance log for current filter
        const attendanceFilter = document.getElementById('attendanceFilter');
        const currentFilter = attendanceFilter ? attendanceFilter.value : 'All';
        loadTodaysAttendance(currentFilter);
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchInput.focus();
    }
}

// ==================== ADD NEW MEMBER ====================
function promptAddNewMember(name) {
    // Store all member data
    const memberData = {
        Name: name,
        DateJoined: new Date().toISOString().split('T')[0]
    };

    // Show gender modal
    window.pendingNewMember = { name: name, data: memberData };
    pendingMemberName.textContent = name;
    genderModal.style.display = 'flex';
}

// ==================== CONTINUE AFTER GENDER SELECTION ====================
function continueAddMember(gender) {
    // Close the gender modal
    genderModal.style.display = 'none';
    
    if (!window.pendingNewMember) {
        console.error('No pending member data found');
        showError('No member data found. Please try again.');
        return;
    }
    
    const name = window.pendingNewMember.name;
    const memberData = window.pendingNewMember.data;
    memberData.Gender = gender;
    
    // Clear the pending member data
    window.pendingNewMember = null;
    
    // Collect additional information
    collectMemberInfo(memberData, name);
}

// ==================== COLLECT MEMBER INFORMATION ====================
async function collectMemberInfo(memberData, name) {
    // Helper function to show a custom prompt
    function customPrompt(message, defaultValue = '') {
        return prompt(message, defaultValue);
    }
    
    // === PHONE NUMBER ===
    let phoneValid = false;
    let phoneAttempts = 0;
    while (!phoneValid && phoneAttempts < 3) {
        phoneAttempts++;
        let phone = customPrompt(`Add new member: "${name}"\n\nPhone Number (must start with 0, 11 digits total, Optional):\n\nLeave empty and click OK to skip.`, '');
        
        if (phone === null) {
            // User cancelled the entire process
            return;
        }
        
        phone = phone.trim();
        
        if (!phone) {
            memberData.Phone = ''; // Store as empty string
            phoneValid = true;
        } else if (!isValidPhone(phone)) {
            alert('Phone must start with 0 and be exactly 11 digits (e.g., 08012345678).\nPlease try again or leave empty to skip.');
            continue; // Ask again
        } else {
            memberData.Phone = phone;
            phoneValid = true;
        }
    }
    
    if (!phoneValid) {
        alert('Phone input cancelled. Using empty phone number.');
        memberData.Phone = '';
    }

    // === PARENT PHONE ===
    let parentPhoneValid = false;
    let parentPhoneAttempts = 0;
    while (!parentPhoneValid && parentPhoneAttempts < 3) {
        parentPhoneAttempts++;
        let parentPhone = customPrompt('Parent/Guardian Phone Number (must start with 0, 11 digits total, Optional):\n\nLeave empty and click OK to skip.', '');
        
        if (parentPhone === null) {
            memberData.ParentPhone = '';
            parentPhoneValid = true;
            continue;
        }
        
        parentPhone = parentPhone.trim();
        if (!parentPhone) {
            memberData.ParentPhone = '';
            parentPhoneValid = true;
        } else if (!isValidPhone(parentPhone)) {
            alert('Parent phone must start with 0 and be exactly 11 digits (e.g., 08012345678).\nPlease try again or leave empty to skip.');
            continue;
        } else {
            memberData.ParentPhone = parentPhone;
            parentPhoneValid = true;
        }
    }
    
    if (!parentPhoneValid) {
        alert('Parent phone input cancelled. Using empty parent phone.');
        memberData.ParentPhone = '';
    }

    // === EMAIL ===
    let emailValid = false;
    let emailAttempts = 0;
    while (!emailValid && emailAttempts < 3) {
        emailAttempts++;
        let email = customPrompt('Email (Optional, must be @gmail.com, @yahoo.com, or @outlook.com):\n\nLeave empty and click OK to skip.', '');
        
        if (email === null) {
            memberData.Email = '';
            emailValid = true;
            continue;
        }
        
        email = email.trim();
        if (!email) {
            memberData.Email = '';
            emailValid = true;
        } else if (!isValidEmail(email)) {
            const errorMsg = 'Invalid email format.\n\nAccepted domains:\n- @gmail.com\n- @yahoo.com\n- @outlook.com\n\nPlease enter a valid email or leave empty to skip.';
            alert(errorMsg);
            continue;
        } else {
            memberData.Email = email;
            emailValid = true;
        }
    }
    
    if (!emailValid) {
        alert('Email input cancelled. Using empty email.');
        memberData.Email = '';
    }

    // === ADDRESS ===
    let address = customPrompt('Address (optional):\n\nLeave empty and click OK to skip.', '');
    if (address === null) {
        memberData.Address = '';
    } else {
        memberData.Address = address.trim();
    }

    // === DATE OF BIRTH ===
    let dobValid = false;
    let dobAttempts = 0;
    while (!dobValid && dobAttempts < 3) {
        dobAttempts++;
        let dob = customPrompt('Date of Birth (Optional, format: YYYY/MM/DD):\n\nExample: 1990/05/15\nLeave empty and click OK to skip.', '');
        
        if (dob === null) {
            memberData.DateOfBirth = '';
            dobValid = true;
            continue;
        }
        
        dob = dob.trim();
        if (!dob) {
            memberData.DateOfBirth = '';
            dobValid = true;
        } else if (!isValidDOB(dob)) {
            const errorMsg = 'Invalid date format. Please use YYYY/MM/DD format.\n\n' +
                           'Examples:\n' +
                           '- 2000/01/15 (January 15, 2000)\n' +
                           '- 1995/12/31 (December 31, 1995)\n\n' +
                           'Or leave empty by clicking OK without typing.';
            alert(errorMsg);
            continue;
        } else {
            memberData.DateOfBirth = dob;
            dobValid = true;
        }
    }
    
    if (!dobValid) {
        alert('Date of birth input cancelled. Using empty date.');
        memberData.DateOfBirth = '';
    }

    // === FINAL: Send data to backend ===
    await addNewMember(memberData);
}

// ==================== ADD NEW MEMBER TO BACKEND ====================
async function addNewMember(memberData) {
    const result = await callBackend('addNewMember', memberData);
    
    if (result.error) {
        showError(`Failed to add member: ${result.error}`);
    } else {
        showSuccessModal(`Successfully added ${memberData.Name} as a new member!`);
        // Automatically mark attendance for the new member
        setTimeout(() => {
            markMemberAttendance(memberData.Name, memberData.Phone || '');
        }, 1000);
    }
}

// ==================== TODAY'S ATTENDANCE LOG ====================
async function loadTodaysAttendance(serviceFilter = 'All') {
    const result = await callBackend('getTodaysAttendance', { 
        service: serviceFilter 
    });

    if (result.error) {
        attendanceLog.innerHTML = `<div style="color: #e74c3c; text-align: center; padding: 20px;">Error loading attendance: ${result.error}</div>`;
        presentCount.textContent = '0';
        return;
    }

    displayTodaysAttendance(result, serviceFilter);
}

function displayTodaysAttendance(records, serviceFilter = 'All') {
    if (!records || records.length === 0) {
        attendanceLog.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <p>No attendance marked yet for today${serviceFilter !== 'All' ? ' in ' + serviceFilter : ''}.</p>
            </div>
        `;
        presentCount.textContent = '0';
        return;
    }

    let html = '';
    let filteredCount = 0;
    
    records.forEach(record => {
        // Skip if service filter doesn't match (unless it's "All")
        const recordService = getMemberProperty(record, ['Service', 'service', 'SERVICE']);
        if (serviceFilter !== 'All' && recordService !== serviceFilter) {
            return;
        }
        
        filteredCount++;
        
        let timeString = '--:--';
        const timestampStr = record.Timestamp || '';
        
        const timeMatch = timestampStr.match(/(\d{1,2}:\d{2}:\d{2})/);
        if (timeMatch) {
            const [hours, minutes] = timeMatch[1].split(':');
            const hour = parseInt(hours) % 12 || 12;
            const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
            timeString = `${hour}:${minutes} ${ampm}`;
        }

        // Get member name from various possible property names
        const memberName = getMemberProperty(record, ['MemberName', 'memberName', 'MEMBERNAME', 'Name', 'name']);
        
        // Add service badge if viewing all services
        const serviceClass = recordService ? recordService.replace(' ', '-').toLowerCase() : '';
        const serviceBadge = serviceFilter === 'All' && recordService 
            ? `<span class="service-badge ${serviceClass}">${recordService}</span>` 
            : '';

        html += `
            <div class="attendance-item">
                <div class="attendance-info">
                    <div class="attendance-name">${memberName || 'Unknown'} ${serviceBadge}</div>
                    <div class="attendance-time">
                        <i class="far fa-clock"></i> ${timeString}
                    </div>
                </div>
            </div>
        `;
    });

    attendanceLog.innerHTML = html || `
        <div class="empty-state">
            <i class="fas fa-clipboard-check"></i>
            <p>No attendance for ${serviceFilter} yet.</p>
        </div>
    `;
    presentCount.textContent = filteredCount.toString();
}

// ==================== MODAL CONTROLS ====================
function showSuccessModal(message) {
    successMessage.textContent = message;
    successModal.style.display = 'flex';
}

function showError(message) {
    alert(`Error: ${message}`);
}

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
        showOfferingMessage(result.message || 'Offering recorded successfully!', 'success');
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
    if (!offerings || offerings.length === 0) {
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
        const amount = offering.Amount || offering.amount || 0;
        const recordedBy = offering.RecordedBy || offering.recordedBy || 'Unknown';
        const time = offering.Timestamp || offering.timestamp;
        let timeString = '--:--';
        
        if (time) {
            const timeMatch = time.toString().match(/(\d{1,2}:\d{2}:\d{2})/);
            if (timeMatch) {
                const [hours, minutes] = timeMatch[1].split(':');
                const hour = parseInt(hours) % 12 || 12;
                const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM';
                timeString = `${hour}:${minutes} ${ampm}`;
            }
        }
        
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
        <div class="offering-item total-offering">
            <div style="font-weight: 600;">TOTAL OFFERING</div>
            <div class="offering-amount total">
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

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', function() {
    // Set up modal close events
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            successModal.style.display = 'none';
        });
    }
    
    // Update refresh button to respect service filter
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const attendanceFilter = document.getElementById('attendanceFilter');
            const currentFilter = attendanceFilter ? attendanceFilter.value : 'All';
            loadTodaysAttendance(currentFilter);
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
        if (event.target === genderModal) {
            genderModal.style.display = 'none';
            window.pendingNewMember = null;
        }
    });
    
    // Set up gender modal buttons
    if (genderModal) {
        genderModal.addEventListener('click', function(event) {
            const clickedButton = event.target.closest('.gender-btn');
            if (clickedButton) {
                const selectedGender = clickedButton.getAttribute('data-gender');
                continueAddMember(selectedGender);
            }
        });
    }
    
    if (cancelGenderBtn) {
        cancelGenderBtn.addEventListener('click', function() {
            genderModal.style.display = 'none';
            window.pendingNewMember = null;
        });
    }
    
    // Service filter change listener
    const attendanceFilter = document.getElementById('attendanceFilter');
    if (attendanceFilter) {
        attendanceFilter.addEventListener('change', function() {
            loadTodaysAttendance(this.value);
        });
    }
    
    // Add service badge styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .service-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 8px;
            vertical-align: middle;
        }
        .service-badge.first-service {
            background-color: #3498db;
            color: white;
        }
        .service-badge.second-service {
            background-color: #9b59b6;
            color: white;
        }
        .service-badge.combined-service {
            background-color: #2ecc71;
            color: white;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize page
    setCurrentDate();
    loadTodaysAttendance();
    loadTodaysOfferings();
    
    if (searchInput) {
        searchInput.focus();
    }
    
    console.log('Attendance System Initialized Successfully');
});