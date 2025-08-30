/**
 * Route Planner - Main JavaScript Module
 * Handles interactive route creation and editing
 */

class RoutePlanner {
    constructor(mapElementId) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.route = [];
        this.markers = [];
        this.distanceTicks = [];
        this.polyline = null;
        this.totalDistance = 0;
        this.isDragging = false;
        this.contextMenu = null;
        this.isMeasuring = false;
        this.measurementPoints = [];
        this.measurementLine = null;
        this.measurementMarkers = [];
        this.gradientLineGroup = null;
        this.dragUpdatePending = false;

        // POI and Analysis systems
        this.poiMarkers = [];
        this.analysisLayers = [];
        this.surfaceAnalysisData = null;
        this.poiLayerGroup = null;
        this.analysisLayerGroup = null;

        // Routing modes system - Default to hybrid mode
        this.routingMode = 'hybrid'; // 'manual' | 'hybrid'
        this.routingProfile = 'driving'; // 'driving' | 'walking' | 'cycling'
        this.routingCache = new Map(); // Cache for routing results
        this.autoSegments = []; // Automatic route segments
        this.autoPolylines = []; // Polylines for automatic segments
        this.pendingRouteRequest = null; // Current routing request
        this.apiKeys = {
            thunderforest: '',
            ors: ''
        }; // API keys for external services

        // Event listeners
        this.eventListeners = {};
        
