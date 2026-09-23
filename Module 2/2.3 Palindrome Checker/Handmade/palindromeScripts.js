// Store shared page elements and selectors once so the functions can reuse them.
const inputElement = document.getElementById("inputText");
const caseSensitivitySelector = 'input[name="caseSens"]:checked';
const algorithmSelector = 'input[name="algChoice"]:checked';
const resultLists = {
    1: document.getElementById("list1"),
    2: document.getElementById("list2"),
    3: document.getElementById("list3")
};

function textAlgorithm() {
    const caseSensitive = document.querySelector(caseSensitivitySelector);

    if (!caseSensitive) {
        alert("Please decide if you want your algorithm to be case sensitive or not!");
        return;
    }

    const originalText = inputElement.value.trim();

    if (originalText === "") {
        alert("Please enter a word!");
        return;
    }

    // Ternary format: condition ? value if true : value if false.
    const checkText = caseSensitive.value === "0"
        ? originalText.toLowerCase()
        : originalText;
    const displayText = sanitizeInput(originalText);
    const algChoice = document.querySelector(algorithmSelector);

    if (!algChoice) {
        alert("Please select an algorithm to use on your word!");
        return;
    }

    // Use the selected algorithm number to find the matching result area.
    const algorithmNumber = algChoice.value;
    const resultList = resultLists[algorithmNumber];
    const isPalindrome = runAlgorithm(algorithmNumber, checkText);

    addResult(resultList, displayText, isPalindrome);
    inputElement.value = "";
}

function runAlgorithm(algorithmNumber, checkText) {
    // Algorithm 1 compares the original text with its reversed version.
    if (algorithmNumber === "1") {
        const reverseText = checkText.split("").reverse().join("");
        return reverseText === checkText;
    }

    // Algorithm 2 compares characters from the outside toward the center.
    if (algorithmNumber === "2") {
        let left = 0;
        let right = checkText.length - 1;

        while (left < right) {
            if (checkText[left] !== checkText[right]) {
                return false;
            }

            left++;
            right--;
        }

        return true;
    }

    // Algorithm 3 performs the same comparison through recursive calls.
    if (algorithmNumber === "3") {
        function checkRecursively(left, right) {
            if (left >= right) {
                return true;
            }

            if (checkText[left] !== checkText[right]) {
                return false;
            }

            return checkRecursively(left + 1, right - 1);
        }

        return checkRecursively(0, checkText.length - 1);
    }

    return false;
}

function addResult(resultList, displayText, isPalindrome) {
    const newItem = document.createElement("div");

    // All algorithms use the same result format and styling.
    newItem.classList.add("list-item");
    newItem.textContent = `${displayText}: ${isPalindrome}`;
    resultList.appendChild(newItem);
}

function sanitizeInput(input) {
    // Remove HTML tags and characters that are not letters or spaces.
    input = input.replace(/<\/?[^>]+(>|$)/g, "");
    input = input.replace(/[^a-zA-Z\s]/g, "");
    return input;
}

function clearList(listNumber) {
    resultLists[listNumber].textContent = "";
}