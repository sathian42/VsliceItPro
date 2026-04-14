function openModal(section) {
    const sourceId = 'text-' + section;
    const sourceElement = document.getElementById(sourceId);
    
    if (sourceElement) {
        const content = sourceElement.innerHTML;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modalOverlay').style.display = 'flex';
    } else {
        console.error(`Could not find content for ID: ${sourceId}`);
    }
}

function closeModal(event, force = false) {
    // 1. If 'force' is true (the X button was clicked), just close it.
    if (force) {
        document.getElementById('modalOverlay').style.display = 'none';
        return;
    }

    // 2. If the user clicked the dark background (the overlay itself), close it.
    if (event && event.target.id === 'modalOverlay') {
        document.getElementById('modalOverlay').style.display = 'none';
    }
}

function copyUPI() {
    const upiId = "sathian100903@oksbi"; // Put your actual UPI ID here
    navigator.clipboard.writeText(upiId).then(() => {
        alert("UPI ID Copied!");
    });
}