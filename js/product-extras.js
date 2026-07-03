/* ============================================================
   Vi Microsystems — Product Page Extras
   Accordion toggle + enquiry form (REAL BACKEND VERSION).
   Submitting now saves the message to the real database AND
   emails it to the business owner (once Gmail is configured on
   the backend) — instead of just opening the visitor's own
   email app, which meant messages could be lost if they never
   actually hit "send."
   ============================================================ */

// Same backend address used by account.js and cart.js.
var VI_API_BASE_URL = 'https://vi-microsystems-backend.onrender.com';

function toggleAccordion(headerEl) {
    var item = headerEl.parentElement;
    var wasOpen = item.classList.contains('open');

    // close any sibling accordion items in the same group for a cleaner UX
    var allItems = item.parentElement.querySelectorAll('.accordion-item');
    allItems.forEach(function (el) {
        el.classList.remove('open');
        var body = el.querySelector('.accordion-body');
        body.style.maxHeight = null;
        el.querySelector('.accordion-icon').classList.remove('fa-times');
        el.querySelector('.accordion-icon').classList.add('fa-plus');
    });

    if (!wasOpen) {
        item.classList.add('open');
        var body = item.querySelector('.accordion-body');
        body.style.maxHeight = body.scrollHeight + 'px';
        headerEl.querySelector('.accordion-icon').classList.remove('fa-plus');
        headerEl.querySelector('.accordion-icon').classList.add('fa-times');
    }
}

function submitEnquiry(event, productName) {
    event.preventDefault();

    var nameInput = document.getElementById('enq-name');
    var emailInput = document.getElementById('enq-email');
    var subjectInput = document.getElementById('enq-subject');
    var messageInput = document.getElementById('enq-message');
    var submitBtn = event.target.querySelector('button[type="submit"]');
    var originalBtnText = submitBtn.innerHTML;

    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    var subject = subjectInput.value.trim() || ('Enquiry: ' + productName);
    var message = messageInput.value.trim();

    // Remove any previous status message before trying again.
    var existingStatus = event.target.querySelector('.enq-status-msg');
    if (existingStatus) existingStatus.remove();

    function showStatus(text, isError) {
        var statusEl = document.createElement('p');
        statusEl.className = 'enq-status-msg';
        statusEl.style.fontSize = '13px';
        statusEl.style.marginTop = '10px';
        statusEl.style.color = isError ? '#e57373' : '#8bd17c';
        statusEl.textContent = text;
        event.target.appendChild(statusEl);
    }

    if (!name || !email || !message) {
        showStatus('Please fill in your name, email, and message.', true);
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    fetch(VI_API_BASE_URL + '/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, subject: subject, message: message, productName: productName })
    })
        .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
        .then(function (result) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;

            if (result.status >= 400) {
                showStatus(result.data.error || 'Could not send your enquiry. Please try again.', true);
                return;
            }

            // Handle server partial success configuration (Timeout occurred but data saved)
            if (result.status === 207 || (result.data && result.data.emailFailed)) {
                showStatus('Enquiry recorded! Note: Your message was saved to our database, but our email notification engine timed out. We will process it shortly.', false);
            } else {
                showStatus('Thank you! Your enquiry has been sent — we usually reply within 2-3 hours.', false);
            }

            nameInput.value = '';
            emailInput.value = '';
            subjectInput.value = '';
            messageInput.value = '';
        })
        .catch(function () {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            showStatus('Could not reach the server. Please check your internet connection and try again.', true);
        });
}