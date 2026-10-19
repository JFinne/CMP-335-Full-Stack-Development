// Base URL for the back-end API. Because Express serves this page too,
// a relative path works (no need for http://localhost:3040).
const API_URL = '/api/pieces';

// Grab the page elements we'll be working with.
const form = document.getElementById('add-form');
const formHeading = document.getElementById('add-heading');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const list = document.getElementById('piece-list');
const message = document.getElementById('message');
const emptyNote = document.getElementById('empty-note');

// The id of the piece being edited, or null when the form is in "add" mode.
// The same form is used for both adding and editing; this variable is how
// the submit handler knows whether to send a POST or a PUT.
let editingId = null;

// Ask the server for every piece, then redraw the table.
async function loadPieces() {
    try {
        const response = await fetch(API_URL);
        const pieces = await response.json();
        renderPieces(pieces);
    } catch (err) {
        showMessage('Could not load the library. Is the server running?', 'error');
    }
}

// Rebuild the table body from an array of pieces.
function renderPieces(pieces) {
    list.innerHTML = ''; // clear the old rows first

    // Show the "library is empty" note only when there's nothing to list.
    emptyNote.hidden = pieces.length > 0;

    for (const piece of pieces) {
        const row = document.createElement('tr');

        // Highlight the row currently being edited so it's easy to spot.
        if (piece.id === editingId) row.className = 'editing';

        // textContent (not innerHTML) so user input is shown as plain text,
        // which prevents anyone from injecting HTML/scripts into the page.
        for (const value of [piece.title, piece.composer, piece.dateComposed, piece.ensemble]) {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        }

        // Edit and Delete buttons for this row. The aria-labels tell screen
        // reader users which piece each button acts on.
        const actionCell = document.createElement('td');
        actionCell.className = 'actions';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.setAttribute('aria-label', `Edit ${piece.title}`);
        editBtn.addEventListener('click', () => startEditing(piece));
        actionCell.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.setAttribute('aria-label', `Delete ${piece.title}`);
        deleteBtn.addEventListener('click', () => deletePiece(piece));
        actionCell.appendChild(deleteBtn);

        row.appendChild(actionCell);
        list.appendChild(row);
    }
}

// Switch the form into "edit" mode and fill it with the piece's current values.
function startEditing(piece) {
    editingId = piece.id;

    form.title.value = piece.title;
    form.composer.value = piece.composer;
    form.dateComposed.value = piece.dateComposed;
    form.ensemble.value = piece.ensemble;

    formHeading.textContent = `Edit "${piece.title}"`;
    submitBtn.textContent = 'Save Changes';
    cancelBtn.hidden = false;
    showMessage('', '');

    // Move the user up to the form so they can start typing right away.
    form.scrollIntoView({ behavior: 'smooth' });
    form.title.focus();

    loadPieces(); // redraw so the row being edited gets highlighted
}

// Put the form back into "add" mode and clear it.
function stopEditing() {
    editingId = null;
    form.reset();
    formHeading.textContent = 'Add a Piece';
    submitBtn.textContent = 'Add Piece';
    cancelBtn.hidden = true;
}

// Cancel button: leave edit mode without saving anything.
cancelBtn.addEventListener('click', () => {
    stopEditing();
    showMessage('', '');
    loadPieces(); // removes the row highlight
});

// Send the form data to the server: a PUT if we're editing, a POST otherwise.
form.addEventListener('submit', async (event) => {
    event.preventDefault(); // stop the browser from reloading the page

    // Build the request body from the form fields (trim removes stray spaces).
    const pieceData = {
        title: form.title.value.trim(),
        composer: form.composer.value.trim(),
        dateComposed: form.dateComposed.value.trim(),
        ensemble: form.ensemble.value.trim(),
    };

    // Pick the URL and method based on which mode the form is in.
    const isEditing = editingId !== null;
    const url = isEditing ? `${API_URL}/${editingId}` : API_URL;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pieceData),
        });

        // On a 400 or 404, the server sends back an error message as plain text.
        if (!response.ok) {
            const errorText = await response.text();
            return showMessage(errorText, 'error');
        }

        const saved = await response.json();
        showMessage(isEditing ? `Updated "${saved.title}".` : `Added "${saved.title}".`, 'success');
        stopEditing();
        form.title.focus(); // ready for the next entry
        loadPieces();       // refresh the list so the change shows up
    } catch (err) {
        showMessage('Could not save the piece. Is the server running?', 'error');
    }
});

// Remove a piece from the library after the user confirms.
async function deletePiece(piece) {
    if (!confirm(`Delete "${piece.title}" by ${piece.composer}?`)) return;

    try {
        const response = await fetch(`${API_URL}/${piece.id}`, { method: 'DELETE' });

        if (!response.ok) {
            const errorText = await response.text();
            return showMessage(errorText, 'error');
        }

        // If the piece being edited was just deleted, there's nothing left
        // to save, so put the form back into "add" mode.
        if (piece.id === editingId) stopEditing();

        showMessage(`Deleted "${piece.title}".`, 'success');
        loadPieces(); // refresh the list so the piece disappears
    } catch (err) {
        showMessage('Could not delete the piece. Is the server running?', 'error');
    }
}

// Show a status message under the form. type is 'success' or 'error'
// and matches a CSS class that sets the color.
function showMessage(text, type) {
    message.textContent = text;
    message.className = type;
}

// Load the library as soon as the page opens.
loadPieces();
