/**
 * Route Planner Application
 * Main initialization and coordination module
 */

class RoutePlannerApp {
    constructor() {
        this.routePlanner = null;
        this.routeManager = null;
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }
    
    initializeApp() {
        try {
            // Initialize route planner
            this.routePlanner = new RoutePlanner('map');
            
            // Initialize route manager
            this.routeManager = new RouteManager('routesList', this.routePlanner);
            
            // Set global references for backward compatibility
            window.routePlanner = this.routePlanner;
            window.routeManager = this.routeManager;
            
            // Initialize export button handlers
            this.initializeExportButtons();
            
            console.log('Route Planner App initialized successfully');
            
        } catch (error) {
            console.error('Error initializing Route Planner App:', error);
        }
    }
    
    initializeExportButtons() {
        console.log('Initializing export buttons (will be bound to floating panel)...');

                // Export GPX button
        const exportGpxBtn = document.getElementById('exportGpx');
        if (exportGpxBtn) {
            exportGpxBtn.addEventListener('click', () => {
                RouteExporter.exportCurrentRouteAsGpx(this.routePlanner);
            });
            console.log('exportGpx button bound successfully');
        } else {
            console.log('exportGpx button will be bound to floating panel (normal)');
        }

        // Export KML button
        const exportKmlBtn = document.getElementById('exportKml');
        if (exportKmlBtn) {
            exportKmlBtn.addEventListener('click', () => {
                RouteExporter.exportCurrentRouteAsKml(this.routePlanner);
            });
            console.log('exportKml button bound successfully');
        } else {
            console.log('exportKml button will be bound to floating panel (normal)');
        }

        // Export TCX button
        const exportTcxBtn = document.getElementById('exportTcx');
        if (exportTcxBtn) {
            exportTcxBtn.addEventListener('click', () => {
                RouteExporter.exportCurrentRouteAsTcx(this.routePlanner);
            });
            console.log('exportTcx button bound successfully');
        } else {
            console.log('exportTcx button will be bound to floating panel (normal)');
        }

        // Initialize routing mode controls
        this.initializeRoutingModeControls();

        // Initialize cycling controls
        this.initializeCyclingControls();

        // Replace alert() with toast notifications
        this.replaceAlertsWithToasts();
    }