        this.init();
    }
    
    init() {
        this.initMap();
        this.initEventListeners();
        this.loadApiKeys();
        this.updateRouteInfo();
    }

    // Load API keys from localStorage
    loadApiKeys() {
        this.apiKeys = {
            thunderforest: localStorage.getItem('thunderforest_api_key') || '',
            ors: localStorage.getItem('ors_api_key') || ''
        };
        console.log('🔑 API ключи загружены:', {
            thunderforest: this.apiKeys.thunderforest ? 'настроен' : 'не настроен',
            ors: this.apiKeys.ors ? 'настроен' : 'не настроен'
        });
    }

    





    // Определение локации пользователя
    async getUserLocation() {
        try {
            console.log('Определяем локацию пользователя...');

            // 1. Пробуем определить по IP через бесплатный API
            const ipResponse = await this.getLocationByIP();
            if (ipResponse && ipResponse.country_code) {
                const coords = this.getCountryCoordinates(ipResponse.country_code);
                console.log(`Определена страна: ${ipResponse.country_name} (${ipResponse.country_code})`);
                return coords;
            }
        } catch (error) {
            console.warn('Не удалось определить локацию по IP:', error);
        }

        // 2. Fallback: определяем по языку браузера
        try {
            const langCoords = this.getLocationByBrowserLanguage();
            if (langCoords) {
                console.log('Используем определение по языку браузера');
                return langCoords;
            }
        } catch (error) {
            console.warn('Не удалось определить по языку браузера:', error);
        }

        // 3. Default: Москва, Россия
        console.log('Используем координаты по умолчанию (Москва)');
        return {
            center: [55.7558, 37.6176], // Москва
            zoom: 10
        };
    }

    // Определение страны по IP
    async getLocationByIP() {
        // Массив API для fallback
        const apis = [
            'https://ipapi.co/json/',
            'https://ip-api.com/json/',
            'https://api.ipify.org?format=json'
        ];

        for (const apiUrl of apis) {
            try {
                console.log(`Пробуем API: ${apiUrl}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`API ${apiUrl} вернул ошибку: ${response.status}`);
                    continue;
                }

                const data = await response.json();

                // Обрабатываем разные форматы ответа
                if (data.country_code || data.countryCode) {
                    return {
                        country_code: data.country_code || data.countryCode,
                        country_name: data.country_name || data.countryName || data.country,
                        city: data.city,
                        region: data.region || data.regionName
                    };
                }
            } catch (error) {
                console.warn(`Ошибка с API ${apiUrl}:`, error.message);
                continue;
            }
        }

        console.warn('Все API для определения локации недоступны');
        return null;
    }

    // Определение по языку браузера
    getLocationByBrowserLanguage() {
        const lang = navigator.language || navigator.userLanguage;
        const countryCode = this.languageToCountryCode(lang);

        if (countryCode) {
            return this.getCountryCoordinates(countryCode);
        }

        return null;
    }

    // Преобразование языка в код страны
    languageToCountryCode(language) {
        const langMap = {
            'ru': 'RU', 'ru-RU': 'RU', // Россия
            'en-US': 'US', 'en': 'US', // США
            'en-GB': 'GB', // Великобритания
            'de': 'DE', 'de-DE': 'DE', // Германия
            'fr': 'FR', 'fr-FR': 'FR', // Франция
            'es': 'ES', 'es-ES': 'ES', // Испания
            'it': 'IT', 'it-IT': 'IT', // Италия
            'pt': 'PT', 'pt-BR': 'BR', // Португалия/Бразилия
            'pl': 'PL', 'pl-PL': 'PL', // Польша
            'nl': 'NL', 'nl-NL': 'NL', // Нидерланды
            'sv': 'SE', 'sv-SE': 'SE', // Швеция
            'no': 'NO', 'nb-NO': 'NO', // Норвегия
            'da': 'DK', 'da-DK': 'DK', // Дания
            'fi': 'FI', 'fi-FI': 'FI', // Финляндия
            'tr': 'TR', 'tr-TR': 'TR', // Турция
            'ar': 'SA', 'ar-SA': 'SA', // Саудовская Аравия
            'zh': 'CN', 'zh-CN': 'CN', // Китай
            'ja': 'JP', 'ja-JP': 'JP', // Япония
            'ko': 'KR', 'ko-KR': 'KR'  // Южная Корея
        };

        return langMap[language] || null;
    }

    // Получение координат столицы страны
    getCountryCoordinates(countryCode) {
        const coordinates = {
            // Европа
            'RU': { center: [55.7558, 37.6176], zoom: 6, name: 'Россия' },
            'UA': { center: [50.4501, 30.5234], zoom: 8, name: 'Украина' },
            'BY': { center: [53.9045, 27.5615], zoom: 8, name: 'Беларусь' },
            'KZ': { center: [51.1694, 71.4491], zoom: 7, name: 'Казахстан' },
            'UZ': { center: [41.2995, 69.2401], zoom: 8, name: 'Узбекистан' },
            'GB': { center: [51.5074, -0.1278], zoom: 10, name: 'Великобритания' },
            'DE': { center: [52.5200, 13.4050], zoom: 8, name: 'Германия' },
            'FR': { center: [48.8566, 2.3522], zoom: 8, name: 'Франция' },
            'ES': { center: [40.4168, -3.7038], zoom: 7, name: 'Испания' },
            'IT': { center: [41.9028, 12.4964], zoom: 7, name: 'Италия' },
            'PT': { center: [38.7223, -9.1393], zoom: 8, name: 'Португалия' },
            'PL': { center: [52.2297, 21.0122], zoom: 8, name: 'Польша' },
            'CZ': { center: [50.0755, 14.4378], zoom: 9, name: 'Чехия' },
            'HU': { center: [47.4979, 19.0402], zoom: 8, name: 'Венгрия' },
            'RO': { center: [44.4268, 26.1025], zoom: 8, name: 'Румыния' },
            'BG': { center: [42.6977, 23.3219], zoom: 8, name: 'Болгария' },
            'GR': { center: [37.9838, 23.7275], zoom: 8, name: 'Греция' },
            'SK': { center: [48.1486, 17.1077], zoom: 8, name: 'Словакия' },
            'SI': { center: [46.0569, 14.5058], zoom: 9, name: 'Словения' },
            'HR': { center: [45.8150, 15.9819], zoom: 8, name: 'Хорватия' },
            'BA': { center: [43.8563, 18.4131], zoom: 8, name: 'Босния и Герцеговина' },
            'RS': { center: [44.8125, 20.4612], zoom: 8, name: 'Сербия' },
            'ME': { center: [42.4304, 19.2594], zoom: 9, name: 'Черногория' },
            'AL': { center: [41.3275, 19.8187], zoom: 8, name: 'Албания' },
            'MK': { center: [41.9981, 21.4254], zoom: 8, name: 'Северная Македония' },
            'LU': { center: [49.6116, 6.1319], zoom: 9, name: 'Люксембург' },
            'MT': { center: [35.8997, 14.5146], zoom: 10, name: 'Мальта' },
            'CY': { center: [35.1264, 33.4299], zoom: 9, name: 'Кипр' },
            'IS': { center: [64.1466, -21.9426], zoom: 7, name: 'Исландия' },
            'LI': { center: [47.1662, 9.5554], zoom: 11, name: 'Лихтенштейн' },
            'AD': { center: [42.5462, 1.6016], zoom: 10, name: 'Андорра' },
            'MC': { center: [43.7384, 7.4246], zoom: 12, name: 'Монако' },
            'SM': { center: [43.9424, 12.4578], zoom: 11, name: 'Сан-Марино' },
            'VA': { center: [41.9029, 12.4534], zoom: 15, name: 'Ватикан' },
            'NL': { center: [52.3676, 4.9041], zoom: 9, name: 'Нидерланды' },
            'BE': { center: [50.8503, 4.3517], zoom: 9, name: 'Бельгия' },
            'AT': { center: [48.2082, 16.3738], zoom: 9, name: 'Австрия' },
            'CH': { center: [46.9481, 7.4474], zoom: 9, name: 'Швейцария' },
            'SE': { center: [59.3293, 18.0686], zoom: 8, name: 'Швеция' },
            'NO': { center: [59.9139, 10.7522], zoom: 8, name: 'Норвегия' },
            'DK': { center: [55.6761, 12.5683], zoom: 9, name: 'Дания' },
            'FI': { center: [60.1699, 24.9384], zoom: 8, name: 'Финляндия' },

            // Америка
            'US': { center: [38.9072, -77.0369], zoom: 5, name: 'США' },
            'CA': { center: [45.4215, -75.6972], zoom: 6, name: 'Канада' },
            'MX': { center: [19.4326, -99.1332], zoom: 7, name: 'Мексика' },
            'BR': { center: [-15.8267, -47.9218], zoom: 5, name: 'Бразилия' },
            'AR': { center: [-34.6118, -58.4173], zoom: 7, name: 'Аргентина' },
            'CL': { center: [-33.4489, -70.6693], zoom: 8, name: 'Чили' },
            'CO': { center: [4.7110, -74.0721], zoom: 7, name: 'Колумбия' },
            'PE': { center: [-12.0464, -77.0428], zoom: 8, name: 'Перу' },

            // Азия
            'TR': { center: [39.9334, 32.8597], zoom: 7, name: 'Турция' },
            'IL': { center: [31.7683, 35.2137], zoom: 9, name: 'Израиль' },
            'SA': { center: [24.7136, 46.6753], zoom: 7, name: 'Саудовская Аравия' },
            'AE': { center: [24.4539, 54.3773], zoom: 9, name: 'ОАЭ' },
            'IN': { center: [28.6139, 77.2090], zoom: 6, name: 'Индия' },
            'TH': { center: [13.7563, 100.5018], zoom: 8, name: 'Таиланд' },
            'VN': { center: [21.0285, 105.8542], zoom: 8, name: 'Вьетнам' },
            'MY': { center: [3.1390, 101.6869], zoom: 8, name: 'Малайзия' },
            'SG': { center: [1.3521, 103.8198], zoom: 10, name: 'Сингапур' },
            'ID': { center: [-6.2088, 106.8456], zoom: 8, name: 'Индонезия' },
            'PH': { center: [14.5995, 120.9842], zoom: 8, name: 'Филиппины' },
            'HK': { center: [22.3193, 114.1694], zoom: 10, name: 'Гонконг' },
            'MO': { center: [22.1987, 113.5439], zoom: 12, name: 'Макао' },
            'BN': { center: [4.9031, 114.9398], zoom: 9, name: 'Бруней' },
            'KH': { center: [11.5625, 104.9160], zoom: 8, name: 'Камбоджа' },
            'LA': { center: [17.9757, 102.6331], zoom: 7, name: 'Лаос' },
            'MM': { center: [16.8661, 96.1951], zoom: 6, name: 'Мьянма' },
            'NP': { center: [27.7172, 85.3240], zoom: 8, name: 'Непал' },
            'LK': { center: [6.9271, 79.8612], zoom: 8, name: 'Шри-Ланка' },
            'BD': { center: [23.8103, 90.4125], zoom: 7, name: 'Бангладеш' },
            'PK': { center: [33.6844, 73.0479], zoom: 6, name: 'Пакистан' },
            'AF': { center: [34.5553, 69.2075], zoom: 7, name: 'Афганистан' },
            'CN': { center: [39.9042, 116.4074], zoom: 5, name: 'Китай' },
            'JP': { center: [35.6762, 139.6503], zoom: 8, name: 'Япония' },
            'KR': { center: [37.5665, 126.9780], zoom: 9, name: 'Южная Корея' },
            'TW': { center: [25.0330, 121.5654], zoom: 9, name: 'Тайвань' },

            // Африка
            'EG': { center: [30.0444, 31.2357], zoom: 8, name: 'Египет' },
            'ZA': { center: [-25.7479, 28.2293], zoom: 7, name: 'ЮАР' },
            'NG': { center: [9.0765, 7.3986], zoom: 7, name: 'Нигерия' },
            'KE': { center: [-1.2921, 36.8219], zoom: 8, name: 'Кения' },
            'MA': { center: [33.9716, -6.8498], zoom: 8, name: 'Марокко' },
            'TN': { center: [36.8065, 10.1815], zoom: 8, name: 'Тунис' },

            // Австралия и Океания
            'AU': { center: [-35.2809, 149.1300], zoom: 6, name: 'Австралия' },
            'NZ': { center: [-41.2865, 174.7762], zoom: 8, name: 'Новая Зеландия' }
        };

        // Возвращаем координаты страны или координаты по умолчанию
        const result = coordinates[countryCode];
        if (result) {
            console.log(`Найдены координаты для ${countryCode}: ${result.name}`);
            return result;
        } else {
            console.warn(`Страна ${countryCode} не найдена в базе данных, используем по умолчанию`);

            // Попробуем найти столицу по геокодингу (если есть возможность)
            // Пока возвращаем координаты по умолчанию
            return {
                center: [55.7558, 37.6176], // Москва по умолчанию
                zoom: 10,
                name: `Неизвестная страна (${countryCode}) - Россия (по умолчанию)`
            };
        }
    }

    // Показываем уведомление о локации
    showLocationNotification(countryName) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'location-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">📍</span>
                <span class="notification-text">Карта позиционирована на: ${countryName}</span>
            </div>
        `;

        // Стили для уведомления
        notification.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            color: #333;
            backdrop-filter: blur(8px);
            animation: fadeInOut 4s ease-in-out;
        `;

        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                10%, 90% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);

        // Добавляем уведомление на страницу
        document.body.appendChild(notification);

        // Удаляем уведомление через 4 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 4000);
    }

    // В файле /static/js/route-planner.js

async initMap() {
    // Определяем начальные координаты пользователя
    const initialCoords = await this.getUserLocation();

    this.map = L.map(this.mapElementId).setView(initialCoords.center, initialCoords.zoom);

    // Показываем уведомление о том, где находится карта
    if (initialCoords.name) {
        console.log(`Карта автоматически позиционирована на: ${initialCoords.name}`);
        this.showLocationNotification(initialCoords.name);
    }

    // --- НОВЫЕ ФУНКЦИОНАЛЬНЫЕ СЛОИ КАРТ ---

    // Базовый слой - современная карта
    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // --- СПЕЦИАЛИЗИРОВАННЫЕ СЛОИ ---
    const specializedLayers = {
        "🏔️ Рельеф & Уклоны": {
            "Карта уклонов": L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                opacity: 0.7
            }),
            "Рельеф (Hillshade)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                opacity: 0.6
            }),
            "Высотные зоны": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap',
                opacity: 0.8
            })
        },
        "🛰️ Спутник & Аэрофото": {
            "Высокое разрешение": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: 19
            }),
            "Исторические снимки": L.tileLayer('https://tiles{s}.geoproxy.rechtspraak.nl/hg/{z}/{x}/{y}.png', {
                attribution: '© Historische Geografie',
                subdomains: ['', '2', '3']
            })
        },
        "📚 Исторические карты": {
            "Карты Генштаба (СССР)": L.tileLayer("https://{s}.tiles.nakarte.me/ggc1000/{z}/{x}/{y}", {
                tms: true,
                attribution: 'Генштаб СССР'
            }),
            "Дореволюционные карты": L.tileLayer("https://{s}.tiles.nakarte.me/ggc500/{z}/{x}/{y}", {
                tms: true,
                attribution: 'Генштаб СССР'
            }),
            "Военные топокарты": L.tileLayer("https://{s}.tiles.nakarte.me/ggc250/{z}/{x}/{y}", {
                tms: true,
                attribution: 'Генштаб СССР'
            })
        },
        "🏃‍♂️ Спортивные маршруты": {
            "Веломаршруты": L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
                attribution: 'Waymarked Trails'
            }),
            "Пешие маршруты": L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
                attribution: 'Waymarked Trails'
            }),
            "Беговые маршруты": L.tileLayer('https://tile.waymarkedtrails.org/running/{z}/{x}/{y}.png', {
                attribution: 'Waymarked Trails'
            })
        },
        "🏪 POI & Инфраструктура": {
            "Точки интереса": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OSM',
                opacity: 0.8
            }),
            "Велосипедная инфраструктура": L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
                attribution: '&copy; CyclOSM'
            }),
            "Транспорт": L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
                attribution: '&copy; OSM HOT'
            })
        }
    };

    // Инициализируем систему POI и анализа поверхности
    this.initPOISystem();
    this.initSurfaceAnalysis();

    // Создаем контрол слоев с новой организацией
    const layerControl = L.control.groupedLayers({}, specializedLayers, {
        collapsed: true,
        groupCheckboxes: true,
        position: 'topright'
    }).addTo(this.map);

    // Автоматически включаем слой "Транспорт" по умолчанию
    const transportLayer = specializedLayers["🏪 POI & Инфраструктура"]["Транспорт"];
    if (transportLayer) {
        transportLayer.addTo(this.map);
        console.log('OSM HOT Transport layer enabled by default');
    }

    // Инициализация полилинии маршрута с градиентным эффектом
    this.polyline = L.polyline(this.route, {
        color: '#fc5200',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(this.map);

    // Создать градиентную линию маршрута
    this.createGradientLine();

    // Добавить тень для глубины
    this.polylineShadow = L.polyline(this.route, {
        color: 'rgba(0,0,0,0.3)',
        weight: 8,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(this.map);

    // Обработчик кликов по карте
            this.map.on('click', (e) => this.handleMapClickEnhanced(e));
}


    
    






    initEventListeners() {
        // Theme handling
        if (localStorage.getItem("theme") === "dark") {
            document.documentElement.classList.add("dark");
        }
        
        // Control buttons - note: buttons are now in floating panel, this is for legacy support
        console.log('🔧 Initializing button bindings (main buttons moved to floating panel)...');
        document.getElementById('clearRoute')?.addEventListener('click', () => this.clearRoute());
        document.getElementById('undoPoint')?.addEventListener('click', () => this.undoPoint());
        document.getElementById('saveRoute')?.addEventListener('click', () => this.saveRoute());

        // Note: closeRoute, measureDistance and other buttons are now in floating panel
        // They will be bound when the floating panel is created
        const closeRouteBtn = document.getElementById('closeRoute');
        if (closeRouteBtn) {
            closeRouteBtn.addEventListener('click', () => this.closeRoute());
            console.log('closeRoute button bound successfully');
        } else {
            console.log('closeRoute button will be bound to floating panel (normal)');
        }

        const measureDistanceBtn = document.getElementById('measureDistance');
        if (measureDistanceBtn) {
            measureDistanceBtn.addEventListener('click', () => this.toggleMeasurementMode());
            console.log('measureDistance button bound successfully');
        } else {
            console.log('measureDistance button will be bound to floating panel (normal)');
        }
        // Bind elevation profile button
        const elevationBtn = document.getElementById('elevationProfile');
        if (elevationBtn) {
            elevationBtn.addEventListener('click', () => this.toggleElevationProfile());
            console.log('Elevation profile button bound successfully');
        } else {
            console.log('Elevation profile button will be bound to floating panel (normal)');
        }

        const closeElevationBtn = document.getElementById('closeElevationPanel');
        if (closeElevationBtn) {
            closeElevationBtn.addEventListener('click', () => this.hideElevationProfile());
        }

        // Bind POI and analysis buttons
        const findPOIBtn = document.getElementById('findPOI');
        if (findPOIBtn) {
            findPOIBtn.addEventListener('click', () => this.findPOIAlongRoute());
            console.log('findPOI button bound successfully');
        } else {
            console.log('findPOI button will be bound to floating panel (normal)');
        }

        const analyzeBtn = document.getElementById('analyzeRoute');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeRouteSurface());
            console.log('analyzeRoute button bound successfully');
        } else {
            console.log('analyzeRoute button will be bound to floating panel (normal)');
        }

        const closeAnalysisBtn = document.getElementById('closeAnalysisPanel');
        if (closeAnalysisBtn) {
            closeAnalysisBtn.addEventListener('click', () => this.hideAnalysisPanel());
        }

        document.getElementById('avgSpeed')?.addEventListener('input', () => this.updateEstimatedTime());
         // Добавьте этот обработчик
        document.addEventListener('keydown', (e) => {
            // Убедимся, что фокус не в поле ввода, чтобы не мешать печатать
            if (document.activeElement.tagName.toLowerCase() === 'input') {
                return;
            }
            
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault(); // Отменяем стандартное действие браузера
                this.undoPoint();
            }
        });
}
    
    // Custom marker icons with numbers
    getMarkerIcon(index, total) {
        let emoji, size;
        if (index === 0) {
            emoji = '🟢';
            size = [24, 24];
        } else if (index === total - 1) {
            emoji = '🔴';
            size = [24, 24];
        } else {
            emoji = `${index}`;
            size = [20, 20];
        }

        return L.divIcon({
            className: `route-marker ${index === 0 ? 'start-marker' : index === total - 1 ? 'end-marker' : 'intermediate-marker'}`,
            html: `<div>${emoji}</div>`,
            iconSize: size,
            iconAnchor: [size[0]/2, size[0]/2]
        });
    }
    
    // Calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Update route info display
    // 1. ЗАМЕНИТЕ ВЕСЬ МЕТОД updateRouteInfo НА ЭТОТ:
    updateRouteInfo() {
        this.totalDistance = 0;
        for (let i = 1; i < this.route.length; i++) {
            this.totalDistance += this.calculateDistance(
                this.route[i-1].lat, this.route[i-1].lng,
                this.route[i].lat, this.route[i].lng
            );
        }
        
        const infoText = this.route.length > 0 ? 
            `Точек: ${this.route.length}, Расстояние: ${this.totalDistance.toFixed(2)} км` : 
            'Кликните по карте для добавления точек';
        
        document.getElementById('routeInfo').textContent = infoText;

        // Новая логика расчета времени
        this.updateEstimatedTime();
        
        this.updateDistanceTicks();

        // Update elevation profile if visible
        const elevationPanel = document.getElementById('elevationPanel');
        if (elevationPanel && elevationPanel.style.display === 'block') {
            if (this.route.length >= 2) {
                console.log('Updating elevation profile for route with', this.route.length, 'points');
                this.generateElevationProfile();
            } else {
                console.log('Route too short for elevation profile, showing empty state');
                this.showEmptyElevationProfile();
            }
        }

        // Update analysis panel if visible
        const analysisPanel = document.getElementById('analysisPanel');
        if (analysisPanel && analysisPanel.style.display === 'block') {
            if (this.route.length >= 2) {
                console.log('Updating analysis panel for route with', this.route.length, 'points');
                // Обновляем анализ поверхности, если панель открыта
                const analysisData = this.generateMockSurfaceAnalysis();
                const surfaceStats = this.calculateSurfaceStatistics(analysisData);
                const routeLength = this.totalDistance;

                this.createAnalysisSummary(analysisData, surfaceStats, routeLength);
                this.createAnalysisDetails(analysisData, surfaceStats);
                this.createAnalysisRecommendations(analysisData, surfaceStats, routeLength);
            } else {
                // Очищаем анализ, если маршрут слишком короткий
                this.showEmptyAnalysisState();
            }
        }

        // Emit route changed event
        this.emit('routeChanged');
        this.emit('routeUpdated');
    }

    // Update marker indices after dragging
    updateMarkerIndices() {
        // Пересчитываем индексы для всех маркеров
        this.markers.forEach((marker, index) => {
            marker.routeIndex = index;
        });
    }


    updateEstimatedTime() {
        const avgSpeedInput = document.getElementById('avgSpeed');
        const timeElement = document.getElementById('estimatedTime');

        if (this.totalDistance > 0 && avgSpeedInput && timeElement) {
            const speed = parseFloat(avgSpeedInput.value) || 25;
            if (speed > 0) {
                const timeInHours = this.totalDistance / speed;
                const totalMinutes = timeInHours * 60;
                
                // Используем новую функцию форматирования времени
                timeElement.textContent = this.formatDuration(totalMinutes);

            } else {
                timeElement.textContent = '';
            }
        } else if (timeElement) {
            timeElement.textContent = '';
        }
    }
    
    // Find point at specific distance along route
    getPointAtDistance(targetDistanceKm) {
        if (this.route.length < 2) return null;
        
        let accumulatedDistance = 0;
        
        for (let i = 1; i < this.route.length; i++) {
            const segmentDistance = this.calculateDistance(
                this.route[i-1].lat, this.route[i-1].lng,
                this.route[i].lat, this.route[i].lng
            );
            
            if (accumulatedDistance + segmentDistance >= targetDistanceKm) {
                // Point is on this segment
                const distanceIntoSegment = targetDistanceKm - accumulatedDistance;
                const ratio = distanceIntoSegment / segmentDistance;
                
                const lat = this.route[i-1].lat + (this.route[i].lat - this.route[i-1].lat) * ratio;
                const lng = this.route[i-1].lng + (this.route[i].lng - this.route[i-1].lng) * ratio;
                
                return L.latLng(lat, lng);
            }
            
            accumulatedDistance += segmentDistance;
        }
        
        return null;
    }
    
    // Clear distance ticks
    clearDistanceTicks() {
        this.distanceTicks.forEach(tick => this.map.removeLayer(tick));
        this.distanceTicks = [];
    }
    
    // Format duration in human-readable format
    formatDuration(totalMinutes) {
        const days = Math.floor(totalMinutes / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = Math.round(totalMinutes % 60);

        let result = '≈ ';

        if (days > 0) {
            result += `${days} ${this.getDaysText(days)} `;
        }

        if (hours > 0) {
            result += `${hours} ${this.getHoursText(hours)} `;
        }

        if (minutes > 0 || (days === 0 && hours === 0)) {
            result += `${minutes} ${this.getMinutesText(minutes)}`;
        }

        return result.trim();
    }

    // Helper functions for Russian pluralization
    getDaysText(days) {
        if (days % 10 === 1 && days % 100 !== 11) return 'день';
        if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return 'дня';
        return 'дней';
    }

    getHoursText(hours) {
        if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
        if (hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 10 || hours % 100 >= 20)) return 'часа';
        return 'часов';
    }

    getMinutesText(minutes) {
        if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минута';
        if (minutes % 10 >= 2 && minutes % 10 <= 4 && (minutes % 100 < 10 || minutes % 100 >= 20)) return 'минуты';
        return 'минут';
    }
    
    // Update distance ticks
    updateDistanceTicks() {
        this.clearDistanceTicks();
        
        if (this.route.length < 2 || this.totalDistance < 1) return;
        
        // Calculate tick interval based on route length for better readability
        let tickInterval;
        if (this.totalDistance < 10) {
            tickInterval = 1; // Каждый км для коротких маршрутов
        } else if (this.totalDistance < 20) {
            tickInterval = 2; // Каждые 2 км для маршрутов 10-20 км
        } else if (this.totalDistance < 50) {
            tickInterval = 5; // Каждые 5 км для маршрутов 20-50 км
        } else if (this.totalDistance < 100) {
            tickInterval = 10; // Каждые 10 км для маршрутов 50-100 км
        } else {
            tickInterval = 20; // Каждые 20 км для очень длинных маршрутов
        }

        console.log(`📏 Маршрут: ${this.totalDistance.toFixed(1)} км, интервал меток: ${tickInterval} км`);

        let distance = tickInterval;
        
        while (distance < this.totalDistance) {
            const point = this.getPointAtDistance(distance);
            if (point) {
                const tickMarker = L.marker(point, {
                    icon: L.divIcon({
                        className: 'distance-tick',
                        html: `${distance}км`,
                        iconSize: [null, null],
                        iconAnchor: [15, 10]
                    }),
                    interactive: false
                });
                
                this.distanceTicks.push(tickMarker);
                tickMarker.addTo(this.map);
            }
            distance += tickInterval;
        }

        // Always add a tick at the end of the route (if not already added)
        if (this.totalDistance > tickInterval && Math.floor(this.totalDistance) > Math.floor(distance - tickInterval)) {
            const endDistance = Math.floor(this.totalDistance);
            const endPoint = this.getPointAtDistance(endDistance);
            if (endPoint) {
                const endTickMarker = L.marker(endPoint, {
                    icon: L.divIcon({
                        className: 'distance-tick distance-tick-end',
                        html: `${endDistance}км`,
                        iconSize: [null, null],
                        iconAnchor: [15, 10]
                    }),
                    interactive: false
                });

                this.distanceTicks.push(endTickMarker);
                endTickMarker.addTo(this.map);
                console.log(`📍 Добавлена конечная метка: ${endDistance} км`);
            }
        }
    }
    
    // Add marker with enhanced dragging and context menu
    addMarker(latlng, index) {
        const icon = this.getMarkerIcon(index, this.route.length);
        const marker = L.marker(latlng, {
            icon: icon,
            draggable: true,
            autoPan: true
        });

        marker.routeIndex = index;
        
        // Enhanced drag functionality with visual feedback
        marker.on('dragstart', (e) => {
            this.isDragging = true;
            marker.setOpacity(0.7);
            // Не отключаем перетаскивание карты, чтобы избежать проблем
            // this.map.dragging.disable();
        });

        marker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            this.route[marker.routeIndex] = newPos;

            // Обновляем только линию маршрута во время перетаскивания, без маркеров
            // Используем requestAnimationFrame для оптимизации производительности
            if (!this.dragUpdatePending) {
                this.dragUpdatePending = true;
                requestAnimationFrame(() => {
                    this.polyline.setLatLngs(this.route);
                    this.polylineShadow.setLatLngs(this.route);
                    this.updateGradientLine();
                    this.dragUpdatePending = false;
                });
            }
        });

        marker.on('dragend', (e) => {
            this.isDragging = false;
            marker.setOpacity(1);
            // this.map.dragging.enable();

            // Обновляем индексы маркеров после перетаскивания
            this.updateMarkerIndices();

            this.updateRouteInfo();
        });

        // Enhanced context menu
        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            if (!this.isDragging) {
                this.showContextMenu(e.containerPoint, marker.routeIndex);
            }
        });

        // Add hover effects
        marker.on('mouseover', (e) => {
            if (!this.isDragging) {
                marker.setOpacity(0.8);
            }
        });

        marker.on('mouseout', (e) => {
            if (!this.isDragging) {
                marker.setOpacity(1);
            }
        });

        this.markers.push(marker);
        marker.addTo(this.map);
        return marker;
    }
    
    // Update polyline and markers
    updatePolyline() {
        this.polyline.setLatLngs(this.route);
        this.polylineShadow.setLatLngs(this.route);

        // Update gradient line
        this.updateGradientLine();
        
        // Remove all markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        // Re-add markers with correct indices
        this.route.forEach((latlng, index) => {
            this.addMarker(latlng, index);
        });
    }
    
    // Show context menu for marker
    showContextMenu(point, markerIndex) {
        // Remove existing context menu
        this.removeContextMenu();

        const contextMenu = L.DomUtil.create('div', 'context-menu');
        contextMenu.style.left = point.x + 'px';
        contextMenu.style.top = point.y + 'px';

        // Create menu items based on marker position
        const isFirst = markerIndex === 0;
        const isLast = markerIndex === this.route.length - 1;

        contextMenu.innerHTML = `
            <button class="context-menu-item" onclick="window.routePlanner.insertPointBefore(${markerIndex})">
                ➕ Вставить точку перед
            </button>
            ${!isLast ? `<button class="context-menu-item" onclick="window.routePlanner.insertPointAfter(${markerIndex})">
                ➕ Вставить точку после
            </button>` : ''}
            ${this.route.length > 2 ? `<button class="context-menu-item delete" onclick="window.routePlanner.removePoint(${markerIndex})">
                🗑️ Удалить точку
            </button>` : ''}
            <button class="context-menu-item" onclick="window.routePlanner.zoomToPoint(${markerIndex})">
                🔍 Приблизить сюда
            </button>
        `;

        this.map._container.appendChild(contextMenu);
        this.contextMenu = contextMenu;

        // Close menu when clicking outside
        setTimeout(() => {
            L.DomEvent.on(document, 'click', this.removeContextMenu, this);
        }, 100);
    }

    // Remove context menu
    removeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        L.DomEvent.off(document, 'click', this.removeContextMenu, this);
    }
    
    // Add point to route with animation
    addPoint(latlng, insertIndex = -1) {
        if (insertIndex === -1) {
            this.route.push(latlng);
        } else {
            this.route.splice(insertIndex, 0, latlng);
        }

        this.animateRouteCreation();
        this.updatePolyline();
        this.updateRouteInfo();
    }

    // Animate route creation
    animateRouteCreation() {
        if (this.route.length < 2) return;

        // Add a temporary animated marker at the new point
        const lastPoint = this.route[this.route.length - 1];
        const animatedMarker = L.marker(lastPoint, {
            icon: L.divIcon({
                className: 'animated-marker',
                html: '<div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(34, 197, 94, 0.5); animation: markerPulse 0.6s ease-out;"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            }),
            interactive: false
        });

        animatedMarker.addTo(this.map);

        // Remove animated marker after animation
        setTimeout(() => {
            this.map.removeLayer(animatedMarker);
        }, 600);
    }

    // Insert point before specific index
    insertPointBefore(index) {
        if (index < 0 || index >= this.route.length) return;

        const prevPoint = index > 0 ? this.route[index - 1] : this.route[index];
        const currentPoint = this.route[index];

        // Calculate midpoint
        const midLat = (prevPoint.lat + currentPoint.lat) / 2;
        const midLng = (prevPoint.lng + currentPoint.lng) / 2;

        this.addPoint(L.latLng(midLat, midLng), index);
        this.removeContextMenu();
    }

    // Insert point after specific index
    insertPointAfter(index) {
        if (index < 0 || index >= this.route.length - 1) return;

        const currentPoint = this.route[index];
        const nextPoint = this.route[index + 1];

        // Calculate midpoint
        const midLat = (currentPoint.lat + nextPoint.lat) / 2;
        const midLng = (currentPoint.lng + nextPoint.lng) / 2;

        this.addPoint(L.latLng(midLat, midLng), index + 1);
        this.removeContextMenu();
    }

    // Zoom to specific point
    zoomToPoint(index) {
        if (index < 0 || index >= this.route.length) return;

        const point = this.route[index];
        this.map.setView(point, 15);
        this.removeContextMenu();
    }

    // Toggle measurement mode
    toggleMeasurementMode() {
        const button = document.getElementById('measureDistance');
        this.isMeasuring = !this.isMeasuring;

        if (this.isMeasuring) {
            button.textContent = '❌ Закончить';
            button.style.backgroundColor = '#ef4444';
            button.style.color = 'white';
            this.clearMeasurement();
            alert('Режим измерения активирован. Кликайте по карте для измерения расстояния.');
        } else {
            button.textContent = '📏 Измерить';
            button.style.backgroundColor = '';
            button.style.color = '';
            this.clearMeasurement();
        }
    }

    // Add measurement point
    addMeasurementPoint(latlng) {
        this.measurementPoints.push(latlng);

        // Add measurement marker
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'measurement-marker',
                html: `<div>${this.measurementPoints.length}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            draggable: true
        });

        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            const index = this.measurementMarkers.indexOf(marker);
            if (index !== -1) {
                this.measurementPoints[index] = newPos;
                this.updateMeasurementLine();
            }
        });

        marker.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            const index = this.measurementMarkers.indexOf(marker);
            if (index !== -1) {
                this.removeMeasurementPoint(index);
            }
        });

        this.measurementMarkers.push(marker);
        marker.addTo(this.map);

        this.updateMeasurementLine();

        if (this.measurementPoints.length >= 2) {
            this.showMeasurementResult();
        }
    }

    // Update measurement line
    updateMeasurementLine() {
        if (this.measurementLine) {
            this.map.removeLayer(this.measurementLine);
        }

        if (this.measurementPoints.length >= 2) {
            this.measurementLine = L.polyline(this.measurementPoints, {
                color: '#10b981',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(this.map);
        }
    }

    // Show measurement result
    showMeasurementResult() {
        let totalDistance = 0;
        for (let i = 1; i < this.measurementPoints.length; i++) {
            totalDistance += this.calculateDistance(
                this.measurementPoints[i-1].lat, this.measurementPoints[i-1].lng,
                this.measurementPoints[i].lat, this.measurementPoints[i].lng
            );
        }

        const result = totalDistance < 1 ?
            `${(totalDistance * 1000).toFixed(0)} м` :
            `${totalDistance.toFixed(2)} км`;

        // Update route info to show measurement
        const infoText = `📏 Измерение: ${result}`;
        document.getElementById('routeInfo').textContent = infoText;
    }

    // Remove measurement point
    removeMeasurementPoint(index) {
        if (index < 0 || index >= this.measurementPoints.length) return;

        this.measurementPoints.splice(index, 1);
        const marker = this.measurementMarkers.splice(index, 1)[0];
        this.map.removeLayer(marker);

        this.updateMeasurementLine();

        if (this.measurementPoints.length >= 2) {
            this.showMeasurementResult();
        } else {
            this.updateRouteInfo(); // Return to normal route info
        }
    }

    // Clear measurement
    clearMeasurement() {
        this.measurementPoints = [];
        this.measurementMarkers.forEach(marker => this.map.removeLayer(marker));
        this.measurementMarkers = [];

        if (this.measurementLine) {
            this.map.removeLayer(this.measurementLine);
            this.measurementLine = null;
        }

        this.updateRouteInfo();
    }

    // Create gradient line visualization
    createGradientLine() {
        this.gradientLineGroup = L.layerGroup().addTo(this.map);
        this.updateGradientLine();
    }

    // Update gradient line segments
    updateGradientLine() {
        if (!this.gradientLineGroup) return;

        // Clear existing gradient segments
        this.gradientLineGroup.clearLayers();

        if (this.route.length < 2) return;

        // Create gradient segments
        const totalDistance = this.totalDistance;
        let accumulatedDistance = 0;

        for (let i = 1; i < this.route.length; i++) {
            const segmentStart = this.route[i-1];
            const segmentEnd = this.route[i];
            const segmentDistance = this.calculateDistance(
                segmentStart.lat, segmentStart.lng,
                segmentEnd.lat, segmentEnd.lng
            );

            // Calculate color based on progress along the route
            const progress = accumulatedDistance / totalDistance;
            const color = this.getGradientColor(progress);

            // Create segment
            const segment = L.polyline([segmentStart, segmentEnd], {
                color: color,
                weight: 6,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
            });

            this.gradientLineGroup.addLayer(segment);
            accumulatedDistance += segmentDistance;
        }
    }

    // Get color for gradient based on progress (0-1)
    getGradientColor(progress) {
        // Gradient from green (start) to red (end)
        const r = Math.round(34 + (220 * progress));   // 34 to 254
        const g = Math.round(197 - (131 * progress));  // 197 to 66
        const b = Math.round(148 - (82 * progress));   // 148 to 66

        return `rgb(${r}, ${g}, ${b})`;
    }

    // Toggle elevation profile panel
    toggleElevationProfile() {
        console.log('Toggle elevation profile clicked');

        const panel = document.getElementById('elevationPanel');
        if (!panel) {
            console.error('Elevation panel not found!');
            return;
        }

        if (panel.style.display === 'block') {
            this.hideElevationProfile();
        } else {
            this.showElevationProfile();
        }
    }

    // Show elevation profile
    showElevationProfile() {
        const panel = document.getElementById('elevationPanel');
        panel.style.display = 'block';

        if (this.route.length >= 2) {
            this.generateElevationProfile();
        } else {
            this.showEmptyElevationProfile();
        }

        // Scroll to panel
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Hide elevation profile
    hideElevationProfile() {
        const panel = document.getElementById('elevationPanel');
        panel.style.display = 'none';
    }

    // Generate elevation profile visualization
    generateElevationProfile() {
        try {
            console.log('Generating elevation profile for route with', this.route.length, 'points');

            const chartContainer = document.getElementById('elevationChart');
            const statsContainer = document.getElementById('elevationStats');

            if (!chartContainer || !statsContainer) {
                console.error('Elevation containers not found:', {chartContainer, statsContainer});
                return;
            }

            // Check if we have enough points
            if (this.route.length < 2) {
                console.warn('Not enough route points for elevation profile');
                this.showEmptyElevationProfile();
                return;
            }

            // Generate mock elevation data (in real app, this would come from an API)
            const elevations = this.generateMockElevations();
            const distances = this.calculateSegmentDistances();

            // Validate data
            if (!elevations || elevations.length === 0 || !distances || distances.length === 0) {
                console.error('Invalid elevation or distance data');
                this.showEmptyElevationProfile();
                return;
            }

            console.log('Elevation data:', elevations);
            console.log('Distance data:', distances);

            // Create elevation chart
            this.renderElevationChart(chartContainer, elevations, distances);
            this.renderElevationStats(statsContainer, elevations, distances);

            console.log('Elevation profile generated successfully');
        } catch (error) {
            console.error('Error generating elevation profile:', error);
            this.showEmptyElevationProfile();
        }
    }

    // Generate mock elevation data
    generateMockElevations() {
        const elevations = [];
        let currentElevation = 100 + Math.random() * 200; // Start between 100-300m

        elevations.push(currentElevation);

        for (let i = 1; i < this.route.length; i++) {
            // Random elevation change between -50m and +50m per segment
            const change = (Math.random() - 0.5) * 100;
            currentElevation = Math.max(0, currentElevation + change);
            elevations.push(currentElevation);
        }

        return elevations;
    }

    // Calculate distances for each segment
    calculateSegmentDistances() {
        const distances = [0];
        let totalDistance = 0;

        for (let i = 1; i < this.route.length; i++) {
            const segmentDistance = this.calculateDistance(
                this.route[i-1].lat, this.route[i-1].lng,
                this.route[i].lat, this.route[i].lng
            );
            totalDistance += segmentDistance;
            distances.push(totalDistance);
        }

        return distances;
    }

    // Get smart distance markers based on route length
    getSmartDistanceMarkers(maxDistance) {
        const markers = [];

        // Always show start
        markers.push({ distance: 0, label: '0' });

        let interval;

        // Smart interval selection based on distance
        if (maxDistance < 5) {
            // Short routes: every 0.5 km
            interval = 0.5;
        } else if (maxDistance < 20) {
            // Medium routes: every 2 km
            interval = 2;
        } else if (maxDistance < 50) {
            // Long routes: every 5 km
            interval = 5;
        } else if (maxDistance < 100) {
            // Very long routes: every 10 km
            interval = 10;
        } else {
            // Ultra long routes: every 20 km
            interval = 20;
        }

        // Generate markers at smart intervals
        let currentDistance = interval;
        while (currentDistance < maxDistance) {
            // Try to align to nice round numbers
            let markerDistance = currentDistance;

            // Round to nearest interval for better readability
            if (interval >= 5) {
                markerDistance = Math.round(markerDistance / interval) * interval;
            }

            if (markerDistance < maxDistance && markerDistance > 0) {
                markers.push({
                    distance: markerDistance,
                    label: Math.round(markerDistance).toString()
                });
            }

            currentDistance += interval;
        }

        // Always show end
        if (maxDistance > 0.1) {
            markers.push({
                distance: maxDistance,
                label: Math.round(maxDistance).toString()
            });
        }

        // Remove duplicates and sort
        const uniqueMarkers = markers
            .filter((marker, index, self) =>
                index === self.findIndex(m => m.distance === marker.distance)
            )
            .sort((a, b) => a.distance - b.distance);

        return uniqueMarkers;
    }

    // Render elevation chart
    renderElevationChart(container, elevations, distances) {
        console.log('Rendering elevation chart with:', {elevations, distances});

        const maxElevation = Math.max(...elevations);
        const minElevation = Math.min(...elevations);
        const elevationRange = maxElevation - minElevation || 1;
        const maxDistance = distances[distances.length - 1] || 1;

        console.log('Chart parameters:', {maxElevation, minElevation, elevationRange, maxDistance});

        // Определяем цвета для графика в зависимости от темы
        const isDark = document.documentElement.classList.contains('dark');
        const gradientBg = isDark
            ? 'linear-gradient(180deg, var(--bg-color) 0%, rgba(var(--bg-color-rgb, 12,12,15), 0.8) 100%)'
            : 'linear-gradient(180deg, var(--bg-color) 0%, rgba(var(--bg-color-rgb, 244,245,247), 0.8) 100%)';

        let chartHTML = `<svg width="100%" height="300" viewBox="0 0 400 300" style="background: ${gradientBg}; border: 1px solid var(--border-color); border-radius: 12px;">`;

        // Background gradient
        chartHTML += `<defs>
            <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="var(--strava-orange)" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="var(--strava-orange)" stop-opacity="0.1"/>
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#22c55e"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#ef4444"/>
            </linearGradient>
        </defs>`;

        // Grid lines with better spacing
        for (let i = 0; i <= 6; i++) {
            const y = 40 + (i * 35);
            chartHTML += `<line x1="60" y1="${y}" x2="340" y2="${y}" stroke="var(--border-color)" stroke-width="1" opacity="0.2"/>`;
        }

        // Elevation path with gradient
        let pathData = '';
        elevations.forEach((elevation, index) => {
            const x = 60 + (distances[index] / maxDistance) * 280; // 60px left/right margin
            const y = 250 - ((elevation - minElevation) / elevationRange) * 200; // 40px top/bottom margin
            pathData += `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        });

        if (pathData) {
            // Fill area under the curve with gradient
            const fillPath = pathData + ` L 340 250 L 60 250 Z`;
            chartHTML += `<path d="${fillPath}" fill="url(#elevationGradient)" stroke="none"/>`;

            // Main elevation line with gradient
            chartHTML += `<path d="${pathData}" fill="none" stroke="url(#lineGradient)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;

            // Glow effect for the line
            chartHTML += `<path d="${pathData}" fill="none" stroke="url(#lineGradient)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>`;
        }

        // Distance markers (умная система)
        const distanceMarkers = this.getSmartDistanceMarkers(maxDistance);
        distanceMarkers.forEach(marker => {
            const x = 60 + (marker.distance / maxDistance) * 280;
            const markerDistance = marker.distance;

            // Vertical line
            chartHTML += `<line x1="${x}" y1="40" x2="${x}" y2="250" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>`;

            // Distance label
            const label = markerDistance >= 1 ? `${Math.round(markerDistance)}км` : `${Math.round(markerDistance * 10) / 10}км`;
            chartHTML += `<text x="${x}" y="270" text-anchor="middle" font-size="10" fill="var(--text-secondary)" font-weight="500">${label}</text>`;
        });

        // Elevation labels on the left
        for (let i = 0; i <= 5; i++) {
            const elevation = minElevation + (elevationRange * i / 5);
            const y = 250 - (i * 35);
            chartHTML += `<text x="45" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-secondary)" font-weight="500">${Math.round(elevation)}м</text>`;
        }

        chartHTML += '</svg>';

        console.log('Generated chart HTML:', chartHTML);
        container.innerHTML = chartHTML;
    }

    // Render elevation statistics
    renderElevationStats(container, elevations, distances) {
        if (!elevations || elevations.length === 0) {
            console.warn('No elevation data to render stats');
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">Нет данных для статистики</div>';
            return;
        }

        const maxElevation = Math.max(...elevations);
        const minElevation = Math.min(...elevations);
        const elevationGain = this.calculateElevationGain(elevations);
        const elevationLoss = this.calculateElevationLoss(elevations);

        container.innerHTML = `
            <div class="elevation-stat">
                <div class="stat-icon">🏔️</div>
                <div class="stat-content">
                    <div class="stat-label">Максимальная высота</div>
                    <div class="stat-value" style="color: #ef4444;">${Math.round(maxElevation)}м</div>
                </div>
            </div>
            <div class="elevation-stat">
                <div class="stat-icon">🏕️</div>
                <div class="stat-content">
                    <div class="stat-label">Минимальная высота</div>
                    <div class="stat-value" style="color: #22c55e;">${Math.round(minElevation)}м</div>
                </div>
            </div>
            <div class="elevation-stat">
                <div class="stat-icon">📈</div>
                <div class="stat-content">
                    <div class="stat-label">Набор высоты</div>
                    <div class="stat-value" style="color: var(--strava-orange); font-weight: 700;">+${Math.round(elevationGain)}м</div>
                </div>
            </div>
            <div class="elevation-stat">
                <div class="stat-icon">📉</div>
                <div class="stat-content">
                    <div class="stat-label">Спуск</div>
                    <div class="stat-value" style="color: #10b981; font-weight: 700;">-${Math.round(elevationLoss)}м</div>
                </div>
            </div>
        `;
    }

    // Calculate total elevation gain
    calculateElevationGain(elevations) {
        let gain = 0;
        for (let i = 1; i < elevations.length; i++) {
            if (elevations[i] > elevations[i-1]) {
                gain += elevations[i] - elevations[i-1];
            }
        }
        return gain;
    }

    // Calculate total elevation loss
    calculateElevationLoss(elevations) {
        let loss = 0;
        for (let i = 1; i < elevations.length; i++) {
            if (elevations[i] < elevations[i-1]) {
                loss += elevations[i-1] - elevations[i];
            }
        }
        return loss;
    }

    // Show empty elevation profile
    showEmptyElevationProfile() {
        const chartContainer = document.getElementById('elevationChart');
        const statsContainer = document.getElementById('elevationStats');

        chartContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">Создайте маршрут для просмотра профиля</div>';
        statsContainer.innerHTML = '';
    }

    // Show empty analysis state
    showEmptyAnalysisState() {
        const summaryContainer = document.getElementById('analysisSummary');
        const detailsContainer = document.getElementById('analysisDetails');
        const recommendationsContainer = document.getElementById('analysisRecommendations');

        if (summaryContainer) {
            summaryContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">Создайте маршрут из минимум 2 точек для анализа поверхности</div>';
        }
        if (detailsContainer) {
            detailsContainer.innerHTML = '';
        }
        if (recommendationsContainer) {
            recommendationsContainer.innerHTML = '';
        }
    }
    
    // Remove point from route
    removePoint(index) {
        this.route.splice(index, 1);
        this.updatePolyline();
        this.updateRouteInfo();
        this.removeContextMenu();
    }
    
    // Find closest segment for inserting intermediate point
    findClosestSegment(clickPoint) {
        if (this.route.length < 2) return -1;
        
        let minDistance = Infinity;
        let closestSegment = -1;
        let closestDistance = Infinity;
        
        for (let i = 0; i < this.route.length - 1; i++) {
            const segmentStart = this.map.latLngToLayerPoint(this.route[i]);
            const segmentEnd = this.map.latLngToLayerPoint(this.route[i + 1]);
            const clickLayerPoint = this.map.latLngToLayerPoint(clickPoint);
            
            // Calculate distance from point to line segment using vector math
            const A = clickLayerPoint.x - segmentStart.x;
            const B = clickLayerPoint.y - segmentStart.y;
            const C = segmentEnd.x - segmentStart.x;
            const D = segmentEnd.y - segmentStart.y;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;

            if (lenSq === 0) {
                // Segment is a point
                const distance = Math.sqrt(A * A + B * B);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestSegment = i;
                    closestDistance = distance;
                }
                continue;
            }

            const param = dot / lenSq;
            
            let closestPoint;
            if (param < 0) {
                closestPoint = segmentStart;
            } else if (param > 1) {
                closestPoint = segmentEnd;
            } else {
                closestPoint = {
                    x: segmentStart.x + param * C,
                    y: segmentStart.y + param * D
                };
            }
            
            const distance = Math.sqrt(
                Math.pow(clickLayerPoint.x - closestPoint.x, 2) + 
                Math.pow(clickLayerPoint.y - closestPoint.y, 2)
            );
            
            // Увеличиваем порог для лучшего захвата и добавляем проверку на минимальную дистанцию
            if (distance < minDistance && distance < 30 && distance < closestDistance) { // Увеличил с 20 до 30
                minDistance = distance;
                closestSegment = i + 1;
                closestDistance = distance;
            }
        }
        
        console.log('Closest segment found:', closestSegment, 'at distance:', closestDistance);
        return closestSegment;
    }
    
    // Map click handler
    handleMapClick(e) {
        if (this.isMeasuring) {
            this.addMeasurementPoint(e.latlng);
            return;
        }

        // Check if click is near existing route segment
        const insertIndex = this.findClosestSegment(e.latlng);
        
        if (insertIndex !== -1) {
            console.log('Inserting point at index:', insertIndex);
            // Insert intermediate point
            this.addPoint(e.latlng, insertIndex);

            // Добавляем визуальную обратную связь
            this.showInsertionFeedback(e.latlng, 'Точка вставлена между существующими!');
        } else {
            console.log('Adding point to end of route');
            // Add point to end of route
            this.addPoint(e.latlng);

            // Добавляем визуальную обратную связь
            this.showInsertionFeedback(e.latlng, 'Точка добавлена в конец маршрута!');
        }
    }

    // Show visual feedback for point insertion
    showInsertionFeedback(position, message) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--strava-orange);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: fadeInOut 2s ease-in-out;
        `;

        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                10%, 90% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Удаляем уведомление через 2 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            if (style.parentNode) {
                style.remove();
            }
        }, 2000);
    }

    // Initialize POI search system
    initPOISystem() {
        this.poiLayerGroup = L.layerGroup().addTo(this.map);
    }

    // Initialize surface analysis system
    initSurfaceAnalysis() {
        this.analysisLayerGroup = L.layerGroup().addTo(this.map);
    }

    // Find points of interest along the route
    async findPOIAlongRoute() {
        if (this.route.length < 2) {
            alert('Создайте маршрут из минимум 2 точек для поиска POI');
            return;
        }

        console.log('Searching for POI along route...');

        // Clear existing POI markers
        this.clearPOI();

        try {
            // Get route bounds
            const bounds = L.polyline(this.route).getBounds();
            const center = bounds.getCenter();

            // Simulate POI search (in real app, this would call an API)
            const mockPOIs = this.generateMockPOIs(center, bounds);

            mockPOIs.forEach(poi => {
                const marker = L.marker([poi.lat, poi.lon], {
                    icon: L.divIcon({
                        className: 'poi-marker',
                        html: `<div>${poi.icon}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    })
                });

                marker.bindPopup(`
                    <div style="font-family: Inter, sans-serif; max-width: 200px;">
                        <h4 style="margin: 0 0 8px 0; color: var(--strava-orange);">${poi.name}</h4>
                        <p style="margin: 0 0 8px 0; font-size: 14px;">${poi.type}</p>
                        <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
                            📍 ${poi.distance.toFixed(1)} км от маршрута
                        </p>
                    </div>
                `);

                this.poiMarkers.push(marker);
                marker.addTo(this.poiLayerGroup);
            });

            this.showInsertionFeedback(this.route[0], `Найдено ${mockPOIs.length} точек интереса вдоль маршрута!`);

        } catch (error) {
            console.error('Error finding POI:', error);
            alert('Ошибка при поиске точек интереса');
        }
    }

    // Generate mock POI data (in real app, this would use Overpass API or similar)
    generateMockPOIs(center, bounds) {
        const pois = [];
        const types = [
            { name: 'Кафе', icon: '☕', type: 'Еда и напитки' },
            { name: 'Заправка', icon: '⛽', type: 'Транспорт' },
            { name: 'Парк', icon: '🌳', type: 'Отдых' },
            { name: 'Магазин', icon: '🏪', type: 'Покупки' },
            { name: 'Отель', icon: '🏨', type: 'Проживание' },
            { name: 'Больница', icon: '🏥', type: 'Медицина' },
            { name: 'Банк', icon: '🏦', type: 'Финансы' },
            { name: 'Спортзал', icon: '🏋️‍♂️', type: 'Спорт' }
        ];

        // Generate 5-10 random POI near the route
        const poiCount = Math.floor(Math.random() * 6) + 5;

        for (let i = 0; i < poiCount; i++) {
            const angle = (Math.PI * 2 * i) / poiCount;
            const distance = 0.5 + Math.random() * 2; // 0.5-2.5 km from center

            const poiLat = center.lat + (distance / 111) * Math.sin(angle);
            const poiLon = center.lng + (distance / 111) * Math.cos(angle);

            const type = types[Math.floor(Math.random() * types.length)];

            pois.push({
                lat: poiLat,
                lon: poiLon,
                name: `${type.name} ${i + 1}`,
                icon: type.icon,
                type: type.type,
                distance: distance
            });
        }

        return pois;
    }

    // Analyze route surface and provide optimization suggestions
    async analyzeRouteSurface() {
        if (this.route.length < 2) {
            alert('Создайте маршрут из минимум 2 точек для анализа');
            return;
        }

        console.log('Analyzing route surface...');

        // Clear existing analysis layers
        this.clearAnalysis();

        try {
            // Simulate surface analysis
            const analysisData = this.generateMockSurfaceAnalysis();

            // Create analysis visualization
            this.createSurfaceAnalysisVisualization(analysisData);

            // Show analysis results
            this.showSurfaceAnalysisResults(analysisData);

        } catch (error) {
            console.error('Error analyzing surface:', error);
            alert('Ошибка при анализе поверхности');
        }
    }

    // Generate realistic surface analysis data based on route characteristics
    generateMockSurfaceAnalysis() {
        const segments = [];
        const routeLength = this.totalDistance;

        // Determine activity type based on route length and speed
        const avgSpeed = parseFloat(document.getElementById('avgSpeed')?.value || 25);
        let activityType = 'mixed';

        if (avgSpeed > 20) {
            activityType = 'cycling';
        } else if (avgSpeed < 8) {
            activityType = 'hiking';
        } else {
            activityType = 'running';
        }

        for (let i = 0; i < this.route.length - 1; i++) {
            const segmentLength = this.calculateDistance(
                this.route[i].lat, this.route[i].lng,
                this.route[i + 1].lat, this.route[i + 1].lng
            );

            // Generate realistic surface based on route context
            const surfaceData = this.generateRealisticSurface(i, segmentLength, routeLength, activityType);

            segments.push({
                index: i + 1,
                start: this.route[i],
                end: this.route[i + 1],
                length: segmentLength,
                surface: surfaceData.surface,
                condition: surfaceData.condition,
                difficulty: surfaceData.difficulty,
                suitability: surfaceData.suitability,
                activityType: activityType,
                color: this.getSurfaceColor(surfaceData.surface, surfaceData.condition)
            });
        }

        return segments;
    }

    // Generate realistic surface data
    generateRealisticSurface(segmentIndex, segmentLength, totalLength, activityType) {
        const surfaces = ['асфальт', 'грунт', 'гравий', 'брусчатка', 'тропинка'];
        const conditions = ['отличное', 'хорошее', 'удовлетворительное', 'плохое'];

        // Different logic based on activity type
        let surfaceWeights;
        if (activityType === 'cycling') {
            surfaceWeights = { 'асфальт': 0.7, 'грунт': 0.2, 'гравий': 0.05, 'брусчатка': 0.03, 'тропинка': 0.02 };
        } else if (activityType === 'hiking') {
            surfaceWeights = { 'асфальт': 0.3, 'грунт': 0.4, 'гравий': 0.15, 'брусчатка': 0.05, 'тропинка': 0.1 };
        } else {
            surfaceWeights = { 'асфальт': 0.5, 'грунт': 0.3, 'гравий': 0.1, 'брусчатка': 0.05, 'тропинка': 0.05 };
        }

        // Select surface based on weights
        const random = Math.random();
        let cumulativeWeight = 0;
        let selectedSurface = 'асфальт';

        for (const [surface, weight] of Object.entries(surfaceWeights)) {
            cumulativeWeight += weight;
            if (random <= cumulativeWeight) {
                selectedSurface = surface;
                break;
            }
        }

        // Determine condition based on surface type
        let conditionWeights;
        if (selectedSurface === 'асфальт') {
            conditionWeights = { 'отличное': 0.6, 'хорошее': 0.3, 'удовлетворительное': 0.08, 'плохое': 0.02 };
        } else if (selectedSurface === 'тропинка') {
            conditionWeights = { 'отличное': 0.2, 'хорошее': 0.4, 'удовлетворительное': 0.3, 'плохое': 0.1 };
        } else {
            conditionWeights = { 'отличное': 0.3, 'хорошее': 0.4, 'удовлетворительное': 0.2, 'плохое': 0.1 };
        }

        const conditionRandom = Math.random();
        let cumulativeConditionWeight = 0;
        let selectedCondition = 'хорошее';

        for (const [condition, weight] of Object.entries(conditionWeights)) {
            cumulativeConditionWeight += weight;
            if (conditionRandom <= cumulativeConditionWeight) {
                selectedCondition = condition;
                break;
            }
        }

        // Calculate difficulty based on surface and condition
        let difficulty = 1;
        if (selectedSurface === 'асфальт' && selectedCondition === 'отличное') {
            difficulty = 1;
        } else if (selectedSurface === 'асфальт' && selectedCondition === 'хорошее') {
            difficulty = 1;
        } else if (selectedSurface === 'грунт' || selectedSurface === 'тропинка') {
            difficulty = selectedCondition === 'плохое' ? 4 : selectedCondition === 'удовлетворительное' ? 3 : 2;
        } else if (selectedSurface === 'гравий' || selectedSurface === 'брусчатка') {
            difficulty = selectedCondition === 'плохое' ? 5 : selectedCondition === 'удовлетворительное' ? 4 : 3;
        }

        // Determine suitability
        let suitability;
        if (activityType === 'cycling') {
            suitability = selectedSurface === 'асфальт' && selectedCondition !== 'плохое' ? 'велосипед' :
                         selectedSurface === 'грунт' && selectedCondition !== 'плохое' ? 'велосипед' : 'пеший';
        } else if (activityType === 'hiking') {
            suitability = selectedSurface !== 'асфальт' || selectedCondition === 'плохое' ? 'пеший' : 'смешанный';
        } else {
            suitability = selectedSurface === 'асфальт' && selectedCondition !== 'плохое' ? 'смешанный' : 'пеший';
        }

        return {
            surface: selectedSurface,
            condition: selectedCondition,
            difficulty: difficulty,
            suitability: suitability
        };
    }

    // Create visual representation of surface analysis
    createSurfaceAnalysisVisualization(analysisData) {
        analysisData.forEach((segment, index) => {
            const color = this.getSurfaceColor(segment.surface, segment.condition);

            const analysisLine = L.polyline([segment.start, segment.end], {
                color: color,
                weight: 8,
                opacity: 0.8,
                dashArray: segment.condition === 'плохое' ? '10, 10' : null
            });

            analysisLine.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <h4 style="margin: 0 0 8px 0; color: var(--strava-orange);">
                        Сегмент ${index + 1}
                    </h4>
                    <p style="margin: 0 0 4px 0;"><strong>Поверхность:</strong> ${segment.surface}</p>
                    <p style="margin: 0 0 4px 0;"><strong>Состояние:</strong> ${segment.condition}</p>
                    <p style="margin: 0 0 4px 0;"><strong>Сложность:</strong> ${segment.difficulty}/5</p>
                    <p style="margin: 0;"><strong>Подходит для:</strong> ${segment.suitability}</p>
                </div>
            `);

            this.analysisLayers.push(analysisLine);
            analysisLine.addTo(this.analysisLayerGroup);
        });
    }

    // Get color for surface type and condition
    getSurfaceColor(surface, condition) {
        const surfaceColors = {
            'асфальт': '#22c55e',
            'грунт': '#f59e0b',
            'гравий': '#ef4444',
            'брусчатка': '#8b5cf6',
            'тропинка': '#06b6d4'
        };

        let baseColor = surfaceColors[surface] || '#6b7280';

        // Adjust brightness based on condition
        if (condition === 'плохое') {
            return this.adjustColorBrightness(baseColor, -40);
        } else if (condition === 'удовлетворительное') {
            return this.adjustColorBrightness(baseColor, -20);
        }

        return baseColor;
    }

    // Adjust color brightness
    adjustColorBrightness(hex, percent) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Parse r, g, b values
        const num = parseInt(hex, 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;

        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    }

    // Show surface analysis results in a beautiful panel
    showSurfaceAnalysisResults(analysisData) {
        const surfaceStats = this.calculateSurfaceStatistics(analysisData);
        const routeLength = this.totalDistance;

        // Show analysis panel
        const panel = document.getElementById('analysisPanel');
        panel.style.display = 'block';

        // Scroll to panel
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Create beautiful analysis content
        this.createAnalysisSummary(analysisData, surfaceStats, routeLength);
        this.createAnalysisDetails(analysisData, surfaceStats);
        this.createAnalysisRecommendations(analysisData, surfaceStats, routeLength);
    }

    // Hide analysis panel
    hideAnalysisPanel() {
        const panel = document.getElementById('analysisPanel');
        panel.style.display = 'none';
    }

    // Calculate surface statistics
    calculateSurfaceStatistics(analysisData) {
        const surfaces = {};
        let bikeCount = 0;
        let walkCount = 0;

        analysisData.forEach(segment => {
            surfaces[segment.surface] = (surfaces[segment.surface] || 0) + 1;
            if (segment.suitability === 'велосипед') bikeCount++;
            if (segment.suitability === 'пеший') walkCount++;
        });

        const bestSurface = Object.keys(surfaces).reduce((a, b) =>
            surfaces[a] > surfaces[b] ? a : b);

        const worstSurface = Object.keys(surfaces).reduce((a, b) =>
            surfaces[a] < surfaces[b] ? a : b);

        return {
            bestSurface,
            worstSurface,
            bikeSuitable: Math.round((bikeCount / analysisData.length) * 100),
            walkSuitable: Math.round((walkCount / analysisData.length) * 100),
            totalSegments: analysisData.length,
            surfaceDistribution: surfaces,
            averageDifficulty: analysisData.reduce((sum, seg) => sum + seg.difficulty, 0) / analysisData.length
        };
    }

    // Create analysis summary section
    createAnalysisSummary(analysisData, surfaceStats, routeLength) {
        const summaryContainer = document.getElementById('analysisSummary');

        const avgSpeed = parseFloat(document.getElementById('avgSpeed')?.value || 25);
        const activityType = this.getActivityType(avgSpeed);

        summaryContainer.innerHTML = `
            <div class="analysis-summary-header">
                <h4>📊 Общая информация</h4>
            </div>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Длина маршрута</div>
                    <div class="summary-value">${routeLength.toFixed(1)} км</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Количество сегментов</div>
                    <div class="summary-value">${surfaceStats.totalSegments}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Тип активности</div>
                    <div class="summary-value">${this.getActivityTypeName(activityType)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Средняя скорость</div>
                    <div class="summary-value">${avgSpeed} км/ч</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Средняя сложность</div>
                    <div class="summary-value">${surfaceStats.averageDifficulty.toFixed(1)}/5</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Время прохождения</div>
                    <div class="summary-value">${this.calculateEstimatedTime(routeLength, avgSpeed)}</div>
                </div>
            </div>
        `;
    }

    // Create analysis details section
    createAnalysisDetails(analysisData, surfaceStats) {
        const detailsContainer = document.getElementById('analysisDetails');

        // Create surface distribution chart
        const surfaceChart = this.createSurfaceDistributionChart(surfaceStats.surfaceDistribution);

        // Create segments table
        const segmentsTable = this.createSegmentsTable(analysisData);

        detailsContainer.innerHTML = `
            <div class="analysis-section">
                <h4>🗺️ Распределение поверхностей</h4>
                ${surfaceChart}
            </div>

            <div class="analysis-section">
                <h4>📋 Детальный анализ сегментов</h4>
                <div class="legend-container">
                    <div class="legend-item">
                        <div class="legend-color" style="background: #22c55e;"></div>
                        <span>Асфальт</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #f59e0b;"></div>
                        <span>Грунт</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #ef4444;"></div>
                        <span>Гравий</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #8b5cf6;"></div>
                        <span>Брусчатка</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: #06b6d4;"></div>
                        <span>Тропинка</span>
                    </div>
                </div>
                ${segmentsTable}
            </div>
        `;
    }

    // Create analysis recommendations section
    createAnalysisRecommendations(analysisData, surfaceStats, routeLength) {
        const recommendationsContainer = document.getElementById('analysisRecommendations');

        const avgSpeed = parseFloat(document.getElementById('avgSpeed')?.value || 25);
        const activityType = this.getActivityType(avgSpeed);

        let recommendations = [];

        // Generate recommendations based on analysis
        if (surfaceStats.bikeSuitable > 70) {
            recommendations.push({
                type: 'success',
                icon: '🚴',
                title: 'Отлично для велосипеда!',
                description: `${surfaceStats.bikeSuitable}% маршрута идеально подходит для велоспорта`
            });
        } else if (surfaceStats.bikeSuitable < 30) {
            recommendations.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Требует внимания',
                description: `Только ${surfaceStats.bikeSuitable}% маршрута подходит для велосипеда`
            });
        }

        if (surfaceStats.averageDifficulty > 3.5) {
            recommendations.push({
                type: 'warning',
                icon: '🏔️',
                title: 'Высокая сложность',
                description: 'Маршрут имеет высокую среднюю сложность поверхности'
            });
        }

        if (surfaceStats.worstSurface === 'гравий' || surfaceStats.worstSurface === 'брусчатка') {
            recommendations.push({
                type: 'info',
                icon: '🛠️',
                title: 'Рекомендация по оборудованию',
                description: 'Рассмотрите шины с хорошим сцеплением для гравийных участков'
            });
        }

        // Time-based recommendations
        const estimatedTime = this.calculateEstimatedTime(routeLength, avgSpeed);
        if (estimatedTime.includes('ч') && parseInt(estimatedTime) > 4) {
            recommendations.push({
                type: 'info',
                icon: '⏰',
                title: 'Длительная активность',
                description: 'Возьмите достаточно воды и питания для длительного маршрута'
            });
        }

        const recommendationsHTML = recommendations.map(rec => `
            <div class="recommendation-item recommendation-${rec.type}">
                <div class="recommendation-icon">${rec.icon}</div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-description">${rec.description}</div>
                </div>
            </div>
        `).join('');

        recommendationsContainer.innerHTML = `
            <div class="analysis-section">
                <h4>💡 Рекомендации</h4>
                ${recommendations.length > 0 ? recommendationsHTML : '<p>Маршрут выглядит сбалансированным! 🎯</p>'}
            </div>
        `;
    }

    // Helper methods
    getActivityType(speed) {
        if (speed > 20) return 'cycling';
        if (speed < 8) return 'hiking';
        return 'running';
    }

    getActivityTypeName(type) {
        const names = {
            'cycling': '🚴 Велоспорт',
            'hiking': '🥾 Пеший туризм',
            'running': '🏃 Бег'
        };
        return names[type] || '🏃‍♂️ Смешанная активность';
    }

    calculateEstimatedTime(distance, speed) {
        const hours = distance / speed;
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);

        if (wholeHours > 0) {
            return `${wholeHours}ч ${minutes}мин`;
        }
        return `${minutes}мин`;
    }

    createSurfaceDistributionChart(surfaceDistribution) {
        const total = Object.values(surfaceDistribution).reduce((sum, val) => sum + val, 0);
        let chartHTML = '<div class="surface-chart">';

        Object.entries(surfaceDistribution).forEach(([surface, count]) => {
            const percentage = (count / total * 100).toFixed(1);
            const color = this.getSurfaceColor(surface, 'хорошее');
            chartHTML += `
                <div class="surface-bar">
                    <div class="surface-label">${surface}</div>
                    <div class="surface-bar-container">
                        <div class="surface-bar-fill" style="width: ${percentage}%; background: ${color};"></div>
                    </div>
                    <div class="surface-percentage">${percentage}%</div>
                </div>
            `;
        });

        chartHTML += '</div>';
        return chartHTML;
    }

    createSegmentsTable(analysisData) {
        let tableHTML = `
            <div class="segments-table">
                <div class="table-header">
                    <div>Сегмент</div>
                    <div>Длина</div>
                    <div>Поверхность</div>
                    <div>Состояние</div>
                    <div>Сложность</div>
                    <div>Подходит для</div>
                </div>
        `;

        analysisData.forEach((segment, index) => {
            tableHTML += `
                <div class="table-row">
                    <div>${segment.index}</div>
                    <div>${segment.length.toFixed(2)} км</div>
                    <div>
                        <span class="surface-indicator" style="background: ${segment.color};">
                            ${segment.surface}
                        </span>
                    </div>
                    <div>${segment.condition}</div>
                    <div>${segment.difficulty}/5</div>
                    <div>${segment.suitability === 'велосипед' ? '🚴' : segment.suitability === 'пеший' ? '🥾' : '🏃‍♂️'}</div>
                </div>
            `;
        });

        tableHTML += '</div>';
        return tableHTML;
    }

    // Clear POI markers
    clearPOI() {
        this.poiMarkers.forEach(marker => this.poiLayerGroup.removeLayer(marker));
        this.poiMarkers = [];
    }

    // Clear analysis layers
    clearAnalysis() {
        this.analysisLayers.forEach(layer => this.analysisLayerGroup.removeLayer(layer));
        this.analysisLayers = [];
    }
    
    // Clear route
    clearRoute() {
        this.route = [];
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        this.clearDistanceTicks();
        this.polyline.setLatLngs([]);
        this.polylineShadow.setLatLngs([]);

        // Clear gradient line
        if (this.gradientLineGroup) {
            this.gradientLineGroup.clearLayers();
        }

        this.clearMeasurement(); // Also clear any measurements
        this.hideElevationProfile(); // Hide elevation profile panel
        this.hideAnalysisPanel(); // Hide analysis panel
        this.clearPOI(); // Clear POI markers
        this.clearAnalysis(); // Clear analysis layers
        this.clearAutoSegments(); // Clear automatic route segments
        this.updateRouteInfo();
    }
    
    // Undo last point
    undoPoint() {
        if (this.route.length > 0) {
            this.removePoint(this.route.length - 1);
        }
    }

    // Close route (connect end to start)
    closeRoute() {
        if (this.route.length < 3) {
            alert('Для замыкания маршрута нужно минимум 3 точки');
            return;
        }

        const firstPoint = this.route[0];
        const lastPoint = this.route[this.route.length - 1];

        // Check if route is already closed (first and last points are very close)
        const distance = this.calculateDistance(
            firstPoint.lat, firstPoint.lng,
            lastPoint.lat, lastPoint.lng
        );

        if (distance < 0.01) { // Less than 10 meters
            alert('Маршрут уже замкнут');
            return;
        }

        // Add the first point at the end to close the route
        this.addPoint(firstPoint);
    }
    
    // Save route
    async saveRoute() {
        const routeName = document.getElementById('routeName')?.value;
        if (!routeName) {
            alert('Пожалуйста, введите название маршрута.');
            return;
        }
        if (this.route.length < 2) {
            alert('Маршрут должен состоять хотя бы из двух точек.');
            return;
        }
    
        const saveButton = document.getElementById('saveRoute');
        const originalButtonText = saveButton.innerHTML;
    
        // 1. Блокируем кнопку и показываем спиннер
        saveButton.disabled = true;
        saveButton.innerHTML = `<span class="spinner"></span>Сохранение...`;
    
        const payload = {
            name: routeName,
            coordinates: this.route, // Keep original manual points for editing
            fullRoute: this.getFullRoute(), // Save complete route with auto segments
            routingMode: this.routingMode,
            routingProfile: this.routingProfile,
            autoSegments: this.autoSegments
        };
    
        try {
            const response = await fetch('/api/route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
    
            if (!response.ok) {
                // Если сервер вернул ошибку, покажем ее
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка сервера');
            }
    
            const data = await response.json();
            console.log('Success:', data);
            alert('Маршрут "' + routeName + '" успешно сохранен!');
            window.dispatchEvent(new CustomEvent('routeSaved'));
    
        } catch (error) {
            console.error('Error:', error);
            alert(`Произошла ошибка при сохранении: ${error.message}`);
        } finally {
            // 2. В любом случае (успех или ошибка) возвращаем кнопку в норму
            saveButton.disabled = false;
            saveButton.innerHTML = originalButtonText;
        }
    }
    
    // Load route from coordinates
    loadRoute(coordinates, name = '') {
        // Clear current route
        this.clearRoute();
        
        // Load new route
        this.route = coordinates.map(coord => L.latLng(coord.lat, coord.lng));
        
        if (name) {
            const routeNameElement = document.getElementById('routeName');
            if (routeNameElement) {
                routeNameElement.value = name;
            }
        }
        
        this.updatePolyline();
        this.updateRouteInfo();
        
        // Fit map to route bounds
        if (this.route.length > 0) {
            if (this.route.length === 1) {
                this.map.setView(this.route[0], 15);
            } else {
                this.map.fitBounds(this.polyline.getBounds(), {padding: [20, 20]});
            }
        }
    }
    
    // Get current route data
    getRouteData() {
        return {
            coordinates: this.route,
            name: document.getElementById('routeName')?.value || '',
            distance: this.totalDistance,
            routingMode: this.routingMode,
            routingProfile: this.routingProfile,
            autoSegments: this.autoSegments,
            fullRoute: this.getFullRoute()
        };
    }

    // Get full route including automatic segments
    getFullRoute() {
        if (this.routingMode === 'manual' || this.autoSegments.length === 0) {
            return this.route;
        }

        // Combine manual points and automatic segments
        const fullRoute = [];
        fullRoute.push(this.route[0]); // Start with first manual point

        // Add automatic segments between manual points
        for (let i = 0; i < this.autoSegments.length; i++) {
            const segment = this.autoSegments[i];
            if (segment && segment.geometry && segment.geometry.coordinates) {
                // Add all coordinates from automatic segment (skip first point as it's already added)
                for (let j = 1; j < segment.geometry.coordinates.length; j++) {
                    const coord = segment.geometry.coordinates[j];
                    fullRoute.push(L.latLng(coord[1], coord[0])); // Swap lng/lat to lat/lng
                }
            }

            // Add next manual point if it exists
            if (i + 1 < this.route.length) {
                fullRoute.push(this.route[i + 1]);
            }
        }

        return fullRoute;
    }

    // ============================================================================
    // ROUTING MODES SYSTEM
    // ============================================================================

    // Set routing mode
    setRoutingMode(mode) {
        if (!['manual', 'hybrid'].includes(mode)) {
            console.error('Invalid routing mode:', mode);
            return;
        }

        this.routingMode = mode;
        console.log('Routing mode changed to:', mode);

        // Emit event for UI updates
        this.emit('routingModeChanged', { mode });
    }

    // Set routing profile
    setRoutingProfile(profile) {
        const validProfiles = ['driving', 'walking', 'cycling', 'cycling-mountain', 'cycling-gravel', 'cycling-regular'];
        if (!validProfiles.includes(profile)) {
            console.error('Invalid routing profile:', profile);
            return;
        }

        this.routingProfile = profile;
        console.log('Routing profile changed to:', profile);

        // Clear cache when profile changes
        this.routingCache.clear();

        // Emit event for UI updates
        this.emit('routingProfileChanged', { profile });
    }

    // Event system for UI communication
    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    // ============================================================================
    // HYBRID ROUTING SYSTEM
    // ============================================================================

    // Calculate hybrid route between manual points
    async calculateHybridRoute() {
        if (this.route.length < 2) {
            alert('Нужно минимум 2 точки для расчета маршрута');
            return;
        }

        if (this.pendingRouteRequest) {
            this.pendingRouteRequest.abort();
        }

        try {
            // Show loading state
            this.showRoutingLoading(true);

            // Clear existing auto segments
            this.clearAutoSegments();

            // Calculate routes between consecutive manual points
            for (let i = 0; i < this.route.length - 1; i++) {
                const startPoint = this.route[i];
                const endPoint = this.route[i + 1];

                await this.calculateAutoSegment(startPoint, endPoint, i);
            }

            this.updateRouteInfo();
            this.emit('routeChanged');

        } catch (error) {
            console.error('Error calculating hybrid route:', error);
            alert('Ошибка расчета маршрута: ' + error.message);
        } finally {
            this.showRoutingLoading(false);
        }
    }

    // Calculate automatic segment between two points
    async calculateAutoSegment(startPoint, endPoint, segmentIndex) {
        const cacheKey = this.getCacheKey(startPoint, endPoint);

        // Check cache first
        if (this.routingCache.has(cacheKey)) {
            const cached = this.routingCache.get(cacheKey);
            this.displayAutoSegment(cached.geometry, segmentIndex);
            return;
        }

        // Make API request
        const routeData = await this.requestRouteFromAPI(startPoint, endPoint);

        // Cache the result
        this.routingCache.set(cacheKey, routeData);

        // Display the segment
        this.displayAutoSegment(routeData.geometry, segmentIndex);

        // Store segment data
        this.autoSegments[segmentIndex] = {
            startPoint,
            endPoint,
            geometry: routeData.geometry,
            distance: routeData.distance,
            duration: routeData.duration
        };
    }

    // Request route from API based on selected engine and profile
    async requestRouteFromAPI(startPoint, endPoint) {
        const routingEngine = document.getElementById('routingEngine')?.value || 'osrm';

        switch (routingEngine) {
            case 'osrm':
                return this.requestRouteFromOSRM(startPoint, endPoint);
            case 'osrm-trails':
                return this.requestRouteFromOSRMTrails(startPoint, endPoint);
            case 'ors':
                return this.requestRouteFromORS(startPoint, endPoint);
            default:
                return this.requestRouteFromOSRM(startPoint, endPoint);
        }
    }

    // Request route from OSRM API
    async requestRouteFromOSRM(startPoint, endPoint) {
        const server = 'https://router.project-osrm.org/route/v1/';

        // Map bike types to OSRM profiles
        let profile;
        switch (this.routingProfile) {
            case 'cycling-mountain':
            case 'cycling-gravel':
                profile = 'cycling';
                break;
            case 'cycling-regular':
                profile = 'cycling';
                break;
            case 'walking':
                profile = 'walking';
                break;
            case 'driving':
                profile = 'driving';
                break;
            default:
                profile = 'cycling';
        }

        const url = `${server}${profile}/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;

        const params = new URLSearchParams({
            overview: 'full',
            geometries: 'geojson',
            steps: 'false',
            alternatives: 'false'
        });

        // Add cycling-specific parameters based on settings
        if (profile === 'cycling') {
            const cyclingSettings = this.getCyclingSettings();

            if (cyclingSettings.avoidHighways) {
                // OSRM doesn't support highway avoidance directly, but we can note it
                console.log('🚫 OSRM: Избегание трасс (эмулируется выбором маршрута)');
            }

            if (cyclingSettings.preferTrails) {
                console.log('🌲 OSRM: Предпочтение троп (ограниченная поддержка)');
            }

            if (cyclingSettings.allowUnpaved) {
                console.log('🪨 OSRM: Разрешены грунтовые дороги');
            }
        }

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('Route not found');
        }

        const route = data.routes[0];
        return {
            geometry: route.geometry,
            distance: route.distance,
            duration: route.duration
        };
    }

    // Request route from OSRM with trail preferences
    async requestRouteFromOSRMTrails(startPoint, endPoint) {
        console.log('🌲 Поиск маршрута с предпочтением троп...');

        // First, try to get trail data from Waymarked Trails
        const trailRoute = await this.tryWaymarkedTrails(startPoint, endPoint);
        if (trailRoute) {
            console.log('✅ Найден маршрут по тропам через Waymarked Trails');
            return trailRoute;
        }

        // Fallback to Thunderforest Outdoors
        const outdoorsRoute = await this.tryThunderforestOutdoors(startPoint, endPoint);
        if (outdoorsRoute) {
            console.log('✅ Найден маршрут через Thunderforest Outdoors');
            return outdoorsRoute;
        }

        // Ultimate fallback to standard OSRM
        console.log('⚠️ Тропы не найдены, используем стандартный OSRM');
        return this.requestRouteFromOSRM(startPoint, endPoint);
    }

    // Try Waymarked Trails API for hiking/biking routes
    async tryWaymarkedTrails(startPoint, endPoint) {
        try {
            // Waymarked Trails API - free service for hiking and cycling routes
            // Updated API endpoint
            const baseUrl = 'https://api.waymarkedtrails.org/v1';
            const bbox = this.calculateBoundingBox(startPoint, endPoint);

            // Get relations (routes) in bounding box
            const relationsUrl = `${baseUrl}/list?bbox=${bbox}&type=hiking&limit=20`;
            const relationsResponse = await fetch(relationsUrl);

            if (!relationsResponse.ok) {
                console.log('Waymarked Trails API недоступен');
                return null;
            }

            const relationsData = await relationsResponse.json();

            if (!relationsData || (Array.isArray(relationsData) && relationsData.length === 0)) {
                console.log('Тропы не найдены в данной области');
                return null;
            }

            // Handle different response formats
            let routes = [];
            if (Array.isArray(relationsData)) {
                routes = relationsData;
            } else if (relationsData.routes) {
                routes = relationsData.routes;
            } else if (relationsData.features) {
                routes = relationsData.features;
            }

            if (routes.length === 0) {
                console.log('Тропы не найдены в данной области');
                return null;
            }

            // Find the best route (closest to our start/end points)
            const bestRoute = this.findBestTrailRoute(routes, startPoint, endPoint);

            if (!bestRoute) {
                console.log('Подходящий маршрут не найден');
                return null;
            }

            // Try to get geometry from the route data
            let geometry = null;

            if (bestRoute.geometry && bestRoute.geometry.coordinates) {
                geometry = bestRoute.geometry;
            } else if (bestRoute.id) {
                // Try to get detailed geometry
                const geometryUrl = `${baseUrl}/route/${bestRoute.id}/geometry`;
                try {
                    const geometryResponse = await fetch(geometryUrl);
                    if (geometryResponse.ok) {
                        const geometryData = await geometryResponse.json();
                        if (geometryData.geometry) {
                            geometry = geometryData.geometry;
                        }
                    }
                } catch (error) {
                    console.log('Не удалось получить геометрию маршрута:', error.message);
                }
            }

            if (!geometry || !geometry.coordinates) {
                console.log('Геометрия маршрута недоступна');
                return null;
            }

            return {
                geometry: geometry,
                distance: this.calculateRouteDistance(geometry.coordinates),
                duration: this.estimateTrailDuration(geometry.coordinates, this.routingProfile)
            };

        } catch (error) {
            console.log('Ошибка при запросе к Waymarked Trails:', error.message);
            return null;
        }
    }

    // Try Thunderforest Outdoors tiles (they have routing data)
    async tryThunderforestOutdoors(startPoint, endPoint) {
        try {
            // Thunderforest Outdoors - free API key required, but has generous free tier
            const apiKey = this.apiKeys.thunderforest || localStorage.getItem('thunderforest_api_key') || '';
            const baseUrl = 'https://api.thunderforest.com/cycle/v1';

            if (!apiKey) {
                console.log('Thunderforest API key не настроен');
                return null;
            }

            const url = `${baseUrl}/${apiKey}/route/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.log('Thunderforest API недоступен');
                return null;
            }

            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                return null;
            }

            const route = data.routes[0];
            return {
                geometry: {
                    type: 'LineString',
                    coordinates: route.geometry.coordinates
                },
                distance: route.distance,
                duration: route.duration
            };

        } catch (error) {
            console.log('Ошибка при запросе к Thunderforest:', error.message);
            return null;
        }
    }

    // Calculate bounding box for API queries
    calculateBoundingBox(startPoint, endPoint) {
        const minLng = Math.min(startPoint.lng, endPoint.lng);
        const maxLng = Math.max(startPoint.lng, endPoint.lng);
        const minLat = Math.min(startPoint.lat, endPoint.lat);
        const maxLat = Math.max(startPoint.lat, endPoint.lat);

        // Add some padding
        const padding = 0.01;
        return `${minLng - padding},${minLat - padding},${maxLng + padding},${maxLat + padding}`;
    }

    // Find the best trail route from available options
    findBestTrailRoute(routes, startPoint, endPoint) {
        let bestRoute = null;
        let bestScore = Infinity;

        for (const route of routes) {
            // Try different bounding box formats
            let minLat, minLon, maxLat, maxLon;

            if (route.bounds) {
                // Format: [minLon, minLat, maxLon, maxLat] or {minlat, minlon, maxlat, maxlon}
                if (Array.isArray(route.bounds)) {
                    [minLon, minLat, maxLon, maxLat] = route.bounds;
                } else {
                    minLat = route.bounds.minlat || route.bounds.south;
                    minLon = route.bounds.minlon || route.bounds.west;
                    maxLat = route.bounds.maxlat || route.bounds.north;
                    maxLon = route.bounds.maxlon || route.bounds.east;
                }
            } else if (route.bbox) {
                [minLon, minLat, maxLon, maxLat] = route.bbox;
            }

            if (!minLat || !minLon || !maxLat || !maxLon) {
                continue; // Skip routes without bounds
            }

            // Calculate how well this route matches our start/end points
            const startDistance = this.calculateDistance(
                startPoint.lat, startPoint.lng, minLat, minLon
            );
            const endDistance = this.calculateDistance(
                endPoint.lat, endPoint.lng, maxLat, maxLon
            );

            const score = startDistance + endDistance;

            if (score < bestScore) {
                bestScore = score;
                bestRoute = route;
            }
        }

        return bestRoute;
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // Calculate route distance from coordinates
    calculateRouteDistance(coordinates) {
        let totalDistance = 0;

        for (let i = 1; i < coordinates.length; i++) {
            const [lon1, lat1] = coordinates[i - 1];
            const [lon2, lat2] = coordinates[i];
            totalDistance += this.calculateDistance(lat1, lon1, lat2, lon2);
        }

        return totalDistance * 1000; // Convert to meters
    }

    // Estimate duration for trail routes
    estimateTrailDuration(coordinates, activityType) {
        const distance = this.calculateRouteDistance(coordinates) / 1000; // km

        // Use current routing profile if activityType is not specified
        const profile = activityType || this.routingProfile;
        const cyclingSettings = this.getCyclingSettings();

        let baseSpeedKmh;
        switch (profile) {
            case 'cycling-mountain':
                baseSpeedKmh = cyclingSettings.allowUnpaved ? 15 : 12; // Faster if unpaved allowed
                break;
            case 'cycling-gravel':
                baseSpeedKmh = cyclingSettings.preferTrails ? 16 : 18; // Slower if preferring trails
                break;
            case 'cycling-regular':
                baseSpeedKmh = 22; // Road bike on paved surfaces
                break;
            case 'walking':
                baseSpeedKmh = 4; // Walking speed
                break;
            default:
                baseSpeedKmh = 15;
        }

        // Apply penalties based on cycling preferences
        let finalSpeed = baseSpeedKmh;

        if (cyclingSettings.avoidHighways && profile.includes('cycling')) {
            finalSpeed *= 0.9; // Slight penalty for avoiding highways
        }

        if (cyclingSettings.preferTrails && profile.includes('cycling')) {
            finalSpeed *= 0.85; // More penalty for preferring trails (longer routes)
        }

        console.log(`🚴‍♂️ Расчет времени: ${distance.toFixed(1)} км, профиль: ${profile}, скорость: ${finalSpeed.toFixed(1)} км/ч`);

        return (distance / finalSpeed) * 3600; // Convert to seconds
    }

    // Get current cycling settings
    getCyclingSettings() {
        return {
            avoidHighways: document.getElementById('avoidHighways')?.checked || true,
            preferTrails: document.getElementById('preferTrails')?.checked || true,
            allowUnpaved: document.getElementById('allowUnpaved')?.checked || false
        };
    }

    // Request route from OpenRouteService API
    async requestRouteFromORS(startPoint, endPoint) {
        try {
            // OpenRouteService API (requires API key, but has free tier)
            const apiKey = this.apiKeys.ors || localStorage.getItem('ors_api_key') || '';
            const server = 'https://api.openrouteservice.org/v2/directions/';

            if (!apiKey) {
                console.log('OpenRouteService API key не настроен');
                return this.requestRouteFromOSRM(startPoint, endPoint);
            }

            let profile;
            switch (this.routingProfile) {
                case 'cycling-mountain':
                    profile = 'cycling-mountain';
                    break;
                case 'cycling-gravel':
                    profile = 'cycling-regular';
                    break;
                case 'cycling-regular':
                    profile = 'cycling-regular';
                    break;
                case 'walking':
                    profile = 'foot-walking';
                    break;
                case 'driving':
                    profile = 'driving-car';
                    break;
                default:
                    profile = 'cycling-regular';
            }

            const url = `${server}${profile}?api_key=${apiKey}`;
            const body = {
                coordinates: [[startPoint.lng, startPoint.lat], [endPoint.lng, endPoint.lat]],
                format: 'geojson',
                instructions: false,
                geometry_simplify: false
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`OpenRouteService ошибка ${response.status}:`, errorText);
                console.warn('OpenRouteService недоступен, переключаюсь на OSRM');
                return this.requestRouteFromOSRM(startPoint, endPoint);
            }

            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                console.warn('OpenRouteService не нашел маршрут');
                return this.requestRouteFromOSRM(startPoint, endPoint);
            }

            const feature = data.features[0];
            console.log('✅ OpenRouteService успешно вернул маршрут');

            return {
                geometry: feature.geometry,
                distance: feature.properties.segments[0].distance,
                duration: feature.properties.segments[0].duration
            };

        } catch (error) {
            console.warn('Ошибка при запросе к OpenRouteService:', error.message);
            console.warn('Переключаюсь на OSRM');
            return this.requestRouteFromOSRM(startPoint, endPoint);
        }
    }

    // Display automatic route segment
    displayAutoSegment(geometry, segmentIndex) {
        const coordinates = geometry.coordinates.map(coord => [coord[1], coord[0]]); // Swap lng/lat to lat/lng

        const polyline = L.polyline(coordinates, {
            color: '#10b981', // Green color for auto segments
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10', // Dashed line to distinguish from manual
            className: 'auto-route-segment'
        });

        polyline.addTo(this.map);
        this.autoPolylines[segmentIndex] = polyline;
    }

    // Clear automatic segments
    clearAutoSegments() {
        this.autoPolylines.forEach(polyline => {
            if (polyline && this.map.hasLayer(polyline)) {
                this.map.removeLayer(polyline);
            }
        });

        this.autoPolylines = [];
        this.autoSegments = [];
        this.emit('autoSegmentsCleared');
    }

    // Generate cache key for route segment
    getCacheKey(startPoint, endPoint) {
        return `${this.routingProfile}_${startPoint.lat.toFixed(6)}_${startPoint.lng.toFixed(6)}_${endPoint.lat.toFixed(6)}_${endPoint.lng.toFixed(6)}`;
    }

    // Show/hide loading state
    showRoutingLoading(isLoading) {
        const calculateBtn = document.getElementById('calculateRoute');
        const loadingOverlay = document.getElementById('routingLoadingOverlay');

        if (calculateBtn) {
            calculateBtn.disabled = isLoading;
            calculateBtn.innerHTML = isLoading ? '⏳ Расчет...' : '📍 Рассчитать маршрут';
        }

        if (loadingOverlay) {
            if (isLoading) {
                loadingOverlay.classList.add('show');
            } else {
                loadingOverlay.classList.remove('show');
            }
        }
    }

    // ============================================================================
    // ENHANCED MANUAL MODE FEATURES
    // ============================================================================

    // Enhanced handleMapClick for hybrid mode
    handleMapClickEnhanced(e) {
        if (this.isMeasuring) {
            this.addMeasurementPoint(e.latlng);
            return;
        }

        if (this.routingMode === 'manual') {
            // Original manual behavior
            this.handleMapClick(e);
        } else if (this.routingMode === 'hybrid') {
            // Hybrid mode: add manual points, auto-connect them
            this.addHybridPoint(e.latlng);
        }
    }

    // Add point in hybrid mode
    addHybridPoint(latlng) {
        // Add the point
        this.addPoint(latlng);

        // If we have 2+ points, offer to calculate route
        if (this.route.length >= 2) {
            const calculateBtn = document.getElementById('calculateRoute');
            if (calculateBtn) {
                calculateBtn.disabled = false;
                // Optional: auto-calculate after short delay
                // setTimeout(() => this.calculateHybridRoute(), 1000);
            }
        }
    }
}

// Export for use in other modules
window.RoutePlanner = RoutePlanner;
