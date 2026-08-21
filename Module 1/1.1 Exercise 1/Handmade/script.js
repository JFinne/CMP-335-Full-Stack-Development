function helloWorld() {
    if (document.querySelector('input').value === '') {
        alert('Please enter your name!');
        return;
    }
    let name = document.querySelector('input').value;
    name = sanitizeInput(name);
    document.getElementById('greeting').textContent = `Hello ${name}!`;
    }

function clearName() {
    document.querySelector('input').value = '';
    document.getElementById('greeting').textContent = '';
}

function sanitizeInput(input) {
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML;
}