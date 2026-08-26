const locationButton = document.querySelector('#location-button');
const locationOutput = document.querySelector('.location-output');

function showCoordinates(position) {
  const { latitude, longitude, accuracy } = position.coords;
  locationOutput.textContent = `LAT ${latitude.toFixed(5)} / LONG ${longitude.toFixed(5)} / ACC +/- ${Math.round(accuracy)}M`;
  locationButton.disabled = false;
  locationButton.textContent = 'Refresh location';
}

function showLocationError(error) {
  const messages = {
    1: 'Location permission was denied.',
    2: 'Your location could not be determined.',
    3: 'The location request timed out.'
  };
  locationOutput.textContent = messages[error.code] || 'Unable to retrieve your location.';
  locationButton.disabled = false;
  locationButton.textContent = 'Try again';
}

function getLocation() {
  if (!navigator.geolocation) {
    locationOutput.textContent = 'Geolocation is not supported by this browser.';
    return;
  }

  locationButton.disabled = true;
  locationButton.textContent = 'Requesting location...';
  locationOutput.textContent = 'Waiting for permission...';
  navigator.geolocation.getCurrentPosition(showCoordinates, showLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
}

locationButton.addEventListener('click', getLocation);
