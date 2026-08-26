const form = document.querySelector('#name-form');
const nameInput = document.querySelector('#name');
const greeting = document.querySelector('#greeting');

form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = nameInput.value.trim();
    if (!name) {
        greeting.textContent = 'Please enter your name.';
        nameInput.focus();
        return;
    }

    greeting.textContent = `Hello, ${name}!`;
});
