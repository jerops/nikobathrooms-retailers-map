// Ensure this script runs after Webflow has initialized all dynamic content.
window.Webflow ||= [];
window.Webflow.push(() => {
    console.info("Script started: Webflow.push initiated. (No DOM reordering)");

    // Select all sidebar location item elements
    const locationItemSidebarElements = document.querySelectorAll("[location-item-sidebar]");
    console.info(`Found ${locationItemSidebarElements.length} elements with [location-item-sidebar] attribute.`);

    // parentElement is now only used for logging purposes, not for reordering
    const parentElement = document.querySelector("[location-list-sidebar]");
    if (parentElement) {
        console.info("Found parent element [location-list-sidebar].");
    } else {
        console.warn("Parent element [location-list-sidebar] NOT FOUND. This script will not sort but will still display distances if elements are found.");
    }

    // Function to hide all distance display elements in the sidebar (CSS controlled)
    const hideAllDistanceElements = () => {
        locationItemSidebarElements.forEach(locationElement => {
            const distanceDisplayElement = locationElement.querySelector("[location-distance-sidebar]");
            if (distanceDisplayElement) {
                distanceDisplayElement.classList.remove('is--visible'); // Remove visibility class
                // Ensure default display is block if it's set to hidden inline by previous logic
                distanceDisplayElement.style.display = ''; 
            }
        });
        console.info("All distance display elements hidden (via CSS class) due to geolocation settings.");
    };

    // Function to show all distance display elements in the sidebar (CSS controlled)
    const showAllDistanceElements = () => {
        locationItemSidebarElements.forEach(locationElement => {
            const distanceDisplayElement = locationElement.querySelector("[location-distance-sidebar]");
            if (distanceDisplayElement) {
                // Ensure default display is block if it's set to hidden inline by previous logic
                distanceDisplayElement.style.display = ''; 
                distanceDisplayElement.classList.add('is--visible'); // Add visibility class for smooth fade-in
            }
        });
    };

    // Function to update distances with a fallback message and hide elements if permission is denied
    // This function no longer sorts the DOM.
    const updateDistancesWithFallback = (message, hideElements = false) => {
        console.warn(`Updating distances with fallback: "${message}". Hide elements: ${hideElements}`);
        locationItemSidebarElements.forEach(locationElement => {
            const distanceDisplayElement = locationElement.querySelector("[location-distance-sidebar]");
            if (distanceDisplayElement) {
                distanceDisplayElement.textContent = message;
                locationElement.setAttribute('data-distance', 'Infinity'); // Still set for potential external sorting
            }
        });
        
        if (hideElements) {
            hideAllDistanceElements();
        } else {
            // If not hiding, show them after a small delay for the text to update
            setTimeout(showAllDistanceElements, 100); 
        }

        console.info("Distances updated with fallback values. (No DOM reordering performed).");
    };

    // Function to get user's current location automatically on page load
    const getUserLocationAutomatically = async () => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by this browser. Cannot calculate distances.");
            updateDistancesWithFallback("Not Supported", true);
            return;
        }

        try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            console.info(`Geolocation permission state: ${permissionStatus.state}`);

            if (permissionStatus.state === 'prompt') {
                alert("Please share your location to calculate closest retailers.");
            } else if (permissionStatus.state === 'denied') {
                console.warn("Geolocation permission already denied by user. Not attempting getCurrentPosition.");
                updateDistancesWithFallback("Permission Denied", true); // Immediately hide elements
                return; // Exit here if already denied
            }

            console.info("Attempting to get user location with navigator.geolocation.getCurrentPosition...");

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;
                    const userLocation = turf.point([userLng, userLat]);
                    console.info(`User location obtained: Lat ${userLat.toFixed(4)}, Lng ${userLng.toFixed(4)}`);
                    calculateAndDisplayDistances(userLocation);
                },
                (error) => {
                    let errorMessage = "Geolocation error: ";
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "Location access denied by user. Distances cannot be calculated.";
                            console.warn(errorMessage);
                            updateDistancesWithFallback("Permission Denied", true);
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += "Location information is unavailable.";
                            console.warn(errorMessage);
                            updateDistancesWithFallback("N/A", false);
                            break;
                        case error.TIMEOUT:
                            errorMessage += "The request to get user location timed out.";
                            console.warn(errorMessage);
                            updateDistancesWithFallback("Timeout", false);
                            break;
                        case error.UNKNOWN_ERROR:
                            errorMessage += "An unknown error occurred.";
                            console.error(errorMessage);
                            updateDistancesWithFallback("Error", false);
                            break;
                    }
                    console.error("Geolocation error details:", error);
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 7000,
                    maximumAge: 0
                }
            );
        } catch (queryError) {
            console.error("Error querying geolocation permission:", queryError);
            updateDistancesWithFallback("Permission Query Error", true);
        }
    };

    const calculateAndDisplayDistances = (userLocation) => {
        // Show all distance elements after a short delay for text to update
        setTimeout(showAllDistanceElements, 100); 
        let calculationSuccessfulCount = 0;

        locationItemSidebarElements.forEach((locationElement, index) => {
            const nameEl = locationElement.querySelector("[location-name-sidebar]"); 
            const latEl = locationElement.querySelector("[location-latitude-sidebar]");
            const longEl = locationElement.querySelector("[location-longitude-sidebar]");
            const distanceDisplayElement = locationElement.querySelector("[location-distance-sidebar]");

            try {
                if (!latEl || !longEl || !nameEl || !distanceDisplayElement) {
                    console.warn(`Skipping location ${nameEl?.textContent.trim() || 'Unknown'} (index ${index}): Missing one or more required sub-elements.`);
                    throw new Error("Missing required sub-elements");
                }

                const locationLat = parseFloat(latEl.textContent.trim());
                const locationLong = parseFloat(longEl.textContent.trim());

                if (isNaN(locationLat) || isNaN(locationLong) || locationLat < -90 || locationLat > 90 || locationLong < -180 || locationLong > 180) {
                    console.warn(`Invalid coordinates for location: ${nameEl.textContent.trim()} (Lat: ${latEl.textContent.trim()}, Lng: ${longEl.textContent.trim()}). Skipping calculation.`);
                    throw new Error("Invalid coordinate values");
                }
                
                if (typeof turf === 'undefined' || !turf.point || !turf.distance) {
                    console.error("Turf.js functions (turf.point, turf.distance) are not available. Make sure Turf.js script is loaded correctly in HTML.");
                    throw new Error("Turf.js not fully loaded");
                }

                const destination = turf.point([locationLong, locationLat]);
                const options = { units: 'kilometers' }; 
                const distance = turf.distance(userLocation, destination, options);

                distanceDisplayElement.textContent = `${distance.toFixed(2)} km`; 
                locationElement.setAttribute('data-distance', distance.toFixed(2)); 
                calculationSuccessfulCount++;

            } catch (error) {
                console.error(`Error processing location ${nameEl?.textContent.trim() || 'Unknown'} (index ${index}):`, error);
                if (distanceDisplayElement) {
                    distanceDisplayElement.textContent = "Calculation Error";
                    locationElement.setAttribute('data-distance', 'Infinity'); 
                }
            }
        });

        console.info(`Successfully calculated distances for ${calculationSuccessfulCount} out of ${locationItemSidebarElements.length} locations.`);
        console.info("Distances calculated. (No DOM reordering performed)."); // Changed log message
    };

    // Initial call to start the process on page load
    getUserLocationAutomatically();
});
