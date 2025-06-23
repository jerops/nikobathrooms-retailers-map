/**
 * Niko Bathrooms Mapbox Integration - WORKING VERSION
 * Fixed: Popup positioning, active states, first click navigation, First click centering
 */

(function() {
    'use strict';
    
    const CONFIG = {
        mapbox: {
            accessToken: "pk.eyJ1IjoiamVyb3BzIiwiYSI6ImNsbnVvbm8yajBqbGkycW5zaDBycjU1dWYifQ.IeXQv2RkJodqAQW8iG6LcA",
            style: "mapbox://styles/mapbox/light-v11",
            irelandBounds: [[-10.5, 51.2], [-5.5, 55.5]],
            irelandCenter: [-7.6921, 53.1424],
            dublinCenter: [-6.2603, 53.3498]
        },
        animation: {
            globeViewDuration: 200,
            zoomDuration: 1200,
            zoomCurve: 1.8,
            zoomSpeed: 1.5
        },
        ui: {
            loadingTimeout: 10000,
            popupCloseDelay: 100,
            resizeDebounce: 250
        },
        geolocation: {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 60000,
            dublinZoom: 11,
            irelandZoom: 6.5
        },
        brand: {
            primary: "#4A9B9B",
            primaryDark: "#357575",
            primaryLight: "#6BB3B3",
            white: "#ffffff",
            dark: "#2A2A2A"
        }
    };

    const state = {
        initialized: false,
        mapLoaded: false,
        animationComplete: false,
        userLocation: null,
        currentActiveLocation: null,
        stores: { type: "FeatureCollection", features: [] },
        elements: {
            locationItemSidebar: [],
            outerCardWrapper: null,
            innerCardWrapper: null,
            locationMapCardWrapper: null,
            locationMapCardItem: [],
            locationMapCardCloseBtn: []
        }
    };

    const utils = {
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        log: function(level, message, data = null) {
            const timestamp = new Date().toISOString();
            const prefix = `[Niko Mapbox ${level.toUpperCase()}] ${timestamp}:`;
            
            switch(level) {
                case 'error':
                    console.error(prefix, message, data);
                    break;
                case 'warn':
                    console.warn(prefix, message, data);
                    break;
                case 'info':
                    console.info(prefix, message, data);
                    break;
                default:
                    console.log(prefix, message, data);
            }
        },

        isValidCoordinate: function(lat, lng) {
            return !isNaN(lat) && !isNaN(lng) && 
                   lat >= -90 && lat <= 90 && 
                   lng >= -180 && lng <= 180;
        },

        calculateDistance: function(lat1, lng1, lat2, lng2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                     Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },

        createLoadingIndicator: function() {
            const loader = document.createElement('div');
            loader.id = 'mapbox-loader';
            loader.innerHTML = `
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(255, 255, 255, 0.95);
                    padding: 32px;
                    border: 2px solid ${CONFIG.brand.primary};
                    border-radius: 12px;
                    z-index: 1000;
                    font-family: Arial, sans-serif;
                    font-size: 16px;
                    color: ${CONFIG.brand.dark};
                    box-shadow: 0 8px 32px rgba(74, 155, 155, 0.2);
                    text-align: center;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid ${CONFIG.brand.primary};
                        border-radius: 50%;
                        animation: nikoSpin 1s linear infinite;
                        margin: 0 auto 16px;
                    "></div>
                    <div style="font-weight: 600; color: ${CONFIG.brand.primary};">
                        Loading Niko Bathrooms locations...
                    </div>
                </div>
                <style>
                    @keyframes nikoSpin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;
            return loader;
        },

        removeLoadingIndicator: function() {
            const loader = document.getElementById('mapbox-loader');
            if (loader) {
                loader.remove();
            }
        }
    };

    const errorHandler = {
        handleMapboxError: function(error) {
            utils.log('error', 'Mapbox error occurred', error);
            
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        background: #f8f9fa;
                        color: ${CONFIG.brand.dark};
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 40px;
                    ">
                        <div>
                            <div style="
                                width: 60px;
                                height: 60px;
                                background: ${CONFIG.brand.primary};
                                border-radius: 50%;
                                margin: 0 auto 20px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-size: 24px;
                                font-weight: bold;
                            ">!</div>
                            <h3 style="margin: 0 0 12px 0; color: ${CONFIG.brand.dark};">Map Loading Error</h3>
                            <p style="margin: 0; color: #666;">Please refresh the page or contact Niko Bathrooms support.</p>
                        </div>
                    </div>
                `;
            }
        },

        handleDataError: function(error, context) {
            utils.log('error', `Data error in ${context}`, error);
        },

        handleGeolocationError: function(error) {
            utils.log('warn', 'Geolocation error', {
                code: error.code,
                message: error.message
            });
            return false;
        }
    };

    const geolocationManager = {
        getCurrentPosition: function() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    utils.log('warn', 'Geolocation not supported');
                    reject(new Error('Geolocation not supported'));
                    return;
                }

                utils.log('info', 'Requesting user location...');
                
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLocation = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        };
                        
                        utils.log('info', 'User location obtained', userLocation);
                        state.userLocation = userLocation;
                        resolve(userLocation);
                    },
                    (error) => {
                        errorHandler.handleGeolocationError(error);
                        reject(error);
                    },
                    CONFIG.geolocation
                );
            });
        },

        isLocationInIreland: function(lat, lng) {
            const bounds = CONFIG.mapbox.irelandBounds;
            const inBounds = lat >= bounds[0][1] && lat <= bounds[1][1] && 
                           lng >= bounds[0][0] && lng <= bounds[1][0];
            
            utils.log('info', `Location check: ${lat}, ${lng} - In Ireland: ${inBounds}`);
            return inBounds;
        },

        isLocationInDublin: function(lat, lng) {
            const dublinLat = CONFIG.mapbox.dublinCenter[1];
            const dublinLng = CONFIG.mapbox.dublinCenter[0];
            const distance = utils.calculateDistance(lat, lng, dublinLat, dublinLng);
            
            const inDublin = distance <= 25;
            utils.log('info', `Dublin check: Distance ${distance.toFixed(2)}km - In Dublin: ${inDublin}`);
            return inDublin;
        }
    };

    const mapManager = {
        map: null,

        init: function() {
            try {
                utils.log('info', 'Starting Niko Bathrooms map initialization');
                
                if (!this.checkPrerequisites()) {
                    return false;
                }

                const mapContainer = document.getElementById('map');
                const loader = utils.createLoadingIndicator();
                mapContainer.appendChild(loader);

                this.createMap();
                return true;

            } catch (error) {
                errorHandler.handleMapboxError(error);
                return false;
            }
        },

        checkPrerequisites: function() {
            if (typeof mapboxgl === 'undefined') {
                utils.log('error', 'Mapbox GL JS not loaded');
                return false;
            }

            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                utils.log('error', 'Map container not found');
                return false;
            }

            if (!CONFIG.mapbox.accessToken) {
                utils.log('error', 'Mapbox access token not configured');
                return false;
            }

            return true;
        },

        createMap: function() {
            const mapContainer = document.getElementById('map');
            mapContainer.innerHTML = '';

            mapboxgl.accessToken = CONFIG.mapbox.accessToken;

            this.map = new mapboxgl.Map({
                container: "map",
                style: CONFIG.mapbox.style,
                center: [0, 20],
                zoom: 0.8,
                pitch: 0,
                bearing: 0,
                antialias: true,
                preserveDrawingBuffer: true,
                trackResize: true,
                dragRotate: false,
                touchZoomRotate: {
                    around: 'center'
                }
            });

            this.map.on('error', (e) => {
                errorHandler.handleMapboxError(e.error);
            });

            this.map.on('load', () => {
                utils.removeLoadingIndicator();
                state.mapLoaded = true;
                utils.log('info', 'Niko Bathrooms map loaded successfully');
                this.onMapLoad();
            });

            this.map.on('render', () => {
                this.ensureResponsive();
            });

            state.initialized = true;
        },

        ensureResponsive: function() {
            const canvas = this.map.getCanvas();
            if (canvas) {
                canvas.style.maxWidth = 'none';
                canvas.style.width = '100%';
            }
        },

        onMapLoad: function() {
            try {
                this.ensureResponsive();
                
                dataManager.loadLocationData();
                
                uiManager.hideAllCards();
                uiManager.hideCardWrapper();
                
                if (state.stores.features.length > 0) {
                    this.addNikoBrandedLayers();
                    utils.log('info', `Added ${state.stores.features.length} Niko Bathrooms locations to map`);
                }
                
                this.setupInteractions();
                
                setTimeout(() => {
                    this.startFastAnimationSequence();
                }, 1000);
                
                this.setupResponsiveHandling();

            } catch (error) {
                errorHandler.handleDataError(error, 'map load');
            }
        },

        addNikoBrandedLayers: function() {
            this.map.addLayer({
                id: "locations-glow",
                type: "circle",
                source: {
                    type: "geojson",
                    data: state.stores
                },
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 12, 10, 20, 15, 28
                    ],
                    "circle-color": CONFIG.brand.primary,
                    "circle-opacity": 0.15,
                    "circle-stroke-width": 0
                }
            });

            this.map.addLayer({
                id: "locations",
                type: "circle",
                source: {
                    type: "geojson",
                    data: state.stores
                },
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 6, 10, 10, 15, 14
                    ],
                    "circle-stroke-width": 3,
                    "circle-color": CONFIG.brand.primary,
                    "circle-opacity": 0.9,
                    "circle-stroke-color": CONFIG.brand.white,
                    "circle-stroke-opacity": 1
                }
            });

            this.map.addLayer({
                id: "locations-hover",
                type: "circle",
                source: {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [] }
                },
                paint: {
                    "circle-radius": [
                        "interpolate", ["linear"], ["zoom"],
                        5, 8, 10, 12, 15, 16
                    ],
                    "circle-color": CONFIG.brand.primaryLight,
                    "circle-opacity": 0.8,
                    "circle-stroke-width": 4,
                    "circle-stroke-color": CONFIG.brand.white,
                    "circle-stroke-opacity": 1
                }
            });
        },

        setupInteractions: function() {
            if (!this.map.getLayer('locations')) {
                utils.log('warn', 'Locations layer not found, skipping interaction setup');
                return;
            }

            this.map.on('click', 'locations', (e) => {
                e.preventDefault();
                utils.log('info', 'Map location clicked - event triggered');
                this.handleLocationClick(e);
            });

            this.map.on('mouseenter', 'locations', (e) => {
                this.map.getCanvas().style.cursor = 'pointer';
                
                if (e.features.length > 0) {
                    this.map.getSource('locations-hover').setData({
                        type: "FeatureCollection",
                        features: [e.features[0]]
                    });
                }
            });

            this.map.on('mouseleave', 'locations', () => {
                this.map.getCanvas().style.cursor = '';
                
                this.map.getSource('locations-hover').setData({
                    type: "FeatureCollection",
                    features: []
                });
            });

            this.map.dragPan.enable();
            this.map.scrollZoom.enable();
            this.map.doubleClickZoom.enable();

            utils.log('info', 'Niko Bathrooms map interactions setup complete');
        },

        handleLocationClick: function(e) {
            try {
                // Wait for map to be ready before processing map click
                if (!state.mapLoaded || !state.animationComplete) {
                    utils.log('info', 'Map not ready for map click, waiting...');
                    setTimeout(() => {
                        this.handleLocationClick(e); // Re-attempt after delay
                    }, 500); // Wait 500ms and retry
                    return;
                }

                const feature = e.features[0];
                const locationID = feature.properties.id;
                const coordinates = feature.geometry.coordinates;

                utils.log('info', `Niko Bathrooms location clicked: ${locationID}`);

                uiManager.updateActiveLocation(locationID);
                uiManager.showNikoBrandedPopup(e);
                uiManager.showLocationCard(locationID);
                this.zoomToLocation(coordinates, true);

            } catch (error) {
                errorHandler.handleDataError(error, 'location click');
            }
        },

        zoomToLocation: function(coordinates, shouldCenter = true) {
            if (!this.map || !coordinates) return;

            const flyToOptions = {
                center: coordinates, // Always target the actual coordinates
                zoom: 13,
                speed: 1.5,
                curve: 1.2,
                essential: true
            };

            // Apply an offset if shouldCenter is true and screen width is greater than 768px
            // This shifts the map's center to account for the sidebar/card on the right.
            // The card has a max-width of 360px, so we offset by half of that to center the point
            // in the remaining visible map area.
            if (shouldCenter && window.innerWidth > 768) {
                const cardWidthPx = 360; // Max width of the card as defined in displayCard
                flyToOptions.offset = [-cardWidthPx / 2, 0]; // Shift left by half the card's width
            }

            this.map.flyTo(flyToOptions);
        },


        startFastAnimationSequence: function() {
            utils.log('info', 'Starting Niko Bathrooms animation sequence');
            
            geolocationManager.getCurrentPosition()
                .then((userLocation) => {
                    if (geolocationManager.isLocationInIreland(userLocation.latitude, userLocation.longitude)) {
                        if (geolocationManager.isLocationInDublin(userLocation.latitude, userLocation.longitude)) {
                            utils.log('info', 'User is in Dublin area, zooming to user location');
                            this.fastAnimateToUserLocation(userLocation);
                        } else {
                            utils.log('info', 'User is in Ireland but not Dublin, zooming to user area');
                            this.fastAnimateToUserLocation(userLocation);
                        }
                    } else {
                        utils.log('info', 'User is outside Ireland, zooming to Ireland overview');
                        this.fastAnimateToIreland();
                    }
                })
                .catch((error) => {
                    utils.log('info', 'Geolocation failed, using Ireland overview', error);
                    this.fastAnimateToIreland();
                });
        },

        fastAnimateToUserLocation: function(userLocation) {
            setTimeout(() => {
                utils.log('info', 'Fast animating to user location');
                
                const zoom = geolocationManager.isLocationInDublin(userLocation.latitude, userLocation.longitude) 
                    ? CONFIG.geolocation.dublinZoom 
                    : 9;
                
                this.map.flyTo({
                    center: [userLocation.longitude, userLocation.latitude],
                    zoom: zoom,
                    duration: CONFIG.animation.zoomDuration,
                    curve: CONFIG.animation.zoomCurve,
                    speed: CONFIG.animation.zoomSpeed,
                    essential: true
                });
                
                setTimeout(() => {
                    this.map.setMaxBounds(CONFIG.mapbox.irelandBounds);
                    state.animationComplete = true;
                    this.ensureResponsive();
                    utils.log('info', 'Fast animation to user location complete');
                }, CONFIG.animation.zoomDuration + 100);
                
            }, CONFIG.animation.globeViewDuration);
        },

        fastAnimateToIreland: function() {
            setTimeout(() => {
                utils.log('info', 'Fast animating to Ireland');
                
                this.map.flyTo({
                    center: CONFIG.mapbox.irelandCenter,
                    zoom: CONFIG.geolocation.irelandZoom,
                    duration: CONFIG.animation.zoomDuration,
                    curve: CONFIG.animation.zoomCurve,
                    speed: CONFIG.animation.zoomSpeed,
                    essential: true
                });
                
                setTimeout(() => {
                    this.map.setMaxBounds(CONFIG.mapbox.irelandBounds);
                    state.animationComplete = true;
                    this.ensureResponsive();
                    utils.log('info', 'Fast animation to Ireland complete');
                }, CONFIG.animation.zoomDuration + 100);
                
            }, CONFIG.animation.globeViewDuration);
        },

        setupResponsiveHandling: function() {
            const debouncedResize = utils.debounce(() => {
                this.handleResize();
            }, CONFIG.ui.resizeDebounce);

            window.addEventListener('resize', debouncedResize);
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.handleResize();
                }, 300);
            });
        },

        handleResize: function() {
            if (!this.map) return;

            try {
                this.map.resize();
                this.ensureResponsive();

            } catch (error) {
                errorHandler.handleDataError(error, 'resize');
            }
        }
    };

    const dataManager = {
        loadLocationData: function() {
            try {
                utils.log('info', 'Loading Niko Bathrooms location data from CMS');
                
                this.getDOMElements();
                this.processLocations();
                this.setupSidebarInteractions();

            } catch (error) {
                errorHandler.handleDataError(error, 'data loading');
            }
        },

        getDOMElements: function() {
            state.elements.locationItemSidebar = document.querySelectorAll("[location-item-sidebar]");
            
            const outerWrapper = document.querySelector(".map_locations-card_wrapper");
            const innerWrapper = document.querySelector(".locations-map-card-wrapper");
            
            state.elements.outerCardWrapper = outerWrapper;
            state.elements.innerCardWrapper = innerWrapper;
            state.elements.locationMapCardWrapper = outerWrapper;
            
            let cardItems = document.querySelectorAll(".locations-map-card_item");
            if (cardItems.length === 0) {
                cardItems = document.querySelectorAll("[locations-map-card-item]");
            }
            state.elements.locationMapCardItem = cardItems;
            
            let closeButtons = document.querySelectorAll(".locations-map-card_close-block");
            if (closeButtons.length === 0) {
                closeButtons = document.querySelectorAll("[locations-map-card-close-block]");
            }
            state.elements.locationMapCardCloseBtn = closeButtons;

            utils.log('info', `Found ${state.elements.locationItemSidebar.length} Niko Bathrooms locations`);
            
            this.forceCleanupInitialStates();
            this.forceHideAllCardsOnLoad();
        },
        
        forceCleanupInitialStates: function() {
            state.elements.locationItemSidebar.forEach((item) => {
                item.classList.remove('is--active'); // Ensure inner element also has class removed
                const parent = item.closest('.location-item_sidebar.w-dyn-item');
                if (parent) {
                    parent.classList.remove('is--active');
                }
            });
            
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.classList.remove('is--show');
            }
            
            utils.log('info', 'Cleaned up initial states');
        },
        
        forceHideAllCardsOnLoad: function() {
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.style.display = 'none';
            }
            
            if (state.elements.innerCardWrapper) {
                state.elements.innerCardWrapper.style.display = 'none';
            }
            
            state.elements.locationMapCardItem.forEach(item => {
                item.style.display = 'none';
                item.classList.remove('is--show');
            });
            
            utils.log('info', 'Hidden all cards on load');
        },

        processLocations: function() {
            state.stores.features = [];

            state.elements.locationItemSidebar.forEach((location, index) => {
                try {
                    const locationData = this.extractLocationData(location, index);
                    if (locationData) {
                        this.addLocationToStores(locationData, location);
                    }
                } catch (error) {
                    errorHandler.handleDataError(error, `location processing ${index}`);
                }
            });

            utils.log('info', `Processed ${state.stores.features.length} valid Niko Bathrooms locations`);
        },

        extractLocationData: function(location, index) {
            const nameElement = location.querySelector("[location-name-sidebar]");
            const latElement = location.querySelector("[location-latitude-sidebar]");
            const longElement = location.querySelector("[location-longitude-sidebar]");

            if (!nameElement || !latElement || !longElement) {
                utils.log('warn', `Missing required elements in location ${index}`);
                return null;
            }

            const locationName = nameElement.textContent.trim();
            const locationLat = parseFloat(latElement.textContent.trim());
            const locationLong = parseFloat(longElement.textContent.trim());

            if (!locationName) {
                utils.log('warn', `Empty location name at index ${index}`);
                return null;
            }

            if (!utils.isValidCoordinate(locationLat, locationLong)) {
                utils.log('warn', `Invalid coordinates for ${locationName}: ${locationLat}, ${locationLong}`);
                return null;
            }

            return {
                name: locationName,
                latitude: locationLat,
                longitude: locationLong
            };
        },

        addLocationToStores: function(locationData, element) {
            const isDuplicate = state.stores.features.some(
                feature => feature.properties.id === locationData.name
            );

            if (isDuplicate) {
                utils.log('warn', `Duplicate location found: ${locationData.name}`);
                return;
            }

            const geoData = {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [locationData.longitude, locationData.latitude]
                },
                properties: {
                    id: locationData.name,
                    name: locationData.name
                }
            };

            state.stores.features.push(geoData);
            element.setAttribute("data-id", locationData.name);
        },

        setupSidebarInteractions: function() {
            state.elements.locationItemSidebar.forEach((location) => {
                location.addEventListener('click', (e) => {
                    this.handleSidebarClick(e);
                });
            });

            utils.log('info', 'Niko Bathrooms sidebar interactions setup complete');
        },

        handleSidebarClick: function(e) {
            try {
                const locationID = e.currentTarget.getAttribute('data-id');
                if (!locationID) {
                    utils.log('warn', 'No data-id found on clicked element');
                    return;
                }

                utils.log('info', `Niko Bathrooms sidebar clicked: ${locationID}`);

                // FIXED: Wait for map to be ready
                if (!state.mapLoaded || !state.animationComplete) {
                    utils.log('info', 'Map not ready, waiting...');
                    setTimeout(() => {
                        this.handleSidebarClick(e);
                    }, 500);
                    return;
                }

                if (window.innerWidth <= 767) {
                    const section = document.getElementById('section-map');
                    if (section) {
                        section.scrollIntoView({ behavior: 'smooth' });
                    }
                }

                const feature = state.stores.features.find(f => f.properties.id === locationID);
                if (feature) {
                    uiManager.updateActiveLocation(locationID);
                    mapManager.zoomToLocation(feature.geometry.coordinates, true);
                    
                    const mockEvent = {
                        features: [{
                            geometry: { coordinates: feature.geometry.coordinates },
                            properties: { name: feature.properties.name }
                        }]
                    };
                    uiManager.showNikoBrandedPopup(mockEvent);
                    uiManager.showLocationCard(locationID);
                } else {
                    utils.log('warn', `Feature not found for location: ${locationID}`);
                }

            } catch (error) {
                errorHandler.handleDataError(error, 'sidebar click');
            }
        }
    };

    const uiManager = {
        updateActiveLocation: function(locationID) {
            try {
                // Remove all active states from all potential parent elements
                document.querySelectorAll('.location-item_sidebar.w-dyn-item.is--active').forEach((el) => {
                    el.classList.remove('is--active');
                });
                // Also remove from any inner wrappers if they somehow got it, for absolute cleanliness
                document.querySelectorAll('.location-item-wrapper_sidebar.is--active').forEach((el) => { // Fixed selector
                    el.classList.remove('is--active');
                });

                // Add active state ONLY to the matching OUTER parent item
                state.elements.locationItemSidebar.forEach((el) => { // el is the inner [location-item-sidebar]
                    if (el.getAttribute("data-id") === locationID) {
                        const outerParent = el.closest('.location-item_sidebar.w-dyn-item');
                        if (outerParent) {
                            outerParent.classList.add("is--active");
                            utils.log('info', `Added is--active to outer div for: ${locationID}`);
                        } else {
                            utils.log('warn', `Could not find outer parent for ${locationID} to add is--active.`);
                        }
                        // Also add to the inner wrapper if it exists and we're sure it's meant to be styled that way
                        // This might be redundant if CSS only targets outerParent, but included for completeness if needed.
                        // if (el.classList.contains('location-item-wrapper_sidebar')) { // Check if 'el' is the wrapper itself
                        //     el.classList.add('is--active');
                        // }
                    }
                });

                state.currentActiveLocation = locationID;

            } catch (error) {
                errorHandler.handleDataError(error, 'active location update');
            }
        },

        showNikoBrandedPopup: function(e) {
            try {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const name = e.features[0].properties.name;

                // Remove existing popups
                const existingPopups = document.getElementsByClassName("mapboxgl-popup");
                Array.from(existingPopups).forEach(popup => popup.remove());

                const popup = new mapboxgl.Popup({
                    closeOnClick: false,
                    closeButton: true,
                    focusAfterOpen: false,
                    maxWidth: '320px',
                    className: 'niko-branded-popup'
                })
                .setLngLat(coordinates)
                .setHTML(`
                    <div class="niko-popup-content">
                        <div class="niko-popup-badge">Niko Bathrooms Supplier</div>
                        <strong class="niko-popup-title">${name}</strong>
                    </div>
                `)
                .addTo(mapManager.map);

                utils.log('info', `Niko Bathrooms popup shown for: ${name}`);

            } catch (error) {
                errorHandler.handleDataError(error, 'popup display');
            }
        },

        showLocationCard: function(locationID) {
            try {
                utils.log('info', `Showing card for: ${locationID}`);
                
                this.hideAllCards();
                this.showCardWrapper();
                
                let cardFound = false;
                
                state.elements.locationMapCardItem.forEach((cardItem, index) => {
                    if (cardFound) return;
                    
                    const titleElement = cardItem.querySelector('h5');
                    if (titleElement) {
                        const cardTitle = titleElement.textContent.trim();
                        
                        if (cardTitle === locationID) {
                            this.displayCard(cardItem, locationID, index);
                            cardFound = true;
                            return;
                        }
                    }
                });

                this.setupCardCloseButtons();

            } catch (error) {
                errorHandler.handleDataError(error, 'location card display');
            }
        },

        showCardWrapper: function() {
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.style.display = 'block';
                state.elements.outerCardWrapper.classList.add('is--show');
            }
            
            if (state.elements.innerCardWrapper) {
                state.elements.innerCardWrapper.style.display = 'block';
                state.elements.innerCardWrapper.classList.add('is--show');
            }
        },

        hideCardWrapper: function() {
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.style.display = 'none';
                state.elements.outerCardWrapper.classList.remove('is--show');
            }
            if (state.elements.innerCardWrapper) {
                state.elements.innerCardWrapper.style.display = 'none';
                state.elements.innerCardWrapper.classList.remove('is--show');
            }
        },

        hideAllCards: function() {
            state.elements.locationMapCardItem.forEach(item => {
                item.style.display = 'none';
                item.classList.remove('is--show');
            });
        },

        displayCard: function(cardItem, locationID, index) {
            cardItem.style.display = 'block';
            cardItem.classList.add('is--show');
            
            cardItem.style.position = 'absolute';
            cardItem.style.bottom = '24px';
            cardItem.style.right = '24px';
            cardItem.style.zIndex = '1000';
            cardItem.style.maxWidth = '360px';
            cardItem.style.minWidth = '300px';
            
            utils.log('info', `Card displayed for: ${locationID}`);
        },

        setupCardCloseButtons: function() {
            state.elements.locationMapCardCloseBtn.forEach(closeBtn => {
                closeBtn.addEventListener('click', (e) => {
                    this.handleCardClose(e);
                });
            });
        },

        handleCardClose: function(e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                
                this.hideAllCards();
                this.hideCardWrapper();
                
                const existingPopups = document.getElementsByClassName("mapboxgl-popup");
                Array.from(existingPopups).forEach(popup => popup.remove());
                
                utils.log('info', 'Cards closed');
            } catch (error) {
                errorHandler.handleDataError(error, 'card close');
            }
        }
    };

    function initialize() {
        if (window.nikoMapboxInitialized) {
            utils.log('info', 'Already initialized, skipping...');
            return;
        }

        utils.log('info', 'Starting Niko Bathrooms Mapbox initialization');
        window.nikoMapboxInitialized = true;

        const success = mapManager.init();
        
        if (!success) {
            utils.log('error', 'Map initialization failed');
            window.nikoMapboxInitialized = false;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 50);
    }

    window.NikoMapboxManager = {
        getState: () => state,
        getConfig: () => CONFIG,
        reinitialize: () => {
            window.nikoMapboxInitialized = false;
            initialize();
        },
        testActiveState: (locationName) => {
            uiManager.updateActiveLocation(locationName);
        },
        testCard: (locationName) => {
            uiManager.showLocationCard(locationName);
        }
    };

})();
