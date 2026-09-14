"use strict";
// --- DOM Elements ---
const lowInput = document.getElementById("low");
const highInput = document.getElementById("high");
const setRangeBtn = document.getElementById("setRange");
const manualInput = document.getElementById("manualInput");
const addManualBtn = document.getElementById("addManual");
const numbersListEl = document.getElementById("numbersList");
const meanEl = document.getElementById("mean");
const medianEl = document.getElementById("median");
const modeEl = document.getElementById("mode");

// --- State ---
let low = null;
let high = null;
let numbers = [];

// --- Utility Functions ---
function calculateMean(nums) {
    const total = nums.reduce((acc, n) => acc + n, 0);
    return total / nums.length;
}
function calculateMedian(nums) {
    const sorted = nums.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
function calculateMode(nums) {
    const freqMap = {};
    for (let i = 0; i < nums.length; i++) {
        const n = nums[i];
        freqMap[n] = (freqMap[n] || 0) + 1;
    }
    const freqs = Object.keys(freqMap).map(k => freqMap[Number(k)]);
    const maxFreq = Math.max.apply(null, freqs);
    const modes = Object.keys(freqMap)
        .filter(k => freqMap[Number(k)] === maxFreq)
        .map(Number);
    return modes.join(", ");
}
function updateDisplay() {
    numbersListEl.textContent = numbers.length ? numbers.join(", ") : "None yet";
    if (numbers.length) {
        meanEl.textContent = calculateMean(numbers).toFixed(2);
        medianEl.textContent = calculateMedian(numbers).toFixed(2);
        modeEl.textContent = calculateMode(numbers);
    }
    else {
        meanEl.textContent = medianEl.textContent = modeEl.textContent = "-";
    }
}

// --- Range Setup ---
setRangeBtn.addEventListener("click", function () {
    const lowVal = Number(lowInput.value);
    const highVal = Number(highInput.value);
    if (isNaN(lowVal) || isNaN(highVal) || lowVal >= highVal) {
        alert("Please enter a valid range (low must be less than high).");
        return;
    }
    low = lowVal;
    high = highVal;
    numbers = [];
    updateDisplay();
    alert("Range set: " + low + " - " + high);
});

// --- Manual Number Add ---
addManualBtn.addEventListener("click", function () {
    const value = Number(manualInput.value);
    if (low === null || high === null) {
        alert("Please set a valid range first.");
        return;
    }
    if (isNaN(value)) {
        alert("Please enter a valid number.");
        return;
    }
    if (value < low || value > high) {
        alert("Number must be within the range " + low + " - " + high + ".");
        return;
    }
    numbers.push(value);
    manualInput.value = "";
    updateDisplay();
});