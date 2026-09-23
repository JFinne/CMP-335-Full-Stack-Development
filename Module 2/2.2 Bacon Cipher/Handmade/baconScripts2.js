async function baconIpsum() {

    // Connecting HTML dropdowns to JS variables
    const paragraphs = document.getElementById("paragraphDropdown").value;
    const type = document.getElementById("typeDropdown").value;
    const algorithm = document.getElementById("algDropdown").value;

    // Connecting HTML text areas to JS variables
    const rawJson = document.getElementById("rawJson");
    const splitText = document.getElementById("splitText");
    const encryptedText = document.getElementById("encryptedText");

    // Empty our text areas before populating them with new data
    rawJson.textContent = "";
    splitText.textContent ="";
    encryptedText.textContent = "";

    // API call to Bacon Ipsum. Throws error if fails, waits for response if successful.
    try {
    const response = await fetch(
           `https://baconipsum.com/api/?type=${type}&paras=${paragraphs}&start-with-lorem=2&format=json`
    );
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json(); // Wait for the response to be converted to JSON

    // Raw JSON -> String -> Display in text area
    rawJson.textContent = JSON.stringify(data, null, 2);

    // Formatted paragraphs
    data.forEach(paragraph => {
        const p = document.createElement("p"); // Create a new <p> element for each paragraph
        p.textContent = paragraph; // Set the text content of the <p> element to the paragraph
        splitText.appendChild(p); // Append the <p> element to the splitText container
    });

    // Encryption methods
    const encryptData = document.getElementById("encryptedText"); // Get the container for the encrypted text
    const vigenereKey = "BACON"; // default key for Vigenère cipher
    const caesarShift = 12; // default shift for Caesar cipher

    // Encrypt each paragraph separately and append as its own <p>
    data.forEach(paragraph => {
        let encryptedParagraph; // Variable to hold the encrypted paragraph
        if (algorithm == 1 || algorithm === "1") {
            encryptedParagraph = vigenereEncrypt(paragraph, vigenereKey); // Encrypt using Vigenère cipher
        } else {
            encryptedParagraph = caesarEncrypt(paragraph, caesarShift); // Encrypt using Caesar cipher
        }

        const p = document.createElement("p"); // Create a new <p> element for the encrypted paragraph
        p.textContent = encryptedParagraph; // Set the text content of the <p> element to the encrypted paragraph
        encryptData.appendChild(p); // Append the <p> element to the encryptedText container
    });

    } catch (error) {
    alert("Something went wrong.")
    console.error("Error fetching Bacon Ipsum:", error); // Throws error both in an alert and in console log
    }

}

// Vigenère cipher function
function vigenereEncrypt(plainText, key) {
    let result = ""; 
    key = key.toUpperCase();
    let keyIndex = 0;
    for (let i = 0; i < plainText.length; i++) {
        let c = plainText[i];
        if (c.match(/[a-zA-Z]/)) { // Check if the character is a letter
            let isUpper = c === c.toUpperCase(); // Check if the character is uppercase
            let base = isUpper ? 65 : 97; // Set base ASCII code for uppercase or lowercase letters
            let pi = c.charCodeAt(0) - base; // Get the position of the character in the alphabet (0-25)
            let ki = key[keyIndex % key.length].charCodeAt(0) - 65; // Get the position of the key character in the alphabet (0-25)
            let ci = (pi + ki) % 26; // Calculate the new position of the character after applying the Vigenère cipher
            result += String.fromCharCode(base + ci); // Convert the new position back to a character and append it to the result
            keyIndex++; // Increment the key index only when a letter is processed
        } else {
            result += c; // Append non-letter characters (like spaces and punctuation) to the result without changing them
        }
    }
    return result;
}

// Caesar cipher function
function caesarEncrypt(plainText, shift) {
    let result = "";
    for (let i = 0; i < plainText.length; i++) {
        let c = plainText[i];
        if (c.match(/[a-zA-Z]/)) {
            let isUpper = c === c.toUpperCase();
            let base = isUpper ? 65 : 97;
            let pi = c.charCodeAt(0) - base;
            let ci = (pi + shift) % 26;
            result += String.fromCharCode(base + ci);
        } else {
            result += c;
        }
    }
    return result;
}