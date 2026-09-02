const surveyForm = document.querySelector("#survey-form");
const usernameInput = document.querySelector("#username");
const messageInput = document.querySelector("#message");

function hasUnsafeMarkup(value) {
	return /[<>]/.test(value);
}

surveyForm.addEventListener("submit", (event) => {
	event.preventDefault();

	const username = usernameInput.value.trim();
	const selectedRoles = document.querySelectorAll("input[name='roles[]']:checked");
	const rosterSelected = document.querySelector("input[name='roster']:checked");
	const contactPermission = document.querySelector("#contact-permission").checked;

	if (username === "") {
		alert("Please enter your username.");
		usernameInput.focus();
		return;
	}

	if (hasUnsafeMarkup(username) || hasUnsafeMarkup(messageInput.value)) {
		alert("Please remove angle brackets from the text fields.");
		usernameInput.focus();
		return;
	}

	if (surveyForm.elements.rank.value === "") {
		alert("Please select your rank.");
		surveyForm.elements.rank.focus();
		return;
	}

	if (!rosterSelected) {
		alert("Please select a roster.");
		return;
	}

	if (selectedRoles.length === 0) {
		alert("Please select at least one role.");
		return;
	}

	if (!contactPermission) {
		alert("Please indicate whether we may contact you.");
		return;
	}

	alert("Your survey was submitted successfully!");
	surveyForm.reset();
});