    initializeRoutingModeControls() {
        // Mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        const transportSection = document.getElementById('transportSection');
        const hybridControls = document.getElementById('hybridControls');
        const calculateRouteBtn = document.getElementById('calculateRoute');
        const clearAutoSegmentsBtn = document.getElementById('clearAutoSegments');
        const routingProfileSelect = document.getElementById('routingProfile');

        modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;

                // Update active button
                modeButtons.forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                // Update RoutePlanner mode
                this.routePlanner.setRoutingMode(mode);

                // Show/hide controls based on mode
                if (mode === 'hybrid') {
                    transportSection.style.display = 'flex';
                    hybridControls.style.display = 'flex';
                } else {
                    transportSection.style.display = 'none';
                    hybridControls.style.display = 'none';
                }

                // Update calculate button state
                if (calculateRouteBtn) {
                    calculateRouteBtn.disabled = this.routePlanner.route.length < 2;
                }

                // Show/hide routing legend
                this.updateRoutingLegend(mode);
            });
        });

        // Initialize with default hybrid mode
        this.routePlanner.setRoutingMode('hybrid');
        transportSection.style.display = 'flex';
        hybridControls.style.display = 'flex';
        this.updateRoutingLegend('hybrid');

        // Transport profile change
        if (routingProfileSelect) {
            routingProfileSelect.addEventListener('change', (e) => {
                this.routePlanner.setRoutingProfile(e.target.value);
                this.updateCyclingControlsVisibility(e.target.value);
            });
        }

        // Calculate route button
        if (calculateRouteBtn) {
            calculateRouteBtn.addEventListener('click', () => {
                this.routePlanner.calculateHybridRoute();
            });
        }

        // Clear auto segments button
        if (clearAutoSegmentsBtn) {
            clearAutoSegmentsBtn.addEventListener('click', () => {
                this.routePlanner.clearAutoSegments();
            });
        }

        // Location button
        const findLocationBtn = document.getElementById('findLocation');
        if (findLocationBtn) {
            findLocationBtn.addEventListener('click', () => {
                this.findUserLocation();
            });
        }

        // Update calculate button when route changes
        this.routePlanner.addEventListener('routeChanged', () => {
            if (calculateRouteBtn) {
                calculateRouteBtn.disabled = this.routePlanner.route.length < 2;
            }
        });

        // Listen for routing mode changes
        this.routePlanner.addEventListener('routingModeChanged', (data) => {
            this.updateRoutingLegend(data.mode);
            this.showModeIndicator(data.mode);
        });

        // Listen for auto segments cleared
        this.routePlanner.addEventListener('autoSegmentsCleared', () => {
            this.updateRoutingLegend(this.routePlanner.routingMode);
            this.updateExportButtons();
        });

        // Listen for route updates
        this.routePlanner.addEventListener('routeUpdated', () => {
            this.updateExportButtons();
        });

        // Initial update of export buttons
        this.updateExportButtons();
    }

    updateRoutingLegend(mode) {
        const legend = document.getElementById('routingLegend');
        if (legend) {
            if (mode === 'hybrid' && this.routePlanner.route.length > 0) {
                legend.style.display = 'block';
            } else {
                legend.style.display = 'none';
            }
        }
    }

    showModeIndicator(mode) {
        const indicator = document.getElementById('modeIndicator');
        if (indicator) {
            const modeNames = {
                'manual': '🎯 Ручной режим',
                'hybrid': '🔄 Гибридный режим'
            };

            indicator.textContent = modeNames[mode] || mode;
            indicator.classList.add('show');

            // Hide after 2 seconds
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }

    updateExportButtons() {
        const exportButtons = document.querySelectorAll('.export-btn');
        const routeData = this.routePlanner.getRouteData();

        const hasHybridRoute = routeData.routingMode === 'hybrid' &&
                              routeData.autoSegments &&
                              routeData.autoSegments.length > 0;

        exportButtons.forEach(button => {
            if (hasHybridRoute) {
                button.classList.add('has-hybrid-route');
            } else {
                button.classList.remove('has-hybrid-route');
            }
        });
    }

    findUserLocation() {
        const locationBtn = document.getElementById('findLocation');
        if (!locationBtn) return;

        // Show loading state
        const originalText = locationBtn.innerHTML;
        locationBtn.disabled = true;
        locationBtn.innerHTML = '⏳ Поиск...';

        if (!navigator.geolocation) {
            this.showToast('Геолокация не поддерживается в этом браузере', 'error');
            locationBtn.disabled = false;
            locationBtn.innerHTML = originalText;
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                // Center map on user location
                this.routePlanner.map.setView([latitude, longitude], 15);

                // Add a marker at user location
                const userMarker = L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'user-location-marker',
                        html: '<div style="width: 20px; height: 20px; background: #2563eb; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);"></div>',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                });

                userMarker.addTo(this.routePlanner.map);
                userMarker.bindPopup('📍 Ваше местоположение').openPopup();

                // Remove marker after 30 seconds
                setTimeout(() => {
                    if (this.routePlanner.map.hasLayer(userMarker)) {
                        this.routePlanner.map.removeLayer(userMarker);
                    }
                }, 30000);

                this.showToast(`📍 Найдено местоположение: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'success');

                // Reset button
                locationBtn.disabled = false;
                locationBtn.innerHTML = originalText;
            },
            (error) => {
                let errorMessage = 'Ошибка определения местоположения';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Информация о местоположении недоступна.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Превышено время ожидания определения местоположения.';
                        break;
                }

                this.showToast(errorMessage, 'error');

                // Reset button
                locationBtn.disabled = false;
                locationBtn.innerHTML = originalText;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    // Toast Notification System
    showToast(message, type = 'info', duration = 4000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove after duration
        const removeToast = () => {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        };

        if (duration > 0) {
            setTimeout(removeToast, duration);
        }

        return toast;
    }

    // Replace alert() calls with toast notifications
    replaceAlertsWithToasts() {
        // Override window.alert for route planner context
        const originalAlert = window.alert;
        window.alert = (message) => {
            if (message.includes('маршрут') || message.includes('экспорт') || message.includes('ошибка') ||
                message.includes('успешно') || message.includes('завершен')) {
                // Route-related messages - use toast
                const isSuccess = message.includes('успешно') || message.includes('завершен') || message.includes('экспортирован');
                const isError = message.includes('ошибка') || message.includes('Ошибка');

                if (isSuccess) {
                    this.showToast(message, 'success');
                } else if (isError) {
                    this.showToast(message, 'error');
                } else {
                    this.showToast(message, 'info');
                }
            } else {
                // Other alerts - use original
                originalAlert(message);
            }
        };
    }

    // Update visibility of cycling controls based on selected profile
    updateCyclingControlsVisibility(profile) {
        const cyclingSettings = document.getElementById('cyclingSettings');
        const routingEngineSection = document.getElementById('routingEngineSection');
        const apiKeysSection = document.getElementById('apiKeysSection');

        if (cyclingSettings && routingEngineSection && apiKeysSection) {
            const isCycling = profile.includes('cycling');

            // Show cycling settings only for cycling profiles
            cyclingSettings.style.display = isCycling ? 'block' : 'none';

            // Show routing engine section for hybrid mode
            routingEngineSection.style.display = 'block';

            // Show API keys section for advanced users
            apiKeysSection.style.display = 'block';

            console.log(`🚴‍♂️ Настройки для ${profile}: ${isCycling ? 'показаны' : 'скрыты'}`);
        }
    }

    // Initialize cycling controls
    initializeCyclingControls() {
        // Set default values for checkboxes
        const avoidHighwaysCheckbox = document.getElementById('avoidHighways');
        const preferTrailsCheckbox = document.getElementById('preferTrails');
        const allowUnpavedCheckbox = document.getElementById('allowUnpaved');

        if (avoidHighwaysCheckbox) {
            avoidHighwaysCheckbox.checked = true; // Default: avoid highways
        }

        if (preferTrailsCheckbox) {
            preferTrailsCheckbox.checked = true; // Default: prefer trails
        }

        if (allowUnpavedCheckbox) {
            allowUnpavedCheckbox.checked = false; // Default: don't allow unpaved
        }

        // Add event listeners for checkboxes
        [avoidHighwaysCheckbox, preferTrailsCheckbox, allowUnpavedCheckbox].forEach(checkbox => {
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    console.log(`🚴‍♂️ Настройка ${e.target.id}: ${e.target.checked ? 'включена' : 'выключена'}`);
                    this.routePlanner.routingCache.clear(); // Clear cache when settings change
                });
            }
        });

        // Routing engine selector
        const routingEngineSelect = document.getElementById('routingEngine');
        if (routingEngineSelect) {
            routingEngineSelect.addEventListener('change', (e) => {
                console.log(`⚙️ Движок маршрутизации изменен на: ${e.target.value}`);
                this.routePlanner.routingCache.clear(); // Clear cache when engine changes
            });
        }

        // API Keys management
        this.initializeApiKeys();

        // Set initial visibility based on current profile
        const currentProfile = document.getElementById('routingProfile')?.value || 'cycling-regular';
        this.updateCyclingControlsVisibility(currentProfile);
    }

    // Initialize API keys management
    initializeApiKeys() {
        // Load saved API keys
        this.loadApiKeys();

        // Save API keys button
        const saveApiKeysBtn = document.getElementById('saveApiKeys');
        if (saveApiKeysBtn) {
            saveApiKeysBtn.addEventListener('click', () => {
                this.saveApiKeys();
                this.showToast('🔑 API ключи сохранены!', 'success');
            });
        }
    }

    // Load API keys from localStorage
    loadApiKeys() {
        const thunderforestKey = localStorage.getItem('thunderforest_api_key') || '';
        const orsKey = localStorage.getItem('ors_api_key') || '';

        const thunderforestInput = document.getElementById('thunderforestKey');
        const orsInput = document.getElementById('orsKey');

        if (thunderforestInput) thunderforestInput.value = thunderforestKey;
        if (orsInput) orsInput.value = orsKey;
    }

    // Save API keys to localStorage
    saveApiKeys() {
        const thunderforestKey = document.getElementById('thunderforestKey')?.value || '';
        const orsKey = document.getElementById('orsKey')?.value || '';

        localStorage.setItem('thunderforest_api_key', thunderforestKey);
        localStorage.setItem('ors_api_key', orsKey);

        // Update RoutePlanner with new API keys
        if (this.routePlanner) {
            this.routePlanner.apiKeys = {
                thunderforest: thunderforestKey,
                ors: orsKey
            };
        }
    }
}

// Initialize the application
new RoutePlannerApp();
