/**
 * Niko Bathrooms Enhanced Mapbox Integration - FIXED FOR YOUR HTML
 * Version: 18 - CORRECTED h3 to h5 tag issue
 * Features: Fixed to work with your exact HTML structure
 */

(function() {
    'use strict';
    
    // Niko Bathrooms Configuration
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

    // State management
    const state = {
        initialized: false,
        mapLoaded: false,
        animationComplete: false,
        userLocation: null,
        currentActiveLocation: null,
        stores: { type: "FeatureCollection", features: [] },
        elements: {
            locationItemSidebar: [],
            outerCardWrapper: null,     // .map_locations-card_wrapper
            innerCardWrapper: null,     // .locations-map-card-wrapper  
            locationMapCardWrapper: null, // Keep for compatibility
            locationMapCardItem: [],
            locationMapCardCloseBtn: []
        }
    };

    // Utility functions
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

    // Enhanced error handling
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

    // Enhanced geolocation manager
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

    // Enhanced map manager with Niko branding
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
                
                // Load location data first
                dataManager.loadLocationData();
                
                // THEN force hide everything after DOM elements are found
                uiManager.hideAllCards();
                uiManager.hideCardWrapper();
                
                if (state.stores.features.length > 0) {
                    this.addNikoBrandedLayers();
                    utils.log('info', `Added ${state.stores.features.length} Niko Bathrooms locations to map`);
                }
                
                this.setupInteractions();
                this.startFastAnimationSequence();
                this.setupResponsiveHandling();

            } catch (error) {
                errorHandler.handleDataError(error, 'map load');
            }
        },

        addNikoBrandedLayers: function() {
            // Add Niko branded glow effect layer
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

            // Add main Niko branded points layer
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

            // Add hover effect layer
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

            // ENHANCED: Ensure map interactions work
            this.map.on('click', 'locations', (e) => {
                e.preventDefault();
                utils.log('info', 'Map location clicked - event triggered');
                this.handleLocationClick(e);
            });

            // ENHANCED: Better hover effects
            this.map.on('mouseenter', 'locations', (e) => {
                this.map.getCanvas().style.cursor = 'pointer';
                utils.log('info', 'Mouse entered location');
                
                // Add hover effect
                if (e.features.length > 0) {
                    this.map.getSource('locations-hover').setData({
                        type: "FeatureCollection",
                        features: [e.features[0]]
                    });
                }
            });

            this.map.on('mouseleave', 'locations', () => {
                this.map.getCanvas().style.cursor = '';
                utils.log('info', 'Mouse left location');
                
                // Remove hover effect
                this.map.getSource('locations-hover').setData({
                    type: "FeatureCollection",
                    features: []
                });
            });

            // FORCE: Enable map interactions
            this.map.dragPan.enable();
            this.map.scrollZoom.enable();
            this.map.doubleClickZoom.enable();

            utils.log('info', 'Niko Bathrooms map interactions setup complete');
            
            // DEBUG: Test if layers exist
            setTimeout(() => {
                const layers = this.map.getStyle().layers;
                const locationLayer = layers.find(l => l.id === 'locations');
                utils.log('info', 'Location layer exists:', !!locationLayer);
                if (locationLayer) {
                    utils.log('info', 'Location layer details:', locationLayer);
                }
            }, 1000);
        },

        handleLocationClick: function(e) {
            try {
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

            let center = coordinates;
            
            if (shouldCenter && window.innerWidth > 768) {
                const offsetLng = (this.map.getBounds().getEast() - this.map.getBounds().getWest()) * 0.1;
                center = [coordinates[0] - offsetLng, coordinates[1]];
            }

            this.map.flyTo({
                center: center,
                zoom: 13,
                speed: 1.5,
                curve: 1.2,
                essential: true
            });
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
                    essential: true,
                    easing: (t) => {
                        return t < 0.5 
                            ? 4 * t * t * t
                            : 1 - Math.pow(-2 * t + 2, 3) / 2;
                    }
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
                    essential: true,
                    easing: (t) => {
                        return t < 0.5 
                            ? 4 * t * t * t
                            : 1 - Math.pow(-2 * t + 2, 3) / 2;
                    }
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
                
                const width = window.innerWidth;
                let zoom;

                if (width <= 480) {
                    zoom = 5.8;
                } else if (width <= 768) {
                    zoom = 6.0;
                } else if (width <= 1024) {
                    zoom = 6.3;
                } else {
                    zoom = 6.5;
                }

                if (state.animationComplete) {
                    const center = state.userLocation && 
                                 geolocationManager.isLocationInIreland(state.userLocation.latitude, state.userLocation.longitude)
                                 ? [state.userLocation.longitude, state.userLocation.latitude]
                                 : CONFIG.mapbox.irelandCenter;
                    
                    this.map.easeTo({
                        zoom: zoom,
                        center: center,
                        duration: 200
                    });
                }

            } catch (error) {
                errorHandler.handleDataError(error, 'resize');
            }
        }
    };

    // FIXED data manager to match your HTML structure
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
            // Get sidebar items
            state.elements.locationItemSidebar = document.querySelectorAll("[location-item-sidebar]");
            
            // FIXED: Get BOTH wrapper levels (your HTML structure has nested wrappers)
            const outerWrapper = document.querySelector(".map_locations-card_wrapper");
            const innerWrapper = document.querySelector(".locations-map-card-wrapper");
            
            // Store both wrappers
            state.elements.outerCardWrapper = outerWrapper;
            state.elements.innerCardWrapper = innerWrapper;
            state.elements.locationMapCardWrapper = outerWrapper; // Keep for compatibility
            
            // FIXED: Get all card items (your HTML structure)  
            let cardItems = document.querySelectorAll(".locations-map-card_item");
            if (cardItems.length === 0) {
                cardItems = document.querySelectorAll("[locations-map-card-item]");
            }
            state.elements.locationMapCardItem = cardItems;
            
            // FIXED: Get all close buttons (your HTML structure)
            let closeButtons = document.querySelectorAll(".locations-map-card_close-block");
            if (closeButtons.length === 0) {
                closeButtons = document.querySelectorAll("[locations-map-card-close-block]");
            }
            state.elements.locationMapCardCloseBtn = closeButtons;

            utils.log('info', `Found ${state.elements.locationItemSidebar.length} Niko Bathrooms locations`);
            utils.log('info', `Found outer wrapper: ${state.elements.outerCardWrapper ? 'Yes' : 'No'}`);
            utils.log('info', `Found inner wrapper: ${state.elements.innerCardWrapper ? 'Yes' : 'No'}`);
            utils.log('info', `Found ${state.elements.locationMapCardItem.length} card items`);
            utils.log('info', `Found ${state.elements.locationMapCardCloseBtn.length} close buttons`);
            
            // CRITICAL: Clean up all default states on load
            // Remove ALL is--active from sidebar items (only one should be active at a time)
            state.elements.locationItemSidebar.forEach((item) => {
                item.classList.remove('is--active');
            });
            
            // Remove the default "is--show" class from outer wrapper on load
            if (state.elements.outerCardWrapper && state.elements.outerCardWrapper.classList.contains('is--show')) {
                state.elements.outerCardWrapper.classList.remove('is--show');
                utils.log('info', 'Removed default is--show class from outer wrapper');
            }
            
            // Force hide all individual cards
            this.forceHideAllCardsOnLoad();
        },
        
        // NEW: Force hide everything on initial load
        forceHideAllCardsOnLoad: function() {
            // Hide outer wrapper
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.style.display = 'none';
                state.elements.outerCardWrapper.classList.remove('is--show');
            }
            
            // Hide inner wrapper  
            if (state.elements.innerCardWrapper) {
                state.elements.innerCardWrapper.style.display = 'none';
                state.elements.innerCardWrapper.classList.remove('is--show');
            }
            
            // Force hide all individual cards
            state.elements.locationMapCardItem.forEach(item => {
                item.style.display = 'none';
                item.style.opacity = '0';
                item.style.visibility = 'hidden';
                item.classList.remove('is--show');
            });
            
            utils.log('info', 'Force hidden all cards and wrappers on load');
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

    // COMPLETELY REWRITTEN UI manager for your HTML structure
    const uiManager = {
        updateActiveLocation: function(locationID) {
            try {
                // Remove active class from all sidebar items first
                state.elements.locationItemSidebar.forEach((el) => {
                    el.classList.remove("is--active");
                });

                // Add active class to matching item
                state.elements.locationItemSidebar.forEach((el) => {
                    if (el.getAttribute("data-id") === locationID) {
                        el.classList.add("is--active");
                    }
                });

                state.currentActiveLocation = locationID;
                utils.log('info', `Active Niko Bathrooms location updated: ${locationID}`);

            } catch (error) {
                errorHandler.handleDataError(error, 'active location update');
            }
        },

        showNikoBrandedPopup: function(e) {
            try {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const name = e.features[0].properties.name;

                const existingPopups = document.getElementsByClassName("mapboxgl-popup");
                Array.from(existingPopups).forEach(popup => popup.remove());

                const popup = new mapboxgl.Popup({
                    closeOnClick: false,
                    closeButton: true,
                    focusAfterOpen: false,
                    maxWidth: '320px'
                })
                .setLngLat(coordinates)
                .setHTML(`
                    <div role="dialog" aria-label="Niko Bathrooms location details" style="
                        padding: 12px; 
                        text-align: center;
                        font-family: inherit;
                    ">
                        <div style="
                            color: ${CONFIG.brand.primary}; 
                            font-size: 12px; 
                            font-weight: 600; 
                            text-transform: uppercase; 
                            letter-spacing: 1px; 
                            margin-bottom: 6px;
                        ">
                            Niko Bathrooms Supplier
                        </div>
                        <strong style="
                            font-size: 16px; 
                            color: ${CONFIG.brand.dark}; 
                            display: block;
                            line-height: 1.3;
                        ">${name}</strong>
                    </div>
                `)
                .addTo(mapManager.map);

                setTimeout(() => {
                    const closeButton = popup._container.querySelector('.mapboxgl-popup-close-button');
                    if (closeButton) {
                        closeButton.removeAttribute('aria-hidden');
                        closeButton.setAttribute('aria-label', `Close ${name} popup`);
                        closeButton.setAttribute('title', `Close ${name} popup`);
                    }
                }, CONFIG.ui.popupCloseDelay);

                utils.log('info', `Niko Bathrooms popup shown for: ${name}`);

            } catch (error) {
                errorHandler.handleDataError(error, 'popup display');
            }
        },

        // COMPLETELY FIXED for your HTML structure - CRITICAL FIX: h3 to h5
        showLocationCard: function(locationID) {
            try {
                utils.log('info', `=== ATTEMPTING TO SHOW CARD FOR: ${locationID} ===`);
                
                // First, hide all cards and show the wrapper
                this.hideAllCards();
                this.showCardWrapper();
                
                let cardFound = false;
                
                utils.log('info', `Searching through ${state.elements.locationMapCardItem.length} cards`);
                
                // Search through all card items to find matching one
                state.elements.locationMapCardItem.forEach((cardItem, index) => {
                    if (cardFound) return;
                    
                    // CRITICAL FIX: Look for h5 instead of h3 (matches your HTML structure)
                    const titleElement = cardItem.querySelector('h5');
                    if (titleElement) {
                        const cardTitle = titleElement.textContent.trim();
                        utils.log('info', `Card ${index}: "${cardTitle}" vs "${locationID}"`);
                        
                        if (cardTitle === locationID) {
                            utils.log('info', `✅ EXACT MATCH FOUND at index ${index}!`);
                            this.displayCard(cardItem, locationID, index);
                            cardFound = true;
                            return;
                        }
                    } else {
                        utils.log('warn', `Card ${index}: No h5 title found`);
                    }
                });
                
                // If exact match not found, try partial match
                if (!cardFound) {
                    utils.log('info', 'No exact match, trying partial match...');
                    
                    state.elements.locationMapCardItem.forEach((cardItem, index) => {
                        if (cardFound) return;
                        
                        const cardText = cardItem.textContent || cardItem.innerText || '';
                        if (cardText.includes(locationID)) {
                            utils.log('info', `✅ PARTIAL MATCH FOUND at index ${index}!`);
                            this.displayCard(cardItem, locationID, index);
                            cardFound = true;
                            return;
                        }
                    });
                }

                if (!cardFound) {
                    utils.log('error', `❌ NO CARD FOUND for: "${locationID}"`);
                    
                    // DEBUG: Show what cards we actually have
                    utils.log('info', '=== AVAILABLE CARDS ===');
                    state.elements.locationMapCardItem.forEach((cardItem, index) => {
                        const titleElement = cardItem.querySelector('h5');
                        const title = titleElement ? titleElement.textContent.trim() : 'No title';
                        utils.log('info', `Card ${index}: "${title}"`);
                    });
                } else {
                    utils.log('info', `✅ Card successfully set up for: ${locationID}`);
                }

                this.setupCardCloseButtons();

            } catch (error) {
                errorHandler.handleDataError(error, 'location card display');
            }
        },

        // ENHANCED: Show the card wrapper with detailed logging
        showCardWrapper: function() {
            utils.log('info', '=== SHOWING CARD WRAPPER ===');
            
            if (state.elements.outerCardWrapper) {
                utils.log('info', 'Outer wrapper before:', {
                    display: state.elements.outerCardWrapper.style.display,
                    classes: state.elements.outerCardWrapper.className
                });
                
                state.elements.outerCardWrapper.style.display = 'block';
                state.elements.outerCardWrapper.classList.add('niko-show');
                state.elements.outerCardWrapper.classList.add('is--show');
                
                utils.log('info', 'Outer wrapper after:', {
                    display: state.elements.outerCardWrapper.style.display,
                    classes: state.elements.outerCardWrapper.className
                });
            } else {
                utils.log('error', 'Outer wrapper not found!');
            }
            
            if (state.elements.innerCardWrapper) {
                utils.log('info', 'Inner wrapper before:', {
                    display: state.elements.innerCardWrapper.style.display,
                    classes: state.elements.innerCardWrapper.className
                });
                
                state.elements.innerCardWrapper.style.display = 'block';
                state.elements.innerCardWrapper.classList.add('is--show');
                
                utils.log('info', 'Inner wrapper after:', {
                    display: state.elements.innerCardWrapper.style.display,
                    classes: state.elements.innerCardWrapper.className
                });
            } else {
                utils.log('error', 'Inner wrapper not found!');
            }
            
            utils.log('info', '✅ Card wrappers show process complete');
        },

        // FIXED: Hide the card wrapper (handle both levels) - Remove all classes
        hideCardWrapper: function() {
            if (state.elements.outerCardWrapper) {
                state.elements.outerCardWrapper.style.display = 'none';
                state.elements.outerCardWrapper.classList.remove('niko-show'); // Remove custom class
                state.elements.outerCardWrapper.classList.remove('is--show');
            }
            if (state.elements.innerCardWrapper) {
                state.elements.innerCardWrapper.style.display = 'none';
                state.elements.innerCardWrapper.classList.remove('is--show');
            }
            utils.log('info', 'Card wrappers hidden');
        },

        // ENHANCED: Hide all individual cards with force
        hideAllCards: function() {
            state.elements.locationMapCardItem.forEach(item => {
                item.style.display = 'none';
                item.style.opacity = '0';
                item.style.visibility = 'hidden';
                item.classList.remove('is--show');
            });
            utils.log('info', 'All cards forcibly hidden');
        },

        // ENHANCED: Display specific card with detailed logging
        displayCard: function(cardItem, locationID, index) {
            utils.log('info', `=== DISPLAYING CARD ===`);
            utils.log('info', `Card: ${locationID} at index ${index}`);
            
            // Show the specific card with multiple methods
            cardItem.style.display = 'block';
            cardItem.style.opacity = '1';
            cardItem.style.visibility = 'visible';
            cardItem.classList.add('is--show');
            
            // Force positioning (important for your structure)
            cardItem.style.position = 'absolute';
            cardItem.style.bottom = '24px';
            cardItem.style.right = '24px';
            cardItem.style.zIndex = '1000';
            cardItem.style.maxWidth = '360px';
            cardItem.style.minWidth = '300px';
            cardItem.style.backgroundColor = '#ffffff';
            cardItem.style.borderRadius = '12px';
            cardItem.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.1)';
            
            // Log the final state
            utils.log('info', `Card display: ${cardItem.style.display}`);
            utils.log('info', `Card opacity: ${cardItem.style.opacity}`);
            utils.log('info', `Card visibility: ${cardItem.style.visibility}`);
            utils.log('info', `Card classes: ${cardItem.className}`);
            utils.log('info', `Card position: ${cardItem.style.position}`);
            
            utils.log('info', `✅ Card successfully displayed for: ${locationID}`);
        },

        setupCardCloseButtons: function() {
            state.elements.locationMapCardCloseBtn.forEach(closeBtn => {
                // Remove existing listeners
                closeBtn.removeEventListener('click', this.handleCardClose);
                // Add new listener
                closeBtn.addEventListener('click', this.handleCardClose.bind(this));
            });
            utils.log('info', `Setup ${state.elements.locationMapCardCloseBtn.length} close buttons`);
        },

        handleCardClose: function(e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                
                utils.log('info', 'Card close button clicked');
                
                // Hide all cards and the wrapper
                this.hideAllCards();
                this.hideCardWrapper();
                
                utils.log('info', 'Niko Bathrooms location cards closed');
            } catch (error) {
                errorHandler.handleDataError(error, 'card close');
            }
        }
    };

    // Main initialization function
    function initialize() {
        if (window.nikoMapboxInitialized) {
            utils.log('info', 'Niko Bathrooms Mapbox already initialized, skipping...');
            return;
        }

        utils.log('info', 'Starting Niko Bathrooms Mapbox initialization v2.6');
        window.nikoMapboxInitialized = true;

        const success = mapManager.init();
        
        if (!success) {
            utils.log('error', 'Niko Bathrooms map initialization failed');
            window.nikoMapboxInitialized = false;
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 50);
    }

    // Enhanced public API for debugging
    window.NikoMapboxManager = {
        getState: () => state,
        getConfig: () => CONFIG,
        reinitialize: () => {
            window.nikoMapboxInitialized = false;
            initialize();
        },
        utils: utils,
        geolocation: geolocationManager,
        forceResponsive: () => {
            if (mapManager.map) {
                mapManager.ensureResponsive();
                mapManager.map.resize();
            }
        },
        // ENHANCED DEBUG FUNCTIONS FOR YOUR HTML
        debugCards: () => {
            console.log('=== NIKO BATHROOMS CARD DEBUG ===');
            console.log('Card Wrapper:', state.elements.locationMapCardWrapper);
            console.log('Card Items:', state.elements.locationMapCardItem.length);
            console.log('Close Buttons:', state.elements.locationMapCardCloseBtn.length);
            
            state.elements.locationMapCardItem.forEach((item, index) => {
                const title = item.querySelector('h5'); // FIXED: Changed from h3 to h5
                const isVisible = item.style.display !== 'none' && item.classList.contains('is--show');
                console.log(`Card ${index}: "${title ? title.textContent : 'No title'}" - Visible: ${isVisible}`);
            });
            
            if (state.elements.locationMapCardWrapper) {
                const wrapperVisible = state.elements.locationMapCardWrapper.style.display !== 'none' && 
                                    state.elements.locationMapCardWrapper.classList.contains('is--show');
                console.log(`Wrapper visible: ${wrapperVisible}`);
            }
        },
        debugSidebar: () => {
            console.log('=== NIKO BATHROOMS SIDEBAR DEBUG ===');
            console.log('Sidebar Items:', state.elements.locationItemSidebar.length);
            
            state.elements.locationItemSidebar.forEach((item, index) => {
                const name = item.querySelector('[location-name-sidebar]');
                const dataId = item.getAttribute('data-id');
                const isActive = item.classList.contains('is--active');
                console.log(`Sidebar ${index}: "${name ? name.textContent : 'No name'}" - ID: ${dataId} - Active: ${isActive}`);
            });
        },
        testCard: (locationName) => {
            console.log(`=== TESTING CARD FOR: ${locationName} ===`);
            uiManager.showLocationCard(locationName);
        },
        forceShowCard: (index) => {
            const cardItem = state.elements.locationMapCardItem[index];
            if (cardItem) {
                uiManager.hideAllCards();
                uiManager.showCardWrapper();
                uiManager.displayCard(cardItem, `Test Card ${index}`, index);
            }
        },
        hideAllCards: () => {
            uiManager.hideAllCards();
            uiManager.hideCardWrapper();
        },
        showWrapper: () => {
            uiManager.showCardWrapper();
        },
        // Test functions for your HTML structure
        testHtmlStructure: () => {
            console.log('=== HTML STRUCTURE TEST ===');
            console.log('Map wrapper:', document.querySelector('.map_locations-card_wrapper'));
            console.log('Card items:', document.querySelectorAll('.locations-map-card_item'));
            console.log('Close buttons:', document.querySelectorAll('.locations-map-card_close-block'));
            console.log('Sidebar items:', document.querySelectorAll('[location-item-sidebar]'));
        }
    };

})();